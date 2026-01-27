/**
 * Health Service
 *
 * Handles symptoms and mood tracking with encryption
 */

const { supabaseAdmin, dbConfig } = require('../config/database');
const Encryption = require('../utils/encryption');
const logger = require('../utils/logger');
const { SYMPTOM_CATEGORIES, MOOD_TYPES } = require('../utils/constants');

class HealthService {
  // ==================== SYMPTOMS ====================

  /**
   * Log a symptom
   */
  async logSymptom(userId, data) {
    const { date, symptom, category, severity, notes, timeOfDay } = data;

    const symptomData = {
      user_id: userId,
      date,
      symptom,
      category: category || SYMPTOM_CATEGORIES.PHYSICAL,
      severity: severity || 2,
      time_of_day: timeOfDay,
      notes: notes ? Encryption.encrypt(notes) : null,
      created_at: new Date().toISOString()
    };

    const { data: result, error } = await supabaseAdmin
      .from(dbConfig.tables.SYMPTOMS)
      .insert(symptomData)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to log symptom', error);
      throw error;
    }

    logger.debug('Symptom logged', { userId, symptom, date });
    return this.formatSymptom(result);
  }

  /**
   * Log multiple symptoms at once
   */
  async logMultipleSymptoms(userId, date, symptoms) {
    const symptomRecords = symptoms.map(s => ({
      user_id: userId,
      date,
      symptom: s.symptom,
      category: s.category || SYMPTOM_CATEGORIES.PHYSICAL,
      severity: s.severity || 2,
      time_of_day: s.timeOfDay,
      notes: s.notes ? Encryption.encrypt(s.notes) : null,
      created_at: new Date().toISOString()
    }));

    const { data: results, error } = await supabaseAdmin
      .from(dbConfig.tables.SYMPTOMS)
      .insert(symptomRecords)
      .select('*');

    if (error) {
      logger.error('Failed to log multiple symptoms', error);
      throw error;
    }

    return results.map(s => this.formatSymptom(s));
  }

  /**
   * Get symptoms with filters
   */
  async getSymptoms(userId, { page = 1, limit = 20, startDate, endDate, category, symptom }) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from(dbConfig.tables.SYMPTOMS)
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    if (category) query = query.eq('category', category);
    if (symptom) query = query.eq('symptom', symptom);

    const { data: symptoms, count, error } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      symptoms: symptoms.map(s => this.formatSymptom(s)),
      pagination: { page, limit, total: count }
    };
  }

  /**
   * Get symptoms for a specific date
   */
  async getSymptomsByDate(userId, date) {
    const { data: symptoms, error } = await supabaseAdmin
      .from(dbConfig.tables.SYMPTOMS)
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return symptoms.map(s => this.formatSymptom(s));
  }

  /**
   * Update a symptom
   */
  async updateSymptom(userId, symptomId, updates) {
    const allowedFields = ['severity', 'notes', 'time_of_day'];
    const sanitizedUpdates = { updated_at: new Date().toISOString() };

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

    const { data: symptom, error } = await supabaseAdmin
      .from(dbConfig.tables.SYMPTOMS)
      .update(sanitizedUpdates)
      .eq('id', symptomId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to update symptom', error);
      throw error;
    }

    return this.formatSymptom(symptom);
  }

  /**
   * Delete a symptom
   */
  async deleteSymptom(userId, symptomId) {
    const { error } = await supabaseAdmin
      .from(dbConfig.tables.SYMPTOMS)
      .delete()
      .eq('id', symptomId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete symptom', error);
      throw error;
    }

    return { message: 'Symptom deleted successfully' };
  }

  // ==================== MOODS ====================

  /**
   * Log a mood
   */
  async logMood(userId, data) {
    const { date, mood, intensity, notes, triggers } = data;

    const moodData = {
      user_id: userId,
      date,
      mood,
      intensity: intensity || 3,
      notes: notes ? Encryption.encrypt(notes) : null,
      triggers: triggers ? Encryption.encrypt(JSON.stringify(triggers)) : null,
      created_at: new Date().toISOString()
    };

    const { data: result, error } = await supabaseAdmin
      .from(dbConfig.tables.MOODS)
      .insert(moodData)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to log mood', error);
      throw error;
    }

    logger.debug('Mood logged', { userId, mood, date });
    return this.formatMood(result);
  }

  /**
   * Log multiple moods at once
   */
  async logMultipleMoods(userId, date, moods) {
    const moodRecords = moods.map(m => ({
      user_id: userId,
      date,
      mood: m.mood,
      intensity: m.intensity || 3,
      notes: m.notes ? Encryption.encrypt(m.notes) : null,
      triggers: m.triggers ? Encryption.encrypt(JSON.stringify(m.triggers)) : null,
      created_at: new Date().toISOString()
    }));

    const { data: results, error } = await supabaseAdmin
      .from(dbConfig.tables.MOODS)
      .insert(moodRecords)
      .select('*');

    if (error) {
      logger.error('Failed to log multiple moods', error);
      throw error;
    }

    return results.map(m => this.formatMood(m));
  }

  /**
   * Get moods with filters
   */
  async getMoods(userId, { page = 1, limit = 20, startDate, endDate, mood }) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from(dbConfig.tables.MOODS)
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    if (mood) query = query.eq('mood', mood);

    const { data: moods, count, error } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      moods: moods.map(m => this.formatMood(m)),
      pagination: { page, limit, total: count }
    };
  }

  /**
   * Get moods for a specific date
   */
  async getMoodsByDate(userId, date) {
    const { data: moods, error } = await supabaseAdmin
      .from(dbConfig.tables.MOODS)
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return moods.map(m => this.formatMood(m));
  }

  /**
   * Update a mood
   */
  async updateMood(userId, moodId, updates) {
    const allowedFields = ['intensity', 'notes', 'triggers'];
    const sanitizedUpdates = { updated_at: new Date().toISOString() };

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        if (snakeKey === 'notes') {
          sanitizedUpdates[snakeKey] = value ? Encryption.encrypt(value) : null;
        } else if (snakeKey === 'triggers') {
          sanitizedUpdates[snakeKey] = value ? Encryption.encrypt(JSON.stringify(value)) : null;
        } else {
          sanitizedUpdates[snakeKey] = value;
        }
      }
    }

    const { data: mood, error } = await supabaseAdmin
      .from(dbConfig.tables.MOODS)
      .update(sanitizedUpdates)
      .eq('id', moodId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to update mood', error);
      throw error;
    }

    return this.formatMood(mood);
  }

  /**
   * Delete a mood
   */
  async deleteMood(userId, moodId) {
    const { error } = await supabaseAdmin
      .from(dbConfig.tables.MOODS)
      .delete()
      .eq('id', moodId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete mood', error);
      throw error;
    }

    return { message: 'Mood deleted successfully' };
  }

  // ==================== ANALYTICS ====================

  /**
   * Get symptom analytics
   */
  async getSymptomAnalytics(userId, { startDate, endDate }) {
    const { data: symptoms, error } = await supabaseAdmin
      .from(dbConfig.tables.SYMPTOMS)
      .select('symptom, category, severity, date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    // Count by symptom
    const symptomCounts = {};
    const categoryBreakdown = {};
    const severityBySymptom = {};

    for (const s of symptoms) {
      // Symptom frequency
      symptomCounts[s.symptom] = (symptomCounts[s.symptom] || 0) + 1;

      // Category breakdown
      categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1;

      // Severity tracking
      if (!severityBySymptom[s.symptom]) {
        severityBySymptom[s.symptom] = [];
      }
      severityBySymptom[s.symptom].push(s.severity);
    }

    // Calculate average severity
    const avgSeverity = {};
    for (const [symptom, severities] of Object.entries(severityBySymptom)) {
      avgSeverity[symptom] = Math.round(
        (severities.reduce((a, b) => a + b, 0) / severities.length) * 10
      ) / 10;
    }

    // Top symptoms
    const topSymptoms = Object.entries(symptomCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([symptom, count]) => ({
        symptom,
        count,
        avgSeverity: avgSeverity[symptom]
      }));

    return {
      totalEntries: symptoms.length,
      topSymptoms,
      categoryBreakdown,
      dateRange: { startDate, endDate }
    };
  }

  /**
   * Get mood analytics
   */
  async getMoodAnalytics(userId, { startDate, endDate }) {
    const { data: moods, error } = await supabaseAdmin
      .from(dbConfig.tables.MOODS)
      .select('mood, intensity, date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    // Count by mood
    const moodCounts = {};
    const intensityByMood = {};

    for (const m of moods) {
      moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;

      if (!intensityByMood[m.mood]) {
        intensityByMood[m.mood] = [];
      }
      intensityByMood[m.mood].push(m.intensity);
    }

    // Calculate average intensity
    const avgIntensity = {};
    for (const [mood, intensities] of Object.entries(intensityByMood)) {
      avgIntensity[mood] = Math.round(
        (intensities.reduce((a, b) => a + b, 0) / intensities.length) * 10
      ) / 10;
    }

    // Mood distribution
    const moodDistribution = Object.entries(moodCounts)
      .map(([mood, count]) => ({
        mood,
        count,
        percentage: Math.round((count / moods.length) * 100),
        avgIntensity: avgIntensity[mood]
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalEntries: moods.length,
      moodDistribution,
      dateRange: { startDate, endDate }
    };
  }

  /**
   * Get combined daily summary for a date
   */
  async getDailySummary(userId, date) {
    const [symptoms, moods] = await Promise.all([
      this.getSymptomsByDate(userId, date),
      this.getMoodsByDate(userId, date)
    ]);

    return {
      date,
      symptoms,
      moods,
      hasSymptomsLogged: symptoms.length > 0,
      hasMoodsLogged: moods.length > 0
    };
  }

  /**
   * Get health trends for cycle correlation
   */
  async getHealthTrends(userId, cycleId) {
    // Get cycle
    const { data: cycle } = await supabaseAdmin
      .from(dbConfig.tables.CYCLES)
      .select('start_date, end_date, period_end_date')
      .eq('id', cycleId)
      .eq('user_id', userId)
      .single();

    if (!cycle) {
      const error = new Error('Cycle not found');
      error.statusCode = 404;
      throw error;
    }

    const endDate = cycle.end_date || new Date().toISOString().split('T')[0];

    // Get symptoms and moods for cycle
    const [{ data: symptoms }, { data: moods }] = await Promise.all([
      supabaseAdmin
        .from(dbConfig.tables.SYMPTOMS)
        .select('symptom, category, severity, date')
        .eq('user_id', userId)
        .gte('date', cycle.start_date)
        .lte('date', endDate),
      supabaseAdmin
        .from(dbConfig.tables.MOODS)
        .select('mood, intensity, date')
        .eq('user_id', userId)
        .gte('date', cycle.start_date)
        .lte('date', endDate)
    ]);

    // Group by cycle day
    const dailyData = {};
    const startDate = new Date(cycle.start_date);

    for (const s of symptoms || []) {
      const day = Math.ceil((new Date(s.date) - startDate) / (1000 * 60 * 60 * 24)) + 1;
      if (!dailyData[day]) dailyData[day] = { symptoms: [], moods: [] };
      dailyData[day].symptoms.push(s);
    }

    for (const m of moods || []) {
      const day = Math.ceil((new Date(m.date) - startDate) / (1000 * 60 * 60 * 24)) + 1;
      if (!dailyData[day]) dailyData[day] = { symptoms: [], moods: [] };
      dailyData[day].moods.push(m);
    }

    return {
      cycleId,
      startDate: cycle.start_date,
      endDate,
      dailyData
    };
  }

  // ==================== FORMATTERS ====================

  formatSymptom(symptom) {
    return {
      id: symptom.id,
      date: symptom.date,
      symptom: symptom.symptom,
      category: symptom.category,
      severity: symptom.severity,
      timeOfDay: symptom.time_of_day,
      notes: symptom.notes ? Encryption.decrypt(symptom.notes) : null,
      createdAt: symptom.created_at
    };
  }

  formatMood(mood) {
    let triggers = null;
    if (mood.triggers) {
      try {
        triggers = JSON.parse(Encryption.decrypt(mood.triggers));
      } catch {
        triggers = null;
      }
    }

    return {
      id: mood.id,
      date: mood.date,
      mood: mood.mood,
      intensity: mood.intensity,
      notes: mood.notes ? Encryption.decrypt(mood.notes) : null,
      triggers,
      createdAt: mood.created_at
    };
  }
}

module.exports = new HealthService();
