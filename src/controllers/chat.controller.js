'use strict';

const chatService = require('../services/chat.service');
const ApiResponse = require('../utils/response');

const chatController = {

  async getConversations(req, res) {
    try {
      const result = await chatService.getConversations(req.user.id);
      const mapped = result.map(c => ({
        ...c,
        id: c.conversation_id,
        recipient: c.other_user,
        name: c.other_user?.name ?? null,
        updated_at: c.last_message_time ?? null,
        is_online: c.is_typing ?? false,
      }));
      return ApiResponse.success(res, mapped);
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async startConversation(req, res) {
    try {
      const { recipient_id } = req.body;
      if (!recipient_id) {
        return ApiResponse.validationError(res, [{ field: 'recipient_id', message: 'recipient_id is required' }]);
      }
      const result = await chatService.startConversation(req.user.id, recipient_id);
      return ApiResponse.created(res, result, 'Conversation started');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { page, limit } = req.query;
      const messages = await chatService.getMessages(req.user.id, conversationId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
      });
      const mapped = messages.map(m => ({
        ...m,
        is_sent: m.sender_id === req.user.id,
      }));
      return ApiResponse.success(res, { messages: mapped });
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;
      if (!content?.trim()) {
        return ApiResponse.validationError(res, [{ field: 'content', message: 'content is required' }]);
      }
      const result = await chatService.sendMessage(req.user.id, conversationId, content.trim());
      return ApiResponse.created(res, result, 'Message sent');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async deleteMessage(req, res) {
    try {
      const { conversationId, messageId } = req.params;
      await chatService.deleteMessage(req.user.id, conversationId, messageId);
      return ApiResponse.success(res, null, 'Message deleted');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async markRead(req, res) {
    try {
      const { conversationId } = req.params;
      await chatService.markRead(req.user.id, conversationId);
      return ApiResponse.success(res, null, 'Conversation marked as read');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async setTyping(req, res) {
    try {
      const { conversationId } = req.params;
      const { is_typing } = req.body;
      if (is_typing === undefined) {
        return ApiResponse.validationError(res, [{ field: 'is_typing', message: 'is_typing (boolean) is required' }]);
      }
      await chatService.setTyping(req.user.id, conversationId, Boolean(is_typing));
      return ApiResponse.success(res, { is_typing: Boolean(is_typing) });
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = chatController;
