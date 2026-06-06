/**
 * Initial Schema Migration
 *
 * Creates all tables for the SatsFlow application.
 * Replaces Supabase auth.users with our own users table + manual JWT auth.
 *
 * Table creation order (respects foreign key dependencies):
 *  1.  users                — core auth table
 *  2.  refresh_tokens       — JWT refresh token store
 *  3.  password_resets      — password reset token store
 *  4.  health_profiles      — per-user health config
 *  5.  cycles               — menstrual cycle records
 *  6.  cycle_logs           — daily entries within a cycle
 *  7.  cycle_profiles       — simplified cycle profile (frontend widget)
 *  8.  symptoms             — symptom logs
 *  9.  moods                — mood logs
 *  10. day_logs             — general daily log (water, sleep, etc.)
 *  11. water_settings       — water intake settings
 *  12. journal_entries      — private journal
 *  13. threads              — community posts
 *  14. thread_comments      — comments on threads
 *  15. thread_likes         — likes on threads
 *  16. notifications        — in-app notifications
 *  17. gift_transactions    — Lightning Bitcoin tips (reserved)
 *  18. forums               — forum categories (reserved)
 *  19. Triggers & indexes
 */

/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

// ─── UP ───────────────────────────────────────────────────────────────────────

exports.up = async (pgm) => {
  // Extensions
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  // ── 1. USERS ────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users (
      id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      email                 VARCHAR(255)  NOT NULL UNIQUE,
      password_hash         VARCHAR(255)  NOT NULL,
      name                  VARCHAR(255)  NOT NULL,
      date_of_birth         DATE,
      avatar_url            TEXT,
      timezone              VARCHAR(100)  NOT NULL DEFAULT 'UTC',
      language              VARCHAR(10)   NOT NULL DEFAULT 'en',
      role                  VARCHAR(20)   NOT NULL DEFAULT 'user'
                              CHECK (role IN ('user', 'admin', 'moderator')),
      status                VARCHAR(20)   NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
      email_verified        BOOLEAN       NOT NULL DEFAULT FALSE,
      verification_token    VARCHAR(255),
      verification_expires  TIMESTAMPTZ,
      preferences           JSONB,
      last_login            TIMESTAMPTZ,
      deleted_at            TIMESTAMPTZ,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_users_email  ON users (email)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_users_status ON users (status)`);

  // ── 2. REFRESH TOKENS ───────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT        NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      revoked     BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens (user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens (token)`);
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active  ON refresh_tokens (user_id, revoked) WHERE revoked = FALSE`
  );

  // ── 3. PASSWORD RESETS ──────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       VARCHAR(255) NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ  NOT NULL,
      used        BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_password_resets_user  ON password_resets (user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token)`);

  // ── 4. HEALTH PROFILES ──────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS health_profiles (
      id                      UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                 UUID     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      average_cycle_length    SMALLINT NOT NULL DEFAULT 28 CHECK (average_cycle_length BETWEEN 18 AND 45),
      average_period_length   SMALLINT NOT NULL DEFAULT 5  CHECK (average_period_length BETWEEN 1 AND 14),
      birth_control_method    VARCHAR(100),
      health_conditions       TEXT,
      medications             TEXT,
      last_period_date        DATE,
      is_pregnant             BOOLEAN  NOT NULL DEFAULT FALSE,
      is_trying_to_conceive   BOOLEAN  NOT NULL DEFAULT FALSE,
      notes                   TEXT,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_health_profiles_user ON health_profiles (user_id)`);

  // ── 5. CYCLES ───────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS cycles (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date       DATE NOT NULL,
      end_date         DATE,
      period_end_date  DATE,
      period_length    SMALLINT CHECK (period_length BETWEEN 1 AND 14),
      cycle_length     SMALLINT CHECK (cycle_length BETWEEN 18 AND 45),
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_cycles_user         ON cycles (user_id)`);
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_cycles_user_start   ON cycles (user_id, start_date DESC)`
  );
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_cycles_active       ON cycles (user_id, end_date) WHERE end_date IS NULL`
  );

  // ── 6. CYCLE LOGS ───────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS cycle_logs (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cycle_id            UUID REFERENCES cycles(id) ON DELETE SET NULL,
      date                DATE NOT NULL,
      flow_intensity      VARCHAR(20) CHECK (flow_intensity IN ('spotting','light','medium','heavy')),
      temperature         NUMERIC(4,1),
      cervical_mucus      VARCHAR(50),
      sexual_activity     BOOLEAN,
      contraception_used  BOOLEAN,
      notes               TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ,
      UNIQUE (user_id, date)
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_cycle_logs_user       ON cycle_logs (user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_cycle_logs_cycle      ON cycle_logs (cycle_id)`);
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_cycle_logs_user_date  ON cycle_logs (user_id, date DESC)`
  );

  // ── 7. CYCLE PROFILES (simplified widget) ───────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS cycle_profiles (
      id                 UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            UUID     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      cycle_length       SMALLINT NOT NULL DEFAULT 28 CHECK (cycle_length BETWEEN 21 AND 35),
      period_length      SMALLINT NOT NULL DEFAULT 5  CHECK (period_length BETWEEN 3 AND 9),
      last_period_start  DATE     NOT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_cycle_profiles_user ON cycle_profiles (user_id)`);

  // ── 8. SYMPTOMS ─────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS symptoms (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date        DATE        NOT NULL,
      symptom     VARCHAR(100) NOT NULL,
      category    VARCHAR(50) NOT NULL
                    CHECK (category IN ('physical','emotional','pain','digestive','skin','sleep')),
      severity    SMALLINT    NOT NULL DEFAULT 2 CHECK (severity BETWEEN 1 AND 5),
      time_of_day VARCHAR(20) CHECK (time_of_day IN ('morning','afternoon','evening','night')),
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_symptoms_user       ON symptoms (user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_symptoms_user_date  ON symptoms (user_id, date DESC)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_symptoms_category   ON symptoms (user_id, category)`);

  // ── 9. MOODS ────────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS moods (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date        DATE        NOT NULL,
      mood        VARCHAR(50) NOT NULL
                    CHECK (mood IN ('happy','sad','irritable','anxious','energetic',
                                    'tired','calm','stressed','emotional','confident')),
      intensity   SMALLINT    NOT NULL DEFAULT 3 CHECK (intensity BETWEEN 1 AND 5),
      notes       TEXT,
      triggers    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_moods_user       ON moods (user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_moods_user_date  ON moods (user_id, date DESC)`);

  // ── 10. DAY LOGS ────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS day_logs (
      id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date      DATE    NOT NULL,
      period_start  BOOLEAN NOT NULL DEFAULT FALSE,
      period_end    BOOLEAN NOT NULL DEFAULT FALSE,
      flow_level    TEXT    CHECK (flow_level IN ('spotting','light','medium','heavy')),
      symptoms      TEXT[]  NOT NULL DEFAULT '{}',
      moods         TEXT[]  NOT NULL DEFAULT '{}',
      medicine      TEXT[]  NOT NULL DEFAULT '{}',
      note          TEXT,
      weight        NUMERIC(5,2),
      temperature   NUMERIC(4,2),
      water_intake  SMALLINT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, log_date)
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_day_logs_user       ON day_logs (user_id)`);
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_day_logs_user_date  ON day_logs (user_id, log_date DESC)`
  );

  // ── 11. WATER SETTINGS ──────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS water_settings (
      id            UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      water_target  SMALLINT NOT NULL DEFAULT 2000 CHECK (water_target > 0),
      cup_capacity  SMALLINT NOT NULL DEFAULT 250  CHECK (cup_capacity > 0),
      cup_style     TEXT     NOT NULL DEFAULT 'standard',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_water_settings_user ON water_settings (user_id)`);

  // ── 12. JOURNAL ENTRIES ─────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_date  DATE NOT NULL,
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_journal_user       ON journal_entries (user_id)`);
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_journal_user_date  ON journal_entries (user_id, entry_date DESC)`
  );

  // ── 13. THREADS ─────────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS threads (
      id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content     TEXT    NOT NULL,
      image_url   TEXT,
      is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_threads_user     ON threads (user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_threads_created  ON threads (created_at DESC)`);

  // ── 14. THREAD COMMENTS ─────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS thread_comments (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id   UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_thread_comments_thread ON thread_comments (thread_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_thread_comments_user   ON thread_comments (user_id)`);

  // ── 15. THREAD LIKES ────────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS thread_likes (
      thread_id   UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (thread_id, user_id)
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_thread_likes_thread ON thread_likes (thread_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_thread_likes_user   ON thread_likes (user_id)`);

  // ── 16. NOTIFICATIONS ───────────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id    UUID    REFERENCES users(id) ON DELETE SET NULL,
      type        TEXT    NOT NULL,
      message     TEXT    NOT NULL,
      is_read     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_notifications_user        ON notifications (user_id)`);
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = FALSE`
  );
  pgm.sql(
    `CREATE INDEX IF NOT EXISTS idx_notifications_created     ON notifications (created_at DESC)`
  );

  // ── 17. GIFT TRANSACTIONS (Lightning — reserved for Isabellah) ─────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS gift_transactions (
      id           UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id    UUID   NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      receiver_id  UUID   NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      amount_sats  BIGINT NOT NULL CHECK (amount_sats > 0),
      thread_id    UUID   REFERENCES threads(id) ON DELETE SET NULL,
      comment_id   UUID   REFERENCES thread_comments(id) ON DELETE SET NULL,
      status       TEXT   NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','completed','failed')),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_gift_sender   ON gift_transactions (sender_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_gift_receiver ON gift_transactions (receiver_id)`);

  // ── 18. FORUMS (reserved) ───────────────────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS forums (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(255) NOT NULL,
      slug        VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_forums_slug ON forums (slug)`);

  // ── 19. TRIGGERS ────────────────────────────────────────────────────────────

  // Generic updated_at trigger function
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$
  `);

  // Apply updated_at trigger to all relevant tables
  const updatedAtTables = [
    'users',
    'health_profiles',
    'cycles',
    'cycle_logs',
    'cycle_profiles',
    'symptoms',
    'moods',
    'day_logs',
    'water_settings',
    'journal_entries',
    'threads',
    'thread_comments',
  ];

  for (const table of updatedAtTables) {
    pgm.sql(`
      CREATE TRIGGER set_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
  }

  // Auto-notify thread author when someone comments
  pgm.sql(`
    CREATE OR REPLACE FUNCTION notify_on_comment()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE
      v_thread_owner UUID;
    BEGIN
      SELECT user_id INTO v_thread_owner FROM threads WHERE id = NEW.thread_id;
      IF v_thread_owner IS DISTINCT FROM NEW.user_id THEN
        INSERT INTO notifications (user_id, type, message, actor_id)
        VALUES (v_thread_owner, 'comment', 'Someone commented on your post', NEW.user_id);
      END IF;
      RETURN NEW;
    END;
    $$
  `);

  pgm.sql(`
    CREATE TRIGGER trg_notify_comment
    AFTER INSERT ON thread_comments
    FOR EACH ROW EXECUTE FUNCTION notify_on_comment()
  `);

  // Auto-notify thread author when someone likes
  pgm.sql(`
    CREATE OR REPLACE FUNCTION notify_on_like()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE
      v_thread_owner UUID;
    BEGIN
      SELECT user_id INTO v_thread_owner FROM threads WHERE id = NEW.thread_id;
      IF v_thread_owner IS DISTINCT FROM NEW.user_id THEN
        INSERT INTO notifications (user_id, type, message, actor_id)
        VALUES (v_thread_owner, 'like', 'Someone liked your post', NEW.user_id);
      END IF;
      RETURN NEW;
    END;
    $$
  `);

  pgm.sql(`
    CREATE TRIGGER trg_notify_like
    AFTER INSERT ON thread_likes
    FOR EACH ROW EXECUTE FUNCTION notify_on_like()
  `);
};

// ─── DOWN ─────────────────────────────────────────────────────────────────────

exports.down = async (pgm) => {
  // Drop triggers first
  pgm.sql(`DROP TRIGGER IF EXISTS trg_notify_like    ON thread_likes`);
  pgm.sql(`DROP TRIGGER IF EXISTS trg_notify_comment ON thread_comments`);

  const updatedAtTables = [
    'thread_comments',
    'threads',
    'journal_entries',
    'water_settings',
    'day_logs',
    'moods',
    'symptoms',
    'cycle_logs',
    'cycle_profiles',
    'cycles',
    'health_profiles',
    'users',
  ];
  for (const table of updatedAtTables) {
    pgm.sql(`DROP TRIGGER IF EXISTS set_${table}_updated_at ON ${table}`);
  }

  // Drop functions
  pgm.sql(`DROP FUNCTION IF EXISTS notify_on_like()`);
  pgm.sql(`DROP FUNCTION IF EXISTS notify_on_comment()`);
  pgm.sql(`DROP FUNCTION IF EXISTS set_updated_at()`);

  // Drop tables in reverse dependency order
  pgm.sql(`DROP TABLE IF EXISTS gift_transactions`);
  pgm.sql(`DROP TABLE IF EXISTS forums`);
  pgm.sql(`DROP TABLE IF EXISTS notifications`);
  pgm.sql(`DROP TABLE IF EXISTS thread_likes`);
  pgm.sql(`DROP TABLE IF EXISTS thread_comments`);
  pgm.sql(`DROP TABLE IF EXISTS threads`);
  pgm.sql(`DROP TABLE IF EXISTS journal_entries`);
  pgm.sql(`DROP TABLE IF EXISTS water_settings`);
  pgm.sql(`DROP TABLE IF EXISTS day_logs`);
  pgm.sql(`DROP TABLE IF EXISTS moods`);
  pgm.sql(`DROP TABLE IF EXISTS symptoms`);
  pgm.sql(`DROP TABLE IF EXISTS cycle_profiles`);
  pgm.sql(`DROP TABLE IF EXISTS cycle_logs`);
  pgm.sql(`DROP TABLE IF EXISTS cycles`);
  pgm.sql(`DROP TABLE IF EXISTS health_profiles`);
  pgm.sql(`DROP TABLE IF EXISTS password_resets`);
  pgm.sql(`DROP TABLE IF EXISTS refresh_tokens`);
  pgm.sql(`DROP TABLE IF EXISTS users`);
};
