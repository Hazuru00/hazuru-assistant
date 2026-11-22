const { getSettings } = require('../database/settings');
const { getGuild } = require('../database');
const { logError } = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // ========================================================================
    // SELECT MENU: Reaction Roles
    // ========================================================================
    if (interaction.isStringSelectMenu() && interaction.customId === 'reaction_role_select') {
      const guildId = interaction.guild?.id;
      if (!guildId) return;

      const config = getGuild(guildId);
      const autoRole = config.autoRole || {};
      if (!autoRole.reactionRoles?.length) return;

      // Find the reaction role config that matches this message
      const rr = autoRole.reactionRoles.find(r => r.messageId === interaction.message.id && r.mode === 'select');
      if (!rr) return;

      try {
        // Remove all previous roles from this group
        const currentRoleIds = rr.roles.map(r => r.roleId);
        const member = interaction.member;
        for (const roleId of currentRoleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role && member.roles.cache.has(roleId)) {
            await member.roles.remove(role);
          }
        }

        // Add selected role
        const selectedRoleId = interaction.values[0];
        const role = interaction.guild.roles.cache.get(selectedRoleId);
        if (role) {
          await member.roles.add(role);
          await interaction.reply({ content: `✅ Rol **${role.name}** asignado.`, ephemeral: true });
        } else {
          await interaction.reply({ content: '❌ Rol no encontrado.', ephemeral: true });
        }
      } catch (e) {
        logError(e, { event: 'interactionCreate', guild: { id: guildId }, user: interaction.user, section: 'reactionRole', action: 'Select menu' });
        await interaction.reply({ content: '❌ Error al asignar el rol.', ephemeral: true });
      }
      return;
    }

    // ========================================================================
    // SLASH COMMANDS
    // ========================================================================
    if (!interaction.isChatInputCommand()) return;

    // Verificar si el servidor está autorizado
    if (interaction.guild) {
      const settings = getSettings();
      const hasRestrictions = Object.keys(settings.authorizedServers).length > 0;
      if (settings.authorizedFilterEnabled && hasRestrictions && !settings.authorizedServers[interaction.guild.id]) {
        return interaction.reply({
          content: '❌ Este servidor no está autorizado para usar este bot.',
          ephemeral: true,
        });
      }
    }

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'Hubo un error al ejecutar el comando.', ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: 'Hubo un error al ejecutar el comando.', ephemeral: true }).catch(() => {});
      }
    }
  },
};
