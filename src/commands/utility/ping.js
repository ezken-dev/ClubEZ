import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../../config.js';
import db from '../../database/db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check Club EZKEN bot latency, SQLite query performance, and uptime'),

  async execute(interaction) {
    const startDb = performance.now();
    db.prepare('SELECT 1').get();
    const dbLatency = (performance.now() - startDb).toFixed(2);

    const sent = await interaction.reply({ content: 'Pinging Club EZKEN mainframe...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;

    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    const embed = new EmbedBuilder()
      .setTitle('⚡ Club EZKEN Bot Diagnostics')
      .setColor(CONFIG.COLORS.PRIMARY)
      .addFields(
        { name: 'Gateway Latency', value: `\`${wsPing}ms\``, inline: true },
        { name: 'Roundtrip API', value: `\`${roundtrip}ms\``, inline: true },
        { name: 'SQLite WAL Read', value: `\`${dbLatency}ms\``, inline: true },
        { name: 'Process Uptime', value: `\`${hours}h ${minutes}m\``, inline: true },
        { name: 'Memory (RSS)', value: `\`${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB\``, inline: true },
        { name: 'Architecture', value: '`Discord.js v14 + Node.js 18+`', inline: true }
      )
      .setFooter({ text: 'Club EZKEN • Zero-Downtime Infrastructure' })
      .setTimestamp();

    return interaction.editReply({ content: null, embeds: [embed] });
  }
};
