import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} from 'discord.js';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'ticket_config.json');
const STORE_PATH = path.join(process.cwd(), 'active_tickets.json');

export function loadTicketConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
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

export function saveTicketConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch {}
}

export const ticketStore = new Map();

try {
  if (fs.existsSync(STORE_PATH)) {
    const list = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    list.forEach((t) => ticketStore.set(t.ticketId, t));
  }
} catch {}

function persistTickets() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(Array.from(ticketStore.values()), null, 2), 'utf-8');
  } catch {}
}

export function buildTicketPanelInterface(cfg) {
  const colorInt = parseInt((cfg.embedColor || '#E50914').replace('#', ''), 16) || 0xE50914;

  const embed = new EmbedBuilder()
    .setTitle(cfg.embedTitle || 'Club EZKEN Support System')
    .setDescription(
      cfg.embedDescription ||
        'Need assistance, have questions regarding your ranks, or want to report an issue?\nClick the button below to open a private ticket with the staff team.'
    )
    .setColor(colorInt)
    .setFooter({ text: 'Club EZKEN Official Ticket Tool' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:create')
      .setLabel(cfg.buttonLabel || 'Create Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji(cfg.buttonEmoji || '📩')
  );

  return { embed, components: [row] };
}

export function buildTicketControlRow(ticketId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`).setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId(`ticket:transcript:${ticketId}`).setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📑'),
    new ButtonBuilder().setCustomId(`ticket:claim:${ticketId}`).setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('👤'),
    new ButtonBuilder().setCustomId(`ticket:add:${ticketId}`).setLabel('Add Member').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
    new ButtonBuilder().setCustomId(`ticket:delete:${ticketId}`).setLabel('Delete').setStyle(ButtonStyle.Secondary).setEmoji('🗑️')
  );
  return [row];
}

async function generateChannelTranscript(channel, ticket) {
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
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

export async function handleTicketInteraction(interaction, client) {
  if (interaction.isButton() && interaction.customId.startsWith('ticket:')) {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const targetTicketId = parts[2];
    const member = interaction.member;
    const guild = interaction.guild;
    const cfg = loadTicketConfig();

    if (action === 'create') {
      const userOpenTickets = Array.from(ticketStore.values()).filter(
        (t) => t.creatorId === member.id && t.status !== 'CLOSED'
      );

      if (userOpenTickets.length >= (cfg.maxOpenPerUser || 1)) {
        const existing = userOpenTickets[0];
        return interaction.reply({
          content: `⚠️ You already have an open ticket in <#${existing.channelId}>!`,
          ephemeral: true,
        });
      }

      cfg.ticketCounter = (cfg.ticketCounter || 0) + 1;
      saveTicketConfig(cfg);

      const ticketNumStr = String(cfg.ticketCounter).padStart(4, '0');
      const channelName = (cfg.namingScheme || 'ticket-{count}')
        .replace('{count}', ticketNumStr)
        .replace('{username}', member.user.username.toLowerCase());

      const parentCategory = cfg.openCategoryId ? guild.channels.cache.get(cfg.openCategoryId) : null;

      const overwrites = [
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
          id: client.user.id,
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

      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parentCategory?.id || null,
        topic: `Support Ticket #${ticketNumStr} • Created by ${member.user.tag}`,
        permissionOverwrites: overwrites,
      });

      ticketStore.set(ticketNumStr, {
        ticketId: ticketNumStr,
        channelId: ticketChannel.id,
        guildId: guild.id,
        creatorId: member.id,
        creatorTag: member.user.tag,
        createdAt: Date.now(),
        status: 'OPEN',
      });
      persistTickets();

      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`Ticket #${ticketNumStr} • Support Request`)
        .setDescription(
          `Welcome <@${member.id}>!\nPlease describe your inquiry or issue in detail below. Staff will assist you shortly.`
        )
        .addFields(
          { name: 'Ticket Owner', value: `<@${member.id}>`, inline: true },
          { name: 'Status', value: '🟢 Open', inline: true },
          { name: 'Staff Claim', value: 'Unclaimed', inline: true }
        )
        .setColor(0xE50914)
        .setFooter({ text: 'Use the buttons below to control this ticket' });

      await ticketChannel.send({
        content: `<@${member.id}> Staff Support Ping`,
        embeds: [welcomeEmbed],
        components: buildTicketControlRow(ticketNumStr),
      });

      return interaction.reply({
        content: `✅ Your ticket has been created: <#${ticketChannel.id}>`,
        ephemeral: true,
      });
    }

    let ticket = targetTicketId ? ticketStore.get(targetTicketId) : null;
    if (!ticket) {
      ticket = Array.from(ticketStore.values()).find((t) => t.channelId === interaction.channelId);
    }
    if (!ticket) return interaction.reply({ content: '⚠️ Ticket record not found.', ephemeral: true });

    const channel = guild.channels.cache.get(ticket.channelId);
    if (!channel) return interaction.reply({ content: '⚠️ Channel not found.', ephemeral: true });

    if (action === 'claim') {
      if (ticket.claimedBy) return interaction.reply({ content: `⚠️ Already claimed by @${ticket.claimedBy.tag}.`, ephemeral: true });
      ticket.claimedBy = { id: member.id, tag: member.user.tag };
      ticket.status = 'CLAIMED';
      persistTickets();
      await channel.send({ content: `👤 **Ticket Claimed!** <@${member.id}> is handling this ticket.` });
      return interaction.reply({ content: '✅ Claimed ticket!', ephemeral: true });
    }

    if (action === 'close') {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket:confirm_close:${ticket.ticketId}`).setLabel('Confirm Close').setStyle(ButtonStyle.Danger).setEmoji('✅'),
        new ButtonBuilder().setCustomId(`ticket:cancel_close:${ticket.ticketId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('❌')
      );
      return interaction.reply({ content: '⚠️ Are you sure you want to close this ticket?', components: [confirmRow] });
    }

    if (action === 'cancel_close') {
      await interaction.message.delete().catch(() => {});
      return interaction.reply({ content: 'Cancelled.', ephemeral: true });
    }

    if (action === 'confirm_close') {
      ticket.status = 'CLOSED';
      ticket.closedAt = Date.now();
      ticket.closedBy = { id: member.id, tag: member.user.tag };
      persistTickets();

      await channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: false }).catch(() => {});

      if (cfg.closedCategoryId) {
        await channel.setParent(cfg.closedCategoryId, { lockPermissions: false }).catch(() => {});
      }

      const transcriptText = await generateChannelTranscript(channel, ticket);
      const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), {
        name: `transcript-ticket-${ticket.ticketId}.txt`,
      });

      if (cfg.logsChannelId) {
        const logsChannel = guild.channels.cache.get(cfg.logsChannelId);
        if (logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(`Ticket #${ticket.ticketId} Closed & Logged`)
            .setDescription(`**Owner:** <@${ticket.creatorId}>\n**Closed By:** <@${member.id}>`)
            .setColor(0x71717A)
            .setTimestamp();
          await logsChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
        }
      }

      const closedEmbed = new EmbedBuilder()
        .setTitle(`Ticket #${ticket.ticketId} Closed`)
        .setDescription(`Closed by <@${member.id}>.\nA complete transcript has been saved.`)
        .setColor(0x27272A);

      const postClosedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket:reopen:${ticket.ticketId}`).setLabel('Reopen').setStyle(ButtonStyle.Success).setEmoji('🔓'),
        new ButtonBuilder().setCustomId(`ticket:transcript:${ticket.ticketId}`).setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📑'),
        new ButtonBuilder().setCustomId(`ticket:delete:${ticket.ticketId}`).setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
      );

      await interaction.message.delete().catch(() => {});
      return channel.send({ embeds: [closedEmbed], components: [postClosedRow], files: [attachment] });
    }

    if (action === 'reopen') {
      ticket.status = 'OPEN';
      ticket.closedAt = undefined;
      ticket.closedBy = undefined;
      persistTickets();

      await channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: true }).catch(() => {});
      if (cfg.openCategoryId) await channel.setParent(cfg.openCategoryId, { lockPermissions: false }).catch(() => {});
      await channel.send({ content: `🔓 **Ticket Reopened!** Reopened by <@${member.id}>.` });
      return interaction.reply({ content: '✅ Ticket reopened.', ephemeral: true });
    }

    if (action === 'transcript') {
      const transcriptText = await generateChannelTranscript(channel, ticket);
      const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), {
        name: `transcript-ticket-${ticket.ticketId}.txt`,
      });
      return interaction.reply({ content: `📑 **Ticket Transcript:**`, files: [attachment] });
    }

    if (action === 'add') {
      const modal = new ModalBuilder().setCustomId(`ticket_modal_add:${ticket.ticketId}`).setTitle('Add Member to Ticket');
      const input = new TextInputBuilder().setCustomId('user_input').setLabel('User ID or Username').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (action === 'delete') {
      await interaction.reply({ content: '🗑️ Ticket will be deleted in 5 seconds...' });
      setTimeout(async () => {
        try {
          await channel.delete().catch(() => {});
          ticketStore.delete(ticket.ticketId);
          persistTickets();
        } catch {}
      }, 5000);
      return;
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
    const parts = interaction.customId.split(':');
    const modalType = parts[0].replace('ticket_modal_', '');
    const ticketId = parts[1];
    const guild = interaction.guild;
    const ticket = ticketStore.get(ticketId);
    if (!ticket) return interaction.reply({ content: '⚠️ Ticket record not found.', ephemeral: true });
    const channel = guild.channels.cache.get(ticket.channelId);
    if (!channel) return interaction.reply({ content: '⚠️ Channel not found.', ephemeral: true });

    if (modalType === 'add') {
      const rawUser = interaction.fields.getTextInputValue('user_input').trim();
      const targetMember = guild.members.cache.find(m => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase());
      if (!targetMember) return interaction.reply({ content: `⚠️ Member not found.`, ephemeral: true });
      await channel.permissionOverwrites.edit(targetMember.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        ReadMessageHistory: true,
      }).catch(() => {});
      await channel.send({ content: `➕ **Member Added:** <@${targetMember.id}> was added to the ticket.` });
      return interaction.reply({ content: `✅ Added **@${targetMember.user.tag}** to this ticket.`, ephemeral: true });
    }
  }
}
