/**
 * ============================================================================
 * COMANDO: /server
 * ============================================================================
 * Muestra información DETALLADA del servidor:
 *   - ID, dueño, miembros, canales, roles, emojis
 *   - Nivel de boost, fecha de creación, nivel de verificación
 *   - Banner del servidor (si tiene)
 *
 * A diferencia de /serverinfo, este comando muestra mucho más detalle.
 *
 * PARÁMETROS: Ninguno
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Muestra informacion detallada del servidor'),

  async execute(interaction) {
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'ID', value: guild.id, inline: true },
        { name: 'Dueño', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Miembros', value: guild.memberCount.toString(), inline: true },
        { name: 'Canales', value: guild.channels.cache.size.toString(), inline: true },
        { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
        { name: 'Emojis', value: guild.emojis.cache.size.toString(), inline: true },
        { name: 'Boosts', value: (guild.premiumSubscriptionCount || 0).toString(), inline: true },
        // premiumTier: 0 = None, 1 = Tier 1, 2 = Tier 2, 3 = Tier 3
        { name: 'Nivel de Boost', value: `Nivel ${guild.premiumTier || 0}`, inline: true },
        { name: 'Creado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        // verificationLevel: 0=None, 1=Low, 2=Medium, 3=High, 4=Very High
        { name: 'Verificacion', value: ['Ninguna', 'Baja', 'Media', 'Alta', 'Muy Alta'][guild.verificationLevel] || 'Desconocido', inline: true },
      )
      .setColor('#5865F2')
      .setTimestamp();

    // Si el servidor tiene descripción, agregarla
    if (guild.description) embed.setDescription(guild.description);

    // Si el servidor tiene banner, mostrarlo como imagen grande
    if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));

    await interaction.reply({ embeds: [embed] });
  },
};
