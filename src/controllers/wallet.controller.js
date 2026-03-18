'use strict';

const { pool } = require('../config/database');
const ApiResponse = require('../utils/response');

const LN_ADDRESS_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;

const walletController = {
  async getLightningAddress(req, res) {
    try {
      const result = await pool.query(
        'SELECT lightning_address FROM users WHERE id = $1',
        [req.user.id]
      );
      return ApiResponse.success(res, { lightning_address: result.rows[0]?.lightning_address || null });
    } catch (err) {
      return ApiResponse.error(res, err.message, 500);
    }
  },

  async updateLightningAddress(req, res) {
    try {
      const { lightning_address } = req.body;
      if (!lightning_address) {
        return ApiResponse.validationError(res, [{ field: 'lightning_address', message: 'lightning_address is required' }]);
      }
      if (!LN_ADDRESS_RE.test(lightning_address.trim())) {
        return ApiResponse.validationError(res, [{ field: 'lightning_address', message: 'Must be a valid lightning address (user@domain.com)' }]);
      }

      const result = await pool.query(
        'UPDATE users SET lightning_address = $1, updated_at = NOW() WHERE id = $2 RETURNING lightning_address',
        [lightning_address.trim(), req.user.id]
      );
      return ApiResponse.success(res, { lightning_address: result.rows[0].lightning_address }, 'Lightning address saved');
    } catch (err) {
      return ApiResponse.error(res, err.message, 500);
    }
  },
};

module.exports = walletController;
