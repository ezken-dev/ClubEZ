import { EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';

export default {
  name: 'messageDelete',
  once: false,
  async execute(message, client) {
    if (!message.guild || (message.author && message.author.bot)) return;

    const logChannel = message.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
    if (!logChannel) return;

    try {
      const content = message.content ? message.content.substring(0, 1024) : '*[No text content or embed-only message]*';
      const authorTag = message.author ? `${message.author.tag} (\`${message.author.id}\`)` : '*Unknown Author*';

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .setColor(CONFIG.COLORS.DANGER)
        .addFields(
          { name: 'Author', value: authorTag, inline: true },
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Content', value: content }
        )
        .setFooter({ text: `Message ID: ${message.id}` })
        .setTimestamp();

      if (message.attachments && message.attachments.size > 0) {
        const attachmentUrls = message.attachments.map(a => a.url).join('\n');
        embed.addFields({ name: 'Attachments', value: attachmentUrls.substring(0, 500) });
      }

      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[MESSAGE DELETE AUDIT ERROR]', err.message);
    }
  }
};
