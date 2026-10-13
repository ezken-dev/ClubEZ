import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  // Credentials
  TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  GUILD_ID: process.env.DISCORD_GUILD_ID || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Channels
  CHANNELS: {
    LOGS: process.env.LOG_CHANNEL_ID || '',
    MOD_ALERTS: process.env.MOD_ALERT_CHANNEL_ID || '',
    REPORTS: process.env.REPORT_CHANNEL_ID || '',
    WELCOME: process.env.WELCOME_CHANNEL_ID || '',
    ANNOUNCEMENTS: process.env.ANNOUNCE_CHANNEL_ID || '',
  },

  // Roles
  ROLES: {
    DEFAULT: process.env.DEFAULT_ROLE_ID || '',
    STREAM_PING: process.env.STREAM_PING_ROLE_ID || '',
  },

  // Level Progression Perks (Level -> Role Name / Perk)
  LEVEL_TIERS: {
    1: { name: 'Initiate Ezken', color: '#9CA3AF' },
    5: { name: 'Bronze Raider', color: '#CD7F32' },
    10: { name: 'Silver Squad', color: '#E5E7EB' },
    20: { name: 'Gold Sentinel', color: '#FBBF24' },
    30: { name: 'Platinum Elite', color: '#38BDF8' },
    45: { name: 'Diamond Vanguard', color: '#818CF8' },
    60: { name: 'Crimson General', color: '#EF4444' },
    80: { name: 'Apex Champion', color: '#DC2626' },
    100: { name: 'Legend of Club EZKEN', color: '#B91C1C' },
  },

  // Branding Colors
  COLORS: {
    PRIMARY: '#E50914',    // Club EZKEN Signature Red
    SECONDARY: '#FFFFFF',  // Crisp White
    DARK: '#121214',       // Slate Black
    ACCENT: '#FF2E3B',
    SUCCESS: '#10B981',
    WARNING: '#F59E0B',
    DANGER: '#EF4444',
  },

  // Rate Limiting & XP Settings
  XP: {
    COOLDOWN_SECONDS: 60,
    TEXT_MIN: 15,
    TEXT_MAX: 25,
    VOICE_PER_MINUTE: 10,
    // Required XP formula: XP = 5 * (level^2) + (50 * level) + 100
    calcLevelXp: (level) => 5 * Math.pow(level, 2) + 50 * level + 100,
    calcTotalXpForLevel: (targetLevel) => {
      let total = 0;
      for (let lvl = 0; lvl < targetLevel; lvl++) {
        total += 5 * Math.pow(lvl, 2) + 50 * lvl + 100;
      }
      return total;
    }
  },

  // Anti-Spam & Auto-Mod Heuristics
  AUTOMOD: {
    MAX_MENTIONS: 4,
    SPAM_BURST_MAX: 5,
    SPAM_BURST_WINDOW_MS: 3000,
    INVITE_REGEX: /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discord\.com\/invite)\/[a-zA-Z0-9-]+/gi,
  },

  // YouTube Polling
  YOUTUBE: {
    CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID || '',
    POLL_INTERVAL_MS: 120000, // 2 minutes
  },

  DATABASE_PATH: process.env.DATABASE_PATH || './data/ezken.sqlite',
};
