/**
 * ============================================================================
 * UTILIDAD: templateEngine - Motor de plantillas con variables y funciones
 * ============================================================================
 *
 * Resuelve texto con:
 *   - variables del sistema: {user}, {server}, {memberCount}...
 *   - variables custom: {Saludos}, {reglas}
 *   - arrays guardados: {Saludos} puede ser una lista
 *   - funciones con parámetros: {aleatorio(valores:"{Saludos}")}
 *   - plantillas guardadas: {plantilla(id:"bienvenida1", nombre:"{user}")}
 *
 * Seguridad:
 *   - No se usa eval ni se ejecuta código del usuario.
 *   - Solo se llaman funciones de la lista blanca FUNCIONES.
 *   - Límite de anidación y detección de ciclos.
 *   - Las variables del sistema y sus nombres reservados nunca se pueden
 *     sobrescribir con parámetros ni con variables custom.
 *
 * Si no se crea ninguna variable custom, el resultado es el mismo que
 * replaceVars de siempre.
 * ============================================================================
 */

const { obtenerVarsBase, obtenerVarsFechaHora } = require('./varsBase');

const MAX_PROFUNDIDAD = 5;

/** Nombres que pertenecen al sistema: jamás se resuelven como custom. */
const VARIABLES_RESERVADAS = [
  'user', 'user.name', 'user.id', 'user.avatar', 'user.tag', 'user.mention',
  'user.createdAt', 'user.joinedAt', 'server', 'server.id', 'server.icon',
  'memberCount', 'boost', 'date', 'time', 'moderator', 'reason',
];

/** Crea un error interno que se puede ocultar o mostrar según debug. */
const fallo = (mensaje, debug = false) => ({ __error: true, mensaje, debug });

/** Comprueba si un valor es un error interno. */
const esFallo = (valor) => !!(valor && typeof valor === 'object' && valor.__error === true);

/**
 * Convierte un valor resuelto a texto para insertarlo en el mensaje.
 * Los errores se muestran solo si la variable implicada tiene debug activo.
 */
const aTexto = (valor) => {
  if (esFallo(valor)) return valor.debug ? `⚠️ ${valor.mensaje}` : '';
  if (Array.isArray(valor)) return valor.map(aTexto).join(', ');
  if (valor === null || valor === undefined) return '';
  return String(valor);
};

