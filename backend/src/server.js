require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const clinicRoutes = require('./routes/clinic');
const appointmentRoutes = require('./routes/appointments');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const usersRoutes = require('./routes/users');

const basicAuthMiddleware = require('./middleware/basicAuth');

const { initDatabase } = require('./db/database');
const { processReminders, resetReminderFlags } = require('./services/notification');

const { startAppointmentReminderCron } = require('./cron/appointment-reminders');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Basic-Auth']
};
app.use(cors(corsOptions));

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => {
        return false;
    }
});
app.use('/api/', limiter);

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

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
            analytics: '/api/analytics',
            notifications: '/api/notifications',
            users: '/api/users'
        }
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/clinics', basicAuthMiddleware, clinicRoutes);
app.use('/api/appointments', basicAuthMiddleware, appointmentRoutes);
app.use('/api/analytics', basicAuthMiddleware, analyticsRoutes);
app.use('/api/notifications', basicAuthMiddleware, notificationRoutes);
app.use('/api/users', basicAuthMiddleware, usersRoutes);

app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        timestamp: new Date().toISOString()
    });
});

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

cron.schedule('0 */1 * * *', async () => {
    console.log('Running hourly reminder check...');
    await processReminders();
}, {
    timezone: 'UTC'
});

cron.schedule('0 0 * * *', async () => {
    console.log('Running daily reminder flag reset...');
    await resetReminderFlags();
}, {
    timezone: 'UTC'
});

async function startServer() {
    try {
        await initDatabase();
        console.log('Database initialized successfully');

        app.listen(PORT, '0.0.0.0', () => {
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
║   Reminder Scheduler: Active (Hourly check)          ║
║   Flag Reset: Active (Daily at midnight UTC)         ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
            `);
            startAppointmentReminderCron();
            console.log('✓ Appointment reminder cron job initialized');
            const { processAppointmentReminders } = require('./cron/appointment-reminders');
            processAppointmentReminders();
        });

        process.on('SIGTERM', () => {
            console.log('SIGTERM signal received: closing HTTP server');
            process.exit(0);
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

startServer();

module.exports = app;
