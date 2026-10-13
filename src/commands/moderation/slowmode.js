import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode rate limit for a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(option =>
      option.setName('seconds')
        .setDescription('Cooldown seconds per user (0 to disable, max 21600)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Target channel (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    try {
      await channel.setRateLimitPerUser(seconds, `Slowmode updated by ${interaction.user.tag}`);
      const text = seconds === 0 
        ? `⚡ Slowmode disabled in ${channel}.` 
        : `⏳ Slowmode in ${channel} set to **${seconds}s** per user.`;
      return interaction.reply({ content: text });
    } catch (err) {
      return interaction.reply({ content: `❌ Failed to set slowmode: ${err.message}`, ephemeral: true });
    }
  }
};
