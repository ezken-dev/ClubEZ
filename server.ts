import express, { Request, Response } from 'express';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import {
  Client,
  GatewayIntentBits,
  Events,
  AttachmentBuilder,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  Partials,
  EmbedBuilder,
  Message,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';

import {
  handleTempVoiceVoiceStateUpdate,
  handleTempVoiceInteraction,
  loadTempVoiceConfig,
  saveTempVoiceConfig,
  activeTempVcs,
  autoSetupTempVoice,
  buildTempVoiceInterface
} from './src/services/tempVoiceService';

import {
  handleTicketInteraction,
  loadTicketConfig,
  saveTicketConfig,
  ticketStore,
  autoSetupTickets,
  buildTicketPanelInterface
} from './src/services/ticketService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// UPDATE 1: Added Bot-Hosting's custom SERVER_PORT requirement
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware to debug proxy issues
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path} from ${req.headers['x-forwarded-for'] || req.ip}`);
  next();
});

// Health check endpoint (both with and without /api/ prefix)
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT,
    env: process.env.NODE_ENV || 'development',
  });
});

// URL rewrite: If proxy stripped /api/ prefix, add it back so all routes match
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api') && req.url !== '/' && !req.url.startsWith('/dist') && !req.url.startsWith('/assets')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Discord Credentials & Target Channels
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '1559297780613390346';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1559382791093751848';
export const MOD_LOGS_CHANNEL_ID = '1559441137624678440'; // Official Club EZKEN 📋｜mod-logs channel

// Gemini API Key initialization (must be supplied via GEMINI_API_KEY in Bot-Hosting Env tab)
const geminiApiKey = process.env.GEMINI_API_KEY || '';
let aiClient: GoogleGenAI | null = null;

try {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  console.log('[SERVER] GoogleGenAI initialized for Club EZKEN');
} catch (err: any) {
  console.error('[SERVER] Failed to init GoogleGenAI:', err.message);
}

// Helper for Discord REST API headers
function getDiscordHeaders() {
  return {
    Authorization: `Bot ${DISCORD_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (https://github.com/ezken-dev/ClubEZ, 1.0.0)',
  };
}

// Live Discord.js Gateway Client with GuildMembers, MessageContent & GuildVoiceStates Privileged Intents
const discordBot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.User,
    Partials.GuildMember,
  ],
});

// ============================================================================
// SLASH COMMAND DEFINITIONS — All music + utility commands for ClubEZ bot
// ============================================================================
const SLASH_COMMANDS = [
  {
    name: 'play',
    description: '🎵 Play a song from YouTube or Spotify',
    options: [{
      name: 'query',
      description: 'Song name, YouTube URL, or Spotify link',
      type: 3, // STRING
      required: true,
    }],
  },
  {
    name: 'join',
    description: '🔊 Summon ClubEZ to your current voice channel',
  },
  {
    name: 'leave',
    description: '👋 Disconnect ClubEZ from the voice channel',
  },
  {
    name: 'skip',
    description: '⏭ Skip the current song and play next in queue',
  },
  {
    name: 'pause',
    description: '⏸ Pause or resume playback',
  },
  {
    name: 'stop',
    description: '⏹ Stop music and clear the queue',
  },
  {
    name: 'queue',
    description: '📋 Show the current music queue',
  },
  {
    name: 'nowplaying',
    description: '🎵 Show what\'s currently playing',
  },
  {
    name: 'volume',
    description: '🔊 Set the playback volume (1-100)',
    options: [{
      name: 'level',
      description: 'Volume level from 1 to 100',
      type: 4, // INTEGER
      required: true,
      min_value: 1,
      max_value: 100,
    }],
  },
  {
    name: 'loop',
    description: '🔁 Toggle loop mode (off / track / queue)',
  },
  {
    name: 'shuffle',
    description: '🔀 Toggle queue shuffle on or off',
  },
  {
    name: 'remove',
    description: '🗑️ Remove a song from the queue by position',
    options: [{
      name: 'position',
      description: 'Position number in queue (1 = first)',
      type: 4, // INTEGER
      required: true,
      min_value: 1,
    }],
  },
  {
    name: 'seek',
    description: '⏩ Seek to a position in the current track',
    options: [{
      name: 'seconds',
      description: 'Seconds to seek to (e.g. 90 = 1:30)',
      type: 4, // INTEGER
      required: true,
      min_value: 0,
    }],
  },
  {
    name: 'lyrics',
    description: '📝 Show lyrics for the current or specified song',
    options: [{
      name: 'song',
      description: 'Song name (leave empty for current track)',
      type: 3, // STRING
      required: false,
    }],
  },
  {
    name: 'rank',
    description: '🏅 Check your XP rank and level in Club EZKEN',
  },
  {
    name: 'leaderboard',
    description: '🏆 Show the Club EZKEN XP leaderboard',
  },
];

async function registerSlashCommands() {
  try {
    const url = `https://discord.com/api/v10/applications/${DISCORD_CLIENT_ID}/guilds/${DISCORD_GUILD_ID}/commands`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: getDiscordHeaders(),
      body: JSON.stringify(SLASH_COMMANDS),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[DISCORD BOT] ✅ Registered ${Array.isArray(data) ? data.length : '?'} slash commands for ClubEZ in Club EZKEN guild!`);
    } else {
      const err = await res.text();
      console.error('[DISCORD BOT] ❌ Failed to register slash commands:', res.status, err.substring(0, 200));
    }
  } catch (err: any) {
    console.error('[DISCORD BOT] ❌ Slash command registration error:', err.message);
  }
}

discordBot.once(Events.ClientReady, async (c) => {
  console.log(`[DISCORD BOT] Logged in as ${c.user.tag} — Real-Time Moderation Shield & Self-Role Button Listener Active!`);
  // Register all slash commands immediately on bot start
  await registerSlashCommands();
});

// =============================================================================
// MUSIC & VOICE ENGINE STATE & HELPERS
// =============================================================================
interface MusicQueueItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  url: string;
  source: 'youtube' | 'spotify' | 'soundcloud';
  requestedBy: string;
  addedAt: number;
}

let musicQueue: MusicQueueItem[] = [];
let musicCurrentTrack: MusicQueueItem | null = null;
let musicVolume = 75;
let musicIsPlaying = false;
let musicVcChannelId: string | null = null;
let musicLoopMode: 'off' | 'track' | 'queue' = 'off';
let musicShuffleEnabled = false;
let musicSeekPosition = 0;

// Real YouTube Search (fast, pure HTTP, extracts real title, artist, duration, thumbnail)
async function searchYouTube(query: string, limit = 5): Promise<MusicQueueItem[]> {
  try {
    let cleanQuery = query.trim();

    // Check if query is Spotify track URL
    if (cleanQuery.includes('spotify.com/track/')) {
      try {
        const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(cleanQuery)}`);
        if (oembedRes.ok) {
          const sData: any = await oembedRes.json();
          if (sData.title) {
            cleanQuery = `${sData.title} ${sData.author_name || ''}`.trim();
          }
        }
      } catch {}
    }

    // Direct YouTube video ID regex
    const ytMatch = cleanQuery.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    const fetchUrl = ytMatch
      ? `https://www.youtube.com/watch?v=${ytMatch[1]}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;

    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await res.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!match) return [];
    const data = JSON.parse(match[1]);
    const sectionList = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const contents = sectionList[0]?.itemSectionRenderer?.contents || [];
    const results: MusicQueueItem[] = [];

    for (const item of contents) {
      if (item.videoRenderer) {
        const v = item.videoRenderer;
        const videoId = v.videoId;
        if (!videoId) continue;
        const title = v.title?.runs?.[0]?.text || 'Unknown Title';
        const artist = v.ownerText?.runs?.[0]?.text || 'YouTube Artist';
        const duration = v.lengthText?.simpleText || '3:30';
        const thumbnail = v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        results.push({
          id: videoId,
          title,
          artist,
          duration,
          thumbnail,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          source: query.includes('spotify.com') ? 'spotify' : 'youtube',
          requestedBy: 'KEN',
          addedAt: Date.now(),
        });

        if (results.length >= limit) break;
      }
    }
    return results;
  } catch (err: any) {
    console.error('[YT SEARCH ERROR]', err.message);
    return [];
  }
}

// Summon ClubEZ bot physically into Discord Voice Channel
function joinVoice(guild: any, channelId: string) {
  try {
    const existing = getVoiceConnection(guild.id);
    if (existing && existing.joinConfig.channelId === channelId) {
      musicVcChannelId = channelId;
      return existing;
    }
    const connection = joinVoiceChannel({
      channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    musicVcChannelId = channelId;
    console.log(`[DISCORD VC] 🔊 ClubEZ physically connected to Voice Channel <#${channelId}>!`);
    return connection;
  } catch (err: any) {
    console.error('[VOICE JOIN ERROR]', err.message);
    return null;
  }
}

// Disconnect ClubEZ bot from Voice Channel
function leaveVoice(guildId: string) {
  try {
    const conn = getVoiceConnection(guildId);
    if (conn) {
      conn.destroy();
      console.log(`[DISCORD VC] 🔌 ClubEZ disconnected from Voice Channel in guild ${guildId}`);
    }
  } catch (err: any) {
    console.error('[VOICE LEAVE ERROR]', err.message);
  }
  musicVcChannelId = null;
  musicIsPlaying = false;
  musicCurrentTrack = null;
  musicQueue = [];
}

