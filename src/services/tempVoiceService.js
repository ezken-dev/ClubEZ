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
} from 'discord.js';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'tempvoice_config.json');
const STORE_PATH = path.join(process.cwd(), 'active_temp_vcs.json');

export function loadTempVoiceConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {
    enabled: true,
    categoryId: '',
    categoryName: 'PRIVATE VC CHANNEL',
    creatorChannelId: '',
    creatorChannelName: '➕ Creator Channel',
    controlChannelId: '',
    controlChannelName: '✨・voice-command',
    defaultNameTemplate: "{username}'s Channel",
    defaultUserLimit: 0,
    defaultLocked: false,
    autoDeleteDelaySec: 3,
  };
}

export function saveTempVoiceConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch {}
}

export const activeTempVcs = new Map();

try {
  if (fs.existsSync(STORE_PATH)) {
    const list = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    list.forEach((item) => activeTempVcs.set(item.channelId, item));
  }
} catch {}

function persistVcs() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(Array.from(activeTempVcs.values()), null, 2), 'utf-8');
  } catch {}
}

export function buildTempVoiceInterface() {
  const embed = new EmbedBuilder()
    .setTitle('TempVoice Interface')
    .setDescription(
      'This **interface** can be used to manage temporary voice channels.\nMore options are available with **/voice** commands.\n\n' +
      '`🔤 NAME` `👥 LIMIT` `🔒 PRIVACY` `🕒 WAITING ROOM` `💬 CHAT`\n' +
      '`👤 TRUST` `👥 UNTRUST` `📞 INVITE` `🚫 KICK` `🌐 REGION`\n' +
      '`⛔ BLOCK` `🔓 UNBLOCK` `👑 CLAIM` `🔄 TRANSFER` `🗑️ DELETE`\n\n' +
      'Press the buttons below to use the interface'
    )
    .setColor(0xE50914);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tempvc:name').setLabel('NAME').setStyle(ButtonStyle.Secondary).setEmoji('🔤'),
    new ButtonBuilder().setCustomId('tempvc:limit').setLabel('LIMIT').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
    new ButtonBuilder().setCustomId('tempvc:privacy').setLabel('PRIVACY').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('tempvc:waitingroom').setLabel('WAITING ROOM').setStyle(ButtonStyle.Secondary).setEmoji('🕒'),
    new ButtonBuilder().setCustomId('tempvc:chat').setLabel('CHAT').setStyle(ButtonStyle.Secondary).setEmoji('💬')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tempvc:trust').setLabel('TRUST').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
    new ButtonBuilder().setCustomId('tempvc:untrust').setLabel('UNTRUST').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
    new ButtonBuilder().setCustomId('tempvc:invite').setLabel('INVITE').setStyle(ButtonStyle.Secondary).setEmoji('📞'),
    new ButtonBuilder().setCustomId('tempvc:kick').setLabel('KICK').setStyle(ButtonStyle.Secondary).setEmoji('🚫'),
    new ButtonBuilder().setCustomId('tempvc:region').setLabel('REGION').setStyle(ButtonStyle.Secondary).setEmoji('🌐')
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tempvc:block').setLabel('BLOCK').setStyle(ButtonStyle.Secondary).setEmoji('⛔'),
    new ButtonBuilder().setCustomId('tempvc:unblock').setLabel('UNBLOCK').setStyle(ButtonStyle.Secondary).setEmoji('🔓'),
    new ButtonBuilder().setCustomId('tempvc:claim').setLabel('CLAIM').setStyle(ButtonStyle.Secondary).setEmoji('👑'),
    new ButtonBuilder().setCustomId('tempvc:transfer').setLabel('TRANSFER').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
    new ButtonBuilder().setCustomId('tempvc:delete').setLabel('DELETE').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
  );

  return { embed, components: [row1, row2, row3] };
}

export async function autoSetupTempVoice(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const config = loadTempVoiceConfig();

  // Create or find the category
  let category = config.categoryId ? guild.channels.cache.get(config.categoryId) : null;
  if (!category || category.type !== ChannelType.GuildCategory) {
    category = await guild.channels.create({
      name: config.categoryName || 'PRIVATE VC CHANNEL',
      type: ChannelType.GuildCategory,
    });
    config.categoryId = category.id;
  }

  // Create or find the creator (join) channel
  let creatorChannel = config.creatorChannelId ? guild.channels.cache.get(config.creatorChannelId) : null;
  if (!creatorChannel || creatorChannel.type !== ChannelType.GuildVoice) {
    creatorChannel = await guild.channels.create({
      name: config.creatorChannelName || '➕ Creator Channel',
      type: ChannelType.GuildVoice,
      parent: category.id,
    });
    config.creatorChannelId = creatorChannel.id;
  }

  // Create or find the control text channel for the interface
  let controlChannel = config.controlChannelId ? guild.channels.cache.get(config.controlChannelId) : null;
  if (!controlChannel || controlChannel.type !== ChannelType.GuildText) {
    controlChannel = await guild.channels.create({
      name: config.controlChannelName || '✨・voice-command',
      type: ChannelType.GuildText,
      parent: category.id,
    });
    config.controlChannelId = controlChannel.id;
  }

  config.enabled = true;
  saveTempVoiceConfig(config);

  // Deploy the interface in the control channel
  const { embed, components } = buildTempVoiceInterface();
  await controlChannel.send({ embeds: [embed], components }).catch(() => {});

  return {
    success: true,
    categoryId: category.id,
    creatorChannelId: creatorChannel.id,
    controlChannelId: controlChannel.id,
    message: `TempVoice system set up: Category "${category.name}", Creator VC, and Control Channel in #${controlChannel.name}`,
  };
}

