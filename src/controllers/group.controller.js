'use strict';

const groupService = require('../services/group.service');
const ApiResponse = require('../utils/response');

const groupController = {

  async getGroups(req, res) {
    try {
      const result = await groupService.getGroups(req.user.id);
      const mapped = result.map(g => ({
        ...g,
        members_count: g.member_count ?? 0,
        last_message: g.last_message ?? null,
      }));
      return ApiResponse.success(res, mapped);
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async createGroup(req, res) {
    try {
      const { name, description, member_ids } = req.body;
      const result = await groupService.createGroup(req.user.id, { name, description, member_ids });
      return ApiResponse.created(res, result, 'Group created');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async getGroup(req, res) {
    try {
      const result = await groupService.getGroup(req.user.id, req.params.groupId);
      return ApiResponse.success(res, result);
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async updateGroup(req, res) {
    try {
      const result = await groupService.updateGroup(req.user.id, req.params.groupId, req.body);
      return ApiResponse.success(res, result, 'Group updated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async deleteGroup(req, res) {
    try {
      await groupService.deleteGroup(req.user.id, req.params.groupId);
      return ApiResponse.success(res, null, 'Group deleted');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async addMember(req, res) {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return ApiResponse.validationError(res, [{ field: 'user_id', message: 'user_id is required' }]);
      }
      await groupService.addMember(req.user.id, req.params.groupId, user_id);
      return ApiResponse.success(res, null, 'Member added');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async removeMember(req, res) {
    try {
      await groupService.removeMember(req.user.id, req.params.groupId, req.params.userId);
      return ApiResponse.success(res, null, 'Member removed');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async getMessages(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await groupService.getMessages(req.user.id, req.params.groupId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
      });
      return ApiResponse.success(res, result);
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async sendMessage(req, res) {
    try {
      const { content } = req.body;
      if (!content?.trim()) {
        return ApiResponse.validationError(res, [{ field: 'content', message: 'content is required' }]);
      }
      const result = await groupService.sendMessage(req.user.id, req.params.groupId, content.trim());
      return ApiResponse.created(res, result, 'Message sent');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async deleteMessage(req, res) {
    try {
      await groupService.deleteMessage(req.user.id, req.params.groupId, req.params.messageId);
      return ApiResponse.success(res, null, 'Message deleted');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async leaveGroup(req, res) {
    try {
      await groupService.leaveGroup(req.user.id, req.params.groupId);
      return ApiResponse.success(res, null, 'Left group');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = groupController;
