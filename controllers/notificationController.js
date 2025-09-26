const { admin, db } = require("../config/firebaseConfig");
const { v4: uuidv4 } = require('uuid');

// Simplified notification service - Leave requests only
const NOTIFICATION_TYPES = {
    LEAVE_REQUEST: 'leave_request',
    LEAVE_APPROVED: 'leave_approved',
    LEAVE_REJECTED: 'leave_rejected'
};

const NOTIFICATION_CHANNELS = {
    IN_APP: 'in_app',
    PUSH: 'push'
};

// Create notification record in database
const createNotificationRecord = async (notificationData) => {
    try {
        const notificationId = uuidv4();
        const notificationRecord = {
            id: notificationId,
            ...notificationData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'sent'
        };

        // Save to Firestore using app_notifications collection
        await db.collection('app_notifications').doc(notificationId).set(notificationRecord);
        
        console.log(`✅ Notification record created in app_notifications: ${notificationId}`);
        return notificationRecord;
    } catch (error) {
        console.error('❌ Error creating notification record:', error);
        throw error;
    }
};

// Removed email and SMS functions to keep costs low

// Send push notification
const sendPushNotification = async (deviceTokens, title, body, data = {}) => {
    try {
        if (!deviceTokens || deviceTokens.length === 0) {
            console.log('⚠️ No device tokens provided for push notification');
            return { success: false, message: 'No device tokens provided' };
        }

        // Prepare the message
        const message = {
            notification: {
                title: title,
                body: body
            },
            data: data,
            tokens: deviceTokens
        };

        // Send using Firebase Admin SDK
        const response = await admin.messaging().sendMulticast(message);
        
        console.log(`📲 Push Notification sent:`);
        console.log(`   Success Count: ${response.successCount}`);
        console.log(`   Failure Count: ${response.failureCount}`);
        
        if (response.failureCount > 0) {
            console.log('❌ Failed tokens:', response.responses
                .map((resp, idx) => resp.success ? null : deviceTokens[idx])
                .filter(token => token !== null));
        }
        
        return { 
            success: true, 
            message: 'Push notification sent successfully',
            successCount: response.successCount,
            failureCount: response.failureCount
        };
    } catch (error) {
        console.error('❌ Error sending push notification:', error);
        throw error;
    }
};

// Create in-app notification
const createInAppNotification = async (recipientId, title, message, type, data = {}) => {
    try {
        const notification = {
            recipientId: recipientId,
            senderId: data.employeeId || recipientId, // Use employeeId from data or default to recipient
            title: title,
            message: message,
            type: type,
            data: data,
            channels: [NOTIFICATION_CHANNELS.IN_APP],
            isRead: false
        };

        // Save to app_notifications collection using createNotificationRecord
        const savedNotification = await createNotificationRecord(notification);
        
        console.log(`📱 In-app notification created for user: ${recipientId}`);
        return savedNotification;
    } catch (error) {
        console.error('❌ Error creating in-app notification:', error);
        throw error;
    }
};

