-- ============================================
-- SATSFLOW DATABASE SCHEMA
-- Supabase PostgreSQL
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    date_of_birth DATE,
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(64),
    verification_expires TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- HEALTH PROFILES TABLE
-- Stores user's health settings and encrypted medical info
-- ============================================
CREATE TABLE IF NOT EXISTS health_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    average_cycle_length INTEGER DEFAULT 28 CHECK (average_cycle_length BETWEEN 21 AND 45),
    average_period_length INTEGER DEFAULT 5 CHECK (average_period_length BETWEEN 1 AND 10),
    birth_control_method VARCHAR(100),
    health_conditions TEXT,  -- Encrypted JSON array
    medications TEXT,        -- Encrypted JSON array
    notes TEXT,              -- Encrypted
    last_period_date DATE,
    is_pregnant BOOLEAN DEFAULT FALSE,
    is_trying_to_conceive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for health profiles
CREATE INDEX idx_health_profiles_user_id ON health_profiles(user_id);

-- ============================================
-- CYCLES TABLE
-- Tracks menstrual cycles
-- ============================================
CREATE TABLE IF NOT EXISTS cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,                    -- Cycle end (next period start - 1)
    period_end_date DATE,             -- When bleeding stopped
    period_length INTEGER,
    cycle_length INTEGER,
    notes TEXT,                       -- Encrypted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cycles
CREATE INDEX idx_cycles_user_id ON cycles(user_id);
CREATE INDEX idx_cycles_start_date ON cycles(start_date DESC);
CREATE INDEX idx_cycles_user_start ON cycles(user_id, start_date DESC);

-- ============================================
-- CYCLE LOGS TABLE
-- Daily entries within a cycle
-- ============================================
CREATE TABLE IF NOT EXISTS cycle_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    flow_intensity VARCHAR(20) CHECK (flow_intensity IN ('spotting', 'light', 'medium', 'heavy')),
    temperature DECIMAL(4,2),         -- Basal body temperature
    cervical_mucus VARCHAR(20) CHECK (cervical_mucus IN ('dry', 'sticky', 'creamy', 'watery', 'egg_white')),
    sexual_activity BOOLEAN,
    contraception_used BOOLEAN,
    notes TEXT,                       -- Encrypted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Indexes for cycle logs
CREATE INDEX idx_cycle_logs_user_id ON cycle_logs(user_id);
CREATE INDEX idx_cycle_logs_date ON cycle_logs(date DESC);
CREATE INDEX idx_cycle_logs_cycle_id ON cycle_logs(cycle_id);

-- ============================================
-- SYMPTOMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS symptoms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    symptom VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'physical' CHECK (category IN ('physical', 'emotional', 'pain', 'digestive', 'skin', 'sleep')),
    severity INTEGER DEFAULT 2 CHECK (severity BETWEEN 1 AND 3),
    time_of_day VARCHAR(20) CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night', 'all_day')),
    notes TEXT,                       -- Encrypted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for symptoms
CREATE INDEX idx_symptoms_user_id ON symptoms(user_id);
CREATE INDEX idx_symptoms_date ON symptoms(date DESC);
CREATE INDEX idx_symptoms_user_date ON symptoms(user_id, date DESC);
CREATE INDEX idx_symptoms_symptom ON symptoms(symptom);

-- ============================================
-- MOODS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS moods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mood VARCHAR(50) NOT NULL CHECK (mood IN ('happy', 'sad', 'irritable', 'anxious', 'energetic', 'tired', 'calm', 'stressed', 'emotional', 'confident')),
    intensity INTEGER DEFAULT 3 CHECK (intensity BETWEEN 1 AND 5),
    notes TEXT,                       -- Encrypted
    triggers TEXT,                    -- Encrypted JSON array
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for moods
CREATE INDEX idx_moods_user_id ON moods(user_id);
CREATE INDEX idx_moods_date ON moods(date DESC);
CREATE INDEX idx_moods_user_date ON moods(user_id, date DESC);

-- ============================================
-- PREDICTIONS TABLE
-- Stores calculated predictions for performance
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prediction_date DATE NOT NULL,    -- Date prediction was made
    next_period_date DATE,
    ovulation_date DATE,
    fertile_window_start DATE,
    fertile_window_end DATE,
    confidence_score DECIMAL(3,2),    -- 0.00 to 1.00
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for predictions
CREATE INDEX idx_predictions_user_id ON predictions(user_id);

