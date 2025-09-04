const express = require("express");
const qrcode = require("qrcode");
const speakeasy = require("speakeasy");
const employeeController = require("../controllers/employeeController");
 
const router = express.Router();

router.post("/check-employee", employeeController.checkEmployee);
router.post("/login", employeeController.login);
router.post("/register", employeeController.register);
router.post("/check-email", employeeController.checkEmail);
router.get("/profile/:uid", employeeController.getProfileByUid);
router.get("/leave-settings", employeeController.getLeaveSettings);
router.get("/leave-list/:uid", employeeController.getEmployeeLeaveList);
router.get("/list", employeeController.getEmployeeList);
router.get("/stats", employeeController.getEmployeeStats);
router.get("/search", employeeController.searchEmployees);
router.get("/filter-options", employeeController.getEmployeeFilterOptions);


module.exports = router;
