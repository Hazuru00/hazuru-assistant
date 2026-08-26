/**
 * ============================================================================
 * EVENTO: guildMemberRemove (Despedida + Detección de Kick)
 * ============================================================================
 * Se ejecuta CADA VEZ que un miembro sale de un servidor (sea kick, ban o leave).
 *
 * Este evento detecta si fue un KICK usando el audit log de Discord:
 *   - Si fue kick → enviar mensaje de kick con el moderador
 *   - Si fue leave normal → enviar mensaje de despedida
 *
 * FLUJO:
 *   1. Consultar audit log para ver si fue kick reciente (< 5 segundos)
 *   2. Si fue kick → enviar config.kick
 *   3. Si no → enviar config.farewell (con card si está habilitada)
 * ============================================================================
 */

const { getGuild } = require('../database');
const { generateCard, generateAnimatedCard } = require('../utils/cardGenerator');
const { replaceVars } = require('../utils/replaceVars');
const { buildEmbed } = require('../utils/buildEmbed');
const { logError, logInfo } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const config = getGuild(member.guild.id);

    // ========================================================================
    // DETECTAR SI FUE UN KICK
    // ========================================================================
    let isKick = false;
    let moderator = null;

    try {
      // type 21 = MEMBER_KICK en el audit log de Discord
      const auditLogs = await member.guild.fetchAuditLogs({ type: 21, limit: 1 });
      const kickLog = auditLogs.entries.first();

      // Verificar que:
      // 1. El kick fue al mismo miembro que salió
      // 2. Fue hace menos de 5 segundos (para evitar falsos positivos)
      if (kickLog && kickLog.target.id === member.id && Date.now() - kickLog.createdTimestamp < 5000) {
        isKick = true;
        moderator = kickLog.executor; // Quién hizo el kick
      }
    } catch (e) {
      logError(e, { event: 'guildMemberRemove', guild: member.guild, user: member.user, section: 'auditLog', action: 'Fetch audit log' });
    }

    // ========================================================================
    // ENVIAR MENSAJE SEGÚN EL TIPO DE SALIDA
    // ========================================================================

    if (isKick && config.kick.enabled && config.kick.channel) {
      // --- FUE UN KICK ---
      const channel = member.guild.channels.cache.get(config.kick.channel);
      if (channel) {
        // Reemplazar {moderator} manualmente ya que replaceVars no lo maneja
        const message = replaceVars(config.kick.message, member).replace(/\{moderator\}/g, moderator ? `<@${moderator.id}>` : 'Desconocido');
        try {
          if (config.kick.embedEnabled) {
            const embedData = { ...config.kick.embed };
            if (!embedData.description && message) embedData.description = message;
            embedData.thumbnail = embedData.thumbnail || member.user.displayAvatarURL({ dynamic: true });
            const embed = buildEmbed(embedData, member);
            await channel.send({ content: message && embedData.description !== message ? message : undefined, embeds: [embed] });
          } else {
            await channel.send({ content: message });
          }
        } catch (e) {
          logError(e, { event: 'guildMemberRemove', guild: member.guild, user: member.user, section: 'kick', action: 'Send kick message' });
        }
      }
    } else if (config.farewell.enabled && config.farewell.channel) {
      // --- FUE UNA DESPEDIDA NORMAL ---
      const channel = member.guild.channels.cache.get(config.farewell.channel);
      if (channel) {
        const message = replaceVars(config.farewell.message, member);
        const card = config.farewell.card || {};
        let sentCard = false;

        // Intentar generar tarjeta de despedida
        if (card.enabled) {
          try {
            let buffer;
            if (card.animated) {
              buffer = await generateAnimatedCard(member, card, false); // false = farewell
            } else {
              buffer = await generateCard(member, card, false);
            }
            const ext = card.animated ? 'gif' : 'png';
            await channel.send({
              content: message || undefined,
              files: [{ attachment: buffer, name: `farewell.${ext}` }],
            });
            sentCard = true;
          } catch (e) {
            logError(e, { event: 'guildMemberRemove', guild: member.guild, user: member.user, section: 'farewell-card', action: 'Generate card', config: card });
          }
        }

        // Si no se envió card, enviar embed o texto
        if (!sentCard) {
          try {
            if (config.farewell.embedEnabled) {
              const embedData = { ...config.farewell.embed };
              if (!embedData.description && message) embedData.description = message;
              embedData.thumbnail = embedData.thumbnail || member.user.displayAvatarURL({ dynamic: true });
              const embed = buildEmbed(embedData, member);
              await channel.send({ content: message && embedData.description !== message ? message : undefined, embeds: [embed] });
            } else {
              await channel.send({ content: message });
            }
          } catch (e) {
            logError(e, { event: 'guildMemberRemove', guild: member.guild, user: member.user, section: 'farewell', action: 'Send message', config: config.farewell });
          }
        }

        logInfo('Farewell sent', { guild: member.guild.name, user: member.user.tag, channel: channel.name, card: card.enabled });
      } else {
        logError(new Error('Canal de despedida no encontrado'), { event: 'guildMemberRemove', guild: member.guild, section: 'farewell', config: { channelId: config.farewell.channel } });
      }
    }
  },
};
