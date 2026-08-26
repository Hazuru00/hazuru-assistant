/**
 * ============================================================================
 * FILTRO: antiCaps - Anti-Mayúsculas Excesivas
 * ============================================================================
 *
 * Detecta mensajes con demasiadas letras mayúsculas.
 * Útil para prevenir "gritos" en el chat.
 *
 * CONFIGURACIÓN:
 *   - enabled: Si el filtro está activo
 *   - minLetters: Mínimo de letras para activar la detección (default: 10)
 *   - maxPercentage: Porcentaje máximo de mayúsculas permitido (default: 70%)
 *   - action: Qué hacer ('delete', 'mute', 'kick')
 *
 * CÓMO FUNCIONA:
 *   1. Elimina todos los caracteres que no son letras
 *   2. Si hay menos de minLetters letras, ignorar
 *   3. Cuenta las mayúsculas
 *   4. Si el porcentaje supera maxPercentage → detecta
 *
 * EJEMPLO:
 *   - "HOLA COMO ESTAS" → 16/16 = 100% mayúsculas → DETECTADO
 *   - "Hola como estas" → 0/16 = 0% mayúsculas → OK
 *   - "HOLA que tal" → 4/7 = 57% mayúsculas → OK (si maxPercentage es 70)
 * ============================================================================
 */

module.exports = {
  name: 'antiCaps',
  check(message, config) {
    if (!config.enabled) return null;

    const allowedChannels = config.allowedChannels || [];
    if (allowedChannels.includes(message.channel.id)) return null;

    const { minLetters = 10, maxPercentage = 70 } = config;

    // Eliminar todos los caracteres que no son letras
    const text = message.content.replace(/[^a-zA-Z]/g, '');

    // Si el mensaje tiene pocas letras, ignorar
    if (text.length < minLetters) return null;

    // Contar solo las mayúsculas
    const caps = text.replace(/[^A-Z]/g, '').length;

    // Calcular porcentaje
    const percentage = (caps / text.length) * 100;

    // Si supera el máximo → detectar
    if (percentage > maxPercentage) {
      return { reason: 'Demasiadas mayusculas', action: config.action || 'delete' };
    }

    return null;
  },
};
