/**
 * Server Entry Point
 *
 * Starts the Express server and handles graceful shutdown
 */

require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const emailService = require('./services/email.service');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Server instance
let server;

/**
 * Start server
 */
async function startServer() {
  try {
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
║   🌸 SATSFLOW API SERVER                                  ║
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

    // Handle server errors
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

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');

      // Close database connections, etc.
      // await supabase.auth.signOut(); // if needed

      logger.info('Graceful shutdown completed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

// ==================== PROCESS HANDLERS ====================

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Start the server
startServer();
