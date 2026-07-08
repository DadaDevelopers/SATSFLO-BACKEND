'use strict';

/**
 * Migration: partner_system
 * Tables:
 *   - partner_invites   : invite codes with sharing preferences
 *   - partnerships      : active pairings with per-user sharing & nicknames
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS partner_invites (
      id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invite_code          VARCHAR(8)  NOT NULL UNIQUE,
      share_period_dates   BOOLEAN     NOT NULL DEFAULT true,
      share_fertile_window BOOLEAN     NOT NULL DEFAULT true,
      share_symptoms_moods BOOLEAN     NOT NULL DEFAULT false,
      share_cycle_insights BOOLEAN     NOT NULL DEFAULT false,
      share_sex_drive      BOOLEAN     NOT NULL DEFAULT false,
      status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'expired')),
      expires_at           TIMESTAMPTZ NOT NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_partner_invites_sender ON partner_invites (sender_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_partner_invites_code   ON partner_invites (invite_code)`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS partnerships (
      id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_a_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      -- user_a sharing permissions (what user_a shares with user_b)
      a_share_period_dates   BOOLEAN NOT NULL DEFAULT true,
      a_share_fertile_window BOOLEAN NOT NULL DEFAULT true,
      a_share_symptoms_moods BOOLEAN NOT NULL DEFAULT false,
      a_share_cycle_insights BOOLEAN NOT NULL DEFAULT false,
      a_share_sex_drive      BOOLEAN NOT NULL DEFAULT false,

      -- user_b sharing permissions (what user_b shares with user_a)
      b_share_period_dates   BOOLEAN NOT NULL DEFAULT true,
      b_share_fertile_window BOOLEAN NOT NULL DEFAULT true,
      b_share_symptoms_moods BOOLEAN NOT NULL DEFAULT false,
      b_share_cycle_insights BOOLEAN NOT NULL DEFAULT false,
      b_share_sex_drive      BOOLEAN NOT NULL DEFAULT false,

      -- Nicknames (each user sets their own perspective)
      a_my_nickname        VARCHAR(50),   -- what user_b calls user_a
      a_partner_nickname   VARCHAR(50),   -- what user_a calls user_b
      b_my_nickname        VARCHAR(50),   -- what user_a calls user_b
      b_partner_nickname   VARCHAR(50),   -- what user_b calls user_a

      -- Partner mode toggle per user
      a_partner_mode       BOOLEAN NOT NULL DEFAULT false,
      b_partner_mode       BOOLEAN NOT NULL DEFAULT false,

      status               VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE (user_a_id, user_b_id)
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_partnerships_user_a ON partnerships (user_a_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_partnerships_user_b ON partnerships (user_b_id)`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS partnerships`);
  pgm.sql(`DROP TABLE IF EXISTS partner_invites`);
};
