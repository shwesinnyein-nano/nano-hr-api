const express = require("express");
const lineController = require("../controllers/lineController")
const router = express.Router();


router.post("/send-notification-line", lineController.sendLineNotification);
router.get("/lineLoginCallback", lineController.lineLoginCallback) 

module.exports = router;
