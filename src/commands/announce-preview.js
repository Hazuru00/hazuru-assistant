/**
 * ============================================================================
 * COMANDO: /announce-preview
 * ============================================================================
 * Muestra cómo quedaría un anuncio ANTES de enviarlo con /announce.
 * La vista es privada (ephemeral), así que nadie más la ve.
 *
 * PARÁMETROS:
 *   - titulo (requerido): Título del anuncio
 *   - mensaje (requerido): Contenido del anuncio
 *   - color (opcional): Color hex (ej: #ff0000)
 *   - mencion (opcional): Rol que se mencionaría
 *
 * PERMISOS: Administradores del servidor
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce-preview')
    .setDescription('Ver cómo quedaría un anuncio antes de enviarlo')
    .addStringOption(opt => opt.setName('titulo').setDescription('Título del anuncio').setRequired(true))
    .addStringOption(opt => opt.setName('mensaje').setDescription('Contenido del anuncio').setRequired(true))
    .addStringOption(opt => opt.setName('color').setDescription('Color hex (ej: #ff0000)'))
    .addRoleOption(opt => opt.setName('mencion').setDescription('Rol a mencionar'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const titulo = interaction.options.getString('titulo');
    const mensaje = interaction.options.getString('mensaje');
    const colorRaw = interaction.options.getString('color') || '#FFA500';
    const rol = interaction.options.getRole('mencion');

    // Mismo color por defecto y mismo parseo que /announce.
    const color = parseInt(colorRaw.replace('#', ''), 16) || 0xFFA500;
    const content = rol ? `<@&${rol.id}> (mención de prueba)` : '';

    await interaction.reply({
      content: content || '📢 Vista previa del anuncio:',
      embeds: [{
        title: titulo,
        description: mensaje,
        color,
        timestamp: new Date().toISOString(),
        footer: { text: `Anuncio por ${interaction.user.tag}` },
      }],
      ephemeral: true,
    });
  },
};
