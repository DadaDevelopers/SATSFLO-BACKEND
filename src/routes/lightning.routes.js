'use strict';

const express = require('express');

const lightningController = require('../controllers/lightning.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const {
  getWalletValidation,
  syncWalletValidation,
  createInvoiceValidation,
  probePaymentValidation,
  payInvoiceValidation,
  previewPaymentValidation,
  payLnurlValidation,
  payLightningAddressValidation,
  listTransactionsValidation,
  proofOfPaymentValidation
} = require('../validators/lightning.validator');

const router = express.Router();

router.get('/wallet', authenticateToken, getWalletValidation, validate, lightningController.getWallet);
router.post('/wallet/sync', authenticateToken, syncWalletValidation, validate, lightningController.syncWallet);
router.post('/invoices', authenticateToken, createInvoiceValidation, validate, lightningController.createInvoice);
router.post('/payments/probe', authenticateToken, probePaymentValidation, validate, lightningController.probePayment);
router.post('/payments/pay', authenticateToken, payInvoiceValidation, validate, lightningController.payInvoice);
router.post('/payments/preview', authenticateToken, previewPaymentValidation, validate, lightningController.previewPayment);
router.post('/payments/lnurl', authenticateToken, payLnurlValidation, validate, lightningController.payLnurl);
router.post('/payments/ln-address', authenticateToken, payLightningAddressValidation, validate, lightningController.payLightningAddress);
router.get('/transactions', authenticateToken, listTransactionsValidation, validate, lightningController.getTransactions);
router.get('/proof-of-payment', authenticateToken, proofOfPaymentValidation, validate, lightningController.getProofOfPayment);

module.exports = router;