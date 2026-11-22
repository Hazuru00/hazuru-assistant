/**
 * ============================================================================
 * UTILIDAD: commandInfo - Información derivada de los comandos registrados
 * ============================================================================
 *
 * source de verdad de la sintaxis y las secciones de los comandos. La usan
 * /help y el endpoint /api/commands del dashboard para que ambos muestren
 * exactamente lo mismo y se actualicen solos al añadir comandos.
 *
 * NO envía nada ni modifica archivos: solo lee definiciones de discord.js.
 * ============================================================================
 */

// Secciones visuales. Solo agrupa nombres: la sintaxis y descripciones salen
// de los comandos reales. Un comando nuevo cae en "Otros" automáticamente.
const SECCIONES = [
  { titulo: '📊 Información', comandos: ['server', 'serverinfo', 'userinfo', 'avatar', 'botinfo'] },
  { titulo: '🎲 Diversión', comandos: ['8ball'] },
  { titulo: '⚙️ Utilidad', comandos: ['help', 'poll', 'poll-close', 'remind', 'remind-list', 'announce', 'announce-preview', 'nick', 'config', 'say', 'preview', 'dm-template', 'reaction-role'] },
  {
    titulo: '📈 Niveles',
    comandos: ['rank', 'leaderboard', 'profile', 'achievements', 'racha', 'title', 'setlevel', 'setxp', 'resetlevels'],
  },
  {
    titulo: '🔨 Moderación',
    comandos: ['ban', 'kick', 'warn', 'warnings', 'unwarn', 'timeout', 'untimeout', 'purge', 'slowmode', 'modlog'],
  },
  { titulo: '🔐 Dueño del bot', comandos: ['owner'] },
];

const TITULO_OTROS = '🔧 Otros';

/**
 * Devuelve el título de sección que corresponde a un comando.
 * @param {string} nombre - Nombre del comando
 * @returns {string} Título de la sección, o "Otros" si no está clasificado
 */
const seccionDe = (nombre) => SECCIONES.find(s => s.comandos.includes(nombre))?.titulo || TITULO_OTROS;

/**
 * Recorre un comando y devuelve una variante por cada subcomando que tenga.
 * @param {Object} nodo - Definición del comando, grupo o subcomando
 * @param {string[]} prefijo - Nombres acumulados en niveles superiores
 * @returns {Array<{nombres: string[], args: string[], desc: string}>} Variantes
 */
const obtenerVariantes = (nodo, prefijo = []) => {
  const nombres = [...prefijo, nodo.name];
  const opciones = nodo.options || [];
  const subcomandos = opciones.filter(op => op.type === 1 || op.type === 2);

  if (!subcomandos.length) {
    return [{
      nombres,
      args: opciones.map(op => (op.required ? `<${op.name}>` : `[${op.name}]`)),
      desc: nodo.description || '',
    }];
  }

  return subcomandos.flatMap(sub => obtenerVariantes(sub, nombres));
};

/**
 * Convierte las variantes en texto con la sintaxis exacta.
 * @param {Object} json - Definición del comando (command.data.toJSON())
 * @returns {Array<{sintaxis: string, descripcion: string}>} Variantes formateadas
 */
const variantesDe = (json) => obtenerVariantes(json).map(({ nombres, args, desc }) => ({
  sintaxis: `/${nombres.join(' ')}${args.length ? ` ${args.join(' ')}` : ''}`,
  descripcion: desc,
}));

/**
 * Genera el resumen de un comando para /help o para el dashboard.
 * @param {Object} json - Definición del comando
 * @returns {{nombre: string, seccion: string, lineas: string[]}} Resumen
 */
const resumenDe = (json) => ({
  nombre: json.name,
  seccion: seccionDe(json.name),
  lineas: variantesDe(json).map(v => `\`${v.sintaxis}\` — ${v.descripcion}`),
});

module.exports = { SECCIONES, TITULO_OTROS, seccionDe, obtenerVariantes, variantesDe, resumenDe };
