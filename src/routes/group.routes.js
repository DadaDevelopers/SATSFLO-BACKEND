'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const groupController = require('../controllers/group.controller');

const router = Router();

router.use(authenticateToken);

router.get('/',                                         groupController.getGroups);
router.post('/',                                        groupController.createGroup);
router.get('/:groupId',                                 groupController.getGroup);
router.put('/:groupId',                                 groupController.updateGroup);
router.delete('/:groupId',                              groupController.deleteGroup);
router.post('/:groupId/members',                        groupController.addMember);
router.delete('/:groupId/members/:userId',              groupController.removeMember);
router.get('/:groupId/messages',                        groupController.getMessages);
router.post('/:groupId/messages',                       groupController.sendMessage);
router.delete('/:groupId/messages/:messageId',          groupController.deleteMessage);
router.post('/:groupId/leave',                          groupController.leaveGroup);

module.exports = router;
