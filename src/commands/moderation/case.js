import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getCase, updateCaseReason, getUserCases } from '../../database/db.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('View or edit moderation case details from SQLite')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View details of a specific case by ID (e.g. #0001 or 1)')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('The case ID (e.g. #0001)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('edit')
        .setDescription('Edit the reason for an existing case')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('The case ID to edit (e.g. #0001)')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('The updated reason')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('history')
        .setDescription('View moderation history for a specific user')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The user whose history to look up')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      const inputId = interaction.options.getString('id');
      const modCase = getCase(inputId);

      if (!modCase) {
        return interaction.reply({ content: `❌ Case \`${inputId}\` not found in database.`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Moderation Case ${modCase.case_id}`)
        .setColor(modCase.action_type === 'BAN' ? CONFIG.COLORS.DANGER : CONFIG.COLORS.PRIMARY)
        .addFields(
          { name: 'Target User', value: `${modCase.user_tag} (\`${modCase.user_id}\`)`, inline: true },
          { name: 'Moderator', value: `${modCase.moderator_tag} (\`${modCase.moderator_id}\`)`, inline: true },
          { name: 'Action', value: `\`${modCase.action_type}\``, inline: true },
          { name: 'Reason', value: modCase.reason || 'None provided' },
          { name: 'Date', value: `<t:${Math.floor(modCase.timestamp / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: 'Club EZKEN Case Ledger' });

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'edit') {
      const inputId = interaction.options.getString('id');
      const newReason = interaction.options.getString('reason');

      const updated = updateCaseReason(inputId, newReason, interaction.user.tag);
      if (!updated) {
        return interaction.reply({ content: `❌ Case \`${inputId}\` could not be found to edit.`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`✏️ Case ${updated.case_id} Updated`)
        .setColor(CONFIG.COLORS.SUCCESS)
        .setDescription(`Successfully updated reason for Case **${updated.case_id}**.`)
        .addFields({ name: 'New Reason', value: updated.reason })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'history') {
      const targetUser = interaction.options.getUser('user');
      const cases = getUserCases(targetUser.id);

      if (!cases || cases.length === 0) {
        return interaction.reply({ content: `ℹ️ No moderation infractions found for **${targetUser.tag}**. Clean record!`, ephemeral: true });
      }

      const caseList = cases.slice(0, 10).map(c => 
        `• \`${c.case_id}\` [**${c.action_type}**] - ${c.reason.substring(0, 50)} (<t:${Math.floor(c.timestamp / 1000)}:R>)`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`📜 Mod History: ${targetUser.tag}`)
        .setColor(CONFIG.COLORS.PRIMARY)
        .setDescription(caseList)
        .setFooter({ text: `Total Infractions: ${cases.length}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
