/**
 * ============================================================================
 * HAZURU'S ASSISTANT - ARCHIVO PRINCIPAL
 * ============================================================================
 *
 * Este es el punto de entrada de todo el bot. Hace tres cosas a la vez:
 *
 * 1. CREA EL CLIENTE DE DISCORD (discord.js v14)
 *    - Conecta al gateway de Discord
 *    - Carga todos los comandos y eventos
 *    - Responde a slash commands y eventos del servidor
 *
 * 2. CREA UN SERVIDOR WEB (Express + Socket.IO)
 *    - Sirve el frontend (panel de configuración web)
 *    - Expone una API REST para que el frontend configure el bot
 *    - Usa Socket.IO para enviar stats en tiempo real al frontend
 *
 * 3. GESTIONA LA BASE DE DATOS (JSON plano)
 *    - Lee/escribe configuraciones de cada servidor en guilds.json
 *    - Lee/escribe advertencias en warnings.json
 *    - Lee/escribe recordatorios en reminders.json
 *
 * CÓMO AGREGAR UN NUEVO COMANDO:
 *   1. Crear un archivo en src/commands/mi-comando.js
 *   2. Exportar { data: new SlashCommandBuilder(), execute(interaction) {} }
 *   3. Ejecutar: node deploy-commands.js
 *   4. El bot lo carga automáticamente al iniciar
 *
 * CÓMO AGREGAR UN NUEVO EVENTO:
 *   1. Crear un archivo en src/events/mi-evento.js
 *   2. Exportar { name: 'nombreDelEvento', execute(...args) {} }
 *   3. El bot lo carga automáticamente al iniciar
 *
 * VARIABLES DE ENTORNO (.env):
 *   - DISCORD_TOKEN: Token del bot de Discord
 *   - CLIENT_ID: ID de la aplicación de Discord
 *   - GUILD_ID: ID del servidor para registrar comandos
 *   - PORT: Puerto del servidor web (default: 3001)
 * ============================================================================
 */

// Cargar variables de entorno desde .env
require('dotenv').config();

// Imports de discord.js
const { Client, GatewayIntentBits, Collection } = require('discord.js');

// Imports del sistema de archivos (para cargar comandos y eventos dinámicamente)
const fs = require('fs');
const path = require('path');

// Imports del servidor web
const express = require('express');     // Framework web
const http = require('http');           // Servidor HTTP base
const { Server } = require('socket.io'); // WebSockets para tiempo real
const multer = require('multer');       // Para subir imágenes

// Imports de la base de datos local
const { getGuild, updateGuild } = require('./database');
const { getAllReminders, removeReminder } = require('./database/reminders');
const { getSettings, updateSettings } = require('./database/settings');
const { readJson, writeJsonAtomic } = require('./database/atomic');
const {
  listCardAnimations, getCardAnimation,
  createCardAnimation, updateCardAnimation, removeCardAnimation,
} = require('./database/cardAnimations');
const { getBiblioteca, guardarBiblioteca } = require('./database/messageVariables');

// Imports de utilidades
const { logError, logInfo } = require('./utils/logger');
const { replaceVars } = require('./utils/replaceVars');
const { buildEmbed } = require('./utils/buildEmbed');
const { listPresets } = require('./utils/textAnimations');
const { resolverPlantillas, FUNCIONES_INFO } = require('./utils/templateEngine');
const { VARIABLES_SISTEMA_INFO } = require('./utils/varsBase');

// Asegurar que existan los directorios de uploads y logs
const uploadsDir = path.join(__dirname, '..', 'uploads');
const logsDir = path.join(__dirname, '..', 'logs');
const fontsDir = path.join(uploadsDir, 'fonts');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });


// ============================================================================
// 1. CREAR CLIENTE DE DISCORD
// ============================================================================

