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

    try {
      const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
      const imageBuffer = await renderRankCard({
        username: target.username,
        discriminator: target.discriminator,
        avatarUrl,
        level: rankData.level,
        rank: rankData.rank,
        currentXp: rankData.xp,
        neededXp: rankData.neededXp
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: `rank-${target.id}.png` });

      return interaction.editReply({
        files: [attachment]
      });
    } catch (err) {
      console.error('[COMMAND RANK]', err);
      return interaction.editReply({
        content: `📊 **${target.username}** • Level ${rankData.level} | ${rankData.xp}/${rankData.neededXp} XP (Rank #${rankData.rank})`
      });
    }
  }
};
