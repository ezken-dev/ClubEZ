import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { CONFIG } from '../config.js';
import { updateReportStatus, getLeaderboard, createCase } from '../database/db.js';

// Pre-mapped friendly role names for button toggle
const ROLE_NAME_MAPPINGS = {
  'rr_toggle_stream_ping': 'Stream Ping',
  'rr_toggle_blood_strike': 'Blood Strike Squad',
  'rr_toggle_events': 'Events & Giveaways',
  'rr_toggle_announcements': 'Major Updates'
};

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    try {
      // =======================================================================
      // 1. SLASH COMMANDS
      // =======================================================================
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          return interaction.reply({ content: `❌ Unknown command: \`/${interaction.commandName}\``, ephemeral: true });
        }
        await command.execute(interaction);
        return;
      }

      // =======================================================================
      // 2. BUTTON INTERACTIONS
      // =======================================================================
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // A. Interactive Reaction Role Buttons (Zero lag, ephemeral response)
        if (customId.startsWith('rr_toggle_')) {
          const roleName = ROLE_NAME_MAPPINGS[customId] || 'Member Role';
          let role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

          // Auto-create role if it does not exist yet
          if (!role && interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            try {
              role = await interaction.guild.roles.create({
                name: roleName,
                color: customId.includes('stream') ? CONFIG.COLORS.PRIMARY : undefined,
                reason: 'Auto-provisioned by Club EZKEN Reaction Role button'
              });
            } catch (rErr) {
              console.error('[ROLE CREATION ERROR]', rErr.message);
            }
          }

          if (!role) {
            return interaction.reply({ content: `❌ The **@${roleName}** role is not yet set up on this server. Contact an administrator.`, ephemeral: true });
          }

          const hasRole = interaction.member.roles.cache.has(role.id);

          try {
            if (hasRole) {
              await interaction.member.roles.remove(role);
              return interaction.reply({
                content: `🗑️ Removed **@${role.name}** from your profile.`,
                ephemeral: true
              });
            } else {
              await interaction.member.roles.add(role);
              return interaction.reply({
                content: `✅ Added **@${role.name}**! You will now receive alerts for this category.`,
                ephemeral: true
              });
            }
          } catch (roleErr) {
            return interaction.reply({
              content: `❌ Could not modify role: Ensure the bot's highest role is above **@${role.name}**.`,
              ephemeral: true
            });
          }
        }

        // A2. Dynamic Self Role Button (by Role ID)
        if (customId.startsWith('self_role_toggle_') || customId.startsWith('role_toggle_')) {
          const roleId = customId.replace('self_role_toggle_', '').replace('role_toggle_', '');
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) {
            return interaction.reply({ content: '❌ Role not found on this server.', ephemeral: true });
          }

          const hasRole = interaction.member.roles.cache.has(role.id);
          try {
            if (hasRole) {
              await interaction.member.roles.remove(role);
              return interaction.reply({
                content: `🗑️ Removed **@${role.name}** from your profile.`,
                ephemeral: true
              });
            } else {
              await interaction.member.roles.add(role);
              return interaction.reply({
                content: `✅ Added **@${role.name}** to your profile!`,
                ephemeral: true
              });
            }
          } catch (rErr) {
            return interaction.reply({
              content: `❌ Could not modify role: Check bot permissions and hierarchy.`,
              ephemeral: true
            });
          }
        }

        // B. Moderator Triage Action Buttons on Reports / AI Alerts
        if (customId.startsWith('mod_report_')) {
          if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: '⛔ You do not have permission to execute moderation staff actions.', ephemeral: true });
          }

          const parts = customId.split('_');
          const action = parts[2]; // timeout, ban, dismiss
          const reportId = parts[3];
          const targetId = parts[4];

          if (action === 'dismiss') {
            updateReportStatus(reportId, 'DISMISSED', 'Dismissed without punitive action', interaction.user.tag);
            return interaction.update({
              content: `🛡️ **Report ${reportId} Dismissed** by ${interaction.user.tag}.`,
              components: []
            });
          }

          if (action === 'timeout' && targetId) {
            const member = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (member && member.moderatable) {
              await member.timeout(60 * 60 * 1000, `Report triage by ${interaction.user.tag}`);
              createCase({
                userId: targetId,
                userTag: member.user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                actionType: 'MUTE',
                reason: `1h Timeout via Report Triage (${reportId})`,
                duration: 3600
              });
              updateReportStatus(reportId, 'RESOLVED', '1 Hour Timeout Applied', interaction.user.tag);
              return interaction.update({
                content: `⏳ **User Timed Out (1 Hour)** by ${interaction.user.tag} for report \`${reportId}\`.`,
                components: []
              });
            } else {
              return interaction.reply({ content: '❌ Could not timeout user (member left or higher role hierarchy).', ephemeral: true });
            }
          }

          if (action === 'ban' && targetId) {
            try {
              await interaction.guild.bans.create(targetId, { reason: `Report triage by ${interaction.user.tag} (${reportId})` });
              createCase({
                userId: targetId,
                userTag: targetId,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                actionType: 'BAN',
                reason: `Banned via Report Triage (${reportId})`
              });
              updateReportStatus(reportId, 'RESOLVED', 'User Banned', interaction.user.tag);
              return interaction.update({
                content: `🔨 **User Banned** by ${interaction.user.tag} for report \`${reportId}\`.`,
                components: []
              });
            } catch (banErr) {
              return interaction.reply({ content: `❌ Error banning user: ${banErr.message}`, ephemeral: true });
            }
          }
        }

        // C. Leaderboard Refresh Button
        if (customId === 'lb_refresh') {
          const topUsers = getLeaderboard(10);
          const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
          const lines = topUsers.map((u, i) => `${medals[i] || `#${i + 1}`} <@${u.user_id}> — **Level ${u.level}** (${u.xp.toLocaleString()} XP)`);
          const embed = new EmbedBuilder()
            .setTitle('🏆 CLUB EZKEN HALL OF FAME • TOP 10 (LIVE REFRESH)')
            .setColor(CONFIG.COLORS.PRIMARY)
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: 'Refreshed' })
            .setTimestamp();
          return interaction.update({ embeds: [embed] });
        }
      }

      // =======================================================================
      // 3. SELECT MENU INTERACTIONS
      // =======================================================================
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'rr_select_games') {
          const selected = interaction.values;
          return interaction.reply({
            content: `🎯 Updated game preferences! You selected: \`${selected.join(', ')}\``,
            ephemeral: true
          });
        }
      }
    } catch (err) {
      console.error('[INTERACTION ERROR]', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred while executing this interaction.', ephemeral: true }).catch(() => {});
      }
    }
  }
};
