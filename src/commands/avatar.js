/**
 * ============================================================================
 * COMANDO: /avatar
 * ============================================================================
 * Muestra el avatar de un usuario en tamaño grande.
 * Si no se especifica usuario, muestra el avatar del que ejecutó el comando.
 *
 * PARÁMETROS:
 *   - usuario (opcional): El usuario del cual ver el avatar
 *
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Muestra el avatar de un usuario')
    .addUserOption(option => option.setName('usuario').setDescription('Usuario').setRequired(false)),

  async execute(interaction) {
    // Obtener el usuario de la opción, o el autor si no se especifica
    const user = interaction.options.getUser('usuario') || interaction.user;

    // Obtener avatar en máxima resolución (1024px)
    // dynamic: true permite GIFs si el usuario tiene avatar animado
    const avatar = user.displayAvatarURL({ dynamic: true, size: 1024 });

    const embed = new EmbedBuilder()
      .setTitle(`Avatar de ${user.tag}`)
      .setImage(avatar) // Imagen grande del embed
      .setColor(user.hexAccentColor || '#5865F2') // Color del embed = color de acento del usuario
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
