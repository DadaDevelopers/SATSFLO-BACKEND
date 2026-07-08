'use strict';

const path = require('path');
const { getClientConfig } = require('../src/config/pgConfig');

const migrationLogger = {
  debug: () => {},
  info: console.log,
  warn: console.warn,
  error: (message) => {
    if (typeof message === 'string' && message.startsWith("Can't determine timestamp for ")) {
      return;
    }

    console.error(message);
  }
};

async function main() {
  const direction = process.argv[2] || 'up';

  if (!['up', 'down'].includes(direction)) {
    throw new Error(`Unsupported migration direction: ${direction}`);
  }

  const argCount = Number.parseInt(process.argv[3] || '', 10);
  const { runner } = await import('node-pg-migrate');

  const migrations = await runner({
    databaseUrl: getClientConfig(),
    dir: path.join(__dirname, '..', 'src', 'database', 'migrations'),
    direction,
    count: Number.isNaN(argCount) ? (direction === 'down' ? 1 : undefined) : argCount,
    migrationsTable: 'pgmigrations',
    schema: 'public',
    createSchema: false,
    createMigrationsSchema: false,
    logger: migrationLogger,
    verbose: false,
    log: console.log
  });

  console.log(
    'MIGRATIONS_RUN',
    migrations.length > 0 ? migrations.map((migration) => migration.name).join(', ') : 'none'
  );
}

main().catch((error) => {
  console.error('MIGRATION_RUN_FAILED', error.message);
  process.exit(1);
});