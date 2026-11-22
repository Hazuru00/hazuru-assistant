/**
 * ============================================================================
 * COMANDO: /remind-list
 * ============================================================================
 * Muestra los recordatorios pendientes del servidor.
 *
 * Por defecto solo muestra los del usuario que ejecuta el comando. Con
 * `todos: true` (para administradores) se listan los de todos los miembros.
 * Los recordatorios ya vencidos se ignoran.
 *
 * PARÁMETROS:
 *   - todos (opcional): Mostrar también los recordatorios de otros usuarios
 *
 * PERMISOS: Todos (la opción "todos" requiere administrador)
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getReminders } = require('../database/reminders');
const { logError } = require('../utils/logger');

// Límite de líneas para no pasarnos del tamaño máximo de un embed.
const MAX_RECORDATORIOS = 15;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind-list')
    .setDescription('Ver tus recordatorios pendientes')
    .addBooleanOption(opt => opt
      .setName('todos')
      .setDescription('Mostrar los recordatorios de todos (solo admin)')),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ Este comando solo funciona en un servidor.', ephemeral: true });
    }

    const verTodos = interaction.options.getBoolean('todos') === true;
    if (verTodos && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Necesitás permiso de administrador para ver los recordatorios de otros.', ephemeral: true });
    }

    try {
      const ahora = Date.now();
      const pendientes = Object.values(getReminders(interaction.guildId))
        .filter(r => r.remindAt > ahora && (verTodos || r.userId === interaction.user.id))
        .sort((a, b) => a.remindAt - b.remindAt);

      if (!pendientes.length) {
        return interaction.reply({ content: '⏰ No tenés recordatorios pendientes.', ephemeral: true });
      }

      const lineas = pendientes.slice(0, MAX_RECORDATORIOS).map(r => {
        const cuando = `<t:${Math.floor(r.remindAt / 1000)}:R>`;
        const mensaje = String(r.message || '').slice(0, 80);
        return `• ${cuando} · <#${r.channel}> · ${mensaje}`;
      });
      const extra = pendientes.length > MAX_RECORDATORIOS
        ? `\n… y ${pendientes.length - MAX_RECORDATORIOS} más.`
        : '';

      const embed = new EmbedBuilder()
        .setTitle('⏰ Recordatorios pendientes')
        .setColor(0x5865F2)
        .setDescription(lineas.join('\n') + extra)
        .setFooter({ text: `${pendientes.length} recordatorio(s)` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      logError(e, { event: 'remind-list', user: interaction.user, guild: interaction.guild, action: 'List reminders' });
      await interaction.reply({ content: '❌ No se pudieron leer los recordatorios.', ephemeral: true }).catch(() => {});
    }
  },
};
