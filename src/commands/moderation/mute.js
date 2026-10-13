import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { createCase } from '../../database/db.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member for a specified duration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The member to timeout')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)) // 28 days max
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the mute')
        .setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const minutes = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: '❌ Member not found in this guild.', ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: '❌ Cannot timeout this member due to role hierarchy.', ephemeral: true });
    }

    const durationMs = minutes * 60 * 1000;

    try {
      await member.timeout(durationMs, `${reason} | By: ${interaction.user.tag}`);

      const modCase = createCase({
        userId: target.id,
        userTag: target.tag || target.username,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag || interaction.user.username,
        actionType: 'MUTE',
        reason: `${reason} (${minutes}m)`,
        duration: durationMs / 1000
      });

      // Notify target DM
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle(`🔇 Timed Out • Club EZKEN`)
          .setColor(CONFIG.COLORS.PRIMARY)
          .setDescription(`You have been timed out in **${interaction.guild.name}** for **${minutes} minutes**.`)
          .addFields(
            { name: 'Case ID', value: `\`${modCase.case_id}\``, inline: true },
            { name: 'Duration', value: `${minutes}m`, inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        await target.send({ embeds: [dmEmbed] });
      } catch {}

      // Log to #mod-logs
      const logChannel = interaction.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`🛡️ Case ${modCase.case_id} | Member Timed Out`)
          .setColor(CONFIG.COLORS.PRIMARY)
          .addFields(
            { name: 'User', value: `${target} (\`${target.id}\`)`, inline: true },
            { name: 'Duration', value: `${minutes} minute(s)`, inline: true },
            { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
            { name: 'Reason', value: reason, inline: false }
          )
          .setFooter({ text: 'Club EZKEN Moderation Engine' })
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }

      return interaction.reply({
        content: `🤐 **${target.tag || target.username}** has been muted for **${minutes}m** (Case \`${modCase.case_id}\`).`
      });
    } catch (err) {
      console.error('[COMMAND MUTE]', err);
      return interaction.reply({ content: `❌ Error executing timeout: ${err.message}`, ephemeral: true });
    }
  }
};
