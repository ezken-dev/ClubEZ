import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { renderWelcomeCard } from '../services/canvasRenderer.js';

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member, client) {
    console.log(`[EVENT] Member joined: ${member.user.tag} (${member.id})`);

    // 1. Auto-assign Default Member Role (@INITIATE / @Member)
    if (CONFIG.ROLES.DEFAULT) {
      try {
        const defaultRole = member.guild.roles.cache.get(CONFIG.ROLES.DEFAULT);
        if (defaultRole) {
          await member.roles.add(defaultRole, 'Auto-assigned initial Club EZKEN member role');
          console.log(`[JOIN ROLE] Assigned @${defaultRole.name} to ${member.user.tag}`);
        }
      } catch (err) {
        console.error(`[JOIN ROLE ERROR] Could not assign default role: ${err.message}`);
      }
    }

    // 2. Generate Canvas Welcome Card & Post in #welcome
    const welcomeChannel = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME)
      || member.guild.systemChannel
      || member.guild.channels.cache.find(c => c.name.toLowerCase().includes('welcome'));
    if (welcomeChannel) {
      try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
        const memberCount = member.guild.memberCount;

        const cardBuffer = await renderWelcomeCard({
          username: member.user.username,
          avatarUrl,
          memberCount,
          guildName: member.guild.name || 'CLUB EZKEN'
        });

        const attachment = new AttachmentBuilder(cardBuffer, { name: `welcome-${member.id}.png` });

        await welcomeChannel.send({
          content: `👋 Welcome to **Club EZKEN**, ${member}! Check out <#rules> and select your roles in <#roles>.`,
          files: [attachment]
        });
      } catch (err) {
        console.error(`[WELCOME CARD ERROR] Failed to render canvas welcome: ${err.message}`);
        await welcomeChannel.send(`👋 Welcome to **Club EZKEN**, ${member}! You are member #${member.guild.memberCount}.`);
      }
    }

    // 3. Audit Log in #mod-logs
    const logChannel = member.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('📥 Member Joined')
        .setColor(CONFIG.COLORS.SUCCESS)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: 'Member', value: `${member.user.tag} (${member})`, inline: true },
          { name: 'User ID', value: `\`${member.id}\``, inline: true },
          { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'Total Members', value: `${member.guild.memberCount}`, inline: true }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }
  }
};
