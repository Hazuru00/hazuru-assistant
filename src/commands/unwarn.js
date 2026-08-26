const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getWarnings, removeWarning, clearWarnings } = require('../database/warnings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Remover una advertencia')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario').setRequired(true))
    .addStringOption(opt => opt.setName('id').setDescription('ID de la advertencia (0 = limpiar todas)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const user = interaction.options.getUser('usuario');
    const id = interaction.options.getString('id');
    const warnings = getWarnings(interaction.guildId, user.id);

    if (warnings.length === 0) {
      return interaction.reply({ content: `${user.tag} no tiene advertencias.`, ephemeral: true });
    }

    if (!id || id === '0') {
      clearWarnings(interaction.guildId, user.id);
      return interaction.reply({ content: `✅ Todas las advertencias de ${user.tag} han sido eliminadas.`, ephemeral: true });
    }

    const removed = removeWarning(interaction.guildId, user.id, id);
    if (removed) {
      await interaction.reply({ content: `✅ Advertencia \`${id}\` eliminada de ${user.tag}.`, ephemeral: true });
    } else {
      await interaction.reply({ content: 'ID de advertencia invalido. Usa `/warnings` para ver los IDs.', ephemeral: true });
    }
  },
};
