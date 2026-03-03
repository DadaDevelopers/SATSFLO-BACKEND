/**
 * Wallet Service
 * 
 * Handles Lightning Network wallets and satoshi balance management
 */

const { supabaseAdmin, dbConfig } = require('../config/database');
const logger = require('../utils/logger');

class WalletService {
  /**
   * Create wallet for new user (called during registration)
   */
  async createWallet(userId) {
    const { data: wallet, error } = await supabaseAdmin
      .from(dbConfig.tables.WALLETS)
      .insert({
        user_id: userId,
        balance_sats: 0,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to create wallet', error);
      throw error;
    }

    logger.info('Wallet created', { userId, walletId: wallet.id });
    return this.formatWallet(wallet);
  }

  /**
   * Get user's wallet
   */
  async getWallet(userId) {
    const { data: wallet, error } = await supabaseAdmin
      .from(dbConfig.tables.WALLETS)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !wallet) {
      const err = new Error('Wallet not found');
      err.statusCode = 404;
      throw err;
    }

    return this.formatWallet(wallet);
  }

  /**
   * Update Lightning address
   */
  async updateLightningAddress(userId, lightningAddress) {
    const { data: wallet, error } = await supabaseAdmin
      .from(dbConfig.tables.WALLETS)
      .update({ 
        lightning_address: lightningAddress,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return this.formatWallet(wallet);
  }

  /**
   * Add sats to wallet (internal - called by reward service)
   */
  async addBalance(userId, amountSats, reason) {
    const { data: wallet } = await supabaseAdmin
      .from(dbConfig.tables.WALLETS)
      .select('balance_sats')
      .eq('user_id', userId)
      .single();

    const newBalance = (wallet?.balance_sats || 0) + amountSats;

    const { data: updated, error } = await supabaseAdmin
      .from(dbConfig.tables.WALLETS)
      .update({ 
        balance_sats: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;

    logger.info('Balance updated', { userId, amountSats, reason, newBalance });
    return this.formatWallet(updated);
  }

  /**
   * Withdraw sats via Lightning
   */
  async withdraw(userId, amountSats, destination, destinationType = 'address') {
    const blinkService = require('./blink.service');
    const wallet = await this.getWallet(userId);

    if (wallet.balanceSats < amountSats) {
      const err = new Error('Insufficient balance');
      err.statusCode = 400;
      throw err;
    }

    // Minimum withdrawal (to cover Lightning fees)
    if (amountSats < 10) {
      const err = new Error('Minimum withdrawal is 10 sats');
      err.statusCode = 400;
      throw err;
    }

    try {
      // Send via Blink
      let result;
      if (destinationType === 'address') {
        if (!blinkService.isValidLightningAddress(destination)) {
          const err = new Error('Invalid Lightning address');
          err.statusCode = 400;
          throw err;
        }
        result = await blinkService.sendToLightningAddress(destination, amountSats, 'Satsflow withdrawal');
      } else {
        result = await blinkService.payInvoice(destination, 'Satsflow withdrawal');
      }

      // Deduct from user balance
      const newBalance = wallet.balanceSats - amountSats;
      const { data: updated, error } = await supabaseAdmin
        .from(dbConfig.tables.WALLETS)
        .update({ 
          balance_sats: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) throw error;

      logger.info('Withdrawal completed', { userId, amountSats, destination });
      return {
        ...this.formatWallet(updated),
        withdrawalAmount: amountSats,
        status: 'completed',
        destination
      };
    } catch (error) {
      logger.error('Withdrawal failed', { userId, error: error.message });
      throw error;
    }
  }

  formatWallet(wallet) {
    return {
      id: wallet.id,
      balanceSats: wallet.balance_sats,
      lightningAddress: wallet.lightning_address,
      createdAt: wallet.created_at,
      updatedAt: wallet.updated_at
    };
  }
}

module.exports = new WalletService();
