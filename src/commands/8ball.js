/**
 * ============================================================================
 * COMANDO: /8ball
 * ============================================================================
 * La clásica bola mágica. Responde una pregunta con una respuesta aleatoria
 * de una lista predefinida en español.
 *
 * PARÁMETROS:
 *   - pregunta (requerido): La pregunta que querés hacerle a la bola mágica
 *
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('La bola magica responde tu pregunta')
    .addStringOption(option => option.setName('pregunta').setDescription('Tu pregunta').setRequired(true)),

  async execute(interaction) {
    // Lista de respuestas posibles
    const answers = [
      'Si, definitivamente.',
      'Es seguro.',
      'Sin duda.',
      'Si.',
      'Cuenta con ello.',
      'Probablemente si.',
      'Las señales apuntan a si.',
      'Si.',
      'Puedes contar con eso.',
      'Mi respuesta es si.',
      'No puedo predecirlo ahora.',
      'Preguntame despues.',
      'Mejor no te lo digo ahora.',
      'No puedo predecirlo ahora.',
      'Concentrate y vuelve a preguntar.',
      'No cuentes con ello.',
      'Mi respuesta es no.',
      'Mis fuentes dicen que no.',
      'Las señales apuntan a no.',
      'Muy dudoso.',
    ];

    // Seleccionar una respuesta aleatoria
    const answer = answers[Math.floor(Math.random() * answers.length)];

    await interaction.reply(`🎱 **Pregunta:** ${interaction.options.getString('pregunta')}\n**Respuesta:** ${answer}`);
  },
};
