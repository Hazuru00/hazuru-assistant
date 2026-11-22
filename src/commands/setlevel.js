const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateUser, saveUser } = require('../database/levels');
const { getGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('Establece el nivel de un usuario (Admin)')
    .setDefaultMemberPermissions(4) // Administrator
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario').setRequired(true))
    .addIntegerOption(opt => opt.setName('nivel').setDescription('Nivel a establecer').setRequired(true).setMinValue(0).setMaxValue(999)),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Necesitas permisos de Administrador.', ephemeral: true });
    }

    const config = getGuild(interaction.guild.id);
    if (!config.levels?.enabled) return interaction.reply({ content: '❌ El sistema de niveles no está activado.', ephemeral: true });

    const user = interaction.options.getUser('usuario');
    const level = interaction.options.getInteger('nivel');
    const userData = getOrCreateUser(interaction.guild.id, user.id);
    userData.level = level;
    userData.xp = 0;
    await saveUser(interaction.guild.id, user.id, userData);

    await interaction.reply({ content: `✅ Nivel de ${user.username} establecido en **${level}**.` });
  },
};
