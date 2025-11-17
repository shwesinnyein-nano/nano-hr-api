const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
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

// Get employee data by auth ID
exports.getEmployeeByAuthId = async (req, res) => {
    console.log("getEmployeeByAuthId called");
    try {
        const { authId } = req.params;
        
        if (!authId) {
            return res.status(400).json({ 
                success: false,
                message: "Auth ID is required" 
            });
        }

        // Get employee data from Firestore
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("authId", "==", authId).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found with this auth ID" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        res.json({
            success: true,
            message: "Employee data retrieved successfully",
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
        console.error("❌ Error in getEmployeeByAuthId:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// OLD LOGIN - Login with Firebase ID Token (after client-side authentication) - BACKUP
exports.loginWithIdToken_OLD = async (req, res) => {
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

// NEW LOGIN/REGISTER - Email and Password Login/Registration System
exports.loginWithEmailPassword = async (req, res) => {
    console.log("loginWithEmailPassword called");
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
            // Employee doesn't exist - Show HR contact message
            console.log(`Employee not found with email: ${email} - Contact HR required`);
            return res.status(404).json({ 
                success: false,
                message: "Your email address was not found in system, please contact to your HR" 
            });

        } else {
            // Employee exists - LOGIN FLOW
            const employeeDoc = querySnapshot.docs[0];
            const employeeData = employeeDoc.data();

            // Check if employee has a password set
            if (!employeeData.password) {
                // Employee exists but no password - need to register
                console.log(`Employee ${email} exists but no password set - need to register`);
                return res.status(400).json({ 
                    success: false,
                    message: "You need to register first" 
                });

            } else {
                // Employee has password - verify it
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
                    isRegistration: false,
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
            }
        }

    } catch (error) {
        console.error("❌ Error in loginWithEmailPassword:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// LOGIN ENDPOINT - Email and Password Login with comprehensive validation
exports.loginUser = async (req, res) => {
    console.log("loginUser called");
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
            // Employee doesn't exist - Show register message
            return res.status(404).json({ 
                success: false,
                message: "You need to register first" 
            });
        }

        // Employee exists - LOGIN FLOW
        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Check if employee has a password set
        if (!employeeData.password) {
            return res.status(400).json({ 
                success: false,
                message: "You need to register first" 
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
        console.error("❌ Error in loginUser:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// REGISTER ENDPOINT - Email and Password Registration (for existing employees only)
exports.registerUser = async (req, res) => {
    console.log("registerUser called");
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
            // Employee doesn't exist in system - Show HR contact message
            return res.status(404).json({ 
                success: false,
                message: "Your email address was not found in system, please contact to your HR" 
            });
        }

        // Employee exists in system - REGISTRATION FLOW
        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Check if employee already has a password set
        if (employeeData.password) {
            return res.status(409).json({ 
                success: false,
                message: "Account already registered. Please use login instead." 
            });
        }

        // Save password for existing employee
        await employeeDoc.ref.update({ 
            password: password,
            updatedAt: new Date().toISOString()
        });
        
        console.log(`Password saved for existing employee: ${email}`);

        // Return success response for registration
        res.json({
            success: true,
            message: "Registration successful",
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
                updatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("❌ Error in registerUser:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Check if email exists in employee table
exports.checkEmail = async (req, res) => {
    console.log("checkEmail called");
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
        console.error("❌ Error in checkEmail:", error);
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

// Mobile login with JWT token generation
exports.mobileLogin = async (req, res) => {
    console.log("Mobile login called");
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
                message: "You need to register first" 
            });
        }

        // Employee exists - LOGIN FLOW
        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Check if employee has a password set
        if (!employeeData.password) {
            return res.status(400).json({ 
                success: false,
                message: "You need to register first" 
            });
        }

        // Verify password
        if (employeeData.password !== password) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid password" 
            });
        }

        // Password matches - generate JWT token
        console.log(`✅ Mobile login successful for: ${employeeData.firstName} ${employeeData.lastName}`);
        
        const jwtSecret = 'nano-hr-mobile-secret-key-2024';
        const jwtPayload = {
            employeeId: employeeDoc.id,
            email: employeeData.email,
            role: employeeData.role,
            firstName: employeeData.firstName,
            lastName: employeeData.lastName,
            companyName: employeeData.companyName,
            positionName: employeeData.positionName
        };
        
        const jwtToken = jwt.sign(jwtPayload, jwtSecret, { expiresIn: '30d' });

        res.json({
            success: true,
            message: "Mobile login successful",
            token: jwtToken, // JWT token for mobile app
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
                profileImage: employeeData.profileImage
            }
        });

    } catch (error) {
        console.error("❌ Error in mobile login:", error);
        res.status(500).json({ 
            success: false,
            message: "Mobile login failed", 
            error: error.message 
        });
    }
};

// Change password endpoint
exports.changePassword = async (req, res) => {
    console.log("changePassword called");
    try {
        const { email, employeeId, currentPassword, newPassword, confirmNewPassword } = req.body;
        
        // Validation - require either email or employeeId
        if (!email && !employeeId) {
            return res.status(400).json({ 
                success: false,
                message: "Email or employeeId is required" 
            });
        }

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Current password, new password, and confirm password are required" 
            });
        }

        // Validate new password matches confirm password
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ 
                success: false,
                message: "New password and confirm password do not match" 
            });
        }

        // Validate new password is different from current password
        if (currentPassword === newPassword) {
            return res.status(400).json({ 
                success: false,
                message: "New password must be different from current password" 
            });
        }

        // Optional: Validate password strength (minimum length)
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false,
                message: "New password must be at least 6 characters long" 
            });
        }

        // Find employee by email or employeeId
        let employeeDoc;
        let employeeData;
        
        if (email) {
            const employeesRef = db.collection("employees");
            // Try root level email first
            let querySnapshot = await employeesRef.where("email", "==", email).get();
            
            // If not found, try nested documents.email
            if (querySnapshot.empty) {
                // Get all employees and filter by nested email (less efficient but handles nested structure)
                const allEmployees = await employeesRef.get();
                const matchingDocs = [];
                allEmployees.forEach(doc => {
                    const data = doc.data();
                    // Check root level email
                    if (data.email === email) {
                        matchingDocs.push(doc);
                    }
                    // Check nested documents.email
                    else if (data.documents && data.documents.email === email) {
                        matchingDocs.push(doc);
                    }
                });
                
                if (matchingDocs.length === 0) {
                    return res.status(404).json({ 
                        success: false,
                        message: "Employee not found with this email address" 
                    });
                }
                
                employeeDoc = matchingDocs[0];
            } else {
                employeeDoc = querySnapshot.docs[0];
            }
            
            employeeData = employeeDoc.data();
        } else {
            // Find by employeeId (document ID or uid field)
            const employeeRef = db.collection("employees").doc(employeeId);
            employeeDoc = await employeeRef.get();
            
            if (!employeeDoc.exists) {
                // Try finding by uid field
                const employeesRef = db.collection("employees");
                const querySnapshot = await employeesRef.where("uid", "==", employeeId).limit(1).get();
                
                if (querySnapshot.empty) {
                    return res.status(404).json({ 
                        success: false,
                        message: "Employee not found" 
                    });
                }
                
                employeeDoc = querySnapshot.docs[0];
            }
            
            employeeData = employeeDoc.data();
        }

        // Check if employee has a password set
        if (!employeeData.password) {
            return res.status(400).json({ 
                success: false,
                message: "No password set for this account. Please register first." 
            });
        }

        // Verify current password
        if (employeeData.password !== currentPassword) {
            return res.status(401).json({ 
                success: false,
                message: "Current password is incorrect" 
            });
        }

        // Update password in Firestore
        const employeeRef = db.collection("employees").doc(employeeDoc.id);
        await employeeRef.update({
            password: newPassword,
            updatedAt: new Date().toISOString()
        });

        console.log(`✅ Password changed successfully for employee: ${employeeData.email || employeeId}`);

        res.json({
            success: true,
            message: "Password changed successfully",
            messageTh: "เปลี่ยนรหัสผ่านสำเร็จ"
        });

    } catch (error) {
        console.error("❌ Error in changePassword:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to change password",
            messageTh: "ไม่สามารถเปลี่ยนรหัสผ่านได้",
            error: error.message 
        });
    }
};

