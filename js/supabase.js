// ============================================
// ALS eCargoWorld — Supabase Client
// ============================================

const SUPABASE_URL = 'https://zijycqosgkycwptofhqs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppanljcW9zZ2t5Y3dwdG9maHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDA4MzQsImV4cCI6MjA5NDMxNjgzNH0.M9au7esVxyt1lruXiZUIueAFw8QZqqEvm6EPLKuDP4k';

// Create Supabase client
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Make available globally
window.supabaseClient = supabase;

export { supabase };
