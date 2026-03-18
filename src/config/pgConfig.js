'use strict';

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true
});

function getSslConfig() {
  return process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
}

function getConnectionString() {
  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  try {
    const connectionUrl = new URL(process.env.DATABASE_URL);

    if (process.env.DB_SSL === 'true') {
      connectionUrl.searchParams.delete('sslmode');
    }

    return connectionUrl.toString();
  } catch {
    return process.env.DATABASE_URL;
  }
}

function getClientConfig() {
  const ssl = getSslConfig();

  return process.env.DATABASE_URL
    ? {
        connectionString: getConnectionString(),
        ssl,
        connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10)
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl,
        connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10)
      };
}

function getPoolConfig() {
  return {
    ...getClientConfig(),
    max: 20,
    idleTimeoutMillis: 30000,
  };
}

module.exports = {
  getSslConfig,
  getConnectionString,
  getClientConfig,
  getPoolConfig
};