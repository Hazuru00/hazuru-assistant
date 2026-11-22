/**
 * ============================================================================
 * UTILIDAD: cardGenerator - Generador de Tarjetas de Bienvenida/Despedida
 * ============================================================================
 *
 * Genera imágenes PNG o GIF animadas para mensajes de bienvenida y despedida.
 * Usa @napi-rs/canvas para renderizar y omggif para crear GIFs animados.
 *
 * TEMAS DISPONIBLES:
 *   - dark: Fondo oscuro con borde azul
 *   - circuit: Fondo oscuro con borde verde (estilo tech)
 *   - code: Fondo púrpura oscuro con borde rosa
 *   - neon: Fondo negro con borde cyan (estilo neón)
 *   - sunset: Fondo azul oscuro con borde rojo (estilo atardecer)
 *
 * CARACTERÍSTICAS:
 *   - Avatar circular con borde personalizable
 *   - Título y subtítulo con variables ({memberCount})
 *   - Fondo personalizable (imagen URL o gradiente del tema)
 *   - Overlay oscuro configurable (opacidad)
 *   - Opción de GIF animado con partículas y línea decorativa
 *
 * CÓMO AGREGAR UN NUEVO TEMA:
 *   1. Agregar objeto al diccionario `themes` con: gradient, borderColor, textColor, subtitleColor
 *   2. Listo, el panel web lo muestra automáticamente
 *
 * CÓMO MODIFICAR EL DISEÑO:
 *   - La función `renderFrame()` controla todo el renderizado
 *   - Los parámetros de posición son hardcodeados para una tarjeta de 900x300
 * ============================================================================
 */

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { GifWriter } = require('omggif');
const { GifFrame, GifUtil, GifKind } = require('gifwrap');
const path = require('path');
const fs = require('fs');
const { getElementState, NEUTRAL } = require('./textAnimations');
const { listCardAnimations } = require('../database/cardAnimations');

/** Convierte la lista de animaciones guardadas en el mapa por ID que espera el motor.*/
function listCardAnimationsAsMap() {
  const map = {};
  for (const anim of listCardAnimations()) map[anim.id] = anim;
  return map;
}

// Registrar fuentes custom del directorio uploads/fonts
const fontsDir = path.join(__dirname, '..', '..', 'uploads', 'fonts');
if (fs.existsSync(fontsDir)) {
  // fonts.json guarda el nombre visible de cada fuente (ej: "BoldPixels")
  let fontsMeta = {};
  try {
    fontsMeta = JSON.parse(fs.readFileSync(path.join(fontsDir, 'fonts.json'), 'utf8'));
  } catch {}

  fs.readdirSync(fontsDir).forEach(file => {
    if (!/\.(ttf|otf|woff|woff2)$/i.test(file)) return;
    const filePath = path.join(fontsDir, file);
    const fileFamily = file.replace(/\.[^.]+$/, '').replace(/-/g, ' ');
    const displayName = fontsMeta[file];
    try { GlobalFonts.registerFromPath(filePath, displayName || fileFamily); } catch {}
    if (displayName && displayName !== fileFamily) {
      try { GlobalFonts.registerFromPath(filePath, fileFamily); } catch {}
    }
  });
}

// ============================================================================
// DEFINICIÓN DE TEMAS
// ============================================================================

/**
 * Cada tema define colores para: gradiente de fondo, borde del avatar,
 * texto principal, y texto de subtítulo.
 */
const themes = {
  dark: {
    gradient: ['#2f3136', '#232428'],   // Gris oscuro
    borderColor: '#5865F2',             // Azul Discord
    textColor: '#ffffff',
    subtitleColor: '#b9bbbe',
  },
  circuit: {
    gradient: ['#0d1117', '#161b22'],   // Negro verdoso
    borderColor: '#57F287',             // Verde
    textColor: '#ffffff',
    subtitleColor: '#8b949e',
  },
  code: {
    gradient: ['#1e1e2e', '#181825'],   // Púrpura oscuro
    borderColor: '#f47fff',             // Rosa
    textColor: '#cdd6f4',
    subtitleColor: '#a6adc8',
  },
  neon: {
    gradient: ['#0a0a0a', '#1a1a2e'],   // Negro con toque azul
    borderColor: '#00ffff',             // Cyan neón
    textColor: '#ffffff',
    subtitleColor: '#00ffff',
  },
  sunset: {
    gradient: ['#1a1a2e', '#16213e'],   // Azul oscuro
    borderColor: '#ff6b6b',             // Rojo/coral
    textColor: '#ffffff',
    subtitleColor: '#ffd93d',           // Amarillo dorado
  },
};


