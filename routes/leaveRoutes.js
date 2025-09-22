const express = require("express");
const leaveController = require("../controllers/leaveController");

const router = express.Router();

// Leave routes
router.get("/settings", leaveController.getLeaveSettings);
router.get("/employee/:uid", leaveController.getEmployeeLeaveList);
router.post("/create", leaveController.createLeaveRequest);
router.get("/all", leaveController.getAllLeaveRequests);
router.get("/:leaveId", leaveController.getLeaveRequestById);
router.put("/:leaveId/status", leaveController.updateLeaveRequestStatus);

module.exports = router;
