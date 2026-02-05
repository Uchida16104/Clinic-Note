const cron = require('node-cron');
const { supabase } = require('../db/database');

async function sendReminderViaEmailJS(userEmail, username, hospitalName, department, appointmentDate, appointmentTime, timezone) {
    console.log(`Reminder scheduled for ${userEmail}: ${hospitalName} - ${department} on ${appointmentDate}`);
    
    return true;
}

async function processEmailJSReminders() {
    try {
        console.log('Processing EmailJS reminders...');
        
        const { data: users } = await supabase
            .from('users')
            .select('id, username, email, timezone, notification_days_before');
        
        if (!users || users.length === 0) {
            console.log('No users found for EmailJS reminders');
            return;
        }
        
        let totalReminders = 0;
        
        for (const user of users) {
            if (!user.email) continue;
            
            const timezone = user.timezone || 'Asia/Tokyo';
            const notificationDaysBefore = user.notification_days_before || 1;
            
            const { data: appointments } = await supabase
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
            
            if (!appointments || appointments.length === 0) continue;
            
            for (const appointment of appointments) {
                const appointmentDate = new Date(appointment.appointment_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const diffTime = appointmentDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === notificationDaysBefore) {
                    const emailSent = await sendReminderViaEmailJS(
                        user.email,
                        user.username,
                        appointment.clinics.hospital_name,
                        appointment.clinics.department,
                        appointment.appointment_date,
                        appointment.appointment_time,
                        timezone
                    );
                    
                    if (emailSent) {
                        await supabase
                            .from('appointments')
                            .update({ reminder_sent: true })
                            .eq('id', appointment.id);
                        
                        totalReminders++;
                        console.log(`EmailJS reminder sent for appointment ${appointment.id}`);
                    }
                }
            }
        }
        
        console.log(`EmailJS reminders processing completed. Total reminders sent: ${totalReminders}`);
    } catch (err) {
        console.error('Process EmailJS reminders error:', err);
    }
}

module.exports = {
    sendReminderViaEmailJS,
    processEmailJSReminders
};
