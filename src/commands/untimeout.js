/**
 * ============================================================================
 * COMANDO: /untimeout
 * ============================================================================
 * Remueve el silencio (timeout) de un usuario antes de que expire el tiempo.
 *
 * PARÁMETROS:
 *   - usuario (requerido): El usuario a desilenciar
 *
 * PERMISOS: Solo administradores
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remover el silencio de un usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a desilenciar').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const target = interaction.options.getMember('usuario');
    if (!target) return interaction.reply({ content: 'Usuario no encontrado.', ephemeral: true });

    // Verificar que el usuario esté efectivamente silenciado
    if (!target.isCommunicationDisabled()) {
      return interaction.reply({ content: 'Este usuario no esta silenciado.', ephemeral: true });
    }

    try {
      // timeout(null) remueve el timeout antes de que expire
      await target.timeout(null);

      const embed = {
        title: '🔊 Silencio Removido',
        color: 0x57F287, // Verde
        fields: [
          { name: 'Usuario', value: `<@${target.id}>`, inline: true },
          { name: 'Moderador', value: `<@${interaction.user.id}>`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      };

      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
};
