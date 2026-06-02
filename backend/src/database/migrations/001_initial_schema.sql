-- ============================================================================
-- KHASINO DATABASE SCHEMA - INITIAL MIGRATION
-- Version: 1.0
-- Description: Complete database schema for Khasino card game platform
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create updated_at trigger function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,
    avatar_url VARCHAR(500),
    country_code VARCHAR(2) NOT NULL,
    preferred_language VARCHAR(5) DEFAULT 'en',
    is_premium BOOLEAN DEFAULT false,
    premium_expires_at TIMESTAMP WITH TIME ZONE,
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'banned', 'deleted')),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_premium_expiry CHECK (
        (is_premium = false AND premium_expires_at IS NULL) OR
        (is_premium = true AND premium_expires_at IS NOT NULL)
    )
);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MATCHES & GAMEPLAY
-- ============================================================================

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('casual', 'ranked', 'tournament', 'private')),
    game_mode VARCHAR(20) NOT NULL CHECK (game_mode IN ('two_player', 'three_player', 'four_player', 'partnership')),
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
    current_round INT DEFAULT 1 CHECK (current_round IN (1, 2)),
    current_turn_player_id UUID REFERENCES users(id),
    dealer_id UUID NOT NULL REFERENCES users(id),
    winner_id UUID REFERENCES users(id),
    scoring_mode VARCHAR(20) NOT NULL CHECK (scoring_mode IN ('eleven_point', 'seven_point')),
    tournament_id UUID,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE match_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    position INT NOT NULL CHECK (position BETWEEN 0 AND 3),
    is_ai BOOLEAN DEFAULT false,
    ai_difficulty VARCHAR(20) CHECK (ai_difficulty IN ('easy', 'medium', 'hard', 'expert')),
    partner_id UUID REFERENCES match_players(id),
    final_score INT DEFAULT 0,
    cards_captured INT DEFAULT 0,
    spades_captured INT DEFAULT 0,
    rank_change INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_ai_player CHECK (
        (is_ai = false AND user_id IS NOT NULL AND ai_difficulty IS NULL) OR
        (is_ai = true AND user_id IS NULL AND ai_difficulty IS NOT NULL)
    ),
    UNIQUE(match_id, position)
);

CREATE TRIGGER update_match_players_updated_at BEFORE UPDATE ON match_players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE game_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    turn_number INT NOT NULL,
    current_player_id UUID NOT NULL REFERENCES users(id),
    deck_remaining INT NOT NULL CHECK (deck_remaining BETWEEN 0 AND 40),
    state_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(match_id, turn_number)
);

CREATE TABLE moves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES match_players(id),
    turn_number INT NOT NULL,
    move_type VARCHAR(20) NOT NULL CHECK (move_type IN ('capture', 'build', 'change_build', 'augment', 'drift', 'stash')),
    card_played JSONB NOT NULL,
    targets JSONB,
    result JSONB,
    time_taken_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE builds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES match_players(id),
    value INT NOT NULL CHECK (value BETWEEN 1 AND 10),
    is_compound BOOLEAN DEFAULT false,
    cards JSONB NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_builds_updated_at BEFORE UPDATE ON builds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TOURNAMENTS
-- ============================================================================

CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    tournament_type VARCHAR(20) NOT NULL CHECK (tournament_type IN ('single_elimination', 'double_elimination', 'round_robin')),
    entry_fee DECIMAL(10,2) DEFAULT 0 CHECK (entry_fee >= 0),
    prize_pool DECIMAL(10,2) DEFAULT 0 CHECK (prize_pool >= 0),
    max_players INT NOT NULL CHECK (max_players > 0),
    current_players INT DEFAULT 0 CHECK (current_players >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'active', 'completed', 'cancelled')),
    game_mode VARCHAR(20) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    rules JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE matches ADD CONSTRAINT fk_matches_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id);

CREATE TABLE tournament_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    seed INT,
    current_round INT DEFAULT 0,
    wins INT DEFAULT 0 CHECK (wins >= 0),
    losses INT DEFAULT 0 CHECK (losses >= 0),
    points INT DEFAULT 0,
    final_position INT,
    prize_amount DECIMAL(10,2),
    eliminated BOOLEAN DEFAULT false,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tournament_id, user_id)
);

-- ============================================================================
-- SOCIAL & COMMUNITY
-- ============================================================================

CREATE TABLE user_friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_not_self_friend CHECK (user_id != friend_id),
    UNIQUE(user_id, friend_id)
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'emoji', 'system')),
    content TEXT NOT NULL,
    language VARCHAR(5) NOT NULL DEFAULT 'en',
    is_flagged BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ACHIEVEMENTS & RANKINGS
-- ============================================================================

CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    matches_played INT DEFAULT 0 CHECK (matches_played >= 0),
    matches_won INT DEFAULT 0 CHECK (matches_won >= 0),
    matches_lost INT DEFAULT 0 CHECK (matches_lost >= 0),
    win_rate DECIMAL(5,2) DEFAULT 0 CHECK (win_rate BETWEEN 0 AND 100),
    elo_rating INT DEFAULT 1200 CHECK (elo_rating >= 0),
    highest_elo INT DEFAULT 1200 CHECK (highest_elo >= 0),
    total_points_scored INT DEFAULT 0 CHECK (total_points_scored >= 0),
    total_cards_captured INT DEFAULT 0 CHECK (total_cards_captured >= 0),
    perfect_games INT DEFAULT 0 CHECK (perfect_games >= 0),
    tournament_wins INT DEFAULT 0 CHECK (tournament_wins >= 0),
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0 CHECK (longest_streak >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon_url VARCHAR(500) NOT NULL,
    category VARCHAR(20) NOT NULL,
    rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    points INT NOT NULL DEFAULT 0,
    criteria JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id),
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notified BOOLEAN DEFAULT false,

    UNIQUE(user_id, achievement_id)
);

-- ============================================================================
-- MONETIZATION
-- ============================================================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) DEFAULT 'ZAR',
    payment_method VARCHAR(50) NOT NULL,
    payment_provider_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    item_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cosmetic_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('card_back', 'table_theme', 'avatar', 'emote')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    currency VARCHAR(3) DEFAULT 'ZAR',
    preview_url VARCHAR(500) NOT NULL,
    asset_url VARCHAR(500) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cosmetic_item_id UUID NOT NULL REFERENCES cosmetic_items(id),
    is_equipped BOOLEAN DEFAULT false,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, cosmetic_item_id)
);

-- ============================================================================
-- MODERATION & SAFETY
-- ============================================================================

CREATE TABLE moderation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    moderator_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('warning', 'mute', 'suspend', 'ban')),
    reason TEXT NOT NULL,
    evidence JSONB,
    duration_hours INT,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE anti_cheat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    match_id UUID REFERENCES matches(id),
    detection_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details JSONB NOT NULL,
    auto_action_taken BOOLEAN DEFAULT false,
    reviewed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_country_code ON users(country_code);
CREATE INDEX idx_users_account_status ON users(account_status) WHERE account_status != 'deleted';
CREATE INDEX idx_users_is_premium ON users(is_premium) WHERE is_premium = true;

-- Auth Sessions indexes
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_refresh_token ON auth_sessions(refresh_token);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at) WHERE NOT revoked;

-- Matches indexes
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_match_type ON matches(match_type);
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX idx_matches_dealer_id ON matches(dealer_id);
CREATE INDEX idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX idx_matches_active ON matches(status, updated_at) WHERE status = 'active';

-- Match Players indexes
CREATE INDEX idx_match_players_match_id ON match_players(match_id);
CREATE INDEX idx_match_players_user_id ON match_players(user_id);
CREATE INDEX idx_match_players_partner_id ON match_players(partner_id);

-- Game States indexes
CREATE INDEX idx_game_states_match_id ON game_states(match_id, turn_number DESC);

-- Moves indexes
CREATE INDEX idx_moves_match_id ON moves(match_id, turn_number);
CREATE INDEX idx_moves_player_id ON moves(player_id);
CREATE INDEX idx_moves_created_at ON moves(created_at DESC);

-- Tournaments indexes
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_start_time ON tournaments(start_time);
CREATE INDEX idx_tournaments_created_by ON tournaments(created_by);

-- Tournament Players indexes
CREATE INDEX idx_tournament_players_tournament_id ON tournament_players(tournament_id);
CREATE INDEX idx_tournament_players_user_id ON tournament_players(user_id);

-- User Stats indexes
CREATE INDEX idx_user_stats_elo_rating ON user_stats(elo_rating DESC);
CREATE INDEX idx_user_stats_matches_won ON user_stats(matches_won DESC);

-- Chat Messages indexes
CREATE INDEX idx_chat_messages_match_id ON chat_messages(match_id, created_at);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_flagged ON chat_messages(is_flagged) WHERE is_flagged = true;

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Full-text search indexes
CREATE INDEX idx_users_username_trgm ON users USING gin(username gin_trgm_ops);
CREATE INDEX idx_achievements_name_trgm ON achievements USING gin(name gin_trgm_ops);

-- Composite indexes for common queries
CREATE INDEX idx_matches_matchmaking ON matches(match_type, status, created_at)
    WHERE status = 'waiting';

CREATE INDEX idx_user_stats_leaderboard ON user_stats(elo_rating DESC, matches_won DESC);

CREATE INDEX idx_tournament_players_standings ON tournament_players(tournament_id, points DESC, wins DESC);
