/**
 * ============================================================================
 * COMANDO: /modlog
 * ============================================================================
 * Muestra el historial de advertencias del servidor (el "modlog" disponible),
 * ordenado de más reciente a más antiguo.
 *
 * Los demás eventos de moderación (bans, kicks, borrados) se envían a los
 * canales de logging configurados en el dashboard, pero no se guardan en una
 * base consultable. Este comando consulta warnings.json.
 *
 * PARÁMETROS:
 *   - usuario (opcional): Filtrar por un usuario concreto
 *   - limite (opcional): Cantidad de entradas (5-25, por defecto 10)
 *
 * PERMISOS: Gestionar mensajes
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getAllGuildWarnings, getWarnings } = require('../database/warnings');
const { logError } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Ver el historial de advertencias del servidor')
    .addUserOption(opt => opt
      .setName('usuario')
      .setDescription('Filtrar por usuario'))
    .addIntegerOption(opt => opt
      .setName('limite')
      .setDescription('Cantidad de entradas (5-25)')
      .setMinValue(5)
      .setMaxValue(25))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ Este comando solo funciona en un servidor.', ephemeral: true });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: '❌ Necesitás permiso de gestionar mensajes.', ephemeral: true });
    }

    const usuario = interaction.options.getUser('usuario');
    const limite = interaction.options.getInteger('limite') || 10;

    try {
      const porUsuario = usuario
        ? { [usuario.id]: getWarnings(interaction.guildId, usuario.id) }
        : getAllGuildWarnings(interaction.guildId);

      const entradas = [];
      for (const [userId, warns] of Object.entries(porUsuario || {})) {
        for (const warn of warns || []) {
          entradas.push({ userId, ...warn });
        }
      }
      entradas.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (!entradas.length) {
        return interaction.reply({ content: '📋 No hay advertencias registradas.', ephemeral: true });
      }

      const lineas = entradas.slice(0, limite).map(w => {
        const fecha = w.timestamp ? `<t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>` : 'fecha desconocida';
        const moderator = w.moderatorId ? `<@${w.moderatorId}>` : 'desconocido';
        return `• <@${w.userId}> · ${fecha} · por ${moderator}\n  └ ${String(w.reason || 'Sin razón').slice(0, 100)}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('📋 Registro de advertencias')
        .setColor(0x5865F2)
        .setDescription(lineas.join('\n'))
        .setFooter({ text: `${entradas.length} advertencia(s) · mostrando ${Math.min(limite, entradas.length)}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      logError(e, { event: 'modlog', user: interaction.user, guild: interaction.guild, action: 'List warnings' });
      await interaction.reply({ content: '❌ No se pudo leer el registro.', ephemeral: true }).catch(() => {});
    }
  },
};
