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
