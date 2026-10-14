import {
  Client,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  GuildMember,
  Interaction,
  CategoryChannel,
  AttachmentBuilder
} from 'discord.js';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'ticket_config.json');
const STORE_PATH = path.join(process.cwd(), 'active_tickets.json');

export interface TicketConfig {
  enabled: boolean;
  openCategoryId: string;
  closedCategoryId: string;
  panelChannelId: string;
  logsChannelId: string;
  supportRoleIds: string[];
  ticketCounter: number;
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
  buttonLabel: string;
  buttonEmoji: string;
  namingScheme: string;
  maxOpenPerUser: number;
  autoTranscript: boolean;
}

export interface TicketRecord {
  ticketId: string;
  channelId: string;
  guildId: string;
  creatorId: string;
  creatorTag: string;
  createdAt: number;
  status: 'OPEN' | 'CLAIMED' | 'CLOSED';
  claimedBy?: { id: string; tag: string };
  closedAt?: number;
  closedBy?: { id: string; tag: string };
  reason?: string;
}

export function loadTicketConfig(): TicketConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (err: any) {
    console.warn('[TICKETS] Failed to load config:', err.message);
  }
  return {
    enabled: true,
    openCategoryId: '',
    closedCategoryId: '',
    panelChannelId: '',
    logsChannelId: '',
    supportRoleIds: [],
    ticketCounter: 0,
    embedTitle: 'Club EZKEN Support System',
    embedDescription: 'Need assistance, have questions regarding your ranks, or want to report an issue?\nClick the button below to open a private ticket with the staff team.',
    embedColor: '#E50914',
    buttonLabel: 'Create Ticket',
    buttonEmoji: '📩',
    namingScheme: 'ticket-{count}',
    maxOpenPerUser: 1,
    autoTranscript: true,
  };
}

export function saveTicketConfig(cfg: TicketConfig) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[TICKETS] Failed to save config:', err.message);
  }
}

export function loadActiveTickets(): TicketRecord[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    }
  } catch (err: any) {
    console.warn('[TICKETS] Failed to load tickets store:', err.message);
  }
  return [];
}

export function saveActiveTickets(list: TicketRecord[]) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[TICKETS] Failed to save tickets store:', err.message);
  }
}

// In-memory ticket registry
export const ticketStore = new Map<string, TicketRecord>();

try {
  loadActiveTickets().forEach((t) => ticketStore.set(t.ticketId, t));
} catch {}

function persistTickets() {
  saveActiveTickets(Array.from(ticketStore.values()));
}

// -----------------------------------------------------------------------------
// Ticket Panel Embed & Button Builders
// -----------------------------------------------------------------------------
export function buildTicketPanelInterface(cfg: TicketConfig) {
  const colorInt = parseInt((cfg.embedColor || '#E50914').replace('#', ''), 16) || 0xE50914;

  const embed = new EmbedBuilder()
    .setTitle(cfg.embedTitle || 'Club EZKEN Support System')
    .setDescription(
      cfg.embedDescription ||
        'Need assistance, have questions regarding your ranks, or want to report an issue?\nClick the button below to open a private ticket with the staff team.'
    )
    .setColor(colorInt)
    .setFooter({ text: 'Club EZKEN Official Ticket Tool • Fast Response Support' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:create')
      .setLabel(cfg.buttonLabel || 'Create Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji(cfg.buttonEmoji || '📩')
  );

  return { embed, components: [row] };
}

export function buildTicketControlRow(ticketId: string) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close:${ticketId}`)
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
    new ButtonBuilder()
      .setCustomId(`ticket:transcript:${ticketId}`)
      .setLabel('Transcript')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📑'),
    new ButtonBuilder()
      .setCustomId(`ticket:claim:${ticketId}`)
      .setLabel('Claim')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId(`ticket:add:${ticketId}`)
      .setLabel('Add Member')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('➕'),
    new ButtonBuilder()
      .setCustomId(`ticket:delete:${ticketId}`)
      .setLabel('Delete')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🗑️')
  );

  return [row];
}

// Helper to generate text transcript from a ticket channel
async function generateChannelTranscript(channel: TextChannel, ticket: TicketRecord): Promise<string> {
  try {
    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
    const sorted = Array.from(fetchedMessages.values()).reverse();

    let text = `============================================================\n`;
    text += `CLUB EZKEN OFFICIAL TICKET TRANSCRIPT\n`;
    text += `Ticket ID: #${ticket.ticketId}\n`;
    text += `Channel: #${channel.name}\n`;
    text += `Owner: ${ticket.creatorTag} (${ticket.creatorId})\n`;
    text += `Created: ${new Date(ticket.createdAt).toLocaleString()}\n`;
    text += `Status: ${ticket.status}\n`;
    if (ticket.claimedBy) text += `Claimed By: ${ticket.claimedBy.tag} (${ticket.claimedBy.id})\n`;
    if (ticket.closedBy) text += `Closed By: ${ticket.closedBy.tag} (${ticket.closedBy.id})\n`;
    text += `============================================================\n\n`;

    for (const msg of sorted) {
      const time = new Date(msg.createdTimestamp).toLocaleTimeString();
      const author = msg.author.tag;
      const content = msg.cleanContent || (msg.attachments.size > 0 ? `[Attachments: ${msg.attachments.size}]` : '');
      text += `[${time}] ${author}: ${content}\n`;
    }

    return text;
  } catch (err: any) {
    return `Error generating transcript: ${err.message}`;
  }
}

