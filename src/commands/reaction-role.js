/**
 * ============================================================================
 * COMANDO: /reaction-role
 * ============================================================================
 * Gestiona los "roles por reacción" configurados en el dashboard sin tener que
 * abrir el panel web. Es el equivalente en Discord al botón "Enviar Mensaje".
 *
 * SUBCOMANDOS:
 *   - list: Muestra los grupos configurados y su estado
 *   - send: Envía un grupo a un canal (o al configurado) y guarda el messageId
 *           para que los eventos de reacción/select sepan qué mensaje vigilar
 *
 * PARÁMETROS de send:
 *   - grupo (requerido): Número del grupo (ver /reaction-role list)
 *   - canal (opcional): Canal destino (por defecto, el configurado)
 *
 * PERMISOS: Administradores del servidor
 * ============================================================================
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getGuild, updateGuild } = require('../database');
const { buildEmbed } = require('../utils/buildEmbed');
const { logInfo, logError } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reaction-role')
    .setDescription('Enviar y ver los roles por reacción configurados')
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Listar los grupos de roles por reacción'))
    .addSubcommand(sub => sub
      .setName('send')
      .setDescription('Enviar un grupo de roles por reacción a un canal')
      .addIntegerOption(opt => opt
        .setName('grupo')
        .setDescription('Número del grupo (ver /reaction-role list)')
        .setRequired(true)
        .setMinValue(1))
      .addChannelOption(opt => opt
        .setName('canal')
        .setDescription('Canal destino (por defecto, el configurado)')))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ Este comando solo funciona en un servidor.', ephemeral: true });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitás permiso de administrador.', ephemeral: true });
    }

    try {
      const config = getGuild(interaction.guildId);
      const grupos = config.autoRole?.reactionRoles || [];
      const subcomando = interaction.options.getSubcommand();

      if (!grupos.length) {
        return interaction.reply({
          content: '❌ No hay grupos configurados. Creá uno en el dashboard → Auto-Role → Reaction Roles.',
          ephemeral: true,
        });
      }

      // SUBCOMANDO list: resumen de todos los grupos configurados.
      if (subcomando === 'list') {
        const lineas = grupos.map((rr, i) => {
          const estado = rr.enabled ? '🟢' : '⚪';
          const destino = rr.channelId ? `<#${rr.channelId}>` : 'sin canal';
          const enviado = rr.messageId ? '· enviado ✅' : '· sin enviar';
          return `**${i + 1}.** ${estado} ${destino} · ${rr.mode === 'select' ? 'menú' : 'emojis'} · ${rr.roles?.length || 0} rol(es) ${enviado}`;
        });
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setTitle('🎭 Roles por reacción')
          .setDescription(lineas.join('\n'))
          .setColor(0x5865F2)
          .setFooter({ text: `${grupos.length} grupo(s) configurado(s)` });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // SUBCOMANDO send: resolver el grupo elegido (el comando usa índice 1-based).
      const numero = interaction.options.getInteger('grupo');
      const rr = grupos[numero - 1];
      if (!rr) {
        return interaction.reply({
          content: `❌ No existe el grupo ${numero}. Usá \`/reaction-role list\` para ver los disponibles.`,
          ephemeral: true,
        });
      }
      if (!rr.roles?.length) {
        return interaction.reply({ content: '❌ Ese grupo no tiene roles asignados.', ephemeral: true });
      }

      const canal = interaction.options.getChannel('canal')
        || interaction.guild.channels.cache.get(rr.channelId);
      if (!canal?.send) {
        return interaction.reply({
          content: '❌ No encontré el canal. Configurá uno en el dashboard o pasá la opción `canal`.',
          ephemeral: true,
        });
      }

      // Mismo embed y mismos componentes que usa el dashboard.
      const embed = buildEmbed(rr.embed, null);
      let mensaje;
      if (rr.mode === 'select') {
        const opciones = rr.roles.map(r => ({
          label: r.label || 'Rol',
          value: r.roleId,
          emoji: r.emoji || undefined,
        }));
        const select = new StringSelectMenuBuilder()
          .setCustomId('reaction_role_select')
          .setPlaceholder('Elige tu rol')
          .addOptions(opciones);
        const fila = new ActionRowBuilder().addComponents(select);
        mensaje = await canal.send({ embeds: embed ? [embed] : [], components: [fila] });
      } else {
        mensaje = await canal.send({ embeds: embed ? [embed] : [] });
        // Si el bot no puede reaccionar, el mensaje igual quedó enviado.
        for (const rol of rr.roles) {
          if (rol.emoji) await mensaje.react(rol.emoji).catch(() => {});
        }
      }

      // Guardar el messageId para que messageReactionAdd / interactionCreate
      // reconozcan el mensaje, igual que hace el dashboard con saveAutoRole().
      rr.messageId = mensaje.id;
      updateGuild(interaction.guildId, { autoRole: config.autoRole });

      logInfo('Reaction role enviado con /reaction-role', {
        guild: interaction.guild,
        user: interaction.user,
        action: 'reaction-role send',
      });
      return interaction.reply({
        content: `✅ Grupo ${numero} enviado en ${canal}.`,
        ephemeral: true,
      });
    } catch (e) {
      logError(e, {
        event: 'reaction-role',
        user: interaction.user,
        guild: interaction.guild,
        action: 'Send reaction role',
      });
      return interaction.reply({ content: `❌ No se pudo completar: ${e.message}`, ephemeral: true }).catch(() => {});
    }
  },
};
