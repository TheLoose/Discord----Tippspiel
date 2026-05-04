const cron = require('node-cron');
const { query } = require('../db/database');
const { buildMatchEmbed, parseEmoji } = require('./helpers');
const { EmbedBuilder } = require('discord.js');

/**
 * Posts all matches scheduled for today that haven't been posted yet.
 * Runs at midnight every day (00:00).
 */
async function postTodaysMatches(client) {
  console.log('🕛 Scheduler: checking for matches to post today...');

  const matches = await query(
    `SELECT m.*,
            l.name AS league_name, l.emoji AS league_emoji,
            l.channel_id AS league_channel_id,
            l.id AS league_id,
            t1.name AS team_a, t1.emoji AS team_a_emoji,
            t2.name AS team_b, t2.emoji AS team_b_emoji,
            md.label AS matchday_label, md.channel_id AS matchday_channel_id
     FROM matches m
     JOIN leagues  l  ON m.league_id  = l.id
     JOIN teams    t1 ON m.team_a_id  = t1.team_id
     JOIN teams    t2 ON m.team_b_id  = t2.team_id
     LEFT JOIN matchdays md ON m.matchday_id = md.id
     WHERE DATE(m.match_date) = CURDATE()
       AND m.status = 'scheduled'
       AND m.discord_message_id IS NULL
     ORDER BY m.match_date ASC`
  );

  if (!matches.length) {
    console.log('🕛 Scheduler: no matches to post today.');
    return;
  }

  console.log(`🕛 Scheduler: posting ${matches.length} match(es) for today.`);

  for (const match of matches) {
    try {
      const channelId = match.matchday_channel_id ?? match.league_channel_id;
      if (!channelId) {
        console.warn(`⚠️  Match ${match.id} has no channel set — skipping.`);
        continue;
      }

      const league = {
        id:       match.league_id,
        name:     match.league_name,
        emoji:    match.league_emoji,
        matchday: match.matchday_label ? { label: match.matchday_label } : null
      };

      const matchForEmbed = {
        id:           match.id,
        team_a:       match.team_a,
        team_a_emoji: match.team_a_emoji,
        team_b:       match.team_b,
        team_b_emoji: match.team_b_emoji,
        match_date:   match.match_date
      };

      const channel = await client.channels.fetch(channelId);
      const embed   = buildMatchEmbed(matchForEmbed, league);
      const msg     = await channel.send({ embeds: [embed] });

      await msg.react(parseEmoji(match.team_a_emoji));
      await msg.react(parseEmoji(match.team_b_emoji));

      await query(
        `UPDATE matches
         SET discord_message_id = ?, discord_channel_id = ?, status = 'open'
         WHERE id = ?`,
        [msg.id, channel.id, match.id]
      );

      console.log(`✅ Posted match ${match.id}: ${match.team_a} vs ${match.team_b}`);
    } catch (e) {
      console.error(`❌ Failed to post match ${match.id}:`, e.message);
    }
  }
}

/**
 * Closes any open matches whose kickoff time has passed.
 * Runs every minute.
 */
async function closeExpiredMatches(client) {
  const matches = await query(
    `SELECT m.*,
            t1.name AS team_a, t1.emoji AS team_a_emoji,
            t2.name AS team_b, t2.emoji AS team_b_emoji
     FROM matches m
     JOIN teams t1 ON m.team_a_id = t1.team_id
     JOIN teams t2 ON m.team_b_id = t2.team_id
     WHERE m.status = 'open'
       AND m.match_date IS NOT NULL
       AND m.match_date <= NOW()`
  );

  for (const match of matches) {
    try {
      await query('UPDATE matches SET status = ? WHERE id = ?', ['closed', match.id]);

      // Update the Discord embed footer to show voting is closed
      if (match.discord_message_id && match.discord_channel_id) {
        try {
          const channel = await client.channels.fetch(match.discord_channel_id);
          const msg     = await channel.messages.fetch(match.discord_message_id);
          const updated = EmbedBuilder.from(msg.embeds[0])
            .setFooter({ text: `Match ID: ${match.id} • 🔒 Voting closed — match has started!` });
          await msg.edit({ embeds: [updated] });
        } catch (e) {
          console.warn(`Could not update embed for match ${match.id}:`, e.message);
        }
      }

      console.log(`🔒 Auto-closed match ${match.id}: ${match.team_a} vs ${match.team_b}`);
    } catch (e) {
      console.error(`❌ Failed to close match ${match.id}:`, e.message);
    }
  }
}

/**
 * Registers all cron jobs. Call this once after the bot is ready.
 */
function startScheduler(client) {
  // Post today's matches at midnight every day
  // Cron format: second(optional) minute hour day month weekday
  cron.schedule('0 0 * * *', () => postTodaysMatches(client), {
    timezone: process.env.TIMEZONE ?? 'Europe/Berlin'
  });

  // Check for matches to auto-close every minute
  cron.schedule('*/5 * * * *', () => closeExpiredMatches(client), {
    timezone: process.env.TIMEZONE ?? 'Europe/Berlin'
  });

  console.log(`⏰ Scheduler started (timezone: ${process.env.TIMEZONE ?? 'Europe/Berlin'})`);
}

module.exports = { startScheduler, postTodaysMatches, closeExpiredMatches };
