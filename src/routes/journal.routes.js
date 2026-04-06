'use strict';

const { Router } = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const journalController = require('../controllers/journal.controller');

const router = Router();
router.use(authenticateToken);

// Multer: memory storage, max 10 MB per file, max 5 files, images + video
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    cb(new Error('Only image and video files are allowed'));
  },
});

// ── List & Search ────────────────────────────────────────────────────────────

// GET  /api/v1/journal?month=YYYY-MM
router.get('/', journalController.getByMonth);

// GET  /api/v1/journal/search?q=text&month=YYYY-MM (optional month filter)
router.get('/search', journalController.search);

// ── Media upload ─────────────────────────────────────────────────────────────

// POST /api/v1/journal/media  — multipart/form-data { files[] }
// Returns { urls: ["data:image/jpeg;base64,..."] }
// Use these URLs in the images[] array when creating / updating an entry.
router.post('/media', upload.array('files', 5), journalController.uploadMedia);

// ── Single entry CRUD ────────────────────────────────────────────────────────

// POST /api/v1/journal
// Body: { date, title?, content?, mood?, symptoms?, images? }
router.post('/', journalController.create);

// GET  /api/v1/journal/:id
router.get('/:id', journalController.getById);

// PUT  /api/v1/journal/:id
// Body: any subset of POST fields
router.put('/:id', journalController.update);

// DELETE /api/v1/journal/:id
router.delete('/:id', journalController.delete);

module.exports = router;
