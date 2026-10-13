import { CONFIG } from '../config.js';
import { addVoiceXp } from '../database/db.js';

// Map of active voice sessions: Map<userId, { channelId, joinedAt, intervalId }>
const activeVoiceUsers = new Map();

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const userId = member.id;
    const isAfkChannel = newState.guild.afkChannelId && newState.channelId === newState.guild.afkChannelId;
    const isDeafOrMuted = newState.selfDeaf || newState.serverDeaf;

    // User left voice or moved to AFK
    if (!newState.channelId || isAfkChannel || isDeafOrMuted) {
      if (activeVoiceUsers.has(userId)) {
        const session = activeVoiceUsers.get(userId);
        if (session.intervalId) clearInterval(session.intervalId);
        activeVoiceUsers.delete(userId);
      }
      return;
    }

    // User joined or moved to an eligible voice channel
    if (newState.channelId && !isAfkChannel && !isDeafOrMuted) {
      if (!activeVoiceUsers.has(userId)) {
        // Poll every 60 seconds to award Voice XP
        const intervalId = setInterval(() => {
          // Re-verify member is still in active channel
          const currentMember = newState.guild.members.cache.get(userId);
          if (
            currentMember &&
            currentMember.voice.channelId &&
            !currentMember.voice.selfDeaf &&
            !currentMember.voice.serverDeaf
          ) {
            addVoiceXp(userId, CONFIG.XP.VOICE_PER_MINUTE);
          } else {
            clearInterval(intervalId);
            activeVoiceUsers.delete(userId);
          }
        }, 60000);

        activeVoiceUsers.set(userId, {
          channelId: newState.channelId,
          joinedAt: Date.now(),
          intervalId
        });
      }
    }
  }
};
