const path = require('path');
const { createBackup } = require('./backup');
const { readJson, writeJsonAtomic } = require('./atomic');

const SETTINGS_PATH = path.join(__dirname, 'settings.json');

const read = () => readJson(SETTINGS_PATH, {});

const write = (data) => {
  writeJsonAtomic(SETTINGS_PATH, data);
};

const getSettings = () => {
  const db = read();
  return {
    authorizedServers: db.authorizedServers || {},
    ...db,
  };
};

const updateSettings = (data) => {
  const db = read();
  createBackup('settings.json');
  const merged = { ...db, ...data };
  write(merged);
  return merged;
};

module.exports = { getSettings, updateSettings };
