/**
 * Validators Index
 *
 * Central export for all validation modules
 */

const authValidators = require('./auth.validator');
const userValidators = require('./user.validator');
const cycleValidators = require('./cycle.validator');
const healthValidators = require('./health.validator');

module.exports = {
  ...authValidators,
  ...userValidators,
  ...cycleValidators,
  ...healthValidators
};
