# AGENTS.md — Guía del Proyecto Hazuru's Assistant

## Qué es este proyecto

Bot de Discord + Dashboard web local para gestionar servidores.
Hecho con Node.js ≥ 20, Discord.js 14, Vue 3 + Tailwind (CDN), Docker.

## Estructura del proyecto

```
├── src/
│   ├── index.js                  # Entry point. Express server + Discord client + todas las rutas API
│   ├── commands/                 # Comandos slash de Discord
│   │   ├── ping.js               # Ping/pong
│   │   ├── help.js               # Lista de comandos
│   │   ├── serverinfo.js         # Info del servidor
│   │   ├── userinfo.js           # Info de un usuario
│   │   ├── avatar.js             # Avatar de un usuario
│   │   ├── server.js             # Stats del servidor
│   │   ├── 8ball.js              # Bola mágica
│   │   ├── botinfo.js            # Info del bot
│   │   ├── poll.js               # Encuestas
│   │   ├── remind.js             # Recordatorios
│   │   ├── announce.js           # Anuncios
│   │   ├── nick.js               # Cambiar nickname
│   │   ├── ban.js                # Banear usuario
│   │   ├── kick.js               # Expulsar usuario
│   │   ├── warn.js               # Warnear usuario
│   │   ├── warnings.js           # Ver warns
│   │   ├── unwarn.js             # Quitar warn
│   │   ├── timeout.js            # Timeout usuario
│   │   ├── untimeout.js          # Quitar timeout
│   │   ├── purge.js              # Borrar mensajes
│   │   ├── slowmode.js           # Slowmode
│   │   ├── rank.js               # Ver nivel/XP propio
│   │   ├── leaderboard.js        # Top rankings
│   │   ├── profile.js            # Perfil extendido
│   │   ├── achievements.js       # Lista de logros
│   │   ├── racha.js              # Racha diaria
│   │   ├── setlevel.js           # Admin: fijar nivel
│   │   ├── setxp.js              # Admin: fijar XP
│   │   ├── resetlevels.js        # Admin: resetear niveles
│   │   └── title.js              # Cambiar título visible
│   ├── events/                   # Eventos de Discord.js (auto-cargados)
│   │   ├── ready.js              # Bot conectado
│   │   ├── interactionCreate.js  # Slash commands + reaction roles
│   │   ├── messageCreate.js      # Automod + OpenCode + XP/niveles
│   │   ├── guildMemberAdd.js     # Bienvenida + auto-role + milestones
│   │   ├── guildMemberRemove.js  # Despedida (detecta kick vs leave)
│   │   ├── guildMemberUpdate.js  # Detección de boost → boostRole
│   │   ├── guildBanAdd.js        # Ban announcement
│   │   ├── messageDelete.js      # Log de mensajes borrados
│   │   ├── messageUpdate.js      # Log de mensajes editados
│   │   ├── voiceStateUpdate.js   # Log de voz
│   │   ├── messageReactionAdd.js # Reaction roles (emoji mode)
│   │   └── messageReactionRemove.js # Quitar reaction role
│   ├── database/                 # Persistencia en JSON
│   │   ├── index.js              # Main DB: guilds.json (config por servidor)
│   │   ├── atomic.js             # Escritura atómica (tmp + fsync + rename) y lectura con recuperación
│   │   ├── backup.js             # Copias de seguridad de las bases JSON
│   │   ├── levels.js             # XP/niveles: levels.json (datos por usuario)
│   │   ├── warnings.js           # warnings.json
│   │   ├── reminders.js          # reminders.json
│   │   ├── settings.js           # settings.json (config global del bot)
│   │   ├── cardAnimations.js     # cardAnimations.json (librería global de animaciones)
│   │   └── cardAnimations.json   # Animaciones guardadas (NO commitear contenido real)
│   └── utils/                    # Utilidades
│       ├── cardGenerator.js      # Generador de tarjetas PNG/GIF (bienvenida/despedida)
│       ├── textAnimations.js     # Motor de animación de texto: presets + keyframes + fases
│       ├── buildEmbed.js         # Constructor de embeds
│       ├── replaceVars.js        # Reemplazo de variables ({user}, {server}, etc.)
│       ├── logger.js             # Logging (logError, logInfo, logEvent)
│       ├── getLogChannel.js      # Resuelve el canal de logs de cada servidor
│       ├── parseDuration.js      # Convierte "10m", "2h", "1d" a milisegundos
│       ├── permissions.js        # Helpers de permisos (admin/mod)
│       ├── leveling.js           # Motor de XP: processMessage, assignLevelRoles, checkAchievements
│       ├── opencode.js           # Cliente API de OpenCode (AI por DM/canal)
│       └── automod/              # Filtros de auto-moderación
│           ├── antiSpam.js
│           ├── antiLinks.js
│           ├── antiCaps.js
│           └── bannedWords.js
├── frontend/
│   ├── index.html                # Dashboard web (Vue 3 + Tailwind)
│   └── app.js                    # Lógica del dashboard (reactividad, fetch, guardado)
├── uploads/                      # Imágenes subidas + fuentes custom (gitignored)
│   └── fonts/                    # Fuentes .ttf/.otf/.woff + fonts.json con el nombre visible
├── logs/                         # Logs del bot (gitignored)
├── backups/                      # Backups de las bases JSON (gitignored)
├── Dockerfile                    # Build: Node 20 Alpine + fontconfig + font-dejavu
├── docker-compose.yml            # Servicios: bot + watch (dev)
├── deploy-commands.js            # Registra comandos slash
├── .env                          # Variables de entorno (NO subir a git)
└── .gitignore
```