export async function handleTempVoiceVoiceStateUpdate(oldState, newState, client) {
  const config = loadTempVoiceConfig();
  if (!config.enabled) return;

  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  // 1. Join Creator Channel
  if (newState.channelId && newState.channelId === config.creatorChannelId) {
    try {
      const guild = newState.guild;
      const rawTemplate = config.defaultNameTemplate || "{username}'s Channel";
      const channelName = rawTemplate
        .replace('{username}', member.displayName || member.user.username)
        .replace('{tag}', member.user.tag);

      const parentCategory = config.categoryId ? guild.channels.cache.get(config.categoryId) : null;

      const newVc = await guild.channels.create({
        name: config.defaultLocked ? `🔒 ${channelName}` : channelName,
        type: ChannelType.GuildVoice,
        parent: parentCategory?.id || null,
        userLimit: config.defaultUserLimit || 0,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel],
            deny: config.defaultLocked ? [PermissionFlagsBits.Connect] : [],
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.MuteMembers,
              PermissionFlagsBits.DeafenMembers,
              PermissionFlagsBits.SendMessages,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
        ],
      });

      await member.voice.setChannel(newVc);

      activeTempVcs.set(newVc.id, {
        channelId: newVc.id,
        guildId: guild.id,
        ownerId: member.id,
        ownerTag: member.user.tag,
        name: newVc.name,
        userLimit: config.defaultUserLimit || 0,
        isLocked: config.defaultLocked,
        trustedUsers: [],
        blockedUsers: [],
        createdAt: Date.now(),
      });
      persistVcs();

      const { embed, components } = buildTempVoiceInterface();
      await newVc.send({ embeds: [embed], components }).catch(() => {});
    } catch (err) {
      console.error('[TEMP VOICE ERROR]', err.message);
    }
  }

  // 2. Leave Voice Channel
  if (oldState.channelId && activeTempVcs.has(oldState.channelId)) {
    const vcRecord = activeTempVcs.get(oldState.channelId);
    const channel = oldState.guild.channels.cache.get(oldState.channelId);

    if (channel && channel.members.size === 0) {
      const delay = Math.max(1000, (config.autoDeleteDelaySec || 3) * 1000);
      setTimeout(async () => {
        try {
          const currentChannel = oldState.guild.channels.cache.get(vcRecord.channelId);
          if (currentChannel && currentChannel.members.size === 0) {
            if (vcRecord.waitingRoomId) {
              const wr = oldState.guild.channels.cache.get(vcRecord.waitingRoomId);
              if (wr) await wr.delete().catch(() => {});
            }
            await currentChannel.delete().catch(() => {});
            activeTempVcs.delete(vcRecord.channelId);
            persistVcs();
          }
        } catch {}
      }, delay);
    }
  }
}

