const { createApp, ref, computed, onMounted, watch } = Vue;

createApp({
  setup() {
    const socket = io();
    const status = ref('offline');
    const guilds = ref([]);
    const selectedGuild = ref(null);
    const channels = ref([]);
    const currentPage = ref('home');
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

    const commands = ref([
      { name: 'ping', description: 'Muestra la latencia del bot' },
      { name: 'serverinfo', description: 'Informacion del servidor' },
      { name: 'help', description: 'Muestra todos los comandos' },
      { name: 'userinfo', description: 'Informacion de un usuario' },
      { name: 'avatar', description: 'Avatar de un usuario' },
      { name: 'server', description: 'Info detallada del servidor' },
      { name: 'botinfo', description: 'Informacion del bot' },
      { name: '8ball', description: 'La bola magica responde' },
      { name: 'poll', description: 'Crear una encuesta' },
      { name: 'remind', description: 'Establecer un recordatorio' },
      { name: 'announce', description: 'Enviar un anuncio a un canal' },
      { name: 'nick', description: 'Cambiar nickname de un usuario' },
      { name: 'ban', description: 'Banear a un usuario (Admin)' },
      { name: 'kick', description: 'Expulsar a un usuario (Admin)' },
      { name: 'warn', description: 'Advertir a un usuario (Admin)' },
      { name: 'warnings', description: 'Ver advertencias (Admin)' },
      { name: 'unwarn', description: 'Remover advertencia (Admin)' },
      { name: 'timeout', description: 'Silenciar usuario temporalmente (Admin)' },
      { name: 'untimeout', description: 'Remover silencio (Admin)' },
      { name: 'purge', description: 'Eliminar mensajes (Admin)' },
      { name: 'slowmode', description: 'Slowmode del canal (Admin)' },
    ]);

    const navItems = [
      { id: 'home', label: 'Inicio', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>' },
      { id: 'welcome', label: 'Bienvenidas', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>' },
      { id: 'farewell', label: 'Despedidas', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>' },
      { id: 'private', label: 'DM Bienvenida', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>' },
      { id: 'boost', label: 'Boost', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>' },
      { id: 'ban', label: 'Bans', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>' },
      { id: 'kick', label: 'Kicks', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"></path></svg>' },
      { id: 'autorole', label: 'Auto-Role', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>' },
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

    const defaultCard = () => ({
      enabled: false,
      theme: 'dark',
      backgroundImage: '',
      borderColor: '#5865F2',
      borderWidth: 2,
      borderRadius: 10,
      animated: false,
      overlayOpacity: 0.6,
    });

    const defaultEmbed = () => ({
      title: '', description: '', color: '#5865F2',
      thumbnail: '', image: '',
      author: { name: '', iconUrl: '', url: '' },
      footer: { text: '', iconUrl: '' },
      fields: [],
    });

    const welcomeConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: defaultEmbed(), card: defaultCard() });
    const farewellConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#ED4245' }, card: { ...defaultCard(), avatarBorderColor: '#ED4245' } });
    const privateConfig = ref({ enabled: false, message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#eb459e' } });
    const boostConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#f47fff' } });
    const banConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#ED4245' } });
    const kickConfig = ref({ enabled: false, channel: '', message: '', embedEnabled: true, embed: { ...defaultEmbed(), color: '#FF9044' } });
    const autoRoleConfig = ref({ enabled: false, roleId: '' });
    const automodConfig = ref({
      enabled: false,
      antiSpam: { enabled: false, maxMessages: 5, interval: 5000, action: 'delete', allowedChannels: [] },
      antiLinks: { enabled: false, action: 'delete', whitelistedDomains: ['youtube.com', 'youtu.be', 'twitch.tv', 'discord.gg'], allowedChannels: [] },
      antiCaps: { enabled: false, minLetters: 10, maxPercentage: 70, action: 'delete', allowedChannels: [] },
      bannedWords: { enabled: false, words: [], wordsStr: '', action: 'delete', allowedChannels: [] },
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

    const currentPageTitle = computed(() => {
      const t = { home: 'Inicio', welcome: 'Bienvenidas', farewell: 'Despedidas', private: 'DM Bienvenida', boost: 'Boost', ban: 'Bans', kick: 'Kicks', autorole: 'Auto-Role', automod: 'Auto-Moderación', logging: 'Logging', commands: 'Comandos', settings: 'Ajustes' };
      return t[currentPage.value] || 'Inicio';
    });

    const currentPageDesc = computed(() => {
      const d = { home: 'Panel de control', welcome: 'Mensajes de bienvenida', farewell: 'Mensajes de despedida', private: 'DM de bienvenida', boost: 'Mensajes de boost', ban: 'Mensajes de ban', kick: 'Mensajes de kick', autorole: 'Rol automatico al unirse', automod: 'Filtros automaticos del chat', logging: 'Registro de eventos del servidor', commands: 'Comandos del bot', settings: 'Personaliza el dashboard' };
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

    const saveAutoMod = async () => {
      if (!selectedGuild.value) return;
      saving.value = true;
      try {
        const data = { ...automodConfig.value };
        if (data.bannedWords.wordsStr) {
          data.bannedWords.words = data.bannedWords.wordsStr.split(',').map(w => w.trim()).filter(Boolean);
        }
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

    const previewCardDebounce = { welcome: null, farewell: null };
    const cardPreviewLoading = ref(false);

    const previewCard = async (type) => {
      if (!selectedGuild.value) return;
      cardPreviewLoading.value = true;
      try {
        const res = await fetch(`/api/guilds/${selectedGuild.value.id}/preview-card/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(type === 'welcome' ? welcomeConfig.value.card : farewellConfig.value.card),
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

    const previewCardDebounced = (type) => {
      if (previewCardDebounce[type]) clearTimeout(previewCardDebounce[type]);
      previewCardDebounce[type] = setTimeout(() => previewCard(type), 400);
    };

    // Live preview: watch card config changes and regenerate
    watch([currentPage, () => welcomeConfig.value.card, () => farewellConfig.value.card], () => {
      if (!selectedGuild.value) return;
      const page = currentPage.value;
      if (page !== 'welcome' && page !== 'farewell') return;
      const card = page === 'welcome' ? welcomeConfig.value.card : farewellConfig.value.card;
      if (card && card.enabled) {
        previewCardDebounced(page);
      }
    }, { deep: true });

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
      const [w, f, p, b, ban, k, ar, am, lg] = await Promise.all([
        fetch(`/api/guilds/${id}/welcome`).then(r => r.json()),
        fetch(`/api/guilds/${id}/farewell`).then(r => r.json()),
        fetch(`/api/guilds/${id}/private-welcome`).then(r => r.json()),
        fetch(`/api/guilds/${id}/boost`).then(r => r.json()),
        fetch(`/api/guilds/${id}/ban`).then(r => r.json()),
        fetch(`/api/guilds/${id}/kick`).then(r => r.json()),
        fetch(`/api/guilds/${id}/autorole`).then(r => r.json()),
        fetch(`/api/guilds/${id}/automod`).then(r => r.json()),
        fetch(`/api/guilds/${id}/logging`).then(r => r.json()),
      ]);
      welcomeConfig.value = { ...welcomeConfig.value, ...w, card: { ...defaultCard(), ...(w.card || {}) } };
      farewellConfig.value = { ...farewellConfig.value, ...f, card: { ...defaultCard(), ...(f.card || {}) } };
      privateConfig.value = p;
      boostConfig.value = b;
      banConfig.value = ban;
      kickConfig.value = k;
      autoRoleConfig.value = ar;
      automodConfig.value = {
        enabled: am.enabled || false,
        antiSpam: { enabled: am.antiSpam?.enabled || false, maxMessages: am.antiSpam?.maxMessages || 5, interval: am.antiSpam?.interval || 5000, action: am.antiSpam?.action || 'delete' },
        antiLinks: { enabled: am.antiLinks?.enabled || false, action: am.antiLinks?.action || 'delete', whitelistedDomains: am.antiLinks?.whitelistedDomains || ['youtube.com', 'youtu.be', 'twitch.tv', 'discord.gg'] },
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

    const loadDashboardConfig = () => {
      const saved = localStorage.getItem('dashboardConfig');
      if (saved) {
        try { Object.assign(dashboardConfig.value, JSON.parse(saved)); } catch {}
      }
    };

    const saveDashboardConfig = () => {
      localStorage.setItem('dashboardConfig', JSON.stringify(dashboardConfig.value));
      showToast('success', 'Ajustes del dashboard guardados');
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

    onMounted(() => {
      loadDashboardConfig();
      socket.on('status', (data) => { status.value = data.status; });
      socket.on('stats', (data) => {
        stats.value[0].value = data.guilds;
        stats.value[1].value = data.users;
        stats.value[2].value = formatUptime(data.uptime);
      });
      loadGuilds();
    });

    return {
      status, guilds, selectedGuild, channels, currentPage, stats, commands,
      navItems, currentPageTitle, currentPageDesc, loadingGuilds, saving, toasts,
      welcomeConfig, farewellConfig, privateConfig, boostConfig, banConfig, kickConfig, autoRoleConfig,
      automodConfig, loggingConfig,
      currentConfig, roles, members, previewMember, dashboardConfig,
      embedTabs, activeEmbedTab, colorPresets, availableVars,
      configTitle, configDesc, hasInlineFields, sendingPreview,
      selectGuild, saveConfig, saveAutoRole, saveAutoMod, saveLogging,
      saveDashboardConfig, uploadDashboardLogo, uploadCardBg, previewCard,
      resetEmbed, addField, copyVar, replacePreview,
      uploadImage, sendPreview, showToast,
      welcomeCardPreview, farewellCardPreview, cardPreviewLoading,
    };
  }
}).mount('#app');
