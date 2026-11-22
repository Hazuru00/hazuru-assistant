/**
 * ============================================================================
 * ESCRITURA ATÓMICA Y LECTURA TOLERANTE A CORRUPCIÓN (JSON)
 * ============================================================================
 *
 * Objetivo: que un apagón o un crash no deje las bases de datos corruptas
 * ni las sobrescriba con datos vacíos.
 *
 * - writeJsonAtomic / writeJsonAtomicAsync:
 *   escriben primero a un archivo .tmp, fuerzan el guardado a disco (fsync)
 *   y recién entonces renombran sobre el archivo real. El rename es atómico,
 *   así que el archivo original queda intacto si se corta la luz a mitad.
 *
 * - readJson:
 *   si el JSON está corrupto, guarda una copia .corrupt-* y restaura el
 *   backup válido más reciente en lugar de devolver un objeto vacío.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { listBackups } = require('./backup');

const fsp = fs.promises;

/**
 * Fuerza la sincronización del directorio para que el rename también
 * quede persistido en disco.
 */
function fsyncDir(dir) {
  let fd;
  try {
    fd = fs.openSync(dir, 'r');
    fs.fsyncSync(fd);
  } catch {
    // Algunos sistemas de archivos no permiten fsync sobre directorios.
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

function tmpPathFor(filePath) {
  const unique = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  return `${filePath}.${unique}.tmp`;
}

/**
 * Escribe un JSON de forma atómica y duradera (síncrono).
 * @param {string} filePath
 * @param {*} data
 */
function writeJsonAtomic(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  const tmpPath = tmpPathFor(filePath);
  let done = false;

  try {
    const fd = fs.openSync(tmpPath, 'w');
    try {
      fs.writeFileSync(fd, json);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, filePath);
    fsyncDir(path.dirname(filePath));
    done = true;
  } finally {
    if (!done) {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  }
}

/**
 * Escribe un JSON de forma atómica y duradera (asíncrono, para no bloquear
 * el event loop en escrituras frecuentes como levels.json).
 * @param {string} filePath
 * @param {*} data
 */
async function writeJsonAtomicAsync(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  const tmpPath = tmpPathFor(filePath);
  let done = false;

  try {
    const handle = await fsp.open(tmpPath, 'w');
    try {
      await handle.writeFile(json);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fsp.rename(tmpPath, filePath);
    fsyncDir(path.dirname(filePath));
    done = true;
  } finally {
    if (!done) {
      try { await fsp.unlink(tmpPath); } catch {}
    }
  }
}

/**
 * Lee un JSON. Si no existe, devuelve `fallback`. Si está corrupto,
 * conserva una copia y restaura el backup válido más reciente.
 * @param {string} filePath
 * @param {*} fallback
 */
function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;

    // Conservar el archivo dañado antes de tocar nada
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const corruptPath = `${filePath}.corrupt-${stamp}`;
    try { fs.copyFileSync(filePath, corruptPath); } catch {}

    // Intentar restaurar el backup válido más reciente
    const filename = path.basename(filePath);
    for (const backup of listBackups(filename)) {
      try {
        const data = JSON.parse(fs.readFileSync(backup.path, 'utf8'));
        writeJsonAtomic(filePath, data);
        console.error(`[db] ${filename} corrupto: restaurado desde ${backup.name}`);
        return data;
      } catch {
        // Backup inválido: probar el siguiente
      }
    }

    console.error(`[db] ${filename} corrupto y sin backup válido. Copia conservada en ${corruptPath}`);
    return fallback;
  }
}

module.exports = { readJson, writeJsonAtomic, writeJsonAtomicAsync };
