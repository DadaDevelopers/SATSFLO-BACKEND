'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const walletController = require('../controllers/wallet.controller');

const router = Router();

router.use(authenticateToken);

// GET  /api/v1/wallet/lightning — get saved lightning address
router.get('/lightning', walletController.getLightningAddress);

// PUT  /api/v1/wallet/lightning — save lightning address
router.put('/lightning', walletController.updateLightningAddress);

module.exports = router;
