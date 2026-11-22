/**
 * ============================================================================
 * PRUEBAS: comandos nuevos
 * ============================================================================
 * Pruebas ligeras con Node (sin frameworks). Se ejecutan con:
 *   NODE_PATH="<ruta a node_modules>" node tests/run.js
 *
 * Los módulos de base de datos y logs se reemplazan en require.cache para no
 * escribir archivos reales durante las pruebas.
 * ============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Collection, SlashCommandBuilder } = require('discord.js');

process.env.OPENCODE_OWNER_ID = 'owner-1';

const RAIZ = path.resolve(__dirname, '..');
const ruta = (relativa) => path.join(RAIZ, relativa);

/**
 * Reemplaza un módulo por un objeto falso antes de que se requiera.
 * @param {string} relativa - Ruta del módulo desde la raíz del proyecto
 * @param {Object} exports - Objeto a devolver
 */
const simular = (relativa, exports) => {
  const archivo = ruta(relativa);
  require.cache[archivo] = { id: archivo, filename: archivo, loaded: true, exports };
};

simular('src/utils/logger.js', { logInfo: () => {}, logError: () => {}, logWarn: () => {} });

// --- Base de variables en memoria: no se escriben JSON reales en los tests ---
let bibliotecaEnMemoria = { variables: {}, plantillas: {} };
simular('src/database/backup.js', { createBackup: () => {} });
simular('src/database/atomic.js', {
  readJson: (archivo, fallback) => archivo.includes('messageVariables') ? bibliotecaEnMemoria : fallback,
  writeJsonAtomic: (archivo, datos) => { bibliotecaEnMemoria = datos; },
});

// --- Datos falsos de recordatorios ---
const ahora = Date.now();
const recordatorios = {
  'guild-1': {
    r1: { id: 'r1', userId: 'user-1', channel: '111111111111111111', message: 'Mi recordatorio', remindAt: ahora + 60000 },
    r2: { id: 'r2', userId: 'user-2', channel: '111111111111111111', message: 'Recordatorio ajeno', remindAt: ahora + 120000 },
    r3: { id: 'r3', userId: 'user-1', channel: '111111111111111111', message: 'Ya vencido', remindAt: ahora - 60000 },
  },
};
simular('src/database/reminders.js', { getReminders: (guildId) => recordatorios[guildId] || {} });

// --- Datos falsos de configuración y advertencias ---
const configGuild = {
  welcome: {
    enabled: true,
    channel: '222222222222222222',
    message: 'Bienvenido {user.name} a {server}',
    embedEnabled: true,
    embed: { title: 'Hola {user.name}', description: 'Sos el miembro {memberCount}', color: '#5865F2' },
  },
  privateWelcome: { enabled: true, message: 'DM para {user.name}', embedEnabled: false },
  ban: { enabled: true, channel: '333333333333333333', message: '{user.name} baneado por {moderator}', embedEnabled: false },
  autoRole: {
    enabled: true,
    reactionRoles: [
      {
        id: 'rr1', enabled: true, channelId: '444444444444444444', messageId: '', mode: 'emoji',
        embed: { title: 'Elige tu rol', description: 'Reacciona', color: '#5865F2' },
        roles: [{ emoji: '🎮', roleId: 'rol-1', label: 'Gamer' }],
      },
      {
        id: 'rr2', enabled: true, channelId: '555555555555555555', messageId: '', mode: 'select',
        embed: { title: 'Menú de roles', description: 'Elegí', color: '#5865F2' },
        roles: [{ emoji: '🎧', roleId: 'rol-2', label: 'Música' }],
      },
    ],
  },
};
const escriturasConfig = [];
simular('src/database/index.js', {
  getGuild: (guildId) => configGuild,
  updateGuild: (guildId, datos) => { escriturasConfig.push({ guildId, datos }); },
  defaultConfig: () => configGuild,
  defaultEmbed: () => ({}),
});
simular('src/database/warnings.js', {
  getWarnings: (guildId, userId) => advertencias[guildId]?.[userId] || [],
  getAllGuildWarnings: (guildId) => advertencias[guildId] || {},
});
const advertencias = {
  'guild-1': {
    'user-9': [
      { id: 'w1', reason: 'Spam', moderatorId: 'mod-1', timestamp: '2026-01-01T00:00:00.000Z' },
      { id: 'w2', reason: 'Insultos', moderatorId: 'mod-1', timestamp: '2026-02-01T00:00:00.000Z' },
    ],
  },
};
const guardados = [];
simular('src/utils/configEdit.js', {
  guardarCampo: (guildId, seccion, campo, valor) => guardados.push({ guildId, seccion, campo, valor }),
});

const pruebas = [];
const prueba = (nombre, fn) => pruebas.push({ nombre, fn });

/**
 * Construye una interacción falsa con las opciones indicadas.
 * @param {Object} opciones - Opciones getString/getBoolean/getChannel
 * @returns {Object} Interacción con reply capturable
 */
const interaccion = (opciones = {}) => {
  const estado = { reply: null };
  const datos = {
    guild: {
      id: 'guild-1', name: 'Servidor', memberCount: 42,
      iconURL: () => '', premiumSubscriptionCount: 0,
    },
    guildId: 'guild-1',
    user: {
      id: 'user-1', username: 'Usuario', tag: 'Usuario#0001',
      displayAvatarURL: () => '', createdTimestamp: Date.now(),
    },
    memberPermissions: { has: () => opciones.admin === true },
    channel: { id: '111111111111111111' },
    client: { commands: new Collection() },
    options: {
      getString: (nombre) => opciones[nombre],
      getBoolean: (nombre) => opciones[nombre],
      getChannel: (nombre) => opciones[nombre],
      getUser: (nombre) => opciones[nombre] || null,
      getRole: (nombre) => opciones[nombre] || null,
      getInteger: (nombre) => opciones[nombre],
      getSubcommand: () => opciones.sub || undefined,
      getSubcommandGroup: () => undefined,
    },
    reply: async (respuesta) => { estado.reply = respuesta; },
  };
  return { datos, estado };
};