// Send leave request notification (FREE channels only)
const sendLeaveRequestNotification = async (req, res) => {
    console.log("🚀 Send leave request notification called");
    try {
        const { 
            employeeId, 
            leaveType, 
            fromDate, 
            toDate, 
            reason,
            managerId,
            channels = ['in_app', 'push'] // Only free channels
        } = req.body;

        if (!employeeId || !leaveType || !managerId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID, leave type, and manager ID are required"
            });
        }

        // Get employee data
        const employeeRef = db.collection('employees').doc(employeeId);
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const employeeData = employeeDoc.data();
        const managerData = await db.collection('employees').doc(managerId).get();
        
        if (!managerData.exists) {
            return res.status(404).json({
                success: false,
                message: "Manager not found"
            });
        }

        const manager = managerData.data();

        // Prepare notification content
        const title = `New Leave Request from ${employeeData.firstName} ${employeeData.lastName}`;
        const message = `${employeeData.firstName} ${employeeData.lastName} has requested ${leaveType} leave from ${fromDate} to ${toDate}. Reason: ${reason}`;

        const results = [];

        // Send notifications through FREE channels only
        for (const channel of channels) {
            try {
                switch (channel) {
                    case NOTIFICATION_CHANNELS.PUSH:
                        // Get device tokens from manager's profile
                        const deviceTokens = manager.deviceTokens || [];
                        if (deviceTokens.length > 0) {
                            const pushResult = await sendPushNotification(deviceTokens, title, message, {
                                type: 'leave_request',
                                employeeId: employeeId,
                                leaveType: leaveType
                            });
                            results.push({ channel: 'push', ...pushResult });
                        } else {
                            results.push({ channel: 'push', success: false, message: 'No device tokens found' });
                        }
                        break;

                    case NOTIFICATION_CHANNELS.IN_APP:
                        const inAppResult = await createInAppNotification(
                            managerId,
                            title,
                            message,
                            NOTIFICATION_TYPES.LEAVE_REQUEST,
                            { employeeId, leaveType, fromDate, toDate, reason }
                        );
                        results.push({ channel: 'in_app', notification: inAppResult });
                        break;
                }
            } catch (channelError) {
                console.error(`❌ Error sending ${channel} notification:`, channelError);
                results.push({ 
                    channel: channel, 
                    success: false, 
                    error: channelError.message 
                });
            }
        }

        // Create notification record
        const notificationRecord = await createNotificationRecord({
            type: NOTIFICATION_TYPES.LEAVE_REQUEST,
            recipientId: managerId,
            senderId: employeeId,
            title: title,
            message: message,
            channels: channels,
            data: {
                leaveType,
                fromDate,
                toDate,
                reason
            }
        });

        res.json({
            success: true,
            message: "Leave request notifications sent successfully (FREE channels only)",
            results: results,
            notificationId: notificationRecord.id
        });

    } catch (error) {
        console.error("❌ Error sending leave request notification:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send notifications",
            error: error.message
        });
    }
};

// Send leave approval/rejection notification (FREE channels only)
const sendLeaveStatusNotification = async (req, res) => {
    console.log("🚀 Send leave status notification called");
    try {
        const { 
            employeeId, 
            leaveRequestId,
            status, // 'approved' or 'rejected'
            approvedBy,
            reason,
            channels = ['in_app', 'push'] // Only free channels
        } = req.body;

        if (!employeeId || !status || !approvedBy) {
            return res.status(400).json({
                success: false,
                message: "Employee ID, status, and approver ID are required"
            });
        }

        // Get employee data
        const employeeRef = db.collection('employees').doc(employeeId);
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const employeeData = employeeDoc.data();

        // Prepare notification content
        const title = `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`;
        const message = `Your leave request has been ${status}. ${reason ? `Reason: ${reason}` : ''}`;

        const results = [];

        // Send notifications through FREE channels only
        for (const channel of channels) {
            try {
                switch (channel) {
                    case NOTIFICATION_CHANNELS.PUSH:
                        const deviceTokens = employeeData.deviceTokens || [];
                        if (deviceTokens.length > 0) {
                            const pushResult = await sendPushNotification(deviceTokens, title, message, {
                                type: status === 'approved' ? 'leave_approved' : 'leave_rejected',
                                leaveRequestId: leaveRequestId
                            });
                            results.push({ channel: 'push', ...pushResult });
                        } else {
                            results.push({ channel: 'push', success: false, message: 'No device tokens found' });
                        }
                        break;

                    case NOTIFICATION_CHANNELS.IN_APP:
                        const inAppResult = await createInAppNotification(
                            employeeId,
                            title,
                            message,
                            status === 'approved' ? NOTIFICATION_TYPES.LEAVE_APPROVED : NOTIFICATION_TYPES.LEAVE_REJECTED,
                            { leaveRequestId, status, reason }
                        );
                        results.push({ channel: 'in_app', notification: inAppResult });
                        break;
                }
            } catch (channelError) {
                console.error(`❌ Error sending ${channel} notification:`, channelError);
                results.push({ 
                    channel: channel, 
                    success: false, 
                    error: channelError.message 
                });
            }
        }

        // Create notification record
        const notificationRecord = await createNotificationRecord({
            type: status === 'approved' ? NOTIFICATION_TYPES.LEAVE_APPROVED : NOTIFICATION_TYPES.LEAVE_REJECTED,
            recipientId: employeeId,
            senderId: approvedBy,
            title: title,
            message: message,
            channels: channels,
            data: {
                leaveRequestId,
                status,
                reason
            }
        });

        res.json({
            success: true,
            message: `Leave ${status} notifications sent successfully (FREE channels only)`,
            results: results,
            notificationId: notificationRecord.id
        });

    } catch (error) {
        console.error("❌ Error sending leave status notification:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send notifications",
            error: error.message
        });
    }
};

