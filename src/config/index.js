/**
 * Configuration Index
 *
 * Central export for all configuration modules
 */

const jwt = require('./jwt');
const { supabase, supabaseAdmin, dbConfig } = require('./database');

module.exports = {
  jwt,
  supabase,
  supabaseAdmin,
  dbConfig
};
