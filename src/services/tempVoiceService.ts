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
  VoiceChannel,
  TextChannel,
  GuildMember,
  VoiceState,
  Interaction,
  ModalSubmitInteraction,
  ButtonInteraction,
  CategoryChannel,
  Guild
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(process.cwd(), 'tempvoice_config.json');
const STORE_PATH = path.join(process.cwd(), 'active_temp_vcs.json');

export interface TempVoiceConfig {
  enabled: boolean;
  categoryId: string;
  categoryName: string;
  creatorChannelId: string;
  creatorChannelName: string;
  controlChannelId: string;
  controlChannelName: string;
  defaultNameTemplate: string;
  defaultUserLimit: number;
  defaultLocked: boolean;
  autoDeleteDelaySec: number;
}

export interface ActiveTempVoiceChannel {
  channelId: string;
  guildId: string;
  ownerId: string;
  ownerTag: string;
  name: string;
  userLimit: number;
  isLocked: boolean;
  waitingRoomId?: string;
  isChatHidden?: boolean;
  trustedUsers: string[];
  blockedUsers: string[];
  createdAt: number;
}

export function loadTempVoiceConfig(): TempVoiceConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (err: any) {
    console.warn('[TEMP VOICE] Failed to load config:', err.message);
  }
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

export function saveTempVoiceConfig(cfg: TempVoiceConfig) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[TEMP VOICE] Failed to save config:', err.message);
  }
}

export function loadActiveTempVoiceChannels(): ActiveTempVoiceChannel[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    }
  } catch (err: any) {
    console.warn('[TEMP VOICE] Failed to load active channels:', err.message);
  }
  return [];
}

export function saveActiveTempVoiceChannels(list: ActiveTempVoiceChannel[]) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[TEMP VOICE] Failed to save active channels:', err.message);
  }
}

// In-memory registry
export const activeTempVcs = new Map<string, ActiveTempVoiceChannel>();

// Populate in-memory map
try {
  loadActiveTempVoiceChannels().forEach((item) => activeTempVcs.set(item.channelId, item));
} catch {}

function persistVcs() {
  saveActiveTempVoiceChannels(Array.from(activeTempVcs.values()));
}

// -----------------------------------------------------------------------------
// Visual Embed & 15-Button Layout Matching Screenshots Exactly
// -----------------------------------------------------------------------------
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

  // Row 1: NAME, LIMIT, PRIVACY, WAITING ROOM, CHAT
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('tempvc:name').setLabel('NAME').setStyle(ButtonStyle.Secondary).setEmoji('🔤'),
    new ButtonBuilder().setCustomId('tempvc:limit').setLabel('LIMIT').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
    new ButtonBuilder().setCustomId('tempvc:privacy').setLabel('PRIVACY').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('tempvc:waitingroom').setLabel('WAITING ROOM').setStyle(ButtonStyle.Secondary).setEmoji('🕒'),
    new ButtonBuilder().setCustomId('tempvc:chat').setLabel('CHAT').setStyle(ButtonStyle.Secondary).setEmoji('💬')
  );

  // Row 2: TRUST, UNTRUST, INVITE, KICK, REGION
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('tempvc:trust').setLabel('TRUST').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
    new ButtonBuilder().setCustomId('tempvc:untrust').setLabel('UNTRUST').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
    new ButtonBuilder().setCustomId('tempvc:invite').setLabel('INVITE').setStyle(ButtonStyle.Secondary).setEmoji('📞'),
    new ButtonBuilder().setCustomId('tempvc:kick').setLabel('KICK').setStyle(ButtonStyle.Secondary).setEmoji('🚫'),
    new ButtonBuilder().setCustomId('tempvc:region').setLabel('REGION').setStyle(ButtonStyle.Secondary).setEmoji('🌐')
  );

  // Row 3: BLOCK, UNBLOCK, CLAIM, TRANSFER, DELETE
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('tempvc:block').setLabel('BLOCK').setStyle(ButtonStyle.Secondary).setEmoji('⛔'),
    new ButtonBuilder().setCustomId('tempvc:unblock').setLabel('UNBLOCK').setStyle(ButtonStyle.Secondary).setEmoji('🔓'),
    new ButtonBuilder().setCustomId('tempvc:claim').setLabel('CLAIM').setStyle(ButtonStyle.Secondary).setEmoji('👑'),
    new ButtonBuilder().setCustomId('tempvc:transfer').setLabel('TRANSFER').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
    new ButtonBuilder().setCustomId('tempvc:delete').setLabel('DELETE').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
  );

  return { embed, components: [row1, row2, row3] };
}

