/**
 * Supabase Client Configuration
 *
 * Provides both admin and public clients for different use cases:
 * - supabaseAdmin: Server-side operations with full access
 * - supabase: Client operations with RLS policies applied
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Check your .env file.');
  process.exit(1);
}

/**
 * Admin client - bypasses RLS policies
 * Use for: user creation, admin operations, background jobs
 */
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Public client - respects RLS policies
 * Use for: user-scoped operations where RLS should apply
 */
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = {
  supabase,
  supabaseAdmin
};
