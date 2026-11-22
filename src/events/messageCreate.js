const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuild } = require('../database/index');
const { logEvent, logError, logInfo } = require('../utils/logger');
const {
  healthCheck, createSession, sendMessageAsync,
  streamSession, deleteSession, abortSession,
  respondPermission
} = require('../utils/opencode');
const { isOwner } = require('../utils/owner');

const MAX_DISCORD_MSG = 2000;
const sessions = new Map();
const activeControllers = new Map();
const pendingPermissions = new Map(); // sessionId -> [{id, message, details}]

function splitMessage(text, limit = MAX_DISCORD_MSG) {
  if (text.length <= limit) return [text];
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) { parts.push(remaining); break; }
    let bp = remaining.lastIndexOf('\n', limit);
    if (bp <= 0) bp = limit;
    parts.push(remaining.slice(0, bp));
    remaining = remaining.slice(bp).trimStart();
  }
  return parts;
}

const filters = [
  require('../utils/automod/antiSpam'),
  require('../utils/automod/antiLinks'),
  require('../utils/automod/antiCaps'),
  require('../utils/automod/bannedWords'),
];

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (message.system) return;
    const content = message.content.trim();

    if (!message.guild) return;

    const config = getGuild(message.guild.id);

    // --- AUTOMOD: Ejecutar PRIMERO, si borra/mutea el mensaje no se procesa XP :p ---
    let automodBlocked = false;
    const autoMod = config.autoMod;
    if (autoMod && autoMod.enabled) {
      for (const filter of filters) {
        try {
          const result = filter.check(message, autoMod[filter.name] || {});
          if (!result) continue;
          if (result.action === 'delete' || result.action === 'mute') try { await message.delete(); } catch {}
          if (result.action === 'mute') try { await message.member.timeout(autoMod.muteDuration || 300000, result.reason); } catch {}
          if (result.action === 'kick') try { await message.member.kick(result.reason); } catch {}
          logEvent('automod', { filter: filter.name, userId: message.author.id, reason: result.reason, action: result.action, channel: message.channel.id });
          automodBlocked = true;
          break;
        } catch (e) { logError(e, { event: 'messageCreate', filter: filter.name }); }
      }
    }

    // --- SISTEMA DE NIVELES: Solo si automod no bloqueó el mensaje ---
    if (!automodBlocked) {
      try {
        const levels = config.levels || {};
        if (levels.enabled) {
          if (!levels.ignoredChannels?.includes(message.channel.id)) {
            const { processMessage, assignLevelRoles } = require('../utils/leveling');
            const result = await processMessage(message.guild.id, message.author.id, config, message.channel.id);
            if (result) {
              if (result.leveledUp && levels.announceLevelUp) {
                const ch = levels.announcementChannel
                  ? message.guild.channels.cache.get(levels.announcementChannel)
                  : message.channel;
                if (ch) {
                  try {
                    const { buildEmbed } = require('../utils/buildEmbed');
                    const embedData = {
                      ...(levels.levelUpEmbed || {}),
                      description: (levels.levelUpEmbed?.description || '¡Felicidades {user}! Ahora eres nivel **{level}**')
                        .replace(/{user}/g, `<@${message.author.id}>`)
                        .replace(/{level}/g, String(result.newLevel))
                        .replace(/{icon}/g, result.icon?.icon || '⭐'),
                      color: levels.levelUpEmbed?.color || '#5865F2',
                    };
                    const embed = buildEmbed(embedData, null);
                    await ch.send({ embeds: [embed] });
                  } catch (e) { logError(e, { event: 'messageCreate', action: 'announceLevelUp' }); }
                }
              }
              if (result.newAchievements?.length && levels.announceAchievement) {
                const ch = levels.announcementChannel
                  ? message.guild.channels.cache.get(levels.announcementChannel)
                  : message.channel;
                if (ch) {
                  for (const ach of result.newAchievements) {
                    try {
                      await ch.send(`🏆 <@${message.author.id}> desbloqueó el logro: **${ach.icon} ${ach.name}** — ${ach.description}`);
                    } catch (e) { logError(e, { event: 'messageCreate', action: 'announceAchievement' }); }
                  }
                }
              }
              if (result.leveledUp && levels.levelRoles?.length) {
                try { await assignLevelRoles(message.member, result.newLevel, levels.levelRoles); } catch {}
              }
            }
          }
        }
      } catch (e) { logError(e, { event: 'messageCreate', action: 'leveling' }); }
    }

    // --- !ai commands ---
    if (!content.startsWith('!ai')) {
      return;
    }

    if (!isOwner(message.author.id)) {
      try { await message.reply('No tienes permiso.'); } catch {}
      return;
    }

    // --- Subcomandos ---
    if (content === '!ai help') {
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('OpenCode Commands').addFields(
        { name: '!ai <msg>', value: 'Preguntar algo', inline: true },
        { name: '!ai help', value: 'Ayuda', inline: true },
        { name: '!ai session', value: 'Ver sesion', inline: true },
        { name: '!ai clear', value: 'Nueva sesion', inline: true },
        { name: '!ai abort', value: 'Abortar', inline: true },
        { name: '!ai perm', value: 'Ver permisos pendientes', inline: true },
        { name: '!ai allow <n>', value: 'Aprobar permiso #n', inline: true },
        { name: '!ai deny <n>', value: 'Rechazar permiso #n', inline: true },
        { name: '!ai allow all', value: 'Aprobar todos', inline: true },
      ).setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (content === '!ai session') {
      const sid = sessions.get(message.author.id);
      return message.reply(sid ? `Sesion: \`${sid}\`` : 'No hay sesion activa.');
    }

    if (content === '!ai clear') {
      const sid = sessions.get(message.author.id);
      if (sid) { try { await deleteSession(sid); } catch {} sessions.delete(message.author.id); }
      return message.reply('Sesion limpiada.');
    }

    if (content === '!ai abort') {
      const sid = sessions.get(message.author.id);
      if (!sid) return message.reply('Nada procesando.');
      try { await abortSession(sid); } catch {}
      return message.reply('Abortado.');
    }

    // !ai perm - ver permisos pendientes
    if (content === '!ai perm') {
      const sid = sessions.get(message.author.id);
      if (!sid) return message.reply('No hay sesion activa.');
      const perms = pendingPermissions.get(sid);
      if (!perms || perms.length === 0) return message.reply('No hay permisos pendientes.');
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('Permisos Pendientes')
        .setDescription(perms.map((p, i) => `**${i + 1}.** ${p.details || p.id}`).join('\n\n'))
        .setFooter({ text: 'Usa !ai allow <num> o !ai deny <num>' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    // !ai allow all - aprobar todos
    if (content === '!ai allow all') {
      const sid = sessions.get(message.author.id);
      if (!sid) return message.reply('No hay sesion activa.');
      const perms = pendingPermissions.get(sid);
      if (!perms || perms.length === 0) return message.reply('No hay permisos pendientes.');
      for (const perm of perms) {
        try { await respondPermission(sid, perm.id, 'allow', true); } catch {}
      }
      perms.length = 0;
      return message.reply('Todos los permisos aprobados.');
    }

    // !ai allow <num> - aprobar permiso
    if (content.startsWith('!ai allow')) {
      const sid = sessions.get(message.author.id);
      if (!sid) return message.reply('No hay sesion activa.');
      const perms = pendingPermissions.get(sid);
      if (!perms || perms.length === 0) return message.reply('No hay permisos pendientes.');
      const idx = parseInt(content.split(' ')[1]) - 1;
      if (isNaN(idx) || idx < 0 || idx >= perms.length) return message.reply('Numero invalido.');
      const perm = perms[idx];
      try {
        await respondPermission(sid, perm.id, 'allow', true);
        perms.splice(idx, 1);
        return message.reply(`Permiso aprobado: ${perm.details || perm.id}`);
      } catch (e) {
        return message.reply(`Error: ${e.message}`);
      }
    }

    // !ai deny <num> - rechazar permiso
    if (content.startsWith('!ai deny')) {
      const sid = sessions.get(message.author.id);
      if (!sid) return message.reply('No hay sesion activa.');
      const perms = pendingPermissions.get(sid);
      if (!perms || perms.length === 0) return message.reply('No hay permisos pendientes.');
      const idx = parseInt(content.split(' ')[1]) - 1;
      if (isNaN(idx) || idx < 0 || idx >= perms.length) return message.reply('Numero invalido.');
      const perm = perms[idx];
      try {
        await respondPermission(sid, perm.id, 'deny', true);
        perms.splice(idx, 1);
        return message.reply(`Permiso rechazado: ${perm.details || perm.id}`);
      } catch (e) {
        return message.reply(`Error: ${e.message}`);
      }
    }

    // --- !ai <prompt> ---
    const prompt = content.slice(4).trim();
    if (!prompt) return message.reply('Escribe algo despues de `!ai`.');

    const processing = await message.reply('Pensando...');

    try {
      const healthy = await healthCheck();
      if (!healthy) return processing.edit('OpenCode no esta corriendo. Ejecuta `opencode serve --port 4096`.');

      let sessionId = sessions.get(message.author.id);
      if (!sessionId) {
        const session = await createSession(`Chat - ${message.author.username}`);
        sessionId = session.id;
        sessions.set(message.author.id, sessionId);
        logInfo('Session created', { userId: message.author.id, sessionId });
      }

      await sendMessageAsync(sessionId, prompt);

      // Estado del streaming - acumula todo
      const state = {
        parts: [],        // Array de partes completas [{type, text}]
        currentPartId: null,
        currentText: '',  // Texto de la parte actual (deltas)
        tools: [],
        lastEdit: 0,
      };

      const editCooldown = 2000;

      const throttledEdit = async (force = false) => {
        const now = Date.now();
        if (!force && now - state.lastEdit < editCooldown) return;
        state.lastEdit = now;

        try {
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(prompt.slice(0, 256));

          // Construir descripcion con todo el contenido acumulado
          const desc = [];
          for (const part of state.parts) {
            if (part.type === 'reasoning') {
              desc.push(`> ${part.text.slice(0, 1500)}`);
            } else if (part.type === 'text') {
              desc.push(part.text);
            }
          }
          // Agregar parte actual si esta en progreso
          if (state.currentText) {
            if (state.currentPartType === 'reasoning') {
              desc.push(`> ${state.currentText.slice(0, 1500)}`);
            } else {
              desc.push(state.currentText);
            }
          }

          embed.setDescription(desc.join('\n\n') || 'Procesando...');

          if (state.tools.length > 0) {
            embed.setFooter({ text: `Tools: ${state.tools.join(', ')}` });
          }

          await processing.edit({ content: null, embeds: [embed] });
        } catch {}
      };

      // Escuchar SSE
      // Abortar stream anterior si existe
      const prevController = activeControllers.get(message.author.id);
      if (prevController) {
        try { prevController.abort(); } catch {}
        activeControllers.delete(message.author.id);
      }

      const controller = new AbortController();
      activeControllers.set(message.author.id, controller);

      const streamPromise = streamSession(sessionId, (evt) => {
        const props = evt.properties || {};
        const type = evt.type;

        // Delta de texto (streaming)
        if (type === 'message.part.delta' && props.field === 'text') {
          const partId = props.partID || '';
          const delta = props.delta || '';

          if (partId !== state.currentPartId) {
            // Nueva parte - guardar la anterior
            if (state.currentPartId && state.currentText) {
              state.parts.push({
                type: state.currentPartType || 'text',
                text: state.currentText,
              });
            }
            state.currentPartId = partId;
            state.currentText = '';
            state.currentPartType = 'text'; // default, se actualiza abajo
          }

          state.currentText += delta;
          throttledEdit();
        }

        // Parte actualizada (completa)
        if (type === 'message.part.updated') {
          const part = props.part;
          if (!part) return;

          if (part.type === 'reasoning') {
            // Si hay parte guardada, no duplicar
            if (state.currentPartId === part.id && state.currentText === part.text) {
              // Ya tenemos este contenido
            } else {
              // Guardar como completada
              if (state.currentPartId && state.currentText) {
                state.parts.push({ type: 'reasoning', text: state.currentText });
              }
              state.currentPartId = part.id;
              state.currentText = part.text || '';
              state.currentPartType = 'reasoning';
            }
            throttledEdit();
          }

          if (part.type === 'text') {
            if (state.currentPartId === part.id && state.currentText === part.text) {
              // Ya tenemos este contenido
            } else {
              if (state.currentPartId && state.currentText) {
                state.parts.push({ type: 'text', text: state.currentText });
              }
              state.currentPartId = part.id;
              state.currentText = part.text || '';
              state.currentPartType = 'text';
            }
            throttledEdit();
          }

          if (part.type === 'tool-invocation') {
            const toolName = part.toolInvocation?.toolName || 'tool';
            if (!state.tools.includes(toolName)) state.tools.push(toolName);
            throttledEdit();
          }

          if (part.type === 'step-finish') {
            // Guardar parte actual y resetear
            if (state.currentPartId && state.currentText) {
              state.parts.push({
                type: state.currentPartType || 'text',
                text: state.currentText,
              });
            }
            state.currentPartId = null;
            state.currentText = '';
            throttledEdit();
          }
        }

        // Session idle = termino
        if (type === 'session.idle' || type === 'session.status') {
          if (props.status?.type === 'idle') {
            // Guardar ultima parte
            if (state.currentPartId && state.currentText) {
              state.parts.push({
                type: state.currentPartType || 'text',
                text: state.currentText,
              });
            }
            state.currentPartId = null;
            state.currentText = '';
          }
        }

        // Permission request
        if (type === 'permission.request' || type === 'session.permission') {
          const permId = props.permissionID || props.id;
          const details = props.message || props.description || JSON.stringify(props);
          if (permId) {
            if (!pendingPermissions.has(sessionId)) pendingPermissions.set(sessionId, []);
            pendingPermissions.get(sessionId).push({ id: permId, details });
            // Notificar al usuario
            message.channel.send({
              embeds: [new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('Permiso Requerido')
                .setDescription(details.slice(0, 4096))
                .setFooter({ text: `Usa !ai allow 1 o !ai deny 1` })
                .setTimestamp()]
            }).catch(() => {});
          }
        }
      }, controller.signal);

      // Timeout de seguridad
      const timeout = setTimeout(() => controller.abort(), 300000);

      await streamPromise;
      clearTimeout(timeout);
      activeControllers.delete(message.author.id);

      // Edit final
      await throttledEdit(true);

      logInfo('Response sent', { userId: message.author.id });
    } catch (error) {
      logError(error, { event: 'aiCommand', user: message.author.id });
      await processing.edit(`Error: ${error.message}`).catch(() => {});
    }
  },
};