// -----------------------------------------------------------------------------
// Voice State Lifecycle: Join Creator -> Spawn VC -> Leave -> Delete
// -----------------------------------------------------------------------------
export async function handleTempVoiceVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
  client: Client
) {
  const config = loadTempVoiceConfig();
  if (!config.enabled) return;

  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  // 1. Check if user joined the Creator Channel (matches either by ID or by name)
  const joinedChannel = newState.channel;
  const isCreatorJoin = newState.channelId && (
    (config.creatorChannelId && newState.channelId === config.creatorChannelId) ||
    (joinedChannel?.name && (
      joinedChannel.name.includes('Creator Channel') ||
      joinedChannel.name.includes('➕') ||
      joinedChannel.name.toLowerCase().includes('creator')
    ))
  );

  if (isCreatorJoin) {
    try {
      const guild = newState.guild;
      // Auto-heal configuration if ID was missing or changed
      if (config.creatorChannelId !== newState.channelId) {
        config.creatorChannelId = newState.channelId!;
        if (joinedChannel?.parentId) config.categoryId = joinedChannel.parentId;
        saveTempVoiceConfig(config);
      }

      const rawTemplate = config.defaultNameTemplate || "{username}'s Channel";
      const channelName = rawTemplate
        .replace('{username}', member.displayName || member.user.username)
        .replace('{tag}', member.user.tag);

      // Category resolution: try config category, fallback to parent of Creator Channel
      const parentCategory = config.categoryId
        ? guild.channels.cache.get(config.categoryId)
        : (joinedChannel?.parentId ? guild.channels.cache.get(joinedChannel.parentId) : null);

      // Create new private voice channel
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
            id: client.user!.id,
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

      // Move the member into their newly spawned personal voice channel
      await member.voice.setChannel(newVc);

      // Track active temp VC
      const record: ActiveTempVoiceChannel = {
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
      };
      activeTempVcs.set(newVc.id, record);
      persistVcs();

      // Post the interactive TempVoice Interface directly into the new VC's built-in text chat!
      const { embed, components } = buildTempVoiceInterface();
      await (newVc as any).send({ embeds: [embed], components }).catch((e: any) => {
        console.warn('[TEMP VOICE] Could not post interface to VC chat:', e.message);
      });

      console.log(`[TEMP VOICE] Created personal VC #${newVc.name} for @${member.user.tag}`);
    } catch (err: any) {
      console.error('[TEMP VOICE CREATE ERROR]', err.message);
    }
  }

  // 2. Check if user left a Temp Voice Channel
  if (oldState.channelId && activeTempVcs.has(oldState.channelId)) {
    const vcRecord = activeTempVcs.get(oldState.channelId);
    if (!vcRecord) return;

    const channel = oldState.guild.channels.cache.get(oldState.channelId) as VoiceChannel | undefined;

    // If channel is completely empty, schedule auto-deletion
    if (channel && channel.members.size === 0) {
      const delay = Math.max(1000, (config.autoDeleteDelaySec || 3) * 1000);
      setTimeout(async () => {
        try {
          // Re-check members
          const currentChannel = oldState.guild.channels.cache.get(vcRecord.channelId) as VoiceChannel | undefined;
          if (currentChannel && currentChannel.members.size === 0) {
            // Delete waiting room if exists
            if (vcRecord.waitingRoomId) {
              const wrChannel = oldState.guild.channels.cache.get(vcRecord.waitingRoomId);
              if (wrChannel) await wrChannel.delete().catch(() => {});
            }
            await currentChannel.delete().catch(() => {});
            activeTempVcs.delete(vcRecord.channelId);
            persistVcs();
            console.log(`[TEMP VOICE] Cleaned up empty channel #${vcRecord.name}`);
          }
        } catch (err: any) {
          console.warn('[TEMP VOICE DELETE ERROR]', err.message);
        }
      }, delay);
    }
  }
}