/**
 * IntentBits = permisos que le pide el bot a Discord.
 * Sin estos permisos, el bot no puede ver ciertos eventos.
 *
 * - Guilds: Acceso a los servidores
 * - GuildMessages: Leer mensajes en servidores
 * - MessageContent: Leer el contenido de los mensajes (obligatorio desde 2022)
 * - GuildMembers: Acceder a la lista de miembros
 * - GuildVoiceStates: Detectar cambios en canales de voz
 * - GuildBans: Detectar bans
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.DirectMessages,
  ],
});

/**
 * Collection de comandos: un Map mejorado de discord.js
 * Guarda todos los comandos cargados, donde la clave es el nombre del comando.
 * Ejemplo: client.commands.get('ping') → devuelve el comando /ping
 */
client.commands = new Collection();


// ============================================================================
// 2. CARGAR COMANDOS DINÁMICAMENTE
// ============================================================================
/**
 * Lee todos los archivos .js de src/commands/ y los registra en client.commands.
 * Cada archivo de comando exporta: { data: SlashCommandBuilder, execute(interaction) }
 *
 * Esto significa que para agregar un nuevo comando, solo creás un archivo
 * en src/commands/ y el bot lo carga solo. No hace falta modificar este archivo.
 */
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    // Validar que el comando tenga la estructura correcta
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    }
  }
}


// ============================================================================
// 3. CARGAR EVENTOS DINÁMICAMENTE
// ============================================================================
/**
 * Lee todos los archivos .js de src/events/ y los registra como listeners.
 * Cada archivo de evento exporta: { name: 'nombreEvento', once?: boolean, execute() }
 *
 * Si `once` es true, el evento se ejecuta solo una vez (ej: clientReady).
 * Si `once` es false o no existe, se ejecuta cada vez que ocurre el evento.
 */
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}


// ============================================================================
// 4. SERVIDOR WEB (EXPRESS + SOCKET.IO)
// ============================================================================
/**
 * Express sirve archivos estáticos y expone una API REST.
 * Socket.IO permite enviar datos en tiempo real al frontend (stats cada 5s).
 * http.createServer envuelve a Express para poder pasarle a Socket.IO.
 */
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos del frontend (HTML, CSS, JS del panel web)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Servir imágenes subidas (fondos de tarjetas de bienvenida/despedida)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Permitir que Express lea JSON en el body de las peticiones (req.body)
app.use(express.json());


// ============================================================================
// 5. CONFIGURACIÓN DE SUBIDA DE IMÁGENES (MULTER)
// ============================================================================
/**
 * Multer maneja la subida de archivos. Configurado para:
 * - Guardar en /uploads
 * - Nombres únicos con timestamp + random
 * - Máximo 8MB por archivo
 * - Solo permitir: jpg, png, gif, webp
 */
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB máximo
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});


// ============================================================================
// 6. ENDPOINTS DE LA API REST
// ============================================================================
/**
 * Estos endpoints son consumidos por el frontend (panel web) para:
 * - Configurar bienvenidas, despedidas, automod, logging, etc.
 * - Subir imágenes de fondo
 * - Obtener información de servidores y canales
 * - Previsualizar mensajes y tarjetas
 *
 * Cada endpoint sigue el patrón: /api/guilds/:id/[seccion]
 * GET = obtener configuración, PUT = actualizar configuración
 */

// --- SUBIDA DE IMÁGENES ---
// POST /api/upload → Sube una imagen y devuelve la URL
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  } catch (e) {
    logError(e, { event: 'api/upload', action: 'Upload image' });
    res.status(500).json({ error: 'Upload failed' });
  }
});

// --- SUBIDA DE FONTS ---
const fontStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'fonts'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const fontUpload = multer({
  storage: fontStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(ttf|otf|woff|woff2)$/i;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(null, ext);
  },
});

