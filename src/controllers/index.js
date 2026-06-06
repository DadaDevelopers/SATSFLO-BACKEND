/**
 * Controllers Index
 *
 * Central export for all controller modules
 */

const authController = require('./auth/auth.controller');
const userController = require('./user/user.controller');
const cycleController = require('./cycle/cycle.controller');
const healthController = require('./health/health.controller');

module.exports = {
  authController,
  userController,
  cycleController,
  healthController,
};
