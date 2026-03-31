'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const journalController = require('../controllers/journal.controller');

const router = Router();

router.use(authenticateToken);

// GET  /api/v1/journal?month=YYYY-MM  — entries for a month
router.get('/', journalController.getByMonth);

// POST /api/v1/journal                — create entry
router.post('/', journalController.create);

// GET  /api/v1/journal/:id            — get single entry
router.get('/:id', journalController.getById);

// PUT  /api/v1/journal/:id            — update entry
router.put('/:id', journalController.update);

// DELETE /api/v1/journal/:id          — delete entry
router.delete('/:id', journalController.delete);

module.exports = router;
