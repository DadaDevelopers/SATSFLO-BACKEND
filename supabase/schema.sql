-- ============================================================
-- SatsFlo Complete Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── CYCLE PROFILES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cycle_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_length    SMALLINT NOT NULL DEFAULT 28 CHECK (cycle_length BETWEEN 21 AND 35),
  period_length   SMALLINT NOT NULL DEFAULT 5  CHECK (period_length BETWEEN 3 AND 9),
  last_period_start DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_cycle_profiles_user ON cycle_profiles (user_id);

-- ─── DAY LOGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS day_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date        DATE NOT NULL,
  period_start    BOOLEAN NOT NULL DEFAULT FALSE,
  period_end      BOOLEAN NOT NULL DEFAULT FALSE,
  flow_level      TEXT CHECK (flow_level IN ('spotting','light','medium','heavy')),
  symptoms        TEXT[]   NOT NULL DEFAULT '{}',
  moods           TEXT[]   NOT NULL DEFAULT '{}',
  medicine        TEXT[]   NOT NULL DEFAULT '{}',
  note            TEXT,
  weight          NUMERIC(5,2),
  temperature     NUMERIC(4,2),
  water_intake    SMALLINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_day_logs_user       ON day_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_day_logs_user_date  ON day_logs (user_id, log_date DESC);

-- ─── WATER SETTINGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS water_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  water_target    SMALLINT NOT NULL DEFAULT 2000 CHECK (water_target > 0),
  cup_capacity    SMALLINT NOT NULL DEFAULT 250  CHECK (cup_capacity > 0),
  cup_style       TEXT NOT NULL DEFAULT 'standard',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_water_settings_user ON water_settings (user_id);

-- ─── JOURNAL ENTRIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date      DATE NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user       ON journal_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_journal_user_date  ON journal_entries (user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_month      ON journal_entries (user_id, DATE_TRUNC('month', entry_date));

-- ─── THREADS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  image_url       TEXT,
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_user       ON threads (user_id);
CREATE INDEX IF NOT EXISTS idx_threads_created    ON threads (created_at DESC);

-- ─── THREAD COMMENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thread_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thread_comments_thread ON thread_comments (thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_comments_user   ON thread_comments (user_id);

-- ─── THREAD LIKES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thread_likes (
  thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_likes_thread ON thread_likes (thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_likes_user   ON thread_likes (user_id);

-- ─── NOTIFICATIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  message         TEXT NOT NULL,
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user        ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created     ON notifications (created_at DESC);

-- ─── GIFT TRANSACTIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_sats     BIGINT NOT NULL CHECK (amount_sats > 0),
  thread_id       UUID REFERENCES threads(id) ON DELETE SET NULL,
  comment_id      UUID REFERENCES thread_comments(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_sender   ON gift_transactions (sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_receiver ON gift_transactions (receiver_id);

-- ─── UPDATED_AT TRIGGER FUNCTION ─────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cycle_profiles','day_logs','water_settings',
    'journal_entries','threads','thread_comments'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ─── AUTO-NOTIFICATION TRIGGERS ──────────────────────────────

-- Notify thread author when someone comments
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

CREATE TRIGGER trg_notify_comment
AFTER INSERT ON thread_comments
FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- Notify thread author when someone likes
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

CREATE TRIGGER trg_notify_like
AFTER INSERT ON thread_likes
FOR EACH ROW EXECUTE FUNCTION notify_on_like();

-- ─── RLS POLICIES ────────────────────────────────────────────
ALTER TABLE cycle_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_likes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;

-- cycle_profiles
CREATE POLICY "owner_all" ON cycle_profiles
  FOR ALL USING (auth.uid() = user_id);

-- day_logs
CREATE POLICY "owner_all" ON day_logs
  FOR ALL USING (auth.uid() = user_id);

-- water_settings
CREATE POLICY "owner_all" ON water_settings
  FOR ALL USING (auth.uid() = user_id);

-- journal_entries
CREATE POLICY "owner_all" ON journal_entries
  FOR ALL USING (auth.uid() = user_id);

-- threads (public read, owner write)
CREATE POLICY "public_read"  ON threads FOR SELECT USING (TRUE);
CREATE POLICY "owner_insert" ON threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON threads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON threads FOR DELETE USING (auth.uid() = user_id);

-- thread_comments (public read, owner write)
CREATE POLICY "public_read"  ON thread_comments FOR SELECT USING (TRUE);
CREATE POLICY "owner_insert" ON thread_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON thread_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON thread_comments FOR DELETE USING (auth.uid() = user_id);

-- thread_likes (public read, owner write)
CREATE POLICY "public_read"  ON thread_likes FOR SELECT USING (TRUE);
CREATE POLICY "owner_insert" ON thread_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON thread_likes FOR DELETE USING (auth.uid() = user_id);

-- notifications (owner only)
CREATE POLICY "owner_all" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- gift_transactions (participants only)
CREATE POLICY "participant_read" ON gift_transactions
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "sender_insert" ON gift_transactions
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
