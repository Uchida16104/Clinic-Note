// Clinic Note - Analytics JavaScript
// Analytics utility functions
const analyticsUtils = {
    // Calculate visit frequency by department
    calculateFrequencyByDepartment: (appointments, clinics) => {
        const departmentCounts = {};
        
        appointments.forEach(appointment => {
            const clinic = clinics.find(c => c.id === appointment.clinic_id);
            if (clinic) {
                const dept = clinic.department;
                departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
            }
        });

        return departmentCounts;
    },

    // Calculate monthly visit frequency
    calculateMonthlyFrequency: (appointments) => {
        const monthlyCounts = {};
        
        appointments.forEach(appointment => {
            const date = new Date(appointment.appointment_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
        });

        return monthlyCounts;
    },

    // Calculate average interval between appointments
    calculateAverageInterval: (appointments) => {
        if (appointments.length < 2) return 0;

        const sortedAppointments = [...appointments].sort((a, b) => {
            return new Date(a.appointment_date) - new Date(b.appointment_date);
        });

        let totalDays = 0;
        for (let i = 1; i < sortedAppointments.length; i++) {
            const date1 = new Date(sortedAppointments[i - 1].appointment_date);
            const date2 = new Date(sortedAppointments[i].appointment_date);
            const days = Math.abs((date2 - date1) / (1000 * 60 * 60 * 24));
            totalDays += days;
        }

        return Math.round(totalDays / (sortedAppointments.length - 1));
    },

    // Determine trend (increasing, stable, decreasing)
    determineTrend: (appointments) => {
        if (appointments.length < 3) return 'stable';

        const sortedAppointments = [...appointments].sort((a, b) => {
            return new Date(a.appointment_date) - new Date(b.appointment_date);
        });

        // Compare first half vs second half
        const midpoint = Math.floor(sortedAppointments.length / 2);
        const firstHalf = sortedAppointments.slice(0, midpoint);
        const secondHalf = sortedAppointments.slice(midpoint);

        const firstHalfDuration = new Date(firstHalf[firstHalf.length - 1].appointment_date) - 
                                  new Date(firstHalf[0].appointment_date);
        const secondHalfDuration = new Date(secondHalf[secondHalf.length - 1].appointment_date) - 
                                   new Date(secondHalf[0].appointment_date);

        if (secondHalfDuration === 0) return 'stable';

        const firstHalfFreq = firstHalf.length / (firstHalfDuration / (1000 * 60 * 60 * 24));
        const secondHalfFreq = secondHalf.length / (secondHalfDuration / (1000 * 60 * 60 * 24));

        const change = ((secondHalfFreq - firstHalfFreq) / firstHalfFreq) * 100;

        if (change > 20) return 'increasing';
        if (change < -20) return 'decreasing';
        return 'stable';
    },

    // Generate trend analysis text
    generateTrendAnalysis: (trend, count, avgInterval, lang = 'ja') => {
        const analyses = {
            ja: {
                increasing: `通院頻度が増加傾向にあります。平均${avgInterval}日間隔で通院しており、より頻繁な診察が必要な状態かもしれません。`,
                stable: `通院頻度は安定しています。平均${avgInterval}日間隔で定期的に通院されています。`,
                decreasing: `通院頻度が減少傾向にあります。症状が改善している可能性がありますが、定期検診は継続しましょう。`
            },
            en: {
                increasing: `Visit frequency is increasing. You visit every ${avgInterval} days on average, which may indicate a need for more frequent check-ups.`,
                stable: `Visit frequency is stable. You regularly visit every ${avgInterval} days on average.`,
                decreasing: `Visit frequency is decreasing. Your condition may be improving, but please continue regular check-ups.`
            }
        };

        return analyses[lang][trend] || '';
    },

    // Calculate medication adherence (based on memos)
    calculateMedicationAdherence: (memos) => {
        if (memos.length === 0) return 0;

        const medicationKeywords = {
            ja: ['服薬', '薬', '飲んだ', '服用'],
            en: ['medication', 'medicine', 'took', 'pill']
        };

        let adherenceCount = 0;
        memos.forEach(memo => {
            const content = memo.content.toLowerCase();
            const hasKeyword = medicationKeywords.ja.some(k => content.includes(k)) ||
                              medicationKeywords.en.some(k => content.includes(k));
            if (hasKeyword) adherenceCount++;
        });

        return Math.round((adherenceCount / memos.length) * 100);
    },

    // Prepare chart data
    prepareChartData: (appointments, clinics) => {
        const departmentFreq = analyticsUtils.calculateFrequencyByDepartment(appointments, clinics);
        const monthlyFreq = analyticsUtils.calculateMonthlyFrequency(appointments);

        return {
            departments: Object.keys(departmentFreq),
            departmentCounts: Object.values(departmentFreq),
            months: Object.keys(monthlyFreq).sort(),
            monthlyCounts: Object.keys(monthlyFreq).sort().map(m => monthlyFreq[m])
        };
    },

    // Generate comprehensive analytics report
    generateReport: (appointments, clinics, memos, lang = 'ja') => {
        const trends = [];
        const departments = [...new Set(clinics.map(c => c.department))];

        departments.forEach(dept => {
            const deptClinics = clinics.filter(c => c.department === dept);
            const deptClinicIds = deptClinics.map(c => c.id);
            const deptAppointments = appointments.filter(a => deptClinicIds.includes(a.clinic_id));

            if (deptAppointments.length > 0) {
                const count = deptAppointments.length;
                const avgInterval = analyticsUtils.calculateAverageInterval(deptAppointments);
                const trend = analyticsUtils.determineTrend(deptAppointments);
                const analysis = analyticsUtils.generateTrendAnalysis(trend, count, avgInterval, lang);

                trends.push({
                    department: dept,
                    count: count,
                    avgInterval: avgInterval,
                    trend: trend,
                    analysis: analysis
                });
            }
        });

        const stats = {
            totalClinics: clinics.length,
            totalAppointments: appointments.length,
            totalMemos: memos.length
        };

        const chartData = analyticsUtils.prepareChartData(appointments, clinics);

        return {
            stats,
            trends,
            chartData
        };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        analyticsUtils
    };
}
