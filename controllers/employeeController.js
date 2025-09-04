const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { admin, db } = require("../config/firebaseConfig");

// Internal function to get employee list (can be called from other parts of the API)
const getEmployeeListInternal = async () => {
    console.log("getEmployeeListInternal called");
    try {
        const employeesRef = db.collection("employees");
        const snapshot = await employeesRef.get();

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
                company: employeeData.company || null   ,
                companyName: employeeData.companyName || null,
                location: employeeData.location || null,
                locationName: employeeData.locationName || null,
                branch: employeeData.branch || null,
                branchName: employeeData.branchName || null,
                status: employeeData.status || null,
                position: employeeData.position || null ,
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

exports.checkEmployee = async (req, res) => {
    console.log("check employee,", req.body)
    try {
        const { mobileNumber } = req.body;
        if (!mobileNumber) return res.status(400).json({ message: "Mobile number is required" });

        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("primary_number", "==", mobileNumber).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const employeeData = querySnapshot.docs[0].data();
       

        if (!employeeData.secret) {
            return res.status(400).json({ message: "Employee has not enabled 2FA" });
        }
       
        res.json({
            success: true,
            message: "Employee exists and has 2FA enabled",
            employee: {
                auth_id: employeeData.authId,
                name: employeeData.nickname,
            }
        });
       

    } catch (error) {
        console.error("❌ Error checking employee:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// HTTP endpoint that uses the internal function
exports.getEmployeeList = async (req, res) => {
    console.log("getEmployeeList HTTP endpoint called");
    try {
        const result = await getEmployeeListInternal();
        
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

// Employee login with email and password (ONLY LOGIN - NO REGISTRATION)
exports.login = async (req, res) => {
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

// Check if email exists in employee table
exports.checkEmail = async (req, res) => {
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
                    email: employeeData.email,
                    nickname: employeeData.nickname,
                    firstName: employeeData.firstName,
                    lastName: employeeData.lastName,
                    hasPassword: !!employeeData.password,
                    status: employeeData.status,
                    role: employeeData.role
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
exports.register = async (req, res) => {
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

// Export the internal function so it can be used by other parts of the API
exports.getEmployeeListInternal = getEmployeeListInternal;

// Example: Function that uses the internal getEmployeeList function
exports.getEmployeeStats = async (req, res) => {
    console.log("getEmployeeStats called - this will use getEmployeeListInternal");
    try {
        // Call the internal function from within the API
        const employeeListResult = await getEmployeeListInternal();
        
        if (!employeeListResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to get employee data",
                error: employeeListResult.message
            });
        }

        const employees = employeeListResult.data;
        
        // Calculate some statistics
        const totalEmployees = employees.length;
        const employeesWith2FA = employees.filter(emp => emp.has2FA).length;
        const employeesWithout2FA = totalEmployees - employeesWith2FA;
        
        // Group by company
        const companyStats = {};
        employees.forEach(emp => {
            if (!companyStats[emp.companyName]) {
                companyStats[emp.companyName] = 0;
            }
            companyStats[emp.companyName]++;
        });

        res.json({
            success: true,
            message: "Employee statistics retrieved successfully",
            stats: {
                totalEmployees,
                employeesWith2FA,
                employeesWithout2FA,
                twoFactorPercentage: totalEmployees > 0 ? Math.round((employeesWith2FA / totalEmployees) * 100) : 0,
                companyBreakdown: companyStats
            },
            employees: employees // Include the full employee list if needed
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

// Search and filter employees API
exports.searchEmployees = async (req, res) => {
    console.log("searchEmployees called with query:", req.query);
    try {
        const {
            search,           // General search term (searches in name, nickname, email)
            company,          // Filter by company
            location,         // Filter by location
            branch,           // Filter by branch
            position,         // Filter by position
            status,           // Filter by status (active, inactive, etc.)
            role,             // Filter by role
            has2FA,           // Filter by 2FA status (true/false)
            maritalStatus,    // Filter by marital status
            page = 1,         // Pagination
            limit = 20,       // Items per page
            sortBy = 'nickname', // Sort field
            sortOrder = 'asc'    // Sort order (asc/desc)
        } = req.query;

        let query = db.collection("employees");

        // Apply filters
        if (company) {
            query = query.where("company", "==", company);
        }
        if (location) {
            query = query.where("location", "==", location);
        }
        if (branch) {
            query = query.where("branch", "==", branch);
        }
        if (position) {
            query = query.where("position", "==", position);
        }
        if (status) {
            query = query.where("status", "==", status);
        }
        if (role) {
            query = query.where("role", "==", role);
        }
        if (maritalStatus) {
            query = query.where("maritalStatus", "==", maritalStatus);
        }
        if (has2FA !== undefined) {
            const has2FABool = has2FA === 'true';
            if (has2FABool) {
                query = query.where("secret", "!=", null);
            } else {
                query = query.where("secret", "==", null);
            }
        }

        // Get all matching documents
        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No employees found matching the criteria",
                data: [],
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: 0,
                    totalItems: 0,
                    itemsPerPage: parseInt(limit)
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

        // Apply text search if provided
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

        // Apply sorting
        employees.sort((a, b) => {
            let aValue = a[sortBy] || '';
            let bValue = b[sortBy] || '';
            
            // Handle different data types
            if (typeof aValue === 'string') aValue = aValue.toLowerCase();
            if (typeof bValue === 'string') bValue = bValue.toLowerCase();
            
            if (sortOrder === 'desc') {
                return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
            } else {
                return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            }
        });

        // Apply pagination
        const totalItems = employees.length;
        const totalPages = Math.ceil(totalItems / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedEmployees = employees.slice(startIndex, endIndex);

        res.json({
            success: true,
            message: "Employee search completed successfully",
            data: paginatedEmployees,
            pagination: {
                currentPage: parseInt(page),
                totalPages: totalPages,
                totalItems: totalItems,
                itemsPerPage: parseInt(limit),
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
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

// Get employee filter options (for dropdowns, etc.)
exports.getEmployeeFilterOptions = async (req, res) => {
    console.log("getEmployeeFilterOptions called");
    try {
        const employeesRef = db.collection("employees");
        const snapshot = await employeesRef.get();

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
