/**
 * ============================================================================
 * COMANDO: /purge
 * ============================================================================
 * Elimina múltiples mensajes de un canal de una sola vez.
 * Útil para limpiar spam o mensajes no deseados.
 *
 * LÍMITE: entre 1 y 100 mensajes por ejecución
 * NOTA: Solo puede borrar mensajes de los últimos 14 días
 *
 * PARÁMETROS:
 *   - cantidad (requerido): Número de mensajes a eliminar (1-100)
 *
 * PERMISOS: Solo administradores
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Eliminar mensajes del canal')
    .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de mensajes (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const amount = interaction.options.getInteger('cantidad');

    // deferReply: Responder después (puede tomar tiempo borrar muchos mensajes)
    // ephemeral: true = solo el admin ve la respuesta
    await interaction.deferReply({ ephemeral: true });

    try {
      // bulkDelete: Elimina mensajes en masa
      // El segundo parámetro true = filtrar mensajes de más de 14 días
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.editReply({ content: `🗑️ Se eliminaron **${deleted.size}** mensajes.` });
    } catch (e) {
      await interaction.editReply({ content: `Error: ${e.message}` });
    }
  },
};