app.post('/api/upload-font', fontUpload.single('font'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No font uploaded' });
    const url = `${req.protocol}://${req.get('host')}/uploads/fonts/${req.file.filename}`;
    const name = req.body.name || req.file.originalname.replace(/\.[^.]+$/, '');
    // Guardar nombre en fonts.json
    const metaPath = path.join(__dirname, '..', 'uploads', 'fonts', 'fonts.json');
    const meta = readJson(metaPath, {});
    meta[req.file.filename] = name;
    writeJsonAtomic(metaPath, meta);
    res.json({ url, filename: req.file.filename, name });
  } catch (e) {
    logError(e, { event: 'api/upload-font', action: 'Upload font' });
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/fonts', (req, res) => {
  try {
    const fontDir = path.join(__dirname, '..', 'uploads', 'fonts');
    if (!fs.existsSync(fontDir)) return res.json([]);
    const files = fs.readdirSync(fontDir).filter(f => /\.(ttf|otf|woff|woff2)$/i.test(f));
    const metaPath = path.join(fontDir, 'fonts.json');
    const meta = readJson(metaPath, {});
    const fonts = files.map(f => ({
      filename: f,
      name: meta[f] || f.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
      url: `${req.protocol}://${req.get('host')}/uploads/fonts/${f}`,
    }));
    res.json(fonts);
  } catch (e) {
    res.json([]);
  }
});

app.delete('/api/fonts/:filename', (req, res) => {
  try {
    const fontDir = path.join(__dirname, '..', 'uploads', 'fonts');
    const filePath = path.join(fontDir, req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const metaPath = path.join(fontDir, 'fonts.json');
    const meta = readJson(metaPath, {});
    delete meta[req.params.filename];
    writeJsonAtomic(metaPath, meta);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Delete failed' });
  }
});


// --- PREVISUALIZAR MENSAJES ---
// POST /api/guilds/:id/preview/:type → Envía un preview de bienvenida/despedida/DM a un canal
// type puede ser: 'welcome', 'farewell', 'private'
app.post('/api/guilds/:id/preview/:type', async (req, res) => {
  try {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const { type } = req.params;
    const config = getGuild(req.params.id);

    // Obtener la sección correcta según el tipo
    let section;
    if (type === 'welcome') section = config.welcome;
    else if (type === 'farewell') section = config.farewell;
    else section = config.privateWelcome;

    if (!section.channel && type !== 'private') {
      return res.status(400).json({ error: 'No channel configured' });
    }

    // Buscar el miembro seleccionado o usar el bot como fallback
    let previewUser;
    try {
      const member = await guild.members.fetch(req.body.userId);
      previewUser = {
        id: member.id,
        tag: member.user.tag,
        username: member.user.username,
        displayAvatarURL: () => member.user.displayAvatarURL({ dynamic: true }),
      };
    } catch {
      previewUser = {
        id: guild.members.me?.id || '0',
        tag: client.user.tag,
        username: client.user.username,
        displayAvatarURL: () => client.user.displayAvatarURL({ dynamic: true }),
      };
    }

    // Variables disponibles en los mensajes: {user}, {server}, {memberCount}, etc.
    const vars = {
      user: `<@${previewUser.id}>`,
      userName: previewUser.username,
      userId: previewUser.id,
      userAvatar: previewUser.displayAvatarURL(),
      userTag: previewUser.tag,
      server: guild.name,
      serverId: guild.id,
      serverIcon: guild.iconURL({ dynamic: true }) || '',
      memberCount: guild.memberCount.toString(),
      channel: '#test-preview',
    };

    const message = replaceVars(section.message, vars);

    // Generar tarjeta de imagen si está habilitada (solo para welcome/farewell)
    let attachments = [];
    const card = section.card || {};
    if (card.enabled && (type === 'welcome' || type === 'farewell')) {
      try {
        const { generateCard, generateAnimatedCard } = require('./utils/cardGenerator');
        const memberObj = { user: previewUser, guild };
        let buffer;
        if (card.animated) {
          buffer = await generateAnimatedCard(memberObj, card, type === 'welcome');
        } else {
          buffer = await generateCard(memberObj, card, type === 'welcome');
        }
        const ext = card.animated ? 'gif' : 'png';
        attachments = [{ attachment: buffer, name: `card.${ext}` }];
      } catch (e) {
        logError(e, { event: 'api/preview', guild: { id: req.params.id }, section: type, action: 'Generate card for preview' });
      }
    }

    // Enviar preview: si es privado, enviar DM; si no, enviar al canal
    if (type === 'private') {
      const dmMember = await guild.members.fetch(req.body.userId);
      if (!dmMember) return res.status(400).json({ error: 'Member not found' });
      if (section.embedEnabled) {
        const embed = buildEmbed(section.embed, vars);
        await dmMember.send({ content: message || undefined, embeds: [embed], files: attachments });
      } else {
        await dmMember.send({ content: message, files: attachments });
      }
      res.json({ success: true, target: 'DM' });
    } else {
      const channel = guild.channels.cache.get(section.channel);
      if (!channel) return res.status(400).json({ error: 'Channel not found' });
      if (section.embedEnabled) {
        const embed = buildEmbed(section.embed, vars);
        await channel.send({ content: message || undefined, embeds: [embed], files: attachments });
      } else {
        await channel.send({ content: message, files: attachments });
      }
      res.json({ success: true, target: channel.name });
    }
  } catch (e) {
    logError(e, { event: 'api/preview', guild: { id: req.params.id }, section: req.params.type, action: 'Send preview' });
    res.status(500).json({ error: e.message });
  }
});


// --- ESTADO DEL BOT ---
// Devuelve el estado real del bot.
// "users" es la suma de miembros de todos los servidores: usar
// client.users.cache.size daba un número incompleto que crecía recién cuando
// se abría un servidor y se consultaba /members.
const obtenerStats = () => ({
  status: client.isReady() ? 'online' : 'offline',
  guilds: client.guilds.cache.size,
  users: client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0),
  uptime: client.uptime,
});

