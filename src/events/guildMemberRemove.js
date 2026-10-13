import { EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member, client) {
    console.log(`[EVENT] Member left: ${member.user.tag} (${member.id})`);

    const logChannel = member.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
    if (logChannel) {
      try {
        const remainingCount = member.guild.memberCount;
        const joinedTimestamp = member.joinedTimestamp
          ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
          : '*Unknown*';

        const embed = new EmbedBuilder()
          .setTitle('📤 Member Left / Deduction Recalculated')
          .setColor(CONFIG.COLORS.DANGER)
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: 'Member', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
            { name: 'Joined Server', value: joinedTimestamp, inline: true },
            { name: 'Total Active Members', value: `\`${remainingCount}\``, inline: true }
          )
          .setFooter({ text: 'Smart Member Counter • Deduction Detected' })
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      } catch (err) {
        console.error('[MEMBER REMOVE AUDIT ERROR]', err.message);
      }
    }
  }
};
