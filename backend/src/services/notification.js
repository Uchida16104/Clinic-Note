const { Resend } = require('resend');
const webpush = require('web-push');
const nodemailer = require('nodemailer');
const { supabase } = require('../db/database');

const resend = new Resend(process.env.RESEND_API_KEY);

webpush.setVapidDetails(
    process.env.WEB_PUSH_EMAIL,
    process.env.WEB_PUSH_PUBLIC_KEY,
    process.env.WEB_PUSH_PRIVATE_KEY
);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

function convertToUserTimezone(date, timezone) {
    const utcDate = new Date(date);
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: timezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    }).format(utcDate);
}

function isReminderDay(appointmentDate, userTimezone, notificationDaysBefore) {
    const now = new Date();
    
    const userNowStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);
    
    const userToday = new Date(userNowStr);
    
    const appointmentDateObj = new Date(appointmentDate);
    
    const diffTime = appointmentDateObj - userToday;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays === notificationDaysBefore;
}

async function sendEmailReminderViaNodemailer(userEmail, username, hospitalName, department, appointmentDate, appointmentTime, timezone, language = 'ja') {
    try {
        const formattedDate = convertToUserTimezone(appointmentDate, timezone);
        const timeStr = appointmentTime ? ` ${appointmentTime}` : '';
        
        const translations = {
            ja: {
                subject: `通院リマインダー - ${hospitalName}`,
                greeting: `こんにちは、${username}さん`,
                message: '通院の予定日が近づいています。',
                hospital: '病院名',
                department: '診療科目',
                datetime: '日時',
                footer: 'お忘れなくお越しください。',
                autoMessage: 'このメールはClinic Noteから自動送信されています。',
                dashboardLink: 'ダッシュボードを開く'
            },
            en: {
                subject: `Appointment Reminder - ${hospitalName}`,
                greeting: `Hello ${username},`,
                message: 'Your appointment is coming up soon.',
                hospital: 'Hospital',
                department: 'Department',
                datetime: 'Date & Time',
                footer: 'Please remember to attend.',
                autoMessage: 'This is an automated message from Clinic Note.',
                dashboardLink: 'Open Dashboard'
            }
        };
        
        const t = translations[language] || translations['ja'];
        
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Clinic Note'}" <${process.env.SMTP_FROM_EMAIL || 'noreply@clinicnote.app'}>`,
            to: userEmail,
            subject: t.subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">${t.subject}</h2>
                    <p>${t.greeting}</p>
                    <p>${t.message}</p>
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>${t.hospital}:</strong> ${hospitalName}</p>
                        <p style="margin: 5px 0;"><strong>${t.department}:</strong> ${department}</p>
                        <p style="margin: 5px 0;"><strong>${t.datetime}:</strong> ${formattedDate}${timeStr}</p>
                    </div>
                    <p>${t.footer}</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                    <p style="font-size: 12px; color: #6B7280;">
                        ${t.autoMessage}
                        <br>
                        <a href="${process.env.FRONTEND_URL}/dashboard.html" style="color: #4F46E5;">${t.dashboardLink}</a>
                    </p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
        console.log('Email sent successfully via Nodemailer to:', userEmail);
        return true;
    } catch (err) {
        console.error('Send email via Nodemailer error:', err);
        return false;
    }
}

async function sendEmailReminder(userEmail, username, hospitalName, department, appointmentDate, appointmentTime, timezone) {
    try {
        const formattedDate = convertToUserTimezone(appointmentDate, timezone);
        
        const timeStr = appointmentTime ? ` ${appointmentTime}` : '';
        
        const { data, error } = await resend.emails.send({
            from: 'Clinic Note <notifications@clinicnote.app>',
            to: userEmail,
            subject: `通院リマインダー - ${hospitalName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">通院リマインダー</h2>
                    <p>こんにちは、${username}さん</p>
                    <p>通院の予定日が近づいています。</p>
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>病院名:</strong> ${hospitalName}</p>
                        <p style="margin: 5px 0;"><strong>診療科目:</strong> ${department}</p>
                        <p style="margin: 5px 0;"><strong>日時:</strong> ${formattedDate}${timeStr}</p>
                    </div>
                    <p>お忘れなくお越しください。</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                    <p style="font-size: 12px; color: #6B7280;">
                        このメールはClinic Noteから自動送信されています。
                        <br>
                        <a href="${process.env.FRONTEND_URL}/dashboard.html" style="color: #4F46E5;">ダッシュボードを開く</a>
                    </p>
                </div>
            `
        });
        
        if (error) {
            console.error('Email send error:', error);
            return false;
        }
        
        console.log('Email sent successfully:', data);
        return true;
    } catch (err) {
        console.error('Send email reminder error:', err);
        return false;
    }
}

