/**
 * ============================================================================
 * SISTEMA DE ADVERTENCIAS (warnings.json)
 * ============================================================================
 *
 * Almacena las advertencias que los moderadores dan a los usuarios.
 * Cada advertencia tiene: ID único, razón, moderador, y timestamp.
 *
 * ESTRUCTURA DEL JSON:
 * {
 *   "ID_DEL_SERVIDOR": {
 *     "ID_DEL_USUARIO": [
 *       { "id": "abc123", "reason": "Spam", "moderatorId": "...", "timestamp": "..." }
 *     ]
 *   }
 * }
 *
 * FUNCIONES EXPORTADAS:
 *   - getWarnings(guildId, userId)       → Obtiene las warnings de un usuario
 *   - getAllGuildWarnings(guildId)        → Obtiene todas las warnings del servidor
 *   - addWarning(guildId, userId, data)  → Agrega una warning
 *   - removeWarning(guildId, userId, warningId) → Elimina una warning por ID
 *   - clearWarnings(guildId, userId)     → Limpia todas las warnings de un usuario
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'warnings.json');

// Leer/escribir el archivo JSON
const read = () => {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
};

const write = (data) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

/**
 * Obtiene todas las advertencias de un usuario específico en un servidor.
 * @returns {Array} Array de objetos de advertencia
 */
const getWarnings = (guildId, userId) => {
  const db = read();
  return db[guildId]?.[userId] || [];
};

/**
 * Obtiene todas las advertencias de un servidor (todos los usuarios).
 * @returns {Object} { userId: [warnings] }
 */
const getAllGuildWarnings = (guildId) => {
  const db = read();
  return db[guildId] || {};
};

/**
 * Agrega una advertencia a un usuario.
 * Genera un ID único usando timestamp en base36 + random.
 * Agrega automáticamente el timestamp de creación.
 *
 * @param {string} guildId - ID del servidor
 * @param {string} userId - ID del usuario advertido
 * @param {Object} data - Datos de la advertencia ({ reason, moderatorId, moderatorTag })
 * @returns {Array} Array actualizado de warnings del usuario
 */
const addWarning = (guildId, userId, data) => {
  const db = read();
  if (!db[guildId]) db[guildId] = {};
  if (!db[guildId][userId]) db[guildId][userId] = [];

  // ID único: timestamp en base36 + 4 caracteres random
  const warning = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ...data,
    timestamp: new Date().toISOString(),
  };

  db[guildId][userId].push(warning);
  write(db);
  return db[guildId][userId];
};

/**
 * Elimina una advertencia específica por su ID.
 * @returns {boolean} true si se eliminó, false si no se encontró
 */
const removeWarning = (guildId, userId, warningId) => {
  const db = read();
  if (!db[guildId]?.[userId]) return false;

  const idx = db[guildId][userId].findIndex(w => w.id === warningId);
  if (idx === -1) return false;

  db[guildId][userId].splice(idx, 1);
  write(db);
  return true;
};

/**
 * Elimina todas las advertencias de un usuario.
 */
const clearWarnings = (guildId, userId) => {
  const db = read();
  if (db[guildId]) db[guildId][userId] = [];
  write(db);
};

module.exports = { getWarnings, getAllGuildWarnings, addWarning, removeWarning, clearWarnings };
