const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { verifyToken } = require('./auth');

router.use(verifyToken);

router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.query.clinic_id;
        let queryText = `SELECT a.id, a.clinic_id, a.appointment_date, a.appointment_time, a.status, a.created_at, a.updated_at, c.hospital_name, c.department FROM appointments a JOIN clinics c ON a.clinic_id = c.id WHERE a.user_id = $1`;
        const params = [userId];
        if (clinicId) {
            queryText += ' AND a.clinic_id = $2';
            params.push(clinicId);
        }
        queryText += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
        const result = await query(queryText, params);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Get appointments error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { clinic_id, appointment_date, appointment_time, status } = req.body;
        if (!clinic_id || !appointment_date) {
            return res.status(400).json({ error: 'Validation error', message: 'Clinic ID and appointment date are required' });
        }
        const clinicResult = await query('SELECT id FROM clinics WHERE id = $1 AND user_id = $2', [clinic_id, userId]);
        if (clinicResult.rows.length === 0) {
            return res.status(404).json({ error: 'Not found', message: 'Clinic not found' });
        }
        const result = await query(`INSERT INTO appointments (user_id, clinic_id, appointment_date, appointment_time, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, clinic_id, appointment_date, appointment_time, status, created_at, updated_at`, [userId, clinic_id, appointment_date, appointment_time || null, status || 'scheduled']);
        res.status(201).json({ message: 'Appointment created successfully', appointment: result.rows[0] });
    } catch (err) {
        console.error('Create appointment error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

router.get('/memos', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.query.clinic_id;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        let queryText = `SELECT m.id, m.clinic_id, m.memo_date, m.patient_memo, m.doctor_memo, m.created_at, m.updated_at, c.hospital_name, c.department FROM memos m JOIN clinics c ON m.clinic_id = c.id WHERE m.user_id = $1`;
        const params = [userId];
        if (clinicId) {
            params.push(clinicId);
            queryText += ` AND m.clinic_id = $${params.length}`;
        }
        if (startDate) {
            params.push(startDate);
            queryText += ` AND m.memo_date >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            queryText += ` AND m.memo_date <= $${params.length}`;
        }
        queryText += ' ORDER BY m.memo_date DESC';
        const result = await query(queryText, params);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Get memos error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

router.post('/memos', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { clinic_id, memo_date, patient_memo, doctor_memo } = req.body;
        if (!clinic_id || !memo_date) {
            return res.status(400).json({ error: 'Validation error', message: 'Clinic ID and memo date are required' });
        }
        const clinicResult = await query('SELECT id FROM clinics WHERE id = $1 AND user_id = $2', [clinic_id, userId]);
        if (clinicResult.rows.length === 0) {
            return res.status(404).json({ error: 'Not found', message: 'Clinic not found' });
        }
        const result = await query(`INSERT INTO memos (user_id, clinic_id, memo_date, patient_memo, doctor_memo) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, clinic_id, memo_date) DO UPDATE SET patient_memo = COALESCE($4, memos.patient_memo), doctor_memo = COALESCE($5, memos.doctor_memo), updated_at = CURRENT_TIMESTAMP RETURNING id, clinic_id, memo_date, patient_memo, doctor_memo, created_at, updated_at`, [userId, clinic_id, memo_date, patient_memo || null, doctor_memo || null]);
        res.status(200).json({ message: 'Memo saved successfully', memo: result.rows[0] });
    } catch (err) {
        console.error('Save memo error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

router.delete('/memos/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const memoId = req.params.id;
        const checkResult = await query('SELECT id FROM memos WHERE id = $1 AND user_id = $2', [memoId, userId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Not found', message: 'Memo not found' });
        }
        await query('DELETE FROM memos WHERE id = $1 AND user_id = $2', [memoId, userId]);
        res.status(200).json({ message: 'Memo deleted successfully' });
    } catch (err) {
        console.error('Delete memo error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

module.exports = router;
