/**
 * ============================================================================
 * UTILIDAD: configView - Lectura y formato de la configuración de servidores
 * ============================================================================
 *
 * Comparte la lista de secciones y campos editables entre el comando de
 * solo lectura (/config) y el comando del dueño (/owner). Así ambos muestran
 * exactamente las mismas secciones y no se desincronizan.
 *
 * NO escribe nada: solo define la whitelist y da formato a la salida.
 * ============================================================================
 */

// Secciones de guilds.json que se pueden consultar y modificar.
const SECCIONES = [
  'welcome', 'farewell', 'privateWelcome', 'boost',
  'ban', 'kick', 'autoRole', 'levels', 'autoMod', 'logging',
];

// Campos permitidos por sección. Evita que un dueño escriba campos inventados.
const CAMPOS = {
  welcome: ['enabled', 'channel', 'message', 'embedEnabled'],
  farewell: ['enabled', 'channel', 'message', 'embedEnabled'],
  privateWelcome: ['enabled', 'message', 'embedEnabled'],
  boost: ['enabled', 'channel', 'message', 'embedEnabled'],
  ban: ['enabled', 'channel', 'message', 'embedEnabled'],
  kick: ['enabled', 'channel', 'message', 'embedEnabled'],
  autoRole: ['enabled', 'roleId'],
  levels: ['enabled', 'announcementChannel', 'announceLevelUp', 'announceAchievement'],
  autoMod: ['enabled'],
  logging: ['channel', 'messageDelete', 'messageUpdate', 'voiceStateUpdate', 'roleUpdate'],
};

// Lista plana de campos para las opciones del comando (luego se valida por sección).
const CAMPOS_GLOBALES = [...new Set(Object.values(CAMPOS).flat())];

// Campos que se guardan como booleano en lugar de texto.
const CAMPOS_BOOL = new Set([
  'enabled', 'embedEnabled', 'announceLevelUp', 'announceAchievement',
  'messageDelete', 'messageUpdate', 'voiceStateUpdate', 'roleUpdate',
]);

// Campos que guardan un ID de canal.
const CAMPOS_CANAL = new Set(['channel', 'announcementChannel']);

/**
 * Resumen corto de todas las secciones: estado y destino configurado.
 * @param {Object} config - Configuración completa del servidor
 * @returns {string} Texto listo para un embed
 */
const resumir = (config) => SECCIONES.map((seccion) => {
  const datos = config[seccion] || {};
  const estado = datos.enabled === true ? '🟢' : '⚪';
  const destino = datos.channel
    ? `<#${datos.channel}>`
    : datos.roleId
      ? `<@&${datos.roleId}>`
      : datos.announcementChannel
        ? `<#${datos.announcementChannel}>`
        : 'sin destino';
  return `${estado} **${seccion}** · ${destino}`;
}).join('\n');

/**
 * Muestra una sección completa como JSON dentro de un bloque de código.
 * Discord permite hasta 4096 caracteres por descripción de embed, así que
 * se recorta con margen para no romper el embed.
 *
 * @param {Object} config - Configuración completa del servidor
 * @param {string} seccion - Nombre de la sección
 * @returns {string} JSON formateado y truncado si hace falta
 */
const formatearSeccion = (config, seccion) => {
  const json = JSON.stringify(config[seccion] || {}, null, 2);
  const limite = 3500;
  const contenido = json.length > limite
    ? `${json.slice(0, limite)}\n… (truncado)`
    : json;
  return `\`\`\`json\n${contenido}\n\`\`\``;
};

module.exports = {
  SECCIONES, CAMPOS, CAMPOS_GLOBALES, CAMPOS_BOOL, CAMPOS_CANAL,
  resumir, formatearSeccion,
};
