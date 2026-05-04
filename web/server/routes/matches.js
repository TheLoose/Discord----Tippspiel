const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth, requireMod } = require('../middleware/auth');

const MATCH_SELECT = `
  SELECT m.*,
         l.name AS league_name, l.emoji AS league_emoji,
         md.label AS matchday_label,
         t1.name AS team_a, t1.emoji AS team_a_emoji,
         t2.name AS team_b, t2.emoji AS team_b_emoji,
         COUNT(v.id) AS total_votes,
         SUM(CASE WHEN v.team = 'a' THEN 1 ELSE 0 END) AS votes_a,
         SUM(CASE WHEN v.team = 'b' THEN 1 ELSE 0 END) AS votes_b
  FROM matches m
  JOIN leagues  l  ON m.league_id  = l.id
  JOIN teams    t1 ON m.team_a_id  = t1.team_id
  JOIN teams    t2 ON m.team_b_id  = t2.team_id
  LEFT JOIN matchdays md ON m.matchday_id = md.id
  LEFT JOIN votes v ON v.match_id = m.id
`;

// GET all matches with optional filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const { league_id, matchday_id, status } = req.query;
    let sql = MATCH_SELECT + ' WHERE 1=1';
    const params = [];
    if (league_id)   { sql += ' AND m.league_id = ?';   params.push(league_id); }
    if (matchday_id) { sql += ' AND m.matchday_id = ?'; params.push(matchday_id); }
    if (status)      { sql += ' AND m.status = ?';      params.push(status); }
    sql += ' GROUP BY m.id ORDER BY m.match_date DESC';
    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single match
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [match] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [req.params.id]);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create match
router.post('/', requireMod, async (req, res) => {
  const { league_id, matchday_id, team_a_id, team_b_id, match_date } = req.body;
  if (!league_id || !team_a_id || !team_b_id) {
    return res.status(400).json({ error: 'league_id, team_a_id and team_b_id are required' });
  }
  try {
    const tz = process.env.TIMEZONE ?? 'Europe/Berlin';
    let initialStatus = 'open';
    let parsedDate = null;

    if (match_date) {
      parsedDate = new Date(match_date);
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
      const matchLocal = new Date(parsedDate.toLocaleString('en-US', { timeZone: tz }));
      if (matchLocal.toDateString() !== now.toDateString() && parsedDate > now) {
        initialStatus = 'scheduled';
      }
    }

    const result = await query(
      'INSERT INTO matches (league_id, matchday_id, team_a_id, team_b_id, match_date, status) VALUES (?, ?, ?, ?, ?, ?)',
      [league_id, matchday_id ?? null, team_a_id, team_b_id, parsedDate, initialStatus]
    );
    const [match] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [result.insertId]);

    // If match is open (today or no date), tell the bot to post it to Discord now
    if (initialStatus === 'open') {
      await notifyBotToPost(result.insertId);
      // Re-fetch to get the updated discord_message_id
      const [updated] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [result.insertId]);
      return res.json(updated);
    }

    res.json(match);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH close match
router.patch('/:id/close', requireMod, async (req, res) => {
  try {
    await query(`UPDATE matches SET status = 'closed' WHERE id = ? AND status = 'open'`, [req.params.id]);
    const [match] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [req.params.id]);
    res.json(match);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH evaluate match — set winner + award points
router.patch('/:id/evaluate', requireMod, async (req, res) => {
  const { winner } = req.body; // 'a' or 'b'
  if (!winner || !['a', 'b'].includes(winner)) {
    return res.status(400).json({ error: 'winner must be "a" or "b"' });
  }
  try {
    const [match] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [req.params.id]);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status !== 'closed') return res.status(400).json({ error: 'Match must be closed before evaluating' });

    const votes = await query('SELECT * FROM votes WHERE match_id = ?', [req.params.id]);
    let correct = 0, wrong = 0;

    for (const vote of votes) {
      const isCorrect = vote.team === winner;
      if (isCorrect) correct++; else wrong++;
      await query(
        `INSERT INTO points (user_id, league_id, username, total, correct, total_votes)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           username = VALUES(username), total = total + VALUES(total),
           correct = correct + VALUES(correct), total_votes = total_votes + 1`,
        [vote.user_id, match.league_id, vote.username, isCorrect ? 1 : 0, isCorrect ? 1 : 0]
      );
    }

    await query('UPDATE matches SET status = ?, winning_team = ? WHERE id = ?', ['evaluated', winner, req.params.id]);
    const [updated] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [req.params.id]);
    res.json({ match: updated, correct, wrong });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Notify the bot process to post the match to Discord
async function notifyBotToPost(matchId) {
  const secret = process.env.INTERNAL_SECRET;
  const port   = process.env.INTERNAL_PORT ?? 3002;
  try {
    await axios.post(
      `http://127.0.0.1:${port}/post-match`,
      { matchId },
      { headers: { 'x-internal-secret': secret } }
    );
  } catch (e) {
    console.warn('Could not notify bot to post match:', e.response?.data ?? e.message);
  }
}

module.exports = router;