## Convenciones de código

### Comentarios
- **TODO el código debe estar comentado en español** para que lo entienda un dev principiante
- Cada archivo tiene un bloque de documentación al inicio explicando qué hace
- Las funciones tienen comentarios explicando la lógica paso a paso
- Los comentarios inline explican el "por qué", no solo el "qué"
- Ejemplo de buen comentario:
  ```js
  // Verificar si el usuario tiene cooldown activo
  // Si no pasó el tiempo suficiente desde el último mensaje, no gana XP
  const now = Date.now();
  if (now - user.lastXpMessage < cooldown) return null;
  ```

### Nombres de variables y funciones
- En español para lógica del dominio (`getOrCreateUser`, `processMessage`, `replaceVars`)
- En inglés para APIs y librerías (`discord.js`, `express`, `multer`)
- Funciones que empiezan con `get` retornan datos
- Funciones que empiezan con `save` guardan datos
- Funciones que empiezan con `check` validan algo y retornan boolean/array

### Estructura de cada archivo
1. **Bloque de documentación** al inicio (qué hace, parámetros, permisos)
2. **Requisitos** (requires)
3. **Lógica principal** con comentarios paso a paso
4. **Export** al final

### Endpoints API
- `GET /api/guilds/:id/[seccion]` → obtener configuración
- `PUT /api/guilds/:id/[seccion]` → actualizar configuración
- `POST` para subir archivos o acciones especiales
- Siempre responder con JSON
- Manejar errores con try/catch + logError

### Comandos slash
- `data`: SlashCommandBuilder con descripción
- `execute(interaction)`: lógica del comando
- Usar `ephemeral: true` para respuestas privadas
- Verificar permisos con `setDefaultMemberPermissions(4)` para admin

## Variables de mensaje (replaceVars)
Disponibles en bienvenidas, despedidas, boosts, bans, kicks:
- `{user}` `{user.name}` `{user.id}` `{user.avatar}` `{user.tag}` `{user.mention}` `{user.createdAt}` `{user.joinedAt}`
- `{server}` `{server.id}` `{server.icon}`
- `{memberCount}` `{boost}` `{date}` `{time}`
- `{moderator}` `{reason}` (solo bans/kicks)

### Variables en tarjetas (cardGenerator)
El título y el subtítulo de las tarjetas aceptan las mismas variables, con una diferencia:
`{user}` se reemplaza por el **nombre de usuario** (no una mención), porque una mención
no se renderiza dentro de una imagen.

