// Clinic Note - Main Application JavaScript
// API Configuration
const API_URL = 'https://clinic-note-api.onrender.com';

// IndexedDB Configuration
let db;
const DB_NAME = 'ClinicNoteDB';
const DB_VERSION = 1;

// Initialize IndexedDB
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('IndexedDB initialized successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;

            // Create object stores
            if (!db.objectStoreNames.contains('clinics')) {
                const clinicStore = db.createObjectStore('clinics', { keyPath: 'id', autoIncrement: true });
                clinicStore.createIndex('user_id', 'user_id', { unique: false });
            }

            if (!db.objectStoreNames.contains('appointments')) {
                const appointmentStore = db.createObjectStore('appointments', { keyPath: 'id', autoIncrement: true });
                appointmentStore.createIndex('clinic_id', 'clinic_id', { unique: false });
                appointmentStore.createIndex('user_id', 'user_id', { unique: false });
            }

            if (!db.objectStoreNames.contains('memos')) {
                const memoStore = db.createObjectStore('memos', { keyPath: 'id', autoIncrement: true });
                memoStore.createIndex('clinic_id', 'clinic_id', { unique: false });
                memoStore.createIndex('user_id', 'user_id', { unique: false });
                memoStore.createIndex('memo_date', 'memo_date', { unique: false });
            }

            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }

            console.log('IndexedDB schema created');
        };
    });
}

// PouchDB Configuration for offline sync
let pouchDB;

function initPouchDB() {
    try {
        pouchDB = new PouchDB('clinic-note-local');
        console.log('PouchDB initialized successfully');
        
        // Sync with remote CouchDB if configured
        const remoteCouchDB = localStorage.getItem('remoteCouchDB');
        if (remoteCouchDB) {
            const remoteDB = new PouchDB(remoteCouchDB);
            pouchDB.sync(remoteDB, {
                live: true,
                retry: true
            }).on('change', (info) => {
                console.log('PouchDB sync change:', info);
            }).on('error', (err) => {
                console.error('PouchDB sync error:', err);
            });
        }
    } catch (err) {
        console.error('PouchDB initialization error:', err);
    }
}

// LocalStorage helpers
const storage = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (err) {
            console.error('LocalStorage set error:', err);
            return false;
        }
    },
    get: (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (err) {
            console.error('LocalStorage get error:', err);
            return null;
        }
    },
    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (err) {
            console.error('LocalStorage remove error:', err);
            return false;
        }
    },
    clear: () => {
        try {
            localStorage.clear();
            return true;
        } catch (err) {
            console.error('LocalStorage clear error:', err);
            return false;
        }
    }
};

// API helpers with error handling
const api = {
    get: async (endpoint, options = {}) => {
        try {
            const authToken = storage.get('authToken');
            const basicAuthToken = storage.get('basicAuthToken');
            
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Basic-Auth': basicAuthToken,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('API GET error:', err);
            throw err;
        }
    },
    post: async (endpoint, data, options = {}) => {
        try {
            const authToken = storage.get('authToken');
            const basicAuthToken = storage.get('basicAuthToken');
            
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Basic-Auth': basicAuthToken,
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('API POST error:', err);
            throw err;
        }
    },
    put: async (endpoint, data, options = {}) => {
        try {
            const authToken = storage.get('authToken');
            const basicAuthToken = storage.get('basicAuthToken');
            
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Basic-Auth': basicAuthToken,
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('API PUT error:', err);
            throw err;
        }
    },
    delete: async (endpoint, options = {}) => {
        try {
            const authToken = storage.get('authToken');
            const basicAuthToken = storage.get('basicAuthToken');
            
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Basic-Auth': basicAuthToken,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('API DELETE error:', err);
            throw err;
        }
    }
};

// Offline queue management
const offlineQueue = {
    add: async (operation) => {
        try {
            if (!db) await initIndexedDB();
            
            const transaction = db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            
            await store.add({
                operation,
                timestamp: new Date().toISOString(),
                synced: false
            });
            
            console.log('Operation added to offline queue');
        } catch (err) {
            console.error('Offline queue add error:', err);
        }
    },
    process: async () => {
        try {
            if (!db) await initIndexedDB();
            
            const transaction = db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.getAll();
            
            request.onsuccess = async () => {
                const items = request.result;
                
                for (const item of items) {
                    if (!item.synced) {
                        try {
                            const { method, endpoint, data } = item.operation;
                            
                            if (method === 'POST') {
                                await api.post(endpoint, data);
                            } else if (method === 'PUT') {
                                await api.put(endpoint, data);
                            } else if (method === 'DELETE') {
                                await api.delete(endpoint);
                            }
                            
                            // Mark as synced
                            item.synced = true;
                            const updateTransaction = db.transaction(['syncQueue'], 'readwrite');
                            const updateStore = updateTransaction.objectStore('syncQueue');
                            updateStore.put(item);
                            
                            console.log('Offline operation synced:', item.operation);
                        } catch (err) {
                            console.error('Failed to sync operation:', err);
                        }
                    }
                }
            };
        } catch (err) {
            console.error('Offline queue process error:', err);
        }
    }
};

// Network status monitoring
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
    isOnline = true;
    console.log('Network status: Online');
    offlineQueue.process();
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('Network status: Offline');
});

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initIndexedDB();
        initPouchDB();
        console.log('Clinic Note app initialized successfully');
    } catch (err) {
        console.error('App initialization error:', err);
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_URL,
        storage,
        api,
        offlineQueue,
        initIndexedDB,
        initPouchDB
    };
}
