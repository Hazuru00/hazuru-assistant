/**
 * ============================================================================
 * COMANDO: /botinfo
 * ============================================================================
 * Muestra información sobre el bot:
 *   - Cantidad de servidores y usuarios
 *   - Uptime (tiempo activo)
 *   - Ping actual
 *   - Versión de Node.js y Discord.js
 *
 * PARÁMETROS: Ninguno
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Muestra informacion del bot'),

  async execute(interaction) {
    // Calcular uptime legible desde milisegundos
    const uptime = interaction.client.uptime;
    const s = Math.floor(uptime / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const uptimeStr = `${h}h ${m % 60}m ${s % 60}s`;

    const embed = new EmbedBuilder()
      .setTitle('Hazuru\'s Assistant')
      .setDescription('Bot multifuncional para tu servidor de Discord')
      .addFields(
        { name: 'Servidores', value: interaction.client.guilds.cache.size.toString(), inline: true },
        { name: 'Usuarios', value: interaction.client.users.cache.size.toString(), inline: true },
        { name: 'Uptime', value: uptimeStr, inline: true },
        { name: 'Ping', value: `${interaction.client.ws.ping}ms`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Discord.js', value: 'v14', inline: true },
      )
      .setColor('#5865F2')
      .setFooter({ text: 'Hazuru\'s Assistant' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
