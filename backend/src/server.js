// Clinic Note - Main Server File
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

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
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

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.'
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
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║           Clinic Note API Server                     ║
║                                                       ║
║   Environment: ${process.env.NODE_ENV?.padEnd(37) || 'development'.padEnd(37)}║
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
        process.on('SIGTERM', () => {
            console.log('SIGTERM signal received: closing HTTP server');
            server.close(() => {
                console.log('HTTP server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('SIGINT signal received: closing HTTP server');
            process.exit(0);
        });

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;
