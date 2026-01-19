// Clinic Note - Database Helper (Frontend)
// This file handles IndexedDB and PouchDB operations

// IndexedDB wrapper
const IndexedDBWrapper = {
    dbName: 'ClinicNoteDB',
    version: 1,
    db: null,

    // Initialize database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB initialization error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('clinics')) {
                    const clinicStore = db.createObjectStore('clinics', { keyPath: 'id', autoIncrement: true });
                    clinicStore.createIndex('user_id', 'user_id', { unique: false });
                }

                if (!db.objectStoreNames.contains('appointments')) {
                    const appointmentStore = db.createObjectStore('appointments', { keyPath: 'id', autoIncrement: true });
                    appointmentStore.createIndex('clinic_id', 'clinic_id', { unique: false });
                    appointmentStore.createIndex('user_id', 'user_id', { unique: false });
                    appointmentStore.createIndex('appointment_date', 'appointment_date', { unique: false });
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
    },

    // Add item to store
    async add(storeName, item) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Get item from store
    async get(storeName, id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Get all items from store
    async getAll(storeName) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Update item in store
    async update(storeName, item) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Delete item from store
    async delete(storeName, id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Clear store
    async clear(storeName) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};

// PouchDB wrapper
const PouchDBWrapper = {
    db: null,
    remoteDB: null,

    // Initialize PouchDB
    async init(remoteCouchDBUrl = null) {
        try {
            this.db = new PouchDB('clinic-note-local');
            console.log('PouchDB initialized successfully');

            if (remoteCouchDBUrl) {
                this.remoteDB = new PouchDB(remoteCouchDBUrl);
                await this.setupSync();
            }

            return this.db;
        } catch (err) {
            console.error('PouchDB initialization error:', err);
            throw err;
        }
    },

    // Setup sync with remote CouchDB
    async setupSync() {
        if (!this.remoteDB) return;

        try {
            this.db.sync(this.remoteDB, {
                live: true,
                retry: true
            }).on('change', (info) => {
                console.log('PouchDB sync change:', info);
            }).on('error', (err) => {
                console.error('PouchDB sync error:', err);
            }).on('complete', (info) => {
                console.log('PouchDB sync complete:', info);
            });
        } catch (err) {
            console.error('PouchDB sync setup error:', err);
        }
    },

    // Add document
    async put(doc) {
        if (!this.db) await this.init();
        return await this.db.put(doc);
    },

    // Get document
    async get(id) {
        if (!this.db) await this.init();
        try {
            return await this.db.get(id);
        } catch (err) {
            if (err.name === 'not_found') {
                return null;
            }
            throw err;
        }
    },

    // Get all documents
    async allDocs(options = {}) {
        if (!this.db) await this.init();
        return await this.db.allDocs({ include_docs: true, ...options });
    },

    // Delete document
    async remove(doc) {
        if (!this.db) await this.init();
        return await this.db.remove(doc);
    },

    // Query documents
    async query(mapFunction, options = {}) {
        if (!this.db) await this.init();
        return await this.db.query(mapFunction, options);
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        IndexedDBWrapper,
        PouchDBWrapper
    };
}
