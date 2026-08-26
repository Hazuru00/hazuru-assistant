const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsar a un usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
    .addStringOption(opt => opt.setName('razon').setDescription('Razon de la expulsion'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('usuario');
    const user = interaction.options.getUser('usuario');
    const razon = interaction.options.getString('razon') || 'Sin razon';

    if (!target) return interaction.reply({ content: 'Usuario no encontrado en el servidor.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: 'No podes expulsarte a vos mismo.', ephemeral: true });
    if (target.user.bot) return interaction.reply({ content: 'No podes expulsar a un bot.', ephemeral: true });
    if (target.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'No podes expulsar a un administrador.', ephemeral: true });
    }

    try {
      await target.send({ content: `Has sido expulsado de **${interaction.guild.name}**.\nRazón: ${razon}` }).catch(() => {});
      await target.kick(razon);

      const embed = {
        title: '👢 Usuario Expulsado',
        color: 0xFF9044,
        fields: [
          { name: 'Usuario', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderador', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Razon', value: razon },
        ],
        timestamp: new Date().toISOString(),
      };
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
};
