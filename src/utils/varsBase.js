/**
 * ============================================================================
 * UTILIDAD: varsBase - Variables del sistema compartidas
 * ============================================================================
 *
 * Contiene los helpers que antes vivían en replaceVars.js. Están en su propio
 * archivo para que replaceVars pueda llamar al motor de plantillas sin crear
 * un ciclo de require (replaceVars → templateEngine → varsBase).
 * ============================================================================
 */

/** Escapa los caracteres especiales de una clave para usarla en una regex. */
const escaparRegex = (clave) => clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Sustituye variables conocidas en un string. Las que no existen se dejan
 * intactas. Se usa una función de reemplazo para que `$&` en un valor se
 * inserte literalmente y no sea interpretado por String.replace.
 */
const sustituirVars = (str, vars) => {
  let resultado = String(str || '');
  for (const [clave, valor] of Object.entries(vars)) {
    resultado = resultado.replace(
      new RegExp(`\\{${escaparRegex(clave)}\\}`, 'g'),
      () => String(valor),
    );
  }
  return resultado;
};

/** Fecha y hora actuales, calculadas una sola vez por resolución. */
const obtenerVarsFechaHora = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return {
    date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
};

/**
 * Construye las variables del sistema a partir de la fuente.
 * No incluye date/time: se aplican al final para conservar el comportamiento
 * original con objetos planos que traen su propia `{date}` o `{time}`.
 */
const obtenerVarsBase = (source) => {
  let vars = {};

  // Ban: tiene user, guild y executor. Debe evaluarse antes que miembro.
  if (source && source.guild && source.user && source.executor) {
    const ban = source;
    vars = {
      user: ban.user.tag,
      'user.name': ban.user.username,
      'user.id': ban.user.id,
      'user.avatar': ban.user.displayAvatarURL({ dynamic: true, size: 256 }),
      'user.tag': ban.user.tag,
      'user.mention': `<@${ban.user.id}>`,
      server: ban.guild.name,
      'server.id': ban.guild.id,
      memberCount: String(ban.guild.memberCount),
      moderator: ban.executor ? `<@${ban.executor.id}>` : 'Desconocido',
      reason: ban.reason || 'Sin razon',
    };

  // Miembro de Discord: bienvenida, despedida, boost.
  } else if (source && source.guild && source.user) {
    const member = source;
    vars = {
      user: `<@${member.id}>`,
      'user.name': member.user.username,
      'user.id': member.id,
      'user.avatar': member.user.displayAvatarURL({ dynamic: true, size: 256 }),
      'user.tag': member.user.tag,
      'user.mention': `<@${member.id}>`,
      'user.createdAt': `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
      'user.joinedAt': member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Desconocido',
      server: member.guild.name,
      'server.id': member.guild.id,
      'server.icon': member.guild.iconURL({ dynamic: true }) || '',
      memberCount: String(member.guild.memberCount),
      boost: String(member.guild.premiumSubscriptionCount || 0),
    };

  // Objeto plano: usado por previews y API. Se copia para no mutarlo.
  } else if (source) {
    vars = { ...source };
  }

  return vars;
};

/** Catálogo para la guía de sintaxis y el autocompletado del dashboard. */
const VARIABLES_SISTEMA_INFO = [
  { nombre: 'user', descripcion: 'Mención al usuario', categoria: 'Usuario' },
  { nombre: 'user.name', descripcion: 'Nombre de usuario', categoria: 'Usuario' },
  { nombre: 'user.id', descripcion: 'ID del usuario', categoria: 'Usuario' },
  { nombre: 'user.avatar', descripcion: 'URL del avatar', categoria: 'Usuario' },
  { nombre: 'user.tag', descripcion: 'Tag completo', categoria: 'Usuario' },
  { nombre: 'user.mention', descripcion: 'Mención al usuario', categoria: 'Usuario' },
  { nombre: 'user.createdAt', descripcion: 'Cuándo se creó la cuenta', categoria: 'Usuario' },
  { nombre: 'user.joinedAt', descripcion: 'Cuándo se unió al servidor', categoria: 'Usuario' },
  { nombre: 'server', descripcion: 'Nombre del servidor', categoria: 'Servidor' },
  { nombre: 'server.id', descripcion: 'ID del servidor', categoria: 'Servidor' },
  { nombre: 'server.icon', descripcion: 'URL del icono', categoria: 'Servidor' },
  { nombre: 'memberCount', descripcion: 'Cantidad de miembros', categoria: 'Servidor' },
  { nombre: 'boost', descripcion: 'Cantidad de boosts', categoria: 'Servidor' },
  { nombre: 'date', descripcion: 'Fecha actual (DD/MM/AAAA)', categoria: 'General' },
  { nombre: 'time', descripcion: 'Hora actual (HH:MM)', categoria: 'General' },
  { nombre: 'moderator', descripcion: 'Moderador (bans y kicks)', categoria: 'Moderación' },
  { nombre: 'reason', descripcion: 'Razón (bans y kicks)', categoria: 'Moderación' },
];

module.exports = {
  escaparRegex,
  sustituirVars,
  obtenerVarsFechaHora,
  obtenerVarsBase,
  VARIABLES_SISTEMA_INFO,
};
