/**
 * ============================================================================
 * UTILIDAD: previewMessage - Construcción de mensajes de prueba
 * ============================================================================
 * 
 * Arma el contenido y el embed de una sección (bienvenida, despedida, DM,
 * boost, ban o kick) usando las MISMAS variables que usan los eventos reales.
 * Así el /preview muestra exactamente lo que se enviaría de verdad.
 *
 * NO envía nada: solo devuelve los datos listos para `channel.send()`.
 * ============================================================================
 */

const { getGuild } = require('../database');
const { replaceVars } = require('./replaceVars');
const { buildEmbed } = require('./buildEmbed');

// Relación entre la opción del comando y la sección de guilds.json.
const TIPO_A_SECCION = {
  welcome: 'welcome',
  farewell: 'farewell',
  private: 'privateWelcome',
  boost: 'boost',
  ban: 'ban',
  kick: 'kick',
};

/**
 * Construye el mensaje de preview de una sección.
 *
 * @param {Object} opciones - Parámetros del preview
 * @param {Guild} opciones.guild - Servidor (para las variables)
 * @param {string} opciones.guildId - ID del servidor
 * @param {string} opciones.tipo - welcome, farewell, private, boost, ban o kick
 * @param {User} opciones.usuario - Usuario de prueba
 * @param {User} opciones.moderador - Quién "hizo" la acción (para ban/kick)
 * @returns {{mensaje: string, embed: EmbedBuilder|null, canalId: string, seccion: string}}
 */
const construirMensajePreview = ({ guild, guildId, tipo, usuario, moderador }) => {
  const seccion = TIPO_A_SECCION[tipo];
  if (!seccion) throw new Error('Tipo de preview no válido');

  const config = getGuild(guildId) || {};
  const datos = config[seccion] || {};

  // Asegurar campos mínimos por si el usuario elegido no es miembro del server.
  const user = {
    createdTimestamp: Date.now(),
    username: 'Usuario',
    tag: 'Usuario#0000',
    displayAvatarURL: () => '',
    ...(usuario || {}),
  };

  // Los eventos reales reciben un GuildMember (con guild y user). Si no se
  // pudo obtener, se arma un objeto equivalente para que replaceVars funcione.
  let fuente = {
    id: user.id,
    guild,
    user,
    joinedTimestamp: Date.now(),
  };

  // Ban y kick usan otra forma de variables: user + guild + executor + reason.
  if (tipo === 'ban' || tipo === 'kick') {
    fuente = {
      user,
      guild,
      executor: moderador || null,
      reason: 'Razón de prueba',
    };
  }

  const mensaje = replaceVars(datos.message || '', fuente);
  const embed = datos.embedEnabled ? buildEmbed(datos.embed, fuente) : null;

  return {
    mensaje,
    embed,
    // Las DMs no tienen canal configurado: el comando usa el canal actual.
    canalId: datos.channel || '',
    seccion,
  };
};

module.exports = { construirMensajePreview, TIPO_A_SECCION };
