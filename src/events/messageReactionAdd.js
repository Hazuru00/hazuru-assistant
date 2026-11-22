const { getGuild } = require('../database');
const { logError } = require('../utils/logger');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    if (user.bot) return;

    // Handle partial reactions
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }

    const guildId = reaction.message.guild?.id;
    if (!guildId) return;

    const config = getGuild(guildId);
    const autoRole = config.autoRole || {};
    if (!autoRole.reactionRoles?.length) return;

    for (const rr of autoRole.reactionRoles) {
      if (!rr.enabled || !rr.messageId) continue;
      if (rr.messageId !== reaction.message.id) continue;

      if (rr.mode === 'select') return; // Select mode handled by interactionCreate

      // Emoji mode — match by name (unicode) or id (custom)
      const emojiKey = reaction.emoji.id || reaction.emoji.name;
      const match = rr.roles.find(r => r.emoji === emojiKey || r.emoji === reaction.emoji.name);
      if (match) {
        try {
          const role = reaction.message.guild.roles.cache.get(match.roleId);
          if (role) await reaction.message.guild.members.cache.get(user.id)?.roles.add(role);
        } catch (e) {
          logError(e, { event: 'messageReactionAdd', guild: { id: guildId }, user, section: 'reactionRole', action: 'Add role' });
        }
      }
    }
  },
};
