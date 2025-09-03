const express = require("express");
const qrcode = require("qrcode");
const speakeasy = require("speakeasy");
const employeeController = require("../controllers/employeeController");
 
const router = express.Router();

router.post("/check-employee", employeeController.checkEmployee);
router.post("/login", employeeController.login);
router.post("/check-email", employeeController.checkEmail);
router.post("/set-password", employeeController.setPassword);
router.get("/list", employeeController.getEmployeeList);
router.get("/stats", employeeController.getEmployeeStats);
router.get("/search", employeeController.searchEmployees);
router.get("/filter-options", employeeController.getEmployeeFilterOptions);


module.exports = router;
