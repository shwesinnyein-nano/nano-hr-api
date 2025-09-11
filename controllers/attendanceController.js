const { v4: uuidV4 } = require('uuid');
const { admin, db } = require("../config/firebaseConfig");

// Check In/Out API with proper record checking
const checkInOut = async (req, res) => {
    console.log("Check In/Out called", req.body);
    try {
        const { 
            employeeId,
            employeeName,
            location,
            branch,
            branchName,
            type
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

        // Get current date and time
        const currentDate = new Date();
        const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Convert to Thai local time (UTC+7)
        const thaiOffset = 7; // Thailand is UTC+7
        const localDate = new Date(currentDate.getTime() + (thaiOffset * 60 * 1000));
        const localTimeString = localDate.toTimeString().split(' ')[0]; // HH:MM:SS format only

        // Check if today's record already exists for this employee
        const existingRecordQuery = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId)
            .where("date", "==", dateString)
            .limit(1);

        const existingSnapshot = await existingRecordQuery.get();

        if (type === 'checkin') {
            // CHECK IN LOGIC
            if (!existingSnapshot.empty) {
                const existingRecord = existingSnapshot.docs[0].data();
                
                // Check if already checked in today
                if (existingRecord.type === 'checkin' && !existingRecord.checkOutAt) {
                    return res.status(400).json({
                        success: false,
                        message: "You have already checked in today. Please check out first."
                    });
                }
                
                // Check if already checked out today
                if (existingRecord.type === 'checkout') {
                    return res.status(400).json({
                        success: false,
                        message: "You have already completed your attendance for today."
                    });
                }
            }

            // Create new check-in record
            const uid = uuidV4();
            const checkRecord = {
                id: uid,
                uid: uid,
                employeeId: employeeId,
                employeeName: employeeName,
                location: location,
                branch: branch, 
                branchName: branchName,
                type: 'checkin',
                date: dateString,
                time: localTimeString,
                checkInAt: localTimeString,
                checkOutAt: null,
                timestamp: currentDate.toISOString(),
                createdAt: currentDate.toISOString(),
                updatedAt: currentDate.toISOString()
            };

            // Save to Firestore
            const checkRef = db.collection("employee-attendance").doc(uid);
            await checkRef.set(checkRecord);

            res.status(200).json({
                success: true,
                message: "Check In recorded successfully",
                data: {
                    id: uid,
                    employeeId: employeeId,
                    employeeName: employeeName,
                    location: location,
                    branch: branch,
                    branchName: branchName,
                    type: 'checkin',
                    date: dateString,
                    checkInAt: localTimeString,
                    checkOutAt: null,
                    timestamp: currentDate.toISOString()
                }
            });

        } else if (type === 'checkout') {
            // CHECK OUT LOGIC
            if (existingSnapshot.empty) {
                return res.status(400).json({
                    success: false,
                    message: "No check-in record found for today. Please check in first."
                });
            }

            const existingRecord = existingSnapshot.docs[0];
            const existingData = existingRecord.data();

            // Check if already checked out
            if (existingData.type === 'checkout') {
                return res.status(400).json({
                    success: false,
                    message: "You have already checked out today."
                });
            }

            // Check if checked in (can check out)
            if (existingData.type === 'checkin' && !existingData.checkOutAt) {
                // Update existing record with checkout
                await existingRecord.ref.update({
                    type: 'checkout',
                    time: localTimeString,
                    checkOutAt: localTimeString,
                    updatedAt: currentDate.toISOString()
                });

                res.status(200).json({
                    success: true,
                    message: "Check Out recorded successfully",
                    data: {
                        id: existingRecord.id,
                        employeeId: employeeId,
                        employeeName: employeeName,
                        location: location,
                        branch: branch,
                        branchName: branchName,
                        type: 'checkout',
                        date: dateString,
                        checkInAt: existingData.checkInAt,
                        checkOutAt: localTimeString,
                        timestamp: currentDate.toISOString()
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid attendance state. Please check in first."
                });
            }
        }

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
            .where("date", "==", today);

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

// Get current attendance status for today
const getTodayAttendanceStatus = async (req, res) => {
    try {
        const { employeeId } = req.params;
        console.log("getTodayAttendanceStatus", req.params);
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const today = new Date().toISOString().split('T')[0];
        
        // Get today's attendance record for this employee
        const query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId)
            .where("date", "==", today)
            .limit(1);

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            // No record today - show check in
            return res.json({
                success: true,
                status: "no_record",
                action: "checkin",
                message: "No attendance record today - can check in",
                buttonText: "Check In",
                canCheckIn: true,
                canCheckOut: false,
                record: null
            });
        }

        const record = snapshot.docs[0].data();
        
        if (record.type === 'checkin' && !record.checkOutAt) {
            // Checked in but not checked out - show check out
            return res.json({
                success: true,
                status: "checked_in",
                action: "checkout",
                message: "Checked in today - can check out",
                buttonText: "Check Out",
                canCheckIn: false,
                canCheckOut: true,
                record: {
                    id: snapshot.docs[0].id,
                    uid: snapshot.docs[0].id,
                    employeeId: record.employeeId,
                    employeeName: record.employeeName,
                    location: record.location,
                    branch: record.branch,
                    branchName: record.branchName,
                    type: record.type,
                    checkInAt: record.checkInAt,
                    checkOutAt: record.checkOutAt,
                    date: record.date,
                    time: record.time,
                    timestamp: record.timestamp,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                    isAutoCheckout: record.isAutoCheckout,
                   
                }
            });
        } else if (record.type === 'checkout') {
            // Already checked out - show completed
            return res.json({
                success: true,
                status: "checked_out",
                action: "completed",
                message: "Already completed attendance for today",
                buttonText: "Completed",
                canCheckIn: false,
                canCheckOut: false,
                record: {
                    id: snapshot.docs[0].id,
                    uid: snapshot.docs[0].id,
                    employeeId: record.employeeId,
                    employeeName: record.employeeName,
                    location: record.location,
                    branch: record.branch,
                    branchName: record.branchName,
                    type: record.type,
                    checkInAt: record.checkInAt,
                    checkOutAt: record.checkOutAt,
                    date: record.date,
                    time: record.time,
                    timestamp: record.timestamp,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                    isAutoCheckout: record.isAutoCheckout,
                   
                }
            });
        }

        // Fallback
        return res.json({
            success: true,
            status: "unknown",
            action: "checkin",
            message: "Unknown status - can check in",
            buttonText: "Check In",
            canCheckIn: true,
            canCheckOut: false,
            record: {
                id: snapshot.docs[0].id,
                uid: snapshot.docs[0].id,
                employeeId: record.employeeId,
                employeeName: record.employeeName,
                location: record.location,
                branch: record.branch,
                branchName: record.branchName,
                type: record.type,
                timestamp: record.timestamp,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                isAutoCheckout: record.isAutoCheckout,
                ...record
               
               
            }
        });

        console.log("getTodayAttendanceStatus responxe", res.json);
    } catch (error) {
        console.error("Get today attendance status error:", error);
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
    checkAutoCheckInNeeded,
    getTodayAttendanceStatus
};