## Tarjetas de bienvenida/despedida
- `src/utils/cardGenerator.js` genera PNG (`generateCard`) o GIF (`generateAnimatedCard`).
- El layout es dinámico: las alturas de línea se calculan según el tamaño de fuente y el
  bloque se centra verticalmente, así que no se solapa al subir `titleSize`/`usernameSize`/`subtitleSize`.
- El texto que excede el ancho disponible se reduce automáticamente y, si aún no cabe, se trunca con `…`.
- Las fuentes de `uploads/fonts/` se registran usando el nombre visible de `fonts.json`
  (ej: `BoldPixels`), no el nombre del archivo.

## Animación de textos en tarjetas
- `src/utils/textAnimations.js` es el **único motor**. Los presets y las animaciones
  guardadas son solo keyframes que se resuelven e interpolan igual.
- 10 presets: `fadeIn`, `slideUp`, `slideLeft`, `slideRight`, `pop`, `pulse`,
  `typewriter`, `bounce`, `glitch`, `reveal`. La fase admite `reverse: true` para
  convertirlos en su versión de salida.
- Cada elemento (`title`, `username`, `subtitle`) tiene `intro`, `loop` y `outro`
  con `{ id, duration, reverse }`. `id` puede ser `none`, un preset o un ID `anim_…`.
- Timeline: `animationFrames * animationDelay / 1000` (default 3 s). Intro al inicio,
  outro al final y el bucle rellena el tiempo restante (se repite cada `loop.duration`).
- Sin `textAnimations` (o todo en `none`) el dibujo es byte-idéntico al anterior.
- La composición multiplica opacidad/escala, suma X/Y/rotación y toma el mínimo en
  `chars`/`reveal`, así se pueden combinar las tres fases sin conflictos.
- `typewriter` recorta caracteres y `reveal` recorta el ancho con un `clip`, siempre
  después de `replaceCardVars` y `fitText`.
- `generateCard(member, config, isWelcome, { frame, draftAnimation })` permite
  renderizar un frame puntual del timeline. El dashboard usa `draftAnimation` con el
  ID interno `__draft__` para ver la animación en edición antes de guardarla.
- API: `GET/POST /api/card-animations`, `PUT/DELETE /api/card-animations/:id`.
  `POST /api/guilds/:id/preview-card/:type` acepta `frame` y `draftAnimation`.
- `src/database/cardAnimations.js` persiste en `cardAnimations.json` con `atomic.js`.
  Es **global por despliegue** (no por usuario): `ownerId` queda en `null` reservado
  para cuando se añadan cuentas. Si se borra una animación en uso, `resolve()` cae a
  `none` sin romper la card.

## Sistema de Niveles
- XP se gana por mensaje (configurable min/max)
- Cooldown de XP (default 60s) y cooldown de mensajes (default 0)
- Multiplicadores por canal y por racha diaria
- Logros automáticos al alcanzar umbrales
- Roles automáticos por nivel
- Títulos personalizados (requiere nivel mínimo)
- Canales bloqueados (sin XP ni anuncios)
- Fórmula configurable: `base * nivel^exponent`

## Persistencia
- Toda escritura de bases JSON pasa por `src/database/atomic.js`:
  `writeFileSync` a un `.tmp`, `fsync` y `rename` (atómico).
- `readJson` intenta recuperar desde el backup si el archivo está corrupto.
- No leer/escribir los JSON directamente: usar los helpers de cada módulo.
- `cardAnimations.json` también pasa por `atomic.js` y se respalda antes de cada
  cambio (`createBackup('cardAnimations.json')`).

## Docker
- `docker compose up -d bot` → arrancar bot
- `docker compose --profile dev up -d` → arrancar bot + watch (dev)
- El bot usa `network_mode: host` para acceder a OpenCode en localhost
- DNS fix: `dns: [8.8.8.8, 8.8.4.4]` para evitar errores de resolución
- Las fuentes custom van en `uploads/fonts/` y se registran al iniciar
- El dashboard/API escucha en `0.0.0.0:3001`; usar `http://127.0.0.1:3001` (no `localhost`, que puede resolver a `::1`)

