/**
 * ============================================================================
 * COMANDO: /ping
 * ============================================================================
 * Muestra la latencia del bot (tiempo de respuesta) y el ping del websocket.
 *
 * CÓMO FUNCIONA:
 *   1. Responde temporalmente con "Pinging..."
 *   2. Mide la diferencia de tiempo entre el envío y la respuesta
 *   3. Editar la respuesta con los valores de latencia
 *
 * PARÁMETROS: Ninguno
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  // Definición del comando (se registra en Discord con deploy-commands.js)
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Muestra el ping del bot'),

  async execute(interaction) {
    // Enviar respuesta y obtener el mensaje enviado
    // fetchReply: true hace que devuelva el mensaje enviado (para medir tiempo)
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });

    // Calcular latencia: timestamp de la respuesta - timestamp del comando
    const ping = sent.createdTimestamp - interaction.createdTimestamp;

    // Editar la respuesta con los resultados
    await interaction.editReply(`Pong! 🏓 Latencia: ${ping}ms | Websocket: ${interaction.client.ws.ping}ms`);
  },
};
