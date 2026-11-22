/**
 * ============================================================================
 * COMANDO: /owner
 * ============================================================================
 * Comandos privados del dueño del bot (OPENCODE_OWNER_ID).
 *
 * Incluye el panel interactivo de edición (/owner panel), los ajustes globales
 * del bot y un estado rápido del dashboard. Los administradores pueden ver la
 * configuración con /config, pero acá se comprueba el ID del usuario antes
 * de cualquier escritura.
 *
 * PERMISOS: Solo el usuario configurado como OPENCODE_OWNER_ID
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getSettings, updateSettings } = require('../database/settings');
const { isOwner, getOwnerId } = require('../utils/owner');
const { SECCIONES } = require('../utils/configView');
const { construirPanel } = require('../utils/configPanel');
const { extraerId } = require('../utils/configEdit');
const { logInfo, logError } = require('../utils/logger');

const seccionChoices = SECCIONES.map(s => ({ name: s, value: s }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('Comandos privados del dueño del bot')
    // Visible para admins, pero el execute vuelve a comprobar el ID del dueño.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('whoami')
      .setDescription('Mostrar tu ID y nivel de acceso'))
    .addSubcommand(sub => sub
      .setName('panel')
      .setDescription('Abrir el panel interactivo para editar configs')
      .addStringOption(opt => opt
        .setName('seccion')
        .setDescription('Sección a abrir directamente (opcional)')
        .addChoices(...seccionChoices)))
    .addSubcommandGroup(grupo => grupo
      .setName('settings')
      .setDescription('Ajustes globales del bot')
      .addSubcommand(sub => sub
        .setName('view')
        .setDescription('Ver los ajustes globales'))
      .addSubcommand(sub => sub
        .setName('filter')
        .setDescription('Activar o desactivar el filtro de servidores')
        .addBooleanOption(opt => opt
          .setName('activo')
          .setDescription('true = solo servidores autorizados')
          .setRequired(true)))
      .addSubcommand(sub => sub
        .setName('servers')
        .setDescription('Reemplazar la lista de servidores autorizados')
        .addStringOption(opt => opt
          .setName('ids')
          .setDescription('IDs separados por coma (vacío = ninguno)')
          .setRequired(true))))
    .addSubcommandGroup(grupo => grupo
      .setName('dashboard')
      .setDescription('Estado del panel web')
      .addSubcommand(sub => sub
        .setName('status')
        .setDescription('Mostrar dirección y alcance del dashboard')),),

  async execute(interaction) {
    // La comprobación manual es la que manda: los permisos de Discord solo
    // controlan la visibilidad del comando, no la identidad del dueño.
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: '🔒 Este comando es exclusivo del dueño del bot.',
        ephemeral: true,
      });
    }

    const grupo = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    await interaction.deferReply({ ephemeral: true });
    logInfo(`Owner command: ${grupo ? `${grupo}.` : ''}${sub}`, {
      user: interaction.user,
      guild: interaction.guild,
      action: 'owner-command',
    });

    try {
      if (sub === 'whoami' && !grupo) {
        return interaction.editReply({
          content: `✅ Sos el dueño del bot. Tu ID: \`${interaction.user.id}\`.`,
        });
      }

      if (sub === 'panel' && !grupo) {
        if (!interaction.guild) {
          return interaction.editReply({ content: '❌ Abrí el panel desde un servidor.' });
        }
        const seccion = interaction.options.getString('seccion');
        return interaction.editReply(construirPanel({
          guildId: interaction.guildId,
          guildName: interaction.guild.name,
          seccion,
          modo: 'edit',
        }));
      }

      if (grupo === 'settings' && sub === 'view') {
        const settings = getSettings();
        const datos = {
          authorizedFilterEnabled: settings.authorizedFilterEnabled === true,
          authorizedServers: settings.authorizedServers || {},
          dashboardConfig: settings.dashboardConfig || {},
        };
        const json = JSON.stringify(datos, null, 2);
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('🔐 Ajustes globales')
            .setColor(0xeb459e)
            .setDescription(`\`\`\`json\n${json.slice(0, 3500)}\n\`\`\``)
            .setTimestamp()],
        });
      }

      if (grupo === 'settings' && sub === 'filter') {
        const activo = interaction.options.getBoolean('activo', true);
        updateSettings({ authorizedFilterEnabled: activo });
        return interaction.editReply({
          content: `✅ Filtro de servidores ${activo ? 'activado' : 'desactivado'}.`,
        });
      }

      if (grupo === 'settings' && sub === 'servers') {
        const texto = interaction.options.getString('ids', true);
        const ids = [...new Set(
          texto.split(',').map(extraerId).filter(Boolean)
        )];
        const autorizados = {};
        for (const id of ids) autorizados[id] = true;
        updateSettings({ authorizedServers: autorizados });
        return interaction.editReply({
          content: `✅ Lista reemplazada: ${ids.length} servidor(es).`,
        });
      }

      if (grupo === 'dashboard' && sub === 'status') {
        const puerto = process.env.PORT || '3001';
        const settings = getSettings();
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('📊 Dashboard')
            .setColor(0xeb459e)
            .setDescription(
              `**Dirección:** http://127.0.0.1:${puerto}\n`
              + '**Alcance:** solo esta máquina (bind IPv4 loopback)\n'
              + `**Dueño:** \`${getOwnerId() || 'sin configurar'}\`\n`
              + `**Filtro de servidores:** ${settings.authorizedFilterEnabled === true ? 'activo' : 'inactivo'}`
            )
            .setTimestamp()],
        });
      }

      return interaction.editReply({ content: '❌ Subcomando no reconocido.' });
    } catch (e) {
      logError(e, { event: 'owner', user: interaction.user, action: sub });
      return interaction.editReply({ content: '❌ No se pudo ejecutar el comando.' }).catch(() => {});
    }
  },
};
