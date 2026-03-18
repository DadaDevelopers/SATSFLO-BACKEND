'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const cycleProfileController = require('../controllers/cycleProfile.controller');

const router = Router();

// All cycle-profile routes require authentication
router.use(authenticateToken);

// POST /api/v1/cycle-profile  — create or replace profile (requires last_period_start)
router.post('/', cycleProfileController.create);

// PUT  /api/v1/cycle-profile  — update existing profile (all fields optional)
router.put('/', cycleProfileController.update);

// GET  /api/v1/cycle-profile  — get profile + live calculations
router.get('/', cycleProfileController.get);

module.exports = router;
