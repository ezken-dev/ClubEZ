import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ChannelType
} from 'discord.js';
import { saveTemplate, getTemplate, listTemplates } from '../../database/db.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create, preview, save, or post custom Club EZKEN rich embeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create and post a branded Club EZKEN embed')
        .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Main message body').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addStringOption(opt => opt.setName('template_name').setDescription('Optional template name to save in SQLite').setRequired(false))
        .addStringOption(opt => opt.setName('color').setDescription('Hex color (default: #E50914)').setRequired(false))
        .addStringOption(opt => opt.setName('banner_url').setDescription('Image banner URL').setRequired(false))
        .addStringOption(opt => opt.setName('thumbnail_url').setDescription('Thumbnail image URL').setRequired(false))
        .addStringOption(opt => opt.setName('button_label').setDescription('Add an interactive link button label').setRequired(false))
        .addStringOption(opt => opt.setName('button_url').setDescription('URL for the interactive button').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('load')
        .setDescription('Load and post a previously saved SQLite embed template')
        .addStringOption(opt => opt.setName('template_name').setDescription('Name of the template').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send to').addChannelTypes(ChannelType.GuildText).setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all saved embed templates in SQLite')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description').replace(/\\n/g, '\n');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      const templateName = interaction.options.getString('template_name');
      const hexColor = interaction.options.getString('color') || CONFIG.COLORS.PRIMARY;
      const bannerUrl = interaction.options.getString('banner_url');
      const thumbnailUrl = interaction.options.getString('thumbnail_url');
      const buttonLabel = interaction.options.getString('button_label');
      const buttonUrl = interaction.options.getString('button_url');

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(hexColor)
        .setFooter({ text: 'Club EZKEN Official Broadcast', iconURL: interaction.guild.iconURL() })
        .setTimestamp();

      if (bannerUrl) embed.setImage(bannerUrl);
      if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

      const components = [];
      if (buttonLabel && buttonUrl) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(buttonLabel)
            .setStyle(ButtonStyle.Link)
            .setURL(buttonUrl)
        );
        components.push(row);
      }

      // Save template if requested
      if (templateName) {
        saveTemplate(templateName, {
          title,
          description,
          color: hexColor,
          bannerUrl,
          thumbnailUrl,
          buttonLabel,
          buttonUrl
        }, interaction.user.tag);
      }

      // Send to target channel
      await targetChannel.send({ embeds: [embed], components });

      return interaction.reply({
        content: `✅ Embed successfully published to ${targetChannel}${templateName ? ` and saved as template \`${templateName}\`` : ''}.`,
        ephemeral: true
      });
    }

    if (sub === 'load') {
      const templateName = interaction.options.getString('template_name');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      const record = getTemplate(templateName);

      if (!record) {
        return interaction.reply({ content: `❌ Template \`${templateName}\` does not exist in SQLite database.`, ephemeral: true });
      }

      const t = record.data;
      const embed = new EmbedBuilder()
        .setTitle(t.title)
        .setDescription(t.description)
        .setColor(t.color || CONFIG.COLORS.PRIMARY)
        .setFooter({ text: 'Club EZKEN Official Broadcast', iconURL: interaction.guild.iconURL() })
        .setTimestamp();

      if (t.bannerUrl) embed.setImage(t.bannerUrl);
      if (t.thumbnailUrl) embed.setThumbnail(t.thumbnailUrl);

      const components = [];
      if (t.buttonLabel && t.buttonUrl) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(t.buttonLabel)
            .setStyle(ButtonStyle.Link)
            .setURL(t.buttonUrl)
        );
        components.push(row);
      }

      await targetChannel.send({ embeds: [embed], components });

      return interaction.reply({ content: `✅ Dispatched saved template \`${templateName}\` to ${targetChannel}.`, ephemeral: true });
    }

    if (sub === 'list') {
      const list = listTemplates();
      if (!list || list.length === 0) {
        return interaction.reply({ content: 'ℹ️ No saved templates found in SQLite database.', ephemeral: true });
      }

      const lines = list.map(t => `• **${t.template_name}** (Saved by ${t.created_by} <t:${Math.floor(t.updated_at / 1000)}:R>)`);
      const embed = new EmbedBuilder()
        .setTitle('📁 Club EZKEN Saved Embed Templates')
        .setColor(CONFIG.COLORS.PRIMARY)
        .setDescription(lines.join('\n'));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
