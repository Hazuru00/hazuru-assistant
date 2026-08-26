/**
 * ============================================================================
 * COMANDO: /poll
 * ============================================================================
 * Crea una encuesta con reacciones.
 *
 * Dos modos:
 *   1. Sin opciones: Crea encuesta sí/no con ✅ y ❌
 *   2. Con opciones: Crea encuesta con hasta 9 opciones (separadas por coma)
 *
 * Opcionalmente, puede tener un temporizador que elimina las reacciones
 * después de X minutos.
 *
 * PARÁMETROS:
 *   - pregunta (requerido): La pregunta de la encuesta
 *   - opciones (opcional): Opciones separadas por coma (máx 9)
 *   - minutos (opcional): Duración en minutos (1-1440)
 *
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Crear una encuesta')
    .addStringOption(opt => opt.setName('pregunta').setDescription('Pregunta de la encuesta').setRequired(true))
    .addStringOption(opt => opt.setName('opciones').setDescription('Opciones separadas por coma (max 9)'))
    .addIntegerOption(opt => opt.setName('minutos').setDescription('Duracion en minutos').setMinValue(1).setMaxValue(1440)),

  async execute(interaction) {
    const question = interaction.options.getString('pregunta');
    const optionsRaw = interaction.options.getString('opciones');
    const minutes = interaction.options.getInteger('minutos') || 0;

    // Emojis numéricos para las opciones
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];

    // --- MODO SÍ/NO (sin opciones) ---
    if (!optionsRaw) {
      const msg = await interaction.reply({
        content: `📊 **${question}**\n\nResponde con ✅ o ❌`,
        fetchReply: true,
      });
      await msg.react('✅');
      await msg.react('❌');

      // Si hay temporizador, eliminar reacciones después del tiempo
      if (minutes) setTimeout(() => msg.reactions.removeAll().catch(() => {}), minutes * 60000);
      return;
    }

    // --- MODO CON OPCIONES ---
    // Separar las opciones por coma, limpiar espacios, y limitar a 9
    const options = optionsRaw.split(',').map(o => o.trim()).filter(Boolean).slice(0, 9);

    // Necesitar al menos 2 opciones para una encuesta válida
    if (options.length < 2) return interaction.reply({ content: 'Necesitas al menos 2 opciones.', ephemeral: true });

    // Crear el mensaje con las opciones formateadas
    const description = options.map((o, i) => `${emojis[i]} **${o}**`).join('\n');
    const msg = await interaction.reply({
      content: `📊 **${question}**\n\n${description}`,
      fetchReply: true,
    });

    // Agregar reacciones numéricas para cada opción
    for (let i = 0; i < options.length; i++) {
      await msg.react(emojis[i]);
    }

    // Si hay temporizador, eliminar reacciones después del tiempo
    if (minutes) {
      setTimeout(() => msg.reactions.removeAll().catch(() => {}), minutes * 60000);
    }
  },
};
