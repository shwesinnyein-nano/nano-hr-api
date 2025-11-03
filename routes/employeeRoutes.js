const express = require("express");
const qrcode = require("qrcode");
const speakeasy = require("speakeasy");
const employeeController = require("../controllers/employeeController");
const { authenticateToken } = require("../middleware/authMiddleware");
 
const router = express.Router();

router.post("/check-employee", employeeController.checkEmployee);
router.post("/login", employeeController.login);
router.post("/register", employeeController.register);
router.post("/check-email", employeeController.checkEmail);

// Specific routes before parameterized routes
router.get("/list", employeeController.getEmployeeList);
router.get("/stats", employeeController.getEmployeeStats);
router.get("/search", employeeController.searchEmployees);
router.get("/filter-options", employeeController.getEmployeeFilterOptions);
router.get("/shift-data/filter", authenticateToken, employeeController.getShiftDataWithFilter);
router.get("/shift/get-by-date", employeeController.getEmployeeShiftByDate);
router.post("/shift-data/create", authenticateToken, employeeController.createShiftData);

// Parameterized routes (must come after specific routes)
router.get("/profile/:uid", employeeController.getProfileByUid);
router.get("/:employeeId/shift-data", employeeController.getEmployeeWithShiftData);

// Attendance routes moved to /attendance

module.exports = router;
