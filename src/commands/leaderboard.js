const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../database/levels');
const { getIconForLevel } = require('../utils/leveling');
const { getGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Muestra el ranking de nivel del servidor'),

  async execute(interaction) {
    const config = getGuild(interaction.guild.id);
    const levels = config.levels || {};
    if (!levels.enabled) return interaction.reply({ content: '❌ El sistema de niveles no está activado.', ephemeral: true });

    const board = getLeaderboard(interaction.guild.id, 15);
    if (!board.length) return interaction.reply({ content: 'No hay datos de nivel aún.', ephemeral: true });

    const medals = ['🥇', '🥈', '🥉'];
    const lines = board.map((entry, i) => {
      const medal = i < 3 ? medals[i] : `#${i + 1}`;
      const icon = getIconForLevel(entry.level, levels.icons);
      return `${medal} <@${entry.userId}> — ${icon.icon} Nivel **${entry.level}** (${entry.xp.toLocaleString()} XP)`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 Leaderboard')
      .setColor('#FFD700')
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
