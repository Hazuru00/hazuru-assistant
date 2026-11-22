/**
 * ============================================================================
 * UTILIDAD: replaceVars - Motor de Variables de Mensaje
 * ============================================================================
 *
 * Reemplaza variables como {user}, {server}, {memberCount} etc. en strings.
 * Se usa en bienvenidas, despedidas, boosts, bans, kicks y previews.
 *
 * VARIABLES DISPONIBLES (para miembros):
 *   {user}           → Mención al usuario (<@123>)
 *   {user.name}      → Nombre de usuario
 *   {user.id}        → ID del usuario
 *   {user.avatar}    → URL del avatar
 *   {user.tag}       → Tag completo (Usuario#1234)
 *   {user.mention}   → Mención (<@123>)
 *   {user.createdAt} → "Hace X tiempo" de creación de cuenta
 *   {user.joinedAt}  → "Hace X tiempo" de unión al servidor
 *   {server}         → Nombre del servidor
 *   {server.id}      → ID del servidor
 *   {server.icon}    → URL del icono del servidor
 *   {memberCount}    → Cantidad de miembros
 *   {boost}          → Cantidad de boosts activos
 *   {date}           → Fecha actual (DD/MM/YYYY)
 *   {time}           → Hora actual (HH:MM)
 *
 * VARIABLES DISPONIBLES (para bans):
 *   {moderator}      → Mención del moderador que baneó
 *   {reason}         → Razón del ban
 *
 * También expone `obtenerVarsBase`, `obtenerVarsFechaHora` y `sustituirVars`
 * para que el motor de plantillas reutilice exactamente las mismas variables.
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

/**
 * Reemplaza todas las variables en un string con sus valores reales.
 * Mantiene el orden original: primero las variables de la fuente y después
 * date/time, para que un objeto plano pueda aportar sus propios valores.
 */
const replaceVars = (str, source) => {
  if (!str) return '';
  const { date, time } = obtenerVarsFechaHora();
  return sustituirVars(str, obtenerVarsBase(source))
    .replace(/\{date\}/g, () => date)
    .replace(/\{time\}/g, () => time);
};

module.exports = { replaceVars, obtenerVarsBase, obtenerVarsFechaHora, sustituirVars };
