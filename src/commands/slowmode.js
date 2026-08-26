/**
 * ============================================================================
 * COMANDO: /slowmode
 * ============================================================================
 * Establece el slowmode (rate limit) de un canal de texto.
 * El slowmode limita cuántos mensajes puede enviar un usuario por segundo.
 *
 * FORMATO DE TIEMPO:
 *   - 5s = 5 segundos entre mensajes
 *   - 30s = 30 segundos
 *   - 1m = 1 minuto
 *   - 0 o off = desactivar slowmode
 *
 * LÍMITE: Máximo 6 horas (21600 segundos) de slowmode
 *
 * PARÁMETROS:
 *   - duracion (requerido): Duración del slowmode o "0" para desactivar
 *
 * PERMISOS: Solo administradores
 * ============================================================================
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { parseDuration, formatDuration } = require('../utils/parseDuration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Establecer slowmode del canal')
    .addStringOption(opt => opt.setName('duracion').setDescription('Duracion (0 para desactivar, 5s, 30s, 1m)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const input = interaction.options.getString('duracion');

    // Desactivar slowmode si el input es "0" o "off"
    if (input === '0' || input === 'off') {
      await interaction.channel.setRateLimitPerUser(0);
      return interaction.reply({ content: '✅ Slowmode desactivado.', ephemeral: true });
    }

    // Parsear la duración
    const ms = parseDuration(input);
    if (!ms) return interaction.reply({ content: 'Formato invalido. Usa: `5s`, `30s`, `1m` o `0` para desactivar.', ephemeral: true });

    // Convertir milisegundos a segundos y verificar límite de Discord (6 horas)
    const seconds = Math.floor(ms / 1000);
    if (seconds > 21600) return interaction.reply({ content: 'El slowmode maximo es 6 horas.', ephemeral: true });

    try {
      await interaction.channel.setRateLimitPerUser(seconds);
      await interaction.reply({ content: `✅ Slowmode establecido a **${formatDuration(ms)}**.`, ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
};
