// Clinic Note - Calendar JavaScript
// Calendar utility functions
const calendarUtils = {
    // Get days in month
    getDaysInMonth: (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    },

    // Get first day of month (0 = Sunday, 6 = Saturday)
    getFirstDayOfMonth: (year, month) => {
        return new Date(year, month, 1).getDay();
    },

    // Check if date is today
    isToday: (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    },

    // Format date to YYYY-MM-DD
    formatDate: (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Parse date string to Date object
    parseDate: (dateString) => {
        return new Date(dateString);
    },

    // Get month name
    getMonthName: (month, lang = 'ja') => {
        const monthNames = {
            ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
            en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        };
        return monthNames[lang][month];
    },

    // Get day name
    getDayName: (day, lang = 'ja') => {
        const dayNames = {
            ja: ['日', '月', '火', '水', '木', '金', '土'],
            en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        };
        return dayNames[lang][day];
    },

    // Calculate days between dates
    daysBetween: (date1, date2) => {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round(Math.abs((date1 - date2) / oneDay));
    },

    // Add days to date
    addDays: (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },

    // Subtract days from date
    subtractDays: (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result;
    },

    // Get week number
    getWeekNumber: (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },

    // Check if date is weekend
    isWeekend: (date) => {
        const day = date.getDay();
        return day === 0 || day === 6;
    },

    // Get calendar data for month
    getMonthCalendar: (year, month) => {
        const firstDay = calendarUtils.getFirstDayOfMonth(year, month);
        const daysInMonth = calendarUtils.getDaysInMonth(year, month);
        const daysInPrevMonth = calendarUtils.getDaysInMonth(year, month - 1);
        
        const calendar = [];
        let week = [];

        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const date = new Date(year, month - 1, day);
            week.push({
                date: date,
                day: day,
                isCurrentMonth: false,
                isToday: calendarUtils.isToday(date),
                isWeekend: calendarUtils.isWeekend(date)
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            week.push({
                date: date,
                day: day,
                isCurrentMonth: true,
                isToday: calendarUtils.isToday(date),
                isWeekend: calendarUtils.isWeekend(date)
            });

            if (week.length === 7) {
                calendar.push(week);
                week = [];
            }
        }

        // Next month days
        if (week.length > 0) {
            let day = 1;
            while (week.length < 7) {
                const date = new Date(year, month + 1, day);
                week.push({
                    date: date,
                    day: day,
                    isCurrentMonth: false,
                    isToday: calendarUtils.isToday(date),
                    isWeekend: calendarUtils.isWeekend(date)
                });
                day++;
            }
            calendar.push(week);
        }

        return calendar;
    }
};

// Memo management functions
const memoManager = {
    // Save memo to IndexedDB
    saveToLocal: async (memo) => {
        try {
            const db = await openDB();
            const transaction = db.transaction(['memos'], 'readwrite');
            const store = transaction.objectStore('memos');
            await store.put(memo);
            console.log('Memo saved to local storage');
            return true;
        } catch (err) {
            console.error('Save memo to local error:', err);
            return false;
        }
    },

    // Get memo from IndexedDB
    getFromLocal: async (clinicId, memoDate) => {
        try {
            const db = await openDB();
            const transaction = db.transaction(['memos'], 'readonly');
            const store = transaction.objectStore('memos');
            const index = store.index('clinic_id');
            const memos = await index.getAll(clinicId);
            
            return memos.find(m => m.memo_date === memoDate);
        } catch (err) {
            console.error('Get memo from local error:', err);
            return null;
        }
    },

    // Get all memos for clinic
    getAllForClinic: async (clinicId) => {
        try {
            const db = await openDB();
            const transaction = db.transaction(['memos'], 'readonly');
            const store = transaction.objectStore('memos');
            const index = store.index('clinic_id');
            return await index.getAll(clinicId);
        } catch (err) {
            console.error('Get all memos error:', err);
            return [];
        }
    }
};

// Appointment management functions
const appointmentManager = {
    // Check if date has appointment
    hasAppointment: (appointments, date) => {
        const dateStr = calendarUtils.formatDate(date);
        return appointments.some(a => a.appointment_date === dateStr);
    },

    // Get appointments for date
    getAppointmentsForDate: (appointments, date) => {
        const dateStr = calendarUtils.formatDate(date);
        return appointments.filter(a => a.appointment_date === dateStr);
    },

    // Get upcoming appointments
    getUpcoming: (appointments, daysAhead = 7) => {
        const today = new Date();
        const futureDate = calendarUtils.addDays(today, daysAhead);
        
        return appointments.filter(a => {
            const appointmentDate = calendarUtils.parseDate(a.appointment_date);
            return appointmentDate >= today && appointmentDate <= futureDate;
        }).sort((a, b) => {
            return calendarUtils.parseDate(a.appointment_date) - calendarUtils.parseDate(b.appointment_date);
        });
    },

    // Get past appointments
    getPast: (appointments, daysBack = 30) => {
        const today = new Date();
        const pastDate = calendarUtils.subtractDays(today, daysBack);
        
        return appointments.filter(a => {
            const appointmentDate = calendarUtils.parseDate(a.appointment_date);
            return appointmentDate >= pastDate && appointmentDate < today;
        }).sort((a, b) => {
            return calendarUtils.parseDate(b.appointment_date) - calendarUtils.parseDate(a.appointment_date);
        });
    }
};

// Helper function to open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ClinicNoteDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calendarUtils,
        memoManager,
        appointmentManager
    };
}
