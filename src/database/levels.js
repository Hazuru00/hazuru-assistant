const fs = require('fs');
const path = require('path');
const { createBackup } = require('./backup');
const { readJson, writeJsonAtomic, writeJsonAtomicAsync } = require('./atomic');

const LEVELS_PATH = path.join(__dirname, 'levels.json');
const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'levels-changes.log');
const BACKUP_EVERY = 50;
let _writeCount = 0;

let _cache = null;
let _writing = false;
const _writeQueue = [];

const logChange = (action, details) => {
  try {
    const line = `[${new Date().toISOString()}] ${action} | ${details}\n`;
    fs.appendFileSync(LOG_PATH, line);
  } catch {}
};

const readSync = () => readJson(LEVELS_PATH, {});

const loadCache = () => {
  if (!_cache) {
    _cache = readSync();
    createBackup('levels.json');
  }
  return _cache;
};

const flushQueue = () => {
  if (_writeQueue.length === 0) { _writing = false; return; }
  const { data, resolve } = _writeQueue.shift();
  _writing = true;

  _writeCount++;
  if (_writeCount % BACKUP_EVERY === 0) {
    createBackup('levels.json');
  }

  writeJsonAtomicAsync(LEVELS_PATH, data)
    .then(() => { resolve(); flushQueue(); })
    .catch((err) => { resolve(err); flushQueue(); });
};

const flush = () => new Promise((resolve) => {
  if (!_cache) return resolve();
  _writeQueue.push({ data: _cache, resolve });
  if (!_writing) flushQueue();
});

const read = () => loadCache();

const writeSync = (data) => {
  _cache = data;
  writeJsonAtomic(LEVELS_PATH, data);
};

const getUser = (guildId, userId) => {
  const db = read();
  return db[guildId]?.[userId] || null;
};

const getOrCreateUser = (guildId, userId) => {
  const db = read();
  if (!db[guildId]) db[guildId] = {};
  if (!db[guildId][userId]) {
    db[guildId][userId] = {
      xp: 0,
      level: 0,
      messages: 0,
      lastXpMessage: 0,
      streak: { days: 0, lastDate: '' },
      achievements: [],
      badges: [],
      title: '',
      joinedAt: Date.now(),
    };
    flush();
  }
  return db[guildId][userId];
};

const saveUser = async (guildId, userId, data) => {
  const db = read();
  if (!db[guildId]) db[guildId] = {};
  db[guildId][userId] = data;
  await flush();
};

const saveUserSync = (guildId, userId, data) => {
  const db = read();
  if (!db[guildId]) db[guildId] = {};
  db[guildId][userId] = data;
  writeSync(db);
};

const getLeaderboard = (guildId, limit = 15) => {
  const db = read();
  const guild = db[guildId] || {};
  return Object.entries(guild)
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.level - a.level || b.xp - a.xp)
    .slice(0, limit);
};

const getRank = (guildId, userId) => {
  const db = read();
  const guild = db[guildId] || {};
  const sorted = Object.entries(guild)
    .map(([uid, data]) => ({ userId: uid, level: data.level, xp: data.xp }))
    .sort((a, b) => b.level - a.level || b.xp - a.xp);
  const pos = sorted.findIndex(e => e.userId === userId);
  return pos >= 0 ? pos + 1 : null;
};

const getAllUsers = (guildId) => {
  const db = read();
  const guild = db[guildId] || {};
  return Object.entries(guild).map(([userId, data]) => ({ userId, ...data }));
};

const resetUser = (guildId, userId) => {
  const db = read();
  const old = db[guildId]?.[userId];
  if (old) {
    logChange('RESET_USER', `guild=${guildId} user=${userId} was level=${old.level} xp=${old.xp}`);
    createBackup('levels.json');
  }
  saveUserSync(guildId, userId, {
    xp: 0,
    level: 0,
    messages: 0,
    lastXpMessage: 0,
    streak: { days: 0, lastDate: '' },
    badges: [],
    title: '',
    joinedAt: Date.now(),
  });
};

const resetAll = (guildId) => {
  const db = read();
  const users = db[guildId] ? Object.keys(db[guildId]).length : 0;
  logChange('RESET_ALL', `guild=${guildId} users=${users}`);
  createBackup('levels.json');
  db[guildId] = {};
  writeSync(db);
};

module.exports = { getUser, getOrCreateUser, saveUser, saveUserSync, getLeaderboard, getRank, getAllUsers, resetUser, resetAll };
