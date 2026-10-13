import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType
} from 'discord.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Deploy interactive Button or Select Menu role pickers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('buttons')
        .setDescription('Deploy quick toggle buttons for notifications and squads')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to deploy the role panel to').addChannelTypes(ChannelType.GuildText).setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('menu')
        .setDescription('Deploy a multi-choice dropdown menu for games & interests')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to deploy the dropdown to').addChannelTypes(ChannelType.GuildText).setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (sub === 'buttons') {
      const embed = new EmbedBuilder()
        .setTitle('🎮 CLUB EZKEN • NOTIFICATION & SQUAD ROLES')
        .setColor(CONFIG.COLORS.PRIMARY)
        .setDescription(
          'Click the buttons below to toggle your community roles on and off.\n' +
          'You will receive an instant ephemeral confirmation.\n\n' +
          '🔴 **@Stream Ping** — Instant alerts when YouTube streams or videos go live\n' +
          '🩸 **@Blood Strike Squad** — Squad up for Blood Strike tournaments & ranked matches\n' +
          '⚔️ **@Events Ping** — Community giveaways, scrims, and community game nights\n' +
          '📰 **@Updates** — Major server news, patch notes, and feature drops'
        )
        .setFooter({ text: 'Club EZKEN Interactive Role System • Zero-Lag Buttons' });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('rr_toggle_stream_ping')
          .setLabel('Stream Ping')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔴'),
        new ButtonBuilder()
          .setCustomId('rr_toggle_blood_strike')
          .setLabel('Blood Strike Squad')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🩸'),
        new ButtonBuilder()
          .setCustomId('rr_toggle_events')
          .setLabel('Events & Giveaways')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⚔️'),
        new ButtonBuilder()
          .setCustomId('rr_toggle_announcements')
          .setLabel('Major Updates')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📰')
      );

      await targetChannel.send({ embeds: [embed], components: [row1] });
      return interaction.reply({ content: `✅ Deployed interactive role button panel to ${targetChannel}.`, ephemeral: true });
    }

    if (sub === 'menu') {
      const embed = new EmbedBuilder()
        .setTitle('🎯 CLUB EZKEN • GAMING DIVISION PREFERENCES')
        .setColor(CONFIG.COLORS.PRIMARY)
        .setDescription(
          'Select the games and community divisions you participate in from the dropdown menu below.\n' +
          'Select again to toggle roles.'
        )
        .setFooter({ text: 'Club EZKEN Role Selector' });

      const menu = new StringSelectMenuBuilder()
        .setCustomId('rr_select_games')
        .setPlaceholder('Choose your games and notification preferences...')
        .setMinValues(1)
        .setMaxValues(4)
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Blood Strike')
            .setDescription('Get pinged for Blood Strike custom rooms and squads')
            .setValue('role_game_bloodstrike')
            .setEmoji('🩸'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Call of Duty: Warzone Mobile')
            .setDescription('Battle Royale squad matchmaking')
            .setValue('role_game_codm')
            .setEmoji('🎯'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Content Creator / Streamer')
            .setDescription('Collaborate with fellow EZKEN creators')
            .setValue('role_creator')
            .setEmoji('🎬'),
          new StringSelectMenuOptionBuilder()
            .setLabel('VIP Community Lounge')
            .setDescription('Special social notifications & lounge access')
            .setValue('role_vip_lounge')
            .setEmoji('💎')
        );

      const row = new ActionRowBuilder().addComponents(menu);
      await targetChannel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `✅ Deployed interactive role dropdown menu to ${targetChannel}.`, ephemeral: true });
    }
  }
};
