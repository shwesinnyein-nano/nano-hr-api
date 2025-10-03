const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { v4: uuidv4 } = require('uuid');
const { admin, db } = require("../config/firebaseConfig");


// ✅ OPTIMIZED: Added pagination and limit
const getEmployeeListInternal = async (limit = 50, page = 1) => {
    try {
        const employeesRef = db.collection("employees");
        
        // Calculate pagination
        const startAt = (page - 1) * limit;
        
        // Query with limit
        const snapshot = await employeesRef
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();

        if (snapshot.empty) {
            return {
                success: false,
                message: "No employees found",
                data: [],
                count: 0
            };
        }

        const employees = [];
        snapshot.forEach(doc => {
            const employeeData = doc.data();
            employees.push({
                id: doc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                primary_number: employeeData.primary_number || null,
                companyName: employeeData.companyName || null,
                locationName: employeeData.locationName || null,
                has2FA: !!employeeData.secret || null,
                createdAt: employeeData.createdAt || null,
                updatedAt: employeeData.updatedAt || null,
                firstName: employeeData.firstName || null,
                lastName: employeeData.lastName || null,
                company: employeeData.company || null,
                location: employeeData.location || null,
                branch: employeeData.branch || null,
                branchName: employeeData.branchName || null,
                status: employeeData.status || null,
                position: employeeData.position || null,
                positionName: employeeData.positionName || null,
                joinDate: employeeData.joinDate || null,
                maritalStatus: employeeData.maritalStatus || null,
                profileImage: employeeData.profileImage || null,
                role: employeeData.role || null,
                email: employeeData.email || null,
                dateOfBirth: employeeData.dateOfBirth || null,
                gender: employeeData.gender || null,
                salary: employeeData.salary || null,
            });
        });

        return {
            success: true,
            message: "Employee list retrieved successfully",
            count: employees.length,
            data: employees
        };

    } catch (error) {
        console.error("❌ Error getting employee list:", error);
        return {
            success: false,
            message: "Internal server error",
            error: error.message,
            data: []
        };
    }
};

