/**
 * ============================================================================
 * COMANDO: /dm-template
 * ============================================================================
 * Consulta o cambia el mensaje de bienvenida privada (DM) desde Discord.
 *
 * Sin parámetros: muestra el template actual con las variables resueltas.
 * Con `mensaje`: lo guarda en privateWelcome.message (solo el dueño del bot).
 *
 * PARÁMETROS:
 *   - mensaje (opcional): Nuevo template. Requiere ser el dueño del bot.
 *
 * PERMISOS: Ver → administradores. Editar → solo el dueño del bot.
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild } = require('../database');
const { guardarCampo } = require('../utils/configEdit');
const { replaceVars } = require('../utils/replaceVars');
const { isOwner } = require('../utils/owner');
const { logError } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm-template')
    .setDescription('Ver o cambiar el mensaje de bienvenida privada')
    .addStringOption(opt => opt
      .setName('mensaje')
      .setDescription('Nuevo mensaje (solo el dueño del bot)')
      .setMaxLength(2000))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ Este comando solo funciona en un servidor.', ephemeral: true });
    }

    const nuevoMensaje = interaction.options.getString('mensaje');

    // Escritura: solo el dueño, igual que el panel interactivo.
    if (nuevoMensaje != null && !isOwner(interaction.user.id)) {
      return interaction.reply({
        content: '🔒 Solo el dueño del bot puede cambiar la configuración.',
        ephemeral: true,
      });
    }

    try {
      if (nuevoMensaje != null) {
        guardarCampo(interaction.guildId, 'privateWelcome', 'message', nuevoMensaje);
        return interaction.reply({
          content: '✅ Mensaje de bienvenida privada actualizado.',
          ephemeral: true,
        });
      }

      const config = getGuild(interaction.guildId);
      const raw = config.privateWelcome?.message || '';
      const ejemplo = replaceVars(raw, {
        id: interaction.user.id,
        guild: interaction.guild,
        user: interaction.user,
        joinedTimestamp: Date.now(),
      });

      return interaction.reply({
        content: `📩 **Template actual** (${raw.length} caracteres):\n\u200b\n${ejemplo || '_(vacío)_'}`,
        ephemeral: true,
      });
    } catch (e) {
      logError(e, { event: 'dm-template', user: interaction.user, guild: interaction.guild, action: 'View/edit template' });
      return interaction.reply({ content: `❌ No se pudo completar: ${e.message}`, ephemeral: true }).catch(() => {});
    }
  },
};
