import { CONFIG, getTierForLevel } from '../config.js';
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

    // User left voice, disconnected, or moved to AFK / deafened
    if (!newState.channelId || isAfkChannel || isDeafOrMuted) {
      if (activeVoiceUsers.has(userId)) {
        const session = activeVoiceUsers.get(userId);
        if (session.intervalId) clearInterval(session.intervalId);
        activeVoiceUsers.delete(userId);
      }
      return;
    }

    // User joined or moved to an eligible active voice channel
    if (newState.channelId && !isAfkChannel && !isDeafOrMuted) {
      if (!activeVoiceUsers.has(userId)) {
        // Poll every 60 seconds to award 8 Voice XP
        const intervalId = setInterval(async () => {
          const currentMember = newState.guild.members.cache.get(userId);
          if (
            currentMember &&
            currentMember.voice.channelId &&
            !currentMember.voice.selfDeaf &&
            !currentMember.voice.serverDeaf
          ) {
            const progress = addVoiceXp(userId, CONFIG.XP.VOICE_PER_MINUTE);
            if (progress.leveledUp) {
              const tier = getTierForLevel(progress.level);
              const role = currentMember.guild.roles.cache.find(r =>
                r.name.toLowerCase().replace(/[@\s]/g, '') === tier.name.toLowerCase().replace(/[@\s]/g, '')
              );
              if (role && !currentMember.roles.cache.has(role.id)) {
                try {
                  await currentMember.roles.add(role, `Voice level up promotion to Level ${progress.level}`);
                  const logChannel = currentMember.guild.channels.cache.get(CONFIG.CHANNELS.LOGS);
                  if (logChannel) {
                    logChannel.send(`🎙️ **[VOICE LEVEL PROMOTION]** ${currentMember.user.tag} reached **Level ${progress.level}** (@${tier.name}) via voice chat!`);
                  }
                } catch (roleErr) {
                  console.error('[VOICE LEVEL ROLE ERROR]', roleErr.message);
                }
              }
            }
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
