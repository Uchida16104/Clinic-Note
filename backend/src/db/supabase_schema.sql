CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    timezone VARCHAR(100) DEFAULT 'Asia/Tokyo',
    email VARCHAR(255),
    notification_days_before INTEGER DEFAULT 1,
    push_subscription JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hospital_name VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    diagnosis TEXT,
    medication TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME,
    status VARCHAR(50) DEFAULT 'scheduled',
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE INDEX IF NOT EXISTS idx_clinics_user_id ON clinics(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder ON appointments(appointment_date, reminder_sent) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id);
CREATE INDEX IF NOT EXISTS idx_memos_clinic_id ON memos(clinic_id);
CREATE INDEX IF NOT EXISTS idx_memos_date ON memos(memo_date);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_clinics_updated_at') THEN
        CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_appointments_updated_at') THEN
        CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_memos_updated_at') THEN
        CREATE TRIGGER update_memos_updated_at BEFORE UPDATE ON memos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

CREATE OR REPLACE FUNCTION get_upcoming_reminders()
RETURNS TABLE (
    appointment_id INTEGER,
    user_id INTEGER,
    user_email VARCHAR,
    username VARCHAR,
    hospital_name VARCHAR,
    department VARCHAR,
    appointment_date DATE,
    appointment_time TIME,
    notification_days_before INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        u.id,
        u.email,
        u.username,
        c.hospital_name,
        c.department,
        a.appointment_date,
        a.appointment_time,
        u.notification_days_before
    FROM appointments a
    JOIN users u ON a.user_id = u.id
    JOIN clinics c ON a.clinic_id = c.id
    WHERE 
        a.status = 'scheduled' 
        AND a.reminder_sent = FALSE
        AND u.email IS NOT NULL
        AND a.appointment_date = CURRENT_DATE + (u.notification_days_before || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);
SELECT setval('clinics_id_seq', COALESCE((SELECT MAX(id) FROM clinics), 0) + 1, false);
SELECT setval('appointments_id_seq', COALESCE((SELECT MAX(id) FROM appointments), 0) + 1, false);
SELECT setval('memos_id_seq', COALESCE((SELECT MAX(id) FROM memos), 0) + 1, false);
