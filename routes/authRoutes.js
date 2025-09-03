const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController")

router.post("/send-otp", authController.sendOTP);
router.post("/verify-otp", authController.verifyOTP);
router.post("/generate-secret", authController.generateSecret);
router.post("/login", authController.loginWithIdToken);
router.get("/verify-token", authController.verifyToken);



module.exports = router;
