// Clinic Note - 完全版同期ユーティリティ
// 全端末間でのリアルタイム同期を実現

class ClinicNoteSync {
    constructor() {
        this.db = null;
        this.userId = null;
        this.syncHandlers = [];
        this.isOnline = navigator.onLine;
        this.syncInterval = null;
        this.changeListener = null;
    }

    // 初期化
    async init(userId) {
        this.userId = userId;
        try {
            this.db = new PouchDB(`clinic-note-${userId}`);
            console.log('PouchDB initialized for user:', userId);
            
            // 変更監視
            this.changeListener = this.db.changes({
                since: 'now',
                live: true,
                include_docs: true
            }).on('change', (change) => {
                console.log('Local change detected:', change);
                this.notifyHandlers(change);
            }).on('error', (err) => {
                console.error('Change listener error:', err);
            });
            
            // ネットワーク状態監視
            window.addEventListener('online', () => {
                this.isOnline = true;
                console.log('Network: Online');
                this.syncNow();
            });
            
            window.addEventListener('offline', () => {
                this.isOnline = false;
                console.log('Network: Offline');
            });
            
            // 定期同期開始
            this.startPeriodicSync();
            
            return true;
        } catch (err) {
            console.error('PouchDB init error:', err);
            return false;
        }
    }

    // 変更通知ハンドラー登録
    onSync(handler) {
        this.syncHandlers.push(handler);
    }

    // ハンドラーに通知
    notifyHandlers(change) {
        this.syncHandlers.forEach(handler => {
            try {
                handler(change);
            } catch (err) {
                console.error('Handler error:', err);
            }
        });
    }

    // データ保存
    async save(type, data) {
        if (!this.db) {
            console.error('DB not initialized');
            return null;
        }
        
        try {
            const docId = `${type}_${data.id || Date.now()}`;
            const doc = {
                _id: docId,
                type: type,
                userId: this.userId,
                data: data,
                timestamp: new Date().toISOString(),
                synced: false
            };
            
            // 既存ドキュメントの確認
            try {
                const existing = await this.db.get(docId);
                doc._rev = existing._rev;
            } catch (err) {
                // 新規ドキュメント
            }
            
            const result = await this.db.put(doc);
            console.log('Saved to local DB:', result);
            
            // オンラインなら即座にサーバー同期
            if (this.isOnline) {
                await this.syncToServer(doc);
            }
            
            return result;
        } catch (err) {
            console.error('Save error:', err);
            return null;
        }
    }

    // データ取得
    async get(type, id) {
        if (!this.db) return null;
        
        try {
            const docId = `${type}_${id}`;
            const doc = await this.db.get(docId);
            return doc.data;
        } catch (err) {
            console.error('Get error:', err);
            return null;
        }
    }

    // タイプ別全データ取得
    async getAll(type) {
        if (!this.db) return [];
        
        try {
            const result = await this.db.allDocs({
                include_docs: true,
                startkey: `${type}_`,
                endkey: `${type}_\ufff0`
            });
            
            return result.rows.map(row => row.doc.data);
        } catch (err) {
            console.error('GetAll error:', err);
            return [];
        }
    }

    // データ削除
    async delete(type, id) {
        if (!this.db) return false;
        
        try {
            const docId = `${type}_${id}`;
            const doc = await this.db.get(docId);
            await this.db.remove(doc);
            console.log('Deleted from local DB:', docId);
            
            // サーバーからも削除
            if (this.isOnline) {
                await this.deleteFromServer(type, id);
            }
            
            return true;
        } catch (err) {
            console.error('Delete error:', err);
            return false;
        }
    }

