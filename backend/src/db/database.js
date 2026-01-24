// Clinic Note - Database Configuration
const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Test database connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Database initialization function
async function initDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('Initializing database schema...');

        // Create users table with timezone
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                timezone VARCHAR(100) DEFAULT 'Asia/Tokyo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Users table created/verified');

        // Create clinics table
        await client.query(`
            CREATE TABLE IF NOT EXISTS clinics (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                hospital_name VARCHAR(255) NOT NULL,
                department VARCHAR(255) NOT NULL,
                diagnosis TEXT,
                medication TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Clinics table created/verified');

        // Create appointments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
                appointment_date DATE NOT NULL,
                appointment_time TIME,
                status VARCHAR(50) DEFAULT 'scheduled',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Appointments table created/verified');

        // Create memos table (patients notes and doctors diagnosis)
        await client.query(`
            CREATE TABLE IF NOT EXISTS memos (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
                memo_date DATE NOT NULL,
                patient_memo TEXT,
                doctor_memo TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, clinic_id, memo_date)
            )
        `);
        console.log('✓ Memos table created/verified');

        // Create indexes for better performance
        await client.query(`CREATE INDEX IF NOT EXISTS idx_clinics_user_id ON clinics(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON appointments(clinic_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_memos_clinic_id ON memos(clinic_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_memos_date ON memos(memo_date)`);
        console.log('✓ Indexes created/verified');

        // Create updated_at trigger function
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);

        // Create triggers for updated_at
        const tables = ['users', 'clinics', 'appointments', 'memos'];
        for (const table of tables) {
            await client.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`);
            await client.query(`
                CREATE TRIGGER update_${table}_updated_at
                BEFORE UPDATE ON ${table}
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column()
            `);
        }
        console.log('✓ Triggers created/verified');

        console.log('Database initialization completed successfully');
    } catch (err) {
        console.error('Database initialization error:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Query helper function
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: result.rowCount });
        return result;
    } catch (err) {
        console.error('Query error:', { text, error: err.message });
        throw err;
    }
}

// Transaction helper function
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// Get client for manual transaction management
async function getClient() {
    return await pool.connect();
}

// Close pool
async function closePool() {
    await pool.end();
    console.log('Database pool closed');
}

module.exports = {
    pool,
    query,
    transaction,
    getClient,
    initDatabase,
    closePool
};
