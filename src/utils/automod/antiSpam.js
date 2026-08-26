/**
 * ============================================================================
 * FILTRO: antiSpam - Anti-Spam
 * ============================================================================
 *
 * Detecta usuarios que envían muchos mensajes en poco tiempo.
 * Rastrea los timestamps de mensajes de cada usuario en memoria (Map).
 *
 * CONFIGURACIÓN:
 *   - enabled: Si el filtro está activo
 *   - maxMessages: Cantidad máxima de mensajes en el intervalo (default: 5)
 *   - interval: Ventana de tiempo en ms (default: 5000 = 5 segundos)
 *   - action: Qué hacer ('delete', 'mute', 'kick')
 *
 * CÓMO FUNCIONA:
 *   1. Guarda el timestamp de cada mensaje por usuario
 *   2. Filtra mensajes fuera de la ventana de tiempo
 *   3. Si quedan más de maxMessages, detecta spam
 *   4. Resetea el historial del usuario
 *
 * NOTA: El tracking se pierde si el bot se reinicia (está en memoria, no en DB).
 * ============================================================================
 */

// Map anidado: guildId → userId → [timestamps]
// Se guarda en memoria para máximo rendimiento
const spamTracker = new Map();

// Cleanup: remove inactive users every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [guildId, guild] of spamTracker) {
    for (const [userId, timestamps] of guild) {
      const valid = timestamps.filter(t => now - t < 30000);
      if (valid.length === 0) guild.delete(userId);
    }
    if (guild.size === 0) spamTracker.delete(guildId);
  }
}, 300000);

module.exports = {
  name: 'antiSpam',
  check(message, config) {
    if (!config.enabled) return null;

    const allowedChannels = config.allowedChannels || [];
    if (allowedChannels.includes(message.channel.id)) return null;

    const { maxMessages = 5, interval = 5000 } = config;
    const guildId = message.guild.id;
    const userId = message.author.id;
    const now = Date.now();

    // Inicializar estructuras si no existen
    if (!spamTracker.has(guildId)) spamTracker.set(guildId, new Map());
    const guild = spamTracker.get(guildId);
    if (!guild.has(userId)) guild.set(userId, []);

    // Obtener timestamps válidos (dentro de la ventana de tiempo)
    const timestamps = guild.get(userId);
    const valid = timestamps.filter(t => now - t < interval);

    // Agregar el timestamp actual
    valid.push(now);
    guild.set(userId, valid);

    // Si hay más mensajes que el máximo → spam detectado
    if (valid.length > maxMessages) {
      guild.set(userId, []); // Resetear historial
      return { reason: 'Spam detectado', action: config.action || 'delete' };
    }

    return null;
  },
};
