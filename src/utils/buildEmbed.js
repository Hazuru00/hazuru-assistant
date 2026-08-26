/**
 * ============================================================================
 * UTILIDAD: buildEmbed - Constructor de Embeds
 * ============================================================================
 *
 * Convierte un objeto de configuración de embed (del panel web) en un
 * EmbedBuilder de discord.js listo para enviar.
 *
 * TODOS los valores pasan por replaceVars para reemplazar variables como
 * {user}, {server}, {memberCount}, etc.
 *
 * USO:
 *   const embedData = { title: 'Hola {user.name}', color: '#ff0000' };
 *   const embed = buildEmbed(embedData, member);
 *   await channel.send({ embeds: [embed] });
 *
 * Estructura de embedData:
 *   - title: Título
 *   - description: Descripción
 *   - color: Color en hex
 *   - thumbnail: URL de miniatura
 *   - image: URL de imagen grande
 *   - author: { name, iconUrl, url }
 *   - footer: { text, iconUrl }
 *   - fields: [{ name, value, inline }]
 * ============================================================================
 */

const { EmbedBuilder } = require('discord.js');
const { replaceVars } = require('./replaceVars');

/**
 * Construye un EmbedBuilder a partir de un objeto de configuración.
 *
 * @param {Object} embedData - Configuración del embed (del panel web)
 * @param {Object} source - Fuente de datos para las variables (miembro, ban, etc.)
 * @returns {EmbedBuilder|null} El embed construido, o null si no hay datos
 */
const buildEmbed = (embedData, source) => {
  if (!embedData) return null;
  const embed = new EmbedBuilder();

  // Título y descripción (con variables reemplazadas)
  if (embedData.title) embed.setTitle(replaceVars(embedData.title, source));
  if (embedData.description) embed.setDescription(replaceVars(embedData.description, source));

  // Color
  if (embedData.color) embed.setColor(embedData.color);

  // Imágenes (thumbnail = miniatura arriba a la derecha, image = imagen grande)
  if (embedData.thumbnail) embed.setThumbnail(replaceVars(embedData.thumbnail, source));
  if (embedData.image) embed.setImage(replaceVars(embedData.image, source));

  // Autor del embed (aparece arriba del título)
  if (embedData.author?.name) {
    embed.setAuthor({
      name: replaceVars(embedData.author.name, source),
      iconURL: embedData.author.iconUrl ? replaceVars(embedData.author.iconUrl, source) : undefined,
      url: embedData.author.url || undefined,
    });
  }

  // Footer (texto del pie de página)
  if (embedData.footer?.text) {
    embed.setFooter({
      text: replaceVars(embedData.footer.text, source),
      iconURL: embedData.footer.iconUrl ? replaceVars(embedData.footer.iconUrl, source) : undefined,
    });
  }

  // Campos adicionales (máximo 25 por límite de Discord)
  if (embedData.fields?.length > 0) {
    embedData.fields.forEach(f => {
      if (f.name && f.value) {
        embed.addFields({
          name: replaceVars(f.name, source),
          value: replaceVars(f.value, source),
          inline: f.inline || false,
        });
      }
    });
  }

  // Timestamp automático
  embed.setTimestamp();
  return embed;
};

module.exports = { buildEmbed };
