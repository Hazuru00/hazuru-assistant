/**
 * ============================================================================
 * COMANDO: /warn
 * ============================================================================
 * Advierte a un usuario y guarda la advertencia en la base de datos.
 * El usuario también recibe un DM informándole de la advertencia.
 *
 * Cada advertencia tiene:
 *   - ID único
 *   - Razón
 *   - Moderador que la dio
 *   - Timestamp
 *
 * PARÁMETROS:
 *   - usuario (requerido): El usuario a advertir
 *   - razon (opcional): Motivo de la advertencia
 *
 * PERMISOS: Solo administradores
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addWarning, getWarnings } = require('../database/warnings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Advertir a un usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a advertir').setRequired(true))
    .addStringOption(opt => opt.setName('razon').setDescription('Razon de la advertencia'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const target = interaction.options.getMember('usuario');
    if (!target) return interaction.reply({ content: 'Usuario no encontrado en el servidor.', ephemeral: true });

    // Verificaciones de seguridad
    if (target.id === interaction.user.id) return interaction.reply({ content: 'No podes advertirte a vos mismo.', ephemeral: true });
    if (target.user.bot) return interaction.reply({ content: 'No podes advertir a un bot.', ephemeral: true });

    const razon = interaction.options.getString('razon') || 'Sin razon';

    // Agregar la warning a la base de datos
    // addWarning devuelve el array actualizado de warnings del usuario
    const warnings = addWarning(interaction.guildId, target.id, {
      reason: razon,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
    });

    // Crear embed informativo
    const embed = {
      title: '⚠️ Advertencia',
      color: 0xFEE75C, // Amarillo
      fields: [
        { name: 'Usuario', value: `<@${target.id}>`, inline: true },
        { name: 'Moderador', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Total warnings', value: String(warnings.length), inline: true },
        { name: 'Razon', value: razon },
      ],
      timestamp: new Date().toISOString(),
    };

    await interaction.reply({ embeds: [embed] });

    // Intentar enviar DM al usuario advertido
    // Si el DM falla (usuarios con DMs deshabilitados), simplemente se ignora
    try {
      await target.send({ content: `Has sido advertido en **${interaction.guild.name}**.\nRazón: ${razon}\nTotal advertencias: ${warnings.length}` });
    } catch {}
  },
};
