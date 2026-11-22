/**
 * ============================================================================
 * COMANDO: /preview
 * ============================================================================
 * Envía un mensaje de prueba de una sección configurada en el dashboard:
 * bienvenida, despedida, DM privada, boost, ban o kick.
 *
 * Usa las mismas variables y el mismo embed que los eventos reales, así que
 * sirve para comprobar una configuración antes de guardarla o activarla.
 * Las tarjetas de imagen no se incluyen (para eso está el preview del dashboard).
 *
 * PARÁMETROS:
 *   - tipo (requerido): Sección a probar
 *   - usuario (opcional): Usuario de prueba (por defecto, quien ejecuta)
 *   - canal (opcional): Dónde enviar el preview (por defecto, el canal configurado)
 *
 * PERMISOS: Administradores del servidor
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { construirMensajePreview, TIPO_A_SECCION } = require('../utils/previewMessage');
const { logError } = require('../utils/logger');

const tipos = Object.keys(TIPO_A_SECCION).map(tipo => ({ name: tipo, value: tipo }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('preview')
    .setDescription('Enviar un mensaje de prueba de una sección')
    .addStringOption(opt => opt
      .setName('tipo')
      .setDescription('Sección a probar')
      .setRequired(true)
      .addChoices(...tipos))
    .addUserOption(opt => opt
      .setName('usuario')
      .setDescription('Usuario de prueba (por defecto, vos)'))
    .addChannelOption(opt => opt
      .setName('canal')
      .setDescription('Canal destino (por defecto, el configurado)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ Este comando solo funciona en un servidor.', ephemeral: true });
    }

    const tipo = interaction.options.getString('tipo');
    const usuario = interaction.options.getUser('usuario') || interaction.user;

    try {
      const { mensaje, embed, canalId, seccion } = construirMensajePreview({
        guild: interaction.guild,
        guildId: interaction.guildId,
        tipo,
        usuario,
        moderador: interaction.user,
      });

      if (!mensaje && !embed) {
        return interaction.reply({
          content: `❌ La sección \`${seccion}\` no tiene mensaje configurado.`,
          ephemeral: true,
        });
      }

      const destino = interaction.options.getChannel('canal')
        || (canalId ? interaction.guild.channels.cache.get(canalId) : null)
        || interaction.channel;

      if (!destino?.send) {
        return interaction.reply({
          content: `❌ No encontré el canal configurado para \`${seccion}\`. Pasá uno con la opción \`canal\`.`,
          ephemeral: true,
        });
      }

      await destino.send({
        content: mensaje || undefined,
        embeds: embed ? [embed] : [],
      });

      await interaction.reply({
        content: `✅ Preview de \`${seccion}\` enviado en ${destino}.`,
        ephemeral: true,
      });
    } catch (e) {
      logError(e, { event: 'preview', user: interaction.user, guild: interaction.guild, action: 'Send preview' });
      await interaction.reply({ content: `❌ No se pudo enviar el preview: ${e.message}`, ephemeral: true }).catch(() => {});
    }
  },
};
