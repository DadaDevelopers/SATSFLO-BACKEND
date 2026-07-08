/**
 * Configuration Index
 */

const jwt = require('./jwt');
const { pool, dbConfig } = require('./database');

module.exports = {
  jwt,
  pool,
  dbConfig,
};
