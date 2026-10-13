# Club EZKEN • Custom Discord Bot

> **High-Performance Discord.js v14 Bot Engine Replacing Sapphire & MEE6**
> Built with Node.js (v18+), SQLite in WAL mode, Canvas GPU/CPU rendering, Gemini AI auto-moderation, and PM2 process management.

---

## ⚡ What This Bot Replaces

| Feature | Legacy Bot (Sapphire / MEE6) | Club EZKEN Custom Bot |
| :--- | :--- | :--- |
| **Moderation Cases** | Cloud-dependent, limited case editing | **Incremental SQLite Case Ledger (`#0001`, `#0002`)** with `/case view` & `/case edit` |
| **AI Auto-Moderation** | Basic regex word blocks or paid paywall | **Gemini 3.8 Flash Neural Shield** evaluating toxicity, severe harassment, hate speech & NSFW |
| **Rank Cards** | Slow external hosted web embeds or watermarks | **High-speed Canvas PNG Cards (934x282)** with custom Club EZKEN red `#E50914` styling |
| **Reaction Roles** | Laggy emoji reactions | **Interactive Discord Buttons & StringSelectMenus** with instant ephemeral feedback |
| **Triage Reports** | Manual screenshot DMs | **Interactive `#mod-reports` Dispatcher** with quick `[Timeout 1h]`, `[Ban]`, `[Dismiss]` buttons |
| **YouTube Alerts** | Unreliable webhooks | **Fast 2-minute RSS Feed Poller** with duplicate-prevention SQLite cache |
| **Uptime / Cost** | Subscription / external downtime | **Self-hosted local SQLite WAL + PM2 zero-downtime clustering** |

---

## 🚀 Quick Start Guide (Get Started Simply)

Follow these simple steps to launch your bot in under 5 minutes:

### 1. Discord Developer Portal Setup
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Name it **Club EZKEN** and save.
3. In the left menu, click **Bot**:
   - Click **Reset Token** and copy your **Bot Token** (save this for `.env`).
   - Scroll down to **Privileged Gateway Intents** and enable ALL THREE:
     - ✅ **Presence Intent**
     - ✅ **Server Members Intent** (Required for join roles & welcome cards)
     - ✅ **Message Content Intent** (Required for AI auto-mod, invite blocking & XP)
