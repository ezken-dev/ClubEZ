import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG, getTierForLevel } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let createCanvas = null;
let loadImage = null;

try {
  const canvasMod = await import('@napi-rs/canvas');
  createCanvas = canvasMod.createCanvas;
  loadImage = canvasMod.loadImage;
} catch (e) {
  // @napi-rs/canvas native binding fallback
}

// Load customizable welcome configuration
function loadWelcomeConfig() {
  const possiblePaths = [
    path.join(process.cwd(), 'welcome_config.json'),
    path.join(__dirname, '../../welcome_config.json'),
    path.join(__dirname, '../welcome_config.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {}
    }
  }

  return {
    canvas: {
      width: 1000,
      height: 450,
      borderRadius: 40,
      bgGradientStart: '#09090B',
      bgGradientMid: '#121218',
      bgGradientEnd: '#22080B',
      borderColor: '#3F1218',
      borderWidth: 2,
      topStripeColor: '#E50914',
      topStripeHeight: 8,
      avatarSize: 170,
      avatarBorderColor: '#E50914',
      avatarBorderWidth: 6,
      welcomeText: 'WELCOME TO',
      welcomeTextColor: '#E50914',
      welcomeTextSize: 24,
      guildText: 'CLUB EZKEN',
      guildTextColor: '#FFFFFF',
      guildTextSize: 48,
      usernameColor: '#E4E4E7',
      usernameSize: 26,
      countTextTemplate: 'MEMBER #{count}',
      countTextColor: '#A1A1AA',
      countTextSize: 18,
      fontFamily: 'Inter, sans-serif'
    }
  };
}

/**
 * Draws rounded rectangle path
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Generates custom 934x282 Rank Card PNG for /rank command
 */
