'use strict';

const { Router } = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const communityController = require('../controllers/community.controller');

const router = Router();

// ─── THREADS ─────────────────────────────────────────────────
// GET  /api/v1/threads  — public read; attach user info when token present
router.get('/threads', optionalAuth, communityController.getThreads);

// POST /api/v1/threads  — requires auth
router.post('/threads', authenticateToken, communityController.createThread);

// ─── COMMENTS ────────────────────────────────────────────────
router.get('/threads/:id/comments',  optionalAuth,       communityController.getComments);
router.post('/threads/:id/comments', authenticateToken,  communityController.addComment);

// ─── LIKES ───────────────────────────────────────────────────
router.post('/threads/:id/like',   authenticateToken, communityController.likeThread);
router.delete('/threads/:id/like', authenticateToken, communityController.unlikeThread);

// ─── NOTIFICATIONS ───────────────────────────────────────────
router.get('/notifications',             authenticateToken, communityController.getNotifications);
router.patch('/notifications/read-all',  authenticateToken, communityController.markAllRead);

module.exports = router;