// Helper function to find employee by email (handles nested documents.email)
const findEmployeeByEmail = async (email) => {
    const employeesRef = db.collection("employees");
    
    // Try root level email first
    let querySnapshot = await employeesRef.where("email", "==", email).get();
    
    if (!querySnapshot.empty) {
        return querySnapshot.docs[0];
    }
    
    // If not found, try nested documents.email
    const allEmployees = await employeesRef.get();
    for (const doc of allEmployees.docs) {
        const data = doc.data();
        if (data.documents && data.documents.email === email) {
            return doc;
        }
    }
    
    return null;
};

// Helper function to get employee email (handles nested structure)
const getEmployeeEmail = (employeeData) => {
    return employeeData.email || (employeeData.documents && employeeData.documents.email) || null;
};

// Forgot password - Generate reset token and send email
exports.forgotPassword = async (req, res) => {
    console.log("forgotPassword called");
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: "Email is required" 
            });
        }

        // Find employee by email
        const employeeDoc = await findEmployeeByEmail(email);
        
        // ✅ Security: Don't reveal if email exists or not
        // Always return success message to prevent email enumeration
        if (!employeeDoc) {
            console.log(`⚠️ Password reset requested for non-existent email: ${email}`);
            // Return success anyway to prevent email enumeration
            return res.json({
                success: true,
                message: "If the email exists, a password reset link has been sent",
                messageTh: "หากอีเมลนี้มีอยู่ในระบบ จะส่งลิงก์รีเซ็ตรหัสผ่านให้"
            });
        }

        const employeeData = employeeDoc.data();
        const employeeEmail = getEmployeeEmail(employeeData);

        // Check if employee has a password set
        if (!employeeData.password) {
            console.log(`⚠️ Password reset requested for account without password: ${email}`);
            // Still return success to prevent information disclosure
            return res.json({
                success: true,
                message: "If the email exists, a password reset link has been sent",
                messageTh: "หากอีเมลนี้มีอยู่ในระบบ จะส่งลิงก์รีเซ็ตรหัสผ่านให้"
            });
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

        // Store reset token in Firestore
        const passwordResetRef = db.collection('password_resets').doc();
        await passwordResetRef.set({
            email: employeeEmail,
            token: resetToken,
            expiresAt: expiresAt.toISOString(),
            used: false,
            createdAt: new Date().toISOString(),
            employeeId: employeeDoc.id
        });

        // Generate reset link
        const frontendUrl = process.env.FRONTEND_URL || process.env.PRODUCTION_FRONTEND_URL || 'https://nano-hr.web.app';
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(employeeEmail)}`;

        // Log reset link for debugging
        console.log(`📧 Password reset link for ${employeeEmail}:`);
        console.log(`   ${resetLink}`);
        console.log(`   Token: ${resetToken}`);
        console.log(`   Expires at: ${expiresAt.toISOString()}`);

        // ✅ Send email using Firebase Extensions Email or simple console for now
        // For production, you should configure a proper email service
        // Options: SendGrid, AWS SES, Nodemailer, Firebase Extensions
        
        // For now, we'll use a simple approach - log and return link in dev mode
        // In production, configure your email service here
        
        try {
            // TODO: Replace with actual email service
            // Example with SendGrid:
            // const sgMail = require('@sendgrid/mail');
            // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            // await sgMail.send({
            //     to: employeeEmail,
            //     from: process.env.EMAIL_FROM || 'noreply@nano-hr.com',
            //     subject: 'Reset Your Password - NANO HR',
            //     html: `...`
            // });
            
            // For now, just log - email will be sent when service is configured
            console.log(`📧 Email should be sent to: ${employeeEmail}`);
            console.log(`📧 Reset link: ${resetLink}`);
            
        } catch (emailError) {
            console.error(`❌ Failed to send email to ${employeeEmail}:`, emailError);
            // Don't fail the request if email fails - token is still generated
        }

        console.log(`✅ Password reset token generated for: ${employeeEmail}`);

        // Return response - include reset link in development mode for testing
        const response = {
            success: true,
            message: "If the email exists, a password reset link has been sent",
            messageTh: "หากอีเมลนี้มีอยู่ในระบบ จะส่งลิงก์รีเซ็ตรหัสผ่านให้"
        };
        
        // In development or if EMAIL_DEBUG is enabled, return the reset link for testing
        if (process.env.NODE_ENV !== 'production' || process.env.EMAIL_DEBUG === 'true') {
            response.resetLink = resetLink;
            response.token = resetToken;
            response.debug = true;
            console.log(`🔧 DEBUG MODE: Returning reset link in response for testing`);
        }
        
        res.json(response);

    } catch (error) {
        console.error("❌ Error in forgotPassword:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to process password reset request",
            messageTh: "ไม่สามารถดำเนินการรีเซ็ตรหัสผ่านได้",
            error: error.message 
        });
    }
};

// Reset password - Validate token and update password
exports.resetPassword = async (req, res) => {
    console.log("resetPassword called");
    try {
        const { token, email, newPassword, confirmPassword } = req.body;
        
        if (!token || !email || !newPassword || !confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Token, email, new password, and confirm password are required" 
            });
        }

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "New password and confirm password do not match" 
            });
        }

        // Validate password strength
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false,
                message: "New password must be at least 6 characters long" 
            });
        }

        // Find reset token in Firestore
        const passwordResetsRef = db.collection('password_resets');
        const querySnapshot = await passwordResetsRef
            .where('token', '==', token)
            .where('email', '==', email)
            .where('used', '==', false)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid or expired reset token" 
            });
        }

        const resetDoc = querySnapshot.docs[0];
        const resetData = resetDoc.data();

        // Check if token is expired
        const expiresAt = new Date(resetData.expiresAt);
        const now = new Date();
        if (now > expiresAt) {
            // Mark as used even though expired
            await resetDoc.ref.update({ used: true });
            return res.status(400).json({ 
                success: false,
                message: "Reset token has expired. Please request a new one." 
            });
        }

        // Find employee
        const employeeDoc = await findEmployeeByEmail(email);
        if (!employeeDoc) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found" 
            });
        }

        const employeeData = employeeDoc.data();

        // Update password
        const employeeRef = db.collection("employees").doc(employeeDoc.id);
        await employeeRef.update({
            password: newPassword,
            updatedAt: new Date().toISOString()
        });

        // Mark reset token as used
        await resetDoc.ref.update({ 
            used: true,
            usedAt: new Date().toISOString()
        });

        console.log(`✅ Password reset successfully for: ${email}`);

        res.json({
            success: true,
            message: "Password reset successfully",
            messageTh: "รีเซ็ตรหัสผ่านสำเร็จ"
        });

    } catch (error) {
        console.error("❌ Error in resetPassword:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to reset password",
            messageTh: "ไม่สามารถรีเซ็ตรหัสผ่านได้",
            error: error.message 
        });
    }
};