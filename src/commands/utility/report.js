import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { createReport } from '../../database/db.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a rule violation to the Club EZKEN moderation staff')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user who violated server rules')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Detailed explanation of the rule violation')
        .setRequired(true)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot file a report against yourself.', ephemeral: true });
    }

    // 1. Create Report in SQLite
    const report = createReport({
      reporterId: interaction.user.id,
      targetId: targetUser.id,
      reason,
      messageUrl: null
    });

    // 2. Dispatch to #mod-reports
    const reportChannel = interaction.guild.channels.cache.get(CONFIG.CHANNELS.REPORTS);
    if (reportChannel) {
      const embed = new EmbedBuilder()
        .setTitle(`🚨 Moderation Report: ${report.report_id}`)
        .setColor(CONFIG.COLORS.DANGER)
        .addFields(
          { name: 'Reported User', value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
          { name: 'Submitted By', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
          { name: 'Channel', value: `${interaction.channel}`, inline: true },
          { name: 'Reason / Evidence', value: reason }
        )
        .setFooter({ text: 'Status: PENDING REVIEW • Club EZKEN Security' })
        .setTimestamp();

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mod_report_timeout_${report.report_id}_${targetUser.id}`)
          .setLabel('Timeout 1h')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⏳'),
        new ButtonBuilder()
          .setCustomId(`mod_report_ban_${report.report_id}_${targetUser.id}`)
          .setLabel('Ban')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔨'),
        new ButtonBuilder()
          .setCustomId(`mod_report_dismiss_${report.report_id}`)
          .setLabel('Dismiss')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✖️')
      );

      await reportChannel.send({ embeds: [embed], components: [actionRow] });
    }

    return interaction.reply({
      content: `✅ Your report against **${targetUser.tag}** has been securely dispatched to staff (Ticket ID: \`${report.report_id}\`). Thank you for keeping Club EZKEN safe.`,
      ephemeral: true
    });
  }
};
