const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/database');

function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '認証トークンが必要です' });
        }
        
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        req.user = {
            userId: decoded.userId,
            username: decoded.username
        };
        
        next();
    } catch (err) {
        console.error('Token verification error:', err);
        return res.status(401).json({ error: '認証に失敗しました' });
    }
}

function authenticateToken(req, res, next) {
    return verifyToken(req, res, next);
}

router.post('/register', async (req, res) => {
    try {
        const { username, password, timezone = 'Asia/Tokyo' } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'パスワードは8文字以上である必要があります' });
        }

        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .maybeSingle();

        if (existingUser) {
            return res.status(409).json({ error: 'このユーザー名は既に使用されています' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                username,
                password_hash: hashedPassword,
                timezone: timezone
            })
            .select('id, username, timezone, email, notification_days_before')
            .single();

        if (error) {
            console.error('User creation error:', error);
            
            if (error.code === '23505') {
                const { data: maxIdResult } = await supabase
                    .from('users')
                    .select('id')
                    .order('id', { ascending: false })
                    .limit(1)
                    .single();
                
                if (maxIdResult) {
                    const nextId = maxIdResult.id + 1;
                    await supabase.rpc('setval', {
                        sequence_name: 'users_id_seq',
                        new_value: nextId
                    });
                }
                
                return res.status(500).json({ error: 'ユーザー登録に失敗しました。もう一度お試しください。' });
            }
            
            return res.status(500).json({ error: 'ユーザー登録に失敗しました' });
        }

        const token = jwt.sign(
            { userId: newUser.id, username: newUser.username },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'ユーザー登録が完了しました',
            token,
            userId: newUser.id,
            timezone: newUser.timezone,
            user: {
                id: newUser.id,
                username: newUser.username,
                timezone: newUser.timezone,
                email: newUser.email,
                notification_days_before: newUser.notification_days_before
            }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, password_hash, timezone, email, notification_days_before')
            .eq('username', username)
            .maybeSingle();

        if (error || !user) {
            return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'ログインに成功しました',
            token,
            userId: user.id,
            timezone: user.timezone,
            user: {
                id: user.id,
                username: user.username,
                timezone: user.timezone,
                email: user.email,
                notification_days_before: user.notification_days_before
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

router.get('/verify', verifyToken, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, timezone, email, notification_days_before')
            .eq('id', req.user.userId)
            .maybeSingle();

        if (error || !user) {
            return res.status(401).json({ error: 'ユーザーが見つかりません' });
        }

        res.json({
            user: {
                id: user.id,
                username: user.username,
                timezone: user.timezone,
                email: user.email,
                notification_days_before: user.notification_days_before
            }
        });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(401).json({ error: '認証に失敗しました' });
    }
});

module.exports = router;
module.exports.verifyToken = verifyToken;
module.exports.authenticateToken = authenticateToken;
