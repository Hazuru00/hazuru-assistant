/**
 * ============================================================================
 * FILTRO: bannedWords - Palabras Prohibidas
 * ============================================================================
 *
 * Detecta mensajes que contienen palabras de una lista configurable.
 * La comparación es case-insensitive (no importa mayúsculas/minúsculas).
 *
 * CONFIGURACIÓN:
 *   - enabled: Si el filtro está activo
 *   - words: Array de palabras prohibidas
 *   - action: Qué hacer ('delete', 'mute', 'kick')
 *
 * CÓMO FUNCIONA:
 *   1. Convierte el mensaje a minúsculas
 *   2. Busca cada palabra prohibida en el mensaje
 *   3. Si encuentra alguna → detecta
 *
 * NOTA: La búsqueda es simple (includes), no usa regex.
 * Esto significa que "mala palabra" detectaría "malapalabra" también.
 * Para búsqueda más precisa, habría que usar word boundaries en regex.
 * ============================================================================
 */

module.exports = {
  name: 'bannedWords',
  check(message, config) {
    if (!config.enabled) return null;

    const allowedChannels = config.allowedChannels || [];
    if (allowedChannels.includes(message.channel.id)) return null;

    const words = config.words || [];
    if (words.length === 0) return null;

    // Convertir a minúsculas para comparación case-insensitive
    const content = message.content.toLowerCase();

    // Buscar alguna palabra prohibida en el contenido
    const found = words.find(w => content.includes(w.toLowerCase()));

    if (found) {
      return { reason: `Palabra prohibida: "${found}"`, action: config.action || 'delete' };
    }

    return null;
  },
};