/** Quita los escapes de una cadena en un solo pasaje (\\n no se come la n). */
const desescapar = (texto) => texto.replace(/\\(n|t|["'\\])/g, (_, caracter) => {
  if (caracter === 'n') return '\n';
  if (caracter === 't') return '\t';
  return caracter;
});

/** Un apóstrofo entre letras no delimita una cadena: don't, l'ami. */
const esApostrofo = (texto, i) => {
  if (texto[i] !== "'") return false;
  const palabra = /[\wáéíóúñü]/i;
  return palabra.test(texto[i - 1] || '') && palabra.test(texto[i + 1] || '');
};

/** Comprueba si una comilla abre una cadena en esa posición. */
const abreComilla = (texto, i) => {
  const c = texto[i];
  if (c !== '"' && c !== "'") return false;
  if (esApostrofo(texto, i)) return false;
  const anterior = texto[i - 1] || '';
  return /[\w]/.test(anterior) === false;
};

/**
 * Encuentra el cierre de un bloque respetando comillas y bloques anidados.
 * Se usa para '{', '(' y '['.
 */
const encontrarCierre = (texto, inicio, abierto, cerrado) => {
  let nivel = 0;
  let comilla = null;
  let nivelComilla = 0;
  for (let i = inicio; i < texto.length; i++) {
    const caracter = texto[i];
    if (comilla) {
      if (caracter === '\\') { i++; continue; }
      // Dentro de una comilla, un bloque anidado puede contener el mismo
      // tipo de comilla sin cerrar la exterior.
      if (esApertura(caracter)) { nivelComilla++; continue; }
      if (esCierre(caracter)) { if (nivelComilla) nivelComilla--; continue; }
      if (caracter === comilla && !nivelComilla && !esApostrofo(texto, i)) comilla = null;
      continue;
    }
    if (abreComilla(texto, i)) { comilla = caracter; nivelComilla = 0; continue; }
    if (caracter === abierto) nivel++;
    else if (caracter === cerrado) {
      nivel--;
      if (nivel === 0) return i;
    }
  }
  return -1;
};

/** Apila los bloques anidados para no dividir por comas dentro de ellos. */
const esApertura = (c) => c === '(' || c === '[' || c === '{';
const esCierre = (c) => c === ')' || c === ']' || c === '}';

/** Divide por comas respetando comillas y bloques anidados. */
const dividirPorComas = (texto) => {
  const partes = [];
  let actual = '';
  let pila = [];
  let comilla = null;
  let nivelComilla = 0;
  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    if (comilla) {
      actual += caracter;
      if (caracter === '\\' && i + 1 < texto.length) { actual += texto[++i]; continue; }
      if (esApertura(caracter)) { nivelComilla++; continue; }
      if (esCierre(caracter)) { if (nivelComilla) nivelComilla--; continue; }
      if (caracter === comilla && !nivelComilla && !esApostrofo(texto, i)) comilla = null;
      continue;
    }
    if (abreComilla(texto, i)) { comilla = caracter; nivelComilla = 0; actual += caracter; continue; }
    if (esApertura(caracter)) { pila.push(caracter); actual += caracter; continue; }
    if (esCierre(caracter)) { if (pila.length) pila.pop(); actual += caracter; continue; }
    if (caracter === ',' && !pila.length) {
      partes.push(actual.trim());
      actual = '';
      continue;
    }
    actual += caracter;
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
};

/** Encuentra el primer ':' de un argumento fuera de comillas y bloques. */
const encontrarDosPuntos = (texto) => {
  let pila = [];
  let comilla = null;
  let nivelComilla = 0;
  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    if (comilla) {
      if (caracter === '\\') { i++; continue; }
      if (esApertura(caracter)) { nivelComilla++; continue; }
      if (esCierre(caracter)) { if (nivelComilla) nivelComilla--; continue; }
      if (caracter === comilla && !nivelComilla && !esApostrofo(texto, i)) comilla = null;
      continue;
    }
    if (abreComilla(texto, i)) { comilla = caracter; nivelComilla = 0; continue; }
    if (esApertura(caracter)) { pila.push(caracter); continue; }
    if (esCierre(caracter)) { if (pila.length) pila.pop(); continue; }
    if (caracter === ':') return i;
  }
  return -1;
};

/** Parsea el contenido de un argumento: texto, array, expresión o error. */
const parsearValor = (texto) => {
  const limpio = texto.trim();
  if (!limpio) return { tipo: 'texto', valor: '' };

  if (limpio.startsWith('[') && encontrarCierre(limpio, 0, '[', ']') === limpio.length - 1) {
    const interior = limpio.slice(1, -1);
    return { tipo: 'array', valores: dividirPorComas(interior).map(parsearValor) };
  }

  if (limpio.startsWith('{') && encontrarCierre(limpio, 0, '{', '}') === limpio.length - 1) {
    return { tipo: 'expresion', contenido: parsearContenido(limpio.slice(1, -1)) };
  }

  const comilla = limpio[0];
  if (comilla === '"' || comilla === "'") {
    if (limpio.length < 2 || limpio[limpio.length - 1] !== comilla) {
      return { tipo: 'error', mensaje: `Comilla sin cerrar: ${limpio}` };
    }
    return { tipo: 'texto', valor: desescapar(limpio.slice(1, -1)) };
  }

  return { tipo: 'texto', valor: limpio };
};

/** Parsea `nombre:"valor", otro:{expresion}`; sin nombre usa índices. */
const parsearArgumentos = (texto) => {
  if (!texto.trim()) return [];
  return dividirPorComas(texto).map((parte, indice) => {
    const dosPuntos = encontrarDosPuntos(parte);
    if (dosPuntos === -1) return { nombre: String(indice), nodo: parsearValor(parte) };
    return {
      nombre: parte.slice(0, dosPuntos).trim(),
      nodo: parsearValor(parte.slice(dosPuntos + 1)),
    };
  });
};

/**
 * Parsea el contenido de `{...}`. Si no es una variable o función válida se
 * devuelve como literal, para no borrar JSON ni ejemplos de código.
 */
