/**
 * Cycle Service
 *
 * Handles period tracking, cycle management, and predictions
 */

const { supabaseAdmin, dbConfig } = require('../config/database');
const Encryption = require('../utils/encryption');
const logger = require('../utils/logger');
const { CYCLE_PHASES, CYCLE_DEFAULTS } = require('../utils/constants');

class CycleService {
  /**
   * Start a new period (creates new cycle)
   */
  async startPeriod(userId, { date, flowIntensity, notes }) {
    // Check for existing active cycle
    const { data: activeCycle } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .select('id')
      .eq('user_id', userId)
      .is('end_date', null)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    // If active cycle exists, end it first
    if (activeCycle) {
      const previousDay = new Date(date);
      previousDay.setDate(previousDay.getDate() - 1);

      await supabaseAdmin
        .from(dbConfig.tables.CYCLES)
        .update({ end_date: previousDay.toISOString().split('T')[0] })
        .eq('id', activeCycle.id);
    }

    // Create new cycle
    const { data: cycle, error } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .insert({
        user_id: userId,
        start_date: date,
        notes: notes ? Encryption.encrypt(notes) : null,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to start period', error);
      throw error;
    }

    // Log first day entry
    await this.logDailyEntry(userId, {
      date,
      cycleId: cycle.id,
      flowIntensity: flowIntensity || 'medium',
      isFirstDay: true
    });

    // Update health profile with last period date
    await supabaseAdmin
      .from(dbConfig.tables.HEALTH_PROFILES)
      .update({ last_period_date: date })
      .eq('user_id', userId);

    logger.info('Period started', { userId, cycleId: cycle.id });

    return this.formatCycle(cycle);
  }

  /**
   * End current period
   */
  async endPeriod(userId, { date }) {
    // Get current cycle
    const { data: cycle, error: fetchError } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .select('*')
      .eq('user_id', userId)
      .is('end_date', null)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !cycle) {
      const error = new Error('No active period found');
      error.statusCode = 404;
      throw error;
    }

    // Validate end date is after start date
    if (new Date(date) < new Date(cycle.start_date)) {
      const error = new Error('End date cannot be before start date');
      error.statusCode = 400;
      throw error;
    }

    // Calculate period length
    const startDate = new Date(cycle.start_date);
    const endDate = new Date(date);
    const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Update cycle with period end date
    const { data: updatedCycle, error } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .update({
        period_end_date: date,
        period_length: periodLength,
        updated_at: new Date().toISOString()
      })
      .eq('id', cycle.id)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to end period', error);
      throw error;
    }

    // Update average period length
    await this.updateAverages(userId);

    logger.info('Period ended', { userId, cycleId: cycle.id, periodLength });

