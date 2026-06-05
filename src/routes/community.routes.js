'use strict';

const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const communityController = require('../controllers/community.controller');

const router = Router();

// ─── THREADS ─────────────────────────────────────────────────
router.get('/threads',     optionalAuth,      communityController.getThreads);
router.post('/threads',    authenticateToken, communityController.createThread);
router.get('/threads/:id', optionalAuth,      communityController.getThread);
router.put('/threads/:id', authenticateToken, communityController.updateThread);
router.delete('/threads/:id', authenticateToken, communityController.deleteThread);

// ─── COMMENTS ────────────────────────────────────────────────
router.get('/threads/:id/comments',                      optionalAuth,      communityController.getComments);
router.post('/threads/:id/comments',                     authenticateToken, communityController.addComment);
router.put('/threads/:id/comments/:commentId',           authenticateToken, communityController.updateComment);
router.delete('/threads/:id/comments/:commentId',        authenticateToken, communityController.deleteComment);

// ─── LIKES ───────────────────────────────────────────────────
router.post('/threads/:id/like',   authenticateToken, communityController.likeThread);
router.delete('/threads/:id/like', authenticateToken, communityController.unlikeThread);

// ─── NOTIFICATIONS ───────────────────────────────────────────
router.get('/notifications',                          authenticateToken, communityController.getNotifications);
router.get('/notifications/unread-count',             authenticateToken, communityController.getUnreadCount);
router.patch('/notifications/read-all',               authenticateToken, communityController.markAllRead);
router.post('/notifications/read-all',                authenticateToken, communityController.markAllRead);
router.patch('/notifications/:notificationId/read',   authenticateToken, communityController.markNotificationRead);
router.delete('/notifications/:notificationId',       authenticateToken, communityController.deleteNotification);

module.exports = router;