// -----------------------------------------------------------------------------
// Interactive Ticket Flow: Create, Claim, Close, Reopen, Transcript, Delete
// -----------------------------------------------------------------------------
export async function handleTicketInteraction(interaction: Interaction, client: Client) {
  // 1. Button Clicks
  if (interaction.isButton() && interaction.customId.startsWith('ticket:')) {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const targetTicketId = parts[2];
    const member = interaction.member as GuildMember;
    const guild = interaction.guild!;
    const cfg = loadTicketConfig();

    // CREATE TICKET ACTION
    if (action === 'create') {
      // Check max open tickets per user
      const userOpenTickets = Array.from(ticketStore.values()).filter(
        (t) => t.creatorId === member.id && t.status !== 'CLOSED'
      );

      if (userOpenTickets.length >= (cfg.maxOpenPerUser || 1)) {
        const existing = userOpenTickets[0];
        await interaction.reply({
          content: `⚠️ You already have an open ticket in <#${existing.channelId}>! Please resolve your existing ticket first.`,
          ephemeral: true,
        });
        return;
      }

      // Increment ticket counter
      cfg.ticketCounter = (cfg.ticketCounter || 0) + 1;
      saveTicketConfig(cfg);

      const ticketNumStr = String(cfg.ticketCounter).padStart(4, '0');
      const channelName = (cfg.namingScheme || 'ticket-{count}')
        .replace('{count}', ticketNumStr)
        .replace('{username}', member.user.username.toLowerCase());

      const parentCategory = cfg.openCategoryId ? guild.channels.cache.get(cfg.openCategoryId) : null;

      // Construct permission overwrites
      const overwrites: any[] = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ];

      // Add support role overwrites
      if (Array.isArray(cfg.supportRoleIds)) {
        for (const roleId of cfg.supportRoleIds) {
          overwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          });
        }
      }

      // Create channel
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parentCategory?.id || null,
        topic: `Support Ticket #${ticketNumStr} • Created by ${member.user.tag}`,
        permissionOverwrites: overwrites,
      });

      // Register ticket
      const newTicket: TicketRecord = {
        ticketId: ticketNumStr,
        channelId: ticketChannel.id,
        guildId: guild.id,
        creatorId: member.id,
        creatorTag: member.user.tag,
        createdAt: Date.now(),
        status: 'OPEN',
      };
      ticketStore.set(ticketNumStr, newTicket);
      persistTickets();

      // Welcome embed in ticket channel
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`Ticket #${ticketNumStr} • Support Request`)
        .setDescription(
          `Welcome <@${member.id}>!\nThank you for reaching out to the Club EZKEN staff team. Please describe your inquiry or issue in detail below.\n\nA team member will assist you shortly.`
        )
        .addFields(
          { name: 'Ticket Owner', value: `<@${member.id}>`, inline: true },
          { name: 'Status', value: '🟢 Open', inline: true },
          { name: 'Staff Claim', value: 'Unclaimed', inline: true }
        )
        .setColor(0xE50914)
        .setFooter({ text: 'Use the buttons below to control this ticket' });

      await ticketChannel.send({
        content: `<@${member.id}> Support Staff Ping`,
        embeds: [welcomeEmbed],
        components: buildTicketControlRow(ticketNumStr),
      });

      await interaction.reply({
        content: `✅ Your ticket has been created: <#${ticketChannel.id}>`,
        ephemeral: true,
      });
      return;
    }

    // Lookup ticket by targetTicketId or channel ID
    let ticket = targetTicketId ? ticketStore.get(targetTicketId) : null;
    if (!ticket) {
      ticket = Array.from(ticketStore.values()).find((t) => t.channelId === interaction.channelId) || null;
    }

    if (!ticket) {
      await interaction.reply({ content: '⚠️ Could not find ticket record for this channel.', ephemeral: true });
      return;
    }

    const channel = guild.channels.cache.get(ticket.channelId) as TextChannel | undefined;
    if (!channel) {
      await interaction.reply({ content: '⚠️ Ticket channel no longer exists.', ephemeral: true });
      return;
    }

    // CLAIM TICKET
    if (action === 'claim') {
      if (ticket.claimedBy) {
        await interaction.reply({
          content: `⚠️ This ticket has already been claimed by **@${ticket.claimedBy.tag}**.`,
          ephemeral: true,
        });
        return;
      }
      ticket.claimedBy = { id: member.id, tag: member.user.tag };
      ticket.status = 'CLAIMED';
      persistTickets();

      await channel.send({
        content: `👤 **Ticket Claimed!** <@${member.id}> will be handling this inquiry.`,
      });
      await interaction.reply({ content: '✅ You have claimed this ticket!', ephemeral: true });
      return;
    }

    // CLOSE INITIATION (Confirm dialog)
    if (action === 'close') {
      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:confirm_close:${ticket.ticketId}`)
          .setLabel('Confirm Close')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`ticket:cancel_close:${ticket.ticketId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );

      await interaction.reply({
        content: '⚠️ Are you sure you want to close this ticket?',
        components: [confirmRow],
        ephemeral: false,
      });
      return;
    }

    // CANCEL CLOSE
    if (action === 'cancel_close') {
      await interaction.message.delete().catch(() => {});
      await interaction.reply({ content: 'Close operation cancelled.', ephemeral: true });
      return;
    }

    // CONFIRM CLOSE
    if (action === 'confirm_close') {
      ticket.status = 'CLOSED';
      ticket.closedAt = Date.now();
      ticket.closedBy = { id: member.id, tag: member.user.tag };
      persistTickets();

      // Lock creator's send perms
      await channel.permissionOverwrites.edit(ticket.creatorId, {
        SendMessages: false,
      }).catch(() => {});

      // Move to closed category if configured
      if (cfg.closedCategoryId) {
        await channel.setParent(cfg.closedCategoryId, { lockPermissions: false }).catch(() => {});
      }

      // Generate Transcript
      const transcriptText = await generateChannelTranscript(channel, ticket);
      const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), {
        name: `transcript-ticket-${ticket.ticketId}.txt`,
      });

      // Post transcript to logs channel if configured
      if (cfg.logsChannelId) {
        const logsChannel = guild.channels.cache.get(cfg.logsChannelId) as TextChannel | undefined;
        if (logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(`Ticket #${ticket.ticketId} Closed & Logged`)
            .setDescription(`**Owner:** <@${ticket.creatorId}>\n**Closed By:** <@${member.id}>`)
            .setColor(0x71717A)
            .setTimestamp();
          await logsChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
        }
      }

      // Closed post embed in ticket channel
      const closedEmbed = new EmbedBuilder()
        .setTitle(`Ticket #${ticket.ticketId} Closed`)
        .setDescription(`Closed by <@${member.id}>.\nA complete transcript has been saved.`)
        .setColor(0x27272A);

      const postClosedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:reopen:${ticket.ticketId}`)
          .setLabel('Reopen')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔓'),
        new ButtonBuilder()
          .setCustomId(`ticket:transcript:${ticket.ticketId}`)
          .setLabel('Transcript')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📑'),
        new ButtonBuilder()
          .setCustomId(`ticket:delete:${ticket.ticketId}`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
      );

      await interaction.message.delete().catch(() => {});
      await channel.send({ embeds: [closedEmbed], components: [postClosedRow], files: [attachment] });
      return;
    }

    // REOPEN TICKET
    if (action === 'reopen') {
      ticket.status = 'OPEN';
      ticket.closedAt = undefined;
      ticket.closedBy = undefined;
      persistTickets();

      // Restore creator's send perms
      await channel.permissionOverwrites.edit(ticket.creatorId, {
        SendMessages: true,
      }).catch(() => {});

      // Move back to open category if configured
      if (cfg.openCategoryId) {
        await channel.setParent(cfg.openCategoryId, { lockPermissions: false }).catch(() => {});
      }

      await channel.send({ content: `🔓 **Ticket Reopened!** Reopened by <@${member.id}>.` });
      await interaction.reply({ content: '✅ Ticket reopened successfully.', ephemeral: true });
      return;
    }

    // ON-DEMAND TRANSCRIPT
    if (action === 'transcript') {
      const transcriptText = await generateChannelTranscript(channel, ticket);
      const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), {
        name: `transcript-ticket-${ticket.ticketId}.txt`,
      });
      await interaction.reply({
        content: `📑 **Ticket Transcript Generated:**`,
        files: [attachment],
        ephemeral: false,
      });
      return;
    }

    // ADD MEMBER MODAL
    if (action === 'add') {
      const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_add:${ticket.ticketId}`)
        .setTitle('Add Member to Ticket');
      const input = new TextInputBuilder()
        .setCustomId('user_input')
        .setLabel('User ID or Username')
        .setPlaceholder('Enter User ID or exact username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // DELETE TICKET
    if (action === 'delete') {
      await interaction.reply({ content: '🗑️ Ticket will be deleted in 5 seconds...', ephemeral: false });
      setTimeout(async () => {
        try {
          await channel.delete().catch(() => {});
          ticketStore.delete(ticket.ticketId);
          persistTickets();
        } catch (err: any) {
          console.warn('[TICKET DELETE ERROR]', err.message);
        }
      }, 5000);
      return;
    }
  }

  // 2. Modal Submissions
  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
    const parts = interaction.customId.split(':');
    const modalType = parts[0].replace('ticket_modal_', '');
    const ticketId = parts[1];
    const guild = interaction.guild!;

    const ticket = ticketStore.get(ticketId);
    if (!ticket) {
      await interaction.reply({ content: '⚠️ Ticket record not found.', ephemeral: true });
      return;
    }

    const channel = guild.channels.cache.get(ticket.channelId) as TextChannel | undefined;
    if (!channel) {
      await interaction.reply({ content: '⚠️ Ticket channel not found.', ephemeral: true });
      return;
    }

    if (modalType === 'add') {
      const rawUser = interaction.fields.getTextInputValue('user_input').trim();
      const targetMember = guild.members.cache.find(
        (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
      );
      if (!targetMember) {
        await interaction.reply({ content: `⚠️ Could not find member "${rawUser}".`, ephemeral: true });
        return;
      }
      await channel.permissionOverwrites.edit(targetMember.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        ReadMessageHistory: true,
      }).catch(() => {});
      await channel.send({ content: `➕ **Member Added:** <@${targetMember.id}> was added to the ticket.` });
      await interaction.reply({ content: `✅ Added **@${targetMember.user.tag}** to this ticket.`, ephemeral: true });
      return;
    }
  }
}

