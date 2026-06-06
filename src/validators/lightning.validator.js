'use strict';

const { body, query } = require('express-validator');

const walletIdRule = (source) =>
  source('walletId').optional().trim().notEmpty().withMessage('walletId cannot be empty');

const amountRule = body('amountSats')
  .isInt({ min: 1 })
  .withMessage('amountSats must be a positive integer');

const optionalAmountRule = body('amountSats')
  .optional()
  .isInt({ min: 1 })
  .withMessage('amountSats must be a positive integer');

const memoRule = body('memo')
  .optional()
  .trim()
  .isLength({ max: 140 })
  .withMessage('memo must not exceed 140 characters');

const paymentRequestRule = body('paymentRequest')
  .trim()
  .notEmpty()
  .withMessage('paymentRequest is required');

const lnurlRule = body('lnurl').trim().notEmpty().withMessage('lnurl is required');

const lightningAddressRule = body('lightningAddress')
  .trim()
  .matches(/^[^\s@]+@[^\s@]+$/)
  .withMessage('lightningAddress must look like name@domain');

const commentRule = body('comment')
  .optional()
  .trim()
  .isLength({ max: 500 })
  .withMessage('comment must not exceed 500 characters');

const getWalletValidation = [walletIdRule(query)];

const syncWalletValidation = [walletIdRule(body)];

const createInvoiceValidation = [walletIdRule(body), amountRule, memoRule];

const probePaymentValidation = [walletIdRule(body), paymentRequestRule];

const payInvoiceValidation = [walletIdRule(body), paymentRequestRule, memoRule];

const previewPaymentValidation = [
  walletIdRule(body),
  body('paymentMethod')
    .trim()
    .isIn(['bolt11', 'lnurl_pay', 'ln_address'])
    .withMessage('paymentMethod must be one of bolt11, lnurl_pay, or ln_address'),
  optionalAmountRule,
  commentRule,
  body().custom((value, { req }) => {
    switch (req.body.paymentMethod) {
      case 'bolt11':
        if (!req.body.paymentRequest || !String(req.body.paymentRequest).trim()) {
          throw new Error('paymentRequest is required when paymentMethod is bolt11');
        }
        break;
      case 'lnurl_pay':
        if (!req.body.lnurl || !String(req.body.lnurl).trim()) {
          throw new Error('lnurl is required when paymentMethod is lnurl_pay');
        }
        break;
      case 'ln_address':
        if (!req.body.lightningAddress || !String(req.body.lightningAddress).trim()) {
          throw new Error('lightningAddress is required when paymentMethod is ln_address');
        }
        break;
      default:
        break;
    }

    return true;
  }),
];

const payLnurlValidation = [walletIdRule(body), amountRule, lnurlRule, memoRule];

const payLightningAddressValidation = [
  walletIdRule(body),
  amountRule,
  lightningAddressRule,
  memoRule,
];

const listTransactionsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50'),
];

const proofOfPaymentValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('limit must be between 1 and 20'),
  query('paymentRequest')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('paymentRequest cannot be empty'),
];

module.exports = {
  getWalletValidation,
  syncWalletValidation,
  createInvoiceValidation,
  probePaymentValidation,
  payInvoiceValidation,
  previewPaymentValidation,
  payLnurlValidation,
  payLightningAddressValidation,
  listTransactionsValidation,
  proofOfPaymentValidation,
};
