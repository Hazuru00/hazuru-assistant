/**
 * ============================================================================
 * UTILIDAD: owner - Identidad del dueño del bot
 * ============================================================================
 *
 * Centraliza la comprobación del dueño del bot para que no haya IDs
 * hardcodeados repartidos por el código.
 *
 * El ID se lee SIEMPRE de la variable de entorno OPENCODE_OWNER_ID.
 * Si la variable no está configurada, nadie es considerado dueño: es mejor
 * fallar cerrado que dejar un ID fijo con permisos.
 *
 * USO:
 *   const { isOwner, getOwnerId } = require('./utils/owner');
 *   if (!isOwner(interaction.user.id)) return;
 * ============================================================================
 */

/**
 * Devuelve el ID del dueño configurado en .env, o cadena vacía si no hay.
 * @returns {string} ID de Discord del dueño
 */
const getOwnerId = () => (process.env.OPENCODE_OWNER_ID || '').trim();

/**
 * Comprueba si un usuario es el dueño del bot.
 * @param {string} userId - ID de Discord a comprobar
 * @returns {boolean} true solo si coincide con OPENCODE_OWNER_ID
 */
const isOwner = (userId) => {
  const ownerId = getOwnerId();
  if (!userId || !ownerId) return false;
  return String(userId) === ownerId;
};

module.exports = { getOwnerId, isOwner };
