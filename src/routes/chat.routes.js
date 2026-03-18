'use strict';

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const chatController = require('../controllers/chat.controller');

const router = Router();

router.use(authenticateToken);

router.get('/',                                       chatController.getConversations);
router.post('/',                                      chatController.startConversation);
router.get('/:conversationId',                        chatController.getMessages);
router.post('/:conversationId',                       chatController.sendMessage);
router.delete('/:conversationId/:messageId',          chatController.deleteMessage);
router.put('/:conversationId/read',                   chatController.markRead);
router.post('/:conversationId/typing',                chatController.setTyping);

module.exports = router;
