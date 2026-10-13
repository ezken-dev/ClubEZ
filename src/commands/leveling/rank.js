import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUserRankPosition } from '../../database/db.js';
import { renderRankCard } from '../../services/canvasRenderer.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your Club EZKEN level, XP progress, and rank card')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Target member to view rank of')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('user') || interaction.user;
    const rankData = getUserRankPosition(target.id);
    const vcHours = Math.floor((rankData.voice_minutes || 0) / 60);
    const vcMins = (rankData.voice_minutes || 0) % 60;
    const vcFormatted = vcHours > 0 ? `${vcHours}h ${vcMins}m in VC` : `${vcMins}m in VC`;

    try {
      const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
      const imageBuffer = await renderRankCard({
        username: target.username,
        discriminator: target.discriminator,
        avatarUrl,
        level: rankData.level,
        rank: rankData.rank,
        currentXp: rankData.xp,
        neededXp: rankData.neededXp,
        tierRole: rankData.tierRole,
        voiceMinutes: rankData.voice_minutes || 0
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: `rank-${target.id}.png` });

      return interaction.editReply({
        files: [attachment]
      });
    } catch (err) {
      console.error('[COMMAND RANK]', err);
      return interaction.editReply({
        content: `📊 **${target.username}** • Level ${rankData.level} (@${rankData.tierRole}) | ${(rankData.xp || 0).toLocaleString()}/${(rankData.neededXp || 100).toLocaleString()} XP (Rank #${rankData.rank}) • 🎙️ ${vcFormatted}`
      });
    }
  }
};
