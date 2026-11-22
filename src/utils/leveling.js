const { getUser, getOrCreateUser, saveUser } = require('../database/levels');
const { logInfo, logError } = require('./logger');

/**
 * Calcula el XP necesario para alcanzar un nivel.
 */
function xpForLevel(level, formula) {
  const base = formula?.base || 100;
  const exp = formula?.exponent || 1.5;
  return Math.floor(base * Math.pow(level, exp));
}

/**
 * Obtiene el icono de rango según el nivel.
 */
function getIconForLevel(level, icons) {
  if (!icons || !icons.length) return { icon: '🌱', label: 'Novato' };
  const sorted = [...icons].sort((a, b) => b.minLevel - a.minLevel);
  return sorted.find(i => level >= i.minLevel) || sorted[sorted.length - 1];
}

/**
 * Obtiene los logros nuevos desbloqueados.
 */
function checkAchievements(userData, achievements) {
  if (!achievements || !achievements.length) return [];
  const newAchievements = [];
  for (const ach of achievements) {
    if (userData.achievements.includes(ach.id)) continue;
    let unlocked = false;
    if (ach.type === 'messages' && userData.messages >= ach.target) unlocked = true;
    if (ach.type === 'level' && userData.level >= ach.target) unlocked = true;
    if (unlocked) {
      newAchievements.push(ach);
      userData.achievements.push(ach.id);
    }
  }
  return newAchievements;
}

/**
 * Procesa la ganancia de XP de un mensaje.
 * Retorna { xpGained, leveledUp, newLevel, newAchievements, icon }
 */
async function processMessage(guildId, userId, config, channelId) {
  const levels = config.levels || {};
  if (!levels.enabled) return null;

  const user = getOrCreateUser(guildId, userId);
  const now = Date.now();
  const today = new Date().toLocaleDateString('sv-SE'); // "2026-08-03" en hora local del servidor
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE');

  // Cooldown de mensajes
  const msgCooldown = (levels.messageCooldown || 0) * 1000;
  const msgOnCooldown = msgCooldown > 0 && (now - user.lastXpMessage < msgCooldown);
  if (!msgOnCooldown) {
    user.messages++;
  }

  // Cooldown de XP
  const xpCooldown = (levels.xpCooldown || 60) * 1000;
  if (now - user.lastXpMessage < xpCooldown) {
    await saveUser(guildId, userId, user);
    return null;
  }

  // Actualizar racha SIEMPRE (incluso si estaba en cooldown)
  if (user.streak.lastDate === today) {
    // Ya habló hoy, no cambiar racha
  } else if (user.streak.lastDate === yesterday) {
    user.streak.days++;
  } else {
    user.streak.days = 1;
  }
  user.streak.lastDate = today;

  // Calcular XP base
  const min = levels.xpPerMessage?.min || 15;
  const max = levels.xpPerMessage?.max || 25;
  let xp = Math.floor(Math.random() * (max - min + 1)) + min;

  // Aplicar multiplicador de canal
  if (levels.channelMultipliers?.length && channelId) {
    const mult = levels.channelMultipliers.find(m => m.channelId === channelId);
    if (mult) xp = Math.floor(xp * mult.multiplier);
  }

  // Aplicar multiplicador de racha
  if (levels.streakMultiplier?.enabled) {
    const bonus = levels.streakMultiplier.dailyBonus || 0.1;
    const maxMult = levels.streakMultiplier.maxMultiplier || 2.5;
    const streakMult = Math.min(1 + (user.streak.days * bonus), maxMult);
    xp = Math.floor(xp * streakMult);
  }

  // Guardar XP
  user.xp += xp;
  user.lastXpMessage = now;

  // Verificar subida de nivel
  const oldLevel = user.level;
  const formula = levels.levelFormula || { base: 100, exponent: 1.5 };
  let leveledUp = false;
  const MAX_LEVEL = 999;
  while (user.level < MAX_LEVEL && user.xp >= xpForLevel(user.level + 1, formula)) {
    user.xp -= xpForLevel(user.level + 1, formula);
    user.level++;
    leveledUp = true;
  }

  // Verificar logros
  const newAchievements = checkAchievements(user, levels.achievements);

  // Obtener icono actual
  const icon = getIconForLevel(user.level, levels.icons);

  // Guardar
  await saveUser(guildId, userId, user);

  return { xpGained: xp, leveledUp, newLevel: user.level, oldLevel, newAchievements, icon, user };
}

/**
 * Asigna roles por nivel al usuario.
 */
async function assignLevelRoles(member, newLevel, levelRoles) {
  if (!levelRoles || !levelRoles.length) return;
  for (const lr of levelRoles) {
    if (newLevel >= lr.level) {
      const role = member.guild.roles.cache.get(lr.roleId);
      if (role && !member.roles.cache.has(lr.roleId)) {
        try {
          await member.roles.add(role);
          // Remover roles anteriores si está configurado
          if (lr.removePrevious) {
            const prevRoles = levelRoles.filter(r => r.level < lr.level && r.roleId !== lr.roleId);
            for (const prev of prevRoles) {
              const prevRole = member.guild.roles.cache.get(prev.roleId);
              if (prevRole && member.roles.cache.has(prev.roleId)) {
                await member.roles.remove(prevRole).catch(() => {});
              }
            }
          }
        } catch (e) {
          const { logError } = require('./logger');
          logError(e, { event: 'assignLevelRoles', userId: member.id, roleId: lr.roleId });
        }
      }
    }
  }
}

module.exports = { xpForLevel, getIconForLevel, processMessage, assignLevelRoles, checkAchievements };