    return this.formatCycle(updatedCycle);
  }

  /**
   * Log daily entry for cycle
   */
  async logDailyEntry(userId, data) {
    const {
      date,
      cycleId,
      flowIntensity,
      temperature,
      cervicalMucus,
      sexualActivity,
      contraceptionUsed,
      notes,
      isFirstDay = false
    } = data;

    // Get cycle ID if not provided
    let targetCycleId = cycleId;
    if (!targetCycleId) {
      const { data: cycle } = await supabaseAdmin
        .from(dbConfig.tables.CYCLES)
        .select('id')
        .eq('user_id', userId)
        .lte('start_date', date)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();

      targetCycleId = cycle?.id;
    }

    // Check if entry exists for this date
    const { data: existingEntry } = await supabaseAdmin
      .from(dbConfig.tables.CYCLE_LOGS)
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    const entryData = {
      user_id: userId,
      cycle_id: targetCycleId,
      date,
      flow_intensity: flowIntensity,
      temperature,
      cervical_mucus: cervicalMucus,
      sexual_activity: sexualActivity,
      contraception_used: contraceptionUsed,
      notes: notes ? Encryption.encrypt(notes) : null,
      updated_at: new Date().toISOString()
    };

    let result;
    if (existingEntry) {
      // Update existing entry
      const { data, error } = await supabaseAdmin
        .from(dbConfig.tables.CYCLE_LOGS)
        .update(entryData)
        .eq('id', existingEntry.id)
        .select('*')
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new entry
      entryData.created_at = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from(dbConfig.tables.CYCLE_LOGS)
        .insert(entryData)
        .select('*')
        .single();

      if (error) throw error;
      result = data;
    }

    return this.formatCycleLog(result);
  }

  /**
   * Get current cycle status
   */
  async getCurrentCycle(userId) {
    const { data: cycle, error } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !cycle) {
      return null;
    }

    const today = new Date();
    const startDate = new Date(cycle.start_date);
    const dayOfCycle = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Get health profile for averages
    const { data: healthProfile } = await supabaseAdmin
      .from(dbConfig.tables.HEALTH_PROFILES)
      .select('average_cycle_length, average_period_length')
      .eq('user_id', userId)
      .single();

    const avgCycleLength = healthProfile?.average_cycle_length || CYCLE_DEFAULTS.AVERAGE_CYCLE_LENGTH;
    const avgPeriodLength = healthProfile?.average_period_length || CYCLE_DEFAULTS.AVERAGE_PERIOD_LENGTH;

    // Calculate phase
    const phase = this.calculatePhase(dayOfCycle, avgCycleLength, avgPeriodLength);

    // Calculate predictions
    const predictions = this.calculatePredictions(cycle, avgCycleLength, avgPeriodLength);

    return {
      ...this.formatCycle(cycle),
      dayOfCycle,
      phase,
      predictions
    };
  }

  /**
   * Get cycle history
   */
  async getCycles(userId, { page = 1, limit = 20, startDate, endDate }) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('start_date', startDate);
    }
    if (endDate) {
      query = query.lte('start_date', endDate);
    }

    const { data: cycles, count, error } = await query
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      cycles: cycles.map(c => this.formatCycle(c)),
      pagination: {
        page,
        limit,
        total: count
      }
    };
  }

  /**
   * Get cycle by ID
   */
  async getCycleById(userId, cycleId) {
    const { data: cycle, error } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .select('*')
      .eq('id', cycleId)
      .eq('user_id', userId)
      .single();

    if (error || !cycle) {
      const err = new Error('Cycle not found');
      err.statusCode = 404;
      throw err;
    }

    // Get daily logs for this cycle
    const { data: logs } = await supabaseAdmin
      .from(dbConfig.tables.CYCLE_LOGS)
      .select('*')
      .eq('cycle_id', cycleId)
      .order('date', { ascending: true });

    return {
      ...this.formatCycle(cycle),
      logs: (logs || []).map(l => this.formatCycleLog(l))
    };
  }

  /**
   * Update cycle
   */
  async updateCycle(userId, cycleId, updates) {
    const allowedFields = ['start_date', 'end_date', 'period_end_date', 'notes'];
    const sanitizedUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        if (snakeKey === 'notes') {
          sanitizedUpdates[snakeKey] = value ? Encryption.encrypt(value) : null;
        } else {
          sanitizedUpdates[snakeKey] = value;
        }
      }
    }

    sanitizedUpdates.updated_at = new Date().toISOString();

    const { data: cycle, error } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .update(sanitizedUpdates)
      .eq('id', cycleId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to update cycle', error);
      throw error;
    }

    // Recalculate averages
    await this.updateAverages(userId);

    return this.formatCycle(cycle);
  }

  /**
   * Delete cycle
   */
  async deleteCycle(userId, cycleId) {
    // Delete associated logs first
    await supabaseAdmin
      .from(dbConfig.tables.CYCLE_LOGS)
      .delete()
      .eq('cycle_id', cycleId);

    const { error } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .delete()
      .eq('id', cycleId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete cycle', error);
      throw error;
    }

    // Recalculate averages
    await this.updateAverages(userId);

    logger.info('Cycle deleted', { userId, cycleId });
    return { message: 'Cycle deleted successfully' };
  }

  /**
   * Get daily log for a specific date
   */
  async getDailyLog(userId, date) {
    const { data: log, error } = await supabaseAdmin
      .from(dbConfig.tables.CYCLE_LOGS)
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (error || !log) {
      return null;
    }

    return this.formatCycleLog(log);
  }

  /**
   * Get analytics/insights
   */
  async getAnalytics(userId, { startDate, endDate }) {
    // Get cycles in range
    const { data: cycles } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .select('*')
      .eq('user_id', userId)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .order('start_date', { ascending: true });

    if (!cycles || cycles.length === 0) {
      return {
        totalCycles: 0,
        averageCycleLength: null,
        averagePeriodLength: null,
        shortestCycle: null,
        longestCycle: null,
        cycles: []
      };
    }

    // Calculate cycle lengths
    const cycleLengths = [];
    const periodLengths = [];

    for (let i = 0; i < cycles.length - 1; i++) {
      const start = new Date(cycles[i].start_date);
      const nextStart = new Date(cycles[i + 1].start_date);
      const length = Math.ceil((nextStart - start) / (1000 * 60 * 60 * 24));
      if (length >= CYCLE_DEFAULTS.MIN_CYCLE_LENGTH && length <= CYCLE_DEFAULTS.MAX_CYCLE_LENGTH) {
        cycleLengths.push(length);
      }
    }

    for (const cycle of cycles) {
      if (cycle.period_length) {
        periodLengths.push(cycle.period_length);
      }
    }

    const avgCycleLength = cycleLengths.length > 0
      ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
      : null;

    const avgPeriodLength = periodLengths.length > 0
      ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
      : null;

    return {
      totalCycles: cycles.length,
      averageCycleLength: avgCycleLength,
      averagePeriodLength: avgPeriodLength,
      shortestCycle: cycleLengths.length > 0 ? Math.min(...cycleLengths) : null,
      longestCycle: cycleLengths.length > 0 ? Math.max(...cycleLengths) : null,
      cycleVariability: this.calculateVariability(cycleLengths),
      cycles: cycles.map(c => this.formatCycle(c))
    };
  }

  /**
   * Calculate current cycle phase
   */
  calculatePhase(dayOfCycle, avgCycleLength, avgPeriodLength) {
    if (dayOfCycle <= avgPeriodLength) {
      return {
        name: CYCLE_PHASES.MENSTRUAL,
        day: dayOfCycle,
        description: 'Menstrual phase - Period days'
      };
    }

    const ovulationDay = Math.round(avgCycleLength / 2);

    if (dayOfCycle <= ovulationDay - 5) {
      return {
        name: CYCLE_PHASES.FOLLICULAR,
        day: dayOfCycle,
        description: 'Follicular phase - Building up to ovulation'
      };
    }

    if (dayOfCycle <= ovulationDay + 1) {
      return {
        name: CYCLE_PHASES.OVULATION,
        day: dayOfCycle,
        description: 'Ovulation phase - Most fertile window',
        isFertile: true
      };
    }

    return {
      name: CYCLE_PHASES.LUTEAL,
      day: dayOfCycle,
      description: 'Luteal phase - Post-ovulation'
    };
  }

  /**
   * Calculate predictions for next period/ovulation
   */
  calculatePredictions(cycle, avgCycleLength, avgPeriodLength) {
    const startDate = new Date(cycle.start_date);
    const today = new Date();

    // Next period prediction
    const nextPeriodDate = new Date(startDate);
    nextPeriodDate.setDate(nextPeriodDate.getDate() + avgCycleLength);

    const daysUntilPeriod = Math.ceil((nextPeriodDate - today) / (1000 * 60 * 60 * 24));

    // Ovulation prediction (typically 14 days before next period)
    const ovulationDate = new Date(nextPeriodDate);
    ovulationDate.setDate(ovulationDate.getDate() - 14);

    const daysUntilOvulation = Math.ceil((ovulationDate - today) / (1000 * 60 * 60 * 24));

    // Fertile window (5 days before ovulation + ovulation day)
    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(fertileStart.getDate() - 5);
    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(fertileEnd.getDate() + 1);

    return {
      nextPeriod: {
        date: nextPeriodDate.toISOString().split('T')[0],
        daysUntil: daysUntilPeriod
      },
      ovulation: {
        date: ovulationDate.toISOString().split('T')[0],
        daysUntil: daysUntilOvulation
      },
      fertileWindow: {
        start: fertileStart.toISOString().split('T')[0],
        end: fertileEnd.toISOString().split('T')[0]
      }
    };
  }

  /**
   * Update user's average cycle/period length
   */
  async updateAverages(userId) {
    const { data: cycles } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .select('start_date, period_length')
      .eq('user_id', userId)
      .order('start_date', { ascending: true })
      .limit(12); // Last 12 cycles

    if (!cycles || cycles.length < 2) return;

    // Calculate average cycle length
    const cycleLengths = [];
    for (let i = 0; i < cycles.length - 1; i++) {
      const start = new Date(cycles[i].start_date);
      const nextStart = new Date(cycles[i + 1].start_date);
      const length = Math.ceil((nextStart - start) / (1000 * 60 * 60 * 24));
      if (length >= CYCLE_DEFAULTS.MIN_CYCLE_LENGTH && length <= CYCLE_DEFAULTS.MAX_CYCLE_LENGTH) {
        cycleLengths.push(length);
      }
    }

    // Calculate average period length
    const periodLengths = cycles
      .filter(c => c.period_length)
      .map(c => c.period_length);

    const updates = {};
    if (cycleLengths.length > 0) {
      updates.average_cycle_length = Math.round(
        cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length
      );
    }
    if (periodLengths.length > 0) {
      updates.average_period_length = Math.round(
        periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length
      );
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from(dbConfig.tables.HEALTH_PROFILES)
        .update(updates)
        .eq('user_id', userId);
    }
  }

  /**
   * Calculate cycle variability
   */
  calculateVariability(lengths) {
    if (lengths.length < 2) return null;

    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const squaredDiffs = lengths.map(l => Math.pow(l - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length;

    return Math.round(Math.sqrt(avgSquaredDiff) * 10) / 10;
  }

  /**
   * Format cycle for response
   */
  formatCycle(cycle) {
    return {
      id: cycle.id,
      startDate: cycle.start_date,
      endDate: cycle.end_date,
      periodEndDate: cycle.period_end_date,
      periodLength: cycle.period_length,
      cycleLength: cycle.cycle_length,
      notes: cycle.notes ? Encryption.decrypt(cycle.notes) : null,
      createdAt: cycle.created_at,
      updatedAt: cycle.updated_at
    };
  }

  /**
   * Format cycle log for response
   */
  formatCycleLog(log) {
    return {
      id: log.id,
      date: log.date,
      flowIntensity: log.flow_intensity,
      temperature: log.temperature,
      cervicalMucus: log.cervical_mucus,
      sexualActivity: log.sexual_activity,
      contraceptionUsed: log.contraception_used,
      notes: log.notes ? Encryption.decrypt(log.notes) : null,
      createdAt: log.created_at
    };
  }
}

module.exports = new CycleService();
