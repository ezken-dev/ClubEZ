import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

// Ensure data directory exists
const dbDir = path.dirname(CONFIG.DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database
const db = new Database(CONFIG.DATABASE_PATH, {
  // verbose: console.log // uncomment for query debugging
});

// Configure High-Performance & Concurrency Pragma Settings
db.pragma('journal_mode = WAL'); // Write-Ahead Logging
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Execute initial schema
const schemaPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

/**
 * Moderation Case Management
 */
export function createCase({ userId, userTag, moderatorId, moderatorTag, actionType, reason, duration = null }) {
  const countRow = db.prepare('SELECT COUNT(*) as total FROM cases').get();
  const nextNum = (countRow.total + 1).toString().padStart(4, '0');
  const caseId = `#${nextNum}`;

  const stmt = db.prepare(`
    INSERT INTO cases (case_id, user_id, user_tag, moderator_id, moderator_tag, action_type, reason, duration, timestamp)
    VALUES (@caseId, @userId, @userTag, @moderatorId, @moderatorTag, @actionType, @reason, @duration, @timestamp)
  `);

  stmt.run({
    caseId,
    userId,
    userTag,
    moderatorId,
    moderatorTag,
    actionType,
    reason,
    duration,
    timestamp: Date.now()
  });

  return getCase(caseId);
}

export function getCase(caseId) {
  const formatted = caseId.startsWith('#') ? caseId : `#${caseId}`;
  return db.prepare('SELECT * FROM cases WHERE case_id = ?').get(formatted);
}

export function updateCaseReason(caseId, newReason, moderatorTag) {
  const formatted = caseId.startsWith('#') ? caseId : `#${caseId}`;
  const existing = getCase(formatted);
  if (!existing) return null;

  const appendNotice = `${newReason} (Updated by ${moderatorTag})`;
  const stmt = db.prepare('UPDATE cases SET reason = ? WHERE case_id = ?');
  stmt.run(appendNotice, formatted);
  return getCase(formatted);
}

export function getUserCases(userId) {
  return db.prepare('SELECT * FROM cases WHERE user_id = ? ORDER BY id DESC').all(userId);
}

/**
 * XP & Leveling Engine
 */
export function getUserXpData(userId) {
  let row = db.prepare('SELECT * FROM users_xp WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare(`
      INSERT INTO users_xp (user_id, xp, level, last_text_xp, total_messages, voice_minutes, updated_at)
      VALUES (?, 0, 0, 0, 0, 0, ?)
    `).run(userId, Date.now());
    row = { user_id: userId, xp: 0, level: 0, last_text_xp: 0, total_messages: 0, voice_minutes: 0 };
  }
  return row;
}

export function addTextXp(userId, amount) {
  const current = getUserXpData(userId);
  const now = Date.now();
  let xp = current.xp + amount;
  let level = current.level;
  let leveledUp = false;

  // Level progression check based on curve
  let needed = CONFIG.XP.calcLevelXp(level);
  while (xp >= needed) {
    xp -= needed;
    level += 1;
    leveledUp = true;
    needed = CONFIG.XP.calcLevelXp(level);
  }

  db.prepare(`
    UPDATE users_xp 
    SET xp = ?, level = ?, last_text_xp = ?, total_messages = total_messages + 1, updated_at = ?
    WHERE user_id = ?
  `).run(xp, level, now, now, userId);

  return {
    userId,
    xp,
    level,
    oldLevel: current.level,
    leveledUp,
    neededXp: needed
  };
}

export function addVoiceXp(userId, amount) {
  const current = getUserXpData(userId);
  let xp = current.xp + amount;
  let level = current.level;
  let leveledUp = false;

  let needed = CONFIG.XP.calcLevelXp(level);
  while (xp >= needed) {
    xp -= needed;
    level += 1;
    leveledUp = true;
    needed = CONFIG.XP.calcLevelXp(level);
  }

  db.prepare(`
    UPDATE users_xp 
    SET xp = ?, level = ?, voice_minutes = voice_minutes + 1, updated_at = ?
    WHERE user_id = ?
  `).run(xp, level, Date.now(), userId);

  return { userId, xp, level, leveledUp };
}

export function getLeaderboard(limit = 10) {
  return db.prepare(`
    SELECT user_id, xp, level, total_messages, voice_minutes
    FROM users_xp
    ORDER BY level DESC, xp DESC
    LIMIT ?
  `).all(limit);
}

export function getUserRankPosition(userId) {
  const row = getUserXpData(userId);
  const rankCount = db.prepare(`
    SELECT COUNT(*) as rank FROM users_xp
    WHERE level > ? OR (level = ? AND xp > ?)
  `).get(row.level, row.level, row.xp);

  return {
    ...row,
    rank: rankCount.rank + 1,
    neededXp: CONFIG.XP.calcLevelXp(row.level)
  };
}

/**
 * Message Templates
 */
export function saveTemplate(name, jsonPayload, createdBy) {
  const stmt = db.prepare(`
    INSERT INTO templates (template_name, json_payload, created_by, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(template_name) DO UPDATE SET
      json_payload = excluded.json_payload,
      updated_at = excluded.updated_at
  `);
  stmt.run(name, JSON.stringify(jsonPayload), createdBy, Date.now());
  return getTemplate(name);
}

export function getTemplate(name) {
  const row = db.prepare('SELECT * FROM templates WHERE template_name = ?').get(name);
  if (!row) return null;
  return { ...row, data: JSON.parse(row.json_payload) };
}

export function listTemplates() {
  return db.prepare('SELECT template_name, created_by, updated_at FROM templates ORDER BY template_name ASC').all();
}

/**
 * YouTube Stream & RSS Cache
 */
export function hasAnnouncedVideo(videoId) {
  const row = db.prepare('SELECT video_id FROM stream_cache WHERE video_id = ?').get(videoId);
  return !!row;
}

export function saveAnnouncedVideo(videoId, title, publishedAt) {
  db.prepare(`
    INSERT INTO stream_cache (video_id, title, published_at, announced_at)
    VALUES (?, ?, ?, ?)
  `).run(videoId, title, publishedAt, Date.now());
}

/**
 * User Reports System
 */
export function createReport({ reporterId, targetId, reason, messageUrl }) {
  const countRow = db.prepare('SELECT COUNT(*) as total FROM reports').get();
  const reportId = `REP-${(countRow.total + 1).toString().padStart(4, '0')}`;

  db.prepare(`
    INSERT INTO reports (report_id, reporter_id, target_id, reason, message_url, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(reportId, reporterId, targetId, reason, messageUrl || null, Date.now());

  return getReport(reportId);
}

export function getReport(reportId) {
  return db.prepare('SELECT * FROM reports WHERE report_id = ?').get(reportId);
}

export function updateReportStatus(reportId, status, actionTaken, resolvedBy) {
  db.prepare(`
    UPDATE reports 
    SET status = ?, action_taken = ?, resolved_by = ?
    WHERE report_id = ?
  `).run(status, actionTaken, resolvedBy, reportId);

  return getReport(reportId);
}

export default db;
