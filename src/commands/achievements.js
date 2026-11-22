const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../database/levels');
const { getGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('Muestra tus logros o los de otro usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)),

  async execute(interaction) {
    const config = getGuild(interaction.guild.id);
    const levels = config.levels || {};
    if (!levels.enabled) return interaction.reply({ content: '❌ El sistema de niveles no está activado.', ephemeral: true });

    const user = interaction.options.getUser('usuario') || interaction.member.user;
    const userData = getUser(interaction.guild.id, user.id);
    if (!userData) return interaction.reply({ content: `${user.username} no tiene datos de nivel.`, ephemeral: true });

    const achievements = levels.achievements || [];
    if (!achievements.length) return interaction.reply({ content: 'No hay logros configurados.', ephemeral: true });

    const lines = achievements.map(a => {
      const unlocked = userData.achievements?.includes(a.id);
      return unlocked ? `${a.icon} **${a.name}** — ${a.description}` : `❓ **???** — ???`;
    });

    const unlockedCount = achievements.filter(a => userData.achievements?.includes(a.id)).length;

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Logros de ${user.username}`)
      .setDescription(lines.join('\n'))
      .setColor('#FFD700')
      .setFooter({ text: `${unlockedCount}/${achievements.length} desbloqueados` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
