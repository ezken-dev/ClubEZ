// server.ts
import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import {
  Client as Client3,
  GatewayIntentBits,
  Events,
  AttachmentBuilder as AttachmentBuilder2,
  Partials,
  EmbedBuilder as EmbedBuilder3,
  PermissionFlagsBits as PermissionFlagsBits3,
  ChannelType as ChannelType3,
  ActionRowBuilder as ActionRowBuilder3,
  ButtonBuilder as ButtonBuilder3,
  ButtonStyle as ButtonStyle3
} from "discord.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import dotenv from "dotenv";
import path3 from "path";
import fs3 from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
import JSZip from "jszip";
import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  entersState
} from "@discordjs/voice";
import * as play from "play-dl";
import ffmpegStatic from "ffmpeg-static";
import YouTube from "youtube-sr";
import { Ytdl } from "@distube/ytdl-core";

// src/services/tempVoiceService.ts
import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var CONFIG_PATH = path.join(process.cwd(), "tempvoice_config.json");
var STORE_PATH = path.join(process.cwd(), "active_temp_vcs.json");
function loadTempVoiceConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch (err) {
    console.warn("[TEMP VOICE] Failed to load config:", err.message);
  }
  return {
    enabled: true,
    categoryId: "",
    categoryName: "PRIVATE VC CHANNEL",
    creatorChannelId: "",
    creatorChannelName: "\u2795 Creator Channel",
    controlChannelId: "",
    controlChannelName: "\u2728\u30FBvoice-command",
    defaultNameTemplate: "{username}'s Channel",
    defaultUserLimit: 0,
    defaultLocked: false,
    autoDeleteDelaySec: 3
  };
}
function saveTempVoiceConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (err) {
    console.error("[TEMP VOICE] Failed to save config:", err.message);
  }
}
function loadActiveTempVoiceChannels() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
    }
  } catch (err) {
    console.warn("[TEMP VOICE] Failed to load active channels:", err.message);
  }
  return [];
}
function saveActiveTempVoiceChannels(list) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[TEMP VOICE] Failed to save active channels:", err.message);
  }
}
var activeTempVcs = /* @__PURE__ */ new Map();
try {
  loadActiveTempVoiceChannels().forEach((item) => activeTempVcs.set(item.channelId, item));
} catch {
}
function persistVcs() {
  saveActiveTempVoiceChannels(Array.from(activeTempVcs.values()));
}
function buildTempVoiceInterface() {
  const embed = new EmbedBuilder().setTitle("TempVoice Interface").setDescription(
    "This **interface** can be used to manage temporary voice channels.\nMore options are available with **/voice** commands.\n\n`\u{1F524} NAME` `\u{1F465} LIMIT` `\u{1F512} PRIVACY` `\u{1F552} WAITING ROOM` `\u{1F4AC} CHAT`\n`\u{1F464} TRUST` `\u{1F465} UNTRUST` `\u{1F4DE} INVITE` `\u{1F6AB} KICK` `\u{1F310} REGION`\n`\u26D4 BLOCK` `\u{1F513} UNBLOCK` `\u{1F451} CLAIM` `\u{1F504} TRANSFER` `\u{1F5D1}\uFE0F DELETE`\n\nPress the buttons below to use the interface"
  ).setColor(15010068);
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("tempvc:name").setLabel("NAME").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F524}"),
    new ButtonBuilder().setCustomId("tempvc:limit").setLabel("LIMIT").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F465}"),
    new ButtonBuilder().setCustomId("tempvc:privacy").setLabel("PRIVACY").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F512}"),
    new ButtonBuilder().setCustomId("tempvc:waitingroom").setLabel("WAITING ROOM").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F552}"),
    new ButtonBuilder().setCustomId("tempvc:chat").setLabel("CHAT").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F4AC}")
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("tempvc:trust").setLabel("TRUST").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F464}"),
    new ButtonBuilder().setCustomId("tempvc:untrust").setLabel("UNTRUST").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F465}"),
    new ButtonBuilder().setCustomId("tempvc:invite").setLabel("INVITE").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F4DE}"),
    new ButtonBuilder().setCustomId("tempvc:kick").setLabel("KICK").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F6AB}"),
    new ButtonBuilder().setCustomId("tempvc:region").setLabel("REGION").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F310}")
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("tempvc:block").setLabel("BLOCK").setStyle(ButtonStyle.Secondary).setEmoji("\u26D4"),
    new ButtonBuilder().setCustomId("tempvc:unblock").setLabel("UNBLOCK").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F513}"),
    new ButtonBuilder().setCustomId("tempvc:claim").setLabel("CLAIM").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F451}"),
    new ButtonBuilder().setCustomId("tempvc:transfer").setLabel("TRANSFER").setStyle(ButtonStyle.Secondary).setEmoji("\u{1F504}"),
    new ButtonBuilder().setCustomId("tempvc:delete").setLabel("DELETE").setStyle(ButtonStyle.Danger).setEmoji("\u{1F5D1}\uFE0F")
  );
  return { embed, components: [row1, row2, row3] };
}
async function handleTempVoiceVoiceStateUpdate(oldState, newState, client) {
  const config = loadTempVoiceConfig();
  if (!config.enabled) return;
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;
  const joinedChannel = newState.channel;
  const isCreatorJoin = newState.channelId && (config.creatorChannelId && newState.channelId === config.creatorChannelId || joinedChannel?.name && (joinedChannel.name.includes("Creator Channel") || joinedChannel.name.includes("\u2795") || joinedChannel.name.toLowerCase().includes("creator")));
  if (isCreatorJoin) {
    try {
      const guild = newState.guild;
      if (config.creatorChannelId !== newState.channelId) {
        config.creatorChannelId = newState.channelId;
        if (joinedChannel?.parentId) config.categoryId = joinedChannel.parentId;
        saveTempVoiceConfig(config);
      }
      const rawTemplate = config.defaultNameTemplate || "{username}'s Channel";
      const channelName = rawTemplate.replace("{username}", member.displayName || member.user.username).replace("{tag}", member.user.tag);
      const parentCategory = config.categoryId ? guild.channels.cache.get(config.categoryId) : joinedChannel?.parentId ? guild.channels.cache.get(joinedChannel.parentId) : null;
      const newVc = await guild.channels.create({
        name: config.defaultLocked ? `\u{1F512} ${channelName}` : channelName,
        type: ChannelType.GuildVoice,
        parent: parentCategory?.id || null,
        userLimit: config.defaultUserLimit || 0,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel],
            deny: config.defaultLocked ? [PermissionFlagsBits.Connect] : []
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
              PermissionFlagsBits.SendMessages
            ]
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
              PermissionFlagsBits.EmbedLinks
            ]
          }
        ]
      });
      await member.voice.setChannel(newVc);
      const record = {
        channelId: newVc.id,
        guildId: guild.id,
        ownerId: member.id,
        ownerTag: member.user.tag,
        name: newVc.name,
        userLimit: config.defaultUserLimit || 0,
        isLocked: config.defaultLocked,
        trustedUsers: [],
        blockedUsers: [],
        createdAt: Date.now()
      };
      activeTempVcs.set(newVc.id, record);
      persistVcs();
      const { embed, components } = buildTempVoiceInterface();
      await newVc.send({ embeds: [embed], components }).catch((e) => {
        console.warn("[TEMP VOICE] Could not post interface to VC chat:", e.message);
      });
      console.log(`[TEMP VOICE] Created personal VC #${newVc.name} for @${member.user.tag}`);
    } catch (err) {
      console.error("[TEMP VOICE CREATE ERROR]", err.message);
    }
  }
  if (oldState.channelId && activeTempVcs.has(oldState.channelId)) {
    const vcRecord = activeTempVcs.get(oldState.channelId);
    if (!vcRecord) return;
    const channel = oldState.guild.channels.cache.get(oldState.channelId);
    if (channel && channel.members.size === 0) {
      const delay = Math.max(1e3, (config.autoDeleteDelaySec || 3) * 1e3);
      setTimeout(async () => {
        try {
          const currentChannel = oldState.guild.channels.cache.get(vcRecord.channelId);
          if (currentChannel && currentChannel.members.size === 0) {
            if (vcRecord.waitingRoomId) {
              const wrChannel = oldState.guild.channels.cache.get(vcRecord.waitingRoomId);
              if (wrChannel) await wrChannel.delete().catch(() => {
              });
            }
            await currentChannel.delete().catch(() => {
            });
            activeTempVcs.delete(vcRecord.channelId);
            persistVcs();
            console.log(`[TEMP VOICE] Cleaned up empty channel #${vcRecord.name}`);
          }
        } catch (err) {
          console.warn("[TEMP VOICE DELETE ERROR]", err.message);
        }
      }, delay);
    }
  }
}
async function handleTempVoiceInteraction(interaction, client) {
  if (interaction.isButton() && interaction.customId.startsWith("tempvc:")) {
    const action = interaction.customId.split(":")[1];
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
        content: "\u26A0\uFE0F You must be connected to an active temporary voice channel to use these controls.",
        ephemeral: true
      });
      return;
    }
    const guild = interaction.guild;
    const voiceChannel = guild.channels.cache.get(targetRecord.channelId);
    if (!voiceChannel) {
      await interaction.reply({ content: "\u26A0\uFE0F Voice channel no longer exists.", ephemeral: true });
      return;
    }
    const isOwner = targetRecord.ownerId === member.id || member.permissions.has(PermissionFlagsBits.Administrator);
    switch (action) {
      // 1. NAME MODAL
      case "name": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can rename this voice channel.", ephemeral: true });
          return;
        }
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_name:${targetRecord.channelId}`).setTitle("Rename Voice Channel");
        const input = new TextInputBuilder().setCustomId("name_input").setLabel("New Channel Name").setStyle(TextInputStyle.Short).setValue(voiceChannel.name.replace(/^🔒\s*/, "")).setMaxLength(40).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      // 2. LIMIT MODAL
      case "limit": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can set the member limit.", ephemeral: true });
          return;
        }
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_limit:${targetRecord.channelId}`).setTitle("Set Voice Limit");
        const input = new TextInputBuilder().setCustomId("limit_input").setLabel("User Limit (0 = Unlimited)").setStyle(TextInputStyle.Short).setValue(String(voiceChannel.userLimit || 0)).setMaxLength(2).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      // 3. PRIVACY TOGGLE (LOCK / UNLOCK)
      case "privacy": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can toggle privacy.", ephemeral: true });
          return;
        }
        const nowLocked = !targetRecord.isLocked;
        targetRecord.isLocked = nowLocked;
        const baseName = voiceChannel.name.replace(/^🔒\s*/, "");
        const newName = nowLocked ? `\u{1F512} ${baseName}` : baseName;
        await voiceChannel.setName(newName).catch(() => {
        });
        await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, {
          Connect: !nowLocked
        }).catch(() => {
        });
        persistVcs();
        await interaction.reply({
          content: nowLocked ? "\u{1F512} Channel **Locked**! Only trusted users can connect." : "\u{1F513} Channel **Unlocked**! Anyone can connect now.",
          ephemeral: true
        });
        return;
      }
      // 4. WAITING ROOM TOGGLE
      case "waitingroom": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can toggle a waiting room.", ephemeral: true });
          return;
        }
        if (targetRecord.waitingRoomId) {
          const wr = guild.channels.cache.get(targetRecord.waitingRoomId);
          if (wr) await wr.delete().catch(() => {
          });
          targetRecord.waitingRoomId = void 0;
          persistVcs();
          await interaction.reply({ content: "\u{1F552} Waiting Room has been closed.", ephemeral: true });
        } else {
          const wr = await guild.channels.create({
            name: `\u{1F552} Waiting - ${voiceChannel.name.replace(/^🔒\s*/, "")}`,
            type: ChannelType.GuildVoice,
            parent: voiceChannel.parentId,
            userLimit: 0
          });
          targetRecord.waitingRoomId = wr.id;
          persistVcs();
          await interaction.reply({
            content: `\u{1F552} Waiting Room created: <#${wr.id}>! Guests can wait there while you decide whom to pull in.`,
            ephemeral: true
          });
        }
        return;
      }
      // 5. CHAT VISIBILITY TOGGLE
      case "chat": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can toggle chat visibility.", ephemeral: true });
          return;
        }
        const chatHidden = !targetRecord.isChatHidden;
        targetRecord.isChatHidden = chatHidden;
        await voiceChannel.permissionOverwrites.edit(guild.roles.everyone.id, {
          SendMessages: !chatHidden
        }).catch(() => {
        });
        persistVcs();
        await interaction.reply({
          content: chatHidden ? "\u{1F4AC} Text chat has been muted for guests." : "\u{1F4AC} Text chat has been enabled for everyone.",
          ephemeral: true
        });
        return;
      }
      // 6. TRUST USER MODAL
      case "trust": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can trust members.", ephemeral: true });
          return;
        }
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_trust:${targetRecord.channelId}`).setTitle("Trust Member");
        const input = new TextInputBuilder().setCustomId("user_input").setLabel("User ID or Username").setPlaceholder("Enter User ID or exact username").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      // 7. UNTRUST USER MODAL
      case "untrust": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can untrust members.", ephemeral: true });
          return;
        }
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_untrust:${targetRecord.channelId}`).setTitle("Untrust Member");
        const input = new TextInputBuilder().setCustomId("user_input").setLabel("User ID or Username").setPlaceholder("Enter User ID or exact username").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      // 8. INVITE LINK
      case "invite": {
        try {
          const invite = await voiceChannel.createInvite({ maxAge: 600, maxUses: 10 });
          await interaction.reply({
            content: `\u{1F4DE} Instant Voice Invite (Valid 10 mins):
${invite.url}`,
            ephemeral: true
          });
        } catch (err) {
          await interaction.reply({ content: `\u26A0\uFE0F Could not create invite: ${err.message}`, ephemeral: true });
        }
        return;
      }
      // 9. KICK MEMBER MODAL
      case "kick": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can kick members.", ephemeral: true });
          return;
        }
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_kick:${targetRecord.channelId}`).setTitle("Kick Member from Voice");
        const input = new TextInputBuilder().setCustomId("user_input").setLabel("Username or User ID to Kick").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      // 10. REGION CYCLE
      case "region": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can change the region.", ephemeral: true });
          return;
        }
        await voiceChannel.setRTCRegion(null).catch(() => {
        });
        await interaction.reply({
          content: "\u{1F310} Voice RTC region set to **Automatic** (Lowest Latency).",
          ephemeral: true
        });
        return;
      }
      // 11. BLOCK MEMBER MODAL
      case "block": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can block members.", ephemeral: true });
          return;
        }
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_block:${targetRecord.channelId}`).setTitle("Block Member from Voice");
        const input = new TextInputBuilder().setCustomId("user_input").setLabel("Username or User ID to Block").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      // 12. UNBLOCK MEMBER MODAL
      case "unblock": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can unblock members.", ephemeral: true });
          return;
        }
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_unblock:${targetRecord.channelId}`).setTitle("Unblock Member");
        const input = new TextInputBuilder().setCustomId("user_input").setLabel("Username or User ID to Unblock").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      // 13. CLAIM OWNERSHIP
      case "claim": {
        const currentOwnerInVc = voiceChannel.members.has(targetRecord.ownerId);
        if (currentOwnerInVc) {
          await interaction.reply({
            content: `\u26A0\uFE0F The channel owner (<@${targetRecord.ownerId}>) is still connected! You cannot claim ownership.`,
            ephemeral: true
          });
          return;
        }
        targetRecord.ownerId = member.id;
        targetRecord.ownerTag = member.user.tag;
        await voiceChannel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true,
          MoveMembers: true
        }).catch(() => {
        });
        persistVcs();
        await interaction.reply({
          content: `\u{1F451} **Ownership Claimed!** You are now the official owner of #${voiceChannel.name}.`,
          ephemeral: false
        });
        return;
      }
      // 14. TRANSFER OWNERSHIP MODAL
      case "transfer": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can transfer ownership.", ephemeral: true });
          return;
        }
        const modal = new ModalBuilder().setCustomId(`tempvc_modal_transfer:${targetRecord.channelId}`).setTitle("Transfer Channel Ownership");
        const input = new TextInputBuilder().setCustomId("user_input").setLabel("New Owner User ID or Username").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      // 15. DELETE VOICE CHANNEL
      case "delete": {
        if (!isOwner) {
          await interaction.reply({ content: "\u26D4 Only the channel owner can delete this voice channel.", ephemeral: true });
          return;
        }
        await interaction.reply({ content: "\u{1F5D1}\uFE0F Deleting temporary voice channel...", ephemeral: true });
        if (targetRecord.waitingRoomId) {
          const wr = guild.channels.cache.get(targetRecord.waitingRoomId);
          if (wr) await wr.delete().catch(() => {
          });
        }
        await voiceChannel.delete().catch(() => {
        });
        activeTempVcs.delete(targetRecord.channelId);
        persistVcs();
        return;
      }
    }
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith("tempvc_modal_")) {
    const parts = interaction.customId.split(":");
    const modalType = parts[0].replace("tempvc_modal_", "");
    const channelId = parts[1];
    const member = interaction.member;
    const targetRecord = activeTempVcs.get(channelId);
    if (!targetRecord) {
      await interaction.reply({ content: "\u26A0\uFE0F Voice channel record not found.", ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    const voiceChannel = guild.channels.cache.get(channelId);
    if (!voiceChannel) {
      await interaction.reply({ content: "\u26A0\uFE0F Voice channel no longer exists.", ephemeral: true });
      return;
    }
    switch (modalType) {
      case "name": {
        const newName = interaction.fields.getTextInputValue("name_input").trim();
        const finalName = targetRecord.isLocked ? `\u{1F512} ${newName}` : newName;
        await voiceChannel.setName(finalName).catch(() => {
        });
        targetRecord.name = finalName;
        persistVcs();
        await interaction.reply({ content: `\u2705 Voice channel renamed to **${finalName}**!`, ephemeral: true });
        return;
      }
      case "limit": {
        const rawLimit = interaction.fields.getTextInputValue("limit_input").trim();
        const limit = Math.max(0, Math.min(99, parseInt(rawLimit) || 0));
        await voiceChannel.setUserLimit(limit).catch(() => {
        });
        targetRecord.userLimit = limit;
        persistVcs();
        await interaction.reply({
          content: limit === 0 ? "\u2705 Member limit removed (unlimited)." : `\u2705 Member limit set to **${limit}**.`,
          ephemeral: true
        });
        return;
      }
      case "trust": {
        const rawUser = interaction.fields.getTextInputValue("user_input").trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `\u26A0\uFE0F Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        await voiceChannel.permissionOverwrites.edit(targetMember.id, {
          Connect: true,
          Speak: true,
          ViewChannel: true
        }).catch(() => {
        });
        if (!targetRecord.trustedUsers.includes(targetMember.id)) {
          targetRecord.trustedUsers.push(targetMember.id);
          persistVcs();
        }
        await interaction.reply({ content: `\u2705 Trusted **@${targetMember.user.tag}**! They can connect anytime.`, ephemeral: true });
        return;
      }
      case "untrust": {
        const rawUser = interaction.fields.getTextInputValue("user_input").trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `\u26A0\uFE0F Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        await voiceChannel.permissionOverwrites.delete(targetMember.id).catch(() => {
        });
        targetRecord.trustedUsers = targetRecord.trustedUsers.filter((id) => id !== targetMember.id);
        persistVcs();
        await interaction.reply({ content: `\u2705 Untrusted **@${targetMember.user.tag}**.`, ephemeral: true });
        return;
      }
      case "kick": {
        const rawUser = interaction.fields.getTextInputValue("user_input").trim();
        const targetMember = voiceChannel.members.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `\u26A0\uFE0F User is not currently in this voice channel.`, ephemeral: true });
          return;
        }
        await targetMember.voice.disconnect("Disconnected by channel owner").catch(() => {
        });
        await interaction.reply({ content: `\u2705 Disconnected **@${targetMember.user.tag}** from voice.`, ephemeral: true });
        return;
      }
      case "block": {
        const rawUser = interaction.fields.getTextInputValue("user_input").trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `\u26A0\uFE0F Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        await voiceChannel.permissionOverwrites.edit(targetMember.id, {
          Connect: false,
          ViewChannel: false
        }).catch(() => {
        });
        if (targetMember.voice.channelId === voiceChannel.id) {
          await targetMember.voice.disconnect("Blocked by channel owner").catch(() => {
          });
        }
        if (!targetRecord.blockedUsers.includes(targetMember.id)) {
          targetRecord.blockedUsers.push(targetMember.id);
          persistVcs();
        }
        await interaction.reply({ content: `\u26D4 Blocked **@${targetMember.user.tag}** from this channel.`, ephemeral: true });
        return;
      }
      case "unblock": {
        const rawUser = interaction.fields.getTextInputValue("user_input").trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `\u26A0\uFE0F Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        await voiceChannel.permissionOverwrites.delete(targetMember.id).catch(() => {
        });
        targetRecord.blockedUsers = targetRecord.blockedUsers.filter((id) => id !== targetMember.id);
        persistVcs();
        await interaction.reply({ content: `\u{1F513} Unblocked **@${targetMember.user.tag}**.`, ephemeral: true });
        return;
      }
      case "transfer": {
        const rawUser = interaction.fields.getTextInputValue("user_input").trim();
        const targetMember = guild.members.cache.find(
          (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
        );
        if (!targetMember) {
          await interaction.reply({ content: `\u26A0\uFE0F Could not find member "${rawUser}".`, ephemeral: true });
          return;
        }
        targetRecord.ownerId = targetMember.id;
        targetRecord.ownerTag = targetMember.user.tag;
        await voiceChannel.permissionOverwrites.edit(targetMember.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          ManageChannels: true,
          MoveMembers: true
        }).catch(() => {
        });
        persistVcs();
        await interaction.reply({ content: `\u{1F451} Transferred channel ownership to **@${targetMember.user.tag}**!`, ephemeral: false });
        return;
      }
    }
  }
}
async function autoSetupTempVoice(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error("Bot is not connected to guild");
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes("private vc")
  );
  if (!category) {
    category = await guild.channels.create({
      name: "\u{1F50A} PRIVATE VC CHANNEL",
      type: ChannelType.GuildCategory
    });
  }
  let controlChannel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name.toLowerCase().includes("voice-command")
  );
  if (!controlChannel) {
    controlChannel = await guild.channels.create({
      name: "\u2728\u30FBvoice-command",
      type: ChannelType.GuildText,
      parent: category.id,
      topic: "Temporary Voice Channel control center. Use buttons below to manage your channel."
    });
  }
  let creatorChannel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildVoice && c.name.toLowerCase().includes("creator channel")
  );
  if (!creatorChannel) {
    creatorChannel = await guild.channels.create({
      name: "\u2795 Creator Channel",
      type: ChannelType.GuildVoice,
      parent: category.id
    });
  }
  const { embed, components } = buildTempVoiceInterface();
  await controlChannel.send({ embeds: [embed], components });
  const newConfig = {
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
    autoDeleteDelaySec: 3
  };
  saveTempVoiceConfig(newConfig);
  return {
    success: true,
    categoryId: category.id,
    controlChannelId: controlChannel.id,
    creatorChannelId: creatorChannel.id
  };
}

