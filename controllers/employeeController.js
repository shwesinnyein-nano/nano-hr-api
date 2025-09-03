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
                primaryNumber: employeeData.primary_number,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                has2FA: !!employeeData.secret,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                company: employeeData.company,
                companyName: employeeData.companyName,
                location: employeeData.location,
                locationName: employeeData.locationName,
                branch: employeeData.branch,
                branchName: employeeData.branchName,
                status: employeeData.status,
                position: employeeData.position,
                positionName: employeeData.positionName,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                profileImage: employeeData.profileImage,
                role: employeeData.role,
               


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