-- ============================================
-- REFRESH TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for refresh tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================
-- PASSWORD RESETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for password resets
CREATE INDEX idx_password_resets_token ON password_resets(token);

-- ============================================
-- RESERVED FOR DEV 2: LIGHTNING/COMMUNITY
-- ============================================

-- WALLETS TABLE (Lightning Network)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance_sats BIGINT DEFAULT 0,
    lightning_address VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REWARDS TABLE
CREATE TABLE IF NOT EXISTS rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_sats INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FORUMS TABLE
CREATE TABLE IF NOT EXISTS forums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    slug VARCHAR(100) UNIQUE NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FORUM POSTS TABLE
CREATE TABLE IF NOT EXISTS forum_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    forum_id UUID NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MESSAGES TABLE (Direct messaging)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,          -- Encrypted
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_own_data ON users FOR ALL USING (id = auth.uid());
CREATE POLICY health_profiles_own_data ON health_profiles FOR ALL USING (user_id = auth.uid());
CREATE POLICY cycles_own_data ON cycles FOR ALL USING (user_id = auth.uid());
CREATE POLICY cycle_logs_own_data ON cycle_logs FOR ALL USING (user_id = auth.uid());
CREATE POLICY symptoms_own_data ON symptoms FOR ALL USING (user_id = auth.uid());
CREATE POLICY moods_own_data ON moods FOR ALL USING (user_id = auth.uid());
CREATE POLICY predictions_own_data ON predictions FOR ALL USING (user_id = auth.uid());
CREATE POLICY wallets_own_data ON wallets FOR ALL USING (user_id = auth.uid());
CREATE POLICY rewards_own_data ON rewards FOR ALL USING (user_id = auth.uid());

-- Messages policy (sender or receiver)
CREATE POLICY messages_own_data ON messages FOR ALL
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Forum posts are public (for reading)
CREATE POLICY forum_posts_read ON forum_posts FOR SELECT USING (true);
CREATE POLICY forum_posts_write ON forum_posts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY forum_posts_update ON forum_posts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY forum_posts_delete ON forum_posts FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_profiles_updated_at BEFORE UPDATE ON health_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cycles_updated_at BEFORE UPDATE ON cycles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cycle_logs_updated_at BEFORE UPDATE ON cycle_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_symptoms_updated_at BEFORE UPDATE ON symptoms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_moods_updated_at BEFORE UPDATE ON moods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate cycle length when a new cycle starts
CREATE OR REPLACE FUNCTION calculate_previous_cycle_length()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the previous cycle's end_date and cycle_length
    UPDATE cycles
    SET
        end_date = NEW.start_date - INTERVAL '1 day',
        cycle_length = NEW.start_date - start_date
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND end_date IS NULL
      AND start_date < NEW.start_date;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_cycle_length AFTER INSERT ON cycles
    FOR EACH ROW EXECUTE FUNCTION calculate_previous_cycle_length();

-- ============================================
-- CLEANUP JOBS (run periodically)
-- ============================================

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    -- Delete expired refresh tokens
    DELETE FROM refresh_tokens WHERE expires_at < NOW();

    -- Delete expired password reset tokens
    DELETE FROM password_resets WHERE expires_at < NOW();

    -- Delete expired verification tokens
    UPDATE users
    SET verification_token = NULL, verification_expires = NULL
    WHERE verification_expires < NOW();
END;
$$ language 'plpgsql';

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE users IS 'User accounts and authentication data';
COMMENT ON TABLE health_profiles IS 'User health settings - sensitive fields are encrypted';
COMMENT ON TABLE cycles IS 'Menstrual cycle tracking';
COMMENT ON TABLE cycle_logs IS 'Daily entries within a cycle';
COMMENT ON TABLE symptoms IS 'Physical and emotional symptom tracking';
COMMENT ON TABLE moods IS 'Mood tracking with intensity levels';
COMMENT ON TABLE predictions IS 'Calculated predictions for period and ovulation';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for authentication';
COMMENT ON TABLE wallets IS 'Lightning Network wallets for Bitcoin rewards';
COMMENT ON TABLE rewards IS 'Earned satoshi rewards history';
COMMENT ON TABLE forums IS 'Community discussion forums';
COMMENT ON TABLE forum_posts IS 'Forum posts and replies';
COMMENT ON TABLE messages IS 'Direct messages between users - content is encrypted';
