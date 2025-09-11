const { v4: uuidV4 } = require('uuid');
const { admin, db } = require("../config/firebaseConfig");

// Check In/Out API
const checkInOut = async (req, res) => {
    console.log("Check In/Out called", req.body);
    try {
        const { 
            employeeId,
            employeeName,
            location,
            branch,
            branchName,
            type,
            checkInAt,
            checkOutAt            
        } = req.body; // type: 'checkin' or 'checkout'
        
        // Validate required fields
        if (!employeeId || !employeeName || !type || !location) {
            return res.status(400).json({
                success: false,
                message: "Employee ID, name, type, and location are required"
            });
        }

        // Validate type
        if (type !== 'checkin' && type !== 'checkout') {
            return res.status(400).json({
                success: false,
                message: "Type must be 'checkin' or 'checkout'"
            });
        }

        // Generate unique ID for this check in/out record
        const uid = uuidV4();
        
        // Get current date and time
        const currentDate = new Date();
        const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Convert to Thai local time (UTC+7)
        const thaiOffset = 7; // Thailand is UTC+7
        const localDate = new Date(currentDate.getTime() + (thaiOffset * 60 * 1000));
        const localTimeString = localDate.toTimeString().split(' ')[0]; // HH:MM:SS format only
        
        // Create check in/out record
        const checkRecord = {
            id: uid,
            uid: uid,
            employeeId: employeeId,
            employeeName: employeeName,
            company: company,
            location: location,
            branch: branch, 
            branchName: branchName,
            type: type, // 'checkin' or 'checkout'
            date: dateString, // Keep original UTC date
            time: localTimeString, // Use local time HH:MM:SS only
            checkInAt: type === 'checkin' ? localTimeString : null,
            checkOutAt: type === 'checkout' ? localTimeString : null,
            timestamp: currentDate.toISOString(), // Keep UTC for consistency
            createdAt: currentDate.toISOString(),
            updatedAt: currentDate.toISOString()
        };

        // Save to Firestore
        const checkRef = db.collection("employee-attendance").doc(uid);
        await checkRef.set(checkRecord);

        res.status(200).json({
            success: true,
            message: `${type === 'checkin' ? 'Check In' : 'Check Out'} recorded successfully`,
            data: {
                id: uid,
                employeeId: employeeId,
                employeeName: employeeName,
                location: location,
                branch: branch,
                branchName: branchName,
                type: type,
                date: dateString,
                checkInAt: type === 'checkin' ? localTimeString : null,
                checkOutAt: type === 'checkout' ? localTimeString : null,
                timestamp: currentDate.toISOString()
            }
        });

    } catch (error) {
        console.error("Check In/Out error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get employee check in/out history
const getCheckInOutHistory = async (req, res) => {
    console.log("Get check in/out history called", req.params, req.query);
    try {
        const { employeeId } = req.params;
        const { startDate, endDate, limit } = req.query;
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const limitNum = limit ? parseInt(limit) : 50;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 50 : Math.min(limitNum, 100); // Max 100 records

        let query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId);

        // Add date range filter if provided
        if (startDate && endDate) {
            query = query
                .where("date", ">=", startDate)
                .where("date", "<=", endDate);
        }

        // Order by timestamp descending (newest first)
        query = query.orderBy("timestamp", "desc");

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found for this employee"
            });
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Apply limit
        const limitedRecords = records.slice(0, validLimit);

        console.log("limitedRecords", limitedRecords);

        res.status(200).json({
            success: true,
            message: "Attendance history retrieved successfully",
            count: limitedRecords.length,
            totalRecords: records.length,
            data: limitedRecords
        });

    } catch (error) {
        console.error("Get check in/out history error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get ALL attendance history (for all employees)
const getAllAttendanceHistory = async (req, res) => {
    try {
        const { startDate, endDate, limit } = req.query;
        
        const limitNum = limit ? parseInt(limit) : 100;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 100 : Math.min(limitNum, 500); // Max 500 records for all employees

        let query = db.collection("employee-attendance");

        // Add date range filter if provided
        if (startDate && endDate) {
            query = query
                .where("date", ">=", startDate)
                .where("date", "<=", endDate);
        }

        // Order by timestamp descending (newest first)
        query = query.orderBy("timestamp", "desc");

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found"
            });
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Apply limit
        const limitedRecords = records.slice(0, validLimit);

        res.status(200).json({
            success: true,
            message: "All attendance history retrieved successfully",
            count: limitedRecords.length,
            totalRecords: records.length,
            data: limitedRecords
        });

    } catch (error) {
        console.error("Get all attendance history error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get attendance by employee ID and specific date
const getAttendanceByEmployeeAndDate = async (req, res) => {
    try {
        const { employeeId, date } = req.params;
        const { limit } = req.query;
        
        if (!employeeId || !date) {
            return res.status(400).json({
                success: false,
                message: "Employee ID and date are required"
            });
        }

        const limitNum = limit ? parseInt(limit) : 50;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 50 : Math.min(limitNum, 100);

        let query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId)
            .where("date", "==", date);

        // Order by timestamp descending (newest first)
        query = query.orderBy("timestamp", "desc");

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found for this employee on this date"
            });
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Apply limit
        const limitedRecords = records.slice(0, validLimit);

        res.status(200).json({
            success: true,
            message: "Attendance records retrieved successfully",
            count: limitedRecords.length,
            totalRecords: records.length,
            data: limitedRecords
        });

    } catch (error) {
        console.error("Get attendance by employee and date error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Check if auto check-in is needed (forgot to check out)
const checkAutoCheckInNeeded = async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const today = new Date().toISOString().split('T')[0];
        
        // Get today's attendance records for this employee
        const query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId)
            .where("date", "==", today)
            .orderBy("timestamp", "desc");

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            // No records today - can check in normally
            return res.json({
                success: true,
                needsAutoCheckIn: false,
                message: "No attendance records today - can check in normally",
                lastRecord: null
            });
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        const lastRecord = records[0];
        
        // Check if last action was check-in without check-out
        if (lastRecord.type === 'checkin' && !lastRecord.checkOutAt) {
            // Check if it's after 11:59 PM
            const now = new Date();
            const currentHour = now.getHours();
            
            if (currentHour >= 23 || currentHour < 6) {
                // Automatically create a checkout record for yesterday
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayString = yesterday.toISOString().split('T')[0];
                
                // Create automatic checkout record
                const autoCheckoutRecord = {
                    id: uuidV4(),
                    uid: uuidV4(),
                    employeeId: employeeId,
                    employeeName: lastRecord.employeeName,
                    location: lastRecord.location,
                    branch: lastRecord.branch,
                    branchName: lastRecord.branchName,
                    type: 'checkout',
                    date: yesterdayString,
                    time: '23:59:00', // Auto checkout at 11:59 PM
                    checkInAt: null,
                    checkOutAt: '23:59:00',
                    timestamp: new Date(yesterdayString + 'T23:59:00.000Z').toISOString(),
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    isAutoCheckout: true // Flag to indicate this was automatic
                };

                // Save automatic checkout
                const autoCheckoutRef = db.collection("employee-attendance").doc(autoCheckoutRecord.id);
                await autoCheckoutRef.set(autoCheckoutRecord);

                return res.json({
                    success: true,
                    needsAutoCheckIn: false,
                    message: "Auto checkout completed for yesterday - you can check in normally now",
                    autoCheckout: autoCheckoutRecord,
                    lastRecord: lastRecord
                });
            } else {
                return res.json({
                    success: true,
                    needsAutoCheckIn: false,
                    message: "Last check-in found but it's not time for auto checkout yet",
                    lastRecord: lastRecord
                });
            }
        } else if (lastRecord.type === 'checkout') {
            return res.json({
                success: true,
                needsAutoCheckIn: false,
                message: "Already checked out today - can check in normally",
                lastRecord: lastRecord
            });
        }

        return res.json({
            success: true,
            needsAutoCheckIn: false,
            message: "Normal check-in status",
            lastRecord: lastRecord
        });

    } catch (error) {
        console.error("Check auto check-in needed error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    checkInOut,
    getCheckInOutHistory,
    getAllAttendanceHistory,
    getAttendanceByEmployeeAndDate,
    checkAutoCheckInNeeded
};
