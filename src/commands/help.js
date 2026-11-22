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

// Discord permite 1024 caracteres por field. Se deja margen para el título.
const LIMITE_CAMPO = 1000;

// Secciones visuales del help. Solo agrupa nombres: la sintaxis y las
// descripciones siguen viniendo de los comandos reales, no de acá.
// Un comando nuevo que no esté en esta lista aparece igual en "Otros".
const SECCIONES = [
  { titulo: '📊 Información', comandos: ['server', 'serverinfo', 'userinfo', 'avatar', 'botinfo'] },
  { titulo: '🎲 Diversión', comandos: ['8ball'] },
  { titulo: '⚙️ Utilidad', comandos: ['help', 'poll', 'remind', 'announce', 'nick', 'config'] },
  {
    titulo: '📈 Niveles',
    comandos: ['rank', 'leaderboard', 'profile', 'achievements', 'racha', 'title', 'setlevel', 'setxp', 'resetlevels'],
  },
  {
    titulo: '🔨 Moderación',
    comandos: ['ban', 'kick', 'warn', 'warnings', 'unwarn', 'timeout', 'untimeout', 'purge', 'slowmode'],
  },
  { titulo: '🔐 Dueño del bot', comandos: ['owner'] },
];

const TITULO_OTROS = '🔧 Otros';

/**
 * Devuelve el título de sección que corresponde a un comando.
 * @param {string} nombre - Nombre del comando
 * @returns {string} Título de la sección, o "Otros" si no está clasificado
 */
const seccionDe = (nombre) => SECCIONES.find(s => s.comandos.includes(nombre))?.titulo || TITULO_OTROS;

/**
 * Recorre un comando y devuelve una variante por cada subcomando que tenga.
 * Los grupos (tipo 2) se bajan recursivamente hasta llegar a un subcomando
 * con argumentos normales, que es donde termina la sintaxis.
 *
 * @param {Object} nodo - Definición del comando, grupo o subcomando
 * @param {string[]} prefijo - Nombres acumulados en niveles superiores
 * @returns {Array<{nombres: string[], args: string[], desc: string}>} Variantes
 */
const obtenerVariantes = (nodo, prefijo = []) => {
  const nombres = [...prefijo, nodo.name];
  const opciones = nodo.options || [];
  const subcomandos = opciones.filter(op => op.type === 1 || op.type === 2);

  // Sin subcomandos: es una variante terminal con sus propios argumentos.
  if (!subcomandos.length) {
    return [{
      nombres,
      args: opciones.map(op => (op.required ? `<${op.name}>` : `[${op.name}]`)),
      desc: nodo.description || '',
    }];
  }

  // Con subcomandos: cada uno genera su propia línea (los grupos se expanden).
  return subcomandos.flatMap(sub => obtenerVariantes(sub, nombres));
};

/**
 * Convierte las variantes de un comando en líneas listas para el embed.
 * @param {Object} json - Definición del comando (command.data.toJSON())
 * @returns {string[]} Líneas con sintaxis exacta y descripción
 */
const lineasComando = (json) => {
  // El lock es solo informativo: el permiso real se comprueba al ejecutar.
  const nota = json.name === 'owner' ? ' 🔒 solo el dueño' : '';
  return obtenerVariantes(json).map(({ nombres, args, desc }) => {
    const sintaxis = `/${nombres.join(' ')}${args.length ? ` ${args.join(' ')}` : ''}`;
    return `\`${sintaxis}\` — ${desc}${nota}`;
  });
};

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
      const titulo = seccionDe(json.name);
      if (!porSeccion.has(titulo)) porSeccion.set(titulo, []);
      porSeccion.get(titulo).push(...lineasComando(json));
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