export async function handleTempVoiceInteraction(interaction, client) {
  if (interaction.isButton() && interaction.customId.startsWith('tempvc:')) {
    const action = interaction.customId.split(':')[1];
    const member = interaction.member;
    if (!member) return;

    let targetRecord;
    if (activeTempVcs.has(interaction.channelId)) {
      targetRecord = activeTempVcs.get(interaction.channelId);
    } else if (member.voice?.channelId && activeTempVcs.has(member.voice.channelId)) {
      targetRecord = activeTempVcs.get(member.voice.channelId);
    }

    if (!targetRecord) {
      await interaction.reply({
        content: '⚠️ You must be connected to an active temporary voice channel to use these controls.',
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    const voiceChannel = guild.channels.cache.get(targetRecord.channelId);
    if (!voiceChannel) {
      await interaction.reply({ content: '⚠️ Voice channel no longer exists.', ephemeral: true });
      return;
    }

    const isOwner = targetRecord.ownerId === member.id || member.permissions.has(PermissionFlagsBits.Administrator);

    switch (action) {
      case 'name': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can rename this voice channel.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_name:${targetRecord.channelId}`).setTitle('Rename Voice Channel');
        const input = new TextInputBuilder().setCustomId('name_input').setLabel('New Channel Name').setStyle(TextInputStyle.Short).setValue(voiceChannel.name.replace(/^🔒\s*/, '')).setMaxLength(40).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'limit': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can set the member limit.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_limit:${targetRecord.channelId}`).setTitle('Set Voice Limit');
        const input = new TextInputBuilder().setCustomId('limit_input').setLabel('User Limit (0 = Unlimited)').setStyle(TextInputStyle.Short).setValue(String(voiceChannel.userLimit || 0)).setMaxLength(2).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'privacy': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can toggle privacy.', ephemeral: true });
        const nowLocked = !targetRecord.isLocked;
        targetRecord.isLocked = nowLocked;
        const baseName = voiceChannel.name.replace(/^🔒\s*/, '');
        await voiceChannel.setName(nowLocked ? `🔒 ${baseName}` : baseName).catch(() => {});
        await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, { Connect: !nowLocked }).catch(() => {});
        persistVcs();
        return interaction.reply({ content: nowLocked ? '🔒 Channel **Locked**!' : '🔓 Channel **Unlocked**!', ephemeral: true });
      }
      case 'waitingroom': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can toggle waiting room.', ephemeral: true });
        if (targetRecord.waitingRoomId) {
          const wr = guild.channels.cache.get(targetRecord.waitingRoomId);
          if (wr) await wr.delete().catch(() => {});
          targetRecord.waitingRoomId = undefined;
          persistVcs();
          return interaction.reply({ content: '🕒 Waiting Room closed.', ephemeral: true });
        } else {
          const wr = await guild.channels.create({
            name: `🕒 Waiting - ${voiceChannel.name.replace(/^🔒\s*/, '')}`,
            type: ChannelType.GuildVoice,
            parent: voiceChannel.parentId,
          });
          targetRecord.waitingRoomId = wr.id;
          persistVcs();
          return interaction.reply({ content: `🕒 Waiting Room created: <#${wr.id}>`, ephemeral: true });
        }
      }
      case 'chat': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can toggle chat visibility.', ephemeral: true });
        const chatHidden = !targetRecord.isChatHidden;
        targetRecord.isChatHidden = chatHidden;
        await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, { SendMessages: !chatHidden }).catch(() => {});
        persistVcs();
        return interaction.reply({ content: chatHidden ? '💬 Text chat muted for guests.' : '💬 Text chat unmuted.', ephemeral: true });
      }
      case 'trust': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can trust members.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_trust:${targetRecord.channelId}`).setTitle('Trust Member');
        const input = new TextInputBuilder().setCustomId('user_input').setLabel('User ID or Username').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'untrust': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can untrust members.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_untrust:${targetRecord.channelId}`).setTitle('Untrust Member');
        const input = new TextInputBuilder().setCustomId('user_input').setLabel('User ID or Username').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'invite': {
        const invite = await voiceChannel.createInvite({ maxAge: 600, maxUses: 10 });
        return interaction.reply({ content: `📞 Instant Voice Invite (Valid 10 mins):\n${invite.url}`, ephemeral: true });
      }
      case 'kick': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can kick members.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_kick:${targetRecord.channelId}`).setTitle('Kick Member from Voice');
        const input = new TextInputBuilder().setCustomId('user_input').setLabel('Username or User ID to Kick').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'region': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can change the region.', ephemeral: true });
        await voiceChannel.setRTCRegion(null).catch(() => {});
        return interaction.reply({ content: '🌐 Voice RTC region set to **Automatic**.', ephemeral: true });
      }
      case 'block': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can block members.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_block:${targetRecord.channelId}`).setTitle('Block Member from Voice');
        const input = new TextInputBuilder().setCustomId('user_input').setLabel('Username or User ID to Block').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'unblock': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can unblock members.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_unblock:${targetRecord.channelId}`).setTitle('Unblock Member');
        const input = new TextInputBuilder().setCustomId('user_input').setLabel('Username or User ID to Unblock').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'claim': {
        const currentOwnerInVc = voiceChannel.members.has(targetRecord.ownerId);
        if (currentOwnerInVc) return interaction.reply({ content: `⚠️ Channel owner is still connected!`, ephemeral: true });
        targetRecord.ownerId = member.id;
        targetRecord.ownerTag = member.user.tag;
        await voiceChannel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true,
          MoveMembers: true,
        }).catch(() => {});
        persistVcs();
        return interaction.reply({ content: `👑 **Ownership Claimed!** You are now the owner.`, ephemeral: false });
      }
      case 'transfer': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can transfer ownership.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_transfer:${targetRecord.channelId}`).setTitle('Transfer Channel Ownership');
        const input = new TextInputBuilder().setCustomId('user_input').setLabel('New Owner User ID or Username').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'delete': {
        if (!isOwner) return interaction.reply({ content: '⛔ Only the channel owner can delete this voice channel.', ephemeral: true });
        await interaction.reply({ content: '🗑️ Deleting temporary voice channel...', ephemeral: true });
        if (targetRecord.waitingRoomId) {
          const wr = guild.channels.cache.get(targetRecord.waitingRoomId);
          if (wr) await wr.delete().catch(() => {});
        }
        await voiceChannel.delete().catch(() => {});
        activeTempVcs.delete(targetRecord.channelId);
        persistVcs();
        return;
      }
    }
  }

  // Modal Submissions
  if (interaction.isModalSubmit() && interaction.customId.startsWith('tempvc_modal_')) {
    const parts = interaction.customId.split(':');
    const modalType = parts[0].replace('tempvc_modal_', '');
    const channelId = parts[1];
    const targetRecord = activeTempVcs.get(channelId);
    if (!targetRecord) return interaction.reply({ content: '⚠️ Voice channel record not found.', ephemeral: true });

    const guild = interaction.guild;
    const voiceChannel = guild.channels.cache.get(channelId);
    if (!voiceChannel) return interaction.reply({ content: '⚠️ Voice channel no longer exists.', ephemeral: true });

    switch (modalType) {
      case 'name': {
        const newName = interaction.fields.getTextInputValue('name_input').trim();
        const finalName = targetRecord.isLocked ? `🔒 ${newName}` : newName;
        await voiceChannel.setName(finalName).catch(() => {});
        targetRecord.name = finalName;
        persistVcs();
        return interaction.reply({ content: `✅ Voice channel renamed to **${finalName}**!`, ephemeral: true });
      }
      case 'limit': {
        const rawLimit = interaction.fields.getTextInputValue('limit_input').trim();
        const limit = Math.max(0, Math.min(99, parseInt(rawLimit) || 0));
        await voiceChannel.setUserLimit(limit).catch(() => {});
        targetRecord.userLimit = limit;
        persistVcs();
        return interaction.reply({ content: `✅ Member limit set to **${limit === 0 ? 'Unlimited' : limit}**.`, ephemeral: true });
      }
      case 'trust': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(m => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase());
        if (!targetMember) return interaction.reply({ content: `⚠️ Member not found.`, ephemeral: true });
        await voiceChannel.permissionOverwrites.edit(targetMember.id, { Connect: true, Speak: true, ViewChannel: true }).catch(() => {});
        return interaction.reply({ content: `✅ Trusted **@${targetMember.user.tag}**!`, ephemeral: true });
      }
      case 'untrust': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(m => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase());
        if (!targetMember) return interaction.reply({ content: `⚠️ Member not found.`, ephemeral: true });
        await voiceChannel.permissionOverwrites.delete(targetMember.id).catch(() => {});
        return interaction.reply({ content: `✅ Untrusted **@${targetMember.user.tag}**.`, ephemeral: true });
      }
      case 'kick': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = voiceChannel.members.find(m => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase());
        if (!targetMember) return interaction.reply({ content: `⚠️ User is not in this voice channel.`, ephemeral: true });
        await targetMember.voice.disconnect('Kicked by channel owner').catch(() => {});
        return interaction.reply({ content: `✅ Disconnected **@${targetMember.user.tag}**.`, ephemeral: true });
      }
      case 'block': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(m => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase());
        if (!targetMember) return interaction.reply({ content: `⚠️ Member not found.`, ephemeral: true });
        await voiceChannel.permissionOverwrites.edit(targetMember.id, { Connect: false, ViewChannel: false }).catch(() => {});
        if (targetMember.voice.channelId === voiceChannel.id) await targetMember.voice.disconnect('Blocked').catch(() => {});
        return interaction.reply({ content: `⛔ Blocked **@${targetMember.user.tag}**.`, ephemeral: true });
      }
      case 'unblock': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(m => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase());
        if (!targetMember) return interaction.reply({ content: `⚠️ Member not found.`, ephemeral: true });
        await voiceChannel.permissionOverwrites.delete(targetMember.id).catch(() => {});
        return interaction.reply({ content: `🔓 Unblocked **@${targetMember.user.tag}**.`, ephemeral: true });
      }
      case 'transfer': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(m => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase());
        if (!targetMember) return interaction.reply({ content: `⚠️ Member not found.`, ephemeral: true });
        targetRecord.ownerId = targetMember.id;
        targetRecord.ownerTag = targetMember.user.tag;
        await voiceChannel.permissionOverwrites.edit(targetMember.id, { ViewChannel: true, Connect: true, Speak: true, ManageChannels: true, MoveMembers: true }).catch(() => {});
        persistVcs();
        return interaction.reply({ content: `👑 Transferred channel ownership to **@${targetMember.user.tag}**!`, ephemeral: false });
      }
    }
  }
}
