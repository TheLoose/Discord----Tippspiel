const { EmbedBuilder } = require('discord.js');

// Colours per league index (cycles if more than 4 leagues)
const LEAGUE_COLORS = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12];

/**
 * Build the embed posted to Discord for a match.
 */
function buildMatchEmbed(match, league) {
  const color = LEAGUE_COLORS[(league.id - 1) % LEAGUE_COLORS.length];

  const matchdayLabel = league.matchday ? ` — ${league.matchday.label}` : '';
  const tz = process.env.TIMEZONE ?? 'Europe/Berlin';
  const dateDisplay = match.match_date
    ? new Date(match.match_date).toLocaleString('de-DE', {
        timeZone: tz,
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : null;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${league.emoji ?? '🏆'} ${league.name}${matchdayLabel} — Match Prediction`)
    .setDescription(
      `## ${match.team_a_emoji} ${match.team_a}  vs  ${match.team_b} ${match.team_b_emoji}\n\n` +
      `React with ${match.team_a_emoji} to vote for **${match.team_a}**\n` +
      `React with ${match.team_b_emoji} to vote for **${match.team_b}**` +
      (dateDisplay ? `\n\n🕐 **Kickoff: ${dateDisplay}**` : '')
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
/**
 * Check whether a member has the moderator role.
 * Checks guild_settings table first, falls back to MOD_ROLE_ID env var.
 */
async function isModerator(member) {
  const { query } = require('../db/database');
  try {
    const [settings] = await query(
      'SELECT mod_role_id FROM guild_settings WHERE guild_id = ?',
      [member.guild.id]
    );
    const roleId = settings?.mod_role_id ?? process.env.MOD_ROLE_ID;
    if (!roleId) return false;
    return member.roles.cache.has(roleId);
  } catch {
    return member.roles.cache.has(process.env.MOD_ROLE_ID ?? '');
  }
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