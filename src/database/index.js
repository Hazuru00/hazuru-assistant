/**
 * ============================================================================
 * BASE DE DATOS DE CONFIGURACIÓN DE SERVIDORES (guilds.json)
 * ============================================================================
 *
 * Este archivo maneja toda la configuración de cada servidor de Discord.
 * Usa un archivo JSON plano (guilds.json) como base de datos.
 *
 * ESTRUCTURA DEL JSON:
 * {
 *   "guilds": {
 *     "ID_DEL_SERVIDOR": {
 *       "welcome": { ... },        // Config de bienvenida
 *       "farewell": { ... },       // Config de despedida
 *       "privateWelcome": { ... }, // Config de bienvenida por DM
 *       "boost": { ... },          // Config de mensaje de boost
 *       "ban": { ... },            // Config de mensaje de ban
 *       "kick": { ... },           // Config de mensaje de kick
 *       "autoRole": { ... },       // Config de rol automático
 *       "autoMod": { ... },        // Config de auto-moderación
 *       "logging": { ... }         // Config de logging
 *     }
 *   }
 * }
 *
 * FUNCIONES EXPORTADAS:
 *   - getGuild(guildId)     → Obtiene la config de un servidor (crea defaults si no existe)
 *   - updateGuild(guildId)  → Actualiza la config de un servidor (merge superficial)
 *   - defaultEmbed()        → Crea un embed por defecto para usar en mensajes
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// Ruta al archivo JSON de base de datos
const DB_PATH = path.join(__dirname, 'guilds.json');


// ============================================================================
// TEMPLATES POR DEFECTO
// ============================================================================

/**
 * Crea un embed por defecto. Se usa como base para los embeds de bienvenida,
 * despedida, boost, ban, kick, etc.
 *
 * Estructura de un embed:
 *   - title: Título del embed
 *   - description: Descripción (texto principal)
 *   - color: Color en hexadecimal
 *   - thumbnail: Miniatura (imagen pequeña arriba a la derecha)
 *   - image: Imagen grande
 *   - author: Información del autor del embed
 *   - footer: Texto del pie de página
 *   - fields: Array de campos adicionales (nombre, valor, inline)
 */
const defaultEmbed = () => ({
  title: '', description: '', color: '#5865F2',
  thumbnail: '', image: '',
  author: { name: '', iconUrl: '', url: '' },
  footer: { text: '', iconUrl: '' },
  fields: [],
});

/**
 * Configuración por defecto de un servidor.
 * Se usa cuando un servidor entra por primera vez al bot.
 *
 * Cada sección (welcome, farewell, etc.) tiene:
 *   - enabled: Si está activo o no
 *   - channel: ID del canal donde enviar el mensaje
 *   - message: Texto del mensaje (soporta variables como {user}, {server})
 *   - embedEnabled: Si usar embed o solo texto plano
 *   - embed: Configuración del embed
 *   - card: Configuración de tarjeta de imagen (solo welcome/farewell)
 */
