const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/database');
const basicAuthMiddleware = require('../middleware/basicAuth');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = '7d';

router.post('/basic', basicAuthMiddleware, async (req, res) => {
    try {
        res.status(200).json({
            message: 'BASIC authentication successful',
            authenticated: true
        });
    } catch (err) {
        console.error('BASIC auth error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.post('/register', basicAuthMiddleware, async (req, res) => {
    try {
        const { username, password, timezone } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Username and password are required'
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Username must be at least 3 characters long'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Password must be at least 8 characters long'
            });
        }

        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(409).json({
                error: 'User already exists',
                message: 'This username is already taken'
            });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                username: username,
                password_hash: passwordHash,
                timezone: timezone || 'Asia/Tokyo'
            })
            .select('id, username, timezone, created_at')
            .single();

        if (error) {
            throw error;
        }

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                timezone: newUser.timezone,
                created_at: newUser.created_at
            }
        });

    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.post('/login', basicAuthMiddleware, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Username and password are required'
            });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, password_hash, timezone')
            .eq('username', username)
            .single();

        if (error || !user) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid username or password'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid username or password'
            });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, timezone: user.timezone },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(200).json({
            message: 'Login successful',
            token: token,
            userId: user.id,
            username: user.username,
            timezone: user.timezone
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.get('/verify', basicAuthMiddleware, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7);

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            const { data: user, error } = await supabase
                .from('users')
                .select('id, username, timezone')
                .eq('id', decoded.userId)
                .single();

            if (error || !user) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'User not found'
                });
            }

            res.status(200).json({
                valid: true,
                user: {
                    id: user.id,
                    username: user.username,
                    timezone: user.timezone
                }
            });

        } catch (jwtErr) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired token'
            });
        }

    } catch (err) {
        console.error('Verify token error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

router.put('/timezone', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { timezone } = req.body;

        if (!timezone) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Timezone is required'
            });
        }

        const { error } = await supabase
            .from('users')
            .update({ timezone: timezone })
            .eq('id', userId);

        if (error) {
            throw error;
        }

        res.status(200).json({
            message: 'Timezone updated successfully',
            timezone: timezone
        });

    } catch (err) {
        console.error('Update timezone error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'No token provided'
        });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token'
        });
    }
}

module.exports = router;
module.exports.verifyToken = verifyToken;