// GET /api/status → Devuelve si el bot está online, cuántos servidores, usuarios, uptime
app.get('/api/status', (req, res) => {
  res.json(obtenerStats());
});


// --- COMANDOS (para el panel del dashboard) ---
// GET /api/commands → Devuelve los comandos REALES cargados por el bot.
// Usa el mismo helper que /help, así ambos se actualizan solos al añadir
// comandos o cambiar sus opciones.
app.get('/api/commands', (req, res) => {
  try {
    const { resumenDe, variantesDe } = require('./utils/commandInfo');
    const comandos = [...client.commands.values()]
      .map(comando => {
        const json = comando.data.toJSON();
        const resumen = resumenDe(json);
        return {
          name: json.name,
          description: json.description || '',
          categoria: resumen.seccion,
          permisos: json.default_member_permissions || null,
          variantes: variantesDe(json),
          ownerOnly: json.name === 'owner',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ total: comandos.length, comandos });
  } catch (e) {
    logError(e, { event: 'api/commands', action: 'List commands' });
    res.status(500).json({ error: e.message });
  }
});


// --- LISTA DE SERVIDORES ---
// GET /api/guilds → Lista todos los servidores donde está el bot
app.get('/api/guilds', (req, res) => {
  const guilds = client.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL({ dynamic: true }),
    memberCount: g.memberCount,
    owner: g.ownerId,
  }));
  res.json(guilds);
});


// --- DETALLE DE UN SERVIDOR ---
// GET /api/guilds/:id → Info del servidor + sus canales de texto
app.get('/api/guilds/:id', (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  // Filtrar solo canales de tipo 0 (texto)
  const channels = guild.channels.cache
    .filter(c => c.type === 0)
    .map(c => ({ id: c.id, name: c.name }));

  res.json({
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ dynamic: true }),
    memberCount: guild.memberCount,
    channels,
  });
});


// --- CANALES DE TEXTO ---
// GET /api/guilds/:id/channels → Lista solo los canales de texto
app.get('/api/guilds/:id/channels', (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  const channels = guild.channels.cache
    .filter(c => c.type === 0)
    .map(c => ({ id: c.id, name: c.name }));

  res.json(channels);
});


// --- CONFIGURACIÓN DE BIENVENIDA ---
// GET /api/guilds/:id/welcome → Obtener config de bienvenida
// PUT /api/guilds/:id/welcome → Actualizar config de bienvenida
app.get('/api/guilds/:id/welcome', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.welcome);
});

app.put('/api/guilds/:id/welcome', (req, res) => {
  const updated = updateGuild(req.params.id, { welcome: req.body });
  res.json(updated.welcome);
});


