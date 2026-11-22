/**
 * ============================================================================
 * BASE DE DATOS: cardAnimations - Librería de animaciones de texto
 * ============================================================================
 *
 * Guarda las animaciones personalizadas creadas desde el dashboard.
 * Es GLOBAL por despliegue: cada persona corre su propio bot (código abierto,
 * instalación local) y sus animaciones están disponibles para todos los
 * servidores que configure en ese panel.
 *
 * El campo ownerId queda reservado para cuando se añadan cuentas de usuario.
 *
 * Persistencia: usa los helpers atómicos de ./atomic (tmp + fsync + rename)
 * y crea un backup antes de cada cambio, igual que el resto de las bases.
 * ============================================================================
 */

const path = require('path');
const crypto = require('crypto');
const { createBackup } = require('./backup');
const { readJson, writeJsonAtomic } = require('./atomic');
const { defaultCustomDefinition } = require('../utils/textAnimations');

const ANIMATIONS_PATH = path.join(__dirname, 'cardAnimations.json');

/**lee la base completa; si no existe, devuelve un objeto vacío*/
const read = () => readJson(ANIMATIONS_PATH, {});

/**normaliza una animación antes de guardarla*/
function normalize(input) {
  const definition = input.definition || {};
  return {
    name: String(input.name || 'Sin nombre').trim().slice(0, 60),
    definition: {
      easing: definition.easing || 'easeOutCubic',
      keyframes: Array.isArray(definition.keyframes)
        ? definition.keyframes.slice(0, 20).map(k => ({
            at: Math.min(1, Math.max(0, Number(k.at) || 0)),
            opacity: k.opacity == null ? 1 : Math.min(1, Math.max(0, Number(k.opacity))),
            x: Number(k.x) || 0,
            y: Number(k.y) || 0,
            scale: k.scale == null ? 1 : Math.max(0, Number(k.scale)),
            rotate: Number(k.rotate) || 0,
            chars: k.chars == null ? 1 : Math.min(1, Math.max(0, Number(k.chars))),
            reveal: k.reveal == null ? 1 : Math.min(1, Math.max(0, Number(k.reveal))),
          }))
        : defaultCustomDefinition().keyframes,
    },
  };
}

/**devuelve todas las animaciones ordenadas por nombre*/
const listCardAnimations = () => Object.values(read()).sort((a, b) => a.name.localeCompare(b.name));

/**devuelve una animación por ID (o null)*/
const getCardAnimation = (id) => read()[id] || null;

/**crea una animación y devuelve el objeto creado*/
function createCardAnimation(input) {
  const db = read();
  const data = normalize(input);
  const id = `anim_${crypto.randomBytes(6).toString('hex')}`;
  const now = Date.now();
  const animation = { id, ownerId: null, ...data, createdAt: now, updatedAt: now };

  createBackup('cardAnimations.json');
  db[id] = animation;
  writeJsonAtomic(ANIMATIONS_PATH, db);
  return animation;
}

/**actualiza nombre/definición; devuelve null si no existe*/
function updateCardAnimation(id, input) {
  const db = read();
  if (!db[id]) return null;

  createBackup('cardAnimations.json');
  db[id] = { ...db[id], ...normalize(input), updatedAt: Date.now() };
  writeJsonAtomic(ANIMATIONS_PATH, db);
  return db[id];
}

/**borra una animación; devuelve true si existía*/
function removeCardAnimation(id) {
  const db = read();
  if (!db[id]) return false;

  createBackup('cardAnimations.json');
  delete db[id];
  writeJsonAtomic(ANIMATIONS_PATH, db);
  return true;
}

module.exports = {
  listCardAnimations,
  getCardAnimation,
  createCardAnimation,
  updateCardAnimation,
  removeCardAnimation,
};
