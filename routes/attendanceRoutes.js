const express = require("express");
const attendanceController = require("../controllers/attendanceController");

const router = express.Router();

// Attendance routes
router.post("/check-in-out", attendanceController.checkInOut);
router.get("/status/:employeeId", attendanceController.getTodayAttendanceStatus);
router.get("/history/:employeeId", attendanceController.getCheckInOutHistory);
router.get("/history", attendanceController.getAllAttendanceHistory);
router.get("/:employeeId/:date", attendanceController.getAttendanceByEmployeeAndDate);
router.get("/auto-checkin/:employeeId", attendanceController.checkAutoCheckInNeeded);

module.exports = router;
