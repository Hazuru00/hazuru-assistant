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

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { GifWriter } = require('omggif');

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
 * Obtiene los colores de un tema por nombre.
 * Si el tema no existe, usa dark como fallback.
 */
function getThemeDefaults(themeName) {
  return themes[themeName] || themes.dark;
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
async function renderFrame(ctx, width, height, cardConfig, theme, member, frame, frames, isWelcome, avatar) {
  const textColor = cardConfig.textColor || theme.textColor;
  const subtitleColor = cardConfig.subtitleColor || theme.subtitleColor;
  const borderColor = cardConfig.avatarBorderColor || theme.borderColor;

  // --- FONDO ---
  // Si hay imagen de fondo, usarla; si no, usar gradiente del tema
  if (cardConfig.background) {
    try {
      const bg = await loadImage(cardConfig.background);
      ctx.drawImage(bg, 0, 0, width, height);
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
  drawRoundedRect(ctx, 20, 20, width - 40, height - 40, 16);
  ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
  ctx.fill();

  // --- BORDE ---
  drawRoundedRect(ctx, 20, 20, width - 40, height - 40, 16);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // --- AVATAR ---
  const avatarRadius = 50;
  const avatarX = 130; // Posición X del centro del avatar
  const avatarY = height / 2; // Centrado verticalmente

  if (avatar) {
    // Dibujar borde circular del avatar
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius + (cardConfig.avatarBorderWidth || 4) / 2 + 2, 0, Math.PI * 2);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = (cardConfig.avatarBorderWidth || 4);
    ctx.stroke();
    // Dibujar avatar recortado en círculo
    drawCircleImage(ctx, avatar, avatarX, avatarY, avatarRadius);
  } else {
    // Si no se pudo cargar el avatar, dibujar un círculo con la inicial
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = borderColor;
    ctx.fill();
    const initial = (member.user.username || member.user.tag || 'U')[0].toUpperCase();
    drawTextWithShadow(ctx, initial, avatarX, avatarY, '#ffffff', `bold 40px ${cardConfig.font || 'sans-serif'}`);
  }

  // --- TÍTULO ---
  // Reemplazar {memberCount} en el título
  const titleText = (cardConfig.title || (isWelcome ? 'Bienvenido' : 'Adiós'))
    .replace(/{memberCount}/g, String(member.guild.memberCount));
  drawTextWithShadow(ctx, titleText, 210, height / 2 - 30, textColor, `bold 28px ${cardConfig.font || 'sans-serif'}`);

  // --- USERNAME ---
  drawTextWithShadow(ctx, member.user.tag, 210, height / 2 + 5, '#ffffff', `600 20px ${cardConfig.font || 'sans-serif'}`);

  // --- SUBTÍTULO ---
  const subtitleText = (cardConfig.subtitle || '').replace(/{memberCount}/g, String(member.guild.memberCount));
  if (subtitleText) {
    drawTextWithShadow(ctx, subtitleText, 210, height / 2 + 35, subtitleColor, `15px ${cardConfig.font || 'sans-serif'}`);
  }

  // --- LÍNEA DECORATIVA ---
  // Línea que crece con la animación (se extiende de izquierda a derecha)
  const lineProgress = Math.min(frame / Math.max(frames, 1), 1);
  ctx.beginPath();
  ctx.moveTo(210, height / 2 + 55);
  ctx.lineTo(210 + (width - 260) * lineProgress, height / 2 + 55);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // --- PARTÍCULAS ---
  // Pequeños puntos que se mueven en onda sinusoidal (solo en GIF animado)
  for (let i = 0; i < 6; i++) {
    const px = 210 + ((width - 260) * (i + 1)) / 7;
    const py = height / 2 + Math.sin(frame * 0.15 + i * 1.2) * 15; // Movimiento sinusoidal
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
 * @returns {Buffer} Buffer de la imagen PNG
 */
async function generateCard(member, config, isWelcome = true) {
  const cardConfig = { ...defaultCardConfig(), ...config };
  const theme = getThemeDefaults(cardConfig.theme);

  const width = 900;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Cargar avatar del usuario
  let avatar = null;
  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    avatar = await loadImage(avatarUrl);
  } catch {}

  // Renderizar un solo frame (frame 0 de 1 total)
  await renderFrame(ctx, width, height, cardConfig, theme, member, 0, 1, isWelcome, avatar);

  return canvas.toBuffer('image/png');
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

  // Cargar avatar
  let avatar = null;
  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    avatar = await loadImage(avatarUrl);
  } catch {}

  // Crear writer del GIF
  const buf = [];
  const gif = new GifWriter(buf, width, height, { loop: 0 }); // loop: 0 = infinito

  // Generar cada frame
  for (let frame = 0; frame < totalFrames; frame++) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    await renderFrame(ctx, width, height, cardConfig, theme, member, frame, totalFrames, isWelcome, avatar);

    // Convertir canvas a píxeles indexed (requerido por GIF)
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Crear paleta de 256 colores y mapear píxeles
    const colorMap = new Map();
    const palette = [];
    const indexedPixels = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      const a = pixels[i * 4 + 3];

      // Pixel transparente → color 0 (negro)
      if (a < 128) {
        indexedPixels[i] = 0;
        continue;
      }

      // Cuantizar a 6 bits por canal (reducir colores para paleta GIF)
      const qr = r >> 2;
      const qg = g >> 2;
      const qb = b >> 2;
      const key = (qr << 12) | (qg << 6) | qb;

      // Agregar a la paleta si no existe (máximo 256 colores)
      if (!colorMap.has(key) && palette.length / 3 < 256) {
        colorMap.set(key, palette.length / 3);
        palette.push(qr << 2, qg << 2, qb << 2);
      }

      indexedPixels[i] = colorMap.has(key) ? colorMap.get(key) : 0;
    }

    // Rellenar paleta hasta 256 colores (requerido por GIF)
    while (palette.length < 256 * 3) {
      palette.push(0, 0, 0);
    }

    // Agregar frame al GIF
    gif.addFrame(0, 0, width, height, indexedPixels, {
      palette: palette,
      delay: Math.round(delay / 10), // omggif usa décimas de segundo
      disposal: 0, // No limpiar frame anterior
    });
  }

  gif.finish();
  return Buffer.from(buf);
}


module.exports = { generateCard, generateAnimatedCard, themes, defaultCardConfig };
