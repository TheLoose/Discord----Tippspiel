const { query } = require('../db/database');
const { isSwitching } = require('../utils/switchLock');

module.exports = {
  name: 'messageReactionRemove',

  async execute(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) {
      try { await reaction.fetch(); } catch (e) {
        console.error('Failed to fetch reaction:', e);
        return;
      }
    }

    const [match] = await query(
      `SELECT m.*,
              t1.name AS team_a, t1.emoji AS team_a_emoji,
              t2.name AS team_b, t2.emoji AS team_b_emoji
       FROM matches m
       JOIN teams t1 ON m.team_a_id = t1.team_id
       JOIN teams t2 ON m.team_b_id = t2.team_id
       WHERE m.discord_message_id = ?`,
      [reaction.message.id]
    );

    if (!match) return;
    if (match.status !== 'open') return;

    // If messageReactionAdd is currently handling a team switch for this
    // user+match, this removal was triggered programmatically — ignore it
    if (isSwitching(user.id, match.id)) {
      console.log(`🔒 Ignoring programmatic reaction removal for ${user.username} on match ${match.id}`);
      return;
    }

    const emojiName = reaction.emoji.name;
    const emojiId   = reaction.emoji.id;

    function emojiMatches(stored) {
      if (emojiId) return stored.includes(emojiId);
      return stored === emojiName;
    }

    let removedTeam = null;
    if (emojiMatches(match.team_a_emoji))      removedTeam = 'a';
    else if (emojiMatches(match.team_b_emoji)) removedTeam = 'b';
    else return;

    const result = await query(
      'DELETE FROM votes WHERE match_id = ? AND user_id = ? AND team = ?',
      [match.id, user.id, removedTeam]
    );

    if (result.affectedRows > 0) {
      console.log(`🗑️ ${user.username} removed their vote from match ${match.id}`);
    }
  }
};