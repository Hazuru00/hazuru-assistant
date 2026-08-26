/**
 * ============================================================================
 * COMANDO: /userinfo
 * ============================================================================
 * Muestra información detallada de un usuario:
 *   - ID, nombre, tag
 *   - Fecha de creación de la cuenta
 *   - Fecha de unión al servidor
 *   - Roles que tiene
 *   - Si está boosteando el servidor
 *
 * PARÁMETROS:
 *   - usuario (opcional): El usuario a investigar
 *
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Muestra informacion de un usuario')
    .addUserOption(option => option.setName('usuario').setDescription('Usuario a investigar').setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('usuario') || interaction.user;

    // Obtener el miembro del servidor (para tener info de roles, boost, etc.)
    // catch: null por si el usuario no está en el servidor
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(`Informacion de ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Nombre', value: user.username, inline: true },
        { name: 'Tag', value: user.tag, inline: true },
        // <t:TIMESTAMP:R> formatea la fecha como "hace X tiempo" en Discord
        { name: 'Cuenta creada', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setColor(user.hexAccentColor || '#5865F2')
      .setTimestamp();

    // Si el miembro está en el servidor, agregar info adicional
    if (member) {
      embed.addFields(
        { name: 'Se unio', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        // Filtrar @everyone (id del servidor) y mostrar solo roles reales
        { name: 'Roles', value: member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Ninguno', inline: false },
      );
      // Si está boosteando, mostrar desde cuándo
      if (member.premiumSince) {
        embed.addFields({ name: 'Boosting desde', value: `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`, inline: true });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },
};
