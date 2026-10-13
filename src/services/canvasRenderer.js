import { createCanvas, loadImage } from '@napi-rs/canvas';
import { CONFIG } from '../config.js';

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
}) {
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

  // 2. Club EZKEN Red Accent Stripe on the Left
  ctx.fillStyle = CONFIG.COLORS.PRIMARY;
  ctx.fillRect(0, 0, 8, height);

  // Decorative glow circle on top right
  const glowGrad = ctx.createRadialGradient(width - 80, 60, 10, width - 80, 60, 250);
  glowGrad.addColorStop(0, 'rgba(229, 9, 20, 0.22)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. User Avatar Render (Circular with Red Ring)
  const avatarSize = 160;
  const avatarX = 50;
  const avatarY = (height - avatarSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  try {
    if (avatarUrl) {
      const avatarImg = await loadImage(avatarUrl);
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    } else {
      throw new Error('No avatar URL');
    }
  } catch {
    // Stylized fallback
    ctx.fillStyle = '#222';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.charAt(0).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();

  // 4. Header Badge / Server Branding
  ctx.fillStyle = CONFIG.COLORS.PRIMARY;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CLUB EZKEN OFFICIAL RANK CARD', 250, 52);

  // 5. Username Display
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px sans-serif';
  const cleanName = username.length > 16 ? username.substring(0, 15) + '…' : username;
  ctx.fillText(cleanName, 250, 100);

  if (discriminator && discriminator !== '0') {
    const nameWidth = ctx.measureText(cleanName).width;
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '24px sans-serif';
    ctx.fillText(`#${discriminator}`, 250 + nameWidth + 8, 100);
  }

  // 6. Stats Badges (Rank & Level)
  // Rank
  ctx.fillStyle = '#9CA3AF';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('RANK', width - 230, 95);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(`#${rank}`, width - 150, 95);

  // Level
  ctx.fillStyle = CONFIG.COLORS.PRIMARY;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('LEVEL', width - 75, 95);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(`${level}`, width - 25, 95);

  // 7. XP Text Details
  ctx.fillStyle = '#D1D5DB';
  ctx.font = '600 20px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${currentXp.toLocaleString()} / ${neededXp.toLocaleString()} XP`, width - 50, 180);

  // 8. Progress Bar
  const barX = 250;
  const barY = 200;
  const barWidth = width - barX - 50;
  const barHeight = 24;
  const barRadius = 12;

  // Track Background
  ctx.fillStyle = '#26262B';
  roundRect(ctx, barX, barY, barWidth, barHeight, barRadius);
  ctx.fill();

  // Progress Fill
  const progressRatio = Math.min(Math.max(currentXp / Math.max(neededXp, 1), 0), 1);
  const fillWidth = Math.max(barWidth * progressRatio, 24);

  const barGrad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
  barGrad.addColorStop(0, '#E50914');
  barGrad.addColorStop(1, '#FF4D58');
  ctx.fillStyle = barGrad;
  roundRect(ctx, barX, barY, fillWidth, barHeight, barRadius);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

/**
 * Generates branded Club EZKEN Welcome Banner on member join
 */
export async function renderWelcomeCard({
  username,
  avatarUrl,
  memberCount = 1,
  guildName = 'CLUB EZKEN'
}) {
  const width = 1000;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#09090B');
  bg.addColorStop(0.5, '#121218');
  bg.addColorStop(1, '#200A0D');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, width, height, 20);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#3F1218';
  ctx.lineWidth = 3;
  roundRect(ctx, 1, 1, width - 2, height - 2, 20);
  ctx.stroke();

  // Red accent top banner
  ctx.fillStyle = CONFIG.COLORS.PRIMARY;
  ctx.fillRect(0, 0, width, 8);

  // Central Avatar
  const avatarSize = 170;
  const avatarX = (width - avatarSize) / 2;
  const avatarY = 60;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  try {
    if (avatarUrl) {
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
  ctx.fillStyle = CONFIG.COLORS.PRIMARY;
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WELCOME TO', width / 2, 280);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 48px sans-serif';
  ctx.fillText(guildName.toUpperCase(), width / 2, 335);

  // Username and count pill
  ctx.fillStyle = '#E4E4E7';
  ctx.font = 'bold 26px sans-serif';
  const cleanName = username.length > 20 ? username.substring(0, 19) + '…' : username;
  ctx.fillText(`${cleanName}`, width / 2, 380);

  ctx.fillStyle = '#A1A1AA';
  ctx.font = '18px sans-serif';
  ctx.fillText(`MEMBER #${memberCount.toLocaleString()}`, width / 2, 412);

  return canvas.toBuffer('image/png');
}
