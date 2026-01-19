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
                (SELECT COUNT(*) FROM memos WHERE user_id = $1) as total_memos
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

                // Generate analysis text
                const analysisTexts = {
                    increasing: `通院頻度が増加傾向にあります。平均${avgInterval}日間隔で通院しており、より頻繁な診察が必要な状態かもしれません。`,
                    stable: `通院頻度は安定しています。平均${avgInterval}日間隔で定期的に通院されています。`,
                    decreasing: `通院頻度が減少傾向にあります。症状が改善している可能性がありますが、定期検診は継続しましょう。`
                };

                trends.push({
                    department: dept,
                    count: deptAppointments.length,
                    avgInterval: avgInterval,
                    trend: trend,
                    analysis: analysisTexts[trend]
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
                totalMemos: parseInt(stats.total_memos)
            },
            trends: trends,
            chartData: chartData
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

        res.status(200).json({
            department: department,
            clinics: clinics,
            appointments: appointments,
            memos: memos,
            statistics: {
                totalClinics: clinics.length,
                totalAppointments: appointments.length,
                totalMemos: memos.length
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

module.exports = router;
