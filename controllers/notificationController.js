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

        // Save to Firestore
        await db.collection('notifications').doc(notificationId).set(notificationRecord);
        
        console.log(`✅ Notification record created: ${notificationId}`);
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
const createInAppNotification = async (userId, title, message, type, data = {}) => {
    try {
        const notificationId = uuidv4();
        const notification = {
            id: notificationId,
            userId: userId,
            title: title,
            message: message,
            type: type,
            data: data,
            isRead: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to user's notifications subcollection
        await db.collection('users').doc(userId).collection('notifications').doc(notificationId).set(notification);
        
        console.log(`📱 In-app notification created for user: ${userId}`);
        return notification;
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
const getUserNotifications = async (req, res) => {
    console.log("🚀 Get user notifications called");
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20, unreadOnly = false, includeManagedBranches = false } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        let query = db.collection('users').doc(userId).collection('notifications').orderBy('createdAt', 'desc');

        if (unreadOnly === 'true') {
            query = query.where('isRead', '==', false);
        }

        const snapshot = await query.limit(parseInt(limit) * parseInt(page)).get();
        const notifications = [];
        
        snapshot.forEach(doc => {
            notifications.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Pagination
        const totalNotifications = notifications.length;
        const totalPages = Math.ceil(totalNotifications / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedNotifications = notifications.slice(startIndex, endIndex);

        res.json({
            success: true,
            message: "User notifications retrieved successfully",
            data: paginatedNotifications,
            pagination: {
                totalNotifications,
                totalPages,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("❌ Error getting user notifications:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get user notifications",
            error: error.message
        });
    }
};

// Get manager notifications from all managed branches
const getManagerNotifications = async (req, res) => {
    console.log("🚀 Get manager notifications from managed branches called");
    try {
        const { managerId } = req.params;
        const { page = 1, limit = 20, unreadOnly = false } = req.query;

        if (!managerId) {
            return res.status(400).json({
                success: false,
                message: "Manager ID is required"
            });
        }

        // Get manager data to find their managed branches
        const managerRef = db.collection('employees').doc(managerId);
        const managerDoc = await managerRef.get();
        
        if (!managerDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Manager not found"
            });
        }

        const managerData = managerDoc.data();
        const managedBranches = managerData.managedBranches || [];
        
        console.log(`🔍 Manager ${managerData.firstName} ${managerData.lastName} manages branches: ${managedBranches.join(', ')}`);

        let allNotifications = [];

        // Get notifications from manager's own notifications
        const managerNotificationsQuery = db.collection('users').doc(managerId).collection('notifications').orderBy('createdAt', 'desc');
        const managerSnapshot = await managerNotificationsQuery.get();
        
        managerSnapshot.forEach(doc => {
            allNotifications.push({
                id: doc.id,
                ...doc.data(),
                source: 'direct' // Direct notification to this manager
            });
        });

        // Get notifications from all employees in managed branches
        if (managedBranches.length > 0) {
            const employeesQuery = db.collection('employees')
                .where('branch', 'in', managedBranches)
                .where('role', '!=', 'manager'); // Exclude other managers
            
            const employeesSnapshot = await employeesQuery.get();
            const employeeIds = [];
            
            employeesSnapshot.forEach(doc => {
                employeeIds.push(doc.data().uid);
            });

            console.log(`📊 Found ${employeeIds.length} employees in managed branches`);

            // Get notifications from all employees in managed branches
            for (const employeeId of employeeIds) {
                try {
                    const employeeNotificationsQuery = db.collection('users').doc(employeeId).collection('notifications')
                        .where('type', 'in', ['leave_request', 'leave_approved', 'leave_rejected'])
                        .orderBy('createdAt', 'desc')
                        .limit(10); // Limit per employee to avoid too many results
                    
                    const employeeSnapshot = await employeeNotificationsQuery.get();
                    
                    employeeSnapshot.forEach(doc => {
                        const notificationData = doc.data();
                        allNotifications.push({
                            id: doc.id,
                            ...notificationData,
                            source: 'managed_branch',
                            employeeId: employeeId,
                            managedBranch: notificationData.data?.employeeBranch || 'unknown'
                        });
                    });
                } catch (error) {
                    console.error(`❌ Error getting notifications for employee ${employeeId}:`, error);
                }
            }
        }

        // Sort all notifications by creation date (newest first)
        allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Filter unread only if requested
        if (unreadOnly === 'true') {
            allNotifications = allNotifications.filter(notification => !notification.isRead);
        }

        // Pagination
        const totalNotifications = allNotifications.length;
        const totalPages = Math.ceil(totalNotifications / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedNotifications = allNotifications.slice(startIndex, endIndex);

        res.json({
            success: true,
            message: "Manager notifications from managed branches retrieved successfully",
            data: paginatedNotifications,
            manager: {
                id: managerId,
                name: `${managerData.firstName} ${managerData.lastName}`,
                managedBranches: managedBranches
            },
            pagination: {
                totalNotifications,
                totalPages,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("❌ Error getting manager notifications:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get manager notifications",
            error: error.message
        });
    }
};

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
    console.log("🚀 Mark notification as read called");
    try {
        const { userId, notificationId } = req.params;

        if (!userId || !notificationId) {
            return res.status(400).json({
                success: false,
                message: "User ID and notification ID are required"
            });
        }

        const notificationRef = db.collection('users').doc(userId).collection('notifications').doc(notificationId);
        const notificationDoc = await notificationRef.get();

        if (!notificationDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
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
    getUserNotifications,
    getManagerNotifications,
    markNotificationAsRead,
    // Export utility functions for use in other controllers
    sendPushNotification,
    createInAppNotification,
    createNotificationRecord,
    NOTIFICATION_TYPES,
    NOTIFICATION_CHANNELS
};
