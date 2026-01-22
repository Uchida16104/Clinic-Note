// Clinic Note - Analytics Routes
const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { verifyToken } = require('./auth');

// Apply JWT verification to all routes
router.use(verifyToken);

// Get comprehensive analytics
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get basic statistics
        const statsResult = await query(
            `SELECT 
                (SELECT COUNT(*) FROM clinics WHERE user_id = $1) as total_clinics,
                (SELECT COUNT(*) FROM appointments WHERE user_id = $1) as total_appointments,
                (SELECT COUNT(*) FROM memos WHERE user_id = $1) as total_memos,
                (SELECT COUNT(*) FROM doctor_memos WHERE user_id = $1) as total_doctor_memos
            `,
            [userId]
        );

        const stats = statsResult.rows[0];

        // Get appointments with clinic details
        const appointmentsResult = await query(
            `SELECT a.id, a.clinic_id, a.appointment_date, a.appointment_time,
                    c.hospital_name, c.department, c.diagnosis, c.medication
             FROM appointments a
             JOIN clinics c ON a.clinic_id = c.id
             WHERE a.user_id = $1
             ORDER BY a.appointment_date`,
            [userId]
        );

        const appointments = appointmentsResult.rows;

        // Get clinics
        const clinicsResult = await query(
            `SELECT id, hospital_name, department, diagnosis, medication
             FROM clinics
             WHERE user_id = $1`,
            [userId]
        );

        const clinics = clinicsResult.rows;

        // Get doctor memos for analysis
        const doctorMemosResult = await query(
            `SELECT dm.id, dm.clinic_id, dm.memo_date, dm.doctor_notes, dm.diagnosis_notes, dm.prescription_notes,
                    c.hospital_name, c.department
             FROM doctor_memos dm
             JOIN clinics c ON dm.clinic_id = c.id
             WHERE dm.user_id = $1
             ORDER BY dm.memo_date DESC`,
            [userId]
        );

        const doctorMemos = doctorMemosResult.rows;

        // Calculate frequency by department
        const departmentFrequency = {};
        appointments.forEach(apt => {
            const dept = apt.department;
            departmentFrequency[dept] = (departmentFrequency[dept] || 0) + 1;
        });

        // Calculate monthly frequency
        const monthlyFrequency = {};
        appointments.forEach(apt => {
            const date = new Date(apt.appointment_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyFrequency[monthKey] = (monthlyFrequency[monthKey] || 0) + 1;
        });

        // Generate trends by department
        const trends = [];
        const departments = [...new Set(clinics.map(c => c.department))];

        for (const dept of departments) {
            const deptClinics = clinics.filter(c => c.department === dept);
            const deptClinicIds = deptClinics.map(c => c.id);
            const deptAppointments = appointments.filter(a => deptClinicIds.includes(a.clinic_id));
            const deptDoctorMemos = doctorMemos.filter(dm => deptClinicIds.includes(dm.clinic_id));

            if (deptAppointments.length > 0) {
                // Calculate average interval
                const sortedAppointments = [...deptAppointments].sort((a, b) => 
                    new Date(a.appointment_date) - new Date(b.appointment_date)
                );

                let avgInterval = 0;
                if (sortedAppointments.length >= 2) {
                    let totalDays = 0;
                    for (let i = 1; i < sortedAppointments.length; i++) {
                        const date1 = new Date(sortedAppointments[i - 1].appointment_date);
                        const date2 = new Date(sortedAppointments[i].appointment_date);
                        const days = Math.abs((date2 - date1) / (1000 * 60 * 60 * 24));
                        totalDays += days;
                    }
                    avgInterval = Math.round(totalDays / (sortedAppointments.length - 1));
                }

                // Determine trend
                let trend = 'stable';
                if (sortedAppointments.length >= 3) {
                    const midpoint = Math.floor(sortedAppointments.length / 2);
                    const firstHalf = sortedAppointments.slice(0, midpoint);
                    const secondHalf = sortedAppointments.slice(midpoint);

                    const firstHalfStart = new Date(firstHalf[0].appointment_date);
                    const firstHalfEnd = new Date(firstHalf[firstHalf.length - 1].appointment_date);
                    const secondHalfStart = new Date(secondHalf[0].appointment_date);
                    const secondHalfEnd = new Date(secondHalf[secondHalf.length - 1].appointment_date);

                    const firstHalfDuration = (firstHalfEnd - firstHalfStart) / (1000 * 60 * 60 * 24);
                    const secondHalfDuration = (secondHalfEnd - secondHalfStart) / (1000 * 60 * 60 * 24);

                    if (secondHalfDuration > 0 && firstHalfDuration > 0) {
                        const firstHalfFreq = firstHalf.length / firstHalfDuration;
                        const secondHalfFreq = secondHalf.length / secondHalfDuration;
                        const change = ((secondHalfFreq - firstHalfFreq) / firstHalfFreq) * 100;

                        if (change > 20) trend = 'increasing';
                        else if (change < -20) trend = 'decreasing';
                    }
                }

                // Analyze doctor memos for this department
                let doctorMemoAnalysis = '';
                if (deptDoctorMemos.length > 0) {
                    const recentMemos = deptDoctorMemos.slice(0, 3);
                    const diagnosisKeywords = {};
                    
                    recentMemos.forEach(memo => {
                        if (memo.diagnosis_notes) {
                            const words = memo.diagnosis_notes.split(/\s+/);
                            words.forEach(word => {
                                if (word.length > 2) {
                                    diagnosisKeywords[word] = (diagnosisKeywords[word] || 0) + 1;
                                }
                            });
                        }
                    });

                    const topKeywords = Object.entries(diagnosisKeywords)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([word]) => word);

                    if (topKeywords.length > 0) {
                        doctorMemoAnalysis = `医師診断の主なキーワード: ${topKeywords.join('、')}`;
                    }
                }

                // Generate analysis text
                const analysisTexts = {
                    increasing: `通院頻度が増加傾向にあります。平均${avgInterval}日間隔で通院しており、より頻繁な診察が必要な状態かもしれません。${doctorMemoAnalysis}`,
                    stable: `通院頻度は安定しています。平均${avgInterval}日間隔で定期的に通院されています。${doctorMemoAnalysis}`,
                    decreasing: `通院頻度が減少傾向にあります。症状が改善している可能性がありますが、定期検診は継続しましょう。${doctorMemoAnalysis}`
                };

                trends.push({
                    department: dept,
                    count: deptAppointments.length,
                    avgInterval: avgInterval,
                    trend: trend,
                    analysis: analysisTexts[trend],
                    doctorMemosCount: deptDoctorMemos.length
                });
            }
        }

        // Prepare chart data
        const chartData = {
            departments: Object.keys(departmentFrequency),
            departmentCounts: Object.values(departmentFrequency),
            months: Object.keys(monthlyFrequency).sort(),
            monthlyCounts: Object.keys(monthlyFrequency).sort().map(m => monthlyFrequency[m])
        };

        res.status(200).json({
            stats: {
                totalClinics: parseInt(stats.total_clinics),
                totalAppointments: parseInt(stats.total_appointments),
                totalMemos: parseInt(stats.total_memos),
                totalDoctorMemos: parseInt(stats.total_doctor_memos)
            },
            trends: trends,
            chartData: chartData,
            doctorMemos: doctorMemos
        });

    } catch (err) {
        console.error('Get analytics error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get department-specific analytics
router.get('/department/:department', async (req, res) => {
    try {
        const userId = req.user.userId;
        const department = req.params.department;

        // Get clinics for department
        const clinicsResult = await query(
            `SELECT id, hospital_name, diagnosis, medication
             FROM clinics
             WHERE user_id = $1 AND department = $2`,
            [userId, department]
        );

        const clinics = clinicsResult.rows;
        const clinicIds = clinics.map(c => c.id);

        if (clinicIds.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'No data found for this department'
            });
        }

        // Get appointments
        const appointmentsResult = await query(
            `SELECT id, clinic_id, appointment_date, appointment_time
             FROM appointments
             WHERE user_id = $1 AND clinic_id = ANY($2)
             ORDER BY appointment_date`,
            [userId, clinicIds]
        );

        const appointments = appointmentsResult.rows;

        // Get memos
        const memosResult = await query(
            `SELECT id, clinic_id, memo_date, content
             FROM memos
             WHERE user_id = $1 AND clinic_id = ANY($2)
             ORDER BY memo_date DESC`,
            [userId, clinicIds]
        );

        const memos = memosResult.rows;

        // Get doctor memos
        const doctorMemosResult = await query(
            `SELECT id, clinic_id, memo_date, doctor_notes, diagnosis_notes, prescription_notes
             FROM doctor_memos
             WHERE user_id = $1 AND clinic_id = ANY($2)
             ORDER BY memo_date DESC`,
            [userId, clinicIds]
        );

        const doctorMemos = doctorMemosResult.rows;

        res.status(200).json({
            department: department,
            clinics: clinics,
            appointments: appointments,
            memos: memos,
            doctorMemos: doctorMemos,
            statistics: {
                totalClinics: clinics.length,
                totalAppointments: appointments.length,
                totalMemos: memos.length,
                totalDoctorMemos: doctorMemos.length
            }
        });

    } catch (err) {
        console.error('Get department analytics error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get timeline analytics
router.get('/timeline', async (req, res) => {
    try {
        const userId = req.user.userId;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        let whereClause = 'WHERE a.user_id = $1';
        const params = [userId];

        if (startDate) {
            params.push(startDate);
            whereClause += ` AND a.appointment_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            whereClause += ` AND a.appointment_date <= $${params.length}`;
        }

        const result = await query(
            `SELECT a.appointment_date, a.appointment_time,
                    c.hospital_name, c.department, c.diagnosis
             FROM appointments a
             JOIN clinics c ON a.clinic_id = c.id
             ${whereClause}
             ORDER BY a.appointment_date, a.appointment_time`,
            params
        );

        res.status(200).json(result.rows);

    } catch (err) {
        console.error('Get timeline analytics error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Export data as JSON
router.get('/export/json', async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get all user data
        const clinicsResult = await query('SELECT * FROM clinics WHERE user_id = $1', [userId]);
        const appointmentsResult = await query('SELECT * FROM appointments WHERE user_id = $1', [userId]);
        const memosResult = await query('SELECT * FROM memos WHERE user_id = $1', [userId]);
        const doctorMemosResult = await query('SELECT * FROM doctor_memos WHERE user_id = $1', [userId]);

        const exportData = {
            exportDate: new Date().toISOString(),
            userId: userId,
            clinics: clinicsResult.rows,
            appointments: appointmentsResult.rows,
            memos: memosResult.rows,
            doctorMemos: doctorMemosResult.rows
        };

        res.status(200).json(exportData);

    } catch (err) {
        console.error('Export JSON error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Export data as CSV
router.get('/export/csv', async (req, res) => {
    try {
        const userId = req.user.userId;
        const type = req.query.type || 'appointments';

        let csvData = '';
        
        if (type === 'appointments') {
            const result = await query(
                `SELECT a.appointment_date, a.appointment_time, c.hospital_name, c.department, c.diagnosis
                 FROM appointments a
                 JOIN clinics c ON a.clinic_id = c.id
                 WHERE a.user_id = $1
                 ORDER BY a.appointment_date`,
                [userId]
            );

            csvData = 'Date,Time,Hospital,Department,Diagnosis\n';
            result.rows.forEach(row => {
                csvData += `"${row.appointment_date}","${row.appointment_time || ''}","${row.hospital_name}","${row.department}","${row.diagnosis || ''}"\n`;
            });
        } else if (type === 'memos') {
            const result = await query(
                `SELECT m.memo_date, c.hospital_name, c.department, m.content
                 FROM memos m
                 JOIN clinics c ON m.clinic_id = c.id
                 WHERE m.user_id = $1
                 ORDER BY m.memo_date`,
                [userId]
            );

            csvData = 'Date,Hospital,Department,Content\n';
            result.rows.forEach(row => {
                csvData += `"${row.memo_date}","${row.hospital_name}","${row.department}","${(row.content || '').replace(/"/g, '""')}"\n`;
            });
        } else if (type === 'doctor_memos') {
            const result = await query(
                `SELECT dm.memo_date, c.hospital_name, c.department, dm.doctor_notes, dm.diagnosis_notes, dm.prescription_notes
                 FROM doctor_memos dm
                 JOIN clinics c ON dm.clinic_id = c.id
                 WHERE dm.user_id = $1
                 ORDER BY dm.memo_date`,
                [userId]
            );

            csvData = 'Date,Hospital,Department,Doctor Notes,Diagnosis,Prescription\n';
            result.rows.forEach(row => {
                csvData += `"${row.memo_date}","${row.hospital_name}","${row.department}","${(row.doctor_notes || '').replace(/"/g, '""')}","${(row.diagnosis_notes || '').replace(/"/g, '""')}","${(row.prescription_notes || '').replace(/"/g, '""')}"\n`;
            });
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_export.csv"`);
        res.status(200).send(csvData);

    } catch (err) {
        console.error('Export CSV error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

module.exports = router;
