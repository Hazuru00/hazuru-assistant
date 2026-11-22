/**
 * ============================================================================
 * UTILIDAD: textAnimations - Motor de animación de textos para tarjetas
 * ============================================================================
 *
 * Un único motor para todos los casos:
 *   - Los presets son solo keyframes guardados en este archivo.
 *   - Las animaciones creadas por el usuario son keyframes guardados en
 *     src/database/cardAnimations.json.
 *   - Ambas se resuelven y se interpolan exactamente igual.
 *
 * FASES:
 *   Cada elemento de texto (título, usuario, subtítulo) tiene tres fases:
 *     - intro: se reproduce al principio
 *     - loop:  se reproduce en el tiempo restante, en bucle
 *     - outro: se reproduce al final
 *   El tiempo total de la tarjeta es animationFrames * animationDelay / 1000.
 *
 * COMPOSICIÓN:
 *   Se parte de un estado neutro y se aplican intro → loop → outro.
 *   opacidad y escala se MULTIPLICAN; x/y/rotación se SUMAN; y los recortes
 *   (chars, reveal) se toman como el mínimo. Así se pueden combinar, por
 *   ejemplo, "slideUp" de entrada con "pulse" en bucle y "fadeIn" invertido
 *   de salida sin que se pisen entre sí.
 * ============================================================================
 */

// Estado neutro: el texto se ve entero, en su posición y sin transformaciones.
const NEUTRAL = Object.freeze({
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,   // grados
  chars: 1,    // fracción de caracteres visibles (typewriter)
  reveal: 1,   // fracción del ancho visible (reveal)
});

/**
 * Funciones de easing. Reciben un progreso 0..1 y devuelven 0..1
 * (algunas permiten leve sobrepaso, como easeOutBack).
 */
const EASINGS = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  bounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
  },
};

/**
 * Diez presets. `reverse: true` en la fase los convierte en su versión de
 * salida (fadeIn → fadeOut, slideUp → slideDown, etc.), así que no hacen
 * falta animaciones duplicadas.
 */
const PRESETS = {
  fadeIn: {
    name: 'Fade In',
    easing: 'linear',
    keyframes: [{ at: 0, opacity: 0 }, { at: 1, opacity: 1 }],
  },
  slideUp: {
    name: 'Slide Up',
    easing: 'easeOutCubic',
    keyframes: [{ at: 0, y: 26, opacity: 0 }, { at: 1, y: 0, opacity: 1 }],
  },
  slideLeft: {
    name: 'Slide Left',
    easing: 'easeOutCubic',
    keyframes: [{ at: 0, x: 45, opacity: 0 }, { at: 1, x: 0, opacity: 1 }],
  },
  slideRight: {
    name: 'Slide Right',
    easing: 'easeOutCubic',
    keyframes: [{ at: 0, x: -45, opacity: 0 }, { at: 1, x: 0, opacity: 1 }],
  },
  pop: {
    name: 'Pop',
    easing: 'linear',
    keyframes: [
      { at: 0, scale: 0.5, opacity: 0 },
      { at: 0.7, scale: 1.15, opacity: 1 },
      { at: 1, scale: 1, opacity: 1 },
    ],
  },
  pulse: {
    name: 'Pulse',
    easing: 'linear',
    keyframes: [{ at: 0, scale: 1 }, { at: 0.5, scale: 1.08 }, { at: 1, scale: 1 }],
  },
  typewriter: {
    name: 'Typewriter',
    easing: 'linear',
    keyframes: [{ at: 0, chars: 0 }, { at: 1, chars: 1 }],
  },
  bounce: {
    name: 'Bounce',
    easing: 'linear',
    keyframes: [
      { at: 0, y: -30, opacity: 0 },
      { at: 0.5, y: 0, opacity: 1 },
      { at: 0.7, y: -10 },
      { at: 0.85, y: 0 },
      { at: 1, y: -4 },
    ],
  },
  glitch: {
    name: 'Glitch',
    easing: 'linear',
    keyframes: [
      { at: 0, x: 0, opacity: 1 },
      { at: 0.15, x: -6, opacity: 0.6 },
      { at: 0.3, x: 6, opacity: 1 },
      { at: 0.45, x: -4, opacity: 0.7 },
      { at: 0.6, x: 4, opacity: 1 },
      { at: 0.75, x: -2, opacity: 1 },
      { at: 1, x: 0, opacity: 1 },
    ],
  },
  reveal: {
    name: 'Reveal',
    easing: 'easeOutCubic',
    keyframes: [{ at: 0, reveal: 0 }, { at: 1, reveal: 1 }],
  },
};

