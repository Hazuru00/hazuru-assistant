/**
 * ============================================================================
 * UTILIDAD: replaceVars - Motor de Variables de Mensaje
 * ============================================================================
 *
 * Reemplaza variables como {user}, {server}, {memberCount} etc. en strings.
 * Se usa en bienvenidas, despedidas, boosts, bans, kicks, y previews.
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
 * TIP: Para agregar una nueva variable, agregarla al objeto `vars` dentro
 * de la sección correspondiente (member, ban, o genérica).
 * ============================================================================
 */

/**
 * Reemplaza todas las variables en un string con sus valores reales.
 *
 * @param {string} str - El string con variables (ej: "Bienvenido {user}!")
 * @param {Object} source - Fuente de datos (miembro, ban info, o objeto plano)
 * @returns {string} String con todas las variables reemplazadas
 */
const replaceVars = (str, source) => {
  if (!str) return '';

  // Fecha y hora actual para las variables {date} y {time}
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let vars = {};

  // --- CASO 1: Miembro de Discord (tiene guild y user) ---
  // Se usa en: bienvenida, despedida, boost
  if (source && source.guild && source.user) {
    const member = source;
    vars = {
      user: `<@${member.id}>`,
      'user.name': member.user.username,
      'user.id': member.id,
      'user.avatar': member.user.displayAvatarURL({ dynamic: true, size: 256 }),
      'user.tag': member.user.tag,
      'user.mention': `<@${member.id}>`,
      // <t:TIMESTAMP:R> formatea como "hace X tiempo" en Discord
      'user.createdAt': `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
      'user.joinedAt': member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Desconocido',
      server: member.guild.name,
      'server.id': member.guild.id,
      'server.icon': member.guild.iconURL({ dynamic: true }) || '',
      memberCount: String(member.guild.memberCount),
      boost: String(member.guild.premiumSubscriptionCount || 0),
    };

  // --- CASO 2: Info de ban (tiene user, guild, executor, reason) ---
  // Se usa en: mensaje de ban
  } else if (source && source.user && source.guild && source.executor) {
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

  // --- CASO 3: Objeto plano (key-value personalizado) ---
  // Se usa en: previews del panel web, API
  } else if (source) {
    vars = source;
  }

  // Reemplazar todas las variables en el string
  let result = str;
  for (const [key, value] of Object.entries(vars)) {
    // Usar regex para reemplazar todas las ocurrencias
    // El punto en claves como "user.name" se escapa con \\
    result = result.replace(new RegExp(`\\{${key.replace('.', '\\.')}}`, 'g'), String(value));
  }

  // Reemplazar variables de fecha y hora (disponibles siempre)
  result = result.replace(/\{date\}/g, dateStr);
  result = result.replace(/\{time\}/g, timeStr);

  return result;
};

module.exports = { replaceVars };
