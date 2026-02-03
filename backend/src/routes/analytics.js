const express = require('express');
const router = express.Router();
const { supabase } = require('../db/database');
const { verifyToken } = require('./auth');

router.use(verifyToken);

router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;

        const { count: clinicsCount } = await supabase
            .from('clinics')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const { count: appointmentsCount } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const { count: memosCount } = await supabase
            .from('memos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const stats = {
            total_clinics: clinicsCount || 0,
            total_appointments: appointmentsCount || 0,
            total_memos: memosCount || 0
        };

        const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select(`
                id,
                clinic_id,
                appointment_date,
                appointment_time,
                clinics (
                    hospital_name,
                    department,
                    diagnosis,
                    medication
                )
            `)
            .eq('user_id', userId)
            .order('appointment_date', { ascending: true });

        if (appointmentsError) {
            throw appointmentsError;
        }

        const formattedAppointments = appointments.map(apt => ({
            id: apt.id,
            clinic_id: apt.clinic_id,
            appointment_date: apt.appointment_date,
            appointment_time: apt.appointment_time,
            hospital_name: apt.clinics.hospital_name,
            department: apt.clinics.department,
            diagnosis: apt.clinics.diagnosis,
            medication: apt.clinics.medication
        }));

        const { data: clinics, error: clinicsError } = await supabase
            .from('clinics')
            .select('id, hospital_name, department, diagnosis, medication')
            .eq('user_id', userId);

        if (clinicsError) {
            throw clinicsError;
        }

        const departmentFrequency = {};
        formattedAppointments.forEach(apt => {
            const dept = apt.department;
            departmentFrequency[dept] = (departmentFrequency[dept] || 0) + 1;
        });

        const monthlyFrequency = {};
        formattedAppointments.forEach(apt => {
            const date = new Date(apt.appointment_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyFrequency[monthKey] = (monthlyFrequency[monthKey] || 0) + 1;
        });

        const trends = [];
        const departments = [...new Set(clinics.map(c => c.department))];

        for (const dept of departments) {
            const deptClinics = clinics.filter(c => c.department === dept);
            const deptClinicIds = deptClinics.map(c => c.id);
            const deptAppointments = formattedAppointments.filter(a => deptClinicIds.includes(a.clinic_id));

            if (deptAppointments.length > 0) {
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

router.get('/department/:department', async (req, res) => {
    try {
        const userId = req.user.userId;
        const department = req.params.department;

        const { data: clinics, error: clinicsError } = await supabase
            .from('clinics')
            .select('id, hospital_name, diagnosis, medication')
            .eq('user_id', userId)
            .eq('department', department);

        if (clinicsError) {
            throw clinicsError;
        }

        const clinicIds = clinics.map(c => c.id);

        if (clinicIds.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'No data found for this department'
            });
        }

        const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('id, clinic_id, appointment_date, appointment_time')
            .eq('user_id', userId)
            .in('clinic_id', clinicIds)
            .order('appointment_date', { ascending: true });

        if (appointmentsError) {
            throw appointmentsError;
        }

        const { data: memos, error: memosError } = await supabase
            .from('memos')
            .select('id, clinic_id, memo_date, patient_memo, doctor_memo')
            .eq('user_id', userId)
            .in('clinic_id', clinicIds)
            .order('memo_date', { ascending: false });

        if (memosError) {
            throw memosError;
        }

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

router.get('/timeline', async (req, res) => {
    try {
        const userId = req.user.userId;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        let query = supabase
            .from('appointments')
            .select(`
                appointment_date,
                appointment_time,
                clinics (
                    hospital_name,
                    department,
                    diagnosis
                )
            `)
            .eq('user_id', userId);

        if (startDate) {
            query = query.gte('appointment_date', startDate);
        }

        if (endDate) {
            query = query.lte('appointment_date', endDate);
        }

        query = query.order('appointment_date', { ascending: true });

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        const formattedData = data.map(apt => ({
            appointment_date: apt.appointment_date,
            appointment_time: apt.appointment_time,
            hospital_name: apt.clinics.hospital_name,
            department: apt.clinics.department,
            diagnosis: apt.clinics.diagnosis
        }));

        res.status(200).json(formattedData);

    } catch (err) {
        console.error('Get timeline analytics error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

module.exports = router;
