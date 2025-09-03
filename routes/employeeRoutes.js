const express = require("express");
const qrcode = require("qrcode");
const speakeasy = require("speakeasy");
const employeeController = require("../controllers/employeeController");
 
const router = express.Router();

router.post("/check-employee", employeeController.checkEmployee);
router.get("/list", employeeController.getEmployeeList);
router.get("/stats", employeeController.getEmployeeStats);


module.exports = router;