async function sendPushNotification(userId, title, body, data = {}) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('push_subscription')
            .eq('id', userId)
            .single();
        
        if (error || !user || !user.push_subscription) {
            console.log('No push subscription found for user:', userId);
            return false;
        }
        
        const subscription = user.push_subscription;
        
        const payload = JSON.stringify({
            title: title,
            body: body,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            data: data
        });
        
        await webpush.sendNotification(subscription, payload);
        
        console.log('Push notification sent successfully to user:', userId);
        return true;
    } catch (err) {
        console.error('Send push notification error:', err);
        if (err.statusCode === 410) {
            try {
                await supabase
                    .from('users')
                    .update({ push_subscription: null })
                    .eq('id', userId);
                console.log('Removed expired push subscription for user:', userId);
            } catch (cleanupErr) {
                console.error('Failed to clean up expired subscription:', cleanupErr);
            }
        }
        return false;
    }
}

async function processReminders() {
    try {
        console.log('Processing reminders...');
        
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, username, email, timezone, notification_days_before, push_subscription');
        
        if (usersError) {
            console.error('Get users error:', usersError);
            return;
        }
        
        if (!users || users.length === 0) {
            console.log('No users found');
            return;
        }
        
        let totalReminders = 0;
        
        for (const user of users) {
            if (!user.email && !user.push_subscription) {
                continue;
            }
            
            const timezone = user.timezone || 'Asia/Tokyo';
            const notificationDaysBefore = user.notification_days_before || 1;
            const userLanguage = timezone.includes('Asia/Tokyo') ? 'ja' : 'en';
            
            const { data: appointments, error: appointmentsError } = await supabase
                .from('appointments')
                .select(`
                    id,
                    appointment_date,
                    appointment_time,
                    reminder_sent,
                    clinics (
                        hospital_name,
                        department
                    )
                `)
                .eq('user_id', user.id)
                .eq('reminder_sent', false)
                .gte('appointment_date', new Date().toISOString().split('T')[0]);
            
            if (appointmentsError) {
                console.error('Get appointments error for user', user.id, ':', appointmentsError);
                continue;
            }
            
            if (!appointments || appointments.length === 0) {
                continue;
            }
            
            for (const appointment of appointments) {
                if (isReminderDay(appointment.appointment_date, timezone, notificationDaysBefore)) {
                    let emailSent = false;
                    let pushSent = false;
                    
                    if (user.email) {
                        emailSent = await sendEmailReminderViaNodemailer(
                            user.email,
                            user.username,
                            appointment.clinics.hospital_name,
                            appointment.clinics.department,
                            appointment.appointment_date,
                            appointment.appointment_time,
                            timezone,
                            userLanguage
                        );
                        
                        if (!emailSent) {
                            emailSent = await sendEmailReminder(
                                user.email,
                                user.username,
                                appointment.clinics.hospital_name,
                                appointment.clinics.department,
                                appointment.appointment_date,
                                appointment.appointment_time,
                                timezone
                            );
                        }
                    }
                    
                    if (user.push_subscription) {
                        const pushTitle = userLanguage === 'ja' ? '通院リマインダー' : 'Appointment Reminder';
                        const pushBody = userLanguage === 'ja' 
                            ? `${appointment.clinics.hospital_name} - ${appointment.clinics.department}の予定があります`
                            : `You have an appointment at ${appointment.clinics.hospital_name} - ${appointment.clinics.department}`;
                        
                        pushSent = await sendPushNotification(
                            user.id,
                            pushTitle,
                            pushBody,
                            {
                                url: `${process.env.FRONTEND_URL}/calendar.html`,
                                appointmentId: appointment.id
                            }
                        );
                    }
                    
                    if (emailSent || pushSent) {
                        const { error: updateError } = await supabase
                            .from('appointments')
                            .update({ reminder_sent: true })
                            .eq('id', appointment.id);
                        
                        if (updateError) {
                            console.error('Update reminder status error:', updateError);
                        } else {
                            totalReminders++;
                            console.log(`Reminder sent for appointment ${appointment.id} (User: ${user.id})`);
                        }
                    }
                }
            }
        }
        
        console.log(`Reminders processing completed. Total reminders sent: ${totalReminders}`);
    } catch (err) {
        console.error('Process reminders error:', err);
    }
}

async function resetReminderFlags() {
    try {
        console.log('Resetting reminder flags for past appointments...');
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('appointments')
            .update({ reminder_sent: false })
            .lt('appointment_date', yesterdayStr)
            .eq('reminder_sent', true)
            .select();
        
        if (error) {
            console.error('Reset reminder flags error:', error);
        } else {
            console.log(`Reset reminder flags for ${data?.length || 0} appointments`);
        }
    } catch (err) {
        console.error('Reset reminder flags error:', err);
    }
}

module.exports = {
    sendEmailReminder,
    sendEmailReminderViaNodemailer,
    sendPushNotification,
    processReminders,
    resetReminderFlags
};
