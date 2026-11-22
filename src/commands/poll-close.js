/**
 * ============================================================================
 * COMANDO: /poll-close
 * ============================================================================
 * Cierra una encuesta creada por /poll y muestra los resultados finales.
 *
 * El mensaje se busca por ID o por enlace de Discord. Solo se pueden cerrar
 * mensajes enviados por el bot (para no alterar mensajes de otra persona).
 * Al cerrar se cuentan las reacciones, se editan los resultados en el mensaje
 * y se quitan las reacciones si el bot tiene permiso para hacerlo.
 *
 * PARÁMETROS:
 *   - mensaje (requerido): ID o enlace del mensaje de la encuesta
 *   - canal (opcional): Canal donde está la encuesta (por defecto, el actual)
 *
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder } = require('discord.js');
const { logError } = require('../utils/logger');

/**
 * Extrae el ID del mensaje desde un ID suelto o un enlace de Discord.
 * @param {string} texto - ID o URL del mensaje
 * @returns {string|null} ID del mensaje, o null si no hay uno válido
 */
const extraerIdMensaje = (texto) => {
  const ids = String(texto || '').match(/\d{15,25}/g);
  // En un enlace de canal, el último número es el ID del mensaje.
  return ids ? ids[ids.length - 1] : null;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll-close')
    .setDescription('Cerrar una encuesta y mostrar resultados')
    .addStringOption(opt => opt
      .setName('mensaje')
      .setDescription('ID o enlace del mensaje de la encuesta')
      .setRequired(true))
    .addChannelOption(opt => opt
      .setName('canal')
      .setDescription('Canal donde está la encuesta (por defecto, este canal)')),

  async execute(interaction) {
    const idMensaje = extraerIdMensaje(interaction.options.getString('mensaje'));
    if (!idMensaje) {
      return interaction.reply({ content: '❌ Pegá un ID de mensaje válido o su enlace.', ephemeral: true });
    }

    const canal = interaction.options.getChannel('canal') || interaction.channel;
    if (!canal?.messages?.fetch) {
      return interaction.reply({ content: '❌ No pude acceder a ese canal.', ephemeral: true });
    }

    try {
      const mensaje = await canal.messages.fetch(idMensaje);
      if (!mensaje || !mensaje.author?.bot) {
        return interaction.reply({ content: '❌ Ese mensaje no es una encuesta del bot.', ephemeral: true });
      }

      // Restar 1 a cada reacción: es la reacción del propio bot.
      const resultados = mensaje.reactions?.cache?.size
        ? [...mensaje.reactions.cache.values()]
          .map(r => `${r.emoji} **${Math.max(0, r.count - 1)}**`)
          .join('  ')
        : 'Sin votos.';

      await mensaje.edit({
        content: `${mensaje.content}\n\n🔒 **Encuesta cerrada**\n${resultados}`,
      });
      // Quitar reacciones puede fallar si el bot no tiene "Gestionar mensajes".
      // La encuesta ya quedó cerrada igual, así que se ignora el error.
      await mensaje.reactions?.removeAll?.().catch(() => {});

      await interaction.reply({ content: '✅ Encuesta cerrada y resultados publicados.', ephemeral: true });
    } catch (e) {
      logError(e, { event: 'poll-close', user: interaction.user, guild: interaction.guild, action: 'Close poll' });
      await interaction.reply({ content: '❌ No se pudo cerrar la encuesta (¿ID incorrecto?).', ephemeral: true }).catch(() => {});
    }
  },
};