// -----------------------------------------------------------------------------
// Interactive Discord Button & Modal Handlers for All 15 Controls
// -----------------------------------------------------------------------------
export async function handleTempVoiceInteraction(interaction: Interaction, client: Client) {
  // 1. Button Click Handlers
  if (interaction.isButton() && interaction.customId.startsWith('tempvc:')) {
    const action = interaction.customId.split(':')[1];
    const member = interaction.member as GuildMember;
    if (!member) return;

    // Identify target voice channel:
    // Either the interaction occurred inside the voice channel's chat, OR member is currently inside their temp VC
    let targetRecord: ActiveTempVoiceChannel | undefined;
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

    const guild = interaction.guild!;
    const voiceChannel = guild.channels.cache.get(targetRecord.channelId) as VoiceChannel | undefined;
    if (!voiceChannel) {
      await interaction.reply({ content: '⚠️ Voice channel no longer exists.', ephemeral: true });
      return;
    }

    const isOwner = targetRecord.ownerId === member.id || member.permissions.has(PermissionFlagsBits.Administrator);

    // Specific button execution
    switch (action) {
      // 1. NAME MODAL
      case 'name': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can rename this voice channel.', ephemeral: true });
          return;
        }
        const modal = new ModalBuilder()
          .setCustomId(`tempvc_modal_name:${targetRecord.channelId}`)
          .setTitle('Rename Voice Channel');
        const input = new TextInputBuilder()
          .setCustomId('name_input')
          .setLabel('New Channel Name')
          .setStyle(TextInputStyle.Short)
          .setValue(voiceChannel.name.replace(/^🔒\s*/, ''))
          .setMaxLength(40)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // 2. LIMIT MODAL
      case 'limit': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can set the member limit.', ephemeral: true });
          return;
        }
        const modal = new ModalBuilder()
          .setCustomId(`tempvc_modal_limit:${targetRecord.channelId}`)
          .setTitle('Set Voice Limit');
        const input = new TextInputBuilder()
          .setCustomId('limit_input')
          .setLabel('User Limit (0 = Unlimited)')
          .setStyle(TextInputStyle.Short)
          .setValue(String(voiceChannel.userLimit || 0))
          .setMaxLength(2)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // 3. PRIVACY TOGGLE (LOCK / UNLOCK)
      case 'privacy': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can toggle privacy.', ephemeral: true });
          return;
        }
        const nowLocked = !targetRecord.isLocked;
        targetRecord.isLocked = nowLocked;

        const baseName = voiceChannel.name.replace(/^🔒\s*/, '');
        const newName = nowLocked ? `🔒 ${baseName}` : baseName;

        await voiceChannel.setName(newName).catch(() => {});
        await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, {
          Connect: !nowLocked,
        }).catch(() => {});

        persistVcs();
        await interaction.reply({
          content: nowLocked
            ? '🔒 Channel **Locked**! Only trusted users can connect.'
            : '🔓 Channel **Unlocked**! Anyone can connect now.',
          ephemeral: true,
        });
        return;
      }

      // 4. WAITING ROOM TOGGLE
      case 'waitingroom': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can toggle a waiting room.', ephemeral: true });
          return;
        }

        if (targetRecord.waitingRoomId) {
          const wr = guild.channels.cache.get(targetRecord.waitingRoomId);
          if (wr) await wr.delete().catch(() => {});
          targetRecord.waitingRoomId = undefined;
          persistVcs();
          await interaction.reply({ content: '🕒 Waiting Room has been closed.', ephemeral: true });
        } else {
          const wr = await guild.channels.create({
            name: `🕒 Waiting - ${voiceChannel.name.replace(/^🔒\s*/, '')}`,
            type: ChannelType.GuildVoice,
            parent: voiceChannel.parentId,
            userLimit: 0,
          });
          targetRecord.waitingRoomId = wr.id;
          persistVcs();
          await interaction.reply({
            content: `🕒 Waiting Room created: <#${wr.id}>! Guests can wait there while you decide whom to pull in.`,
            ephemeral: true,
          });
        }
        return;
      }

      // 5. CHAT VISIBILITY TOGGLE
      case 'chat': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can toggle chat visibility.', ephemeral: true });
          return;
        }
        const chatHidden = !targetRecord.isChatHidden;
        targetRecord.isChatHidden = chatHidden;
        await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, {
          SendMessages: !chatHidden,
        }).catch(() => {});
        persistVcs();
        await interaction.reply({
          content: chatHidden ? '💬 Text chat has been muted for guests.' : '💬 Text chat has been enabled for everyone.',
          ephemeral: true,
        });
        return;
      }

      // 6. TRUST USER MODAL
      case 'trust': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can trust members.', ephemeral: true });
          return;
        }
        const modal = new ModalBuilder()
          .setCustomId(`tempvc_modal_trust:${targetRecord.channelId}`)
          .setTitle('Trust Member');
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

      // 7. UNTRUST USER MODAL
      case 'untrust': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can untrust members.', ephemeral: true });
          return;
        }
        const modal = new ModalBuilder()
          .setCustomId(`tempvc_modal_untrust:${targetRecord.channelId}`)
          .setTitle('Untrust Member');
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

      // 8. INVITE LINK
      case 'invite': {
        try {
          const invite = await voiceChannel.createInvite({ maxAge: 600, maxUses: 10 });
          await interaction.reply({
            content: `📞 Instant Voice Invite (Valid 10 mins):\n${invite.url}`,
            ephemeral: true,
          });
        } catch (err: any) {
          await interaction.reply({ content: `⚠️ Could not create invite: ${err.message}`, ephemeral: true });
        }
        return;
      }

      // 9. KICK MEMBER MODAL
      case 'kick': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can kick members.', ephemeral: true });
          return;
        }
        const modal = new ModalBuilder()
          .setCustomId(`tempvc_modal_kick:${targetRecord.channelId}`)
          .setTitle('Kick Member from Voice');
        const input = new TextInputBuilder()
          .setCustomId('user_input')
          .setLabel('Username or User ID to Kick')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // 10. REGION CYCLE
      case 'region': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can change the region.', ephemeral: true });
          return;
        }
        await voiceChannel.setRTCRegion(null).catch(() => {});
        await interaction.reply({
          content: '🌐 Voice RTC region set to **Automatic** (Lowest Latency).',
          ephemeral: true,
        });
        return;
      }

      // 11. BLOCK MEMBER MODAL
      case 'block': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can block members.', ephemeral: true });
          return;
        }
        const modal = new ModalBuilder()
          .setCustomId(`tempvc_modal_block:${targetRecord.channelId}`)
          .setTitle('Block Member from Voice');
        const input = new TextInputBuilder()
          .setCustomId('user_input')
          .setLabel('Username or User ID to Block')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // 12. UNBLOCK MEMBER MODAL
      case 'unblock': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can unblock members.', ephemeral: true });
          return;
        }
        const modal = new ModalBuilder()
          .setCustomId(`tempvc_modal_unblock:${targetRecord.channelId}`)
          .setTitle('Unblock Member');
        const input = new TextInputBuilder()
          .setCustomId('user_input')
          .setLabel('Username or User ID to Unblock')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // 13. CLAIM OWNERSHIP
      case 'claim': {
        const currentOwnerInVc = voiceChannel.members.has(targetRecord.ownerId);
        if (currentOwnerInVc) {
          await interaction.reply({
            content: `⚠️ The channel owner (<@${targetRecord.ownerId}>) is still connected! You cannot claim ownership.`,
            ephemeral: true,
          });
          return;
        }

        // Transfer to clicking user
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

        await interaction.reply({
          content: `👑 **Ownership Claimed!** You are now the official owner of #${voiceChannel.name}.`,
          ephemeral: false,
        });
        return;
      }

      // 14. TRANSFER OWNERSHIP MODAL
      case 'transfer': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can transfer ownership.', ephemeral: true });
          return;
        }
        const modal = new ModalBuilder()
          .setCustomId(`tempvc_modal_transfer:${targetRecord.channelId}`)
          .setTitle('Transfer Channel Ownership');
        const input = new TextInputBuilder()
          .setCustomId('user_input')
          .setLabel('New Owner User ID or Username')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // 15. DELETE VOICE CHANNEL
      case 'delete': {
        if (!isOwner) {
          await interaction.reply({ content: '⛔ Only the channel owner can delete this voice channel.', ephemeral: true });
          return;
        }
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

  // 2. Modal Submission Handlers
  if (interaction.isModalSubmit() && interaction.customId.startsWith('tempvc_modal_')) {
    const parts = interaction.customId.split(':');
    const modalType = parts[0].replace('tempvc_modal_', '');
    const channelId = parts[1];
    const member = interaction.member as GuildMember;

    const targetRecord = activeTempVcs.get(channelId);
    if (!targetRecord) {
      await interaction.reply({ content: '⚠️ Voice channel record not found.', ephemeral: true });
      return;
    }

    const guild = interaction.guild!;
    const voiceChannel = guild.channels.cache.get(channelId) as VoiceChannel | undefined;
    if (!voiceChannel) {
      await interaction.reply({ content: '⚠️ Voice channel no longer exists.', ephemeral: true });
      return;
    }

    switch (modalType) {
      case 'name': {
        const newName = interaction.fields.getTextInputValue('name_input').trim();
        const finalName = targetRecord.isLocked ? `🔒 ${newName}` : newName;
        await voiceChannel.setName(finalName).catch(() => {});
        targetRecord.name = finalName;
        persistVcs();
        await interaction.reply({ content: `✅ Voice channel renamed to **${finalName}**!`, ephemeral: true });
        return;
      }

      case 'limit': {
        const rawLimit = interaction.fields.getTextInputValue('limit_input').trim();
        const limit = Math.max(0, Math.min(99, parseInt(rawLimit) || 0));
        await voiceChannel.setUserLimit(limit).catch(() => {});
        targetRecord.userLimit = limit;
        persistVcs();
        await interaction.reply({
          content: limit === 0 ? '✅ Member limit removed (unlimited).' : `✅ Member limit set to **${limit}**.`,
          ephemeral: true,
        });
        return;
      }

      case 'trust': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `⚠️ Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        await voiceChannel.permissionOverwrites.edit(targetMember.id, {
          Connect: true,
          Speak: true,
          ViewChannel: true,
        }).catch(() => {});
        if (!targetRecord.trustedUsers.includes(targetMember.id)) {
          targetRecord.trustedUsers.push(targetMember.id);
          persistVcs();
        }
        await interaction.reply({ content: `✅ Trusted **@${targetMember.user.tag}**! They can connect anytime.`, ephemeral: true });
        return;
      }

      case 'untrust': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `⚠️ Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        await voiceChannel.permissionOverwrites.delete(targetMember.id).catch(() => {});
        targetRecord.trustedUsers = targetRecord.trustedUsers.filter((id) => id !== targetMember.id);
        persistVcs();
        await interaction.reply({ content: `✅ Untrusted **@${targetMember.user.tag}**.`, ephemeral: true });
        return;
      }

      case 'kick': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = voiceChannel.members.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `⚠️ User is not currently in this voice channel.`, ephemeral: true });
          return;
        }
        await targetMember.voice.disconnect('Disconnected by channel owner').catch(() => {});
        await interaction.reply({ content: `✅ Disconnected **@${targetMember.user.tag}** from voice.`, ephemeral: true });
        return;
      }

      case 'block': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `⚠️ Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        await voiceChannel.permissionOverwrites.edit(targetMember.id, {
          Connect: false,
          ViewChannel: false,
        }).catch(() => {});
        if (targetMember.voice.channelId === voiceChannel.id) {
          await targetMember.voice.disconnect('Blocked by channel owner').catch(() => {});
        }
        if (!targetRecord.blockedUsers.includes(targetMember.id)) {
          targetRecord.blockedUsers.push(targetMember.id);
          persistVcs();
        }
        await interaction.reply({ content: `⛔ Blocked **@${targetMember.user.tag}** from this channel.`, ephemeral: true });
        return;
      }

      case 'unblock': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `⚠️ Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        await voiceChannel.permissionOverwrites.delete(targetMember.id).catch(() => {});
        targetRecord.blockedUsers = targetRecord.blockedUsers.filter((id) => id !== targetMember.id);
        persistVcs();
        await interaction.reply({ content: `🔓 Unblocked **@${targetMember.user.tag}**.`, ephemeral: true });
        return;
      }

      case 'transfer': {
        const rawUser = interaction.fields.getTextInputValue('user_input').trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `⚠️ Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        targetRecord.ownerId = targetMember.id;
        targetRecord.ownerTag = targetMember.user.tag;
        await voiceChannel.permissionOverwrites.edit(targetMember.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true,
          MoveMembers: true,
        }).catch(() => {});
        persistVcs();
        await interaction.reply({ content: `👑 Transferred channel ownership to **@${targetMember.user.tag}**!`, ephemeral: false });
        return;
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Auto-Setup System: 1-Click Category & Channels Creation
// -----------------------------------------------------------------------------
export async function autoSetupTempVoice(client: Client, guildId: string) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Bot is not connected to guild');

  // 1. Create or resolve Category
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('private vc')
  ) as CategoryChannel | undefined;

  if (!category) {
    category = await guild.channels.create({
      name: '🔊 PRIVATE VC CHANNEL',
      type: ChannelType.GuildCategory,
    });
  }

  // 2. Create or resolve Control Text Channel
  let controlChannel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name.toLowerCase().includes('voice-command')
  ) as TextChannel | undefined;

  if (!controlChannel) {
    controlChannel = await guild.channels.create({
      name: '✨・voice-command',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'Temporary Voice Channel control center. Use buttons below to manage your channel.',
    });
  }

  // 3. Create or resolve Join-to-Create Voice Channel
  let creatorChannel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildVoice && c.name.toLowerCase().includes('creator channel')
  ) as VoiceChannel | undefined;

  if (!creatorChannel) {
    creatorChannel = await guild.channels.create({
      name: '➕ Creator Channel',
      type: ChannelType.GuildVoice,
      parent: category.id,
    });
  }

  // 4. Deploy Interface into control channel
  const { embed, components } = buildTempVoiceInterface();
  await controlChannel.send({ embeds: [embed], components });

  // 5. Update config
  const newConfig: TempVoiceConfig = {
    enabled: true,
    categoryId: category.id,
    categoryName: category.name,
    controlChannelId: controlChannel.id,
    controlChannelName: controlChannel.name,
    creatorChannelId: creatorChannel.id,
    creatorChannelName: creatorChannel.name,
    defaultNameTemplate: "{username}'s Channel",
    defaultUserLimit: 0,
    defaultLocked: false,
    autoDeleteDelaySec: 3,
  };

  saveTempVoiceConfig(newConfig);

  return {
    success: true,
    categoryId: category.id,
    controlChannelId: controlChannel.id,
    creatorChannelId: creatorChannel.id,
  };
}
