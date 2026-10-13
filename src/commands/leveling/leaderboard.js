import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getLeaderboard } from '../../database/db.js';
import { CONFIG, getTierForLevel } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the top 10 ranked members of Club EZKEN with voice & text stats'),

  async execute(interaction) {
    const topUsers = getLeaderboard(10);

    if (!topUsers || topUsers.length === 0) {
      return interaction.reply({ content: '📊 The leaderboard is currently empty. Start chatting or join voice chat to earn XP!', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    const lines = topUsers.map((u, i) => {
      const medal = medals[i] || `#${i + 1}`;
      const tierName = u.tierRole || getTierForLevel(u.level).name;
      const hours = Math.floor((u.voice_minutes || 0) / 60);
      const mins = (u.voice_minutes || 0) % 60;
      const vcText = hours > 0 ? `${hours}h ${mins}m in VC` : `${mins}m in VC`;
      return `${medal} <@${u.user_id}> — **Level ${u.level}** (@${tierName}) • **${(u.xp || 0).toLocaleString()} XP**\n💬 *${(u.total_messages || 0).toLocaleString()} messages • 🎙️ ${vcText}*`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 CLUB EZKEN HALL OF FAME • TOP 10')
      .setColor(CONFIG.COLORS.PRIMARY)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: 'Hard Exponential Leveling: 120 × Level^1.85 • 8 XP/min in VC • 60s Chat Cooldown' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('lb_refresh')
        .setLabel('Refresh Leaderboard')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
