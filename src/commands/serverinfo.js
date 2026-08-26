/**
 * ============================================================================
 * COMANDO: /serverinfo
 * ============================================================================
 * Muestra información básica del servidor:
 *   - ID, cantidad de miembros, fecha de creación, dueño
 *
 * Para info más detallada, usar /server
 *
 * PARÁMETROS: Ninguno
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Muestra información del servidor'),

  async execute(interaction) {
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: guild.id, inline: true },
        { name: 'Miembros', value: guild.memberCount.toString(), inline: true },
        // <t:TIMESTAMP:R> = "hace X tiempo"
        { name: 'Creado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Dueño', value: `<@${guild.ownerId}>`, inline: true },
      )
      .setColor('#00ff00')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
