/**
 * JWT Configuration
 *
 * Handles token expiration and signing options
 */

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true
});

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
