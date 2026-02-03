require('dotenv').config();
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const renderClient = new Client({
    connectionString: process.env.RENDER_DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateData() {
    try {
        console.log('Starting data migration from Render PostgreSQL to Supabase...\n');

        await renderClient.connect();
        console.log('Connected to Render PostgreSQL');

        console.log('\nMigrating users...');
        const usersResult = await renderClient.query('SELECT * FROM users ORDER BY id');
        for (const user of usersResult.rows) {
            const { error } = await supabase.from('users').upsert({
                id: user.id,
                username: user.username,
                password_hash: user.password_hash,
                timezone: user.timezone || 'Asia/Tokyo',
                email: user.email || null,
                notification_days_before: user.notification_days_before || 1,
                created_at: user.created_at,
                updated_at: user.updated_at
            });
            if (error) console.error(`Error migrating user ${user.id}:`, error);
            else console.log(`Migrated user: ${user.username}`);
        }
        console.log(`Total users migrated: ${usersResult.rows.length}`);

        console.log('\nMigrating clinics...');
        const clinicsResult = await renderClient.query('SELECT * FROM clinics ORDER BY id');
        for (const clinic of clinicsResult.rows) {
            const { error } = await supabase.from('clinics').upsert({
                id: clinic.id,
                user_id: clinic.user_id,
                hospital_name: clinic.hospital_name,
                department: clinic.department,
                diagnosis: clinic.diagnosis,
                medication: clinic.medication,
                created_at: clinic.created_at,
                updated_at: clinic.updated_at
            });
            if (error) console.error(`Error migrating clinic ${clinic.id}:`, error);
            else console.log(`Migrated clinic: ${clinic.hospital_name} - ${clinic.department}`);
        }
        console.log(`Total clinics migrated: ${clinicsResult.rows.length}`);

        console.log('\nMigrating appointments...');
        const appointmentsResult = await renderClient.query('SELECT * FROM appointments ORDER BY id');
        for (const appointment of appointmentsResult.rows) {
            const { error } = await supabase.from('appointments').upsert({
                id: appointment.id,
                user_id: appointment.user_id,
                clinic_id: appointment.clinic_id,
                appointment_date: appointment.appointment_date,
                appointment_time: appointment.appointment_time,
                status: appointment.status || 'scheduled',
                reminder_sent: appointment.reminder_sent || false,
                created_at: appointment.created_at,
                updated_at: appointment.updated_at
            });
            if (error) console.error(`Error migrating appointment ${appointment.id}:`, error);
            else console.log(`Migrated appointment: ${appointment.appointment_date}`);
        }
        console.log(`Total appointments migrated: ${appointmentsResult.rows.length}`);

        console.log('\nMigrating memos...');
        const memosResult = await renderClient.query('SELECT * FROM memos ORDER BY id');
        for (const memo of memosResult.rows) {
            const { error } = await supabase.from('memos').upsert({
                id: memo.id,
                user_id: memo.user_id,
                clinic_id: memo.clinic_id,
                memo_date: memo.memo_date,
                patient_memo: memo.patient_memo,
                doctor_memo: memo.doctor_memo,
                created_at: memo.created_at,
                updated_at: memo.updated_at
            });
            if (error) console.error(`Error migrating memo ${memo.id}:`, error);
            else console.log(`Migrated memo: ${memo.memo_date}`);
        }
        console.log(`Total memos migrated: ${memosResult.rows.length}`);

        await renderClient.end();
        console.log('\n✅ Data migration completed successfully!');

    } catch (err) {
        console.error('\n❌ Migration error:', err);
        process.exit(1);
    }
}

migrateData();
