import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getLeaderboard } from '../../database/db.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the top 10 ranked members of Club EZKEN'),

  async execute(interaction) {
    const topUsers = getLeaderboard(10);

    if (!topUsers || topUsers.length === 0) {
      return interaction.reply({ content: '📊 The leaderboard is currently empty. Start chatting in the server to earn XP!', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    const lines = topUsers.map((u, i) => {
      const medal = medals[i] || `#${i + 1}`;
      const tier = CONFIG.LEVEL_TIERS[u.level] ? `• ${CONFIG.LEVEL_TIERS[u.level].name}` : '';
      return `${medal} <@${u.user_id}> — **Level ${u.level}** (${u.xp.toLocaleString()} XP) ${tier}\n💬 *${u.total_messages || 0} msgs • 🎙️ ${u.voice_minutes || 0}m voice*`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 CLUB EZKEN HALL OF FAME • TOP 10')
      .setColor(CONFIG.COLORS.PRIMARY)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: 'XP Formula: 5(Lvl²) + 50(Lvl) + 100 • 60s Cooldown' })
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
