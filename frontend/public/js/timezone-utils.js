let userTimezone = 'Asia/Tokyo';

function setUserTimezone(timezone) {
    userTimezone = timezone || 'Asia/Tokyo';
    localStorage.setItem('userTimezone', userTimezone);
}

function getUserTimezone() {
    const stored = localStorage.getItem('userTimezone');
    if (stored) {
        userTimezone = stored;
    }
    return userTimezone;
}

function formatDateInTimezone(date, timezone, options = {}) {
    if (!date) return '';
    
    const tz = timezone || getUserTimezone();
    
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        
        if (isNaN(dateObj.getTime())) return '';
        
        const defaultOptions = {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            ...options
        };
        
        return new Intl.DateTimeFormat('ja-JP', defaultOptions).format(dateObj);
    } catch (error) {
        console.error('Format date error:', error);
        return '';
    }
}

function formatDateTimeInTimezone(date, timezone, options = {}) {
    if (!date) return '';
    
    const tz = timezone || getUserTimezone();
    
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        
        if (isNaN(dateObj.getTime())) return '';
        
        const defaultOptions = {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            ...options
        };
        
        return new Intl.DateTimeFormat('ja-JP', defaultOptions).format(dateObj);
    } catch (error) {
        console.error('Format datetime error:', error);
        return '';
    }
}

function convertToLocalDate(date, timezone) {
    if (!date) return null;
    
    const tz = timezone || getUserTimezone();
    
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        
        if (isNaN(dateObj.getTime())) return null;
        
        const options = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-CA', options);
        return formatter.format(dateObj);
    } catch (error) {
        console.error('Convert to local date error:', error);
        return null;
    }
}

function getTodayInTimezone(timezone) {
    const tz = timezone || getUserTimezone();
    
    try {
        const now = new Date();
        const options = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-CA', options);
        return formatter.format(now);
    } catch (error) {
        console.error('Get today in timezone error:', error);
        const now = new Date();
        return now.toISOString().split('T')[0];
    }
}

function getCurrentTimeInTimezone(timezone) {
    const tz = timezone || getUserTimezone();
    
    try {
        const now = new Date();
        const options = { 
            timeZone: tz, 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        };
        return new Intl.DateTimeFormat('ja-JP', options).format(now);
    } catch (error) {
        console.error('Get current time error:', error);
        return '';
    }
}

function getTimezoneOffset(timezone) {
    const tz = timezone || getUserTimezone();
    
    try {
        const now = new Date();
        const tzString = now.toLocaleString('en-US', { timeZone: tz });
        const tzDate = new Date(tzString);
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const offset = (tzDate - utcDate) / (1000 * 60);
        return offset;
    } catch (error) {
        console.error('Get timezone offset error:', error);
        return 0;
    }
}

function parseInputDateTime(dateStr, timeStr, timezone) {
    const tz = timezone || getUserTimezone();
    
    try {
        if (!dateStr) return null;
        
        const dateTimeStr = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00:00`;
        
        const date = new Date(dateTimeStr);
        
        if (isNaN(date.getTime())) return null;
        
        return date.toISOString();
    } catch (error) {
        console.error('Parse input datetime error:', error);
        return null;
    }
}

const TIMEZONE_LIST = [
    { value: 'Asia/Tokyo', label: '日本標準時 (JST)' },
    { value: 'America/New_York', label: '米国東部標準時 (EST/EDT)' },
    { value: 'America/Chicago', label: '米国中部標準時 (CST/CDT)' },
    { value: 'America/Denver', label: '米国山岳部標準時 (MST/MDT)' },
    { value: 'America/Los_Angeles', label: '米国太平洋標準時 (PST/PDT)' },
    { value: 'Europe/London', label: 'グリニッジ標準時 (GMT/BST)' },
    { value: 'Europe/Paris', label: '中央ヨーロッパ標準時 (CET/CEST)' },
    { value: 'Asia/Shanghai', label: '中国標準時 (CST)' },
    { value: 'Asia/Hong_Kong', label: '香港標準時 (HKT)' },
    { value: 'Asia/Singapore', label: 'シンガポール標準時 (SGT)' },
    { value: 'Asia/Seoul', label: '韓国標準時 (KST)' },
    { value: 'Australia/Sydney', label: 'オーストラリア東部標準時 (AEST/AEDT)' },
    { value: 'Pacific/Auckland', label: 'ニュージーランド標準時 (NZST/NZDT)' },
    { value: 'UTC', label: '協定世界時 (UTC)' }
];

function getTimezoneList() {
    return TIMEZONE_LIST;
}
