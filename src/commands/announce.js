/**
 * ============================================================================
 * COMANDO: /announce
 * ============================================================================
 * Envía un embed de anuncio a un canal específico.
 * Permite mencionar un rol para notificar a sus miembros.
 *
 * PARÁMETROS:
 *   - titulo (requerido): Título del anuncio
 *   - mensaje (requerido): Contenido del anuncio
 *   - canal (requerido): Canal donde enviar el anuncio
 *   - color (opcional): Color en hex (ej: #ff0000)
 *   - mencion (opcional): Rol a mencionar
 *
 * PERMISOS: Solo administradores
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Enviar un anuncio')
    .addStringOption(opt => opt.setName('titulo').setDescription('Titulo del anuncio').setRequired(true))
    .addStringOption(opt => opt.setName('mensaje').setDescription('Mensaje del anuncio').setRequired(true))
    .addChannelOption(opt => opt.setName('canal').setDescription('Canal destino').setRequired(true))
    .addStringOption(opt => opt.setName('color').setDescription('Color hex (ej: #ff0000)'))
    .addRoleOption(opt => opt.setName('mencion').setDescription('Rol a mencionar'))
    // Solo administradores pueden usar este comando
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const titulo = interaction.options.getString('titulo');
    const mensaje = interaction.options.getString('mensaje');
    const canal = interaction.options.getChannel('canal');
    const color = interaction.options.getString('color') || '#FFA500'; // Naranja por defecto
    const rol = interaction.options.getRole('mencion');

    // Verificar que el canal sea de texto (type 0) o anuncios (type 5)
    if (canal.type !== 0 && canal.type !== 5) {
      return interaction.reply({ content: 'El canal debe ser de texto o anuncios.', ephemeral: true });
    }

    // Construir el embed del anuncio
    const embed = {
      title: titulo,
      description: mensaje,
      // Convertir hex string a número: "#FFA500" → 16753664
      color: parseInt(color.replace('#', ''), 16) || 0xFFA500,
      timestamp: new Date().toISOString(),
      footer: { text: `Anuncio por ${interaction.user.tag}` },
    };

    // Si se mencionó un rol, incluir la mención en el contenido
    const content = rol ? `<@&${rol.id}>` : '';

    try {
      await canal.send({ content, embeds: [embed] });
      await interaction.reply({ content: `✅ Anuncio enviado en ${canal}.`, ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
};
