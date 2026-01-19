// Clinic Note - Appointments Routes
const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { verifyToken } = require('./auth');

// Apply JWT verification to all routes
router.use(verifyToken);

// Get all appointments for user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.query.clinic_id;

        let queryText = `
            SELECT a.id, a.clinic_id, a.appointment_date, a.appointment_time, a.status, 
                   a.created_at, a.updated_at,
                   c.hospital_name, c.department
            FROM appointments a
            JOIN clinics c ON a.clinic_id = c.id
            WHERE a.user_id = $1
        `;
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
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get single appointment
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const appointmentId = req.params.id;

        const result = await query(
            `SELECT a.id, a.clinic_id, a.appointment_date, a.appointment_time, a.status, 
                    a.created_at, a.updated_at,
                    c.hospital_name, c.department
             FROM appointments a
             JOIN clinics c ON a.clinic_id = c.id
             WHERE a.id = $1 AND a.user_id = $2`,
            [appointmentId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Appointment not found'
            });
        }

        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error('Get appointment error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Create new appointment
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { clinic_id, appointment_date, appointment_time, status } = req.body;

        // Validation
        if (!clinic_id || !appointment_date) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Clinic ID and appointment date are required'
            });
        }

        // Verify clinic belongs to user
        const clinicResult = await query(
            'SELECT id FROM clinics WHERE id = $1 AND user_id = $2',
            [clinic_id, userId]
        );

        if (clinicResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Clinic not found'
            });
        }

        const result = await query(
            `INSERT INTO appointments (user_id, clinic_id, appointment_date, appointment_time, status) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, clinic_id, appointment_date, appointment_time, status, created_at, updated_at`,
            [userId, clinic_id, appointment_date, appointment_time || null, status || 'scheduled']
        );

        res.status(201).json({
            message: 'Appointment created successfully',
            appointment: result.rows[0]
        });

    } catch (err) {
        console.error('Create appointment error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Update appointment
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const appointmentId = req.params.id;
        const { appointment_date, appointment_time, status } = req.body;

        // Check if appointment exists and belongs to user
        const checkResult = await query(
            'SELECT id FROM appointments WHERE id = $1 AND user_id = $2',
            [appointmentId, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Appointment not found'
            });
        }

        // Validation
        if (!appointment_date) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Appointment date is required'
            });
        }

        const result = await query(
            `UPDATE appointments 
             SET appointment_date = $1, appointment_time = $2, status = $3 
             WHERE id = $4 AND user_id = $5 
             RETURNING id, clinic_id, appointment_date, appointment_time, status, created_at, updated_at`,
            [appointment_date, appointment_time || null, status || 'scheduled', appointmentId, userId]
        );

        res.status(200).json({
            message: 'Appointment updated successfully',
            appointment: result.rows[0]
        });

    } catch (err) {
        console.error('Update appointment error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Delete appointment
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const appointmentId = req.params.id;

        // Check if appointment exists and belongs to user
        const checkResult = await query(
            'SELECT id FROM appointments WHERE id = $1 AND user_id = $2',
            [appointmentId, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Appointment not found'
            });
        }

        await query(
            'DELETE FROM appointments WHERE id = $1 AND user_id = $2',
            [appointmentId, userId]
        );

        res.status(200).json({
            message: 'Appointment deleted successfully'
        });

    } catch (err) {
        console.error('Delete appointment error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get upcoming appointments
router.get('/upcoming/list', async (req, res) => {
    try {
        const userId = req.user.userId;
        const days = parseInt(req.query.days) || 30;

        const result = await query(
            `SELECT a.id, a.clinic_id, a.appointment_date, a.appointment_time, a.status,
                    c.hospital_name, c.department
             FROM appointments a
             JOIN clinics c ON a.clinic_id = c.id
             WHERE a.user_id = $1 
             AND a.appointment_date >= CURRENT_DATE 
             AND a.appointment_date <= CURRENT_DATE + INTERVAL '${days} days'
             ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
            [userId]
        );

        res.status(200).json(result.rows);

    } catch (err) {
        console.error('Get upcoming appointments error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get past appointments
router.get('/past/list', async (req, res) => {
    try {
        const userId = req.user.userId;
        const days = parseInt(req.query.days) || 90;

        const result = await query(
            `SELECT a.id, a.clinic_id, a.appointment_date, a.appointment_time, a.status,
                    c.hospital_name, c.department
             FROM appointments a
             JOIN clinics c ON a.clinic_id = c.id
             WHERE a.user_id = $1 
             AND a.appointment_date < CURRENT_DATE 
             AND a.appointment_date >= CURRENT_DATE - INTERVAL '${days} days'
             ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
            [userId]
        );

        res.status(200).json(result.rows);

    } catch (err) {
        console.error('Get past appointments error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get memos
router.get('/memos', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.query.clinic_id;

        let queryText = `
            SELECT m.id, m.clinic_id, m.memo_date, m.content, m.created_at, m.updated_at,
                   c.hospital_name, c.department
            FROM memos m
            JOIN clinics c ON m.clinic_id = c.id
            WHERE m.user_id = $1
        `;
        const params = [userId];

        if (clinicId) {
            queryText += ' AND m.clinic_id = $2';
            params.push(clinicId);
        }

        queryText += ' ORDER BY m.memo_date DESC';

        const result = await query(queryText, params);

        res.status(200).json(result.rows);

    } catch (err) {
        console.error('Get memos error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Create or update memo
router.post('/memos', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { clinic_id, memo_date, content } = req.body;

        // Validation
        if (!clinic_id || !memo_date) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Clinic ID and memo date are required'
            });
        }

        // Verify clinic belongs to user
        const clinicResult = await query(
            'SELECT id FROM clinics WHERE id = $1 AND user_id = $2',
            [clinic_id, userId]
        );

        if (clinicResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Clinic not found'
            });
        }

        // Upsert memo
        const result = await query(
            `INSERT INTO memos (user_id, clinic_id, memo_date, content) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (user_id, clinic_id, memo_date) 
             DO UPDATE SET content = $4, updated_at = CURRENT_TIMESTAMP
             RETURNING id, clinic_id, memo_date, content, created_at, updated_at`,
            [userId, clinic_id, memo_date, content || '']
        );

        res.status(200).json({
            message: 'Memo saved successfully',
            memo: result.rows[0]
        });

    } catch (err) {
        console.error('Save memo error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Delete memo
router.delete('/memos/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const memoId = req.params.id;

        const checkResult = await query(
            'SELECT id FROM memos WHERE id = $1 AND user_id = $2',
            [memoId, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Memo not found'
            });
        }

        await query(
            'DELETE FROM memos WHERE id = $1 AND user_id = $2',
            [memoId, userId]
        );

        res.status(200).json({
            message: 'Memo deleted successfully'
        });

    } catch (err) {
        console.error('Delete memo error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

module.exports = router;
