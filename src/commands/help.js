/**
 * ============================================================================
 * COMANDO: /help
 * ============================================================================
 * Muestra una lista de todos los comandos disponibles agrupados por categoría.
 * También lista todas las variables de mensaje disponibles para configurar
 * bienvenidas, despedidas, etc.
 *
 * PARÁMETROS: Ninguno
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra todos los comandos disponibles'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Comandos Disponibles')
      .setDescription('Lista de todos los comandos del bot:')
      .addFields(
        // Categoría: General
        { name: '📌 General', value: '`/ping` `/botinfo` `/help` `/8ball`', inline: false },
        // Categoría: Información
        { name: '📊 Informacion', value: '`/userinfo` `/avatar` `/server` `/serverinfo`', inline: false },
        // Categoría: Utilidad
        { name: '⚙️ Utilidad', value: '`/poll` `/remind` `/announce` `/nick`', inline: false },
        // Categoría: Niveles
        { name: '📈 Niveles', value: '`/rank` `/leaderboard` `/profile` `/achievements` `/title` `/racha`', inline: false },
        // Categoría: Moderación (solo admins)
        { name: '🔨 Moderación (Admin)', value: '`/ban` `/kick` `/warn` `/warnings` `/unwarn` `/timeout` `/untimeout` `/purge` `/slowmode`', inline: false },
        // Categoría: Admin Niveles
        { name: '🔧 Admin Niveles', value: '`/setlevel` `/setxp` `/resetlevels`', inline: false },
        // Variables de mensaje disponibles en la configuración del panel web
        { name: 'Variables de Mensaje', value: '`{user}` `{user.name}` `{user.id}` `{user.avatar}` `{user.tag}` `{user.mention}` `{user.createdAt}` `{user.joinedAt}` `{server}` `{server.id}` `{server.icon}` `{memberCount}` `{boost}` `{date}` `{time}` `{moderator}` `{reason}`', inline: false },
      )
      .setColor('#5865F2')
      .setFooter({ text: 'Hazuru\'s Assistant' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
