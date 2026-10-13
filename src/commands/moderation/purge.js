import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages from the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Only delete messages from this specific user')
        .setRequired(false)),

  async execute(interaction) {
    const count = interaction.options.getInteger('count');
    const filterUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await interaction.channel.messages.fetch({ limit: count });
      let toDelete = messages;

      if (filterUser) {
        toDelete = messages.filter(m => m.author.id === filterUser.id);
      }

      const deleted = await interaction.channel.bulkDelete(toDelete, true);

      // Log action to #mod-logs
      const logChannel = interaction.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🧹 Messages Purged')
          .setColor(CONFIG.COLORS.PRIMARY)
          .addFields(
            { name: 'Channel', value: `${interaction.channel}`, inline: true },
            { name: 'Count', value: `${deleted.size} messages`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Filtered User', value: filterUser ? `${filterUser.tag}` : 'None (All Users)', inline: true }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      return interaction.editReply({
        content: `🧹 Successfully deleted **${deleted.size}** messages${filterUser ? ` from **${filterUser.tag}**` : ''}.`
      });
    } catch (err) {
      return interaction.editReply({
        content: `❌ Could not purge messages: ${err.message}. Note that messages older than 14 days cannot be bulk-deleted.`
      });
    }
  }
};
