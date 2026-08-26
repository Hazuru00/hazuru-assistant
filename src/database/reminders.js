/**
 * ============================================================================
 * SISTEMA DE RECORDATORIOS (reminders.json)
 * ============================================================================
 *
 * Almacena recordatorios que los usuarios crean con el comando /remind.
 * Cuando el tiempo se cumple, el bot envía un mensaje al canal.
 *
 * NOTA IMPORTANTE: Los recordatorios se crean con setTimeout() en memoria.
 * Si el bot se reinicia, los recordatorios pendientes se pierden (aunque
 * quedan guardados en el JSON). Para恢复recordatorios al iniciar, habría
 * que agregar código en index.js que lea el JSON y programe los timeouts.
 *
 * ESTRUCTURA DEL JSON:
 * {
 *   "ID_DEL_SERVIDOR": {
 *     "ID_DEL_RECORDATORIO": {
 *       "id": "abc123",
 *       "guildId": "123",
 *       "userId": "456",
 *       "channel": "789",
 *       "message": "Reunión a las 3pm",
 *       "remindAt": 1234567890,
 *       "createdAt": "2026-07-22T..."
 *     }
 *   }
 * }
 *
 * FUNCIONES EXPORTADAS:
 *   - getReminders(guildId)           → Obtiene todos los recordatorios de un servidor
 *   - getAllReminders()               → Obtiene todos los recordatorios de todos los servidores
 *   - addReminder(guildId, data)      → Crea un nuevo recordatorio
 *   - removeReminder(guildId, reminderId) → Elimina un recordatorio
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'reminders.json');

const read = () => {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
};

const write = (data) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

/**
 * Obtiene todos los recordatorios de un servidor.
 * @returns {Object} { reminderId: reminder }
 */
const getReminders = (guildId) => {
  const db = read();
  return db[guildId] || {};
};

/**
 * Obtiene TODOS los recordatorios de TODOS los servidores.
 * @returns {Array} Array plano de recordatorios
 */
const getAllReminders = () => {
  const db = read();
  const all = [];
  for (const guildId of Object.keys(db)) {
    for (const reminder of Object.values(db[guildId])) {
      all.push(reminder);
    }
  }
  return all;
};

/**
 * Crea un nuevo recordatorio.
 * @param {string} guildId - ID del servidor
 * @param {Object} data - { userId, channel, message, remindAt }
 * @returns {Object} El recordatorio creado
 */
const addReminder = (guildId, data) => {
  const db = read();
  if (!db[guildId]) db[guildId] = {};

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reminder = { id, guildId, ...data, createdAt: new Date().toISOString() };
  db[guildId][id] = reminder;
  write(db);
  return reminder;
};

/**
 * Elimina un recordatorio por su ID.
 * @returns {boolean} true si se eliminó, false si no se encontró
 */
const removeReminder = (guildId, reminderId) => {
  const db = read();
  if (db[guildId]?.[reminderId]) {
    delete db[guildId][reminderId];
    write(db);
    return true;
  }
  return false;
};

module.exports = { getReminders, getAllReminders, addReminder, removeReminder };
