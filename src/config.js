import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  // Credentials
  TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.DISCORD_CLIENT_ID || '1559382791093751848',
  GUILD_ID: process.env.DISCORD_GUILD_ID || '1559297780613390346',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Channels
  CHANNELS: {
    LOGS: process.env.LOG_CHANNEL_ID || '1559441137624678440',
    MOD_ALERTS: process.env.MOD_ALERT_CHANNEL_ID || '1559441137624678440',
    REPORTS: process.env.REPORT_CHANNEL_ID || '1559441137624678440',
    WELCOME: process.env.WELCOME_CHANNEL_ID || '',
    ANNOUNCEMENTS: process.env.ANNOUNCE_CHANNEL_ID || '',
  },

  // Roles
  ROLES: {
    DEFAULT: process.env.DEFAULT_ROLE_ID || '',
    STREAM_PING: process.env.STREAM_PING_ROLE_ID || '',
  },

  // 9 Approved Level Progression Tiers & Progressive Feature Gates
  LEVEL_TIERS: {
    1: {
      level: 1,
      name: 'ROOKIE',
      color: '#00A8FC',
      xpRequired: 0,
      features: ['Basic Text Chatting', 'Voice Chat Speaking'],
      description: 'Starter tier. Restricted from posting links, rich embeds, image attachments, or external emojis/stickers.'
    },
    10: {
      level: 10,
      name: 'INSIDER',
      color: '#2DD4BF',
      xpRequired: 8495,
      features: ['Posting Web Links', 'Attach Files & Images'],
      description: 'Unlocks uploading screenshots, game recordings, and sharing web URLs in text channels.'
    },
    20: {
      level: 20,
      name: 'RESIDENT',
      color: '#38BDF8',
      xpRequired: 30627,
      features: ['Posting GIFs (Tenor)', 'Rich Embed Previews', 'Video Embeds'],
      description: 'Unlocks animated GIF picker via Tenor and automatic link rich preview embeds in chat.'
    },
    30: {
      level: 30,
      name: 'CLUB REGULAR',
      color: '#FBBF24',
      xpRequired: 64960,
      features: ['Use External Emojis', 'Use External Stickers'],
      description: 'Unlocks using custom emojis and animated stickers from other Discord servers.'
    },
    40: {
      level: 40,
      name: 'HYPEMASTER',
      color: '#F97316',
      xpRequired: 110653,
      features: ['Create Public Threads', 'Priority Speaker in VC'],
      description: 'Unlocks creating topic threads and priority voice volume override in voice lobbies.'
    },
    55: {
      level: 55,
      name: 'ASCENDANT',
      color: '#EF4444',
      xpRequired: 199444,
      features: ['Voice Soundboard', 'Use External Sounds'],
      description: 'Unlocks playing custom soundboard sound effects and clips in voice channels.'
    },
    70: {
      level: 70,
      name: 'CLUB TITAN',
      color: '#E11D48',
      xpRequired: 310033,
      features: ['VIP Lounge Access', 'High-Tier Scrim Channels'],
      description: 'Grants access to private VIP text channels and high-tier competitive scrim rooms.'
    },
    85: {
      level: 85,
      name: 'THE IMMORTAL',
      color: '#FFFFFF',
      xpRequired: 442159,
      features: ['Custom Nickname', 'Voice Activity Detection (No PTT needed)'],
      description: 'Unlocks custom server nickname formatting and unconstrained voice activity.'
    },
    100: {
      level: 100,
      name: 'STAR SUPPORTER',
      color: '#EC4899',
      xpRequired: 601438,
      features: ['Max Prestige Badge', 'Hall of Fame Showcase', 'Event Host Pings'],
      description: 'Ultimate Club EZKEN status! Inducted into Hall of Fame with event host pings.'
    }
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

  // Hard Leveling & VC XP Rates
  XP: {
    COOLDOWN_SECONDS: 60,
    TEXT_MIN: 15,
    TEXT_MAX: 20,
    VOICE_PER_MINUTE: 8,
    // Hard exponential curve: xp = Math.floor(120 * Math.pow(level, 1.85))
    calcLevelXp: (level) => Math.floor(120 * Math.pow(Math.max(1, level), 1.85)),
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
    CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID || 'UCZlA8UMbRHcjN1m0ENVl3MA',
    POLL_INTERVAL_MS: 120000, // 2 minutes
  },

  DATABASE_PATH: process.env.DATABASE_PATH || './data/ezken.sqlite',
};

/**
 * Resolves the active tier for a given level
 */
export function getTierForLevel(level) {
  const sortedTiers = Object.values(CONFIG.LEVEL_TIERS).sort((a, b) => b.level - a.level);
  for (const tier of sortedTiers) {
    if (level >= tier.level) return tier;
  }
  return CONFIG.LEVEL_TIERS[1];
}