// ============================================================================
// CONFIGURACIÓN POR DEFECTO
// ============================================================================

/**
 * Valores por defecto para la configuración de una tarjeta.
 * Se fusionan con la configuración del usuario.
 */
const defaultCardConfig = () => ({
  enabled: false,
  theme: 'dark',
  background: '',           // URL de imagen de fondo (vacío = gradiente del tema)
  title: 'Bienvenido',
  subtitle: 'Miembro #{memberCount}',
  textColor: '',            // Vacío = usar color del tema
  subtitleColor: '',
  avatarBorderColor: '',    // Vacío = usar color del tema
  avatarBorderWidth: 5,
  font: 'sans-serif',
  overlayOpacity: 50,       // 0-100, opacidad del overlay oscuro
  blur: false,
  animated: false,          // true = GIF animado
  animationFrames: 30,      // Cuántos frames tiene el GIF
  animationDelay: 100,      // Milisegundos entre frames
});


// ============================================================================
// FUNCIONES DE DIBUJO (Canvas)
// ============================================================================

/**
 * Dibuja un rectángulo con esquinas redondeadas.
 * Se usa para el overlay oscuro y el borde de la tarjeta.
 */
function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Dibuja una imagen recortada en círculo (para el avatar).
 * Guarda el estado del canvas, recorta un círculo, dibuja la imagen, y restaura.
 */
function drawCircleImage(ctx, img, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip(); // Recortar al círculo
  ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/**
 * Dibuja texto con sombra oscura para mejor legibilidad.
 * Primero dibuja un borde oscuro (stroke) y luego el texto coloreado (fill).
 */
function drawTextWithShadow(ctx, text, x, y, color, font) {
  if (!text) return;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Paso 1: Borde oscuro (outline)
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);

  // Paso 2: Texto coloreado (fill)
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * Dibuja una línea de texto aplicando el estado de animación calculado.
 * `typewriter` recorta caracteres y `reveal` recorta el ancho con un clip.
 */
function drawAnimatedText(ctx, fit, x, y, color, state) {
  const chars = Math.max(0, Math.min(fit.text.length, Math.ceil(state.chars * fit.text.length)));
  const text = fit.text.slice(0, chars);
  if (!text || state.opacity <= 0.01 || state.scale <= 0.01) return;

  ctx.save();
  ctx.translate(x + state.x, y + state.y);
  ctx.rotate(state.rotate * Math.PI / 180);
  ctx.scale(state.scale, state.scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, state.opacity));

  if (state.reveal < 0.999) {
    ctx.font = fit.font;
    const textWidth = ctx.measureText(text).width;
    ctx.beginPath();
    ctx.rect(-6, -fit.size, textWidth * state.reveal + 12, fit.size * 2);
    ctx.clip();
  }

  drawTextWithShadow(ctx, text, 0, 0, color, fit.font);
  ctx.restore();
}

/** ¿El estado es neutro? Así evitamos envolver el dibujo cuando no hay animación.*/
function isNeutralState(state) {
  return Object.keys(NEUTRAL).every(key => Math.abs(state[key] - NEUTRAL[key]) < 0.0001);
}

/**
 * Obtiene los colores de un tema por nombre.
 * Si el tema no existe, usa dark como fallback.
 */
function getThemeDefaults(themeName) {
  return themes[themeName] || themes.dark;
}

/**
 * Reemplaza variables en los textos de la tarjeta.
 *
 * A diferencia de los mensajes, `{user}` se reemplaza por el nombre de
 * usuario (no por una mención), porque una mención no se renderiza dentro
 * de una imagen.
 */
