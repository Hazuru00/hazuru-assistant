/**
 * ============================================================================
 * COMANDO: /help
 * ============================================================================
 * Muestra TODOS los comandos disponibles con su sintaxis exacta.
 *
 * La lista NO está escrita a mano: se genera desde los comandos que el bot
 * cargó al iniciar (client.commands). Así, al añadir/quitar un comando o
 * cambiar sus opciones, /help se actualiza solo y nunca queda desactualizado.
 *
 * Los comandos con subcomandos se muestran como una línea por variante, igual
 * que en Discord: /owner panel, /owner settings filter, etc.
 *
 * También lista las variables de mensaje disponibles para configurar
 * bienvenidas, despedidas, etc.
 *
 * PARÁMETROS: Ninguno
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { SECCIONES, TITULO_OTROS, resumenDe } = require('../utils/commandInfo');

// Discord permite 1024 caracteres por field. Se deja margen para el título.
const LIMITE_CAMPO = 1000;

/**
 * Reparte las líneas en campos que no superen el límite de Discord.
 * @param {string[]} lineas - Líneas con la sintaxis y descripción de cada comando
 * @param {string} titulo - Nombre de la sección para los campos
 * @returns {Array<{name: string, value: string, inline: boolean}>} Campos del embed
 */
const agruparEnCampos = (lineas, titulo) => {
  const grupos = [];
  let actual = [];
  let largo = 0;

  for (const linea of lineas) {
    // Si agregar esta línea se pasa del límite, se cierra el campo actual.
    if (largo + linea.length + 1 > LIMITE_CAMPO && actual.length) {
      grupos.push(actual);
      actual = [];
      largo = 0;
    }
    actual.push(linea);
    largo += linea.length + 1;
  }
  if (actual.length) grupos.push(actual);

  return grupos.map((grupo, indice) => ({
    name: grupos.length > 1 ? `${titulo} (${indice + 1}/${grupos.length})` : titulo,
    value: grupo.join('\n'),
    inline: false,
  }));
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra todos los comandos disponibles'),

  async execute(interaction) {
    // client.commands es la misma Collection que usa el dispatcher de slash
    // commands: la fuente de verdad de lo que realmente puede ejecutar el bot.
    const comandos = interaction.client.commands;
    const definiciones = comandos
      ? [...comandos.values()].map(comando => comando.data.toJSON())
      : [];

    // Se arma un grupo por sección. Los comandos desconocidos van a "Otros",
    // así un comando nuevo nunca desaparece del help aunque no se clasifique.
    const porSeccion = new Map();
    for (const json of definiciones.sort((a, b) => a.name.localeCompare(b.name))) {
      const resumen = resumenDe(json);
      // El lock es informativo: el permiso real se comprueba al ejecutar.
      const lineas = json.name === 'owner'
        ? resumen.lineas.map(linea => `${linea} 🔒 solo el dueño`)
        : resumen.lineas;
      if (!porSeccion.has(resumen.seccion)) porSeccion.set(resumen.seccion, []);
      porSeccion.get(resumen.seccion).push(...lineas);
    }
    if (!definiciones.length) {
      porSeccion.set(TITULO_OTROS, ['No se pudieron cargar los comandos.']);
    }

    const campos = [];
    const titulos = [...SECCIONES.map(s => s.titulo), TITULO_OTROS];
    for (const titulo of titulos) {
      const lineas = porSeccion.get(titulo);
      if (lineas?.length) campos.push(...agruparEnCampos(lineas, titulo));
    }

    const embed = new EmbedBuilder()
      .setTitle('Comandos Disponibles')
      .setDescription('Sintaxis exacta de todos los comandos del bot, agrupada por sección:')
      .addFields(
        ...campos,
        // Variables de mensaje disponibles en la configuración del panel web.
        {
          name: 'Variables de Mensaje',
          value: '`{user}` `{user.name}` `{user.id}` `{user.avatar}` `{user.tag}` `{user.mention}` `{user.createdAt}` `{user.joinedAt}` `{server}` `{server.id}` `{server.icon}` `{memberCount}` `{boost}` `{date}` `{time}` `{moderator}` `{reason}`',
          inline: false,
        },
      )
      .setColor('#5865F2')
      .setFooter({ text: `${comandos?.size || 0} comandos · generado desde el registro actual` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
