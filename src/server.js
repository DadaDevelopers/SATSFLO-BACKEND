/**
 * Server Entry Point
 *
 * Starts the Express server and handles graceful shutdown
 */

require('dotenv').config();
const app = require('./app');
const { pool } = require('./config/database');
const logger = require('./utils/logger');
const emailService = require('./services/email.service');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

let server;

async function startServer() {
  try {
    // Verify database connection
    await pool.query('SELECT 1');
    logger.info('Database connection established');

    // Initialize email service
    await emailService.initialize();

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`Server started`, {
        port: PORT,
        environment: NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid
      });

      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   SATSFLOW API SERVER                                  ║
║                                                           ║
║   Status:      Running                                    ║
║   Port:        ${PORT}                                        ║
║   Environment: ${NODE_ENV.padEnd(11)}                            ║
║   API Base:    http://localhost:${PORT}/api/v1               ║
║                                                           ║
║   Endpoints:                                              ║
║   • Auth:      /api/v1/auth                               ║
║   • Users:     /api/v1/users                              ║
║   • Cycles:    /api/v1/cycles                             ║
║   • Health:    /api/v1/health                             ║
║                                                           ║
║   Health Check: http://localhost:${PORT}/health              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      }
      throw error;
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      await pool.end();
      logger.info('Database pool closed');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    await pool.end();
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

startServer();