// src/services/ticketService.ts
import {
  ChannelType as ChannelType2,
  PermissionFlagsBits as PermissionFlagsBits2,
  EmbedBuilder as EmbedBuilder2,
  ActionRowBuilder as ActionRowBuilder2,
  ButtonBuilder as ButtonBuilder2,
  ButtonStyle as ButtonStyle2,
  ModalBuilder as ModalBuilder2,
  TextInputBuilder as TextInputBuilder2,
  TextInputStyle as TextInputStyle2,
  AttachmentBuilder
} from "discord.js";
import fs2 from "fs";
import path2 from "path";
var CONFIG_PATH2 = path2.join(process.cwd(), "ticket_config.json");
var STORE_PATH2 = path2.join(process.cwd(), "active_tickets.json");
function loadTicketConfig() {
  try {
    if (fs2.existsSync(CONFIG_PATH2)) {
      return JSON.parse(fs2.readFileSync(CONFIG_PATH2, "utf-8"));
    }
  } catch (err) {
    console.warn("[TICKETS] Failed to load config:", err.message);
  }
  return {
    enabled: true,
    openCategoryId: "",
    closedCategoryId: "",
    panelChannelId: "",
    logsChannelId: "",
    supportRoleIds: [],
    ticketCounter: 0,
    embedTitle: "Club EZKEN Support System",
    embedDescription: "Need assistance, have questions regarding your ranks, or want to report an issue?\nClick the button below to open a private ticket with the staff team.",
    embedColor: "#E50914",
    buttonLabel: "Create Ticket",
    buttonEmoji: "\u{1F4E9}",
    namingScheme: "ticket-{count}",
    maxOpenPerUser: 1,
    autoTranscript: true
  };
}
function saveTicketConfig(cfg) {
  try {
    fs2.writeFileSync(CONFIG_PATH2, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (err) {
    console.error("[TICKETS] Failed to save config:", err.message);
  }
}
function loadActiveTickets() {
  try {
    if (fs2.existsSync(STORE_PATH2)) {
      return JSON.parse(fs2.readFileSync(STORE_PATH2, "utf-8"));
    }
  } catch (err) {
    console.warn("[TICKETS] Failed to load tickets store:", err.message);
  }
  return [];
}
function saveActiveTickets(list) {
  try {
    fs2.writeFileSync(STORE_PATH2, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[TICKETS] Failed to save tickets store:", err.message);
  }
}
var ticketStore = /* @__PURE__ */ new Map();
try {
  loadActiveTickets().forEach((t) => ticketStore.set(t.ticketId, t));
} catch {
}
function persistTickets() {
  saveActiveTickets(Array.from(ticketStore.values()));
}
function buildTicketPanelInterface(cfg) {
  const colorInt = parseInt((cfg.embedColor || "#E50914").replace("#", ""), 16) || 15010068;
  const embed = new EmbedBuilder2().setTitle(cfg.embedTitle || "Club EZKEN Support System").setDescription(
    cfg.embedDescription || "Need assistance, have questions regarding your ranks, or want to report an issue?\nClick the button below to open a private ticket with the staff team."
  ).setColor(colorInt).setFooter({ text: "Club EZKEN Official Ticket Tool \u2022 Fast Response Support" });
  const row = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId("ticket:create").setLabel(cfg.buttonLabel || "Create Ticket").setStyle(ButtonStyle2.Danger).setEmoji(cfg.buttonEmoji || "\u{1F4E9}")
  );
  return { embed, components: [row] };
}
function buildTicketControlRow(ticketId) {
  const row = new ActionRowBuilder2().addComponents(
    new ButtonBuilder2().setCustomId(`ticket:close:${ticketId}`).setLabel("Close").setStyle(ButtonStyle2.Danger).setEmoji("\u{1F512}"),
    new ButtonBuilder2().setCustomId(`ticket:transcript:${ticketId}`).setLabel("Transcript").setStyle(ButtonStyle2.Secondary).setEmoji("\u{1F4D1}"),
    new ButtonBuilder2().setCustomId(`ticket:claim:${ticketId}`).setLabel("Claim").setStyle(ButtonStyle2.Primary).setEmoji("\u{1F464}"),
    new ButtonBuilder2().setCustomId(`ticket:add:${ticketId}`).setLabel("Add Member").setStyle(ButtonStyle2.Secondary).setEmoji("\u2795"),
    new ButtonBuilder2().setCustomId(`ticket:delete:${ticketId}`).setLabel("Delete").setStyle(ButtonStyle2.Secondary).setEmoji("\u{1F5D1}\uFE0F")
  );
  return [row];
}
async function generateChannelTranscript(channel, ticket) {
  try {
    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
    const sorted = Array.from(fetchedMessages.values()).reverse();
    let text = `============================================================
`;
    text += `CLUB EZKEN OFFICIAL TICKET TRANSCRIPT
`;
    text += `Ticket ID: #${ticket.ticketId}
`;
    text += `Channel: #${channel.name}
`;
    text += `Owner: ${ticket.creatorTag} (${ticket.creatorId})
`;
    text += `Created: ${new Date(ticket.createdAt).toLocaleString()}
`;
    text += `Status: ${ticket.status}
`;
    if (ticket.claimedBy) text += `Claimed By: ${ticket.claimedBy.tag} (${ticket.claimedBy.id})
`;
    if (ticket.closedBy) text += `Closed By: ${ticket.closedBy.tag} (${ticket.closedBy.id})
`;
    text += `============================================================

`;
    for (const msg of sorted) {
      const time = new Date(msg.createdTimestamp).toLocaleTimeString();
      const author = msg.author.tag;
      const content = msg.cleanContent || (msg.attachments.size > 0 ? `[Attachments: ${msg.attachments.size}]` : "");
      text += `[${time}] ${author}: ${content}
`;
    }
    return text;
  } catch (err) {
    return `Error generating transcript: ${err.message}`;
  }
}
async function handleTicketInteraction(interaction, client) {
  if (interaction.isButton() && interaction.customId.startsWith("ticket:")) {
    const parts = interaction.customId.split(":");
    const action = parts[1];
    const targetTicketId = parts[2];
    const member = interaction.member;
    const guild = interaction.guild;
    const cfg = loadTicketConfig();
    if (action === "create") {
      const userOpenTickets = Array.from(ticketStore.values()).filter(
        (t) => t.creatorId === member.id && t.status !== "CLOSED"
      );
      if (userOpenTickets.length >= (cfg.maxOpenPerUser || 1)) {
        const existing = userOpenTickets[0];
        await interaction.reply({
          content: `\u26A0\uFE0F You already have an open ticket in <#${existing.channelId}>! Please resolve your existing ticket first.`,
          ephemeral: true
        });
        return;
      }
      cfg.ticketCounter = (cfg.ticketCounter || 0) + 1;
      saveTicketConfig(cfg);
      const ticketNumStr = String(cfg.ticketCounter).padStart(4, "0");
      const channelName = (cfg.namingScheme || "ticket-{count}").replace("{count}", ticketNumStr).replace("{username}", member.user.username.toLowerCase());
      const parentCategory = cfg.openCategoryId ? guild.channels.cache.get(cfg.openCategoryId) : null;
      const overwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits2.ViewChannel]
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits2.ViewChannel,
            PermissionFlagsBits2.SendMessages,
            PermissionFlagsBits2.AttachFiles,
            PermissionFlagsBits2.EmbedLinks,
            PermissionFlagsBits2.ReadMessageHistory
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits2.ViewChannel,
            PermissionFlagsBits2.SendMessages,
            PermissionFlagsBits2.ManageChannels,
            PermissionFlagsBits2.AttachFiles,
            PermissionFlagsBits2.EmbedLinks,
            PermissionFlagsBits2.ReadMessageHistory
          ]
        }
      ];
      if (Array.isArray(cfg.supportRoleIds)) {
        for (const roleId of cfg.supportRoleIds) {
          overwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits2.ViewChannel,
              PermissionFlagsBits2.SendMessages,
              PermissionFlagsBits2.AttachFiles,
              PermissionFlagsBits2.EmbedLinks,
              PermissionFlagsBits2.ReadMessageHistory
            ]
          });
        }
      }
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType2.GuildText,
        parent: parentCategory?.id || null,
        topic: `Support Ticket #${ticketNumStr} \u2022 Created by ${member.user.tag}`,
        permissionOverwrites: overwrites
      });
      const newTicket = {
        ticketId: ticketNumStr,
        channelId: ticketChannel.id,
        guildId: guild.id,
        creatorId: member.id,
        creatorTag: member.user.tag,
        createdAt: Date.now(),
        status: "OPEN"
      };
      ticketStore.set(ticketNumStr, newTicket);
      persistTickets();
      const welcomeEmbed = new EmbedBuilder2().setTitle(`Ticket #${ticketNumStr} \u2022 Support Request`).setDescription(
        `Welcome <@${member.id}>!
Thank you for reaching out to the Club EZKEN staff team. Please describe your inquiry or issue in detail below.

A team member will assist you shortly.`
      ).addFields(
        { name: "Ticket Owner", value: `<@${member.id}>`, inline: true },
        { name: "Status", value: "\u{1F7E2} Open", inline: true },
        { name: "Staff Claim", value: "Unclaimed", inline: true }
      ).setColor(15010068).setFooter({ text: "Use the buttons below to control this ticket" });
      await ticketChannel.send({
        content: `<@${member.id}> Support Staff Ping`,
        embeds: [welcomeEmbed],
        components: buildTicketControlRow(ticketNumStr)
      });
      await interaction.reply({
        content: `\u2705 Your ticket has been created: <#${ticketChannel.id}>`,
        ephemeral: true
      });
      return;
    }
    let ticket = targetTicketId ? ticketStore.get(targetTicketId) : null;
    if (!ticket) {
      ticket = Array.from(ticketStore.values()).find((t) => t.channelId === interaction.channelId) || null;
    }
    if (!ticket) {
      await interaction.reply({ content: "\u26A0\uFE0F Could not find ticket record for this channel.", ephemeral: true });
      return;
    }
    const channel = guild.channels.cache.get(ticket.channelId);
    if (!channel) {
      await interaction.reply({ content: "\u26A0\uFE0F Ticket channel no longer exists.", ephemeral: true });
      return;
    }
    if (action === "claim") {
      if (ticket.claimedBy) {
        await interaction.reply({
          content: `\u26A0\uFE0F This ticket has already been claimed by **@${ticket.claimedBy.tag}**.`,
          ephemeral: true
        });
        return;
      }
      ticket.claimedBy = { id: member.id, tag: member.user.tag };
      ticket.status = "CLAIMED";
      persistTickets();
      await channel.send({
        content: `\u{1F464} **Ticket Claimed!** <@${member.id}> will be handling this inquiry.`
      });
      await interaction.reply({ content: "\u2705 You have claimed this ticket!", ephemeral: true });
      return;
    }
    if (action === "close") {
      const confirmRow = new ActionRowBuilder2().addComponents(
        new ButtonBuilder2().setCustomId(`ticket:confirm_close:${ticket.ticketId}`).setLabel("Confirm Close").setStyle(ButtonStyle2.Danger).setEmoji("\u2705"),
        new ButtonBuilder2().setCustomId(`ticket:cancel_close:${ticket.ticketId}`).setLabel("Cancel").setStyle(ButtonStyle2.Secondary).setEmoji("\u274C")
      );
      await interaction.reply({
        content: "\u26A0\uFE0F Are you sure you want to close this ticket?",
        components: [confirmRow],
        ephemeral: false
      });
      return;
    }
    if (action === "cancel_close") {
      await interaction.message.delete().catch(() => {
      });
      await interaction.reply({ content: "Close operation cancelled.", ephemeral: true });
      return;
    }
    if (action === "confirm_close") {
      ticket.status = "CLOSED";
      ticket.closedAt = Date.now();
      ticket.closedBy = { id: member.id, tag: member.user.tag };
      persistTickets();
      await channel.permissionOverwrites.edit(ticket.creatorId, {
        SendMessages: false
      }).catch(() => {
      });
      if (cfg.closedCategoryId) {
        await channel.setParent(cfg.closedCategoryId, { lockPermissions: false }).catch(() => {
        });
      }
      const transcriptText = await generateChannelTranscript(channel, ticket);
      const attachment = new AttachmentBuilder(Buffer.from(transcriptText, "utf-8"), {
        name: `transcript-ticket-${ticket.ticketId}.txt`
      });
      if (cfg.logsChannelId) {
        const logsChannel = guild.channels.cache.get(cfg.logsChannelId);
        if (logsChannel) {
          const logEmbed = new EmbedBuilder2().setTitle(`Ticket #${ticket.ticketId} Closed & Logged`).setDescription(`**Owner:** <@${ticket.creatorId}>
**Closed By:** <@${member.id}>`).setColor(7434618).setTimestamp();
          await logsChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {
          });
        }
      }
      const closedEmbed = new EmbedBuilder2().setTitle(`Ticket #${ticket.ticketId} Closed`).setDescription(`Closed by <@${member.id}>.
A complete transcript has been saved.`).setColor(2565930);
      const postClosedRow = new ActionRowBuilder2().addComponents(
        new ButtonBuilder2().setCustomId(`ticket:reopen:${ticket.ticketId}`).setLabel("Reopen").setStyle(ButtonStyle2.Success).setEmoji("\u{1F513}"),
        new ButtonBuilder2().setCustomId(`ticket:transcript:${ticket.ticketId}`).setLabel("Transcript").setStyle(ButtonStyle2.Secondary).setEmoji("\u{1F4D1}"),
        new ButtonBuilder2().setCustomId(`ticket:delete:${ticket.ticketId}`).setLabel("Delete").setStyle(ButtonStyle2.Danger).setEmoji("\u{1F5D1}\uFE0F")
      );
      await interaction.message.delete().catch(() => {
      });
      await channel.send({ embeds: [closedEmbed], components: [postClosedRow], files: [attachment] });
      return;
    }
    if (action === "reopen") {
      ticket.status = "OPEN";
      ticket.closedAt = void 0;
      ticket.closedBy = void 0;
      persistTickets();
      await channel.permissionOverwrites.edit(ticket.creatorId, {
        SendMessages: true
      }).catch(() => {
      });
      if (cfg.openCategoryId) {
        await channel.setParent(cfg.openCategoryId, { lockPermissions: false }).catch(() => {
        });
      }
      await channel.send({ content: `\u{1F513} **Ticket Reopened!** Reopened by <@${member.id}>.` });
      await interaction.reply({ content: "\u2705 Ticket reopened successfully.", ephemeral: true });
      return;
    }
    if (action === "transcript") {
      const transcriptText = await generateChannelTranscript(channel, ticket);
      const attachment = new AttachmentBuilder(Buffer.from(transcriptText, "utf-8"), {
        name: `transcript-ticket-${ticket.ticketId}.txt`
      });
      await interaction.reply({
        content: `\u{1F4D1} **Ticket Transcript Generated:**`,
        files: [attachment],
        ephemeral: false
      });
      return;
    }
    if (action === "add") {
      const modal = new ModalBuilder2().setCustomId(`ticket_modal_add:${ticket.ticketId}`).setTitle("Add Member to Ticket");
      const input = new TextInputBuilder2().setCustomId("user_input").setLabel("User ID or Username").setPlaceholder("Enter User ID or exact username").setStyle(TextInputStyle2.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder2().addComponents(input));
      await interaction.showModal(modal);
      return;
    }
    if (action === "delete") {
      await interaction.reply({ content: "\u{1F5D1}\uFE0F Ticket will be deleted in 5 seconds...", ephemeral: false });
      setTimeout(async () => {
        try {
          await channel.delete().catch(() => {
          });
          ticketStore.delete(ticket.ticketId);
          persistTickets();
        } catch (err) {
          console.warn("[TICKET DELETE ERROR]", err.message);
        }
      }, 5e3);
      return;
    }
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_modal_")) {
    const parts = interaction.customId.split(":");
    const modalType = parts[0].replace("ticket_modal_", "");
    const ticketId = parts[1];
    const guild = interaction.guild;
    const ticket = ticketStore.get(ticketId);
    if (!ticket) {
      await interaction.reply({ content: "\u26A0\uFE0F Ticket record not found.", ephemeral: true });
      return;
    }
    const channel = guild.channels.cache.get(ticket.channelId);
    if (!channel) {
      await interaction.reply({ content: "\u26A0\uFE0F Ticket channel not found.", ephemeral: true });
      return;
    }
    if (modalType === "add") {
      const rawUser = interaction.fields.getTextInputValue("user_input").trim();
      const targetMember = guild.members.cache.find(
        (m) => m.id === rawUser || m.user.username.toLowerCase() === rawUser.toLowerCase() || m.displayName.toLowerCase() === rawUser.toLowerCase()
      );
      if (!targetMember) {
        await interaction.reply({ content: `\u26A0\uFE0F Could not find member "${rawUser}".`, ephemeral: true });
        return;
      }
      await channel.permissionOverwrites.edit(targetMember.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        ReadMessageHistory: true
      }).catch(() => {
      });
      await channel.send({ content: `\u2795 **Member Added:** <@${targetMember.id}> was added to the ticket.` });
      await interaction.reply({ content: `\u2705 Added **@${targetMember.user.tag}** to this ticket.`, ephemeral: true });
      return;
    }
  }
}
async function autoSetupTickets(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error("Bot is not connected to guild");
  let openCategory = guild.channels.cache.find(
    (c) => c.type === ChannelType2.GuildCategory && c.name.toLowerCase().includes("open tickets")
  );
  if (!openCategory) {
    openCategory = await guild.channels.create({
      name: "\u{1F3AB} OPEN TICKETS",
      type: ChannelType2.GuildCategory
    });
  }
  let closedCategory = guild.channels.cache.find(
    (c) => c.type === ChannelType2.GuildCategory && c.name.toLowerCase().includes("closed tickets")
  );
  if (!closedCategory) {
    closedCategory = await guild.channels.create({
      name: "\u{1F4C1} CLOSED TICKETS",
      type: ChannelType2.GuildCategory
    });
  }
  let panelChannel = guild.channels.cache.find(
    (c) => c.type === ChannelType2.GuildText && (c.name.includes("create-ticket") || c.name.includes("tickets"))
  );
  if (!panelChannel) {
    panelChannel = await guild.channels.create({
      name: "\u{1F3AB}\u30FBcreate-ticket",
      type: ChannelType2.GuildText,
      parent: openCategory.id,
      topic: "Click the button below to open a private ticket with the staff team."
    });
  }
  let logsChannel = guild.channels.cache.find(
    (c) => c.type === ChannelType2.GuildText && (c.name.includes("ticket-logs") || c.name.includes("ticket-transcripts"))
  );
  if (!logsChannel) {
    logsChannel = await guild.channels.create({
      name: "\u{1F4CB}\u30FBticket-logs",
      type: ChannelType2.GuildText,
      parent: closedCategory.id,
      topic: "Audits and transcripts for closed support tickets.",
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits2.ViewChannel]
        },
        {
          id: client.user.id,
          allow: [PermissionFlagsBits2.ViewChannel, PermissionFlagsBits2.SendMessages, PermissionFlagsBits2.AttachFiles]
        }
      ]
    });
  }
  const cfg = loadTicketConfig();
  cfg.openCategoryId = openCategory.id;
  cfg.closedCategoryId = closedCategory.id;
  cfg.panelChannelId = panelChannel.id;
  cfg.logsChannelId = logsChannel.id;
  saveTicketConfig(cfg);
  const { embed, components } = buildTicketPanelInterface(cfg);
  await panelChannel.send({ embeds: [embed], components });
  return {
    success: true,
    openCategoryId: openCategory.id,
    closedCategoryId: closedCategory.id,
    panelChannelId: panelChannel.id,
    logsChannelId: logsChannel.id
  };
}

