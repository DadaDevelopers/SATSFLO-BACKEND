'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const partnerController = require('../controllers/partner.controller');

const router = Router();

router.use(authenticateToken);

// Invite flow (sender)
router.post('/invite', partnerController.generateInvite);
router.get('/invite/status', partnerController.getInviteStatus);

// Accept flow (receiver)
router.post('/accept', partnerController.acceptInvite);

// Partnership management
router.get('/', partnerController.getPartner);
router.delete('/', partnerController.unpair);
router.put('/nickname', partnerController.updateNicknames);

// Sharing settings
router.get('/settings', partnerController.getSettings);
router.put('/settings', partnerController.updateSettings);

// Partner mode toggle
router.put('/mode', partnerController.updatePartnerMode);

// Partner cycle view
router.get('/cycle', partnerController.getPartnerCycle);
router.get('/calendar', partnerController.getPartnerCalendar);

module.exports = router;
