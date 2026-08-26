/**
 * ============================================================================
 * COMANDO: /warnings
 * ============================================================================
 * Muestra todas las advertencias de un usuario específico.
 * Si no se especifica usuario, muestra las del autor del comando.
 *
 * PARÁMETROS:
 *   - usuario (opcional): El usuario a consultar
 *
 * PERMISOS: Solo administradores
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getWarnings } = require('../database/warnings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Ver advertencias de un usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const user = interaction.options.getUser('usuario') || interaction.user;

    // Obtener las warnings del usuario
    const warnings = getWarnings(interaction.guildId, user.id);

    if (warnings.length === 0) {
      return interaction.reply({ content: `${user.tag} no tiene advertencias.`, ephemeral: true });
    }

    // Crear un campo por cada warning (máximo 25 por límite de Discord)
    const fields = warnings.slice(0, 25).map((w, i) => ({
      name: `\`${w.id}\` — ${new Date(w.timestamp).toLocaleDateString('es')}`,
      value: `**Razón:** ${w.reason}\n**Moderador:** <@${w.moderatorId}>`,
      inline: false,
    }));

    const embed = {
      title: `⚠️ Advertencias de ${user.tag}`,
      color: 0xFEE75C, // Amarillo
      description: `Total: **${warnings.length}** advertencia(s)`,
      fields,
      timestamp: new Date().toISOString(),
    };

    // ephemeral: true = solo el admin que ejecutó el comando ve la respuesta
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
