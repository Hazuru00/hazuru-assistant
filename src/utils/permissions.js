/**
 * ============================================================================
 * UTILIDAD: permissions - Verificación de Permisos
 * ============================================================================
 *
 * Funciones helper para verificar permisos de usuario antes de ejecutar
 * comandos de moderación.
 *
 * NOTA: Estas funciones NO se usan actualmente en los comandos.
 * Los comandos usan .setDefaultMemberPermissions() en el SlashCommandBuilder
 * para que Discord valide los permisos automáticamente.
 *
 * Se mantienen aquí por si se necesitan para futuros comandos que requieran
 * validación de permisos manual (ej: comando custom con lógica compleja).
 *
 * USO:
 *   const { checkPermission, checkHierarchy } = require('./utils/permissions');
 *
 *   // Verificar si tiene un permiso específico
 *   if (!await checkPermission(interaction, 'Administrator')) return;
 *
 *   // Verificar jerarquía de roles
 *   if (!await checkHierarchy(interaction, targetMember)) return;
 * ============================================================================
 */

const { PermissionFlagsBits } = require('discord.js');

/**
 * Verifica si el usuario que ejecuta el comando tiene un permiso específico.
 * Si no lo tiene, responde con un mensaje de error (ephemeral).
 *
 * @param {ChatInputCommandInteraction} interaction - La interacción del comando
 * @param {string} permission - Nombre del permiso (ej: 'Administrator', 'BanMembers')
 * @returns {boolean} true si tiene el permiso, false si no
 */
const checkPermission = async (interaction, permission) => {
  if (!interaction.member.permissions.has(PermissionFlagsBits[permission])) {
    await interaction.reply({
      content: `No tenes permiso para usar este comando. Necesitas: \`${permission}\``,
      ephemeral: true,
    });
    return false;
  }
  return true;
};

/**
 * Verifica si el usuario tiene un rol igual o mayor al objetivo.
 * Esto evita que un moderador banee/mutee a alguien con igual o mayor rango.
 *
 * @param {ChatInputCommandInteraction} interaction - La interacción
 * @param {GuildMember} targetMember - El miembro objetivo
 * @returns {boolean} true si puede actuar sobre el objetivo, false si no
 */
const checkHierarchy = async (interaction, targetMember) => {
  if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
    await interaction.reply({
      content: 'No podes actuar sobre un miembro con igual o mayor rango.',
      ephemeral: true,
    });
    return false;
  }
  return true;
};

module.exports = { checkPermission, checkHierarchy };