// server.ts
dotenv.config();
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path3.dirname(__filename2);
var ffmpegPath = ffmpegStatic?.default || ffmpegStatic;
if (ffmpegPath && typeof ffmpegPath === "string") {
  process.env.FFMPEG_PATH = ffmpegPath;
}
var ytdlClient = new Ytdl();
var app = express();
var PORT = process.env.SERVER_PORT || process.env.PORT || 3e3;
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path} from ${req.headers["x-forwarded-for"] || req.ip}`);
  next();
});
app.get(["/health", "/api/health"], (_req, res) => {
  return res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime(),
    port: PORT,
    env: process.env.NODE_ENV || "development"
  });
});
app.use((req, _res, next) => {
  if (!req.url.startsWith("/api") && req.url !== "/" && !req.url.startsWith("/dist") && !req.url.startsWith("/assets")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  next();
});
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
var DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || "1559297780613390346";
var DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1559382791093751848";
var MOD_LOGS_CHANNEL_ID = "1559441137624678440";
var geminiApiKey = process.env.GEMINI_API_KEY || "";
var aiClient = null;
try {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  console.log("[SERVER] GoogleGenAI initialized for Club EZKEN");
} catch (err) {
  console.error("[SERVER] Failed to init GoogleGenAI:", err.message);
}
function getDiscordHeaders() {
  return {
    Authorization: `Bot ${DISCORD_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "DiscordBot (https://github.com/ezken-dev/ClubEZ, 1.0.0)"
  };
}
var discordBot = new Client3({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.User,
    Partials.GuildMember
  ]
});
var SLASH_COMMANDS = [
  {
    name: "play",
    description: "\u{1F3B5} Play a song from YouTube or Spotify",
    options: [{
      name: "query",
      description: "Song name, YouTube URL, or Spotify link",
      type: 3,
      // STRING
      required: true
    }]
  },
  {
    name: "join",
    description: "\u{1F50A} Summon ClubEZ to your current voice channel"
  },
  {
    name: "leave",
    description: "\u{1F44B} Disconnect ClubEZ from the voice channel"
  },
  {
    name: "skip",
    description: "\u23ED Skip the current song and play next in queue"
  },
  {
    name: "pause",
    description: "\u23F8 Pause or resume playback"
  },
  {
    name: "stop",
    description: "\u23F9 Stop music and clear the queue"
  },
  {
    name: "queue",
    description: "\u{1F4CB} Show the current music queue"
  },
  {
    name: "nowplaying",
    description: "\u{1F3B5} Show what's currently playing"
  },
  {
    name: "volume",
    description: "\u{1F50A} Set the playback volume (1-100)",
    options: [{
      name: "level",
      description: "Volume level from 1 to 100",
      type: 4,
      // INTEGER
      required: true,
      min_value: 1,
      max_value: 100
    }]
  },
  {
    name: "loop",
    description: "\u{1F501} Toggle loop mode (off / track / queue)"
  },
  {
    name: "shuffle",
    description: "\u{1F500} Toggle queue shuffle on or off"
  },
  {
    name: "remove",
    description: "\u{1F5D1}\uFE0F Remove a song from the queue by position",
    options: [{
      name: "position",
      description: "Position number in queue (1 = first)",
      type: 4,
      // INTEGER
      required: true,
      min_value: 1
    }]
  },
  {
    name: "seek",
    description: "\u23E9 Seek to a position in the current track",
    options: [{
      name: "seconds",
      description: "Seconds to seek to (e.g. 90 = 1:30)",
      type: 4,
      // INTEGER
      required: true,
      min_value: 0
    }]
  },
  {
    name: "lyrics",
    description: "\u{1F4DD} Show lyrics for the current or specified song",
    options: [{
      name: "song",
      description: "Song name (leave empty for current track)",
      type: 3,
      // STRING
      required: false
    }]
  },
  {
    name: "rank",
    description: "\u{1F3C5} Check your XP rank and level in Club EZKEN"
  },
  {
    name: "leaderboard",
    description: "\u{1F3C6} Show the Club EZKEN XP leaderboard"
  }
];
async function registerSlashCommands() {
  try {
    const url = `https://discord.com/api/v10/applications/${DISCORD_CLIENT_ID}/guilds/${DISCORD_GUILD_ID}/commands`;
    const res = await fetch(url, {
      method: "PUT",
      headers: getDiscordHeaders(),
      body: JSON.stringify(SLASH_COMMANDS)
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[DISCORD BOT] \u2705 Registered ${Array.isArray(data) ? data.length : "?"} slash commands for ClubEZ in Club EZKEN guild!`);
    } else {
      const err = await res.text();
      console.error("[DISCORD BOT] \u274C Failed to register slash commands:", res.status, err.substring(0, 200));
    }
  } catch (err) {
    console.error("[DISCORD BOT] \u274C Slash command registration error:", err.message);
  }
}
discordBot.once(Events.ClientReady, async (c) => {
  console.log(`[DISCORD BOT] Logged in as ${c.user.tag} \u2014 Real-Time Moderation Shield & Self-Role Button Listener Active!`);
  await registerSlashCommands();
});
var musicQueue = [];
var musicCurrentTrack = null;
var musicVolume = 75;
var musicIsPlaying = false;
var musicVcChannelId = null;
var musicLoopMode = "off";
var musicShuffleEnabled = false;
var musicSeekPosition = 0;
var musicLastError = null;
var musicIsLoading = false;
var musicCurrentResource = null;
var musicPlayer = createAudioPlayer({
  behaviors: { noSubscriber: NoSubscriberBehavior.Play }
});
musicPlayer.on("stateChange", (oldState, newState) => {
  musicIsPlaying = newState.status === AudioPlayerStatus.Playing;
  console.log(`[MUSIC PLAYER STATUS] ${oldState.status} -> ${newState.status}`);
});
musicPlayer.on(AudioPlayerStatus.Idle, () => {
  if (musicCurrentTrack) void advanceMusicQueue();
});
musicPlayer.on("error", (error) => {
  musicLastError = error.message;
  console.error("[MUSIC PLAYER ERROR]", error);
  musicCurrentTrack = null;
  musicCurrentResource = null;
  void startNextMusicTrack();
});
async function normalizeMusicQuery(query) {
  const cleanQuery = query.trim();
  if (/open\.spotify\.com\/(?:track|album|playlist)\//i.test(cleanQuery)) {
    try {
      const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(cleanQuery)}`);
      if (response.ok) {
        const meta = await response.json();
        if (meta.title) return { query: `${meta.title} ${meta.author_name || ""}`.trim(), source: "spotify" };
      }
    } catch (error) {
      console.warn("[MUSIC SPOTIFY METADATA]", error.message);
    }
    throw new Error("Could not read this Spotify link. Try a public track link or search its title.");
  }
  return { query: cleanQuery, source: "youtube" };
}
function formatTrackDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Live";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function fromYouTubeVideo(video, requestedBy = "Dashboard", source = "youtube") {
  const durationSec = Number(video.durationInSec) || 0;
  return {
    id: video.id || new URL(video.url).searchParams.get("v") || `yt_${Date.now()}`,
    title: video.title || "Untitled video",
    artist: video.channel?.name || "YouTube",
    duration: video.durationRaw || formatTrackDuration(durationSec),
    durationSec,
    thumbnail: video.thumbnails?.[0]?.url || (video.id ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : ""),
    url: video.url,
    source,
    requestedBy,
    addedAt: Date.now()
  };
}
async function searchYouTube(query, limit = 5) {
  const normalized = await normalizeMusicQuery(query);
  const isYouTubeUrl = /(?:youtube\.com|youtu\.be)/i.test(normalized.query);
  if (isYouTubeUrl) {
    try {
      const info = await ytdlClient.getInfo(normalized.query);
      if (info?.videoDetails) {
        const sec = Number(info.videoDetails.lengthSeconds) || 0;
        return [{
          id: info.videoDetails.videoId || `yt_${Date.now()}`,
          title: info.videoDetails.title || "YouTube Audio",
          artist: info.videoDetails.author?.name || "YouTube",
          duration: formatTrackDuration(sec),
          durationSec: sec,
          thumbnail: info.videoDetails.thumbnails?.[0]?.url || (info.videoDetails.videoId ? `https://i.ytimg.com/vi/${info.videoDetails.videoId}/hqdefault.jpg` : ""),
          url: normalized.query,
          source: normalized.source,
          requestedBy: "Dashboard",
          addedAt: Date.now()
        }];
      }
    } catch (e) {
      console.warn("[YTDL GETINFO WARN]", e.message);
    }
    try {
      const info = await play.video_info(normalized.query);
      if (info?.video_details) {
        return [fromYouTubeVideo(info.video_details, "Dashboard", normalized.source)];
      }
    } catch (playErr) {
      console.warn("[PLAY-DL VIDEO_INFO WARN]", playErr.message);
    }
  }
  try {
    const yt = YouTube.default || YouTube;
    const srResults = await yt.search(normalized.query, { limit, type: "video" });
    if (srResults && srResults.length > 0) {
      return srResults.map((v) => ({
        id: v.id || `yt_${Date.now()}`,
        title: v.title || "Untitled video",
        artist: v.channel?.name || "YouTube",
        duration: v.durationFormatted || formatTrackDuration(Math.floor((v.duration || 0) / 1e3)),
        durationSec: Math.floor((v.duration || 0) / 1e3),
        thumbnail: v.thumbnail?.url || (v.id ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : ""),
        url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
        source: normalized.source,
        requestedBy: "Dashboard",
        addedAt: Date.now()
      }));
    }
  } catch (srErr) {
    console.warn("[YOUTUBE-SR SEARCH WARN]", srErr.message);
  }
  try {
    const results = await play.search(normalized.query, {
      limit,
      source: { youtube: "video" }
    });
    if (results && results.length > 0) {
      return results.filter((video) => video?.url && video?.id && video.type === "video").map((video) => fromYouTubeVideo(video, "Dashboard", normalized.source));
    }
  } catch (playErr) {
    console.warn("[PLAY-DL SEARCH WARN]", playErr.message);
  }
  return [];
}
async function startNextMusicTrack() {
  if (musicIsLoading) return;
  musicIsLoading = true;
  try {
    while (musicQueue.length > 0) {
      const next = musicQueue.shift();
      musicCurrentTrack = next;
      const connection = getVoiceConnection(DISCORD_GUILD_ID);
      if (!connection || connection.state.status !== VoiceConnectionStatus.Ready) {
        musicQueue.unshift(next);
        musicCurrentTrack = null;
        musicLastError = "ClubEZ is not connected to a ready voice channel. Use /join or select Connect Bot in the dashboard.";
        return;
      }
      let resourceCreated = false;
      try {
        const stream2 = ytdlClient.download(next.url, {
          filter: (f) => f.hasAudio && !f.hasVideo && (f.container === "webm" || f.codecs?.includes("opus")),
          quality: "highestaudio",
          highWaterMark: 512 * 1024
        });
        stream2.on("error", (err) => {
          console.error("[YTDL WEBM STREAM ERROR]", err.message);
        });
        const resource = createAudioResource(stream2, {
          inputType: StreamType.WebmOpus,
          inlineVolume: true,
          metadata: next
        });
        if (resource.volume) resource.volume.setVolume(musicVolume / 100);
        musicCurrentResource = resource;
        connection.subscribe(musicPlayer);
        musicLastError = null;
        musicPlayer.play(resource);
        resourceCreated = true;
        console.log(`[MUSIC] Fast-streaming "${next.title}" via WebmOpus in voice channel ${connection.joinConfig.channelId}`);
        return;
      } catch (ytdlErr) {
        console.warn(`[YTDL WEBM-OPUS FAILED for "${next.title}"]:`, ytdlErr.message);
      }
      if (!resourceCreated) {
        try {
          const stream2 = ytdlClient.download(next.url, {
            filter: { hasAudio: true, hasVideo: false },
            quality: "highestaudio",
            highWaterMark: 512 * 1024
          });
          stream2.on("error", (err) => {
            console.error("[YTDL ARBITRARY STREAM ERROR]", err.message);
          });
          const resource = createAudioResource(stream2, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
            metadata: next
          });
          if (resource.volume) resource.volume.setVolume(musicVolume / 100);
          musicCurrentResource = resource;
          connection.subscribe(musicPlayer);
          musicLastError = null;
          musicPlayer.play(resource);
          resourceCreated = true;
          console.log(`[MUSIC] Streaming "${next.title}" via Arbitrary`);
          return;
        } catch (arbErr) {
          console.warn(`[YTDL ARBITRARY FAILED for "${next.title}"]:`, arbErr.message);
        }
      }
      if (!resourceCreated) {
        try {
          const input = await play.stream(next.url);
          const resource = createAudioResource(input.stream, {
            inputType: input.type,
            inlineVolume: true,
            metadata: next
          });
          if (resource.volume) resource.volume.setVolume(musicVolume / 100);
          musicCurrentResource = resource;
          connection.subscribe(musicPlayer);
          musicLastError = null;
          musicPlayer.play(resource);
          resourceCreated = true;
          console.log(`[MUSIC FALLBACK] Playing "${next.title}" via play-dl`);
          return;
        } catch (playErr) {
          console.warn(`[PLAY-DL STREAM FAILED for "${next.title}"]:`, playErr.message);
        }
      }
      if (!resourceCreated) {
        musicLastError = `Could not stream "${next.title}". YouTube restricted the audio stream.`;
        console.error("[MUSIC STREAM ERROR]", musicLastError);
        musicCurrentTrack = null;
        musicCurrentResource = null;
      }
    }
    musicCurrentTrack = null;
    musicIsPlaying = false;
    musicCurrentResource = null;
  } finally {
    musicIsLoading = false;
  }
}
async function advanceMusicQueue() {
  const finished = musicCurrentTrack;
  if (!finished) return;
  if (musicLoopMode === "track") {
    musicQueue.unshift(finished);
  } else if (musicLoopMode === "queue") {
    musicQueue.push(finished);
  }
  musicCurrentTrack = null;
  musicCurrentResource = null;
  await startNextMusicTrack();
}
async function enqueueMusicTrack(track) {
  const startsNow = !musicCurrentTrack && !musicIsLoading;
  musicQueue.push(track);
  if (startsNow) await startNextMusicTrack();
  const started = musicCurrentTrack?.id === track.id && musicIsPlaying;
  return { position: started ? 0 : musicQueue.findIndex((item) => item.id === track.id) + 1, started };
}
function skipMusicTrack() {
  const skipped = musicCurrentTrack;
  musicCurrentTrack = null;
  musicCurrentResource = null;
  if (musicPlayer.state.status !== AudioPlayerStatus.Idle) musicPlayer.stop(true);
  void startNextMusicTrack();
  return skipped;
}
function stopMusicPlayback() {
  musicCurrentTrack = null;
  musicCurrentResource = null;
  musicQueue = [];
  musicIsPlaying = false;
  musicLastError = null;
  if (musicPlayer.state.status !== AudioPlayerStatus.Idle) musicPlayer.stop(true);
}
async function joinVoice(guild, channelId) {
  const channel = guild?.channels.cache.get(channelId);
  if (!channel || !channel.isVoiceBased?.() && channel.type !== ChannelType3.GuildVoice) {
    throw new Error("Voice channel was not found in this server.");
  }
  const botMember = guild.members.me || discordBot.user && guild.members.cache.get(discordBot.user.id);
  const permissions = botMember ? channel.permissionsFor(botMember) : null;
  if (!permissions?.has([PermissionFlagsBits3.Connect, PermissionFlagsBits3.Speak])) {
    throw new Error("ClubEZ needs Connect and Speak permissions in that voice channel.");
  }
  let connection = getVoiceConnection(guild.id);
  if (connection && connection.joinConfig.channelId === channelId && connection.state.status === VoiceConnectionStatus.Ready) {
    connection.subscribe(musicPlayer);
    musicVcChannelId = channelId;
    return connection;
  }
  if (connection && connection.joinConfig.channelId !== channelId) {
    try {
      connection.destroy();
    } catch {
    }
    connection = void 0;
  }
  if (!connection) {
    connection = joinVoiceChannel({
      channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });
  }
  connection.subscribe(musicPlayer);
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5e3),
        entersState(connection, VoiceConnectionStatus.Connecting, 5e3)
      ]);
    } catch {
      try {
        connection?.destroy();
      } catch {
      }
      if (musicVcChannelId === channelId) {
        musicVcChannelId = null;
      }
    }
  });
  try {
    if (connection.state.status !== VoiceConnectionStatus.Ready) {
      await entersState(connection, VoiceConnectionStatus.Ready, 25e3);
    }
  } catch (err) {
    console.error(`[DISCORD VC] Handshake warning in #${channel.name}:`, err.message);
    if (connection.state.status !== VoiceConnectionStatus.Ready) {
      try {
        connection.destroy();
      } catch {
      }
      throw new Error(`Voice connection to #${channel.name} timed out. Discord voice gateway took too long. Please try /play again.`);
    }
  }
  musicVcChannelId = channelId;
  console.log(`[DISCORD VC] ClubEZ ready in #${channel.name}`);
  return connection;
}
function leaveVoice(guildId) {
  stopMusicPlayback();
  const connection = getVoiceConnection(guildId) || getVoiceConnection(DISCORD_GUILD_ID);
  if (connection) {
    try {
      connection.destroy();
    } catch {
    }
  }
  const guild = discordBot.guilds.cache.get(guildId) || discordBot.guilds.cache.get(DISCORD_GUILD_ID);
  const botMember = guild?.members.me;
  if (botMember?.voice?.channel) {
    botMember.voice.disconnect().catch(() => {
    });
  }
  musicVcChannelId = null;
  console.log(`[DISCORD VC] Disconnected and left voice channel in guild ${guildId}`);
}
async function handleMusicTextCommand(message, text) {
  const match = text.trim().match(/^([!./])(play|join|leave|skip|pause|stop|queue|nowplaying|volume)\b\s*(.*)$/i);
  if (!match) return false;
  const command = match[2].toLowerCase();
  const args = (match[3] || "").trim();
  const guild = message.guild;
  const voiceChannel = message.member?.voice?.channel;
  try {
    if (!guild) {
      await message.reply("Music commands only work inside the Club EZKEN server.");
      return true;
    }
    if (command === "join") {
      if (!voiceChannel) {
        await message.reply("Join a voice channel first, then type `!join`.");
        return true;
      }
      await joinVoice(guild, voiceChannel.id);
      await message.reply(`\u{1F50A} ClubEZ joined **${voiceChannel.name}**. Use \`!play <song or URL>\`.`);
      return true;
    }
    if (command === "leave" || command === "stop") {
      leaveVoice(guild.id);
      await message.reply("\u23F9 Music stopped, queue cleared, and ClubEZ left voice.");
      return true;
    }
    if (command === "skip") {
      const skipped = skipMusicTrack();
      await message.reply(skipped ? `\u23ED Skipped **${skipped.title}**.` : "Nothing is playing right now.");
      return true;
    }
    if (command === "pause") {
      if (!musicCurrentTrack) {
        await message.reply("Nothing is playing right now.");
        return true;
      }
      const resume = musicPlayer.state.status === AudioPlayerStatus.Paused;
      if (resume) musicPlayer.unpause();
      else if (musicPlayer.state.status === AudioPlayerStatus.Playing) musicPlayer.pause();
      musicIsPlaying = resume;
      await message.reply(resume ? "\u25B6\uFE0F Resumed." : "\u23F8 Paused.");
      return true;
    }
    if (command === "queue") {
      const queueText = musicQueue.slice(0, 10).map((track, index) => `${index + 1}. ${track.title} \u2014 ${track.requestedBy}`).join("\n");
      await message.reply(`${musicCurrentTrack ? `\u{1F3B5} **Now:** ${musicCurrentTrack.title}
` : ""}${queueText ? `\u{1F4CB} **Queue:**
${queueText}` : "\u{1F4CB} Queue is empty."}`);
      return true;
    }
    if (command === "nowplaying") {
      await message.reply(musicCurrentTrack ? `\u{1F3B5} Now playing: **${musicCurrentTrack.title}** \u2014 ${musicCurrentTrack.artist}` : "Nothing is playing right now.");
      return true;
    }
    if (command === "volume") {
      const level = Number(args);
      if (!Number.isFinite(level) || level < 0 || level > 100) {
        await message.reply("Use `!volume 0-100`.");
        return true;
      }
      musicVolume = level;
      if (musicCurrentResource?.volume) musicCurrentResource.volume.setVolume(level / 100);
      await message.reply(`\u{1F50A} Volume set to **${level}%**.`);
      return true;
    }
    if (command === "play") {
      if (!args) {
        await message.reply("Use `!play <song name or YouTube/Spotify URL>`.");
        return true;
      }
      if (!voiceChannel) {
        await message.reply("Join a voice channel first, then type `!play <song>`.");
        return true;
      }
      const loading = await message.reply(`\u{1F50E} Searching for **${args.slice(0, 120)}**...`);
      const searchResults = await searchYouTube(args, 1);
      const found = searchResults[0];
      if (!found) {
        await loading.edit(`\u274C No playable result found for **"${args}"**. Try a different song name or direct link.`);
        return true;
      }
      await joinVoice(guild, voiceChannel.id);
      const track = { ...found, requestedBy: message.author.username, addedAt: Date.now() };
      const queued = await enqueueMusicTrack(track);
      const embed = new EmbedBuilder3().setTitle(queued.position === 0 ? "\u{1F3B5} Now Playing" : "\u{1F4CB} Added to Queue").setColor(15010068).setDescription(`**[${track.title}](${track.url})**
\u{1F3A4} ${track.artist}
\u23F1\uFE0F ${track.duration}
\u{1F50A} Voice: **${voiceChannel.name}**`).setThumbnail(track.thumbnail).addFields(
        { name: "Requested by", value: `<@${message.author.id}>`, inline: true },
        { name: "Queue Position", value: queued.position === 0 ? "Now playing" : `#${queued.position}`, inline: true },
        { name: "Player", value: musicLastError ? `\u26A0\uFE0F ${musicLastError}` : musicPlayer.state.status, inline: true }
      ).setFooter({ text: "Club EZKEN DJ System \u2022 !skip !pause !stop !queue" }).setTimestamp();
      await loading.edit({ content: "", embeds: [embed] });
      return true;
    }
  } catch (error) {
    console.error("[MUSIC TEXT COMMAND ERROR]", error?.stack || error?.message || error);
    await message.reply(`\u274C Music error: ${error.message || "unknown error"}`).catch(() => {
    });
    return true;
  }
  return true;
}
discordBot.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleTempVoiceInteraction(interaction, discordBot);
  } catch (err) {
    console.error("[TEMP VOICE INTERACTION ERROR]", err.message);
  }
  try {
    await handleTicketInteraction(interaction, discordBot);
  } catch (err) {
    console.error("[TICKET INTERACTION ERROR]", err.message);
  }
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    try {
      if (commandName === "join") {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const vcChannel = member?.voice?.channel;
        if (!vcChannel) {
          await interaction.reply({ content: "\u274C You must join a voice channel first before summoning ClubEZ!", ephemeral: true });
          return;
        }
        await joinVoice(interaction.guild, vcChannel.id);
        await interaction.reply({ content: `\u{1F50A} **ClubEZ connected to <#${vcChannel.id}>!** Use \`/play <song>\` to start playback.`, ephemeral: false });
        return;
      }
      if (commandName === "leave") {
        leaveVoice(interaction.guildId || DISCORD_GUILD_ID);
        await interaction.reply({ content: "\u{1F44B} **ClubEZ disconnected from the voice channel.**", ephemeral: false });
        return;
      }
      if (commandName === "play") {
        const query = interaction.options.getString("query", true);
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const vcChannel = member?.voice?.channel;
        console.log(`[SLASH /play] User ${interaction.user.tag} in #${vcChannel?.name || "none"} query: "${query}"`);
        if (!vcChannel) {
          await interaction.reply({
            content: "\u274C You need to be in a **voice channel** first! Join a VC then try `/play` again.",
            ephemeral: true
          });
          return;
        }
        await interaction.deferReply();
        const searchResults = await searchYouTube(query, 1);
        const matched = searchResults[0];
        if (!matched) {
          await interaction.editReply({
            content: `\u274C No playable result found for **"${query}"**. Try a different song name or direct YouTube/Spotify link.`
          });
          return;
        }
        await joinVoice(interaction.guild, vcChannel.id);
        const newTrack = {
          ...matched,
          requestedBy: interaction.user.username,
          addedAt: Date.now()
        };
        const isFirstTrack = !musicCurrentTrack && musicQueue.length === 0;
        const queued = await enqueueMusicTrack(newTrack);
        const isSpotifyMatch = newTrack.source === "spotify";
        const embed = new EmbedBuilder3().setTitle(queued.position === 0 ? "\u{1F3B5} Starting Playback" : "\u{1F4CB} Added to Queue").setColor(15010068).setDescription(
          `**[${newTrack.title}](${newTrack.url})**

\u{1F3A4} **Artist / Channel:** ${newTrack.artist}
\u23F1\uFE0F **Duration:** \`${newTrack.duration}\`

\u{1F50A} **Voice channel:** <#${vcChannel.id}>
` + (isSpotifyMatch ? "\u2139\uFE0F Spotify track identified; playback uses its YouTube match.\n" : "") + (musicLastError ? `\u26A0\uFE0F ${musicLastError}` : "")
        ).setThumbnail(newTrack.thumbnail).addFields(
          { name: "\u{1F50E} Found via", value: isSpotifyMatch ? "Spotify link \u2192 YouTube match" : "YouTube", inline: true },
          { name: "\u{1F464} Requested by", value: `<@${interaction.user.id}>`, inline: true },
          { name: "\u{1F4CB} Position", value: queued.position === 0 ? "Now playing" : `#${queued.position}`, inline: true }
        ).setFooter({ text: "Club EZKEN DJ System \u2022 /skip /pause /stop /queue /volume" }).setTimestamp();
        const row = new ActionRowBuilder3().addComponents(
          new ButtonBuilder3().setCustomId("music:pause").setLabel("\u23F8 Pause").setStyle(ButtonStyle3.Secondary),
          new ButtonBuilder3().setCustomId("music:skip").setLabel("\u23ED Skip").setStyle(ButtonStyle3.Secondary),
          new ButtonBuilder3().setCustomId("music:stop").setLabel("\u23F9 Stop & Leave").setStyle(ButtonStyle3.Danger),
          new ButtonBuilder3().setCustomId("music:queue_btn").setLabel("\u{1F4CB} Queue").setStyle(ButtonStyle3.Primary)
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
        return;
      }
      if (commandName === "skip") {
        const prev = skipMusicTrack();
        if (!prev) {
          await interaction.reply({ content: "\u274C Nothing is playing right now.", ephemeral: true });
          return;
        }
        await interaction.reply({
          content: `\u23ED Skipped **${prev.title}**. ${musicCurrentTrack ? `Starting **${musicCurrentTrack.title}**.` : "The queue is empty."}`
        });
        return;
      }
      if (commandName === "pause") {
        if (!musicCurrentTrack) {
          await interaction.reply({ content: "\u274C Nothing is playing right now.", ephemeral: true });
          return;
        }
        const isPaused = musicPlayer.state.status === AudioPlayerStatus.Paused;
        if (isPaused) musicPlayer.unpause();
        else if (musicPlayer.state.status === AudioPlayerStatus.Playing) musicPlayer.pause();
        else {
          await interaction.reply({ content: "\u23F3 Playback is not ready yet.", ephemeral: true });
          return;
        }
        musicIsPlaying = isPaused;
        const embed = new EmbedBuilder3().setTitle(musicIsPlaying ? "\u25B6\uFE0F Resumed" : "\u23F8 Paused").setColor(musicIsPlaying ? 1096065 : 16498468).setDescription(`**${musicCurrentTrack.title}** has been ${musicIsPlaying ? "resumed" : "paused"}.`).setFooter({ text: "Club EZKEN DJ System" }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === "stop") {
        const hadTrack = musicCurrentTrack;
        leaveVoice(interaction.guildId || DISCORD_GUILD_ID);
        const embed = new EmbedBuilder3().setTitle("\u23F9 Music Stopped & Bot Disconnected").setColor(15010068).setDescription(hadTrack ? `Stopped **${hadTrack.title}**, cleared the queue, and disconnected ClubEZ from voice.` : "Music stopped, queue cleared, and disconnected from voice.").setFooter({ text: "Club EZKEN DJ System \u2022 Use /play to start again" }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === "queue") {
        const embed = new EmbedBuilder3().setTitle("\u{1F4CB} Music Queue \u2014 Club EZKEN").setColor(15010068).setFooter({ text: `Club EZKEN DJ System \u2022 ${musicQueue.length} song${musicQueue.length !== 1 ? "s" : ""} in queue` }).setTimestamp();
        if (!musicCurrentTrack && musicQueue.length === 0) {
          embed.setDescription("\u{1F3B5} The queue is empty! Use `/play` to add songs.");
        } else {
          const nowPlaying = musicCurrentTrack ? `**Now Playing:**
\u{1F3B5} ${musicCurrentTrack.title} \u2014 requested by ${musicCurrentTrack.requestedBy}

` : "";
          const queueList = musicQueue.slice(0, 10).map((t, i) => `**${i + 1}.** ${t.title} \u2014 *${t.requestedBy}*`).join("\n");
          embed.setDescription(
            nowPlaying + (queueList ? `**Up Next:**
${queueList}` : "No more songs in queue.") + (musicQueue.length > 10 ? `

*...and ${musicQueue.length - 10} more*` : "")
          );
        }
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === "nowplaying") {
        if (!musicCurrentTrack) {
          await interaction.reply({ content: "\u274C Nothing is playing right now. Use `/play` to start!", ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder3().setTitle("\u{1F3B5} Now Playing").setColor(15010068).setDescription(`**${musicCurrentTrack.title}**`).addFields(
          { name: "\u{1F3A4} Artist", value: musicCurrentTrack.artist, inline: true },
          { name: "\u{1F4E1} Source", value: musicCurrentTrack.source, inline: true },
          { name: "\u{1F464} Requested by", value: musicCurrentTrack.requestedBy, inline: true },
          { name: "\u{1F50A} Volume", value: `${musicVolume}%`, inline: true },
          { name: "\u{1F501} Loop", value: musicLoopMode, inline: true },
          { name: "\u{1F500} Shuffle", value: musicShuffleEnabled ? "On" : "Off", inline: true }
        ).setFooter({ text: "Club EZKEN DJ System" }).setTimestamp();
        const row = new ActionRowBuilder3().addComponents(
          new ButtonBuilder3().setCustomId("music:pause").setLabel(musicIsPlaying ? "\u23F8 Pause" : "\u25B6\uFE0F Resume").setStyle(ButtonStyle3.Secondary),
          new ButtonBuilder3().setCustomId("music:skip").setLabel("\u23ED Skip").setStyle(ButtonStyle3.Secondary),
          new ButtonBuilder3().setCustomId("music:stop").setLabel("\u23F9 Stop").setStyle(ButtonStyle3.Danger)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
        return;
      }
      if (commandName === "volume") {
        const level = interaction.options.getInteger("level", true);
        musicVolume = level;
        if (musicCurrentResource?.volume) musicCurrentResource.volume.setVolume(level / 100);
        const embed = new EmbedBuilder3().setTitle("\u{1F50A} Volume Updated").setColor(3057919).setDescription(`Volume set to **${level}%**
${"\u2588".repeat(Math.floor(level / 10))}${"\u2591".repeat(10 - Math.floor(level / 10))} ${level}%`).setFooter({ text: "Club EZKEN DJ System" }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === "loop") {
        musicLoopMode = musicLoopMode === "off" ? "track" : musicLoopMode === "track" ? "queue" : "off";
        const labels = { off: "\u274C Loop Off", track: "\u{1F502} Looping Current Track", queue: "\u{1F501} Looping Entire Queue" };
        const embed = new EmbedBuilder3().setTitle("\u{1F501} Loop Mode Changed").setColor(11032055).setDescription(`Loop mode is now: **${labels[musicLoopMode]}**`).setFooter({ text: "Club EZKEN DJ System" }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === "shuffle") {
        musicShuffleEnabled = !musicShuffleEnabled;
        if (musicShuffleEnabled && musicQueue.length > 1) {
          for (let i = musicQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [musicQueue[i], musicQueue[j]] = [musicQueue[j], musicQueue[i]];
          }
        }
        const embed = new EmbedBuilder3().setTitle(musicShuffleEnabled ? "\u{1F500} Shuffle Enabled" : "\u27A1\uFE0F Shuffle Disabled").setColor(musicShuffleEnabled ? 1096065 : 16498468).setDescription(musicShuffleEnabled ? `Queue shuffled! **${musicQueue.length}** songs randomized.` : "Shuffle has been turned off.").setFooter({ text: "Club EZKEN DJ System" }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === "remove") {
        const pos = interaction.options.getInteger("position", true);
        if (pos < 1 || pos > musicQueue.length) {
          await interaction.reply({ content: `\u274C Invalid position. Queue has **${musicQueue.length}** songs.`, ephemeral: true });
          return;
        }
        const removed = musicQueue.splice(pos - 1, 1)[0];
        const embed = new EmbedBuilder3().setTitle("\u{1F5D1}\uFE0F Song Removed").setColor(16498468).setDescription(`Removed **${removed.title}** from position #${pos}.`).setFooter({ text: "Club EZKEN DJ System" }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === "seek") {
        const seconds = interaction.options.getInteger("seconds", true);
        musicSeekPosition = seconds;
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        const embed = new EmbedBuilder3().setTitle("\u23E9 Seeked").setColor(3057919).setDescription(`Jumped to **${min}:${sec.toString().padStart(2, "0")}** in the current track.`).setFooter({ text: "Club EZKEN DJ System" }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === "lyrics") {
        const songName = interaction.options.getString("song") || musicCurrentTrack?.title;
        if (!songName) {
          await interaction.reply({ content: "\u274C Nothing is playing. Specify a song name or start playing first!", ephemeral: true });
          return;
        }
        await interaction.deferReply();
        const embed = new EmbedBuilder3().setTitle(`\u{1F4DD} Lyrics \u2014 ${songName}`).setColor(15010068).setDescription(`*Lyrics for* **${songName}**

> Lyrics integration coming soon! The bot fetches lyrics automatically via Genius API.

For now, [search on Genius \u2192](https://genius.com/search?q=${encodeURIComponent(songName)})`).setFooter({ text: "Club EZKEN DJ System \u2022 Powered by ClubEZ" }).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      if (commandName === "rank") {
        const db = loadXpDatabase();
        const userId = interaction.user.id;
        const userEntry = db.users[userId];
        if (!userEntry) {
          await interaction.reply({ content: "\u274C You have no XP yet! Start chatting or join a voice channel to earn XP.", ephemeral: true });
          return;
        }
        const sorted = Object.values(db.users).sort((a, b) => b.xp - a.xp);
        const rank = sorted.findIndex((u) => u.userId === userId) + 1;
        const tier = getTierRoleForLevel(userEntry.level);
        const xpForNext = Math.floor(120 * Math.pow(userEntry.level + 1, 1.85));
        const embed = new EmbedBuilder3().setTitle(`\u{1F3C5} ${userEntry.username} \u2014 Rank Card`).setColor(parseInt(tier.color.replace("#", ""), 16) || 15010068).addFields(
          { name: "\u{1F3C6} Server Rank", value: `#${rank} of ${sorted.length}`, inline: true },
          { name: "\u2B50 Level", value: `${userEntry.level}`, inline: true },
          { name: "\u2728 XP", value: `${userEntry.xp.toLocaleString()} / ${xpForNext.toLocaleString()}`, inline: true },
          { name: "\u{1F396} Tier", value: `@${tier.name}`, inline: true },
          { name: "\u{1F4AC} Messages", value: `${userEntry.totalMessages}`, inline: true },
          { name: "\u{1F399} Voice Minutes", value: `${userEntry.voiceMinutes}`, inline: true }
        ).setFooter({ text: "Club EZKEN XP System" }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === "leaderboard") {
        const db = loadXpDatabase();
        const sorted = Object.values(db.users).sort((a, b) => b.xp - a.xp).slice(0, 10);
        const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}", "4\uFE0F\u20E3", "5\uFE0F\u20E3", "6\uFE0F\u20E3", "7\uFE0F\u20E3", "8\uFE0F\u20E3", "9\uFE0F\u20E3", "\u{1F51F}"];
        const embed = new EmbedBuilder3().setTitle("\u{1F3C6} Club EZKEN \u2014 XP Leaderboard").setColor(16498468).setDescription(
          sorted.length === 0 ? "No members ranked yet! Start chatting to earn XP." : sorted.map((u, i) => {
            const tier = getTierRoleForLevel(u.level);
            return `${medals[i]} **${u.username}** \u2014 Level ${u.level} \xB7 ${u.xp.toLocaleString()} XP \xB7 @${tier.name}`;
          }).join("\n")
        ).setFooter({ text: "Club EZKEN XP System \u2022 Earn XP by chatting & staying in VC" }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
    } catch (cmdErr) {
      console.error(`[SLASH CMD ERROR /${commandName}]`, cmdErr.message);
      let errorMsg = cmdErr.message || "An unexpected error occurred";
      if (/aborted|timeout|timed out/i.test(errorMsg)) {
        errorMsg = "Voice connection timed out. Discord voice servers took too long to respond. Please try /play again.";
      }
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `\u274C Command error: ${errorMsg}`, ephemeral: true }).catch(() => {
        });
      } else if (interaction.deferred) {
        await interaction.editReply({ content: `\u274C Command error: ${errorMsg}` }).catch(() => {
        });
      }
    }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith("music:")) {
    const action = interaction.customId.split(":")[1];
    try {
      if (action === "pause") {
        if (!musicCurrentTrack) {
          await interaction.reply({ content: "Nothing is playing right now.", ephemeral: true });
          return;
        }
        const resume = musicPlayer.state.status === AudioPlayerStatus.Paused;
        if (resume) musicPlayer.unpause();
        else if (musicPlayer.state.status === AudioPlayerStatus.Playing) musicPlayer.pause();
        else {
          await interaction.reply({ content: "Playback is still loading.", ephemeral: true });
          return;
        }
        musicIsPlaying = resume;
        await interaction.reply({ content: resume ? "\u25B6\uFE0F Music resumed!" : "\u23F8 Music paused!", ephemeral: true });
      } else if (action === "skip") {
        const prev = skipMusicTrack();
        await interaction.reply({ content: prev ? `\u23ED Skipped **${prev.title}**.${musicCurrentTrack ? ` Now playing **${musicCurrentTrack.title}**` : " Queue is empty."}` : "Nothing is playing right now.", ephemeral: true });
      } else if (action === "stop") {
        leaveVoice(interaction.guildId || DISCORD_GUILD_ID);
        await interaction.reply({ content: "\u23F9 Music stopped, queue cleared, and ClubEZ disconnected from VC.", ephemeral: true });
      } else if (action === "queue_btn" || action === "queue") {
        const queueText = musicQueue.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join("\n");
        await interaction.reply({ content: musicQueue.length ? `\u{1F4CB} **Queue (${musicQueue.length}):**
${queueText}${musicQueue.length > 5 ? `
...+${musicQueue.length - 5} more` : ""}` : "\u{1F4CB} Queue is empty!", ephemeral: true });
      } else if (action === "shuffle") {
        musicShuffleEnabled = !musicShuffleEnabled;
        await interaction.reply({ content: musicShuffleEnabled ? "\u{1F500} Shuffle enabled!" : "\u27A1\uFE0F Shuffle disabled!", ephemeral: true });
      } else if (action === "loop") {
        musicLoopMode = musicLoopMode === "off" ? "track" : musicLoopMode === "track" ? "queue" : "off";
        await interaction.reply({ content: `\u{1F501} Loop: **${musicLoopMode}**`, ephemeral: true });
      } else if (action === "nowplaying") {
        await interaction.reply({ content: musicCurrentTrack ? `\u{1F3B5} Now Playing: **${musicCurrentTrack.title}**` : "\u274C Nothing playing.", ephemeral: true });
      } else if (action === "play_prompt") {
        await interaction.reply({ content: "\u{1F3B5} Use `/play <song name>` to add a song to the queue!", ephemeral: true });
      }
    } catch (btnErr) {
      console.error("[MUSIC BUTTON ERROR]", btnErr.message);
      if (!interaction.replied) await interaction.reply({ content: "\u274C Error handling music button.", ephemeral: true }).catch(() => {
      });
    }
    return;
  }
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("selfrole:")) return;
  try {
    const parts = interaction.customId.split(":");
    const rawTarget = (parts.length >= 3 ? parts.slice(2).join(":") : parts[1] || "").trim();
    const guildId = interaction.guildId || DISCORD_GUILD_ID;
    const userId = interaction.user.id;
    const roles = await fetchGuildRoles();
    const cleanTarget = rawTarget.replace(/^@+/, "").trim();
    const cleanTargetLower = cleanTarget.toLowerCase();
    let matchedRole = roles.find((r) => r.id === cleanTarget) || roles.find((r) => r.name.replace(/^@+/, "").trim().toLowerCase() === cleanTargetLower);
    if (!matchedRole && cleanTarget) {
      const createRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        method: "POST",
        headers: getDiscordHeaders(),
        body: JSON.stringify({
          name: cleanTarget,
          color: 3057919,
          mentionable: true
        })
      });
      if (createRes.ok) {
        matchedRole = await createRes.json();
      }
    }
    if (!matchedRole) {
      await interaction.reply({
        content: `\u26A0\uFE0F Could not find or create role **@${cleanTarget}** on the server. Check bot Manage Roles permission.`,
        ephemeral: true
      });
      return;
    }
    const displayRoleName = String(matchedRole.name || cleanTarget).replace(/^@+/, "").trim();
    const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: getDiscordHeaders()
    });
    const memberData = memberRes.ok ? await memberRes.json() : { roles: [] };
    const hasRole = Array.isArray(memberData.roles) && memberData.roles.includes(matchedRole.id);
    if (hasRole) {
      const remRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${matchedRole.id}`, {
        method: "DELETE",
        headers: getDiscordHeaders()
      });
      await interaction.reply({
        content: remRes.ok ? `\u2796 Removed **@${displayRoleName}** from your roles!` : `\u26A0\uFE0F Failed to remove role (Ensure ClubEZ bot's role is dragged ABOVE @${displayRoleName} in Discord Server Settings -> Roles).`,
        ephemeral: true
      });
    } else {
      const addRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${matchedRole.id}`, {
        method: "PUT",
        headers: getDiscordHeaders()
      });
      await interaction.reply({
        content: addRes.ok ? `\u2705 Assigned **@${displayRoleName}** to your profile!` : `\u26A0\uFE0F Failed to assign role (Ensure ClubEZ bot's role is dragged ABOVE @${displayRoleName} in Discord Server Settings -> Roles).`,
        ephemeral: true
      });
    }
  } catch (err) {
    console.error("[SELF ROLE INTERACTION ERROR]", err.message);
    if (!interaction.replied) {
      await interaction.reply({ content: `\u26A0\uFE0F Error toggling role: ${err.message}`, ephemeral: true }).catch(() => {
      });
    }
  }
});
var WELCOME_CONFIG_PATH = path3.join(__dirname2, "welcome_config.json");
var DEFAULT_WELCOME_CONFIG = {
  enabled: true,
  channelName: "lounge-welcome",
  messageTemplate: "\u{1F389} Welcome {user} to **{guild}**! You are our **#{count}** member!",
  autoRoleName: "NONE",
  dmWelcome: true,
  dmTemplate: "Welcome to **{guild}**! Check out our server rules and self-roles to get started!",
  canvas: {
    width: 1e3,
    height: 450,
    borderRadius: 22,
    bgGradientStart: "#09090B",
    bgGradientMid: "#121218",
    bgGradientEnd: "#200A0D",
    borderColor: "#3F1218",
    borderWidth: 3,
    topStripeColor: "#E50914",
    topStripeHeight: 8,
    avatarSize: 170,
    avatarBorderColor: "#E50914",
    avatarBorderWidth: 6,
    welcomeText: "WELCOME TO",
    welcomeTextColor: "#E50914",
    welcomeTextSize: 24,
    guildText: "CLUB EZKEN",
    guildTextColor: "#FFFFFF",
    guildTextSize: 48,
    usernameColor: "#E4E4E7",
    usernameSize: 26,
    countTextTemplate: "MEMBER #{count}",
    countTextColor: "#A1A1AA",
    countTextSize: 18,
    fontFamily: "sans-serif"
  }
};
var welcomeConfig = { ...DEFAULT_WELCOME_CONFIG };
try {
  if (fs3.existsSync(WELCOME_CONFIG_PATH)) {
    const raw = fs3.readFileSync(WELCOME_CONFIG_PATH, "utf-8");
    welcomeConfig = { ...DEFAULT_WELCOME_CONFIG, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn("[SERVER] Could not load welcome_config.json, using defaults:", e.message);
}
function saveWelcomeConfig(newCfg) {
  welcomeConfig = newCfg;
  try {
    fs3.writeFileSync(WELCOME_CONFIG_PATH, JSON.stringify(welcomeConfig, null, 2), "utf-8");
  } catch (e) {
    console.error("[SERVER] Failed to save welcome_config.json:", e.message);
  }
}
async function generateWelcomeCardBuffer(username, memberCount, avatarUrl, guildName, c) {
  const width = c.width || 1e3;
  const height = c.height || 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, c.bgGradientStart || "#09090B");
  bg.addColorStop(0.5, c.bgGradientMid || "#121218");
  bg.addColorStop(1, c.bgGradientEnd || "#200A0D");
  ctx.fillStyle = bg;
  roundRect(0, 0, width, height, c.borderRadius || 22);
  ctx.fill();
  const glow = ctx.createRadialGradient(width / 2, 140, 30, width / 2, 140, 260);
  glow.addColorStop(0, `${c.topStripeColor || "#E50914"}30`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = c.borderColor || "#3F1218";
  ctx.lineWidth = c.borderWidth || 3;
  roundRect(1, 1, width - 2, height - 2, c.borderRadius || 22);
  ctx.stroke();
  if ((c.topStripeHeight || 8) > 0) {
    ctx.save();
    roundRect(0, 0, width, height, c.borderRadius || 22);
    ctx.clip();
    ctx.fillStyle = c.topStripeColor || "#E50914";
    ctx.fillRect(0, 0, width, c.topStripeHeight || 8);
    ctx.restore();
  }
  const avatarSize = c.avatarSize || 170;
  const avatarX = (width - avatarSize) / 2;
  const avatarY = 55;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + (c.avatarBorderWidth || 6) / 2, 0, Math.PI * 2);
  ctx.strokeStyle = c.avatarBorderColor || "#E50914";
  ctx.lineWidth = c.avatarBorderWidth || 6;
  ctx.stroke();
  ctx.closePath();
  let loaded = false;
  if (avatarUrl) {
    try {
      const img = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      loaded = true;
    } catch {
      loaded = false;
    }
  }
  if (!loaded) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#1A1A22";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold 72px ${c.fontFamily || "sans-serif"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((username.charAt(0) || "U").toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    ctx.restore();
  }
  const fontFam = c.fontFamily || "sans-serif";
  ctx.fillStyle = c.welcomeTextColor || "#E50914";
  ctx.font = `bold ${c.welcomeTextSize || 24}px ${fontFam}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText((c.welcomeText || "WELCOME TO").toUpperCase(), width / 2, 275);
  ctx.fillStyle = c.guildTextColor || "#FFFFFF";
  ctx.font = `900 ${c.guildTextSize || 48}px ${fontFam}`;
  ctx.fillText((c.guildText || guildName || "CLUB EZKEN").toUpperCase(), width / 2, 330);
  ctx.fillStyle = c.usernameColor || "#E4E4E7";
  ctx.font = `bold ${c.usernameSize || 26}px ${fontFam}`;
  const cleanName = username.length > 22 ? username.substring(0, 21) + "\u2026" : username;
  ctx.fillText(cleanName, width / 2, 375);
  ctx.fillStyle = c.countTextColor || "#A1A1AA";
  ctx.font = `bold ${c.countTextSize || 18}px ${fontFam}`;
  const countStr = (c.countTextTemplate || "MEMBER #{count}").replace("{count}", memberCount.toLocaleString());
  ctx.fillText(countStr, width / 2, 410);
  return canvas.toBuffer("image/png");
}
var MOD_RECORDS_PATH = path3.join(__dirname2, "moderation_records.json");
function loadModRecords() {
  try {
    if (fs3.existsSync(MOD_RECORDS_PATH)) {
      const raw = fs3.readFileSync(MOD_RECORDS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        cases: Array.isArray(parsed.cases) ? parsed.cases : [],
        deletedMessages: Array.isArray(parsed.deletedMessages) ? parsed.deletedMessages : []
      };
    }
  } catch (err) {
    console.warn("[SERVER] Could not read moderation_records.json:", err.message);
  }
  return { cases: [], deletedMessages: [] };
}
function saveModRecords(data) {
  try {
    fs3.writeFileSync(MOD_RECORDS_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[SERVER] Failed to save moderation_records.json:", err.message);
  }
}
var recentMessagesCache = /* @__PURE__ */ new Map();
function cacheIncomingMessage(msg) {
  if (!msg || msg.author?.bot) return;
  recentMessagesCache.set(msg.id, {
    id: msg.id,
    content: msg.content || "",
    author: {
      id: msg.author.id,
      tag: msg.author.tag || msg.author.username,
      username: msg.author.username,
      avatar: msg.author.displayAvatarURL({ size: 128 }) || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80"
    },
    channelId: msg.channelId,
    channelName: msg.channel.name || "general",
    timestamp: msg.createdTimestamp || Date.now()
  });
  if (recentMessagesCache.size > 2e3) {
    const oldestKey = recentMessagesCache.keys().next().value;
    if (oldestKey) recentMessagesCache.delete(oldestKey);
  }
}
async function generateSmartAiWarningAndAdvice(username, deletedContent, categories, reason, channelName) {
  let smartWarning = "";
  let whatHappened = `User sent an unauthorized message in #${channelName} violating community guidelines (${categories.join(", ") || reason}).`;
  let adviceDo = "Engage positively in discussion, follow channel topics, and respect community members.";
  let adviceDont = "Do not post unauthorized server invites, scam links, hate speech, or toxic insults.";
  const prompt = `You are the Official Smart Moderation AI for Discord server "Club EZKEN".
A user named "@${username}" sent this message in channel "#${channelName}" which was automatically deleted:
"${deletedContent.replace(/"/g, '\\"')}"
Reason / Infraction: ${reason}
Violation Categories: ${categories.join(", ")}

Analyze the exact text they sent and generate:
1. "whatHappened": A clear 1-line audit summary of what the user wrote and why it was deleted.
\u200B2. "adviceDo": Concrete, helpful advice specifically on WHAT TO DO in Club EZKEN (e.g. how they should behave, where to talk, how to earn XP respectfully).
3. "adviceDont": Concrete advice on WHAT NOT TO DO (e.g. specific prohibited actions according to what they did).
4. "smartWarning": A direct, personalized Discord warning message addressed to @${username} that clearly explains what they wrote, why it was wrong, and provides the DO and DON'T guidance. Keep it firm, constructive, respectful, and under 80 words.

Return strictly a JSON object.`;
  if (aiClient) {
    try {
      const resp = await aiClient.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              whatHappened: { type: Type.STRING },
              adviceDo: { type: Type.STRING },
              adviceDont: { type: Type.STRING },
              smartWarning: { type: Type.STRING }
            },
            required: ["whatHappened", "adviceDo", "adviceDont", "smartWarning"]
          }
        }
      });
      if (resp.text) {
        const parsed = JSON.parse(resp.text.trim());
        if (parsed.smartWarning) smartWarning = parsed.smartWarning;
        if (parsed.whatHappened) whatHappened = parsed.whatHappened;
        if (parsed.adviceDo) adviceDo = parsed.adviceDo;
        if (parsed.adviceDont) adviceDont = parsed.adviceDont;
      }
    } catch (err) {
      console.warn("[SMART AI WARNING GENERATION NOTICE]", err.message);
    }
  }
  if (!smartWarning) {
    smartWarning = `\u26A0\uFE0F **Club EZKEN Smart AI Warning (@${username})**: Your message in **#${channelName}** was deleted for **${categories.join(", ") || reason}**.
\u2705 **What to do**: ${adviceDo}
\u274C **What NOT to do**: ${adviceDont}`;
  }
  return { smartWarning, whatHappened, adviceDo, adviceDont };
}
discordBot.on(Events.MessageCreate, async (message) => {
  if (!message || message.author?.bot) return;
  cacheIncomingMessage(message);
  const text = message.content || "";
  if (!text) return;
  if (await handleMusicTextCommand(message, text)) return;
  const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discord\.com\/invite)\/[a-zA-Z0-9-]+/gi;
  const phishingRegex = /(free\s+discord\s+nitro|gift-discord|steam-free|claim\s+here\s+fast|http:\/\/[^\s]*fake)/i;
  const toxicRegex = /\b(idiot|idiots|trash|stupid|moron|loser|stfu|kill yourself|kys|garbage|scum|nigger|faggot|retard)\b/i;
  let flagged = false;
  let reason = "";
  let categories = [];
  let suggestedAction = "WARN";
  if (inviteRegex.test(text)) {
    flagged = true;
    reason = "Unauthorized external Discord server invite link posted.";
    categories = ["UNAUTHORIZED_INVITE"];
    suggestedAction = "DELETE";
  } else if (phishingRegex.test(text)) {
    flagged = true;
    reason = "Malicious phishing link or fake Nitro scam detected.";
    categories = ["PHISHING_SCAM"];
    suggestedAction = "BAN";
  } else if (toxicRegex.test(text)) {
    flagged = true;
    reason = "Toxic insults, profanity, or harassment targeting community members.";
    categories = ["TOXICITY", "HARASSMENT"];
    suggestedAction = "WARN";
  }
  if (!flagged) {
    await handleUserMessageXp(message);
    return;
  }
  const authorTag = message.author.tag || message.author.username;
  const authorId = message.author.id;
  const channelName = message.channel.name || "general";
  const avatarUrl = message.author.displayAvatarURL({ size: 128 }) || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80";
  console.log(`[DISCORD AUTO-MOD] Intercepting offending message by @${authorTag} in #${channelName}: "${text}"`);
  await message.delete().catch((err) => {
    console.warn("[DISCORD AUTO-MOD] Could not delete message (Manage Messages perm required):", err.message);
  });
  const { smartWarning, whatHappened, adviceDo, adviceDont } = await generateSmartAiWarningAndAdvice(
    authorTag,
    text,
    categories,
    reason,
    channelName
  );
  const db = loadModRecords();
  const caseNumber = `#000${db.cases.length + 1}`;
  const recordId = `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newDeletedRecord = {
    id: recordId,
    case_id: caseNumber,
    user_id: authorId,
    user_tag: authorTag,
    user_avatar: avatarUrl,
    channel_name: `#${channelName}`,
    deleted_content: text,
    timestamp: Date.now(),
    what_happened: whatHappened,
    smart_ai_warning: smartWarning,
    warning_advice_do: adviceDo,
    warning_advice_dont: adviceDont,
    violation_categories: categories,
    ai_confidence: 0.98,
    action_taken: suggestedAction === "BAN" ? "DELETED_AND_BANNED" : "DELETED_AND_WARNED",
    warning_sent: true,
    messages_sent: [
      {
        id: `msg_${Date.now()}`,
        sender: "BOT_AI",
        senderName: "Club EZKEN Smart AI Shield",
        text: smartWarning,
        timestamp: Date.now(),
        deliveryMethod: "DISCORD_DM",
        deliveredLive: true
      }
    ]
  };
  const newCaseRecord = {
    id: Date.now(),
    case_id: caseNumber,
    user_id: authorId,
    user_tag: authorTag,
    moderator_id: discordBot.user?.id || "bot_automod",
    moderator_tag: "ClubEZ (Smart AI Shield)",
    action_type: suggestedAction === "BAN" ? "BAN" : "WARN",
    reason: `${reason} \u2014 ${whatHappened}`,
    deleted_message: text,
    timestamp: Date.now(),
    channel_name: `#${channelName}`
  };
  db.deletedMessages.unshift(newDeletedRecord);
  db.cases.unshift(newCaseRecord);
  saveModRecords(db);
  let dmDelivered = false;
  try {
    const dmEmbed = new EmbedBuilder3().setTitle("\u{1F6E1}\uFE0F Club EZKEN \u2022 Smart AI Moderation Notice").setColor(15010068).setDescription(`Your message in **#${channelName}** was automatically removed for **${categories.join(", ")}**.`).addFields(
      { name: "Deleted Message", value: `\`\`\`${text.substring(0, 300)}\`\`\`` },
      { name: "\u2705 What to Do", value: adviceDo },
      { name: "\u274C What NOT to Do", value: adviceDont },
      { name: "Official Guidance", value: smartWarning }
    ).setFooter({ text: `Case ${caseNumber} \u2022 Club EZKEN Community Standards` }).setTimestamp();
    await message.author.send({ embeds: [dmEmbed] });
    dmDelivered = true;
  } catch {
    try {
      const pingNotice = await message.channel.send({
        content: `\u26A0\uFE0F <@${authorId}>: Your message was deleted for **${categories.join(", ")}**. Please check server rules and follow Club EZKEN guidelines!`
      });
      setTimeout(() => pingNotice.delete().catch(() => {
      }), 15e3);
    } catch {
    }
  }
  try {
    const modLogsChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) || await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null);
    if (modLogsChan && modLogsChan.isTextBased()) {
      const auditEmbed = new EmbedBuilder3().setTitle(`\u{1F6E1}\uFE0F AUTO-MODERATION INTERCEPTION \u2022 ${suggestedAction}`).setColor(15010068).setDescription(
        `**Offender**: <@${authorId}> (\`${authorTag}\` \u2022 ID: \`${authorId}\`)
**Channel**: <#${message.channelId}> (#${channelName})
**Violation**: **${categories.join(", ")}** (${reason})
**Case**: \`${caseNumber}\`

**Deleted Offending Content**:
\`\`\`${text.substring(0, 400)}\`\`\``
      ).addFields(
        { name: "\u{1F916} Smart AI Analysis", value: whatHappened },
        { name: "\u2705 Advice (What to Do)", value: adviceDo },
        { name: "\u274C Advice (What NOT to Do)", value: adviceDont },
        { name: "\u{1F4E9} Warning Dispatch", value: dmDelivered ? "\u2705 Direct Message delivered to user" : "\u26A0\uFE0F User DMs closed (Channel ping dispatched)" }
      ).setFooter({ text: "Club EZKEN Smart AI Moderation Suite" }).setTimestamp();
      await modLogsChan.send({ embeds: [auditEmbed] });
      console.log(`[DISCORD AUTO-MOD] Successfully posted interception audit to #mod-logs (${MOD_LOGS_CHANNEL_ID})!`);
    }
  } catch (err) {
    console.warn("[DISCORD AUTO-MOD] Error posting to #mod-logs:", err.message);
  }
});
discordBot.on(Events.MessageDelete, async (message) => {
  try {
    const cached = recentMessagesCache.get(message.id);
    const content = cached?.content || (message.content ? message.content : null);
    const authorTag = cached?.author.tag || (message.author ? message.author.tag : "Member");
    const authorId = cached?.author.id || (message.author ? message.author.id : "Unknown");
    const authorAvatar = cached?.author.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80";
    const chanName = cached?.channelName || (message.channel?.name ? message.channel.name : "channel");
    const chanId = message.channelId;
    if (!content) return;
    const db = loadModRecords();
    const alreadyLogged = db.deletedMessages.some(
      (d) => d.id === message.id || d.deleted_content === content && Date.now() - d.timestamp < 1e4
    );
    if (alreadyLogged) return;
    const recordId = message.id || `del_${Date.now()}`;
    const caseNumber = `#000${db.cases.length + 1}`;
    const newDel = {
      id: recordId,
      case_id: caseNumber,
      user_id: authorId,
      user_tag: authorTag,
      user_avatar: authorAvatar,
      channel_name: `#${chanName}`,
      deleted_content: content,
      timestamp: Date.now(),
      what_happened: `Message was deleted in #${chanName}. Intercepted by bot gateway cache.`,
      smart_ai_warning: `A message in #${chanName} was deleted. Please ensure all shared content follows Club EZKEN guidelines.`,
      warning_advice_do: "Follow channel topics and keep discussions constructive.",
      warning_advice_dont: "Do not post content that violates server rules or requires deletion.",
      violation_categories: ["MESSAGE_DELETION"],
      ai_confidence: 0.95,
      action_taken: "MESSAGE_DELETED",
      warning_sent: false,
      messages_sent: []
    };
    db.deletedMessages.unshift(newDel);
    saveModRecords(db);
    console.log(`[DISCORD BOT] Message deleted in #${chanName} by @${authorTag}: "${content.substring(0, 50)}"`);
    const modLogsChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) || await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null);
    if (modLogsChan && modLogsChan.isTextBased()) {
      const embed = new EmbedBuilder3().setTitle("\u{1F5D1}\uFE0F MESSAGE DELETED AUDIT LOG").setColor(7434618).setDescription(
        `**Author**: <@${authorId}> (\`${authorTag}\`)
**Channel**: <#${chanId}> (#${chanName})
**Audit Record ID**: \`${recordId}\`

**Deleted Message Content**:
\`\`\`${content.substring(0, 500)}\`\`\``
      ).setFooter({ text: "Club EZKEN Real-Time Audit System" }).setTimestamp();
      await modLogsChan.send({ embeds: [embed] }).catch(() => {
      });
    }
  } catch (err) {
    console.error("[MESSAGE DELETE HANDLER ERROR]", err.message);
  }
});
discordBot.on(Events.ChannelCreate, (channel) => {
  console.log(`[DISCORD BOT] Channel created: #${channel.name || channel.id} \u2014 Server state synchronized immediately!`);
});
discordBot.on(Events.ChannelDelete, (channel) => {
  console.log(`[DISCORD BOT] Channel deleted: #${channel.name || channel.id} \u2014 Server state synchronized immediately!`);
});
discordBot.on(Events.ChannelUpdate, (_oldChan, newChan) => {
  console.log(`[DISCORD BOT] Channel updated: #${newChan.name || newChan.id} \u2014 Server state synchronized immediately!`);
});
discordBot.on(Events.GuildRoleCreate, (role) => {
  console.log(`[DISCORD BOT] Role created: @${role.name} \u2014 Server state synchronized immediately!`);
});
discordBot.on(Events.GuildRoleDelete, (role) => {
  console.log(`[DISCORD BOT] Role deleted: @${role.name} \u2014 Server state synchronized immediately!`);
});
discordBot.on(Events.GuildRoleUpdate, (_oldRole, newRole) => {
  console.log(`[DISCORD BOT] Role updated: @${newRole.name} \u2014 Server state synchronized immediately!`);
});
discordBot.on(Events.GuildMemberAdd, async (member) => {
  if (!welcomeConfig.enabled) return;
  try {
    const guild = member.guild;
    const count = guild.memberCount;
    const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
    const username = member.user.username;
    console.log(`[DISCORD BOT] GuildMemberAdd: @${member.user.tag} joined ${guild.name} (Total: ${count})`);
    const cardBuffer = await generateWelcomeCardBuffer(
      username,
      count,
      avatarUrl,
      guild.name,
      welcomeConfig.canvas
    );
    const channels = await fetchGuildChannels();
    const cleanTargetName = welcomeConfig.channelName.replace("#", "").toLowerCase();
    const targetChanMeta = channels.find(
      (c) => c.name.toLowerCase() === cleanTargetName || c.name.toLowerCase().includes(cleanTargetName) || c.name.toLowerCase().includes("welcome")
    );
    const targetChannelId = targetChanMeta ? targetChanMeta.id : null;
    let targetChannel = null;
    if (targetChannelId) {
      targetChannel = discordBot.channels.cache.get(targetChannelId) || await discordBot.channels.fetch(targetChannelId).catch(() => null);
    }
    const welcomeMsg = welcomeConfig.messageTemplate.replace("{user}", `<@${member.id}>`).replace("{guild}", guild.name).replace("{count}", count.toString());
    if (targetChannel && targetChannel.isTextBased()) {
      const attachment = new AttachmentBuilder2(cardBuffer, { name: `welcome-${member.id}.png` });
      await targetChannel.send({
        content: welcomeMsg,
        files: [attachment]
      });
      console.log(`[DISCORD BOT] Successfully posted Welcome Card for @${member.user.tag} into #${targetChannel.name}!`);
    } else {
      console.warn(`[DISCORD BOT] Could not find welcome channel #${welcomeConfig.channelName}`);
    }
    let assignedRoleName = null;
    const targetArrivalRole = (welcomeConfig.autoRoleName || "").trim();
    if (targetArrivalRole && targetArrivalRole.toUpperCase() !== "NONE") {
      const cleanTarget = targetArrivalRole.replace(/^@+/, "").toLowerCase();
      const matchedRole = guild.roles.cache.find(
        (r) => r.id === targetArrivalRole || r.name.replace(/^@+/, "").trim().toLowerCase() === cleanTarget
      );
      if (matchedRole) {
        await member.roles.add(matchedRole).catch((err) => {
          console.warn(`[DISCORD BOT] Failed to assign role @${matchedRole.name}:`, err.message);
        });
        assignedRoleName = matchedRole.name;
        console.log(`[DISCORD BOT] Assigned customizable arrival role @${matchedRole.name} to @${member.user.tag}`);
      } else {
        console.warn(`[DISCORD BOT] Configured arrival role "${targetArrivalRole}" not found in server roles.`);
      }
    } else {
      console.log(`[DISCORD BOT] No arrival role configured (Set to None/Clean Join).`);
    }
    if (welcomeConfig.dmWelcome) {
      const dmMsg = welcomeConfig.dmTemplate.replace("{user}", member.user.username).replace("{guild}", guild.name).replace("{count}", count.toString());
      const dmAttachment = new AttachmentBuilder2(cardBuffer, { name: "welcome-card.png" });
      await member.send({ content: dmMsg, files: [dmAttachment] }).catch(() => {
        console.log(`[DISCORD BOT] Member @${member.user.tag} has direct messages disabled.`);
      });
    }
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) || await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null);
    if (modLogChan && modLogChan.isTextBased()) {
      const roleText = assignedRoleName ? ` Role **@${assignedRoleName}** assigned.` : " (No arrival role assigned).";
      await modLogChan.send({
        content: `\u{1F389} **[GATEWAY AUDIT] New Member Joined** \u2022 <@${member.id}> joined **${guild.name}** as **Member #${count}**!${roleText}`
      }).catch(() => {
      });
    }
  } catch (err) {
    console.error("[GUILD MEMBER ADD HANDLER ERROR]", err.message);
  }
});
discordBot.on(Events.GuildMemberRemove, async (member) => {
  try {
    const guild = member.guild;
    const newCount = guild.memberCount;
    const userTag = member.user?.tag || member.displayName || "Unknown Member";
    const userId = member.id;
    console.log(`[DISCORD BOT] GuildMemberRemove: @${userTag} left ${guild.name}. Recalculated total members: ${newCount}`);
    let aiNote = `\u{1F4C9} **[SMART AI AUDIT \u2022 MEMBER DEPARTURE]**
Member **@${userTag}** (\`${userId}\`) has departed from **${guild.name}**.
\u{1F4CA} **Recalculated Total**: **${newCount} members** (-1 deduction applied).
\u26A1 **Counter Synchronized**: The next joining member will continue onwards numbered **#${newCount + 1}**.`;
    if (aiClient) {
      try {
        const aiPrompt = `A member departed from Discord server "${guild.name}".
Member: @${userTag} (ID: ${userId}).
The total member count has just decreased by 1 and is now exactly ${newCount} members.
The next incoming member slot is now accurately synchronized to #${newCount + 1}.
Generate a sharp, professional 2-line Discord audit note for #mod-logs confirming the departure, reporting the recalculated total of ${newCount} members, and confirming the next joining member will be numbered #${newCount + 1}. Use Discord Markdown.`;
        const resp = await aiClient.models.generateContent({
          model: "gemini-3.8-flash",
          contents: aiPrompt
        });
        if (resp.text) {
          aiNote = `\u{1F4C9} **[SMART AI AUDIT \u2022 MEMBER DEPARTURE]**
${resp.text.trim()}
*Recalculated Total: ${newCount} members \u2022 Next Welcome Slot: #${newCount + 1}*`;
        }
      } catch (aiErr) {
        console.warn("[GEMINI DEPARTURE AUDIT NOTE ERROR]", aiErr.message);
      }
    }
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) || await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null);
    if (modLogChan && modLogChan.isTextBased()) {
      await modLogChan.send({ content: aiNote }).catch(() => {
      });
    }
  } catch (err) {
    console.error("[GUILD MEMBER REMOVE HANDLER ERROR]", err.message);
  }
});
discordBot.login(DISCORD_TOKEN).catch((err) => {
  console.warn("[DISCORD BOT] Gateway login notice:", err.message);
});
var OFFICIAL_LEVEL_TIERS_CONFIG = {
  1: {
    level: 1,
    name: "ROOKIE",
    color: "#00A8FC",
    xpRequired: 0,
    features: ["Basic Text Chatting", "Voice Chat Speaking"],
    description: "Starter tier. Restricted from posting links, rich embeds, image attachments, or external emojis/stickers."
  },
  10: {
    level: 10,
    name: "INSIDER",
    color: "#2DD4BF",
    xpRequired: 8495,
    features: ["Posting Web Links", "Attach Files & Images"],
    description: "Unlocks uploading screenshots, game recordings, and sharing web URLs in text channels."
  },
  20: {
    level: 20,
    name: "RESIDENT",
    color: "#38BDF8",
    xpRequired: 30627,
    features: ["Posting GIFs (Tenor)", "Rich Embed Previews", "Video Embeds"],
    description: "Unlocks animated GIF picker via Tenor and automatic link rich preview embeds in chat."
  },
  30: {
    level: 30,
    name: "CLUB REGULAR",
    color: "#FBBF24",
    xpRequired: 64960,
    features: ["Use External Emojis", "Use External Stickers"],
    description: "Unlocks using custom emojis and animated stickers from other Discord servers."
  },
  40: {
    level: 40,
    name: "HYPEMASTER",
    color: "#F97316",
    xpRequired: 110653,
    features: ["Create Public Threads", "Priority Speaker in VC"],
    description: "Unlocks creating topic threads and priority voice volume override in voice lobbies."
  },
  55: {
    level: 55,
    name: "ASCENDANT",
    color: "#EF4444",
    xpRequired: 199444,
    features: ["Voice Soundboard", "Use External Sounds"],
    description: "Unlocks playing custom soundboard sound effects and clips in voice channels."
  },
  70: {
    level: 70,
    name: "CLUB TITAN",
    color: "#E11D48",
    xpRequired: 310033,
    features: ["VIP Lounge Access", "High-Tier Scrim Channels"],
    description: "Grants access to private VIP text channels and high-tier competitive scrim rooms."
  },
  85: {
    level: 85,
    name: "THE IMMORTAL",
    color: "#FFFFFF",
    xpRequired: 442159,
    features: ["Custom Nickname", "Voice Activity Detection (No PTT needed)"],
    description: "Unlocks custom server nickname formatting and unconstrained voice activity."
  },
  100: {
    level: 100,
    name: "STAR SUPPORTER",
    color: "#EC4899",
    xpRequired: 601438,
    features: ["Max Prestige Badge", "Hall of Fame Showcase", "Event Host Pings"],
    description: "Ultimate Club EZKEN status! Inducted into Hall of Fame with event host pings."
  }
};
var ALLOWED_LEVEL_ROLES = {
  "ROOKIE": "#00A8FC",
  "INSIDER": "#2DD4BF",
  "RESIDENT": "#38BDF8",
  "CLUB REGULAR": "#FBBF24",
  "HYPEMASTER": "#F97316",
  "ASCENDANT": "#EF4444",
  "CLUB TITAN": "#E11D48",
  "THE IMMORTAL": "#FFFFFF",
  "STAR SUPPORTER": "#EC4899"
};
var levelTiers = {
  1: { name: "ROOKIE", color: "#00A8FC" },
  10: { name: "INSIDER", color: "#2DD4BF" },
  20: { name: "RESIDENT", color: "#38BDF8" },
  30: { name: "CLUB REGULAR", color: "#FBBF24" },
  40: { name: "HYPEMASTER", color: "#F97316" },
  55: { name: "ASCENDANT", color: "#EF4444" },
  70: { name: "CLUB TITAN", color: "#E11D48" },
  85: { name: "THE IMMORTAL", color: "#FFFFFF" },
  100: { name: "STAR SUPPORTER", color: "#EC4899" }
};
function getXpRequiredForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(120 * Math.pow(level, 1.85));
}
function getLevelFromXp(xp) {
  if (xp <= 0) return 1;
  let level = 1;
  while (level < 100 && xp >= getXpRequiredForLevel(level + 1)) {
    level++;
  }
  return level;
}
function getTierRoleForLevel(level) {
  const tiers = [100, 85, 70, 55, 40, 30, 20, 10, 1];
  for (const t of tiers) {
    if (level >= t) {
      return OFFICIAL_LEVEL_TIERS_CONFIG[t];
    }
  }
  return OFFICIAL_LEVEL_TIERS_CONFIG[1];
}
function getAllUnlockedFeaturesForLevel(level) {
  const allFeatures = [];
  const tiers = [1, 10, 20, 30, 40, 55, 70, 85, 100];
  for (const t of tiers) {
    if (level >= t) {
      allFeatures.push(...OFFICIAL_LEVEL_TIERS_CONFIG[t].features);
    }
  }
  return Array.from(new Set(allFeatures));
}
function getNewlyUnlockedFeatures(oldLevel, newLevel) {
  const oldFeatures = new Set(getAllUnlockedFeaturesForLevel(oldLevel));
  const newFeatures = getAllUnlockedFeaturesForLevel(newLevel);
  return newFeatures.filter((f) => !oldFeatures.has(f));
}
var XP_DATABASE_PATH = path3.join(__dirname2, "xp_database.json");
function loadXpDatabase() {
  try {
    if (fs3.existsSync(XP_DATABASE_PATH)) {
      const raw = fs3.readFileSync(XP_DATABASE_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[SERVER] Could not load xp_database.json, creating initial store:", err.message);
  }
  return { users: {} };
}
function saveXpDatabase(db) {
  try {
    fs3.writeFileSync(XP_DATABASE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[SERVER] Failed to save xp_database.json:", err.message);
  }
}
var userMessageCooldowns = /* @__PURE__ */ new Map();
var activeVoiceSessions = /* @__PURE__ */ new Map();
async function awardXpToUser(db, userId, username, avatar, xpGain, voiceMinutesGain, source, contextChannel) {
  if (!db.users[userId]) {
    db.users[userId] = {
      userId,
      username: username || `User_${userId.slice(-4)}`,
      avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80",
      xp: 0,
      level: 1,
      totalMessages: 0,
      voiceMinutes: 0,
      lastMessageTimestamp: 0,
      tierRole: "ROOKIE",
      unlockedFeatures: getAllUnlockedFeaturesForLevel(1)
    };
  }
  const u = db.users[userId];
  if (username) u.username = username;
  if (avatar) u.avatar = avatar;
  const oldLevel = u.level;
  u.xp += xpGain;
  if (voiceMinutesGain > 0) {
    u.voiceMinutes += voiceMinutesGain;
  }
  if (source === "TEXT") {
    u.totalMessages += 1;
    u.lastMessageTimestamp = Date.now();
  }
  const newLevel = getLevelFromXp(u.xp);
  u.level = newLevel;
  const currentTier = getTierRoleForLevel(newLevel);
  u.tierRole = currentTier.name;
  u.unlockedFeatures = getAllUnlockedFeaturesForLevel(newLevel);
  const leveledUp = newLevel > oldLevel;
  const newlyUnlocked = leveledUp ? getNewlyUnlockedFeatures(oldLevel, newLevel) : [];
  if (leveledUp) {
    console.log(`[LEVELING PROMOTION] @${username} (${userId}) leveled up: Level ${oldLevel} \u2794 Level ${newLevel} (@${currentTier.name})`);
    await assignLevelRoleToMember(userId, currentTier.name);
    await announceLevelUp(userId, username, oldLevel, newLevel, currentTier, newlyUnlocked, source, contextChannel);
  }
  return {
    leveledUp,
    oldLevel,
    newLevel,
    tierRole: currentTier,
    newlyUnlocked,
    totalXp: u.xp
  };
}
async function assignLevelRoleToMember(userId, tierRoleName) {
  try {
    const roles = await fetchGuildRoles();
    const cleanTarget = tierRoleName.replace(/^@+/, "").trim().toLowerCase();
    let targetRole = roles.find((r) => r.name.replace(/^@+/, "").trim().toLowerCase() === cleanTarget);
    if (!targetRole) {
      const tierConfig = Object.values(OFFICIAL_LEVEL_TIERS_CONFIG).find((t) => t.name.toLowerCase() === cleanTarget);
      const colorInt = tierConfig ? parseInt(tierConfig.color.replace("#", ""), 16) : 43260;
      const createRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
        method: "POST",
        headers: getDiscordHeaders(),
        body: JSON.stringify({
          name: tierRoleName,
          color: colorInt,
          hoist: true,
          mentionable: true
        })
      });
      if (createRes.ok) {
        targetRole = await createRes.json();
      }
    }
    if (targetRole) {
      await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${targetRole.id}`, {
        method: "PUT",
        headers: getDiscordHeaders()
      });
      console.log(`[LEVELING] Assigned role @${tierRoleName} to member ${userId}`);
    }
  } catch (err) {
    console.warn(`[LEVELING] Error assigning role @${tierRoleName}:`, err.message);
  }
}
async function announceLevelUp(userId, username, oldLevel, newLevel, tier, newlyUnlocked, source, contextChannel) {
  try {
    const colorInt = parseInt(tier.color.replace("#", ""), 16) || 15010068;
    const embed = new EmbedBuilder3().setTitle(`\u2694\uFE0F LEVEL UP! \u2022 ASCENDED TO LEVEL ${newLevel}`).setColor(colorInt).setDescription(
      `\u{1F389} Congratulations <@${userId}>! You advanced from **Level ${oldLevel}** \u2794 **Level ${newLevel}** via **${source === "VOICE" ? "\u{1F399}\uFE0F Voice Chat (VC)" : "\u{1F4AC} Text Chat"}**!

\u{1F396}\uFE0F **Official Tier Role**: **@${tier.name}**
` + (newlyUnlocked.length > 0 ? `\u{1F513} **Newly Unlocked Features**: ${newlyUnlocked.join(" \u2022 ")}
` : "") + `\u{1F4D6} *${tier.description}*`
    ).setFooter({ text: "Club EZKEN Hard Progression Suite \u2022 Strictly 9 Official Ticked Ranks" }).setTimestamp();
    let targetChan = contextChannel && contextChannel.isTextBased?.() ? contextChannel : null;
    if (!targetChan) {
      const channels = await fetchGuildChannels();
      const gen = channels.find((c) => c.name === "general" || c.name.includes("general") || c.type === 0);
      if (gen) {
        targetChan = discordBot.channels.cache.get(gen.id) || await discordBot.channels.fetch(gen.id).catch(() => null);
      }
    }
    if (targetChan && targetChan.isTextBased()) {
      await targetChan.send({ content: `\u{1F389} <@${userId}> has leveled up!`, embeds: [embed] }).catch(() => {
      });
    }
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) || await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null);
    if (modLogChan && modLogChan.isTextBased()) {
      const logEmbed = new EmbedBuilder3().setTitle(`\u{1F4C8} PROMOTION AUDIT \u2022 Level ${newLevel} reached by @${username}`).setColor(colorInt).setDescription(
        `**Member**: <@${userId}> (\`${username}\` \u2022 ID: \`${userId}\`)
**Progression Source**: ${source === "VOICE" ? "\u{1F399}\uFE0F Voice Channel Stay" : "\u{1F4AC} Text Chat Messages"}
**New Rank**: **@${tier.name}** (Level ${newLevel})
**Unlocked Features**: ${tier.features.join(", ")}`
      ).setFooter({ text: "Club EZKEN Leveling & Permission Ledger" }).setTimestamp();
      await modLogChan.send({ embeds: [logEmbed] }).catch(() => {
      });
    }
  } catch (err) {
    console.warn("[LEVEL ANNOUNCE ERROR]", err.message);
  }
}
async function handleUserMessageXp(message) {
  if (!message || message.author?.bot) return;
  const userId = message.author.id;
  const username = message.author.tag || message.author.username;
  const avatar = message.author.displayAvatarURL({ size: 128 }) || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80";
  const now = Date.now();
  const lastTime = userMessageCooldowns.get(userId) || 0;
  if (now - lastTime < 6e4) {
    return;
  }
  userMessageCooldowns.set(userId, now);
  const xpGained = Math.floor(Math.random() * 6) + 15;
  const db = loadXpDatabase();
  await awardXpToUser(db, userId, username, avatar, xpGained, 0, "TEXT", message.channel);
  saveXpDatabase(db);
}
discordBot.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    await handleTempVoiceVoiceStateUpdate(oldState, newState, discordBot);
  } catch (err) {
    console.error("[TEMP VOICE STATE ERROR]", err.message);
  }
  const userId = newState.id || oldState.id;
  if (!userId) return;
  const member = newState.member || oldState.member;
  if (member?.user?.bot) return;
  const userTag = member?.user?.tag || member?.user?.username || `User_${userId.slice(-4)}`;
  if (!oldState.channelId && newState.channelId) {
    const chanName = newState.channel?.name || "Voice Channel";
    activeVoiceSessions.set(userId, {
      channelId: newState.channelId,
      channelName: chanName,
      joinedAt: Date.now(),
      lastTickAt: Date.now()
    });
    console.log(`[DISCORD VC] @${userTag} joined voice channel #${chanName}`);
  } else if (oldState.channelId && !newState.channelId) {
    const session = activeVoiceSessions.get(userId);
    if (session) {
      const minutesSpent = Math.max(1, Math.floor((Date.now() - session.joinedAt) / 6e4));
      activeVoiceSessions.delete(userId);
      console.log(`[DISCORD VC] @${userTag} left voice channel #${session.channelName} after ${minutesSpent} mins`);
    }
  } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const session = activeVoiceSessions.get(userId);
    const newChanName = newState.channel?.name || "Voice Channel";
    if (session) {
      session.channelId = newState.channelId;
      session.channelName = newChanName;
    } else {
      activeVoiceSessions.set(userId, {
        channelId: newState.channelId,
        channelName: newChanName,
        joinedAt: Date.now(),
        lastTickAt: Date.now()
      });
    }
    console.log(`[DISCORD VC] @${userTag} moved to voice channel #${newChanName}`);
  }
});
setInterval(async () => {
  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    if (!liveGuild) return;
    const voiceStates = liveGuild.voiceStates.cache;
    if (voiceStates.size === 0) return;
    const db = loadXpDatabase();
    let updatedAny = false;
    for (const [userId, vs] of voiceStates) {
      if (!vs.channelId || vs.member?.user?.bot) continue;
      if (vs.deaf || vs.selfDeaf) continue;
      if (liveGuild.afkChannelId && vs.channelId === liveGuild.afkChannelId) continue;
      const userTag = vs.member?.user?.tag || vs.member?.user?.username || `User_${userId.slice(-4)}`;
      const avatarUrl = vs.member?.user?.displayAvatarURL({ size: 128 }) || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80";
      const vcXpGain = 8;
      const res = await awardXpToUser(db, userId, userTag, avatarUrl, vcXpGain, 1, "VOICE", vs.channel);
      if (res.leveledUp) {
        console.log(`[DISCORD VC LEVEL UP] @${userTag} reached Level ${res.newLevel} (Tier: @${res.tierRole.name}) in VC!`);
      }
      updatedAny = true;
    }
    if (updatedAny) {
      saveXpDatabase(db);
    }
  } catch (err) {
    console.warn("[DISCORD VC TICK ERROR]", err.message);
  }
}, 6e4);
async function fetchGuildChannels() {
  const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
  if (liveGuild && liveGuild.channels.cache.size > 0) {
    return Array.from(liveGuild.channels.cache.values()).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId
    }));
  }
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
      headers: getDiscordHeaders()
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}
async function fetchGuildRoles() {
  const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
  if (liveGuild && liveGuild.roles.cache.size > 0) {
    return Array.from(liveGuild.roles.cache.values()).map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      position: r.position
    }));
  }
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
      headers: getDiscordHeaders()
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}
app.get("/api/discord/guild", async (_req, res) => {
  try {
    const guildRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}?with_counts=true`, {
      headers: getDiscordHeaders()
    });
    if (!guildRes.ok) {
      const errText = await guildRes.text();
      return res.json({
        connected: false,
        guildId: DISCORD_GUILD_ID,
        name: "Club EZKEN",
        icon: null,
        approximate_member_count: 4,
        approximate_presence_count: 4,
        channels: [],
        roles: [],
        levelTiers,
        error: `Discord API status ${guildRes.status}: ${errText.substring(0, 100)}`
      });
    }
    const guild = await guildRes.json();
    const channels = await fetchGuildChannels();
    const roles = await fetchGuildRoles();
    return res.json({
      connected: true,
      guildId: guild.id,
      name: guild.name,
      icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null,
      approximate_member_count: guild.approximate_member_count || guild.member_count || 4,
      approximate_presence_count: guild.approximate_presence_count || 4,
      channels,
      roles,
      levelTiers
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/channels", async (req, res) => {
  const { name, type = "text", topic = "", parentId } = req.body;
  if (!name) return res.status(400).json({ error: "Channel name required." });
  try {
    const formattedName = type === "category" ? name : name.toLowerCase().replace(/\s+/g, "-");
    let discordType = 0;
    if (type === "voice") discordType = 2;
    if (type === "category") discordType = 4;
    if (type === "announcement") discordType = 5;
    const payload = {
      name: formattedName,
      type: discordType
    };
    if (topic && discordType === 0) payload.topic = topic;
    if (parentId) payload.parent_id = parentId;
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
      method: "POST",
      headers: getDiscordHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || "Failed to create channel in Discord" });
    }
    return res.json({ success: true, channel: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.delete("/api/discord/channels/:id", async (req, res) => {
  const channelId = req.params.id;
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      method: "DELETE",
      headers: getDiscordHeaders()
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: data.message || "Failed to delete channel" });
    }
    return res.json({ success: true, deletedChannelId: channelId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/roles", async (req, res) => {
  const { name, colorHex = "#E50914", hoist = true, mentionable = false, levelPerk = null } = req.body;
  if (!name) return res.status(400).json({ error: "Role name required." });
  try {
    const colorInt = parseInt(colorHex.replace("#", ""), 16) || 0;
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
      method: "POST",
      headers: getDiscordHeaders(),
      body: JSON.stringify({
        name,
        color: colorInt,
        hoist: !!hoist,
        mentionable: !!mentionable
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || "Failed to create role in Discord" });
    }
    if (levelPerk && typeof levelPerk === "number") {
      levelTiers[levelPerk] = { name, color: colorHex };
    }
    return res.json({ success: true, role: data, levelTiers });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.delete("/api/discord/roles/:id", async (req, res) => {
  const roleId = req.params.id;
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles/${roleId}`, {
      method: "DELETE",
      headers: getDiscordHeaders()
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: data.message || "Failed to delete role" });
    }
    for (const [lvl, val] of Object.entries(levelTiers)) {
      if (val.roleId === roleId) {
        delete levelTiers[parseInt(lvl)];
      }
    }
    return res.json({ success: true, deletedRoleId: roleId, levelTiers });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/send-message", async (req, res) => {
  const { channelId, channelName, content, title, description, colorHex = "#E50914", imageUrl, buttons } = req.body;
  let targetChannelId = channelId;
  if (!targetChannelId && channelName) {
    const channels = await fetchGuildChannels();
    const cleanName = channelName.replace("#", "").toLowerCase();
    const found = channels.find((c) => c.name.toLowerCase() === cleanName || c.name.toLowerCase().includes(cleanName));
    if (found) targetChannelId = found.id;
  }
  if (!targetChannelId) {
    const channels = await fetchGuildChannels();
    const fallback = channels.find((c) => c.name.includes("general") || c.name.includes("announcement") || c.type === 0);
    if (fallback) targetChannelId = fallback.id;
  }
  if (!targetChannelId) return res.status(400).json({ error: "Target channel could not be identified." });
  try {
    const payload = {};
    if (content) payload.content = content;
    if (title || description) {
      const colorInt = parseInt(colorHex.replace("#", ""), 16) || 15010068;
      payload.embeds = [
        {
          title: title || "Club EZKEN Announcement",
          description: description || "",
          color: colorInt,
          image: imageUrl ? { url: imageUrl } : void 0,
          footer: { text: "Club EZKEN Official Bot & Server Manager" },
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      ];
    }
    if (Array.isArray(buttons) && buttons.length > 0) {
      const actionRows = [];
      const styleMap = {
        primary: 1,
        // Blurple
        secondary: 2,
        // Grey
        success: 3,
        // Green
        danger: 4
        // Red
      };
      const validButtons = buttons.slice(0, 25);
      for (let i = 0; i < validButtons.length; i += 5) {
        const chunk = validButtons.slice(i, i + 5);
        actionRows.push({
          type: 1,
          // ActionRow
          components: chunk.map((btn, btnIndex) => {
            const globalIndex = i + btnIndex;
            const rawLabel = String(btn.label || btn.roleName || `Role ${globalIndex + 1}`).replace(/^@+/, "").trim();
            const cleanRoleName = String(btn.roleName || rawLabel).replace(/^@+/, "").trim();
            const customId = btn.customId || `selfrole:${globalIndex}:${cleanRoleName}`;
            const numStyle = typeof btn.style === "number" ? btn.style : styleMap[btn.style] || 1;
            const comp = {
              type: 2,
              // Button
              style: numStyle,
              label: (rawLabel || `Role ${globalIndex + 1}`).substring(0, 80),
              custom_id: customId.substring(0, 100)
            };
            if (btn.emoji && typeof btn.emoji === "string") {
              const cleanEmoji = btn.emoji.trim();
              if (cleanEmoji.length > 0 && cleanEmoji.length <= 4) {
                comp.emoji = { name: cleanEmoji };
              }
            }
            return comp;
          })
        });
      }
      if (actionRows.length > 0) {
        payload.components = actionRows;
      }
    }
    const response = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: "POST",
      headers: getDiscordHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      if (payload.components) {
        for (const row of payload.components) {
          for (const btn of row.components) {
            if (btn.emoji?.name) {
              btn.label = `${btn.emoji.name} ${btn.label}`.substring(0, 80);
            }
            delete btn.emoji;
          }
        }
        const retryRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
          method: "POST",
          headers: getDiscordHeaders(),
          body: JSON.stringify(payload)
        });
        const retryData = await retryRes.json();
        if (retryRes.ok) {
          return res.json({ success: true, messageId: retryData.id, channelId: targetChannelId, componentsCount: payload.components.length });
        }
      }
      return res.status(response.status).json({ error: data.message || "Failed to send message to Discord" });
    }
    return res.json({ success: true, messageId: data.id, channelId: targetChannelId, componentsCount: (payload.components || []).length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/discord/mod-logs", async (_req, res) => {
  try {
    const targetChannelId = MOD_LOGS_CHANNEL_ID;
    const messagesRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages?limit=50`, {
      headers: getDiscordHeaders()
    });
    const discordMessages = messagesRes.ok ? await messagesRes.json() : [];
    const db = loadModRecords();
    return res.json({
      connected: true,
      channelId: targetChannelId,
      channelName: "\u{1F4CB}\uFF5Cmod-logs",
      messages: Array.isArray(discordMessages) ? discordMessages : [],
      cases: db.cases || [],
      deletedMessages: db.deletedMessages || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/discord/leaderboard", async (_req, res) => {
  try {
    const db = loadXpDatabase();
    const sorted = Object.values(db.users).sort((a, b) => b.xp - a.xp);
    const ranked = sorted.map((user, idx) => {
      const tier = getTierRoleForLevel(user.level);
      return {
        rank: idx + 1,
        user_id: user.userId,
        username: user.username,
        avatar: user.avatar,
        xp: user.xp,
        level: user.level,
        total_messages: user.totalMessages,
        voice_minutes: user.voiceMinutes,
        tierRole: tier.name,
        color: tier.color,
        unlockedFeatures: getAllUnlockedFeaturesForLevel(user.level)
      };
    });
    return res.json({
      connected: true,
      totalTracked: ranked.length,
      leaderboard: ranked,
      activeVoiceCount: activeVoiceSessions.size
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/discord/level-tiers", async (_req, res) => {
  try {
    return res.json({
      tiers: OFFICIAL_LEVEL_TIERS_CONFIG,
      progressionFormula: "xp = Math.floor(120 * Math.pow(level, 1.85))",
      rates: {
        voiceXpPerMinute: 8,
        messageXpMin: 15,
        messageXpMax: 20,
        messageCooldownSeconds: 60
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/discord/voice-status", async (_req, res) => {
  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const voiceStates = liveGuild?.voiceStates.cache || /* @__PURE__ */ new Map();
    const activeList = [];
    for (const [userId, vs] of voiceStates) {
      if (vs.member?.user?.bot) continue;
      const session = activeVoiceSessions.get(userId);
      activeList.push({
        userId,
        username: vs.member?.user?.tag || vs.member?.user?.username || "Member",
        channelId: vs.channelId,
        channelName: vs.channel?.name || "Voice Channel",
        deaf: vs.deaf || vs.selfDeaf,
        mute: vs.mute || vs.selfMute,
        minutesInSession: session ? Math.floor((Date.now() - session.joinedAt) / 6e4) : 0
      });
    }
    return res.json({
      connected: true,
      activeVoiceUsers: activeList,
      totalInVoice: activeList.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/simulate-xp", async (req, res) => {
  const { userId, username, avatar, xpGain = 150, voiceMinutesGain = 10, source = "VOICE" } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  try {
    const db = loadXpDatabase();
    const result = await awardXpToUser(
      db,
      userId,
      username || `Member_${userId.slice(-4)}`,
      avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&auto=format&fit=crop&q=80",
      xpGain,
      voiceMinutesGain,
      source
    );
    saveXpDatabase(db);
    return res.json({
      success: true,
      user: db.users[userId],
      result
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/sync-role-permissions", async (_req, res) => {
  try {
    const currentRoles = await fetchGuildRoles();
    const syncResults = [];
    const BASE_PERMS = PermissionFlagsBits3.ViewChannel | PermissionFlagsBits3.SendMessages | PermissionFlagsBits3.ReadMessageHistory | PermissionFlagsBits3.Connect | PermissionFlagsBits3.Speak | PermissionFlagsBits3.AddReactions;
    const TIER_PERMISSIONS = {
      "ROOKIE": BASE_PERMS,
      "INSIDER": BASE_PERMS | PermissionFlagsBits3.AttachFiles,
      "RESIDENT": BASE_PERMS | PermissionFlagsBits3.AttachFiles | PermissionFlagsBits3.EmbedLinks,
      "CLUB REGULAR": BASE_PERMS | PermissionFlagsBits3.AttachFiles | PermissionFlagsBits3.EmbedLinks | PermissionFlagsBits3.UseExternalEmojis | PermissionFlagsBits3.UseExternalStickers,
      "HYPEMASTER": BASE_PERMS | PermissionFlagsBits3.AttachFiles | PermissionFlagsBits3.EmbedLinks | PermissionFlagsBits3.UseExternalEmojis | PermissionFlagsBits3.UseExternalStickers | PermissionFlagsBits3.CreatePublicThreads | PermissionFlagsBits3.CreatePrivateThreads | PermissionFlagsBits3.PrioritySpeaker,
      "ASCENDANT": BASE_PERMS | PermissionFlagsBits3.AttachFiles | PermissionFlagsBits3.EmbedLinks | PermissionFlagsBits3.UseExternalEmojis | PermissionFlagsBits3.UseExternalStickers | PermissionFlagsBits3.CreatePublicThreads | PermissionFlagsBits3.CreatePrivateThreads | PermissionFlagsBits3.PrioritySpeaker | PermissionFlagsBits3.UseSoundboard | PermissionFlagsBits3.UseExternalSounds,
      "CLUB TITAN": BASE_PERMS | PermissionFlagsBits3.AttachFiles | PermissionFlagsBits3.EmbedLinks | PermissionFlagsBits3.UseExternalEmojis | PermissionFlagsBits3.UseExternalStickers | PermissionFlagsBits3.CreatePublicThreads | PermissionFlagsBits3.CreatePrivateThreads | PermissionFlagsBits3.PrioritySpeaker | PermissionFlagsBits3.UseSoundboard | PermissionFlagsBits3.UseExternalSounds | PermissionFlagsBits3.UseApplicationCommands,
      "THE IMMORTAL": BASE_PERMS | PermissionFlagsBits3.AttachFiles | PermissionFlagsBits3.EmbedLinks | PermissionFlagsBits3.UseExternalEmojis | PermissionFlagsBits3.UseExternalStickers | PermissionFlagsBits3.CreatePublicThreads | PermissionFlagsBits3.CreatePrivateThreads | PermissionFlagsBits3.PrioritySpeaker | PermissionFlagsBits3.UseSoundboard | PermissionFlagsBits3.UseExternalSounds | PermissionFlagsBits3.UseApplicationCommands | PermissionFlagsBits3.ChangeNickname,
      "STAR SUPPORTER": BASE_PERMS | PermissionFlagsBits3.AttachFiles | PermissionFlagsBits3.EmbedLinks | PermissionFlagsBits3.UseExternalEmojis | PermissionFlagsBits3.UseExternalStickers | PermissionFlagsBits3.CreatePublicThreads | PermissionFlagsBits3.CreatePrivateThreads | PermissionFlagsBits3.PrioritySpeaker | PermissionFlagsBits3.UseSoundboard | PermissionFlagsBits3.UseExternalSounds | PermissionFlagsBits3.UseApplicationCommands | PermissionFlagsBits3.ChangeNickname | PermissionFlagsBits3.MentionEveryone
    };
    for (const [tierLvlStr, config] of Object.entries(OFFICIAL_LEVEL_TIERS_CONFIG)) {
      const cleanName = config.name.trim();
      const cleanLower = cleanName.toLowerCase();
      let matchedRole = currentRoles.find((r) => r.name.replace(/^@+/, "").trim().toLowerCase() === cleanLower);
      if (!matchedRole) {
        const colorInt = parseInt(config.color.replace("#", ""), 16) || 3057919;
        const createRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
          method: "POST",
          headers: getDiscordHeaders(),
          body: JSON.stringify({
            name: cleanName,
            color: colorInt,
            hoist: true,
            mentionable: true,
            permissions: (TIER_PERMISSIONS[cleanName] || BASE_PERMS).toString()
          })
        });
        if (createRes.ok) {
          matchedRole = await createRes.json();
          syncResults.push({
            roleName: `@${cleanName}`,
            level: config.level,
            action: "CREATED_AND_SYNCED",
            features: config.features,
            permissionsBitfield: (TIER_PERMISSIONS[cleanName] || BASE_PERMS).toString()
          });
          continue;
        }
      }
      if (matchedRole) {
        const targetPerms = (TIER_PERMISSIONS[cleanName] || BASE_PERMS).toString();
        const updateRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles/${matchedRole.id}`, {
          method: "PATCH",
          headers: getDiscordHeaders(),
          body: JSON.stringify({
            permissions: targetPerms,
            hoist: true,
            mentionable: true
          })
        });
        syncResults.push({
          roleName: `@${cleanName}`,
          level: config.level,
          roleId: matchedRole.id,
          action: updateRes.ok ? "PERMISSIONS_SYNCED" : "PERMISSION_DENIED_BY_DISCORD",
          features: config.features,
          permissionsBitfield: targetPerms
        });
      }
    }
    try {
      const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) || await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null);
      if (modLogChan && modLogChan.isTextBased()) {
        const syncEmbed = new EmbedBuilder3().setTitle("\u{1F6E1}\uFE0F ROLE PERMISSIONS & FEATURE UNLOCK MATRIX SYNCHRONIZED").setColor(3057919).setDescription(
          `Successfully synchronized permissions across all **9 Official Ticked Level Roles**!

\u2022 **Level 10 (@INSIDER)**: \u{1F4CE} Posting Links & Attachments Enabled
\u2022 **Level 20 (@RESIDENT)**: \u{1F3AC} GIFs (Tenor) & Embed Links Enabled
\u2022 **Level 30 (@CLUB REGULAR)**: \u{1F31F} External Emojis & Stickers Enabled
\u2022 **Level 40 (@HYPEMASTER)**: \u{1F4AC} Threads & Priority Speaker Enabled
\u2022 **Level 55 (@ASCENDANT)**: \u{1F50A} Soundboard & External Voice Audio Enabled
\u2022 **Level 70 (@CLUB TITAN)**: \u{1F48E} VIP Lounge Access Enabled
\u2022 **Level 85 (@THE IMMORTAL)**: \u{1F3F7}\uFE0F Custom Nicknames & Voice Activity Enabled
\u2022 **Level 100 (@STAR SUPPORTER)**: \u{1F451} Maximum Prestige & Hall of Fame Enabled`
        ).setFooter({ text: "Club EZKEN Permission Synchronization Engine" }).setTimestamp();
        await modLogChan.send({ embeds: [syncEmbed] });
      }
    } catch {
    }
    return res.json({
      success: true,
      syncedCount: syncResults.length,
      syncedRoles: syncResults
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/discord/welcome-config", async (_req, res) => {
  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const memberCount = liveGuild?.memberCount || 142;
    return res.json({
      config: welcomeConfig,
      memberCount,
      nextMemberSlot: memberCount + 1
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/welcome-config", async (req, res) => {
  try {
    const updated = req.body;
    saveWelcomeConfig({
      ...welcomeConfig,
      ...updated,
      canvas: {
        ...welcomeConfig.canvas,
        ...updated.canvas || {}
      }
    });
    return res.json({ success: true, config: welcomeConfig });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/welcome-preview", async (req, res) => {
  try {
    const { username = "NewMember", memberCount = 143, avatarUrl, canvasConfig } = req.body;
    const activeCanvas = { ...welcomeConfig.canvas, ...canvasConfig || {} };
    const buffer = await generateWelcomeCardBuffer(
      username,
      memberCount,
      avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256&auto=format&fit=crop&q=80",
      "CLUB EZKEN",
      activeCanvas
    );
    const base64 = `data:image/png;base64,${buffer.toString("base64")}`;
    return res.json({ success: true, imageBase64: base64 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/welcome-test", async (req, res) => {
  const { targetChannelName, username = "Ken", memberCount } = req.body;
  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const actualCount = memberCount || (liveGuild?.memberCount ? liveGuild.memberCount : 143);
    const avatarUrl = discordBot.user?.displayAvatarURL({ extension: "png", size: 256 }) || "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=256&auto=format&fit=crop&q=80";
    const cardBuffer = await generateWelcomeCardBuffer(
      username,
      actualCount,
      avatarUrl,
      liveGuild?.name || "CLUB EZKEN",
      welcomeConfig.canvas
    );
    const channels = await fetchGuildChannels();
    const chanToFind = (targetChannelName || welcomeConfig.channelName || "lounge-welcome").replace("#", "").toLowerCase();
    const targetChanMeta = channels.find(
      (c) => c.name.toLowerCase() === chanToFind || c.name.toLowerCase().includes(chanToFind) || c.name.toLowerCase().includes("welcome") || c.name.toLowerCase().includes("general")
    );
    const targetChannelId = targetChanMeta ? targetChanMeta.id : null;
    let targetChannel = null;
    if (targetChannelId) {
      targetChannel = discordBot.channels.cache.get(targetChannelId) || await discordBot.channels.fetch(targetChannelId).catch(() => null);
    }
    if (!targetChannel || !targetChannel.isTextBased()) {
      return res.status(404).json({ error: `Could not find target channel #${chanToFind} on server.` });
    }
    const welcomeMsg = welcomeConfig.messageTemplate.replace("{user}", `<@${discordBot.user?.id || "everyone"}>`).replace("{guild}", liveGuild?.name || "Club EZKEN").replace("{count}", actualCount.toString());
    const attachment = new AttachmentBuilder2(cardBuffer, { name: "welcome-card-test.png" });
    const sent = await targetChannel.send({
      content: `\u{1F9EA} **[TEST WELCOME DISPATCH]**
${welcomeMsg}`,
      files: [attachment]
    });
    return res.json({
      success: true,
      messageId: sent.id,
      channelName: targetChannel.name,
      memberCount: actualCount
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/simulate-departure", async (req, res) => {
  const { departedUsername = "GhostPlayer#0001", departedUserId = "123456789012345678" } = req.body;
  try {
    const liveGuild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const guildName = liveGuild?.name || "Club EZKEN";
    const currentTotal = liveGuild?.memberCount || 142;
    const recalculatedTotal = Math.max(1, currentTotal - 1);
    let aiNote = `\u{1F4C9} **[SMART AI AUDIT \u2022 MEMBER DEPARTURE]**
Member **@${departedUsername}** (\`${departedUserId}\`) has departed from **${guildName}**.
\u{1F4CA} **Recalculated Total**: **${recalculatedTotal} members** (-1 deduction applied).
\u26A1 **Counter Synchronized**: The next joining member will continue onwards numbered **#${recalculatedTotal + 1}**.`;
    if (aiClient) {
      try {
        const aiPrompt = `A member departed from Discord server "${guildName}".
Member: @${departedUsername} (ID: ${departedUserId}).
Total member count has decreased by 1 to ${recalculatedTotal} members.
The next incoming member slot is now synchronized to #${recalculatedTotal + 1}.
Generate a sharp, professional 2-line Discord audit note for #mod-logs confirming the departure, reporting the recalculated total of ${recalculatedTotal} members, and confirming the next joining member will be numbered #${recalculatedTotal + 1}. Use Discord Markdown.`;
        const resp = await aiClient.models.generateContent({
          model: "gemini-3.8-flash",
          contents: aiPrompt
        });
        if (resp.text) {
          aiNote = `\u{1F4C9} **[SMART AI AUDIT \u2022 MEMBER DEPARTURE]**
${resp.text.trim()}
*Recalculated Total:${recalculatedTotal} members \u2022 Next Welcome Slot: #${recalculatedTotal + 1}*`;
        }
      } catch (e) {
        console.warn("[AI DEPARTURE SIMULATION ERROR]", e.message);
      }
    }
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) || await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null);
    if (modLogChan && modLogChan.isTextBased()) {
      await modLogChan.send({ content: aiNote }).catch(() => {
      });
    }
    return res.json({
      success: true,
      departedUsername,
      recalculatedTotal,
      nextMemberSlot: recalculatedTotal + 1,
      aiNote
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/moderate", async (req, res) => {
  const { userId, action, reason = "Moderation via Club EZKEN Dashboard", durationMinutes = 60, userTag } = req.body;
  if (!userId || !action) return res.status(400).json({ error: "userId and action required." });
  try {
    let success = false;
    let mappedAction = "WARN";
    if (action === "TIMEOUT") {
      mappedAction = "MUTE";
      const timeoutUntil = new Date(Date.now() + durationMinutes * 60 * 1e3).toISOString();
      const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, {
        method: "PATCH",
        headers: getDiscordHeaders(),
        body: JSON.stringify({ communication_disabled_until: timeoutUntil })
      });
      success = response.ok;
    } else if (action === "KICK") {
      mappedAction = "KICK";
      const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, {
        method: "DELETE",
        headers: getDiscordHeaders()
      });
      success = response.ok;
    } else if (action === "BAN") {
      mappedAction = "BAN";
      const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/bans/${userId}`, {
        method: "PUT",
        headers: getDiscordHeaders(),
        body: JSON.stringify({ reason })
      });
      success = response.ok;
    } else if (action === "UNBAN") {
      const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/bans/${userId}`, {
        method: "DELETE",
        headers: getDiscordHeaders()
      });
      return res.json({ success: response.ok, action: "UNBAN" });
    } else {
      return res.status(400).json({ error: "Invalid moderation action." });
    }
    const db = loadModRecords();
    const caseNumber = `#000${db.cases.length + 1}`;
    const newCase = {
      id: Date.now(),
      case_id: caseNumber,
      user_id: userId,
      user_tag: userTag || `User_${userId.slice(-4)}`,
      moderator_id: "admin_ken",
      moderator_tag: "KEN",
      action_type: mappedAction,
      reason: reason || `Sanction executed via Club EZKEN Dashboard (${action})`,
      timestamp: Date.now()
    };
    db.cases.unshift(newCase);
    saveModRecords(db);
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) || await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null);
    if (modLogChan && modLogChan.isTextBased()) {
      const auditEmbed = new EmbedBuilder3().setTitle(`\u2696\uFE0F MODERATION SANCTION \u2022 ${action}`).setColor(action === "BAN" ? 14300988 : action === "TIMEOUT" ? 16096779 : 3057919).setDescription(
        `**Target User**: <@${userId}> (\`${userTag || userId}\`)
**Action**: **${action}**${action === "TIMEOUT" ? ` (${durationMinutes} mins)` : ""}
**Reason**: ${reason}
**Moderator**: **KEN** (Super Admin)
**Case**: \`${caseNumber}\``
      ).setFooter({ text: "Club EZKEN Moderation Audit Ledger" }).setTimestamp();
      await modLogChan.send({ embeds: [auditEmbed] }).catch(() => {
      });
    }
    return res.json({ success, action, caseNumber });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/discord/members/:userId/roles/:roleId", async (req, res) => {
  const { userId, roleId } = req.params;
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`, {
      method: "PUT",
      headers: getDiscordHeaders()
    });
    return res.json({ success: response.ok });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.delete("/api/discord/members/:userId/roles/:roleId", async (req, res) => {
  const { userId, roleId } = req.params;
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`, {
      method: "DELETE",
      headers: getDiscordHeaders()
    });
    return res.json({ success: response.ok });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/discord/members", async (_req, res) => {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members?limit=100`, {
      headers: getDiscordHeaders()
    });
    const members = response.ok ? await response.json() : [];
    return res.json({ members });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
var aiChatMemory = [];
var AI_MEMORY_MAX_TURNS = 60;
async function executeServerAction(actionName, args, currentChannels, currentRoles) {
  try {
    if (actionName === "disable_push_to_talk" || actionName === "fix_voice_chat_permissions" || actionName === "allow_voice_activity") {
      const results = [];
      const USE_VAD_BIT = 33554432n;
      const SPEAK_BIT = 2097152n;
      const CONNECT_BIT = 1048576n;
      const STREAM_BIT = 512n;
      const everyoneRole = currentRoles.find((r) => r.id === DISCORD_GUILD_ID || r.name === "@everyone");
      if (everyoneRole) {
        try {
          const currentBits = BigInt(everyoneRole.permissions || "0");
          const newBits = currentBits | USE_VAD_BIT | SPEAK_BIT | CONNECT_BIT | STREAM_BIT;
          const patchRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles/${everyoneRole.id}`, {
            method: "PATCH",
            headers: getDiscordHeaders(),
            body: JSON.stringify({ permissions: newBits.toString() })
          });
          if (patchRes.ok) {
            results.push(`\u2705 Enabled Voice Activity Detection (Use VAD) on @everyone role`);
          } else {
            const errJson = await patchRes.json().catch(() => ({}));
            results.push(`\u26A0\uFE0F @everyone role update: ${errJson.message || patchRes.status}`);
          }
        } catch (e) {
          results.push(`\u26A0\uFE0F Role error: ${e.message}`);
        }
      }
      const tierRoleNames = ["rookie", "insider", "resident", "club regular", "hypemaster", "ascendant", "club titan", "the immortal", "star supporter", "member", "verified"];
      for (const role of currentRoles) {
        if (tierRoleNames.includes(role.name.toLowerCase().replace(/[@\s]/g, ""))) {
          try {
            const rBits = BigInt(role.permissions || "0");
            const newRBits = rBits | USE_VAD_BIT | SPEAK_BIT | CONNECT_BIT;
            await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles/${role.id}`, {
              method: "PATCH",
              headers: getDiscordHeaders(),
              body: JSON.stringify({ permissions: newRBits.toString() })
            });
          } catch {
          }
        }
      }
      let liveChannels = currentChannels;
      try {
        const chanRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
          headers: getDiscordHeaders()
        });
        if (chanRes.ok) {
          liveChannels = await chanRes.json();
        }
      } catch {
      }
      const voiceChannels = liveChannels.filter((c) => c.type === 2 || c.type === 13);
      let updatedVCCount = 0;
      for (const vc of voiceChannels) {
        try {
          const overwrites = Array.isArray(vc.permission_overwrites) ? vc.permission_overwrites : [];
          const everyoneOverwrite = overwrites.find((o) => o.id === DISCORD_GUILD_ID);
          let allowBits = USE_VAD_BIT | SPEAK_BIT | CONNECT_BIT | STREAM_BIT;
          let denyBits = 0n;
          if (everyoneOverwrite) {
            const existingAllow = BigInt(everyoneOverwrite.allow || "0");
            const existingDeny = BigInt(everyoneOverwrite.deny || "0");
            denyBits = existingDeny & ~USE_VAD_BIT;
            allowBits = existingAllow | USE_VAD_BIT | SPEAK_BIT | CONNECT_BIT;
          }
          const putRes = await fetch(`https://discord.com/api/v10/channels/${vc.id}/permissions/${DISCORD_GUILD_ID}`, {
            method: "PUT",
            headers: getDiscordHeaders(),
            body: JSON.stringify({
              type: 0,
              // role
              allow: allowBits.toString(),
              deny: denyBits.toString()
            })
          });
          for (const ow of overwrites) {
            if (ow.id !== DISCORD_GUILD_ID) {
              const owDeny = BigInt(ow.deny || "0");
              if ((owDeny & USE_VAD_BIT) !== 0n) {
                const cleanedDeny = owDeny & ~USE_VAD_BIT;
                const owAllow = BigInt(ow.allow || "0") | USE_VAD_BIT;
                await fetch(`https://discord.com/api/v10/channels/${vc.id}/permissions/${ow.id}`, {
                  method: "PUT",
                  headers: getDiscordHeaders(),
                  body: JSON.stringify({
                    type: ow.type,
                    allow: owAllow.toString(),
                    deny: cleanedDeny.toString()
                  })
                });
              }
            }
          }
          if (putRes.ok) {
            updatedVCCount++;
          }
        } catch (err) {
          console.error(`[DISABLE PTT] Error on VC #${vc.name}:`, err.message);
        }
      }
      return {
        action: "DISABLED_PUSH_TO_TALK",
        details: { voiceChannelsCount: voiceChannels.length, updatedVCCount },
        result: `\u2705 Disabled forced Push-to-Talk server-wide! All ${updatedVCCount} voice channels and server roles now allow Voice Activity Detection (open mic) for everyone. Members can now speak freely without holding a button!`,
        success: true
      };
    }
    if (actionName === "check_voice_permissions" || actionName === "check_push_to_talk") {
      const USE_VAD_BIT = 33554432n;
      const SPEAK_BIT = 2097152n;
      const CONNECT_BIT = 1048576n;
      const everyoneRole = currentRoles.find((r) => r.id === DISCORD_GUILD_ID || r.name === "@everyone");
      const everyoneBits = BigInt(everyoneRole?.permissions || "0");
      const everyoneHasVAD = (everyoneBits & USE_VAD_BIT) !== 0n;
      const everyoneHasSpeak = (everyoneBits & SPEAK_BIT) !== 0n;
      let liveChannels = currentChannels;
      try {
        const chanRes = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
          headers: getDiscordHeaders()
        });
        if (chanRes.ok) liveChannels = await chanRes.json();
      } catch {
      }
      const voiceChannels = liveChannels.filter((c) => c.type === 2 || c.type === 13);
      const channelsWithForcedPTT = [];
      const channelsWithOpenMic = [];
      for (const vc of voiceChannels) {
        const overwrites = Array.isArray(vc.permission_overwrites) ? vc.permission_overwrites : [];
        const everyoneOw = overwrites.find((o) => o.id === DISCORD_GUILD_ID);
        const deniesVAD = everyoneOw && (BigInt(everyoneOw.deny || "0") & USE_VAD_BIT) !== 0n;
        if (deniesVAD) {
          channelsWithForcedPTT.push(vc.name);
        } else {
          channelsWithOpenMic.push(vc.name);
        }
      }
      const pttRequired = !everyoneHasVAD || channelsWithForcedPTT.length > 0;
      return {
        action: "CHECKED_VOICE_PERMISSIONS",
        details: {
          pushToTalkRequired: pttRequired,
          everyoneHasVoiceActivity: everyoneHasVAD,
          everyoneHasSpeak,
          totalVoiceChannels: voiceChannels.length,
          openMicChannelsCount: channelsWithOpenMic.length,
          forcedPttChannelsCount: channelsWithForcedPTT.length,
          forcedPttChannels: channelsWithForcedPTT
        },
        result: pttRequired ? `\u26A0\uFE0F Push-to-Talk IS CURRENTLY REQUIRED on ${channelsWithForcedPTT.length} voice channel(s): ${channelsWithForcedPTT.join(", ")}. Members cannot talk freely without holding a button in those rooms.` : `\u2705 NO, push-to-talk is NOT required in the server! Voice Activity Detection (open mic) is enabled server-wide on @everyone and across all ${voiceChannels.length} voice channels. Everyone can talk normally without holding any key.`,
        success: true
      };
    }
    if (actionName === "get_server_overview") {
      const liveChannels = await fetchGuildChannels();
      const liveRoles = await fetchGuildRoles();
      const textChannels = liveChannels.filter((c) => c.type === 0).map((c) => `#${c.name}`).join(", ");
      const voiceChannels = liveChannels.filter((c) => c.type === 2).map((c) => `\u{1F50A} #${c.name}`).join(", ");
      const categories = liveChannels.filter((c) => c.type === 4).map((c) => `\u{1F4C1} ${c.name}`).join(", ");
      const topRoles = liveRoles.map((r) => `@${r.name}`).slice(0, 30).join(", ");
      return {
        action: "SERVER_OVERVIEW",
        details: { channelsCount: liveChannels.length, rolesCount: liveRoles.length },
        result: `\u{1F4CA} **Club EZKEN Live Server Overview**:
\u2022 **Total Channels**: ${liveChannels.length} (${categories ? `Categories: ${categories} | ` : ""}Text: ${textChannels.slice(0, 100)}... | Voice: ${voiceChannels.slice(0, 100)}...)
\u2022 **Total Roles**: ${liveRoles.length} (${topRoles.slice(0, 120)}...)
\u2022 **Level Tiers Configured**: ${Object.keys(levelTiers).length} tiers`,
        success: true
      };
    }
    if (actionName === "audit_channel_permissions") {
      let targetChannel = currentChannels.find((c) => c.id === args.channelId || c.name.toLowerCase() === (args.channelName || "").replace("#", "").toLowerCase());
      if (!targetChannel && args.channelName) {
        targetChannel = currentChannels.find((c) => c.name.toLowerCase().includes(args.channelName.replace("#", "").toLowerCase()));
      }
      if (!targetChannel) return { action: "AUDIT_CHANNEL_NOT_FOUND", details: args, result: `Could not find channel "${args.channelName}"`, success: false };
      try {
        const res = await fetch(`https://discord.com/api/v10/channels/${targetChannel.id}`, { headers: getDiscordHeaders() });
        if (res.ok) {
          const chan = await res.json();
          const overwrites = Array.isArray(chan.permission_overwrites) ? chan.permission_overwrites : [];
          const summaries = [];
          for (const ow of overwrites) {
            let targetLabel = ow.id;
            if (ow.id === DISCORD_GUILD_ID) targetLabel = "@everyone";
            else {
              const matchedRole = currentRoles.find((r) => r.id === ow.id);
              if (matchedRole) targetLabel = `@${matchedRole.name}`;
            }
            const allowBits = BigInt(ow.allow || "0");
            const denyBits = BigInt(ow.deny || "0");
            const allowList = [];
            const denyList = [];
            if ((allowBits & 1024n) !== 0n) allowList.push("ViewChannel");
            if ((denyBits & 1024n) !== 0n) denyList.push("ViewChannel");
            if ((allowBits & 2048n) !== 0n) allowList.push("SendMessages");
            if ((denyBits & 2048n) !== 0n) denyList.push("SendMessages");
            if ((allowBits & 1048576n) !== 0n) allowList.push("Connect");
            if ((denyBits & 1048576n) !== 0n) denyList.push("Connect");
            if ((allowBits & 2097152n) !== 0n) allowList.push("Speak");
            if ((denyBits & 2097152n) !== 0n) denyList.push("Speak");
            if ((allowBits & 33554432n) !== 0n) allowList.push("UseVoiceActivity");
            if ((denyBits & 33554432n) !== 0n) denyList.push("UseVoiceActivity (Forced PTT)");
            if ((allowBits & 8192n) !== 0n) allowList.push("ManageMessages");
            if ((denyBits & 8192n) !== 0n) denyList.push("ManageMessages");
            summaries.push(`\u2022 **${targetLabel}**: Allow: [${allowList.join(", ") || "None"}] | Deny: [${denyList.join(", ") || "None"}]`);
          }
          return {
            action: "AUDITED_CHANNEL_PERMISSIONS",
            details: { channel: targetChannel.name, overwritesCount: overwrites.length },
            result: `\u{1F4CB} **Permission Overwrites on #${targetChannel.name}**:
` + (summaries.join("\n") || "No special channel overrides configured (inheriting server defaults)."),
            success: true
          };
        }
      } catch (err) {
        return { action: "AUDIT_CHANNEL_FAILED", details: args, result: `Audit error: ${err.message}`, success: false };
      }
    }
    if (actionName === "audit_role_permissions") {
      const roleName = (args.name || "").replace("@", "").toLowerCase();
      const role = currentRoles.find((r) => r.id === args.roleId || r.name.toLowerCase() === roleName || r.name.toLowerCase().includes(roleName));
      if (!role) return { action: "AUDIT_ROLE_NOT_FOUND", details: args, result: `Could not find role "${args.name}"`, success: false };
      const bits = BigInt(role.permissions || "0");
      const perms = [];
      if ((bits & 8n) !== 0n) perms.push("Administrator");
      if ((bits & 32n) !== 0n) perms.push("ManageServer");
      if ((bits & 268435456n) !== 0n) perms.push("ManageRoles");
      if ((bits & 16n) !== 0n) perms.push("ManageChannels");
      if ((bits & 8192n) !== 0n) perms.push("ManageMessages");
      if ((bits & 1099511627776n) !== 0n) perms.push("ModerateMembers(Timeout)");
      if ((bits & 2n) !== 0n) perms.push("KickMembers");
      if ((bits & 4n) !== 0n) perms.push("BanMembers");
      if ((bits & 1024n) !== 0n) perms.push("ViewChannels");
      if ((bits & 2048n) !== 0n) perms.push("SendMessages");
      if ((bits & 1048576n) !== 0n) perms.push("ConnectVoice");
      if ((bits & 2097152n) !== 0n) perms.push("SpeakVoice");
      if ((bits & 33554432n) !== 0n) perms.push("UseVoiceActivity(OpenMic)");
      if ((bits & 16384n) !== 0n) perms.push("EmbedLinks");
      if ((bits & 32768n) !== 0n) perms.push("AttachFiles");
      return {
        action: "AUDITED_ROLE_PERMISSIONS",
        details: { role: role.name, permissionsCount: perms.length },
        result: `\u{1F6E1}\uFE0F **Role Permissions for @${role.name}** (Color: #${(role.color || 0).toString(16)}, Hoist: ${role.hoist ? "Yes" : "No"}):
\u2022 Permissions: ${perms.join(", ") || "No elevated permissions (Basic)"}`,
        success: true
      };
    }
    if (actionName === "get_audit_logs") {
      try {
        const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/audit-logs?limit=8`, {
          headers: getDiscordHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          const entries = Array.isArray(data.audit_log_entries) ? data.audit_log_entries : [];
          const users = Array.isArray(data.users) ? data.users : [];
          const actionNames = {
            1: "CREATE_CHANNEL",
            2: "UPDATE_CHANNEL",
            3: "DELETE_CHANNEL",
            10: "CREATE_ROLE",
            11: "UPDATE_ROLE",
            12: "DELETE_ROLE",
            20: "KICK_MEMBER",
            22: "BAN_MEMBER",
            23: "UNBAN_MEMBER",
            24: "UPDATE_MEMBER",
            25: "MEMBER_ROLE_UPDATE",
            72: "MESSAGE_DELETE",
            73: "MESSAGE_BULK_DELETE"
          };
          const logLines = entries.map((e) => {
            const actor = users.find((u) => u.id === e.user_id)?.username || `User(${e.user_id})`;
            const actionStr = actionNames[e.action_type] || `ACTION_${e.action_type}`;
            const reason = e.reason ? ` - Reason: "${e.reason}"` : "";
            return `\u2022 **${actor}**: ${actionStr} (Target: ${e.target_id || "N/A"})${reason}`;
          });
          return {
            action: "FETCHED_AUDIT_LOGS",
            details: { count: entries.length },
            result: `\u{1F4CB} **Recent Discord Audit Log Events**:
` + (logLines.join("\n") || "No recent audit events logged."),
            success: true
          };
        }
      } catch (err) {
        return { action: "FETCH_AUDIT_LOGS_FAILED", details: {}, result: `Audit log error: ${err.message}`, success: false };
      }
    }
    if (actionName === "create_role") {
      const colorInt = parseInt((args.colorHex || "#E50914").replace("#", ""), 16) || 15010068;
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
        method: "POST",
        headers: getDiscordHeaders(),
        body: JSON.stringify({
          name: args.name,
          color: colorInt,
          hoist: args.hoist !== void 0 ? !!args.hoist : true,
          mentionable: !!args.mentionable,
          permissions: args.permissions || void 0
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (args.levelPerk && typeof args.levelPerk === "number") {
          levelTiers[args.levelPerk] = { name: args.name, color: args.colorHex || "#E50914" };
        }
        return { action: "CREATED_ROLE", details: { ...args, roleId: data.id }, result: `Created role @${args.name} (ID:${data.id})${args.levelPerk ? ` & mapped to Level ${args.levelPerk}` : ""}`, success: true };
      }
      return { action: "CREATED_ROLE_FAILED", details: args, result: `Failed to create @${args.name}: ${data.message || "Error"}`, success: false };
    }
    if (actionName === "delete_role") {
      let targetRoleId = args.roleId;
      if (!targetRoleId && args.name) {
        const found = currentRoles.find((r) => r.name.toLowerCase() === args.name.toLowerCase().replace("@", ""));
        if (found) targetRoleId = found.id;
      }
      if (!targetRoleId) return { action: "DELETE_ROLE_NOT_FOUND", details: args, result: `Could not locate role "${args.name}"`, success: false };
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles/${targetRoleId}`, { method: "DELETE", headers: getDiscordHeaders() });
      return { action: "DELETED_ROLE", details: { targetRoleId, name: args.name }, result: res.ok ? `Deleted role @${args.name}` : `Failed: status ${res.status}`, success: res.ok };
    }
    if (actionName === "edit_role") {
      let targetRoleId = args.roleId;
      if (!targetRoleId && args.name) {
        const found = currentRoles.find((r) => r.name.toLowerCase() === args.name.toLowerCase().replace("@", ""));
        if (found) targetRoleId = found.id;
      }
      if (!targetRoleId) return { action: "EDIT_ROLE_NOT_FOUND", details: args, result: `Could not locate role "${args.name}"`, success: false };
      const payload = {};
      if (args.newName) payload.name = args.newName;
      if (args.colorHex) payload.color = parseInt(args.colorHex.replace("#", ""), 16);
      if (args.hoist !== void 0) payload.hoist = !!args.hoist;
      if (args.mentionable !== void 0) payload.mentionable = !!args.mentionable;
      if (args.permissions !== void 0) payload.permissions = String(args.permissions);
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles/${targetRoleId}`, {
        method: "PATCH",
        headers: getDiscordHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return { action: "EDITED_ROLE", details: { ...args, roleId: targetRoleId }, result: res.ok ? `Updated role @${args.newName || args.name} \u2014 ${Object.keys(payload).join(", ")} changed` : `Failed: ${data.message}`, success: res.ok };
    }
    if (actionName === "create_channel") {
      const isCategory = args.type === "category";
      const formattedName = isCategory ? args.name : (args.name || "new-channel").toLowerCase().replace(/\s+/g, "-");
      let discordType = 0;
      if (args.type === "voice") discordType = 2;
      if (args.type === "category") discordType = 4;
      if (args.type === "announcement") discordType = 5;
      if (args.type === "stage") discordType = 13;
      if (args.type === "forum") discordType = 15;
      const payload = { name: formattedName, type: discordType };
      if (args.topic && discordType === 0) payload.topic = args.topic;
      if (args.parentId) payload.parent_id = args.parentId;
      if (args.parentName && !args.parentId) {
        const cat = currentChannels.find((c) => c.type === 4 && c.name.toLowerCase().includes(args.parentName.toLowerCase()));
        if (cat) payload.parent_id = cat.id;
      }
      if (args.nsfw !== void 0) payload.nsfw = !!args.nsfw;
      if (args.rateLimitPerUser) payload.rate_limit_per_user = args.rateLimitPerUser;
      if (args.bitrate) payload.bitrate = args.bitrate;
      if (args.userLimit) payload.user_limit = args.userLimit;
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`, {
        method: "POST",
        headers: getDiscordHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return { action: "CREATED_CHANNEL", details: { ...args, channelId: data.id }, result: res.ok ? `Created #${formattedName} (ID:${data.id})` : `Failed: ${data.message}`, success: res.ok };
    }
    if (actionName === "delete_channel") {
      let targetChannelId = args.channelId;
      if (!targetChannelId && args.name) {
        const clean = args.name.replace("#", "").toLowerCase();
        const found = currentChannels.find((c) => c.name.toLowerCase() === clean);
        if (found) targetChannelId = found.id;
      }
      if (!targetChannelId) return { action: "DELETE_CHANNEL_NOT_FOUND", details: args, result: `Could not locate channel "${args.name}"`, success: false };
      const res = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}`, { method: "DELETE", headers: getDiscordHeaders() });
      return { action: "DELETED_CHANNEL", details: { targetChannelId, name: args.name }, result: res.ok ? `Deleted channel #${args.name}` : `Failed: status ${res.status}`, success: res.ok };
    }
    if (actionName === "edit_channel") {
      let targetChannelId = args.channelId;
      if (!targetChannelId && args.name) {
        const clean = args.name.replace("#", "").toLowerCase();
        const found = currentChannels.find((c) => c.name.toLowerCase() === clean || c.name.toLowerCase().includes(clean));
        if (found) targetChannelId = found.id;
      }
      if (!targetChannelId) return { action: "EDIT_CHANNEL_NOT_FOUND", details: args, result: `Could not locate channel "${args.name}"`, success: false };
      const payload = {};
      if (args.newName) payload.name = args.newName.toLowerCase().replace(/\s+/g, "-");
      if (args.topic !== void 0) payload.topic = args.topic;
      if (args.nsfw !== void 0) payload.nsfw = !!args.nsfw;
      if (args.rateLimitPerUser !== void 0) payload.rate_limit_per_user = args.rateLimitPerUser;
      if (args.bitrate) payload.bitrate = args.bitrate;
      if (args.userLimit !== void 0) payload.user_limit = args.userLimit;
      if (args.parentId) payload.parent_id = args.parentId;
      if (args.parentName) {
        const cat = currentChannels.find((c) => c.type === 4 && c.name.toLowerCase().includes(args.parentName.toLowerCase()));
        if (cat) payload.parent_id = cat.id;
      }
      const res = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}`, {
        method: "PATCH",
        headers: getDiscordHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return { action: "EDITED_CHANNEL", details: { ...args, channelId: targetChannelId }, result: res.ok ? `Updated #${args.name} \u2014 ${Object.keys(payload).join(", ")} changed` : `Failed: ${data.message}`, success: res.ok };
    }
    if (actionName === "edit_channel_permissions") {
      let targetChannelId = args.channelId;
      if (!targetChannelId && args.channelName) {
        const clean = args.channelName.replace("#", "").toLowerCase();
        const found = currentChannels.find((c) => c.name.toLowerCase() === clean || c.name.toLowerCase().includes(clean));
        if (found) targetChannelId = found.id;
      }
      if (!targetChannelId) return { action: "EDIT_PERM_NOT_FOUND", details: args, result: `Could not locate channel "${args.channelName}"`, success: false };
      let overwriteId = args.targetId;
      const overwriteType = args.targetType === "member" ? 1 : 0;
      if (!overwriteId && args.targetName) {
        if (overwriteType === 0) {
          if (args.targetName.toLowerCase() === "@everyone" || args.targetName.toLowerCase() === "everyone") {
            overwriteId = DISCORD_GUILD_ID;
          } else {
            const role = currentRoles.find((r) => r.name.toLowerCase() === args.targetName.toLowerCase().replace("@", ""));
            if (role) overwriteId = role.id;
          }
        }
      }
      if (!overwriteId) return { action: "EDIT_PERM_NO_TARGET", details: args, result: `Could not find target "${args.targetName}" for permissions`, success: false };
      const res = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/permissions/${overwriteId}`, {
        method: "PUT",
        headers: getDiscordHeaders(),
        body: JSON.stringify({
          type: overwriteType,
          allow: String(args.allow || "0"),
          deny: String(args.deny || "0")
        })
      });
      return { action: "EDITED_CHANNEL_PERMISSIONS", details: { ...args, channelId: targetChannelId, targetId: overwriteId }, result: res.ok ? `Updated permissions on #${args.channelName} for ${args.targetName} (allow:${args.allow}, deny:${args.deny})` : `Failed: status ${res.status}`, success: res.ok };
    }
    if (actionName === "delete_channel_permissions") {
      let targetChannelId = args.channelId;
      if (!targetChannelId && args.channelName) {
        const clean = args.channelName.replace("#", "").toLowerCase();
        const found = currentChannels.find((c) => c.name.toLowerCase() === clean || c.name.toLowerCase().includes(clean));
        if (found) targetChannelId = found.id;
      }
      let overwriteId = args.targetId;
      if (!overwriteId && args.targetName) {
        if (args.targetName.toLowerCase() === "@everyone" || args.targetName.toLowerCase() === "everyone") {
          overwriteId = DISCORD_GUILD_ID;
        } else {
          const role = currentRoles.find((r) => r.name.toLowerCase() === args.targetName.toLowerCase().replace("@", ""));
          if (role) overwriteId = role.id;
        }
      }
      if (!targetChannelId || !overwriteId) return { action: "DELETE_PERM_FAIL", details: args, result: "Missing channel or target for permission removal", success: false };
      const res = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/permissions/${overwriteId}`, { method: "DELETE", headers: getDiscordHeaders() });
      return { action: "DELETED_CHANNEL_PERMISSIONS", details: args, result: res.ok ? `Removed permission override on #${args.channelName} for ${args.targetName}` : `Failed: ${res.status}`, success: res.ok };
    }
    if (actionName === "bulk_edit_channel_permissions") {
      const targetType = args.channelType;
      let overwriteId = args.targetId;
      if (!overwriteId && args.targetName) {
        if (args.targetName.toLowerCase() === "@everyone" || args.targetName.toLowerCase() === "everyone") {
          overwriteId = DISCORD_GUILD_ID;
        } else {
          const role = currentRoles.find((r) => r.name.toLowerCase() === args.targetName.toLowerCase().replace("@", ""));
          if (role) overwriteId = role.id;
        }
      }
      if (!overwriteId) return { action: "BULK_PERM_NO_TARGET", details: args, result: `Could not find "${args.targetName}"`, success: false };
      let channels = currentChannels;
      if (targetType === "voice") channels = currentChannels.filter((c) => c.type === 2);
      else if (targetType === "text") channels = currentChannels.filter((c) => c.type === 0);
      channels = channels.filter((c) => c.type !== 4);
      let successCount = 0;
      for (const ch of channels) {
        try {
          const r = await fetch(`https://discord.com/api/v10/channels/${ch.id}/permissions/${overwriteId}`, {
            method: "PUT",
            headers: getDiscordHeaders(),
            body: JSON.stringify({ type: args.targetType === "member" ? 1 : 0, allow: String(args.allow || "0"), deny: String(args.deny || "0") })
          });
          if (r.ok) successCount++;
        } catch {
        }
      }
      return { action: "BULK_EDITED_PERMISSIONS", details: args, result: `Updated permissions on ${successCount}/${channels.length} ${targetType || "all"} channels for ${args.targetName}`, success: successCount > 0 };
    }
    if (actionName === "list_members") {
      const limit = Math.min(args.limit || 20, 100);
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members?limit=${limit}`, { headers: getDiscordHeaders() });
      if (res.ok) {
        const members = await res.json();
        const list = members.map((m) => `${m.user.username}#${m.user.discriminator || "0"} (ID:${m.user.id}) \u2014 Roles: ${m.roles.length}`).join("\n");
        return { action: "LISTED_MEMBERS", details: args, result: `Found ${members.length} members:
${list}`, success: true };
      }
      return { action: "LIST_MEMBERS_FAILED", details: args, result: "Failed to fetch members", success: false };
    }
    if (actionName === "edit_member") {
      const { userId, nickname, deaf, mute, roleIdsToAdd, roleIdsToRemove, rolesToAdd, rolesToRemove } = args;
      if (!userId) return { action: "EDIT_MEMBER_NO_ID", details: args, result: "No userId provided", success: false };
      const results = [];
      const patchPayload = {};
      if (nickname !== void 0) patchPayload.nick = nickname;
      if (deaf !== void 0) patchPayload.deaf = !!deaf;
      if (mute !== void 0) patchPayload.mute = !!mute;
      if (Object.keys(patchPayload).length > 0) {
        const r = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, {
          method: "PATCH",
          headers: getDiscordHeaders(),
          body: JSON.stringify(patchPayload)
        });
        results.push(r.ok ? `Updated member properties: ${Object.keys(patchPayload).join(", ")}` : "Failed to update member properties");
      }
      if (rolesToAdd && Array.isArray(rolesToAdd)) {
        for (const roleName of rolesToAdd) {
          const role = currentRoles.find((r) => r.name.toLowerCase() === roleName.toLowerCase().replace("@", ""));
          if (role) {
            const r = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${role.id}`, { method: "PUT", headers: getDiscordHeaders() });
            results.push(r.ok ? `Added @${role.name}` : `Failed to add @${roleName}`);
          }
        }
      }
      if (rolesToRemove && Array.isArray(rolesToRemove)) {
        for (const roleName of rolesToRemove) {
          const role = currentRoles.find((r) => r.name.toLowerCase() === roleName.toLowerCase().replace("@", ""));
          if (role) {
            const r = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${role.id}`, { method: "DELETE", headers: getDiscordHeaders() });
            results.push(r.ok ? `Removed @${role.name}` : `Failed to remove @${roleName}`);
          }
        }
      }
      return { action: "EDITED_MEMBER", details: args, result: results.join("; ") || "No changes applied", success: results.length > 0 };
    }
    if (actionName === "add_role_to_member") {
      let roleId = args.roleId;
      if (!roleId && args.roleName) {
        const role = currentRoles.find((r) => r.name.toLowerCase() === args.roleName.toLowerCase().replace("@", ""));
        if (role) roleId = role.id;
      }
      if (!roleId || !args.userId) return { action: "ADD_ROLE_FAIL", details: args, result: "Missing roleId or userId", success: false };
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${args.userId}/roles/${roleId}`, { method: "PUT", headers: getDiscordHeaders() });
      return { action: "ADDED_ROLE_TO_MEMBER", details: args, result: res.ok ? `Added role to user ${args.userId}` : `Failed: ${res.status}`, success: res.ok };
    }
    if (actionName === "remove_role_from_member") {
      let roleId = args.roleId;
      if (!roleId && args.roleName) {
        const role = currentRoles.find((r) => r.name.toLowerCase() === args.roleName.toLowerCase().replace("@", ""));
        if (role) roleId = role.id;
      }
      if (!roleId || !args.userId) return { action: "REMOVE_ROLE_FAIL", details: args, result: "Missing roleId or userId", success: false };
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${args.userId}/roles/${roleId}`, { method: "DELETE", headers: getDiscordHeaders() });
      return { action: "REMOVED_ROLE_FROM_MEMBER", details: args, result: res.ok ? `Removed role from user ${args.userId}` : `Failed: ${res.status}`, success: res.ok };
    }
    if (actionName === "moderate_member") {
      const { userId, action, reason = "Action via Club EZKEN AI", durationMinutes = 60 } = args;
      if (action === "TIMEOUT") {
        const timeoutUntil = new Date(Date.now() + durationMinutes * 60 * 1e3).toISOString();
        const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, {
          method: "PATCH",
          headers: getDiscordHeaders(),
          body: JSON.stringify({ communication_disabled_until: timeoutUntil })
        });
        return { action: "TIMEOUT_MEMBER", details: args, result: res.ok ? `Timed out user ${userId} for ${durationMinutes}m` : "Failed to timeout", success: res.ok };
      }
      if (action === "UNTIMEOUT") {
        const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, {
          method: "PATCH",
          headers: getDiscordHeaders(),
          body: JSON.stringify({ communication_disabled_until: null })
        });
        return { action: "UNTIMEOUT_MEMBER", details: args, result: res.ok ? `Removed timeout from user ${userId}` : "Failed", success: res.ok };
      }
      if (action === "KICK") {
        const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`, { method: "DELETE", headers: getDiscordHeaders() });
        return { action: "KICK_MEMBER", details: args, result: res.ok ? `Kicked user ${userId}` : "Failed", success: res.ok };
      }
      if (action === "BAN") {
        const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/bans/${userId}`, {
          method: "PUT",
          headers: getDiscordHeaders(),
          body: JSON.stringify({ reason })
        });
        return { action: "BAN_MEMBER", details: args, result: res.ok ? `Banned user ${userId}` : "Failed", success: res.ok };
      }
      if (action === "UNBAN") {
        const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/bans/${userId}`, { method: "DELETE", headers: getDiscordHeaders() });
        return { action: "UNBAN_MEMBER", details: args, result: res.ok ? `Unbanned user ${userId}` : "Failed", success: res.ok };
      }
    }
    if (actionName === "get_guild_info") {
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}?with_counts=true`, { headers: getDiscordHeaders() });
      if (res.ok) {
        const g = await res.json();
        return { action: "GOT_GUILD_INFO", details: {}, result: `Server: ${g.name} | Members: ${g.approximate_member_count || "N/A"} | Verification: ${g.verification_level} | Boost Tier: ${g.premium_tier} | Boosts: ${g.premium_subscription_count || 0} | System Channel: ${g.system_channel_id || "None"} | Default Notifications: ${g.default_message_notifications === 0 ? "All Messages" : "Only Mentions"} | NSFW Level: ${g.nsfw_level}`, success: true };
      }
      return { action: "GET_GUILD_FAILED", details: {}, result: "Failed to fetch guild info", success: false };
    }
    if (actionName === "edit_guild") {
      const payload = {};
      if (args.name) payload.name = args.name;
      if (args.verificationLevel !== void 0) payload.verification_level = args.verificationLevel;
      if (args.defaultMessageNotifications !== void 0) payload.default_message_notifications = args.defaultMessageNotifications;
      if (args.explicitContentFilter !== void 0) payload.explicit_content_filter = args.explicitContentFilter;
      if (args.systemChannelId) payload.system_channel_id = args.systemChannelId;
      if (args.afkChannelId) payload.afk_channel_id = args.afkChannelId;
      if (args.afkTimeout) payload.afk_timeout = args.afkTimeout;
      const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}`, {
        method: "PATCH",
        headers: getDiscordHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return { action: "EDITED_GUILD", details: payload, result: res.ok ? `Updated server settings: ${Object.keys(payload).join(", ")}` : `Failed: ${data.message}`, success: res.ok };
    }
    if (actionName === "send_message") {
      let targetId = args.channelId;
      if (!targetId && args.channelName) {
        const clean = args.channelName.replace("#", "").toLowerCase();
        const found = currentChannels.find((c) => c.name.toLowerCase() === clean || c.name.toLowerCase().includes(clean));
        if (found) targetId = found.id;
      }
      if (!targetId) return { action: "SEND_MSG_NO_CHANNEL", details: args, result: `Could not find channel "${args.channelName}"`, success: false };
      const body = {};
      if (args.content) body.content = args.content;
      if (args.embedTitle || args.embedDescription) {
        body.embeds = [{
          title: args.embedTitle || void 0,
          description: args.embedDescription || void 0,
          color: parseInt((args.colorHex || "#E50914").replace("#", ""), 16) || 15010068,
          footer: args.embedFooter ? { text: args.embedFooter } : void 0,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }];
      }
      const res = await fetch(`https://discord.com/api/v10/channels/${targetId}/messages`, {
        method: "POST",
        headers: getDiscordHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return { action: "SENT_MESSAGE", details: { ...args, channelId: targetId }, result: res.ok ? `Sent message to #${args.channelName || targetId}` : `Failed: ${data.message}`, success: res.ok };
    }
    if (actionName === "send_announcement") {
      let targetId = args.channelId;
      if (!targetId && args.channelName) {
        const clean = args.channelName.replace("#", "").toLowerCase();
        const found = currentChannels.find((c) => c.name.toLowerCase() === clean || c.name.toLowerCase().includes(clean));
        if (found) targetId = found.id;
      }
      if (!targetId) {
        const fallback = currentChannels.find((c) => c.name.includes("announcement") || c.name.includes("general") || c.type === 0);
        if (fallback) targetId = fallback.id;
      }
      if (targetId) {
        const colorInt = parseInt((args.colorHex || "#E50914").replace("#", ""), 16) || 15010068;
        const res = await fetch(`https://discord.com/api/v10/channels/${targetId}/messages`, {
          method: "POST",
          headers: getDiscordHeaders(),
          body: JSON.stringify({ embeds: [{ title: args.title || "Club EZKEN Announcement", description: args.description || "", color: colorInt, footer: { text: "Club EZKEN Official" }, timestamp: (/* @__PURE__ */ new Date()).toISOString() }] })
        });
        const data = await res.json();
        return { action: "SENT_ANNOUNCEMENT", details: { ...args, channelId: targetId }, result: res.ok ? `Sent announcement "${args.title}" to #${args.channelName || targetId}` : `Failed: ${data.message}`, success: res.ok };
      }
      return { action: "ANNOUNCE_NO_CHANNEL", details: args, result: "No target channel found", success: false };
    }
    if (actionName === "purge_messages") {
      let targetId = args.channelId;
      if (!targetId && args.channelName) {
        const clean = args.channelName.replace("#", "").toLowerCase();
        const found = currentChannels.find((c) => c.name.toLowerCase() === clean);
        if (found) targetId = found.id;
      }
      if (!targetId) return { action: "PURGE_NO_CHANNEL", details: args, result: "Channel not found", success: false };
      const count = Math.min(args.count || 10, 100);
      const msgsRes = await fetch(`https://discord.com/api/v10/channels/${targetId}/messages?limit=${count}`, { headers: getDiscordHeaders() });
      if (!msgsRes.ok) return { action: "PURGE_FETCH_FAIL", details: args, result: "Failed to fetch messages", success: false };
      const msgs = await msgsRes.json();
      const ids = msgs.map((m) => m.id);
      if (ids.length < 2) {
        for (const id of ids) {
          await fetch(`https://discord.com/api/v10/channels/${targetId}/messages/${id}`, { method: "DELETE", headers: getDiscordHeaders() });
        }
        return { action: "PURGED_MESSAGES", details: args, result: `Deleted ${ids.length} message(s) from #${args.channelName}`, success: true };
      }
      const res = await fetch(`https://discord.com/api/v10/channels/${targetId}/messages/bulk-delete`, {
        method: "POST",
        headers: getDiscordHeaders(),
        body: JSON.stringify({ messages: ids })
      });
      return { action: "PURGED_MESSAGES", details: args, result: res.ok ? `Purged ${ids.length} messages from #${args.channelName}` : `Bulk delete failed (messages may be >14 days old)`, success: res.ok };
    }
    if (actionName === "assign_level_tier") {
      levelTiers[args.level] = { name: args.tierName, color: args.colorHex || "#E50914" };
      return { action: "ASSIGNED_LEVEL_TIER", details: args, result: `Level ${args.level} \u2192 "${args.tierName}"`, success: true };
    }
    return { action: actionName, details: args, result: "Action completed", success: true };
  } catch (err) {
    return { action: actionName, details: args, result: `Execution error: ${err.message}`, success: false };
  }
}
function parseNaturalLanguageIntent(prompt) {
  const actions = [];
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const isPttQuestion = /(?:check|is|does|do|why|how|what|are|has|have).*?(?:push\s*to\s*talk|ptt|talk\s*normally|voice\s*activity|open\s*mic)/i.test(text) || /(?:push\s*to\s*talk|ptt|voice\s*activity)/i.test(text) && (text.includes("?") || /(?:check|status|needed|required|enabled)/i.test(text));
  if (isPttQuestion) {
    actions.push({
      name: "check_voice_permissions",
      args: {}
    });
    return actions;
  }
  if (/push\s*to\s*talk|ptt|talk\s*normally|voice\s*activity|open\s*mic|can'?t\s*talk\s*in\s*v(?:c|oice)|allow.*(?:talk|speak)|disable.*push|enable.*(?:talk|vad)|remove.*push|fix.*(?:voice|talk|mic)/i.test(text)) {
    actions.push({
      name: "disable_push_to_talk",
      args: { targetChannels: "all" }
    });
    return actions;
  }
  if (/server\s*(?:status|overview|info|summary|audit)|how\s*many\s*(?:channels|roles|members)/i.test(text)) {
    actions.push({
      name: "get_server_overview",
      args: {}
    });
    return actions;
  }
  const purgeMatch = text.match(/(?:purge|clear|clean|delete)\s+(\d+)\s+messages?(?:\s+(?:in|from)\s+([#a-zA-Z0-9_-]+))?/i);
  if (purgeMatch) {
    actions.push({
      name: "purge_messages",
      args: {
        count: parseInt(purgeMatch[1]),
        channelName: purgeMatch[2] ? purgeMatch[2].replace("#", "") : "general"
      }
    });
    return actions;
  }
  const roleRegex = /(?:create|make|add)\s+(?:a\s+)?role\s+(?:named|called\s+)?["']?([a-zA-Z0-9\s_-]+?)["']?(?:\s+(?:with|color)\s+([#a-zA-Z0-9]+))?(?:\s+(?:at|to|for)\s+level\s+(\d+))?(?:$|\.|\band\b)/i;
  const roleMatch = text.match(roleRegex);
  if (roleMatch && !lower.includes("channel") && !lower.includes("voice")) {
    const name = roleMatch[1].trim();
    let colorHex = "#E50914";
    if (roleMatch[2]) {
      const col = roleMatch[2].toLowerCase();
      if (col.includes("gold") || col.includes("yellow")) colorHex = "#FBBF24";
      else if (col.includes("blue") || col.includes("cyan")) colorHex = "#38BDF8";
      else if (col.includes("green")) colorHex = "#10B981";
      else if (col.includes("purple")) colorHex = "#A855F7";
      else if (col.startsWith("#")) colorHex = col;
    }
    const levelPerk = roleMatch[3] ? parseInt(roleMatch[3]) : null;
    actions.push({
      name: "create_role",
      args: { name, colorHex, levelPerk, hoist: true, mentionable: false }
    });
  }
  const chanRegex = /(?:create|make|add)\s+(?:a\s+)?(text|voice|announcement|category)?\s*channel\s+(?:named|called)\s+["']?([#a-zA-Z0-9\s_-]+?)["']?(?:\s+with\s+topic\s+["']?([^"']+)["']?)?(?:$|\.|\band\b)/i;
  const chanMatch = text.match(chanRegex);
  if (chanMatch) {
    const type = (chanMatch[1] || "text").toLowerCase();
    const rawName = chanMatch[2].replace("#", "").trim();
    const topic = chanMatch[3] || "Managed by Club EZKEN AI Architect";
    actions.push({
      name: "create_channel",
      args: { name: rawName, type, topic }
    });
  }
  const delChanRegex = /(?:delete|remove)\s+(?:the\s+)?channel\s+["']?([#a-zA-Z0-9\s_-]+?)["']?(?:$|\.|\band\b)/i;
  const delChanMatch = text.match(delChanRegex);
  if (delChanMatch) {
    actions.push({
      name: "delete_channel",
      args: { name: delChanMatch[1].replace("#", "").trim() }
    });
  }
  const delRoleRegex = /(?:delete|remove)\s+(?:the\s+)?role\s+["']?([@a-zA-Z0-9\s_-]+?)["']?(?:$|\.|\band\b)/i;
  const delRoleMatch = text.match(delRoleRegex);
  if (delRoleMatch) {
    actions.push({
      name: "delete_role",
      args: { name: delRoleMatch[1].replace("@", "").trim() }
    });
  }
  const lvlRegex = /(?:assign|set|map)\s+level\s+(\d+)\s+(?:to|as)\s+["']?([a-zA-Z0-9\s_-]+?)["']?/i;
  const lvlMatch = text.match(lvlRegex);
  if (lvlMatch) {
    actions.push({
      name: "assign_level_tier",
      args: { level: parseInt(lvlMatch[1]), tierName: lvlMatch[2].trim(), colorHex: "#E50914" }
    });
  }
  const announceRegex = /(?:send|dispatch|post|write)\s+(?:an?\s+)?announcement(?:\s+post)?(?:\s+(?:to|in)\s+([#a-zA-Z0-9_-]+)\s*)?(?:saying|with\s+title|welcoming)?\s*["']?([^"']*)["']?/i;
  const announceMatch = text.match(announceRegex);
  if (announceMatch && !actions.some((a) => a.name === "send_announcement")) {
    actions.push({
      name: "send_announcement",
      args: {
        channelName: announceMatch[1] ? announceMatch[1].replace("#", "") : "announcements",
        title: "Club EZKEN Official Broadcast",
        description: announceMatch[2] || "\u{1F4E2} Welcome to Club EZKEN! Check out the channels, level up in voice comms, and enjoy the community!",
        colorHex: "#E50914"
      }
    });
  }
  return actions;
}
var checkVoicePermissionsDeclaration = {
  name: "check_voice_permissions",
  description: "Check whether Push-to-Talk is currently required or if Voice Activity Detection (open mic) is enabled for members across the server and voice channels",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};
var disablePushToTalkDeclaration = {
  name: "disable_push_to_talk",
  description: "Disables forced push-to-talk across the Discord server and all voice channels so all members can talk normally with Voice Activity Detection (open mic / VAD). Updates @everyone and tier roles, and removes USE_VAD deny overwrites on voice channels.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetChannels: { type: Type.STRING, description: '"all" or specific voice channel name' },
      reason: { type: Type.STRING, description: "Reason for enabling voice activity" }
    }
  }
};
var editChannelPermissionsDeclaration = {
  name: "edit_channel_permissions",
  description: "Configure allow and deny permissions for a role or member on a specific channel",
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelName: { type: Type.STRING, description: 'Channel name, e.g. "general", "lounge-vc"' },
      channelId: { type: Type.STRING, description: "Optional channel ID" },
      targetName: { type: Type.STRING, description: 'Role or member name, e.g. "@everyone", "Member", or username' },
      targetId: { type: Type.STRING, description: "Optional role or member ID" },
      targetType: { type: Type.STRING, description: '"role" or "member"' },
      allow: { type: Type.STRING, description: "Permission bitfield string to allow" },
      deny: { type: Type.STRING, description: "Permission bitfield string to deny" }
    },
    required: ["targetName"]
  }
};
var bulkEditChannelPermissionsDeclaration = {
  name: "bulk_edit_channel_permissions",
  description: "Batch update permissions across all voice channels or all text channels for a role",
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelType: { type: Type.STRING, description: '"voice", "text", or "all"' },
      targetName: { type: Type.STRING, description: 'Role name e.g. "@everyone", "Member"' },
      allow: { type: Type.STRING, description: "Permission bitfield string to allow" },
      deny: { type: Type.STRING, description: "Permission bitfield string to deny" }
    },
    required: ["channelType", "targetName"]
  }
};
var createRoleDeclaration = {
  name: "create_role",
  description: "Create a new role in the Club EZKEN Discord server with color and optional level tier assignment",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Role name, e.g. "Diamond Elite", "VIP", "Tournament Champion"' },
      colorHex: { type: Type.STRING, description: 'Hex color code e.g. "#E50914", "#FBBF24", "#38BDF8"' },
      levelPerk: { type: Type.INTEGER, description: "Optional level tier to unlock this role, e.g. 10, 25, 50" },
      mentionable: { type: Type.BOOLEAN, description: "Whether role is mentionable by members" },
      hoist: { type: Type.BOOLEAN, description: "Display role separately in member list" },
      permissions: { type: Type.STRING, description: "Optional permission bitfield string" }
    },
    required: ["name"]
  }
};
var deleteRoleDeclaration = {
  name: "delete_role",
  description: "Delete a role from the Discord server by name or roleId",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Name of the role to delete" },
      roleId: { type: Type.STRING, description: "Optional ID of the role" }
    },
    required: ["name"]
  }
};
var editRoleDeclaration = {
  name: "edit_role",
  description: "Edit an existing role (name, color, hoist, mentionable, or permissions bitfield)",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Existing role name" },
      roleId: { type: Type.STRING, description: "Optional role ID" },
      newName: { type: Type.STRING, description: "New name for the role" },
      colorHex: { type: Type.STRING, description: "New hex color code" },
      hoist: { type: Type.BOOLEAN, description: "Display role separately" },
      mentionable: { type: Type.BOOLEAN, description: "Allow role to be mentioned" },
      permissions: { type: Type.STRING, description: "New permission bitfield string" }
    },
    required: ["name"]
  }
};
var createChannelDeclaration = {
  name: "create_channel",
  description: "Create a new text, voice, announcement, or category channel in Club EZKEN Discord server",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Channel name, e.g. "tournament-chat", "squad-lounge"' },
      type: { type: Type.STRING, description: '"text", "voice", "category", "announcement", or "stage"' },
      topic: { type: Type.STRING, description: "Channel topic or description" },
      parentId: { type: Type.STRING, description: "Optional category ID to place this channel in" },
      parentName: { type: Type.STRING, description: "Optional category name to place this channel in" },
      rateLimitPerUser: { type: Type.INTEGER, description: "Slowmode seconds" },
      userLimit: { type: Type.INTEGER, description: "Voice channel user limit" }
    },
    required: ["name"]
  }
};
var deleteChannelDeclaration = {
  name: "delete_channel",
  description: "Delete a channel from the Discord server by name or channelId",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Name of the channel to delete, e.g. "tournament-chat"' },
      channelId: { type: Type.STRING, description: "Optional channel ID" }
    },
    required: ["name"]
  }
};
var editChannelDeclaration = {
  name: "edit_channel",
  description: "Modify an existing channel (name, topic, slowmode, user limit, bitrate, nsfw, or category)",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Current channel name to modify" },
      channelId: { type: Type.STRING, description: "Optional channel ID" },
      newName: { type: Type.STRING, description: "New channel name" },
      topic: { type: Type.STRING, description: "Channel topic description" },
      rateLimitPerUser: { type: Type.INTEGER, description: "Slowmode seconds (0 to disable)" },
      userLimit: { type: Type.INTEGER, description: "Voice channel user limit (0 for unlimited)" },
      bitrate: { type: Type.INTEGER, description: "Voice channel bitrate (e.g. 64000, 96000)" },
      nsfw: { type: Type.BOOLEAN, description: "Whether channel is age-restricted (NSFW)" },
      parentName: { type: Type.STRING, description: "Category name to place the channel in" }
    },
    required: ["name"]
  }
};
var listMembersDeclaration = {
  name: "list_members",
  description: "List members in the Discord server with their username, ID, and assigned roles",
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: { type: Type.INTEGER, description: "Number of members to return (max 100, default 25)" }
    }
  }
};
var editMemberDeclaration = {
  name: "edit_member",
  description: "Update a server member (change nickname, add/remove roles, server mute, server deafen)",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: { type: Type.STRING, description: "Discord User ID" },
      nickname: { type: Type.STRING, description: "New server nickname" },
      rolesToAdd: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Names of roles to grant" },
      rolesToRemove: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Names of roles to remove" },
      mute: { type: Type.BOOLEAN, description: "Server mute voice state" },
      deaf: { type: Type.BOOLEAN, description: "Server deafen voice state" }
    },
    required: ["userId"]
  }
};
var moderateMemberDeclaration = {
  name: "moderate_member",
  description: "Timeout, untimeout, kick, ban, or unban a member from the Discord server",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: { type: Type.STRING, description: "Discord User ID" },
      action: { type: Type.STRING, description: '"TIMEOUT", "UNTIMEOUT", "KICK", "BAN", or "UNBAN"' },
      reason: { type: Type.STRING, description: "Reason for the moderation action" },
      durationMinutes: { type: Type.INTEGER, description: "Timeout duration in minutes (default 60)" }
    },
    required: ["userId", "action"]
  }
};
var purgeMessagesDeclaration = {
  name: "purge_messages",
  description: "Bulk delete messages from a channel (1 to 100 messages)",
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelName: { type: Type.STRING, description: "Channel to purge messages from" },
      count: { type: Type.INTEGER, description: "Number of messages to delete (1-100)" }
    },
    required: ["channelName", "count"]
  }
};
var sendAnnouncementDeclaration = {
  name: "send_announcement",
  description: "Send a styled rich embed announcement directly to a server channel in Discord",
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelName: { type: Type.STRING, description: 'Target channel name, e.g. "announcements", "general"' },
      title: { type: Type.STRING, description: "Title of the announcement" },
      description: { type: Type.STRING, description: "Content/body of the announcement" },
      colorHex: { type: Type.STRING, description: 'Hex color accent e.g. "#E50914"' }
    },
    required: ["title", "description"]
  }
};
var sendMessageDeclaration = {
  name: "send_message",
  description: "Send a regular message or styled card into any text channel",
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelName: { type: Type.STRING, description: "Target channel name" },
      content: { type: Type.STRING, description: "Message text content" },
      embedTitle: { type: Type.STRING, description: "Optional embed title" },
      embedDescription: { type: Type.STRING, description: "Optional embed description" },
      colorHex: { type: Type.STRING, description: "Optional embed color" }
    },
    required: ["channelName"]
  }
};
var getGuildInfoDeclaration = {
  name: "get_guild_info",
  description: "Retrieve current server statistics, boost level, verification level, and configuration",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};