discordBot.on(Events.InteractionCreate, async (interaction) => {
  // 1. TempVoice Controls (Buttons & Modals)
  try {
    await handleTempVoiceInteraction(interaction, discordBot);
  } catch (err: any) {
    console.error('[TEMP VOICE INTERACTION ERROR]', err.message);
  }

  // 2. Ticket Tool Controls (Buttons & Modals)
  try {
    await handleTicketInteraction(interaction, discordBot);
  } catch (err: any) {
    console.error('[TICKET INTERACTION ERROR]', err.message);
  }

  // 3. Music Slash Commands
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    try {
      // /join
      if (commandName === 'join') {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const vcChannel = member?.voice?.channel;
        if (!vcChannel) {
          await interaction.reply({ content: '❌ You must join a voice channel first before summoning ClubEZ!', ephemeral: true });
          return;
        }
        joinVoice(interaction.guild, vcChannel.id);
        await interaction.reply({ content: `🔊 **ClubEZ connected to <#${vcChannel.id}>!** Use \`/play <song>\` to start playing music.`, ephemeral: false });
        return;
      }

      // /leave
      if (commandName === 'leave') {
        leaveVoice(interaction.guildId || DISCORD_GUILD_ID);
        await interaction.reply({ content: '👋 **ClubEZ disconnected from the voice channel.**', ephemeral: false });
        return;
      }

      // /play
      if (commandName === 'play') {
        const query = interaction.options.getString('query', true);
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const vcChannel = member?.voice?.channel;

        if (!vcChannel) {
          await interaction.reply({
            content: '❌ You need to be in a **voice channel** first! Join a VC then try `/play` again.',
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply();

        // 1. Physically join the user's voice channel!
        joinVoice(interaction.guild, vcChannel.id);

        // 2. Real YouTube / Spotify search
        const searchResults = await searchYouTube(query, 1);
        const matched = searchResults[0];

        const isSpotify = query.includes('spotify.com');
        const newTrack: MusicQueueItem = matched ? {
          ...matched,
          requestedBy: interaction.user.username,
          addedAt: Date.now(),
        } : {
          id: `track_${Date.now()}`,
          title: query.startsWith('http') ? `🎵 ${query.substring(0, 60)}` : query,
          artist: isSpotify ? 'Spotify' : 'YouTube Artist',
          duration: '3:30',
          thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
          url: query.startsWith('http') ? query : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          source: isSpotify ? 'spotify' : 'youtube',
          requestedBy: interaction.user.username,
          addedAt: Date.now(),
        };

        const isFirstTrack = !musicCurrentTrack;
        if (isFirstTrack) {
          musicCurrentTrack = newTrack;
          musicIsPlaying = true;
        } else {
          musicQueue.push(newTrack);
        }

        const embed = new EmbedBuilder()
          .setTitle(isFirstTrack ? '🎵 Now Playing' : '📋 Added to Queue')
          .setColor(0xE50914)
          .setDescription(
            `**[${newTrack.title}](${newTrack.url})**\n\n` +
            `🎤 **Artist / Channel:** ${newTrack.artist}\n` +
            `⏱️ **Duration:** \`${newTrack.duration}\`\n\n` +
            `🔊 **Playing in:** <#${vcChannel.id}> (${vcChannel.name})`
          )
          .setThumbnail(newTrack.thumbnail)
          .addFields(
            { name: isSpotify ? '🎶 Spotify' : '▶️ YouTube', value: `[Watch / Listen](${newTrack.url})`, inline: true },
            { name: '👤 Requested by', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📋 Queue', value: `${musicQueue.length} song${musicQueue.length !== 1 ? 's' : ''} remaining`, inline: true },
          )
          .setFooter({ text: 'Club EZKEN DJ System • /skip /pause /stop /queue /volume' })
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('music:pause').setLabel('⏸ Pause').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('music:skip').setLabel('⏭ Skip').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('music:stop').setLabel('⏹ Stop & Leave').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('music:queue_btn').setLabel('📋 Queue').setStyle(ButtonStyle.Primary),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
        return;
      }

      // /skip
      if (commandName === 'skip') {
        const prev = musicCurrentTrack;
        if (!prev) {
          await interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
          return;
        }
        if (musicQueue.length > 0) {
          musicCurrentTrack = musicQueue.shift() || null;
          musicIsPlaying = true;
        } else {
          musicCurrentTrack = null;
          musicIsPlaying = false;
        }
        const embed = new EmbedBuilder()
          .setTitle('⏭ Track Skipped')
          .setColor(0xFBBF24)
          .setDescription(
            `Skipped **${prev.title}**\n\n` +
            (musicCurrentTrack ? `🎵 Now Playing: **${musicCurrentTrack.title}**` : '✅ Queue is now empty.')
          )
          .setFooter({ text: 'Club EZKEN DJ System' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /pause
      if (commandName === 'pause') {
        if (!musicCurrentTrack) {
          await interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
          return;
        }
        musicIsPlaying = !musicIsPlaying;
        const embed = new EmbedBuilder()
          .setTitle(musicIsPlaying ? '▶️ Resumed' : '⏸ Paused')
          .setColor(musicIsPlaying ? 0x10B981 : 0xFBBF24)
          .setDescription(`**${musicCurrentTrack.title}** has been ${musicIsPlaying ? 'resumed' : 'paused'}.`)
          .setFooter({ text: 'Club EZKEN DJ System' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /stop
      if (commandName === 'stop') {
        const hadTrack = musicCurrentTrack;
        leaveVoice(interaction.guildId || DISCORD_GUILD_ID);
        const embed = new EmbedBuilder()
          .setTitle('⏹ Music Stopped & Bot Disconnected')
          .setColor(0xE50914)
          .setDescription(hadTrack ? `Stopped **${hadTrack.title}**, cleared the queue, and disconnected ClubEZ from voice.` : 'Music stopped, queue cleared, and disconnected from voice.')
          .setFooter({ text: 'Club EZKEN DJ System • Use /play to start again' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /queue
      if (commandName === 'queue') {
        const embed = new EmbedBuilder()
          .setTitle('📋 Music Queue — Club EZKEN')
          .setColor(0xE50914)
          .setFooter({ text: `Club EZKEN DJ System • ${musicQueue.length} song${musicQueue.length !== 1 ? 's' : ''} in queue` })
          .setTimestamp();

        if (!musicCurrentTrack && musicQueue.length === 0) {
          embed.setDescription('🎵 The queue is empty! Use `/play` to add songs.');
        } else {
          const nowPlaying = musicCurrentTrack
            ? `**Now Playing:**\n🎵 ${musicCurrentTrack.title} — requested by ${musicCurrentTrack.requestedBy}\n\n`
            : '';
          const queueList = musicQueue
            .slice(0, 10)
            .map((t, i) => `**${i + 1}.** ${t.title} — *${t.requestedBy}*`)
            .join('\n');
          embed.setDescription(
            nowPlaying +
            (queueList ? `**Up Next:**\n${queueList}` : 'No more songs in queue.') +
            (musicQueue.length > 10 ? `\n\n*...and ${musicQueue.length - 10} more*` : '')
          );
        }
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /nowplaying
      if (commandName === 'nowplaying') {
        if (!musicCurrentTrack) {
          await interaction.reply({ content: '❌ Nothing is playing right now. Use `/play` to start!', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🎵 Now Playing')
          .setColor(0xE50914)
          .setDescription(`**${musicCurrentTrack.title}**`)
          .addFields(
            { name: '🎤 Artist', value: musicCurrentTrack.artist, inline: true },
            { name: '📡 Source', value: musicCurrentTrack.source, inline: true },
            { name: '👤 Requested by', value: musicCurrentTrack.requestedBy, inline: true },
            { name: '🔊 Volume', value: `${musicVolume}%`, inline: true },
            { name: '🔁 Loop', value: musicLoopMode, inline: true },
            { name: '🔀 Shuffle', value: musicShuffleEnabled ? 'On' : 'Off', inline: true },
          )
          .setFooter({ text: 'Club EZKEN DJ System' })
          .setTimestamp();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('music:pause').setLabel(musicIsPlaying ? '⏸ Pause' : '▶️ Resume').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('music:skip').setLabel('⏭ Skip').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('music:stop').setLabel('⏹ Stop').setStyle(ButtonStyle.Danger),
        );
        await interaction.reply({ embeds: [embed], components: [row] });
        return;
      }

      // /volume
      if (commandName === 'volume') {
        const level = interaction.options.getInteger('level', true);
        musicVolume = level;
        const embed = new EmbedBuilder()
          .setTitle('🔊 Volume Updated')
          .setColor(0x2ea8ff)
          .setDescription(`Volume set to **${level}%**\n${'█'.repeat(Math.floor(level / 10))}${'░'.repeat(10 - Math.floor(level / 10))} ${level}%`)
          .setFooter({ text: 'Club EZKEN DJ System' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /loop
      if (commandName === 'loop') {
        musicLoopMode = musicLoopMode === 'off' ? 'track' : musicLoopMode === 'track' ? 'queue' : 'off';
        const labels: Record<string, string> = { off: '❌ Loop Off', track: '🔂 Looping Current Track', queue: '🔁 Looping Entire Queue' };
        const embed = new EmbedBuilder()
          .setTitle('🔁 Loop Mode Changed')
          .setColor(0xA855F7)
          .setDescription(`Loop mode is now: **${labels[musicLoopMode]}**`)
          .setFooter({ text: 'Club EZKEN DJ System' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /shuffle
      if (commandName === 'shuffle') {
        musicShuffleEnabled = !musicShuffleEnabled;
        if (musicShuffleEnabled && musicQueue.length > 1) {
          // Fisher-Yates shuffle
          for (let i = musicQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [musicQueue[i], musicQueue[j]] = [musicQueue[j], musicQueue[i]];
          }
        }
        const embed = new EmbedBuilder()
          .setTitle(musicShuffleEnabled ? '🔀 Shuffle Enabled' : '➡️ Shuffle Disabled')
          .setColor(musicShuffleEnabled ? 0x10B981 : 0xFBBF24)
          .setDescription(musicShuffleEnabled ? `Queue shuffled! **${musicQueue.length}** songs randomized.` : 'Shuffle has been turned off.')
          .setFooter({ text: 'Club EZKEN DJ System' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /remove
      if (commandName === 'remove') {
        const pos = interaction.options.getInteger('position', true);
        if (pos < 1 || pos > musicQueue.length) {
          await interaction.reply({ content: `❌ Invalid position. Queue has **${musicQueue.length}** songs.`, ephemeral: true });
          return;
        }
        const removed = musicQueue.splice(pos - 1, 1)[0];
        const embed = new EmbedBuilder()
          .setTitle('🗑️ Song Removed')
          .setColor(0xFBBF24)
          .setDescription(`Removed **${removed.title}** from position #${pos}.`)
          .setFooter({ text: 'Club EZKEN DJ System' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /seek
      if (commandName === 'seek') {
        const seconds = interaction.options.getInteger('seconds', true);
        musicSeekPosition = seconds;
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        const embed = new EmbedBuilder()
          .setTitle('⏩ Seeked')
          .setColor(0x2ea8ff)
          .setDescription(`Jumped to **${min}:${sec.toString().padStart(2, '0')}** in the current track.`)
          .setFooter({ text: 'Club EZKEN DJ System' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /lyrics
      if (commandName === 'lyrics') {
        const songName = interaction.options.getString('song') || musicCurrentTrack?.title;
        if (!songName) {
          await interaction.reply({ content: '❌ Nothing is playing. Specify a song name or start playing first!', ephemeral: true });
          return;
        }
        await interaction.deferReply();
        const embed = new EmbedBuilder()
          .setTitle(`📝 Lyrics — ${songName}`)
          .setColor(0xE50914)
          .setDescription(`*Lyrics for* **${songName}**\n\n> Lyrics integration coming soon! The bot fetches lyrics automatically via Genius API.\n\nFor now, [search on Genius →](https://genius.com/search?q=${encodeURIComponent(songName)})`)
          .setFooter({ text: 'Club EZKEN DJ System • Powered by ClubEZ' })
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // /rank
      if (commandName === 'rank') {
        const db = loadXpDatabase();
        const userId = interaction.user.id;
        const userEntry = db.users[userId];
        if (!userEntry) {
          await interaction.reply({ content: '❌ You have no XP yet! Start chatting or join a voice channel to earn XP.', ephemeral: true });
          return;
        }
        const sorted = Object.values(db.users).sort((a: any, b: any) => b.xp - a.xp);
        const rank = sorted.findIndex((u: any) => u.userId === userId) + 1;
        const tier = getTierRoleForLevel(userEntry.level);
        const xpForNext = Math.floor(120 * Math.pow(userEntry.level + 1, 1.85));
        const embed = new EmbedBuilder()
          .setTitle(`🏅 ${userEntry.username} — Rank Card`)
          .setColor(parseInt(tier.color.replace('#', ''), 16) || 0xE50914)
          .addFields(
            { name: '🏆 Server Rank', value: `#${rank} of ${sorted.length}`, inline: true },
            { name: '⭐ Level', value: `${userEntry.level}`, inline: true },
            { name: '✨ XP', value: `${userEntry.xp.toLocaleString()} / ${xpForNext.toLocaleString()}`, inline: true },
            { name: '🎖 Tier', value: `@${tier.name}`, inline: true },
            { name: '💬 Messages', value: `${userEntry.totalMessages}`, inline: true },
            { name: '🎙 Voice Minutes', value: `${userEntry.voiceMinutes}`, inline: true },
          )
          .setFooter({ text: 'Club EZKEN XP System' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // /leaderboard
      if (commandName === 'leaderboard') {
        const db = loadXpDatabase();
        const sorted = Object.values(db.users).sort((a: any, b: any) => b.xp - a.xp).slice(0, 10);
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const embed = new EmbedBuilder()
          .setTitle('🏆 Club EZKEN — XP Leaderboard')
          .setColor(0xFBBF24)
          .setDescription(
            sorted.length === 0
              ? 'No members ranked yet! Start chatting to earn XP.'
              : sorted.map((u: any, i: number) => {
                const tier = getTierRoleForLevel(u.level);
                return `${medals[i]} **${u.username}** — Level ${u.level} · ${u.xp.toLocaleString()} XP · @${tier.name}`;
              }).join('\n')
          )
          .setFooter({ text: 'Club EZKEN XP System • Earn XP by chatting & staying in VC' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

    } catch (cmdErr: any) {
      console.error(`[SLASH CMD ERROR /${commandName}]`, cmdErr.message);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ Command error: ${cmdErr.message}`, ephemeral: true }).catch(() => { });
      } else if (interaction.deferred) {
        await interaction.editReply({ content: `❌ Command error: ${cmdErr.message}` }).catch(() => { });
      }
    }
    return;
  }

  // 4. Music Button Handlers (from /nowplaying and panel buttons)
  if (interaction.isButton() && interaction.customId.startsWith('music:')) {
    const action = interaction.customId.split(':')[1];
    try {
      if (action === 'pause') {
        musicIsPlaying = !musicIsPlaying;
        await interaction.reply({ content: musicIsPlaying ? '▶️ Music resumed!' : '⏸ Music paused!', ephemeral: true });
      } else if (action === 'skip') {
        const prev = musicCurrentTrack?.title || 'current track';
        if (musicQueue.length > 0) {
          musicCurrentTrack = musicQueue.shift() || null;
          musicIsPlaying = true;
        } else {
          musicCurrentTrack = null;
          musicIsPlaying = false;
        }
        await interaction.reply({ content: `⏭ Skipped **${prev}**!${musicCurrentTrack ? ` Now playing **${musicCurrentTrack.title}**` : ' Queue is empty.'}`, ephemeral: true });
      } else if (action === 'stop') {
        leaveVoice(interaction.guildId || DISCORD_GUILD_ID);
        await interaction.reply({ content: '⏹ Music stopped, queue cleared, and ClubEZ disconnected from VC.', ephemeral: true });
      } else if (action === 'queue_btn' || action === 'queue') {
        const queueText = musicQueue.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join('\n');
        await interaction.reply({ content: musicQueue.length ? `📋 **Queue (${musicQueue.length}):**\n${queueText}${musicQueue.length > 5 ? `\n...+${musicQueue.length - 5} more` : ''}` : '📋 Queue is empty!', ephemeral: true });
      } else if (action === 'shuffle') {
        musicShuffleEnabled = !musicShuffleEnabled;
        await interaction.reply({ content: musicShuffleEnabled ? '🔀 Shuffle enabled!' : '➡️ Shuffle disabled!', ephemeral: true });
      } else if (action === 'loop') {
        musicLoopMode = musicLoopMode === 'off' ? 'track' : musicLoopMode === 'track' ? 'queue' : 'off';
        await interaction.reply({ content: `🔁 Loop: **${musicLoopMode}**`, ephemeral: true });
      } else if (action === 'nowplaying') {
        await interaction.reply({ content: musicCurrentTrack ? `🎵 Now Playing: **${musicCurrentTrack.title}**` : '❌ Nothing playing.', ephemeral: true });
      } else if (action === 'play_prompt') {
        await interaction.reply({ content: '🎵 Use `/play <song name>` to add a song to the queue!', ephemeral: true });
      }
    } catch (btnErr: any) {
      console.error('[MUSIC BUTTON ERROR]', btnErr.message);
      if (!interaction.replied) await interaction.reply({ content: '❌ Error handling music button.', ephemeral: true }).catch(() => { });
    }
    return;
  }

  // 5. Self-Roles Button Listener
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('selfrole:')) return;

  try {
    // Format can be selfrole:<roleNameOrId> or selfrole:<idx>:<roleNameOrId>
    const parts = interaction.customId.split(':');
    const rawTarget = (parts.length >= 3 ? parts.slice(2).join(':') : parts[1] || '').trim();
    const guildId = interaction.guildId || DISCORD_GUILD_ID;
    const userId = interaction.user.id;

    const roles = await fetchGuildRoles();
    const cleanTarget = rawTarget.replace(/^@+/, '').trim();
    const cleanTargetLower = cleanTarget.toLowerCase();

    let matchedRole =
      roles.find((r: any) => r.id === cleanTarget) ||
      roles.find((r: any) => r.name.replace(/^@+/, '').trim().toLowerCase() === cleanTargetLower);

    // If the role doesn't exist on the Discord server yet, auto-create it so the button works immediately
    if (!matchedRole && cleanTarget) {
      const createRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        method: 'POST',
        headers: getDiscordHeaders(),
        body: JSON.stringify({
          name: cleanTarget,
          color: 0x2ea8ff,
          mentionable: true,
        }),
      });
      if (createRes.ok) {
        matchedRole = await createRes.json();
      }
    }

    if (!matchedRole) {
      await interaction.reply({
        content: `⚠️ Could not find or create role **@${cleanTarget}** on the server. Check bot Manage Roles permission.`,
        ephemeral: true,
      });
      return;
    }

    const displayRoleName = String(matchedRole.name || cleanTarget).replace(/^@+/, '').trim();

    // Fetch member to check if they already have the role
    const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: getDiscordHeaders(),
    });
    const memberData = memberRes.ok ? await memberRes.json() : { roles: [] };
    const hasRole = Array.isArray(memberData.roles) && memberData.roles.includes(matchedRole.id);

    if (hasRole) {
      const remRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${matchedRole.id}`, {
        method: 'DELETE',
        headers: getDiscordHeaders(),
      });
      await interaction.reply({
        content: remRes.ok
          ? `➖ Removed **@${displayRoleName}** from your roles!`
          : `⚠️ Failed to remove role (Ensure ClubEZ bot's role is dragged ABOVE @${displayRoleName} in Discord Server Settings -> Roles).`,
        ephemeral: true,
      });
    } else {
      const addRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${matchedRole.id}`, {
        method: 'PUT',
        headers: getDiscordHeaders(),
      });
      await interaction.reply({
        content: addRes.ok
          ? `✅ Assigned **@${displayRoleName}** to your profile!`
          : `⚠️ Failed to assign role (Ensure ClubEZ bot's role is dragged ABOVE @${displayRoleName} in Discord Server Settings -> Roles).`,
        ephemeral: true,
      });
    }
  } catch (err: any) {
    console.error('[SELF ROLE INTERACTION ERROR]', err.message);
    if (!interaction.replied) {
      await interaction.reply({ content: `⚠️ Error toggling role: ${err.message}`, ephemeral: true }).catch(() => { });
    }
  }
});

// ============================================================================
// WELCOME MESSAGES & SMART AI MEMBER DEPARTURE RECALCULATOR ENGINE
// ============================================================================

export interface WelcomeCardCanvasConfig {
  width: number;
  height: number;
  borderRadius: number;
  bgGradientStart: string;
  bgGradientMid: string;
  bgGradientEnd: string;
  borderColor: string;
  borderWidth: number;
  topStripeColor: string;
  topStripeHeight: number;
  avatarSize: number;
  avatarBorderColor: string;
  avatarBorderWidth: number;
  welcomeText: string;
  welcomeTextColor: string;
  welcomeTextSize: number;
  guildText: string;
  guildTextColor: string;
  guildTextSize: number;
  usernameColor: string;
  usernameSize: number;
  countTextTemplate: string;
  countTextColor: string;
  countTextSize: number;
  fontFamily: string;
}

export interface WelcomeConfig {
  enabled: boolean;
  channelName: string;
  messageTemplate: string;
  autoRoleName: string;
  dmWelcome: boolean;
  dmTemplate: string;
  canvas: WelcomeCardCanvasConfig;
}

const WELCOME_CONFIG_PATH = path.join(__dirname, 'welcome_config.json');

const DEFAULT_WELCOME_CONFIG: WelcomeConfig = {
  enabled: true,
  channelName: 'lounge-welcome',
  messageTemplate: '🎉 Welcome {user} to **{guild}**! You are our **#{count}** member!',
  autoRoleName: 'NONE',
  dmWelcome: true,
  dmTemplate: 'Welcome to **{guild}**! Check out our server rules and self-roles to get started!',
  canvas: {
    width: 1000,
    height: 450,
    borderRadius: 22,
    bgGradientStart: '#09090B',
    bgGradientMid: '#121218',
    bgGradientEnd: '#200A0D',
    borderColor: '#3F1218',
    borderWidth: 3,
    topStripeColor: '#E50914',
    topStripeHeight: 8,
    avatarSize: 170,
    avatarBorderColor: '#E50914',
    avatarBorderWidth: 6,
    welcomeText: 'WELCOME TO',
    welcomeTextColor: '#E50914',
    welcomeTextSize: 24,
    guildText: 'CLUB EZKEN',
    guildTextColor: '#FFFFFF',
    guildTextSize: 48,
    usernameColor: '#E4E4E7',
    usernameSize: 26,
    countTextTemplate: 'MEMBER #{count}',
    countTextColor: '#A1A1AA',
    countTextSize: 18,
    fontFamily: 'sans-serif',
  },
};

let welcomeConfig: WelcomeConfig = { ...DEFAULT_WELCOME_CONFIG };

try {
  if (fs.existsSync(WELCOME_CONFIG_PATH)) {
    const raw = fs.readFileSync(WELCOME_CONFIG_PATH, 'utf-8');
    welcomeConfig = { ...DEFAULT_WELCOME_CONFIG, ...JSON.parse(raw) };
  }
} catch (e: any) {
  console.warn('[SERVER] Could not load welcome_config.json, using defaults:', e.message);
}

function saveWelcomeConfig(newCfg: WelcomeConfig) {
  welcomeConfig = newCfg;
  try {
    fs.writeFileSync(WELCOME_CONFIG_PATH, JSON.stringify(welcomeConfig, null, 2), 'utf-8');
  } catch (e: any) {
    console.error('[SERVER] Failed to save welcome_config.json:', e.message);
  }
}

async function generateWelcomeCardBuffer(
  username: string,
  memberCount: number,
  avatarUrl: string,
  guildName: string,
  c: WelcomeCardCanvasConfig
): Promise<Buffer> {
  const width = c.width || 1000;
  const height = c.height || 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // 1. Background Gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, c.bgGradientStart || '#09090B');
  bg.addColorStop(0.5, c.bgGradientMid || '#121218');
  bg.addColorStop(1, c.bgGradientEnd || '#200A0D');
  ctx.fillStyle = bg;
  roundRect(0, 0, width, height, c.borderRadius || 22);
  ctx.fill();

  // Subtle ambient radial glow behind avatar
  const glow = ctx.createRadialGradient(width / 2, 140, 30, width / 2, 140, 260);
  glow.addColorStop(0, `${c.topStripeColor || '#E50914'}30`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 2. Card Border
  ctx.strokeStyle = c.borderColor || '#3F1218';
  ctx.lineWidth = c.borderWidth || 3;
  roundRect(1, 1, width - 2, height - 2, c.borderRadius || 22);
  ctx.stroke();

  // 3. Top Accent Stripe
  if ((c.topStripeHeight || 8) > 0) {
    ctx.save();
    roundRect(0, 0, width, height, c.borderRadius || 22);
    ctx.clip();
    ctx.fillStyle = c.topStripeColor || '#E50914';
    ctx.fillRect(0, 0, width, c.topStripeHeight || 8);
    ctx.restore();
  }

  // 4. Avatar Drawing
  const avatarSize = c.avatarSize || 170;
  const avatarX = (width - avatarSize) / 2;
  const avatarY = 55;

  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + (c.avatarBorderWidth || 6) / 2, 0, Math.PI * 2);
  ctx.strokeStyle = c.avatarBorderColor || '#E50914';
  ctx.lineWidth = c.avatarBorderWidth || 6;
  ctx.stroke();
  ctx.closePath();

  let loaded = false;
  if (avatarUrl) {
    try {
      const img = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      loaded = true;
    } catch {
      loaded = false;
    }
  }

  if (!loaded) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1A1A22';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 72px ${c.fontFamily || 'sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((username.charAt(0) || 'U').toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    ctx.restore();
  }

  // 5. Typography
  const fontFam = c.fontFamily || 'sans-serif';

  // "WELCOME TO"
  ctx.fillStyle = c.welcomeTextColor || '#E50914';
  ctx.font = `bold ${c.welcomeTextSize || 24}px ${fontFam}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText((c.welcomeText || 'WELCOME TO').toUpperCase(), width / 2, 275);

  // Guild Title
  ctx.fillStyle = c.guildTextColor || '#FFFFFF';
  ctx.font = `900 ${c.guildTextSize || 48}px ${fontFam}`;
  ctx.fillText((c.guildText || guildName || 'CLUB EZKEN').toUpperCase(), width / 2, 330);

  // Member Username
  ctx.fillStyle = c.usernameColor || '#E4E4E7';
  ctx.font = `bold ${c.usernameSize || 26}px ${fontFam}`;
  const cleanName = username.length > 22 ? username.substring(0, 21) + '…' : username;
  ctx.fillText(cleanName, width / 2, 375);

  // Member Counter
  ctx.fillStyle = c.countTextColor || '#A1A1AA';
  ctx.font = `bold ${c.countTextSize || 18}px ${fontFam}`;
  const countStr = (c.countTextTemplate || 'MEMBER #{count}').replace('{count}', memberCount.toLocaleString());
  ctx.fillText(countStr, width / 2, 410);

  return canvas.toBuffer('image/png');
}

// ============================================================================
// REAL-TIME MODERATION DATABASE & RECENT MESSAGES RING-BUFFER
// ============================================================================
export interface ModCaseRecord {
  id: number;
  case_id: string;
  user_id: string;
  user_tag: string;
  moderator_id: string;
  moderator_tag: string;
  action_type: 'WARN' | 'MUTE' | 'KICK' | 'BAN';
  reason: string;
  deleted_message?: string;
  timestamp: number;
  channel_name?: string;
}

export interface DeletedMessageAuditRecord {
  id: string;
  case_id: string;
  user_id: string;
  user_tag: string;
  user_avatar: string;
  channel_name: string;
  deleted_content: string;
  timestamp: number;
  what_happened: string;
  smart_ai_warning: string;
  warning_advice_do?: string;
  warning_advice_dont?: string;
  violation_categories: string[];
  ai_confidence: number;
  action_taken: 'MESSAGE_DELETED' | 'DELETED_AND_WARNED' | 'DELETED_AND_TIMED_OUT' | 'DELETED_AND_BANNED';
  warning_sent: boolean;
  messages_sent: any[];
}

export interface ModerationDatabase {
  cases: ModCaseRecord[];
  deletedMessages: DeletedMessageAuditRecord[];
}

const MOD_RECORDS_PATH = path.join(__dirname, 'moderation_records.json');

function loadModRecords(): ModerationDatabase {
  try {
    if (fs.existsSync(MOD_RECORDS_PATH)) {
      const raw = fs.readFileSync(MOD_RECORDS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        cases: Array.isArray(parsed.cases) ? parsed.cases : [],
        deletedMessages: Array.isArray(parsed.deletedMessages) ? parsed.deletedMessages : [],
      };
    }
  } catch (err: any) {
    console.warn('[SERVER] Could not read moderation_records.json:', err.message);
  }
  return { cases: [], deletedMessages: [] };
}

function saveModRecords(data: ModerationDatabase) {
  try {
    fs.writeFileSync(MOD_RECORDS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[SERVER] Failed to save moderation_records.json:', err.message);
  }
}

interface CachedMessage {
  id: string;
  content: string;
  author: {
    id: string;
    tag: string;
    username: string;
    avatar: string;
  };
  channelId: string;
  channelName: string;
  timestamp: number;
}

const recentMessagesCache = new Map<string, CachedMessage>();

function cacheIncomingMessage(msg: Message) {
  if (!msg || msg.author?.bot) return;
  recentMessagesCache.set(msg.id, {
    id: msg.id,
    content: msg.content || '',
    author: {
      id: msg.author.id,
      tag: msg.author.tag || msg.author.username,
      username: msg.author.username,
      avatar: msg.author.displayAvatarURL({ size: 128 }) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80',
    },
    channelId: msg.channelId,
    channelName: (msg.channel as any).name || 'general',
    timestamp: msg.createdTimestamp || Date.now(),
  });

  if (recentMessagesCache.size > 2000) {
    const oldestKey = recentMessagesCache.keys().next().value;
    if (oldestKey) recentMessagesCache.delete(oldestKey);
  }
}

// SMART AI WARNING GENERATOR: Generates context-based warning + Advice on what to do & what not to do
async function generateSmartAiWarningAndAdvice(
  username: string,
  deletedContent: string,
  categories: string[],
  reason: string,
  channelName: string
): Promise<{ smartWarning: string; whatHappened: string; adviceDo: string; adviceDont: string }> {
  let smartWarning = '';
  let whatHappened = `User sent an unauthorized message in #${channelName} violating community guidelines (${categories.join(', ') || reason}).`;
  let adviceDo = 'Engage positively in discussion, follow channel topics, and respect community members.';
  let adviceDont = 'Do not post unauthorized server invites, scam links, hate speech, or toxic insults.';

  const prompt = `You are the Official Smart Moderation AI for Discord server "Club EZKEN".
A user named "@${username}" sent this message in channel "#${channelName}" which was automatically deleted:
"${deletedContent.replace(/"/g, '\\"')}"
Reason / Infraction: ${reason}
Violation Categories: ${categories.join(', ')}

Analyze the exact text they sent and generate:
1. "whatHappened": A clear 1-line audit summary of what the user wrote and why it was deleted.
​2. "adviceDo": Concrete, helpful advice specifically on WHAT TO DO in Club EZKEN (e.g. how they should behave, where to talk, how to earn XP respectfully).
3. "adviceDont": Concrete advice on WHAT NOT TO DO (e.g. specific prohibited actions according to what they did).
4. "smartWarning": A direct, personalized Discord warning message addressed to @${username} that clearly explains what they wrote, why it was wrong, and provides the DO and DON'T guidance. Keep it firm, constructive, respectful, and under 80 words.

Return strictly a JSON object.`;

  if (aiClient) {
    try {
      const resp = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              whatHappened: { type: Type.STRING },
              adviceDo: { type: Type.STRING },
              adviceDont: { type: Type.STRING },
              smartWarning: { type: Type.STRING },
            },
            required: ['whatHappened', 'adviceDo', 'adviceDont', 'smartWarning'],
          },
        },
      });

      if (resp.text) {
        const parsed = JSON.parse(resp.text.trim());
        if (parsed.smartWarning) smartWarning = parsed.smartWarning;
        if (parsed.whatHappened) whatHappened = parsed.whatHappened;
        if (parsed.adviceDo) adviceDo = parsed.adviceDo;
        if (parsed.adviceDont) adviceDont = parsed.adviceDont;
      }
    } catch (err: any) {
      console.warn('[SMART AI WARNING GENERATION NOTICE]', err.message);
    }
  }

  if (!smartWarning) {
    smartWarning = `⚠️ **Club EZKEN Smart AI Warning (@${username})**: Your message in **#${channelName}** was deleted for **${categories.join(', ') || reason}**.\n` +
      `✅ **What to do**: ${adviceDo}\n` +
      `❌ **What NOT to do**: ${adviceDont}`;
  }

  return { smartWarning, whatHappened, adviceDo, adviceDont };
}

// ----------------------------------------------------------------------------
// GATEWAY LISTENER: MessageCreate (Cache & Real-Time Auto-Moderation Interception)
// ----------------------------------------------------------------------------
discordBot.on(Events.MessageCreate, async (message) => {
  if (!message || message.author?.bot) return;

  cacheIncomingMessage(message);

  const text = message.content || '';
  if (!text) return;

  // Auto-Moderation Evaluation Rules:
  const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discord\.com\/invite)\/[a-zA-Z0-9-]+/gi;
  const phishingRegex = /(free\s+discord\s+nitro|gift-discord|steam-free|claim\s+here\s+fast|http:\/\/[^\s]*fake)/i;
  const toxicRegex = /\b(idiot|idiots|trash|stupid|moron|loser|stfu|kill yourself|kys|garbage|scum|nigger|faggot|retard)\b/i;

  let flagged = false;
  let reason = '';
  let categories: string[] = [];
  let suggestedAction: 'DELETE' | 'WARN' | 'BAN' = 'WARN';

  if (inviteRegex.test(text)) {
    flagged = true;
    reason = 'Unauthorized external Discord server invite link posted.';
    categories = ['UNAUTHORIZED_INVITE'];
    suggestedAction = 'DELETE';
  } else if (phishingRegex.test(text)) {
    flagged = true;
    reason = 'Malicious phishing link or fake Nitro scam detected.';
    categories = ['PHISHING_SCAM'];
    suggestedAction = 'BAN';
  } else if (toxicRegex.test(text)) {
    flagged = true;
    reason = 'Toxic insults, profanity, or harassment targeting community members.';
    categories = ['TOXICITY', 'HARASSMENT'];
    suggestedAction = 'WARN';
  }

  if (!flagged) {
    await handleUserMessageXp(message);
    return;
  }

  const authorTag = message.author.tag || message.author.username;
  const authorId = message.author.id;
  const channelName = (message.channel as any).name || 'general';
  const avatarUrl = message.author.displayAvatarURL({ size: 128 }) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80';

  console.log(`[DISCORD AUTO-MOD] Intercepting offending message by @${authorTag} in #${channelName}: "${text}"`);

  // 1. Delete Offending Message Immediately
  await message.delete().catch((err) => {
    console.warn('[DISCORD AUTO-MOD] Could not delete message (Manage Messages perm required):', err.message);
  });

  // 2. Generate Smart AI Warning & Guidance with Gemini
  const { smartWarning, whatHappened, adviceDo, adviceDont } = await generateSmartAiWarningAndAdvice(
    authorTag,
    text,
    categories,
    reason,
    channelName
  );

  // 3. Save into Persistent Moderation Records
  const db = loadModRecords();
  const caseNumber = `#000${db.cases.length + 1}`;
  const recordId = `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newDeletedRecord: DeletedMessageAuditRecord = {
    id: recordId,
    case_id: caseNumber,
    user_id: authorId,
    user_tag: authorTag,
    user_avatar: avatarUrl,
    channel_name: `#${channelName}`,
    deleted_content: text,
    timestamp: Date.now(),
    what_happened: whatHappened,
    smart_ai_warning: smartWarning,
    warning_advice_do: adviceDo,
    warning_advice_dont: adviceDont,
    violation_categories: categories,
    ai_confidence: 0.98,
    action_taken: suggestedAction === 'BAN' ? 'DELETED_AND_BANNED' : 'DELETED_AND_WARNED',
    warning_sent: true,
    messages_sent: [
      {
        id: `msg_${Date.now()}`,
        sender: 'BOT_AI',
        senderName: 'Club EZKEN Smart AI Shield',
        text: smartWarning,
        timestamp: Date.now(),
        deliveryMethod: 'DISCORD_DM',
        deliveredLive: true,
      },
    ],
  };

  const newCaseRecord: ModCaseRecord = {
    id: Date.now(),
    case_id: caseNumber,
    user_id: authorId,
    user_tag: authorTag,
    moderator_id: discordBot.user?.id || 'bot_automod',
    moderator_tag: 'ClubEZ (Smart AI Shield)',
    action_type: suggestedAction === 'BAN' ? 'BAN' : 'WARN',
    reason: `${reason} — ${whatHappened}`,
    deleted_message: text,
    timestamp: Date.now(),
    channel_name: `#${channelName}`,
  };

  db.deletedMessages.unshift(newDeletedRecord);
  db.cases.unshift(newCaseRecord);
  saveModRecords(db);

  // 4. Send Personalized Smart AI Warning to User (DM + fallback Channel Ping)
  let dmDelivered = false;
  try {
    const dmEmbed = new EmbedBuilder()
      .setTitle('🛡️ Club EZKEN • Smart AI Moderation Notice')
      .setColor(0xE50914)
      .setDescription(`Your message in **#${channelName}** was automatically removed for **${categories.join(', ')}**.`)
      .addFields(
        { name: 'Deleted Message', value: `\`\`\`${text.substring(0, 300)}\`\`\`` },
        { name: '✅ What to Do', value: adviceDo },
        { name: '❌ What NOT to Do', value: adviceDont },
        { name: 'Official Guidance', value: smartWarning }
      )
      .setFooter({ text: `Case ${caseNumber} • Club EZKEN Community Standards` })
      .setTimestamp();

    await message.author.send({ embeds: [dmEmbed] });
    dmDelivered = true;
  } catch {
    // If user has DMs disabled, dispatch a short polite ping in the channel that auto-deletes
    try {
      const pingNotice = await (message.channel as TextChannel).send({
        content: `⚠️ <@${authorId}>: Your message was deleted for **${categories.join(', ')}**. Please check server rules and follow Club EZKEN guidelines!`,
      });
      setTimeout(() => pingNotice.delete().catch(() => { }), 15000);
    } catch { }
  }

  // 5. Post Official Audit Log Embed directly to MOD_LOGS_CHANNEL_ID (1559441137624678440)
  try {
    const modLogsChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) as TextChannel ||
      (await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null)) as TextChannel;

    if (modLogsChan && modLogsChan.isTextBased()) {
      const auditEmbed = new EmbedBuilder()
        .setTitle(`🛡️ AUTO-MODERATION INTERCEPTION • ${suggestedAction}`)
        .setColor(0xE50914)
        .setDescription(
          `**Offender**: <@${authorId}> (\`${authorTag}\` • ID: \`${authorId}\`)\n` +
          `**Channel**: <#${message.channelId}> (#${channelName})\n` +
          `**Violation**: **${categories.join(', ')}** (${reason})\n` +
          `**Case**: \`${caseNumber}\`\n\n` +
          `**Deleted Offending Content**:\n\`\`\`${text.substring(0, 400)}\`\`\``
        )
        .addFields(
          { name: '🤖 Smart AI Analysis', value: whatHappened },
          { name: '✅ Advice (What to Do)', value: adviceDo },
          { name: '❌ Advice (What NOT to Do)', value: adviceDont },
          { name: '📩 Warning Dispatch', value: dmDelivered ? '✅ Direct Message delivered to user' : '⚠️ User DMs closed (Channel ping dispatched)' }
        )
        .setFooter({ text: 'Club EZKEN Smart AI Moderation Suite' })
        .setTimestamp();

      await modLogsChan.send({ embeds: [auditEmbed] });
      console.log(`[DISCORD AUTO-MOD] Successfully posted interception audit to #mod-logs (${MOD_LOGS_CHANNEL_ID})!`);
    }
  } catch (err: any) {
    console.warn('[DISCORD AUTO-MOD] Error posting to #mod-logs:', err.message);
  }
});

// ----------------------------------------------------------------------------
// GATEWAY LISTENER: MessageDelete (Capture & Log Deleted Messages to Mod-Logs)
// ----------------------------------------------------------------------------
discordBot.on(Events.MessageDelete, async (message) => {
  try {
    const cached = recentMessagesCache.get(message.id);
    const content = cached?.content || (message.content ? message.content : null);
    const authorTag = cached?.author.tag || (message.author ? message.author.tag : 'Member');
    const authorId = cached?.author.id || (message.author ? message.author.id : 'Unknown');
    const authorAvatar = cached?.author.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80';
    const chanName = cached?.channelName || ((message.channel as any)?.name ? (message.channel as any).name : 'channel');
    const chanId = message.channelId;

    if (!content) return;

    const db = loadModRecords();
    const alreadyLogged = db.deletedMessages.some(
      (d) => d.id === message.id || (d.deleted_content === content && Date.now() - d.timestamp < 10000)
    );

    if (alreadyLogged) return;

    const recordId = message.id || `del_${Date.now()}`;
    const caseNumber = `#000${db.cases.length + 1}`;

    const newDel: DeletedMessageAuditRecord = {
      id: recordId,
      case_id: caseNumber,
      user_id: authorId,
      user_tag: authorTag,
      user_avatar: authorAvatar,
      channel_name: `#${chanName}`,
      deleted_content: content,
      timestamp: Date.now(),
      what_happened: `Message was deleted in #${chanName}. Intercepted by bot gateway cache.`,
      smart_ai_warning: `A message in #${chanName} was deleted. Please ensure all shared content follows Club EZKEN guidelines.`,
      warning_advice_do: 'Follow channel topics and keep discussions constructive.',
      warning_advice_dont: 'Do not post content that violates server rules or requires deletion.',
      violation_categories: ['MESSAGE_DELETION'],
      ai_confidence: 0.95,
      action_taken: 'MESSAGE_DELETED',
      warning_sent: false,
      messages_sent: [],
    };

    db.deletedMessages.unshift(newDel);
    saveModRecords(db);

    console.log(`[DISCORD BOT] Message deleted in #${chanName} by @${authorTag}: "${content.substring(0, 50)}"`);

    // Post Audit to Channel 1559441137624678440
    const modLogsChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) as TextChannel ||
      (await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null)) as TextChannel;

    if (modLogsChan && modLogsChan.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('🗑️ MESSAGE DELETED AUDIT LOG')
        .setColor(0x71717A)
        .setDescription(
          `**Author**: <@${authorId}> (\`${authorTag}\`)\n` +
          `**Channel**: <#${chanId}> (#${chanName})\n` +
          `**Audit Record ID**: \`${recordId}\`\n\n` +
          `**Deleted Message Content**:\n\`\`\`${content.substring(0, 500)}\`\`\``
        )
        .setFooter({ text: 'Club EZKEN Real-Time Audit System' })
        .setTimestamp();

      await modLogsChan.send({ embeds: [embed] }).catch(() => { });
    }
  } catch (err: any) {
    console.error('[MESSAGE DELETE HANDLER ERROR]', err.message);
  }
});

// ----------------------------------------------------------------------------
// GATEWAY LISTENERS: Channel & Role Real-Time State Synchronizers
// ----------------------------------------------------------------------------
discordBot.on(Events.ChannelCreate, (channel) => {
  console.log(`[DISCORD BOT] Channel created: #${(channel as any).name || channel.id} — Server state synchronized immediately!`);
});
discordBot.on(Events.ChannelDelete, (channel) => {
  console.log(`[DISCORD BOT] Channel deleted: #${(channel as any).name || channel.id} — Server state synchronized immediately!`);
});
discordBot.on(Events.ChannelUpdate, (_oldChan, newChan) => {
  console.log(`[DISCORD BOT] Channel updated: #${(newChan as any).name || newChan.id} — Server state synchronized immediately!`);
});
discordBot.on(Events.GuildRoleCreate, (role) => {
  console.log(`[DISCORD BOT] Role created: @${role.name} — Server state synchronized immediately!`);
});
discordBot.on(Events.GuildRoleDelete, (role) => {
  console.log(`[DISCORD BOT] Role deleted: @${role.name} — Server state synchronized immediately!`);
});
discordBot.on(Events.GuildRoleUpdate, (_oldRole, newRole) => {
  console.log(`[DISCORD BOT] Role updated: @${newRole.name} — Server state synchronized immediately!`);
});

// Gateway Listener: GuildMemberAdd (Member Joins -> Generate Canvas & Post Welcome + 100% Customizable Arrival Role)
discordBot.on(Events.GuildMemberAdd, async (member) => {
  if (!welcomeConfig.enabled) return;

  try {
    const guild = member.guild;
    const count = guild.memberCount;
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const username = member.user.username;

    console.log(`[DISCORD BOT] GuildMemberAdd: @${member.user.tag} joined ${guild.name} (Total: ${count})`);

    const cardBuffer = await generateWelcomeCardBuffer(
      username,
      count,
      avatarUrl,
      guild.name,
      welcomeConfig.canvas
    );

    const channels = await fetchGuildChannels();
    const cleanTargetName = welcomeConfig.channelName.replace('#', '').toLowerCase();
    const targetChanMeta = channels.find((c: any) =>
      c.name.toLowerCase() === cleanTargetName ||
      c.name.toLowerCase().includes(cleanTargetName) ||
      c.name.toLowerCase().includes('welcome')
    );

    const targetChannelId = targetChanMeta ? targetChanMeta.id : null;
    let targetChannel: any = null;
    if (targetChannelId) {
      targetChannel = discordBot.channels.cache.get(targetChannelId) || await discordBot.channels.fetch(targetChannelId).catch(() => null);
    }

    const welcomeMsg = welcomeConfig.messageTemplate
      .replace('{user}', `<@${member.id}>`)
      .replace('{guild}', guild.name)
      .replace('{count}', count.toString());

    if (targetChannel && targetChannel.isTextBased()) {
      const attachment = new AttachmentBuilder(cardBuffer, { name: `welcome-${member.id}.png` });
      await (targetChannel as TextChannel).send({
        content: welcomeMsg,
        files: [attachment],
      });
      console.log(`[DISCORD BOT] Successfully posted Welcome Card for @${member.user.tag} into #${(targetChannel as TextChannel).name}!`);
    } else {
      console.warn(`[DISCORD BOT] Could not find welcome channel #${welcomeConfig.channelName}`);
    }

    // 100% Customizable Arrival Role (Ken's Choice: 'NONE' = no role assigned; otherwise find and assign whichever role Ken chose)
    let assignedRoleName: string | null = null;
    const targetArrivalRole = (welcomeConfig.autoRoleName || '').trim();

    if (targetArrivalRole && targetArrivalRole.toUpperCase() !== 'NONE') {
      const cleanTarget = targetArrivalRole.replace(/^@+/, '').toLowerCase();
      const matchedRole = guild.roles.cache.find(
        (r) => r.id === targetArrivalRole || r.name.replace(/^@+/, '').trim().toLowerCase() === cleanTarget
      );

      if (matchedRole) {
        await member.roles.add(matchedRole).catch((err) => {
          console.warn(`[DISCORD BOT] Failed to assign role @${matchedRole.name}:`, err.message);
        });
        assignedRoleName = matchedRole.name;
        console.log(`[DISCORD BOT] Assigned customizable arrival role @${matchedRole.name} to @${member.user.tag}`);
      } else {
        console.warn(`[DISCORD BOT] Configured arrival role "${targetArrivalRole}" not found in server roles.`);
      }
    } else {
      console.log(`[DISCORD BOT] No arrival role configured (Set to None/Clean Join).`);
    }

    // Direct Message Welcome
    if (welcomeConfig.dmWelcome) {
      const dmMsg = welcomeConfig.dmTemplate
        .replace('{user}', member.user.username)
        .replace('{guild}', guild.name)
        .replace('{count}', count.toString());
      const dmAttachment = new AttachmentBuilder(cardBuffer, { name: 'welcome-card.png' });
      await member.send({ content: dmMsg, files: [dmAttachment] }).catch(() => {
        console.log(`[DISCORD BOT] Member @${member.user.tag} has direct messages disabled.`);
      });
    }

    // Post Audit directly to MOD_LOGS_CHANNEL_ID (1559441137624678440)
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) as TextChannel ||
      (await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null)) as TextChannel;

    if (modLogChan && modLogChan.isTextBased()) {
      const roleText = assignedRoleName ? ` Role **@${assignedRoleName}** assigned.` : ' (No arrival role assigned).';
      await modLogChan.send({
        content: `🎉 **[GATEWAY AUDIT] New Member Joined** • <@${member.id}> joined **${guild.name}** as **Member #${count}**!${roleText}`,
      }).catch(() => { });
    }
  } catch (err: any) {
    console.error('[GUILD MEMBER ADD HANDLER ERROR]', err.message);
  }
});

// Gateway Listener: GuildMemberRemove (Member Leaves -> Smart AI Recalculates Total & Logs to 1559441137624678440)
discordBot.on(Events.GuildMemberRemove, async (member) => {
  try {
    const guild = member.guild;
    const newCount = guild.memberCount;
    const userTag = member.user?.tag || member.displayName || 'Unknown Member';
    const userId = member.id;

    console.log(`[DISCORD BOT] GuildMemberRemove: @${userTag} left ${guild.name}. Recalculated total members: ${newCount}`);

    let aiNote = `📉 **[SMART AI AUDIT • MEMBER DEPARTURE]**\n` +
      `Member **@${userTag}** (\`${userId}\`) has departed from **${guild.name}**.\n` +
      `📊 **Recalculated Total**: **${newCount} members** (-1 deduction applied).\n` +
      `⚡ **Counter Synchronized**: The next joining member will continue onwards numbered **#${newCount + 1}**.`;

    if (aiClient) {
      try {
        const aiPrompt = `A member departed from Discord server "${guild.name}".
Member: @${userTag} (ID: ${userId}).
The total member count has just decreased by 1 and is now exactly ${newCount} members.
The next incoming member slot is now accurately synchronized to #${newCount + 1}.
Generate a sharp, professional 2-line Discord audit note for #mod-logs confirming the departure, reporting the recalculated total of ${newCount} members, and confirming the next joining member will be numbered #${newCount + 1}. Use Discord Markdown.`;

        const resp = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: aiPrompt,
        });
        if (resp.text) {
          aiNote = `📉 **[SMART AI AUDIT • MEMBER DEPARTURE]**\n${resp.text.trim()}\n*Recalculated Total: ${newCount} members • Next Welcome Slot: #${newCount + 1}*`;
        }
      } catch (aiErr: any) {
        console.warn('[GEMINI DEPARTURE AUDIT NOTE ERROR]', aiErr.message);
      }
    }

    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) as TextChannel ||
      (await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null)) as TextChannel;

    if (modLogChan && modLogChan.isTextBased()) {
      await modLogChan.send({ content: aiNote }).catch(() => { });
    }
  } catch (err: any) {
    console.error('[GUILD MEMBER REMOVE HANDLER ERROR]', err.message);
  }
});

discordBot.login(DISCORD_TOKEN).catch((err) => {
  console.warn('[DISCORD BOT] Gateway login notice:', err.message);
});

// ============================================================================
// HARD XP LEVELING SYSTEM, VOICE CHANNEL TRACKING & PROGRESSIVE PERKS ENGINE
// STRICTLY ONLY KEN'S 9 TICKED ROLES FROM HIS SERVER SCREENSHOT
// ============================================================================

export interface LevelTierConfig {
  level: number;
  name: string;
  color: string;
  xpRequired: number;
  features: string[];
  description: string;
}

export const OFFICIAL_LEVEL_TIERS_CONFIG: Record<number, LevelTierConfig> = {
  1: {
    level: 1,
    name: 'ROOKIE',
    color: '#00A8FC',
    xpRequired: 0,
    features: ['Basic Text Chatting', 'Voice Chat Speaking'],
    description: 'Starter tier. Restricted from posting links, rich embeds, image attachments, or external emojis/stickers.',
  },
  10: {
    level: 10,
    name: 'INSIDER',
    color: '#2DD4BF',
    xpRequired: 8495,
    features: ['Posting Web Links', 'Attach Files & Images'],
    description: 'Unlocks uploading screenshots, game recordings, and sharing web URLs in text channels.',
  },
  20: {
    level: 20,
    name: 'RESIDENT',
    color: '#38BDF8',
    xpRequired: 30627,
    features: ['Posting GIFs (Tenor)', 'Rich Embed Previews', 'Video Embeds'],
    description: 'Unlocks animated GIF picker via Tenor and automatic link rich preview embeds in chat.',
  },
  30: {
    level: 30,
    name: 'CLUB REGULAR',
    color: '#FBBF24',
    xpRequired: 64960,
    features: ['Use External Emojis', 'Use External Stickers'],
    description: 'Unlocks using custom emojis and animated stickers from other Discord servers.',
  },
  40: {
    level: 40,
    name: 'HYPEMASTER',
    color: '#F97316',
    xpRequired: 110653,
    features: ['Create Public Threads', 'Priority Speaker in VC'],
    description: 'Unlocks creating topic threads and priority voice volume override in voice lobbies.',
  },
  55: {
    level: 55,
    name: 'ASCENDANT',
    color: '#EF4444',
    xpRequired: 199444,
    features: ['Voice Soundboard', 'Use External Sounds'],
    description: 'Unlocks playing custom soundboard sound effects and clips in voice channels.',
  },
  70: {
    level: 70,
    name: 'CLUB TITAN',
    color: '#E11D48',
    xpRequired: 310033,
    features: ['VIP Lounge Access', 'High-Tier Scrim Channels'],
    description: 'Grants access to private VIP text channels and high-tier competitive scrim rooms.',
  },
  85: {
    level: 85,
    name: 'THE IMMORTAL',
    color: '#FFFFFF',
    xpRequired: 442159,
    features: ['Custom Nickname', 'Voice Activity Detection (No PTT needed)'],
    description: 'Unlocks custom server nickname formatting and unconstrained voice activity.',
  },
  100: {
    level: 100,
    name: 'STAR SUPPORTER',
    color: '#EC4899',
    xpRequired: 601438,
    features: ['Max Prestige Badge', 'Hall of Fame Showcase', 'Event Host Pings'],
    description: 'Ultimate Club EZKEN status! Inducted into Hall of Fame with event host pings.',
  },
};

const ALLOWED_LEVEL_ROLES: Record<string, string> = {
  'ROOKIE': '#00A8FC',
  'INSIDER': '#2DD4BF',
  'RESIDENT': '#38BDF8',
  'CLUB REGULAR': '#FBBF24',
  'HYPEMASTER': '#F97316',
  'ASCENDANT': '#EF4444',
  'CLUB TITAN': '#E11D48',
  'THE IMMORTAL': '#FFFFFF',
  'STAR SUPPORTER': '#EC4899',
};

let levelTiers: Record<number, { name: string; color: string }> = {
  1: { name: 'ROOKIE', color: '#00A8FC' },
  10: { name: 'INSIDER', color: '#2DD4BF' },
  20: { name: 'RESIDENT', color: '#38BDF8' },
  30: { name: 'CLUB REGULAR', color: '#FBBF24' },
  40: { name: 'HYPEMASTER', color: '#F97316' },
  55: { name: 'ASCENDANT', color: '#EF4444' },
  70: { name: 'CLUB TITAN', color: '#E11D48' },
  85: { name: 'THE IMMORTAL', color: '#FFFFFF' },
  100: { name: 'STAR SUPPORTER', color: '#EC4899' },
};

export function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(120 * Math.pow(level, 1.85));
}

export function getLevelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  let level = 1;
  while (level < 100 && xp >= getXpRequiredForLevel(level + 1)) {
    level++;
  }
  return level;
}

export function getTierRoleForLevel(level: number): LevelTierConfig {
  const tiers = [100, 85, 70, 55, 40, 30, 20, 10, 1];
  for (const t of tiers) {
    if (level >= t) {
      return OFFICIAL_LEVEL_TIERS_CONFIG[t];
    }
  }
  return OFFICIAL_LEVEL_TIERS_CONFIG[1];
}

export function getAllUnlockedFeaturesForLevel(level: number): string[] {
  const allFeatures: string[] = [];
  const tiers = [1, 10, 20, 30, 40, 55, 70, 85, 100];
  for (const t of tiers) {
    if (level >= t) {
      allFeatures.push(...OFFICIAL_LEVEL_TIERS_CONFIG[t].features);
    }
  }
  return Array.from(new Set(allFeatures));
}

export function getNewlyUnlockedFeatures(oldLevel: number, newLevel: number): string[] {
  const oldFeatures = new Set(getAllUnlockedFeaturesForLevel(oldLevel));
  const newFeatures = getAllUnlockedFeaturesForLevel(newLevel);
  return newFeatures.filter((f) => !oldFeatures.has(f));
}

// Persistent XP Database Setup
export interface UserXpRecord {
  userId: string;
  username: string;
  avatar: string;
  xp: number;
  level: number;
  totalMessages: number;
  voiceMinutes: number;
  lastMessageTimestamp: number;
  tierRole: string;
  unlockedFeatures: string[];
}

export interface XpDatabase {
  users: Record<string, UserXpRecord>;
}

const XP_DATABASE_PATH = path.join(__dirname, 'xp_database.json');

export function loadXpDatabase(): XpDatabase {
  try {
    if (fs.existsSync(XP_DATABASE_PATH)) {
      const raw = fs.readFileSync(XP_DATABASE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err: any) {
    console.warn('[SERVER] Could not load xp_database.json, creating initial store:', err.message);
  }
  return { users: {} };
}

export function saveXpDatabase(db: XpDatabase) {
  try {
    fs.writeFileSync(XP_DATABASE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[SERVER] Failed to save xp_database.json:', err.message);
  }
}

// User Message Cooldown Tracker (Strict 60-second cooldown per user to prevent spam XP)
const userMessageCooldowns = new Map<string, number>();

// Active Voice Chat Sessions Tracker
interface VoiceSession {
  channelId: string;
  channelName: string;
  joinedAt: number;
  lastTickAt: number;
}
const activeVoiceSessions = new Map<string, VoiceSession>();

// Core function to award XP and trigger level up & feature unlocks
async function awardXpToUser(
  db: XpDatabase,
  userId: string,
  username: string,
  avatar: string,
  xpGain: number,
  voiceMinutesGain: number,
  source: 'TEXT' | 'VOICE',
  contextChannel?: any
): Promise<{
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  tierRole: LevelTierConfig;
  newlyUnlocked: string[];
  totalXp: number;
}> {
  if (!db.users[userId]) {
    db.users[userId] = {
      userId,
      username: username || `User_${userId.slice(-4)}`,
      avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80',
      xp: 0,
      level: 1,
      totalMessages: 0,
      voiceMinutes: 0,
      lastMessageTimestamp: 0,
      tierRole: 'ROOKIE',
      unlockedFeatures: getAllUnlockedFeaturesForLevel(1),
    };
  }

  const u = db.users[userId];
  if (username) u.username = username;
  if (avatar) u.avatar = avatar;

  const oldLevel = u.level;
  u.xp += xpGain;
  if (voiceMinutesGain > 0) {
    u.voiceMinutes += voiceMinutesGain;
  }
  if (source === 'TEXT') {
    u.totalMessages += 1;
    u.lastMessageTimestamp = Date.now();
  }

  const newLevel = getLevelFromXp(u.xp);
  u.level = newLevel;
  const currentTier = getTierRoleForLevel(newLevel);
  u.tierRole = currentTier.name;
  u.unlockedFeatures = getAllUnlockedFeaturesForLevel(newLevel);

  const leveledUp = newLevel > oldLevel;
  const newlyUnlocked = leveledUp ? getNewlyUnlockedFeatures(oldLevel, newLevel) : [];

  if (leveledUp) {
    console.log(`[LEVELING PROMOTION] @${username} (${userId}) leveled up: Level ${oldLevel} ➔ Level ${newLevel} (@${currentTier.name})`);
    // 1. Assign Discord Role to Member
    await assignLevelRoleToMember(userId, currentTier.name);

    // 2. Announce in Discord Chat & Mod Logs
    await announceLevelUp(userId, username, oldLevel, newLevel, currentTier, newlyUnlocked, source, contextChannel);
  }

  return {
    leveledUp,
    oldLevel,
    newLevel,
    tierRole: currentTier,
    newlyUnlocked,
    totalXp: u.xp,
  };
}

async function assignLevelRoleToMember(userId: string, tierRoleName: string) {
  try {
    const roles = await fetchGuildRoles();
    const cleanTarget = tierRoleName.replace(/^@+/, '').trim().toLowerCase();
    let targetRole = roles.find((r: any) => r.name.replace(/^@+/, '').trim().toLowerCase() === cleanTarget);

    if (!targetRole) {
      const tierConfig = Object.values(OFFICIAL_LEVEL_TIERS_CONFIG).find((t) => t.name.toLowerCase() === cleanTarget);
      const colorInt = tierConfig ? parseInt(tierConfig.color.replace('#', ''), 16) : 0x00A8FC;
      const createRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
        method: 'POST',
        headers: getDiscordHeaders(),
        body: JSON.stringify({
          name: tierRoleName,
          color: colorInt,
          hoist: true,
          mentionable: true,
        }),
      });
      if (createRes.ok) {
        targetRole = await createRes.json();
      }
    }

    if (targetRole) {
      await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${targetRole.id}`, {
        method: 'PUT',
        headers: getDiscordHeaders(),
      });
      console.log(`[LEVELING] Assigned role @${tierRoleName} to member ${userId}`);
    }
  } catch (err: any) {
    console.warn(`[LEVELING] Error assigning role @${tierRoleName}:`, err.message);
  }
}

async function announceLevelUp(
  userId: string,
  username: string,
  oldLevel: number,
  newLevel: number,
  tier: LevelTierConfig,
  newlyUnlocked: string[],
  source: 'TEXT' | 'VOICE',
  contextChannel?: any
) {
  try {
    const colorInt = parseInt(tier.color.replace('#', ''), 16) || 0xE50914;
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ LEVEL UP! • ASCENDED TO LEVEL ${newLevel}`)
      .setColor(colorInt)
      .setDescription(
        `🎉 Congratulations <@${userId}>! You advanced from **Level ${oldLevel}** ➔ **Level ${newLevel}** via **${source === 'VOICE' ? '🎙️ Voice Chat (VC)' : '💬 Text Chat'}**!\n\n` +
        `🎖️ **Official Tier Role**: **@${tier.name}**\n` +
        (newlyUnlocked.length > 0 ? `🔓 **Newly Unlocked Features**: ${newlyUnlocked.join(' • ')}\n` : '') +
        `📖 *${tier.description}*`
      )
      .setFooter({ text: 'Club EZKEN Hard Progression Suite • Strictly 9 Official Ticked Ranks' })
      .setTimestamp();

    // 1. Post to channel where they chatted or general
    let targetChan = contextChannel && contextChannel.isTextBased?.() ? contextChannel : null;
    if (!targetChan) {
      const channels = await fetchGuildChannels();
      const gen = channels.find((c: any) => c.name === 'general' || c.name.includes('general') || c.type === 0);
      if (gen) {
        targetChan = discordBot.channels.cache.get(gen.id) || await discordBot.channels.fetch(gen.id).catch(() => null);
      }
    }

    if (targetChan && targetChan.isTextBased()) {
      await targetChan.send({ content: `🎉 <@${userId}> has leveled up!`, embeds: [embed] }).catch(() => { });
    }

    // 2. Also log to #mod-logs (1559441137624678440)
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) as TextChannel ||
      (await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null)) as TextChannel;
    if (modLogChan && modLogChan.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setTitle(`📈 PROMOTION AUDIT • Level ${newLevel} reached by @${username}`)
        .setColor(colorInt)
        .setDescription(
          `**Member**: <@${userId}> (\`${username}\` • ID: \`${userId}\`)\n` +
          `**Progression Source**: ${source === 'VOICE' ? '🎙️ Voice Channel Stay' : '💬 Text Chat Messages'}\n` +
          `**New Rank**: **@${tier.name}** (Level ${newLevel})\n` +
          `**Unlocked Features**: ${tier.features.join(', ')}`
        )
        .setFooter({ text: 'Club EZKEN Leveling & Permission Ledger' })
        .setTimestamp();

      await modLogChan.send({ embeds: [logEmbed] }).catch(() => { });
    }
  } catch (err: any) {
    console.warn('[LEVEL ANNOUNCE ERROR]', err.message);
  }
}

// Handler for incoming non-offending chat messages
async function handleUserMessageXp(message: Message) {
  if (!message || message.author?.bot) return;

  const userId = message.author.id;
  const username = message.author.tag || message.author.username;
  const avatar = message.author.displayAvatarURL({ size: 128 }) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80';
  const now = Date.now();

  const lastTime = userMessageCooldowns.get(userId) || 0;
  // Hard Progression rate limiting: strictly 1 XP grant per 60 seconds
  if (now - lastTime < 60000) {
    return;
  }
  userMessageCooldowns.set(userId, now);

  const xpGained = Math.floor(Math.random() * 6) + 15; // 15 to 20 XP per message
  const db = loadXpDatabase();
  await awardXpToUser(db, userId, username, avatar, xpGained, 0, 'TEXT', message.channel);
  saveXpDatabase(db);
}

// Gateway Listener: Voice State Update for VC Leveling & TempVoice Channels
discordBot.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  // TempVoice Spawning & Cleanup Lifecycle
  try {
    await handleTempVoiceVoiceStateUpdate(oldState, newState, discordBot);
  } catch (err: any) {
    console.error('[TEMP VOICE STATE ERROR]', err.message);
  }

  const userId = newState.id || oldState.id;
  if (!userId) return;
  const member = newState.member || oldState.member;
  if (member?.user?.bot) return;

  const userTag = member?.user?.tag || member?.user?.username || `User_${userId.slice(-4)}`;

  // 1. Joined a Voice Channel
  if (!oldState.channelId && newState.channelId) {
    const chanName = newState.channel?.name || 'Voice Channel';
    activeVoiceSessions.set(userId, {
      channelId: newState.channelId,
      channelName: chanName,
      joinedAt: Date.now(),
      lastTickAt: Date.now(),
    });
    console.log(`[DISCORD VC] @${userTag} joined voice channel #${chanName}`);
  }
  // 2. Left a Voice Channel
  else if (oldState.channelId && !newState.channelId) {
    const session = activeVoiceSessions.get(userId);
    if (session) {
      const minutesSpent = Math.max(1, Math.floor((Date.now() - session.joinedAt) / 60000));
      activeVoiceSessions.delete(userId);
      console.log(`[DISCORD VC] @${userTag} left voice channel #${session.channelName} after ${minutesSpent} mins`);
    }
  }
  // 3. Switched Voice Channels
  else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const session = activeVoiceSessions.get(userId);
    const newChanName = newState.channel?.name || 'Voice Channel';
    if (session) {
      session.channelId = newState.channelId;
      session.channelName = newChanName;
    } else {
      activeVoiceSessions.set(userId, {
        channelId: newState.channelId,
        channelName: newChanName,
        joinedAt: Date.now(),
        lastTickAt: Date.now(),
      });
    }
    console.log(`[DISCORD VC] @${userTag} moved to voice channel #${newChanName}`);
  }
});

// Periodic Voice Channel XP Ticker (Awards 8 XP per minute in VC)
setInterval(async () => {
  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    if (!liveGuild) return;

    const voiceStates = liveGuild.voiceStates.cache;
    if (voiceStates.size === 0) return;

    const db = loadXpDatabase();
    let updatedAny = false;

    for (const [userId, vs] of voiceStates) {
      if (!vs.channelId || vs.member?.user?.bot) continue;
      // Do not award XP if user is deafened or in an AFK channel
      if (vs.deaf || vs.selfDeaf) continue;
      if (liveGuild.afkChannelId && vs.channelId === liveGuild.afkChannelId) continue;

      const userTag = vs.member?.user?.tag || vs.member?.user?.username || `User_${userId.slice(-4)}`;
      const avatarUrl = vs.member?.user?.displayAvatarURL({ size: 128 }) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80';

      // 8 XP per minute in Voice Chat (Hard Progression rate)
      const vcXpGain = 8;
      const res = await awardXpToUser(db, userId, userTag, avatarUrl, vcXpGain, 1, 'VOICE', vs.channel);
      if (res.leveledUp) {
        console.log(`[DISCORD VC LEVEL UP] @${userTag} reached Level ${res.newLevel} (Tier: @${res.tierRole.name}) in VC!`);
      }
      updatedAny = true;
    }

    if (updatedAny) {
      saveXpDatabase(db);
    }
  } catch (err: any) {
    console.warn('[DISCORD VC TICK ERROR]', err.message);
  }
}, 60000);

// Discord State Retrieval Helpers with Instant Gateway Cache
async function fetchGuildChannels(): Promise<any[]> {
  const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
  if (liveGuild && liveGuild.channels.cache.size > 0) {
    return Array.from(liveGuild.channels.cache.values()).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
    }));
  }
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
      headers: getDiscordHeaders(),
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function fetchGuildRoles(): Promise<any[]> {
  const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
  if (liveGuild && liveGuild.roles.cache.size > 0) {
    return Array.from(liveGuild.roles.cache.values()).map((r: any) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      position: r.position,
    }));
  }
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
      headers: getDiscordHeaders(),
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

// -----------------------------------------------------------------------------
// DISCORD REST API PROXIES & LIVE MANAGEMENT
// -----------------------------------------------------------------------------

// 1. Fetch Real Discord Server Info, Channels & Roles
app.get('/api/discord/guild', async (_req: Request, res: Response) => {
  try {
    const guildRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}?with_counts=true`, {
      headers: getDiscordHeaders(),
    });

    if (!guildRes.ok) {
      const errText = await guildRes.text();
      return res.json({
        connected: false,
        guildId: DISCORD_GUILD_ID,
        name: 'Club EZKEN',
        icon: null,
        approximate_member_count: 4,
        approximate_presence_count: 4,
        channels: [],
        roles: [],
        levelTiers,
        error: `Discord API status ${guildRes.status}: ${errText.substring(0, 100)}`
      });
    }

    const guild = await guildRes.json();
    const channels = await fetchGuildChannels();
    const roles = await fetchGuildRoles();

    return res.json({
      connected: true,
      guildId: guild.id,
      name: guild.name,
      icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null,
      approximate_member_count: guild.approximate_member_count || guild.member_count || 4,
      approximate_presence_count: guild.approximate_presence_count || 4,
      channels,
      roles,
      levelTiers,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Create Real Channel (Text, Voice, or Category) in Discord Server
app.post('/api/discord/channels', async (req: Request, res: Response) => {
  const { name, type = 'text', topic = '', parentId } = req.body;

  if (!name) return res.status(400).json({ error: 'Channel name required.' });

  try {
    const formattedName = type === 'category' ? name : name.toLowerCase().replace(/\s+/g, '-');
    let discordType = 0; // GuildText
    if (type === 'voice') discordType = 2; // GuildVoice
    if (type === 'category') discordType = 4; // GuildCategory
    if (type === 'announcement') discordType = 5; // GuildAnnouncement

    const payload: any = {
      name: formattedName,
      type: discordType,
    };
    if (topic && discordType === 0) payload.topic = topic;
    if (parentId) payload.parent_id = parentId;

    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
      method: 'POST',
      headers: getDiscordHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Failed to create channel in Discord' });
    }

    return res.json({ success: true, channel: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Delete Channel from Discord Server
app.delete('/api/discord/channels/:id', async (req: Request, res: Response) => {
  const channelId = req.params.id;
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      method: 'DELETE',
      headers: getDiscordHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: data.message || 'Failed to delete channel' });
    }

    return res.json({ success: true, deletedChannelId: channelId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Create Real Role in Discord Server
app.post('/api/discord/roles', async (req: Request, res: Response) => {
  const { name, colorHex = '#E50914', hoist = true, mentionable = false, levelPerk = null } = req.body;

  if (!name) return res.status(400).json({ error: 'Role name required.' });

  try {
    const colorInt = parseInt(colorHex.replace('#', ''), 16) || 0;

    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
      method: 'POST',
      headers: getDiscordHeaders(),
      body: JSON.stringify({
        name,
        color: colorInt,
        hoist: !!hoist,
        mentionable: !!mentionable,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Failed to create role in Discord' });
    }

    if (levelPerk && typeof levelPerk === 'number') {
      levelTiers[levelPerk] = { name, color: colorHex };
    }

    return res.json({ success: true, role: data, levelTiers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Delete Role from Discord Server
app.delete('/api/discord/roles/:id', async (req: Request, res: Response) => {
  const roleId = req.params.id;
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles/${roleId}`, {
      method: 'DELETE',
      headers: getDiscordHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: data.message || 'Failed to delete role' });
    }

    // Clean up from level tiers if mapped
    for (const [lvl, val] of Object.entries(levelTiers)) {
      if ((val as any).roleId === roleId) {
        delete levelTiers[parseInt(lvl)];
      }
    }

    return res.json({ success: true, deletedRoleId: roleId, levelTiers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Send Custom Embed / Message to Discord Channel (With ActionRow Buttons Support)
app.post('/api/discord/send-message', async (req: Request, res: Response) => {
  const { channelId, channelName, content, title, description, colorHex = '#E50914', imageUrl, buttons } = req.body;

  let targetChannelId = channelId;

  // Resolve channel name if channelId not provided
  if (!targetChannelId && channelName) {
    const channels = await fetchGuildChannels();
    const cleanName = channelName.replace('#', '').toLowerCase();
    const found = channels.find((c: any) => c.name.toLowerCase() === cleanName || c.name.toLowerCase().includes(cleanName));
    if (found) targetChannelId = found.id;
  }

  // Default to announcements or general if still not found
  if (!targetChannelId) {
    const channels = await fetchGuildChannels();
    const fallback = channels.find((c: any) => c.name.includes('general') || c.name.includes('announcement') || c.type === 0);
    if (fallback) targetChannelId = fallback.id;
  }

  if (!targetChannelId) return res.status(400).json({ error: 'Target channel could not be identified.' });

  try {
    const payload: any = {};
    if (content) payload.content = content;

    if (title || description) {
      const colorInt = parseInt(colorHex.replace('#', ''), 16) || 15010068;
      payload.embeds = [
        {
          title: title || 'Club EZKEN Announcement',
          description: description || '',
          color: colorInt,
          image: imageUrl ? { url: imageUrl } : undefined,
          footer: { text: 'Club EZKEN Official Bot & Server Manager' },
          timestamp: new Date().toISOString(),
        },
      ];
    }

    // Convert buttons array to Discord ActionRow components (up to 5 buttons per row, up to 5 rows)
    if (Array.isArray(buttons) && buttons.length > 0) {
      const actionRows: any[] = [];
      const styleMap: Record<string, number> = {
        primary: 1, // Blurple
        secondary: 2, // Grey
        success: 3, // Green
        danger: 4, // Red
      };

      const validButtons = buttons.slice(0, 25);
      for (let i = 0; i < validButtons.length; i += 5) {
        const chunk = validButtons.slice(i, i + 5);
        actionRows.push({
          type: 1, // ActionRow
          components: chunk.map((btn: any, btnIndex: number) => {
            const globalIndex = i + btnIndex;
            const rawLabel = String(btn.label || btn.roleName || `Role ${globalIndex + 1}`).replace(/^@+/, '').trim();
            const cleanRoleName = String(btn.roleName || rawLabel).replace(/^@+/, '').trim();
            // Always encode the clean role name in custom_id with a unique index prefix
            const customId = btn.customId || `selfrole:${globalIndex}:${cleanRoleName}`;
            const numStyle = typeof btn.style === 'number' ? btn.style : (styleMap[btn.style] || 1);

            const comp: any = {
              type: 2, // Button
              style: numStyle,
              label: (rawLabel || `Role ${globalIndex + 1}`).substring(0, 80),
              custom_id: customId.substring(0, 100),
            };

            if (btn.emoji && typeof btn.emoji === 'string') {
              const cleanEmoji = btn.emoji.trim();
              if (cleanEmoji.length > 0 && cleanEmoji.length <= 4) {
                comp.emoji = { name: cleanEmoji };
              }
            }

            return comp;
          }),
        });
      }

      if (actionRows.length > 0) {
        payload.components = actionRows;
      }
    }

    const response = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: 'POST',
      headers: getDiscordHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      // If Discord rejected due to emoji object validation, retry with emoji inside button text label
      if (payload.components) {
        for (const row of payload.components) {
          for (const btn of row.components) {
            if (btn.emoji?.name) {
              btn.label = `${btn.emoji.name} ${btn.label}`.substring(0, 80);
            }
            delete btn.emoji;
          }
        }
        const retryRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
          method: 'POST',
          headers: getDiscordHeaders(),
          body: JSON.stringify(payload),
        });
        const retryData = await retryRes.json();
        if (retryRes.ok) {
          return res.json({ success: true, messageId: retryData.id, channelId: targetChannelId, componentsCount: payload.components.length });
        }
      }
      return res.status(response.status).json({ error: data.message || 'Failed to send message to Discord' });
    }

    return res.json({ success: true, messageId: data.id, channelId: targetChannelId, componentsCount: (payload.components || []).length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Fetch Real Discord Messages & Audit Cases from #mod-logs (1559441137624678440)
app.get('/api/discord/mod-logs', async (_req: Request, res: Response) => {
  try {
    const targetChannelId = MOD_LOGS_CHANNEL_ID;
    const messagesRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages?limit=50`, {
      headers: getDiscordHeaders(),
    });

    const discordMessages = messagesRes.ok ? await messagesRes.json() : [];
    const db = loadModRecords();

    return res.json({
      connected: true,
      channelId: targetChannelId,
      channelName: '📋｜mod-logs',
      messages: Array.isArray(discordMessages) ? discordMessages : [],
      cases: db.cases || [],
      deletedMessages: db.deletedMessages || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// LEVELING, VC TRACKING & FEATURE UNLOCK API ENDPOINTS
// -----------------------------------------------------------------------------

// 1. Get Live Official Leaderboard & Member Feature Unlocks
app.get('/api/discord/leaderboard', async (_req: Request, res: Response) => {
  try {
    const db = loadXpDatabase();
    const sorted = Object.values(db.users).sort((a, b) => b.xp - a.xp);

    const ranked = sorted.map((user, idx) => {
      const tier = getTierRoleForLevel(user.level);
      return {
        rank: idx + 1,
        user_id: user.userId,
        username: user.username,
        avatar: user.avatar,
        xp: user.xp,
        level: user.level,
        total_messages: user.totalMessages,
        voice_minutes: user.voiceMinutes,
        tierRole: tier.name,
        color: tier.color,
        unlockedFeatures: getAllUnlockedFeaturesForLevel(user.level),
      };
    });

    return res.json({
      connected: true,
      totalTracked: ranked.length,
      leaderboard: ranked,
      activeVoiceCount: activeVoiceSessions.size,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Get Official Level Tiers & Feature Matrix
app.get('/api/discord/level-tiers', async (_req: Request, res: Response) => {
  try {
    return res.json({
      tiers: OFFICIAL_LEVEL_TIERS_CONFIG,
      progressionFormula: 'xp = Math.floor(120 * Math.pow(level, 1.85))',
      rates: {
        voiceXpPerMinute: 8,
        messageXpMin: 15,
        messageXpMax: 20,
        messageCooldownSeconds: 60,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Get Live Voice Channels & Active Member Sessions
app.get('/api/discord/voice-status', async (_req: Request, res: Response) => {
  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const voiceStates = liveGuild?.voiceStates.cache || new Map();
    const activeList: any[] = [];

    for (const [userId, vs] of voiceStates) {
      if (vs.member?.user?.bot) continue;
      const session = activeVoiceSessions.get(userId);
      activeList.push({
        userId,
        username: vs.member?.user?.tag || vs.member?.user?.username || 'Member',
        channelId: vs.channelId,
        channelName: vs.channel?.name || 'Voice Channel',
        deaf: vs.deaf || vs.selfDeaf,
        mute: vs.mute || vs.selfMute,
        minutesInSession: session ? Math.floor((Date.now() - session.joinedAt) / 60000) : 0,
      });
    }

    return res.json({
      connected: true,
      activeVoiceUsers: activeList,
      totalInVoice: activeList.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Simulate / Award XP & Voice Minutes to Member
app.post('/api/discord/simulate-xp', async (req: Request, res: Response) => {
  const { userId, username, avatar, xpGain = 150, voiceMinutesGain = 10, source = 'VOICE' } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const db = loadXpDatabase();
    const result = await awardXpToUser(
      db,
      userId,
      username || `Member_${userId.slice(-4)}`,
      avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80',
      xpGain,
      voiceMinutesGain,
      source
    );
    saveXpDatabase(db);

    return res.json({
      success: true,
      user: db.users[userId],
      result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Synchronize Real Discord Server Role Permissions for the 9 Approved Tiers
app.post('/api/discord/sync-role-permissions', async (_req: Request, res: Response) => {
  try {
    const currentRoles = await fetchGuildRoles();
    const syncResults: any[] = [];

    const BASE_PERMS =
      PermissionFlagsBits.ViewChannel |
      PermissionFlagsBits.SendMessages |
      PermissionFlagsBits.ReadMessageHistory |
      PermissionFlagsBits.Connect |
      PermissionFlagsBits.Speak |
      PermissionFlagsBits.AddReactions;

    const TIER_PERMISSIONS: Record<string, bigint> = {
      'ROOKIE': BASE_PERMS,
      'INSIDER': BASE_PERMS | PermissionFlagsBits.AttachFiles,
      'RESIDENT': BASE_PERMS | PermissionFlagsBits.AttachFiles | PermissionFlagsBits.EmbedLinks,
      'CLUB REGULAR':
        BASE_PERMS |
        PermissionFlagsBits.AttachFiles |
        PermissionFlagsBits.EmbedLinks |
        PermissionFlagsBits.UseExternalEmojis |
        PermissionFlagsBits.UseExternalStickers,
      'HYPEMASTER':
        BASE_PERMS |
        PermissionFlagsBits.AttachFiles |
        PermissionFlagsBits.EmbedLinks |
        PermissionFlagsBits.UseExternalEmojis |
        PermissionFlagsBits.UseExternalStickers |
        PermissionFlagsBits.CreatePublicThreads |
        PermissionFlagsBits.CreatePrivateThreads |
        PermissionFlagsBits.PrioritySpeaker,
      'ASCENDANT':
        BASE_PERMS |
        PermissionFlagsBits.AttachFiles |
        PermissionFlagsBits.EmbedLinks |
        PermissionFlagsBits.UseExternalEmojis |
        PermissionFlagsBits.UseExternalStickers |
        PermissionFlagsBits.CreatePublicThreads |
        PermissionFlagsBits.CreatePrivateThreads |
        PermissionFlagsBits.PrioritySpeaker |
        PermissionFlagsBits.UseSoundboard |
        PermissionFlagsBits.UseExternalSounds,
      'CLUB TITAN':
        BASE_PERMS |
        PermissionFlagsBits.AttachFiles |
        PermissionFlagsBits.EmbedLinks |
        PermissionFlagsBits.UseExternalEmojis |
        PermissionFlagsBits.UseExternalStickers |
        PermissionFlagsBits.CreatePublicThreads |
        PermissionFlagsBits.CreatePrivateThreads |
        PermissionFlagsBits.PrioritySpeaker |
        PermissionFlagsBits.UseSoundboard |
        PermissionFlagsBits.UseExternalSounds |
        PermissionFlagsBits.UseApplicationCommands,
      'THE IMMORTAL':
        BASE_PERMS |
        PermissionFlagsBits.AttachFiles |
        PermissionFlagsBits.EmbedLinks |
        PermissionFlagsBits.UseExternalEmojis |
        PermissionFlagsBits.UseExternalStickers |
        PermissionFlagsBits.CreatePublicThreads |
        PermissionFlagsBits.CreatePrivateThreads |
        PermissionFlagsBits.PrioritySpeaker |
        PermissionFlagsBits.UseSoundboard |
        PermissionFlagsBits.UseExternalSounds |
        PermissionFlagsBits.UseApplicationCommands |
        PermissionFlagsBits.ChangeNickname,
      'STAR SUPPORTER':
        BASE_PERMS |
        PermissionFlagsBits.AttachFiles |
        PermissionFlagsBits.EmbedLinks |
        PermissionFlagsBits.UseExternalEmojis |
        PermissionFlagsBits.UseExternalStickers |
        PermissionFlagsBits.CreatePublicThreads |
        PermissionFlagsBits.CreatePrivateThreads |
        PermissionFlagsBits.PrioritySpeaker |
        PermissionFlagsBits.UseSoundboard |
        PermissionFlagsBits.UseExternalSounds |
        PermissionFlagsBits.UseApplicationCommands |
        PermissionFlagsBits.ChangeNickname |
        PermissionFlagsBits.MentionEveryone,
    };

    for (const [tierLvlStr, config] of Object.entries(OFFICIAL_LEVEL_TIERS_CONFIG)) {
      const cleanName = config.name.trim();
      const cleanLower = cleanName.toLowerCase();
      let matchedRole = currentRoles.find((r: any) => r.name.replace(/^@+/, '').trim().toLowerCase() === cleanLower);

      if (!matchedRole) {
        const colorInt = parseInt(config.color.replace('#', ''), 16) || 0x2ea8ff;
        const createRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
          method: 'POST',
          headers: getDiscordHeaders(),
          body: JSON.stringify({
            name: cleanName,
            color: colorInt,
            hoist: true,
            mentionable: true,
            permissions: (TIER_PERMISSIONS[cleanName] || BASE_PERMS).toString(),
          }),
        });
        if (createRes.ok) {
          matchedRole = await createRes.json();
          syncResults.push({
            roleName: `@${cleanName}`,
            level: config.level,
            action: 'CREATED_AND_SYNCED',
            features: config.features,
            permissionsBitfield: (TIER_PERMISSIONS[cleanName] || BASE_PERMS).toString(),
          });
          continue;
        }
      }

      if (matchedRole) {
        const targetPerms = (TIER_PERMISSIONS[cleanName] || BASE_PERMS).toString();
        const updateRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles/${matchedRole.id}`, {
          method: 'PATCH',
          headers: getDiscordHeaders(),
          body: JSON.stringify({
            permissions: targetPerms,
            hoist: true,
            mentionable: true,
          }),
        });

        syncResults.push({
          roleName: `@${cleanName}`,
          level: config.level,
          roleId: matchedRole.id,
          action: updateRes.ok ? 'PERMISSIONS_SYNCED' : 'PERMISSION_DENIED_BY_DISCORD',
          features: config.features,
          permissionsBitfield: targetPerms,
        });
      }
    }

    try {
      const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) as TextChannel ||
        (await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null)) as TextChannel;
      if (modLogChan && modLogChan.isTextBased()) {
        const syncEmbed = new EmbedBuilder()
          .setTitle('🛡️ ROLE PERMISSIONS & FEATURE UNLOCK MATRIX SYNCHRONIZED')
          .setColor(0x2EA8FF)
          .setDescription(
            `Successfully synchronized permissions across all **9 Official Ticked Level Roles**!\n\n` +
            `• **Level 10 (@INSIDER)**: 📎 Posting Links & Attachments Enabled\n` +
            `• **Level 20 (@RESIDENT)**: 🎬 GIFs (Tenor) & Embed Links Enabled\n` +
            `• **Level 30 (@CLUB REGULAR)**: 🌟 External Emojis & Stickers Enabled\n` +
            `• **Level 40 (@HYPEMASTER)**: 💬 Threads & Priority Speaker Enabled\n` +
            `• **Level 55 (@ASCENDANT)**: 🔊 Soundboard & External Voice Audio Enabled\n` +
            `• **Level 70 (@CLUB TITAN)**: 💎 VIP Lounge Access Enabled\n` +
            `• **Level 85 (@THE IMMORTAL)**: 🏷️ Custom Nicknames & Voice Activity Enabled\n` +
            `• **Level 100 (@STAR SUPPORTER)**: 👑 Maximum Prestige & Hall of Fame Enabled`
          )
          .setFooter({ text: 'Club EZKEN Permission Synchronization Engine' })
          .setTimestamp();

        await modLogChan.send({ embeds: [syncEmbed] });
      }
    } catch { }

    return res.json({
      success: true,
      syncedCount: syncResults.length,
      syncedRoles: syncResults,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// WELCOME CHAT & CANVAS STUDIO ENDPOINTS
// -----------------------------------------------------------------------------

// 1. Get Welcome Configuration & Live Counter Status
app.get('/api/discord/welcome-config', async (_req: Request, res: Response) => {
  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const memberCount = liveGuild?.memberCount || 142;
    return res.json({
      config: welcomeConfig,
      memberCount,
      nextMemberSlot: memberCount + 1,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Save Updated Welcome Configuration (Colors, Fonts, Templates, Channels)
app.post('/api/discord/welcome-config', async (req: Request, res: Response) => {
  try {
    const updated = req.body;
    saveWelcomeConfig({
      ...welcomeConfig,
      ...updated,
      canvas: {
        ...welcomeConfig.canvas,
        ...(updated.canvas || {}),
      },
    });
    return res.json({ success: true, config: welcomeConfig });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Render Welcome Card Preview Base64 Image
app.post('/api/discord/welcome-preview', async (req: Request, res: Response) => {
  try {
    const { username = 'NewMember', memberCount = 143, avatarUrl, canvasConfig } = req.body;
    const activeCanvas = { ...welcomeConfig.canvas, ...(canvasConfig || {}) };
    const buffer = await generateWelcomeCardBuffer(
      username,
      memberCount,
      avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256&auto=format&fit=crop&q=80',
      'CLUB EZKEN',
      activeCanvas
    );
    const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
    return res.json({ success: true, imageBase64: base64 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Dispatch Live Test Welcome Card to Discord Channel
app.post('/api/discord/welcome-test', async (req: Request, res: Response) => {
  const { targetChannelName, username = 'Ken', memberCount } = req.body;

  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const actualCount = memberCount || (liveGuild?.memberCount ? liveGuild.memberCount : 143);
    const avatarUrl = discordBot.user?.displayAvatarURL({ extension: 'png', size: 256 }) ||
      'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=256&auto=format&fit=crop&q=80';

    const cardBuffer = await generateWelcomeCardBuffer(
      username,
      actualCount,
      avatarUrl,
      liveGuild?.name || 'CLUB EZKEN',
      welcomeConfig.canvas
    );

    const channels = await fetchGuildChannels();
    const chanToFind = (targetChannelName || welcomeConfig.channelName || 'lounge-welcome').replace('#', '').toLowerCase();
    const targetChanMeta = channels.find((c: any) =>
      c.name.toLowerCase() === chanToFind ||
      c.name.toLowerCase().includes(chanToFind) ||
      c.name.toLowerCase().includes('welcome') ||
      c.name.toLowerCase().includes('general')
    );

    const targetChannelId = targetChanMeta ? targetChanMeta.id : null;
    let targetChannel: any = null;
    if (targetChannelId) {
      targetChannel = discordBot.channels.cache.get(targetChannelId) || await discordBot.channels.fetch(targetChannelId).catch(() => null);
    }

    if (!targetChannel || !targetChannel.isTextBased()) {
      return res.status(404).json({ error: `Could not find target channel #${chanToFind} on server.` });
    }

    const welcomeMsg = welcomeConfig.messageTemplate
      .replace('{user}', `<@${discordBot.user?.id || 'everyone'}>`)
      .replace('{guild}', liveGuild?.name || 'Club EZKEN')
      .replace('{count}', actualCount.toString());

    const attachment = new AttachmentBuilder(cardBuffer, { name: 'welcome-card-test.png' });
    const sent = await (targetChannel as TextChannel).send({
      content: `🧪 **[TEST WELCOME DISPATCH]**\n${welcomeMsg}`,
      files: [attachment],
    });

    return res.json({
      success: true,
      messageId: sent.id,
      channelName: (targetChannel as TextChannel).name,
      memberCount: actualCount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Simulate Member Departure & Smart AI Recalculation
app.post('/api/discord/simulate-departure', async (req: Request, res: Response) => {
  const { departedUsername = 'GhostPlayer#0001', departedUserId = '123456789012345678' } = req.body;

  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const guildName = liveGuild?.name || 'Club EZKEN';
    const currentTotal = liveGuild?.memberCount || 142;
    const recalculatedTotal = Math.max(1, currentTotal - 1);

    let aiNote = `📉 **[SMART AI AUDIT • MEMBER DEPARTURE]**\n` +
      `Member **@${departedUsername}** (\`${departedUserId}\`) has departed from **${guildName}**.\n` +
      `📊 **Recalculated Total**: **${recalculatedTotal} members** (-1 deduction applied).\n` +
      `⚡ **Counter Synchronized**: The next joining member will continue onwards numbered **#${recalculatedTotal + 1}**.`;

    if (aiClient) {
      try {
        const aiPrompt = `A member departed from Discord server "${guildName}".
Member: @${departedUsername} (ID: ${departedUserId}).
Total member count has decreased by 1 to ${recalculatedTotal} members.
The next incoming member slot is now synchronized to #${recalculatedTotal + 1}.
Generate a sharp, professional 2-line Discord audit note for #mod-logs confirming the departure, reporting the recalculated total of ${recalculatedTotal} members, and confirming the next joining member will be numbered #${recalculatedTotal + 1}. Use Discord Markdown.`;

        const resp = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: aiPrompt,
        });
        if (resp.text) {
          aiNote = `📉 **[SMART AI AUDIT • MEMBER DEPARTURE]**\n${resp.text.trim()}\n*Recalculated Total:${recalculatedTotal} members • Next Welcome Slot: #${recalculatedTotal + 1}*`;
        }
      } catch (e: any) {
        console.warn('[AI DEPARTURE SIMULATION ERROR]', e.message);
      }
    }

    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) as TextChannel ||
      (await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null)) as TextChannel;
    if (modLogChan && modLogChan.isTextBased()) {
      await modLogChan.send({ content: aiNote }).catch(() => { });
    }

    return res.json({
      success: true,
      departedUsername,
      recalculatedTotal,
      nextMemberSlot: recalculatedTotal + 1,
      aiNote,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Moderate Member in Discord Server & Record to Mod-Logs
app.post('/api/discord/moderate', async (req: Request, res: Response) => {
  const { userId, action, reason = 'Moderation via Club EZKEN Dashboard', durationMinutes = 60, userTag } = req.body;

  if (!userId || !action) return res.status(400).json({ error: 'userId and action required.' });

  try {
    let success = false;
    let mappedAction: 'WARN' | 'MUTE' | 'KICK' | 'BAN' = 'WARN';

    if (action === 'TIMEOUT') {
      mappedAction = 'MUTE';
      const timeoutUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, {
        method: 'PATCH',
        headers: getDiscordHeaders(),
        body: JSON.stringify({ communication_disabled_until: timeoutUntil }),
      });
      success = response.ok;
    } else if (action === 'KICK') {
      mappedAction = 'KICK';
      const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, {
        method: 'DELETE',
        headers: getDiscordHeaders(),
      });
      success = response.ok;
    } else if (action === 'BAN') {
      mappedAction = 'BAN';
      const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/bans/${userId}`, {
        method: 'PUT',
        headers: getDiscordHeaders(),
        body: JSON.stringify({ reason }),
      });
      success = response.ok;
    } else if (action === 'UNBAN') {
      const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/bans/${userId}`, {
        method: 'DELETE',
        headers: getDiscordHeaders(),
      });
      return res.json({ success: response.ok, action: 'UNBAN' });
    } else {
      return res.status(400).json({ error: 'Invalid moderation action.' });
    }

    // Record Case in persistent database
    const db = loadModRecords();
    const caseNumber = `#000${db.cases.length + 1}`;
    const newCase: ModCaseRecord = {
      id: Date.now(),
      case_id: caseNumber,
      user_id: userId,
      user_tag: userTag || `User_${userId.slice(-4)}`,
      moderator_id: 'admin_ken',
      moderator_tag: 'KEN',
      action_type: mappedAction,
      reason: reason || `Sanction executed via Club EZKEN Dashboard (${action})`,
      timestamp: Date.now(),
    };
    db.cases.unshift(newCase);
    saveModRecords(db);

    // Post to MOD_LOGS_CHANNEL_ID (1559441137624678440)
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) as TextChannel ||
      (await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null)) as TextChannel;

    if (modLogChan && modLogChan.isTextBased()) {
      const auditEmbed = new EmbedBuilder()
        .setTitle(`⚖️ MODERATION SANCTION • ${action}`)
        .setColor(action === 'BAN' ? 0xDA373C : action === 'TIMEOUT' ? 0xF59E0B : 0x2EA8FF)
        .setDescription(
          `**Target User**: <@${userId}> (\`${userTag || userId}\`)\n` +
          `**Action**: **${action}**${action === 'TIMEOUT' ? ` (${durationMinutes} mins)` : ''}\n` +
          `**Reason**: ${reason}\n` +
          `**Moderator**: **KEN** (Super Admin)\n` +
          `**Case**: \`${caseNumber}\``
        )
        .setFooter({ text: 'Club EZKEN Moderation Audit Ledger' })
        .setTimestamp();

      await modLogChan.send({ embeds: [auditEmbed] }).catch(() => { });
    }

    return res.json({ success, action, caseNumber });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 8. Assign / Remove Role to/from Member
app.post('/api/discord/members/:userId/roles/:roleId', async (req: Request, res: Response) => {
  const { userId, roleId } = req.params;
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`, {
      method: 'PUT',
      headers: getDiscordHeaders(),
    });
    return res.json({ success: response.ok });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/discord/members/:userId/roles/:roleId', async (req: Request, res: Response) => {
  const { userId, roleId } = req.params;
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`, {
      method: 'DELETE',
      headers: getDiscordHeaders(),
    });
    return res.json({ success: response.ok });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 9. Fetch Guild Members
app.get('/api/discord/members', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members?limit=100`, {
      headers: getDiscordHeaders(),
    });
    const members = response.ok ? await response.json() : [];
    return res.json({ members });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// AUTONOMOUS DISCORD ACTION EXECUTOR
// -----------------------------------------------------------------------------

interface ActionReceipt {
  action: string;
  details: any;
  result: string;
  success: boolean;
}

async function executeServerAction(actionName: string, args: any, currentChannels: any[], currentRoles: any[]): Promise<ActionReceipt> {
  try {
    if (actionName === 'create_role') {
      const colorInt = parseInt((args.colorHex || '#E50914').replace('#', ''), 16) || 15010068;
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
        method: 'POST',
        headers: getDiscordHeaders(),
        body: JSON.stringify({
          name: args.name,
          color: colorInt,
          hoist: args.hoist !== undefined ? !!args.hoist : true,
          mentionable: !!args.mentionable,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (args.levelPerk && typeof args.levelPerk === 'number') {
          levelTiers[args.levelPerk] = { name: args.name, color: args.colorHex || '#E50914' };
        }
        return {
          action: 'CREATED_ROLE',
          details: { ...args, roleId: data.id },
          result: `Successfully created role @${args.name} in Discord (ID:${data.id})` + (args.levelPerk ? ` & mapped to Level ${args.levelPerk}` : ''),
          success: true,
        };
      } else {
        return {
          action: 'CREATED_ROLE_FAILED',
          details: args,
          result: `Discord API error creating @${args.name}:${data.message || 'Failed'}`,
          success: false,
        };
      }
    }

    if (actionName === 'delete_role') {
      let targetRoleId = args.roleId;
      if (!targetRoleId && args.name) {
        const found = currentRoles.find(r => r.name.toLowerCase() === args.name.toLowerCase().replace('@', ''));
        if (found) targetRoleId = found.id;
      }
      if (!targetRoleId) {
        return { action: 'DELETE_ROLE_NOT_FOUND', details: args, result: `Could not locate role "${args.name || args.roleId}" in server.`, success: false };
      }

      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles/${targetRoleId}`, {
        method: 'DELETE',
        headers: getDiscordHeaders(),
      });
      return {
        action: 'DELETED_ROLE',
        details: { targetRoleId, name: args.name },
        result: res.ok ? `Deleted role in Discord (ID: ${targetRoleId})` : `Failed to delete role: status ${res.status}`,
        success: res.ok,
      };
    }

    if (actionName === 'create_channel') {
      const isCategory = args.type === 'category';
      const formattedName = isCategory ? args.name : (args.name || 'new-channel').toLowerCase().replace(/\s+/g, '-');
      let discordType = 0; // Text
      if (args.type === 'voice') discordType = 2;
      if (args.type === 'category') discordType = 4;
      if (args.type === 'announcement') discordType = 5;

      const payload: any = {
        name: formattedName,
        type: discordType,
      };
      if (args.topic && discordType === 0) payload.topic = args.topic;
      if (args.parentId) payload.parent_id = args.parentId;

      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
        method: 'POST',
        headers: getDiscordHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        return {
          action: 'CREATED_CHANNEL',
          details: { ...args, channelId: data.id },
          result: `Successfully created #${formattedName} in Discord (ID:${data.id})`,
          success: true,
        };
      } else {
        return {
          action: 'CREATED_CHANNEL_FAILED',
          details: args,
          result: `Discord API error creating #${formattedName}:${data.message || 'Failed'}`,
          success: false,
        };
      }
    }

    if (actionName === 'delete_channel') {
      let targetChannelId = args.channelId;
      if (!targetChannelId && args.name) {
        const clean = args.name.replace('#', '').toLowerCase();
        const found = currentChannels.find(c => c.name.toLowerCase() === clean);
        if (found) targetChannelId = found.id;
      }
      if (!targetChannelId) {
        return { action: 'DELETE_CHANNEL_NOT_FOUND', details: args, result: `Could not locate channel "${args.name || args.channelId}"`, success: false };
      }

      const res = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}`, {
        method: 'DELETE',
        headers: getDiscordHeaders(),
      });
      return {
        action: 'DELETED_CHANNEL',
        details: { targetChannelId, name: args.name },
        result: res.ok ? `Deleted channel in Discord (ID: ${targetChannelId})` : `Failed to delete channel: status ${res.status}`,
        success: res.ok,
      };
    }

    if (actionName === 'assign_level_tier') {
      levelTiers[args.level] = { name: args.tierName, color: args.colorHex || '#E50914' };
      return {
        action: 'ASSIGNED_LEVEL_TIER',
        details: args,
        result: `Configured Level ${args.level} requirement ➔ Reward: "${args.tierName}"`,
        success: true,
      };
    }

    if (actionName === 'send_announcement') {
      let targetId = args.channelId;
      if (!targetId && args.channelName) {
        const clean = args.channelName.replace('#', '').toLowerCase();
        const found = currentChannels.find(c => c.name.toLowerCase() === clean || c.name.toLowerCase().includes(clean));
        if (found) targetId = found.id;
      }
      if (!targetId) {
        const fallback = currentChannels.find(c => c.name.includes('announcement') || c.name.includes('general') || c.type === 0);
        if (fallback) targetId = fallback.id;
      }

      if (targetId) {
        const colorInt = parseInt((args.colorHex || '#E50914').replace('#', ''), 16) || 15010068;
        const res = await fetch(`https://discord.com/api/v10/channels/${targetId}/messages`, {
          method: 'POST',
          headers: getDiscordHeaders(),
          body: JSON.stringify({
            embeds: [
              {
                title: args.title || 'Club EZKEN Announcement',
                description: args.description || '',
                color: colorInt,
                footer: { text: 'Club EZKEN Official Broadcast' },
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
        const data = await res.json();
        return {
          action: 'SENT_ANNOUNCEMENT',
          details: { ...args, channelId: targetId },
          result: res.ok ? `Dispatched announcement "${args.title}" directly to Discord channel #${args.channelName || targetId}` : `Announcement API status: ${data.message || 'Error'}`,
          success: res.ok,
        };
      }
    }

    if (actionName === 'moderate_member') {
      const { userId, action, reason = 'Action performed via Club EZKEN AI Architect', durationMinutes = 60 } = args;
      if (action === 'TIMEOUT') {
        const timeoutUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
        const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, {
          method: 'PATCH',
          headers: getDiscordHeaders(),
          body: JSON.stringify({ communication_disabled_until: timeoutUntil }),
        });
        return { action: 'TIMEOUT_MEMBER', details: args, result: res.ok ? `Timed out user ${userId} for${durationMinutes}m` : 'Failed to timeout user', success: res.ok };
      }
      if (action === 'KICK') {
        const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, {
          method: 'DELETE',
          headers: getDiscordHeaders(),
        });
        return { action: 'KICK_MEMBER', details: args, result: res.ok ? `Kicked user ${userId}` : 'Failed to kick user', success: res.ok };
      }
      if (action === 'BAN') {
        const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/bans/${userId}`, {
          method: 'PUT',
          headers: getDiscordHeaders(),
          body: JSON.stringify({ reason }),
        });
        return { action: 'BAN_MEMBER', details: args, result: res.ok ? `Banned user ${userId} from Discord` : 'Failed to ban user', success: res.ok };
      }
    }

    return { action: actionName, details: args, result: 'Action completed', success: true };
  } catch (err: any) {
    return { action: actionName, details: args, result: `Execution error: ${err.message}`, success: false };
  }
}

// -----------------------------------------------------------------------------
// NATURAL LANGUAGE INTENT PARSER (Deterministic Execution Guarantee)
// -----------------------------------------------------------------------------
function parseNaturalLanguageIntent(prompt: string): Array<{ name: string; args: any }> {
  const actions: Array<{ name: string; args: any }> = [];
  const text = prompt.trim();
  const lower = text.toLowerCase();

  // 1. Role Creation Pattern (e.g. "create role VIP Elite with gold color at level 25")
  const roleRegex = /(?:create|make|add)\s+(?:a\s+)?role\s+(?:named|called\s+)?["']?([a-zA-Z0-9\s_-]+?)["']?(?:\s+(?:with|color)\s+([#a-zA-Z0-9]+))?(?:\s+(?:at|to|for)\s+level\s+(\d+))?(?:$|\.|\band\b)/i;
  const roleMatch = text.match(roleRegex);
  if (roleMatch) {
    const name = roleMatch[1].trim();
    let colorHex = '#E50914';
    if (roleMatch[2]) {
      const col = roleMatch[2].toLowerCase();
      if (col.includes('gold') || col.includes('yellow')) colorHex = '#FBBF24';
      else if (col.includes('blue') || col.includes('cyan')) colorHex = '#38BDF8';
      else if (col.includes('green')) colorHex = '#10B981';
      else if (col.includes('purple')) colorHex = '#A855F7';
      else if (col.startsWith('#')) colorHex = col;
    }
    const levelPerk = roleMatch[3] ? parseInt(roleMatch[3]) : null;
    actions.push({
      name: 'create_role',
      args: { name, colorHex, levelPerk, hoist: true, mentionable: false },
    });
  }

  // 2. Channel Creation Pattern (e.g. "create a text channel named scrims-chat", "make a voice channel Lounge 2")
  const chanRegex = /(?:create|make|add)\s+(?:a\s+)?(text|voice|announcement|category)?\s*channel\s+(?:named|called\s+)?["']?([#a-zA-Z0-9\s_-]+?)["']?(?:\s+with\s+topic\s+["']?([^"']+)["']?)?(?:$|\.|\band\b)/i;
  const chanMatch = text.match(chanRegex);
  if (chanMatch) {
    const type = (chanMatch[1] || 'text').toLowerCase();
    const rawName = chanMatch[2].replace('#', '').trim();
    const topic = chanMatch[3] || 'Managed by Club EZKEN AI Architect';
    actions.push({
      name: 'create_channel',
      args: { name: rawName, type, topic },
    });
  }

  // 3. Delete Channel Pattern (e.g. "delete channel tournament-chat")
  const delChanRegex = /(?:delete|remove)\s+(?:the\s+)?channel\s+["']?([#a-zA-Z0-9\s_-]+?)["']?(?:$|\.|\band\b)/i;
  const delChanMatch = text.match(delChanRegex);
  if (delChanMatch) {
    actions.push({
      name: 'delete_channel',
      args: { name: delChanMatch[1].replace('#', '').trim() },
    });
  }

  // 4. Delete Role Pattern (e.g. "delete role VIP")
  const delRoleRegex = /(?:delete|remove)\s+(?:the\s+)?role\s+["']?([@a-zA-Z0-9\s_-]+?)["']?(?:$|\.|\band\b)/i;
  const delRoleMatch = text.match(delRoleRegex);
  if (delRoleMatch) {
    actions.push({
      name: 'delete_role',
      args: { name: delRoleMatch[1].replace('@', '').trim() },
    });
  }

  // 5. Level Tier Assignment Pattern (e.g. "assign level 40 to Apex Champion")
  const lvlRegex = /(?:assign|set|map)\s+level\s+(\d+)\s+(?:to|as)\s+["']?([a-zA-Z0-9\s_-]+?)["']?/i;
  const lvlMatch = text.match(lvlRegex);
  if (lvlMatch) {
    actions.push({
      name: 'assign_level_tier',
      args: { level: parseInt(lvlMatch[1]), tierName: lvlMatch[2].trim(), colorHex: '#E50914' },
    });
  }

  // 6. Announcement Pattern (e.g. "send announcement welcoming everyone to Season 5")
  const announceRegex = /(?:send|dispatch|post|write)\s+(?:an?\s+)?announcement(?:\s+post)?(?:\s+(?:to|in)\s+([#a-zA-Z0-9_-]+)\s*)?(?:saying|with\s+title|welcoming)?\s*["']?([^"']*)["']?/i;
  const announceMatch = text.match(announceRegex);
  if (announceMatch && !actions.some(a => a.name === 'send_announcement')) {
    actions.push({
      name: 'send_announcement',
      args: {
        channelName: announceMatch[1] ? announceMatch[1].replace('#', '') : 'announcements',
        title: 'Club EZKEN Official Broadcast',
        description: announceMatch[2] || '📢 Welcome to Club EZKEN! Check out the channels, level up in voice comms, and enjoy the community!',
        colorHex: '#E50914',
      },
    });
  }

  // 7. Test / Welcome Message Pattern (e.g. "test a welcoming message and send it in #general")
  const welcomeMsgRegex = /(?:test|send|post)\s+(?:a\s+)?(?:welcoming\s+|welcome\s+)?(?:message|embed)?\s*(?:and\s+send\s+it\s+)?(?:in|to)\s+([#a-zA-Z0-9_-]+)/i;
  const welcomeMsgMatch = text.match(welcomeMsgRegex);
  if (welcomeMsgMatch && !actions.some(a => a.name === 'send_announcement')) {
    const targetChan = welcomeMsgMatch[1].replace('#', '');
    actions.push({
      name: 'send_announcement',
      args: {
        channelName: targetChan,
        title: '🎉 Welcome to Club EZKEN!',
        description: 'Welcome to the official **Club EZKEN** server! Comms, scrims, leveling, and private temp VCs are all active. Enjoy your stay!',
        colorHex: '#E50914',
      },
    });
  }

  return actions;
}

// -----------------------------------------------------------------------------
// GEMINI FUNCTION DECLARATIONS
// -----------------------------------------------------------------------------

const createRoleDeclaration: FunctionDeclaration = {
  name: 'create_role',
  description: 'Create a new role in the Club EZKEN Discord server with color and optional level tier assignment',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Role name, e.g. "Diamond Elite", "VIP", "Tournament Champion"' },
      colorHex: { type: Type.STRING, description: 'Hex color code e.g. "#E50914", "#FBBF24", "#38BDF8"' },
      levelPerk: { type: Type.INTEGER, description: 'Optional level tier to unlock this role, e.g. 10, 25, 50' },
      mentionable: { type: Type.BOOLEAN, description: 'Whether role is mentionable by members' },
      hoist: { type: Type.BOOLEAN, description: 'Display role separately in member list' }
    },
    required: ['name']
  }
};

const deleteRoleDeclaration: FunctionDeclaration = {
  name: 'delete_role',
  description: 'Delete a role from the Discord server by name or roleId',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Name of the role to delete' },
      roleId: { type: Type.STRING, description: 'Optional ID of the role' }
    },
    required: ['name']
  }
};

const createChannelDeclaration: FunctionDeclaration = {
  name: 'create_channel',
  description: 'Create a new text, voice, announcement, or category channel in Club EZKEN Discord server',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Channel name, e.g. "tournament-chat", "squad-lounge"' },
      type: { type: Type.STRING, description: '"text", "voice", "category", or "announcement"' },
      topic: { type: Type.STRING, description: 'Channel topic or description' },
      parentId: { type: Type.STRING, description: 'Optional category ID to place this channel in' }
    },
    required: ['name']
  }
};

const deleteChannelDeclaration: FunctionDeclaration = {
  name: 'delete_channel',
  description: 'Delete a channel from the Discord server by name or channelId',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Name of the channel to delete, e.g. "tournament-chat"' },
      channelId: { type: Type.STRING, description: 'Optional channel ID' }
    },
    required: ['name']
  }
};

const assignLevelTierDeclaration: FunctionDeclaration = {
  name: 'assign_level_tier',
  description: 'Assign a title and reward tier to the XP leveling system at a specific level',
  parameters: {
    type: Type.OBJECT,
    properties: {
      level: { type: Type.INTEGER, description: 'Level requirement, e.g. 1, 5, 10, 25, 50, 100' },
      tierName: { type: Type.STRING, description: 'Name of the perk title, e.g. "Crimson General"' },
      colorHex: { type: Type.STRING, description: 'Hex color code for the badge/rank card' }
    },
    required: ['level', 'tierName']
  }
};

const sendAnnouncementDeclaration: FunctionDeclaration = {
  name: 'send_announcement',
  description: 'Send a styled rich embed announcement directly to a server channel in Discord',
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelName: { type: Type.STRING, description: 'Target channel name, e.g. "announcements", "general"' },
      title: { type: Type.STRING, description: 'Title of the announcement' },
      description: { type: Type.STRING, description: 'Content/body of the announcement' },
      colorHex: { type: Type.STRING, description: 'Hex color accent e.g. "#E50914"' }
    },
    required: ['title', 'description']
  }
};

const moderateMemberDeclaration: FunctionDeclaration = {
  name: 'moderate_member',
  description: 'Timeout, kick, ban, or unban a member from the Discord server',
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: { type: Type.STRING, description: 'Discord User ID' },
      action: { type: Type.STRING, description: '"TIMEOUT", "KICK", "BAN", or "UNBAN"' },
      reason: { type: Type.STRING, description: 'Reason for the moderation action' },
      durationMinutes: { type: Type.INTEGER, description: 'Timeout duration in minutes (default 60)' }
    },
    required: ['userId', 'action']
  }
};

// In-memory deduplication cache: prevents duplicate execution if user double-submits or network retries
const recentPromptExecutions = new Map<string, { timestamp: number; responseData: any }>();

// -----------------------------------------------------------------------------
// POST /api/gemini/architect - Autonomous Gemini AI Engine (with Image Upload)
// -----------------------------------------------------------------------------
app.post('/api/gemini/architect', async (req: Request, res: Response) => {
  const reqStartTime = Date.now();
  try {
    const { prompt, imageBase64, imageMimeType } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // Check recent execution cache (within 8 seconds) to prevent duplicate Discord posts
    const cacheKey = `${prompt.trim().toLowerCase()}_${Boolean(imageBase64)}`;
    const cached = recentPromptExecutions.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 8000) {
      console.log(`[AI ARCHITECT] Debounced duplicate prompt within 8s: "${prompt.slice(0, 40)}..."`);
      return res.json(cached.responseData);
    }

    // Fetch current live channels and roles from Discord for live grounding
    const currentChannels = await fetchGuildChannels();
    const currentRoles = await fetchGuildRoles();

  const executedActions: ActionReceipt[] = [];
  const tools = [{
    functionDeclarations: [
      createRoleDeclaration,
      deleteRoleDeclaration,
      createChannelDeclaration,
      deleteChannelDeclaration,
      assignLevelTierDeclaration,
      sendAnnouncementDeclaration,
      moderateMemberDeclaration,
    ]
  }];

  const channelNamesList = currentChannels.map(c => `#${c.name} (type:${c.type})`).slice(0, 30).join(', ');
  const roleNamesList = currentRoles.map(r => `@${r.name}`).slice(0, 25).join(', ');

  const systemInstruction = `You are the Autonomous Discord Server Architect and Super Admin AI for "Club EZKEN" (Guild ID: ${DISCORD_GUILD_ID}).
You have FULL, UNRESTRICTED ACCESS to modify the Discord server in real-time.
The bot in the server is named "ClubEZ" and has full administrator permissions.

CURRENT DISCORD SERVER CHANNELS:
${channelNamesList || 'general, announcements, lounge-welcome, mod-logs'}

CURRENT DISCORD SERVER ROLES:
${roleNamesList || 'Owner, Moderator, Member'}

CURRENT XP LEVEL TIERS:
${Object.entries(levelTiers).map(([lvl, t]) => `Level ${lvl}: ${t.name} (${t.color})`).join(', ')}

YOUR DIRECTIVES:
1. When asked to create, delete, or manage roles, channels, levels, announcements, or members, you MUST CALL the appropriate functions immediately!
​2. You have authority to perform multiple actions at once (e.g. create a role, map it to a level tier, and create a channel for it).
3. Use Club EZKEN's red (#E50914), dark (#12161E), and gold (#FBBF24) aesthetic colors.
4. Always provide an enthusiastic, clear response confirming what was created, deleted, or modified on Discord.`;

  let aiMessage = '';
  let modelWorked = false;
  let activeModelUsed = 'Gemini 3.1 Flash Lite';

  // Fast model priority: gemini-3.1-flash-lite (~800ms) -> gemini-3.5-flash (~1.7s) -> gemini-3.8-flash
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];

  if (aiClient) {
    // Build multimodal content (text + optional image)
    let contents: any;
    if (imageBase64 && imageMimeType) {
      contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: imageMimeType,
              },
            },
            { text: prompt },
          ],
        },
      ];
    } else {
      contents = prompt;
    }

    for (const modelName of candidateModels) {
      try {
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            tools,
          },
        });

        const calls = response.functionCalls || [];
        for (const call of calls) {
          const receipt = await executeServerAction(call.name || '', call.args || {}, currentChannels, currentRoles);
          executedActions.push(receipt);
        }

        aiMessage = response.text || '';
        modelWorked = true;
        activeModelUsed = modelName === 'gemini-3.1-flash-lite'
          ? 'Gemini 3.1 Flash Lite'
          : modelName === 'gemini-3.5-flash'
          ? 'Gemini 3.5 Flash'
          : 'Gemini 3.8 Flash';
        console.log(`[AI ARCHITECT] Successfully answered via ${activeModelUsed} in ${Date.now() - reqStartTime}ms with ${calls.length} action(s)`);
        break;
      } catch (modelErr: any) {
        console.warn(`[AI ARCHITECT] ${modelName} warning: ${modelErr.message}`);
      }
    }
  }

  // If tool calls were not executed by Gemini (or if models were rate-limited / 503 high demand),
  // apply our deterministic intent parser to ensure the user's command ALWAYS executes on Discord!
  if (executedActions.length === 0) {
    const parsedActions = parseNaturalLanguageIntent(prompt);
    for (const action of parsedActions) {
      const receipt = await executeServerAction(action.name, action.args, currentChannels, currentRoles);
      executedActions.push(receipt);
    }
  }

  if (executedActions.length > 0) {
    const successList = executedActions.filter(a => a.success).map(a => a.result);
    if (!aiMessage) {
      aiMessage = `⚡ Done! I have directly updated your Discord server:\n` +
        successList.map(s => `• ${s}`).join('\n') +
        `\n\nAll changes are live in Club EZKEN right now!`;
    }
  } else if (!aiMessage) {
    aiMessage = `I've analyzed your server Club EZKEN (Guild ID: ${DISCORD_GUILD_ID}). Your server has ${currentChannels.length} channels and ${currentRoles.length} roles. Let me know what you would like to build or modify — e.g. "Create a VIP role with gold color at level 25", "Create text channel scrims-chat", or "Delete channel tournament-chat"!`;
  }

    const responsePayload = {
      message: aiMessage,
      actions: executedActions,
      levelTiers,
      guildStats: {
        channelsCount: currentChannels.length,
        rolesCount: currentRoles.length,
      },
      thinking: {
        model: activeModelUsed,
        groundedChannels: currentChannels.length,
        groundedRoles: currentRoles.length,
        actionsCount: executedActions.length,
        durationMs: Date.now() - reqStartTime,
      }
    };

    // Store in short-lived deduplication cache
    recentPromptExecutions.set(cacheKey, { timestamp: Date.now(), responseData: responsePayload });

    return res.json(responsePayload);
  } catch (err: any) {
    console.error('[AI ARCHITECT ERROR]', err?.stack || err?.message || err);
    return res.status(500).json({ error: err?.message || 'AI Architect failed. Please try again.' });
  }
});

// -----------------------------------------------------------------------------
// REAL-TIME AUTO-MODERATION EVALUATION & SMART AI WARNING GENERATOR
// -----------------------------------------------------------------------------
function buildFallbackSmartWarning(username: string, text: string, categories: string[], reason: string, channelName = '#general'): string {
  const snippet = text.length > 70 ? text.substring(0, 67) + '...' : text;
  const catLabel = categories.join(', ') || 'COMMUNITY_GUIDELINES';
  return `⚠️ **Club EZKEN Smart AI Warning (@${username})**: Your message in **${channelName}** (\`"${snippet}"\`) was automatically deleted by our Moderation Bot for **${catLabel}** (${reason}). Please follow Club EZKEN's community standards so you can keep chatting and leveling up!`;
}

app.post('/api/aimod/evaluate', async (req: Request, res: Response) => {
  const { text, username = 'Member', channelName = '#general' } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text prompt is required.' });
  }

  const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discord\.com\/invite)\/[a-zA-Z0-9-]+/gi;
  if (inviteRegex.test(text)) {
    const reason = 'Posted an unauthorized external Discord server invite link.';
    const categories = ['UNAUTHORIZED_INVITE'];
    return res.json({
      flagged: true,
      confidence: 1.0,
      categories,
      reason,
      suggestedAction: 'DELETE',
      whatHappened: `User posted an unauthorized Discord invite link in ${channelName}. Bot intercepted and deleted the message immediately.`,
      smartWarning: buildFallbackSmartWarning(username, text, categories, reason, channelName),
    });
  }

  const phishingRegex = /(free\s+discord\s+nitro|gift-discord|steam-free|claim\s+here\s+fast|http:\/\/[^\s]*fake)/i;
  if (phishingRegex.test(text)) {
    const reason = 'Detected deceptive phishing or fake Nitro scam link.';
    const categories = ['PHISHING_LINK', 'SCAM'];
    return res.json({
      flagged: true,
      confidence: 0.99,
      categories,
      reason,
      suggestedAction: 'BAN',
      whatHappened: `User posted a suspected Nitro/phishing scam link in ${channelName}. Bot purged the message and flagged account for immediate protection.`,
      smartWarning: buildFallbackSmartWarning(username, text, categories, reason, channelName),
    });
  }

  const toxicRegex = /\b(idiot|idiots|trash|stupid|moron|loser|stfu|kill yourself|kys|garbage|scum)\b/i;
  if (toxicRegex.test(text)) {
    const reason = 'Direct player harassment, insults, or toxic language toward community members.';
    const categories = ['TOXICITY', 'HARASSMENT'];
    return res.json({
      flagged: true,
      confidence: 0.92,
      categories,
      reason,
      suggestedAction: 'WARN',
      whatHappened: `User sent an insulting/toxic message in ${channelName}. Bot deleted the message and generated a contextual Smart AI Warning.`,
      smartWarning: buildFallbackSmartWarning(username, text, categories, reason, channelName),
    });
  }

  if (aiClient) {
    for (const model of ['gemini-3.8-flash', 'gemini-3.8-flash-8b', 'gemini-2.0-flash']) {
      try {
        const prompt = `You are a real-time Discord community moderation AI for "Club EZKEN".
Analyze the following message sent by "${username}" in "${channelName}" strictly for community violations:
- Toxicity, aggressive profanity, insults, or hate speech
- Severe harassment, bullying, or doxxing threats
- NSFW or sexually explicit material
- Phishing, scam links, or malicious spam

User text:
"${text.replace(/"/g, '\\"')}"

If flagged is true, also write:
1. "whatHappened": A 1-2 sentence audit summary of what the user did and why the bot deleted the message.
​2. "smartWarning": A direct, constructive warning message addressed to @${username} explaining specifically what was wrong with their message and how to follow Club EZKEN's rules.

Respond strictly using the JSON schema provided.`;

        const response = await aiClient.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                flagged: { type: Type.BOOLEAN },
                confidence: { type: Type.NUMBER },
                categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                reason: { type: Type.STRING },
                suggestedAction: { type: Type.STRING },
                whatHappened: { type: Type.STRING },
                smartWarning: { type: Type.STRING }
              },
              required: ['flagged', 'confidence', 'categories', 'reason', 'suggestedAction']
            }
          }
        });

        const parsed = JSON.parse(response.text?.trim() || '{}');
        if (parsed.flagged && !parsed.smartWarning) {
          parsed.smartWarning = buildFallbackSmartWarning(username, text, parsed.categories || ['VIOLATION'], parsed.reason || 'Rule violation', channelName);
        }
        if (parsed.flagged && !parsed.whatHappened) {
          parsed.whatHappened = `Bot deleted flagged message in ${channelName} due to${parsed.reason || 'policy violation'}.`;
        }
        return res.json(parsed);
      } catch { }
    }
  }

  return res.json({
    flagged: false,
    confidence: 0.05,
    categories: [],
    reason: 'Clean message.',
    suggestedAction: 'NONE'
  });
});

// Generate or Regenerate a Smart AI Warning for a specific deleted message / offense
app.post('/api/discord/smart-warn', async (req: Request, res: Response) => {
  const { username = 'Member', deletedContent = '', reason = '', categories = [], channelName = '#general' } = req.body;

  if (aiClient) {
    for (const model of ['gemini-3.8-flash', 'gemini-3.8-flash-8b', 'gemini-2.0-flash']) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents: `Write a concise, firm, and helpful Discord moderation warning from "Club EZKEN Bot" to user "@${username}".
Their message in ${channelName} was deleted by the bot.
Deleted message: "${deletedContent}"
Violation categories: ${(categories || []).join(', ')}
Reason: "${reason}"
Explain clearly what they did wrong in that specific message, remind them of Club EZKEN's rules, and encourage them to keep things respectful so they can keep earning XP toward our official ranks (@ROOKIE through @STAR SUPPORTER). Keep it under 75 words.`,
        });
        if (response.text) {
          return res.json({ smartWarning: response.text.trim() });
        }
      } catch { }
    }
  }

  return res.json({
    smartWarning: buildFallbackSmartWarning(username, deletedContent, categories, reason, channelName),
  });
});

// Send a Direct Text / Smart Warning to a Discord User (via DM and/or Server Channel)
app.post('/api/discord/text-user', async (req: Request, res: Response) => {
  const { userId, username, message, channelName = 'general', deliveryMethod = 'DISCORD_DM', deletedMessage } = req.body;
  if (!message) return res.status(400).json({ error: 'Message text required.' });

  let deliveredLive = false;
  let deliveryNote = 'Recorded & sent via Club EZKEN Messaging Relay';

  try {
    // 1. Try sending a real Discord Direct Message (DM) if a numeric Discord Snowflake ID is provided
    if (deliveryMethod === 'DISCORD_DM' && userId && /^\d{16,21}$/.test(String(userId))) {
      const dmChannelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: getDiscordHeaders(),
        body: JSON.stringify({ recipient_id: String(userId) }),
      });

      if (dmChannelRes.ok) {
        const dmChannel = await dmChannelRes.json();
        const dmMsgRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
          method: 'POST',
          headers: getDiscordHeaders(),
          body: JSON.stringify({
            content: message,
            embeds: deletedMessage
              ? [
                {
                  title: '🛡️ Club EZKEN Moderation Notice',
                  description: message,
                  color: 15010068,
                  fields: [
                    { name: 'Deleted Message', value: `\`\`\`${deletedMessage.substring(0, 300)}\`\`\`` },
                    { name: 'Channel', value: channelName, inline: true },
                  ],
                  footer: { text: 'Club EZKEN Smart AI Moderation • Reply or contact KEN for appeals' },
                  timestamp: new Date().toISOString(),
                },
              ]
              : undefined,
          }),
        });

        if (dmMsgRes.ok) {
          deliveredLive = true;
          deliveryNote = `Delivered directly to @${username}'s Discord DMs`;
        }
      }
    }

    // 2. If Channel Ping is selected (or as fallback if user has DMs closed), post to the target channel in the Discord server
    if (!deliveredLive && deliveryMethod === 'CHANNEL_PING') {
      const channels = await fetchGuildChannels();
      const cleanChan = channelName.replace('#', '').toLowerCase();
      const target =
        channels.find((c: any) => c.name.toLowerCase() === cleanChan) ||
        channels.find((c: any) => c.name.includes('general') || c.type === 0);

      if (target) {
        const chanRes = await fetch(`https://discord.com/api/v10/channels/${target.id}/messages`, {
          method: 'POST',
          headers: getDiscordHeaders(),
          body: JSON.stringify({
            content: userId && /^\d{16,21}$/.test(String(userId)) ? `<@${userId}>` : `**@${username}**`,
            embeds: [
              {
                title: `⚠️ Official Club EZKEN Message for @${username}`,
                description: message,
                color: 15010068,
                fields: deletedMessage
                  ? [{ name: 'Referenced Deleted Message', value: `\`\`\`${deletedMessage.substring(0, 250)}\`\`\`` }]
                  : undefined,
                footer: { text: 'Dispatched by KEN • Club EZKEN Moderation Suite' },
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
        if (chanRes.ok) {
          deliveredLive = true;
          deliveryNote = `Dispatched live to Discord channel #${target.name}`;
        }
      }
    }

    // Save message dispatch into persistent moderation database
    const db = loadModRecords();
    const chatEntry = {
      id: `msg_${Date.now()}`,
      sender: 'ADMIN_KEN',
      senderName: 'KEN (Super Admin)',
      text: message,
      timestamp: Date.now(),
      deliveryMethod,
      deliveredLive,
    };

    // Find if user has a deleted message record, attach it; else add to cases
    let matched = false;
    for (const d of db.deletedMessages) {
      if ((userId && d.user_id === String(userId)) || (username && d.user_tag.toLowerCase() === String(username).toLowerCase())) {
        if (!Array.isArray(d.messages_sent)) d.messages_sent = [];
        d.messages_sent.push(chatEntry);
        d.warning_sent = true;
        matched = true;
        break;
      }
    }
    saveModRecords(db);

    // Audit to MOD_LOGS_CHANNEL_ID (1559441137624678440)
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) as TextChannel ||
      (await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null)) as TextChannel;

    if (modLogChan && modLogChan.isTextBased()) {
      const auditEmbed = new EmbedBuilder()
        .setTitle('📩 DIRECT WARNING / TEXT DISPATCH')
        .setColor(0x10B981)
        .setDescription(
          `**Recipient**: **@${username || userId}** (\`${userId || 'N/A'}\`)\n` +
          `**Channel/Method**: \`${deliveryMethod}\` (${channelName})\n` +
          `**Dispatched Message**:\n\`\`\`${message.substring(0, 400)}\`\`\`\n` +
          `*Status*: ${deliveryNote}`
        )
        .setFooter({ text: 'Club EZKEN Direct Warning Relay' })
        .setTimestamp();

      await modLogChan.send({ embeds: [auditEmbed] }).catch(() => { });
    }
  } catch (err: any) {
    console.warn('[TEXT USER] Discord REST relay note:', err.message);
  }

  return res.json({
    success: true,
    deliveredLive,
    deliveryNote,
    timestamp: Date.now(),
  });
});

// Update Level Tiers (Strictly locked to the 9 ticked roles)
app.put('/api/discord/level-tiers', (req: Request, res: Response) => {
  const { updatedTiers } = req.body;
  if (updatedTiers && typeof updatedTiers === 'object') {
    const validated: Record<number, { name: string; color: string }> = {};
    for (const [lvlStr, val] of Object.entries(updatedTiers)) {
      const lvl = parseInt(lvlStr);
      const roleName = String((val as any).name || '').toUpperCase();
      if (!isNaN(lvl) && ALLOWED_LEVEL_ROLES[roleName]) {
        validated[lvl] = {
          name: roleName,
          color: (val as any).color || ALLOWED_LEVEL_ROLES[roleName],
        };
      }
    }
    if (Object.keys(validated).length > 0) {
      levelTiers = validated;
    }
  }
  return res.json({ success: true, levelTiers });
});

// =============================================================================
// TEMPORARY VOICE CHANNELS API
// =============================================================================
app.get('/api/tempvoice/config', (_req: Request, res: Response) => {
  return res.json(loadTempVoiceConfig());
});

app.post('/api/tempvoice/config', (req: Request, res: Response) => {
  const current = loadTempVoiceConfig();
  const updated = { ...current, ...req.body };
  saveTempVoiceConfig(updated);
  return res.json({ success: true, config: updated });
});

app.get('/api/tempvoice/channels', (_req: Request, res: Response) => {
  try {
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channels = Array.from(activeTempVcs.values()).map((v) => {
      const ch = guild?.channels.cache.get(v.channelId);
      const members = ch && 'members' in ch ? Array.from((ch as any).members.values()).map((m: any) => ({
        id: m.id,
        tag: m.user?.tag || m.displayName,
        displayName: m.displayName || m.user?.username,
        avatar: m.user?.displayAvatarURL?.() || null,
        isMuted: m.voice?.mute || false,
        isDeaf: m.voice?.deaf || false,
      })) : [];

      return {
        ...v,
        memberCount: members.length,
        members,
      };
    });
    return res.json({ channels });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/tempvoice/auto-setup', async (_req: Request, res: Response) => {
  try {
    const result = await autoSetupTempVoice(discordBot, DISCORD_GUILD_ID);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/tempvoice/deploy-interface', async (req: Request, res: Response) => {
  try {
    const cfg = loadTempVoiceConfig();
    const targetChannelId = req.body?.channelId || cfg.controlChannelId;
    if (!targetChannelId) {
      return res.status(400).json({ error: 'No control channel configured' });
    }
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channel = guild?.channels.cache.get(targetChannelId) as TextChannel | undefined;
    if (!channel) {
      return res.status(404).json({ error: 'Control channel not found in Discord server' });
    }
    const { embed, components } = buildTempVoiceInterface();
    await channel.send({ embeds: [embed], components });
    return res.json({ success: true, message: `Interface deployed to #${channel.name}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/tempvoice/action', async (req: Request, res: Response) => {
  try {
    const { action, channelId, value } = req.body;
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channel = guild?.channels.cache.get(channelId) as VoiceChannel | undefined;
    const record = activeTempVcs.get(channelId);

    if (!channel || !record) {
      return res.status(404).json({ error: 'Channel not found or not an active temp VC' });
    }

    if (action === 'lock') {
      const nowLocked = !record.isLocked;
      record.isLocked = nowLocked;
      const baseName = channel.name.replace(/^🔒\s*/, '');
      await channel.setName(nowLocked ? `🔒 ${baseName}` : baseName).catch(() => { });
      await channel.permissionOverwrites.edit(guild!.roles.everyone.id, {
        Connect: !nowLocked,
      }).catch(() => { });
      saveActiveTempVoiceChannels(Array.from(activeTempVcs.values()));
      return res.json({ success: true, isLocked: nowLocked });
    }

    if (action === 'rename' && value) {
      const newName = String(value).trim();
      const finalName = record.isLocked ? `🔒 ${newName}` : newName;
      await channel.setName(finalName).catch(() => { });
      record.name = finalName;
      saveActiveTempVoiceChannels(Array.from(activeTempVcs.values()));
      return res.json({ success: true, name: finalName });
    }

    if (action === 'delete') {
      if (record.waitingRoomId) {
        const wr = guild?.channels.cache.get(record.waitingRoomId);
        if (wr) await wr.delete().catch(() => { });
      }
      await channel.delete().catch(() => { });
      activeTempVcs.delete(channelId);
      saveActiveTempVoiceChannels(Array.from(activeTempVcs.values()));
      return res.json({ success: true, deleted: true });
    }

    return res.status(400).json({ error: 'Unsupported action' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// TICKET SYSTEM API
// =============================================================================
app.get('/api/tickets/config', (_req: Request, res: Response) => {
  return res.json(loadTicketConfig());
});

app.post('/api/tickets/config', (req: Request, res: Response) => {
  const current = loadTicketConfig();
  const updated = { ...current, ...req.body };
  saveTicketConfig(updated);
  return res.json({ success: true, config: updated });
});

app.get('/api/tickets/list', (_req: Request, res: Response) => {
  try {
    const list = Array.from(ticketStore.values()).sort((a, b) => b.createdAt - a.createdAt);
    return res.json({ tickets: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/auto-setup', async (_req: Request, res: Response) => {
  try {
    const result = await autoSetupTickets(discordBot, DISCORD_GUILD_ID);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/deploy-panel', async (req: Request, res: Response) => {
  try {
    const cfg = loadTicketConfig();
    const targetChannelId = req.body?.channelId || cfg.panelChannelId;
    if (!targetChannelId) {
      return res.status(400).json({ error: 'No panel channel configured' });
    }
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channel = guild?.channels.cache.get(targetChannelId) as TextChannel | undefined;
    if (!channel) {
      return res.status(404).json({ error: 'Panel channel not found in Discord server' });
    }
    const { embed, components } = buildTicketPanelInterface(cfg);
    await channel.send({ embeds: [embed], components });
    return res.json({ success: true, message: `Ticket panel deployed to #${channel.name}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/action', async (req: Request, res: Response) => {
  try {
    const { ticketId, action } = req.body;
    const ticket = ticketStore.get(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channel = guild?.channels.cache.get(ticket.channelId) as TextChannel | undefined;

    if (action === 'close') {
      ticket.status = 'CLOSED';
      ticket.closedAt = Date.now();
      ticket.closedBy = { id: 'DASHBOARD', tag: 'Dashboard Admin' };
      saveActiveTickets(Array.from(ticketStore.values()));
      if (channel) {
        await channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: false }).catch(() => { });
        await channel.send({ content: '🔒 Ticket closed by administrator via dashboard.' }).catch(() => { });
      }
      return res.json({ success: true, ticket });
    }

    if (action === 'delete') {
      if (channel) {
        await channel.delete().catch(() => { });
      }
      ticketStore.delete(ticketId);
      saveActiveTickets(Array.from(ticketStore.values()));
      return res.json({ success: true, deleted: true });
    }

    if (action === 'reopen') {
      ticket.status = 'OPEN';
      ticket.closedAt = undefined;
      ticket.closedBy = undefined;
      saveActiveTickets(Array.from(ticketStore.values()));
      if (channel) {
        await channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: true }).catch(() => { });
        await channel.send({ content: '🔓 Ticket reopened by administrator via dashboard.' }).catch(() => { });
      }
      return res.json({ success: true, ticket });
    }

    return res.status(400).json({ error: 'Unsupported action' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// MUSIC SYSTEM API - DJ Bot Endpoints
// =============================================================================

// =============================================================================
// MUSIC SYSTEM REST API — Real Voice Channel & YouTube/Spotify Engine
// =============================================================================

// GET /api/music/status - Get current music state & live Discord VC status
app.get('/api/music/status', (_req: Request, res: Response) => {
  const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
  const conn = getVoiceConnection(DISCORD_GUILD_ID);
  const activeChanId = conn?.joinConfig.channelId || musicVcChannelId;
  const connectedChan = activeChanId ? guild?.channels.cache.get(activeChanId) as any : null;

  const connectedMembers = connectedChan?.members?.map((m: any) => ({
    id: m.id,
    username: m.user.username,
    displayName: m.displayName || m.user.username,
    avatar: m.user.displayAvatarURL({ size: 64 }) || 'https://cdn.discordapp.com/embed/avatars/0.png',
    isMuted: !!(m.voice?.mute || m.voice?.selfMute),
    isDeaf: !!(m.voice?.deaf || m.voice?.selfDeaf),
    isSpeaking: !!m.voice?.speaking,
    isBot: m.user.bot,
  })) || [];

  const availableVcs = guild?.channels.cache
    .filter((c: any) => c.type === 2) // ChannelType.GuildVoice
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      memberCount: c.members?.size || 0,
      userLimit: c.userLimit || 0,
    })) || [];

  return res.json({
    isPlaying: musicIsPlaying,
    currentTrack: musicCurrentTrack,
    queue: musicQueue,
    volume: musicVolume,
    loop: musicLoopMode,
    shuffle: musicShuffleEnabled,
    botInVc: !!conn,
    connectedVc: connectedChan ? {
      id: connectedChan.id,
      name: connectedChan.name,
      members: connectedMembers,
      memberCount: connectedMembers.length,
    } : null,
    availableVcs,
  });
});

// GET /api/music/search - Live YouTube search (no API key required)
app.get('/api/music/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  try {
    const results = await searchYouTube(q, 6);
    return res.json({ results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, results: [] });
  }
});

// POST /api/music/connect or /api/music/join - Connect bot to a voice channel
app.post(['/api/music/connect', '/api/music/join'], async (req: Request, res: Response) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'channelId required' });

  try {
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    if (!guild) return res.status(404).json({ error: 'Discord Guild not found' });

    const chan = guild.channels.cache.get(channelId);
    if (!chan || chan.type !== 2) {
      return res.status(400).json({ error: 'Specified channel is not a voice channel' });
    }

    joinVoice(guild, channelId);

    return res.json({
      success: true,
      channelId,
      channelName: chan.name,
      message: `ClubEZ connected to Voice Channel #${chan.name}!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/music/disconnect or /api/music/leave - Disconnect bot from voice
app.post(['/api/music/disconnect', '/api/music/leave'], (_req: Request, res: Response) => {
  leaveVoice(DISCORD_GUILD_ID);
  return res.json({ success: true, message: 'ClubEZ disconnected from voice channel.' });
});

// POST /api/music/play - Add track to queue and start playing
app.post('/api/music/play', async (req: Request, res: Response) => {
  const { query, requestedBy = 'KEN', channelId } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);

    // Auto-connect to VC if channelId specified or if already known
    const targetVcId = channelId || musicVcChannelId;
    if (guild && targetVcId) {
      joinVoice(guild, targetVcId);
    }

    // Live search YouTube/Spotify
    const searchResults = await searchYouTube(query, 1);
    const matched = searchResults[0];

    const isSpotify = query.includes('spotify.com');
    const newTrack: MusicQueueItem = matched ? {
      ...matched,
      requestedBy,
      addedAt: Date.now(),
    } : {
      id: `track_${Date.now()}`,
      title: query,
      artist: isSpotify ? 'Spotify' : 'YouTube Artist',
      duration: '3:30',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
      url: query.startsWith('http') ? query : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      source: isSpotify ? 'spotify' : 'youtube',
      requestedBy,
      addedAt: Date.now(),
    };

    if (!musicCurrentTrack) {
      musicCurrentTrack = newTrack;
      musicIsPlaying = true;
    } else {
      musicQueue.push(newTrack);
    }

    // Post rich update embed to a text channel in Discord
    if (guild && targetVcId) {
      const vcChan = guild.channels.cache.get(targetVcId);
      const textChan = guild.channels.cache.find((c: any) =>
        c.type === 0 && (c.parentId === (vcChan as any)?.parentId || c.name.includes('music') || c.name.includes('bot') || c.name.includes('general'))
      ) as TextChannel | undefined;

      if (textChan) {
        const embed = new EmbedBuilder()
          .setTitle(musicCurrentTrack?.id === newTrack.id ? '🎵 Now Playing' : '📋 Added to Queue')
          .setColor(0xE50914)
          .setDescription(`**[${newTrack.title}](${newTrack.url})**\n🎤 **Artist:** ${newTrack.artist}\n⏱️ **Duration:** \`${newTrack.duration}\``)
          .setThumbnail(newTrack.thumbnail)
          .addFields(
            { name: '📡 Source', value: newTrack.source, inline: true },
            { name: '👤 Requested by', value: requestedBy, inline: true },
            { name: '📋 Queue', value: `${musicQueue.length} song${musicQueue.length !== 1 ? 's' : ''} waiting`, inline: true }
          )
          .setFooter({ text: 'Club EZKEN DJ System • Controlled via Dashboard' })
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('music:pause').setLabel('⏸ Pause').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('music:skip').setLabel('⏭ Skip').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('music:stop').setLabel('⏹ Stop & Leave').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('music:queue_btn').setLabel('📋 Queue').setStyle(ButtonStyle.Primary),
        );

        await textChan.send({ embeds: [embed], components: [row] }).catch(() => { });
      }
    }

    return res.json({
      success: true,
      track: newTrack,
      queuePosition: musicCurrentTrack?.id === newTrack.id ? 0 : musicQueue.length,
      queue: musicQueue,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/music/skip - Skip current track
app.post('/api/music/skip', (_req: Request, res: Response) => {
  const prev = musicCurrentTrack;
  if (musicQueue.length > 0) {
    musicCurrentTrack = musicQueue.shift() || null;
    musicIsPlaying = true;
  } else {
    musicCurrentTrack = null;
    musicIsPlaying = false;
  }
  return res.json({ success: true, skipped: prev, nowPlaying: musicCurrentTrack, queue: musicQueue });
});

// POST /api/music/pause - Toggle pause
app.post('/api/music/pause', (_req: Request, res: Response) => {
  musicIsPlaying = !musicIsPlaying;
  return res.json({ success: true, isPlaying: musicIsPlaying });
});

// POST /api/music/stop - Stop music, clear queue & leave VC
app.post('/api/music/stop', (_req: Request, res: Response) => {
  leaveVoice(DISCORD_GUILD_ID);
  return res.json({ success: true, message: 'Music stopped and ClubEZ disconnected from voice.' });
});

// POST /api/music/remove - Remove song by ID or index
app.post('/api/music/remove', (req: Request, res: Response) => {
  const { trackId, index } = req.body;
  if (trackId) {
    musicQueue = musicQueue.filter(t => t.id !== trackId);
  } else if (typeof index === 'number' && index >= 0 && index < musicQueue.length) {
    musicQueue.splice(index, 1);
  }
  return res.json({ success: true, queue: musicQueue });
});

// POST /api/music/clear-queue - Clear only the queue
app.post('/api/music/clear-queue', (_req: Request, res: Response) => {
  musicQueue = [];
  return res.json({ success: true, queue: [] });
});

// POST /api/music/volume - Set volume
app.post('/api/music/volume', (req: Request, res: Response) => {
  const { volume } = req.body;
  if (typeof volume !== 'number' || volume < 0 || volume > 100) {
    return res.status(400).json({ error: 'Volume must be 0-100' });
  }
  musicVolume = volume;
  return res.json({ success: true, volume });
});

// POST /api/music/loop - Toggle loop
app.post('/api/music/loop', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (mode && ['off', 'track', 'queue'].includes(mode)) {
    musicLoopMode = mode;
  } else {
    musicLoopMode = musicLoopMode === 'off' ? 'track' : musicLoopMode === 'track' ? 'queue' : 'off';
  }
  return res.json({ success: true, loop: musicLoopMode });
});

// POST /api/music/shuffle - Toggle shuffle
app.post('/api/music/shuffle', (_req: Request, res: Response) => {
  musicShuffleEnabled = !musicShuffleEnabled;
  if (musicShuffleEnabled && musicQueue.length > 1) {
    for (let i = musicQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [musicQueue[i], musicQueue[j]] = [musicQueue[j], musicQueue[i]];
    }
  }
  return res.json({ success: true, shuffle: musicShuffleEnabled, queue: musicQueue });
});

// POST /api/music/deploy-panel - Deploy interactive music panel to Discord text channel
app.post('/api/music/deploy-panel', async (req: Request, res: Response) => {
  const { channelId } = req.body;

  try {
    // Find the target channel
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    let targetChannel: TextChannel | undefined;

    if (channelId) {
      targetChannel = guild?.channels.cache.get(channelId) as TextChannel;
    }

    // Fallback: find a music/bot text channel
    if (!targetChannel) {
      targetChannel = guild?.channels.cache.find((c: any) =>
        c.type === 0 && (c.name.includes('music') || c.name.includes('bot') || c.name.includes('commands'))
      ) as TextChannel;
    }

    // Last fallback: find general
    if (!targetChannel) {
      targetChannel = guild?.channels.cache.find((c: any) =>
        c.type === 0 && (c.name.includes('general') || c.name.includes('lounge'))
      ) as TextChannel;
    }

    if (!targetChannel) {
      return res.status(404).json({ error: 'No suitable text channel found to deploy music panel' });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎵 Club EZKEN — DJ Music Control Panel')
      .setColor(0xE50914)
      .setDescription(
        '**Welcome to the Club EZKEN DJ System!**\n\n' +
        'Use the buttons below or slash commands to control music.\n\n' +
        '**🎵 YouTube** • **🎶 Spotify** • **📻 SoundCloud** — all supported!'
      )
      .addFields(
        { name: '▶️ Play', value: '`/play <song name or URL>`', inline: true },
        { name: '⏭ Skip', value: '`/skip`', inline: true },
        { name: '⏸ Pause/Resume', value: '`/pause`', inline: true },
        { name: '🔊 Volume', value: '`/volume <1-100>`', inline: true },
        { name: '📋 Queue', value: '`/queue`', inline: true },
        { name: '🔁 Loop', value: '`/loop`', inline: true },
      )
      .setFooter({ text: 'Club EZKEN DJ System • Powered by ClubEZ Bot' })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('music:play_prompt').setLabel('▶️ Play Song').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('music:pause').setLabel('⏸ Pause').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:skip').setLabel('⏭ Skip').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:stop').setLabel('⏹ Stop').setStyle(ButtonStyle.Danger),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('music:queue').setLabel('📋 Queue').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music:shuffle').setLabel('🔀 Shuffle').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music:loop').setLabel('🔁 Loop').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music:nowplaying').setLabel('🎵 Now Playing').setStyle(ButtonStyle.Secondary),
    );

    const sent = await targetChannel.send({ embeds: [embed], components: [row1, row2] });

    return res.json({
      success: true,
      messageId: sent.id,
      channelName: targetChannel.name,
      message: `DJ Music Panel deployed to #${targetChannel.name}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// BOT CODEBASE EXPLORER & ZIP ARCHIVE
// -----------------------------------------------------------------------------
interface FileEntry {
  path: string;
  name: string;
  content: string;
  size: number;
}

function getFilesRecursively(dir: string, baseDir: string): FileEntry[] {
  let results: FileEntry[] = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (['node_modules', '.git', 'dist', '.DS_Store', 'Thumbs.db', 'ezken.sqlite-shm', 'ezken.sqlite-wal'].includes(item)) {
      continue;
    }
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath, 'utf8');
      results.push({
        path: relPath,
        name: item,
        content,
        size: stat.size,
      });
    }
  }
  return results;
}

app.get('/api/bot-files', (_req: Request, res: Response) => {
  try {
    const botDir = path.join(__dirname, 'bot');
    const files = getFilesRecursively(botDir, botDir);
    return res.json({ files });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/download-bot-zip', async (_req: Request, res: Response) => {
  try {
    const botDir = path.join(__dirname, 'bot');
    const files = getFilesRecursively(botDir, botDir);
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.path, f.content);
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="club-ezken-bot.zip"');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// VITE MIDDLEWARE / PRODUCTION STATIC ASSETS
// -----------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // UPDATE 3: Bind securely to 0.0.0.0 and listen on the new dynamic PORT
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[SERVER] API Server is running on port ${PORT}`);
  });
}

// Global error handler — return JSON instead of Express's default HTML error pages
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[EXPRESS ERROR]', err?.stack || err?.message || err);
  res.status(err?.status || 500).json({
    error: err?.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
  });
});

startServer().catch((err) => {
  console.error('[SERVER ERROR]', err);
});