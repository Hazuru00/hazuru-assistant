/**
 * ============================================================================
 * EVENTO: guildMemberAdd (Bienvenida + Auto-Role)
 * ============================================================================
 * Se ejecuta CADA VEZ que un miembro nuevo entra a un servidor.
 *
 * Este evento maneja tres cosas:
 *   1. AUTO-ROLE: Asignar un rol automáticamente al nuevo miembro
 *   2. BIENVENIDA PÚBLICA: Enviar un mensaje/tarjeta en el canal de bienvenida
 *   3. BIENVENIDA PRIVADA: Enviar un DM al nuevo miembro
 *
 * FLUJO DE BIENVENIDA:
 *   1. Si la card está habilitada → generar imagen y enviarla
 *   2. Si no hay card o falla → enviar embed o texto plano
 *   3. Las variables como {user}, {server}, {memberCount} se reemplazan automáticamente
 * ============================================================================
 */

const { getGuild, updateGuild } = require('../database');
const { generateCard, generateAnimatedCard } = require('../utils/cardGenerator');
const { replaceVars } = require('../utils/replaceVars');
const { buildEmbed } = require('../utils/buildEmbed');
const { logError, logInfo } = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const config = getGuild(member.guild.id);

    // ========================================================================
    // 1. AUTO-ROLE: Roles inteligentes
    // ========================================================================
    const autoRole = config.autoRole || {};
    const rolesToAdd = [];

    // Rol básico para todos
    if (autoRole.enabled && autoRole.roleId) {
      const role = member.guild.roles.cache.get(autoRole.roleId);
      if (role) rolesToAdd.push(role);
    }

    // Rol para bots
    if (autoRole.botRole?.enabled && autoRole.botRole.roleId && member.user.bot) {
      const role = member.guild.roles.cache.get(autoRole.botRole.roleId);
      if (role) rolesToAdd.push(role);
    }

    // Rol para boosters
    if (autoRole.boostRole?.enabled && autoRole.boostRole.roleId && member.premiumSince) {
      const role = member.guild.roles.cache.get(autoRole.boostRole.roleId);
      if (role) rolesToAdd.push(role);
    }

    // Asignar roles
    if (rolesToAdd.length > 0) {
      try {
        await member.roles.add(rolesToAdd);
      } catch (e) {
        logError(e, { event: 'guildMemberAdd', guild: member.guild, user: member.user, section: 'autoRole', action: 'Assign roles', config: { roleIds: rolesToAdd.map(r => r.id) } });
      }
    }

    // ========================================================================
    // 1b. MILESTONES: Roles para primeros N miembros
    // ========================================================================
    if (autoRole.milestones?.length > 0) {
      const memberCount = member.guild.memberCount;
      let updated = false;

      for (const milestone of autoRole.milestones) {
        if (milestone.completed) continue;
        if (!milestone.enabled || !milestone.roleId) continue;

        if (memberCount <= milestone.maxMembers) {
          // Asignar rol milestone
          const role = member.guild.roles.cache.get(milestone.roleId);
          if (role) {
            try {
              await member.roles.add(role);
              logInfo('Milestone role assigned', { guild: member.guild.name, user: member.user.tag, milestone: milestone.maxMembers, role: role.name });
            } catch (e) {
              logError(e, { event: 'guildMemberAdd', guild: member.guild, user: member.user, section: 'milestone', action: 'Assign milestone role', config: { roleId: milestone.roleId, maxMembers: milestone.maxMembers } });
            }
          }
        }

        // Si alcanzó la meta, marcar como completado y avisar
        if (memberCount >= milestone.maxMembers && !milestone.completed) {
          milestone.completed = true;
          updated = true;

          // Enviar announce
          if (milestone.announceChannel) {
            const channel = member.guild.channels.cache.get(milestone.announceChannel);
            if (channel) {
              try {
                const embedData = {
                  title: milestone.announceEmbed?.title || 'Meta alcanzada',
                  description: (milestone.announceMessage || `¡Meta de ${milestone.maxMembers} miembros alcanzada! Ya no se asignará el rol automáticamente.`)
                    .replace(/{memberCount}/g, String(memberCount))
                    .replace(/{role}/g, `<@&${milestone.roleId}>`),
                  color: milestone.announceEmbed?.color || '#5865F2',
                };
                const embed = buildEmbed(embedData, null);
                await channel.send({ embeds: [embed] });
              } catch (e) {
                logError(e, { event: 'guildMemberAdd', guild: member.guild, section: 'milestone', action: 'Send announce' });
              }
            }
          }

          logInfo('Milestone completed', { guild: member.guild.name, milestone: milestone.maxMembers, memberCount });
        }
      }

      if (updated) {
        updateGuild(member.guild.id, { autoRole });
      }
    }

    // ========================================================================
    // 2. BIENVENIDA PÚBLICA: Mensaje/tarjeta en el canal
    // ========================================================================
    if (config.welcome.enabled && config.welcome.channel) {
      const channel = member.guild.channels.cache.get(config.welcome.channel);
      if (channel) {
        // Reemplazar variables en el mensaje ({user}, {server}, etc.)
        const message = replaceVars(config.welcome.message, member);
        const card = config.welcome.card || {};
        let sentCard = false;

        // Intentar generar y enviar tarjeta de imagen
        if (card.enabled) {
          try {
            let buffer;
            if (card.animated) {
              buffer = await generateAnimatedCard(member, card, true); // true = welcome
            } else {
              buffer = await generateCard(member, card, true);
            }
            const ext = card.animated ? 'gif' : 'png';
            await channel.send({
              content: message || undefined,
              files: [{ attachment: buffer, name: `welcome.${ext}` }],
            });
            sentCard = true;
          } catch (e) {
            logError(e, { event: 'guildMemberAdd', guild: member.guild, user: member.user, section: 'welcome-card', action: 'Generate card', config: card });
          }
        }

        // Si no se envió card (no estaba habilitada o falló), enviar embed o texto
        if (!sentCard) {
          try {
            if (config.welcome.embedEnabled) {
              const embedData = { ...config.welcome.embed };
              // Si el embed no tiene descripción, usar el mensaje como descripción
              if (!embedData.description && message) embedData.description = message;
              embedData.thumbnail = embedData.thumbnail || member.user.displayAvatarURL({ dynamic: true });
              const embed = buildEmbed(embedData, member);
              await channel.send({ content: message && embedData.description !== message ? message : undefined, embeds: [embed] });
            } else {
              await channel.send({ content: message });
            }
          } catch (e) {
            logError(e, { event: 'guildMemberAdd', guild: member.guild, user: member.user, section: 'welcome', action: 'Send message', config: config.welcome });
          }
        }

        logInfo('Welcome sent', { guild: member.guild.name, user: member.user.tag, channel: channel.name, card: card.enabled });
      } else {
        logError(new Error('Canal de bienvenida no encontrado'), { event: 'guildMemberAdd', guild: member.guild, section: 'welcome', config: { channelId: config.welcome.channel } });
      }
    }

    // ========================================================================
    // 3. BIENVENIDA PRIVADA: DM al nuevo miembro
    // ========================================================================
    if (config.privateWelcome.enabled && config.privateWelcome.message) {
      const message = replaceVars(config.privateWelcome.message, member);
      try {
        if (config.privateWelcome.embedEnabled) {
          const embedData = { ...config.privateWelcome.embed };
          if (!embedData.description && message) embedData.description = message;
          const embed = buildEmbed(embedData, member);
          await member.send({ content: message && embedData.description !== message ? message : undefined, embeds: [embed] });
        } else {
          await member.send({ content: message });
        }
      } catch (e) {
        // Si falla el DM (el usuario los tiene deshabilitados), solo loggear
        logError(e, { event: 'guildMemberAdd', guild: member.guild, user: member.user, section: 'privateWelcome', action: 'Send DM' });
      }
    }
  },
};
