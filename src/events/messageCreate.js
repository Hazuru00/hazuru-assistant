/**
 * ============================================================================
 * EVENTO: messageCreate (Auto-Moderación)
 * ============================================================================
 * Se ejecuta CADA VEZ que se envía un mensaje en un servidor.
 *
 * Su función principal es ejecutar los filtros de auto-moderación:
 *   1. antiSpam: Detecta mensajes repetidos rápido
 *   2. antiLinks: Detecta links no permitidos
 *   3. antiCaps: Detecta demasiadas mayúsculas
 *   4. bannedWords: Detecta palabras prohibidas
 *
 * FLUJO:
 *   1. Ignorar mensajes de bots y DMs
 *   2. Obtener la config del servidor
 *   3. Si autoMod no está habilitado, salir
 *   4. Ejecutar cada filtro en orden
 *   5. Si un filtro detecta algo, ejecutar la acción (delete/mute/kick)
 *   6. Registrar en el log y salir (no ejecutar más filtros)
 *
 * NOTA: Las acciones son:
 *   - 'delete': Elimina el mensaje
 *   - 'mute': Elimina el mensaje + silencia al usuario temporalmente
 *   - 'kick': Elimina el mensaje + expulsa al usuario del servidor
 * ============================================================================
 */

const { Events } = require('discord.js');
const { getGuild } = require('../database/index');
const { logEvent, logError } = require('../utils/logger');

// Lista de filtros de auto-moderación (se ejecutan en orden)
const filters = [
  require('../utils/automod/antiSpam'),    // 1. Anti-spam
  require('../utils/automod/antiLinks'),   // 2. Anti-links
  require('../utils/automod/antiCaps'),    // 3. Anti-caps
  require('../utils/automod/bannedWords'), // 4. Palabras prohibidas
];

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignorar mensajes en DMs y mensajes de bots
    if (!message.guild || message.author.bot) return;

    // Obtener configuración del servidor
    const config = getGuild(message.guild.id);
    const autoMod = config.autoMod;

    // Si autoMod no está habilitado, no hacer nada
    if (!autoMod || !autoMod.enabled) return;

    // Ejecutar cada filtro en orden
    for (const filter of filters) {
      try {
        // Pasar el mensaje y la configuración específica de este filtro
        // autoMod[filter.name] obtiene la config del filtro por su nombre
        // Ejemplo: autoMod['antiSpam'] → { enabled: true, maxMessages: 5, ... }
        const result = filter.check(message, autoMod[filter.name] || {});

        // Si el filtro no detectó nada, pasar al siguiente
        if (!result) continue;

        // --- EJECUTAR ACCIÓN ---

        // Si la acción es delete o mute, eliminar el mensaje
        if (result.action === 'delete' || result.action === 'mute') {
          try { await message.delete(); } catch {}
        }

        // Si la acción es mute, silenciar al usuario
        if (result.action === 'mute') {
          const duration = autoMod.muteDuration || 300000; // Default: 5 minutos
          try { await message.member.timeout(duration, result.reason); } catch {}
        }

        // Si la acción es kick, expulsar al usuario
        if (result.action === 'kick') {
          try { await message.member.kick(result.reason); } catch {}
        }

        // Registrar la acción en el log
        logEvent('automod', {
          filter: filter.name,
          userId: message.author.id,
          reason: result.reason,
          action: result.action,
          channel: message.channel.id,
        });

        break;
      } catch (e) {
        logError(e, { event: 'messageCreate', filter: filter.name });
      }
    }
  },
};
