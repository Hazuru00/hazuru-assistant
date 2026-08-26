/**
 * ============================================================================
 * FILTRO: antiLinks - Anti-Links
 * ============================================================================
 *
 * Detecta mensajes que contienen URLs no permitidas.
 * Tiene una whitelist de dominios permitidos (YouTube, Twitch, etc.).
 *
 * CONFIGURACIÓN:
 *   - enabled: Si el filtro está activo
 *   - whitelist: Array de dominios permitidos
 *   - allowedChannels: Canales donde se permiten links (no se filtra)
 *   - action: Qué hacer ('delete', 'mute', 'kick')
 *
 * CÓMO FUNCIONA:
 *   1. Busca URLs en el mensaje con regex
 *   2. Para cada URL, extrae el dominio (hostname)
 *   3. Compara con la whitelist
 *   4. Si hay algún dominio no whitelisteado → detecta link no permitido
 *
 * NOTA: La whitelist por defecto incluye: discord.com, youtube.com, twitch.tv, etc.
 * ============================================================================
 */

// Regex para detectar URLs (http://, https://, www.)
const LINK_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

module.exports = {
  name: 'antiLinks',
  check(message, config) {
    if (!config.enabled) return null;

    const allowedChannels = config.allowedChannels || [];
    if (allowedChannels.includes(message.channel.id)) return null;

    if (LINK_REGEX.test(message.content)) {
      LINK_REGEX.lastIndex = 0;
      const whitelist = config.whitelistedDomains || ['youtube.com', 'youtu.be', 'twitch.tv', 'discord.gg'];

      // Extraer todas las URLs del mensaje
      const urls = message.content.match(LINK_REGEX) || [];

      // Verificar si alguna URL tiene un dominio NO permitido
      const hasNonWhitelisted = urls.some(url => {
        try {
          const host = new URL(url).hostname.replace('www.', '');
          return !whitelist.some(d => host.includes(d));
        } catch { return true; } // Si no se puede parsear, considerar como no permitido
      });

      if (hasNonWhitelisted) {
        return { reason: 'Links no permitidos', action: config.action || 'delete' };
      }
    }

    return null;
  },
};
