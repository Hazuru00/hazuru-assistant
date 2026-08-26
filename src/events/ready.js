/**
 * ============================================================================
 * EVENTO: clientReady
 * ============================================================================
 * Se ejecuta UNA SOLA VEZ cuando el bot se conecta exitosamente a Discord.
 * Equivale al evento 'ready' de discord.js.
 *
 * USO: Configurar el estado/actividad del bot y loggear que está online.
 * ============================================================================
 */

module.exports = {
  name: 'clientReady',
  once: true, // Solo se ejecuta una vez
  execute(client) {
    console.log(`✅ ${client.user.tag} is online!`);

    // Establecer la actividad que se muestra en el perfil del bot
    // type 3 = "Jugando a..." (Playing)
    client.user.setActivity('Hazuru\'s Assistant | /help', { type: 3 });
  },
};
