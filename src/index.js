import { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  Partials,
  ActivityType 
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { initStreamWatcher } from './services/streamWatcher.js';
import db from './database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// GLOBAL ERROR HANDLING & PROCESS RESILIENCE (Zero Runtime Crashes)
// =============================================================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error(`[CRITICAL] Uncaught Exception: ${err.message} (${origin})`, err.stack);
});

// =============================================================================
// DISCORD CLIENT INITIALIZATION WITH PRIVILEGED INTENTS
// =============================================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,       // Required for message analysis & auto-mod
    GatewayIntentBits.GuildMembers,          // Required for member join & welcome cards
    GatewayIntentBits.GuildVoiceStates,      // Required for voice channel XP
    GatewayIntentBits.GuildModeration,       // Required for audit logs & bans
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User
  ]
});

client.commands = new Collection();

// =============================================================================
// DYNAMIC COMMAND LOADER
// =============================================================================
const commandFolders = ['moderation', 'leveling', 'utility', 'templates'];

for (const folder of commandFolders) {
  const folderPath = path.join(__dirname, 'commands', folder);
  if (!fs.existsSync(folderPath)) continue;

  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const commandModule = await import(`file://${filePath}`);
    const command = commandModule.default || commandModule;

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`[WARN] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

// =============================================================================
// DYNAMIC EVENT HANDLER LOADER
// =============================================================================
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const eventModule = await import(`file://${filePath}`);
    const event = eventModule.default || eventModule;

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

// =============================================================================
// CLIENT READY EVENT
// =============================================================================
client.once('ready', () => {
  console.log(`
  ==============================================================
   ██████╗██╗     ██╗   ██╗██████╗     ███████╗███████╗██╗  ██╗███████╗███╗   ██╗
  ██╔════╝██║     ██║   ██║██╔══██╗    ██╔════╝╚══███╔╝██║ ██╔╝██╔════╝████╗  ██║
  ██║     ██║     ██║   ██║██████╔╝    █████╗    ███╔╝ █████╔╝ █████╗  ██╔██╗ ██║
  ██║     ██║     ██║   ██║██╔══██╗    ██╔══╝   ███╔╝  ██╔═██╗ ██╔══╝  ██║╚██╗██║
  ╚██████╗███████╗╚██████╔╝██████╔╝    ███████╗███████╗██║  ██╗███████╗██║ ╚████║
   ╚═════╝╚══════╝ ╚═════╝ ╚═════╝     ╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝
  ==============================================================
  🚀 Logged in as: ${client.user.tag}
  🛡️ Guilds: ${client.guilds.cache.size}
  👥 Members Cached: ${client.users.cache.size}
  ⚡ Commands Loaded: ${client.commands.size}
  💽 SQLite WAL Mode: Active (${CONFIG.DATABASE_PATH})
  🤖 AI Auto-Moderation: ${CONFIG.GEMINI_API_KEY ? 'Active (Gemini 3.8 Flash)' : 'Heuristic Mode'}
  ==============================================================
  `);

  // Rich Presence
  client.user.setPresence({
    activities: [{
      name: 'Club EZKEN | /rank & /help',
      type: ActivityType.Watching
    }],
    status: 'online'
  });

  // Start YouTube RSS Stream Poller
  initStreamWatcher(client);
});

// Start Bot
if (CONFIG.TOKEN) {
  client.login(CONFIG.TOKEN).catch((err) => {
    console.error('[LOGIN ERROR] Failed to connect to Discord Gateway:', err.message);
  });
} else {
  console.warn('[NOTICE] No DISCORD_TOKEN set. Configure .env with your bot token to connect live.');
}

export default client;
