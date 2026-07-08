'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const journalController = require('../controllers/journal.controller');
const { uploadJournalImages } = require('../config/cloudinary');

const router = Router();
router.use(authenticateToken);

// ── List & Search ────────────────────────────────────────────────────────────

// GET  /api/v1/journal?month=YYYY-MM
router.get('/', journalController.getByMonth);

// GET  /api/v1/journal/search?q=text&month=YYYY-MM (optional month filter)
router.get('/search', journalController.search);

// ── Media upload ─────────────────────────────────────────────────────────────

// POST /api/v1/journal/media  — multipart/form-data { files[] }
// Returns { urls: ["data:image/jpeg;base64,..."] }
// Use these URLs in the images[] array when creating / updating an entry.
router.post('/media', uploadJournalImages.array('files', 5), journalController.uploadMedia);

// ── Single entry CRUD ────────────────────────────────────────────────────────

// POST /api/v1/journal
// Body: { date, title?, content?, mood?, symptoms?, images? }
router.post('/', journalController.create);

// GET  /api/v1/journal/:id
router.get('/:id', journalController.getById);

// PUT  /api/v1/journal/:id
// Body: any subset of POST fields
router.put('/:id', journalController.update);

// DELETE /api/v1/journal  — delete all entries for the authenticated user
router.delete('/', journalController.deleteAll);

// DELETE /api/v1/journal/:id
router.delete('/:id', journalController.delete);

module.exports = router;
