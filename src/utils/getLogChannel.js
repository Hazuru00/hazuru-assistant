/**
 * Obtiene el canal de logs para un servidor.
 * Si se configuró un canal específico, lo usa.
 * Si no, busca automáticamente: #system -> primer canal de texto visible.
 */
function getLogChannel(guild, logging) {
  // Si hay un canal configurado, usarlo
  if (logging?.channel) {
    const ch = guild.channels.cache.get(logging.channel);
    if (ch) return ch;
  }

  // Buscar automáticamente: system channel, luego primer canal de texto
  if (guild.systemChannel) return guild.systemChannel;

  const textChannel = guild.channels.cache.find(
    c => c.type === 0 && c.viewable && c.permissionsFor(guild.members.me)?.has('SendMessages')
  );
  return textChannel || null;
}

module.exports = { getLogChannel };