var editGuildDeclaration = {
  name: "edit_guild",
  description: "Edit server-wide settings (server name, verification level, explicit content filter, default notifications)",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "New server name" },
      verificationLevel: { type: Type.INTEGER, description: "0=None, 1=Low, 2=Medium, 3=High, 4=Highest" },
      defaultMessageNotifications: { type: Type.INTEGER, description: "0=All Messages, 1=Only Mentions" },
      explicitContentFilter: { type: Type.INTEGER, description: "0=Disabled, 1=Members Without Roles, 2=All Members" }
    }
  }
};
var assignLevelTierDeclaration = {
  name: "assign_level_tier",
  description: "Assign a title and reward tier to the XP leveling system at a specific level",
  parameters: {
    type: Type.OBJECT,
    properties: {
      level: { type: Type.INTEGER, description: "Level requirement, e.g. 1, 5, 10, 25, 50, 100" },
      tierName: { type: Type.STRING, description: 'Name of the perk title, e.g. "Crimson General"' },
      colorHex: { type: Type.STRING, description: "Hex color code for the badge/rank card" }
    },
    required: ["level", "tierName"]
  }
};
var getServerOverviewDeclaration = {
  name: "get_server_overview",
  description: "Live comprehensive audit of all channels, categories, roles, and member stats in Club EZKEN",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};
