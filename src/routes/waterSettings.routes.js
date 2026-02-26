'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const waterSettingsController = require('../controllers/waterSettings.controller');

const router = Router();

router.use(authenticateToken);

// GET /api/v1/water-settings
router.get('/', waterSettingsController.get);

// PUT /api/v1/water-settings
router.put('/', waterSettingsController.update);

module.exports = router;
