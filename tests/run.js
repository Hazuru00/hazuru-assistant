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
    guild: { id: 'guild-1', name: 'Servidor' },
    guildId: 'guild-1',
    user: { id: 'user-1', tag: 'Usuario#0001' },
    memberPermissions: { has: () => opciones.admin === true },
    channel: { id: '111111111111111111' },
    client: { commands: new Collection() },
    options: {
      getString: (nombre) => opciones[nombre],
      getBoolean: (nombre) => opciones[nombre],
      getChannel: (nombre) => opciones[nombre],
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
