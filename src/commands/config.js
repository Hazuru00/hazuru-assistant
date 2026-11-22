/**
 * ============================================================================
 * COMANDO: /config
 * ============================================================================
 * Abre el panel interactivo de SOLO LECTURA de la configuración del servidor.
 *
 * Los administradores pueden recorrer las secciones con el menú y los botones,
 * pero no aparecen los controles de edición. Los cambios los hace el dueño
 * del bot con /owner panel.
 *
 * PERMISOS: Administradores del servidor
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { SECCIONES } = require('../utils/configView');
const { construirPanel } = require('../utils/configPanel');
const { logError } = require('../utils/logger');

const seccionChoices = SECCIONES.map(s => ({ name: s, value: s }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Ver la configuración del servidor (solo lectura)')
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('Abrir el panel de configuración')
      .addStringOption(opt => opt
        .setName('seccion')
        .setDescription('Sección a abrir directamente (opcional)')
        .addChoices(...seccionChoices)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ Este comando solo funciona dentro de un servidor.', ephemeral: true });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitás permiso de administrador para ver la configuración.', ephemeral: true });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      const seccion = interaction.options.getString('seccion');
      const panel = construirPanel({
        guildId: interaction.guildId,
        guildName: interaction.guild.name,
        seccion,
        modo: 'view',
      });
      await interaction.editReply(panel);
    } catch (e) {
      logError(e, { event: 'config', guild: interaction.guild, user: interaction.user, action: 'Open panel' });
      await interaction.editReply({ content: '❌ No se pudo abrir el panel.' }).catch(() => {});
    }
  },
};
