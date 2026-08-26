/**
 * ============================================================================
 * UTILIDAD: parseDuration - Parseador de Duraciones
 * ============================================================================
 *
 * Convierte strings de duración como "10m", "2h", "1d" en milisegundos.
 * También puede formatear milisegundos a texto legible.
 *
 * FORMATOS SOPORTADOS:
 *   - 10s  → 10,000 ms (segundos)
 *   - 30m  → 1,800,000 ms (minutos)
 *   - 2h   → 7,200,000 ms (horas)
 *   - 1d   → 86,400,000 ms (días)
 *   - 1w   → 604,800,000 ms (semanas)
 *
 * LÍMITE: 28 días (requerimiento de Discord para timeouts)
 *
 * USO:
 *   const ms = parseDuration('2h'); // 7200000
 *   const text = formatDuration(7200000); // "2h 0m 0s"
 * ============================================================================
 */

/**
 * Parsea un string de duración a milisegundos.
 *
 * @param {string} str - String de duración (ej: "10m", "2h", "1d")
 * @returns {number|null} Milisegundos, o null si el formato es inválido
 */
const parseDuration = (str) => {
  if (!str) return null;

  // Regex: captura número + unidad (s/m/h/d/w)
  const match = str.trim().match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  // Multiplicadores para convertir a milisegundos
  const multipliers = {
    s: 1000,                    // segundos
    m: 60 * 1000,              // minutos
    h: 60 * 60 * 1000,         // horas
    d: 24 * 60 * 60 * 1000,    // días
    w: 7 * 24 * 60 * 60 * 1000, // semanas
  };

  const ms = value * multipliers[unit];

  // Discord limita timeouts a 28 días
  if (ms > 28 * 24 * 60 * 60 * 1000) return null;

  return ms;
};

/**
 * Convierte milisegundos a un string legible.
 *
 * @param {number} ms - Milisegundos
 * @returns {string} String formateado (ej: "2h 30m 15s")
 */
const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000) % 24;
  const days = Math.floor(ms / 86400000);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join(' ') || '0s';
};

module.exports = { parseDuration, formatDuration };
