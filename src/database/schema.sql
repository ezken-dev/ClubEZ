-- Club EZKEN SQLite Database Schema
-- Production SQLite with WAL (Write-Ahead Logging) Mode

-- Moderation Cases Tracking
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT UNIQUE NOT NULL, -- e.g. #0001, #0002
  user_id TEXT NOT NULL,
  user_tag TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  moderator_tag TEXT NOT NULL,
  action_type TEXT NOT NULL, -- WARN, MUTE, KICK, BAN, UNBAN, AUTO_TIMEOUT
  reason TEXT NOT NULL,
  duration INTEGER DEFAULT NULL, -- Duration in seconds if applicable
  timestamp INTEGER NOT NULL
);

-- Custom Embed / Message Templates
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_name TEXT UNIQUE NOT NULL,
  json_payload TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- XP, Leveling & Voice Statistics
CREATE TABLE IF NOT EXISTS users_xp (
  user_id TEXT PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 0,
  last_text_xp INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  voice_minutes INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- YouTube Stream / Upload Announcement Cache
CREATE TABLE IF NOT EXISTS stream_cache (
  video_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  published_at TEXT NOT NULL,
  announced_at INTEGER NOT NULL
);

-- User Reports System
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT UNIQUE NOT NULL,
  reporter_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  message_url TEXT,
  status TEXT DEFAULT 'PENDING', -- PENDING, RESOLVED, DISMISSED
  action_taken TEXT,
  resolved_by TEXT,
  created_at INTEGER NOT NULL
);

-- Server Configuration & Role Connections
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  log_channel_id TEXT,
  alert_channel_id TEXT,
  report_channel_id TEXT,
  welcome_channel_id TEXT,
  announce_channel_id TEXT,
  default_role_id TEXT,
  stream_role_id TEXT
);
