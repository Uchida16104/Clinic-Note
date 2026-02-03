const express = require('express');
const router = express.Router();
const { supabase } = require('../db/database');
const { verifyToken } = require('./auth');

router.use(verifyToken);

router.post('/subscribe', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { subscription } = req.body;

        if (!subscription) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Subscription object is required'
            });
        }

        const { error } = await supabase
            .from('users')
            .update({ push_subscription: subscription })
            .eq('id', userId);

        if (error) {
            throw error;
        }

        res.status(200).json({
            message: 'Push notification subscription saved successfully'
        });

    } catch (err) {
        console.error('Subscribe to push notifications error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.delete('/unsubscribe', async (req, res) => {
    try {
        const userId = req.user.userId;

        const { error } = await supabase
            .from('users')
            .update({ push_subscription: null })
            .eq('id', userId);

        if (error) {
            throw error;
        }

        res.status(200).json({
            message: 'Push notification subscription removed successfully'
        });

    } catch (err) {
        console.error('Unsubscribe from push notifications error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.put('/settings', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { email, notification_days_before } = req.body;

        const updateData = {};
        if (email !== undefined) updateData.email = email;
        if (notification_days_before !== undefined) {
            const days = parseInt(notification_days_before);
            if (isNaN(days) || days < 0 || days > 7) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'notification_days_before must be between 0 and 7'
                });
            }
            updateData.notification_days_before = days;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'No valid fields to update'
            });
        }

        const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);

        if (error) {
            throw error;
        }

        res.status(200).json({
            message: 'Notification settings updated successfully',
            settings: updateData
        });

    } catch (err) {
        console.error('Update notification settings error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.get('/settings', async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from('users')
            .select('email, notification_days_before, push_subscription')
            .eq('id', userId)
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json({
            email: data.email,
            notification_days_before: data.notification_days_before,
            push_enabled: !!data.push_subscription
        });

    } catch (err) {
        console.error('Get notification settings error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.get('/vapid-public-key', async (req, res) => {
    try {
        res.status(200).json({
            publicKey: process.env.WEB_PUSH_PUBLIC_KEY
        });
    } catch (err) {
        console.error('Get VAPID public key error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

module.exports = router;