// -----------------------------------------------------------------------------
// Auto-Setup System: 1-Click Ticket System Generator
// -----------------------------------------------------------------------------
export async function autoSetupTickets(client: Client, guildId: string) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Bot is not connected to guild');

  // 1. Create or resolve Open Tickets Category
  let openCategory = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('open tickets')
  ) as CategoryChannel | undefined;

  if (!openCategory) {
    openCategory = await guild.channels.create({
      name: '🎫 OPEN TICKETS',
      type: ChannelType.GuildCategory,
    });
  }

  // 2. Create or resolve Closed Tickets Category
  let closedCategory = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('closed tickets')
  ) as CategoryChannel | undefined;

  if (!closedCategory) {
    closedCategory = await guild.channels.create({
      name: '📁 CLOSED TICKETS',
      type: ChannelType.GuildCategory,
    });
  }

  // 3. Create or resolve Ticket Creation Panel channel
  let panelChannel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && (c.name.includes('create-ticket') || c.name.includes('tickets'))
  ) as TextChannel | undefined;

  if (!panelChannel) {
    panelChannel = await guild.channels.create({
      name: '🎫・create-ticket',
      type: ChannelType.GuildText,
      parent: openCategory.id,
      topic: 'Click the button below to open a private ticket with the staff team.',
    });
  }

  // 4. Create or resolve Ticket Logs channel
  let logsChannel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && (c.name.includes('ticket-logs') || c.name.includes('ticket-transcripts'))
  ) as TextChannel | undefined;

  if (!logsChannel) {
    logsChannel = await guild.channels.create({
      name: '📋・ticket-logs',
      type: ChannelType.GuildText,
      parent: closedCategory.id,
      topic: 'Audits and transcripts for closed support tickets.',
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: client.user!.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
        },
      ],
    });
  }

  // 5. Update Config
  const cfg = loadTicketConfig();
  cfg.openCategoryId = openCategory.id;
  cfg.closedCategoryId = closedCategory.id;
  cfg.panelChannelId = panelChannel.id;
  cfg.logsChannelId = logsChannel.id;
  saveTicketConfig(cfg);

  // 6. Deploy panel into panelChannel
  const { embed, components } = buildTicketPanelInterface(cfg);
  await panelChannel.send({ embeds: [embed], components });

  return {
    success: true,
    openCategoryId: openCategory.id,
    closedCategoryId: closedCategory.id,
    panelChannelId: panelChannel.id,
    logsChannelId: logsChannel.id,
  };
}
