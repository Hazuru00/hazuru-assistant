const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banear a un usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a banear').setRequired(true))
    .addStringOption(opt => opt.setName('razon').setDescription('Razon del ban'))
    .addBooleanOption(opt => opt.setName('eliminar_mensajes').setDescription('Eliminar mensajes recientes (7 dias)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('usuario');
    const user = interaction.options.getUser('usuario');
    const razon = interaction.options.getString('razon') || 'Sin razon';
    const deleteDays = interaction.options.getBoolean('eliminar_mensajes') ? 7 : 0;

    if (!target) return interaction.reply({ content: 'Usuario no encontrado en el servidor.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: 'No podes banear a vos mismo.', ephemeral: true });
    if (target.user.bot) return interaction.reply({ content: 'No podes banear a un bot.', ephemeral: true });
    if (target.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'No podes banear a un administrador.', ephemeral: true });
    }

    try {
      await target.send({ content: `Has sido baneado de **${interaction.guild.name}**.\nRazón: ${razon}` }).catch(() => {});
      await interaction.guild.members.ban(user.id, { deleteMessageDays: deleteDays, reason: `${razon} | Por: ${interaction.user.tag}` });

      const embed = {
        title: '🔨 Usuario Baneado',
        color: 0xED4245,
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
