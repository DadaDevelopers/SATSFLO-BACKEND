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
const lightningRoutes    = require('./lightning.routes');
const walletRoutes       = require('./wallet.routes');
const partnerRoutes      = require('./partner.routes');
const chatRoutes         = require('./chat.routes');
const groupRoutes        = require('./group.routes');
const ApiResponse = require('../utils/response');

const API_VERSION = process.env.API_VERSION || 'v1';
const API_BASE_PATH = `/api/${API_VERSION}`;

/**
 * API Health check
 * GET /api/:version/health
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
 * GET /api/:version
 */
router.get('/', (req, res) => {
  return ApiResponse.success(res, {
    name: 'Satsflow API',
    version: '1.0.0',
    apiVersion: API_VERSION,
    description: 'Period tracking with Bitcoin Lightning rewards',
    documentation: `${API_BASE_PATH}/docs`,
    endpoints: {
      auth: `${API_BASE_PATH}/auth`,
      users: `${API_BASE_PATH}/users`,
      cycles: `${API_BASE_PATH}/cycles`,
      health: `${API_BASE_PATH}/health`,
      cycleProfile: `${API_BASE_PATH}/cycle-profile`,
      logs: `${API_BASE_PATH}/logs`,
      waterSettings: `${API_BASE_PATH}/water-settings`,
      journal: `${API_BASE_PATH}/journal`,
      payments: `${API_BASE_PATH}/payments`,
      lightning: `${API_BASE_PATH}/lightning`,
      wallet: `${API_BASE_PATH}/wallet`,
      partner: `${API_BASE_PATH}/partner`,
      chats: `${API_BASE_PATH}/chats`,
      groups: `${API_BASE_PATH}/groups`,
      threads: `${API_BASE_PATH}/threads`,
      notifications: `${API_BASE_PATH}/notifications`,
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
router.use('/lightning',      lightningRoutes);
router.use('/wallet',         walletRoutes);
router.use('/partner',        partnerRoutes);
router.use('/chats',          chatRoutes);
router.use('/groups',         groupRoutes);
router.use('/',               communityRoutes);   // /threads, /notifications

module.exports = router;
