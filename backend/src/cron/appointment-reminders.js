const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.RENDER_DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

function formatDateInTimezone(date, timezone) {
    try {
        const options = {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        return new Intl.DateTimeFormat('ja-JP', options).format(new Date(date));
    } catch (error) {
        console.error('Format date error:', error);
        return new Date(date).toLocaleString();
    }
}

function getEmailTemplate(lang, appointmentDate, appointmentTime, hospitalName, department, userName, timezone) {
    const formattedDate = formatDateInTimezone(appointmentDate, timezone);
    
    const templates = {
        ja: {
            subject: `【通院リマインダー】${hospitalName} - ${department}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .appointment-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #6366f1; border-radius: 5px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #6366f1; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 通院リマインダー</h1>
        </div>
        <div class="content">
            <p>${userName} 様</p>
            <p>以下の通院予定日が近づいています。</p>
            
            <div class="appointment-box">
                <div class="info-row">
                    <span class="label">病院名:</span> ${hospitalName}
                </div>
                <div class="info-row">
                    <span class="label">診療科目:</span> ${department}
                </div>
                <div class="info-row">
                    <span class="label">通院日:</span> ${formattedDate.split(' ')[0]}
                </div>
                ${appointmentTime ? `<div class="info-row"><span class="label">時間:</span> ${appointmentTime}</div>` : ''}
            </div>
            
            <p>必要な持ち物や事前準備をご確認ください。</p>
            <p>お大事にしてください。</p>
            
            <div class="footer">
                <p>このメールは Clinic Note から自動送信されています。</p>
                <p>© 2025 Clinic Note. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
            `,
            text: `
${userName} 様

以下の通院予定日が近づいています。

病院名: ${hospitalName}
診療科目: ${department}
通院日: ${formattedDate.split(' ')[0]}
${appointmentTime ? `時間: ${appointmentTime}` : ''}

必要な持ち物や事前準備をご確認ください。
お大事にしてください。

---
このメールは Clinic Note から自動送信されています。
            `
        },
        en: {
            subject: `[Appointment Reminder] ${hospitalName} - ${department}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .appointment-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #6366f1; border-radius: 5px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #6366f1; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 Appointment Reminder</h1>
        </div>
        <div class="content">
            <p>Dear ${userName},</p>
            <p>Your upcoming appointment is approaching.</p>
            
            <div class="appointment-box">
                <div class="info-row">
                    <span class="label">Hospital:</span> ${hospitalName}
                </div>
                <div class="info-row">
                    <span class="label">Department:</span> ${department}
                </div>
                <div class="info-row">
                    <span class="label">Date:</span> ${formattedDate.split(' ')[0]}
                </div>
                ${appointmentTime ? `<div class="info-row"><span class="label">Time:</span> ${appointmentTime}</div>` : ''}
            </div>
            
            <p>Please check any necessary items or preparations.</p>
            <p>Take care of yourself.</p>
            
            <div class="footer">
                <p>This email was sent automatically from Clinic Note.</p>
                <p>© 2025 Clinic Note. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
            `,
            text: `
Dear ${userName},

Your upcoming appointment is approaching.

Hospital: ${hospitalName}
Department: ${department}
Date: ${formattedDate.split(' ')[0]}
${appointmentTime ? `Time: ${appointmentTime}` : ''}

Please check any necessary items or preparations.
Take care of yourself.

---
This email was sent automatically from Clinic Note.
            `
        }
    };
    
    return templates[lang] || templates['ja'];
}

async function sendReminderEmail(userEmail, userName, appointmentDate, appointmentTime, hospitalName, department, timezone, lang) {
    try {
        const template = getEmailTemplate(lang, appointmentDate, appointmentTime, hospitalName, department, userName, timezone);
        
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Clinic Note'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: userEmail,
            subject: template.subject,
            text: template.text,
            html: template.html
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log('Reminder email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Failed to send reminder email:', error);
        return false;
    }
}

async function processAppointmentReminders() {
    console.log('Processing appointment reminders...');
    
    try {
        const query = `
            SELECT 
                a.id as appointment_id,
                a.appointment_date,
                a.appointment_time,
                a.reminder_sent,
                u.id as user_id,
                u.username,
                u.email,
                u.timezone,
                u.notification_days_before,
                c.hospital_name,
                c.department
            FROM appointments a
            JOIN users u ON a.user_id = u.id
            JOIN clinics c ON a.clinic_id = c.id
            WHERE 
                a.reminder_sent = false
                AND a.appointment_date >= CURRENT_DATE
                AND u.email IS NOT NULL
                AND u.email != ''
        `;
        
        const result = await pool.query(query);
        console.log(`Found ${result.rows.length} appointments to check`);
        
        for (const row of result.rows) {
            const timezone = row.timezone || 'Asia/Tokyo';
            const daysBefore = row.notification_days_before || 1;
            
            const now = new Date();
            const appointmentDate = new Date(row.appointment_date);
            
            const timezoneOffset = getTimezoneOffset(timezone);
            const nowInTimezone = new Date(now.getTime() + timezoneOffset * 60000);
            const appointmentInTimezone = new Date(appointmentDate.getTime() + timezoneOffset * 60000);
            
            const daysUntilAppointment = Math.ceil((appointmentInTimezone - nowInTimezone) / (1000 * 60 * 60 * 24));
            
            console.log(`Appointment ${row.appointment_id}: ${daysUntilAppointment} days until appointment (notify at ${daysBefore} days before)`);
            
            if (daysUntilAppointment <= daysBefore && daysUntilAppointment >= 0) {
                const lang = timezone.includes('Asia') ? 'ja' : 'en';
                
                const emailSent = await sendReminderEmail(
                    row.email,
                    row.username,
                    row.appointment_date,
                    row.appointment_time,
                    row.hospital_name,
                    row.department,
                    timezone,
                    lang
                );
                
                if (emailSent) {
                    await pool.query(
                        'UPDATE appointments SET reminder_sent = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                        [row.appointment_id]
                    );
                    console.log(`Reminder sent for appointment ${row.appointment_id}`);
                }
            }
        }
        
        console.log('Appointment reminders processing completed');
    } catch (error) {
        console.error('Error processing appointment reminders:', error);
    }
}

function getTimezoneOffset(timezone) {
    try {
        const now = new Date();
        const tzString = now.toLocaleString('en-US', { timeZone: timezone });
        const tzDate = new Date(tzString);
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const offset = (tzDate - utcDate) / (1000 * 60);
        return offset;
    } catch (error) {
        console.error('Get timezone offset error:', error);
        return 0;
    }
}

function startAppointmentReminderCron() {
    cron.schedule('0 9 * * *', async () => {
        console.log('Running daily appointment reminder job at 9:00 AM');
        await processAppointmentReminders();
    }, {
        timezone: 'Asia/Tokyo'
    });
    
    console.log('Appointment reminder cron job started (runs daily at 9:00 AM JST)');
}

module.exports = {
    startAppointmentReminderCron,
    processAppointmentReminders
};
