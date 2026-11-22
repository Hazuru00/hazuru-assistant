/**
 * ============================================================================
 * COMANDO: /say
 * ============================================================================
 * Envía un mensaje a un canal usando el bot. Es el equivalente en Discord a
 * escribir en el dashboard, pero con la ventaja de estar protegido por el ID
 * del dueño (OPENCODE_OWNER_ID).
 *
 * PARÁMETROS:
 *   - canal (requerido): Canal donde enviar el mensaje
 *   - mensaje (requerido): Texto a enviar (máx. 2000 caracteres)
 *
 * PERMISOS: Solo el dueño del bot (los demás reciben un mensaje privado)
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils/owner');
const { logInfo, logError } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('[Dueño] Enviar un mensaje como el bot')
    .addChannelOption(opt => opt
      .setName('canal')
      .setDescription('Canal donde enviar el mensaje')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('mensaje')
      .setDescription('Texto del mensaje')
      .setRequired(true)
      .setMaxLength(2000))
    // Visible para admins, pero el execute comprueba el ID del dueño.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '🔒 Este comando es exclusivo del dueño del bot.', ephemeral: true });
    }

    const canal = interaction.options.getChannel('canal');
    const mensaje = interaction.options.getString('mensaje');

    // Solo canales donde se puede escribir texto.
    if (!canal || ![0, 5, 15].includes(canal.type)) {
      return interaction.reply({ content: '❌ El canal debe ser de texto, anuncios o hilo.', ephemeral: true });
    }

    try {
      await canal.send({ content: mensaje });
      logInfo('Mensaje enviado con /say', {
        user: interaction.user,
        guild: interaction.guild,
        action: 'say',
      });
      await interaction.reply({ content: `✅ Mensaje enviado en ${canal}.`, ephemeral: true });
    } catch (e) {
      logError(e, { event: 'say', user: interaction.user, guild: interaction.guild, action: 'Send message' });
      await interaction.reply({ content: `❌ No pude enviar el mensaje: ${e.message}`, ephemeral: true }).catch(() => {});
    }
  },
};
