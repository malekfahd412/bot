-- PostgreSQL Schema for GTA Heist RPG Bot
-- Run this against your PostgreSQL database before switching to pg-adapter
-- Set DATABASE_URL in your environment, then configure pg-adapter.ts

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discord_id VARCHAR(20) UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 1000,
  rank VARCHAR(30) NOT NULL DEFAULT 'CIVILIAN',
  total_heists INTEGER NOT NULL DEFAULT 0,
  successful_heists INTEGER NOT NULL DEFAULT 0,
  failed_heists INTEGER NOT NULL DEFAULT 0,
  total_earnings INTEGER NOT NULL DEFAULT 0,
  hardest_heist VARCHAR(20),
  streak_current INTEGER NOT NULL DEFAULT 0,
  streak_longest INTEGER NOT NULL DEFAULT 0,
  last_daily TIMESTAMPTZ,
  last_heist TIMESTAMPTZ,
  crew_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heist_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitter_id VARCHAR(20) NOT NULL,
  heist_name VARCHAR(64) NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  teammates JSONB NOT NULL DEFAULT '[]',
  proof_url TEXT NOT NULL,
  notes TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id VARCHAR(20),
  reviewer_note TEXT,
  xp_awarded INTEGER,
  coins_awarded INTEGER,
  review_message_id VARCHAR(20),
  submission_channel_id VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(32) UNIQUE NOT NULL,
  tag VARCHAR(5) UNIQUE NOT NULL,
  owner_id VARCHAR(20) NOT NULL,
  description TEXT,
  icon_url TEXT,
  total_heists INTEGER NOT NULL DEFAULT 0,
  total_earnings BIGINT NOT NULL DEFAULT 0,
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id VARCHAR(20) NOT NULL,
  achievement_key VARCHAR(50) NOT NULL,
  achievement_name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(10) NOT NULL DEFAULT '🏆',
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id VARCHAR(20) NOT NULL,
  item_key VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  item_type VARCHAR(30) NOT NULL DEFAULT 'misc',
  quantity INTEGER NOT NULL DEFAULT 1,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_players_discord_id ON players(discord_id);
CREATE INDEX IF NOT EXISTS idx_players_xp ON players(xp DESC);
CREATE INDEX IF NOT EXISTS idx_heist_status ON heist_submissions(status);
CREATE INDEX IF NOT EXISTS idx_heist_submitter ON heist_submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_achievements_player ON achievements(player_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
