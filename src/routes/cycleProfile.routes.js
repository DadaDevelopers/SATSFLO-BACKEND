'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const cycleProfileController = require('../controllers/cycleProfile.controller');

const router = Router();

// All cycle-profile routes require authentication
router.use(authenticateToken);

// POST /api/v1/cycle-profile  — create or replace profile
router.post('/', cycleProfileController.create);

// GET  /api/v1/cycle-profile  — get profile + live calculations
router.get('/', cycleProfileController.get);

module.exports = router;
