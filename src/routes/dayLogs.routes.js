'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const dayLogsController = require('../controllers/dayLogs.controller');

const router = Router();

router.use(authenticateToken);

// GET  /api/v1/logs?date=YYYY-MM-DD        — single day log (query param)
router.get('/', dayLogsController.getByDate);

// GET  /api/v1/logs/range?from=...&to=...  — range query  (must be before /:date)
router.get('/range', dayLogsController.getRange);

// GET  /api/v1/logs/:date                  — single day log (path param)
router.get('/:date', dayLogsController.getByDateParam);

// PUT  /api/v1/logs/:date                  — upsert a day log
router.put('/:date', dayLogsController.upsert);

module.exports = router;
