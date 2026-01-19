// Clinic Note - Authentication JavaScript
// Authentication helpers
const auth = {
    // Check if user is authenticated
    isAuthenticated: () => {
        const authToken = localStorage.getItem('authToken');
        return authToken !== null && authToken !== '';
    },

    // Check if BASIC auth is passed
    hasBasicAuth: () => {
        const basicAuthToken = localStorage.getItem('basicAuthToken');
        return basicAuthToken !== null && basicAuthToken !== '';
    },

    // Get current user ID
    getUserId: () => {
        return localStorage.getItem('userId');
    },

    // Get auth token
    getAuthToken: () => {
        return localStorage.getItem('authToken');
    },

    // Get BASIC auth token
    getBasicAuthToken: () => {
        return localStorage.getItem('basicAuthToken');
    },

    // Set auth tokens
    setAuthToken: (token) => {
        localStorage.setItem('authToken', token);
    },

    setBasicAuthToken: (username, password) => {
        const token = btoa(`${username}:${password}`);
        localStorage.setItem('basicAuthToken', token);
        return token;
    },

    setUserId: (userId) => {
        localStorage.setItem('userId', userId);
    },

    // Clear auth data
    logout: () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        window.location.href = '/login.html';
    },

    // Verify token with backend
    verifyToken: async () => {
        try {
            const API_URL = 'https://clinic-note-api.onrender.com';
            const authToken = auth.getAuthToken();
            const basicAuthToken = auth.getBasicAuthToken();

            if (!authToken || !basicAuthToken) {
                return false;
            }

            const response = await fetch(`${API_URL}/api/auth/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Basic-Auth': basicAuthToken
                }
            });

            return response.ok;
        } catch (err) {
            console.error('Token verification error:', err);
            return false;
        }
    },

    // Require authentication for protected pages
    requireAuth: async () => {
        if (!auth.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }

        const isValid = await auth.verifyToken();
        if (!isValid) {
            auth.logout();
            return false;
        }

        return true;
    },

    // Require BASIC auth
    requireBasicAuth: () => {
        if (!auth.hasBasicAuth()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }
};

// Auto-redirect if not authenticated (for protected pages)
if (typeof window !== 'undefined') {
    const protectedPages = ['/dashboard.html', '/calendar.html', '/analytics.html'];
    const currentPage = window.location.pathname;

    if (protectedPages.some(page => currentPage.includes(page))) {
        if (!auth.isAuthenticated() || !auth.hasBasicAuth()) {
            window.location.href = '/login.html';
        }
    }
}

// HTMX authentication interceptor
if (typeof htmx !== 'undefined') {
    document.body.addEventListener('htmx:configRequest', (event) => {
        const authToken = auth.getAuthToken();
        const basicAuthToken = auth.getBasicAuthToken();

        if (authToken) {
            event.detail.headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (basicAuthToken) {
            event.detail.headers['X-Basic-Auth'] = basicAuthToken;
        }
    });

    // Handle authentication errors
    document.body.addEventListener('htmx:responseError', (event) => {
        if (event.detail.xhr.status === 401) {
            auth.logout();
        }
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
}
