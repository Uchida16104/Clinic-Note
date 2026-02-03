const express = require('express');
const router = express.Router();
const { supabase } = require('../db/database');
const { verifyToken } = require('./auth');

router.use(verifyToken);

router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.query.clinic_id;
        
        let query = supabase
            .from('appointments')
            .select(`
                id,
                clinic_id,
                appointment_date,
                appointment_time,
                status,
                reminder_sent,
                created_at,
                updated_at,
                clinics (
                    hospital_name,
                    department
                )
            `)
            .eq('user_id', userId);
        
        if (clinicId) {
            query = query.eq('clinic_id', clinicId);
        }
        
        query = query.order('appointment_date', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        const formattedData = data.map(apt => ({
            id: apt.id,
            clinic_id: apt.clinic_id,
            appointment_date: apt.appointment_date,
            appointment_time: apt.appointment_time,
            status: apt.status,
            reminder_sent: apt.reminder_sent,
            created_at: apt.created_at,
            updated_at: apt.updated_at,
            hospital_name: apt.clinics.hospital_name,
            department: apt.clinics.department
        }));
        
        res.status(200).json(formattedData);
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
            return res.status(400).json({ 
                error: 'Validation error', 
                message: 'Clinic ID and appointment date are required' 
            });
        }
        
        const { data: clinic, error: clinicError } = await supabase
            .from('clinics')
            .select('id')
            .eq('id', clinic_id)
            .eq('user_id', userId)
            .single();
        
        if (clinicError || !clinic) {
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'Clinic not found' 
            });
        }
        
        const { data, error } = await supabase
            .from('appointments')
            .insert({
                user_id: userId,
                clinic_id: clinic_id,
                appointment_date: appointment_date,
                appointment_time: appointment_time || null,
                status: status || 'scheduled',
                reminder_sent: false
            })
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        res.status(201).json({ 
            message: 'Appointment created successfully', 
            appointment: data 
        });
    } catch (err) {
        console.error('Create appointment error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const appointmentId = req.params.id;
        const { appointment_date, appointment_time, status } = req.body;
        
        const { data: existingAppointment, error: checkError } = await supabase
            .from('appointments')
            .select('id')
            .eq('id', appointmentId)
            .eq('user_id', userId)
            .single();
        
        if (checkError || !existingAppointment) {
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'Appointment not found' 
            });
        }
        
        const updateData = {};
        if (appointment_date !== undefined) updateData.appointment_date = appointment_date;
        if (appointment_time !== undefined) updateData.appointment_time = appointment_time;
        if (status !== undefined) updateData.status = status;
        
        if (appointment_date || appointment_time) {
            updateData.reminder_sent = false;
        }
        
        const { data, error } = await supabase
            .from('appointments')
            .update(updateData)
            .eq('id', appointmentId)
            .eq('user_id', userId)
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        res.status(200).json({ 
            message: 'Appointment updated successfully', 
            appointment: data 
        });
    } catch (err) {
        console.error('Update appointment error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const appointmentId = req.params.id;
        
        const { data: existingAppointment, error: checkError } = await supabase
            .from('appointments')
            .select('id')
            .eq('id', appointmentId)
            .eq('user_id', userId)
            .single();
        
        if (checkError || !existingAppointment) {
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'Appointment not found' 
            });
        }
        
        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', appointmentId)
            .eq('user_id', userId);
        
        if (error) {
            throw error;
        }
        
        res.status(200).json({ message: 'Appointment deleted successfully' });
    } catch (err) {
        console.error('Delete appointment error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

router.get('/memos', async (req, res) => {
    try {
        const userId = req.user.userId;
        const clinicId = req.query.clinic_id;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        
        let query = supabase
            .from('memos')
            .select(`
                id,
                clinic_id,
                memo_date,
                patient_memo,
                doctor_memo,
                created_at,
                updated_at,
                clinics (
                    hospital_name,
                    department
                )
            `)
            .eq('user_id', userId);
        
        if (clinicId) {
            query = query.eq('clinic_id', clinicId);
        }
        
        if (startDate) {
            query = query.gte('memo_date', startDate);
        }
        
        if (endDate) {
            query = query.lte('memo_date', endDate);
        }
        
        query = query.order('memo_date', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        const formattedData = data.map(memo => ({
            id: memo.id,
            clinic_id: memo.clinic_id,
            memo_date: memo.memo_date,
            patient_memo: memo.patient_memo,
            doctor_memo: memo.doctor_memo,
            created_at: memo.created_at,
            updated_at: memo.updated_at,
            hospital_name: memo.clinics.hospital_name,
            department: memo.clinics.department
        }));
        
        res.status(200).json(formattedData);
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
            return res.status(400).json({ 
                error: 'Validation error', 
                message: 'Clinic ID and memo date are required' 
            });
        }
        
        const { data: clinic, error: clinicError } = await supabase
            .from('clinics')
            .select('id')
            .eq('id', clinic_id)
            .eq('user_id', userId)
            .single();
        
        if (clinicError || !clinic) {
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'Clinic not found' 
            });
        }
        
        const { data: existingMemo, error: checkError } = await supabase
            .from('memos')
            .select('id')
            .eq('user_id', userId)
            .eq('clinic_id', clinic_id)
            .eq('memo_date', memo_date)
            .maybeSingle();
        
        let data, error;
        
        if (existingMemo) {
            const updateResult = await supabase
                .from('memos')
                .update({
                    patient_memo: patient_memo || null,
                    doctor_memo: doctor_memo || null
                })
                .eq('id', existingMemo.id)
                .select()
                .single();
            
            data = updateResult.data;
            error = updateResult.error;
        } else {
            const insertResult = await supabase
                .from('memos')
                .insert({
                    user_id: userId,
                    clinic_id: clinic_id,
                    memo_date: memo_date,
                    patient_memo: patient_memo || null,
                    doctor_memo: doctor_memo || null
                })
                .select()
                .single();
            
            data = insertResult.data;
            error = insertResult.error;
        }
        
        if (error) {
            throw error;
        }
        
        res.status(200).json({ 
            message: 'Memo saved successfully', 
            memo: data 
        });
    } catch (err) {
        console.error('Save memo error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

router.delete('/memos/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const memoId = req.params.id;
        
        const { data: existingMemo, error: checkError } = await supabase
            .from('memos')
            .select('id')
            .eq('id', memoId)
            .eq('user_id', userId)
            .single();
        
        if (checkError || !existingMemo) {
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'Memo not found' 
            });
        }
        
        const { error } = await supabase
            .from('memos')
            .delete()
            .eq('id', memoId)
            .eq('user_id', userId);
        
        if (error) {
            throw error;
        }
        
        res.status(200).json({ message: 'Memo deleted successfully' });
    } catch (err) {
        console.error('Delete memo error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
});

module.exports = router;
