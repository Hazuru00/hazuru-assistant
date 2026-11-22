/**
 * ============================================================================
 * UTILIDAD: replaceVars - Punto de entrada de las variables de mensaje
 * ============================================================================
 *
 * Todos los eventos, comandos, previews y embeds llaman a esta función.
 * Ahora resuelve tanto las variables del sistema como las variables y
 * plantillas custom guardadas en messageVariables.json.
 *
 * Si no hay nada guardado, el resultado es idéntico al de siempre: el motor
 * solo interviene cuando hay una expresión que resolver.
 *
 * VARIABLES DISPONIBLES (para miembros):
 *   {user} {user.name} {user.id} {user.avatar} {user.tag} {user.mention}
 *   {user.createdAt} {user.joinedAt} {server} {server.id} {server.icon}
 *   {memberCount} {boost} {date} {time}
 *
 * VARIABLES DISPONIBLES (para bans):
 *   {moderator} {reason}
 * ============================================================================
 */

const { resolverPlantillas } = require('./templateEngine');
const { getBiblioteca } = require('../database/messageVariables');
const { obtenerVarsBase, obtenerVarsFechaHora, sustituirVars } = require('./varsBase');

/** Ruta histórica: sin variables guardadas el resultado es byte-idéntico. */
const reemplazoBasico = (str, source) => {
  const { date, time } = obtenerVarsFechaHora();
  return sustituirVars(str, obtenerVarsBase(source))
    .replace(/\{date\}/g, () => date)
    .replace(/\{time\}/g, () => time);
};

/**
 * Reemplaza todas las variables en un string con sus valores reales.
 *
 * @param {string} str - El string con variables
 * @param {Object} source - Fuente de datos (miembro, ban info u objeto plano)
 * @returns {string} String con todas las variables reemplazadas
 */
const replaceVars = (str, source) => {
  if (!str) return '';

  const biblioteca = getBiblioteca();
  if (!Object.keys(biblioteca.variables).length && !Object.keys(biblioteca.plantillas).length) {
    return reemplazoBasico(str, source);
  }

  const guildId = (source && source.guild && source.guild.id)
    || (source && source['server.id'])
    || '';

  return resolverPlantillas(str, {
    fuente: source,
    guildId,
    biblioteca,
  });
};

module.exports = {
  replaceVars,
  obtenerVarsBase,
  obtenerVarsFechaHora,
  sustituirVars,
};