const parsearContenido = (contenido) => {
  const texto = contenido.trim();
  const paren = texto.indexOf('(');
  const esVariable = /^[\w.]+$/.test(texto);
  const esFuncion = paren !== -1 && texto.endsWith(')')
    && /^[\w.]+$/.test(texto.slice(0, paren))
    && encontrarCierre(texto, paren, '(', ')') === texto.length - 1;

  if (esVariable) return { tipo: 'variable', nombre: texto };
  if (esFuncion) {
    return {
      tipo: 'funcion',
      nombre: texto.slice(0, paren).trim(),
      argumentos: parsearArgumentos(texto.slice(paren + 1, -1)),
    };
  }
  return { tipo: 'literal', texto: `{${contenido}}` };
};

/** Normaliza un valor a array: array directo, JSON o texto separado por líneas/comas. */
const normalizarArray = (valor) => {
  if (Array.isArray(valor)) {
    return valor.flat(Infinity).map((item) => aTexto(item)).filter((item) => item !== '');
  }
  if (valor === null || valor === undefined) return [];
  const texto = String(valor).trim();
  if (texto.startsWith('[') && texto.endsWith(']')) {
    try {
      const parseado = JSON.parse(texto);
      if (Array.isArray(parseado)) return parseado.map((item) => aTexto(item)).filter(Boolean);
    } catch {}
  }
  return texto.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
};

/** Busca una variable custom por nombre o id. */
const buscarVariable = (nombre, biblioteca) => {
  const variables = biblioteca.variables || {};
  const lista = Object.values(variables);
  return lista.find((v) => v.nombre === nombre || v.id === nombre)
    || lista.find((v) => String(v.nombre || '').toLowerCase() === nombre.toLowerCase());
};

/** Busca una plantilla guardada por id o nombre sin tocar el prototipo. */
const buscarPlantilla = (nombre, biblioteca) => {
  const plantillas = biblioteca.plantillas || {};
  if (Object.prototype.hasOwnProperty.call(plantillas, nombre)) return plantillas[nombre];
  return Object.values(plantillas).find((p) => p.nombre === nombre)
    || Object.values(plantillas).find((p) => String(p.nombre || '').toLowerCase() === String(nombre).toLowerCase());
};

/** Comprueba si una definición aplica al servidor actual. */
const disponibleEn = (definicion, guildId) => {
  if (!definicion) return false;
  if (definicion.global) return true;
  if (!guildId) return false;
  if (definicion.valoresPorServidor && Object.prototype.hasOwnProperty.call(definicion.valoresPorServidor, guildId)) {
    return true;
  }
  return (definicion.servidores || []).includes(guildId);
};

/** Devuelve el valor global o el override del servidor. */
const valorDe = (definicion, guildId) => {
  if (guildId && definicion.valoresPorServidor && Object.prototype.hasOwnProperty.call(definicion.valoresPorServidor, guildId)) {
    return definicion.valoresPorServidor[guildId];
  }
  return definicion.valor !== undefined ? definicion.valor : definicion.contenido;
};

