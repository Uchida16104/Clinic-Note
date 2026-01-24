// Clinic Note - Authentication Routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/database');
const basicAuthMiddleware = require('../middleware/basicAuth');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = '7d';

// BASIC Authentication endpoint
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

// Register new user with timezone
router.post('/register', basicAuthMiddleware, async (req, res) => {
    try {
        const { username, password, timezone } = req.body;

        // Validation
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

        // Check if user already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'User already exists',
                message: 'This username is already taken'
            });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert user with timezone
        const result = await query(
            'INSERT INTO users (username, password_hash, timezone) VALUES ($1, $2, $3) RETURNING id, username, timezone, created_at',
            [username, passwordHash, timezone || 'Asia/Tokyo']
        );

        const newUser = result.rows[0];

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

// Login user
router.post('/login', basicAuthMiddleware, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Username and password are required'
            });
        }

        // Find user
        const result = await query(
            'SELECT id, username, password_hash, timezone FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid username or password'
            });
        }

        const user = result.rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid username or password'
            });
        }

        // Generate JWT token
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

// Verify token
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
            
            // Check if user still exists
            const result = await query(
                'SELECT id, username, timezone FROM users WHERE id = $1',
                [decoded.userId]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'User not found'
                });
            }

            res.status(200).json({
                valid: true,
                user: {
                    id: result.rows[0].id,
                    username: result.rows[0].username,
                    timezone: result.rows[0].timezone
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

// Update timezone
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

        await query(
            'UPDATE users SET timezone = $1 WHERE id = $2',
            [timezone, userId]
        );

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

// Middleware to verify JWT token for protected routes
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
