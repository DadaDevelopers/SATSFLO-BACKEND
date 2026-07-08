'use strict';

const { pool } = require('../config/database');

class CommunityService {
  // ──────────────────────────────────────────────
  // THREADS
  // ──────────────────────────────────────────────

  /**
   * List threads with comment/like counts and whether the caller liked them.
   */
  async getThreads({ tab = 'recent', search, userId, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const values = [];
    let whereClause = '';

    if (search) {
      values.push(`%${search}%`);
      whereClause = `WHERE t.content ILIKE $${values.length}`;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM threads t ${whereClause}`, values);

    values.push(limit, offset);

    const result = await pool.query(
      `SELECT
         t.id, t.content, t.image_url, t.created_at, t.updated_at,
         u.id   AS user_id,
         u.name AS user_name,
         u.avatar_url AS user_avatar_url,
         (SELECT COUNT(*) FROM thread_comments WHERE thread_id = t.id) AS comment_count,
         (SELECT COUNT(*) FROM thread_likes    WHERE thread_id = t.id) AS like_count
       FROM threads t
       JOIN users u ON t.user_id = u.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    let likedSet = new Set();
    if (userId && result.rows.length > 0) {
      const threadIds = result.rows.map((t) => t.id);
      const likesResult = await pool.query(
        'SELECT thread_id FROM thread_likes WHERE user_id = $1 AND thread_id = ANY($2)',
        [userId, threadIds]
      );
      likedSet = new Set(likesResult.rows.map((l) => l.thread_id));
    }

    let threads = result.rows.map((t) => ({
      id: t.id,
      content: t.content,
      image_url: t.image_url,
      created_at: t.created_at,
      updated_at: t.updated_at,
      user: { id: t.user_id, name: t.user_name, avatar_url: t.user_avatar_url },
      comment_count: parseInt(t.comment_count),
      like_count: parseInt(t.like_count),
      is_liked_by_me: likedSet.has(t.id),
    }));

    if (tab === 'popular') {
      threads.sort((a, b) => b.like_count - a.like_count);
    }

    return { threads, total: parseInt(countResult.rows[0].count), page, limit };
  }

  /**
   * Create a new thread.
   */
  async createThread(userId, { content, image_url }) {
    const values = [userId, content];
    let cols = 'user_id, content';
    let placeholders = '$1, $2';

    if (image_url) {
      values.push(image_url);
      cols += ', image_url';
      placeholders += `, $${values.length}`;
    }

    const result = await pool.query(
      `INSERT INTO threads (${cols}) VALUES (${placeholders})
       RETURNING id, content, image_url, created_at, user_id`,
      values
    );
    const thread = result.rows[0];

    const userResult = await pool.query('SELECT id, name, avatar_url FROM users WHERE id = $1', [
      userId,
    ]);

    return { ...thread, user: userResult.rows[0] };
  }

  // ──────────────────────────────────────────────
  // COMMENTS
  // ──────────────────────────────────────────────

  /**
   * List comments for a thread.
   */
  async getComments(threadId) {
    const result = await pool.query(
      `SELECT
         tc.id, tc.content, tc.created_at,
         u.id         AS user_id,
         u.name       AS user_name,
         u.avatar_url AS user_avatar_url
       FROM thread_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.thread_id = $1
       ORDER BY tc.created_at ASC`,
      [threadId]
    );

    return result.rows.map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user: { id: c.user_id, name: c.user_name, avatar_url: c.user_avatar_url },
    }));
  }

  /**
   * Add a comment to a thread.
   */
  async addComment(userId, threadId, content) {
    const threadResult = await pool.query('SELECT id FROM threads WHERE id = $1', [threadId]);
    if (!threadResult.rows[0]) {
      const err = new Error('Thread not found');
      err.statusCode = 404;
      throw err;
    }

    const result = await pool.query(
      `INSERT INTO thread_comments (thread_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at`,
      [threadId, userId, content]
    );
    const comment = result.rows[0];

    const userResult = await pool.query('SELECT id, name, avatar_url FROM users WHERE id = $1', [
      userId,
    ]);

    return { ...comment, user: userResult.rows[0] };
  }

  /**
   * Get a single thread by ID with comment list and is_liked_by_me.
   */
  async getThread(threadId, userId = null) {
    const result = await pool.query(
      `SELECT
         t.id, t.content, t.image_url, t.created_at, t.updated_at,
         u.id         AS user_id,
         u.name       AS user_name,
         u.avatar_url AS user_avatar_url,
         (SELECT COUNT(*) FROM thread_comments WHERE thread_id = t.id) AS comment_count,
         (SELECT COUNT(*) FROM thread_likes    WHERE thread_id = t.id) AS like_count
       FROM threads t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [threadId]
    );
    const t = result.rows[0];
    if (!t) {
      const err = new Error('Thread not found');
      err.statusCode = 404;
      throw err;
    }

    let is_liked_by_me = false;
    if (userId) {
      const likeResult = await pool.query(
        'SELECT 1 FROM thread_likes WHERE thread_id = $1 AND user_id = $2',
        [threadId, userId]
      );
      is_liked_by_me = likeResult.rows.length > 0;
    }

    const comments = await this.getComments(threadId);

    return {
      id: t.id,
      content: t.content,
      image_url: t.image_url,
      created_at: t.created_at,
      updated_at: t.updated_at,
      user: { id: t.user_id, name: t.user_name, avatar_url: t.user_avatar_url },
      comment_count: parseInt(t.comment_count),
      like_count: parseInt(t.like_count),
      is_liked_by_me,
      comments,
    };
  }

  /**
   * Update a thread (only by owner).
   */
  async updateThread(userId, threadId, { content, image_url }) {
    const existing = await pool.query('SELECT user_id FROM threads WHERE id = $1', [threadId]);
    if (!existing.rows[0]) {
      const err = new Error('Thread not found');
      err.statusCode = 404;
      throw err;
    }
    if (existing.rows[0].user_id !== userId) {
      const err = new Error('Not authorised to edit this thread');
      err.statusCode = 403;
      throw err;
    }

    const fields = [];
    const values = [];
    if (content !== undefined) {
      values.push(content);
      fields.push(`content = $${values.length}`);
    }
    if (image_url !== undefined) {
      values.push(image_url);
      fields.push(`image_url = $${values.length}`);
    }

    if (fields.length === 0) {
      const err = new Error('No fields to update');
      err.statusCode = 400;
      throw err;
    }

    values.push(threadId);
    const result = await pool.query(
      `UPDATE threads SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING id, content, image_url, updated_at`,
      values
    );
    return result.rows[0];
  }

  /**
   * Delete a thread (only by owner or admin).
   */
  async deleteThread(userId, threadId, userRole) {
    const existing = await pool.query('SELECT user_id FROM threads WHERE id = $1', [threadId]);
    if (!existing.rows[0]) {
      const err = new Error('Thread not found');
      err.statusCode = 404;
      throw err;
    }
    if (existing.rows[0].user_id !== userId && userRole !== 'admin') {
      const err = new Error('Not authorised to delete this thread');
      err.statusCode = 403;
      throw err;
    }

    await pool.query('DELETE FROM threads WHERE id = $1', [threadId]);
  }

  /**
   * Update a comment (only by owner).
   */
  async updateComment(userId, threadId, commentId, content) {
    const existing = await pool.query(
      'SELECT user_id FROM thread_comments WHERE id = $1 AND thread_id = $2',
      [commentId, threadId]
    );
    if (!existing.rows[0]) {
      const err = new Error('Comment not found');
      err.statusCode = 404;
      throw err;
    }
    if (existing.rows[0].user_id !== userId) {
      const err = new Error('Not authorised to edit this comment');
      err.statusCode = 403;
      throw err;
    }

    const result = await pool.query(
      'UPDATE thread_comments SET content = $1 WHERE id = $2 RETURNING id, content, created_at',
      [content, commentId]
    );
    const comment = result.rows[0];
    const userResult = await pool.query('SELECT id, name, avatar_url FROM users WHERE id = $1', [
      userId,
    ]);
    return { ...comment, user: userResult.rows[0] };
  }

  /**
   * Delete a comment (only by owner or admin).
   */
  async deleteComment(userId, threadId, commentId, userRole) {
    const existing = await pool.query(
      'SELECT user_id FROM thread_comments WHERE id = $1 AND thread_id = $2',
      [commentId, threadId]
    );
    if (!existing.rows[0]) {
      const err = new Error('Comment not found');
      err.statusCode = 404;
      throw err;
    }
    if (existing.rows[0].user_id !== userId && userRole !== 'admin') {
      const err = new Error('Not authorised to delete this comment');
      err.statusCode = 403;
      throw err;
    }

    await pool.query('DELETE FROM thread_comments WHERE id = $1', [commentId]);
  }

  // ──────────────────────────────────────────────
  // LIKES
  // ──────────────────────────────────────────────

  /**
   * Toggle like on a thread. Returns new like_count.
   */
  async likeThread(userId, threadId) {
    try {
      await pool.query('INSERT INTO thread_likes (thread_id, user_id) VALUES ($1, $2)', [
        threadId,
        userId,
      ]);
    } catch (err) {
      if (err.code !== '23505') throw err; // ignore unique violation
    }
    return this._getLikeCount(threadId);
  }

  /**
   * Remove like from a thread.
   */
  async unlikeThread(userId, threadId) {
    await pool.query('DELETE FROM thread_likes WHERE thread_id = $1 AND user_id = $2', [
      threadId,
      userId,
    ]);
    return this._getLikeCount(threadId);
  }

  async _getLikeCount(threadId) {
    const result = await pool.query('SELECT COUNT(*) FROM thread_likes WHERE thread_id = $1', [
      threadId,
    ]);
    return parseInt(result.rows[0].count);
  }

  // ──────────────────────────────────────────────
  // NOTIFICATIONS
  // ──────────────────────────────────────────────

  /**
   * List notifications for a user with actor info.
   */
  async getNotifications(userId) {
    const result = await pool.query(
      `SELECT
         n.id, n.type, n.message, n.is_read, n.created_at,
         u.id         AS actor_id,
         u.name       AS actor_name,
         u.avatar_url AS actor_avatar_url
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return result.rows.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      is_read: n.is_read,
      read: n.is_read,
      created_at: n.created_at,
      avatar_url: n.actor_avatar_url ?? null,
      actor: n.actor_id
        ? { id: n.actor_id, name: n.actor_name, avatar_url: n.actor_avatar_url }
        : null,
    }));
  }

  /**
   * Count unread notifications for a user.
   */
  async getUnreadCount(userId) {
    const result = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllRead(userId) {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );
  }

  /**
   * Delete a single notification (must belong to the user).
   */
  async deleteNotification(userId, notificationId) {
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId]
    );
    if (!result.rows[0]) {
      const err = new Error('Notification not found');
      err.statusCode = 404;
      throw err;
    }
  }

  /**
   * Mark a single notification as read (must belong to the user).
   */
  async markNotificationRead(userId, notificationId) {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id, is_read',
      [notificationId, userId]
    );
    if (!result.rows[0]) {
      const err = new Error('Notification not found');
      err.statusCode = 404;
      throw err;
    }
    return result.rows[0];
  }
}

module.exports = new CommunityService();