## Variables de entorno (.env)
```
DISCORD_TOKEN=       # Token del bot
CLIENT_ID=           # Client ID
CLIENT_SECRET=       # Client Secret
GUILD_ID=            # Guild ID principal
OPENCODE_OWNER_ID=   # ID del owner para comandos !ai
OPENCODE_SERVER_URL= # URL de OpenCode (http://127.0.0.1:4096)
PORT=3001            # Puerto del dashboard
```

## Comandos importantes
- `docker compose restart bot` → reiniciar bot después de cambiar código
- `docker compose exec bot node deploy-commands.js` → redeploy comandos slash
- `node --check [archivo]` → verificar sintaxis sin ejecutar

## Reglas para agentes

1. **No hardcodear secrets** — Usar `process.env.*` siempre. `.env` está en `.gitignore`.
2. **Carga dinámica** — No modificar `index.js` para registrar comandos/eventos; crear el archivo en la carpeta correspondiente.
3. **Base de datos JSON** — Usar los helpers de `src/database/*.js`. Nunca leer/escribir `guilds.json` directo.
4. **Frontend Vue** — Estado reactivo en `setup()`. APIs vía `fetch('/api/...')`. Socket.IO en el `socket` global.
5. **Imágenes subidas** → `/uploads` (multer, 8 MB máx, solo imágenes). Servidas estáticamente.
6. **Tarjetas canvas** → `src/utils/cardGenerator.js` (PNG/GIF animado con `@napi-rs/canvas`).
7. **Logs** → `src/utils/logger.js` (`logInfo`, `logError`, `logWarn`).
8. **Variables en mensajes** → `src/utils/replaceVars.js`.
9. **Permisos** → `src/utils/permissions.js` (`checkAdmin`, `checkMod`, etc.).
10. **Docker** — Multi-stage: builder (`npm ci`) → runner (`node:20-alpine`, usuario non-root). `.dockerignore` excluye `node_modules`, `.env`, bases JSON, `uploads/` y `logs/`.

## Archivos sensibles (NO commitear)

- `.env` — Tokens reales
- `src/database/guilds.json` — Config real de servidores (IDs, canales)
- `src/database/warnings.json` — Advertencias de usuarios reales
- `src/database/reminders.json` — Recordatorios reales
- `src/database/levels.json` — XP y niveles de usuarios reales
- `src/database/settings.json` — Config global del bot
- `src/database/cardAnimations.json` — Animaciones custom creadas en el dashboard
- `uploads/` — Imágenes y fuentes subidas
- `logs/`, `backups/`
- `node_modules/`

## Notas importantes
- El bot y el dashboard comparten el puerto 3001 (no correr ambos al mismo tiempo en dev)
- `saveUser` en `levels.js` es async (usa write queue para evitar race conditions)
- El leaderboard ordena por nivel primero, luego por XP
- Los system messages de Discord (`message.system`) no se procesan para XP
- Los mensajes del bot (`message.author.bot`) se ignoran siempre
- Automod se ejecuta ANTES del sistema de niveles

## Alcance actual y visión a futuro

- Hoy es un proyecto **local y de código abierto**: cada persona crea su bot en el
  portal de Discord, clona el repo, configura `.env` y levanta su contenedor Docker.
- El dashboard no tiene login, hosting ni versión comercial/verificada. Escucha en
  `127.0.0.1:3001`, así que solo accede quien tiene esa máquina.
- Las animaciones guardadas son globales **por despliegue**, reutilizables en todos
  los servidores que administre esa instalación. `ownerId` queda preparado para el día
  que existan cuentas.
- A futuro (no implementado): cuentas/OAuth2 para separar animaciones por usuario,
  marketplace de tarjetas y animaciones de la comunidad, y un servicio hospedado con
  bots verificados y panel público. Mantener esas ideas documentadas para no perder
  el contexto de por qué la librería es global por ahora.

## Licencia

GPL-3.0 — Copyright (C) 2025 Moises A. Marcano (Hazuru00). Ver `LICENSE`.
