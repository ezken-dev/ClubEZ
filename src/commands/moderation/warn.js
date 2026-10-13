import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { createCase } from '../../database/db.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a guild member and create a moderation case')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => 
      option.setName('target')
        .setDescription('The member to warn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const member = interaction.guild.members.cache.get(target.id);

    if (target.bot) {
      return interaction.reply({ content: '❌ You cannot warn bot accounts.', ephemeral: true });
    }

    if (member && member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ You cannot warn a member with equal or higher role hierarchy.', ephemeral: true });
    }

    // 1. Create SQLite Case
    const modCase = createCase({
      userId: target.id,
      userTag: target.tag || target.username,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag || interaction.user.username,
      actionType: 'WARN',
      reason
    });

    // 2. Try DMing the target
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`⚠️ Warning Received • Club EZKEN`)
        .setColor(CONFIG.COLORS.WARNING)
        .setDescription(`You have received an official warning in **${interaction.guild.name}**.`)
        .addFields(
          { name: 'Case ID', value: `\`${modCase.case_id}\``, inline: true },
          { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();
      await target.send({ embeds: [dmEmbed] });
    } catch {
      // Direct messages might be closed
    }

    // 3. Post Audit Log to #mod-logs
    const logChannel = interaction.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle(`🛡️ Case ${modCase.case_id} | Warning Issued`)
        .setColor(CONFIG.COLORS.WARNING)
        .addFields(
          { name: 'User', value: `${target} (\`${target.id}\`)`, inline: true },
          { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setFooter({ text: 'Club EZKEN Moderation Engine' })
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }

    // 4. Acknowledge in channel
    return interaction.reply({
      content: `✅ Successfully warned **${target.tag || target.username}** (Case \`${modCase.case_id}\`).`,
      ephemeral: false
    });
  }
};