// --- CONFIGURACIÓN DE DESPEDIDA ---
app.get('/api/guilds/:id/farewell', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.farewell);
});

app.put('/api/guilds/:id/farewell', (req, res) => {
  const updated = updateGuild(req.params.id, { farewell: req.body });
  res.json(updated.farewell);
});


// --- BIENVENIDA PRIVADA (DM) ---
app.get('/api/guilds/:id/private-welcome', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.privateWelcome);
});

app.put('/api/guilds/:id/private-welcome', (req, res) => {
  const updated = updateGuild(req.params.id, { privateWelcome: req.body });
  res.json(updated.privateWelcome);
});


// --- CONFIGURACIÓN DE BOOST ---
app.get('/api/guilds/:id/boost', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.boost);
});

app.put('/api/guilds/:id/boost', (req, res) => {
  const updated = updateGuild(req.params.id, { boost: req.body });
  res.json(updated.boost);
});


// --- CONFIGURACIÓN DE BAN ---
app.get('/api/guilds/:id/ban', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.ban);
});

app.put('/api/guilds/:id/ban', (req, res) => {
  const updated = updateGuild(req.params.id, { ban: req.body });
  res.json(updated.ban);
});


// --- CONFIGURACIÓN DE KICK ---
app.get('/api/guilds/:id/kick', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.kick);
});

app.put('/api/guilds/:id/kick', (req, res) => {
  const updated = updateGuild(req.params.id, { kick: req.body });
  res.json(updated.kick);
});


// --- AUTO-ROLE (rol automático al entrar) ---
app.get('/api/guilds/:id/autorole', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.autoRole);
});

app.put('/api/guilds/:id/autorole', (req, res) => {
  const updated = updateGuild(req.params.id, { autoRole: req.body });
  res.json(updated.autoRole);
});

// POST /api/guilds/:id/reaction-role/send → Envía el mensaje de reaction role en un canal
app.post('/api/guilds/:id/reaction-role/send', async (req, res) => {
  try {
    const { channelId, embed, roles, mode } = req.body;
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const { buildEmbed } = require('./utils/buildEmbed');
    const embedData = buildEmbed(embed, null);

    if (mode === 'select') {
      const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
      const options = roles.map(r => ({ label: r.label, value: r.roleId, emoji: r.emoji || undefined }));
      const select = new StringSelectMenuBuilder().setCustomId('reaction_role_select').setPlaceholder('Elige tu rol').addOptions(options);
      const row = new ActionRowBuilder().addComponents(select);
      const msg = await channel.send({ embeds: [embedData], components: [row] });
      res.json({ success: true, messageId: msg.id });
    } else {
      const msg = await channel.send({ embeds: [embedData] });
      for (const r of roles) {
        if (r.emoji) await msg.react(r.emoji);
      }
      res.json({ success: true, messageId: msg.id });
    }
  } catch (e) {
    logError(e, { event: 'api/reaction-role', guild: { id: req.params.id }, action: 'Send reaction role message' });
    res.status(500).json({ error: e.message });
  }
});


// --- SISTEMA DE NIVELES ---
app.get('/api/guilds/:id/levels', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.levels);
});

app.put('/api/guilds/:id/levels', (req, res) => {
  const config = getGuild(req.params.id);
  const currentLevels = config.levels || {};
  // Deep merge: preserve existing nested arrays/objects not included in request
  const merged = { ...currentLevels };
  for (const [key, value] of Object.entries(req.body)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && currentLevels[key] && typeof currentLevels[key] === 'object' && !Array.isArray(currentLevels[key])) {
      merged[key] = { ...currentLevels[key], ...value };
    } else {
      merged[key] = value;
    }
  }
  const updated = updateGuild(req.params.id, { levels: merged });
  res.json(updated.levels);
});

app.get('/api/guilds/:id/levels/leaderboard', (req, res) => {
  const { getLeaderboard } = require('./database/levels');
  const board = getLeaderboard(req.params.id, parseInt(req.query.limit) || 15);
  res.json(board);
});

