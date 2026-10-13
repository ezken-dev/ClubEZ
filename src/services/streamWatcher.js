import { EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hasAnnouncedVideo, saveAnnouncedVideo } from '../database/db.js';

let intervalTimer = null;

/**
 * Initializes the YouTube RSS Stream & Upload Poller
 * @param {import('discord.js').Client} client 
 */
export function initStreamWatcher(client) {
  if (!CONFIG.YOUTUBE.CHANNEL_ID) {
    console.log('[STREAM WATCHER] Skipped: No YOUTUBE_CHANNEL_ID set in .env');
    return;
  }

  console.log(`[STREAM WATCHER] Started polling YouTube channel: ${CONFIG.YOUTUBE.CHANNEL_ID}`);
  
  // Initial check after 10 seconds
  setTimeout(() => checkYouTubeFeed(client), 10000);

  // Recurring check
  intervalTimer = setInterval(() => {
    checkYouTubeFeed(client).catch((err) => {
      console.error('[STREAM WATCHER] Polling cycle error:', err.message);
    });
  }, CONFIG.YOUTUBE.POLL_INTERVAL_MS);
}

/**
 * Checks YouTube RSS feed for new video or livestream
 */
export async function checkYouTubeFeed(client) {
  try {
    const channelId = CONFIG.YOUTUBE.CHANNEL_ID;
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    
    const response = await fetch(rssUrl);
    if (!response.ok) {
      return;
    }

    const xml = await response.text();
    
    // Parse entries from Atom feed
    const entryMatch = xml.match(/<entry>[\s\S]*?<\/entry>/);
    if (!entryMatch) return;

    const entry = entryMatch[0];
    const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
    const titleMatch = entry.match(/<title>(.*?)<\/title>/);
    const publishedMatch = entry.match(/<published>(.*?)<\/published>/);

    if (!videoIdMatch || !titleMatch) return;

    const videoId = videoIdMatch[1];
    const title = titleMatch[1];
    const publishedAt = publishedMatch ? publishedMatch[1] : new Date().toISOString();

    // Check if already announced in SQLite cache
    if (hasAnnouncedVideo(videoId)) {
      return;
    }

    // Video URL & Thumbnail
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Locate announcements channel
    const channel = client.channels.cache.get(CONFIG.CHANNELS.ANNOUNCEMENTS);
    if (!channel) {
      console.warn(`[STREAM WATCHER] Announcement channel ${CONFIG.CHANNELS.ANNOUNCEMENTS} not found.`);
      return;
    }

    // Build Club EZKEN Branded Announcement Embed
    const embed = new EmbedBuilder()
      .setTitle(`🔴 LIVE / NEW VIDEO: ${title}`)
      .setURL(videoUrl)
      .setColor(CONFIG.COLORS.PRIMARY)
      .setDescription(`**Club EZKEN is broadcasting!** Don't miss out on today's action.\n\n▶️ **[Click Here to Watch on YouTube](${videoUrl})**`)
      .setImage(thumbnailUrl)
      .setFooter({ text: 'Club EZKEN Socials • Automated Stream Watcher', iconURL: client.user.displayAvatarURL() })
      .setTimestamp(new Date(publishedAt));

    const pingContent = CONFIG.ROLES.STREAM_PING ? `<@&${CONFIG.ROLES.STREAM_PING}>` : '';

    await channel.send({
      content: pingContent ? `🚨 **STREAM ALERT** ${pingContent}` : '🚨 **STREAM ALERT**',
      embeds: [embed]
    });

    // Mark as announced in SQLite
    saveAnnouncedVideo(videoId, title, publishedAt);
    console.log(`[STREAM WATCHER] Successfully announced video: ${title} (${videoId})`);
  } catch (err) {
    console.error('[STREAM WATCHER] Failed to process RSS feed:', err.message);
  }
}

export function stopStreamWatcher() {
  if (intervalTimer) clearInterval(intervalTimer);
}
