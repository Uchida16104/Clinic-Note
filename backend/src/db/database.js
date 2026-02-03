const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initDatabase() {
    try {
        console.log('Verifying database connection...');
        
        const { data, error } = await supabase.from('users').select('count').limit(1);
        
        if (error) {
            console.error('Database connection error:', error);
            throw error;
        }
        
        console.log('Database connection verified successfully');
        return true;
    } catch (err) {
        console.error('Database initialization error:', err);
        throw err;
    }
}

async function query(text, params) {
    const start = Date.now();
    try {
        const result = await executeRawQuery(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: result?.length || 0 });
        return { rows: result || [] };
    } catch (err) {
        console.error('Query error:', { text, error: err.message });
        throw err;
    }
}

async function executeRawQuery(text, params) {
    const { data, error } = await supabase.rpc('execute_sql', {
        query: text,
        params: params || []
    });
    
    if (error) throw error;
    return data;
}

async function transaction(callback) {
    try {
        const result = await callback(supabase);
        return result;
    } catch (err) {
        throw err;
    }
}

async function getClient() {
    return supabase;
}

async function closePool() {
    console.log('Supabase client does not require explicit closing');
}

module.exports = {
    supabase,
    query,
    transaction,
    getClient,
    initDatabase,
    closePool
};
