const { createApp, ref, computed, onMounted, watch } = Vue;

createApp({
  setup() {
    const socket = io();
    const status = ref('offline');
    const guilds = ref([]);
    const selectedGuild = ref(null);
    const channels = ref([]);
    const currentPage = ref('home');
    // Panel lateral: abierto por defecto en escritorio, cerrado en móvil.
    const sidebarOpen = ref(window.innerWidth >= 1024);
    const toggleSidebar = () => { sidebarOpen.value = !sidebarOpen.value; };
    // Al elegir una página desde el celular se cierra el menú automáticamente.
    const cerrarSidebar = () => { if (window.innerWidth < 1024) sidebarOpen.value = false; };
    const loadingGuilds = ref(true);
    const saving = ref(false);
    const sendingPreview = ref(false);
    const toasts = ref([]);
    const activeEmbedTab = ref('general');

    const stats = ref([
      { label: 'Servidores', value: 0 },
      { label: 'Usuarios', value: 0 },
      { label: 'Uptime', value: '0s' },
    ]);

    // La lista de comandos NO va hardcodeada: se consulta a /api/commands, que
    // devuelve los comandos reales cargados por el bot (igual que /help).
    const commands = ref([]);
    const commandsLoading = ref(false);
    const commandsError = ref('');
    const commandSearch = ref('');
    const commandCategory = ref('Todas');

    // Categorías derivadas de los propios comandos (sin listas fijas).
    const commandCategories = computed(() => {
      const vistas = new Set(commands.value.map(c => c.categoria || '🔧 Otros'));
      return ['Todas', ...[...vistas].sort()];
    });

    // Búsqueda por nombre, descripción o sintaxis de cualquier variante.
    const filteredCommands = computed(() => {
      const texto = commandSearch.value.trim().toLowerCase();
      return commands.value.filter(c => {
        const enCategoria = commandCategory.value === 'Todas' || c.categoria === commandCategory.value;
        if (!enCategoria) return false;
        if (!texto) return true;
        const buscable = [
          c.name,
          c.description,
          ...(c.variantes || []).flatMap(v => [v.sintaxis, v.descripcion]),
        ].join(' ').toLowerCase();
        return buscable.includes(texto);
      });
    });

    const loadCommands = async () => {
      commandsLoading.value = true;
      commandsError.value = '';
      try {
        const res = await fetch('/api/commands');
        if (!res.ok) throw new Error('No se pudo consultar el bot');
        const data = await res.json();
        commands.value = data.comandos || [];
      } catch (e) {
        commandsError.value = e.message || 'Error de conexión';
      } finally {
        commandsLoading.value = false;
      }
    };

    // Icono que identifica cada comando en la grilla. Los que no están en el
    // mapa caen en "⌘", así un comando nuevo nunca queda sin icono.
    const ICONOS_COMANDOS = {
      help: '❓', ping: '🏓', server: '🖥️', serverinfo: '🏛️', userinfo: '👤',
      avatar: '🖼️', botinfo: '🤖', '8ball': '🎱', poll: '📊', 'poll-close': '🔒',
      remind: '⏰', 'remind-list': '📋', announce: '📢', 'announce-preview': '👁️',
      nick: '🏷️', config: '⚙️', say: '💬', preview: '🔍', 'dm-template': '✉️',
      'reaction-role': '🎭', rank: '🏆', leaderboard: '🥇', profile: '📜',
      achievements: '🏅', racha: '🔥', title: '👑', setlevel: '🔼', setxp: '✨',
      resetlevels: '♻️', ban: '🔨', kick: '🦵', warn: '⚠️', warnings: '📋',
      unwarn: '✅', timeout: '🔇', untimeout: '🔊', purge: '🧹', slowmode: '🐌',
      modlog: '📖', owner: '🔐',
    };

    // Color de acento por sección: tiñe el icono, el nombre y la cabecera.
    const COLORES_CATEGORIA = {
      '📊 Información': '#5865F2',
      '🎲 Diversión': '#eb459e',
      '⚙️ Utilidad': '#57F287',
      '📈 Niveles': '#FEE75C',
      '🔨 Moderación': '#ED4245',
      '🔐 Dueño del bot': '#b47cff',
      '🔧 Otros': '#949CF7',
    };
    const ORDEN_CATEGORIAS = Object.keys(COLORES_CATEGORIA);

    const iconoComando = (nombre) => ICONOS_COMANDOS[nombre] || '⌘';
    const colorCategoria = (cat) => COLORES_CATEGORIA[cat] || '#5865F2';

    // Agrupa los comandos filtrados por sección, en el mismo orden que /help.
    const commandGroups = computed(() => {
      const mapa = new Map();
      for (const cmd of filteredCommands.value) {
        const cat = cmd.categoria || '🔧 Otros';
        if (!mapa.has(cat)) mapa.set(cat, []);
        mapa.get(cat).push(cmd);
      }
      const orden = [...ORDEN_CATEGORIAS, ...[...mapa.keys()].filter(c => !ORDEN_CATEGORIAS.includes(c))];
      return orden.filter(cat => mapa.has(cat)).map(cat => ({
        categoria: cat,
        nombre: cat.replace(/^\S+\s*/, ''),
        emoji: cat.match(/^\S+/)?.[0] || '⌘',
        color: colorCategoria(cat),
        comandos: mapa.get(cat),
      }));
    });

    const navItems = [
      { id: 'home', label: 'Inicio', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>' },
      { id: 'welcome', label: 'Bienvenidas', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>' },
      { id: 'farewell', label: 'Despedidas', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>' },
      { id: 'private', label: 'DM Bienvenida', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>' },
      { id: 'boost', label: 'Boost', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>' },
      { id: 'ban', label: 'Bans', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>' },
      { id: 'kick', label: 'Kicks', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"></path></svg>' },
      { id: 'autorole', label: 'Auto-Role', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>' },
      { id: 'levels', label: 'Niveles', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>' },
      { id: 'automod', label: 'Auto-Moderación', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>' },
      { id: 'logging', label: 'Logging', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>' },
      { id: 'commands', label: 'Comandos', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>' },
      { id: 'settings', label: 'Ajustes', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>' },
    ];

    const embedTabs = [
      { id: 'general', label: 'General' },
      { id: 'author', label: 'Autor' },
      { id: 'footer', label: 'Footer' },
      { id: 'fields', label: 'Fields' },
    ];

    const colorPresets = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#FF9044', '#FFFFFF', '#2ECC71'];

    const availableVars = [
      { value: '{user}', desc: 'Mencion' },
      { value: '{user.name}', desc: 'Nombre' },
      { value: '{user.id}', desc: 'ID' },
      { value: '{user.avatar}', desc: 'Avatar URL' },
      { value: '{user.tag}', desc: 'Tag completo' },
      { value: '{user.mention}', desc: 'Mencion' },
      { value: '{user.createdAt}', desc: 'Fecha creacion' },
      { value: '{user.joinedAt}', desc: 'Fecha union' },
      { value: '{server}', desc: 'Servidor' },
      { value: '{server.id}', desc: 'ID server' },
      { value: '{server.icon}', desc: 'Icono server' },
      { value: '{memberCount}', desc: 'Miembros' },
      { value: '{boost}', desc: 'Boosts' },
      { value: '{date}', desc: 'Fecha' },
      { value: '{time}', desc: 'Hora' },
      { value: '{moderator}', desc: 'Moderador' },
      { value: '{reason}', desc: 'Razon' },
    ];

    const cardThemePresets = { dark: 'bg-gray-900/60 border-gray-700/40', circuit: 'bg-gray-900/60 border-green-700/40', code: 'bg-gray-900/60 border-blue-700/40', neon: 'bg-gray-900/60 border-purple-700/40', sunset: 'bg-gray-900/60 border-orange-700/40' };

    // Fase neutra por defecto: las cards existentes no cambian visualmente.
    const defaultAnimPhase = () => ({ id: 'none', duration: 0.5, reverse: false });
    const defaultTextAnimations = () => ({
      title: { intro: defaultAnimPhase(), loop: defaultAnimPhase(), outro: defaultAnimPhase() },
      username: { intro: defaultAnimPhase(), loop: defaultAnimPhase(), outro: defaultAnimPhase() },
      subtitle: { intro: defaultAnimPhase(), loop: defaultAnimPhase(), outro: defaultAnimPhase() },
    });

    const defaultCard = () => ({
      enabled: false,
      theme: 'dark',
      fontFamily: 'DejaVu Sans',
      background: '',
      bgScale: 'cover',
      bgZoom: 100,
      title: '',
      subtitle: '',
      textColor: '',
      subtitleColor: '',
      avatarBorderColor: '',
      avatarBorderWidth: 5,
      animated: false,
      overlayOpacity: 50,
      titleSize: 28,
      usernameSize: 20,
      subtitleSize: 15,
      avatarSize: 50,
      avatarBorder: true,
      cardBorder: true,
      cardMargin: 20,
      textAnimations: defaultTextAnimations(),
    });

    const availableFonts = ref([]);
    const loadFonts = async () => {
      try {
        const res = await fetch('/api/fonts');
        if (res.ok) availableFonts.value = await res.json();
      } catch {}
    };

    const uploadFont = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('font', file);
      formData.append('name', file.name.replace(/\.[^.]+$/, ''));
      try {
        const res = await fetch('/api/upload-font', { method: 'POST', body: formData });
        if (res.ok) {
          const font = await res.json();
          availableFonts.value.push(font);
          currentConfig.value.card.fontFamily = font.name;
          showToast('success', 'Fuente subida');
        } else {
          showToast('error', 'Error al subir fuente');
        }
      } catch {
        showToast('error', 'Error de conexion');
      }
      event.target.value = '';
    };

    const defaultEmbed = () => ({
      title: '', description: '', color: '#5865F2',
      thumbnail: '', image: '',
      author: { name: '', iconUrl: '', url: '' },
      footer: { text: '', iconUrl: '' },
      fields: [],
    });

    const welcomeConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: defaultEmbed(), card: defaultCard() });
    const farewellConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#ED4245' }, card: { ...defaultCard(), avatarBorderColor: '#ED4245' } });
    const privateConfig = ref({ enabled: false, message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#eb459e' }, card: { ...defaultCard(), backgroundColor: '#1a1a2e', avatarBorderColor: '#eb459e' } });
    const boostConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#f47fff' } });
    const banConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#ED4245' } });
    const kickConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#FF9044' } });
    const autoRoleConfig = ref({ enabled: false, roleId: '', botRole: { enabled: false, roleId: '' }, boostRole: { enabled: false, roleId: '' }, milestones: [], reactionRoles: [] });
    const autoRoleTab = ref('basic');
    const levelsConfig = ref({
      enabled: false,
      xpPerMessage: { min: 15, max: 25 },
      xpCooldown: 60,
      messageCooldown: 0,
      channelMultipliers: [],
      streakMultiplier: { enabled: false, dailyBonus: 0.1, maxMultiplier: 2.5 },
      levelFormula: { base: 100, exponent: 1.5 },
      levelRoles: [],
      icons: [],
      achievements: [],
      ignoredChannels: [],
      announcementChannel: '',
      announceLevelUp: true,
      announceAchievement: true,
      levelUpEmbed: { title: '¡Subiste de nivel!', description: '¡Felicidades {user}! Ahora eres nivel **{level}**', color: '#5865F2' },
      commandsEnabled: { rank: true, leaderboard: true, profile: true, achievements: true },
      titleMinLevel: 10,
    });
    const levelsTab = ref('general');
    const levelsLeaderboard = ref([]);
    const automodConfig = ref({
      enabled: false,
      antiSpam: { enabled: false, maxMessages: 5, interval: 5000, action: 'delete' },
      antiLinks: { enabled: false, action: 'delete', whitelistedDomains: ['youtube.com', 'youtu.be', 'twitch.tv', 'discord.gg'] },
      whitelistedDomainsStr: 'youtube.com, youtu.be, twitch.tv, discord.gg',
      antiCaps: { enabled: false, minLetters: 10, maxPercentage: 70, action: 'delete' },
      bannedWords: { enabled: false, words: [], wordsStr: '', action: 'delete' },
    });
    const loggingConfig = ref({
      channel: '',
      messageDelete: true,
      messageUpdate: true,
      voiceStateUpdate: false,
      roleUpdate: false,
    });
    const roles = ref([]);
    const members = ref([]);
    const previewMember = ref('');
    const dashboardConfig = ref({ title: "Hazuru's Assistant", subtitle: 'Dashboard', logo: '' });
    const welcomeCardPreview = ref('');
    const farewellCardPreview = ref('');

    // --- Animaciones de texto para tarjetas ---
    const animElements = [
      { id: 'title', label: 'Titulo' },
      { id: 'username', label: 'Usuario' },
      { id: 'subtitle', label: 'Subtitulo' },
    ];
    const animPhases = [
      { id: 'intro', label: 'Entrada' },
      { id: 'loop', label: 'Bucle' },
      { id: 'outro', label: 'Salida' },
    ];
    const animationPresets = ref([]);
    const cardAnimations = ref([]);
    const animEditorOpen = ref(false);
    const animFrame = ref(0);
    // En GIFs se reproduce el archivo completo por defecto; al desactivarlo
    // se muestra el timeline y la preview pasa a ser un frame puntual (PNG).
    const autoPlayPreview = ref(true);
    // Auto-actualización de la preview al cambiar keyframes/ajustes. Si se
    // desactiva, solo se regenera al apretar "Regenerar ahora".
    const autoRefreshPreview = ref(true);
    const animSaving = ref(false);
    const newAnimName = ref('');
    const customDefinition = () => ({
      easing: 'easeOutCubic',
      keyframes: [
        { at: 0, opacity: 0, y: 20, scale: 0.95 },
        { at: 1, opacity: 1, y: 0, scale: 1 },
      ],
    });
    const animEditor = ref({
      element: 'title', phase: 'intro', selectedId: 'none', definition: customDefinition(),
    });

    const authorizedServers = ref([]);
    const authorizedFilter = ref(false);

    const currentConfig = computed({
      get() {
        const map = { welcome: welcomeConfig, farewell: farewellConfig, private: privateConfig, boost: boostConfig, ban: banConfig, kick: kickConfig };
        return map[currentPage.value]?.value || welcomeConfig.value;
      },
      set(val) {
        const map = { welcome: welcomeConfig, farewell: farewellConfig, private: privateConfig, boost: boostConfig, ban: banConfig, kick: kickConfig };
        if (map[currentPage.value]) map[currentPage.value].value = val;
      }
    });

    const isGifPreview = computed(() => !!currentConfig.value.card?.animated);

    const phaseInfo = {
      intro: { label: 'Entrada', hint: 'al aparecer', color: '#23a55a' },
      loop: { label: 'Bucle', hint: 'mientras está', color: '#5865f2' },
      outro: { label: 'Salida', hint: 'al desaparecer', color: '#f23f43' },
    };

    /** Barras proporcionales de las 3 fases para un elemento (solo lectura). */
    const timelineBar = (element) => {
      const card = currentConfig.value.card || {};
      const total = (card.animationFrames || 30) * (card.animationDelay || 100) / 1000;
      const phases = card.textAnimations?.[element] || {};
      const intro = Math.min(Math.max(Number(phases.intro?.duration) || 0, 0), total);
      const outro = Math.min(Math.max(Number(phases.outro?.duration) || 0, 0), total - intro);
      const loop = Math.max(total - intro - outro, 0);
      const pct = (v) => total > 0 ? (v / total) * 100 : 0;
      return { intro: pct(intro), loop: pct(loop), outro: pct(outro) };
    };

    const currentPageTitle = computed(() => {
      const t = { home: 'Inicio', welcome: 'Bienvenidas', farewell: 'Despedidas', private: 'DM Bienvenida', boost: 'Boost', ban: 'Bans', kick: 'Kicks', autorole: 'Auto-Role', automod: 'Auto-Moderación', logging: 'Logging', commands: 'Comandos', settings: 'Ajustes', levels: 'Niveles' };
      return t[currentPage.value] || 'Inicio';
    });

    const currentPageDesc = computed(() => {
      const d = { home: 'Panel de control', welcome: 'Mensajes de bienvenida', farewell: 'Mensajes de despedida', private: 'DM de bienvenida', boost: 'Mensajes de boost', ban: 'Mensajes de ban', kick: 'Mensajes de kick', autorole: 'Rol automatico al unirse', automod: 'Filtros automaticos del chat', logging: 'Registro de eventos del servidor', commands: 'Comandos del bot', settings: 'Personaliza el dashboard', levels: 'Sistema de niveles y XP' };
      return d[currentPage.value] || '';
    });

    const configTitle = computed(() => {
      const t = { welcome: 'Mensajes de Bienvenida', farewell: 'Mensajes de Despedida', private: 'DM de Bienvenida', boost: 'Mensajes de Boost', ban: 'Mensajes de Ban', kick: 'Mensajes de Kick' };
      return t[currentPage.value] || '';
    });

    const configDesc = computed(() => {
      const d = { welcome: 'Se envia cuando alguien se une al servidor', farewell: 'Se envia cuando alguien se va', private: 'DM a cada nuevo miembro', boost: 'Se envia cuando alguien hace boost', ban: 'Se envia cuando banean a alguien', kick: 'Se envia cuando expulsan a alguien' };
      return d[currentPage.value] || '';
    });

    const hasInlineFields = computed(() => currentConfig.value.embed?.fields?.some(f => f.inline) || false);

    const formatUptime = (ms) => {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) return `${h}h ${m % 60}m`;
      if (m > 0) return `${m}m ${s % 60}s`;
      return `${s}s`;
    };

    const replacePreview = (str) => {
      if (!str) return '';
      return str
        .replace(/\{user\}/g, '@Usuario').replace(/\{user\.name\}/g, 'Usuario')
        .replace(/\{user\.id\}/g, '123456789').replace(/\{user\.avatar\}/g, '')
        .replace(/\{user\.tag\}/g, 'Usuario#0001').replace(/\{user\.mention\}/g, '@Usuario')
        .replace(/\{server\}/g, 'Mi Servidor').replace(/\{server\.id\}/g, '987654321')
        .replace(/\{server\.icon\}/g, '').replace(/\{memberCount\}/g, '150')
        .replace(/\{date\}/g, new Date().toLocaleDateString('es-ES'))
        .replace(/\{time\}/g, new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
        .replace(/\{channel\}/g, '#general');
    };

    const copyVar = (v) => {
      navigator.clipboard?.writeText(v);
      showToast('success', `Variable ${v} copiada`);
    };

    const showToast = (type, message) => {
      const id = Date.now();
      toasts.value.push({ id, type, message });
      setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3000);
    };

    const addField = () => {
      if (!currentConfig.value.embed.fields) currentConfig.value.embed.fields = [];
      currentConfig.value.embed.fields.push({ name: '', value: '', inline: false });
    };

    const resetEmbed = () => {
      const color = currentPage.value === 'farewell' ? '#ED4245' : currentPage.value === 'private' ? '#eb459e' : '#5865F2';
      currentConfig.value.embed = { ...defaultEmbed(), color };
      saveConfig();
      showToast('info', 'Embed reiniciado');
    };

    const uploadImage = async (event, fieldPath) => {
      const file = event.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('image', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          // Set the URL in the correct field
          const parts = fieldPath.split('.');
          let obj = currentConfig.value.embed;
          for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
          obj[parts[parts.length - 1]] = url;
          saveConfig();
          showToast('success', 'Imagen subida');
        } else {
          showToast('error', 'Error al subir imagen');
        }
      } catch (e) {
        showToast('error', 'Error de conexion');
      }
      event.target.value = '';
    };

    const sendPreview = async () => {
      if (!selectedGuild.value) return;
      sendingPreview.value = true;
      try {
        const res = await fetch(`/api/guilds/${selectedGuild.value.id}/preview/${currentPage.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: previewMember.value || selectedGuild.value.owner }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast('success', `Preview enviado a ${data.target}`);
        } else {
          showToast('error', data.error || 'Error al enviar preview');
        }
      } catch (e) {
        showToast('error', 'Error de conexion');
      } finally {
        sendingPreview.value = false;
      }
    };

    const saveConfig = async () => {
      if (!selectedGuild.value) return;
      saving.value = true;
      try {
        const id = selectedGuild.value.id;
        const cfg = currentConfig.value;
        const endpointMap = {
          welcome: `/api/guilds/${id}/welcome`,
          farewell: `/api/guilds/${id}/farewell`,
          private: `/api/guilds/${id}/private-welcome`,
          boost: `/api/guilds/${id}/boost`,
          ban: `/api/guilds/${id}/ban`,
          kick: `/api/guilds/${id}/kick`,
        };
        const endpoint = endpointMap[currentPage.value];
        if (!endpoint) return;
        const res = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg),
        });
        if (res.ok) showToast('success', 'Guardado');
        else showToast('error', 'Error al guardar');
      } catch (e) {
        showToast('error', 'Error de conexion');
      } finally {
        saving.value = false;
      }
    };

    const saveAutoRole = async () => {
      if (!selectedGuild.value) return;
      saving.value = true;
      try {
        const res = await fetch(`/api/guilds/${selectedGuild.value.id}/autorole`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(autoRoleConfig.value),
        });
        if (res.ok) showToast('success', 'Auto-role guardado');
        else showToast('error', 'Error al guardar');
      } catch (e) {
        showToast('error', 'Error de conexion');
      } finally {
        saving.value = false;
      }
    };

    const sendReactionRole = async (index) => {
      if (!selectedGuild.value) return;
      const rr = autoRoleConfig.value.reactionRoles[index];
      if (!rr || !rr.channelId) return;
      saving.value = true;
      try {
        const res = await fetch(`/api/guilds/${selectedGuild.value.id}/reaction-role/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rr),
        });
        if (res.ok) {
          const data = await res.json();
          rr.messageId = data.messageId;
          await saveAutoRole();
          showToast('success', 'Mensaje enviado');
        } else {
          showToast('error', 'Error al enviar');
        }
      } catch {
        showToast('error', 'Error de conexion');
      } finally {
        saving.value = false;
      }
    };

    const saveLevels = async () => {
      if (!selectedGuild.value) return;
      saving.value = true;
      try {
        const res = await fetch(`/api/guilds/${selectedGuild.value.id}/levels`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(levelsConfig.value),
        });
        if (res.ok) showToast('success', 'Niveles guardados');
        else showToast('error', 'Error al guardar');
      } catch {
        showToast('error', 'Error de conexion');
      } finally {
        saving.value = false;
      }
    };

    const loadLevelsLeaderboard = async () => {
      if (!selectedGuild.value) return;
      try {
        const res = await fetch(`/api/guilds/${selectedGuild.value.id}/levels/leaderboard?limit=20`);
        if (res.ok) levelsLeaderboard.value = await res.json();
      } catch {}
    };

    const saveAutoMod = async () => {
      if (!selectedGuild.value) return;
      saving.value = true;
      try {
        const data = { ...automodConfig.value };
        if (data.bannedWords.wordsStr) {
          data.bannedWords.words = data.bannedWords.wordsStr.split(',').map(w => w.trim()).filter(Boolean);
        }
        if (data.whitelistedDomainsStr) {
          data.antiLinks.whitelistedDomains = data.whitelistedDomainsStr.split(',').map(d => d.trim()).filter(Boolean);
        }
        delete data.whitelistedDomainsStr;
        const res = await fetch(`/api/guilds/${selectedGuild.value.id}/automod`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) showToast('success', 'Auto-moderación guardada');
        else showToast('error', 'Error al guardar');
      } catch (e) {
        showToast('error', 'Error de conexion');
      } finally {
        saving.value = false;
      }
    };

    const saveLogging = async () => {
      if (!selectedGuild.value) return;
      saving.value = true;
      try {
        const res = await fetch(`/api/guilds/${selectedGuild.value.id}/logging`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loggingConfig.value),
        });
        if (res.ok) showToast('success', 'Logging guardado');
        else showToast('error', 'Error al guardar');
      } catch (e) {
        showToast('error', 'Error de conexion');
      } finally {
        saving.value = false;
      }
    };

    const uploadCardBg = async (event, type) => {
      const file = event.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('image', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          if (type === 'welcome') welcomeConfig.value.card.background = url;
          else farewellConfig.value.card.background = url;
          showToast('success', 'Fondo subido');
        } else {
          showToast('error', 'Error al subir imagen');
        }
      } catch (e) {
        showToast('error', 'Error de conexion');
      }
      event.target.value = '';
    };

    const cardPreviewLoading = ref(false);

    // frame y draft son opcionales: permiten ver un instante concreto y
    // previsualizar una animación que todavía no fue guardada.
    const previewCard = async (type, frame = null, draft = null) => {
      if (!selectedGuild.value) return;
      cardPreviewLoading.value = true;
      try {
        const card = type === 'welcome' ? welcomeConfig.value.card : farewellConfig.value.card;
        const body = { ...card };
        if (frame != null) body.frame = frame;
        if (draft) body.draftAnimation = draft;

        const res = await fetch(`/api/guilds/${selectedGuild.value.id}/preview-card/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok && data.image) {
          if (type === 'welcome') welcomeCardPreview.value = data.image;
          else farewellCardPreview.value = data.image;
        } else {
          showToast('error', data.error || 'Error al generar preview');
        }
      } catch (e) {
        showToast('error', 'Error de conexion');
      } finally {
        cardPreviewLoading.value = false;
      }
    };

    // --- Librería y editor de animaciones ---
    const loadCardAnimations = async () => {
      try {
        const res = await fetch('/api/card-animations');
        if (!res.ok) return;
        const data = await res.json();
        animationPresets.value = data.presets || [];
        cardAnimations.value = data.animations || [];
      } catch {}
    };

    function getAnimPhase(element, phase) {
      const card = currentConfig.value.card;
      if (!card.textAnimations) card.textAnimations = {};
      if (!card.textAnimations[element]) card.textAnimations[element] = {};
      if (!card.textAnimations[element][phase]) {
        card.textAnimations[element][phase] = { id: 'none', duration: 0.5, reverse: false };
      }
      return card.textAnimations[element][phase];
    }

    const findDefinition = (id) => {
      const preset = animationPresets.value.find(p => p.id === id);
      if (preset?.definition) return JSON.parse(JSON.stringify(preset.definition));
      const saved = cardAnimations.value.find(a => a.id === id);
      return saved ? JSON.parse(JSON.stringify(saved.definition)) : null;
    };

    const currentAnimDraft = () => {
      if (!animEditorOpen.value) return null;
      const phase = getAnimPhase(animEditor.value.element, animEditor.value.phase);
      return {
        element: animEditor.value.element,
        phase: animEditor.value.phase,
        duration: phase.duration,
        reverse: !!phase.reverse,
        definition: animEditor.value.definition,
      };
    };

    let animDraftTimer = null;
    const previewAnimDraft = () => {
      if (!selectedGuild.value || !currentConfig.value.card?.enabled) return;
      const page = currentPage.value;
      if (page !== 'welcome' && page !== 'farewell') return;

      // Con autoplay en un GIF se muestra el archivo animado completo.
      // Sin autoplay (o en PNG) se dibuja el frame exacto del scrubber, que
      // es el único modo en el que se puede aplicar el borrador del editor.
      if (isGifPreview.value && autoPlayPreview.value) {
        previewCard(page);
      } else {
        previewCard(page, animFrame.value, currentAnimDraft());
      }
    };
    const previewAnimDebounced = () => {
      if (!autoRefreshPreview.value) return;
      if (animDraftTimer) clearTimeout(animDraftTimer);
      animDraftTimer = setTimeout(previewAnimDraft, 120);
    };

    const regeneratePreview = () => {
      if (animDraftTimer) clearTimeout(animDraftTimer);
      if (manualPreviewTimer) clearTimeout(manualPreviewTimer);
      previewAnimDraft();
    };

    // Pequeño debounce exclusivo para el scrubber (no depende de Auto-actualizar)
    let manualPreviewTimer = null;
    const regeneratePreviewDebounced = () => {
      if (manualPreviewTimer) clearTimeout(manualPreviewTimer);
      manualPreviewTimer = setTimeout(regeneratePreview, 80);
    };

    const setAutoPlayPreview = (value) => {
      autoPlayPreview.value = value;
      regeneratePreview();
    };

    const animMaxFrame = computed(() => Math.max(0, (currentConfig.value.card?.animationFrames || 30) - 1));

    const jumpToFrame = (value) => {
      animFrame.value = Math.min(animMaxFrame.value, Math.max(0, value));
      regeneratePreview();
    };

    const openAnimEditor = (element, phase) => {
      const ph = getAnimPhase(element, phase);
      const def = ph.id === 'none' ? customDefinition() : (findDefinition(ph.id) || customDefinition());
      animEditor.value = {
        element, phase,
        selectedId: ph.id,
        definition: JSON.parse(JSON.stringify(def)),
      };
      const saved = cardAnimations.value.find(a => a.id === ph.id);
      newAnimName.value = saved ? saved.name : '';
      animEditorOpen.value = true;
      // Editar keyframes necesita ver un frame concreto, no el GIF en bucle
      autoPlayPreview.value = false;
      regeneratePreview();
    };

    const onAnimPhaseChange = (element, phase) => {
      const ph = getAnimPhase(element, phase);
      if (!ph.duration) ph.duration = 0.5;
      if (animEditorOpen.value && animEditor.value.element === element && animEditor.value.phase === phase) {
        animEditor.value.selectedId = ph.id;
        const def = findDefinition(ph.id);
        if (def) animEditor.value.definition = def;
      }
      previewAnimDebounced();
    };

    const addKeyframe = () => {
      const list = animEditor.value.definition.keyframes;
      const last = list[list.length - 1] || { at: 1 };
      list.push({ ...last, at: Math.min(1, (last.at || 0) + 0.25) });
      list.sort((a, b) => a.at - b.at);
      previewAnimDebounced();
    };

    const removeKeyframe = (index) => {
      if (animEditor.value.definition.keyframes.length <= 2) return;
      animEditor.value.definition.keyframes.splice(index, 1);
      previewAnimDebounced();
    };

    const saveCardAnimation = async (update = false) => {
      const id = animEditor.value.selectedId;
      if (update && !id.startsWith('anim_')) return;
      const name = newAnimName.value.trim();
      if (!name) { showToast('error', 'Ponle un nombre a la animacion'); return; }

      animSaving.value = true;
      try {
        const url = update ? `/api/card-animations/${id}` : '/api/card-animations';
        const res = await fetch(url, {
          method: update ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, definition: animEditor.value.definition }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar');
        if (update) {
          const idx = cardAnimations.value.findIndex(a => a.id === id);
          if (idx >= 0) cardAnimations.value[idx] = data;
        } else {
          cardAnimations.value.push(data);
          getAnimPhase(animEditor.value.element, animEditor.value.phase).id = data.id;
          animEditor.value.selectedId = data.id;
        }
        showToast('success', update ? 'Animación actualizada' : 'Animación guardada');
      } catch (e) {
        showToast('error', e.message);
      } finally {
        animSaving.value = false;
      }
    };

    const applySavedAnimation = (anim) => {
      const phase = getAnimPhase(animEditor.value.element, animEditor.value.phase);
      phase.id = anim.id;
      animEditor.value.selectedId = anim.id;
      animEditor.value.definition = JSON.parse(JSON.stringify(anim.definition));
      newAnimName.value = anim.name;
      regeneratePreview();
    };

    const deleteCardAnim = async (id) => {
      if (!confirm('¿Borrar esta animación? Se quitará de las cards que la usen.')) return;
      try {
        const res = await fetch(`/api/card-animations/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('No se pudo borrar');
        cardAnimations.value = cardAnimations.value.filter(a => a.id !== id);
        for (const cfg of [welcomeConfig.value, farewellConfig.value]) {
          const map = cfg.card?.textAnimations;
          if (!map) continue;
          for (const el of Object.keys(map)) {
            for (const ph of Object.keys(map[el])) {
              if (map[el][ph]?.id === id) map[el][ph].id = 'none';
            }
          }
        }
        if (animEditor.value.selectedId === id) animEditor.value.selectedId = 'none';
        showToast('success', 'Animación borrada');
      } catch (e) {
        showToast('error', e.message);
      }
    };

    // Live preview: watch card config changes and regenerate
    watch([currentPage, () => welcomeConfig.value.card, () => farewellConfig.value.card], () => {
      if (!selectedGuild.value) return;
      const page = currentPage.value;
      if (page !== 'welcome' && page !== 'farewell') return;
      const card = page === 'welcome' ? welcomeConfig.value.card : farewellConfig.value.card;
      if (card && card.enabled) previewAnimDebounced();
    }, { deep: true });

    watch(autoRefreshPreview, (value) => {
      if (value) regeneratePreview();
    });

    // Páginas que necesitan un servidor elegido para mostrar contenido.
    // El resto (inicio, comandos, ajustes) funciona sin selección.
    const PAGINAS_CON_GUILD = [
      'welcome', 'farewell', 'private', 'boost', 'ban', 'kick',
      'autorole', 'levels', 'automod', 'logging',
    ];

    // Indica si una opción del menú depende de tener un servidor elegido.
    const necesitaGuild = (pagina) => PAGINAS_CON_GUILD.includes(pagina);

    // Ir a la pantalla de inicio para elegir un servidor desde el estado vacío.
    const irASeleccionarGuild = () => {
      currentPage.value = 'home';
    };

    // Quita el servidor actual y vuelve al selector. También limpia los datos
    // que pertenecían a ese servidor para no reutilizarlos por accidente.
    const deseleccionarGuild = () => {
      selectedGuild.value = null;
      channels.value = [];
      roles.value = [];
      members.value = [];
      previewMember.value = '';
      currentPage.value = 'home';
    };

    const selectGuild = async (guild) => {
      selectedGuild.value = guild;
      currentPage.value = 'welcome';
      activeEmbedTab.value = 'general';
      previewMember.value = '';
      const res = await fetch(`/api/guilds/${guild.id}/channels`);
      if (res.ok) channels.value = await res.json();
      else {
        const res2 = await fetch(`/api/guilds/${guild.id}`);
        const data = await res2.json();
        channels.value = data.channels || [];
      }
      // Load roles
      const rolesRes = await fetch(`/api/guilds/${guild.id}/roles`);
      if (rolesRes.ok) roles.value = await rolesRes.json();
      // Load members
      const membersRes = await fetch(`/api/guilds/${guild.id}/members`);
      if (membersRes.ok) members.value = await membersRes.json();
      await loadConfigs();
    };

    const loadConfigs = async () => {
      if (!selectedGuild.value) return;
      const id = selectedGuild.value.id;
      const [w, f, p, b, ban, k, ar, am, lg, lv] = await Promise.all([
        fetch(`/api/guilds/${id}/welcome`).then(r => r.json()),
        fetch(`/api/guilds/${id}/farewell`).then(r => r.json()),
        fetch(`/api/guilds/${id}/private-welcome`).then(r => r.json()),
        fetch(`/api/guilds/${id}/boost`).then(r => r.json()),
        fetch(`/api/guilds/${id}/ban`).then(r => r.json()),
        fetch(`/api/guilds/${id}/kick`).then(r => r.json()),
        fetch(`/api/guilds/${id}/autorole`).then(r => r.json()),
        fetch(`/api/guilds/${id}/automod`).then(r => r.json()),
        fetch(`/api/guilds/${id}/logging`).then(r => r.json()),
        fetch(`/api/guilds/${id}/levels`).then(r => r.json()),
      ]);
      welcomeConfig.value = { ...welcomeConfig.value, ...w, card: { ...defaultCard(), ...(w.card || {}) } };
      farewellConfig.value = { ...farewellConfig.value, ...f, card: { ...defaultCard(), ...(f.card || {}) } };
      privateConfig.value = p;
      boostConfig.value = b;
      banConfig.value = ban;
      kickConfig.value = k;
      autoRoleConfig.value = {
        enabled: ar.enabled || false,
        roleId: ar.roleId || '',
        botRole: { enabled: ar.botRole?.enabled || false, roleId: ar.botRole?.roleId || '' },
        boostRole: { enabled: ar.boostRole?.enabled || false, roleId: ar.boostRole?.roleId || '' },
        milestones: ar.milestones || [],
        reactionRoles: ar.reactionRoles || [],
      };
      automodConfig.value = {
        enabled: am.enabled || false,
        antiSpam: { enabled: am.antiSpam?.enabled || false, maxMessages: am.antiSpam?.maxMessages || 5, interval: am.antiSpam?.interval || 5000, action: am.antiSpam?.action || 'delete' },
        antiLinks: { enabled: am.antiLinks?.enabled || false, action: am.antiLinks?.action || 'delete', whitelistedDomains: am.antiLinks?.whitelistedDomains || ['youtube.com', 'youtu.be', 'twitch.tv', 'discord.gg'] },
        whitelistedDomainsStr: (am.antiLinks?.whitelistedDomains || ['youtube.com', 'youtu.be', 'twitch.tv', 'discord.gg']).join(', '),
        antiCaps: { enabled: am.antiCaps?.enabled || false, minLetters: am.antiCaps?.minLetters || 10, maxPercentage: am.antiCaps?.maxPercentage || 70, action: am.antiCaps?.action || 'delete' },
        bannedWords: { enabled: am.bannedWords?.enabled || false, words: am.bannedWords?.words || [], wordsStr: (am.bannedWords?.words || []).join(', '), action: am.bannedWords?.action || 'delete' },
      };
      loggingConfig.value = {
        channel: lg.channel || '',
        messageDelete: lg.messageDelete !== false,
        messageUpdate: lg.messageUpdate !== false,
        voiceStateUpdate: lg.voiceStateUpdate === true,
        roleUpdate: lg.roleUpdate === true,
      };
      levelsConfig.value = {
        enabled: lv.enabled || false,
        xpPerMessage: { min: lv.xpPerMessage?.min || 15, max: lv.xpPerMessage?.max || 25 },
        xpCooldown: lv.xpCooldown || 60,
        messageCooldown: lv.messageCooldown || 0,
        channelMultipliers: lv.channelMultipliers || [],
        streakMultiplier: { enabled: lv.streakMultiplier?.enabled || false, dailyBonus: lv.streakMultiplier?.dailyBonus || 0.1, maxMultiplier: lv.streakMultiplier?.maxMultiplier || 2.5 },
        levelFormula: { base: lv.levelFormula?.base || 100, exponent: lv.levelFormula?.exponent || 1.5 },
        levelRoles: lv.levelRoles || [],
        icons: lv.icons || [],
        achievements: lv.achievements || [],
        ignoredChannels: lv.ignoredChannels || [],
        announcementChannel: lv.announcementChannel || '',
        announceLevelUp: lv.announceLevelUp !== false,
        announceAchievement: lv.announceAchievement !== false,
        levelUpEmbed: { title: lv.levelUpEmbed?.title || '¡Subiste de nivel!', description: lv.levelUpEmbed?.description || '¡Felicidades {user}! Ahora eres nivel **{level}**', color: lv.levelUpEmbed?.color || '#5865F2' },
        commandsEnabled: { rank: lv.commandsEnabled?.rank !== false, leaderboard: lv.commandsEnabled?.leaderboard !== false, profile: lv.commandsEnabled?.profile !== false, achievements: lv.commandsEnabled?.achievements !== false },
        titleMinLevel: lv.titleMinLevel || 10,
      };
      if (levelsConfig.value.enabled) loadLevelsLeaderboard();
    };

    // Pinta las tres tarjetas superiores con los datos que llegan del bot.
    const aplicarStats = (data) => {
      if (data.status) status.value = data.status;
      if (data.guilds !== undefined) stats.value[0].value = data.guilds;
      if (data.users !== undefined) stats.value[1].value = data.users;
      if (data.uptime !== undefined) stats.value[2].value = formatUptime(data.uptime);
    };

    // Consulta inicial por si Socket.IO tarda en conectar o no está disponible.
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) aplicarStats(await res.json());
      } catch {}
    };

    const loadGuilds = async () => {
      loadingGuilds.value = true;
      try {
        const res = await fetch('/api/guilds');
        guilds.value = await res.json();
      } finally {
        loadingGuilds.value = false;
      }
    };

    const loadAuthorizedServers = async () => {
      try {
        const res = await fetch('/api/authorized-servers');
        const data = await res.json();
        authorizedServers.value = data.servers;
        authorizedFilter.value = data.hasFilter;
      } catch {}
    };

    const toggleServerAuth = async (guildId, authorized) => {
      try {
        // Fetch current state from server
        const settingsRes = await fetch('/api/authorized-servers');
        const { servers } = await settingsRes.json();

        // Build blocklist: only servers that are NOT authorized
        // (empty = mode libre, all servers work)
        const current = {};
        for (const s of servers) {
          if (s.id === guildId) {
            // This is the one we're toggling
            if (!authorized) current[s.id] = false;
            // If authorized, don't add (means allowed)
          } else {
            // Other servers: keep their current state
            if (!s.authorized) current[s.id] = false;
          }
        }

        await fetch('/api/authorized-servers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorizedServers: current }),
        });
        await loadAuthorizedServers();
        showToast('success', authorized ? 'Servidor autorizado' : 'Servidor desautorizado');
      } catch {
        showToast('error', 'Error al guardar');
      }
    };

    const toggleAuthFilter = async (enabled) => {
      try {
        await fetch('/api/authorized-filter', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        authorizedFilter.value = enabled;
        await loadAuthorizedServers();
        showToast('success', enabled ? 'Filtro activado: solo servidores autorizados' : 'Filtro desactivado: todos los servidores pueden usar el bot');
      } catch {
        showToast('error', 'Error al guardar');
      }
    };

    const loadDashboardConfig = async () => {
      try {
        const res = await fetch('/api/dashboard-config');
        if (res.ok) {
          const data = await res.json();
          dashboardConfig.value = { ...dashboardConfig.value, ...data };
        }
      } catch {}
    };

    const saveDashboardConfig = async () => {
      try {
        const res = await fetch('/api/dashboard-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dashboardConfig.value),
        });
        if (res.ok) showToast('success', 'Ajustes del dashboard guardados');
        else showToast('error', 'Error al guardar');
      } catch {
        showToast('error', 'Error de conexion');
      }
    };

    const uploadDashboardLogo = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('image', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const { url } = await res.json();
          dashboardConfig.value.logo = url;
          saveDashboardConfig();
          showToast('success', 'Logo actualizado');
        } else {
          showToast('error', 'Error al subir logo');
        }
      } catch (e) {
        showToast('error', 'Error de conexion');
      }
      event.target.value = '';
    };

    // El scrubber y el borrador también deben refrescar la preview
    // El scrubber es una acción manual: siempre actualiza, aunque el
    // auto-actualizado esté desactivado para los cambios de configuración.
    watch(animFrame, regeneratePreviewDebounced);
    watch(animEditor, previewAnimDebounced, { deep: true });

    // Cada vez que se abre el panel de comandos se vuelven a consultar:
    // si el bot se reinició o cambiaron los comandos, se refleja al instante.
    watch(currentPage, (pagina) => {
      if (pagina === 'commands') loadCommands();
      cerrarSidebar();
    });

    onMounted(() => {
      loadStatus();
      loadCommands();
      loadDashboardConfig();
      loadAuthorizedServers();
      loadFonts();
      loadCardAnimations();
      socket.on('status', (data) => { status.value = data.status; });
      socket.on('stats', aplicarStats);
      // Escape cierra el menú lateral, igual que en cualquier app nativa.
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarOpen.value) sidebarOpen.value = false;
      });
      loadGuilds();
    });

    return {
      status, guilds, selectedGuild, channels, currentPage, stats, commands,
      commandsLoading, commandsError, commandSearch, commandCategory,
      commandCategories, filteredCommands, loadCommands,
      commandGroups, iconoComando, colorCategoria,
      sidebarOpen, toggleSidebar, cerrarSidebar,
      PAGINAS_CON_GUILD, necesitaGuild, irASeleccionarGuild, deseleccionarGuild,
      navItems, currentPageTitle, currentPageDesc, loadingGuilds, saving, toasts,
      welcomeConfig, farewellConfig, privateConfig, boostConfig, banConfig, kickConfig, autoRoleConfig, autoRoleTab,
      levelsConfig, levelsTab, levelsLeaderboard,
      automodConfig, loggingConfig, authorizedServers, authorizedFilter,
      currentConfig, roles, members, previewMember, dashboardConfig,
      embedTabs, activeEmbedTab, colorPresets, availableVars, availableFonts,
      configTitle, configDesc, hasInlineFields, sendingPreview,
      selectGuild, saveConfig, saveAutoRole, sendReactionRole, saveAutoMod, saveLogging,
      saveLevels, loadLevelsLeaderboard,
      saveDashboardConfig, uploadDashboardLogo, uploadCardBg, uploadFont, previewCard,
      resetEmbed, addField, copyVar, replacePreview,
      uploadImage, sendPreview, showToast, toggleServerAuth, toggleAuthFilter,
      welcomeCardPreview, farewellCardPreview, cardPreviewLoading,
      animElements, animPhases, phaseInfo, animationPresets, cardAnimations,
      animEditorOpen, animFrame, animMaxFrame, autoPlayPreview, autoRefreshPreview,
      animSaving, newAnimName, animEditor, isGifPreview, timelineBar,
      getAnimPhase, openAnimEditor, onAnimPhaseChange, addKeyframe, removeKeyframe,
      saveCardAnimation, deleteCardAnim, previewAnimDraft, previewAnimDebounced, regeneratePreview,
      setAutoPlayPreview, jumpToFrame, applySavedAnimation,
    };
  }
}).mount('#app');
