/**
 * Routes Index
 *
 * Central router configuration
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const cycleRoutes = require('./cycle.routes');
const healthRoutes = require('./health.routes');
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
      health: '/api/v1/health'
    }
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/cycles', cycleRoutes);
router.use('/health', healthRoutes);

module.exports = router;
