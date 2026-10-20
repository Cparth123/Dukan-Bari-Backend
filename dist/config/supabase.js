"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("./env");
// Public/Anon client for token validation & standard user operations
exports.supabase = (0, supabase_js_1.createClient)(env_1.config.supabase.url, env_1.config.supabase.anonKey);
// Admin Service Role client for system operations, bypassing RLS where required (e.g. background push jobs)
exports.supabaseAdmin = (0, supabase_js_1.createClient)(env_1.config.supabase.url, env_1.config.supabase.serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
