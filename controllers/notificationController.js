const { admin, db } = require("../config/firebaseConfig");
const { v4: uuidv4 } = require('uuid');

// Notification service configuration
const NOTIFICATION_TYPES = {
    LEAVE_REQUEST: 'leave_request',
    LEAVE_APPROVED: 'leave_approved',
    LEAVE_REJECTED: 'leave_rejected',
    ATTENDANCE_REMINDER: 'attendance_reminder',
    PAYROLL_READY: 'payroll_ready',
    SYSTEM_ANNOUNCEMENT: 'system_announcement',
    BIRTHDAY_WISH: 'birthday_wish',
    WORK_ANNIVERSARY: 'work_anniversary'
};

const NOTIFICATION_CHANNELS = {
    EMAIL: 'email',
    SMS: 'sms',
    PUSH: 'push',
    IN_APP: 'in_app'
};

// Email service configuration (using a simple SMTP approach)
const emailConfig = {
    // You can integrate with services like SendGrid, AWS SES, or Nodemailer
    // For now, we'll use a placeholder configuration
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
};

// SMS service configuration (you can integrate with Twilio, AWS SNS, etc.)
const smsConfig = {
    // Placeholder for SMS service configuration
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || ''
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

// Send email notification
const sendEmailNotification = async (to, subject, htmlContent, textContent) => {
    try {
        // For now, we'll log the email content
        // In production, integrate with actual email service like SendGrid, AWS SES, etc.
        console.log(`📧 Email Notification:`);
        console.log(`   To: ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Content: ${textContent}`);
        
        // TODO: Implement actual email sending
        // Example with Nodemailer:
        // const nodemailer = require('nodemailer');
        // const transporter = nodemailer.createTransporter(emailConfig);
        // await transporter.sendMail({ to, subject, html: htmlContent, text: textContent });
        
        return { success: true, message: 'Email notification sent successfully' };
    } catch (error) {
        console.error('❌ Error sending email notification:', error);
        throw error;
    }
};

// Send SMS notification
const sendSMSNotification = async (to, message) => {
    try {
        // For now, we'll log the SMS content
        // In production, integrate with actual SMS service like Twilio, AWS SNS, etc.
        console.log(`📱 SMS Notification:`);
        console.log(`   To: ${to}`);
        console.log(`   Message: ${message}`);
        
        // TODO: Implement actual SMS sending
        // Example with Twilio:
        // const twilio = require('twilio');
        // const client = twilio(smsConfig.accountSid, smsConfig.authToken);
        // await client.messages.create({ body: message, from: smsConfig.fromNumber, to: to });
        
        return { success: true, message: 'SMS notification sent successfully' };
    } catch (error) {
        console.error('❌ Error sending SMS notification:', error);
        throw error;
    }
};

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

// Send leave request notification
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
            channels = ['email', 'in_app'] 
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
        const subject = `Leave Request from ${employeeData.firstName} ${employeeData.lastName}`;
        const emailContent = `
            <h3>New Leave Request</h3>
            <p><strong>Employee:</strong> ${employeeData.firstName} ${employeeData.lastName}</p>
            <p><strong>Leave Type:</strong> ${leaveType}</p>
            <p><strong>From:</strong> ${fromDate}</p>
            <p><strong>To:</strong> ${toDate}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Please review and approve/reject this request.</p>
        `;

        const smsContent = `Leave request from ${employeeData.firstName} ${employeeData.lastName} for ${leaveType} from ${fromDate} to ${toDate}. Please check your dashboard.`;

        const pushTitle = "New Leave Request";
        const pushBody = `Leave request from ${employeeData.firstName} ${employeeData.lastName}`;

        const results = [];

        // Send notifications through requested channels
        for (const channel of channels) {
            try {
                switch (channel) {
                    case NOTIFICATION_CHANNELS.EMAIL:
                        if (manager.email) {
                            const emailResult = await sendEmailNotification(
                                manager.email, 
                                subject, 
                                emailContent, 
                                emailContent.replace(/<[^>]*>/g, '')
                            );
                            results.push({ channel: 'email', ...emailResult });
                        }
                        break;

                    case NOTIFICATION_CHANNELS.SMS:
                        if (manager.primary_number) {
                            const smsResult = await sendSMSNotification(manager.primary_number, smsContent);
                            results.push({ channel: 'sms', ...smsResult });
                        }
                        break;

                    case NOTIFICATION_CHANNELS.PUSH:
                        // You would get device tokens from manager's profile
                        const deviceTokens = manager.deviceTokens || [];
                        const pushResult = await sendPushNotification(deviceTokens, pushTitle, pushBody, {
                            type: 'leave_request',
                            employeeId: employeeId,
                            leaveType: leaveType
                        });
                        results.push({ channel: 'push', ...pushResult });
                        break;

                    case NOTIFICATION_CHANNELS.IN_APP:
                        const inAppResult = await createInAppNotification(
                            managerId,
                            pushTitle,
                            pushBody,
                            NOTIFICATION_TYPES.LEAVE_REQUEST,
                            { employeeId, leaveType, fromDate, toDate }
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
            title: subject,
            message: emailContent,
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
            message: "Leave request notifications sent successfully",
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

// Send leave approval/rejection notification
const sendLeaveStatusNotification = async (req, res) => {
    console.log("🚀 Send leave status notification called");
    try {
        const { 
            employeeId, 
            leaveRequestId,
            status, // 'approved' or 'rejected'
            approvedBy,
            reason,
            channels = ['email', 'in_app'] 
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
        const subject = `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`;
        const emailContent = `
            <h3>Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}</h3>
            <p>Dear ${employeeData.firstName} ${employeeData.lastName},</p>
            <p>Your leave request has been <strong>${status}</strong>.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>Thank you for your understanding.</p>
        `;

        const pushTitle = `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`;
        const pushBody = `Your leave request has been ${status}`;

        const results = [];

        // Send notifications through requested channels
        for (const channel of channels) {
            try {
                switch (channel) {
                    case NOTIFICATION_CHANNELS.EMAIL:
                        if (employeeData.email) {
                            const emailResult = await sendEmailNotification(
                                employeeData.email, 
                                subject, 
                                emailContent, 
                                emailContent.replace(/<[^>]*>/g, '')
                            );
                            results.push({ channel: 'email', ...emailResult });
                        }
                        break;

                    case NOTIFICATION_CHANNELS.SMS:
                        if (employeeData.primary_number) {
                            const smsContent = `Your leave request has been ${status}. ${reason ? `Reason: ${reason}` : ''}`;
                            const smsResult = await sendSMSNotification(employeeData.primary_number, smsContent);
                            results.push({ channel: 'sms', ...smsResult });
                        }
                        break;

                    case NOTIFICATION_CHANNELS.PUSH:
                        const deviceTokens = employeeData.deviceTokens || [];
                        const pushResult = await sendPushNotification(deviceTokens, pushTitle, pushBody, {
                            type: status === 'approved' ? 'leave_approved' : 'leave_rejected',
                            leaveRequestId: leaveRequestId
                        });
                        results.push({ channel: 'push', ...pushResult });
                        break;

                    case NOTIFICATION_CHANNELS.IN_APP:
                        const inAppResult = await createInAppNotification(
                            employeeId,
                            pushTitle,
                            pushBody,
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
            title: subject,
            message: emailContent,
            channels: channels,
            data: {
                leaveRequestId,
                status,
                reason
            }
        });

        res.json({
            success: true,
            message: `Leave ${status} notifications sent successfully`,
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

// Send system announcement
const sendSystemAnnouncement = async (req, res) => {
    console.log("🚀 Send system announcement called");
    try {
        const { 
            title, 
            message, 
            targetUsers = 'all', // 'all' or array of user IDs
            channels = ['email', 'in_app', 'push'] 
        } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: "Title and message are required"
            });
        }

        let users = [];
        
        if (targetUsers === 'all') {
            // Get all employees
            const employeesSnapshot = await db.collection('employees').get();
            users = employeesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } else {
            // Get specific users
            for (const userId of targetUsers) {
                const userDoc = await db.collection('employees').doc(userId).get();
                if (userDoc.exists) {
                    users.push({
                        id: userDoc.id,
                        ...userDoc.data()
                    });
                }
            }
        }

        const results = [];
        const notifications = [];

        // Send to each user
        for (const user of users) {
            for (const channel of channels) {
                try {
                    switch (channel) {
                        case NOTIFICATION_CHANNELS.EMAIL:
                            if (user.email) {
                                const emailResult = await sendEmailNotification(
                                    user.email, 
                                    title, 
                                    `<h3>${title}</h3><p>${message}</p>`, 
                                    message
                                );
                                results.push({ userId: user.id, channel: 'email', ...emailResult });
                            }
                            break;

                        case NOTIFICATION_CHANNELS.IN_APP:
                            const inAppResult = await createInAppNotification(
                                user.id,
                                title,
                                message,
                                NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
                                {}
                            );
                            notifications.push(inAppResult);
                            results.push({ userId: user.id, channel: 'in_app', notification: inAppResult });
                            break;

                        case NOTIFICATION_CHANNELS.PUSH:
                            const deviceTokens = user.deviceTokens || [];
                            if (deviceTokens.length > 0) {
                                const pushResult = await sendPushNotification(deviceTokens, title, message, {
                                    type: 'system_announcement'
                                });
                                results.push({ userId: user.id, channel: 'push', ...pushResult });
                            }
                            break;
                    }
                } catch (channelError) {
                    console.error(`❌ Error sending ${channel} notification to user ${user.id}:`, channelError);
                    results.push({ 
                        userId: user.id,
                        channel: channel, 
                        success: false, 
                        error: channelError.message 
                    });
                }
            }
        }

        // Create notification record for system announcement
        const notificationRecord = await createNotificationRecord({
            type: NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
            recipientId: targetUsers === 'all' ? 'all_users' : targetUsers.join(','),
            senderId: 'system',
            title: title,
            message: message,
            channels: channels,
            data: {
                targetUsers: targetUsers,
                totalRecipients: users.length
            }
        });

        res.json({
            success: true,
            message: `System announcement sent to ${users.length} users`,
            totalRecipients: users.length,
            results: results,
            notificationId: notificationRecord.id
        });

    } catch (error) {
        console.error("❌ Error sending system announcement:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send system announcement",
            error: error.message
        });
    }
};

// Get user notifications
const getUserNotifications = async (req, res) => {
    console.log("🚀 Get user notifications called");
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20, unreadOnly = false } = req.query;

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
    sendSystemAnnouncement,
    getUserNotifications,
    markNotificationAsRead,
    // Export utility functions for use in other controllers
    sendEmailNotification,
    sendSMSNotification,
    sendPushNotification,
    createInAppNotification,
    createNotificationRecord,
    NOTIFICATION_TYPES,
    NOTIFICATION_CHANNELS
};
