/**
 * Wallet Controller
 * 
 * Handles Lightning wallet endpoints
 */

const walletService = require('../../services/wallet.service');
const rewardService = require('../../services/reward.service');
const ApiResponse = require('../../utils/response');

/**
 * Get user's wallet
 * GET /api/v1/wallets
 */
const getWallet = async (req, res, next) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    const stats = await rewardService.getStats(req.user.id);

    return ApiResponse.success(res, { wallet, stats });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Lightning address
 * PUT /api/v1/wallets/lightning-address
 */
const updateLightningAddress = async (req, res, next) => {
  try {
    const { lightningAddress } = req.body;
    const wallet = await walletService.updateLightningAddress(req.user.id, lightningAddress);

    return ApiResponse.success(res, wallet, 'Lightning address updated');
  } catch (error) {
    next(error);
  }
};

/**
 * Withdraw sats
 * POST /api/v1/wallets/withdraw
 */
const withdraw = async (req, res, next) => {
  try {
    const { amountSats, destination, type } = req.body;
    const result = await walletService.withdraw(
      req.user.id, 
      amountSats, 
      destination,
      type || 'address'
    );

    return ApiResponse.success(res, result, 'Withdrawal completed');
  } catch (error) {
    next(error);
  }
};

/**
 * Get reward history
 * GET /api/v1/wallets/rewards
 */
const getRewards = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await rewardService.getRewards(req.user.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    return ApiResponse.paginated(res, result.rewards, result.pagination);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWallet,
  updateLightningAddress,
  withdraw,
  getRewards
};
