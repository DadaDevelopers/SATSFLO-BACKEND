/**
 * Wallet Routes
 * 
 * Lightning wallet and rewards endpoints
 */

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet/wallet.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { body } = require('express-validator');

router.use(authenticateToken);

/**
 * @route   GET /api/v1/wallets
 * @desc    Get user's wallet and stats
 * @access  Private
 */
router.get('/', walletController.getWallet);

/**
 * @route   PUT /api/v1/wallets/lightning-address
 * @desc    Update Lightning address
 * @access  Private
 */
router.put(
  '/lightning-address',
  [body('lightningAddress').isString().trim().notEmpty()],
  validate,
  walletController.updateLightningAddress
);

/**
 * @route   POST /api/v1/wallets/withdraw
 * @desc    Withdraw sats to Lightning address or invoice
 * @access  Private
 */
router.post(
  '/withdraw',
  [
    body('amountSats').isInt({ min: 10 }).withMessage('Minimum withdrawal is 10 sats'),
    body('destination').isString().trim().notEmpty().withMessage('Lightning address or invoice required'),
    body('type').optional().isIn(['address', 'invoice']).withMessage('Type must be address or invoice')
  ],
  validate,
  walletController.withdraw
);

/**
 * @route   GET /api/v1/wallets/rewards
 * @desc    Get reward history
 * @access  Private
 */
router.get('/rewards', walletController.getRewards);

module.exports = router;
