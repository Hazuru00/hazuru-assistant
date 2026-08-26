/**
 * ============================================================================
 * EVENTO: guildBanAdd (Notificación de Ban)
 * ============================================================================
 * Se ejecuta CADA VEZ que un miembro es baneado de un servidor.
 *
 * Si el logging de bans está habilitado, envía un embed al canal configurado
 * con información del baneo: quién fue, quién lo baneó, y la razón.
 * ============================================================================
 */

const { getGuild } = require('../database');
const { replaceVars } = require('../utils/replaceVars');
const { buildEmbed } = require('../utils/buildEmbed');
const { logError, logInfo } = require('../utils/logger');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    const config = getGuild(ban.guild.id);

    // Si la sección de ban no está habilitada, salir
    if (!config.ban.enabled || !config.ban.channel) return;

    // Obtener el canal configurado para bans
    const channel = ban.guild.channels.cache.get(config.ban.channel);
    if (!channel) {
      logError(new Error('Canal de ban no encontrado'), { event: 'guildBanAdd', guild: ban.guild, user: ban.user, section: 'ban', config: { channelId: config.ban.channel } });
      return;
    }

    // Preparar datos para replaceVars
    // banInfo tiene: user (baneado), guild, executor (quién baneó), reason (razón)
    const banInfo = { user: ban.user, guild: ban.guild, executor: ban.executor, reason: ban.reason };
    const message = replaceVars(config.ban.message, banInfo);

    try {
      if (config.ban.embedEnabled) {
        const embedData = { ...config.ban.embed };
        if (!embedData.description && message) embedData.description = message;
        const embed = buildEmbed(embedData, banInfo);
        await channel.send({ content: message && embedData.description !== message ? message : undefined, embeds: [embed] });
      } else {
        await channel.send({ content: message });
      }
      logInfo('Ban message sent', { guild: ban.guild.name, user: ban.user.tag, channel: channel.name, reason: ban.reason });
    } catch (e) {
      logError(e, { event: 'guildBanAdd', guild: ban.guild, user: ban.user, section: 'ban', action: 'Send ban message', config: config.ban });
    }
  },
};
