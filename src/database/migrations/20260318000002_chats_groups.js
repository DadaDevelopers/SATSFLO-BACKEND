'use strict';

/**
 * Migration: chats_groups
 * Tables:
 *   - conversations       : 1-to-1 DM channel
 *   - direct_messages     : messages in a DM conversation
 *   - typing_indicators   : ephemeral typing state (REST fallback)
 *   - groups              : group chat channel
 *   - group_members       : membership + role
 *   - group_messages      : messages in a group
 */

exports.up = (pgm) => {
  // ── DMs ─────────────────────────────────────────────────────────────────────

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS conversations (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_a_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_a_id, user_b_id),
      CHECK (user_a_id < user_b_id)
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_conversations_a ON conversations (user_a_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_conversations_b ON conversations (user_b_id)`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content         TEXT        NOT NULL,
      read_at         TIMESTAMPTZ,
      deleted_at      TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages (conversation_id, created_at DESC)`
  );
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_dm_sender       ON direct_messages (sender_id)`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS typing_indicators (
      conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_typing       BOOLEAN     NOT NULL DEFAULT false,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (conversation_id, user_id)
    )
  `);

  // ── Groups ──────────────────────────────────────────────────────────────────

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS groups (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL,
      description TEXT,
      created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS group_members (
      id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id  UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role      VARCHAR(20) NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin', 'member')),
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (group_id, user_id)
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members (group_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_group_members_user  ON group_members (user_id)`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id   UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      sender_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT        NOT NULL,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages (group_id, created_at DESC)`
  );
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS group_messages`);
  pgm.sql(`DROP TABLE IF EXISTS group_members`);
  pgm.sql(`DROP TABLE IF EXISTS groups`);
  pgm.sql(`DROP TABLE IF EXISTS typing_indicators`);
  pgm.sql(`DROP TABLE IF EXISTS direct_messages`);
  pgm.sql(`DROP TABLE IF EXISTS conversations`);
};
