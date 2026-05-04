const http = require('http');
const { query } = require('../db/database');
const { buildMatchEmbed, parseEmoji } = require('./helpers');

/**
 * Starts a lightweight internal HTTP server that only listens on localhost.
 * The web dashboard calls this to trigger Discord actions from the bot process.
 */
function startInternalServer(client) {
  const PORT = process.env.INTERNAL_PORT ?? 3002;

  const server = http.createServer(async (req, res) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.writeHead(405); res.end('Method Not Allowed'); return;
    }

    // Simple auth check — shared secret between bot and web server
    const secret = req.headers['x-internal-secret'];
    if (secret !== process.env.INTERNAL_SECRET) {
      res.writeHead(401); res.end('Unauthorized'); return;
    }

    // Parse JSON body
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        // ── POST MATCH ──────────────────────────────────────────────────────
        if (req.url === '/post-match') {
          const { matchId } = data;

          const [match] = await query(
            `SELECT m.*,
                    l.name AS league_name, l.emoji AS league_emoji, l.id AS league_id,
                    l.channel_id AS league_channel_id,
                    t1.name AS team_a, t1.emoji AS team_a_emoji,
                    t2.name AS team_b, t2.emoji AS team_b_emoji,
                    md.label AS matchday_label, md.channel_id AS matchday_channel_id
             FROM matches m
             JOIN leagues  l  ON m.league_id  = l.id
             JOIN teams    t1 ON m.team_a_id  = t1.team_id
             JOIN teams    t2 ON m.team_b_id  = t2.team_id
             LEFT JOIN matchdays md ON m.matchday_id = md.id
             WHERE m.id = ?`,
            [matchId]
          );

          if (!match) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Match not found' }));
            return;
          }

          if (match.discord_message_id) {
            res.writeHead(409);
            res.end(JSON.stringify({ error: 'Match already posted' }));
            return;
          }

          const channelId = match.matchday_channel_id ?? match.league_channel_id;
          if (!channelId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No channel set on matchday or league' }));
            return;
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
            'UPDATE matches SET discord_message_id = ?, discord_channel_id = ?, status = ? WHERE id = ?',
            [msg.id, channel.id, 'open', match.id]
          );

          console.log(`📢 Internal: posted match ${match.id} to Discord`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, messageId: msg.id }));
          return;
        }

        res.writeHead(404); res.end('Not Found');
      } catch (e) {
        console.error('Internal server error:', e);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`🔒 Internal bot server listening on 127.0.0.1:${PORT}`);
  });
}

module.exports = { startInternalServer };