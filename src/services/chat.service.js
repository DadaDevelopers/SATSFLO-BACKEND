'use strict';

const { pool } = require('../config/database');

function err(msg, code = 400) {
  return Object.assign(new Error(msg), { statusCode: code });
}

// Normalise user pair so user_a < user_b (matches UNIQUE + CHECK constraint)
function orderedPair(idA, idB) {
  return idA < idB ? [idA, idB] : [idB, idA];
}

class ChatService {

  // ── List conversations ──────────────────────────────────────────────────────

  async getConversations(userId) {
    const result = await pool.query(
      `SELECT
         c.id AS conversation_id,
         CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END AS other_user_id,
         c.created_at
       FROM conversations c
       WHERE c.user_a_id = $1 OR c.user_b_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    if (result.rows.length === 0) return [];

    const convIds = result.rows.map(r => r.conversation_id);
    const otherIds = result.rows.map(r => r.other_user_id);

    // Fetch other users in one query
    const usersResult = await pool.query(
      `SELECT id, name, avatar_url FROM users WHERE id = ANY($1)`,
      [otherIds]
    );
    const usersMap = Object.fromEntries(usersResult.rows.map(u => [u.id, u]));

    // Last message per conversation
    const lastMsgResult = await pool.query(
      `SELECT DISTINCT ON (conversation_id)
         conversation_id, content, sender_id, created_at
       FROM direct_messages
       WHERE conversation_id = ANY($1) AND deleted_at IS NULL
       ORDER BY conversation_id, created_at DESC`,
      [convIds]
    );
    const lastMsgMap = Object.fromEntries(lastMsgResult.rows.map(m => [m.conversation_id, m]));

    // Unread counts
    const unreadResult = await pool.query(
      `SELECT conversation_id, COUNT(*) AS unread_count
       FROM direct_messages
       WHERE conversation_id = ANY($1)
         AND sender_id != $2
         AND read_at IS NULL
         AND deleted_at IS NULL
       GROUP BY conversation_id`,
      [convIds, userId]
    );
    const unreadMap = Object.fromEntries(unreadResult.rows.map(r => [r.conversation_id, parseInt(r.unread_count)]));

    // Typing indicators (fresh within 5 seconds)
    const typingResult = await pool.query(
      `SELECT conversation_id, user_id
       FROM typing_indicators
       WHERE conversation_id = ANY($1)
         AND user_id != $2
         AND is_typing = true
         AND updated_at > NOW() - INTERVAL '5 seconds'`,
      [convIds, userId]
    );
    const typingSet = new Set(typingResult.rows.map(t => t.conversation_id));

    return result.rows.map(r => ({
      conversation_id: r.conversation_id,
      other_user: usersMap[r.other_user_id] || null,
      last_message: lastMsgMap[r.conversation_id]?.content || null,
      last_message_time: lastMsgMap[r.conversation_id]?.created_at || null,
      unread_count: unreadMap[r.conversation_id] || 0,
      is_typing: typingSet.has(r.conversation_id),
    }));
  }

  // ── Start conversation ──────────────────────────────────────────────────────

  async startConversation(userId, recipientId) {
    if (userId === recipientId) throw err('Cannot start a conversation with yourself');

    // Check recipient exists
    const recipientResult = await pool.query(
      'SELECT id, name, avatar_url FROM users WHERE id = $1',
      [recipientId]
    );
    if (!recipientResult.rows[0]) throw err('User not found', 404);

    const [userA, userB] = orderedPair(userId, recipientId);

    // Upsert conversation
    const result = await pool.query(
      `INSERT INTO conversations (user_a_id, user_b_id)
       VALUES ($1, $2)
       ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET user_a_id = EXCLUDED.user_a_id
       RETURNING id, created_at`,
      [userA, userB]
    );

    return {
      conversation_id: result.rows[0].id,
      other_user: recipientResult.rows[0],
      created_at: result.rows[0].created_at,
    };
  }

  // ── Get messages ────────────────────────────────────────────────────────────

  async getMessages(userId, conversationId, { page = 1, limit = 50 } = {}) {
    await this._assertMember(userId, conversationId);

    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT
         dm.id, dm.content, dm.sender_id, dm.read_at, dm.created_at,
         u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM direct_messages dm
       JOIN users u ON dm.sender_id = u.id
       WHERE dm.conversation_id = $1 AND dm.deleted_at IS NULL
       ORDER BY dm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    return result.rows.map(m => ({
      id: m.id,
      content: m.content,
      sender_id: m.sender_id,
      sender: { id: m.sender_id, name: m.sender_name, avatar_url: m.sender_avatar },
      read_at: m.read_at,
      created_at: m.created_at,
    }));
  }

  // ── Send message ────────────────────────────────────────────────────────────

  async sendMessage(userId, conversationId, content) {
    await this._assertMember(userId, conversationId);

    const result = await pool.query(
      `INSERT INTO direct_messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, sender_id, read_at, created_at`,
      [conversationId, userId, content]
    );

    return result.rows[0];
  }

  // ── Delete message ──────────────────────────────────────────────────────────

  async deleteMessage(userId, conversationId, messageId) {
    const result = await pool.query(
      `SELECT sender_id FROM direct_messages
       WHERE id = $1 AND conversation_id = $2 AND deleted_at IS NULL`,
      [messageId, conversationId]
    );
    if (!result.rows[0]) throw err('Message not found', 404);
    if (result.rows[0].sender_id !== userId) throw err('Not authorised to delete this message', 403);

    await pool.query(
      `UPDATE direct_messages SET deleted_at = NOW() WHERE id = $1`,
      [messageId]
    );
  }

  // ── Mark conversation as read ───────────────────────────────────────────────

  async markRead(userId, conversationId) {
    await this._assertMember(userId, conversationId);

    await pool.query(
      `UPDATE direct_messages
       SET read_at = NOW()
       WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [conversationId, userId]
    );
  }

  // ── Typing indicator ────────────────────────────────────────────────────────

  async setTyping(userId, conversationId, isTyping) {
    await this._assertMember(userId, conversationId);

    await pool.query(
      `INSERT INTO typing_indicators (conversation_id, user_id, is_typing, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (conversation_id, user_id)
       DO UPDATE SET is_typing = EXCLUDED.is_typing, updated_at = NOW()`,
      [conversationId, userId, isTyping]
    );
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  async _assertMember(userId, conversationId) {
    const result = await pool.query(
      `SELECT id FROM conversations
       WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
      [conversationId, userId]
    );
    if (!result.rows[0]) throw err('Conversation not found or access denied', 404);
  }
}

module.exports = new ChatService();
