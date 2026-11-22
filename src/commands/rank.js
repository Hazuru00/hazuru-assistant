const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, getRank } = require('../database/levels');
const { xpForLevel, getIconForLevel } = require('../utils/leveling');
const { getGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Muestra tu nivel y XP o el de otro usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)),

  async execute(interaction) {
    const config = getGuild(interaction.guild.id);
    const levels = config.levels || {};
    if (!levels.enabled) return interaction.reply({ content: '❌ El sistema de niveles no está activado.', ephemeral: true });

    const user = interaction.options.getUser('usuario') || interaction.member.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const userData = getUser(interaction.guild.id, user.id);
    if (!userData) return interaction.reply({ content: `${user.username} no tiene datos de nivel.`, ephemeral: true });

    const formula = levels.levelFormula || { base: 100, exponent: 1.5 };
    const xpNeeded = xpForLevel(userData.level + 1, formula);
    const progress = Math.min((userData.xp / xpNeeded) * 100, 100);
    const barLength = 20;
    const filled = Math.round((progress / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    const rank = getRank(interaction.guild.id, user.id);
    const icon = getIconForLevel(userData.level, levels.icons);

    const embed = new EmbedBuilder()
      .setTitle(`${icon.icon} ${user.username}`)
      .setColor(levels.levelUpEmbed?.color || '#5865F2')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Nivel', value: `**${userData.level}** ${icon.icon} ${icon.label}`, inline: true },
        { name: 'XP', value: `**${userData.xp.toLocaleString()}** / ${xpNeeded.toLocaleString()}`, inline: true },
        { name: 'Rank', value: rank ? `#${rank}` : 'N/A', inline: true },
        { name: 'Progreso', value: `\`${bar}\` ${progress.toFixed(1)}%`, inline: false },
        { name: 'Mensajes', value: String(userData.messages), inline: true },
        { name: 'Racha', value: `${userData.streak?.days || 0} días`, inline: true }
      )
      .setTimestamp();

    if (userData.title) embed.setFooter({ text: userData.title });

    await interaction.reply({ embeds: [embed] });
  },
};
