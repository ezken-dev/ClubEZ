import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CONFIG } from '../config.js';
import { addTextXp, getUserXpData, createCase } from '../database/db.js';
import { evaluateMessageWithAI } from '../services/aiModeration.js';

// Anti-Spam Burst Tracker in Memory: Map<userId, Array<timestamps>>
const spamTracker = new Map();

export default {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild || message.webhookId) return;

    const content = message.content || '';
    const userId = message.author.id;
    const now = Date.now();

    // =========================================================================
    // 1. HEURISTIC AUTO-MODERATION RULE FILTERS
    // =========================================================================

    // A. Anti-Spam / Burst Rate Limiter (>5 messages in 3 seconds)
    let userTimestamps = spamTracker.get(userId) || [];
    userTimestamps = userTimestamps.filter(t => now - t < CONFIG.AUTOMOD.SPAM_BURST_WINDOW_MS);
    userTimestamps.push(now);
    spamTracker.set(userId, userTimestamps);

    if (userTimestamps.length > CONFIG.AUTOMOD.SPAM_BURST_MAX) {
      spamTracker.delete(userId);
      try {
        await message.delete();
        if (message.member && message.member.moderatable) {
          await message.member.timeout(10 * 60 * 1000, 'Auto-Mod: Message burst rate limit triggered');
        }

        const alertChannel = message.guild.channels.cache.get(CONFIG.CHANNELS.MOD_ALERTS);
        if (alertChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🚨 Anti-Spam Burst Triggered')
            .setColor(CONFIG.COLORS.DANGER)
            .setDescription(`**${message.author.tag}** sent >5 messages in 3 seconds.\nTarget timed out for 10 minutes.`)
            .addFields({ name: 'Channel', value: `${message.channel}` })
            .setTimestamp();
          await alertChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('[SPAM FILTER ERROR]', err.message);
      }
      return;
    }

    // B. Mass-Mention Suppression (>4 mentions)
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount > CONFIG.AUTOMOD.MAX_MENTIONS) {
      try {
        await message.delete();
        if (message.member && message.member.moderatable) {
          await message.member.timeout(60 * 60 * 1000, 'Auto-Mod: Mass mentions triggered');
        }

        createCase({
          userId,
          userTag: message.author.tag,
          moderatorId: client.user.id,
          moderatorTag: 'EZKEN-AutoMod',
          actionType: 'AUTO_TIMEOUT',
          reason: `Mass mentions (${mentionCount} mentions in single message)`
        });

        const alertChannel = message.guild.channels.cache.get(CONFIG.CHANNELS.MOD_ALERTS);
        if (alertChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🚨 Mass Mention Suppressed')
            .setColor(CONFIG.COLORS.DANGER)
            .setDescription(`**${message.author.tag}** attempted mass mention (${mentionCount} pings) in ${message.channel}.\nUser placed in timeout for 1 hour.`)
            .setTimestamp();
          await alertChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('[MASS MENTION ERROR]', err.message);
      }
      return;
    }

    // C. Discord Invite Link Filter
    if (CONFIG.AUTOMOD.INVITE_REGEX.test(content)) {
      // Allow administrators and moderators to post invites
      if (!message.member.permissions.has('ManageGuild')) {
        try {
          await message.delete();
          await message.channel.send(`⚠️ ${message.author}, posting unauthorized Discord invite links is strictly prohibited in **Club EZKEN**.`);

          const logChannel = message.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
          if (logChannel) {
            const embed = new EmbedBuilder()
              .setTitle('🛡️ Unauthorized Invite Link Removed')
              .setColor(CONFIG.COLORS.WARNING)
              .addFields(
                { name: 'Author', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Content', value: content.substring(0, 500) }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [embed] });
          }
        } catch (err) {
          console.error('[INVITE FILTER ERROR]', err.message);
        }
        return;
      }
    }

    // =========================================================================
    // 2. AI AUTO-MODERATION ENGINE (Gemini API)
    // =========================================================================
    if (content.length > 5 && !content.startsWith('/')) {
      // Run AI evaluation asynchronously to not block event loop
      evaluateMessageWithAI(content).then(async (result) => {
        if (result.flagged && result.confidence >= 0.75) {
          try {
            await message.delete().catch(() => {});

            // Auto-action (Timeout if suggested)
            if (result.suggestedAction === 'TIMEOUT' && message.member && message.member.moderatable) {
              await message.member.timeout(30 * 60 * 1000, `AI Auto-Mod: ${result.reason}`);
            }

            // Create SQLite Moderation Case
            const modCase = createCase({
              userId: message.author.id,
              userTag: message.author.tag,
              moderatorId: client.user.id,
              moderatorTag: 'EZKEN-AI-Mod',
              actionType: result.suggestedAction === 'TIMEOUT' ? 'AUTO_TIMEOUT' : 'WARN',
              reason: `[AI Flagged ${result.categories.join(', ')}] ${result.reason}`
            });

            // Dispatch Alert Card to #mod-alerts
            const alertChannel = message.guild.channels.cache.get(CONFIG.CHANNELS.MOD_ALERTS);
            if (alertChannel) {
              const alertEmbed = new EmbedBuilder()
                .setTitle(`🤖 AI Moderation Alert • Case ${modCase.case_id}`)
                .setColor(CONFIG.COLORS.DANGER)
                .setDescription(`A message in ${message.channel} was flagged and automatically removed.`)
                .addFields(
                  { name: 'Author', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                  { name: 'Confidence', value: `\`${Math.round(result.confidence * 100)}%\``, inline: true },
                  { name: 'Categories', value: `\`${result.categories.join(', ') || 'HARASSMENT'}\``, inline: true },
                  { name: 'Flagged Content', value: `\`\`\`${content.substring(0, 800)}\`\`\`` },
                  { name: 'AI Assessment', value: result.reason }
                )
                .setFooter({ text: 'Powered by Gemini 3.8 Flash • Club EZKEN Neural Shield' })
                .setTimestamp();

              const modButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`mod_report_timeout_${modCase.case_id}_${message.author.id}`)
                  .setLabel('Timeout 1h')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('⏳'),
                new ButtonBuilder()
                  .setCustomId(`mod_report_ban_${modCase.case_id}_${message.author.id}`)
                  .setLabel('Ban User')
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji('🔨'),
                new ButtonBuilder()
                  .setCustomId(`mod_report_dismiss_${modCase.case_id}`)
                  .setLabel('Dismiss Alert')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('✅')
              );

              await alertChannel.send({ embeds: [alertEmbed], components: [modButtons] });
            }
          } catch (err) {
            console.error('[AI MOD DISPATCH ERROR]', err.message);
          }
        }
      }).catch(err => console.error('[AI EVALUATION ERROR]', err));
    }

    // =========================================================================
    // 3. DYNAMIC XP & LEVELING ENGINE
    // =========================================================================
    const userStats = getUserXpData(userId);
    const cooldownMs = CONFIG.XP.COOLDOWN_SECONDS * 1000;

    if (now - userStats.last_text_xp >= cooldownMs) {
      // Random XP between 15 and 25
      const xpGained = Math.floor(Math.random() * (CONFIG.XP.TEXT_MAX - CONFIG.XP.TEXT_MIN + 1)) + CONFIG.XP.TEXT_MIN;
      const progress = addTextXp(userId, xpGained);

      if (progress.leveledUp) {
        // Congratulatory Level-Up Notification
        const levelEmbed = new EmbedBuilder()
          .setTitle('🔥 LEVEL UP! • CLUB EZKEN')
          .setColor(CONFIG.COLORS.PRIMARY)
          .setDescription(`Congratulations ${message.author}! You just advanced to **Level ${progress.level}**! 🎉`)
          .setFooter({ text: 'Keep chatting to unlock elite community perks & roles' });

        await message.channel.send({ embeds: [levelEmbed] }).catch(() => {});

        // Check for Auto-Role Rewards (Levels 1, 5, 10, 20, 30, 45, 60, 80, 100)
        const tier = CONFIG.LEVEL_TIERS[progress.level];
        if (tier && message.member) {
          const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === tier.name.toLowerCase());
          if (role) {
            try {
              await message.member.roles.add(role, `Automated reward for reaching Level ${progress.level}`);
              await message.channel.send(`🎖️ ${message.author} unlocked the prestigious **@${tier.name}** role!`);
            } catch (roleErr) {
              console.error('[LEVEL ROLE ERROR]', roleErr.message);
            }
          }
        }
      }
    }
  }
};
