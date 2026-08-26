/**
 * ============================================================================
 * COMANDO: /nick
 * ============================================================================
 * Cambia el nickname (apodo) de un usuario en el servidor.
 * Si no se especifica nickname, lo resetea al nombre original.
 *
 * PARÁMETROS:
 *   - usuario (requerido): El usuario cuyo nick cambiar
 *   - nick (opcional): El nuevo nickname (vacío = resetear)
 *
 * PERMISOS: Solo administradores
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Cambiar el nickname de un usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario').setRequired(true))
    .addStringOption(opt => opt.setName('nick').setDescription('Nuevo nickname (vacio para resetear)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const target = interaction.options.getMember('usuario');
    if (!target) return interaction.reply({ content: 'Usuario no encontrado.', ephemeral: true });

    const nick = interaction.options.getString('nick') || '';

    // Verificar que el bot pueda modificar a este miembro
    // (no puede modificar a alguien con igual o mayor rol)
    if (!target.manageable) {
      return interaction.reply({ content: 'No puedo cambiar el nickname de ese usuario.', ephemeral: true });
    }

    try {
      // Si nick está vacío, pasar null para resetear al nombre original
      await target.setNickname(nick || null);
      const action = nick ? ` cambiado a **${nick}**` : ' reseteado';
      await interaction.reply({ content: `✅ Nickname de <@${target.id}>${action}.`, ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
};
