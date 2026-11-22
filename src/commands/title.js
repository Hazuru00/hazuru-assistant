const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateUser, saveUser } = require('../database/levels');
const { getGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('title')
    .setDescription('Cambia tu titulo visible en el perfil')
    .addStringOption(opt => opt.setName('titulo').setDescription('Tu nuevo titulo (max 30 caracteres)').setRequired(true).setMinLength(1).setMaxLength(30)),

  async execute(interaction) {
    const config = getGuild(interaction.guild.id);
    const levels = config.levels || {};
    if (!levels.enabled) return interaction.reply({ content: '❌ El sistema de niveles no está activado.', ephemeral: true });

    const userData = getOrCreateUser(interaction.guild.id, interaction.user.id);
    const minLevel = levels.titleMinLevel || 10;
    if (userData.level < minLevel) {
      return interaction.reply({ content: `❌ Necesitas ser nivel **${minLevel}** para cambiar tu titulo.`, ephemeral: true });
    }

    const titulo = interaction.options.getString('titulo').trim();
    if (!titulo) return interaction.reply({ content: '❌ El titulo no puede estar vacío.', ephemeral: true });

    userData.title = titulo;
    await saveUser(interaction.guild.id, interaction.user.id, userData);

    await interaction.reply({ content: `✅ Tu titulo ahora es: **${titulo}**` });
  },
};
