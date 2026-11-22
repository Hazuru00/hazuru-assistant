/**
 * ============================================================================
 * UTILIDAD: configEdit - Validación y escritura de la configuración
 * ============================================================================
 *
 * Toda escritura de configuración (desde slash commands o desde el panel
 * interactivo) pasa por acá. Así hay una sola validación y una sola llamada
 * a updateGuild(), que ya hace backup atómico.
 *
 * NO se expone a los comandos de administradores: el dueño se comprueba en
 * los handlers antes de llamar a estas funciones.
 * ============================================================================
 */

const { getGuild, updateGuild, defaultConfig } = require('../database');
const { CAMPOS_BOOL, CAMPOS_CANAL } = require('./configView');
const { logInfo } = require('./logger');

/**
 * Extrae un ID numérico de Discord de un texto o mención.
 * @param {string} texto - Por ejemplo '<#123456789>' o '123456789'
 * @returns {string|null} El ID, o null si no hay uno válido
 */
const extraerId = (texto) => {
  const coincidencia = String(texto || '').match(/(\d{15,25})/);
  return coincidencia ? coincidencia[1] : null;
};

/**
 * Convierte texto libre en booleano. Acepta sí/no, true/false, 1/0, on/off.
 * @param {string} texto - Texto escrito por el usuario
 * @returns {boolean|null} Booleano, o null si no se entiende
 */
const parsearBooleano = (texto) => {
  const valor = String(texto || '').trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'on', 'activo'].includes(valor)) return true;
  if (['false', '0', 'no', 'off', 'inactivo'].includes(valor)) return false;
  return null;
};

/**
 * Valida y convierte el valor escrito en un modal según el tipo de campo.
 * @param {string} campo - Nombre del campo (enabled, channel, message, ...)
 * @param {string} texto - Valor escrito por el usuario
 * @param {Guild} guild - Servidor, para verificar canales y roles
 * @returns {{ok: boolean, valor?: any, error?: string}}
 */
const parsearValor = async (campo, texto, guild) => {
  const valor = String(texto ?? '').trim();

  if (CAMPOS_BOOL.has(campo)) {
    const booleano = parsearBooleano(valor);
    if (booleano === null) {
      return { ok: false, error: 'Escribí `sí` o `no` (también `true`/`false`).' };
    }
    return { ok: true, valor: booleano };
  }

  if (CAMPOS_CANAL.has(campo)) {
    const id = extraerId(valor);
    if (!id) return { ok: false, error: 'Pegá un canal (#canal) o su ID numérico.' };
    let canal = guild.channels.cache.get(id);
    if (!canal) canal = await guild.channels.fetch(id).catch(() => null);
    if (!canal || ![0, 5, 15].includes(canal.type)) {
      return { ok: false, error: 'Ese canal no existe o no es de texto/anuncios/hilo.' };
    }
    return { ok: true, valor: id };
  }

  if (campo === 'roleId') {
    const id = extraerId(valor);
    if (!id) return { ok: false, error: 'Pegá un rol (@rol) o su ID numérico.' };
    if (!guild.roles.cache.has(id)) return { ok: false, error: 'Ese rol no existe en este servidor.' };
    return { ok: true, valor: id };
  }

  if (campo === 'message') {
    // Un mensaje se usa como content (2000) o como descripción de embed (4096).
    // 2000 es el límite más estricto y evita mensajes que Discord rechazaría.
    if (valor.length > 2000) return { ok: false, error: 'El mensaje no puede superar 2000 caracteres.' };
    return { ok: true, valor };
  }

  return { ok: true, valor };
};

/**
 * Guarda un campo de una sección y devuelve el valor anterior (para el diff).
 * @param {string} guildId - ID del servidor
 * @param {string} seccion - Sección de guilds.json
 * @param {string} campo - Campo dentro de la sección
 * @param {any} valor - Valor ya validado
 * @returns {any} Valor que tenía antes
 */
const guardarCampo = (guildId, seccion, campo, valor) => {
  const config = getGuild(guildId);
  const anterior = config[seccion]?.[campo];

  // updateGuild() hace merge superficial: hay que pasar la sección completa.
  updateGuild(guildId, {
    [seccion]: { ...(config[seccion] || {}), [campo]: valor },
  });

  logInfo(`Config editada: ${seccion}.${campo}`, {
    guild: { id: guildId },
    action: 'config-edit',
  });
  return anterior;
};

/**
 * Invierte un campo booleano (lo usan los botones del panel).
 * @param {string} guildId - ID del servidor
 * @param {string} seccion - Sección de guilds.json
 * @param {string} campo - Campo booleano
 * @returns {boolean} Nuevo valor
 */
const alternarCampo = (guildId, seccion, campo) => {
  const config = getGuild(guildId);
  const nuevoValor = config[seccion]?.[campo] !== true;
  guardarCampo(guildId, seccion, campo, nuevoValor);
  return nuevoValor;
};

/**
 * Restablece una sección completa a sus valores por defecto.
 * @param {string} guildId - ID del servidor
 * @param {string} seccion - Sección de guilds.json
 */
const resetearSeccion = (guildId, seccion) => {
  const valorPorDefecto = defaultConfig()[seccion];
  updateGuild(guildId, { [seccion]: valorPorDefecto });
  logInfo(`Config restablecida: ${seccion}`, { guild: { id: guildId }, action: 'config-reset' });
};

module.exports = {
  extraerId, parsearBooleano, parsearValor,
  guardarCampo, alternarCampo, resetearSeccion,
};
