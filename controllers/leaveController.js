const { admin, db } = require("../config/firebaseConfig");
const { v4: uuidv4 } = require('uuid');

// Get leave settings list
const getLeaveSettings = async (req, res) => {
    console.log("Get leave settings called");
    try {
        const { gender, employeeId } = req.query;
        
        const leaveSettingsRef = db.collection("leave-settings");
        let query = leaveSettingsRef;
        
        // If gender filter is provided, filter by gender
        if (gender && ['male', 'female', 'all'].includes(gender.toLowerCase())) {
            if (gender.toLowerCase() !== 'all') {
                query = query.where("gender", "in", [gender.toLowerCase(), "all"]);
            }
        }
        
        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No leave settings found",
                data: [],
                count: 0
            });
        }

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

        // If employeeId is provided, also check if employee is eligible (3+ months)
        let employeeEligible = true;
        let monthsWithCompany = 0;
        
        if (employeeId) {
            try {
                const employeesRef = db.collection("employees");
                const employeeQuery = await employeesRef.where("uid", "==", employeeId).get();
                
                if (!employeeQuery.empty) {
                    const employeeDoc = employeeQuery.docs[0];
                    const employeeData = employeeDoc.data();
                    const joinDate = new Date(employeeData.joinDate);
                    const today = new Date();
                    
                    monthsWithCompany = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                                      (today.getMonth() - joinDate.getMonth());
                    
                    employeeEligible = monthsWithCompany >= 3;
                }
            } catch (error) {
                console.error("Error checking employee eligibility:", error);
            }
        }

        res.json({
            success: true,
            message: "Leave settings retrieved successfully",
            count: leaveSettings.length,
            data: leaveSettings,
            employeeEligible: employeeEligible,
            monthsWithCompany: monthsWithCompany,
            requiredMonths: 3
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
    console.log("Get employee leave list called");
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
        
        console.log(`Employee join date: ${joinDate.toISOString()}`);
        console.log(`Today: ${today.toISOString()}`);
        console.log(`Months with company: ${monthsDiff}`);

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
        const querySnapshot = await employeeLeaveRef.where("uid", "==", uid).get();

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
                uid: leaveData.uid,
                employeeId: leaveData.employeeId,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveData.leaveTypeName,
                startDate: leaveData.startDate,
                endDate: leaveData.endDate,
                totalDays: leaveData.totalDays,
                reason: leaveData.reason,
                status: leaveData.status,
                statusName: leaveData.statusName,
                approvedBy: leaveData.approvedBy,
                approvedDate: leaveData.approvedDate,
                rejectedReason: leaveData.rejectedReason,
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt,
                attachment: leaveData.attachment 
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

// Create leave request
const createLeaveRequest = async (req, res) => {
    console.log("Create leave request called");
    try {
        const { 
            employeeId, 
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
        
        // Validation
        if (!employeeId || !leaveType || !leaveTypeName || !requestType || !reason) {
            return res.status(400).json({ 
                success: false,
                message: "EmployeeId, leaveType, leaveTypeName, requestType, and reason are required" 
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

        // Create leave request data
        const leaveRequestData = {
            id: leaveRequestId,
            uid: leaveRequestId,
            employeeId: employeeId,
            leaveType: leaveType,
            leaveTypeName: leaveTypeName,
            requestType: requestType,
            reason: reason,
            attachment: attachment || null,
            status: "pending",
            statusName: "Pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
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

        console.log(`Leave request created for employee: ${employeeId}`);

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
    console.log("Get all leave requests called");
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
    console.log("Update leave request status called");
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
            updateData.approvedBy = approvedBy;
            updateData.approvedDate = new Date().toISOString();
        }

        if (status === 'rejected') {
            updateData.rejectedReason = rejectedReason;
        }

        await leaveRequestRef.update(updateData);

        console.log(`Leave request ${leaveId} status updated to ${status}`);

        res.json({
            success: true,
            message: `Leave request ${status} successfully`,
            leaveRequest: {
                id: leaveId,
                status: status,
                statusName: updateData.statusName,
                approvedBy: updateData.approvedBy,
                approvedDate: updateData.approvedDate,
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
    console.log("Get leave request by ID called");
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

module.exports = {
    getLeaveSettings,
    getEmployeeLeaveList,
    createLeaveRequest,
    getAllLeaveRequests,
    updateLeaveRequestStatus,
    getLeaveRequestById
};
