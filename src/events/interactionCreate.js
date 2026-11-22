const { PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('../database/settings');
const { getGuild } = require('../database');
const { logError } = require('../utils/logger');
const { isOwner } = require('../utils/owner');
const { SECCIONES, CAMPOS } = require('../utils/configView');
const { construirPanel, construirModal, etiqueta } = require('../utils/configPanel');
const {
  parsearValor, guardarCampo, alternarCampo, resetearSeccion,
} = require('../utils/configEdit');

/**
 * Comprueba quién puede usar cada panel. El modo edición exige ser el dueño;
 * el modo lectura exige administrador del servidor.
 */
const puedeUsarPanel = (interaction, modo) => {
  if (modo === 'edit') return isOwner(interaction.user.id);
  return !!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
};

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
    // PANEL DE CONFIGURACIÓN: menú de secciones, botones y modales
    // ========================================================================
    try {
      // El menú sirve tanto para el panel de lectura como para el de edición.
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('cfg:select:')) {
        const modo = interaction.customId.split(':')[2];
        if (!puedeUsarPanel(interaction, modo) || !interaction.guild) {
          return interaction.reply({ content: '🔒 No tenés acceso a este panel.', ephemeral: true });
        }
        return interaction.update(construirPanel({
          guildId: interaction.guildId,
          guildName: interaction.guild.name,
          seccion: interaction.values[0],
          modo,
        }));
      }

      // Botones del panel: volver, alternar booleanos, restablecer y editar.
      if (interaction.isButton() && interaction.customId.startsWith('cfg:')) {
        const [, accion, modo, seccion, campo] = interaction.customId.split(':');
        if (!puedeUsarPanel(interaction, modo) || !interaction.guild) {
          return interaction.reply({ content: '🔒 No tenés acceso a este panel.', ephemeral: true });
        }

        const datosPanel = {
          guildId: interaction.guildId,
          guildName: interaction.guild.name,
          modo,
        };

        if (accion === 'back') {
          return interaction.update(construirPanel({ ...datosPanel, seccion: null }));
        }

        // Un admin podría forjar un customId con modo 'view' y llegar hasta
        // acá. Toda escritura exige al dueño, sin importar el modo recibido.
        if (['toggle', 'reset', 'edit'].includes(accion) && !isOwner(interaction.user.id)) {
          return interaction.reply({
            content: '🔒 Solo el dueño del bot puede cambiar la configuración.',
            ephemeral: true,
          });
        }

        // Restablecer no tiene campo: solo necesita una sección válida.
        if (!SECCIONES.includes(seccion) || (accion !== 'reset' && !CAMPOS[seccion]?.includes(campo))) {
          return interaction.reply({ content: '❌ Campo no válido.', ephemeral: true });
        }

        if (accion === 'toggle') {
          const nuevo = alternarCampo(interaction.guildId, seccion, campo);
          return interaction.update(construirPanel({
            ...datosPanel,
            seccion,
            nota: `${etiqueta(campo)} → ${nuevo ? 'activado' : 'desactivado'}`,
          }));
        }

        if (accion === 'reset') {
          resetearSeccion(interaction.guildId, seccion);
          return interaction.update(construirPanel({
            ...datosPanel,
            seccion,
            nota: 'Sección restablecida a sus valores por defecto.',
          }));
        }

        if (accion === 'edit') {
          return interaction.showModal(construirModal(seccion, campo));
        }
      }

      // Envío del modal: validar, guardar y refrescar el panel de origen.
      if (interaction.isModalSubmit() && interaction.customId.startsWith('cfgmodal:')) {
        const [, seccion, campo] = interaction.customId.split(':');
        if (!isOwner(interaction.user.id) || !interaction.guild) {
          return interaction.reply({ content: '🔒 Solo el dueño del bot puede cambiar la configuración.', ephemeral: true });
        }
        if (!SECCIONES.includes(seccion) || !CAMPOS[seccion]?.includes(campo)) {
          return interaction.reply({ content: '❌ Campo no válido.', ephemeral: true });
        }

        const texto = interaction.fields.getTextInputValue('valor');
        const resultado = await parsearValor(campo, texto, interaction.guild);
        if (!resultado.ok) {
          return interaction.reply({ content: `❌ ${resultado.error}`, ephemeral: true });
        }

        guardarCampo(interaction.guildId, seccion, campo, resultado.valor);
        const panel = construirPanel({
          guildId: interaction.guildId,
          guildName: interaction.guild.name,
          seccion,
          modo: 'edit',
          nota: `${etiqueta(campo)} guardado correctamente.`,
        });
        if (interaction.message) await interaction.message.edit(panel).catch(() => {});
        return interaction.reply({ content: `✅ ${etiqueta(campo)} actualizado.`, ephemeral: true });
      }
    } catch (e) {
      logError(e, { event: 'interactionCreate', section: 'configPanel', action: 'Component' });
      if (interaction.isRepliable()) {
        await interaction.reply({ content: '❌ Error en el panel de configuración.', ephemeral: true }).catch(() => {});
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