export async function renderRankCard({
  username,
  discriminator = '',
  avatarUrl,
  level = 0,
  rank = 1,
  currentXp = 0,
  neededXp = 100,
  tierRole = '',
  voiceMinutes = 0
}) {
  if (!createCanvas) {
    throw new Error('Canvas rendering engine is not available on this environment');
  }

  const tier = getTierForLevel(level);
  const displayRole = tierRole || tier.name;
  const roleColor = tier.color || CONFIG.COLORS.PRIMARY;

  const width = 934;
  const height = 282;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Dark Carbon Background with subtle red gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0D0D10');
  bgGrad.addColorStop(0.6, '#141419');
  bgGrad.addColorStop(1, '#1A0E10');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, width, height, 16);
  ctx.fill();

  // Subtle Border
  ctx.strokeStyle = '#272730';
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, width - 2, height - 2, 16);
  ctx.stroke();

  // 2. Accent Stripe on the Left using Tier Color
  ctx.fillStyle = roleColor;
  ctx.fillRect(0, 0, 8, height);

  // Decorative glow circle on top right
  const glowGrad = ctx.createRadialGradient(width - 80, 60, 10, width - 80, 60, 250);
  glowGrad.addColorStop(0, 'rgba(229, 9, 20, 0.22)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. User Avatar Render (Circular with Ring)
  const avatarSize = 160;
  const avatarX = 50;
  const avatarY = (height - avatarSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = roleColor;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  try {
    if (avatarUrl && loadImage) {
      const avatarImg = await loadImage(avatarUrl);
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    } else {
      throw new Error('No avatar URL');
    }
  } catch {
    ctx.fillStyle = '#222';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.charAt(0).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();

  // 4. Header Badge / Server Branding & Tier Role
  ctx.fillStyle = roleColor;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`@${displayRole.toUpperCase()} • CLUB EZKEN`, 250, 48);

  // 5. Username Display
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 34px sans-serif';
  const cleanName = username.length > 15 ? username.substring(0, 14) + '…' : username;
  ctx.fillText(cleanName, 250, 92);

  // 6. Voice Chat Badge & Rank / Level Stats
  const vcHours = Math.floor(voiceMinutes / 60);
  const vcMins = voiceMinutes % 60;
  const vcFormatted = vcHours > 0 ? `${vcHours}h ${vcMins}m in VC` : `${vcMins}m in VC`;
  ctx.fillStyle = '#38BDF8';
  ctx.font = '600 14px sans-serif';
  ctx.fillText(`🎙️ ${vcFormatted}`, 250, 120);

  // Stats Badges (Rank & Level)
  ctx.fillStyle = '#9CA3AF';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('RANK', width - 210, 85);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(`#${rank}`, width - 140, 85);

  ctx.fillStyle = roleColor;
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('LEVEL', width - 70, 85);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(`${level}`, width - 25, 85);

  // 7. XP Text Details
  ctx.fillStyle = '#D1D5DB';
  ctx.font = '600 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${currentXp.toLocaleString()} / ${neededXp.toLocaleString()} XP`, width - 50, 180);

  // 8. Progress Bar
  const barX = 250;
  const barY = 200;
  const barWidth = width - barX - 50;
  const barHeight = 22;
  const barRadius = 11;

  // Track Background
  ctx.fillStyle = '#26262B';
  roundRect(ctx, barX, barY, barWidth, barHeight, barRadius);
  ctx.fill();

  // Progress Fill
  const progressRatio = Math.min(Math.max(currentXp / Math.max(neededXp, 1), 0), 1);
  const fillWidth = Math.max(barWidth * progressRatio, 22);

  const barGrad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
  barGrad.addColorStop(0, roleColor);
  barGrad.addColorStop(1, '#FF4D58');
  ctx.fillStyle = barGrad;
  roundRect(ctx, barX, barY, fillWidth, barHeight, barRadius);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

/**
 * Generates branded Club EZKEN Welcome Banner on member join
 * utilizing heavily customizable colors, fonts, and member counting
 */
export async function renderWelcomeCard({
  username,
  avatarUrl,
  memberCount = 1,
  guildName = 'CLUB EZKEN'
}) {
  if (!createCanvas) {
    throw new Error('Canvas rendering engine is not available on this environment');
  }

  const conf = loadWelcomeConfig().canvas || {};
  const width = conf.width || 1000;
  const height = conf.height || 450;
  const radius = conf.borderRadius || 30;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, conf.bgGradientStart || '#09090B');
  bg.addColorStop(0.5, conf.bgGradientMid || '#121218');
  bg.addColorStop(1, conf.bgGradientEnd || '#22080B');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, width, height, radius);
  ctx.fill();

  // Border
  ctx.strokeStyle = conf.borderColor || '#3F1218';
  ctx.lineWidth = conf.borderWidth || 2;
  roundRect(ctx, 1, 1, width - 2, height - 2, radius);
  ctx.stroke();

  // Top Accent Stripe
  ctx.fillStyle = conf.topStripeColor || CONFIG.COLORS.PRIMARY;
  ctx.fillRect(0, 0, width, conf.topStripeHeight || 8);

  // Central Avatar
  const avatarSize = conf.avatarSize || 170;
  const avatarX = (width - avatarSize) / 2;
  const avatarY = 55;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.strokeStyle = conf.avatarBorderColor || CONFIG.COLORS.PRIMARY;
  ctx.lineWidth = conf.avatarBorderWidth || 6;
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  try {
    if (avatarUrl && loadImage) {
      const avatarImg = await loadImage(avatarUrl);
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    } else {
      throw new Error('No avatar');
    }
  } catch {
    ctx.fillStyle = '#18181B';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 70px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.charAt(0).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();

  // Welcome Text
  ctx.fillStyle = conf.welcomeTextColor || CONFIG.COLORS.PRIMARY;
  ctx.font = `bold ${conf.welcomeTextSize || 24}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(conf.welcomeText || 'WELCOME TO', width / 2, 275);

  ctx.fillStyle = conf.guildTextColor || '#FFFFFF';
  ctx.font = `900 ${conf.guildTextSize || 48}px sans-serif`;
  ctx.fillText((conf.guildText || guildName).toUpperCase(), width / 2, 330);

  // Username and member count
  ctx.fillStyle = conf.usernameColor || '#E4E4E7';
  ctx.font = `bold ${conf.usernameSize || 26}px sans-serif`;
  const cleanName = username.length > 20 ? username.substring(0, 19) + '…' : username;
  ctx.fillText(cleanName, width / 2, 375);

  const countPattern = conf.countTextTemplate || 'MEMBER #{count}';
  const countText = countPattern.replace('{count}', memberCount.toLocaleString());
  ctx.fillStyle = conf.countTextColor || '#A1A1AA';
  ctx.font = `${conf.countTextSize || 18}px sans-serif`;
  ctx.fillText(countText, width / 2, 408);

  return canvas.toBuffer('image/png');
}
