const { admin, db } = require("../config/firebaseConfig");
const { v4: uuidv4 } = require('uuid');
const { FieldValue } = require('firebase-admin/firestore');

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

// Helpers to safely respond when used as an Express handler OR an internal function
const safeJson = (res, payload) => {
    if (res && typeof res.json === 'function') return res.json(payload);
    return payload;
};

const safeStatusJson = (res, statusCode, payload) => {
    if (res && typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(statusCode).json(payload);
    }
    return payload;
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

        // Send using Firebase Admin SDK (v13+)
        const response = await admin.messaging().sendEachForMulticast(message);
        
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
    console.log("🚀 Create in-app notification called");
    console.log("📝 Notification data:", JSON.stringify(data, null, 2));
    console.log("📝 Notification type:", type);
    console.log("📝 Notification recipient:", recipientId);
    console.log("📝 Notification sender:", data.employeeId || recipientId);
    console.log("📝 Notification title:", title);
    console.log("📝 Notification message:", message);
    try {
        // Ensure all fields in the data object are defined
        const notificationData = {
            recipientId: recipientId,
            senderId: data.employeeId || recipientId,
            title: title,
            message: message,
            type: type,
            data: {
                ...data,
                comment: data.comment || '' // Provide a default value if comment is undefined
            },
            channels: [NOTIFICATION_CHANNELS.IN_APP],
            isRead: false
        };

        // Create notification record
        const savedNotification = await createNotificationRecord(notificationData);
        
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
            leaveRequestId, // Add leave request ID
            leaveType, 
            fromDate, 
            toDate, 
            reason, 
            managerId,
            channels = ['in_app', 'push'], // Only free channels
            titleOverride,
            messageOverride
        } = req.body;

        if (!employeeId || !leaveType || !managerId) {
            return safeStatusJson(res, 400, {
                success: false,
                message: "Employee ID, leave type, and manager ID are required"
            });
        }

        // Get employee data (by doc id or uid)
        const employeeRef = await findEmployeeDocRef(employeeId);
        if (!employeeRef) {
            return safeStatusJson(res, 404, { success: false, message: "Employee not found" });
        }
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return safeStatusJson(res, 404, {
                success: false,
                message: "Employee not found"
            });
        }

        const employeeData = employeeDoc.data();
        const managerRef = await findEmployeeDocRef(managerId);
        if (!managerRef) {
            return safeStatusJson(res, 404, { success: false, message: "Manager not found" });
        }
        const managerSnap = await managerRef.get();
        const manager = managerSnap.data();

        // Prepare notification content
        const defaultTitle = `New Leave Request from ${employeeData.firstName} ${employeeData.lastName}`;
        const dateRange = (() => {
            if (fromDate && toDate) {
                if (fromDate === toDate) return fromDate;
                return `${fromDate} - ${toDate}`;
            }
            return fromDate || toDate || '';
        })();
        const defaultMessage = `${employeeData.firstName} ${employeeData.lastName} has requested ${leaveType} leave${dateRange ? ` (${dateRange})` : ''}.${reason ? ` Reason: ${reason}` : ''}`;
        const title = titleOverride || defaultTitle;
        const message = messageOverride || defaultMessage;

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
                                leaveRequestId: leaveRequestId,
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
                            { employeeId, leaveRequestId, leaveType, fromDate, toDate, reason }
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

        // Note: Notifications are already created by individual channel handlers above
        // No need for additional createNotificationRecord to avoid duplicates

        return safeJson(res, {
            success: true,
            message: "Leave request notifications sent successfully (FREE channels only)",
            results: results
        });

    } catch (error) {
        console.error("❌ Error sending leave request notification:", error);
        return safeStatusJson(res, 500, {
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
            leaveType,
            fromDate,
            toDate,
            employeeName,
            firstName,
            lastName,
            positionName,
            channels = ['in_app', 'push'] // Only free channels
        } = req.body;

        if (!employeeId || !status || !approvedBy) {
            return safeStatusJson(res, 400, {
                success: false,
                message: "Employee ID, status, and approver ID are required"
            });
        }

        // Get employee data (by doc id or uid)
        const employeeRef = await findEmployeeDocRef(employeeId);
        if (!employeeRef) {
            return safeStatusJson(res, 404, { success: false, message: "Employee not found" });
        }
        const employeeDoc = await employeeRef.get();
        
        if (!employeeDoc.exists) {
            return safeStatusJson(res, 404, {
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
                                employeeId: employeeId,
                                leaveRequestId: leaveRequestId,
                                leaveType: leaveType,
                                employeeName: employeeName,
                                positionName: positionName
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
                            { 
                                employeeId,
                                leaveRequestId, 
                                status, 
                                reason,
                                leaveType,
                                fromDate,
                                toDate,
                                employeeName,
                                firstName,
                                lastName,
                                positionName
                            }
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

        // Note: Notifications are already created by individual channel handlers above
        // No need for additional createNotificationRecord to avoid duplicates

        return safeJson(res, {
            success: true,
            message: `Leave ${status} notifications sent successfully (FREE channels only)`,
            results: results
        });

    } catch (error) {
        console.error("❌ Error sending leave status notification:", error);
        return safeStatusJson(res, 500, {
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

// Helper: find employee doc by docId or by uid field
const findEmployeeDocRef = async (employeeId) => {
    // Try direct doc id first
    let docRef = db.collection('employees').doc(employeeId);
    const byId = await docRef.get();
    if (byId.exists) return docRef;

    // Fallback: query by uid
    const snap = await db.collection('employees').where('uid', '==', employeeId).limit(1).get();
    if (!snap.empty) {
        return db.collection('employees').doc(snap.docs[0].id);
    }
    return null;
};

// POST /notifications/devices/register
const registerDevice = async (req, res) => {
    try {
        const { employeeId, token, platform, appVersion } = req.body || {};
        if (!employeeId || !token) {
            return res.status(400).json({ success: false, message: 'employeeId and token are required' });
        }
        const empRef = await findEmployeeDocRef(employeeId);
        if (!empRef) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        await empRef.set({
            deviceTokens: FieldValue.arrayUnion(token),
            devices: FieldValue.arrayUnion({ token, platform: platform || 'unknown', appVersion: appVersion || '', registeredAt: new Date().toISOString() })
        }, { merge: true });

        return res.json({ success: true, message: 'Device registered' });
    } catch (err) {
        console.error('❌ registerDevice error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

// DELETE /notifications/devices/:token (employeeId in query/body optional)
const unregisterDevice = async (req, res) => {
    try {
        const { token } = req.params;
        const { employeeId } = req.query;
        if (!token) return res.status(400).json({ success: false, message: 'token is required' });

        let empRef = null;
        if (employeeId) {
            empRef = await findEmployeeDocRef(employeeId);
        } else {
            // Best-effort search by token
            const snap = await db.collection('employees').where('deviceTokens', 'array-contains', token).limit(1).get();
            if (!snap.empty) empRef = db.collection('employees').doc(snap.docs[0].id);
        }
        if (!empRef) return res.status(404).json({ success: false, message: 'Employee not found for token' });

        await empRef.set({
            deviceTokens: FieldValue.arrayRemove(token)
        }, { merge: true });

        return res.json({ success: true, message: 'Device unregistered' });
    } catch (err) {
        console.error('❌ unregisterDevice error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

// GET /notifications/unread-count/:employeeId
const getUnreadCount = async (req, res) => {
    try {
        const { employeeId } = req.params;
        if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId is required' });
        const snap = await db.collection('app_notifications')
            .where('recipientId', '==', employeeId)
            .where('isRead', '==', false)
            .get();
        return res.json({ success: true, unread: snap.size });
    } catch (err) {
        console.error('❌ getUnreadCount error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

// POST /notifications/read-all { employeeId }
const markAllAsRead = async (req, res) => {
    try {
        const { employeeId } = req.body || {};
        if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId is required' });
        const snap = await db.collection('app_notifications')
            .where('recipientId', '==', employeeId)
            .where('isRead', '==', false)
            .get();
        const batch = db.batch();
        snap.forEach(doc => batch.update(doc.ref, { isRead: true, readAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
        await batch.commit();
        return res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        console.error('❌ markAllAsRead error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

// POST /notifications/push/test { employeeId, title, body }
const sendTestPush = async (req, res) => {
    try {
        const { employeeId, title, body } = req.body || {};
        if (!employeeId || !title || !body) return res.status(400).json({ success: false, message: 'employeeId, title, body are required' });
        const empRef = await findEmployeeDocRef(employeeId);
        if (!empRef) return res.status(404).json({ success: false, message: 'Employee not found' });
        const empDoc = await empRef.get();
        const tokens = (empDoc.data().deviceTokens || []).filter(Boolean);
        if (tokens.length === 0) return res.status(200).json({ success: true, message: 'No device tokens to send' });
        const result = await sendPushNotification(tokens, title, body, { type: 'test' });
        return res.json({ success: true, ...result });
    } catch (err) {
        console.error('❌ sendTestPush error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

module.exports.registerDevice = registerDevice;
module.exports.unregisterDevice = unregisterDevice;
module.exports.getUnreadCount = getUnreadCount;
module.exports.markAllAsRead = markAllAsRead;
module.exports.sendTestPush = sendTestPush;
