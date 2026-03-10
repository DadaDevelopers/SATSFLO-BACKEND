/**
 * Health Service
 *
 * Handles symptoms and mood tracking with encryption
 */

const { pool } = require('../config/database');
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

    const result = await pool.query(
      `INSERT INTO symptoms
         (user_id, date, symptom, category, severity, time_of_day, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        userId, date, symptom,
        category || SYMPTOM_CATEGORIES.PHYSICAL,
        severity || 2,
        timeOfDay,
        notes ? Encryption.encrypt(notes) : null
      ]
    );

    logger.debug('Symptom logged', { userId, symptom, date });
    return this.formatSymptom(result.rows[0]);
  }

  /**
   * Log multiple symptoms at once
   */
  async logMultipleSymptoms(userId, date, symptoms) {
    const results = await Promise.all(
      symptoms.map(s =>
        pool.query(
          `INSERT INTO symptoms
             (user_id, date, symptom, category, severity, time_of_day, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING *`,
          [
            userId, date, s.symptom,
            s.category || SYMPTOM_CATEGORIES.PHYSICAL,
            s.severity || 2,
            s.timeOfDay,
            s.notes ? Encryption.encrypt(s.notes) : null
          ]
        )
      )
    );

    return results.map(r => this.formatSymptom(r.rows[0]));
  }

  /**
   * Get symptoms with filters
   */
  async getSymptoms(userId, { page = 1, limit = 20, startDate, endDate, category, symptom }) {
    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1'];
    const values = [userId];

    if (startDate) { values.push(startDate); conditions.push(`date >= $${values.length}`); }
    if (endDate) { values.push(endDate); conditions.push(`date <= $${values.length}`); }
    if (category) { values.push(category); conditions.push(`category = $${values.length}`); }
    if (symptom) { values.push(symptom); conditions.push(`symptom = $${values.length}`); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM symptoms ${whereClause}`,
      values
    );

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT * FROM symptoms ${whereClause}
       ORDER BY date DESC, created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );

    return {
      symptoms: result.rows.map(s => this.formatSymptom(s)),
      pagination: { page, limit, total: parseInt(countResult.rows[0].count) }
    };
  }

  /**
   * Get symptoms for a specific date
   */
  async getSymptomsByDate(userId, date) {
    const result = await pool.query(
      `SELECT * FROM symptoms WHERE user_id = $1 AND date = $2 ORDER BY created_at ASC`,
      [userId, date]
    );
    return result.rows.map(s => this.formatSymptom(s));
  }

  /**
   * Update a symptom
   */
  async updateSymptom(userId, symptomId, updates) {
    const allowedFields = ['severity', 'notes', 'time_of_day'];
    const setClauses = [`updated_at = NOW()`];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        if (snakeKey === 'notes') {
          values.push(value ? Encryption.encrypt(value) : null);
        } else {
          values.push(value);
        }
        setClauses.push(`${snakeKey} = $${values.length}`);
      }
    }

    values.push(symptomId, userId);

    const result = await pool.query(
      `UPDATE symptoms SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING *`,
      values
    );

    return this.formatSymptom(result.rows[0]);
  }

  /**
   * Delete a symptom
   */
  async deleteSymptom(userId, symptomId) {
    await pool.query(
      'DELETE FROM symptoms WHERE id = $1 AND user_id = $2',
      [symptomId, userId]
    );
    return { message: 'Symptom deleted successfully' };
  }

  // ==================== MOODS ====================

  /**
   * Log a mood
   */
  async logMood(userId, data) {
    const { date, mood, intensity, notes, triggers } = data;

    const result = await pool.query(
      `INSERT INTO moods (user_id, date, mood, intensity, notes, triggers, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        userId, date, mood,
        intensity || 3,
        notes ? Encryption.encrypt(notes) : null,
        triggers ? Encryption.encrypt(JSON.stringify(triggers)) : null
      ]
    );

    logger.debug('Mood logged', { userId, mood, date });
    return this.formatMood(result.rows[0]);
  }

  /**
   * Log multiple moods at once
   */
  async logMultipleMoods(userId, date, moods) {
    const results = await Promise.all(
      moods.map(m =>
        pool.query(
          `INSERT INTO moods (user_id, date, mood, intensity, notes, triggers, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING *`,
          [
            userId, date, m.mood,
            m.intensity || 3,
            m.notes ? Encryption.encrypt(m.notes) : null,
            m.triggers ? Encryption.encrypt(JSON.stringify(m.triggers)) : null
          ]
        )
      )
    );

    return results.map(r => this.formatMood(r.rows[0]));
  }

  /**
   * Get moods with filters
   */
  async getMoods(userId, { page = 1, limit = 20, startDate, endDate, mood }) {
    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1'];
    const values = [userId];

    if (startDate) { values.push(startDate); conditions.push(`date >= $${values.length}`); }
    if (endDate) { values.push(endDate); conditions.push(`date <= $${values.length}`); }
    if (mood) { values.push(mood); conditions.push(`mood = $${values.length}`); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM moods ${whereClause}`,
      values
    );

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT * FROM moods ${whereClause}
       ORDER BY date DESC, created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );

    return {
      moods: result.rows.map(m => this.formatMood(m)),
      pagination: { page, limit, total: parseInt(countResult.rows[0].count) }
    };
  }

  /**
   * Get moods for a specific date
   */
  async getMoodsByDate(userId, date) {
    const result = await pool.query(
      'SELECT * FROM moods WHERE user_id = $1 AND date = $2 ORDER BY created_at ASC',
      [userId, date]
    );
    return result.rows.map(m => this.formatMood(m));
  }

  /**
   * Update a mood
   */
  async updateMood(userId, moodId, updates) {
    const allowedFields = ['intensity', 'notes', 'triggers'];
    const setClauses = [`updated_at = NOW()`];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        if (snakeKey === 'notes') {
          values.push(value ? Encryption.encrypt(value) : null);
        } else if (snakeKey === 'triggers') {
          values.push(value ? Encryption.encrypt(JSON.stringify(value)) : null);
        } else {
          values.push(value);
        }
        setClauses.push(`${snakeKey} = $${values.length}`);
      }
    }

    values.push(moodId, userId);

    const result = await pool.query(
      `UPDATE moods SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING *`,
      values
    );

    return this.formatMood(result.rows[0]);
  }

  /**
   * Delete a mood
   */
  async deleteMood(userId, moodId) {
    await pool.query(
      'DELETE FROM moods WHERE id = $1 AND user_id = $2',
      [moodId, userId]
    );
    return { message: 'Mood deleted successfully' };
  }

  // ==================== ANALYTICS ====================

  /**
   * Get symptom analytics
   */
  async getSymptomAnalytics(userId, { startDate, endDate }) {
    const result = await pool.query(
      `SELECT symptom, category, severity, date FROM symptoms
       WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [userId, startDate, endDate]
    );
    const symptoms = result.rows;

    const symptomCounts = {};
    const categoryBreakdown = {};
    const severityBySymptom = {};

    for (const s of symptoms) {
      symptomCounts[s.symptom] = (symptomCounts[s.symptom] || 0) + 1;
      categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1;

      if (!severityBySymptom[s.symptom]) severityBySymptom[s.symptom] = [];
      severityBySymptom[s.symptom].push(s.severity);
    }

    const avgSeverity = {};
    for (const [symptom, severities] of Object.entries(severityBySymptom)) {
      avgSeverity[symptom] =
        Math.round((severities.reduce((a, b) => a + b, 0) / severities.length) * 10) / 10;
    }

    const topSymptoms = Object.entries(symptomCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([symptom, count]) => ({ symptom, count, avgSeverity: avgSeverity[symptom] }));

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
    const result = await pool.query(
      `SELECT mood, intensity, date FROM moods
       WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [userId, startDate, endDate]
    );
    const moods = result.rows;

    const moodCounts = {};
    const intensityByMood = {};

    for (const m of moods) {
      moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
      if (!intensityByMood[m.mood]) intensityByMood[m.mood] = [];
      intensityByMood[m.mood].push(m.intensity);
    }

    const avgIntensity = {};
    for (const [mood, intensities] of Object.entries(intensityByMood)) {
      avgIntensity[mood] =
        Math.round((intensities.reduce((a, b) => a + b, 0) / intensities.length) * 10) / 10;
    }

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
    const cycleResult = await pool.query(
      `SELECT start_date, end_date, period_end_date FROM cycles
       WHERE id = $1 AND user_id = $2`,
      [cycleId, userId]
    );
    const cycle = cycleResult.rows[0];

    if (!cycle) {
      const error = new Error('Cycle not found');
      error.statusCode = 404;
      throw error;
    }

    const endDate = cycle.end_date || new Date().toISOString().split('T')[0];

    const [symptomsResult, moodsResult] = await Promise.all([
      pool.query(
        `SELECT symptom, category, severity, date FROM symptoms
         WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [userId, cycle.start_date, endDate]
      ),
      pool.query(
        `SELECT mood, intensity, date FROM moods
         WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [userId, cycle.start_date, endDate]
      )
    ]);

    const dailyData = {};
    const startDate = new Date(cycle.start_date);

    for (const s of symptomsResult.rows) {
      const day = Math.ceil((new Date(s.date) - startDate) / (1000 * 60 * 60 * 24)) + 1;
      if (!dailyData[day]) dailyData[day] = { symptoms: [], moods: [] };
      dailyData[day].symptoms.push(s);
    }

    for (const m of moodsResult.rows) {
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
