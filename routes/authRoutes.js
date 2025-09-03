const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController")

router.post("/send-otp", authController.sendOTP);
router.post("/verify-otp", authController.verifyOTP);
router.post("/generate-secret", authController.generateSecret);
router.post("/login", authController.loginWithIdToken_OLD); // OLD LOGIN - BACKUP
router.post("/login-email-password", authController.loginWithEmailPassword); // NEW LOGIN
router.get("/verify-token", authController.verifyToken);
router.get("/employee/:authId", authController.getEmployeeByAuthId);



module.exports = router;
