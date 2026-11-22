/**
 * ============================================================================
 * COMANDO: /racha
 * ============================================================================
 * Muestra el estado de la racha diaria del usuario.
 * Indica días consecutivos, multiplicador actual, y cuánto falta para
 * que la racha se rompa (medianoche).
 *
 * PARÁMETROS:
 *   - usuario: (opcional) Usuario a consultar
 *
 * PERMISOS: Todos los usuarios
 * ============================================================================
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../database/levels');
const { getGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('racha')
    .setDescription('Muestra tu racha diaria y cuánto falta para que se rompa')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false)),

  async execute(interaction) {
    const config = getGuild(interaction.guild.id);
    const levels = config.levels || {};
    if (!levels.enabled) return interaction.reply({ content: '❌ El sistema de niveles no está activado.', ephemeral: true });
    if (!levels.streakMultiplier?.enabled) return interaction.reply({ content: '❌ El sistema de rachas no está activado.', ephemeral: true });

    const user = interaction.options.getUser('usuario') || interaction.member.user;
    const userData = getUser(interaction.guild.id, user.id);
    if (!userData) return interaction.reply({ content: `${user.username} no tiene datos de nivel.`, ephemeral: true });

    const streak = userData.streak || { days: 0, lastDate: '' };
    const today = new Date().toLocaleDateString('sv-SE');
    const lastDate = streak.lastDate || '';

    // Calcular cuánto falta para medianoche (fin del día actual)
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timeLeft = midnight - now;
    const hours = Math.floor(timeLeft / 3600000);
    const minutes = Math.floor((timeLeft % 3600000) / 60000);

    // Determinar estado de la racha
    let status = '';
    let color = '#5865F2';
    if (lastDate === today) {
      status = `✅ Racha activa — ya hablaste hoy. Habla mañana para mantenerla.`;
      color = '#57F287';
    } else if (lastDate === '') {
      status = `⚠️ Sin racha — envía un mensaje para empezar una.`;
      color = '#FEE75C';
    } else {
      status = `🔴 Racha rota — el último mensaje fue hace días. Habla ahora para reiniciar.`;
      color = '#ED4245';
    }

    // Calcular multiplicador actual
    const bonus = levels.streakMultiplier?.dailyBonus || 0.1;
    const maxMult = levels.streakMultiplier?.maxMultiplier || 2.5;
    const currentMult = Math.min(1 + (streak.days * bonus), maxMult);
    const nextMult = Math.min(1 + ((streak.days + 1) * bonus), maxMult);

    const embed = new EmbedBuilder()
      .setTitle(`🔥 Racha de ${user.username}`)
      .setColor(color)
      .addFields(
        { name: 'Días consecutivos', value: `**${streak.days}** día${streak.days !== 1 ? 's' : ''}`, inline: true },
        { name: 'Multiplicador actual', value: `**x${currentMult.toFixed(1)}**`, inline: true },
        { name: 'Siguiente nivel', value: `x${nextMult.toFixed(1)}`, inline: true },
        { name: 'Estado', value: status, inline: false },
        { name: '⏳ Tiempo restante hoy', value: `**${hours}h ${minutes}m** para medianoche`, inline: false },
      )
      .setFooter({ text: 'Habla cada día para mantener tu racha' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
