/**
 * ============================================================================
 * LÓGICA PURA DEL AUTOCOMPLETADO (compatible con navegador y Node)
 * ============================================================================
 *
 * Separa la detección del token, el filtrado y la inserción de sugerencias del
 * componente Vue. Así se puede probar con tests sin necesidad de un navegador.
 * No toca el DOM: solo recibe y devuelve strings y objetos.
 * ============================================================================
 */

(function (root) {
  'use strict';

  /** Normaliza para buscar sin importar mayúsculas ni acentos. */
  const normalizar = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  /**
   * Detecta la expresión `{...}` que se está escribiendo antes del cursor.
   * Devuelve null si la llave está escapada, ya se cerró o hay argumentos.
   *
   * @param {string} texto - Contenido completo del campo
   * @param {number} cursor - Posición del caret
   * @returns {{inicio:number, fin:number, trozo:string}|null}
   */
  const detectarToken = (texto, cursor) => {
    const value = String(texto || '');
    const pos = typeof cursor === 'number' ? Math.max(0, Math.min(cursor, value.length)) : value.length;
    const antes = value.slice(0, pos);
    const apertura = antes.lastIndexOf('{');

    // `\{` es una llave literal, no el inicio de una variable.
    if (apertura < 0 || antes[apertura - 1] === '\\') return null;

    const trozo = antes.slice(apertura + 1);
    // Solo se completan nombres: con (, }, comillas o salto de línea el
    // usuario ya está escribiendo argumentos o la expresión terminó.
    if (!/^[A-Za-z0-9_.]*$/.test(trozo)) return null;

    // Si hay una `}` después del cursor, la reemplazamos completa para no
    // dejar una expresión a medias al aceptar la sugerencia.
    const resto = value.slice(pos);
    const cierre = resto.indexOf('}');
    return {
      inicio: apertura,
      fin: cierre >= 0 ? pos + cierre + 1 : pos,
      trozo,
    };
  };

  /** Filtra el catálogo por nombre o etiqueta y limita la cantidad. */
  const filtrarCatalogo = (catalogo, consulta, limite = 8) => {
    const q = normalizar(consulta);
    return (catalogo || [])
      .filter((item) => normalizar(item.clave).startsWith(q)
        || normalizar(item.etiqueta).includes(q))
      .slice(0, limite);
  };

  /**
   * Genera el texto a insertar y dónde dejar el caret.
   * Las funciones se insertan con argumentos nombrados y el cursor dentro de
   * las primeras comillas, para que solo haya que escribir el valor.
   */
  const textoDeSugerencia = (item) => {
    if (!item) return { texto: '', cursor: 0 };
    if (item.tipo !== 'funcion') return { texto: item.texto, cursor: item.texto.length };

    const args = (item.funcion && item.funcion.argumentos || [])
      .filter((a) => !String(a).startsWith('...'));
    if (!args.length) {
      const texto = `{${item.clave}()}`;
      return { texto, cursor: texto.length - 1 };
    }
    const texto = `{${item.clave}(${args.map((a) => `${a}:""`).join(', ')})}`;
    return { texto, cursor: texto.indexOf('""') + 1 };
  };

  /** Arma el catálogo con lo que viene de la API: sistema + guardado. */
  const construirCatalogo = (guia = {}, biblioteca = {}) => {
    const items = [];

    for (const variable of guia.variables || []) {
      items.push({
        clave: variable.nombre,
        etiqueta: `{${variable.nombre}}`,
        descripcion: variable.descripcion,
        categoria: variable.categoria,
        tipo: 'variable',
        texto: `{${variable.nombre}}`,
      });
    }

    for (const funcion of guia.funciones || []) {
      items.push({
        clave: funcion.nombre,
        etiqueta: `${funcion.nombre}()`,
        descripcion: funcion.descripcion,
        categoria: 'Función',
        tipo: 'funcion',
        funcion,
      });
    }

    for (const variable of Object.values(biblioteca.variables || {})) {
      items.push({
        clave: variable.nombre,
        etiqueta: `{${variable.nombre}}`,
        descripcion: variable.descripcion
          || (variable.tipo === 'array' ? 'Array: úsalo con aleatorio()' : 'Variable personalizada'),
        categoria: variable.tipo === 'array' ? 'Array custom' : 'Variable custom',
        tipo: 'variable',
        texto: `{${variable.nombre}}`,
      });
    }

    for (const plantilla of Object.values(biblioteca.plantillas || {})) {
      const params = (plantilla.parametros || []).filter(Boolean).map((p) => `${p}:""`);
      items.push({
        clave: plantilla.nombre,
        etiqueta: `plantilla(${plantilla.nombre})`,
        descripcion: plantilla.descripcion || 'Plantilla guardada',
        categoria: 'Plantilla',
        tipo: 'plantilla',
        texto: `{plantilla(id:"${plantilla.id}"${params.length ? `, ${params.join(', ')}` : ''})}`,
      });
    }

    return items;
  };

  const api = { normalizar, detectarToken, filtrarCatalogo, textoDeSugerencia, construirCatalogo };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LogicaEditor = api;
})(typeof window !== 'undefined' ? window : globalThis);
