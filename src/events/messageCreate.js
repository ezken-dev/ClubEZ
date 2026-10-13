import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CONFIG, getTierForLevel } from '../config.js';
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

        const alertChannel = message.guild.channels.cache.get(CONFIG.CHANNELS.MOD_ALERTS) || message.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
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

        const alertChannel = message.guild.channels.cache.get(CONFIG.CHANNELS.MOD_ALERTS) || message.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
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
      if (!message.member?.permissions.has('ManageGuild')) {
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
    // 2. SMART AI AUTO-MODERATION ENGINE (Gemini API with DO & DON'T advice)
    // =========================================================================
    if (content.length > 5 && !content.startsWith('/')) {
      evaluateMessageWithAI(content).then(async (result) => {
        if (result.flagged && result.confidence >= 0.70) {
          try {
            await message.delete().catch(() => {});

            // Auto-action (Timeout if suggested)
            if (result.suggestedAction === 'TIMEOUT' && message.member?.moderatable) {
              await message.member.timeout(30 * 60 * 1000, `AI Auto-Mod: ${result.reason}`);
            }

            // Create Moderation Case
            const modCase = createCase({
              userId: message.author.id,
              userTag: message.author.tag,
              moderatorId: client.user.id,
              moderatorTag: 'EZKEN-AI-Mod',
              actionType: result.suggestedAction === 'TIMEOUT' ? 'AUTO_TIMEOUT' : 'WARN',
              reason: `[AI Flagged ${result.categories.join(', ')}] ${result.reason}`
            });

            // Send Direct Smart AI Warning to User via DM
            const dmEmbed = new EmbedBuilder()
              .setTitle('⚠️ Club EZKEN Automated Moderation Warning')
              .setColor(CONFIG.COLORS.WARNING)
              .setDescription(`Hey **${message.author.username}**, your recent message in **#${message.channel.name}** was removed because it violated community rules.`)
              .addFields(
                { name: '🤖 What Happened', value: result.smartWarning || result.reason },
                { name: '✅ What You Should Do', value: result.adviceDo || 'Engage constructively and follow our respectful community standards.' },
                { name: '❌ What You Must NOT Do', value: result.adviceDont || 'Do not post offensive language, harassment, or prohibited content.' }
              )
              .setFooter({ text: 'Club EZKEN Smart AI Shield • Powered by Gemini' })
              .setTimestamp();

            try {
              await message.author.send({ embeds: [dmEmbed] });
            } catch {
              // Fallback to brief channel notice if DMs are disabled
              const tempWarn = await message.channel.send({
                content: `⚠️ ${message.author}, your message was removed for rule violation: **${result.smartWarning || result.reason}**`
              }).catch(() => null);
              if (tempWarn) setTimeout(() => tempWarn.delete().catch(() => {}), 15000);
            }

            // Realtime Audit Log to #mod-logs (Channel ID 1559441137624678440)
            const logChannel = message.guild.channels.cache.get(CONFIG.CHANNELS.LOGS) || message.guild.channels.cache.get(CONFIG.CHANNELS.MOD_ALERTS);
            if (logChannel) {
              const alertEmbed = new EmbedBuilder()
                .setTitle(`🤖 AI Moderation Alert • Case ${modCase.case_id}`)
                .setColor(CONFIG.COLORS.DANGER)
                .setDescription(`A message in ${message.channel} was flagged and automatically removed.`)
                .addFields(
                  { name: 'Offender', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                  { name: 'Confidence', value: `\`${Math.round(result.confidence * 100)}%\``, inline: true },
                  { name: 'Categories', value: `\`${result.categories.join(', ') || 'TOXICITY'}\``, inline: true },
                  { name: 'Flagged Content', value: `\`\`\`${content.substring(0, 800)}\`\`\`` },
                  { name: 'AI Assessment', value: result.reason },
                  { name: 'Smart AI Warning', value: result.smartWarning || 'Warning delivered to user' },
                  { name: 'Advice DO', value: result.adviceDo || 'Engage constructively' },
                  { name: 'Advice DONT', value: result.adviceDont || 'Avoid toxicity/spam' }
                )
                .setFooter({ text: 'Powered by Gemini • Club EZKEN Neural Shield' })
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
                  .setLabel('Dismiss')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('✅')
              );

              await logChannel.send({ embeds: [alertEmbed], components: [modButtons] });
            }
          } catch (err) {
            console.error('[AI MOD DISPATCH ERROR]', err.message);
          }
        }
      }).catch(err => console.error('[AI EVALUATION ERROR]', err));
    }

    // =========================================================================
    // 3. HARD EXPONENTIAL XP & LEVELING PROGRESSION
    // =========================================================================
    const userStats = getUserXpData(userId);
    const cooldownMs = CONFIG.XP.COOLDOWN_SECONDS * 1000;

    if (now - userStats.last_text_xp >= cooldownMs) {
      // 15 - 20 XP per message with strict 60s cooldown
      const xpGained = Math.floor(Math.random() * (CONFIG.XP.TEXT_MAX - CONFIG.XP.TEXT_MIN + 1)) + CONFIG.XP.TEXT_MIN;
      const progress = addTextXp(userId, xpGained);

      if (progress.leveledUp) {
        const tier = getTierForLevel(progress.level);

        // Congratulatory Level-Up Notification
        const levelEmbed = new EmbedBuilder()
          .setTitle('🔥 LEVEL UP! • CLUB EZKEN')
          .setColor(tier.color || CONFIG.COLORS.PRIMARY)
          .setDescription(`Congratulations ${message.author}! You just advanced to **Level ${progress.level}**! 🎉\nRank Tier: **@${tier.name}**`)
          .addFields(
            { name: '🔓 Unlocked Perks', value: tier.features.map(f => `• ${f}`).join('\n') }
          )
          .setFooter({ text: 'Leveling up requires dedication • Voice chat & texting earn XP' });

        await message.channel.send({ embeds: [levelEmbed] }).catch(() => {});

        // Automatic Promotion & Role Assignment from the 9 Approved Tiers
        if (message.member) {
          const role = message.guild.roles.cache.find(r =>
            r.name.toLowerCase().replace(/[@\s]/g, '') === tier.name.toLowerCase().replace(/[@\s]/g, '')
          );
          if (role && !message.member.roles.cache.has(role.id)) {
            try {
              await message.member.roles.add(role, `Automated promotion for reaching Level ${progress.level}`);
              await message.channel.send(`🎖️ ${message.author} unlocked the prestigious **@${tier.name}** role!`);

              const logChannel = message.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
              if (logChannel) {
                logChannel.send(`🎉 **[LEVELING PROMOTION]** ${message.author.tag} promoted to **Level ${progress.level}** (@${tier.name})!`);
              }
            } catch (roleErr) {
              console.error('[LEVEL ROLE ERROR]', roleErr.message);
            }
          }
        }
      }
    }
  }
};