/** Normaliza los keyframes rellenando los campos que faltan con NEUTRAL. */
function normalizeKeyframes(keyframes) {
  if (!Array.isArray(keyframes) || keyframes.length < 2) {
    return [{ ...NEUTRAL, at: 0 }, { ...NEUTRAL, at: 1 }];
  }
  const list = keyframes
    .map(k => ({ ...NEUTRAL, ...k, at: Math.min(1, Math.max(0, Number(k.at) || 0)) }))
    .sort((a, b) => a.at - b.at);
  return list.length >= 2 ? list : [{ ...NEUTRAL, at: 0 }, { ...NEUTRAL, at: 1 }];
}

/** Interpola linealmente dos estados. */
function lerpState(a, b, p) {
  const out = {};
  for (const key of Object.keys(NEUTRAL)) {
    out[key] = a[key] + (b[key] - a[key]) * p;
  }
  return out;
}

/** Devuelve el estado de una animación en un progreso 0..1. */
function sampleAnimation(definition, phase, progress) {
  const def = definition || {};
  const keyframes = normalizeKeyframes(def.keyframes);
  const easing = EASINGS[def.easing] ? def.easing : 'linear';
  let t = Math.min(1, Math.max(0, progress));
  if (phase && phase.reverse) t = 1 - t;
  t = EASINGS[easing](t);

  if (t <= keyframes[0].at) return { ...keyframes[0] };
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i], b = keyframes[i + 1];
    if (t <= b.at) {
      const span = b.at - a.at;
      return lerpState(a, b, span <= 0 ? 0 : (t - a.at) / span);
    }
  }
  return { ...keyframes[keyframes.length - 1] };
}

/** Compone un estado sobre otro (ver comentario de COMPOSICIÓN arriba). */
function composeState(base, add) {
  return {
    opacity: base.opacity * add.opacity,
    scale: base.scale * add.scale,
    x: base.x + add.x,
    y: base.y + add.y,
    rotate: base.rotate + add.rotate,
    chars: Math.min(base.chars, add.chars),
    reveal: Math.min(base.reveal, add.reveal),
  };
}

/**
 * Resuelve un ID a una definición: preset, animación guardada o null.
 * '__draft__' se usa para previsualizar una animación que aún no se guardó.
 */
function resolveAnimation(id, library) {
  if (!id || id === 'none') return null;
  if (id === '__draft__' && library && library.__draft__) return library.__draft__;
  if (PRESETS[id]) return PRESETS[id];
  if (library && library[id]) return library[id].definition || library[id];
  return null;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Calcula el estado final de un elemento en un instante dado.
 *
 * @param {Object} textAnim - { intro:{id,duration,reverse}, loop:{...}, outro:{...} }
 * @param {number} tSec - Segundo actual dentro de la tarjeta
 * @param {number} totalSec - Duración total de la tarjeta
 * @param {Object} library - Animaciones guardadas (mapa por ID)
 * @returns {Object} Estado compuesto listo para dibujar
 */
function getElementState(textAnim, tSec, totalSec, library) {
  let state = { ...NEUTRAL };
  if (!textAnim || !totalSec || totalSec <= 0) return state;

  const intro = textAnim.intro;
  const loop = textAnim.loop;
  const outro = textAnim.outro;

  const introDur = clamp(Number(intro?.duration) || 0, 0, totalSec);
  const outroDur = clamp(Number(outro?.duration) || 0, 0, totalSec - introDur);
  const outroStart = totalSec - outroDur;
  const loopDur = Math.max(outroStart - introDur, 0);
  const t = clamp(tSec, 0, totalSec);

  if (introDur > 0 && t < introDur) {
    const def = resolveAnimation(intro.id, library);
    if (def) state = composeState(state, sampleAnimation(def, intro, t / introDur));
  } else if (loopDur > 0 && t >= introDur && t < outroStart) {
    const def = resolveAnimation(loop?.id, library);
    if (def) {
      const cycle = Number(loop.duration) > 0 ? Number(loop.duration) : loopDur;
      const local = ((t - introDur) % cycle) / cycle;
      state = composeState(state, sampleAnimation(def, loop, local));
    }
  } else if (outroDur > 0 && t >= outroStart) {
    const def = resolveAnimation(outro.id, library);
    if (def) state = composeState(state, sampleAnimation(def, outro, (t - outroStart) / outroDur));
  }

  return state;
}

/** Lista de presets para el selector del dashboard. */
const listPresets = () => Object.entries(PRESETS).map(([id, def]) => ({ id, name: def.name }));

/** Definición base que se ofrece al crear una animación personalizada. */
const defaultCustomDefinition = () => ({
  easing: 'easeOutCubic',
  keyframes: [
    { at: 0, opacity: 0, y: 20, scale: 0.95 },
    { at: 1, opacity: 1, y: 0, scale: 1 },
  ],
});

module.exports = {
  NEUTRAL,
  EASINGS,
  PRESETS,
  getElementState,
  sampleAnimation,
  listPresets,
  defaultCustomDefinition,
};