app.get('/api/guilds/:id/levels/user/:userId', (req, res) => {
  const { getUser, getRank } = require('./database/levels');
  const user = getUser(req.params.id, req.params.userId);
  const rank = getRank(req.params.id, req.params.userId);
  res.json({ user, rank });
});


// --- ROLES DEL SERVIDOR (para el selector de auto-role) ---
// GET /api/guilds/:id/roles → Lista todos los roles que el bot puede asignar
app.get('/api/guilds/:id/roles', (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id && r.editable) // Excluir @everyone y roles que el bot no puede manejar
    .sort((a, b) => b.position - a.position) // Ordenar de mayor a menor rango
    .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));

  res.json(roles);
});


// --- MIEMBROS DEL SERVIDOR (para previsualizar usuarios) ---
// GET /api/guilds/:id/members → Primeros 100 miembros (sin bots)
app.get('/api/guilds/:id/members', async (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  try {
    const fetched = await guild.members.fetch({ limit: 100 });
    const members = fetched
      .filter(m => !m.user.bot) // Excluir bots
      .map(m => ({
        id: m.id,
        tag: m.user.tag,
        username: m.user.username,
        avatar: m.user.displayAvatarURL({ dynamic: true, size: 64 }),
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
    res.json(members);
  } catch {
    res.json([]);
  }
});


// --- LIBRERÍA DE ANIMACIONES DE TEXTO (global por despliegue) ---
// GET /api/card-animations → presets + animaciones guardadas
app.get('/api/card-animations', (req, res) => {
  res.json({ presets: listPresets(), animations: listCardAnimations() });
});

// POST /api/card-animations → guardar una animación nueva
app.post('/api/card-animations', (req, res) => {
  try {
    if (!req.body || !Array.isArray(req.body.definition?.keyframes)) {
      return res.status(400).json({ error: 'Se requiere definition.keyframes' });
    }
    const animation = createCardAnimation(req.body);
    logInfo(`Animación guardada: ${animation.name}`, { event: 'api/card-animations', action: 'create' });
    res.status(201).json(animation);
  } catch (e) {
    logError(e, { event: 'api/card-animations', action: 'create' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/card-animations/:id → editar nombre/definición
app.put('/api/card-animations/:id', (req, res) => {
  try {
    const animation = updateCardAnimation(req.params.id, req.body || {});
    if (!animation) return res.status(404).json({ error: 'Animación no encontrada' });
    res.json(animation);
  } catch (e) {
    logError(e, { event: 'api/card-animations', action: 'update' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/card-animations/:id → borrar animación
app.delete('/api/card-animations/:id', (req, res) => {
  try {
    if (!removeCardAnimation(req.params.id)) {
      return res.status(404).json({ error: 'Animación no encontrada' });
    }
    res.json({ success: true });
  } catch (e) {
    logError(e, { event: 'api/card-animations', action: 'remove' });
    res.status(500).json({ error: e.message });
  }
});

// --- VARIABLES Y PLANTILLAS DE MENSAJE (global por despliegue) ---
// GET /api/message-variables → biblioteca guardada + guía de sintaxis
app.get('/api/message-variables', (req, res) => {
  res.json({
    biblioteca: getBiblioteca(),
    guia: {
      variables: VARIABLES_SISTEMA_INFO,
      funciones: FUNCIONES_INFO,
      formas: [
        { sintaxis: '{nombre}', descripcion: 'Variable del sistema o variable custom' },
        { sintaxis: '{aleatorio(valores:"{MiArray}", rango:"1,5")}', descripcion: 'Elige entre los primeros 5 valores' },
        { sintaxis: '{plantilla(id:"bienvenida", nombre:"{user}")}', descripcion: 'Inserta una plantilla con parámetros' },
        { sintaxis: '{si(condicion:"{memberCount} >= 100", verdadero:"Grande", falso:"Pequeño")}', descripcion: 'Elige un texto según una comparación' },
        { sintaxis: '\\{user\\}', descripcion: 'Escribe {user} literalmente sin resolverlo' },
      ],
    },
  });
});

// PUT /api/message-variables → valida y guarda la biblioteca completa
app.put('/api/message-variables', (req, res) => {
  try {
    const resultado = guardarBiblioteca(req.body);
    if (!resultado.ok) return res.status(400).json({ error: resultado.error });
    logInfo('Biblioteca de variables actualizada', { event: 'api/message-variables', action: 'save' });
    res.json(resultado.biblioteca);
  } catch (e) {
    logError(e, { event: 'api/message-variables', action: 'save' });
    res.status(500).json({ error: e.message });
  }
});

// POST /api/message-variables/preview → prueba un texto sin guardarlo
app.post('/api/message-variables/preview', (req, res) => {
  try {
    const { texto, fuente, guildId, biblioteca } = req.body || {};
    const resultado = resolverPlantillas(String(texto || ''), {
      fuente: fuente || {},
      guildId: guildId || '',
      biblioteca: biblioteca || getBiblioteca(),
    });
    res.json({ resultado });
  } catch (e) {
    logError(e, { event: 'api/message-variables', action: 'preview' });
    res.status(500).json({ error: e.message });
  }
});

// --- PREVISUALIZAR TARJETA ---
// POST /api/guilds/:id/preview-card/:type → Genera una tarjeta de bienvenida/despedida como imagen base64
// Opcional: { frame } → PNG de ese frame exacto (scrubber)
// Opcional: { draftAnimation } → animación aún no guardada que se quiere probar
app.post('/api/guilds/:id/preview-card/:type', async (req, res) => {
  try {
    const { generateCard, generateAnimatedCard } = require('./utils/cardGenerator');
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const body = req.body || {};
    const cardConfig = { ...body };
    const previewFrame = body.frame != null ? Number(body.frame) : null;
    const draftAnimation = body.draftAnimation || null;
    delete cardConfig.frame;
    delete cardConfig.draftAnimation;

    // Usar un usuario de prueba para la preview
    const previewUser = {
      id: client.user.id,
      tag: 'TestUser#0001',
      username: 'TestUser',
      displayAvatarURL: (opts) => client.user.displayAvatarURL(opts),
      createdTimestamp: client.user.createdTimestamp,
    };
    const member = {
      id: previewUser.id,
      user: previewUser,
      guild: guild,
      joinedTimestamp: Date.now(),
    };

    let buffer;
    if (previewFrame != null && !Number.isNaN(previewFrame)) {
      // Frame puntual → PNG (lo usa el scrubber del editor de animaciones)
      buffer = await generateCard(member, cardConfig, req.params.type === 'welcome', { frame: previewFrame, draftAnimation });
    } else if (cardConfig.animated) {
      buffer = await generateAnimatedCard(member, cardConfig, req.params.type === 'welcome');
    } else {
      buffer = await generateCard(member, cardConfig, req.params.type === 'welcome');
    }

    const ext = previewFrame != null && !Number.isNaN(previewFrame) ? 'png' : (cardConfig.animated ? 'gif' : 'png');
    res.json({
      success: true,
      image: `data:image/${ext};base64,${buffer.toString('base64')}`,
    });
  } catch (e) {
    logError(e, { event: 'api/preview-card', guild: { id: req.params.id }, section: req.params.type, config: {}, action: 'Generate card preview' });
    res.status(500).json({ error: e.message });
  }
});


// --- CONFIGURACIÓN DE AUTO-MODERACIÓN ---
app.get('/api/guilds/:id/automod', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.autoMod);
});

app.put('/api/guilds/:id/automod', (req, res) => {
  const updated = updateGuild(req.params.id, { autoMod: req.body });
  res.json(updated.autoMod);
});


// --- CONFIGURACIÓN DE LOGGING ---
app.get('/api/guilds/:id/logging', (req, res) => {
  const config = getGuild(req.params.id);
  res.json(config.logging);
});

app.put('/api/guilds/:id/logging', (req, res) => {
  const updated = updateGuild(req.params.id, { logging: req.body });
  res.json(updated.logging);
});


// --- SERVIDORES AUTORIZADOS ---
app.get('/api/authorized-servers', (req, res) => {
  const settings = getSettings();
  const guilds = client.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL({ dynamic: true }),
    memberCount: g.memberCount,
    authorized: settings.authorizedServers[g.id] !== false,
  }));
  res.json({ servers: guilds, hasFilter: settings.authorizedFilterEnabled === true });
});

app.put('/api/authorized-servers', (req, res) => {
  const { authorizedServers } = req.body;
  const updated = updateSettings({ authorizedServers });
  res.json({ authorizedServers: updated.authorizedServers });
});

app.put('/api/authorized-filter', (req, res) => {
  const { enabled } = req.body;
  updateSettings({ authorizedFilterEnabled: enabled });
  if (!enabled) updateSettings({ authorizedServers: {} });
  res.json({ enabled });
});


// --- DASHBOARD CONFIG (persistente en servidor) ---
app.get('/api/dashboard-config', (req, res) => {
  const settings = getSettings();
  res.json(settings.dashboardConfig || { title: "Hazuru's Assistant", subtitle: 'Dashboard', logo: '' });
});

app.put('/api/dashboard-config', (req, res) => {
  const updated = updateSettings({ dashboardConfig: req.body });
  res.json(updated.dashboardConfig);
});


// ============================================================================
// 7. SOCKET.IO - STATS EN TIEMPO REAL
// ============================================================================
/**
 * Socket.IO permite enviar datos del bot al frontend sin que el frontend tenga
 * que refrescar la página. El bot envía stats cada 5 segundos.
 */
io.on('connection', (socket) => {
  console.log('Frontend connected');
  // Enviar el estado completo de una vez: así el dashboard no arranca con
  // ceros ni con datos viejos esperando al primer intervalo de 5 segundos.
  const stats = obtenerStats();
  socket.emit('status', { status: stats.status });
  socket.emit('stats', stats);
});

// Enviar stats cada 5 segundos a todos los frontends conectados
setInterval(() => {
  if (client.isReady()) {
    io.emit('stats', obtenerStats());
  }
}, 5000);


// ============================================================================
// 8. INICIAR BOT Y SERVIDOR
// ============================================================================

// Conectar el bot a Discord
client.login(process.env.DISCORD_TOKEN).then(() => {
  // Reprogramar recordatorios pendientes al iniciar
  const allReminders = getAllReminders();
  const now = Date.now();
  let reprogrammed = 0;
  let expired = 0;

  for (const reminder of allReminders) {
    const delay = reminder.remindAt - now;
    if (delay <= 0) {
      // Recordatorio expirado: enviar ahora y eliminar
      expired++;
      const ch = client.channels.cache.get(reminder.channel);
      if (ch) {
        ch.send({ content: `<@${reminder.userId}> ⏰ Recordatorio: **${reminder.message}**` }).catch(() => {});
      }
      removeReminder(reminder.guildId, reminder.id);
    } else {
      // Recordatorio pendiente: reprogramar
      reprogrammed++;
      setTimeout(async () => {
        try {
          const ch = await client.channels.fetch(reminder.channel);
          if (ch) await ch.send({ content: `<@${reminder.userId}> ⏰ Recordatorio: **${reminder.message}**` });
        } catch {}
        removeReminder(reminder.guildId, reminder.id);
      }, delay);
    }
  }

  if (reprogrammed > 0 || expired > 0) {
    logInfo(`Reminders: ${reprogrammed} reprogramados, ${expired} expirados enviados`);
  }
});

// Iniciar el servidor web en el puerto configurado
const PORT = process.env.PORT || 3001;
// El dashboard es local: solo se enlaza en IPv4 loopback. Cambiar el bind
// a 0.0.0.0 lo expondría a cualquier equipo de la red sin autenticación.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Frontend server running on http://127.0.0.1:${PORT}`);
});


// ============================================================================
// 9. GRACEFUL SHUTDOWN
// ============================================================================
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    client.destroy();
    logInfo('Bot disconnected gracefully', { signal });
  } catch {}
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Force exit after 5s if hanging
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