function replaceCardVars(text, member) {
  if (!text) return '';

  const user = member.user || {};
  const guild = member.guild || {};
  const avatarUrl = typeof user.displayAvatarURL === 'function'
    ? user.displayAvatarURL({ dynamic: true, size: 256 })
    : '';
  const iconUrl = typeof guild.iconURL === 'function'
    ? (guild.iconURL({ dynamic: true }) || '')
    : '';

  const vars = {
    user: user.username || user.tag || '',
    'user.name': user.username || user.tag || '',
    'user.id': user.id || member.id || '',
    'user.avatar': avatarUrl,
    'user.tag': user.tag || user.username || '',
    'user.mention': `<@${member.id || user.id || ''}>`,
    'user.createdAt': user.createdTimestamp
      ? `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`
      : 'Desconocido',
    'user.joinedAt': member.joinedTimestamp
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : 'Desconocido',
    server: guild.name || '',
    'server.id': guild.id || '',
    'server.icon': iconUrl,
    memberCount: String(guild.memberCount ?? ''),
    boost: String(guild.premiumSubscriptionCount || 0),
  };

  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key.replace(/\./g, '\\.')}}`, 'g'), String(value));
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  result = result.replace(/\{date\}/g, `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`);
  result = result.replace(/\{time\}/g, `${pad(now.getHours())}:${pad(now.getMinutes())}`);

  return result;
}

/**
 * Ajusta el tamaño de una fuente para que el texto quepa en maxWidth.
 * Si aun así no cabe, lo trunca con puntos suspensivos.
 */
function fitText(ctx, text, weight, size, family, maxWidth, minSize = 12) {
  let current = Math.max(minSize, size);
  const buildFont = (s) => `${weight} ${s}px ${family}`;

  ctx.font = buildFont(current);
  while (current > minSize && ctx.measureText(text).width > maxWidth) {
    current -= 1;
    ctx.font = buildFont(current);
  }

  if (ctx.measureText(text).width > maxWidth) {
    let truncated = text;
    while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    text = `${truncated}…`;
  }

  return { text, font: buildFont(current), size: current };
}


// ============================================================================
// RENDERIZADO DE FRAME
// ============================================================================

/**
 * Renderiza un frame completo de la tarjeta.
 * Esta es la función principal de dibujo, usada tanto para PNG estático
 * como para cada frame del GIF animado.
 *
 * DIMENSIONES DE LA TARJETA: 900x300 píxeles
 *
 * Layout:
 *   [20px padding] [Avatar 100px] [30px gap] [Título] [Username] [Subtítulo] [Línea decorativa]
 *
 * @param {CanvasRenderingContext2d} ctx - Contexto del canvas
 * @param {number} width - Ancho del canvas (900)
 * @param {number} height - Alto del canvas (300)
 * @param {Object} cardConfig - Configuración de la tarjeta
 * @param {Object} theme - Colores del tema
 * @param {Object} member - Miembro de Discord
 * @param {number} frame - Número de frame actual (para animación)
 * @param {number} frames - Total de frames
 * @param {boolean} isWelcome - true = bienvenida, false = despedida
 * @param {Image|null} avatar - Imagen del avatar (o null si no se pudo cargar)
 */
async function renderFrame(ctx, width, height, cardConfig, theme, member, frame, frames, isWelcome, avatar, bgFrames, animOptions = {}) {
  const textColor = cardConfig.textColor || theme.textColor;
  const subtitleColor = cardConfig.subtitleColor || theme.subtitleColor;
  const borderColor = cardConfig.avatarBorderColor || theme.borderColor;

  // --- FONDO ---
  // Si hay frames de GIF predecodificados, usarlos; si no, cargar imagen normal
    if (bgFrames && bgFrames.length > 0) {
    try {
      const gifFrameIndex = Math.floor((frame / frames) * bgFrames.length);
      const gifFrame = bgFrames[gifFrameIndex % bgFrames.length];
      
      const tempCanvas = createCanvas(gifFrame.bitmap.width, gifFrame.bitmap.height);
      const tempCtx = tempCanvas.getContext('2d');
      const imgData = tempCtx.createImageData(gifFrame.bitmap.width, gifFrame.bitmap.height);
      imgData.data.set(gifFrame.bitmap.data);
      tempCtx.putImageData(imgData, 0, 0);
      
      const bg = tempCanvas;
      const zoom = (cardConfig.bgZoom || 100) / 100;
      const scale = cardConfig.bgScale || 'cover';
      const bgW = width * zoom;
      const bgH = height * zoom;
      let sx = 0, sy = 0, sw = bg.width, sh = bg.height;

      if (scale === 'cover') {
        const ratio = Math.max(bgW / bg.width, bgH / bg.height);
        sw = bgW / ratio;
        sh = bgH / ratio;
        sx = (bg.width - sw) / 2;
        sy = (bg.height - sh) / 2;
        ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, width, height);
      } else if (scale === 'contain') {
        const ratio = Math.min(bgW / bg.width, bgH / bg.height);
        const dw = bg.width * ratio;
        const dh = bg.height * ratio;
        ctx.drawImage(bg, 0, 0, bg.width, bg.height, (width - dw) / 2, (height - dh) / 2, dw, dh);
      } else if (scale === 'stretch') {
        ctx.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, bgW, bgH);
      } else if (scale === 'center') {
        ctx.drawImage(bg, 0, 0, bg.width, bg.height, (width - bgW) / 2, (height - bgH) / 2, bgW, bgH);
      }
    } catch {
      // Si falla, usar gradiente
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, theme.gradient[0]);
      grad.addColorStop(1, theme.gradient[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  } else if (cardConfig.background) {
    try {
      const bg = await loadImage(cardConfig.background);
      const zoom = (cardConfig.bgZoom || 100) / 100;
      const scale = cardConfig.bgScale || 'cover';
      const bgW = width * zoom;
      const bgH = height * zoom;
      let sx = 0, sy = 0, sw = bg.width, sh = bg.height;

      if (scale === 'cover') {
        const ratio = Math.max(bgW / bg.width, bgH / bg.height);
        sw = bgW / ratio;
        sh = bgH / ratio;
        sx = (bg.width - sw) / 2;
        sy = (bg.height - sh) / 2;
        ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, width, height);
      } else if (scale === 'contain') {
        const ratio = Math.min(bgW / bg.width, bgH / bg.height);
        const dw = bg.width * ratio;
        const dh = bg.height * ratio;
        ctx.drawImage(bg, 0, 0, bg.width, bg.height, (width - dw) / 2, (height - dh) / 2, dw, dh);
      } else if (scale === 'stretch') {
        ctx.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, bgW, bgH);
      } else if (scale === 'center') {
        ctx.drawImage(bg, 0, 0, bg.width, bg.height, (width - bgW) / 2, (height - bgH) / 2, bgW, bgH);
      }
    } catch {
      // Si la imagen falla, usar gradiente
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, theme.gradient[0]);
      grad.addColorStop(1, theme.gradient[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, theme.gradient[0]);
    grad.addColorStop(1, theme.gradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // --- OVERLAY OSCURO ---
  // Rectángulo redondeado oscuro sobre el fondo
  const opacityPct = typeof cardConfig.overlayOpacity === 'number' ? cardConfig.overlayOpacity : 50;
  const overlayAlpha = Math.min(opacityPct / 100 * 0.8, 0.8); // Máximo 0.8 de opacidad
  const m = cardConfig.cardMargin != null ? cardConfig.cardMargin : 20;
  drawRoundedRect(ctx, m, m, width - m * 2, height - m * 2, 16);
  ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
  ctx.fill();

  // --- BORDE (solo si está habilitado) ---
  if (cardConfig.cardBorder !== false) {
    drawRoundedRect(ctx, m, m, width - m * 2, height - m * 2, 16);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // --- AVATAR ---
  const avatarRadius = cardConfig.avatarSize || 50;
  const avatarX = m + avatarRadius + 30; // Posición X del centro del avatar (respeta margen)
  const avatarY = height / 2; // Centrado verticalmente
  const fontFamily = cardConfig.fontFamily || 'DejaVu Sans';
  const showBorder = cardConfig.avatarBorder !== false;

  if (avatar) {
    // Dibujar borde circular del avatar (solo si está habilitado)
    if (showBorder) {
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + (cardConfig.avatarBorderWidth || 4) / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = (cardConfig.avatarBorderWidth || 4);
      ctx.stroke();
    }
    // Dibujar avatar recortado en círculo
    drawCircleImage(ctx, avatar, avatarX, avatarY, avatarRadius);
  } else {
    // Si no se pudo cargar el avatar, dibujar un círculo con la inicial
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = borderColor;
    ctx.fill();
    const initial = (member.user.username || member.user.tag || 'U')[0].toUpperCase();
    drawTextWithShadow(ctx, initial, avatarX, avatarY, '#ffffff', `bold ${Math.round(avatarRadius * 0.8)}px ${fontFamily}`);
  }

  // --- TEXTO (título, usuario y subtítulo) ---
  const titleText = replaceCardVars(
    cardConfig.title || (isWelcome ? 'Bienvenido' : 'Adiós'),
    member
  );
  const usernameText = member.user.username || member.user.tag || 'Usuario';
  const subtitleText = replaceCardVars(cardConfig.subtitle || '', member);

  const titleSize = cardConfig.titleSize || 28;
  const usernameSize = cardConfig.usernameSize || 20;
  const subtitleSize = cardConfig.subtitleSize || 15;

  const textX = avatarX + avatarRadius + 20;
  const maxTextWidth = width - textX - m - 20;

  // Ajustar cada línea al ancho disponible (sin salirse de la tarjeta)
  const titleFit = fitText(ctx, titleText, 'bold', titleSize, fontFamily, maxTextWidth, 14);
  const usernameFit = fitText(ctx, usernameText, '600', usernameSize, fontFamily, maxTextWidth, 12);
  const subtitleFit = subtitleText
    ? fitText(ctx, subtitleText, 'normal', subtitleSize, fontFamily, maxTextWidth, 10)
    : null;

  // Alturas dinámicas: evitan que usuario y subtítulo se solapen
  const titleLine = titleFit.size * 1.5;
  const usernameLine = usernameFit.size * 1.4;
  const subtitleLine = subtitleFit ? subtitleFit.size * 1.4 : 0;
  const gap = Math.max(4, Math.round(titleFit.size * 0.12));
  const blockHeight = titleLine + usernameLine + subtitleLine + gap * (subtitleFit ? 2 : 1);
  let textTop = height / 2 - blockHeight / 2;

  // --- ANIMACIÓN DE TEXTOS ---
  const library = animOptions.library || listCardAnimationsAsMap();
  let animMap = cardConfig.textAnimations || null;

  // Si viene un borrador desde el dashboard, se inyecta como '__draft__'
  // para poder previsualizarlo antes de guardarlo.
  const draft = animOptions.draftAnimation;
  if (draft && draft.element && draft.phase && draft.definition) {
    animMap = { ...(animMap || {}) };
    animMap[draft.element] = {
      ...(animMap[draft.element] || {}),
      [draft.phase]: {
        id: '__draft__',
        duration: draft.duration != null ? draft.duration : 0.5,
        reverse: !!draft.reverse,
      },
    };
    library.__draft__ = { definition: draft.definition };
  }

  const totalSec = animOptions.totalSec || 3;
  const animTime = animOptions.animTime != null
    ? animOptions.animTime
    : (frames > 1 ? (frame / frames) * totalSec : 0);

  const drawAnimatedLine = (fit, y, color, element) => {
    const state = animMap
      ? getElementState(animMap[element], animTime, totalSec, library)
      : NEUTRAL;
    if (isNeutralState(state)) {
      drawTextWithShadow(ctx, fit.text, textX, y, color, fit.font);
    } else {
      drawAnimatedText(ctx, fit, textX, y, color, state);
    }
  };

  drawAnimatedLine(titleFit, textTop + titleLine / 2, textColor, 'title');
  textTop += titleLine + gap;

  drawAnimatedLine(usernameFit, textTop + usernameLine / 2, '#ffffff', 'username');
  textTop += usernameLine + gap;

  if (subtitleFit) {
    drawAnimatedLine(subtitleFit, textTop + subtitleLine / 2, subtitleColor, 'subtitle');
  }

  // --- LÍNEA DECORATIVA ---
  // Línea que crece con la animación (se extiende de izquierda a derecha)
  const lineY = Math.min(height - m - 18, textTop + (subtitleFit ? subtitleLine : 0) + 18);
  const lineProgress = Math.min(frame / Math.max(frames, 1), 1);
  ctx.beginPath();
  ctx.moveTo(textX, lineY);
  ctx.lineTo(textX + maxTextWidth * lineProgress, lineY);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // --- PARTÍCULAS ---
  // Pequeños puntos que se mueven en onda sinusoidal (solo en GIF animado)
  for (let i = 0; i < 6; i++) {
    const px = textX + (maxTextWidth * (i + 1)) / 7;
    const py = lineY + Math.sin(frame * 0.15 + i * 1.2) * 12; // Movimiento sinusoidal
    const size = 2 + Math.sin(frame * 0.2 + i) * 0.8;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fillStyle = borderColor;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}


// ============================================================================
// GENERACIÓN DE IMÁGENES
// ============================================================================

/**
 * Genera una tarjeta estática (PNG).
 *
 * @param {Object} member - Miembro de Discord (con user y guild)
 * @param {Object} config - Configuración de la tarjeta
 * @param {boolean} isWelcome - true = bienvenida, false = despedida
 * @param {Object} options - { frame, draftAnimation } para preview de un frame
 * @returns {Buffer} Buffer de la imagen PNG
 */
async function generateCard(member, config, isWelcome = true, options = {}) {
  const cardConfig = { ...defaultCardConfig(), ...config };
  const theme = getThemeDefaults(cardConfig.theme);

  const width = 900;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const totalFrames = cardConfig.animationFrames || 30;
  const delayMs = cardConfig.animationDelay || 100;
  const totalSec = totalFrames * delayMs / 1000;

  // Con frame explícito se dibuja ese instante exacto (lo usa el scrubber).
  // Sin él, se mantiene el dibujo estático de siempre y las animaciones de
  // texto se evalúan a mitad de timeline para que se vean completas.
  const hasFrame = options.frame != null && !Number.isNaN(Number(options.frame));
  const frame = hasFrame ? Math.min(totalFrames - 1, Math.max(0, Number(options.frame))) : 0;
  const frames = hasFrame ? totalFrames : 1;
  const animTime = hasFrame ? frame * delayMs / 1000 : totalSec / 2;

  // Cargar avatar del usuario
  let avatar = null;
  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    avatar = await loadImage(avatarUrl);
  } catch {}

  await renderFrame(
    ctx, width, height, cardConfig, theme, member, frame, frames, isWelcome, avatar, null,
    { library: listCardAnimationsAsMap(), draftAnimation: options.draftAnimation, totalSec, animTime }
  );

  return canvas.toBuffer('image/png');
}

/**
 * Median cut: divide el cubo de color por el canal con mayor rango
 * hasta tener maxColors promedios.
 */
function medianCut(colorEntries, maxColors) {
  if (colorEntries.length <= maxColors) return colorEntries.map(e => e[0]);

  // [[rgb, count], ...] → buckets
  let buckets = [colorEntries.slice()];

  while (buckets.length < maxColors) {
    // Encontrar bucket con mayor rango
    let maxRange = -1, maxIdx = 0;
    for (let b = 0; b < buckets.length; b++) {
      const bucket = buckets[b];
      if (bucket.length < 2) continue;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0;
        for (const [rgb] of bucket) {
          const v = (rgb >> (ch * 8)) & 0xff;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const range = hi - lo;
        if (range > maxRange) { maxRange = range; maxIdx = b; }
      }
    }

    if (maxRange <= 0) break;

    // Dividir por canal de mayor rango
    const bucket = buckets[maxIdx];
    let splitCh = 0, bestRange = -1;
    for (let ch = 0; ch < 3; ch++) {
      let lo = 255, hi = 0;
      for (const [rgb] of bucket) {
        const v = (rgb >> (ch * 8)) & 0xff;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo > bestRange) { bestRange = hi - lo; splitCh = ch; }
    }

    bucket.sort((a, b) => ((a[0] >> (splitCh * 8)) & 0xff) - ((b[0] >> (splitCh * 8)) & 0xff));
    const mid = Math.floor(bucket.length / 2);
    buckets.splice(maxIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
  }

  // Promediar cada bucket (ponderado por frecuencia)
  return buckets.map(bucket => {
    let totalR = 0, totalG = 0, totalB = 0, totalW = 0;
    for (const [rgb, count] of bucket) {
      totalR += ((rgb >> 16) & 0xff) * count;
      totalG += ((rgb >> 8) & 0xff) * count;
      totalB += (rgb & 0xff) * count;
      totalW += count;
    }
    return ((Math.round(totalR / totalW) << 16) |
            (Math.round(totalG / totalW) << 8) |
            Math.round(totalB / totalW));
  });
}

/**
 * Genera una tarjeta animada (GIF).
 *
 * Crea múltiples frames con animaciones (partículas, línea creciente)
 * y los compila en un GIF usando omggif.
 *
 * NOTA: El GIF usa una paleta de 256 colores (requerimiento de GIF).
 * Los colores se cuantifican a 6 bits por canal (2 bits por canal).
 *
 * @param {Object} member - Miembro de Discord
 * @param {Object} config - Configuración de la tarjeta
 * @param {boolean} isWelcome - true = bienvenida, false = despedida
 * @returns {Buffer} Buffer del GIF animado
 */
async function generateAnimatedCard(member, config, isWelcome = true) {
  const cardConfig = { ...defaultCardConfig(), ...config };
  const theme = getThemeDefaults(cardConfig.theme);

  const width = 900;
  const height = 300;
  const totalFrames = cardConfig.animationFrames || 30;
  const delay = cardConfig.animationDelay || 100;
  const totalSec = totalFrames * delay / 1000;
  const library = listCardAnimationsAsMap();

  // Cargar avatar
  let avatar = null;
  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    avatar = await loadImage(avatarUrl);
  } catch {}

  // Decodificar frames del GIF de fondo si es necesario
  let bgFrames = null;
  if (cardConfig.background && cardConfig.background.toLowerCase().includes('.gif')) {
    try {
      const response = await fetch(cardConfig.background);
      const buffer = Buffer.from(await response.arrayBuffer());
      const gif = await GifUtil.read(buffer);
      bgFrames = gif.frames;
    } catch {
      // Si falla, renderFrame usará loadImage como fallback
      bgFrames = null;
    }
  }

  // Crear writer del GIF
  const buf = [];
  const gif = new GifWriter(buf, width, height, { loop: 0 }); // loop: 0 = infinito

  // Generar cada frame
  for (let frame = 0; frame < totalFrames; frame++) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    await renderFrame(
      ctx, width, height, cardConfig, theme, member, frame, totalFrames, isWelcome, avatar, bgFrames,
      { library, totalSec, animTime: frame * delay / 1000 }
    );

    // Convertir canvas a píxeles
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const totalPixels = width * height;

    // Paso 1: colectar colores únicos con frecuencia
    const colorFreq = new Map();
    for (let i = 0; i < totalPixels; i++) {
      if (pixels[i * 4 + 3] < 128) continue; // skip transparent
      const rgb = (pixels[i * 4] << 16) | (pixels[i * 4 + 1] << 8) | pixels[i * 4 + 2];
      colorFreq.set(rgb, (colorFreq.get(rgb) || 0) + 1);
    }

    let palette;
    if (colorFreq.size <= 255) {
      // 255 o menos colores únicos: usarlos todos sin cuantizar
      palette = [0x000000, ...Array.from(colorFreq.keys())];
    } else {
      // Más de 255: median cut para reducir a 255 colores preservando calidad
      const colors = Array.from(colorFreq.entries());
      palette = [0x000000, ...medianCut(colors, 255)];
    }

    // Paso 2: construir mapa color→índice y buscar cercano
    const paletteRgb = palette.map(c => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff]);
    const indexedPixels = new Uint8Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const a = pixels[i * 4 + 3];
      if (a < 128) { indexedPixels[i] = 0; continue; }

      const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
      const rgb = (r << 16) | (g << 8) | b;

      // Buscar exacto en paleta
      let bestIdx = 0;
      for (let p = 1; p < palette.length; p++) {
        if (palette[p] === rgb) { bestIdx = p; break; }
      }
      if (bestIdx > 0) { indexedPixels[i] = bestIdx; continue; }

      // Buscar el más cercano
      let minDist = Infinity;
      for (let p = 1; p < paletteRgb.length; p++) {
        const dr = r - paletteRgb[p][0], dg = g - paletteRgb[p][1], db = b - paletteRgb[p][2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) { minDist = dist; bestIdx = p; }
      }
      indexedPixels[i] = bestIdx;
    }

    // Potencia de 2 para omggif
    const paletteSize = Math.min(256, Math.max(2, Math.pow(2, Math.ceil(Math.log2(Math.max(2, palette.length))))));
    while (palette.length < paletteSize) palette.push(0x000000);

    // Agregar frame al GIF
    gif.addFrame(0, 0, width, height, indexedPixels, {
      palette: palette,
      delay: Math.round(delay / 10), // omggif usa décimas de segundo
      disposal: 0, // No limpiar frame anterior
    });
  }

  gif.end();
  return Buffer.from(buf);
}


module.exports = { generateCard, generateAnimatedCard, themes, defaultCardConfig };
