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


// Create in-app notification
const createInAppNotification = async (recipientId, title, message, type, data = {}) => {
   
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
    console.log(" sendLeaveRequestNotification : ", req.body);
    //  try {
        let { 
            employeeId, 
            leaveRequestId, // Add leave request ID
            leaveType, 
            leaveTypeNameEng,
            fromDate, 
            toDate, 
            reason, 
            managerId,
            channels = ['in_app', 'push'], // Only free channels
            titleOverride,
            messageOverride
        } = req.body;
        
        // Only fetch employee data if we need it for default message (no overrides provided)
        let employeeData = null;
        if (!titleOverride || !messageOverride) {
        const employeeRef = await findEmployeeDocRef(employeeId);
            if (employeeRef) {
        const employeeDoc = await employeeRef.get();
                if (employeeDoc.exists) {
                    employeeData = employeeDoc.data();
                }
            }
        }

        const managerRef = await findEmployeeDocRef(managerId);
        if (!managerRef) {
            console.warn(`⚠️ Approver not found: ${managerId}`);
            return safeJson(res, {
                success: true,
                message: "Approver not found - no notifications sent",
                results: []
            });
        }
        const managerSnap = await managerRef.get();
        if (!managerSnap.exists) {
            console.warn(`⚠️ Approver document does not exist: ${managerId}`);
            return safeJson(res, {
                success: true,
                message: "Approver not found - no notifications sent",
                results: []
            });
        }
        const manager = managerSnap.data();
        // if (!manager) {
        //     return safeStatusJson(res, 404, { success: false, message: "Manager not found" });
        // }
        // if (!manager.exists) {
        //     return safeStatusJson(res, 404, {
        //         success: false,
        //         message: "Manager not found"
        //     });
        // }

        // Prepare notification content
        const employeeName = employeeData 
            ? `${employeeData.firstName} ${employeeData.lastName}`
            : employeeId || 'An employee';
        const defaultTitle = `New Leave Request from ${employeeName}`;
        const dateRange = (() => {
            if (fromDate && toDate) {
                if (fromDate === toDate) return fromDate;
                return `${fromDate} - ${toDate}`;
            }
            return fromDate || toDate || '';
        })();
        const leaveLabel = leaveTypeNameEng ? `${leaveTypeNameEng} (${leaveType})` : leaveType;
        const defaultMessage = `${employeeName} has requested ${leaveLabel} leave${dateRange ? ` (${dateRange})` : ''}.${reason ? ` Reason: ${reason}` : ''}`;
        const title = titleOverride || defaultTitle;
        const message = messageOverride || defaultMessage;

        const results = [];
        console.log('📨 title: 1', title);
        console.log('📨 message: 1', message);
        console.log('📨 channels: 1', channels);
        console.log('📨 titleOverride: 1', titleOverride);
        console.log('📨 messageOverride: 1', messageOverride);
        console.log('📨 defaultTitle: 1', defaultTitle);
        console.log('📨 manager: 1', manager);

        // Send notifications through FREE channels only
        for (const channel of channels) {
            console.log('📨 channel: 2', channel);
            try {
                switch (channel) {
                    case NOTIFICATION_CHANNELS.PUSH:
                        // Get device tokens from manager's profile
                        let deviceTokens = manager.deviceTokens || [];
                        console.log('📨 deviceTokens: 2', deviceTokens);
                        if ((!deviceTokens || deviceTokens.length === 0) && Array.isArray(manager.devices)) {
                            console.log('📨 manager.devices: 1', manager.devices);
                            deviceTokens = manager.devices
                                .map(device => device && device.token)
                                .filter(Boolean);
                        }
                        console.log('📨 deviceTokens: 1', deviceTokens.length);
                        if (deviceTokens && deviceTokens.length > 0) {
                            const uniqueTokens = Array.from(new Set(deviceTokens));
                            const pushResult = await sendPushNotification(uniqueTokens, title, message, {
                                type: 'leave_request',
                                employeeId: employeeId,
                                leaveRequestId: leaveRequestId,
                                leaveType: leaveType,
                                leaveTypeNameEng: leaveTypeNameEng
                            });
                            results.push({ channel: 'push', ...pushResult });
                        } else {
                            console.warn(`⚠️ No device tokens found for approver ${managerId}`);
                            results.push({ channel: 'push', success: false, message: 'No device tokens found' });
                        }
                        break;

                    case NOTIFICATION_CHANNELS.IN_APP:
                        const inAppResult = await createInAppNotification(
                            managerId,
                            title,
                            message,
                            NOTIFICATION_TYPES.LEAVE_REQUEST,
                            { employeeId, leaveRequestId, leaveType, leaveTypeNameEng, fromDate, toDate, reason }
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

    // } catch (error) {
    //     console.error("❌ Error sending leave request notification:", error);
    //     return safeStatusJson(res, 500, {
    //         success: false,
    //         message: "Failed to send notifications",
    //         error: error.message
    //     });
    // }
};

// NEW: Simplified version - send notification to specific approver by employee ID
// Takes approver employee ID and notification content directly
// Optional deviceTokens parameter to avoid re-fetching approver document
const sendLeaveRequestNotificationToApprover = async (approverEmployeeId, {
    title,
    message,
    employeeId,
    leaveRequestId,
    leaveType,
    leaveTypeNameEng,
    fromDate,
    toDate,
    reason
}, deviceTokens = null) => {
    try {
        console.log(`[NOTIF] Sending to approver ${approverEmployeeId} - Title: "${title}"`);
        
        let sanitizedTokens = [];
        let approverData = null;

        // Use provided device tokens, or fetch approver data if not provided
        if (deviceTokens && Array.isArray(deviceTokens)) {
            console.log('📨 deviceTokens: 3', deviceTokens);
            sanitizedTokens = sanitizeDeviceTokens(deviceTokens);
        } 
        else {
            console.log('📨 deviceTokens: 4', deviceTokens);
            // Get approver's data (for device tokens) - only if not provided
            const approverRef = await findEmployeeDocRef(approverEmployeeId);
            if (!approverRef) {
                console.error(`[NOTIF] ERROR: Approver not found: ${approverEmployeeId}`);
                return { success: false, message: "Approver not found" };
            }

            const approverDoc = await approverRef.get();
            if (!approverDoc.exists) {
                console.error(`[NOTIF] ERROR: Approver document not found: ${approverEmployeeId}`);
                return { success: false, message: "Approver document not found" };
            }

            approverData = approverDoc.data();
            sanitizedTokens = sanitizeDeviceTokens(approverData.deviceTokens || []);
        }

        const results = [];

        // Send push notification
        console.log('📨 sanitizedTokens: 1', sanitizedTokens);
        
        if (sanitizedTokens.length > 0) {
            console.log('📨 sanitizedTokens: 2', sanitizedTokens);
            const pushResult = await sendPushNotification(
                sanitizedTokens,
                title,
                message,
                {
                    type: 'leave_request',
                    employeeId: employeeId,
                    leaveRequestId: leaveRequestId,
                    leaveType: leaveType,
                    leaveTypeNameEng: leaveTypeNameEng
                }
            );
            results.push({ channel: 'push', ...pushResult });
        } else {
            console.warn(`[NOTIF] No device tokens for ${approverEmployeeId}`);
            results.push({ channel: 'push', success: false, message: 'No device tokens found' });
        }

        // Send in-app notification
        const inAppResult = await createInAppNotification(
            approverEmployeeId,
            title,
            message,
            NOTIFICATION_TYPES.LEAVE_REQUEST,
            {
                employeeId,
                leaveRequestId,
                leaveType,
                leaveTypeNameEng,
                fromDate,
                toDate,
                reason
            }
        );
        results.push({ channel: 'in_app', notification: inAppResult });

        console.log(`[NOTIF] ✅ Sent to ${approverEmployeeId} - Push: ${results.find(r => r.channel === 'push')?.success || false}, In-app: ${!!inAppResult.id}`);

        return {
            success: true,
            message: "Notification sent to approver",
            results: results
        };

    } catch (error) {
        console.error(`[NOTIF] ❌ Error sending to ${approverEmployeeId}:`, error.message);
        return {
            success: false,
            message: "Failed to send notification",
            error: error.message
        };
    }
};

const sanitizeDeviceTokens = (tokens = []) => {
    if (!Array.isArray(tokens)) return [];
    return Array.from(
        new Set(
            tokens
                .map(token => (typeof token === 'string' ? token.trim() : ''))
                .filter(token => token.length > 0)
        )
    );
};

const sendPushNotification = async (deviceTokens, title, body, data = {}) => {
    const sanitizedTokens = sanitizeDeviceTokens(deviceTokens);
    console.log('📨 sendPushNotification: tokens', sanitizedTokens, title, body, data);

    if (sanitizedTokens.length === 0) {
        console.log('⚠️ No valid device tokens provided for push notification');
            return { success: false, message: 'No device tokens provided' };
        }

    console.log('📨 FCM tokens:', sanitizedTokens);

        // Prepare the message with platform-specific configuration
        // For iOS: Use notification block + APNs headers (simpler, works better)
        // For Android: Add Android-specific config for priority and sound
        const message = {
            tokens: sanitizedTokens,
            notification: {
                title: title,  // Works for both iOS and Android
                body: body     // Works for both iOS and Android
            },
            data: data,
            // Android config (only affects Android devices)
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'nano_hr_foreground'
                }
            },
            // iOS config - use minimal APNs headers (notification block handles the alert)
            apns: {
                headers: {
                    'apns-priority': '10',          // Required: High priority for immediate delivery
                    'apns-push-type': 'alert',      // Required: Without this, APNs silently discards (iOS 13+)
                    // apns-topic: Automatically set by Firebase Admin SDK
                },
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                        // Don't duplicate alert here - notification block handles it
                    }
                }
            }
        };
        // Send using Firebase Admin SDK (v13+)
        let response;
        try {
            response = await admin.messaging().sendEachForMulticast(message);
            
            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const token = sanitizedTokens[idx];
                        console.error(`[FCM] ❌ Failed token ${token ? token.substring(0, 20) + '...' : 'unknown'}: ${resp.error?.code || 'unknown'} - ${resp.error?.message || 'unknown'}`);
                    }
                });
            }
            
            if (response.successCount > 0) {
                console.log(`[FCM] ✅ Sent to ${response.successCount} device(s) | ❌ ${response.failureCount} failed`);
            } else {
                console.error(`[FCM] ❌ All ${response.failureCount} notification(s) failed`);
            }
        } catch (fcmError) {
            console.error('[FCM] ❌ ERROR:', fcmError.message);
            return {
                success: false,
                message: 'Failed to send push notification',
                error: fcmError.message,
                successCount: 0,
                failureCount: sanitizedTokens.length
            };
        }
        
        return { 
            success: response.successCount > 0, 
            message: response.successCount > 0 
                ? 'Push notification sent successfully' 
                : 'All push notifications failed',
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses.map((resp, idx) => ({
                token: sanitizedTokens[idx] ? `${sanitizedTokens[idx].substring(0, 20)}...` : 'unknown',
                success: resp.success,
                error: resp.error ? {
                    code: resp.error.code,
                    message: resp.error.message
                } : null
            }))
        };
    // } catch (error) {
    //     console.error('❌ Error sending push notification:', error);
    //     throw error;
    // }
};
const sendPushNotification3 = async (deviceTokens, title, body, data = {}) => {
    const sanitizedTokens = sanitizeDeviceTokens(deviceTokens);
    console.log('📨 sendPushNotification: tokens', sanitizedTokens, title, body, data);

    if (sanitizedTokens.length === 0) {
        console.log('⚠️ No valid device tokens provided for push notification');
        return { success: false, message: 'No device tokens provided' };
    }

    console.log('📨 FCM tokens:', sanitizedTokens);

        // Prepare the message
        const message = {
            tokens: sanitizedTokens,
            notification: {
                title: title,
                body: body
            },
            data: data,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default'
                }
            },
            apns: {
                headers: {
                    'apns-priority': '10',
                    'apns-push-type': 'alert'
                },
                payload: {
                    aps: {
                        alert: {
                            title: title,
                            body: body
                        },
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };
        // Send using Firebase Admin SDK (v13+)
        const response = await admin.messaging().sendEachForMulticast(message);
        
        console.log(`📲 Push Notification sent:`);
        console.log(`   Success Count: ${response.successCount}`);
        console.log(`   Failure Count: ${response.failureCount}`);
        
        if (response.failureCount > 0) {
            console.log('❌ Failed tokens:', response.responses
                .map((resp, idx) => resp.success ? null : sanitizedTokens[idx])
                .filter(token => token !== null));
        }
        
        return { 
            success: true, 
            message: 'Push notification sent successfully',
            successCount: response.successCount,
            failureCount: response.failureCount
        };
    // } catch (error) {
    //     console.error('❌ Error sending push notification:', error);
    //     throw error;
    // }
};

const sendPushNotification2 = async (deviceTokens, title, body, data = {}) => {
    const sanitizedTokens = sanitizeDeviceTokens(deviceTokens);
    console.log('📨 sendPushNotification: 1', sanitizedTokens, title, body, data);
  
    if (sanitizedTokens.length === 0) {
      console.log('⚠️ No device tokens provided for push notification');
      return { success: false, message: 'No device tokens provided' };
    }
  
    console.log('📨 FCM tokens:', sanitizedTokens);
  
    // Prepare the message with Android + iOS optimization
    const message = {
      tokens: sanitizedTokens,
      notification: {
        title: title,
        body: body,
      },
      data: data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'high_importance_channel', // optional, if you defined custom channels
        },
      },
      apns: {
        headers: {
          'apns-priority': '10', // 🚀 high priority = immediate delivery
          'apns-push-type': 'alert', // required for visible notifications on iOS 13+
        },
        payload: {
          aps: {
            alert: {
              title: title,
              body: body,
            },
            sound: 'default',
            badge: 1,
            contentAvailable: true, // allows background updates
          },
        },
      },
    };
  
    try {
      const response = await admin.messaging().sendEachForMulticast(message);
  
      console.log('📲 Push Notification sent:');
      console.log(`   ✅ Success Count: ${response.successCount}`);
      console.log(`   ❌ Failure Count: ${response.failureCount}`);
  
      if (response.failureCount > 0) {
        const failedTokens = response.responses
                .map((resp, idx) => (resp.success ? null : sanitizedTokens[idx]))
          .filter(token => token !== null);
        console.log('❌ Failed tokens:', failedTokens);
      }
  
      return {
        success: true,
        message: 'Push notification sent successfully',
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      throw error;
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
            leaveTypeNameEng,
            fromDate,
            toDate,
            employeeName,
            firstName,
            lastName,
            positionName,
            statusName,
            channels = ['in_app', 'push'] // Only free channels
        } = req.body;

        if (!employeeId || !status || !approvedBy) {
            return safeStatusJson(res, 400, {
                success: false,
                message: "Employee ID, status, and approver ID are required"
            });
        }
        console.log('📨 employeeId: 1', employeeId);
        console.log('📨 status: 1', status);
        console.log('📨 approvedBy: 1', approvedBy);
        // Get employee data (by doc id or uid)
        const employeeRef = await findEmployeeDocRef(employeeId);
        console.log('📨 employeeRef: 1', employeeRef);
        if (!employeeRef) {
            return safeStatusJson(res, 404, { success: false, message: "Employee not found" });
        }
        const employeeDoc = await employeeRef.get();
        console.log('📨 employeeDoc: 1', employeeDoc);
        if (!employeeDoc.exists) {
            return safeStatusJson(res, 404, {
                success: false,
                message: "Employee not found"
            });
        }

        const employeeData = employeeDoc.data();
        console.log('📨 employeeData: 1', employeeData);
        // Prepare notification content
        const statusLabel = statusName || status.charAt(0).toUpperCase() + status.slice(1);
        const title = `Leave Request ${statusLabel}`;
        const titleTh = `การแจ้งเตือนการขอลา ${statusLabel}`;
        const reasonPart = reason ? ` Reason: ${reason}` : '';
        const message = `Your leave request has been ${statusLabel}.${reasonPart}`;
        const messageTh = `การขอลาของคุณได้รับการ${statusLabel}.${reason ? ` เหตุผล: ${reason}` : ''}`;

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
                                leaveTypeNameEng: leaveTypeNameEng,
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
                                leaveTypeNameEng,
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
            messageTh: "การแจ้งเตือนการขอลาได้รับการดำเนินการสำเร็จ",
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
    sendLeaveRequestNotificationToApprover, // NEW: Simplified version
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
    console.log('📨 findEmployeeDocRef: 1', employeeId);

    // Try direct doc id first
    const docRef = db.collection('employees').doc(employeeId);
    try {
        const byId = await docRef.get();
        console.log('📨 byId.exists:', byId.exists);
        if (byId.exists) {
            console.log('📨 returning docRef by id');
            return docRef;
        }
    } catch (err) {
        console.error('❌ Error getting employee doc by id:', err);
    }

    // Fallback: query by uid
    try {
        const snap = await db.collection('employees')
            .where('uid', '==', employeeId)
            .limit(1)
            .get();
        console.log('📨 snap.empty:', snap.empty);
        if (!snap.empty) {
            console.log('📨 snap.docs[0].id:', snap.docs[0].id);
            return db.collection('employees').doc(snap.docs[0].id);
        }
    } catch (err) {
        console.error('❌ Error querying employee by uid:', err);
    }

    return null;
};
const findEmployeeDocRefs = async (employeeId) => {
    console.log('📨 Searching employee with ID/UID:', employeeId);
  
    try {
      // 1️⃣ Try direct document ID first
      const docRef = db.collection('employees').doc(employeeId);
      console.log('📨 docRef: 1', docRef);
      const docSnap = await docRef.get();
      console.log('📨 docSnap: 1', docSnap);
      if (docSnap.exists) {
        console.log('✅ Found employee by document ID:', docSnap.id);
        console.log('📨 Employee data:', docSnap.data());
        return docRef;
      }
  
      // 2️⃣ Fallback: query by uid field
      const querySnap = await db.collection('employees')
        .where('uid', '==', employeeId)
        .limit(1)
        .get();
  
      if (!querySnap.empty) {
        const foundDoc = querySnap.docs[0];
        console.log('✅ Found employee by UID:', foundDoc.id);
        console.log('📨 Employee data:', foundDoc.data());
        return db.collection('employees').doc(foundDoc.id);
      }
  
      // 3️⃣ Employee not found
      console.warn('⚠️ Employee not found:', employeeId);
      return null;
  
    } catch (err) {
      console.error('❌ Error fetching employee document:', err);
      return null;
    }
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

        const normalizedPlatform = (platform || 'unknown').toLowerCase();
        const nowIso = new Date().toISOString();

        await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(empRef);
            const existingData = snap.exists ? snap.data() : {};

            const existingDeviceTokens = Array.isArray(existingData.deviceTokens)
                ? existingData.deviceTokens
                : [];
            const existingDevices = Array.isArray(existingData.devices)
                ? existingData.devices
                : [];

            const dedupedTokens = Array.from(
                new Set(
                    existingDeviceTokens
                        .concat(token)
                        .filter(t => typeof t === 'string' && t.trim().length > 0)
                        .map(t => t.trim())
                )
            );

            const filteredDevices = existingDevices.filter(device => {
                if (!device || typeof device !== 'object') return false;
                if (!device.token || typeof device.token !== 'string') return false;

                const sameToken = device.token === token;
                const samePlatform = device.platform && device.platform.toLowerCase() === normalizedPlatform;

                // keep device records that don't match platform/token combo
                return !sameToken && !samePlatform;
            });

            filteredDevices.push({
                token,
                platform: normalizedPlatform,
                appVersion: appVersion || '',
                registeredAt: nowIso
            });

            transaction.set(
                empRef,
                {
                    deviceTokens: dedupedTokens,
                    devices: filteredDevices,
                    updatedAt: nowIso
                },
                { merge: true }
            );
        });

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

        await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(empRef);
            if (!snap.exists) return;

            const data = snap.data() || {};
            const existingTokens = Array.isArray(data.deviceTokens) ? data.deviceTokens : [];
            const existingDevices = Array.isArray(data.devices) ? data.devices : [];

            const remainingTokens = existingTokens.filter(
                existingToken => typeof existingToken === 'string' && existingToken !== token
            );
            const remainingDevices = existingDevices.filter(
                device => device && device.token !== token
            );

            transaction.set(
                empRef,
                {
                    deviceTokens: remainingTokens,
                    devices: remainingDevices,
                    updatedAt: new Date().toISOString()
                },
                { merge: true }
            );
        });

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
        if (!employeeId || !title || !body) {
            return res.status(400).json({ success: false, message: 'employeeId, title, body are required' });
        }
        
        console.log(`📨 sendTestPush: Testing push for employee ${employeeId}`);
        
        const empRef = await findEmployeeDocRef(employeeId);
        if (!empRef) {
            console.warn(`⚠️ Employee not found: ${employeeId}`);
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        
        const empDoc = await empRef.get();
        if (!empDoc.exists) {
            console.warn(`⚠️ Employee document does not exist: ${employeeId}`);
            return res.status(404).json({ success: false, message: 'Employee document not found' });
        }
        
        const empData = empDoc.data();
        const rawTokens = empData.deviceTokens || [];
        const sanitizedTokens = sanitizeDeviceTokens(rawTokens);
        
        console.log(`📨 Employee ${employeeId} has ${rawTokens.length} raw token(s), ${sanitizedTokens.length} valid token(s)`);
        console.log(`📨 Valid tokens:`, sanitizedTokens);
        
        if (sanitizedTokens.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: 'No valid device tokens found for employee',
                rawTokensCount: rawTokens.length,
                validTokensCount: 0
            });
        }
        
        const result = await sendPushNotification(sanitizedTokens, title, body, { type: 'test' });
        console.log(`📨 Test push result:`, result);
        
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
module.exports.findEmployeeDocRef = findEmployeeDocRef;
