const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, getRank, getLeaderboard } = require('../database/levels');
const { xpForLevel, getIconForLevel } = require('../utils/leveling');
const { getGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Muestra tu perfil social o el de otro usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)),

  async execute(interaction) {
    const config = getGuild(interaction.guild.id);
    const levels = config.levels || {};
    if (!levels.enabled) return interaction.reply({ content: '❌ El sistema de niveles no está activado.', ephemeral: true });

    const user = interaction.options.getUser('usuario') || interaction.member.user;
    const userData = getUser(interaction.guild.id, user.id);
    if (!userData) return interaction.reply({ content: `${user.username} no tiene datos de nivel.`, ephemeral: true });

    const formula = levels.levelFormula || { base: 100, exponent: 1.5 };
    const xpNeeded = xpForLevel(userData.level + 1, formula);
    const rank = getRank(interaction.guild.id, user.id);
    const icon = getIconForLevel(userData.level, levels.icons);
    const leaderboard = getLeaderboard(interaction.guild.id, 100);
    const totalMembers = leaderboard.length;

    // Logros desbloqueados
    const unlockedAch = levels.achievements?.filter(a => userData.achievements?.includes(a.id)) || [];
    const achIcons = unlockedAch.map(a => a.icon).join(' ') || 'Ninguno';

    // Fecha de ingreso
    const joined = userData.joinedAt ? `<t:${Math.floor(userData.joinedAt / 1000)}:R>` : 'Desconocido';

    const embed = new EmbedBuilder()
      .setTitle(`${icon.icon} Perfil de ${user.username}`)
      .setColor(levels.levelUpEmbed?.color || '#5865F2')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Titulo', value: userData.title || icon.label, inline: true },
        { name: 'Nivel', value: `**${userData.level}** ${icon.icon}`, inline: true },
        { name: 'XP', value: `${userData.xp.toLocaleString()} / ${xpNeeded.toLocaleString()}`, inline: true },
        { name: 'Rank', value: rank ? `#${rank} de ${totalMembers}` : 'N/A', inline: true },
        { name: 'Mensajes', value: String(userData.messages), inline: true },
        { name: 'Racha', value: `${userData.streak?.days || 0} días`, inline: true },
        { name: 'Logros', value: achIcons, inline: false },
        { name: 'Miembro desde', value: joined, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