// ---------------------------------------------------------------------------
// Pruebas generales: todos los comandos cargan y el help los incluye
// ---------------------------------------------------------------------------
prueba('todos los comandos cargan y tienen definición válida', () => {
  const comandos = new Collection();
  for (const archivo of fs.readdirSync(ruta('src/commands')).filter(f => f.endsWith('.js'))) {
    const cmd = require(ruta(`src/commands/${archivo}`));
    assert(cmd.data instanceof SlashCommandBuilder, `${archivo} no es SlashCommandBuilder`);
    assert.strictEqual(typeof cmd.execute, 'function', `${archivo} sin execute`);
    comandos.set(cmd.data.name, cmd);
  }
  assert(comandos.size >= 35, `solo ${comandos.size} comandos`);
  for (const nombre of ['remind-list', 'poll-close', 'say']) {
    assert(comandos.has(nombre), `falta /${nombre}`);
  }
  return comandos;
});

prueba('el help incluye automáticamente los comandos nuevos', async (comandos) => {
  const help = require(ruta('src/commands/help.js'));
  const { datos, estado } = interaccion();
  datos.client.commands = comandos;
  await help.execute(datos);
  const texto = estado.reply.embeds[0].toJSON().fields.map(f => f.value).join('\n');
  for (const nombre of comandos.keys()) assert(texto.includes(`\`/${nombre}`), `falta /${nombre} en help`);
  assert(texto.includes('`/remind-list [todos]`'), 'sintaxis de /remind-list');
  assert(texto.includes('`/poll-close <mensaje> [canal]`'), 'sintaxis de /poll-close');
  assert(texto.includes('`/say <canal> <mensaje>`'), 'sintaxis de /say');
});

// ---------------------------------------------------------------------------
// Tanda 1: /remind-list
// ---------------------------------------------------------------------------
prueba('/remind-list solo muestra los propios y excluye vencidos', async () => {
  const cmd = require(ruta('src/commands/remind-list.js'));
  const { datos, estado } = interaccion();
  await cmd.execute(datos);
  assert.strictEqual(estado.reply.ephemeral, true);
  const texto = estado.reply.embeds[0].toJSON().description;
  assert(texto.includes('Mi recordatorio'), 'incluye el propio');
  assert(!texto.includes('Recordatorio ajeno'), 'excluye el ajeno');
  assert(!texto.includes('Ya vencido'), 'excluye el vencido');
});

prueba('/remind-list con todos requiere admin y muestra los ajenos', async () => {
  const cmd = require(ruta('src/commands/remind-list.js'));
  const sinPermiso = interaccion({ todos: true });
  await cmd.execute(sinPermiso.datos);
  assert(sinPermiso.estado.reply.content.includes('administrador'), 'niega a no admin');

  const conPermiso = interaccion({ todos: true, admin: true });
  await cmd.execute(conPermiso.datos);
  const texto = conPermiso.estado.reply.embeds[0].toJSON().description;
  assert(texto.includes('Mi recordatorio') && texto.includes('Recordatorio ajeno'), 'muestra todos');
  assert(!texto.includes('Ya vencido'), 'sigue excluyendo vencidos');
});

// ---------------------------------------------------------------------------
// Tanda 1: /poll-close
// ---------------------------------------------------------------------------
prueba('/poll-close cierra la encuesta y publica resultados', async () => {
  const cmd = require(ruta('src/commands/poll-close.js'));
  const mensaje = {
    author: { bot: true },
    content: '📊 **¿Pizza o tacos?**',
    reactions: {
      cache: new Map([
        ['a', { emoji: '1️⃣', count: 4 }],
        ['b', { emoji: '2️⃣', count: 2 }],
      ]),
      removeAll: async () => { mensaje.reactionsRemovidas = true; },
    },
    edit: async (payload) => { mensaje.editado = payload; },
  };
  const canal = { messages: { fetch: async (id) => { mensaje.idBuscado = id; return mensaje; } } };
  const { datos, estado } = interaccion({
    mensaje: 'https://discord.com/channels/999/888/123456789012345678',
    canal,
  });
  await cmd.execute(datos);
  assert.strictEqual(mensaje.idBuscado, '123456789012345678', 'extrae ID del enlace');
  assert(mensaje.editado.content.includes('Encuesta cerrada'), 'marca como cerrada');
  assert(mensaje.editado.content.includes('1️⃣ **3**'), 'descuenta el voto del bot');
  assert(mensaje.editado.content.includes('2️⃣ **1**'), 'segundo resultado');
  assert.strictEqual(mensaje.reactionsRemovidas, true, 'quita reacciones');
  assert(estado.reply.content.startsWith('✅'), 'confirma');
});

prueba('/poll-close rechaza mensajes que no son del bot', async () => {
  const cmd = require(ruta('src/commands/poll-close.js'));
  const canal = { messages: { fetch: async () => ({ author: { bot: false }, content: 'hola' }) } };
  const { datos, estado } = interaccion({ mensaje: '123456789012345678', canal });
  await cmd.execute(datos);
  assert(estado.reply.content.includes('no es una encuesta'), 'rechaza mensaje ajeno');
});

