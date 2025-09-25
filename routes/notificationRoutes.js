const express = require('express');
const { 
    sendLeaveRequestNotification,
    sendLeaveStatusNotification,
    getUserNotifications,
    getManagerNotifications,
    markNotificationAsRead
} = require('../controllers/notificationController');

const router = express.Router();

// Notification routes - Leave requests only (FREE)

// Send leave request notification to manager
router.post('/leave-request', sendLeaveRequestNotification);

// Send leave approval/rejection notification to employee
router.post('/leave-status', sendLeaveStatusNotification);

// Get user notifications
router.get('/user/:userId', getUserNotifications);

// Get manager notifications from all managed branches
router.get('/manager/:managerId', getManagerNotifications);

// Mark notification as read
router.put('/user/:userId/read/:notificationId', markNotificationAsRead);

module.exports = router;