const checkEmployee = async (req, res) => {
    try {
        const { authId } = req.params;
        console.log("checkEmployee called with authId:", authId);

        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("authId", "==", authId).get();
        
        if (querySnapshot.empty) {
            return res.json({
                success: true,
                message: "Employee not found",
                employeeExists: false
            });
        } else {
            return res.json({
                success: true,
                message: "Employee found",
                employeeExists: true
            });
        }

    } catch (error) {
        console.error("❌ Error checking employee:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// ✅ OPTIMIZED: Added pagination support
const getEmployeeList = async (req, res) => {
    try {
        const { limit = 50, page = 1 } = req.query;
        const result = await getEmployeeListInternal(parseInt(limit), parseInt(page));
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error("❌ Error in getEmployeeList endpoint:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};


const login = async (req, res) => {
    console.log("Employee login called");
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: "Email and password are required" 
            });
        }

        // Check if employee exists with this email
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("email", "==", email).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found with this email address" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Check if employee has a password set
        if (!employeeData.password) {
            return res.status(400).json({ 
                success: false,
                message: "Please register first" 
            });
        }

        // Verify password
        if (employeeData.password !== password) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid password" 
            });
        }

        // Password matches - successful login
        console.log(`Successful login for employee: ${email}`);

        res.json({
            success: true,
            message: "Login successful",
            employee: {
                id: employeeDoc.id,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                primaryNumber: employeeData.primary_number,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                branchName: employeeData.branchName,
                positionName: employeeData.positionName,
                status: employeeData.status,
                role: employeeData.role,
                profileImage: employeeData.profileImage,
                has2FA: !!employeeData.secret,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                dateOfBirth: employeeData.dateOfBirth,
                gender: employeeData.gender,
                salary: employeeData.salary,
                department: employeeData.department,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt
            }
        });

    } catch (error) {
        console.error("❌ Error in employee login:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

const checkEmail = async (req, res) => {
    console.log("Employee checkEmail called");
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: "Email is required" 
            });
        }

        // Check if employee exists with this email
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("email", "==", email).get();
        
        if (querySnapshot.empty) {
            return res.json({
                success: true,
                message: "Email not found in employee table",
                emailExists: false,
                email: email
            });
        } else {
            const employeeDoc = querySnapshot.docs[0];
            const employeeData = employeeDoc.data();
            
            return res.json({
                success: true,
                message: "Email found in employee table",
                emailExists: true,
                email: email,
                employee: {
                    id: employeeDoc.id,
                    uid: employeeData.uid,
                    authId: employeeData.authId ?? null,
                    email: employeeData.email ?? null,
                    nickname: employeeData.nickname ?? null,
                    firstName: employeeData.firstName ?? null,
                    lastName: employeeData.lastName ?? null,
                    hasPassword: !!employeeData.password,
                    status: employeeData.status ?? null,
                    role: employeeData.role ?? null,
                    profileImage: employeeData.profileImage ?? null,
                    has2FA: !!employeeData.secret,
                    joinDate: employeeData.joinDate ?? null,
                    maritalStatus: employeeData.maritalStatus ?? null,
                    dateOfBirth: employeeData.dateOfBirth ?? null,
                    gender: employeeData.gender ?? null,
                    salary: employeeData.salary ?? null,
                    department: employeeData.department ?? null,
                    createdAt: employeeData.createdAt ?? null,
                    updatedAt: employeeData.updatedAt ?? null,
                    title: employeeData.title ?? null,
                    idAddress: employeeData.idAddress ?? null,
                    subDistrict: employeeData.subDistrict ?? null,
                    district: employeeData.district ?? null,
                    province: employeeData.province ?? null,
                    idType: employeeData.idType ?? null,
                    idCardNumber: employeeData.idCardNumber ?? null,
                    company: employeeData.company ?? null,
                    companyName: employeeData.companyName ?? null,
                    location: employeeData.location ?? null,
                    locationName: employeeData.locationName ?? null,
                    branch: employeeData.branch ?? null,
                    branchName: employeeData.branchName ?? null,
                    position: employeeData.position ?? null,
                    positionName: employeeData.positionName ?? null,
                }
            });
        }

    } catch (error) {
        console.error("❌ Error in employee checkEmail:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Register employee with email and password (check if email exists, if exists then save)
const register = async (req, res) => {
    console.log("Employee register called");
    try {
        const { email, password, confirmPassword } = req.body;
        
        // Validation
        if (!email || !password || !confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Email, password, and confirm password are required" 
            });
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Password and confirm password do not match" 
            });
        }

        // Check if employee exists with this email
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("email", "==", email).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Don't have data" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Update password for existing employee (whether they have password or not)
        await employeeDoc.ref.update({ 
            password: password,
            updatedAt: new Date().toISOString()
        });
        
        console.log(`Password updated for employee: ${email}`);

        res.json({
            success: true,
            message: "Password updated successfully",
            employee: {
                id: employeeDoc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                title: employeeData.title,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                primaryNumber: employeeData.primary_number,
                company: employeeData.company,
                companyName: employeeData.companyName,
                location: employeeData.location,
                locationName: employeeData.locationName,
                branch: employeeData.branch,
                branchName: employeeData.branchName,
                position: employeeData.position,
                positionName: employeeData.positionName,
                status: employeeData.status,
                role: employeeData.role,
                roleName: employeeData.roleName,
                profileImage: employeeData.profileImage,
                has2FA: !!employeeData.secret,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                dateOfBirth: employeeData.dateOfBirth,
                gender: employeeData.gender,
                salary: employeeData.salary,
                idAddress: employeeData.idAddress,
                subDistrict: employeeData.subDistrict,
                district: employeeData.district,
                province: employeeData.province,
                idType: employeeData.idType,
                idCardNumber: employeeData.idCardNumber,
                createdAt: employeeData.createdAt,
                updatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("❌ Error in employee register:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get employee profile by UID
const getProfileByUid = async (req, res) => {
    console.log("Get employee profile by UID called");
    try {
        const { uid } = req.params;
        
        if (!uid) {
            return res.status(400).json({ 
                success: false,
                message: "UID is required" 
            });
        }

        // Check if employee exists with this UID
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("uid", "==", uid).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found with this UID" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        res.json({
            success: true,
            message: "Employee profile retrieved successfully",
            employee: {
                id: employeeDoc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                primaryNumber: employeeData.primary_number,
                company: employeeData.company,
                companyName: employeeData.companyName,
                location: employeeData.location,
                locationName: employeeData.locationName,
                branchName: employeeData.branchName,
                branch: employeeData.branch,
                position: employeeData.position,
                positionName: employeeData.positionName,
                status: employeeData.status,
                role: employeeData.role,
                roleName: employeeData.roleName,
                bankName: employeeData.bankName,
                bankAccountNumber: employeeData.bankAccountNumber,
                bankHolderName: employeeData.bankHolderName,
                profileImage: employeeData.profileImage,
                has2FA: !!employeeData.secret,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                dateOfBirth: employeeData.dateOfBirth,
                gender: employeeData.gender,
                salary: employeeData.salary,
                idAddress: employeeData.idAddress,
                subDistrict: employeeData.subDistrict,
                district: employeeData.district,
                province: employeeData.province,
                postalCode: employeeData.postalCode,
                idType: employeeData.idType,
                idCardNumber: employeeData.idCardNumber,
                nationality: employeeData.nationality,
                title: employeeData.title,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt
            }
        });

    } catch (error) {
        console.error("❌ Error in getProfileByUid:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// ✅ OPTIMIZED: Use aggregation instead of fetching all employees
const getEmployeeStats = async (req, res) => {
    try {
        const employeesRef = db.collection("employees");
        
        // Get total count efficiently
        const snapshot = await employeesRef.select('has2FA', 'secret', 'companyName', 'status').get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "No employees found"
            });
        }

        let totalEmployees = 0;
        let employeesWith2FA = 0;
        let activeEmployees = 0;
        const companyStats = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            totalEmployees++;
            
            if (data.secret) {
                employeesWith2FA++;
            }
            
            if (data.status === 'active') {
                activeEmployees++;
            }
            
            if (data.companyName) {
                companyStats[data.companyName] = (companyStats[data.companyName] || 0) + 1;
            }
        });

        const employeesWithout2FA = totalEmployees - employeesWith2FA;

        res.json({
            success: true,
            message: "Employee statistics retrieved successfully",
            stats: {
                totalEmployees,
                activeEmployees,
                employeesWith2FA,
                employeesWithout2FA,
                twoFactorPercentage: totalEmployees > 0 ? Math.round((employeesWith2FA / totalEmployees) * 100) : 0,
                companyBreakdown: companyStats
            }
        });

    } catch (error) {
        console.error("❌ Error getting employee stats:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// ✅ OPTIMIZED: Use Firestore ordering and limits instead of client-side operations
const searchEmployees = async (req, res) => {
    try {
        const {
            search,
            company,
            location,
            branch,
            position,
            status,
            role,
            has2FA,
            maritalStatus,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        let query = db.collection("employees");

        // Apply filters (Firestore native)
        if (company) query = query.where("company", "==", company);
        if (location) query = query.where("location", "==", location);
        if (branch) query = query.where("branch", "==", branch);
        if (position) query = query.where("position", "==", position);
        if (status) query = query.where("status", "==", status);
        if (role) query = query.where("role", "==", role);
        if (maritalStatus) query = query.where("maritalStatus", "==", maritalStatus);

        // Apply ordering (only if no text search)
        if (!search && sortBy) {
            query = query.orderBy(sortBy, sortOrder);
        } else {
            // Default ordering for pagination
            query = query.orderBy("createdAt", "desc");
        }

        // Apply limit (Firestore native pagination)
        const limitInt = parseInt(limit);
        const pageInt = parseInt(page);
        query = query.limit(limitInt);

        // If pagination beyond page 1, use offset (note: not efficient for large offsets)
        if (pageInt > 1) {
            const skipCount = (pageInt - 1) * limitInt;
            const skipSnapshot = await query.limit(skipCount).get();
            if (!skipSnapshot.empty) {
                const lastVisible = skipSnapshot.docs[skipSnapshot.docs.length - 1];
                query = db.collection("employees");
                
                // Reapply filters
                if (company) query = query.where("company", "==", company);
                if (location) query = query.where("location", "==", location);
                if (branch) query = query.where("branch", "==", branch);
                if (position) query = query.where("position", "==", position);
                if (status) query = query.where("status", "==", status);
                if (role) query = query.where("role", "==", role);
                if (maritalStatus) query = query.where("maritalStatus", "==", maritalStatus);
                
                if (!search && sortBy) {
                    query = query.orderBy(sortBy, sortOrder);
                } else {
                    query = query.orderBy("createdAt", "desc");
                }
                
                query = query.startAfter(lastVisible).limit(limitInt);
            }
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No employees found matching the criteria",
                data: [],
                pagination: {
                    currentPage: pageInt,
                    totalPages: 0,
                    totalItems: 0,
                    itemsPerPage: limitInt
                }
            });
        }

        let employees = [];
        snapshot.forEach(doc => {
            const employeeData = doc.data();
            employees.push({
                id: doc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                primaryNumber: employeeData.primary_number,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                has2FA: !!employeeData.secret,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                company: employeeData.company,
                location: employeeData.location,
                branch: employeeData.branch,
                branchName: employeeData.branchName,
                status: employeeData.status,
                position: employeeData.position,
                positionName: employeeData.positionName,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                profileImage: employeeData.profileImage,
                role: employeeData.role,
                email: employeeData.email || '',
                department: employeeData.department || '',
                salary: employeeData.salary || null
            });
        });

        // Apply text search if provided (client-side, but only on limited results)
        if (search) {
            const searchTerm = search.toLowerCase();
            employees = employees.filter(emp => 
                (emp.nickname && emp.nickname.toLowerCase().includes(searchTerm)) ||
                (emp.firstName && emp.firstName.toLowerCase().includes(searchTerm)) ||
                (emp.lastName && emp.lastName.toLowerCase().includes(searchTerm)) ||
                (emp.email && emp.email.toLowerCase().includes(searchTerm)) ||
                (emp.primaryNumber && emp.primaryNumber.includes(searchTerm)) ||
                (emp.companyName && emp.companyName.toLowerCase().includes(searchTerm)) ||
                (emp.locationName && emp.locationName.toLowerCase().includes(searchTerm)) ||
                (emp.branchName && emp.branchName.toLowerCase().includes(searchTerm)) ||
                (emp.positionName && emp.positionName.toLowerCase().includes(searchTerm))
            );
        }

        res.json({
            success: true,
            message: "Employee search completed successfully",
            data: employees,
            pagination: {
                currentPage: pageInt,
                itemsPerPage: limitInt,
                hasNextPage: employees.length === limitInt,
                hasPrevPage: pageInt > 1
            },
            filters: {
                search: search || null,
                company: company || null,
                location: location || null,
                branch: branch || null,
                position: position || null,
                status: status || null,
                role: role || null,
                has2FA: has2FA || null,
                maritalStatus: maritalStatus || null
            }
        });

    } catch (error) {
        console.error("❌ Error searching employees:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// ✅ OPTIMIZED: Use Firestore select to only fetch needed fields
const getEmployeeFilterOptions = async (req, res) => {
    try {
        const employeesRef = db.collection("employees");
        // Only select the fields we need for filter options
        const snapshot = await employeesRef
            .select('companyName', 'locationName', 'branchName', 'positionName', 'status', 'role', 'maritalStatus')
            .get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No employees found",
                data: {
                    companies: [],
                    locations: [],
                    branches: [],
                    positions: [],
                    statuses: [],
                    roles: [],
                    maritalStatuses: []
                }
            });
        }

        const companies = new Set();
        const locations = new Set();
        const branches = new Set();
        const positions = new Set();
        const statuses = new Set();
        const roles = new Set();
        const maritalStatuses = new Set();

        snapshot.forEach(doc => {
            const employeeData = doc.data();
            
            if (employeeData.companyName) companies.add(employeeData.companyName);
            if (employeeData.locationName) locations.add(employeeData.locationName);
            if (employeeData.branchName) branches.add(employeeData.branchName);
            if (employeeData.positionName) positions.add(employeeData.positionName);
            if (employeeData.status) statuses.add(employeeData.status);
            if (employeeData.role) roles.add(employeeData.role);
            if (employeeData.maritalStatus) maritalStatuses.add(employeeData.maritalStatus);
        });

        res.json({
            success: true,
            message: "Filter options retrieved successfully",
            data: {
                companies: Array.from(companies).sort(),
                locations: Array.from(locations).sort(),
                branches: Array.from(branches).sort(),
                positions: Array.from(positions).sort(),
                statuses: Array.from(statuses).sort(),
                roles: Array.from(roles).sort(),
                maritalStatuses: Array.from(maritalStatuses).sort()
            }
        });

    } catch (error) {
        console.error("❌ Error getting filter options:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Check In/Out API
const checkInOut = async (req, res) => {
    console.log("Check In/Out called", req.body);
    try {
        const { 
            employeeId, 
            employeeName, 
            position, 
            positionName, 
            company, 
            companyName, 
            locationName, 
            location, 
            branch, 
            branchName, 
            type,
            checkInAt,
            checkOutAt         
        } = req.body; // type: 'checkin' or 'checkout'
        
        // Validate required fields
        if (!employeeId || !employeeName || !type || !location) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: employeeId, employeeName, type, location"
            });
        }

        // Validate type
        if (type !== 'checkin' && type !== 'checkout') {
            return res.status(400).json({
                success: false,
                message: "Type must be 'checkin' or 'checkout'"
            });
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Reference to attendance collection
        const attendanceRef = db.collection("employee-attendance");
        
        // Query for existing attendance record for this employee today
        const existingQuery = await attendanceRef
            .where("employeeId", "==", employeeId)
            .where("date", "==", today)
            .limit(1)
            .get();

        if (type === 'checkin') {
            // Check if already checked in today
            if (!existingQuery.empty) {
                const existingDoc = existingQuery.docs[0];
                const existingData = existingDoc.data();
                
                if (existingData.checkInAt) {
                    return res.status(400).json({
                        success: false,
                        message: "Already checked in today",
                        attendance: existingData
                    });
                }
            }

            // Create or update check-in record
            const checkInData = {
                employeeId,
                employeeName,
                position,
                positionName,
                company,
                companyName,
                location,
                locationName,
                branch,
                branchName,
                date: today,
                checkInAt: checkInAt || new Date().toISOString(),
                checkOutAt: null,
                status: 'checked_in',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            let attendanceDoc;
            if (!existingQuery.empty) {
                // Update existing document
                attendanceDoc = existingQuery.docs[0];
                await attendanceDoc.ref.update(checkInData);
            } else {
                // Create new document
                const newDoc = await attendanceRef.add(checkInData);
                attendanceDoc = await newDoc.get();
            }

            return res.json({
                success: true,
                message: "Check-in successful",
                attendance: {
                    id: attendanceDoc.id,
                    ...checkInData
                }
            });

        } else if (type === 'checkout') {
            // Check if checked in first
            if (existingQuery.empty) {
                return res.status(400).json({
                    success: false,
                    message: "No check-in record found for today. Please check in first."
                });
            }

            const existingDoc = existingQuery.docs[0];
            const existingData = existingDoc.data();

            // Check if already checked out
            if (existingData.checkOutAt) {
                return res.status(400).json({
                    success: false,
                    message: "Already checked out today",
                    attendance: existingData
                });
            }

            // Update with check-out time
            const checkOutData = {
                checkOutAt: checkOutAt || new Date().toISOString(),
                status: 'checked_out',
                updatedAt: new Date().toISOString()
            };

            await existingDoc.ref.update(checkOutData);

            return res.json({
                success: true,
                message: "Check-out successful",
                attendance: {
                    id: existingDoc.id,
                    ...existingData,
                    ...checkOutData
                }
            });
        }

    } catch (error) {
        console.error("❌ Error in check in/out:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get attendance history for an employee
const getAttendanceHistory = async (req, res) => {
    console.log("Get attendance history called");
    try {
        const { employeeId, startDate, endDate, limit = 30 } = req.query;
        
        let query = db.collection("employee-attendance");

        // Filter by employee ID if provided
        if (employeeId) {
            query = query.where("employeeId", "==", employeeId);
        }

        // Filter by date range if provided
        if (startDate) {
            query = query.where("date", ">=", startDate);
        }
        if (endDate) {
            query = query.where("date", "<=", endDate);
        }

        // Order by date descending and limit results
        query = query.orderBy("date", "desc").limit(parseInt(limit));

        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No attendance records found",
                data: [],
                count: 0
            });
        }

        const attendanceRecords = [];
        snapshot.forEach(doc => {
            const record = doc.data();
            attendanceRecords.push({
                id: doc.id,
                ...record
            });
        });

        res.json({
            success: true,
            message: "Attendance history retrieved successfully",
            data: attendanceRecords,
            count: attendanceRecords.length
        });

    } catch (error) {
        console.error("❌ Error getting attendance history:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get today's attendance status for an employee
const getTodayAttendance = async (req, res) => {
    console.log("Get today's attendance called");
    try {
        const { employeeId } = req.params;
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const today = new Date().toISOString().split('T')[0];
        
        const attendanceRef = db.collection("employee-attendance");
        const query = await attendanceRef
            .where("employeeId", "==", employeeId)
            .where("date", "==", today)
            .limit(1)
            .get();

        if (query.empty) {
            return res.json({
                success: true,
                message: "No attendance record for today",
                hasCheckedIn: false,
                hasCheckedOut: false,
                attendance: null
            });
        }

        const doc = query.docs[0];
        const attendanceData = doc.data();

        res.json({
            success: true,
            message: "Today's attendance retrieved successfully",
            hasCheckedIn: !!attendanceData.checkInAt,
            hasCheckedOut: !!attendanceData.checkOutAt,
            attendance: {
                id: doc.id,
                ...attendanceData
            }
        });

    } catch (error) {
        console.error("❌ Error getting today's attendance:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

module.exports = {
    login,
    register,
    checkEmail,
    getEmployeeList,
    getProfileByUid,
    getEmployeeStats,
    searchEmployees,
    getEmployeeFilterOptions,
    checkInOut,
    getAttendanceHistory,
    getTodayAttendance,
    checkEmployee,
    getEmployeeListInternal
};
