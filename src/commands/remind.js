/**
 * ============================================================================
 * COMANDO: /remind
 * ============================================================================
 * Crea un recordatorio que el bot envía después de un tiempo determinado.
 *
 * Ejemplo: /remind tiempo:2h mensaje:Reunión con el equipo
 * → El bot menciona al usuario en 2 horas con el mensaje
 *
 * FORMATO DE TIEMPO:
 *   - 10s = 10 segundos
 *   - 30m = 30 minutos
 *   - 2h = 2 horas
 *   - 1d = 1 día
 *   - 1w = 1 semana
 *
 * PARÁMETROS:
 *   - tiempo (requerido): Duración del recordatorio
 *   - mensaje (requerido): Qué recordar
 *
 * PERMISOS: Todos los usuarios
 *
 * NOTA: Los recordatorios se pierden si el bot se reinicia.
 * ============================================================================
 */

const { SlashCommandBuilder } = require('discord.js');
const { parseDuration, formatDuration } = require('../utils/parseDuration');
const { addReminder } = require('../database/reminders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Establecer un recordatorio')
    .addStringOption(opt => opt.setName('tiempo').setDescription('Tiempo (10m, 2h, 1d)').setRequired(true))
    .addStringOption(opt => opt.setName('mensaje').setDescription('Mensaje del recordatorio').setRequired(true)),

  async execute(interaction) {
    const timeStr = interaction.options.getString('tiempo');
    const message = interaction.options.getString('mensaje');

    // Parsear la duración (ej: "2h" → 7200000 milisegundos)
    const ms = parseDuration(timeStr);

    // Validar formato
    if (!ms) return interaction.reply({ content: 'Formato invalido. Usa: `10m`, `2h`, `1d`', ephemeral: true });
    if (ms > 365 * 24 * 60 * 60 * 1000) return interaction.reply({ content: 'Maximo 1 año.', ephemeral: true });

    // Guardar el recordatorio en la base de datos
    const reminder = addReminder(interaction.guildId, {
      userId: interaction.user.id,
      channel: interaction.channel.id,
      message,
      remindAt: Date.now() + ms,
    });

    // Programar el envío del recordatorio con setTimeout
    setTimeout(async () => {
      try {
        const ch = await interaction.client.channels.fetch(reminder.channel);
        await ch.send({
          content: `<@${reminder.userId}> ⏰ Recordatorio: **${reminder.message}**`,
        });
      } catch {}
    }, ms);

    // Confirmar al usuario (ephemeral = solo lo ve él)
    await interaction.reply({
      content: `✅ Te recordaré **${message}** en **${formatDuration(ms)}**.`,
      ephemeral: true,
    });
  },
};
