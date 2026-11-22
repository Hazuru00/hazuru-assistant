const { SlashCommandBuilder } = require('discord.js');
const { resetUser, resetAll } = require('../database/levels');
const { getGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetlevels')
    .setDescription('Resetea el progreso de niveles (Admin)')
    .setDefaultMemberPermissions(4) // Administrator
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a resetear (vacío = todos)').setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Necesitas permisos de Administrador.', ephemeral: true });
    }

    const config = getGuild(interaction.guild.id);
    if (!config.levels?.enabled) return interaction.reply({ content: '❌ El sistema de niveles no está activado.', ephemeral: true });

    const user = interaction.options.getUser('usuario');
    if (user) {
      resetUser(interaction.guild.id, user.id);
      await interaction.reply({ content: `✅ Progreso de ${user.username} reseteado.` });
    } else {
      resetAll(interaction.guild.id);
      await interaction.reply({ content: '✅ Todos los datos de niveles han sido reseteados.' });
    }
  },
};
