/**
 * JWT Configuration
 *
 * Handles token expiration and signing options
 */

require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  options: {
    issuer: 'satsflow-api',
    audience: 'satsflow-mobile-app'
  }
};
