import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { createCase } from '../../database/db.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from Club EZKEN')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Days of message history to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ content: '❌ Unable to ban target user due to hierarchy.', ephemeral: true });
    }

    try {
      // DM prior to ban
      try {
        const dm = new EmbedBuilder()
          .setTitle(`🔨 Banned from Club EZKEN`)
          .setColor(CONFIG.COLORS.DANGER)
          .setDescription(`You have been permanently banned from **${interaction.guild.name}**.`)
          .addFields({ name: 'Reason', value: reason })
          .setTimestamp();
        await target.send({ embeds: [dm] });
      } catch {}

      await interaction.guild.bans.create(target.id, {
        reason: `${reason} | By: ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400
      });

      const modCase = createCase({
        userId: target.id,
        userTag: target.tag || target.username,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag || interaction.user.username,
        actionType: 'BAN',
        reason
      });

      // Audit Log
      const logChannel = interaction.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`🛡️ Case ${modCase.case_id} | User Banned`)
          .setColor(CONFIG.COLORS.DANGER)
          .addFields(
            { name: 'Target', value: `${target.tag} (\`${target.id}\`)`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      return interaction.reply({ content: `🔨 **${target.tag}** was banned from the server (Case \`${modCase.case_id}\`).` });
    } catch (err) {
      return interaction.reply({ content: `❌ Error banning user: ${err.message}`, ephemeral: true });
    }
  }
};
