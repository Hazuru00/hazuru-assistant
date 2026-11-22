# Hazuru's Assistant

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![discord.js](https://img.shields.io/badge/discord.js-14.16.3-5865F2.svg)](https://discord.js.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](https://www.docker.com/)

Bot de Discord con **dashboard web** para configurar mensajes de bienvenida, despedida, DMs privados, automod, logging, auto-roles, recordatorios, advertencias, bans/kicks, boost, y más. Incluye generador de tarjetas visuales (PNG/GIF animado) con canvas.

> **Autor**: Moises A. Marcano (Hazuru00)  
> **Licencia**: GNU GPL v3 — ver [LICENSE](LICENSE)

---

## Características principales

| Módulo | Descripción |
|--------|-------------|
| **Bienvenidas / Despedidas** | Embeds + tarjetas visuales (temas, avatar, fondo) con **animación de texto** configurable: entrada, bucle y salida |
| **DM de bienvenida** | Mensaje privado al nuevo miembro con variables dinámicas |
| **Auto-Role** | Asignar rol automático al unirse |
| **Auto-Moderación** | Filtro de links, invites, palabras prohibidas, spam, mayúsculas |
| **Logging** | Logs de mensajes editados/eliminados, joins/leaves, bans/kicks, voice, role changes |
| **Boost / Ban / Kick** | Mensajes y tarjetas dedicadas |
| **Advertencias** | Sistema de warns con escalado automático (timeout/ban/kick) |
| **Recordatorios** | `/remind` persistente (sobrevive reinicios) |
| **Sistema de niveles** | XP por mensaje, roles por nivel, logros, rachas y títulos personalizados |
| **IA (OpenCode)** | Consultas por DM/canal a través de `!ai`, restringidas al owner |
| **Reaction Roles** | Auto-roles por reacción (añadir/quitar emoji) |
| **Comandos de moderación** | ban, kick, timeout, purge, slowmode, nick, warn, unwarn, warnings |
| **Comandos de info** | serverinfo, userinfo, avatar, botinfo, poll, 8ball, announce |
| **Dashboard Web** | SPA Vue 3 + Tailwind (CDN) — config visual, preview en tiempo real, Socket.IO stats |

---

## Capturas

| Dashboard | Editor de Bienvenida | Tarjeta Generada |
|-----------|---------------------|------------------|
| ![Dashboard](docs/dashboard.png) | ![Welcome Editor](docs/welcome-editor.png) | ![Welcome Card](docs/welcome-card.png) |

*(Agrega tus capturas en `docs/`)*

---

## Instalación rápida

### Requisitos
- Node.js ≥ 20
- Cuenta Discord Developer → [Crear aplicación](https://discord.com/developers/applications)
- Bot token + privilegios: `Guilds`, `GuildMessages`, `MessageContent`, `GuildMembers`, `GuildVoiceStates`, `GuildBans`

### Local (desarrollo)

```bash
# 1. Clonar e instalar
git clone https://github.com/Hazuru00/hazuru-assistant.git
cd hazuru-assistant
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con tus tokens (ver Variables de entorno)

# 3. Registrar comandos slash (solo primera vez o al añadir comandos)
node deploy-commands.js

# 4. Iniciar
npm run dev          # Con nodemon (auto-reload)
# El dashboard está en http://localhost:3001
```

### Docker (producción)

```bash
# 1. Configurar .env
cp .env.example .env
# Editar .env

# 2. Levantar
docker compose up -d

# 3. Ver logs
docker compose logs -f

# Desarrollo con hot-reload
docker compose --profile dev up watch
```

---

## Variables de entorno

Crea `.env` basado en `.env.example`:

```env
# Obligatorias
DISCORD_TOKEN=tu_token_del_bot_aqui
CLIENT_ID=tu_application_id_aqui
GUILD_ID=tu_server_id_para_dev_aqui

# Opcionales
CLIENT_SECRET=tu_client_secret_si_usas_oauth  # Solo para OAuth2 login en dashboard
PORT=3001                                      # Puerto del servidor web

# IA con OpenCode (requiere el servidor de OpenCode corriendo)
OPENCODE_OWNER_ID=tu_discord_user_id           # Único autorizado para !ai
OPENCODE_SERVER_URL=http://127.0.0.1:4096      # URL del servidor de OpenCode
```

> **⚠️ Seguridad**: Nunca commitees `.env`. Está en `.gitignore`. Regenera tokens si se filtran.

---

## Variables dinámicas en mensajes

Usa estas variables en mensajes de bienvenida, despedida, DM, boost, ban, kick:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{user}` | Mención del usuario | `@Juan` |
| `{user.name}` | Nombre de usuario | `Juan` |
| `{user.id}` | ID del usuario | `123456789` |
| `{user.avatar}` | URL del avatar | `https://...` |
| `{user.tag}` | Tag completo | `Juan#0001` |
| `{user.mention}` | Mención al usuario | `<@123456789>` |
| `{user.createdAt}` | Antigüedad de la cuenta | `hace 2 años` |
| `{user.joinedAt}` | Antigüedad en el servidor | `hace 3 días` |
| `{server}` | Nombre del servidor | `Mi Server` |
| `{server.id}` | ID del servidor | `987654321` |
| `{server.icon}` | URL del icono | `https://...` |
| `{memberCount}` | Total de miembros | `150` |
| `{boost}` | Boosts del servidor | `3` |
| `{date}` | Fecha actual (DD/MM/YYYY) | `18/07/2026` |
| `{time}` | Hora actual (HH:mm) | `14:30` |
| `{moderator}` | Moderador (solo bans/kicks) | `@Mod` |
| `{reason}` | Razón (solo bans/kicks) | `spam` |

> **Tarjetas**: el título y el subtítulo de las cards de bienvenida/despedida aceptan
> estas mismas variables, excepto que `{user}` muestra el **nombre** en lugar de una
> mención (las menciones no se renderizan dentro de una imagen). El texto se ajusta
> automáticamente al ancho y las líneas no se solapan al cambiar los tamaños de fuente.
> Los fondos GIF se componen frame a frame respetando transparencia y disposal, así que
> no aparecen manchas negras en los primeros fotogramas.

---

## Animación de textos en tarjetas

Cada elemento de texto (título, usuario y subtítulo) puede tener tres fases independientes:

| Fase | Cuándo se reproduce |
|------|---------------------|
| **Entrada** | Desde el inicio hasta `duración` segundos |
| **Bucle** | Todo el tiempo restante, repitiéndose cada `duración` segundos |
| **Salida** | Los últimos `duración` segundos |

- Hay **10 presets**: `fadeIn`, `slideUp`, `slideLeft`, `slideRight`, `pop`, `pulse`, `typewriter`, `bounce`, `glitch` y `reveal`.
- Cualquier preset o animación guardada puede invertirse con **Invertir (salida)**, así `fadeIn` se convierte en `fadeOut`, etc.
- La fase de bucle por defecto es **Ninguna**, y las cards sin animaciones se ven exactamente igual que antes.
- El timeline total es `animationFrames × animationDelay / 1000` (por defecto `30 × 100 ms = 3 s`). Si entrada + salida superan ese tiempo, se recortan proporcionalmente.
- Se pueden combinar, por ejemplo, `slideUp` de entrada + `pulse` en bucle + `fadeIn` invertido de salida.

### Editor y librería global

En el editor de la card hay un **scrubber** que recorre el timeline y muestra el frame exacto dentro de la tarjeta. El botón **Editor de keyframes** permite editar opacidad, X, Y, escala, rotación, caracteres visibles y recorte horizontal, además del easing.

Las animaciones creadas con **Guardar como…** se guardan en `src/database/cardAnimations.json` y están disponibles para **todos los servidores configurados en ese despliegue**. Se pueden editar (**Actualizar**) y borrar desde **Mis animaciones**; si se borra una animación en uso, las cards caen a `Ninguna` sin romperse.

> Esta versión es local y de código abierto: cada persona monta su propio bot en Docker y administra sus propios servidores. No hay cuentas ni login, así que "global" significa global por despliegue, no por usuario. El campo `ownerId` ya está reservado para una futura versión con cuentas.

---

## Filosofía y estado del proyecto

Hoy **Hazuru's Assistant** es un proyecto local y de código abierto (GPL-3.0): clonas el repo, creas el bot en el portal de Discord, rellenas `.env` y levantas el contenedor. El dashboard escucha en `127.0.0.1:3001`, así que solo entra quien tiene acceso a esa máquina. No hay versión online, hosting, cuentas de usuario ni modalidad comercial/verificada por Discord.

Ideas a largo plazo (no implementadas):

- Cuentas y login para que cada persona tenga sus propias animaciones y configuraciones, reutilizables en los servidores que administre.
- Una **marketplace** donde la comunidad comparta tarjetas, animaciones y otros recursos.
- Un servicio hospedado, con bots verificados y configuración desde un panel web público.

Por ahora el alcance es el bot local: cada usuario crea su animación custom y la usa en todos los servidores que configura en su panel.

---

## Comandos Slash

| Comando | Descripción | Permiso |
|---------|-------------|---------|
| `/ping` | Latencia del bot | Todos |
| `/serverinfo` | Info detallada del servidor | Todos |
| `/userinfo [usuario]` | Info de un usuario | Todos |
| `/avatar [usuario]` | Avatar en alta resolución | Todos |
| `/botinfo` | Stats del bot | Todos |
| `/help` | Lista de comandos | Todos |
| `/8ball [pregunta]` | Bola mágica | Todos |
| `/poll <pregunta> [opciones]` | Crear encuesta | Todos |
| `/remind <tiempo> <mensaje>` | Recordatorio personal | Todos |
| `/announce <canal> <mensaje>` | Anuncio en canal | Admin |
| `/nick <usuario> <nuevo_nick>` | Cambiar nickname | Manage Nicknames |
| `/ban <usuario> [razón]` | Banear usuario | Ban Members |
| `/kick <usuario> [razón]` | Expulsar usuario | Kick Members |
| `/timeout <usuario> <duración> [razón]` | Silenciar temporal | Moderate Members |
| `/warn <usuario> <razón>` | Advertir usuario | Manage Messages |
| `/warnings <usuario>` | Ver advertencias | Manage Messages |
| `/unwarn <usuario> <id>` | Quitar advertencia | Manage Messages |
| `/purge <cantidad>` | Borrar mensajes | Manage Messages |
| `/slowmode <segundos>` | Slowmode canal | Manage Channels |
| `/rank` | Ver tu nivel y XP | Todos |
| `/leaderboard` | Ranking del servidor | Todos |
| `/profile [usuario]` | Perfil extendido | Todos |
| `/achievements` | Lista de logros | Todos |
| `/racha` | Racha diaria de mensajes | Todos |
| `/title <título>` | Cambiar título visible (requiere nivel) | Todos |
| `/setlevel <usuario> <nivel>` | Fijar nivel | Admin |
| `/setxp <usuario> <xp>` | Fijar XP | Admin |
| `/resetlevels` | Resetear niveles del servidor | Admin |

---

## Sistema de niveles

- Se gana XP por mensaje (mínimo y máximo configurables por servidor).
- Cooldown de XP (60 s por defecto) y cooldown de mensajes configurable.
- Multiplicadores por canal y por racha diaria.
- Roles automáticos al alcanzar ciertos niveles.
- Logros automáticos por umbrales de mensajes/niveles.
- Títulos personalizados que requieren un nivel mínimo.
- Canales bloqueados: no generan XP ni anuncios.
- Fórmula de XP configurable: `base * nivel^exponent`.
- Los mensajes de bots y los system messages no generan XP.

---

## Estructura del proyecto

```
hazuru-assistant/
├── src/
│   ├── index.js                 # Entry: Discord + Express + Socket.IO + rutas API
│   ├── commands/                # Slash commands (auto-load)
│   │   ├── ping.js / help.js / serverinfo.js / userinfo.js / avatar.js
│   │   ├── server.js / botinfo.js / 8ball.js / poll.js / announce.js
│   │   ├── ban.js / kick.js / warn.js / warnings.js / unwarn.js
│   │   ├── timeout.js / untimeout.js / purge.js / slowmode.js / nick.js
│   │   ├── remind.js
│   │   └── rank.js / leaderboard.js / profile.js / achievements.js
│   │       / racha.js / title.js / setlevel.js / setxp.js / resetlevels.js
│   ├── events/                  # Discord events (auto-load)
│   │   ├── ready.js
│   │   ├── interactionCreate.js  # Slash commands + reaction roles
│   │   ├── messageCreate.js      # Automod + OpenCode + XP/niveles
│   │   ├── guildMemberAdd.js / guildMemberRemove.js / guildMemberUpdate.js
│   │   ├── guildBanAdd.js
│   │   ├── messageDelete.js / messageUpdate.js / voiceStateUpdate.js
│   │   └── messageReactionAdd.js / messageReactionRemove.js
│   ├── database/                # JSON storage (escritura atómica)
│   │   ├── index.js             # getGuild, updateGuild → guilds.json
│   │   ├── atomic.js            # tmp + fsync + rename, recuperación por backup
│   │   ├── backup.js            # Copias de seguridad
│   │   ├── levels.js            # levels.json — XP/niveles
│   │   ├── warnings.js          # warnings.json
│   │   ├── reminders.js         # reminders.json
│   │   └── settings.js          # settings.json — config global
│   └── utils/
│       ├── logger.js            # logInfo, logError, logWarn
│       ├── replaceVars.js       # Sustituye {vars} en mensajes
│       ├── buildEmbed.js        # Constructor de embeds
│       ├── cardGenerator.js     # Canvas PNG/GIF tarjetas
│       ├── leveling.js          # Motor de XP, roles y logros
│       ├── opencode.js          # Cliente API de OpenCode
│       ├── parseDuration.js     # "1h30m" → ms
│       ├── permissions.js       # Checks de permisos
│       ├── getLogChannel.js     # Resuelve canal de logs
│       └── automod/             # antiSpam, antiLinks, antiCaps, bannedWords
├── frontend/
│   ├── index.html               # Shell + Tailwind/Vue CDN
│   └── app.js                   # Vue 3 Dashboard reactivo
├── uploads/                     # Imágenes y fuentes subidas (gitignored)
│   └── fonts/                   # Fuentes .ttf/.otf + fonts.json
├── logs/                        # Logs del bot (gitignored)
├── backups/                     # Backups de bases JSON (gitignored)
├── deploy-commands.js           # Registra slash commands
├── docker-compose.yml           # Prod + Dev (watch)
├── Dockerfile                   # Multi-stage Node 20 slim
├── .env.example                 # Plantilla variables
├── .gitignore
├── .dockerignore
├── LICENSE                      # GPL-3.0
├── AGENTS.md                    # Guía para agentes LLM
└── README.md                    # Este archivo
```

---

## Dashboard Web

Accesible en `http://127.0.0.1:3001` (o `PORT` configurado). Usa `127.0.0.1`
en vez de `localhost`: el servidor escucha en IPv4 y `localhost` puede resolver a `::1`.

- **SPA Vue 3** (CDN, sin build step)
- **Tailwind CSS** (CDN)
- **Socket.IO** — stats en tiempo real (servers, users, uptime cada 5s)
- **Tabs**: Inicio, Bienvenidas, Despedidas, DM Bienvenida, Boost, Ban, Kick, Auto-Role, Niveles, Auto-Mod, Logging, Comandos, Ajustes
- **Editor de Embeds**: autor, footer, fields, color, thumbnail, image — preview instantáneo
- **Generador de tarjetas**: preview base64, temas (sunset, ocean, neon, etc.), animación GIF
- **Variables copiables**: click en variable → copia al portapapeles
- **Selector de servidor/canal/rol/usuario** con búsqueda

---

## Despliegue en producción

### Opción A: VPS + Docker (recomendado)

```bash
# En servidor
git clone https://github.com/Hazuru00/hazuru-assistant.git
cd hazuru-assistant
cp .env.example .env
# Editar .env con tokens de producción
docker compose up -d
```

- Usa reverse proxy (Nginx/Caddy) con SSL para exponer puerto 3001
- Configura `CLIENT_SECRET` + OAuth2 redirect URI si quieres login en dashboard

### Opción B: Railway / Render / Fly.io

- Conecta repo → detecta Dockerfile → deploy
- Añade variables de entorno en panel del proveedor
- `PORT` se inyecta automáticamente

---

## Desarrollo

```bash
# Hot-reload backend
npm run dev

# Frontend separado (puerto 3000, proxy a API 3001)
npm run frontend

# Tests (no hay suite aún — PRs welcome)
# npm test
```

### Añadir comando
```bash
# 1. Crear src/commands/mi-comando.js
# 2. node deploy-commands.js
# 3. Listo
```

### Añadir evento
```bash
# 1. Crear src/events/mi-evento.js
# 2. Reiniciar bot
```

---

## Base de datos (JSON)

Archivos en `src/database/` (gitignored):

- `guilds.json` — Config completa por servidor (welcome, farewell, automod, logging, etc.)
- `warnings.json` — Advertencias por usuario por servidor
- `reminders.json` — Recordatorios pendientes (userId, channel, guildId, message, remindAt)

Helpers en `src/database/index.js`: `getGuild(id)`, `updateGuild(id, partial)`.

---

## Docker

`Dockerfile` multi-stage:
1. **builder** — `npm ci --omit=dev` (cache de layers)
2. **runner** — `node:20-alpine`, usuario no-root, copia solo `node_modules` + src + frontend

`docker-compose.yml`:
- `app` — producción (puerto 3001)
- `dev` — perfil `dev`, `npm run dev`, volúmenes bind-mount, puerto 3001

```bash
# Producción
docker compose up -d

# Desarrollo
docker compose --profile dev up watch
```

---

## Seguridad

- `.env` en `.gitignore` — **nunca** commitear tokens
- `guilds.json`, `warnings.json`, `reminders.json` en `.gitignore` — datos reales de usuarios
- `uploads/` en `.gitignore` — imágenes subidas por usuarios
- Rate limit básico en endpoints de preview (middleware opcional sugerido)
- Validación de permisos Discord en cada comando/evento
- Sanitización de entrada en `replaceVars` y `buildEmbed`

---

## Contribuir

1. Fork → rama `feature/mi-cosa`
2. Commits convencionales (`feat:`, `fix:`, `docs:`, `refactor:`)
3. PR con descripción clara
4. CI básico: `npm install && node deploy-commands.js --dry-run` (si se añade)

---

## Licencia

**GNU General Public License v3.0** — ver [LICENSE](LICENSE).

```
Copyright (C) 2025 Moises A. Marcano (Hazuru00)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
```

---

## Contacto

- **GitHub**: [Hazuru00](https://github.com/Hazuru00)
- **Discord**: `hazuru` (o únete al server de soporte si existe)
- **Portfolio**: [hazurudev.vercel.app](https://hazurudev.vercel.app)

---

*Hecho con ❤️ por Hazuru — "Creando experiencias digitales memorables"*