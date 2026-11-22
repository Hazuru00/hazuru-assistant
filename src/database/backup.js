const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const MAX_BACKUPS = 10;

// Asegurar que existe el directorio de backups
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Crea un backup de un archivo JSON.
 * @param {string} filename - Nombre del archivo (ej: 'levels.json')
 * @returns {string|null} Ruta del backup creado o null si falló
 */
function createBackup(filename) {
  const srcPath = path.join(__dirname, filename);
  if (!fs.existsSync(srcPath)) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `${filename.replace('.json', '')}_${timestamp}.json`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  try {
    fs.copyFileSync(srcPath, backupPath);
    rotateBackups(filename);
    return backupPath;
  } catch {
    return null;
  }
}

/**
 * Elimina backups antiguos, manteniendo solo los más recientes.
 */
function rotateBackups(filename) {
  const prefix = filename.replace('.json', '');
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();

  // Eliminar excedentes
  for (let i = MAX_BACKUPS; i < files.length; i++) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, files[i])); } catch {}
  }
}

/**
 * Restaura un archivo desde el backup más reciente.
 * @param {string} filename - Nombre del archivo (ej: 'levels.json')
 * @returns {boolean} true si se restauró correctamente
 */
function restoreFromBackup(filename) {
  const prefix = filename.replace('.json', '');
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return false;

  const backupPath = path.join(BACKUP_DIR, files[0]);
  const destPath = path.join(__dirname, filename);

  try {
    fs.copyFileSync(backupPath, destPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lista todos los backups disponibles.
 */
function listBackups(filename) {
  const prefix = filename ? filename.replace('.json', '') : '';
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json') && (!prefix || f.startsWith(prefix)))
    .sort()
    .reverse()
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      created: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
    }));
}

module.exports = { createBackup, restoreFromBackup, listBackups, BACKUP_DIR };
