const { Events, EmbedBuilder } = require('discord.js');
const { getGuild } = require('../database/index');
const { getLogChannel } = require('../utils/getLogChannel');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const config = getGuild(newState.guild.id);
    const logging = config.logging;
    if (!logging?.voiceStateUpdate) return;

    const ch = getLogChannel(newState.guild, logging);
    if (!ch) return;

    const member = newState.member;
    let title = '';
    let color = 0x57F287;

    if (!oldState.channel && newState.channel) {
      title = '🔊 Canal de voz: Entrada';
    } else if (oldState.channel && !newState.channel) {
      title = '🔇 Canal de voz: Salida';
      color = 0xED4245;
    } else if (oldState.channel.id !== newState.channel.id) {
      title = '🔀 Canal de voz: Movido';
      color = 0xFEE75C;
    } else if (oldState.selfMute !== newState.selfMute || oldState.selfDeaf !== newState.selfDeaf) {
      title = '🎛️ Canal de voz: Estado cambiado';
      color = 0x5865F2;
    } else {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .addFields({ name: 'Usuario', value: `<@${member.id}> (${member.user.tag})`, inline: true })
      .setTimestamp();

    if (oldState.channel) embed.addFields({ name: 'Desde', value: oldState.channel.name, inline: true });
    if (newState.channel) embed.addFields({ name: 'Hacia', value: newState.channel.name, inline: true });

    ch.send({ embeds: [embed] }).catch(() => {});
  },
};
