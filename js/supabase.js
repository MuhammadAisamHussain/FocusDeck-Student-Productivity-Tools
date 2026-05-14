// ============================================
// ALS eCargoWorld — Supabase Client
// ============================================

const SUPABASE_URL = 'https://zijycqosgkycwptofhqs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppanljcW9zZ2t5Y3dwdG9maHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDA4MzQsImV4cCI6MjA5NDMxNjgzNH0.M9au7esVxyt1lruXiZUIueAFw8QZqqEvm6EPLKuDP4k';

// Create Supabase client
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) || {
    // Fallback for development without the Supabase CDN script
    from: () => ({ 
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }), order: () => Promise.resolve({ data: [] }) }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        upsert: () => Promise.resolve({ data: null, error: null })
    }),
    storage: {
        from: () => ({
            upload: () => Promise.resolve({ data: { path: '' }, error: null }),
            getPublicUrl: () => ({ data: { publicUrl: '' } }),
            remove: () => Promise.resolve({ data: null, error: null }),
            list: () => Promise.resolve({ data: [], error: null })
        })
    },
    auth: {
        signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        getUser: () => Promise.resolve({ data: { user: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    }
};

export { supabase };
