'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const paymentController = require('../controllers/payment.controller');

const router = Router();

router.post('/tip',                    authenticateToken, paymentController.createTip);
router.get('/status/:paymentHash',     authenticateToken, paymentController.getStatus);
router.get('/history',                 authenticateToken, paymentController.getHistory);
router.post('/webhook',                paymentController.webhook);

module.exports = router;
