const { admin, db } = require("../config/firebaseConfig");
const { v4: uuidv4 } = require('uuid');
const { sendLeaveRequestNotification, sendLeaveStatusNotification, createInAppNotification } = require('./notificationController');

// Initialize Firebase Storage with better error handling
let bucket;
const initializeFirebaseStorage = async () => {
    try {
        if (admin.apps.length === 0) {
            console.error("❌ Firebase Admin not initialized");
            return null;
        }
        
    bucket = admin.storage().bucket();
        
        // Test if bucket exists
        try {
            const [exists] = await bucket.exists();
            if (!exists) {
                console.error("❌ Storage bucket does not exist");
                return null;
            }
        } catch (bucketError) {
            console.error("❌ Error checking bucket existence:", bucketError);
            return null;
        }
        
        return bucket;
} catch (error) {
    console.error("❌ Firebase Storage initialization error:", error);
        return null;
    }
};

// Initialize on module load
initializeFirebaseStorage().then(result => {
    bucket = result;
}).catch(error => {
    console.error("Failed to initialize Firebase Storage:", error);
    bucket = null;
});

// Upload file to Firebase Storage
const uploadFileToStorage = async (file, leaveRequestId, employeeId) => {
    try {
        // Retry initialization if bucket is null
        if (!bucket) {
            bucket = await initializeFirebaseStorage();
            if (!bucket) {
                throw new Error("Firebase Storage bucket not initialized after retry");
            }
        }
        
        const fileName = `leave-attachments/${employeeId}/${leaveRequestId}/${Date.now()}_${file.originalname}`;
        const fileUpload = bucket.file(fileName);
        
        const stream = fileUpload.createWriteStream({
            metadata: {
                contentType: file.mimetype,
                metadata: {
                    originalName: file.originalname,
                    uploadedBy: employeeId,
                    leaveRequestId: leaveRequestId,
                    uploadedAt: new Date().toISOString()
                }
            }
        });
        
        return new Promise((resolve, reject) => {
            stream.on('error', (error) => {
                console.error('❌ File upload error:', error);
                reject(error);
            });
            
            stream.on('finish', async () => {
                try {
                    // Make the file publicly accessible
                    await fileUpload.makePublic();
                    
                    // Get the public URL
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                    
                    resolve({
                        fileName: fileName,
                        originalName: file.originalname,
                        publicUrl: publicUrl,
                        size: file.size,
                        contentType: file.mimetype
                    });
                } catch (error) {
                    console.error('❌ Error making file public:', error);
                    reject(error);
                }
            });
            
            stream.end(file.buffer);
        });
    } catch (error) {
        console.error('❌ Upload file to storage error:', error);
        throw error;
    }
};