// ---------------------------------------------------------------------------
// Tanda 1: /say
// ---------------------------------------------------------------------------
prueba('/say solo lo puede usar el dueño', async () => {
  const cmd = require(ruta('src/commands/say.js'));
  const canal = { type: 0, send: async () => { canal.enviado = true; } };

  const ajeno = interaccion({ canal, mensaje: 'hola', user: { id: 'otro' } });
  ajeno.datos.user = { id: 'otro' };
  await cmd.execute(ajeno.datos);
  assert(ajeno.estado.reply.content.includes('dueño'), 'niega a otro usuario');
  assert(!canal.enviado, 'no envía mensaje ajeno');

  const dueno = interaccion({ canal, mensaje: 'hola' });
  dueno.datos.user = { id: 'owner-1' };
  await cmd.execute(dueno.datos);
  assert.strictEqual(canal.enviado, true, 'el dueño sí envía');
  assert(dueno.estado.reply.content.startsWith('✅'), 'confirma');
});

// ---------------------------------------------------------------------------
// Tanda 2: /preview y su helper
// ---------------------------------------------------------------------------
prueba('el helper de preview resuelve las variables como los eventos reales', () => {
  const { construirMensajePreview } = require(ruta('src/utils/previewMessage.js'));
  const guild = { id: 'guild-1', name: 'Servidor', memberCount: 42, iconURL: () => '' };
  const usuario = {
    id: 'user-1', username: 'Ana', tag: 'Ana#0001',
    displayAvatarURL: () => 'http://avatar', createdTimestamp: Date.now(),
  };
  const bienvenida = construirMensajePreview({
    guild, guildId: 'guild-1', tipo: 'welcome', usuario,
  });
  assert(bienvenida.mensaje.includes('Ana') && bienvenida.mensaje.includes('Servidor'), 'variables de texto');
  assert.strictEqual(bienvenida.embed.toJSON().title, 'Hola Ana', 'variables en embed');
  assert.strictEqual(bienvenida.canalId, '222222222222222222', 'canal configurado');

  const ban = construirMensajePreview({
    guild, guildId: 'guild-1', tipo: 'ban', usuario, moderador: { id: 'mod-1' },
  });
  assert(ban.mensaje.includes('Ana baneado por <@mod-1>'), 'variables de ban');
});

prueba('/preview envía el mensaje al canal correcto', async () => {
  const cmd = require(ruta('src/commands/preview.js'));
  const enviados = [];
  const canal = { id: '222222222222222222', send: async (payload) => enviados.push(payload) };
  const guild = {
    id: 'guild-1', name: 'Servidor', memberCount: 42, iconURL: () => '',
    channels: { cache: new Map([['222222222222222222', canal]]) },
  };
  const { datos, estado } = interaccion({ tipo: 'welcome', canal, admin: true });
  datos.guild = guild;
  await cmd.execute(datos);
  assert.strictEqual(enviados.length, 1, 'envía un mensaje');
  assert(enviados[0].content.includes('Bienvenido'), 'contenido resuelto');
  assert.strictEqual(enviados[0].embeds.length, 1, 'incluye embed');
  assert(estado.reply.content.startsWith('✅'), 'confirma');
});

prueba('/preview avisa si la sección está vacía', async () => {
  const cmd = require(ruta('src/commands/preview.js'));
  const original = { message: configGuild.ban.message, embedEnabled: configGuild.ban.embedEnabled };
  configGuild.ban.message = '';
  configGuild.ban.embedEnabled = false;
  try {
    const { datos, estado } = interaccion({ tipo: 'ban', admin: true });
    await cmd.execute(datos);
    assert(estado.reply.content.includes('no tiene mensaje configurado'), 'avisa configuración vacía');
  } finally {
    configGuild.ban.message = original.message;
    configGuild.ban.embedEnabled = original.embedEnabled;
  }
});

// ---------------------------------------------------------------------------
// Tanda 2: /announce-preview
// ---------------------------------------------------------------------------
prueba('/announce-preview genera un embed privado con mención y color', async () => {
  const cmd = require(ruta('src/commands/announce-preview.js'));
  const { datos, estado } = interaccion({
    titulo: 'Aviso', mensaje: 'Hola a todos', color: '#ff0000', mencion: { id: 'rol-1' },
  });
  await cmd.execute(datos);
  const embed = estado.reply.embeds[0];
  assert.strictEqual(estado.reply.ephemeral, true, 'es privado');
  assert.strictEqual(embed.title, 'Aviso');
  assert.strictEqual(embed.description, 'Hola a todos');
  assert(estado.reply.content.includes('<@&rol-1>'), 'muestra la mención');
});

// ---------------------------------------------------------------------------
// Tanda 2: /dm-template
// ---------------------------------------------------------------------------
prueba('/dm-template consulta el template sin permiso de dueño', async () => {
  const cmd = require(ruta('src/commands/dm-template.js'));
  const { datos, estado } = interaccion();
  await cmd.execute(datos);
  assert(estado.reply.content.includes('Template actual'), 'muestra el template');
  assert.strictEqual(guardados.length, 0, 'no escribe nada');
});

prueba('/dm-template solo permite editar al dueño', async () => {
  const cmd = require(ruta('src/commands/dm-template.js'));
  const ajeno = interaccion({ mensaje: 'nuevo DM' });
  ajeno.datos.user = { id: 'otro' };
  await cmd.execute(ajeno.datos);
  assert(ajeno.estado.reply.content.includes('dueño'), 'niega a otro usuario');
  assert.strictEqual(guardados.length, 0, 'no guarda');

  const dueno = interaccion({ mensaje: 'nuevo DM' });
  dueno.datos.user = { id: 'owner-1' };
  await cmd.execute(dueno.datos);
  assert.strictEqual(guardados.length, 1, 'guarda una vez');
  assert.strictEqual(guardados[0].campo, 'message');
  assert.strictEqual(guardados[0].seccion, 'privateWelcome');
  assert.strictEqual(guardados[0].valor, 'nuevo DM');
});