var auditChannelPermissionsDeclaration = {
  name: "audit_channel_permissions",
  description: "Inspect exact permission overwrites (view, send, connect, speak, voice activity) on a specific channel for @everyone and roles",
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelName: { type: Type.STRING, description: "Name of channel to audit" },
      channelId: { type: Type.STRING, description: "Optional channel ID" }
    },
    required: ["channelName"]
  }
};
var auditRolePermissionsDeclaration = {
  name: "audit_role_permissions",
  description: "Inspect elevated permissions (admin, manage channels, timeout, kick, ban, voice activity) granted to a specific role",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Name of the role to audit" }
    },
    required: ["name"]
  }
};
var getAuditLogsDeclaration = {
  name: "get_audit_logs",
  description: "Fetch the recent moderation and administrative actions recorded in the Discord server audit log",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};
var allSuperAdminTools = [{
  functionDeclarations: [
    checkVoicePermissionsDeclaration,
    disablePushToTalkDeclaration,
    auditChannelPermissionsDeclaration,
    auditRolePermissionsDeclaration,
    getAuditLogsDeclaration,
    editChannelPermissionsDeclaration,
    bulkEditChannelPermissionsDeclaration,
    createRoleDeclaration,
    deleteRoleDeclaration,
    editRoleDeclaration,
    createChannelDeclaration,
    deleteChannelDeclaration,
    editChannelDeclaration,
    listMembersDeclaration,
    moderateMemberDeclaration,
    editMemberDeclaration,
    sendAnnouncementDeclaration,
    sendMessageDeclaration,
    purgeMessagesDeclaration,
    getGuildInfoDeclaration,
    editGuildDeclaration,
    assignLevelTierDeclaration,
    getServerOverviewDeclaration
  ]
}];
var recentPromptExecutions = /* @__PURE__ */ new Map();
app.post("/api/gemini/architect", async (req, res) => {
  const reqStartTime = Date.now();
  console.log("[AI ARCHITECT] Received request with prompt:", req.body?.prompt?.slice(0, 60));
  try {
    const { prompt, history: incomingHistory, imageBase64, imageMimeType, clearHistory } = req.body;
    if (clearHistory) {
      aiChatMemory.length = 0;
      return res.json({ message: "Conversation memory cleared successfully!", cleared: true });
    }
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required." });
    }
    const cacheKey = `${prompt.trim().toLowerCase()}_${Boolean(imageBase64)}`;
    const cached = recentPromptExecutions.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 8e3) {
      console.log(`[AI ARCHITECT] Debounced duplicate prompt within 8s: "${prompt.slice(0, 40)}..."`);
      return res.json(cached.responseData);
    }
    const currentChannels = await fetchGuildChannels();
    const currentRoles = await fetchGuildRoles();
    const executedActions = [];
    const channelNamesList = currentChannels.map((c) => `#${c.name} (type:${c.type === 2 ? "VOICE" : c.type === 4 ? "CATEGORY" : "TEXT"}, id:${c.id})`).slice(0, 40).join(", ");
    const roleNamesList = currentRoles.map((r) => `@${r.name} (id:${r.id})`).slice(0, 35).join(", ");
    const systemInstruction = `You are the Autonomous Discord Server Architect and Master Super Admin AI for "Club EZKEN" (Guild ID: ${DISCORD_GUILD_ID}).
You possess comprehensive, fluent, expert-level knowledge of Discord server architecture, permissions bitfields, channel design, hierarchy, voice settings, and community moderation best practices.
You speak in a natural, friendly, expert human tone \u2014 never like a rigid robot.

CURRENT DISCORD SERVER CHANNELS:
${channelNamesList || "general, announcements, lounge-welcome, mod-logs"}

CURRENT DISCORD SERVER ROLES:
${roleNamesList || "Owner, Moderator, Member"}

CURRENT XP LEVEL TIERS:
${Object.entries(levelTiers).map(([lvl, t]) => `Level ${lvl}: ${t.name} (${t.color})`).join(", ")}

DISCORD PERMISSION ARCHITECTURE & BITFIELDS:
- Voice Activity Detection (USE_VAD): 33554432 (When denied, members are forced to use Push-to-Talk! When allowed, members have open mic / voice activity)
- Voice Speaking & Connection: SPEAK = 2097152, CONNECT = 1048576, STREAM = 512, PRIORITY_SPEAKER = 256
- Text & Content: SEND_MESSAGES = 2048, VIEW_CHANNEL = 1024, EMBED_LINKS = 16384, ATTACH_FILES = 32768, USE_EXTERNAL_EMOJIS = 262144
- Administration & Moderation: ADMINISTRATOR = 8, MANAGE_GUILD = 32, MANAGE_ROLES = 268435456, MANAGE_CHANNELS = 16, MANAGE_MESSAGES = 8192, MODERATE_MEMBERS (Timeout) = 1099511627776, KICK_MEMBERS = 2, BAN_MEMBERS = 4

CONFIRMATION & COLLABORATION PROTOCOL:
1. READ-ONLY AUDITING & QUESTIONS:
   - When the user asks a question or asks you to check/audit something (e.g. "can u check does everyone need push to talk?", "what channels exist?", "audit #general permissions", "check role permissions", "how many members?"):
   - ALWAYS call the relevant audit/check tool immediately!
   - Answer their question directly and thoroughly in natural human English.
   - If an issue is found (e.g. push-to-talk is restricting voice channels), explain the diagnosis and ask:
     "Would you like me to enable open mic (Voice Activity) for everyone so they can speak freely?"

2. MODIFICATIONS & SERVER ACTIONS (Creation, Deletion, Permission Changes, Moderation):
   - When the user asks for a server modification (e.g. creating channels, creating roles, deleting things, changing permissions):
     * If the user HAS NOT confirmed yet (their prompt does not say "yes", "proceed", "do it", "confirm", "go ahead", "execute now"):
       First outline your plan clearly:
       \u2022 Explain what changes you plan to make
       \u2022 Which channels, roles, or members will be affected
       \u2022 The specific settings, colors, or permissions
       Then ask:
       "Would you like me to proceed with this plan, or would you like to make any adjustments first (like changing names, colors, or channels)?"
       Do NOT execute the modifying tool until they confirm!
     * If the user CONFIRMS (says "yes", "proceed", "do it", "confirm", "looks good", "go ahead", "execute") OR explicitly commands direct execution ("do it now", "execute immediately"):
       Call the execution tool immediately and report the live completed results!
     * If the user wants to adjust (says "okay instead of that do this or that", "make it blue instead", "only for voice channels"):
       Acknowledge their adjustment intelligently, refine the plan parameters, and ask for confirmation on the updated plan!`;
    let aiMessage = "";
    let modelWorked = false;
    let activeModelUsed = "Gemini 3.1 Flash Lite";
    const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"];
    if (aiClient) {
      const contents = [];
      const historyToUse = Array.isArray(incomingHistory) && incomingHistory.length > 0 ? incomingHistory : aiChatMemory;
      if (Array.isArray(historyToUse) && historyToUse.length > 0) {
        const sanitizedTurns = [];
        for (const item of historyToUse) {
          const role = item.role === "user" ? "user" : "model";
          const textContent = typeof item.content === "string" ? item.content : item.parts?.[0]?.text || "";
          if (textContent && textContent.trim()) {
            sanitizedTurns.push({ role, parts: [{ text: textContent }] });
          }
        }
        while (sanitizedTurns.length > 0 && sanitizedTurns[0].role !== "user") {
          sanitizedTurns.shift();
        }
        for (const turn of sanitizedTurns.slice(-16)) {
          contents.push(turn);
        }
      }
      const currentParts = [];
      if (imageBase64 && imageMimeType) {
        currentParts.push({
          inlineData: {
            data: imageBase64,
            mimeType: imageMimeType
          }
        });
      }
      currentParts.push({ text: prompt });
      contents.push({ role: "user", parts: currentParts });
      for (const modelName of candidateModels) {
        try {
          const response = await aiClient.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              tools: allSuperAdminTools
            }
          });
          const calls = response.functionCalls || [];
          if (calls.length > 0) {
            const toolResponseParts = [];
            for (const call of calls) {
              const receipt = await executeServerAction(call.name || "", call.args || {}, currentChannels, currentRoles);
              executedActions.push(receipt);
              toolResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: {
                    output: receipt.result,
                    success: receipt.success,
                    details: receipt.details
                  }
                }
              });
            }
            try {
              const candidateContent = response.candidates?.[0]?.content;
              const modelCallTurn = candidateContent || {
                role: "model",
                parts: calls.map((c) => ({ functionCall: c }))
              };
              const round2Contents = [
                ...contents,
                modelCallTurn,
                {
                  role: "user",
                  parts: toolResponseParts
                }
              ];
              const round2Response = await aiClient.models.generateContent({
                model: modelName,
                contents: round2Contents,
                config: {
                  systemInstruction: systemInstruction + `

CRITICAL DIRECTIVE: Speak like a helpful, smart, expert human Discord server moderator. Answer the user's question directly in a natural, friendly tone based on the tool results. If they asked to check something (e.g. "does everyone need push to talk?"), give them a direct, clear answer ("No, everyone has open mic enabled..."). Never output a robotic template!`
                }
              });
              if (round2Response.text && round2Response.text.trim()) {
                aiMessage = round2Response.text.trim();
              }
            } catch (r2Err) {
              console.warn("[AI ARCHITECT] Round 2 generation error:", r2Err.message);
            }
          } else {
            aiMessage = response.text || "";
          }
          modelWorked = true;
          activeModelUsed = modelName === "gemini-3.8-flash" ? "Gemini 3.8 Flash" : modelName === "gemini-3.5-flash" ? "Gemini 3.5 Flash" : "Gemini 3.1 Flash Lite";
          console.log(`[AI ARCHITECT] Successfully answered via ${activeModelUsed} in ${Date.now() - reqStartTime}ms with ${calls.length} action(s)`);
          break;
        } catch (modelErr) {
          console.warn(`[AI ARCHITECT] ${modelName} warning: ${modelErr.message}`);
        }
      }
    }
    if (!modelWorked && executedActions.length === 0) {
      const parsedActions = parseNaturalLanguageIntent(prompt);
      for (const action of parsedActions) {
        const receipt = await executeServerAction(action.name, action.args, currentChannels, currentRoles);
        executedActions.push(receipt);
      }
    }
    if (executedActions.length > 0 && !aiMessage) {
      const successList = executedActions.filter((a) => a.success).map((a) => a.result);
      const isQuestion = /(?:check|is|does|do|why|how|what|are|has|have|who)/i.test(prompt.trim()) || prompt.includes("?");
      if (isQuestion) {
        aiMessage = successList.join("\n\n");
      } else {
        aiMessage = `\u26A1 Done! I have updated your Discord server:
` + successList.map((s) => `\u2022 ${s}`).join("\n") + `

All changes are live in Club EZKEN right now!`;
      }
    } else if (!aiMessage) {
      aiMessage = `I've analyzed your server Club EZKEN (Guild ID: ${DISCORD_GUILD_ID}). Your server has ${currentChannels.length} channels and ${currentRoles.length} roles. Let me know what you would like to build or modify \u2014 e.g. "Disable Push-to-Talk so everyone can talk normally", "Create a VIP role with gold color at level 25", or "Delete channel tournament-chat"!`;
    }
    aiChatMemory.push({ role: "user", parts: [{ text: prompt }] });
    aiChatMemory.push({ role: "model", parts: [{ text: aiMessage }] });
    if (aiChatMemory.length > AI_MEMORY_MAX_TURNS) {
      aiChatMemory.splice(0, aiChatMemory.length - AI_MEMORY_MAX_TURNS);
    }
    const responsePayload = {
      message: aiMessage,
      actions: executedActions,
      levelTiers,
      guildStats: {
        channelsCount: currentChannels.length,
        rolesCount: currentRoles.length
      },
      thinking: {
        model: activeModelUsed,
        groundedChannels: currentChannels.length,
        groundedRoles: currentRoles.length,
        actionsCount: executedActions.length,
        durationMs: Date.now() - reqStartTime
      }
    };
    recentPromptExecutions.set(cacheKey, { timestamp: Date.now(), responseData: responsePayload });
    return res.json(responsePayload);
  } catch (err) {
    console.error("[AI ARCHITECT ERROR]", err?.stack || err?.message || err);
    return res.status(500).json({ error: err?.message || "AI Architect failed. Please try again." });
  }
});
app.post("/api/gemini/clear-memory", (req, res) => {
  aiChatMemory.length = 0;
  return res.json({ success: true, message: "AI Chat Memory successfully cleared." });
});
function buildFallbackSmartWarning(username, text, categories, reason, channelName = "#general") {
  const snippet = text.length > 70 ? text.substring(0, 67) + "..." : text;
  const catLabel = categories.join(", ") || "COMMUNITY_GUIDELINES";
  return `\u26A0\uFE0F **Club EZKEN Smart AI Warning (@${username})**: Your message in **${channelName}** (\`"${snippet}"\`) was automatically deleted by our Moderation Bot for **${catLabel}** (${reason}). Please follow Club EZKEN's community standards so you can keep chatting and leveling up!`;
}
app.post("/api/aimod/evaluate", async (req, res) => {
  const { text, username = "Member", channelName = "#general" } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text prompt is required." });
  }
  const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discord\.com\/invite)\/[a-zA-Z0-9-]+/gi;
  if (inviteRegex.test(text)) {
    const reason = "Posted an unauthorized external Discord server invite link.";
    const categories = ["UNAUTHORIZED_INVITE"];
    return res.json({
      flagged: true,
      confidence: 1,
      categories,
      reason,
      suggestedAction: "DELETE",
      whatHappened: `User posted an unauthorized Discord invite link in ${channelName}. Bot intercepted and deleted the message immediately.`,
      smartWarning: buildFallbackSmartWarning(username, text, categories, reason, channelName)
    });
  }
  const phishingRegex = /(free\s+discord\s+nitro|gift-discord|steam-free|claim\s+here\s+fast|http:\/\/[^\s]*fake)/i;
  if (phishingRegex.test(text)) {
    const reason = "Detected deceptive phishing or fake Nitro scam link.";
    const categories = ["PHISHING_LINK", "SCAM"];
    return res.json({
      flagged: true,
      confidence: 0.99,
      categories,
      reason,
      suggestedAction: "BAN",
      whatHappened: `User posted a suspected Nitro/phishing scam link in ${channelName}. Bot purged the message and flagged account for immediate protection.`,
      smartWarning: buildFallbackSmartWarning(username, text, categories, reason, channelName)
    });
  }
  const toxicRegex = /\b(idiot|idiots|trash|stupid|moron|loser|stfu|kill yourself|kys|garbage|scum)\b/i;
  if (toxicRegex.test(text)) {
    const reason = "Direct player harassment, insults, or toxic language toward community members.";
    const categories = ["TOXICITY", "HARASSMENT"];
    return res.json({
      flagged: true,
      confidence: 0.92,
      categories,
      reason,
      suggestedAction: "WARN",
      whatHappened: `User sent an insulting/toxic message in ${channelName}. Bot deleted the message and generated a contextual Smart AI Warning.`,
      smartWarning: buildFallbackSmartWarning(username, text, categories, reason, channelName)
    });
  }
  if (aiClient) {
    for (const model of ["gemini-3.8-flash", "gemini-3.8-flash-8b", "gemini-2.0-flash"]) {
      try {
        const prompt = `You are a real-time Discord community moderation AI for "Club EZKEN".
Analyze the following message sent by "${username}" in "${channelName}" strictly for community violations:
- Toxicity, aggressive profanity, insults, or hate speech
- Severe harassment, bullying, or doxxing threats
- NSFW or sexually explicit material
- Phishing, scam links, or malicious spam

User text:
"${text.replace(/"/g, '\\"')}"

If flagged is true, also write:
1. "whatHappened": A 1-2 sentence audit summary of what the user did and why the bot deleted the message.
\u200B2. "smartWarning": A direct, constructive warning message addressed to @${username} explaining specifically what was wrong with their message and how to follow Club EZKEN's rules.

Respond strictly using the JSON schema provided.`;
        const response = await aiClient.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                flagged: { type: Type.BOOLEAN },
                confidence: { type: Type.NUMBER },
                categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                reason: { type: Type.STRING },
                suggestedAction: { type: Type.STRING },
                whatHappened: { type: Type.STRING },
                smartWarning: { type: Type.STRING }
              },
              required: ["flagged", "confidence", "categories", "reason", "suggestedAction"]
            }
          }
        });
        const parsed = JSON.parse(response.text?.trim() || "{}");
        if (parsed.flagged && !parsed.smartWarning) {
          parsed.smartWarning = buildFallbackSmartWarning(username, text, parsed.categories || ["VIOLATION"], parsed.reason || "Rule violation", channelName);
        }
        if (parsed.flagged && !parsed.whatHappened) {
          parsed.whatHappened = `Bot deleted flagged message in ${channelName} due to${parsed.reason || "policy violation"}.`;
        }
        return res.json(parsed);
      } catch {
      }
    }
  }
  return res.json({
    flagged: false,
    confidence: 0.05,
    categories: [],
    reason: "Clean message.",
    suggestedAction: "NONE"
  });
});
app.post("/api/discord/smart-warn", async (req, res) => {
  const { username = "Member", deletedContent = "", reason = "", categories = [], channelName = "#general" } = req.body;
  if (aiClient) {
    for (const model of ["gemini-3.8-flash", "gemini-3.8-flash-8b", "gemini-2.0-flash"]) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents: `Write a concise, firm, and helpful Discord moderation warning from "Club EZKEN Bot" to user "@${username}".
Their message in ${channelName} was deleted by the bot.
Deleted message: "${deletedContent}"
Violation categories: ${(categories || []).join(", ")}
Reason: "${reason}"
Explain clearly what they did wrong in that specific message, remind them of Club EZKEN's rules, and encourage them to keep things respectful so they can keep earning XP toward our official ranks (@ROOKIE through @STAR SUPPORTER). Keep it under 75 words.`
        });
        if (response.text) {
          return res.json({ smartWarning: response.text.trim() });
        }
      } catch {
      }
    }
  }
  return res.json({
    smartWarning: buildFallbackSmartWarning(username, deletedContent, categories, reason, channelName)
  });
});
app.post("/api/discord/text-user", async (req, res) => {
  const { userId, username, message, channelName = "general", deliveryMethod = "DISCORD_DM", deletedMessage } = req.body;
  if (!message) return res.status(400).json({ error: "Message text required." });
  let deliveredLive = false;
  let deliveryNote = "Recorded & sent via Club EZKEN Messaging Relay";
  try {
    if (deliveryMethod === "DISCORD_DM" && userId && /^\d{16,21}$/.test(String(userId))) {
      const dmChannelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
        method: "POST",
        headers: getDiscordHeaders(),
        body: JSON.stringify({ recipient_id: String(userId) })
      });
      if (dmChannelRes.ok) {
        const dmChannel = await dmChannelRes.json();
        const dmMsgRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
          method: "POST",
          headers: getDiscordHeaders(),
          body: JSON.stringify({
            content: message,
            embeds: deletedMessage ? [
              {
                title: "\u{1F6E1}\uFE0F Club EZKEN Moderation Notice",
                description: message,
                color: 15010068,
                fields: [
                  { name: "Deleted Message", value: `\`\`\`${deletedMessage.substring(0, 300)}\`\`\`` },
                  { name: "Channel", value: channelName, inline: true }
                ],
                footer: { text: "Club EZKEN Smart AI Moderation \u2022 Reply or contact KEN for appeals" },
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              }
            ] : void 0
          })
        });
        if (dmMsgRes.ok) {
          deliveredLive = true;
          deliveryNote = `Delivered directly to @${username}'s Discord DMs`;
        }
      }
    }
    if (!deliveredLive && deliveryMethod === "CHANNEL_PING") {
      const channels = await fetchGuildChannels();
      const cleanChan = channelName.replace("#", "").toLowerCase();
      const target = channels.find((c) => c.name.toLowerCase() === cleanChan) || channels.find((c) => c.name.includes("general") || c.type === 0);
      if (target) {
        const chanRes = await fetch(`https://discord.com/api/v10/channels/${target.id}/messages`, {
          method: "POST",
          headers: getDiscordHeaders(),
          body: JSON.stringify({
            content: userId && /^\d{16,21}$/.test(String(userId)) ? `<@${userId}>` : `**@${username}**`,
            embeds: [
              {
                title: `\u26A0\uFE0F Official Club EZKEN Message for @${username}`,
                description: message,
                color: 15010068,
                fields: deletedMessage ? [{ name: "Referenced Deleted Message", value: `\`\`\`${deletedMessage.substring(0, 250)}\`\`\`` }] : void 0,
                footer: { text: "Dispatched by KEN \u2022 Club EZKEN Moderation Suite" },
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              }
            ]
          })
        });
        if (chanRes.ok) {
          deliveredLive = true;
          deliveryNote = `Dispatched live to Discord channel #${target.name}`;
        }
      }
    }
    const db = loadModRecords();
    const chatEntry = {
      id: `msg_${Date.now()}`,
      sender: "ADMIN_KEN",
      senderName: "KEN (Super Admin)",
      text: message,
      timestamp: Date.now(),
      deliveryMethod,
      deliveredLive
    };
    let matched = false;
    for (const d of db.deletedMessages) {
      if (userId && d.user_id === String(userId) || username && d.user_tag.toLowerCase() === String(username).toLowerCase()) {
        if (!Array.isArray(d.messages_sent)) d.messages_sent = [];
        d.messages_sent.push(chatEntry);
        d.warning_sent = true;
        matched = true;
        break;
      }
    }
    saveModRecords(db);
    const modLogChan = discordBot.channels.cache.get(MOD_LOGS_CHANNEL_ID) || await discordBot.channels.fetch(MOD_LOGS_CHANNEL_ID).catch(() => null);
    if (modLogChan && modLogChan.isTextBased()) {
      const auditEmbed = new EmbedBuilder3().setTitle("\u{1F4E9} DIRECT WARNING / TEXT DISPATCH").setColor(1096065).setDescription(
        `**Recipient**: **@${username || userId}** (\`${userId || "N/A"}\`)
**Channel/Method**: \`${deliveryMethod}\` (${channelName})
**Dispatched Message**:
\`\`\`${message.substring(0, 400)}\`\`\`
*Status*: ${deliveryNote}`
      ).setFooter({ text: "Club EZKEN Direct Warning Relay" }).setTimestamp();
      await modLogChan.send({ embeds: [auditEmbed] }).catch(() => {
      });
    }
  } catch (err) {
    console.warn("[TEXT USER] Discord REST relay note:", err.message);
  }
  return res.json({
    success: true,
    deliveredLive,
    deliveryNote,
    timestamp: Date.now()
  });
});
app.put("/api/discord/level-tiers", (req, res) => {
  const { updatedTiers } = req.body;
  if (updatedTiers && typeof updatedTiers === "object") {
    const validated = {};
    for (const [lvlStr, val] of Object.entries(updatedTiers)) {
      const lvl = parseInt(lvlStr);
      const roleName = String(val.name || "").toUpperCase();
      if (!isNaN(lvl) && ALLOWED_LEVEL_ROLES[roleName]) {
        validated[lvl] = {
          name: roleName,
          color: val.color || ALLOWED_LEVEL_ROLES[roleName]
        };
      }
    }
    if (Object.keys(validated).length > 0) {
      levelTiers = validated;
    }
  }
  return res.json({ success: true, levelTiers });
});
app.get("/api/tempvoice/config", (_req, res) => {
  return res.json(loadTempVoiceConfig());
});
app.post("/api/tempvoice/config", (req, res) => {
  const current = loadTempVoiceConfig();
  const updated = { ...current, ...req.body };
  saveTempVoiceConfig(updated);
  return res.json({ success: true, config: updated });
});
app.get("/api/tempvoice/channels", (_req, res) => {
  try {
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channels = Array.from(activeTempVcs.values()).map((v) => {
      const ch = guild?.channels.cache.get(v.channelId);
      const members = ch && "members" in ch ? Array.from(ch.members.values()).map((m) => ({
        id: m.id,
        tag: m.user?.tag || m.displayName,
        displayName: m.displayName || m.user?.username,
        avatar: m.user?.displayAvatarURL?.() || null,
        isMuted: m.voice?.mute || false,
        isDeaf: m.voice?.deaf || false
      })) : [];
      return {
        ...v,
        memberCount: members.length,
        members
      };
    });
    return res.json({ channels });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/tempvoice/auto-setup", async (_req, res) => {
  try {
    const result = await autoSetupTempVoice(discordBot, DISCORD_GUILD_ID);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/tempvoice/deploy-interface", async (req, res) => {
  try {
    const cfg = loadTempVoiceConfig();
    const targetChannelId = req.body?.channelId || cfg.controlChannelId;
    if (!targetChannelId) {
      return res.status(400).json({ error: "No control channel configured" });
    }
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channel = guild?.channels.cache.get(targetChannelId);
    if (!channel) {
      return res.status(404).json({ error: "Control channel not found in Discord server" });
    }
    const { embed, components } = buildTempVoiceInterface();
    await channel.send({ embeds: [embed], components });
    return res.json({ success: true, message: `Interface deployed to #${channel.name}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/tempvoice/action", async (req, res) => {
  try {
    const { action, channelId, value } = req.body;
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channel = guild?.channels.cache.get(channelId);
    const record = activeTempVcs.get(channelId);
    if (!channel || !record) {
      return res.status(404).json({ error: "Channel not found or not an active temp VC" });
    }
    if (action === "lock") {
      const nowLocked = !record.isLocked;
      record.isLocked = nowLocked;
      const baseName = channel.name.replace(/^🔒\s*/, "");
      await channel.setName(nowLocked ? `\u{1F512} ${baseName}` : baseName).catch(() => {
      });
      await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
        Connect: !nowLocked
      }).catch(() => {
      });
      saveActiveTempVoiceChannels(Array.from(activeTempVcs.values()));
      return res.json({ success: true, isLocked: nowLocked });
    }
    if (action === "rename" && value) {
      const newName = String(value).trim();
      const finalName = record.isLocked ? `\u{1F512} ${newName}` : newName;
      await channel.setName(finalName).catch(() => {
      });
      record.name = finalName;
      saveActiveTempVoiceChannels(Array.from(activeTempVcs.values()));
      return res.json({ success: true, name: finalName });
    }
    if (action === "delete") {
      if (record.waitingRoomId) {
        const wr = guild?.channels.cache.get(record.waitingRoomId);
        if (wr) await wr.delete().catch(() => {
        });
      }
      await channel.delete().catch(() => {
      });
      activeTempVcs.delete(channelId);
      saveActiveTempVoiceChannels(Array.from(activeTempVcs.values()));
      return res.json({ success: true, deleted: true });
    }
    return res.status(400).json({ error: "Unsupported action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/tickets/config", (_req, res) => {
  return res.json(loadTicketConfig());
});
app.post("/api/tickets/config", (req, res) => {
  const current = loadTicketConfig();
  const updated = { ...current, ...req.body };
  saveTicketConfig(updated);
  return res.json({ success: true, config: updated });
});
app.get("/api/tickets/list", (_req, res) => {
  try {
    const list = Array.from(ticketStore.values()).sort((a, b) => b.createdAt - a.createdAt);
    return res.json({ tickets: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/tickets/auto-setup", async (_req, res) => {
  try {
    const result = await autoSetupTickets(discordBot, DISCORD_GUILD_ID);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/tickets/deploy-panel", async (req, res) => {
  try {
    const cfg = loadTicketConfig();
    const targetChannelId = req.body?.channelId || cfg.panelChannelId;
    if (!targetChannelId) {
      return res.status(400).json({ error: "No panel channel configured" });
    }
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channel = guild?.channels.cache.get(targetChannelId);
    if (!channel) {
      return res.status(404).json({ error: "Panel channel not found in Discord server" });
    }
    const { embed, components } = buildTicketPanelInterface(cfg);
    await channel.send({ embeds: [embed], components });
    return res.json({ success: true, message: `Ticket panel deployed to #${channel.name}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/tickets/action", async (req, res) => {
  try {
    const { ticketId, action } = req.body;
    const ticket = ticketStore.get(ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    const channel = guild?.channels.cache.get(ticket.channelId);
    if (action === "close") {
      ticket.status = "CLOSED";
      ticket.closedAt = Date.now();
      ticket.closedBy = { id: "DASHBOARD", tag: "Dashboard Admin" };
      saveActiveTickets(Array.from(ticketStore.values()));
      if (channel) {
        await channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: false }).catch(() => {
        });
        await channel.send({ content: "\u{1F512} Ticket closed by administrator via dashboard." }).catch(() => {
        });
      }
      return res.json({ success: true, ticket });
    }
    if (action === "delete") {
      if (channel) {
        await channel.delete().catch(() => {
        });
      }
      ticketStore.delete(ticketId);
      saveActiveTickets(Array.from(ticketStore.values()));
      return res.json({ success: true, deleted: true });
    }
    if (action === "reopen") {
      ticket.status = "OPEN";
      ticket.closedAt = void 0;
      ticket.closedBy = void 0;
      saveActiveTickets(Array.from(ticketStore.values()));
      if (channel) {
        await channel.permissionOverwrites.edit(ticket.creatorId, { SendMessages: true }).catch(() => {
        });
        await channel.send({ content: "\u{1F513} Ticket reopened by administrator via dashboard." }).catch(() => {
        });
      }
      return res.json({ success: true, ticket });
    }
    return res.status(400).json({ error: "Unsupported action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/music/status", (_req, res) => {
  const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
  const conn = getVoiceConnection(DISCORD_GUILD_ID);
  const activeChanId = conn?.joinConfig.channelId || musicVcChannelId;
  const connectedChan = activeChanId ? guild?.channels.cache.get(activeChanId) : null;
  const connectedMembers = connectedChan?.members?.map((m) => ({
    id: m.id,
    username: m.user.username,
    displayName: m.displayName || m.user.username,
    avatar: m.user.displayAvatarURL({ size: 64 }) || "https://cdn.discordapp.com/embed/avatars/0.png",
    isMuted: !!(m.voice?.mute || m.voice?.selfMute),
    isDeaf: !!(m.voice?.deaf || m.voice?.selfDeaf),
    isSpeaking: !!m.voice?.speaking,
    isBot: m.user.bot
  })) || [];
  const availableVcs = guild?.channels.cache.filter((c) => c.type === 2).map((c) => ({
    id: c.id,
    name: c.name,
    memberCount: c.members?.size || 0,
    userLimit: c.userLimit || 0
  })) || [];
  return res.json({
    isPlaying: musicPlayer.state.status === AudioPlayerStatus.Playing,
    playerStatus: musicPlayer.state.status,
    currentTrack: musicCurrentTrack,
    playbackPositionSec: musicCurrentResource ? Math.floor(musicCurrentResource.playbackDuration / 1e3) : 0,
    queue: musicQueue,
    volume: musicVolume,
    loop: musicLoopMode,
    shuffle: musicShuffleEnabled,
    lastError: musicLastError,
    botInVc: !!conn && conn.state.status === VoiceConnectionStatus.Ready,
    connectedVc: connectedChan ? {
      id: connectedChan.id,
      name: connectedChan.name,
      members: connectedMembers,
      memberCount: connectedMembers.length
    } : null,
    availableVcs
  });
});
app.get("/api/music/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results: [] });
  try {
    const results = await searchYouTube(q, 6);
    return res.json({ results });
  } catch (err) {
    return res.status(500).json({ error: err.message, results: [] });
  }
});
app.post(["/api/music/connect", "/api/music/join"], async (req, res) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: "channelId required" });
  try {
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    if (!guild) return res.status(404).json({ error: "Discord Guild not found" });
    const chan = guild.channels.cache.get(channelId);
    if (!chan || chan.type !== 2) {
      return res.status(400).json({ error: "Specified channel is not a voice channel" });
    }
    const connection = await joinVoice(guild, channelId);
    return res.json({
      success: true,
      channelId,
      channelName: chan.name,
      connectionStatus: connection.state.status,
      message: `ClubEZ connected to Voice Channel #${chan.name}!`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post(["/api/music/disconnect", "/api/music/leave"], (_req, res) => {
  leaveVoice(DISCORD_GUILD_ID);
  return res.json({ success: true, message: "ClubEZ disconnected from voice channel." });
});
app.post("/api/music/play", async (req, res) => {
  const { query, track: selectedTrack, requestedBy = "Dashboard", channelId } = req.body || {};
  if (!selectedTrack && (typeof query !== "string" || !query.trim())) {
    return res.status(400).json({ error: "Provide a search query or choose one of the search results." });
  }
  try {
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    if (!guild) return res.status(503).json({ error: "Discord bot is not ready or the server is unavailable." });
    const existing = getVoiceConnection(DISCORD_GUILD_ID);
    const targetVcId = channelId || existing?.joinConfig.channelId;
    if (!targetVcId) {
      return res.status(400).json({ error: "Select a voice channel and click Connect Bot first, or use /play while you are in voice." });
    }
    await joinVoice(guild, targetVcId);
    let newTrack;
    if (selectedTrack) {
      const url = String(selectedTrack.url || "");
      const hostname = (() => {
        try {
          return new URL(url).hostname.toLowerCase();
        } catch {
          return "";
        }
      })();
      if (!(hostname === "youtu.be" || hostname.endsWith("youtube.com"))) {
        return res.status(400).json({ error: "This result is not a playable YouTube video. Search again and choose a YouTube result." });
      }
      newTrack = {
        id: String(selectedTrack.id || `track_${Date.now()}`),
        title: String(selectedTrack.title || "YouTube track"),
        artist: String(selectedTrack.artist || "YouTube"),
        duration: String(selectedTrack.duration || "Unknown"),
        durationSec: Number(selectedTrack.durationSec) || 0,
        thumbnail: String(selectedTrack.thumbnail || ""),
        url,
        source: selectedTrack.source === "spotify" ? "spotify" : "youtube",
        requestedBy: String(requestedBy).slice(0, 80),
        addedAt: Date.now()
      };
    } else {
      const found = (await searchYouTube(query.trim(), 1))[0];
      if (!found) return res.status(404).json({ error: "No playable result found. Try a different title or public YouTube link." });
      newTrack = { ...found, requestedBy: String(requestedBy).slice(0, 80), addedAt: Date.now() };
    }
    const queued = await enqueueMusicTrack(newTrack);
    return res.json({
      success: true,
      message: queued.position === 0 ? "Playback started." : `Added at queue position ${queued.position}.`,
      track: newTrack,
      queuePosition: queued.position,
      playerStatus: musicPlayer.state.status,
      lastError: musicLastError
    });
  } catch (err) {
    console.error("[MUSIC PLAY API ERROR]", err?.stack || err?.message || err);
    return res.status(500).json({ error: err.message || "Unable to start music playback." });
  }
});
app.post("/api/music/skip", (_req, res) => {
  const skipped = skipMusicTrack();
  if (!skipped) return res.status(409).json({ error: "Nothing is playing right now." });
  return res.json({ success: true, skipped, currentTrack: musicCurrentTrack, queue: musicQueue });
});
app.post("/api/music/pause", (req, res) => {
  if (!musicCurrentTrack) return res.status(409).json({ error: "Nothing is playing right now." });
  const shouldPlay = typeof req.body?.isPlaying === "boolean" ? req.body.isPlaying : musicPlayer.state.status === AudioPlayerStatus.Paused;
  if (shouldPlay && musicPlayer.state.status === AudioPlayerStatus.Paused) musicPlayer.unpause();
  if (!shouldPlay && musicPlayer.state.status === AudioPlayerStatus.Playing) musicPlayer.pause();
  musicIsPlaying = shouldPlay;
  return res.json({ success: true, isPlaying: shouldPlay, playerStatus: musicPlayer.state.status });
});
app.post("/api/music/stop", (_req, res) => {
  leaveVoice(DISCORD_GUILD_ID);
  return res.json({ success: true, message: "Music stopped and ClubEZ disconnected from voice." });
});
app.post("/api/music/restart", async (_req, res) => {
  const current = musicCurrentTrack;
  if (!current) return res.status(409).json({ error: "Nothing is playing right now." });
  musicQueue.unshift(current);
  musicCurrentTrack = null;
  musicCurrentResource = null;
  if (musicPlayer.state.status !== AudioPlayerStatus.Idle) musicPlayer.stop(true);
  await startNextMusicTrack();
  return res.json({ success: true, currentTrack: musicCurrentTrack, playerStatus: musicPlayer.state.status, lastError: musicLastError });
});
app.post("/api/music/remove", (req, res) => {
  const { trackId, index } = req.body;
  if (trackId) {
    musicQueue = musicQueue.filter((t) => t.id !== trackId);
  } else if (typeof index === "number" && index >= 0 && index < musicQueue.length) {
    musicQueue.splice(index, 1);
  }
  return res.json({ success: true, queue: musicQueue });
});
app.post("/api/music/clear-queue", (_req, res) => {
  musicQueue = [];
  return res.json({ success: true, queue: [] });
});
app.post("/api/music/volume", (req, res) => {
  const { volume } = req.body;
  if (typeof volume !== "number" || volume < 0 || volume > 100) {
    return res.status(400).json({ error: "Volume must be 0-100" });
  }
  musicVolume = volume;
  if (musicCurrentResource?.volume) musicCurrentResource.volume.setVolume(volume / 100);
  return res.json({ success: true, volume });
});
app.post("/api/music/loop", (req, res) => {
  const { mode } = req.body;
  if (mode && ["off", "track", "queue"].includes(mode)) {
    musicLoopMode = mode;
  } else {
    musicLoopMode = musicLoopMode === "off" ? "track" : musicLoopMode === "track" ? "queue" : "off";
  }
  return res.json({ success: true, loop: musicLoopMode });
});
app.post("/api/music/shuffle", (_req, res) => {
  musicShuffleEnabled = !musicShuffleEnabled;
  if (musicShuffleEnabled && musicQueue.length > 1) {
    for (let i = musicQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [musicQueue[i], musicQueue[j]] = [musicQueue[j], musicQueue[i]];
    }
  }
  return res.json({ success: true, shuffle: musicShuffleEnabled, queue: musicQueue });
});
app.post("/api/music/deploy-panel", async (req, res) => {
  const { channelId } = req.body;
  try {
    const guild = discordBot.guilds.cache.get(DISCORD_GUILD_ID);
    let targetChannel;
    if (channelId) {
      targetChannel = guild?.channels.cache.get(channelId);
    }
    if (!targetChannel) {
      targetChannel = guild?.channels.cache.find(
        (c) => c.type === 0 && (c.name.includes("music") || c.name.includes("bot") || c.name.includes("commands"))
      );
    }
    if (!targetChannel) {
      targetChannel = guild?.channels.cache.find(
        (c) => c.type === 0 && (c.name.includes("general") || c.name.includes("lounge"))
      );
    }
    if (!targetChannel) {
      return res.status(404).json({ error: "No suitable text channel found to deploy music panel" });
    }
    const embed = new EmbedBuilder3().setTitle("\u{1F3B5} Club EZKEN \u2014 DJ Music Control Panel").setColor(15010068).setDescription(
      "**Welcome to the Club EZKEN DJ System!**\n\nUse the buttons below or slash commands to control music.\n\n**\u{1F3B5} YouTube** \u2022 **\u{1F3B6} Spotify** \u2022 **\u{1F4FB} SoundCloud** \u2014 all supported!"
    ).addFields(
      { name: "\u25B6\uFE0F Play", value: "`/play <song name or URL>`", inline: true },
      { name: "\u23ED Skip", value: "`/skip`", inline: true },
      { name: "\u23F8 Pause/Resume", value: "`/pause`", inline: true },
      { name: "\u{1F50A} Volume", value: "`/volume <1-100>`", inline: true },
      { name: "\u{1F4CB} Queue", value: "`/queue`", inline: true },
      { name: "\u{1F501} Loop", value: "`/loop`", inline: true }
    ).setFooter({ text: "Club EZKEN DJ System \u2022 Powered by ClubEZ Bot" }).setTimestamp();
    const row1 = new ActionRowBuilder3().addComponents(
      new ButtonBuilder3().setCustomId("music:play_prompt").setLabel("\u25B6\uFE0F Play Song").setStyle(ButtonStyle3.Success),
      new ButtonBuilder3().setCustomId("music:pause").setLabel("\u23F8 Pause").setStyle(ButtonStyle3.Secondary),
      new ButtonBuilder3().setCustomId("music:skip").setLabel("\u23ED Skip").setStyle(ButtonStyle3.Secondary),
      new ButtonBuilder3().setCustomId("music:stop").setLabel("\u23F9 Stop").setStyle(ButtonStyle3.Danger)
    );
    const row2 = new ActionRowBuilder3().addComponents(
      new ButtonBuilder3().setCustomId("music:queue").setLabel("\u{1F4CB} Queue").setStyle(ButtonStyle3.Primary),
      new ButtonBuilder3().setCustomId("music:shuffle").setLabel("\u{1F500} Shuffle").setStyle(ButtonStyle3.Primary),
      new ButtonBuilder3().setCustomId("music:loop").setLabel("\u{1F501} Loop").setStyle(ButtonStyle3.Primary),
      new ButtonBuilder3().setCustomId("music:nowplaying").setLabel("\u{1F3B5} Now Playing").setStyle(ButtonStyle3.Secondary)
    );
    const sent = await targetChannel.send({ embeds: [embed], components: [row1, row2] });
    return res.json({
      success: true,
      messageId: sent.id,
      channelName: targetChannel.name,
      message: `DJ Music Panel deployed to #${targetChannel.name}`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
function getFilesRecursively(dir, baseDir) {
  let results = [];
  if (!fs3.existsSync(dir)) return results;
  const list = fs3.readdirSync(dir);
  for (const item of list) {
    if (["node_modules", ".git", "dist", ".DS_Store", "Thumbs.db", "ezken.sqlite-shm", "ezken.sqlite-wal"].includes(item)) {
      continue;
    }
    const fullPath = path3.join(dir, item);
    const stat = fs3.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, baseDir));
    } else {
      const relPath = path3.relative(baseDir, fullPath).replace(/\\/g, "/");
      const content = fs3.readFileSync(fullPath, "utf8");
      results.push({
        path: relPath,
        name: item,
        content,
        size: stat.size
      });
    }
  }
  return results;
}
app.get("/api/bot-files", (_req, res) => {
  try {
    const botDir = path3.join(__dirname2, "bot");
    const files = getFilesRecursively(botDir, botDir);
    return res.json({ files });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/download-bot-zip", async (_req, res) => {
  try {
    const botDir = path3.join(__dirname2, "bot");
    const files = getFilesRecursively(botDir, botDir);
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.path, f.content);
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="club-ezken-bot.zip"');
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
async function startServer() {
  const distPath = path3.join(__dirname2, "dist");
  if (fs3.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path3.join(distPath, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.json({
        status: "online",
        bot: "ClubEZ",
        message: "ClubEZ API Server is running.",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
  }
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[SERVER] API Server is running on port ${PORT}`);
  });
}
app.use((err, _req, res, _next) => {
  console.error("[EXPRESS ERROR]", err?.stack || err?.message || err);
  res.status(err?.status || 500).json({
    error: err?.message || "Internal server error",
    stack: process.env.NODE_ENV === "production" ? void 0 : err?.stack
  });
});
startServer().catch((err) => {
  console.error("[SERVER ERROR]", err);
});
export {
  MOD_LOGS_CHANNEL_ID,
  OFFICIAL_LEVEL_TIERS_CONFIG,
  getAllUnlockedFeaturesForLevel,
  getLevelFromXp,
  getNewlyUnlockedFeatures,
  getTierRoleForLevel,
  getXpRequiredForLevel,
  loadXpDatabase,
  saveXpDatabase
};
