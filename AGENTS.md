# AGENTS.md — Hazuru's Assistant

Guía para agentes de código (LLM) que trabajen en este repositorio.

## Contexto del proyecto

**Hazuru's Assistant** — Bot de Discord (discord.js v14) + Dashboard web (Express + Socket.IO + Vue 3 CDN) para gestión de servidores: bienvenidas/despedidas con tarjetas visuales, automod, logging, roles automáticos, recordatorios, advertencias, bans/kicks, boost, etc.

- **Stack**: Node.js ≥ 20, discord.js 14, Express, Socket.IO, multer, @napi-rs/canvas
- **Arquitectura**: Carga dinámica de comandos (`src/commands/*.js`) y eventos (`src/events/*.js`)
- **Base de datos**: JSON plano (`src/database/`) — guilds.json, warnings.json, reminders.json
- **Frontend**: SPA en `frontend/` (index.html + app.js, Vue 3 via CDN, Tailwind via CDN)
- **Despliegue**: Docker (multi-stage) + docker-compose (prod + dev con watch)

## Estructura clave

```
├── src/
│   ├── index.js              # Entry point: Discord client + Express + Socket.IO
│   ├── commands/             # Slash commands (auto-cargados)
│   ├── events/               # Eventos Discord (auto-cargados)
│   ├── database/             # JSON storage (guilds, warnings, reminders)
│   └── utils/                # Helpers (logger, canvas, embeds, vars, etc.)
├── frontend/
│   ├── index.html            # Shell HTML + Tailwind/Vue CDN
│   └── app.js                # Vue 3 app (dashboard reactivo)
├── deploy-commands.js        # Registra slash commands en Discord
├── docker-compose.yml        # Prod + dev profiles
├── Dockerfile                # Multi-stage Node 20 slim
└── .env.example              # Plantilla de variables
```

## Cómo agregar funcionalidad

### Nuevo comando slash
1. Crear `src/commands/mi-comando.js` exportando:
   ```js
   module.exports = {
     data: new SlashCommandBuilder().setName('mi-comando').setDescription('...'),
     execute(interaction) { ... }
   };
   ```
2. Ejecutar `node deploy-commands.js` (o reiniciar bot)

### Nuevo evento
1. Crear `src/events/mi-evento.js` exportando:
   ```js
   module.exports = { name: 'eventName', once?: boolean, execute(...args) { ... } };
   ```

### Nueva sección en dashboard
1. Backend: añadir endpoints REST en `src/index.js` (`/api/guilds/:id/nueva-seccion` GET/PUT)
2. Frontend: añadir tab en `app.js` (`navItems`, `currentPage`, template HTML, lógica reactiva)

## Variables de entorno (`.env`)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DISCORD_TOKEN` | Sí | Token del bot (Developer Portal → Bot) |
| `CLIENT_ID` | Sí | Application ID (General Information) |
| `CLIENT_SECRET` | No | Solo si usas OAuth2 (dashboard login) |
| `GUILD_ID` | Sí | ID del servidor de desarrollo (registra comandos instantáneo) |
| `PORT` | No | Puerto web (default: 3001) |

## Comandos útiles

```bash
# Desarrollo
npm run dev              # Nodemon (auto-reload)
npm run frontend         # Sirve frontend estático en :3000

# Producción
npm start                # Node src/index.js
docker compose up -d     # Contenedor prod
docker compose --profile dev up watch  # Dev con hot-reload

# Deploy comandos
node deploy-commands.js
```

## Reglas para agentes

1. **No hardcodear secrets** — Usar `process.env.*` siempre. `.env` está en `.gitignore`.
2. **Carga dinámica** — No modificar `index.js` para registrar comandos/eventos; crear archivo en carpeta correspondiente.
3. **Base de datos JSON** — Usar helpers en `src/database/index.js` (`getGuild`, `updateGuild`). No leer/escribir `guilds.json` directo.
4. **Frontend Vue** — Estado reactivo en `setup()`. APIs via `fetch('/api/...')`. Socket.IO en `socket` global.
4. **Imágenes subidas** → `/uploads` (multer, 8MB máx, solo imágenes). Servidas estáticamente.
5. **Tarjetas canvas** → `src/utils/cardGenerator.js` (genera PNG/GIF animado con @napi-rs/canvas).
6. **Logs** → `src/utils/logger.js` (`logInfo`, `logError`, `logWarn`).
7. **Variables en mensajes** → `src/utils/replaceVars.js` (sintaxis `{user}`, `{server}`, etc.).
8. **Permisos** → `src/utils/permissions.js` (checkAdmin, checkMod, etc.).
9. **Docker** — Multi-stage: builder (npm ci) → runner (node:20-alpine, non-root user). `.dockerignore` excluye node_modules, .env, guilds.json.

## Archivos sensibles (NO commitear)

- `.env` — Tokens reales
- `src/database/guilds.json` — Config real de servidores (IDs, canales)
- `src/database/warnings.json` — Advertencias de usuarios reales
- `src/database/reminders.json` — Recordatorios reales
- `node_modules/`
- `uploads/` — Imágenes subidas por usuarios

## Licencia

GPL-3.0 — Copyright (C) 2025 Moises A. Marcano (Hazuru00). Ver `LICENSE`.