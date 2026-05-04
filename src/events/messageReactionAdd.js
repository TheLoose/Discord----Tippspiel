const { query } = require('../db/database');
const { lockSwitch, unlockSwitch } = require('../utils/switchLock');

module.exports = {
  name: 'messageReactionAdd',

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
              l.name AS league_name,
              t1.name AS team_a, t1.emoji AS team_a_emoji,
              t2.name AS team_b, t2.emoji AS team_b_emoji
       FROM matches m
       JOIN leagues l  ON m.league_id = l.id
       JOIN teams   t1 ON m.team_a_id = t1.team_id
       JOIN teams   t2 ON m.team_b_id = t2.team_id
       WHERE m.discord_message_id = ?`,
      [reaction.message.id]
    );

    if (!match) return;
    if (match.status !== 'open') return;

    const emojiName = reaction.emoji.name;
    const emojiId   = reaction.emoji.id;

    function emojiMatches(stored) {
      if (emojiId) return stored.includes(emojiId);
      return stored === emojiName;
    }

    let team = null;
    if (emojiMatches(match.team_a_emoji))      team = 'a';
    else if (emojiMatches(match.team_b_emoji)) team = 'b';
    else {
      try { await reaction.users.remove(user.id); } catch {}
      return;
    }

    try {
      const [existing] = await query(
        'SELECT * FROM votes WHERE match_id = ? AND user_id = ?',
        [match.id, user.id]
      );

      if (existing && existing.team !== team) {
        // User is switching teams — lock so messageReactionRemove ignores
        // the programmatic removal of the old reaction
        lockSwitch(user.id, match.id);

        try {
          const oldEmoji = existing.team === 'a' ? match.team_a_emoji : match.team_b_emoji;
          const oldEmojiId = oldEmoji.match(/\d{10,}/)?.[0];
          const oldReaction = reaction.message.reactions.cache.find(r =>
            oldEmojiId ? r.emoji.id === oldEmojiId : r.emoji.name === oldEmoji
          );
          if (oldReaction) await oldReaction.users.remove(user.id);
        } catch (e) {
          console.warn('Could not remove old reaction:', e.message);
        } finally {
          // Always unlock, even if the reaction removal failed
          unlockSwitch(user.id, match.id);
        }

        await query(
          'UPDATE votes SET team = ?, voted_at = NOW() WHERE match_id = ? AND user_id = ?',
          [team, match.id, user.id]
        );

        console.log(`🔄 ${user.username} switched vote to Team ${team.toUpperCase()} on match ${match.id}`);
        return;
      }

      if (existing) return; // Already voted for same team, nothing to do

      const guild    = reaction.message.guild;
      const member   = await guild.members.fetch(user.id).catch(() => null);
      const username = member?.displayName ?? user.username;

      await query(
        'INSERT INTO votes (match_id, user_id, username, team) VALUES (?, ?, ?, ?)',
        [match.id, user.id, username, team]
      );

      console.log(`✅ ${username} voted for Team ${team.toUpperCase()} on match ${match.id} (${match.league_name})`);
    } catch (e) {
      console.error('Error recording vote:', e);
    }
  }
};