/**
 * Rewards Service
 * 
 * Handles satoshi rewards for user activities
 */

const { supabaseAdmin, dbConfig } = require('../config/database');
const walletService = require('./wallet.service');
const logger = require('../utils/logger');

// Reward amounts in satoshis
const REWARD_AMOUNTS = {
  DAILY_LOG: 10,           // Log period/symptoms/mood
  COMPLETE_CYCLE: 50,      // Complete a full cycle
  WEEKLY_STREAK: 25,       // 7 days in a row
  MONTHLY_STREAK: 100,     // 30 days in a row
  FIRST_POST: 20,          // First forum post
  HELPFUL_POST: 15,        // Post gets upvoted
  PROFILE_COMPLETE: 30     // Complete health profile
};

class RewardService {
  /**
   * Award sats for daily logging
   */
  async rewardDailyLog(userId) {
    return this.createReward(userId, REWARD_AMOUNTS.DAILY_LOG, 'daily_log', 'Daily health tracking');
  }

  /**
   * Award sats for completing a cycle
   */
  async rewardCompleteCycle(userId) {
    return this.createReward(userId, REWARD_AMOUNTS.COMPLETE_CYCLE, 'complete_cycle', 'Completed menstrual cycle');
  }

  /**
   * Award sats for streak
   */
  async rewardStreak(userId, days) {
    const amount = days >= 30 ? REWARD_AMOUNTS.MONTHLY_STREAK : REWARD_AMOUNTS.WEEKLY_STREAK;
    const reason = days >= 30 ? 'monthly_streak' : 'weekly_streak';
    return this.createReward(userId, amount, reason, `${days} day tracking streak`);
  }

  /**
   * Award sats for first forum post
   */
  async rewardFirstPost(userId) {
    return this.createReward(userId, REWARD_AMOUNTS.FIRST_POST, 'first_post', 'First community post');
  }

  /**
   * Award sats for helpful post
   */
  async rewardHelpfulPost(userId) {
    return this.createReward(userId, REWARD_AMOUNTS.HELPFUL_POST, 'helpful_post', 'Helpful community contribution');
  }

  /**
   * Create reward and add to wallet
   */
  async createReward(userId, amountSats, reason, description) {
    // Check if reward already exists (prevent duplicates)
    const { data: existing } = await supabaseAdmin
      .from(dbConfig.tables.REWARDS)
      .select('id')
      .eq('user_id', userId)
      .eq('reason', reason)
      .eq('claimed', false)
      .single();

    if (existing) {
      return null; // Already rewarded
    }

    // Create reward record
    const { data: reward, error } = await supabaseAdmin
      .from(dbConfig.tables.REWARDS)
      .insert({
        user_id: userId,
        amount_sats: amountSats,
        reason,
        description,
        claimed: true,
        claimed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to create reward', error);
      throw error;
    }

    // Add to wallet balance
    await walletService.addBalance(userId, amountSats, reason);

    logger.info('Reward granted', { userId, amountSats, reason });
    return this.formatReward(reward);
  }

  /**
   * Get user's reward history
   */
  async getRewards(userId, { page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    const { data: rewards, count, error } = await supabaseAdmin
      .from(dbConfig.tables.REWARDS)
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      rewards: (rewards || []).map(r => this.formatReward(r)),
      pagination: { page, limit, total: count }
    };
  }

  /**
   * Get reward stats
   */
  async getStats(userId) {
    const { data: rewards } = await supabaseAdmin
      .from(dbConfig.tables.REWARDS)
      .select('amount_sats, claimed')
      .eq('user_id', userId);

    const totalEarned = rewards?.reduce((sum, r) => sum + r.amount_sats, 0) || 0;
    const totalClaimed = rewards?.filter(r => r.claimed).reduce((sum, r) => sum + r.amount_sats, 0) || 0;

    return {
      totalEarned,
      totalClaimed,
      pending: totalEarned - totalClaimed,
      rewardCount: rewards?.length || 0
    };
  }

  formatReward(reward) {
    return {
      id: reward.id,
      amountSats: reward.amount_sats,
      reason: reward.reason,
      description: reward.description,
      claimed: reward.claimed,
      claimedAt: reward.claimed_at,
      createdAt: reward.created_at
    };
  }
}

module.exports = new RewardService();
