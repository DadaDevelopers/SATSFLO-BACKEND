'use strict';

const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
const { getPoolConfig } = require('../src/config/pgConfig');

async function main() {
  const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
  const pool = new Pool(getPoolConfig());

  try {
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter((file) => file.endsWith('.js'))
      .sort();

    const existsResult = await pool.query(
      "SELECT to_regclass('public.pgmigrations') AS table_name"
    );

    const hasMigrationsTable = Boolean(existsResult.rows[0]?.table_name);
    const appliedRows = hasMigrationsTable
      ? (await pool.query('SELECT name, run_on FROM pgmigrations ORDER BY run_on ASC')).rows
      : [];

    const appliedNames = new Set(appliedRows.map((row) => `${row.name}.js`));
    const pending = migrationFiles.filter((file) => !appliedNames.has(file));

    console.log('MIGRATIONS_TABLE', hasMigrationsTable ? 'present' : 'missing');
    console.log('APPLIED_COUNT', appliedRows.length);
    console.log('PENDING_COUNT', pending.length);
    console.log('APPLIED', appliedRows.length ? appliedRows.map((row) => row.name).join(', ') : 'none');
    console.log('PENDING', pending.length ? pending.join(', ') : 'none');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('MIGRATION_STATUS_FAILED', error.message);
  process.exit(1);
});