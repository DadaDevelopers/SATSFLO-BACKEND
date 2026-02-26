'use strict';

const { supabaseAdmin } = require('../config/supabase');

class CommunityService {
  // ──────────────────────────────────────────────
  // THREADS
  // ──────────────────────────────────────────────

  /**
   * List threads with comment/like counts and whether the caller liked them.
   *
   * @param {Object} opts
   * @param {string} [opts.tab='recent']   recent | popular | following
   * @param {string} [opts.search]         full-text search string
   * @param {string|null} [opts.userId]    null for unauthenticated requests
   * @param {number} [opts.page=1]
   * @param {number} [opts.limit=20]
   */
  async getThreads({ tab = 'recent', search, userId, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('threads')
      .select(
        `id, content, image_url, created_at, updated_at,
         user:user_id (id, name, avatar_url),
         comment_count:thread_comments(count),
         like_count:thread_likes(count)`,
        { count: 'exact' }
      );

    if (search) {
      query = query.ilike('content', `%${search}%`);
    }

    if (tab === 'popular') {
      // order by like count done post-fetch (Supabase doesn't support ordering by aggregate)
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // Flatten counts and attach is_liked_by_me
    let likedSet = new Set();
    if (userId && data.length > 0) {
      const threadIds = data.map((t) => t.id);
      const { data: likes } = await supabaseAdmin
        .from('thread_likes')
        .select('thread_id')
        .eq('user_id', userId)
        .in('thread_id', threadIds);

      likedSet = new Set((likes || []).map((l) => l.thread_id));
    }

    const threads = data.map((t) => ({
      id: t.id,
      content: t.content,
      image_url: t.image_url,
      created_at: t.created_at,
      updated_at: t.updated_at,
      user: t.user,
      comment_count: t.comment_count?.[0]?.count ?? 0,
      like_count: t.like_count?.[0]?.count ?? 0,
      is_liked_by_me: likedSet.has(t.id),
    }));

    if (tab === 'popular') {
      threads.sort((a, b) => b.like_count - a.like_count);
    }

    return { threads, total: count ?? 0, page, limit };
  }

  /**
   * Create a new thread.
   */
  async createThread(userId, { content, image_url }) {
    const payload = { user_id: userId, content };
    if (image_url) payload.image_url = image_url;

    const { data, error } = await supabaseAdmin
      .from('threads')
      .insert(payload)
      .select(
        `id, content, image_url, created_at,
         user:user_id (id, name, avatar_url)`
      )
      .single();

    if (error) throw error;
    return data;
  }

  // ──────────────────────────────────────────────
  // COMMENTS
  // ──────────────────────────────────────────────

  /**
   * List comments for a thread.
   */
  async getComments(threadId) {
    const { data, error } = await supabaseAdmin
      .from('thread_comments')
      .select(
        `id, content, created_at,
         user:user_id (id, name, avatar_url)`
      )
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Add a comment to a thread.
   */
  async addComment(userId, threadId, content) {
    // Verify thread exists
    const { data: thread, error: threadErr } = await supabaseAdmin
      .from('threads')
      .select('id')
      .eq('id', threadId)
      .maybeSingle();

    if (threadErr) throw threadErr;
    if (!thread) {
      const err = new Error('Thread not found');
      err.statusCode = 404;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from('thread_comments')
      .insert({ thread_id: threadId, user_id: userId, content })
      .select(
        `id, content, created_at,
         user:user_id (id, name, avatar_url)`
      )
      .single();

    if (error) throw error;
    return data;
  }

  // ──────────────────────────────────────────────
  // LIKES
  // ──────────────────────────────────────────────

  /**
   * Toggle like on a thread (insert). Returns new like_count.
   */
  async likeThread(userId, threadId) {
    const { error } = await supabaseAdmin
      .from('thread_likes')
      .insert({ thread_id: threadId, user_id: userId });

    // 23505 = unique violation → already liked, treat as success
    if (error && error.code !== '23505') throw error;

    return this._getLikeCount(threadId);
  }

  /**
   * Remove like from a thread.
   */
  async unlikeThread(userId, threadId) {
    const { error } = await supabaseAdmin
      .from('thread_likes')
      .delete()
      .eq('thread_id', threadId)
      .eq('user_id', userId);

    if (error) throw error;
    return this._getLikeCount(threadId);
  }

  async _getLikeCount(threadId) {
    const { count, error } = await supabaseAdmin
      .from('thread_likes')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId);

    if (error) throw error;
    return count ?? 0;
  }

  // ──────────────────────────────────────────────
  // NOTIFICATIONS
  // ──────────────────────────────────────────────

  /**
   * List notifications for a user with actor info.
   */
  async getNotifications(userId) {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select(
        `id, type, message, is_read, created_at,
         actor:actor_id (id, name, avatar_url)`
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data;
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllRead(userId) {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
  }
}

module.exports = new CommunityService();