const defaultConfig = () => ({
  // --- BIENVENIDA ---
  welcome: {
    enabled: false, channel: '', message: '', embedEnabled: true, embed: defaultEmbed(),
    card: {
      enabled: false, theme: 'dark', background: '', title: 'Bienvenido',
      subtitle: 'Miembro #{memberCount}', textColor: '', subtitleColor: '',
      avatarBorderColor: '', avatarBorderWidth: 5, font: 'sans-serif',
      overlayOpacity: 50, blur: false, animated: false, animationFrames: 30, animationDelay: 100,
    },
  },
  // --- DESPEDIDA ---
  farewell: {
    enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#ED4245' },
    card: {
      enabled: false, theme: 'dark', background: '', title: 'Adiós',
      subtitle: 'Te extrañaremos', textColor: '', subtitleColor: '',
      avatarBorderColor: '', avatarBorderWidth: 5, font: 'sans-serif',
      overlayOpacity: 50, blur: false, animated: false, animationFrames: 30, animationDelay: 100,
    },
  },
  // --- BIENVENIDA PRIVADA (DM) ---
  privateWelcome: { enabled: false, message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#eb459e' } },
  // --- BOOST ---
  boost: { enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#f47fff' } },
  // --- BAN ---
  ban: { enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#ED4245' } },
  // --- KICK ---
  kick: { enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#FF9044' } },
  // --- ROL AUTOMÁTICO ---
  autoRole: { enabled: false, roleId: '' },
  // --- AUTO-MODERACIÓN ---
  autoMod: {
    enabled: false,
    antiSpam: { enabled: false, maxMessages: 5, interval: 5000, action: 'mute', muteDuration: 60000 },
    antiLinks: { enabled: false, whitelistedDomains: ['discord.com', 'discordapp.com', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'twitch.tv', 'github.com'], action: 'delete' },
    antiCaps: { enabled: false, maxPercentage: 70, minLetters: 10, action: 'delete' },
    bannedWords: { enabled: false, words: [], action: 'delete' },
  },
  // --- LOGGING ---
  logging: { channel: '', messageDelete: true, messageUpdate: true, voiceStateUpdate: false, roleUpdate: false },
});


// ============================================================================
// FUNCIONES DE LECTURA/ESCRITURA
// ============================================================================

/**
 * Lee el archivo JSON y devuelve el objeto.
 * Si el archivo no existe o está corrupto, devuelve { guilds: {} }
 */
const read = () => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return { guilds: {} };
  }
};

/**
 * Escribe datos al archivo JSON.
 * Sobrescribe todo el contenido del archivo.
 */
const write = (data) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};


// ============================================================================
// FUNCIONES PÚBLICAS
// ============================================================================

/**
 * Obtiene la configuración completa de un servidor.
 *
 * Si el servidor no tiene configuración, crea una con los valores por defecto
 * y la guarda en el archivo. También asegura que todas las secciones existan
 * (útil cuando se agrega una nueva sección al defaultConfig y los servidores
 * viejos no la tienen).
 *
 * @param {string} guildId - ID del servidor de Discord
 * @returns {Object} Configuración completa del servidor
 */
const getGuild = (guildId) => {
  const db = read();

  // Si el servidor no existe, crearlo con defaults
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = defaultConfig();
    write(db);
  }

  const cfg = db.guilds[guildId];

  // Asegurar que todas las secciones existan con valores por defecto
  // Esto es útil cuando se agrega una nueva funcionalidad al bot
  const defaults = defaultConfig();
  for (const key of Object.keys(defaults)) {
    if (!cfg[key]) cfg[key] = defaults[key];

    // Asegurar que el embed tenga los campos requeridos
    if (cfg[key].embed && typeof cfg[key].embed === 'object') {
      if (!cfg[key].embed.fields) cfg[key].embed.fields = [];
      if (!cfg[key].embed.author) cfg[key].embed.author = { name: '', iconUrl: '', url: '' };
      if (!cfg[key].embed.footer) cfg[key].embed.footer = { text: '', iconUrl: '' };
    }

    // Asegurar que la card exista para welcome/farewell
    if ((key === 'welcome' || key === 'farewell') && !cfg[key].card) {
      cfg[key].card = defaults[key].card;
    }
  }

  return cfg;
};

/**
 * Actualiza la configuración de un servidor.
 * Hace un merge superficial (shallow merge): solo sobreescribe las propiedades
 * que se pasan en `data`, las demás quedan igual.
 *
 * Ejemplo:
 *   updateGuild('123', { welcome: { enabled: true, channel: '456' } })
 *   → Solo cambia welcome, el resto queda igual
 *
 * @param {string} guildId - ID del servidor
 * @param {Object} data - Datos a actualizar (parcial)
 * @returns {Object} Configuración completa actualizada
 */
const updateGuild = (guildId, data) => {
  const db = read();
  const current = getGuild(guildId);
  db.guilds[guildId] = { ...current, ...data };
  write(db);
  return db.guilds[guildId];
};


module.exports = { getGuild, updateGuild, defaultEmbed };
