const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { admin, db } = require("../config/firebaseConfig")

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

exports.getEmployeeList = async (req, res) => {
    console.log("getEmployeeList called");
    try {
        const employeesRef = db.collection("employees");
        const snapshot = await employeesRef.get();

        if (snapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "No employees found",
                data: []
            });
        }

        const employees = [];
        snapshot.forEach(doc => {
            const employeeData = doc.data();
            employees.push({
                id: doc.id,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                primaryNumber: employeeData.primary_number,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                has2FA: !!employeeData.secret,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt
            });
        });

        res.json({
            success: true,
            message: "Employee list retrieved successfully",
            count: employees.length,
            data: employees
        });

    } catch (error) {
        console.error("❌ Error getting employee list:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
}
