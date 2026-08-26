/**
 * ============================================================================
 * COMANDO: /timeout
 * ============================================================================
 * Silencia temporalmente a un usuario (timeout/mute).
 * El usuario silenciado no puede enviar mensajes, reaccionar, ni unirse a voz.
 *
 * LÍMITE: Máximo 28 días de timeout
 *
 * PARÁMETROS:
 *   - usuario (requerido): El usuario a silenciar
 *   - duracion (requerido): Cuánto tiempo (10s, 30m, 2h, 1d)
 *   - razon (opcional): Motivo del timeout
 *
 * PERMISOS: Solo administradores
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { parseDuration, formatDuration } = require('../utils/parseDuration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Silenciar a un usuario temporalmente')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a silenciar').setRequired(true))
    .addStringOption(opt => opt.setName('duracion').setDescription('Duracion (10s, 30m, 2h, 1d)').setRequired(true))
    .addStringOption(opt => opt.setName('razon').setDescription('Razon del timeout'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const target = interaction.options.getMember('usuario');
    if (!target) return interaction.reply({ content: 'Usuario no encontrado.', ephemeral: true });

    // Verificaciones de seguridad
    if (target.id === interaction.user.id) return interaction.reply({ content: 'No podes silenciarte a vos mismo.', ephemeral: true });
    if (target.user.bot) return interaction.reply({ content: 'No podes silenciar a un bot.', ephemeral: true });
    if (target.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'No podes silenciar a un administrador.', ephemeral: true });
    }

    // Parsear y validar duración
    const duration = parseDuration(interaction.options.getString('duracion'));
    if (!duration) return interaction.reply({ content: 'Duracion invalida. Usa formato: `10s`, `30m`, `2h`, `1d`', ephemeral: true });
    if (duration > 28 * 24 * 60 * 60 * 1000) return interaction.reply({ content: 'La duracion maxima es 28 dias.', ephemeral: true });

    const razon = interaction.options.getString('razon') || 'Sin razon';

    try {
      // Aplicar timeout al miembro
      await target.timeout(duration, razon);

      // Crear embed informativo
      const embed = {
        title: '🔇 Usuario Silenciado',
        color: 0xFEE75C, // Amarillo
        fields: [
          { name: 'Usuario', value: `<@${target.id}>`, inline: true },
          { name: 'Duracion', value: formatDuration(duration), inline: true },
          { name: 'Moderador', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Razon', value: razon },
        ],
        timestamp: new Date().toISOString(),
      };

      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
};