/** Funciones permitidas. `lazy` indica argumentos que solo se resuelven si se usan. */
const FUNCIONES = {
  aleatorio: {
    descripcion: 'Elige un valor al azar. rango:"1,5" o rango:"5" usa solo los primeros 5 valores.',
    argumentos: ['valores', 'rango'],
    requeridos: ['valores'],
    ejemplo: '{aleatorio(valores:"{Saludos}", rango:"1,5")}',
    ejecutar: (args, ctx) => {
      const valores = normalizarArray(args.valores);
      if (args.rango !== undefined) {
        const numeros = String(args.rango).split(',').map((n) => parseInt(n, 10)).filter(Number.isFinite);
        const limite = numeros[numeros.length - 1];
        if (limite > 0) valores.splice(limite);
      }
      if (!valores.length) return fallo('aleatorio() necesita al menos un valor', ctx.debug);
      const indice = Math.floor(ctx.random() * valores.length);
      return valores[Math.min(indice, valores.length - 1)];
    },
  },
  plantilla: {
    descripcion: 'Inserta una plantilla guardada y le pasa parámetros por nombre.',
    argumentos: ['id', '...parametros'],
    requeridos: ['id'],
    ejemplo: '{plantilla(id:"bienvenida1", nombre:"{user}", dato:"eres genial")}',
    ejecutar: (args, ctx, api) => {
      const id = args.id;
      const plantilla = buscarPlantilla(id, ctx.biblioteca);
      if (!plantilla) return fallo(`Plantilla no disponible: ${id}`, ctx.debug);
      if (!disponibleEn(plantilla, ctx.guildId)) {
        return fallo(`Plantilla no disponible en este servidor: ${id}`, ctx.debug || plantilla.debug);
      }
      const clavePila = `plantilla:${plantilla.id || id}`;
      if (ctx.pila.includes(clavePila)) {
        return fallo(`Ciclo detectado en plantilla: ${id}`, ctx.debug || plantilla.debug);
      }
      const parametros = {};
      for (const nombre of plantilla.parametros || []) {
        if (!Object.prototype.hasOwnProperty.call(args, nombre)) {
          return fallo(`Falta el parámetro "${nombre}" en plantilla "${id}"`, ctx.debug || plantilla.debug);
        }
        parametros[nombre] = args[nombre];
      }
      ctx.pila.push(clavePila);
      ctx.parametros.push(parametros);
      const debugAnterior = ctx.debug;
      if (plantilla.debug) ctx.debug = true;
      let resultado;
      try {
        resultado = api.resolverContenido(aTexto(valorDe(plantilla, ctx.guildId)));
      } finally {
        ctx.debug = debugAnterior;
        ctx.parametros.pop();
        ctx.pila.pop();
      }
      return resultado;
    },
  },
  mayusculas: {
    descripcion: 'Convierte el texto a mayúsculas.',
    argumentos: ['texto'],
    requeridos: ['texto'],
    ejemplo: '{mayusculas(texto:"{server}")}',
    ejecutar: (args) => aTexto(args.texto).toUpperCase(),
  },
  minusculas: {
    descripcion: 'Convierte el texto a minúsculas.',
    argumentos: ['texto'],
    requeridos: ['texto'],
    ejemplo: '{minusculas(texto:"{user.name}")}',
    ejecutar: (args) => aTexto(args.texto).toLowerCase(),
  },
  si: {
    descripcion: 'Elige un texto u otro según una comparación.',
    argumentos: ['condicion', 'verdadero', 'falso'],
    requeridos: ['condicion', 'verdadero', 'falso'],
    ejemplo: '{si(condicion:"{memberCount} >= 100", verdadero:"Grande", falso:"Pequeño")}',
    lazy: ['verdadero', 'falso'],
    ejecutar: (args, ctx, api) => {
      const condicion = aTexto(args.condicion);
      const coincidencia = condicion.match(/^(.*?)\s*(==|!=|>=|<=|>|<|contiene)\s*(.*)$/i);
      if (!coincidencia) return fallo(`Condición inválida en si(): ${condicion}`, ctx.debug);
      const limpiar = (valor) => String(valor).trim().replace(/^["'`]|["'`]$/g, '');
      const izquierda = limpiar(coincidencia[1]);
      const operador = coincidencia[2];
      const derecha = limpiar(coincidencia[3]);
      const tantoNumeros = izquierda !== '' && derecha !== ''
        && !Number.isNaN(Number(izquierda)) && !Number.isNaN(Number(derecha));
      const a = tantoNumeros ? Number(izquierda) : izquierda;
      const b = tantoNumeros ? Number(derecha) : derecha;
      let resultado;
      switch (operador.toLowerCase()) {
        case '==': resultado = a === b; break;
        case '!=': resultado = a !== b; break;
        case '>=': resultado = a >= b; break;
        case '<=': resultado = a <= b; break;
        case '>': resultado = a > b; break;
        case '<': resultado = a < b; break;
        case 'contiene': resultado = String(a).includes(String(b)); break;
      }
      return api.resolver(resultado ? 'verdadero' : 'falso');
    },
  },
};

/** Información pública para la guía de sintaxis y el autocompletado. */
const FUNCIONES_INFO = Object.entries(FUNCIONES).map(([nombre, datos]) => ({
  nombre,
  descripcion: datos.descripcion,
  argumentos: datos.argumentos,
  requeridos: datos.requeridos,
  ejemplo: datos.ejemplo,
}));

/** Resuelve un nodo del parser a su valor (texto, array o error). */
const resolverNodo = (nodo, ctx, profundidad) => {
  if (profundidad > MAX_PROFUNDIDAD) {
    return fallo(`Anidación máxima superada (${MAX_PROFUNDIDAD} niveles)`, ctx.debug);
  }

  if (nodo.tipo === 'literal') return nodo.texto;
  if (nodo.tipo === 'error') return fallo(nodo.mensaje, ctx.debug);

  if (nodo.tipo === 'texto') {
    const texto = nodo.valor;
    const inicio = texto.search(/\S/);
    if (inicio === -1) return texto;
    const fin = texto.trimEnd().length;
    const recortado = texto.slice(inicio, fin);
    // Una expresión que ocupa todo el argumento se resuelve sola, pero se
    // devuelven los espacios que la envolvían.
    if (recortado.startsWith('{')) {
      const cierre = encontrarCierre(recortado, 0, '{', '}');
      if (cierre === recortado.length - 1) {
        const resuelto = resolverNodo(
          { tipo: 'expresion', contenido: parsearContenido(recortado.slice(1, -1)) },
          ctx, profundidad,
        );
        // Sin texto alrededor se devuelve el valor tal cual: si es un array,
        // normalizarArray todavía puede distinguir sus elementos.
        if (inicio === 0 && fin === texto.length) return resuelto;
        return texto.slice(0, inicio) + aTexto(resuelto) + texto.slice(fin);
      }
    }
    return texto.includes('{') ? interpolar(texto, ctx, profundidad) : texto;
  }

  if (nodo.tipo === 'array') {
    // No se convierte a texto aquí: así un array dentro de otro conserva sus
    // elementos y normalizarArray puede distinguirlos después.
    return nodo.valores.map((valor) => resolverNodo(valor, ctx, profundidad + 1));
  }

  if (nodo.tipo === 'expresion') return evaluarContenido(nodo.contenido, ctx, profundidad);
  if (nodo.tipo === 'variable' || nodo.tipo === 'funcion') {
    return evaluarContenido(nodo, ctx, profundidad);
  }

  return aTexto(nodo);
};

/** Resuelve una variable o función ya parseada. */
const evaluarContenido = (contenido, ctx, profundidad) => {
  if (contenido.tipo === 'literal') return contenido.texto;

  if (contenido.tipo === 'variable') {
    const nombre = contenido.nombre.trim();

    // 1. Nombres reservados y variables del sistema: nunca son sobrescribibles
    //    ni por parámetros de plantilla ni por variables custom.
    if (esReservada(nombre)) {
      return Object.prototype.hasOwnProperty.call(ctx.vars, nombre)
        ? ctx.vars[nombre]
        : fallo(`Variable del sistema no disponible: {${nombre}}`, ctx.debug);
    }
    if (Object.prototype.hasOwnProperty.call(ctx.vars, nombre)) return ctx.vars[nombre];

    // 2. Parámetros locales de una plantilla.
    for (let i = ctx.parametros.length - 1; i >= 0; i--) {
      if (Object.prototype.hasOwnProperty.call(ctx.parametros[i], nombre)) {
        return materializar(ctx.parametros[i][nombre], ctx, profundidad + 1);
      }
    }

    // 3. Variable custom con su scope.
    const variable = buscarVariable(nombre, ctx.biblioteca);
    if (!variable) return fallo(`Variable no disponible: {${nombre}}`, ctx.debug);
    if (!disponibleEn(variable, ctx.guildId)) {
      return fallo(`Variable no disponible en este servidor: {${nombre}}`, ctx.debug || variable.debug);
    }
    const clavePila = `variable:${variable.id || nombre}`;
    if (ctx.pila.includes(clavePila)) return fallo(`Ciclo detectado: {${nombre}}`, ctx.debug || variable.debug);
    ctx.pila.push(clavePila);
    // El debug de la variable también cubre los errores dentro de su valor.
    const debugAnterior = ctx.debug;
    if (variable.debug) ctx.debug = true;
    let resultado;
    try {
      resultado = materializar(valorDe(variable, ctx.guildId), ctx, profundidad + 1);
    } finally {
      ctx.debug = debugAnterior;
      ctx.pila.pop();
    }
    return resultado;
  }

  if (contenido.tipo === 'funcion') {
    const funcion = FUNCIONES[contenido.nombre];
    if (!funcion) return fallo(`Función desconocida: {${contenido.nombre}()}`, ctx.debug);

    const nodos = {};
    contenido.argumentos.forEach((argumento, indice) => {
      // Los argumentos posicionales toman el nombre declarado de la función.
      const nombre = /^\d+$/.test(argumento.nombre)
        ? ((funcion.argumentos || [])[Number(argumento.nombre)] || argumento.nombre)
        : argumento.nombre;
      nodos[nombre] = argumento.nodo;
    });

    for (const nombre of funcion.requeridos || []) {
      if (!Object.prototype.hasOwnProperty.call(nodos, nombre)) {
        return fallo(`Falta el argumento "${nombre}" en ${contenido.nombre}()`, ctx.debug);
      }
    }

    const valores = {};
    contenido.argumentos.forEach((argumento, indice) => {
      const nombre = /^\d+$/.test(argumento.nombre)
        ? ((funcion.argumentos || [])[Number(argumento.nombre)] || argumento.nombre)
        : argumento.nombre;
      if (!(funcion.lazy || []).includes(nombre)) {
        // resolverNodo ya interpola textos y materializa arrays y expresiones.
        valores[nombre] = resolverNodo(argumento.nodo, ctx, profundidad + 1);
      }
    });

    const api = {
      resolver: (nombre) => nodos[nombre]
        ? resolverNodo(nodos[nombre], ctx, profundidad + 1)
        : fallo(`Falta el argumento "${nombre}" en ${contenido.nombre}()`, ctx.debug),
      resolverContenido: (texto) => interpolar(texto, ctx, profundidad + 1),
    };
    return funcion.ejecutar(valores, ctx, api);
  }

  return aTexto(contenido);
};

/** Resuelve recursivamente un valor ya obtenido. */
const materializar = (valor, ctx, profundidad) => {
  if (esFallo(valor)) return valor;
  if (Array.isArray(valor)) return valor.map((item) => materializar(item, ctx, profundidad + 1));
  if (typeof valor === 'string') return interpolar(valor, ctx, profundidad);
  return valor === null || valor === undefined ? '' : String(valor);
};

/** Interpola todas las expresiones `{...}` de un texto. */
const interpolar = (texto, ctx, profundidad) => {
  if (typeof texto !== 'string' || !texto.includes('{')) return texto;
  let salida = '';
  let i = 0;
  while (i < texto.length) {
    // \{ y \} permiten escribir llaves literales.
    if (texto[i] === '\\' && (texto[i + 1] === '{' || texto[i + 1] === '}')) {
      salida += texto[i + 1];
      i += 2;
      continue;
    }
    if (texto[i] !== '{') { salida += texto[i++]; continue; }
    const cierre = encontrarCierre(texto, i, '{', '}');
    if (cierre === -1) { salida += texto[i++]; continue; }
    const contenido = parsearContenido(texto.slice(i + 1, cierre));
    salida += aTexto(resolverNodo({ tipo: 'expresion', contenido }, ctx, profundidad + 1));
    i = cierre + 1;
  }
  return salida;
};

/**
 * Resuelve un texto con variables del sistema, variables custom y funciones.
 *
 * @param {string} texto - Texto con variables
 * @param {Object} opciones
 * @param {Object} opciones.fuente - GuildMember, ban info u objeto plano
 * @param {Object} [opciones.vars] - Variables del sistema ya calculadas
 * @param {Object} [opciones.biblioteca] - { variables, plantillas }
 * @param {string} [opciones.guildId] - Servidor actual para aplicar scopes
 * @param {Function} [opciones.random] - Inyectable en pruebas
 * @param {boolean} [opciones.debug] - Muestra errores sin debug de variable
 * @returns {string} Texto resultante
 */
const resolverPlantillas = (texto, opciones = {}) => {
  const baseVars = opciones.vars || obtenerVarsBase(opciones.fuente);
  const ctx = {
    vars: { ...obtenerVarsFechaHora(), ...baseVars },
    biblioteca: opciones.biblioteca || {},
    guildId: opciones.guildId || (opciones.fuente && opciones.fuente.guild && opciones.fuente.guild.id) || '',
    random: opciones.random || Math.random,
    debug: !!opciones.debug,
    parametros: [],
    pila: [],
  };
  return interpolar(String(texto || ''), ctx, 0);
};

/** Comprueba si un nombre pertenece a las variables reservadas. */
const esReservada = (nombre) => VARIABLES_RESERVADAS.includes(nombre);

module.exports = {
  resolverPlantillas,
  FUNCIONES_INFO,
  VARIABLES_RESERVADAS,
  normalizarArray,
  esReservada,
};
