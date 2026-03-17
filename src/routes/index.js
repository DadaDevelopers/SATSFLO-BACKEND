/**
 * Routes Index
 *
 * Central router configuration
 */

const express = require('express');
const router = express.Router();

const authRoutes         = require('./auth.routes');
const userRoutes         = require('./user.routes');
const cycleRoutes        = require('./cycle.routes');
const healthRoutes       = require('./health.routes');
const cycleProfileRoutes = require('./cycleProfile.routes');
const dayLogsRoutes      = require('./dayLogs.routes');
const waterSettingsRoutes = require('./waterSettings.routes');
const journalRoutes      = require('./journal.routes');
const communityRoutes    = require('./community.routes');
const paymentRoutes      = require('./payment.routes');
const ApiResponse = require('../utils/response');

/**
 * API Health check
 * GET /api/v1/health
 */
router.get('/health', (req, res) => {
  return ApiResponse.success(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

/**
 * API Info
 * GET /api/v1
 */
router.get('/', (req, res) => {
  return ApiResponse.success(res, {
    name: 'Satsflow API',
    version: '1.0.0',
    description: 'Period tracking with Bitcoin Lightning rewards',
    documentation: '/api/v1/docs',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      cycles: '/api/v1/cycles',
      health: '/api/v1/health',
      cycleProfile: '/api/v1/cycle-profile',
      logs: '/api/v1/logs',
      waterSettings: '/api/v1/water-settings',
      journal: '/api/v1/journal',
      payments: '/api/v1/payments',
      threads: '/api/v1/threads',
      notifications: '/api/v1/notifications',
    }
  });
});

// Mount route modules
router.use('/auth',           authRoutes);
router.use('/users',          userRoutes);
router.use('/cycles',         cycleRoutes);
router.use('/health',         healthRoutes);
router.use('/cycle-profile',  cycleProfileRoutes);
router.use('/logs',           dayLogsRoutes);
router.use('/water-settings', waterSettingsRoutes);
router.use('/journal',        journalRoutes);
router.use('/payments',       paymentRoutes);
router.use('/',               communityRoutes);   // /threads, /notifications

module.exports = router;
