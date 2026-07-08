'use strict';
const { Pool } = require('pg');
const { getPoolConfig } = require('./pgConfig');

const pool = new Pool(getPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
  process.exit(-1);
});

module.exports = pool;
