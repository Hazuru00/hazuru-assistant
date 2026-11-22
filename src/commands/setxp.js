const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateUser, saveUser } = require('../database/levels');
const { getGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Establece el XP de un usuario (Admin)')
    .setDefaultMemberPermissions(4) // Administrator
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario').setRequired(true))
    .addIntegerOption(opt => opt.setName('xp').setDescription('XP a establecer').setRequired(true).setMinValue(0).setMaxValue(99999999)),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Necesitas permisos de Administrador.', ephemeral: true });
    }

    const config = getGuild(interaction.guild.id);
    if (!config.levels?.enabled) return interaction.reply({ content: '❌ El sistema de niveles no está activado.', ephemeral: true });

    const user = interaction.options.getUser('usuario');
    const xp = interaction.options.getInteger('xp');
    const userData = getOrCreateUser(interaction.guild.id, user.id);
    userData.xp = xp;
    await saveUser(interaction.guild.id, user.id, userData);

    await interaction.reply({ content: `✅ XP de ${user.username} establecido en **${xp.toLocaleString()}**.` });
  },
};
