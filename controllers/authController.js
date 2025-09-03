


const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { admin, db } = require("../config/firebaseConfig");

exports.sendOTP = async (req, res) => {
    try {
        const { mobileNumber } = req.body;
        if (!mobileNumber) return res.status(400).json({ message: "Mobile number is required" });

        const employeesRef = db.collection("employees");
        const snapshot = await employeesRef.where("primary_number", "==", mobileNumber).get();

        if (snapshot.empty) {
            return res.status(404).json({ message: "No user found with this mobile number" });
        }

        const employeeDoc = snapshot.docs[0];
        const employeeData = employeeDoc.data();

        if (!employeeData.secret) {
            return res.status(400).json({ message: "Google Authenticator is not set up for this user" });
        }

        
        const otp = speakeasy.totp({
            secret: employeeData.secret,
            encoding: "base32",
        });

        res.json({ message: "OTP sent successfully", otp });

    } catch (error) {
        
        res.status(500).json({ message: "Internal server error" });
    }
};


exports.verifyOTP = async (req, res) => {
    
    try {
        const { mobileNumber, otp } = req.body;
        
        if (!mobileNumber || !otp) return res.status(400).json({ message: "Mobile number and OTP are required" });

        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("primary_number", "==", mobileNumber).get();
       
        if (querySnapshot.empty) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const employeeData = querySnapshot.docs[0].data();
      
        if (!employeeData.secret) {
            return res.status(400).json({ message: "Employee has not enabled 2FA" });
        }

       
        
        const verified = speakeasy.totp.verify({
            secret: employeeData.secret,
            encoding: "base32",
            token: otp,
            window: 2,
            step: 30
        });

       

        if (verified) {
            const firebaseCustomToken = await admin.auth().createCustomToken(employeeData.authId);
            res.json({
                success: true,
                message: "OTP verified successfully",
                firebaseCustomToken,
                employeeData
            });
        } else {
            res.status(400).json({ message: "Invalid OTP" });
        }

    } catch (error) {
       
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.generateSecret = async (req, res) => {
    try {
        const { uid, mobileNumber } = req.body;
        if (!uid || !mobileNumber) return res.status(400).json({ message: "UID and mobile number required" });

        const employeeRef = db.collection("employees").doc(uid);
        const employeeDoc = await employeeRef.get();

        if (!employeeDoc.exists) return res.status(404).json({ message: "Employee not found" });

        const employeeData = employeeDoc.data();
        if (employeeData.secret) {
            return res.json({ secret: employeeData.secret, qrCode: employeeData.qrCode, message: "Secret key already exists." });
        }

        // ✅ Generate new secret
        const secret = speakeasy.generateSecret({
            length: 20,
            name: `${employeeData.companyName} (${mobileNumber})`,
            issuer: "MyCompany"
        });

        const otpAuthUrl = secret.otpauth_url;
        const qrCodeImage = await qrcode.toDataURL(otpAuthUrl);

        // ✅ Save to Firestore
        await employeeRef.update({ secret: secret.base32, qrCode: qrCodeImage });

        res.json({ secret: secret.base32, qrCode: qrCodeImage, message: "New secret key generated." });
    } catch (error) {
        console.error("❌ Error generating secret:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Login with Firebase ID Token (after client-side authentication)
exports.loginWithIdToken = async (req, res) => {
    console.log("loginWithIdToken called");
    try {
        const { idToken } = req.body;
        
        if (!idToken) {
            return res.status(400).json({ 
                success: false,
                message: "ID token is required" 
            });
        }

        // Verify the ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Get employee data from Firestore
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("authId", "==", decodedToken.uid).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee record not found" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        res.json({
            success: true,
            message: "Login successful",
            user: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                displayName: decodedToken.name || employeeData.nickname,
                emailVerified: decodedToken.email_verified,
                customMetadata: decodedToken
            },
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
                has2FA: !!employeeData.secret
            }
        });

    } catch (error) {
        console.error("❌ Error in loginWithIdToken:", error);
        
        if (error.code === 'auth/invalid-token') {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token" 
            });
        }

        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};



// Verify custom token and get user info
exports.verifyToken = async (req, res) => {
    console.log("verifyToken called");
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                message: "No token provided" 
            });
        }

        const token = authHeader.split(' ')[1];
        
        // Verify the custom token
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Get employee data
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("authId", "==", decodedToken.uid).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee record not found" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        res.json({
            success: true,
            message: "Token verified successfully",
            user: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                emailVerified: decodedToken.email_verified
            },
            employee: {
                id: employeeDoc.id,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                role: employeeData.role,
                profileImage: employeeData.profileImage
            }
        });

    } catch (error) {
        console.error("❌ Error verifying token:", error);
        
        if (error.code === 'auth/invalid-token') {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token" 
            });
        }

        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

