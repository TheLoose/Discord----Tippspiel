const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth, requireMod } = require('../middleware/auth');

const MATCH_SELECT = `
  SELECT m.*,
         l.guild_id,
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
  const guildId = req.session?.activeGuild?.id;
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  try {
    const { league_id, matchday_id, status } = req.query;
    let sql = MATCH_SELECT + ' WHERE l.guild_id = ?';
    const params = [guildId];
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
  const guildId = req.session?.activeGuild?.id;
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  const { league_id, matchday_id, team_a_id, team_b_id, match_date } = req.body;
  if (!league_id || !team_a_id || !team_b_id) {
    return res.status(400).json({ error: 'league_id, team_a_id and team_b_id are required' });
  }
  // Verify league belongs to this guild
  const [league] = await query('SELECT * FROM leagues WHERE id = ? AND guild_id = ?', [league_id, guildId]);
  if (!league) return res.status(404).json({ error: 'League not found' });
  try {
    let initialStatus = 'open';
    let parsedDate = null;

    if (match_date) {
      // The browser sends datetime-local as "2026-05-10T20:00" (no timezone info)
      // We interpret this as Europe/Berlin local time by finding the UTC offset
      // and adjusting accordingly so MySQL stores the correct UTC time
      const tz = process.env.TIMEZONE ?? 'Europe/Berlin';

      // Parse the naive datetime string as if it were UTC first
      const naiveDate = new Date(match_date + ':00Z');

      // Find what UTC offset Europe/Berlin has at that moment
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(naiveDate);
      const get = type => parseInt(parts.find(p => p.type === type).value);
      const localEquiv = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
      const offsetMs = localEquiv - naiveDate;

      // Subtract the offset to get the correct UTC time for storage
      parsedDate = new Date(naiveDate.getTime() - offsetMs);

      const now       = new Date();
      const nowLocal  = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const matchLocal = new Date(parsedDate.toLocaleString('en-US', { timeZone: tz }));

      if (matchLocal.toDateString() !== nowLocal.toDateString() && parsedDate > now) {
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
      // Log immediately before notifying bot (don't wait for bot response)
      await query(
        `INSERT INTO logs (guild_id, type, match_id, details) VALUES (?, 'match_posted', ?, ?)`,
        [guildId, result.insertId, JSON.stringify({
          team_a: match.team_a, team_b: match.team_b,
          match_date: match.match_date,
          posted_by: req.session.user.username
        })]
      ).catch(e => console.warn('Log insert failed:', e.message));

      await notifyBotToPost(result.insertId);
      const [updated] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [result.insertId]);
      return res.json(updated ?? match);
    }

    // Log scheduled matches
    if (initialStatus === 'scheduled' && match) {
      await query(
        `INSERT INTO logs (guild_id, type, match_id, details) VALUES (?, 'match_posted', ?, ?)`,
        [guildId, result.insertId, JSON.stringify({
          team_a: match.team_a, team_b: match.team_b,
          match_date: match.match_date, status: 'scheduled',
          posted_by: req.session.user.username
        })]
      ).catch(e => console.warn('Log insert failed:', e.message));
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
    if (match) {
      await query(
        `INSERT INTO logs (guild_id, type, match_id, details) VALUES (?, 'match_closed', ?, ?)`,
        [match.guild_id, req.params.id, JSON.stringify({
          team_a: match.team_a, team_b: match.team_b,
          reason: 'manual', closed_by: req.session.user.username
        })]
      );
    }
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
        `INSERT INTO points (user_id, guild_id, league_id, username, total, correct, total_votes)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           username = VALUES(username), total = total + VALUES(total),
           correct = correct + VALUES(correct), total_votes = total_votes + 1`,
        [vote.user_id, match.guild_id, match.league_id, vote.username, isCorrect ? 1 : 0, isCorrect ? 1 : 0]
      );
    }

    await query('UPDATE matches SET status = ?, winning_team = ? WHERE id = ?', ['evaluated', winner, req.params.id]);

    // Log evaluation
    await query(
      `INSERT INTO logs (guild_id, type, match_id, details) VALUES (?, 'match_evaluated', ?, ?)`,
      [match.guild_id, req.params.id, JSON.stringify({
        team_a: match.team_a, team_b: match.team_b,
        winning_team: winner,
        winning_name: winner === 'a' ? match.team_a : match.team_b,
        correct, wrong,
        evaluated_by: req.session.user.username
      })]
    );

    const [updated] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [req.params.id]);
    res.json({ match: updated, correct, wrong });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH reevaluate match — switch winner and recalculate points
router.patch('/:id/reevaluate', requireMod, async (req, res) => {
  const { winner } = req.body;
  if (!winner || !['a', 'b'].includes(winner)) {
    return res.status(400).json({ error: 'winner must be "a" or "b"' });
  }
  try {
    const [match] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [req.params.id]);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status !== 'evaluated') return res.status(400).json({ error: 'Match must be evaluated first' });
    if (match.winning_team === winner) return res.status(400).json({ error: 'That team already won' });

    const oldWinner = match.winning_team;
    const votes = await query('SELECT * FROM votes WHERE match_id = ?', [req.params.id]);

    // Reverse old points and award new ones
    for (const vote of votes) {
      const wasCorrect = vote.team === oldWinner;
      const isCorrect  = vote.team === winner;
      if (wasCorrect === isCorrect) continue; // no change for this user

      // Subtract old result, add new result
      const pointDiff  = isCorrect ? 1 : -1;
      const correctDiff = isCorrect ? 1 : -1;
      await query(
        `UPDATE points SET total = total + ?, correct = correct + ?
         WHERE user_id = ? AND league_id = ?`,
        [pointDiff, correctDiff, vote.user_id, match.league_id]
      );
    }

    await query('UPDATE matches SET winning_team = ? WHERE id = ?', [winner, req.params.id]);

    // Log reevaluation
    await query(
      `INSERT INTO logs (guild_id, type, match_id, details) VALUES (?, 'match_reevaluated', ?, ?)`,
      [match.guild_id, req.params.id, JSON.stringify({
        team_a: match.team_a, team_b: match.team_b,
        old_winner: oldWinner, old_winning_name: oldWinner === 'a' ? match.team_a : match.team_b,
        new_winner: winner,    new_winning_name: winner   === 'a' ? match.team_a : match.team_b,
        reevaluated_by: req.session.user.username
      })]
    );

    const [updated] = await query(MATCH_SELECT + ' WHERE m.id = ? GROUP BY m.id', [req.params.id]);
    res.json({ match: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Notify the bot process to post the match to Discord
async function notifyBotToPost(matchId) {
  const secret = process.env.INTERNAL_SECRET;
  const port   = process.env.INTERNAL_PORT ?? 3002;
  const host   = process.env.BOT_INTERNAL_HOST ?? '127.0.0.1';
  try {
    await axios.post(
      `http://${host}:${port}/post-match`,
      { matchId },
      { headers: { 'x-internal-secret': secret } }
    );
  } catch (e) {
    console.warn('Could not notify bot to post match:', e.response?.data ?? e.message);
  }
}


// POST force-post a scheduled match to Discord immediately
router.post('/:id/post', requireMod, async (req, res) => {
  const secret = process.env.INTERNAL_SECRET;
  const port   = process.env.INTERNAL_PORT ?? 3002;
  const host   = process.env.BOT_INTERNAL_HOST ?? '127.0.0.1';
  try {
    const result = await axios.post(
      `http://${host}:${port}/post-match`,
      { matchId: parseInt(req.params.id) },
      { headers: { 'x-internal-secret': secret } }
    );
    res.json(result.data);
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error ?? e.message });
  }
});

module.exports = router;