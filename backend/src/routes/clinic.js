// Clinic Note - Clinic Routes
const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { verifyToken } = require('./auth');

// Apply JWT verification to all routes
router.use(verifyToken);

// Get all clinics for user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await query(
            `SELECT id, hospital_name, department, diagnosis, medication, created_at, updated_at 
             FROM clinics 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [userId]
        );

        res.status(200).json(result.rows);

    } catch (err) {
        console.error('Get clinics error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get single clinic
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.params.id;

        const result = await query(
            `SELECT id, hospital_name, department, diagnosis, medication, created_at, updated_at 
             FROM clinics 
             WHERE id = $1 AND user_id = $2`,
            [clinicId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Clinic not found'
            });
        }

        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error('Get clinic error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Create new clinic
router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { hospital_name, department, diagnosis, medication } = req.body;

        // Validation
        if (!hospital_name || !department) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Hospital name and department are required'
            });
        }

        const result = await query(
            `INSERT INTO clinics (user_id, hospital_name, department, diagnosis, medication) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, hospital_name, department, diagnosis, medication, created_at, updated_at`,
            [userId, hospital_name, department, diagnosis || null, medication || null]
        );

        res.status(201).json({
            message: 'Clinic created successfully',
            clinic: result.rows[0]
        });

    } catch (err) {
        console.error('Create clinic error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Update clinic
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.params.id;
        const { hospital_name, department, diagnosis, medication } = req.body;

        // Check if clinic exists and belongs to user
        const checkResult = await query(
            'SELECT id FROM clinics WHERE id = $1 AND user_id = $2',
            [clinicId, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Clinic not found'
            });
        }

        // Validation
        if (!hospital_name || !department) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Hospital name and department are required'
            });
        }

        const result = await query(
            `UPDATE clinics 
             SET hospital_name = $1, department = $2, diagnosis = $3, medication = $4 
             WHERE id = $5 AND user_id = $6 
             RETURNING id, hospital_name, department, diagnosis, medication, created_at, updated_at`,
            [hospital_name, department, diagnosis || null, medication || null, clinicId, userId]
        );

        res.status(200).json({
            message: 'Clinic updated successfully',
            clinic: result.rows[0]
        });

    } catch (err) {
        console.error('Update clinic error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Delete clinic
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.params.id;

        // Check if clinic exists and belongs to user
        const checkResult = await query(
            'SELECT id FROM clinics WHERE id = $1 AND user_id = $2',
            [clinicId, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Clinic not found'
            });
        }

        // Delete clinic (cascades to appointments and memos)
        await query(
            'DELETE FROM clinics WHERE id = $1 AND user_id = $2',
            [clinicId, userId]
        );

        res.status(200).json({
            message: 'Clinic deleted successfully'
        });

    } catch (err) {
        console.error('Delete clinic error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get clinics by hospital
router.get('/hospital/:hospitalName', async (req, res) => {
    try {
        const userId = req.user.userId;
        const hospitalName = req.params.hospitalName;

        const result = await query(
            `SELECT id, hospital_name, department, diagnosis, medication, created_at, updated_at 
             FROM clinics 
             WHERE user_id = $1 AND hospital_name = $2 
             ORDER BY department`,
            [userId, hospitalName]
        );

        res.status(200).json(result.rows);

    } catch (err) {
        console.error('Get clinics by hospital error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get unique hospitals
router.get('/list/hospitals', async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await query(
            `SELECT DISTINCT hospital_name 
             FROM clinics 
             WHERE user_id = $1 
             ORDER BY hospital_name`,
            [userId]
        );

        res.status(200).json(result.rows.map(row => row.hospital_name));

    } catch (err) {
        console.error('Get hospitals error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

// Get unique departments
router.get('/list/departments', async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await query(
            `SELECT DISTINCT department 
             FROM clinics 
             WHERE user_id = $1 
             ORDER BY department`,
            [userId]
        );

        res.status(200).json(result.rows.map(row => row.department));

    } catch (err) {
        console.error('Get departments error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

module.exports = router;