    // サーバーとの同期
    async syncToServer(doc) {
        try {
            const API_URL = 'https://clinic-note-api.onrender.com';
            const authToken = localStorage.getItem('authToken');
            const basicAuthToken = localStorage.getItem('basicAuthToken');
            
            if (!authToken || !basicAuthToken) {
                console.log('No auth tokens, skipping server sync');
                return;
            }
            
            // ドキュメントタイプに応じてAPIエンドポイントを選択
            let endpoint = '';
            let method = 'POST';
            
            if (doc.type === 'clinic') {
                endpoint = '/api/clinics';
            } else if (doc.type === 'appointment') {
                endpoint = '/api/appointments';
            } else if (doc.type === 'memo') {
                endpoint = '/api/appointments/memos';
            } else if (doc.type === 'doctor_memo') {
                endpoint = '/api/appointments/doctor-memos';
            } else {
                console.log('Unknown doc type, skipping server sync');
                return;
            }
            
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-Basic-Auth': basicAuthToken
                },
                body: JSON.stringify(doc.data)
            });
            
            if (response.ok) {
                // 同期成功フラグを更新
                doc.synced = true;
                await this.db.put(doc);
                console.log('Synced to server:', doc._id);
            } else {
                console.error('Server sync failed:', response.status);
            }
        } catch (err) {
            console.error('Sync to server error:', err);
        }
    }

    // サーバーからデータ取得
    async syncFromServer(type) {
        try {
            const API_URL = 'https://clinic-note-api.onrender.com';
            const authToken = localStorage.getItem('authToken');
            const basicAuthToken = localStorage.getItem('basicAuthToken');
            
            if (!authToken || !basicAuthToken) {
                console.log('No auth tokens, skipping server fetch');
                return [];
            }
            
            let endpoint = '';
            
            if (type === 'clinic') {
                endpoint = '/api/clinics';
            } else if (type === 'appointment') {
                endpoint = '/api/appointments';
            } else if (type === 'memo') {
                endpoint = '/api/appointments/memos';
            } else if (type === 'doctor_memo') {
                endpoint = '/api/appointments/doctor-memos';
            } else {
                return [];
            }
            
            const response = await fetch(`${API_URL}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Basic-Auth': basicAuthToken
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // ローカルDBに保存
                for (const item of data) {
                    await this.save(type, item);
                }
                
                console.log(`Synced ${data.length} items from server:`, type);
                return data;
            } else {
                console.error('Server fetch failed:', response.status);
                return [];
            }
        } catch (err) {
            console.error('Sync from server error:', err);
            return [];
        }
    }

    // サーバーから削除
    async deleteFromServer(type, id) {
        try {
            const API_URL = 'https://clinic-note-api.onrender.com';
            const authToken = localStorage.getItem('authToken');
            const basicAuthToken = localStorage.getItem('basicAuthToken');
            
            let endpoint = '';
            
            if (type === 'clinic') {
                endpoint = `/api/clinics/${id}`;
            } else if (type === 'appointment') {
                endpoint = `/api/appointments/${id}`;
            } else if (type === 'memo') {
                endpoint = `/api/appointments/memos/${id}`;
            } else if (type === 'doctor_memo') {
                endpoint = `/api/appointments/doctor-memos/${id}`;
            } else {
                return;
            }
            
            await fetch(`${API_URL}${endpoint}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Basic-Auth': basicAuthToken
                }
            });
            
            console.log('Deleted from server:', type, id);
        } catch (err) {
            console.error('Delete from server error:', err);
        }
    }

    // 即座に同期
    async syncNow() {
        if (!this.isOnline) {
            console.log('Offline, skipping sync');
            return;
        }
        
        console.log('Starting full sync...');
        
        try {
            // 全タイプのデータをサーバーから取得
            await this.syncFromServer('clinic');
            await this.syncFromServer('appointment');
            await this.syncFromServer('memo');
            await this.syncFromServer('doctor_memo');
            
            // 未同期のローカルデータをサーバーに送信
            const unsyncedDocs = await this.db.allDocs({
                include_docs: true
            });
            
            for (const row of unsyncedDocs.rows) {
                const doc = row.doc;
                if (!doc.synced && doc.type) {
                    await this.syncToServer(doc);
                }
            }
            
            console.log('Full sync completed');
            this.notifyHandlers({ type: 'sync_complete' });
        } catch (err) {
            console.error('Sync error:', err);
        }
    }

    // 定期同期開始
    startPeriodicSync() {
        // 既存のintervalをクリア
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // 30秒ごとに同期
        this.syncInterval = setInterval(async () => {
            if (this.isOnline) {
                await this.syncNow();
            }
        }, 30000);
        
        console.log('Periodic sync started');
    }

    // 定期同期停止
    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('Periodic sync stopped');
        }
    }

    // クリーンアップ
    destroy() {
        this.stopPeriodicSync();
        
        if (this.changeListener) {
            this.changeListener.cancel();
        }
        
        this.syncHandlers = [];
        console.log('ClinicNoteSync destroyed');
    }
}

// グローバルインスタンス
window.clinicNoteSync = new ClinicNoteSync();

// 自動初期化
document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    if (userId) {
        window.clinicNoteSync.init(userId);
    }
});
