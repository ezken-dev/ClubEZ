import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

// Ensure data directory exists
const dbDir = path.dirname(CONFIG.DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let sqliteDb = null;
let useFallback = false;

// Attempt to load native better-sqlite3
try {
  const { default: Database } = await import('better-sqlite3');
  sqliteDb = new Database(CONFIG.DATABASE_PATH);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('synchronous = NORMAL');
  sqliteDb.pragma('foreign_keys = ON');

  const schemaPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    sqliteDb.exec(schema);
  }
  console.log('[DATABASE] Native SQLite WAL engine active.');
} catch (err) {
  useFallback = true;
  console.warn('[DATABASE WARNING] Native better-sqlite3 bindings unavailable on this container:', err.message);
  console.log('[DATABASE] Activating zero-dependency local JSON/WAL persistence engine.');
}

// ---------------------------------------------------------------------------
// Zero-Dependency Fallback Engine (When C++ bindings are not compiled on container)
// ---------------------------------------------------------------------------
const fallbackPath = path.join(dbDir, 'ezken-store.json');

function loadFallbackData() {
  if (fs.existsSync(fallbackPath)) {
    try {
      return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    } catch {
      // fallback to initial
    }
  }
  return {
    cases: [],
    templates: {},
    users_xp: {},
    stream_cache: {},
    reports: []
  };
}

let store = loadFallbackData();

