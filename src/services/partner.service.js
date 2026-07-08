'use strict';

const { pool } = require('../config/database');
const logger = require('../utils/logger');

// ── Helpers ──────────────────────────────────────────────────────────────────

function err(msg, code = 400) {
  return Object.assign(new Error(msg), { statusCode: code });
}

function randomCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let code = '';
  for (let i = 0; i < len; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const SHARING_FIELDS = [
  'share_period_dates',
  'share_fertile_window',
  'share_symptoms_moods',
  'share_cycle_insights',
  'share_sex_drive',
];

/**
 * Find active partnership for a user.
 * Returns { partnership, role } where role is 'a' or 'b'.
 */
async function findPartnership(userId) {
  const result = await pool.query(
    `SELECT * FROM partnerships
     WHERE (user_a_id = $1 OR user_b_id = $1) AND status = 'active'
     LIMIT 1`,
    [userId]
  );
  const p = result.rows[0];
  if (!p) return null;
  return { partnership: p, role: p.user_a_id === userId ? 'a' : 'b' };
}

function partnerId(partnership, myRole) {
  return myRole === 'a' ? partnership.user_b_id : partnership.user_a_id;
}

function myShareSettings(partnership, myRole) {
  const prefix = `${myRole}_share_`;
  return {
    share_period_dates: partnership[`${prefix}period_dates`],
    share_fertile_window: partnership[`${prefix}fertile_window`],
    share_symptoms_moods: partnership[`${prefix}symptoms_moods`],
    share_cycle_insights: partnership[`${prefix}cycle_insights`],
    share_sex_drive: partnership[`${prefix}sex_drive`],
  };
}

function partnerShareSettings(partnership, myRole) {
  // What the PARTNER allows me to see
  const theirRole = myRole === 'a' ? 'b' : 'a';
  return myShareSettings(partnership, theirRole);
}

// ── Phase calculation (mirrors cycleProfile.service) ─────────────────────────

const PHASE_DESCRIPTIONS = {
  menstrual: 'Your partner is in their period. They may need some extra care right now.',
  follicular: 'Your partner is in the follicular phase. Energy levels are rising.',
  ovulation: 'Your partner is in the ovulation period. Keep in touch and stay connected.',
  luteal: 'Your partner is in the luteal phase. They may experience mood changes.',
};

function calculatePhase(profile) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastPeriod = new Date(profile.last_period_start);
  lastPeriod.setHours(0, 0, 0, 0);

  const daysSince = Math.floor((today - lastPeriod) / 86_400_000);
  const cycleLength = profile.cycle_length || 28;
  const periodLength = profile.period_length || 5;
  const lutealLength = profile.luteal_phase_length || 14;

  const currentDay = (daysSince % cycleLength) + 1;
  const ovulationDay = cycleLength - lutealLength;
  const daysUntilPeriod = cycleLength - currentDay + 1;
  const daysUntilOvulation = ovulationDay - currentDay;

  let phase;
  if (currentDay <= periodLength) phase = 'menstrual';
  else if (currentDay < ovulationDay - 1) phase = 'follicular';
  else if (currentDay <= ovulationDay + 1) phase = 'ovulation';
  else phase = 'luteal';

  // Rough pregnancy chance
  let pregnancyChance;
  if (Math.abs(currentDay - ovulationDay) <= 2) pregnancyChance = 'High';
  else if (currentDay >= ovulationDay - 5 && currentDay < ovulationDay) pregnancyChance = 'Medium';
  else pregnancyChance = 'Low';

  return { currentDay, daysUntilPeriod, daysUntilOvulation, phase, ovulationDay, pregnancyChance };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Partner Service
// ═══════════════════════════════════════════════════════════════════════════════

class PartnerService {
  // ── Generate invite ─────────────────────────────────────────────────────────

  async generateInvite(senderId, sharingSettings = {}) {
    // Must not already have an active partner
    const existing = await findPartnership(senderId);
    if (existing)
      throw err('You already have an active partner. Unpair first to invite someone new.', 409);

    // Expire any previous pending invites from this user
    await pool.query(
      `UPDATE partner_invites SET status = 'expired'
       WHERE sender_id = $1 AND status = 'pending'`,
      [senderId]
    );

    // Generate unique code (retry on collision)
    let inviteCode;
    for (let i = 0; i < 5; i++) {
      const candidate = randomCode(6);
      const check = await pool.query(
        `SELECT id FROM partner_invites WHERE invite_code = $1 AND status = 'pending'`,
        [candidate]
      );
      if (check.rows.length === 0) {
        inviteCode = candidate;
        break;
      }
    }
    if (!inviteCode) throw err('Failed to generate unique invite code, please try again', 500);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const result = await pool.query(
      `INSERT INTO partner_invites
         (sender_id, invite_code, expires_at,
          share_period_dates, share_fertile_window, share_symptoms_moods,
          share_cycle_insights, share_sex_drive)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, invite_code, expires_at,
                 share_period_dates, share_fertile_window, share_symptoms_moods,
                 share_cycle_insights, share_sex_drive`,
      [
        senderId,
        inviteCode,
        expiresAt,
        sharingSettings.share_period_dates ?? true,
        sharingSettings.share_fertile_window ?? true,
        sharingSettings.share_symptoms_moods ?? false,
        sharingSettings.share_cycle_insights ?? false,
        sharingSettings.share_sex_drive ?? false,
      ]
    );

    const row = result.rows[0];
    const appUrl = process.env.APP_URL || 'https://satsflo.app';
    return {
      ...row,
      share_url: `${appUrl}/invite?code=${row.invite_code}`,
    };
  }

  // ── Invite status ───────────────────────────────────────────────────────────

  async getInviteStatus(senderId) {
    const result = await pool.query(
      `SELECT pi.id, pi.invite_code, pi.status, pi.expires_at,
              pi.share_period_dates, pi.share_fertile_window,
              pi.share_symptoms_moods, pi.share_cycle_insights, pi.share_sex_drive,
              u.id AS partner_id, u.name AS partner_name, u.avatar_url AS partner_avatar
       FROM partner_invites pi
       LEFT JOIN partnerships ps ON ps.user_a_id = pi.sender_id AND ps.status = 'active'
       LEFT JOIN users u ON u.id = ps.user_b_id
       WHERE pi.sender_id = $1
       ORDER BY pi.created_at DESC
       LIMIT 1`,
      [senderId]
    );

    const invite = result.rows[0];
    if (!invite) return { status: 'none' };

    // Auto-expire if past expiry
    if (invite.status === 'pending' && new Date(invite.expires_at) < new Date()) {
      await pool.query(`UPDATE partner_invites SET status = 'expired' WHERE id = $1`, [invite.id]);
      invite.status = 'expired';
    }

    return {
      invite_code: invite.invite_code,
      status: invite.status,
      expires_at: invite.expires_at,
      partner: invite.partner_id
        ? { id: invite.partner_id, name: invite.partner_name, avatar_url: invite.partner_avatar }
        : null,
    };
  }

  // ── Accept invite ───────────────────────────────────────────────────────────

  async acceptInvite(receiverId, inviteCode) {
    // Receiver must not already have a partner
    const existing = await findPartnership(receiverId);
    if (existing)
      throw err(
        'You already have an active partner. Unpair first to connect with someone new.',
        409
      );

    // Find invite
    const inviteResult = await pool.query(
      `SELECT * FROM partner_invites WHERE invite_code = $1 AND status = 'pending'`,
      [inviteCode.trim().toUpperCase()]
    );
    const invite = inviteResult.rows[0];
    if (!invite) throw err('Invalid or expired invite code', 404);
    if (new Date(invite.expires_at) < new Date()) {
      await pool.query(`UPDATE partner_invites SET status = 'expired' WHERE id = $1`, [invite.id]);
      throw err('This invite code has expired', 410);
    }
    logger.debug('acceptInvite comparison', {
      inviterId: invite.sender_id,
      acceptorId: receiverId,
    });
    if (invite.sender_id === receiverId) throw err('You cannot accept your own invite', 400);

    // Sender must not already have a partner (race condition guard)
    const senderExisting = await findPartnership(invite.sender_id);
    if (senderExisting) throw err('This invite is no longer valid', 409);

    // Create partnership (user_a = sender, user_b = receiver)
    const partnershipResult = await pool.query(
      `INSERT INTO partnerships
         (user_a_id, user_b_id,
          a_share_period_dates, a_share_fertile_window, a_share_symptoms_moods,
          a_share_cycle_insights, a_share_sex_drive)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_a_id, user_b_id, created_at`,
      [
        invite.sender_id,
        receiverId,
        invite.share_period_dates,
        invite.share_fertile_window,
        invite.share_symptoms_moods,
        invite.share_cycle_insights,
        invite.share_sex_drive,
      ]
    );

    // Mark invite accepted
    await pool.query(`UPDATE partner_invites SET status = 'accepted' WHERE id = $1`, [invite.id]);

    // Fetch partner (sender) info
    const partnerResult = await pool.query(`SELECT id, name, avatar_url FROM users WHERE id = $1`, [
      invite.sender_id,
    ]);
    const partner = partnerResult.rows[0];
    const ps = partnershipResult.rows[0];

    return {
      partnership_id: ps.id,
      partner: { id: partner.id, name: partner.name, avatar_url: partner.avatar_url },
    };
  }

  // ── Get current partner info ────────────────────────────────────────────────

  async getPartner(userId) {
    const found = await findPartnership(userId);
    if (!found) throw err('No active partner', 404);
    const { partnership, role } = found;
    const pId = partnerId(partnership, role);

    const partnerResult = await pool.query(`SELECT id, name, avatar_url FROM users WHERE id = $1`, [
      pId,
    ]);
    const partner = partnerResult.rows[0];

    const myRole = role;
    const myNickname = partnership[`${myRole}_my_nickname`];
    const partnerNickname = partnership[`${myRole}_partner_nickname`];
    const partnerMode = partnership[`${myRole}_partner_mode`];

    return {
      partnership_id: partnership.id,
      partner: { id: partner.id, name: partner.name, avatar_url: partner.avatar_url },
      my_nickname: myNickname,
      partner_nickname: partnerNickname,
      partner_mode_enabled: partnerMode,
      connected_since: partnership.created_at,
      my_sharing: myShareSettings(partnership, myRole),
    };
  }

  // ── Update nicknames ────────────────────────────────────────────────────────

  async updateNicknames(userId, { my_nickname, partner_nickname }) {
    const found = await findPartnership(userId);
    if (!found) throw err('No active partner', 404);
    const { partnership, role } = found;

    const updates = {};
    if (my_nickname !== undefined) updates[`${role}_my_nickname`] = my_nickname;
    if (partner_nickname !== undefined) updates[`${role}_partner_nickname`] = partner_nickname;

    if (Object.keys(updates).length === 0) throw err('No fields to update', 400);

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    const values = [partnership.id, ...Object.values(updates)];

    await pool.query(
      `UPDATE partnerships SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1`,
      values
    );

    return {
      my_nickname: my_nickname ?? partnership[`${role}_my_nickname`],
      partner_nickname: partner_nickname ?? partnership[`${role}_partner_nickname`],
    };
  }

  // ── Unpair ──────────────────────────────────────────────────────────────────

  async unpair(userId) {
    const found = await findPartnership(userId);
    if (!found) throw err('No active partner', 404);
    const { partnership } = found;

    await pool.query(
      `UPDATE partnerships SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [partnership.id]
    );

    return { unlinked: true };
  }

  // ── Sharing settings ────────────────────────────────────────────────────────

  async getSettings(userId) {
    const found = await findPartnership(userId);
    if (!found) throw err('No active partner', 404);
    const { partnership, role } = found;
    return myShareSettings(partnership, role);
  }

  async updateSettings(userId, settings) {
    const found = await findPartnership(userId);
    if (!found) throw err('No active partner', 404);
    const { partnership, role } = found;

    const setClauses = [];
    const values = [partnership.id];

    for (const field of SHARING_FIELDS) {
      if (settings[field] !== undefined) {
        values.push(settings[field]);
        setClauses.push(`${role}_${field} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) throw err('No settings to update', 400);

    const result = await pool.query(
      `UPDATE partnerships SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      values
    );

    return myShareSettings(result.rows[0], role);
  }

  // ── Partner mode toggle ─────────────────────────────────────────────────────

  async updatePartnerMode(userId, enabled) {
    const found = await findPartnership(userId);
    if (!found) throw err('No active partner', 404);
    const { partnership, role } = found;

    await pool.query(
      `UPDATE partnerships SET ${role}_partner_mode = $1, updated_at = NOW() WHERE id = $2`,
      [enabled, partnership.id]
    );

    return { partner_mode_enabled: enabled };
  }

  // ── Partner cycle data ──────────────────────────────────────────────────────

  async getPartnerCycle(userId) {
    const found = await findPartnership(userId);
    if (!found) throw err('No active partner', 404);
    const { partnership, role } = found;
    const pId = partnerId(partnership, role);
    const perms = partnerShareSettings(partnership, role);

    // Partner user info (for nickname header)
    const partnerUserResult = await pool.query(
      `SELECT id, name, avatar_url FROM users WHERE id = $1`,
      [pId]
    );
    const partnerUser = partnerUserResult.rows[0];

    // My nickname for the partner (what I call them — used as the cycle header)
    const myRole = role;
    const partnerNickname = partnership[`${myRole}_partner_nickname`] || partnerUser?.name;

    // Partner's cycle profile
    const profileResult = await pool.query(`SELECT * FROM cycle_profiles WHERE user_id = $1`, [
      pId,
    ]);
    const profile = profileResult.rows[0];
    if (!profile) throw err('Partner has not set up a cycle profile', 404);

    const { currentDay, daysUntilPeriod, daysUntilOvulation, phase, pregnancyChance } =
      calculatePhase(profile);

    const response = {
      partner_name: partnerUser?.name,
      partner_nickname: partnerNickname,
      partner_avatar_url: partnerUser?.avatar_url,
      cycle_day: currentDay,
      cycle_phase: phase,
      phase_description: PHASE_DESCRIPTIONS[phase] ?? '',
      next_period_days: daysUntilPeriod,
      next_ovulation_days: daysUntilOvulation,
      pregnancy_chance: pregnancyChance,
      todays_symptoms: null,
      moods: null,
      sex_drive: null,
    };

    if (perms.share_symptoms_moods) {
      const today = new Date().toISOString().slice(0, 10);

      // Read from day_logs (unified daily log)
      const logResult = await pool.query(
        `SELECT symptoms, moods FROM day_logs WHERE user_id = $1 AND log_date = $2`,
        [pId, today]
      );
      const log = logResult.rows[0];
      response.todays_symptoms = log?.symptoms ?? [];
      response.moods = log?.moods ?? [];
    }

    if (!perms.share_sex_drive) {
      delete response.sex_drive;
    }

    return response;
  }

  // ── Partner calendar data ───────────────────────────────────────────────────

  async getPartnerCalendar(userId) {
    const found = await findPartnership(userId);
    if (!found) throw err('No active partner', 404);
    const { partnership, role } = found;
    const pId = partnerId(partnership, role);
    const perms = partnerShareSettings(partnership, role);

    if (!perms.share_period_dates && !perms.share_fertile_window) {
      throw err('Partner has not shared calendar data', 403);
    }

    // Partner's cycle profile
    const profileResult = await pool.query(`SELECT * FROM cycle_profiles WHERE user_id = $1`, [
      pId,
    ]);
    const profile = profileResult.rows[0];
    if (!profile) throw err('Partner has not set up a cycle profile', 404);

    const { currentDay, ovulationDay } = calculatePhase(profile);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 86_400_000;

    const toDate = (offset) => {
      const d = new Date(today.getTime() + offset * msPerDay);
      return d.toISOString().slice(0, 10);
    };

    const response = {
      period_days: null,
      fertility_window: null,
      ovulation_day: null,
      cycle_count: null,
    };

    if (perms.share_period_dates) {
      // Next period start: daysUntilPeriod days from today
      const periodStart = profile.cycle_length - currentDay + 1;
      const periodDays = [];
      for (let i = 0; i < profile.period_length; i++) {
        periodDays.push(toDate(periodStart + i));
      }
      response.period_days = periodDays;
    }

    if (perms.share_fertile_window) {
      const fertileStart = ovulationDay - currentDay - 4; // 5 days before ovulation
      const fertileDays = [];
      for (let i = 0; i < 6; i++) {
        fertileDays.push(toDate(fertileStart + i));
      }
      response.fertility_window = fertileDays;
      response.ovulation_day = toDate(ovulationDay - currentDay);
    }

    // Cycle count from stored cycles
    const cycleCountResult = await pool.query(`SELECT COUNT(*) FROM cycles WHERE user_id = $1`, [
      pId,
    ]);
    response.cycle_count = parseInt(cycleCountResult.rows[0].count);

    return response;
  }
}

module.exports = new PartnerService();
