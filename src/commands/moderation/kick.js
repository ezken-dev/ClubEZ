import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { createCase } from '../../database/db.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from Club EZKEN')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The member to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: '❌ Target member is not in the server.', ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ content: '❌ Unable to kick user. Target has higher or equal permissions.', ephemeral: true });
    }

    try {
      // DM prior to kick
      try {
        const dm = new EmbedBuilder()
          .setTitle(`👞 Kicked from Club EZKEN`)
          .setColor(CONFIG.COLORS.DANGER)
          .setDescription(`You have been removed from **${interaction.guild.name}**.`)
          .addFields({ name: 'Reason', value: reason })
          .setTimestamp();
        await target.send({ embeds: [dm] });
      } catch {}

      await member.kick(`${reason} | Moderator: ${interaction.user.tag}`);

      const modCase = createCase({
        userId: target.id,
        userTag: target.tag || target.username,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag || interaction.user.username,
        actionType: 'KICK',
        reason
      });

      // Audit Log
      const logChannel = interaction.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`🛡️ Case ${modCase.case_id} | Member Kicked`)
          .setColor(CONFIG.COLORS.DANGER)
          .addFields(
            { name: 'Target', value: `${target.tag} (\`${target.id}\`)`, inline: true },
            { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      return interaction.reply({ content: `👞 Successfully kicked **${target.tag}** (Case \`${modCase.case_id}\`).` });
    } catch (err) {
      return interaction.reply({ content: `❌ Error kicking member: ${err.message}`, ephemeral: true });
    }
  }
};
