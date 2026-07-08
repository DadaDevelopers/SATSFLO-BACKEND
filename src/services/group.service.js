'use strict';

const { pool } = require('../config/database');

function err(msg, code = 400) {
  return Object.assign(new Error(msg), { statusCode: code });
}

class GroupService {
  // ── List groups for a user ──────────────────────────────────────────────────

  async getGroups(userId) {
    const result = await pool.query(
      `SELECT
         g.id, g.name, g.description, g.created_by, g.created_at,
         gm.role AS my_role,
         (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count,
         (SELECT COUNT(*) FROM group_messages WHERE group_id = g.id AND deleted_at IS NULL) AS message_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );
    return result.rows.map((g) => ({
      ...g,
      member_count: parseInt(g.member_count),
      message_count: parseInt(g.message_count),
    }));
  }

  // ── Create group ────────────────────────────────────────────────────────────

  async createGroup(userId, { name, description, member_ids = [] }) {
    if (!name?.trim()) throw err('name is required');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const groupResult = await client.query(
        `INSERT INTO groups (name, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, name, description, created_by, created_at`,
        [name.trim(), description || null, userId]
      );
      const group = groupResult.rows[0];

      // Add creator as admin
      const memberSet = new Set([userId, ...member_ids]);
      const insertValues = [];
      const insertParams = [];
      let paramIndex = 1;

      for (const memberId of memberSet) {
        const role = memberId === userId ? 'admin' : 'member';
        insertValues.push(group.id, memberId, role);
        insertParams.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
        paramIndex += 3;
      }

      await client.query(
        `INSERT INTO group_members (group_id, user_id, role) VALUES ${insertParams.join(', ')}
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        insertValues
      );

      await client.query('COMMIT');
      return { ...group, member_count: memberSet.size };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ── Get group info + members ────────────────────────────────────────────────

  async getGroup(userId, groupId) {
    await this._assertMember(userId, groupId);

    const [groupResult, membersResult] = await Promise.all([
      pool.query(
        `SELECT id, name, description, created_by, created_at, updated_at FROM groups WHERE id = $1`,
        [groupId]
      ),
      pool.query(
        `SELECT u.id, u.name, u.avatar_url, gm.role, gm.joined_at
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1
         ORDER BY gm.joined_at`,
        [groupId]
      ),
    ]);

    if (!groupResult.rows[0]) throw err('Group not found', 404);

    return { ...groupResult.rows[0], members: membersResult.rows };
  }

  // ── Update group ────────────────────────────────────────────────────────────

  async updateGroup(userId, groupId, { name, description }) {
    await this._assertAdmin(userId, groupId);

    const fields = [];
    const values = [groupId];

    if (name !== undefined) {
      values.push(name.trim());
      fields.push(`name = $${values.length}`);
    }
    if (description !== undefined) {
      values.push(description);
      fields.push(`description = $${values.length}`);
    }

    if (fields.length === 0) throw err('No fields to update');

    fields.push(`updated_at = NOW()`);
    const result = await pool.query(
      `UPDATE groups SET ${fields.join(', ')} WHERE id = $1 RETURNING id, name, description, updated_at`,
      values
    );
    return result.rows[0];
  }

  // ── Delete group ────────────────────────────────────────────────────────────

  async deleteGroup(userId, groupId) {
    await this._assertAdmin(userId, groupId);
    await pool.query('DELETE FROM groups WHERE id = $1', [groupId]);
  }

  // ── Add member ──────────────────────────────────────────────────────────────

  async addMember(userId, groupId, targetUserId) {
    await this._assertAdmin(userId, groupId);

    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (!userExists.rows[0]) throw err('User not found', 404);

    await pool.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, targetUserId]
    );
  }

  // ── Remove member ───────────────────────────────────────────────────────────

  async removeMember(userId, groupId, targetUserId) {
    await this._assertAdmin(userId, groupId);

    if (userId === targetUserId) throw err('Use POST /leave to leave the group', 400);

    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [
      groupId,
      targetUserId,
    ]);
  }

  // ── Leave group ─────────────────────────────────────────────────────────────

  async leaveGroup(userId, groupId) {
    await this._assertMember(userId, groupId);

    // If user is the only admin, block leave
    const adminResult = await pool.query(
      `SELECT user_id FROM group_members WHERE group_id = $1 AND role = 'admin'`,
      [groupId]
    );
    const admins = adminResult.rows.map((r) => r.user_id);
    if (admins.length === 1 && admins[0] === userId) {
      throw err('Assign another admin before leaving the group', 400);
    }

    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [
      groupId,
      userId,
    ]);
  }

  // ── Get group messages ──────────────────────────────────────────────────────

  async getMessages(userId, groupId, { page = 1, limit = 50 } = {}) {
    await this._assertMember(userId, groupId);

    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT
         gm.id, gm.content, gm.sender_id, gm.created_at,
         u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM group_messages gm
       JOIN users u ON u.id = gm.sender_id
       WHERE gm.group_id = $1 AND gm.deleted_at IS NULL
       ORDER BY gm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    );

    return result.rows.map((m) => ({
      id: m.id,
      content: m.content,
      sender_id: m.sender_id,
      sender: { id: m.sender_id, name: m.sender_name, avatar_url: m.sender_avatar },
      created_at: m.created_at,
    }));
  }

  // ── Send group message ──────────────────────────────────────────────────────

  async sendMessage(userId, groupId, content) {
    await this._assertMember(userId, groupId);

    const result = await pool.query(
      `INSERT INTO group_messages (group_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, sender_id, created_at`,
      [groupId, userId, content]
    );
    return result.rows[0];
  }

  // ── Delete group message ────────────────────────────────────────────────────

  async deleteMessage(userId, groupId, messageId) {
    const result = await pool.query(
      `SELECT sender_id FROM group_messages WHERE id = $1 AND group_id = $2 AND deleted_at IS NULL`,
      [messageId, groupId]
    );
    if (!result.rows[0]) throw err('Message not found', 404);

    // Sender or group admin can delete
    if (result.rows[0].sender_id !== userId) {
      const adminCheck = await pool.query(
        `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin'`,
        [groupId, userId]
      );
      if (!adminCheck.rows[0]) throw err('Not authorised to delete this message', 403);
    }

    await pool.query(`UPDATE group_messages SET deleted_at = NOW() WHERE id = $1`, [messageId]);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async _assertMember(userId, groupId) {
    const result = await pool.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (!result.rows[0]) throw err('Group not found or access denied', 404);
    return result.rows[0].role;
  }

  async _assertAdmin(userId, groupId) {
    const result = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (!result.rows[0]) throw err('Group not found or access denied', 404);
    if (result.rows[0].role !== 'admin')
      throw err('Only group admins can perform this action', 403);
  }
}

module.exports = new GroupService();
