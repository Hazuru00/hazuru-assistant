/**
 * ============================================================================
 * UTILIDAD: logger - Sistema de Logging a Archivo
 * ============================================================================
 *
 * Escribe logs de errores e información en archivos diarios.
 * Los archivos se guardan en la carpeta /logs/ del proyecto.
 *
 * FORMATO DE ARCHIVO: errors-YYYY-MM-DD.log
 * Ejemplo: errors-2026-07-22.log
 *
 * ESTRUCTURA DE UN LOG DE ERROR:
 *   ============================================================
 *   [2026-07-22T15:30:00.000Z] Error: Cannot read property 'id'
 *     Evento: guildMemberAdd
 *     Servidor: Mi Servidor (123456789)
 *     Usuario: Usuario#1234 (123456789)
 *     Seccion: welcome
 *     Accion: Send message
 *     Stack:
 *       at execute (guildMemberAdd.js:15:20)
 *   ============================================================
 *
 * USO:
 *   const { logError, logInfo } = require('./utils/logger');
 *   logError(error, { event: 'guildMemberAdd', guild, user, section: 'welcome' });
 *   logInfo('Welcome sent', { guild: guild.name, user: user.tag });
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// Carpeta donde se guardan los logs
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

// Crear la carpeta de logs si no existe
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

/**
 * Obtiene la ruta del archivo de log del día actual.
 * Ejemplo: /logs/errors-2026-07-22.log
 */
function getLogFile() {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // "2026-07-22"
  return path.join(LOGS_DIR, `errors-${date}.log`);
}

/**
 * Formatea un error con contexto para escribir en el log.
 *
 * @param {Error} err - El objeto de error
 * @param {Object} context - Contexto adicional (evento, guild, user, etc.)
 * @returns {string} El log formateado
 */
function formatError(err, context = {}) {
  const now = new Date().toISOString();
  const lines = [
    `\n${'='.repeat(60)}`,
    `[${now}] ${err.name || 'Error'}: ${err.message}`,
  ];

  // Agregar campos de contexto si existen
  if (context.event) lines.push(`  Evento: ${context.event}`);
  if (context.guild) lines.push(`  Servidor: ${context.guild.name} (${context.guild.id})`);
  if (context.user) lines.push(`  Usuario: ${context.user.tag || context.user} (${context.user.id || 'N/A'})`);
  if (context.channel) lines.push(`  Canal: #${context.channel.name || context.channel} (${context.channel.id || 'N/A'})`);
  if (context.section) lines.push(`  Seccion: ${context.section}`);
  if (context.action) lines.push(`  Accion: ${context.action}`);
  if (context.config) lines.push(`  Config: ${JSON.stringify(context.config)}`);
  if (context.stack) lines.push(`  Stack:\n${context.stack.split('\n').slice(1, 6).join('\n    ')}`);
  lines.push(`${'='.repeat(60)}\n`);

  return lines.join('\n');
}

/**
 * Registra un error en el archivo de log Y en la consola.
 *
 * @param {Error} err - El error
 * @param {Object} context - Contexto (evento, guild, user, section, action, config)
 */
function logError(err, context = {}) {
  const logEntry = formatError(err, context);
  const logFile = getLogFile();

  try {
    fs.appendFileSync(logFile, logEntry, 'utf8');
  } catch (e) {
    console.error('No se pudo escribir log:', e.message);
  }

  console.error(logEntry);
}

/**
 * Registra un mensaje informativo en el archivo de log.
 *
 * @param {string} message - Mensaje descriptivo
 * @param {Object} context - Contexto adicional
 */
function logInfo(message, context = {}) {
  const now = new Date().toISOString();
  const line = `[${now}] INFO: ${message}${Object.keys(context).length ? ' | ' + JSON.stringify(context) : ''}\n`;
  const logFile = getLogFile();
  try {
    fs.appendFileSync(logFile, line, 'utf8');
  } catch {}
}

/**
 * Registra un evento de auto-moderación o información general.
 * Alias de logInfo con formato más legible para consola.
 */
function logEvent(type, data = {}) {
  const now = new Date().toISOString();
  const line = `[${now}] EVENT: ${type} | ${JSON.stringify(data)}\n`;
  const logFile = getLogFile();
  try {
    fs.appendFileSync(logFile, line, 'utf8');
  } catch {}
  console.log(`[EVENT] ${type}`, data);
}

module.exports = { logError, logInfo, logEvent };
