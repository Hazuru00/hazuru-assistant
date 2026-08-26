const { Events, EmbedBuilder } = require('discord.js');
const { getGuild } = require('../database/index');
const { getLogChannel } = require('../utils/getLogChannel');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    const config = getGuild(message.guild.id);
    const logging = config.logging;
    if (!logging?.messageDelete) return;

    const ch = getLogChannel(message.guild, logging);
    if (!ch) return;

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Mensaje Eliminado')
      .setColor(0xED4245)
      .addFields(
        { name: 'Autor', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Contenido', value: message.content?.slice(0, 1024) || '*Sin contenido*' },
      )
      .setTimestamp();

    if (message.attachments.size > 0) {
      embed.addFields({
        name: 'Archivos',
        value: message.attachments.map(a => a.name).join(', ').slice(0, 1024),
      });
    }

    ch.send({ embeds: [embed] }).catch(() => {});
  },
};
