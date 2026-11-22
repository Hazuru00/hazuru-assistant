/**
 * ============================================================================
 * EVENTO: guildMemberUpdate (Boost + Logging de Roles)
 * ============================================================================
 * Se ejecuta CADA VEZ que un miembro es actualizado en un servidor.
 *
 * Este evento detecta dos cosas:
 *   1. NUEVO BOOST: Si el miembro empezó a boostear el servidor
 *   2. CAMBIO DE ROLES: Si se le agregaron o quitaron roles
 *
 * ============================================================================
 */

const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('../database');
const { replaceVars } = require('../utils/replaceVars');
const { buildEmbed } = require('../utils/buildEmbed');
const { logError, logInfo } = require('../utils/logger');
const { getLogChannel } = require('../utils/getLogChannel');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const guildId = newMember.guild.id;

    // ========================================================================
    // 1. DETECTAR NUEVO BOOST
    // ========================================================================
    // premiumSince es null si no está boosteando, y tiene fecha si empezó
    if (!oldMember.premiumSince && newMember.premiumSince) {
      const config = getGuild(guildId);

      // Asignar boostRole si está configurado
      const autoRole = config.autoRole || {};
      if (autoRole.boostRole?.enabled && autoRole.boostRole.roleId) {
        try {
          const role = newMember.guild.roles.cache.get(autoRole.boostRole.roleId);
          if (role) await newMember.roles.add(role);
        } catch (e) {
          logError(e, { event: 'guildMemberUpdate', guild: newMember.guild, user: newMember.user, section: 'boostRole', action: 'Assign boost role' });
        }
      }

      if (config.boost.enabled && config.boost.channel) {
        const channel = newMember.guild.channels.cache.get(config.boost.channel);
        if (channel) {
          const message = replaceVars(config.boost.message, newMember);
          try {
            if (config.boost.embedEnabled) {
              const embedData = { ...config.boost.embed };
              if (!embedData.description && message) embedData.description = message;
              embedData.thumbnail = embedData.thumbnail || newMember.user.displayAvatarURL({ dynamic: true });
              const embed = buildEmbed(embedData, newMember);
              await channel.send({ content: message && embedData.description !== message ? message : undefined, embeds: [embed] });
            } else {
              await channel.send({ content: message });
            }
            logInfo('Boost message sent', { guild: newMember.guild.name, user: newMember.user.tag, channel: channel.name });
          } catch (e) {
            logError(e, { event: 'guildMemberUpdate', guild: newMember.guild, user: newMember.user, section: 'boost', action: 'Send boost message' });
          }
        } else {
          logError(new Error('Canal de boost no encontrado'), { event: 'guildMemberUpdate', guild: newMember.guild, section: 'boost', config: { channelId: config.boost.channel } });
        }
      }
    }

    // ========================================================================
    // 2. LOGGING DE CAMBIOS DE ROLES
    // ========================================================================
    const logConfig = getGuild(guildId);
    const logging = logConfig.logging;

    if (logging?.roleUpdate) {
      const oldRoles = [...oldMember.roles.cache.keys()];
      const newRoles = [...newMember.roles.cache.keys()];
      const added = newRoles.filter(r => !oldRoles.includes(r));
      const removed = oldRoles.filter(r => !newRoles.includes(r));

      if (added.length > 0 || removed.length > 0) {
        const ch = getLogChannel(newMember.guild, logging);
        if (ch) {
          const embed = new EmbedBuilder()
            .setTitle('🏷️ Roles Actualizados')
            .setColor(0x5865F2)
            .addFields({ name: 'Usuario', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true })
            .setTimestamp();

          if (added.length > 0) embed.addFields({ name: 'Agregados', value: added.map(r => `<@&${r}>`).join(', ') });
          if (removed.length > 0) embed.addFields({ name: 'Removidos', value: removed.map(r => `<@&${r}>`).join(', ') });

          ch.send({ embeds: [embed] }).catch(() => {});
        }
      }
    }
  },
};
