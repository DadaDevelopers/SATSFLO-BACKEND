const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = async () => {
  const { pool } = require('../../src/config/database');
  await pool.end();
};
