const { Events, EmbedBuilder } = require('discord.js');
const { getGuild } = require('../database/index');
const { getLogChannel } = require('../utils/getLogChannel');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const config = getGuild(oldMessage.guild.id);
    const logging = config.logging;
    if (!logging?.messageUpdate) return;

    const ch = getLogChannel(oldMessage.guild, logging);
    if (!ch) return;

    const embed = new EmbedBuilder()
      .setTitle('✏️ Mensaje Editado')
      .setColor(0xFEE75C)
      .addFields(
        { name: 'Autor', value: `<@${oldMessage.author.id}> (${oldMessage.author.tag})`, inline: true },
        { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
        { name: 'Antes', value: oldMessage.content?.slice(0, 1024) || '*Sin contenido*' },
        { name: 'Despues', value: newMessage.content?.slice(0, 1024) || '*Sin contenido*' },
      )
      .setTimestamp();

    ch.send({ embeds: [embed] }).catch(() => {});
  },
};
