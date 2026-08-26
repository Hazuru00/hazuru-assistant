/**
 * ============================================================================
 * EVENTO: interactionCreate
 * ============================================================================
 * Se ejecuta CADA VEZ que un usuario interactúa con el bot (slash commands,
 * botones, selects, modals, etc.).
 *
 * En este caso, solo procesa slash commands (isChatInputCommand).
 * Busca el comando en client.commands y ejecuta su función execute().
 *
 * CÓMO FUNCIONA EL FLUJO DE UN COMANDO:
 *   1. Usuario escribe /ping en Discord
 *   2. Discord envía una interacción al bot
 *   3. Este evento la recibe
 *   4. Busca 'ping' en client.commands
 *   5. Ejecuta ping.execute(interaction)
 * ============================================================================
 */

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Ignorar si no es un slash command (ignorar botones, selects, etc.)
    if (!interaction.isChatInputCommand()) return;

    // Buscar el comando por nombre
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      // Ejecutar el comando
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      // Si el comando falla, enviar un mensaje de error al usuario (ephemeral = solo lo ve él)
      await interaction.reply({ content: 'Hubo un error al ejecutar el comando.', ephemeral: true });
    }
  },
};