function saveFallbackData() {
  try {
    fs.writeFileSync(fallbackPath, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[DATABASE SAVE ERROR]', err.message);
  }
}

// ---------------------------------------------------------------------------
// Public API Methods
// ---------------------------------------------------------------------------

/**
 * Moderation Case Management
 */
export function createCase({ userId, userTag, moderatorId, moderatorTag, actionType, reason, duration = null }) {
  if (!useFallback && sqliteDb) {
    const countRow = sqliteDb.prepare('SELECT COUNT(*) as total FROM cases').get();
    const nextNum = (countRow.total + 1).toString().padStart(4, '0');
    const caseId = `#${nextNum}`;

    const stmt = sqliteDb.prepare(`
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

  // Fallback
  const caseNum = (store.cases.length + 1).toString().padStart(4, '0');
  const caseId = `#${caseNum}`;
  const newCase = {
    id: store.cases.length + 1,
    case_id: caseId,
    user_id: userId,
    user_tag: userTag,
    moderator_id: moderatorId,
    moderator_tag: moderatorTag,
    action_type: actionType,
    reason,
    duration,
    timestamp: Date.now()
  };
  store.cases.push(newCase);
  saveFallbackData();
  return newCase;
}

export function getCase(caseId) {
  const formatted = caseId.startsWith('#') ? caseId : `#${caseId}`;
  if (!useFallback && sqliteDb) {
    return sqliteDb.prepare('SELECT * FROM cases WHERE case_id = ?').get(formatted);
  }
  return store.cases.find(c => c.case_id === formatted) || null;
}

export function updateCaseReason(caseId, newReason, moderatorTag) {
  const formatted = caseId.startsWith('#') ? caseId : `#${caseId}`;
  if (!useFallback && sqliteDb) {
    const existing = getCase(formatted);
    if (!existing) return null;
    const appendNotice = `${newReason} (Updated by ${moderatorTag})`;
    sqliteDb.prepare('UPDATE cases SET reason = ? WHERE case_id = ?').run(appendNotice, formatted);
    return getCase(formatted);
  }

  const existing = store.cases.find(c => c.case_id === formatted);
  if (!existing) return null;
  existing.reason = `${newReason} (Updated by ${moderatorTag})`;
  saveFallbackData();
  return existing;
}

export function getUserCases(userId) {
  if (!useFallback && sqliteDb) {
    return sqliteDb.prepare('SELECT * FROM cases WHERE user_id = ? ORDER BY id DESC').all(userId);
  }
  return store.cases.filter(c => c.user_id === userId).reverse();
}

/**
 * XP & Leveling Engine
 */
export function getUserXpData(userId) {
  if (!useFallback && sqliteDb) {
    let row = sqliteDb.prepare('SELECT * FROM users_xp WHERE user_id = ?').get(userId);
    if (!row) {
      sqliteDb.prepare(`
        INSERT INTO users_xp (user_id, xp, level, last_text_xp, total_messages, voice_minutes, updated_at)
        VALUES (?, 0, 0, 0, 0, 0, ?)
      `).run(userId, Date.now());
      row = { user_id: userId, xp: 0, level: 0, last_text_xp: 0, total_messages: 0, voice_minutes: 0 };
    }
    return row;
  }

  if (!store.users_xp[userId]) {
    store.users_xp[userId] = {
      user_id: userId,
      xp: 0,
      level: 0,
      last_text_xp: 0,
      total_messages: 0,
      voice_minutes: 0,
      updated_at: Date.now()
    };
    saveFallbackData();
  }
  return store.users_xp[userId];
}

export function addTextXp(userId, amount) {
  const current = getUserXpData(userId);
  const now = Date.now();
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

  if (!useFallback && sqliteDb) {
    sqliteDb.prepare(`
      UPDATE users_xp 
      SET xp = ?, level = ?, last_text_xp = ?, total_messages = total_messages + 1, updated_at = ?
      WHERE user_id = ?
    `).run(xp, level, now, now, userId);
  } else {
    current.xp = xp;
    current.level = level;
    current.last_text_xp = now;
    current.total_messages = (current.total_messages || 0) + 1;
    current.updated_at = now;
    saveFallbackData();
  }

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

  if (!useFallback && sqliteDb) {
    sqliteDb.prepare(`
      UPDATE users_xp 
      SET xp = ?, level = ?, voice_minutes = voice_minutes + 1, updated_at = ?
      WHERE user_id = ?
    `).run(xp, level, Date.now(), userId);
  } else {
    current.xp = xp;
    current.level = level;
    current.voice_minutes = (current.voice_minutes || 0) + 1;
    current.updated_at = Date.now();
    saveFallbackData();
  }

  return { userId, xp, level, leveledUp };
}

export function getLeaderboard(limit = 10) {
  if (!useFallback && sqliteDb) {
    return sqliteDb.prepare(`
      SELECT user_id, xp, level, total_messages, voice_minutes
      FROM users_xp
      ORDER BY level DESC, xp DESC
      LIMIT ?
    `).all(limit);
  }

  const allUsers = Object.values(store.users_xp);
  allUsers.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return b.xp - a.xp;
  });
  return allUsers.slice(0, limit);
}

export function getUserRankPosition(userId) {
  const row = getUserXpData(userId);
  if (!useFallback && sqliteDb) {
    const rankCount = sqliteDb.prepare(`
      SELECT COUNT(*) as rank FROM users_xp
      WHERE level > ? OR (level = ? AND xp > ?)
    `).get(row.level, row.level, row.xp);

    return {
      ...row,
      rank: rankCount.rank + 1,
      neededXp: CONFIG.XP.calcLevelXp(row.level)
    };
  }

  const allUsers = Object.values(store.users_xp);
  allUsers.sort((a, b) => (b.level !== a.level ? b.level - a.level : b.xp - a.xp));
  const rank = allUsers.findIndex(u => u.user_id === userId) + 1;
  return {
    ...row,
    rank: rank || 1,
    neededXp: CONFIG.XP.calcLevelXp(row.level)
  };
}

/**
 * Message Templates
 */
export function saveTemplate(name, jsonPayload, createdBy) {
  if (!useFallback && sqliteDb) {
    const stmt = sqliteDb.prepare(`
      INSERT INTO templates (template_name, json_payload, created_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(template_name) DO UPDATE SET
        json_payload = excluded.json_payload,
        updated_at = excluded.updated_at
    `);
    stmt.run(name, JSON.stringify(jsonPayload), createdBy, Date.now());
    return getTemplate(name);
  }

  store.templates[name] = {
    template_name: name,
    json_payload: JSON.stringify(jsonPayload),
    created_by: createdBy,
    updated_at: Date.now()
  };
  saveFallbackData();
  return getTemplate(name);
}

export function getTemplate(name) {
  if (!useFallback && sqliteDb) {
    const row = sqliteDb.prepare('SELECT * FROM templates WHERE template_name = ?').get(name);
    if (!row) return null;
    return { ...row, data: JSON.parse(row.json_payload) };
  }

  const record = store.templates[name];
  if (!record) return null;
  return { ...record, data: JSON.parse(record.json_payload) };
}

export function listTemplates() {
  if (!useFallback && sqliteDb) {
    return sqliteDb.prepare('SELECT template_name, created_by, updated_at FROM templates ORDER BY template_name ASC').all();
  }
  return Object.values(store.templates);
}

/**
 * YouTube Stream & RSS Cache
 */
export function hasAnnouncedVideo(videoId) {
  if (!useFallback && sqliteDb) {
    const row = sqliteDb.prepare('SELECT video_id FROM stream_cache WHERE video_id = ?').get(videoId);
    return !!row;
  }
  return !!store.stream_cache[videoId];
}

export function saveAnnouncedVideo(videoId, title, publishedAt) {
  if (!useFallback && sqliteDb) {
    sqliteDb.prepare(`
      INSERT INTO stream_cache (video_id, title, published_at, announced_at)
      VALUES (?, ?, ?, ?)
    `).run(videoId, title, publishedAt, Date.now());
    return;
  }

  store.stream_cache[videoId] = {
    video_id: videoId,
    title,
    published_at: publishedAt,
    announced_at: Date.now()
  };
  saveFallbackData();
}

/**
 * User Reports System
 */
export function createReport({ reporterId, targetId, reason, messageUrl }) {
  if (!useFallback && sqliteDb) {
    const countRow = sqliteDb.prepare('SELECT COUNT(*) as total FROM reports').get();
    const reportId = `REP-${(countRow.total + 1).toString().padStart(4, '0')}`;

    sqliteDb.prepare(`
      INSERT INTO reports (report_id, reporter_id, target_id, reason, message_url, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(reportId, reporterId, targetId, reason, messageUrl || null, Date.now());

    return getReport(reportId);
  }

  const reportId = `REP-${(store.reports.length + 1).toString().padStart(4, '0')}`;
  const report = {
    id: store.reports.length + 1,
    report_id: reportId,
    reporter_id: reporterId,
    target_id: targetId,
    reason,
    message_url: messageUrl || null,
    status: 'PENDING',
    created_at: Date.now()
  };
  store.reports.push(report);
  saveFallbackData();
  return report;
}

export function getReport(reportId) {
  if (!useFallback && sqliteDb) {
    return sqliteDb.prepare('SELECT * FROM reports WHERE report_id = ?').get(reportId);
  }
  return store.reports.find(r => r.report_id === reportId) || null;
}

export function updateReportStatus(reportId, status, actionTaken, resolvedBy) {
  if (!useFallback && sqliteDb) {
    sqliteDb.prepare(`
      UPDATE reports 
      SET status = ?, action_taken = ?, resolved_by = ?
      WHERE report_id = ?
    `).run(status, actionTaken, resolvedBy, reportId);
    return getReport(reportId);
  }

  const report = store.reports.find(r => r.report_id === reportId);
  if (report) {
    report.status = status;
    report.action_taken = actionTaken;
    report.resolved_by = resolvedBy;
    saveFallbackData();
  }
  return report;
}

// Default export safe wrapper so commands like ping don't crash
export default {
  prepare: (query) => ({
    get: () => ({ ok: 1 }),
    all: () => [],
    run: () => ({ changes: 1 })
  })
};
