const { EmbedBuilder } = require('discord.js');

// Colours per league index (cycles if more than 4 leagues)
const LEAGUE_COLORS = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12];

/**
 * Build the embed posted to Discord for a match.
 */
function buildMatchEmbed(match, league) {
  const color = LEAGUE_COLORS[(league.id - 1) % LEAGUE_COLORS.length];

  const matchdayLabel = league.matchday ? ` — ${league.matchday.label}` : '';

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${league.emoji ?? '🏆'} ${league.name}${matchdayLabel} — Match Prediction`)
    .setDescription(
      `## ${match.team_a_emoji} ${match.team_a}  vs  ${match.team_b} ${match.team_b_emoji}\n\n` +
      `React with ${match.team_a_emoji} to vote for **${match.team_a}**\n` +
      `React with ${match.team_b_emoji} to vote for **${match.team_b}**`
    )
    .setFooter({ text: `Match ID: ${match.id} • Voting is open!` })
    .setTimestamp(match.match_date ? new Date(match.match_date) : null);
}

/**
 * Build the result embed posted after evaluation.
 */
function buildResultEmbed(match, league, winnerName, winnerEmoji, stats) {
  const color = LEAGUE_COLORS[(league.id - 1) % LEAGUE_COLORS.length];

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${league.emoji ?? '🏆'} ${league.name} — Result`)
    .setDescription(
      `## ${match.team_a_emoji} ${match.team_a}  vs  ${match.team_b} ${match.team_b_emoji}\n\n` +
      `🏅 **Winner: ${winnerEmoji} ${winnerName}**\n\n` +
      `✅ ${stats.correct} correct guess${stats.correct !== 1 ? 'es' : ''}\n` +
      `❌ ${stats.wrong} wrong guess${stats.wrong !== 1 ? 'es' : ''}\n` +
      `👻 ${stats.noVote} did not vote`
    )
    .setFooter({ text: `Match ID: ${match.id} • Points have been awarded` })
    .setTimestamp();
}

/**
 * Check whether a member has the moderator role defined in .env
 */
function isModerator(member) {
  return member.roles.cache.has(process.env.MOD_ROLE_ID);
}

/**
 * Converts a Discord emoji string to the format msg.react() expects.
 * Unicode:  "⚽"              → "⚽"
 * Custom:   "<:BDW:123456>"  → "BDW:123456"
 * Animated: "<a:BDW:123456>" → "BDW:123456"
 */
function parseEmoji(emoji) {
  const match = emoji.match(/^<a?:(\w+):(\d+)>$/);
  if (match) return `${match[1]}:${match[2]}`;
  return emoji;
}

module.exports = { buildMatchEmbed, buildResultEmbed, isModerator, parseEmoji };
