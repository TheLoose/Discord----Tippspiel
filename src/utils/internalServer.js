const http = require('http');
const { query } = require('../db/database');
const { postMatch } = require('./scheduler');

const MATCH_WITH_TEAMS = `
  SELECT m.*,
         l.name AS league_name, l.emoji AS league_emoji,
         l.channel_id AS league_channel_id, l.id AS league_id,
         t1.name AS team_a, t1.emoji AS team_a_emoji,
         t2.name AS team_b, t2.emoji AS team_b_emoji,
         md.label AS matchday_label, md.channel_id AS matchday_channel_id
  FROM matches m
  JOIN leagues  l  ON m.league_id  = l.id
  JOIN teams    t1 ON m.team_a_id  = t1.team_id
  JOIN teams    t2 ON m.team_b_id  = t2.team_id
  LEFT JOIN matchdays md ON m.matchday_id = md.id
`;

function startInternalServer(client) {
  const PORT = process.env.INTERNAL_PORT ?? 3002;

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }

    const secret = req.headers['x-internal-secret'];
    if (secret !== process.env.INTERNAL_SECRET) { res.writeHead(401); res.end('Unauthorized'); return; }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json');
      try {
        const data = JSON.parse(body);

        // ── POST SINGLE MATCH ───────────────────────────────────────────────
        if (req.url === '/post-match') {
          const { matchId } = data;
          const [match] = await query(MATCH_WITH_TEAMS + ' WHERE m.id = ?', [matchId]);

          if (!match) { res.writeHead(404); res.end(JSON.stringify({ error: 'Match not found' })); return; }
          if (match.discord_message_id) { res.writeHead(409); res.end(JSON.stringify({ error: 'Already posted' })); return; }

          const msgId = await postMatch(client, match);
          res.writeHead(200); res.end(JSON.stringify({ ok: true, messageId: msgId }));
          return;
        }

        // ── POST ALL MATCHES IN A MATCHDAY ──────────────────────────────────
        if (req.url === '/post-matchday') {
          const { matchdayId } = data;
          const matches = await query(
            MATCH_WITH_TEAMS + ` WHERE m.matchday_id = ? AND m.status = 'scheduled' AND m.discord_message_id IS NULL ORDER BY m.match_date`,
            [matchdayId]
          );

          if (!matches.length) {
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, posted: 0, message: 'No scheduled matches to post' }));
            return;
          }

          let posted = 0;
          const errors = [];
          for (const match of matches) {
            try {
              await postMatch(client, match);
              posted++;
            } catch (e) {
              errors.push(`Match ${match.id}: ${e.message}`);
            }
          }

          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, posted, errors }));
          return;
        }

        res.writeHead(404); res.end('Not Found');
      } catch (e) {
        console.error('Internal server error:', e);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`🔒 Internal bot server listening on port ${PORT}`);
  });
}

module.exports = { startInternalServer };
