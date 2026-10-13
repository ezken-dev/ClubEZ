import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { createCase } from '../../database/db.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by their Discord user ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option => 
      option.setName('user_id')
        .setDescription('The user ID to unban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for unbanning')
        .setRequired(true)),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason');

    try {
      const banInfo = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (!banInfo) {
        return interaction.reply({ content: `❌ No ban found for user ID \`${userId}\`.`, ephemeral: true });
      }

      await interaction.guild.bans.remove(userId, `${reason} | Moderator: ${interaction.user.tag}`);

      const modCase = createCase({
        userId,
        userTag: banInfo.user.tag || userId,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        actionType: 'UNBAN',
        reason
      });

      const logChannel = interaction.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`🛡️ Case ${modCase.case_id} | User Unbanned`)
          .setColor(CONFIG.COLORS.SUCCESS)
          .addFields(
            { name: 'Target', value: `${banInfo.user.tag} (\`${userId}\`)`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      return interaction.reply({ content: `🔓 Successfully unbanned **${banInfo.user.tag}** (Case \`${modCase.case_id}\`).` });
    } catch (err) {
      return interaction.reply({ content: `❌ Error unbanning: ${err.message}`, ephemeral: true });
    }
  }
};