// ---------------------------------------------------------------------------
// Tanda 2: /modlog
// ---------------------------------------------------------------------------
prueba('/modlog lista advertencias ordenadas y filtra por usuario', async () => {
  const cmd = require(ruta('src/commands/modlog.js'));
  const general = interaccion({ admin: true });
  await cmd.execute(general.datos);
  const descripcion = general.estado.reply.embeds[0].toJSON().description;
  assert(descripcion.indexOf('Insultos') < descripcion.indexOf('Spam'), 'más reciente primero');
  assert(general.estado.reply.embeds[0].toJSON().footer.text.includes('2 advertencia'), 'contador');

  const filtrado = interaccion({ admin: true, usuario: { id: 'user-9' } });
  await cmd.execute(filtrado.datos);
  assert(filtrado.estado.reply.embeds[0].toJSON().description.includes('Insultos'), 'filtra por usuario');
});

prueba('/modlog exige permiso y avisa cuando no hay datos', async () => {
  const cmd = require(ruta('src/commands/modlog.js'));
  const sinPermiso = interaccion();
  await cmd.execute(sinPermiso.datos);
  assert(sinPermiso.estado.reply.content.includes('gestionar mensajes'), 'niega sin permiso');

  const vacio = interaccion({ admin: true });
  vacio.datos.guildId = 'sin-datos';
  await cmd.execute(vacio.datos);
  assert(vacio.estado.reply.content.includes('No hay advertencias'), 'avisa si está vacío');
});

// ---------------------------------------------------------------------------
// Tanda 3: /reaction-role
// ---------------------------------------------------------------------------
prueba('/reaction-role list muestra los grupos configurados', async () => {
  const cmd = require(ruta('src/commands/reaction-role.js'));
  const { datos, estado } = interaccion({ sub: 'list', admin: true });
  await cmd.execute(datos);
  const texto = estado.reply.embeds[0].toJSON().description;
  assert(texto.includes('🎮') === false, 'no muestra emojis sueltos');
  assert(texto.includes('emojis') && texto.includes('menú'), 'muestra ambos modos');
  assert(texto.includes('sin enviar'), 'indica que no están enviados');
});

prueba('/reaction-role send en modo emoji guarda el messageId', async () => {
  const cmd = require(ruta('src/commands/reaction-role.js'));
  const mensaje = { id: 'msg-999', react: async (emoji) => { mensaje.reaccion = emoji; } };
  const canal = { send: async (payload) => { canal.enviado = payload; return mensaje; } };
  const { datos, estado } = interaccion({ sub: 'send', grupo: 1, canal, admin: true });
  const antes = escriturasConfig.length;
  await cmd.execute(datos);
  assert.strictEqual(mensaje.reaccion, '🎮', 'reacciona con el emoji configurado');
  assert.strictEqual(canal.enviado.embeds.length, 1, 'envía el embed');
  assert.strictEqual(escriturasConfig.length, antes + 1, 'guarda la configuración');
  assert.strictEqual(escriturasConfig[antes].datos.autoRole.reactionRoles[0].messageId, 'msg-999', 'persiste el messageId');
  assert(estado.reply.content.startsWith('✅'), 'confirma');
});

prueba('/reaction-role send en modo select envía el menú y respeta permisos', async () => {
  const cmd = require(ruta('src/commands/reaction-role.js'));
  const mensaje = { id: 'msg-1000' };
  const canal = { send: async (payload) => { canal.enviado = payload; return mensaje; } };

  const sinPermiso = interaccion({ sub: 'send', grupo: 2, canal });
  await cmd.execute(sinPermiso.datos);
  assert(sinPermiso.estado.reply.content.includes('administrador'), 'niega a no admin');
  assert(!canal.enviado, 'no envía mensaje');

  const { datos, estado } = interaccion({ sub: 'send', grupo: 2, canal, admin: true });
  await cmd.execute(datos);
  const componente = canal.enviado.components[0].toJSON();
  assert.strictEqual(componente.components[0].custom_id, 'reaction_role_select', 'customId del select');
  assert.strictEqual(componente.components[0].options[0].value, 'rol-2', 'opción del rol');
  assert(estado.reply.content.startsWith('✅'), 'confirma');
});

prueba('/reaction-role rechaza un grupo inexistente', async () => {
  const cmd = require(ruta('src/commands/reaction-role.js'));
  const { datos, estado } = interaccion({ sub: 'send', grupo: 99, admin: true });
  await cmd.execute(datos);
  assert(estado.reply.content.includes('No existe el grupo'), 'avisa grupo inválido');
});

// ---------------------------------------------------------------------------
// Panel de comandos: helper compartido con /help y /api/commands
// ---------------------------------------------------------------------------
prueba('commandInfo genera la misma sintaxis para help y el dashboard', () => {
  const { variantesDe, seccionDe, resumenDe } = require(ruta('src/utils/commandInfo.js'));

  // Un comando simple con argumentos obligatorios y opcionales.
  const simple = { name: 'poll-close', description: 'Cerrar encuesta', options: [
    { name: 'mensaje', type: 3, required: true },
    { name: 'canal', type: 7, required: false },
  ] };
  assert.deepStrictEqual(variantesDe(simple), [
    { sintaxis: '/poll-close <mensaje> [canal]', descripcion: 'Cerrar encuesta' },
  ]);

  // Un comando con subcomando (como /owner panel) se expande en una línea.
  const conSub = { name: 'owner', description: 'Dueño', options: [
    { name: 'panel', type: 1, description: 'Abrir panel', options: [] },
  ] };
  assert.strictEqual(variantesDe(conSub)[0].sintaxis, '/owner panel');

  // Clasificación y fallback para comandos nuevos no clasificados.
  assert(seccionDe('ban').includes('Moderación'), 'sección de ban');
  assert.strictEqual(seccionDe('comando-nuevo'), '🔧 Otros');
  assert.strictEqual(resumenDe(simple).nombre, 'poll-close');
});

