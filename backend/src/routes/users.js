const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabase } = require('../db/database');

router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, timezone, email, notification_days_before, created_at')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }

        res.json({ user });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { email, timezone, notification_days_before } = req.body;

        const updateData = {};
        
        if (email !== undefined) {
            updateData.email = email;
        }
        
        if (timezone !== undefined) {
            updateData.timezone = timezone;
        }
        
        if (notification_days_before !== undefined) {
            if (notification_days_before < 0 || notification_days_before > 30) {
                return res.status(400).json({ error: '通知日数は0から30の範囲で指定してください' });
            }
            updateData.notification_days_before = notification_days_before;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: '更新する項目がありません' });
        }

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select('id, username, timezone, email, notification_days_before')
            .single();

        if (error) {
            console.error('Update profile error:', error);
            return res.status(500).json({ error: 'プロフィールの更新に失敗しました' });
        }

        res.json({
            message: 'プロフィールを更新しました',
            user: updatedUser
        });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

router.put('/timezone', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { timezone } = req.body;

        if (!timezone) {
            return res.status(400).json({ error: 'タイムゾーンを指定してください' });
        }

        const validTimezones = [
            'Asia/Tokyo', 'America/New_York', 'America/Chicago', 'America/Denver',
            'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Shanghai',
            'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul', 'Australia/Sydney',
            'Pacific/Auckland', 'UTC'
        ];

        if (!validTimezones.includes(timezone)) {
            return res.status(400).json({ error: '無効なタイムゾーンです' });
        }

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({ timezone })
            .eq('id', userId)
            .select('id, username, timezone, email, notification_days_before')
            .single();

        if (error) {
            console.error('Update timezone error:', error);
            return res.status(500).json({ error: 'タイムゾーンの更新に失敗しました' });
        }

        res.json({
            message: 'タイムゾーンを更新しました',
            user: updatedUser
        });
    } catch (err) {
        console.error('Update timezone error:', err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

router.post('/push-subscription', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { subscription } = req.body;

        if (!subscription) {
            return res.status(400).json({ error: 'プッシュ通知の登録情報が必要です' });
        }

        const { error } = await supabase
            .from('users')
            .update({ push_subscription: subscription })
            .eq('id', userId);

        if (error) {
            console.error('Save push subscription error:', error);
            return res.status(500).json({ error: 'プッシュ通知の登録に失敗しました' });
        }

        res.json({ message: 'プッシュ通知を登録しました' });
    } catch (err) {
        console.error('Push subscription error:', err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

router.delete('/push-subscription', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const { error } = await supabase
            .from('users')
            .update({ push_subscription: null })
            .eq('id', userId);

        if (error) {
            console.error('Delete push subscription error:', error);
            return res.status(500).json({ error: 'プッシュ通知の解除に失敗しました' });
        }

        res.json({ message: 'プッシュ通知を解除しました' });
    } catch (err) {
        console.error('Delete push subscription error:', err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