4. In the left menu, click **OAuth2 ➔ URL Generator**:
   - Check `bot` and `applications.commands`.
   - Under Bot Permissions, select:
     - `Administrator` (or `Manage Roles`, `Manage Channels`, `Kick Members`, `Ban Members`, `Moderate Members`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`).
   - Copy the generated URL, open it in your browser, and authorize it to your **Club EZKEN** server.

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your configuration:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
DISCORD_GUILD_ID=your_primary_club_ezken_server_id_here
GEMINI_API_KEY=your_gemini_api_key_here

# Channels (Right-click channels in Discord with Developer Mode enabled to copy IDs)
LOG_CHANNEL_ID=your_mod_logs_channel_id
MOD_ALERT_CHANNEL_ID=your_mod_alerts_channel_id
REPORT_CHANNEL_ID=your_mod_reports_channel_id
WELCOME_CHANNEL_ID=your_lounge_welcome_channel_id
ANNOUNCE_CHANNEL_ID=your_announcements_channel_id

# Roles
DEFAULT_ROLE_ID=your_initiate_or_member_role_id
STREAM_PING_ROLE_ID=your_stream_ping_role_id

# YouTube (Optional)
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxx
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Deploy Slash Commands
Register all commands to your Discord server instantly:
```bash
npm run deploy
```

### 5. Launch the Bot
**For Local Testing:**
```bash
npm start
```

**For 24/7 Production Deployment (PM2):**
```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start with zero-downtime autorestart & logging
pm2 start ecosystem.config.cjs

# View live logs
pm2 logs club-ezken-bot

# Save PM2 process list to restart automatically on server reboot
pm2 save
pm2 startup
```

---

## 📂 Architecture Overview

```
├── package.json               # Dependencies (@napi-rs/canvas, better-sqlite3, discord.js, @google/genai)
├── ecosystem.config.cjs       # PM2 orchestration with max-memory auto-restarts & log rotation
├── .env.example               # Template environment configuration
├── src/
│   ├── index.js               # Client entry point with unhandled rejection shields
│   ├── config.js              # Central constants, level curve formula & branding
│   ├── deploy-commands.js     # Discord REST API slash command registrar
│   ├── database/
│   │   ├── db.js              # better-sqlite3 WAL mode operations & prepared statements
│   │   └── schema.sql         # Cases, templates, users_xp, reports & stream cache schemas
│   ├── services/
│   │   ├── aiModeration.js    # Gemini 3.8 Flash neural moderation scanner
│   │   ├── canvasRenderer.js  # 934x282 Rank Card & Welcome Banner canvas generator
│   │   └── streamWatcher.js   # YouTube RSS poller with SQLite anti-duplicate cache
│   ├── events/
│   │   ├── guildMemberAdd.js  # Join role & welcome card dispatcher
│   │   ├── messageCreate.js   # Anti-spam, mass-mention, invite blocker & XP engine
│   │   ├── interactionCreate.js# Slash command, button toggle & report triage router
│   │   ├── voiceStateUpdate.js# Dynamic voice channel XP ticker
│   │   └── messageDelete.js   # Audit log logger
│   └── commands/
│       ├── moderation/        # /warn, /mute, /kick, /ban, /unban, /slowmode, /purge, /case
│       ├── leveling/          # /rank, /leaderboard
│       ├── utility/           # /report, /ping
│       └── templates/         # /embed, /reactionrole
```

---

## 🎯 Command Reference

### Moderation & Permissions
- `/syncpermissions` — **(Admin only)** Synchronizes Discord permissions for all 9 leveling roles (`@ROOKIE` through `@STAR SUPPORTER`).
- `/warn <user> <reason>` — Issues formal warning with AI advice, logs Case ID, DMs target.
- `/mute <user> <duration> <reason>` — Discord timeout (up to 28 days), DMs user, logs to `#mod-logs`.
- `/kick <user> <reason>` — Removes member with audit logging.
- `/ban <user> <reason> [delete_days]` — Bans user and purges recent messages.
- `/unban <user_id> <reason>` — Revokes guild ban and updates case log.
- `/slowmode <seconds> [channel]` — Configures user rate-limiting (0 to disable).
- `/purge <count> [user]` — Bulk removes up to 100 recent messages with moderator audit log.
- `/case view <id>` — Retrieves case `#0001` details, moderator, timestamp, and action.
- `/case edit <id> <new_reason>` — Updates reason for an existing punitive action.
- `/case history <user>` — Displays full infraction ledger for a user.

### Leveling & Community
- `/rank [user]` — Renders real-time 934x282 PNG Rank Card with avatar, level, tier badge, VC time, and progress.
- `/leaderboard` — Interactive top 10 members with VC minutes, message counts, and live refresh button.
- `/reactionrole buttons` — Deploys interactive buttons for self-roles with instant toggle feedback.
- `/reactionrole menu` — Deploys multi-choice role select dropdown.
- `/embed create` — Builds custom Club EZKEN red `#E50914` embeds with buttons and templates.
- `/embed load <template_name>` — Dispatches pre-saved embed from SQLite.
- `/report <user> <reason>` — Dispatches triage ticket to `#mod-reports` with staff action buttons.
- `/ping` — Measures WebSocket ping, roundtrip latency, and SQLite query speed.

---

## 🚀 How to Push to GitHub & Host 24/7

1. **Initialize Git inside this folder:**
   ```bash
   git init
   git add .
   git commit -m "feat: Club EZKEN custom bot with hard leveling and smart AI moderation"
   ```
2. **Push to your GitHub repository:**
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/club-ezken-bot.git
   git push -u origin main
   ```
3. **Deploy Anywhere (Railway / VPS / Heroku / Pterodactyl):**
   - Clone the repo: `git clone https://github.com/YOUR_USERNAME/club-ezken-bot.git`
   - Run `npm install`
   - Run `npm run deploy` to register slash commands in Discord
   - Run `npm start` (or `pm2 start ecosystem.config.cjs`)
   - The bot comes online immediately 24/7!

