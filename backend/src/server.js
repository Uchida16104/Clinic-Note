// Clinic Note - Main Server File (修正版)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const clinicRoutes = require('./routes/clinic');
const appointmentRoutes = require('./routes/appointments');
const analyticsRoutes = require('./routes/analytics');

// Import middleware
const basicAuthMiddleware = require('./middleware/basicAuth');

// Import database
const { initDatabase } = require('./db/database');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Trust proxy (for Render)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'https://clinic-note-liart.vercel.app',
            'http://localhost:3000',
            'http://localhost:4173'
        ];
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all for development
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Basic-Auth']
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}

// Rate limiting (より寛容な設定)
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // 100から500に増加
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => {
        // 認証済みユーザーはレート制限を緩和
        return req.headers['authorization'] && req.headers['x-basic-auth'];
    }
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Clinic Note API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            clinics: '/api/clinics',
            appointments: '/api/appointments',
            analytics: '/api/analytics'
        }
    });
});

// CouchDB/PouchDB互換エンドポイント (修正)
app.get('/db/:dbname', (req, res) => {
    res.status(200).json({
        db_name: req.params.dbname,
        doc_count: 0,
        update_seq: 0
    });
});

app.get('/db/:dbname/:docid', (req, res) => {
    res.status(404).json({
        error: 'not_found',
        reason: 'missing'
    });
});

app.post('/db/:dbname/_revs_diff', (req, res) => {
    res.status(200).json({});
});

app.get('/db/:dbname/_changes', (req, res) => {
    res.status(200).json({
        results: [],
        last_seq: 0
    });
});

app.get('/db/:dbname/_local/:localid', (req, res) => {
    res.status(404).json({
        error: 'not_found',
        reason: 'missing'
    });
});

// Memos PouchDB エンドポイント (追加)
app.get('/memos/', (req, res) => {
    res.status(200).json({
        db_name: 'memos',
        doc_count: 0,
        update_seq: 0
    });
});

app.get('/memos/:userid', (req, res) => {
    res.status(200).json({
        db_name: `memos_${req.params.userid}`,
        doc_count: 0,
        update_seq: 0
    });
});

app.get('/memos/:userid/:docid', (req, res) => {
    res.status(404).json({
        error: 'not_found',
        reason: 'missing'
    });
});

app.post('/memos/:userid/_revs_diff', (req, res) => {
    res.status(200).json({});
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/clinics', basicAuthMiddleware, clinicRoutes);
app.use('/api/appointments', basicAuthMiddleware, appointmentRoutes);
app.use('/api/analytics', basicAuthMiddleware, analyticsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(statusCode).json({
        error: message,
        timestamp: new Date().toISOString(),
        path: req.path,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await initDatabase();
        console.log('Database initialized successfully');

        // Start server
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║           Clinic Note API Server                     ║
║                                                       ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(37)}║
║   Port: ${PORT.toString().padEnd(43)}║
║   Status: Running                                    ║
║                                                       ║
║   Health Check: http://localhost:${PORT}/health${' '.repeat(14)}║
║   API Docs: http://localhost:${PORT}/${' '.repeat(19)}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
            `);
        });

        // Graceful shutdown
        const shutdown = async (signal) => {
            console.log(`${signal} signal received: closing HTTP server`);
            server.close(() => {
                console.log('HTTP server closed');
                process.exit(0);
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                console.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;
