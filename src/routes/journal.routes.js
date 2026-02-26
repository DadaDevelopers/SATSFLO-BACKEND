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

module.exports = router;