// Removed system announcement to keep costs low - only leave notifications

// Get user notifications
// Unified notification API with role-based filtering
const getNotifications = async (req, res) => {
    console.log("🚀 Get notifications called");
    try {
        const { employeeId } = req.params;
        const { page = 1, limit = 20, unreadOnly = false } = req.query;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        // Get employee data to determine role
        const employeeRef = db.collection('employees').doc(employeeId);
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

                const employeeData = employeeDoc.data();
                const isManager = employeeData.positionName === 'Manager';
                const managedBranches = employeeData.managedBranches || [];

                console.log(`👤 Employee: ${employeeData.firstName} ${employeeData.lastName}`);
                console.log(`🎭 Position: ${employeeData.positionName}`);
                if (isManager) {
                    console.log(`🏢 Managed branches: ${managedBranches.join(', ')}`);
                }

        let allNotifications = [];

        // Get direct notifications for this employee (simplified to avoid complex indexing)
        let directQuery = db.collection('app_notifications')
            .where('recipientId', '==', employeeId)
            .limit(parseInt(limit) * 2);

        const directSnapshot = await directQuery.get();
        
        directSnapshot.forEach(doc => {
            allNotifications.push({
                id: doc.id,
                ...doc.data(),
                source: 'direct'
            });
        });

        // If manager, get notifications from managed branches (simplified approach)
        if (isManager && managedBranches.length > 0) {
            console.log(`🔍 Getting notifications from managed branches: ${managedBranches.join(', ')}`);
            console.log(`⚠️ Multi-branch notifications temporarily simplified to avoid index requirements`);
            
            // For now, just show manager's direct notifications
            // TODO: Implement efficient multi-branch lookup after creating proper indexes
        }

        // Filter unread only if requested (after getting all notifications)
        if (unreadOnly === 'true') {
            allNotifications = allNotifications.filter(notification => !notification.isRead);
        }

        // Sort all notifications by creation date (newest first)
        allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const totalNotifications = allNotifications.length;
        const totalPages = Math.ceil(totalNotifications / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedNotifications = allNotifications.slice(startIndex, endIndex);

        res.json({
            success: true,
            message: "Notifications retrieved successfully",
            data: paginatedNotifications,
                    employee: {
                        id: employeeId,
                        name: `${employeeData.firstName} ${employeeData.lastName}`,
                        positionName: employeeData.positionName,
                        managedBranches: isManager ? managedBranches : undefined
                    },
            pagination: {
                totalNotifications,
                totalPages,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("❌ Error getting notifications:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get notifications",
            error: error.message
        });
    }
};

// Old getManagerNotifications function removed - now using unified getNotifications API

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
    console.log("🚀 Mark notification as read called");
    try {
        const { employeeId, notificationId } = req.params;

        if (!employeeId || !notificationId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID and notification ID are required"
            });
        }

        // Use app_notifications collection
        const notificationRef = db.collection('app_notifications').doc(notificationId);
        const notificationDoc = await notificationRef.get();

        if (!notificationDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        const notificationData = notificationDoc.data();
        
        // Verify the notification belongs to this employee
        if (notificationData.recipientId !== employeeId) {
            return res.status(403).json({
                success: false,
                message: "Access denied - notification belongs to another user"
            });
        }

        await notificationRef.update({
            isRead: true,
            readAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: "Notification marked as read"
        });

    } catch (error) {
        console.error("❌ Error marking notification as read:", error);
        res.status(500).json({
            success: false,
            message: "Failed to mark notification as read",
            error: error.message
        });
    }
};

module.exports = {
    sendLeaveRequestNotification,
    sendLeaveStatusNotification,
    getNotifications, // Unified API
    markNotificationAsRead,
    // Export utility functions for use in other controllers
    sendPushNotification,
    createInAppNotification,
    createNotificationRecord,
    NOTIFICATION_TYPES,
    NOTIFICATION_CHANNELS
};
