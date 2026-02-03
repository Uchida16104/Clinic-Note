const { Resend } = require('resend');
const webpush = require('web-push');
const { supabase } = require('../db/database');

const resend = new Resend(process.env.RESEND_API_KEY);

webpush.setVapidDetails(
    process.env.WEB_PUSH_EMAIL,
    process.env.WEB_PUSH_PUBLIC_KEY,
    process.env.WEB_PUSH_PRIVATE_KEY
);

async function sendEmailReminder(userEmail, username, hospitalName, department, appointmentDate, appointmentTime) {
    try {
        const formattedDate = new Date(appointmentDate).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        
        const timeStr = appointmentTime ? ` ${appointmentTime}` : '';
        
        const { data, error } = await resend.emails.send({
            from: 'Clinic Note <notifications@clinicnote.app>',
            to: userEmail,
            subject: `通院リマインダー - ${hospitalName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">通院リマインダー</h2>
                    <p>こんにちは、${username}さん</p>
                    <p>明日は通院の予定日です。</p>
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
        return false;
    }
}

async function processReminders() {
    try {
        console.log('Processing reminders...');
        
        const { data: reminders, error } = await supabase.rpc('get_upcoming_reminders');
        
        if (error) {
            console.error('Get reminders error:', error);
            return;
        }
        
        if (!reminders || reminders.length === 0) {
            console.log('No reminders to send');
            return;
        }
        
        console.log(`Found ${reminders.length} reminders to send`);
        
        for (const reminder of reminders) {
            const emailSent = await sendEmailReminder(
                reminder.user_email,
                reminder.username,
                reminder.hospital_name,
                reminder.department,
                reminder.appointment_date,
                reminder.appointment_time
            );
            
            const pushSent = await sendPushNotification(
                reminder.user_id,
                '通院リマインダー',
                `${reminder.hospital_name} - ${reminder.department}の予定があります`,
                {
                    url: `${process.env.FRONTEND_URL}/calendar.html`,
                    appointmentId: reminder.appointment_id
                }
            );
            
            if (emailSent || pushSent) {
                const { error: updateError } = await supabase
                    .from('appointments')
                    .update({ reminder_sent: true })
                    .eq('id', reminder.appointment_id);
                
                if (updateError) {
                    console.error('Update reminder status error:', updateError);
                } else {
                    console.log(`Reminder sent for appointment ${reminder.appointment_id}`);
                }
            }
        }
        
        console.log('Reminders processing completed');
    } catch (err) {
        console.error('Process reminders error:', err);
    }
}

module.exports = {
    sendEmailReminder,
    sendPushNotification,
    processReminders
};
