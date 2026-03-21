'use strict';

const communityService = require('../services/community.service');
const ApiResponse = require('../utils/response');

const communityController = {
  // ──────────────────────────────────────────────
  // THREADS
  // ──────────────────────────────────────────────

  async getThreads(req, res) {
    try {
      const { tab = 'recent', search, page = 1, limit = 20 } = req.query;

      // userId may be null when optionalAuth is used (unauthenticated)
      const userId = req.user?.id ?? null;

      const result = await communityService.getThreads({
        tab,
        search: search?.trim() || undefined,
        userId,
        page: Math.max(1, Number(page)),
        limit: Math.min(50, Math.max(1, Number(limit))),
      });

      const threads = result.threads.map(t => ({
        ...t,
        likes_count: t.like_count ?? 0,
        comments_count: t.comment_count ?? 0,
        is_liked: t.is_liked_by_me ?? false,
      }));
      return ApiResponse.paginated(res, threads, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async getThread(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id ?? null;
      const thread = await communityService.getThread(id, userId);
      return ApiResponse.success(res, {
        ...thread,
        likes_count: thread.like_count ?? 0,
        comments_count: thread.comment_count ?? 0,
        is_liked: thread.is_liked_by_me ?? false,
      }, 'Thread retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async createThread(req, res) {
    try {
      const { content, image_url } = req.body;

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return ApiResponse.validationError(res, [
          { field: 'content', message: 'content is required' },
        ]);
      }

      const thread = await communityService.createThread(req.user.id, {
        content: content.trim(),
        image_url: image_url || null,
      });

      return ApiResponse.created(res, thread, 'Thread created');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async updateThread(req, res) {
    try {
      const { id } = req.params;
      const { content, image_url } = req.body;
      const thread = await communityService.updateThread(req.user.id, id, { content, image_url });
      return ApiResponse.success(res, thread, 'Thread updated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async deleteThread(req, res) {
    try {
      const { id } = req.params;
      await communityService.deleteThread(req.user.id, id, req.user.role);
      return ApiResponse.success(res, null, 'Thread deleted');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // ──────────────────────────────────────────────
  // COMMENTS
  // ──────────────────────────────────────────────

  async getComments(req, res) {
    try {
      const { id } = req.params;
      const comments = await communityService.getComments(id);
      return ApiResponse.success(res, comments, 'Comments retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async addComment(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return ApiResponse.validationError(res, [
          { field: 'content', message: 'content is required' },
        ]);
      }

      const comment = await communityService.addComment(req.user.id, id, content.trim());
      return ApiResponse.created(res, comment, 'Comment added');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async updateComment(req, res) {
    try {
      const { id: threadId, commentId } = req.params;
      const { content } = req.body;
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return ApiResponse.validationError(res, [{ field: 'content', message: 'content is required' }]);
      }
      const comment = await communityService.updateComment(req.user.id, threadId, commentId, content.trim());
      return ApiResponse.success(res, comment, 'Comment updated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async deleteComment(req, res) {
    try {
      const { id: threadId, commentId } = req.params;
      await communityService.deleteComment(req.user.id, threadId, commentId, req.user.role);
      return ApiResponse.success(res, null, 'Comment deleted');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // ──────────────────────────────────────────────
  // LIKES
  // ──────────────────────────────────────────────

  async likeThread(req, res) {
    try {
      const { id } = req.params;
      const likeCount = await communityService.likeThread(req.user.id, id);
      return ApiResponse.success(res, { like_count: likeCount, is_liked_by_me: true }, 'Thread liked');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async unlikeThread(req, res) {
    try {
      const { id } = req.params;
      const likeCount = await communityService.unlikeThread(req.user.id, id);
      return ApiResponse.success(res, { like_count: likeCount, is_liked_by_me: false }, 'Like removed');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // ──────────────────────────────────────────────
  // NOTIFICATIONS
  // ──────────────────────────────────────────────

  async getNotifications(req, res) {
    try {
      const notifications = await communityService.getNotifications(req.user.id);
      return ApiResponse.success(res, notifications, 'Notifications retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async markAllRead(req, res) {
    try {
      await communityService.markAllRead(req.user.id);
      return ApiResponse.success(res, null, 'All notifications marked as read');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async markNotificationRead(req, res) {
    try {
      const { notificationId } = req.params;
      const result = await communityService.markNotificationRead(req.user.id, notificationId);
      return ApiResponse.success(res, result, 'Notification marked as read');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = communityController;
