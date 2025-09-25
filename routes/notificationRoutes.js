const express = require('express');
const { 
    sendLeaveRequestNotification,
    sendLeaveStatusNotification,
    sendSystemAnnouncement,
    getUserNotifications,
    markNotificationAsRead
} = require('../controllers/notificationController');

const router = express.Router();

// Notification routes

// Send leave request notification to manager
router.post('/leave-request', sendLeaveRequestNotification);

// Send leave approval/rejection notification to employee
router.post('/leave-status', sendLeaveStatusNotification);

// Send system announcement to all users or specific users
router.post('/system-announcement', sendSystemAnnouncement);

// Get user notifications
router.get('/user/:userId', getUserNotifications);

// Mark notification as read
router.put('/user/:userId/read/:notificationId', markNotificationAsRead);

module.exports = router;
