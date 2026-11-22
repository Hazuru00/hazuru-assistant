/**
 * ============================================================================
 * UTILIDAD: configPanel - Panel interactivo de configuración
 * ============================================================================
 *
 * Construye el embed, el menú de secciones, los botones y el modal usados
 * tanto por /config (solo lectura) como por /owner panel (edición).
 *
 * El estado no se guarda en memoria: cada customId lleva el modo, la sección
 * y el campo. Así un reinicio del bot no rompe los paneles abiertos.
 * ============================================================================
 */

const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
} = require('discord.js');
const { getGuild } = require('../database');
const {
  SECCIONES, CAMPOS, CAMPOS_BOOL, resumir, formatearSeccion,
} = require('./configView');

// Etiquetas cortas y entendibles para los botones y modales.
const ETIQUETAS = {
  enabled: 'Activada',
  embedEnabled: 'Usar embed',
  message: 'Mensaje',
  channel: 'Canal',
  roleId: 'Rol',
  announcementChannel: 'Canal de anuncios',
  announceLevelUp: 'Anunciar niveles',
  announceAchievement: 'Anunciar logros',
  messageDelete: 'Log: borrados',
  messageUpdate: 'Log: ediciones',
  voiceStateUpdate: 'Log: voz',
  roleUpdate: 'Log: roles',
};

const PLACEHOLDERS = {
  channel: '#canal o su ID numérico',
  announcementChannel: '#canal o su ID numérico',
  roleId: '@rol o su ID numérico',
  message: 'Escribí el mensaje. Variables: {user}, {server}, {memberCount}…',
};

const etiqueta = (campo) => ETIQUETAS[campo] || campo;

/**
 * Agrupa botones en filas de hasta 5 (máximo de Discord por ActionRow).
 * @param {ButtonBuilder[]} botones - Botones a distribuir
 * @returns {ActionRowBuilder[]} Filas listas para el mensaje
 */
const filasDeBotones = (botones) => {
  const filas = [];
  for (let i = 0; i < botones.length; i += 5) {
    filas.push(new ActionRowBuilder().addComponents(botones.slice(i, i + 5)));
  }
  return filas;
};

/**
 * Construye el mensaje del panel.
 *
 * @param {Object} opciones - Opciones del panel
 * @param {string} opciones.guildId - ID del servidor
 * @param {string} opciones.guildName - Nombre del servidor
 * @param {string|null} opciones.seccion - Sección abierta, o null para el resumen
 * @param {'view'|'edit'} opciones.modo - Solo lectura o edición
 * @param {string} opciones.nota - Texto opcional para el footer
 * @returns {{embeds: EmbedBuilder[], components: ActionRowBuilder[]}}
 */
const construirPanel = ({ guildId, guildName, seccion = null, modo = 'view', nota = '' }) => {
  const config = getGuild(guildId);
  const esEdicion = modo === 'edit';
  const seccionValida = seccion && SECCIONES.includes(seccion) ? seccion : null;

  const embed = new EmbedBuilder()
    .setColor(esEdicion ? 0xeb459e : 0x5865F2)
    .setTimestamp();

  if (seccionValida) {
    const campos = CAMPOS[seccionValida] || [];
    embed
      .setTitle(`⚙️ ${seccionValida} · ${guildName}`)
      .setDescription(
        `${formatearSeccion(config, seccionValida)}\n\n`
        + (esEdicion
          ? 'Elegí un botón para cambiar un campo.'
          : 'Panel de solo lectura.')
      );
  } else {
    embed
      .setTitle(`⚙️ Configuración · ${guildName}`)
      .setDescription(resumir(config) + '\n\nElegí una sección para ver el detalle.');
  }

  embed.setFooter({
    text: nota || (esEdicion
      ? 'Panel del dueño · los cambios se guardan al instante'
      : 'Solo lectura · solo el dueño del bot puede cambiar la config'),
  });

  // El menú va siempre para poder saltar entre secciones sin volver al resumen.
  const select = new StringSelectMenuBuilder()
    .setCustomId(`cfg:select:${modo}`)
    .setPlaceholder('Elegí una sección…')
    .addOptions(SECCIONES.map(s => ({
      label: s,
      value: s,
      description: camposDescripcion(s),
    })));

  const componentes = [new ActionRowBuilder().addComponents(select)];

  if (seccionValida) {
    if (esEdicion) {
      const campos = CAMPOS[seccionValida] || [];
      const botones = campos.map((campo) => {
        if (CAMPOS_BOOL.has(campo)) {
          const activo = config[seccionValida]?.[campo] === true;
          return new ButtonBuilder()
            .setCustomId(`cfg:toggle:${modo}:${seccionValida}:${campo}`)
            .setLabel(`${activo ? '✅' : '⬜'} ${etiqueta(campo)}`)
            .setStyle(activo ? ButtonStyle.Success : ButtonStyle.Secondary);
        }
        return new ButtonBuilder()
          .setCustomId(`cfg:edit:${modo}:${seccionValida}:${campo}`)
          .setLabel(`✏️ ${etiqueta(campo)}`)
          .setStyle(ButtonStyle.Primary);
      });

      componentes.push(...filasDeBotones(botones));
      componentes.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cfg:reset:${modo}:${seccionValida}`)
          .setLabel('↩️ Restablecer sección')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`cfg:back:${modo}`)
          .setLabel('← Resumen')
          .setStyle(ButtonStyle.Secondary),
      ));
    } else {
      componentes.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cfg:back:${modo}`)
          .setLabel('← Resumen')
          .setStyle(ButtonStyle.Secondary),
      ));
    }
  }

  return { embeds: [embed], components: componentes };
};

/**
 * Descripción corta del menú de secciones.
 * @param {string} seccion - Nombre de la sección
 * @returns {string} Texto para el option del select
 */
const camposDescripcion = (seccion) => {
  const descripciones = {
    welcome: 'Mensaje al entrar',
    farewell: 'Mensaje al salir',
    privateWelcome: 'DM de bienvenida',
    boost: 'Aviso de boost',
    ban: 'Aviso de baneo',
    kick: 'Aviso de expulsión',
    autoRole: 'Rol automático',
    levels: 'XP y anuncios',
    autoMod: 'Filtros del bot',
    logging: 'Canal de logs',
  };
  return descripciones[seccion] || 'Configuración';
};

/**
 * Construye el modal para escribir el valor de un campo.
 * @param {string} seccion - Sección de guilds.json
 * @param {string} campo - Campo a editar
 * @returns {ModalBuilder} Modal listo para interaction.showModal()
 */
const construirModal = (seccion, campo) => {
  const modal = new ModalBuilder()
    .setCustomId(`cfgmodal:${seccion}:${campo}`)
    .setTitle(`Editar ${etiqueta(campo)}`.slice(0, 45));

  const input = new TextInputBuilder()
    .setCustomId('valor')
    .setLabel(etiqueta(campo).slice(0, 45))
    .setStyle(campo === 'message' ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setPlaceholder(PLACEHOLDERS[campo] || 'Nuevo valor')
    .setRequired(campo !== 'message');

  if (campo === 'message') input.setMaxLength(2000);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
};

module.exports = { construirPanel, construirModal, etiqueta };