prueba('el help sigue incluyendo todas las variantes tras el refactor', async () => {
  const { variantesDe } = require(ruta('src/utils/commandInfo.js'));
  const help = require(ruta('src/commands/help.js'));
  const comandos = new Collection();
  for (const archivo of fs.readdirSync(ruta('src/commands')).filter(f => f.endsWith('.js'))) {
    const cmd = require(ruta(`src/commands/${archivo}`));
    comandos.set(cmd.data.name, cmd);
  }
  const { datos, estado } = interaccion();
  datos.client.commands = comandos;
  await help.execute(datos);
  const texto = estado.reply.embeds[0].toJSON().fields.map(f => f.value).join('\n');
  for (const cmd of comandos.values()) {
    for (const v of variantesDe(cmd.data.toJSON())) {
      assert(texto.includes(`\`${v.sintaxis}\``), `falta ${v.sintaxis}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Motor de plantillas: variables custom, arrays, funciones y anidación
// ---------------------------------------------------------------------------
prueba('replaceVars mantiene el resultado original sin variables custom', () => {
  const { replaceVars } = require(ruta('src/utils/replaceVars.js'));
  const { resolverPlantillas } = require(ruta('src/utils/templateEngine.js'));

  // Miembro falso con los mismos métodos que expone discord.js.
  const member = {
    id: '1',
    user: {
      username: 'Ana', tag: 'Ana#0001', createdTimestamp: 1700000000000,
      displayAvatarURL: () => 'https://avatar/1.png',
    },
    joinedTimestamp: 1700000100000,
    guild: { id: 'g1', name: 'Servidor', memberCount: 147, premiumSubscriptionCount: 3, iconURL: () => 'https://icon/g1.png' },
  };

  for (const texto of [
    'Hola {user} en {server} ({memberCount})',
    '{user.name} / {user.id} / {user.avatar} / {user.tag}',
    '{user.createdAt} - {user.joinedAt} - {boost} - {server.icon}',
    '{date} {time}',
  ]) {
    assert.strictEqual(resolverPlantillas(texto, { fuente: member }), replaceVars(texto, member), texto);
  }

  // Ban: rama distinta de miembro.
  const ban = {
    user: { id: '2', username: 'Beto', tag: 'Beto#0002', displayAvatarURL: () => 'https://avatar/2.png' },
    guild: { id: 'g1', name: 'Servidor', memberCount: 147 },
    executor: { id: '3' },
    reason: 'spam',
  };
  assert.strictEqual(
    resolverPlantillas('{user} baneado por {moderator}: {reason}', { fuente: ban }),
    replaceVars('{user} baneado por {moderator}: {reason}', ban),
  );
});

prueba('variables del sistema nunca son sobrescribibles por variables custom', () => {
  const { resolverPlantillas } = require(ruta('src/utils/templateEngine.js'));
  const biblioteca = { variables: {
    v1: { id: 'v1', nombre: 'user', valor: 'HACK', global: true },
    v2: { id: 'v2', nombre: 'server', valor: 'HACK', global: true },
    v3: { id: 'v3', nombre: 'date', valor: 'HACK', global: true },
  } };
  const salida = resolverPlantillas('{user} | {server} | {date}', {
    fuente: { user: '<@1>', server: 'Real' }, biblioteca, guildId: 'g1',
  });
  assert(salida.startsWith('<@1> | Real | '), salida);
  assert(!salida.includes('HACK'), salida);
});

prueba('scope global con override por servidor', () => {
  const { resolverPlantillas } = require(ruta('src/utils/templateEngine.js'));
  const biblioteca = { variables: {
    v1: { id: 'v1', nombre: 'prefijo', valor: 'GLOBAL', global: true, valoresPorServidor: { g1: 'LOCAL' } },
    v2: { id: 'v2', nombre: 'soloUno', valor: 'A', servidores: ['g1'] },
  } };
  const plantilla = { fuente: {}, biblioteca };
  assert.strictEqual(resolverPlantillas('{prefijo}', { ...plantilla, guildId: 'g1' }), 'LOCAL');
  assert.strictEqual(resolverPlantillas('{prefijo}', { ...plantilla, guildId: 'g2' }), 'GLOBAL');
  assert.strictEqual(resolverPlantillas('{soloUno}', { ...plantilla, guildId: 'g1' }), 'A');
  assert.strictEqual(resolverPlantillas('{soloUno}', { ...plantilla, guildId: 'g2' }), '');
});

prueba('arrays guardados, anidación y las cinco funciones', () => {
  const { resolverPlantillas } = require(ruta('src/utils/templateEngine.js'));
  const biblioteca = {
    variables: {
      v1: { id: 'v1', nombre: 'Saludos', valor: ['Hola {user}', 'Qué tal {user}', 'Bienvenido'], global: true },
      v2: { id: 'v2', nombre: 'prefijo', valor: 'SRV', global: true },
    },
    plantillas: {
      p1: { id: 'p1', nombre: 'bienvenida', contenido: '{nombre}, {dato}!', parametros: ['nombre', 'dato'], global: true },
    },
  };
  const base = { fuente: { user: '<@1>' }, biblioteca, guildId: 'g1' };

  // Array como tipo propio: se convierte a texto separado por comas.
  assert.strictEqual(resolverPlantillas('{Saludos}', base), 'Hola <@1>, Qué tal <@1>, Bienvenido');
  // random inyectado: siempre el primero.
  assert.strictEqual(resolverPlantillas('{aleatorio(valores:"{Saludos}")}', { ...base, random: () => 0 }), 'Hola <@1>');
  assert.strictEqual(resolverPlantillas('{aleatorio(valores:"{Saludos}", rango:"1,2")}', { ...base, random: () => 0.9 }), 'Qué tal <@1>');
  assert.strictEqual(resolverPlantillas('{aleatorio(valores:["A {user}", "B"])}', { ...base, random: () => 0 }), 'A <@1>');
  // Variable dentro de función, y función dentro de función.
  assert.strictEqual(resolverPlantillas('{mayusculas(texto:"{prefijo}")}', base), 'SRV');
  assert.strictEqual(resolverPlantillas('{minusculas(texto:"{mayusculas(texto:"hola")}")}', base), 'hola');
  // Plantilla con parámetros resueltos en el scope del llamador.
  assert.strictEqual(
    resolverPlantillas('{plantilla(id:"bienvenida", nombre:"{user}", dato:"eres genial")}', base),
    '<@1>, eres genial!',
  );
  // Condiciones numéricas y de texto.
  const si = (condicion) => resolverPlantillas(
    `{si(condicion:"${condicion}", verdadero:"SI", falso:"NO")}`,
    { ...base, fuente: { user: '<@1>', memberCount: '147', server: 'Servidor' } },
  );
  assert.strictEqual(si('{memberCount} >= 100'), 'SI');
  assert.strictEqual(si('{memberCount} < 100'), 'NO');
  assert.strictEqual(si('{server} contiene Serv'), 'SI');
  assert.strictEqual(si('{server} == Otro'), 'NO');
});

prueba('errores: visibles solo con debug, ciclos y anidación limitada', () => {
  const { resolverPlantillas } = require(ruta('src/utils/templateEngine.js'));
  const biblioteca = {
    variables: {
      v1: { id: 'v1', nombre: 'cicloA', valor: '{cicloB}', global: true },
      v2: { id: 'v2', nombre: 'cicloB', valor: '{cicloA}', global: true },
      v3: { id: 'v3', nombre: 'debugOn', valor: '{noExiste}', global: true, debug: true },
      v4: { id: 'v4', nombre: 'fueraDeServidor', valor: 'X', servidores: ['otro'] },
    },
    plantillas: {
      p1: { id: 'p1', nombre: 'recursiva', contenido: '{plantilla(id:"recursiva")}', parametros: [], global: true },
    },
  };
  const base = { fuente: {}, biblioteca, guildId: 'g1' };

  assert.strictEqual(resolverPlantillas('{noExiste}', base), '');
  assert.strictEqual(resolverPlantillas('{noExiste}', { ...base, debug: true }), '⚠️ Variable no disponible: {noExiste}');
  assert(resolverPlantillas('{debugOn}', base).includes('⚠️'), 'debug por variable');
  assert.strictEqual(resolverPlantillas('{fueraDeServidor}', base), '');
  assert.strictEqual(resolverPlantillas('{fueraDeServidor}', { ...base, debug: true }), '⚠️ Variable no disponible en este servidor: {fueraDeServidor}');
  assert(resolverPlantillas('{cicloA}', { ...base, debug: true }).includes('Ciclo detectado'));
  assert(resolverPlantillas('{plantilla(id:"recursiva")}', { ...base, debug: true }).includes('Ciclo detectado'));
  assert(resolverPlantillas('{nope(texto:"x")}', { ...base, debug: true }).includes('Función desconocida'));
  assert(resolverPlantillas('{plantilla(id:"bienvenida")}', { ...base, debug: true }).includes('no disponible'));
  assert(resolverPlantillas('{aleatorio(valores:[])}', { ...base, debug: true }).includes('al menos un valor'));
  assert(resolverPlantillas('{si(condicion:"mal", verdadero:"SI", falso:"NO")}', { ...base, debug: true }).includes('Condición inválida'));
});

prueba('parser respeta espacios, comillas, escapes y llaves literales', () => {
  const { resolverPlantillas, FUNCIONES_INFO, normalizarArray } = require(ruta('src/utils/templateEngine.js'));
  const base = { fuente: { user: '<@1>' }, biblioteca: { variables: {
    v1: { id: 'v1', nombre: 'espacios', valor: '  {user}  ', global: true },
  } }, guildId: 'g1' };

  assert.strictEqual(resolverPlantillas('  {user}  ', base), '  <@1>  ');
  assert.strictEqual(resolverPlantillas('[{espacios}]', base), '[  <@1>  ]');
  assert.strictEqual(resolverPlantillas('esto no es variable {', base), 'esto no es variable {');
  assert.strictEqual(resolverPlantillas('{aleatorio(valores:["lunes", "martes"])}', { ...base, random: () => 0.99 }), 'martes');
  assert.deepStrictEqual(normalizarArray('a, b\nc'), ['a', 'b', 'c']);
  assert.deepStrictEqual(normalizarArray('["a", "b"]'), ['a', 'b']);
  // La guía de sintaxis expone las cinco funciones esperadas.
  const nombres = FUNCIONES_INFO.map((f) => f.nombre);
  for (const nombre of ['aleatorio', 'plantilla', 'mayusculas', 'minusculas', 'si']) {
    assert(nombres.includes(nombre), `falta ${nombre} en la guía`);
  }
  assert(FUNCIONES_INFO.every((f) => f.ejemplo && f.descripcion), 'la guía trae ejemplo y descripción');
});

prueba('casos límite: profundidad, comas, arrays anidados y argumentos faltantes', () => {
  const { resolverPlantillas } = require(ruta('src/utils/templateEngine.js'));
  const biblioteca = {
    variables: {
      v1: { id: 'v1', nombre: 'profunda', valor: '{n1}', global: true },
      v2: { id: 'v2', nombre: 'n1', valor: '{n2}', global: true },
      v3: { id: 'v3', nombre: 'n2', valor: '{n3}', global: true },
      v4: { id: 'v4', nombre: 'n3', valor: '{n4}', global: true },
      v5: { id: 'v5', nombre: 'n4', valor: '{n5}', global: true },
      v6: { id: 'v6', nombre: 'n5', valor: 'FIN', global: true },
      v7: { id: 'v7', nombre: 'comas', valor: ['Hola, mundo', 'Adiós'], global: true },
      v8: { id: 'v8', nombre: 'matriz', valor: [['a', 'b'], ['c']], global: true },
    },
    plantillas: {
      p1: { id: 'p1', nombre: 'conArreglo', contenido: '{elem}', parametros: ['elem'], global: true },
    },
  };
  const base = { fuente: { user: '<@1>' }, biblioteca, guildId: 'g1' };

  assert.strictEqual(
    resolverPlantillas('{aleatorio(valores:["Hola, mundo", "Adiós"])}', { ...base, random: () => 0 }),
    'Hola, mundo',
    'la coma dentro de comillas no separa argumentos',
  );
  assert.strictEqual(
    resolverPlantillas('{aleatorio(valores:"{comas}")}', { ...base, random: () => 0 }),
    'Hola, mundo',
    'array guardado con comas',
  );
  assert.strictEqual(resolverPlantillas('{matriz}', base), 'a, b, c', 'array de arrays se aplana');
  assert.strictEqual(
    resolverPlantillas('{plantilla(id:"conArreglo", elem:"{comas}")}', base),
    'Hola, mundo, Adiós',
    'array como parámetro de plantilla',
  );
  assert.strictEqual(
    resolverPlantillas('{aleatorio(valores:"{comas}", rango:"1")}', { ...base, random: () => 0.9 }),
    'Hola, mundo',
    'rango de un solo número',
  );

  const si = (condicion) => resolverPlantillas(
    `{si(condicion:"${condicion}", verdadero:"SI", falso:"NO")}`,
    { ...base, fuente: { user: '<@1>', memberCount: '147' } },
  );
  assert.strictEqual(si('{memberCount} == 147'), 'SI');
  assert.strictEqual(si('{memberCount} != 147'), 'NO');

  const profunda = resolverPlantillas('{profunda}', { ...base, debug: true });
  assert(profunda.includes('Anidación máxima'), profunda);
  const falta = resolverPlantillas('{mayusculas()}', { ...base, debug: true });
  assert(falta.includes('Falta el argumento'), falta);
});

prueba('regresiones de la revisión: reservadas, espacios, compatibilidad y scopes', () => {
  const { resolverPlantillas } = require(ruta('src/utils/templateEngine.js'));
  const { replaceVars } = require(ruta('src/utils/replaceVars.js'));

  // Un parámetro de plantilla no puede falsificar una mención ni un servidor.
  const conParametrosReservados = {
    plantillas: { p: { id: 'p', parametros: ['user', 'server'], contenido: '{user}|{server}', global: true } },
  };
  assert.strictEqual(
    resolverPlantillas('{plantilla(id:"p", user:"FALSO", server:"FALSO")}', {
      vars: { user: '<@1>', server: 'MiServer' }, biblioteca: conParametrosReservados,
    }),
    '<@1>|MiServer',
  );

  // Los espacios que envuelven una expresión dentro de un argumento se conservan.
  assert.strictEqual(resolverPlantillas('{mayusculas(texto:"  {user}  ")}', { vars: { user: '<@1>' } }), '  <@1>  ');

  // replaceVars sigue respetando date/time propios de un objeto plano y `$&`.
  assert.strictEqual(replaceVars('{date}', { date: 'CUSTOM' }), 'CUSTOM');
  assert(/^CUSTOM \d{2}\/\d{2}\/\d{4}$/.test(replaceVars('{date} {x}', { date: 'CUSTOM', x: '{date}' })), 'fecha original al final');
  assert.strictEqual(replaceVars('Hola {user}', { user: '$&' }), 'Hola $&');
  assert(/^\d{2}\/\d{2}\/\d{4}$/.test(replaceVars('{date}', {})), 'date por defecto');

  // Un override por servidor implica disponibilidad aunque no haya `servidores`.
  assert.strictEqual(resolverPlantillas('{A}', {
    guildId: 'g1',
    biblioteca: { variables: { a: { id: 'a', nombre: 'A', valoresPorServidor: { g1: 'SI' } } } },
  }), 'SI');

  // Definiciones sin `id` no se confunden entre sí como falsos ciclos.
  assert.strictEqual(resolverPlantillas('{A}', {
    biblioteca: { variables: {
      a: { nombre: 'A', valor: '{B}', global: true },
      b: { nombre: 'B', valor: 'OK', global: true },
    } },
  }), 'OK');

  // rango:"1,5" significa "primeros 5", tal como se decidió.
  assert.strictEqual(resolverPlantillas('{aleatorio(valores:"{vals}", rango:"1,5")}', {
    biblioteca: { variables: { v: { id: 'v', nombre: 'vals', valor: ['a', 'b', 'c', 'd', 'e', 'f'], global: true } } },
    random: () => 0.99,
  }), 'e');

  // Arrays dentro de arrays conservan sus elementos y las comas literales.
  const conArray = { biblioteca: { variables: {
    a: { id: 'a', nombre: 'A', valor: ['uno, dos', 'tres'], global: true },
  } } };
  assert.strictEqual(resolverPlantillas('{aleatorio(valores:["{A}"])}', { ...conArray, random: () => 0 }), 'uno, dos');
  assert.strictEqual(resolverPlantillas('{aleatorio(valores:["hola, mundo"])}', { random: () => 0 }), 'hola, mundo');

  // Un apóstrofo no cierra una cadena escrita con comillas simples.
  assert.strictEqual(resolverPlantillas("{mayusculas(texto:'don't')}", { debug: true }), "DON'T");

  // JSON y llaves escapadas no se borran ni se interpretan como variables.
  assert.strictEqual(resolverPlantillas('Config: {"user":"ana"}', { debug: true }), 'Config: {"user":"ana"}');
  assert.strictEqual(resolverPlantillas('\\{user\\}', { vars: { user: 'X' } }), '{user}');

  // Argumentos posicionales siguen funcionando con la validación de requeridos.
  assert.strictEqual(resolverPlantillas('{aleatorio("a,b")}', { random: () => 0 }), 'a');
  assert.strictEqual(resolverPlantillas('{mayusculas("hola")}', {}), 'HOLA');

  // Un backslash literal antes de n no se convierte en salto de línea.
  assert.strictEqual(resolverPlantillas('{mayusculas(texto:"C:\\\\new")}', {}), 'C:\\NEW');

  // El ID de plantilla es obligatorio: no se toma un parámetro como ID.
  assert(resolverPlantillas('{plantilla(nombre:"p", x:"1")}', { debug: true }).includes('Falta el argumento "id"'));

  // No se accede a propiedades del prototipo al buscar plantillas.
  assert(resolverPlantillas('{plantilla(id:"constructor")}', { debug: true }).includes('Plantilla no disponible: constructor'));

  // El nombre 'reason' es reservado aunque la fuente no sea un ban.
  assert(resolverPlantillas('{reason}', { debug: true }).includes('Variable del sistema no disponible'));
});

prueba('la biblioteca guardada se aplica a mensajes y embeds reales', () => {
  const { getBiblioteca, guardarBiblioteca } = require(ruta('src/database/messageVariables.js'));
  const { replaceVars } = require(ruta('src/utils/replaceVars.js'));
  const { buildEmbed } = require(ruta('src/utils/buildEmbed.js'));

  bibliotecaEnMemoria = { variables: {}, plantillas: {} };
  const guardado = guardarBiblioteca({
    variables: {
      n1: { nombre: 'reglas', descripcion: 'Enlace', valor: 'https://ejemplo', global: true },
      n2: { nombre: 'Saludos', tipo: 'array', valor: ['Hola {user}', 'Yeee'], global: true, valoresPorServidor: { '123456789012345678': 'Solo aquí' } },
    },
    plantillas: {
      p1: { nombre: 'bienvenida', contenido: '{nombre} -> {reglas}', parametros: ['nombre'], global: true },
    },
  });
  assert(guardado.ok, guardado.error);
  assert.strictEqual(Object.keys(getBiblioteca().variables).length, 2);

  const fuente = {
    id: '1',
    guild: { id: '123456789012345678', name: 'Servidor', memberCount: 5, iconURL: () => '' },
    user: { username: 'Ana', tag: 'Ana#1', createdTimestamp: 1, displayAvatarURL: () => '' },
    joinedTimestamp: 1,
  };
  assert.strictEqual(replaceVars('Enlace: {reglas}', fuente), 'Enlace: https://ejemplo');
  assert.strictEqual(replaceVars('{Saludos}', fuente), 'Solo aquí', 'el override por servidor gana');
  assert.strictEqual(
    replaceVars('{plantilla(id:"bienvenida", nombre:"{user.name}")}', fuente),
    'Ana -> https://ejemplo',
  );
  assert.strictEqual(buildEmbed({ title: '{reglas}' }, fuente).toJSON().title, 'https://ejemplo');
});

prueba('validación de la biblioteca: reservados, duplicados y tamaños', () => {
  const { guardarBiblioteca, validarNombre } = require(ruta('src/database/messageVariables.js'));
  const { VARIABLES_SISTEMA_INFO } = require(ruta('src/utils/varsBase.js'));

  assert(validarNombre('user'), 'usuario reservado');
  assert(validarNombre('user.name'), 'variable compuesta reservada');
  assert(validarNombre('constructor'), 'propiedad del prototipo');
  assert.strictEqual(validarNombre('saludos123'), null, 'nombre normal aceptado');

  const reservada = guardarBiblioteca({ variables: { x: { nombre: 'server', valor: 'x', global: true } } });
  assert(!reservada.ok && reservada.error.includes('sistema'));
  const duplicado = guardarBiblioteca({ variables: {
    a: { nombre: 'uno', valor: 'x' }, b: { nombre: 'uno', valor: 'y' },
  } });
  assert(!duplicado.ok && duplicado.error.includes('duplicado'));
  const grande = guardarBiblioteca({ variables: { a: { nombre: 'grande', valor: 'x'.repeat(5000) } } });
  assert(!grande.ok, 'valor demasiado grande');

  assert(VARIABLES_SISTEMA_INFO.some((v) => v.nombre === 'memberCount'), 'guía trae memberCount');
  assert(VARIABLES_SISTEMA_INFO.some((v) => v.categoria === 'Moderación'), 'guía trae moderator/reason');
});

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------
(async () => {
  let comandos;
  for (const { nombre, fn } of pruebas) {
    comandos = await fn(comandos);
    console.log(`  ✅ ${nombre}`);
  }
  console.log(`\n${pruebas.length} pruebas superadas`);
})().catch((e) => {
  console.error('\n❌ Prueba fallida:', e);
  process.exit(1);
});