// Get leave settings list
const getLeaveSettings = async (req, res) => {
    try {
        const { gender, employeeId } = req.query;
        
        // Step 1: If employeeId is provided, FIRST check if employee is eligible (3+ months)
        let employeeEligible = true;
        let monthsWithCompany = 0;
        let employeeGender = null;
        
        if (employeeId) {
            try {
                const employeesRef = db.collection("employees");
                const employeeQuery = await employeesRef.where("uid", "==", employeeId).get();
                
                if (employeeQuery.empty) {
                    return res.status(404).json({
                        success: false,
                        message: "Employee not found"
                    });
                }
                
                const employeeDoc = employeeQuery.docs[0];
                const employeeData = employeeDoc.data();
                const joinDate = new Date(employeeData.joinDate);
                const today = new Date();
                
                monthsWithCompany = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                                  (today.getMonth() - joinDate.getMonth());
                
                employeeEligible = monthsWithCompany >= 3;
                employeeGender = employeeData.gender;
                
                
                // If not eligible, return empty array immediately
                if (!employeeEligible) {
                    return res.json({
                        success: true,
                        message: `Employee must be with company for 3+ months to access leave types. Current: ${monthsWithCompany} months`,
                        data: [],
                        count: 0,
                        employeeEligible: false,
                        monthsWithCompany: monthsWithCompany,
                        requiredMonths: 3,
                        employeeGender: employeeGender
                    });
                }
            } catch (error) {
                console.error("Error checking employee eligibility:", error);
                return res.status(500).json({
                    success: false,
                    message: "Error checking employee eligibility",
                    error: error.message
                });
            }
        }
        
        // Step 2: If eligible (or no employeeId), retrieve ALL leave settings from database
        const leaveSettingsRef = db.collection("leave-settings");
        const snapshot = await leaveSettingsRef.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No leave settings found",
                data: [],
                count: 0,
                employeeEligible: employeeEligible,
                monthsWithCompany: monthsWithCompany,
                requiredMonths: 3,
                employeeGender: employeeGender
            });
        }

        // Step 3: Get all leave settings
        const leaveSettings = [];
        snapshot.forEach(doc => {
            const leaveSettingData = doc.data();
            leaveSettings.push({
                id: doc.id,
                uid: leaveSettingData.uid,
                leaveType: leaveSettingData.title,
                leaveTypeEng: leaveSettingData.titleEng,
                maxDays: leaveSettingData.leaveDay,
                isPaid: leaveSettingData.isPaid,
                gender: leaveSettingData.gender,
                description: leaveSettingData.description,
                isActive: leaveSettingData.isActive,
                createdAt: leaveSettingData.createdDate,
                updatedAt: leaveSettingData.updatedDate
            });
        });

        // Step 4: Filter by gender (employee's gender or provided gender filter)
        let filteredLeaveSettings = leaveSettings;
        let filterGender = null;
        
        if (employeeId && employeeEligible && employeeGender) {
            // Use employee's gender for filtering
            filterGender = employeeGender;
        } else if (gender && ['male', 'female', 'all'].includes(gender.toLowerCase())) {
            // Use provided gender filter
            filterGender = gender.toLowerCase();
        }
        
        if (filterGender && filterGender !== 'all') {
            filteredLeaveSettings = leaveSettings.filter(setting => 
                setting.gender.toLowerCase() === filterGender.toLowerCase() || 
                setting.gender.toLowerCase() === 'all'
            );
        }

        let message = "Leave settings retrieved successfully";
        if (employeeId) {
            message = `Leave settings for ${employeeGender} employee (${monthsWithCompany} months with company)`;
        }

        res.json({
            success: true,
            message: message,
            count: filteredLeaveSettings.length,
            data: filteredLeaveSettings,
            employeeEligible: employeeEligible,
            monthsWithCompany: monthsWithCompany,
            requiredMonths: 3,
            employeeGender: employeeGender
        });

    } catch (error) {
        console.error("❌ Error getting leave settings:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get employee leave list filtered by UID
const getEmployeeLeaveList = async (req, res) => {
    try {
        const { uid } = req.params;
        
        if (!uid) {
            return res.status(400).json({ 
                success: false,
                message: "UID is required" 
            });
        }

        // First, get employee data to check join date
        const employeesRef = db.collection("employees");
        const employeeQuery = await employeesRef.where("uid", "==", uid).get();
        
        if (employeeQuery.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found" 
            });
        }

        const employeeDoc = employeeQuery.docs[0];
        const employeeData = employeeDoc.data();
        const joinDate = new Date(employeeData.joinDate);
        const today = new Date();
        
        // Calculate months difference
        const monthsDiff = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                          (today.getMonth() - joinDate.getMonth());
        

        // Check if employee has been with company for 3+ months
        if (monthsDiff < 3) {
            return res.json({
                success: true,
                message: "Employee must be with company for 3+ months to access leave data",
                data: [],
                count: 0,
                eligible: false,
                monthsWithCompany: monthsDiff,
                requiredMonths: 3
            });
        }

        // Get employee leave records filtered by employeeId (login user UID)
        const employeeLeaveRef = db.collection("employee-leave");
        
        // First, let's check if there are any records in the employee-leave table at all
        const allRecordsSnapshot = await employeeLeaveRef.limit(5).get();
        
        const querySnapshot = await employeeLeaveRef.where("employeeId", "==", employeeData.uid).get();

        if (querySnapshot.empty) {
            return res.json({
                success: true,
                message: "No leave records found for this employee",
                data: [],
                count: 0,
                eligible: true,
                monthsWithCompany: monthsDiff
            });
        }

        const leaveRecords = [];
        querySnapshot.forEach(doc => {
            const leaveData = doc.data();
            leaveRecords.push({
                id: doc.id,
                uid: leaveData.uid || doc.id,
                employeeId: leaveData.employeeId,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveData.leaveTypeName,
                requestType: leaveData.requestType || 'daily',
                // Daily leave fields
                startDate: leaveData.startDate || leaveData.fromDate || null,
                endDate: leaveData.endDate || leaveData.toDate || null,
                fromDate: leaveData.fromDate || leaveData.startDate || null,
                toDate: leaveData.toDate || leaveData.endDate || null,
                // Hourly leave fields
                date: leaveData.date || null,
                workingShift: leaveData.workingShift || null,
                startTime: leaveData.startTime || null,
                endTime: leaveData.endTime || null,
                // Common fields
                totalDays: leaveData.totalDays || 0,
                reason: leaveData.reason,
                status: leaveData.status || 'pending',
                statusName: leaveData.statusName || 'Pending',
                approvedBy: leaveData.approvedBy || null,
                approvedDate: leaveData.approvedDate || null,
                rejectedReason: leaveData.rejectedReason || null,
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt,
                attachment: leaveData.attachment || null
            });
        });

        // Sort by created date (newest first)
        leaveRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            message: "Employee leave records retrieved successfully",
            count: leaveRecords.length,
            data: leaveRecords,
            eligible: true,
            monthsWithCompany: monthsDiff
        });

    } catch (error) {
        console.error("❌ Error getting employee leave list:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Create leave request with file upload support
const createLeaveRequest = async (req, res) => {
   
    try {
        const { 
            employeeId, 
            employeeName,
            firstName,
            lastName,
            positionName,
            company,        // Add company code
            companyName,    // Add company name
            location,       // Add location code
            locationName,   // Add location name
            branch,         // Add branch code
            branchName,     // Add branch name
            requestDate,    // Add request date
            leaveType, 
            leaveTypeName, 
            requestType, // 'daily' or 'hourly'
            fromDate, 
            toDate, 
            date, // for hourly leave
            workingShift, // for hourly leave
            startTime, // for hourly leave
            endTime, // for hourly leave
            reason, 
            attachment 
        } = req.body;
        
        
        
        if (!employeeId || !leaveType || !leaveTypeName || !requestType || !reason) {
            const missingFields = [];
            if (!employeeId) missingFields.push("employeeId");
            if (!leaveType) missingFields.push("leaveType");
            if (!leaveTypeName) missingFields.push("leaveTypeName");
            if (!requestType) missingFields.push("requestType");
            if (!reason) missingFields.push("reason");
            
            return res.status(400).json({ 
                success: false,
                message: `Missing required fields: ${missingFields.join(", ")}`,
                missingFields: missingFields
            });
        }

        if (!['daily', 'hourly'].includes(requestType)) {
            return res.status(400).json({ 
                success: false,
                message: "Request type must be 'daily' or 'hourly'" 
            });
        }

        // Validate daily leave
        if (requestType === 'daily') {
            if (!fromDate || !toDate) {
                return res.status(400).json({ 
                    success: false,
                    message: "From date and to date are required for daily leave" 
                });
            }
        }

        // Validate hourly leave
        if (requestType === 'hourly') {
            if (!date || !workingShift || !startTime || !endTime) {
                return res.status(400).json({ 
                    success: false,
                    message: "Date, working shift, start time, and end time are required for hourly leave" 
                });
            }
        }

        // Calculate total days for daily leave
        let totalDays = 0;
        if (requestType === 'daily') {
            const start = new Date(fromDate);
            const end = new Date(toDate);
            const timeDiff = end.getTime() - start.getTime();
            totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
        }

        // Generate unique leave request ID and UUID v4
        const leaveRequestId = uuidv4();

        // Handle file uploads
        let attachmentData = null;
        if (req.files && req.files.length > 0) {
            try {
                const uploadedFiles = [];
                for (const file of req.files) {
                    const uploadResult = await uploadFileToStorage(file, leaveRequestId, employeeId);
                    uploadedFiles.push(uploadResult);
                }
                attachmentData = {
                    files: uploadedFiles,
                    count: uploadedFiles.length,
                    uploadedAt: new Date().toISOString()
                };
            } catch (uploadError) {
                console.error("❌ File upload failed:", uploadError);
                return res.status(500).json({
                    success: false,
                    message: "File upload failed",
                    error: uploadError.message
                });
            }
        } else if (attachment) {
            // Handle text-based attachment (legacy support)
            attachmentData = attachment;
        }

        // Use provided company/location/branch data, with fallback to employee data
        let finalCompany = company;
        let finalCompanyName = companyName;
        let finalLocation = location;
        let finalLocationName = locationName;
        let finalBranch = branch;
        let finalBranchName = branchName;
        
        // Fallback: Get employee data if company/location/branch not provided
        if (!finalCompany || !finalCompanyName || !finalLocation || !finalLocationName || !finalBranch || !finalBranchName) {
        const employeesRef = db.collection("employees");
        const employeeQuery = await employeesRef.where("uid", "==", employeeId).get();
        
        if (!employeeQuery.empty) {
            const employeeData = employeeQuery.docs[0].data();
                finalCompany = finalCompany || employeeData.company || "NANO";
                finalCompanyName = finalCompanyName || employeeData.companyName || "NANO Company";
                finalLocation = finalLocation || employeeData.location || "BKK";
                finalLocationName = finalLocationName || employeeData.locationName || "Bangkok";
                finalBranch = finalBranch || employeeData.branch || "001";
                finalBranchName = finalBranchName || employeeData.branchName || "Main Branch";
            } else {
                // Ultimate fallback
                finalCompany = finalCompany || "NANO";
                finalCompanyName = finalCompanyName || "NANO Company";
                finalLocation = finalLocation || "BKK";
                finalLocationName = finalLocationName || "Bangkok";
                finalBranch = finalBranch || "001";
                finalBranchName = finalBranchName || "Main Branch";
            }
        }
        

        // Get employee data to check their role (for approver auto-approval)
        const employeesRef = db.collection("employees");
        const employeeQuery = await employeesRef.where("uid", "==", employeeId).get();
        
        let employeeRole = null;
        if (!employeeQuery.empty) {
            const employeeData = employeeQuery.docs[0].data();
            employeeRole = employeeData.role;
        }
        
        // Determine first approver based on requester's position/role
        // This prevents people from approving their own leave requests
        let firstApprover = "manager";  // Default for regular employees
        let initialStatus = "pending";
        let initialStatusName = "Pending";
        
        // Define positions that go through normal manager approval
        const requiresManagerApproval = ["Salesman", "Programmer"];
        
        // Check if requester is a final approver (highest level)
        if (employeeRole === "approver" || employeeRole === "approver-three") {
            // Approver requests leave → Auto-approve (no one above them)
            firstApprover = null;
            initialStatus = "approved";
            initialStatusName = "Approved";
        } else if (positionName === "Manager") {
            // Manager requests leave → Skip manager level, go to HR
            firstApprover = "hr";
        } else if (positionName === "HR") {
            // HR requests leave → Skip both manager and HR, go to final approver
            firstApprover = "approver";
        } else if (requiresManagerApproval.includes(positionName)) {
            // Salesman and Programmer → Go through manager approval
            firstApprover = "manager";
        } else {
            // Other positions (excluding Programmer and Salesman) → Skip manager, go to HR directly
            firstApprover = "hr";
        }

        // Create leave request data
        const currentDateTime = new Date().toISOString();
        const leaveRequestData = {
            id: leaveRequestId,
            uid: leaveRequestId,
            employeeId: employeeId,
            employeeName: employeeName,
            firstName: firstName,
            lastName: lastName,
            positionName: positionName,
            company: finalCompany,           // Store company code
            companyName: finalCompanyName,   // Store company name
            location: finalLocation,         // Store location code
            locationName: finalLocationName, // Store location name
            branch: finalBranch,             // Store branch code
            branchName: finalBranchName,     // Store branch name
            branchCode: finalBranch,         // Legacy compatibility
            requestDate: requestDate || currentDateTime.split('T')[0], // Use provided date or current date (YYYY-MM-DD)
            leaveType: leaveType,
            leaveTypeName: leaveTypeName,
            requestType: requestType,
            reason: reason,
            attachment: attachmentData,
            status: initialStatus,
            statusName: initialStatusName,
            // Approval workflow fields
            approvalLevel: "employee",
            currentApprover: firstApprover,  // Smart routing based on position
            createdAt: currentDateTime,
            updatedAt: currentDateTime
        };

        // Add daily leave specific fields
        if (requestType === 'daily') {
            leaveRequestData.fromDate = fromDate;
            leaveRequestData.toDate = toDate;
            leaveRequestData.totalDays = totalDays;
        }

        // Add hourly leave specific fields
        if (requestType === 'hourly') {
            leaveRequestData.date = date;
            leaveRequestData.workingShift = workingShift;
            leaveRequestData.startTime = startTime;
            leaveRequestData.endTime = endTime;
            leaveRequestData.totalDays = 0; // Hourly leave doesn't count as full days
        }

        // Save to Firestore using custom document ID
        const leaveRequestRef = db.collection("employee-leave").doc(leaveRequestId);
        await leaveRequestRef.set(leaveRequestData);
        const leaveRequestDoc = await leaveRequestRef.get();
        const savedLeaveRequest = leaveRequestDoc.data();


        // Send notification to appropriate approver based on routing (async, don't wait for it)
        // Skip notification if auto-approved (firstApprover is null)
        if (firstApprover !== null) {
            try {
                let approverIds = [];
                
                // Get employee data to find their manager
                const employeesRef = db.collection("employees");
                const employeeQuery = await employeesRef.where("uid", "==", employeeId).get();
            
            if (!employeeQuery.empty) {
                const employeeData = employeeQuery.docs[0].data();
                const branchCode = employeeData.branch || "001";
                
                // Route notification based on firstApprover
                if (firstApprover === "manager") {
                    // Find managers for this branch
                    
                    const managersWithManagedBranchesQuery = await employeesRef
                        .where("positionName", "==", "Manager")
                        .get();
                    
                    const managersWithManagedBranches = [];
                    managersWithManagedBranchesQuery.forEach(doc => {
                        const managerData = doc.data();
                        if (managerData.managedBranches && Array.isArray(managerData.managedBranches)) {
                            if (managerData.managedBranches.includes(branchCode)) {
                                managersWithManagedBranches.push({
                                    id: doc.id,
                                    uid: managerData.uid,
                                    firstName: managerData.firstName,
                                    lastName: managerData.lastName
                                });
                            }
                        }
                    });
                    
                    // Fallback - find manager in same branch
                    const sameBranchManagerQuery = await employeesRef
                        .where("branch", "==", branchCode)
                        .where("positionName", "==", "Manager")
                        .limit(1)
                        .get();
                    
                    const sameBranchManagers = [];
                    sameBranchManagerQuery.forEach(doc => {
                        const managerData = doc.data();
                        sameBranchManagers.push({
                            id: doc.id,
                            uid: managerData.uid
                        });
                    });
                    
                    const allManagers = [...managersWithManagedBranches, ...sameBranchManagers];
                    const uniqueManagers = allManagers.filter((manager, index, self) => 
                        index === self.findIndex(m => m.id === manager.id)
                    );
                    
                    approverIds = uniqueManagers.map(manager => manager.uid);
                    
                } else if (firstApprover === "hr") {
                    // Find HR personnel
                    const hrQuery = await employeesRef.where("positionName", "==", "HR").get();
                    
                    hrQuery.forEach(doc => {
                        const hrData = doc.data();
                        approverIds.push(hrData.uid);
                    });
                    
                } else if (firstApprover === "approver") {
                    // Find final approvers
                    const approverQuery = await employeesRef.where("role", "in", ["approver", "approver-three"]).get();
                    
                    approverQuery.forEach(doc => {
                        const approverData = doc.data();
                        approverIds.push(approverData.uid);
                    });
                }
                
                if (approverIds.length === 0) {
                }
            } else {
            }
            
            // Send notifications to all found approvers
            if (approverIds.length > 0) {
                
                for (const approverId of approverIds) {
                    sendLeaveRequestNotification({
                        body: {
                            employeeId: employeeId,
                            leaveRequestId: leaveRequestId,
                            leaveType: leaveTypeName,
                            fromDate: fromDate || date,
                            toDate: toDate || date,
                            reason: reason,
                            managerId: approverId,  // Keep field name for compatibility
                            approverLevel: firstApprover,  // Add which level this is
                            channels: ['in_app', 'push']
                        }
                    }, {
                        json: () => {}
                    }).catch(notifError => {
                        console.error(`❌ Failed to send leave request notification to ${firstApprover} ${approverId}:`, notifError);
                    });
                    
                }
            } else {
            }
            } catch (notifError) {
                console.error("❌ Error sending notification:", notifError);
            }
        } else {
        }

        res.json({
            success: true,
            message: "Leave request created successfully",
            leaveRequest: {
                id: savedLeaveRequest.id,
                uid: savedLeaveRequest.uid,
                employeeId: savedLeaveRequest.employeeId,
                leaveType: savedLeaveRequest.leaveType,
                leaveTypeName: savedLeaveRequest.leaveTypeName,
                requestType: savedLeaveRequest.requestType,
                reason: savedLeaveRequest.reason,
                attachment: savedLeaveRequest.attachment,
                status: savedLeaveRequest.status,
                statusName: savedLeaveRequest.statusName,
                totalDays: savedLeaveRequest.totalDays,
                createdAt: savedLeaveRequest.createdAt,
                updatedAt: savedLeaveRequest.updatedAt,
                // Daily leave fields
                ...(requestType === 'daily' && {
                    fromDate: savedLeaveRequest.fromDate,
                    toDate: savedLeaveRequest.toDate
                }),
                // Hourly leave fields
                ...(requestType === 'hourly' && {
                    date: savedLeaveRequest.date,
                    workingShift: savedLeaveRequest.workingShift,
                    startTime: savedLeaveRequest.startTime,
                    endTime: savedLeaveRequest.endTime
                })
            }
        });

    } catch (error) {
        console.error("❌ Error creating leave request:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get all leave requests (for admin/HR)
const getAllLeaveRequests = async (req, res) => {
    try {
        const { status, employeeId, page = 1, limit = 10 } = req.query;
        
        let query = db.collection("employee-leave");
        
        // Apply filters
        if (status) {
            query = query.where("status", "==", status);
        }
        
        if (employeeId) {
            query = query.where("employeeId", "==", employeeId);
        }
        
        // Order by created date (newest first)
        query = query.orderBy("createdAt", "desc");
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No leave requests found",
                data: [],
                count: 0,
                totalPages: 0,
                currentPage: parseInt(page)
            });
        }

        const leaveRequests = [];
        snapshot.forEach(doc => {
            const leaveData = doc.data();
            leaveRequests.push({
                id: doc.id,
                uid: leaveData.uid,
                employeeId: leaveData.employeeId,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveData.leaveTypeName,
                requestType: leaveData.requestType,
                reason: leaveData.reason,
                status: leaveData.status,
                statusName: leaveData.statusName,
                totalDays: leaveData.totalDays,
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt,
                // Daily leave fields
                ...(leaveData.requestType === 'daily' && {
                    fromDate: leaveData.fromDate,
                    toDate: leaveData.toDate
                }),
                // Hourly leave fields
                ...(leaveData.requestType === 'hourly' && {
                    date: leaveData.date,
                    workingShift: leaveData.workingShift,
                    startTime: leaveData.startTime,
                    endTime: leaveData.endTime
                })
            });
        });

        // Pagination
        const totalRecords = leaveRequests.length;
        const totalPages = Math.ceil(totalRecords / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedData = leaveRequests.slice(startIndex, endIndex);

        res.json({
            success: true,
            message: "Leave requests retrieved successfully",
            count: paginatedData.length,
            totalRecords: totalRecords,
            totalPages: totalPages,
            currentPage: parseInt(page),
            data: paginatedData
        });

    } catch (error) {
        console.error("❌ Error getting all leave requests:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Update leave request status (approve/reject)
const updateLeaveRequestStatus = async (req, res) => {
    try {
        const { leaveId } = req.params;
        const { status, approvedBy, rejectedReason } = req.body;
        
        if (!leaveId || !status) {
            return res.status(400).json({ 
                success: false,
                message: "Leave ID and status are required" 
            });
        }

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                message: "Status must be 'approved', 'rejected', or 'pending'" 
            });
        }

        if (status === 'approved' && !approvedBy) {
            return res.status(400).json({ 
                success: false,
                message: "Approver employee ID is required for approval" 
            });
        }

        // Get the leave request
        const leaveRequestRef = db.collection("employee-leave").doc(leaveId);
        const leaveRequestDoc = await leaveRequestRef.get();
        
        if (!leaveRequestDoc.exists) {
            return res.status(404).json({ 
                success: false,
                message: "Leave request not found" 
            });
        }

        const leaveData = leaveRequestDoc.data();
        
        // Update the leave request
        const updateData = {
            status: status,
            statusName: status.charAt(0).toUpperCase() + status.slice(1),
            updatedAt: new Date().toISOString()
        };

        if (status === 'approved') {
            updateData.approvedBy = approvedBy; // Store employee ID of approver
            updateData.approvedDate = new Date().toISOString();
            
            // Determine specific approval status based on approver role
            const employeesRef = db.collection("employees");
            const approverQuery = await employeesRef.where("uid", "==", approvedBy).get();
            
            if (!approverQuery.empty) {
                const approverData = approverQuery.docs[0].data();
                const approverPosition = approverData.positionName;
                
                // Set specific status based on approver role
                if (approverPosition === 'Manager') {
                    updateData.status = 'approved_manager';
                    updateData.statusName = 'Approved by Manager';
                } else if (approverPosition === 'HR') {
                    updateData.status = 'approved_hr';
                    updateData.statusName = 'Approved by HR';
                } else {
                    // Final approver or other roles
                    updateData.status = 'approved';
                    updateData.statusName = 'Approved';
                }
                
            } else {
                // Fallback if approver not found
                updateData.status = 'approved';
                updateData.statusName = 'Approved';
            }
        }

        if (status === 'rejected') {
            updateData.rejectedBy = approvedBy; // Store employee ID of rejecter
            updateData.rejectedDate = new Date().toISOString();
            updateData.rejectedReason = rejectedReason;
        }

        await leaveRequestRef.update(updateData);


        // Send notification to employee about status change (async, don't wait for it)
        try {
            
            sendLeaveStatusNotification({
                body: {
                    employeeId: leaveData.employeeId,
                    leaveRequestId: leaveId,
                    status: status,
                    approvedBy: approvedBy,
                    reason: rejectedReason || `Leave request ${status}`,
                    leaveType: leaveData.leaveTypeName,
                    fromDate: leaveData.fromDate,
                    toDate: leaveData.toDate,
                    employeeName: leaveData.employeeName, // From stored data
                    firstName: leaveData.firstName,       // From stored data
                    lastName: leaveData.lastName,         // From stored data
                    positionName: leaveData.positionName, // From stored data
                    channels: ['in_app', 'push'] // Only FREE channels
                }
            }, {
                json: () => {}
            }).catch(notifError => {
                console.error(`❌ Failed to send ${status} notification to employee:`, notifError);
            });

            // If approved by manager, also notify HR
            if (updateData.status === 'approved_manager') {
                
                // Get approver data to check if they are a manager
                const employeesRef = db.collection("employees");
                const approverQuery = await employeesRef.where("uid", "==", approvedBy).get();
                
                if (!approverQuery.empty) {
                    const approverData = approverQuery.docs[0].data();
                    
                    if (approverData.positionName === 'Manager') {
                        
                        // Find HR personnel
                        const hrQuery = await employeesRef.where("positionName", "==", "HR").get();
                        
                        if (!hrQuery.empty) {
                            hrQuery.forEach(hrDoc => {
                                const hrData = hrDoc.data();
                                // Ensure recipientId is correct
                                
                                // Create HR notification
                                createInAppNotification(
                                    hrData.uid,
                                    'Manager Approved Leave Request',
                                    `${approverData.firstName} ${approverData.lastName} approved ${leaveData.leaveTypeName} request from employee ${leaveData.employeeId}`,
                                    'leave_approved_by_manager',
                                    {
                                        leaveRequestId: leaveId, // Include leave request ID for navigation
                                        employeeId: leaveData.employeeId,
                                        managerId: approvedBy,
                                        managerName: `${approverData.firstName} ${approverData.lastName}`,
                                        leaveType: leaveData.leaveTypeName,
                                        fromDate: leaveData.fromDate,
                                        toDate: leaveData.toDate
                                    }
                                ).catch(hrNotifError => {
                                    console.error(`❌ Failed to send HR notification:`, hrNotifError);
                                });
                            });
                        } else {
                        }
                    } else {
                    }
                } else {
                }
            }
        } catch (notifError) {
            console.error("❌ Error sending notifications:", notifError);
        }

        res.json({
            success: true,
            message: `Leave request ${status} successfully`,
            leaveRequest: {
                id: leaveId,
                status: status,
                statusName: updateData.statusName,
                approvedBy: updateData.approvedBy,
                approvedDate: updateData.approvedDate,
                rejectedBy: updateData.rejectedBy,
                rejectedDate: updateData.rejectedDate,
                rejectedReason: updateData.rejectedReason,
                updatedAt: updateData.updatedAt
            }
        });

    } catch (error) {
        console.error("❌ Error updating leave request status:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get leave request by ID
const getLeaveRequestById = async (req, res) => {
    try {
        const { leaveId } = req.params;
        
        if (!leaveId) {
            return res.status(400).json({ 
                success: false,
                message: "Leave ID is required" 
            });
        }

        const leaveRequestRef = db.collection("employee-leave").doc(leaveId);
        const leaveRequestDoc = await leaveRequestRef.get();
        
        if (!leaveRequestDoc.exists) {
            return res.status(404).json({ 
                success: false,
                message: "Leave request not found" 
            });
        }

        const leaveData = leaveRequestDoc.data();

        res.json({
            success: true,
            message: "Leave request retrieved successfully",
            leaveRequest: {
                id: leaveRequestDoc.id,
                uid: leaveData.uid,
                employeeId: leaveData.employeeId,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveData.leaveTypeName,
                requestType: leaveData.requestType,
                reason: leaveData.reason,
                attachment: leaveData.attachment,
                status: leaveData.status,
                statusName: leaveData.statusName,
                totalDays: leaveData.totalDays,
                approvedBy: leaveData.approvedBy,
                approvedDate: leaveData.approvedDate,
                rejectedReason: leaveData.rejectedReason,
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt,
                // Daily leave fields
                ...(leaveData.requestType === 'daily' && {
                    fromDate: leaveData.fromDate,
                    toDate: leaveData.toDate
                }),
                // Hourly leave fields
                ...(leaveData.requestType === 'hourly' && {
                    date: leaveData.date,
                    workingShift: leaveData.workingShift,
                    startTime: leaveData.startTime,
                    endTime: leaveData.endTime
                })
            }
        });

    } catch (error) {
        console.error("❌ Error getting leave request by ID:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get leave requests by approval level and branch
const getLeaveRequestsByApprovalLevel = async (req, res) => {
    try {
        const { level, branchCode, userId } = req.query;
        
        
        // For managers, automatically get their managed branches
        let managedBranches = [];
        if (level === "manager" && userId) {
            try {
                const employeesRef = db.collection("employees");
                const managerQuery = await employeesRef.where("uid", "==", userId).get();
                
                if (!managerQuery.empty) {
                    const managerData = managerQuery.docs[0].data();
                    managedBranches = managerData.managedBranches || [];
                    
                    // Fallback: if no managedBranches, use their own branch
                    if (managedBranches.length === 0 && managerData.branch) {
                        managedBranches = [managerData.branch];
                    }
                    
                } else {
                }
            } catch (error) {
                console.error("❌ Error fetching manager data:", error);
            }
        }
        
        let query = db.collection("employee-leave");
        
        // Filter by approval level
        if (level) {
            query = query.where("currentApprover", "==", level);
        }
        
        // Filter by status (only pending for approval)
        // Note: HR needs to see both "pending" (manager's own requests) and "approved_manager" (regular employee requests)
        if(level === "manager"){
            query = query.where("status", "==", "pending");
        }
        if(level === "hr"){
            // HR sees: "pending" (manager requests) OR "approved_manager" (regular employee requests)
            // Since Firestore doesn't support OR in same field, we filter by currentApprover only
            // and handle status in post-processing
            query = query.where("status", "in", ["pending", "approved_manager"]);
        }
        if(level === "approver"){
            // Approver sees: "pending" (HR requests) OR "approved_hr" (regular flow)
            query = query.where("status", "in", ["pending", "approved_hr"]);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.json({
                success: true,
                message: `No pending leave requests found for ${level} approval`,
                data: [],
                count: 0,
                managedBranches: managedBranches
            });
        }
        
        const allLeaveRequests = [];
        snapshot.forEach(doc => {
            const leaveData = doc.data();
            allLeaveRequests.push({
                id: doc.id,
                uid: leaveData.uid || doc.id,
                employeeId: leaveData.employeeId,
                employeeName: leaveData.employeeName,
                firstName: leaveData.firstName,
                lastName: leaveData.lastName,
                positionName: leaveData.positionName,
                company: leaveData.company,
                companyName: leaveData.companyName,
                location: leaveData.location,
                locationName: leaveData.locationName,
                branch: leaveData.branch,
                branchName: leaveData.branchName,
                branchCode: leaveData.branchCode || leaveData.branch, // Legacy compatibility
                requestDate: leaveData.requestDate,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveData.leaveTypeName,
                requestType: leaveData.requestType || 'daily',
                startDate: leaveData.startDate || leaveData.fromDate || null,
                endDate: leaveData.endDate || leaveData.toDate || null,
                totalDays: leaveData.totalDays || 0,
                reason: leaveData.reason,
                status: leaveData.status,
                statusName: leaveData.statusName,
                currentApprover: leaveData.currentApprover,
                approvalLevel: leaveData.approvalLevel,
                approvalHistory: leaveData.approvalHistory || [],
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt
            });
        });
        
        // Filter by manager's managed branches and employee position (if manager level)
        let leaveRequests = allLeaveRequests;
        if (level === "manager" && managedBranches.length > 0) {
            leaveRequests = allLeaveRequests.filter(request => {
                // Check if request is from manager's managed branches
                const fromManagedBranch = managedBranches.includes(request.branchCode);
                
                // Managers can approve requests from Salesman and Programmer (positions that require manager approval)
                const requiresManagerApproval = request.positionName === "Salesman" || request.positionName === "Programmer";
                
                // Manager can see requests from their managed branches AND from positions that require manager approval
                return fromManagedBranch && requiresManagerApproval;
            });
        }
        
        // Also support manual branch filtering (optional) - ONLY for managers
        if (branchCode && level === "manager") {
            leaveRequests = leaveRequests.filter(request => 
                request.branchCode === branchCode
            );
        }
        
        // HR and approver see ALL requests (no branch filtering)
        
        // Sort by created date (oldest first for approval queue)
        leaveRequests.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        res.json({
            success: true,
            message: `Leave requests for ${level} approval retrieved successfully`,
            count: leaveRequests.length,
            data: leaveRequests
        });
        
    } catch (error) {
        console.error("❌ Error getting leave requests by approval level:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Approve leave request (multi-level)
const approveLeaveRequest = async (req, res) => {
    
    try {
        const { leaveId } = req.params;
        const { userId, comment, action } = req.body; // action: approve/reject
        
        if (!leaveId || !userId || !action) {
            return res.status(400).json({ 
                success: false,
                message: "Leave ID, user ID, and action are required" 
            });
        }
        
        // Get the leave request
        const leaveRequestRef = db.collection("employee-leave").doc(leaveId);
        const leaveRequestDoc = await leaveRequestRef.get();
        
        if (!leaveRequestDoc.exists) {
            return res.status(404).json({ 
                success: false,
                message: "Leave request not found" 
            });
        }
        
        const leaveData = leaveRequestDoc.data();
        
        // Verify user's actual role from database
        const employeesRef = db.collection("employees");
        const userQuery = await employeesRef.where("uid", "==", userId).get();
        
        if (userQuery.empty) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }
        
        const userData = userQuery.docs[0].data();
        const actualUserRole = userData.role; // For approvers
        const actualPositionName = userData.positionName; // For manager and HR
        
        
        // Check permission based on approval level
        // Manager and HR: Check positionName
        // Approver: Check role
        let canApprove = false;
        let userApprovalLevel = null;
        
        if (leaveData.currentApprover === "manager" && actualPositionName === "Manager") {
            canApprove = true;
            userApprovalLevel = "manager";
        } else if (leaveData.currentApprover === "hr" && actualPositionName === "HR") {
            canApprove = true;
            userApprovalLevel = "hr";
        } else if (leaveData.currentApprover === "approver" && (actualUserRole === "approver" || actualUserRole === "approver-three")) {
            canApprove = true;
            userApprovalLevel = "approver";
        }
        
        if (!canApprove) {
            return res.status(403).json({ 
                success: false,
                message: `You don't have permission to approve at ${leaveData.currentApprover} level. Your position: ${actualPositionName}, role: ${actualUserRole}` 
            });
        }
        
        // Determine next approval level based on current approval level
        let nextApprover = null;
        let newStatus = "pending";
        
        if (action === "approve") {
            switch (userApprovalLevel) {
                case "manager":
                    nextApprover = "hr";
                    newStatus = "approved_manager";
                    break;
                case "hr":
                    nextApprover = "approver";
                    newStatus = "approved_hr";
                    break;
                case "approver":
                    nextApprover = null;
                    newStatus = "approved";
                    break;
                default:
                    return res.status(400).json({ 
                        success: false,
                        message: "Invalid user level for approval" 
                    });
            }
        } else if (action === "reject") {
            nextApprover = null;
            newStatus = "rejected";
        }
        
        // Update leave request
        const updateData = {
            status: newStatus,
            statusName: getStatusDisplayName(newStatus),
            currentApprover: nextApprover,
            updatedAt: new Date().toISOString()
        };
        
        // Helper function to get proper status display names
        function getStatusDisplayName(status) {
            switch (status) {
                case 'approved_manager':
                    return 'Approved by Manager';
                case 'approved_hr':
                    return 'Approved by HR';
                case 'approved':
                    return 'Approved';
                case 'rejected':
                    return 'Rejected';
                case 'pending':
                    return 'Pending';
                default:
                    return status.charAt(0).toUpperCase() + status.slice(1);
            }
        }
        
        // Add approval history
        const approvalEntry = {
            level: userApprovalLevel,
            action: action,
            userId: userId,
            timestamp: new Date().toISOString(),
            comment: comment || `${action} by ${userApprovalLevel}`
        };
        
        const currentHistory = leaveData.approvalHistory || [];
        currentHistory.push(approvalEntry);
        updateData.approvalHistory = currentHistory;
        
        await leaveRequestRef.update(updateData);
        

        // Send notification to employee about status change (async, don't wait for it)
        try {
            
            sendLeaveStatusNotification({
                body: {
                    employeeId: leaveData.employeeId,
                    leaveRequestId: leaveId,
                    status: newStatus,
                    approvedBy: userId,
                    reason: comment || `Leave request ${action} by ${userApprovalLevel}`,
                    leaveType: leaveData.leaveTypeName,
                    fromDate: leaveData.fromDate || leaveData.date,
                    toDate: leaveData.toDate || leaveData.date,
                    employeeName: leaveData.employeeName, // From stored data
                    firstName: leaveData.firstName,       // From stored data
                    lastName: leaveData.lastName,         // From stored data
                    positionName: leaveData.positionName, // From stored data
                    channels: ['in_app', 'push'] // Only FREE channels
                }
            }, {
                json: () => {}
            }).catch(notifError => {
                console.error(`❌ Failed to send ${action} notification to employee:`, notifError);
            });

            // If approved by manager, also notify HR
            if (action === 'approve' && userApprovalLevel === 'manager') {
                
                // Get approver data for notification
                const employeesRef = db.collection("employees");
                const approverQuery = await employeesRef.where("uid", "==", userId).get();
                
                let approverName = userId;
                if (!approverQuery.empty) {
                    const approverData = approverQuery.docs[0].data();
                    approverName = `${approverData.firstName} ${approverData.lastName}`;
                }
                
                // Find HR personnel
                const hrQuery = await employeesRef.where("positionName", "==", "HR").get();
                
                if (!hrQuery.empty) {
                    hrQuery.forEach(hrDoc => {
                        const hrData = hrDoc.data();
                        
                        // Create HR notification
                        createInAppNotification(
                            hrData.uid,
                            'Manager Approved Leave Request',
                            `${approverName} approved ${leaveData.leaveTypeName} request from employee ${leaveData.employeeId}`,
                            'leave_approved_by_manager',
                            {
                                leaveRequestId: leaveId, // Include leave request ID for navigation
                                employeeId: leaveData.employeeId,
                                managerId: userId,
                                managerName: approverName,
                                leaveType: leaveData.leaveTypeName,
                                fromDate: leaveData.fromDate || leaveData.date,
                                toDate: leaveData.toDate || leaveData.date,
                                comment: comment
                            }
                        ).catch(hrNotifError => {
                            console.error(`❌ Failed to send HR notification:`, hrNotifError);
                        });
                    });
                } else {
                }
            }
            
            // If approved by HR, also notify final Approver
            if (action === 'approve' && userApprovalLevel === 'hr') {
                
                // Get HR data for notification
                const employeesRef = db.collection("employees");
                const hrApproverQuery = await employeesRef.where("uid", "==", userId).get();
                
                let hrApproverName = userId;
                if (!hrApproverQuery.empty) {
                    const hrApproverData = hrApproverQuery.docs[0].data();
                    hrApproverName = `${hrApproverData.firstName} ${hrApproverData.lastName}`;
                }
                
                // Find final Approver personnel by role (support multiple approver roles)
                const finalApproverQuery = await employeesRef.where("role", "in", ["approver", "approver-three"]).get();
                
                if (!finalApproverQuery.empty) {
                    finalApproverQuery.forEach(approverDoc => {
                        const approverData = approverDoc.data();
                        
                        // Create Approver notification
                        createInAppNotification(
                            approverData.uid,
                            'HR Approved Leave Request',
                            `${hrApproverName} approved ${leaveData.leaveTypeName} request from employee ${leaveData.employeeId}`,
                            'leave_approved_by_hr',
                            {
                                leaveRequestId: leaveId,
                                employeeId: leaveData.employeeId,
                                hrId: userId,
                                hrName: hrApproverName,
                                leaveType: leaveData.leaveTypeName,
                                fromDate: leaveData.fromDate || leaveData.date,
                                toDate: leaveData.toDate || leaveData.date,
                                comment: comment
                            }
                        ).catch(approverNotifError => {
                            console.error(`❌ Failed to send Approver notification:`, approverNotifError);
                        });
                    });
                } else {
                }
            }
        } catch (notifError) {
            console.error("❌ Error sending notifications:", notifError);
        }
        
        res.json({
            success: true,
            message: `Leave request ${action} successfully`,
            leaveRequest: {
                id: leaveId,
                status: newStatus,
                statusName: updateData.statusName,
                currentApprover: nextApprover,
                approvalHistory: currentHistory
            }
        });
        
    } catch (error) {
        console.error("❌ Error approving leave request:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

module.exports = {
    getLeaveSettings,
    getEmployeeLeaveList,
    createLeaveRequest,
    getAllLeaveRequests,
    updateLeaveRequestStatus,
    getLeaveRequestById,
    getLeaveRequestsByApprovalLevel,
    approveLeaveRequest
};
