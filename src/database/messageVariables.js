/**
 * ============================================================================
 * BASE DE DATOS: messageVariables - Variables y plantillas del dashboard
 * ============================================================================
 *
 * Guarda la biblioteca de variables custom, arrays y plantillas usada por el
 * motor de mensajes. Es GLOBAL por despliegue, igual que cardAnimations.json:
 * cada instalación local tiene su propia biblioteca para todos sus servidores.
 *
 * ESTRUCTURA:
 * {
 *   "variables": {
 *     "var_xxx": {
 *       id, nombre, descripcion, tipo: "texto"|"array", valor,
 *       global, servidores: [], valoresPorServidor: {}, debug
 *     }
 *   },
 *   "plantillas": {
 *     "tpl_xxx": {
 *       id, nombre, contenido, parametros: [],
 *       global, servidores: [], valoresPorServidor: {}, debug
 *     }
 *   }
 * }
 *
 * Persistencia: atomic.js (tmp + fsync + rename) y backup antes de cada cambio.
 * ============================================================================
 */

const path = require('path');
const crypto = require('crypto');
const { createBackup } = require('./backup');
const { readJson, writeJsonAtomic } = require('./atomic');
const { esReservada } = require('../utils/templateEngine');

const DB_PATH = path.join(__dirname, 'messageVariables.json');
const VACIA = () => ({ variables: {}, plantillas: {} });

/**lee la base completa; si no existe, devuelve la estructura vacía*/
const getBiblioteca = () => {
  const datos = readJson(DB_PATH, VACIA());
  return {
    variables: datos.variables && typeof datos.variables === 'object' ? datos.variables : {},
    plantillas: datos.plantillas && typeof datos.plantillas === 'object' ? datos.plantillas : {},
  };
};

/**comprueba que un nombre se pueda usar como variable o parámetro*/
const validarNombre = (nombre) => {
  const limpio = String(nombre || '').trim();
  if (!/^[A-Za-z0-9_]{1,40}$/.test(limpio)) return 'El nombre solo puede tener letras, números y guion bajo (máx. 40)';
  if (esReservada(limpio)) return `«${limpio}» es una variable del sistema y no se puede sobrescribir`;
  if (['constructor', 'prototype', '__proto__'].includes(limpio)) return 'Ese nombre está reservado';
  return null;
};

/**normaliza un texto o array con sus límites; devuelve null si no es válido*/
const normalizarValor = (valor, tipo, maximo = 4000) => {
  if (tipo === 'array') {
    if (!Array.isArray(valor)) return null;
    if (valor.length > 100) return null;
    const items = valor.map((item) => String(item ?? '').trim().slice(0, 500)).filter(Boolean);
    return items;
  }
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  return texto.length > maximo ? null : texto;
};

/**normaliza los servidores y sus valores específicos*/
const normalizarScope = (input) => {
  const servidores = Array.isArray(input.servidores)
    ? input.servidores.map(String).filter(Boolean).slice(0, 50)
    : [];
  const valoresPorServidor = {};
  const overrides = input.valoresPorServidor && typeof input.valoresPorServidor === 'object'
    ? input.valoresPorServidor
    : {};
  for (const [guildId, valor] of Object.entries(overrides)) {
    if (!/^\d{10,25}$/.test(guildId)) continue;
    // El override puede ser un array o un texto simple: el motor lo normaliza.
    const normalizado = normalizarValor(valor, Array.isArray(valor) ? 'array' : 'texto');
    if (normalizado !== null) valoresPorServidor[guildId] = normalizado;
  }
  return { global: !!input.global, servidores, valoresPorServidor, debug: !!input.debug };
};

/**
 * Valida y guarda la biblioteca completa que envía el dashboard.
 * @returns {{ok: boolean, error?: string, biblioteca?: Object}}
 */
function guardarBiblioteca(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Datos no válidos' };

  const resultados = VACIA();
  const nombres = new Set();

  for (const [clave, dato] of Object.entries(input.variables || {})) {
    const error = validarNombre(dato?.nombre);
    if (error) return { ok: false, error: `Variable «${dato?.nombre || clave}»: ${error}` };
    if (nombres.has(dato.nombre)) return { ok: false, error: `Nombre duplicado: ${dato.nombre}` };
    nombres.add(dato.nombre);

    const tipo = dato.tipo === 'array' ? 'array' : 'texto';
    const valor = normalizarValor(dato.valor, tipo);
    if (valor === null) return { ok: false, error: `El valor de «${dato.nombre}» es demasiado grande` };

    const id = /^var_[a-f0-9]+$/.test(clave) ? clave : `var_${crypto.randomBytes(6).toString('hex')}`;
    resultados.variables[id] = {
      id,
      nombre: dato.nombre.trim(),
      descripcion: String(dato.descripcion || '').trim().slice(0, 160),
      tipo,
      valor,
      ...normalizarScope({ ...dato, tipo }),
    };
  }

  for (const [clave, dato] of Object.entries(input.plantillas || {})) {
    const error = validarNombre(dato?.nombre);
    if (error) return { ok: false, error: `Plantilla «${dato?.nombre || clave}»: ${error}` };
    if (nombres.has(dato.nombre)) return { ok: false, error: `Nombre duplicado: ${dato.nombre}` };
    nombres.add(dato.nombre);

    const contenido = normalizarValor(dato.contenido, 'texto');
    if (contenido === null) return { ok: false, error: `La plantilla «${dato.nombre}» es demasiado grande` };
    const parametros = Array.isArray(dato.parametros)
      ? dato.parametros.map((p) => String(p).trim()).filter(Boolean).slice(0, 10)
      : [];
    for (const parametro of parametros) {
      const errorParametro = validarNombre(parametro);
      if (errorParametro) return { ok: false, error: `Parámetro «${parametro}»: ${errorParametro}` };
    }

    const id = /^tpl_[a-f0-9]+$/.test(clave) ? clave : `tpl_${crypto.randomBytes(6).toString('hex')}`;
    resultados.plantillas[id] = {
      id,
      nombre: dato.nombre.trim(),
      descripcion: String(dato.descripcion || '').trim().slice(0, 160),
      contenido,
      parametros,
      ...normalizarScope(dato),
    };
  }

  createBackup('messageVariables.json');
  writeJsonAtomic(DB_PATH, resultados);
  return { ok: true, biblioteca: resultados };
}

module.exports = { getBiblioteca, guardarBiblioteca, validarNombre };
