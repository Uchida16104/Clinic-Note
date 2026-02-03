const express = require('express');
const router = express.Router();
const { supabase } = require('../db/database');
const { verifyToken } = require('./auth');

router.use(verifyToken);

router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from('clinics')
            .select('id, hospital_name, department, diagnosis, medication, created_at, updated_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        res.status(200).json(data);

    } catch (err) {
        console.error('Get clinics error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.params.id;

        const { data, error } = await supabase
            .from('clinics')
            .select('id, hospital_name, department, diagnosis, medication, created_at, updated_at')
            .eq('id', clinicId)
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Clinic not found'
            });
        }

        res.status(200).json(data);

    } catch (err) {
        console.error('Get clinic error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { hospital_name, department, diagnosis, medication } = req.body;

        if (!hospital_name || !department) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Hospital name and department are required'
            });
        }

        const { data, error } = await supabase
            .from('clinics')
            .insert({
                user_id: userId,
                hospital_name: hospital_name,
                department: department,
                diagnosis: diagnosis || null,
                medication: medication || null
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.status(201).json({
            message: 'Clinic created successfully',
            clinic: data
        });

    } catch (err) {
        console.error('Create clinic error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.params.id;
        const { hospital_name, department, diagnosis, medication } = req.body;

        const { data: existingClinic, error: checkError } = await supabase
            .from('clinics')
            .select('id')
            .eq('id', clinicId)
            .eq('user_id', userId)
            .single();

        if (checkError || !existingClinic) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Clinic not found'
            });
        }

        if (!hospital_name || !department) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Hospital name and department are required'
            });
        }

        const { data, error } = await supabase
            .from('clinics')
            .update({
                hospital_name: hospital_name,
                department: department,
                diagnosis: diagnosis || null,
                medication: medication || null
            })
            .eq('id', clinicId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json({
            message: 'Clinic updated successfully',
            clinic: data
        });

    } catch (err) {
        console.error('Update clinic error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.params.id;

        const { data: existingClinic, error: checkError } = await supabase
            .from('clinics')
            .select('id')
            .eq('id', clinicId)
            .eq('user_id', userId)
            .single();

        if (checkError || !existingClinic) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Clinic not found'
            });
        }

        const { error } = await supabase
            .from('clinics')
            .delete()
            .eq('id', clinicId)
            .eq('user_id', userId);

        if (error) {
            throw error;
        }

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

router.get('/hospital/:hospitalName', async (req, res) => {
    try {
        const userId = req.user.userId;
        const hospitalName = req.params.hospitalName;

        const { data, error } = await supabase
            .from('clinics')
            .select('id, hospital_name, department, diagnosis, medication, created_at, updated_at')
            .eq('user_id', userId)
            .eq('hospital_name', hospitalName)
            .order('department', { ascending: true });

        if (error) {
            throw error;
        }

        res.status(200).json(data);

    } catch (err) {
        console.error('Get clinics by hospital error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.get('/list/hospitals', async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from('clinics')
            .select('hospital_name')
            .eq('user_id', userId)
            .order('hospital_name', { ascending: true });

        if (error) {
            throw error;
        }

        const uniqueHospitals = [...new Set(data.map(row => row.hospital_name))];

        res.status(200).json(uniqueHospitals);

    } catch (err) {
        console.error('Get hospitals error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.get('/list/departments', async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from('clinics')
            .select('department')
            .eq('user_id', userId)
            .order('department', { ascending: true });

        if (error) {
            throw error;
        }

        const uniqueDepartments = [...new Set(data.map(row => row.department))];

        res.status(200).json(uniqueDepartments);

    } catch (err) {
        console.error('Get departments error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

module.exports = router;
