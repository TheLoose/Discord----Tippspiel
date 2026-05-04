const express = require('express');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth, requireMod } = require('../middleware/auth');

// GET matchdays, optionally filtered by league
router.get('/', requireAuth, async (req, res) => {
  try {
    const { league_id } = req.query;
    let sql = `
      SELECT md.*, l.name AS league_name, l.emoji AS league_emoji,
             COUNT(m.id) AS match_count,
             SUM(CASE WHEN m.status = 'evaluated' THEN 1 ELSE 0 END) AS evaluated_count
      FROM matchdays md
      JOIN leagues l ON md.league_id = l.id
      LEFT JOIN matches m ON m.matchday_id = md.id
    `;
    const params = [];
    if (league_id) { sql += ' WHERE md.league_id = ?'; params.push(league_id); }
    sql += ' GROUP BY md.id ORDER BY l.name, md.number';
    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create matchday
router.post('/', requireMod, async (req, res) => {
  const { league_id, number, label, channel_id } = req.body;
  if (!league_id || !number) return res.status(400).json({ error: 'league_id and number are required' });
  try {
    const resolvedLabel = label ?? `Matchday ${number}`;
    const result = await query(
      'INSERT INTO matchdays (league_id, number, label, channel_id) VALUES (?, ?, ?, ?)',
      [league_id, number, resolvedLabel, channel_id ?? null]
    );
    const [matchday] = await query('SELECT * FROM matchdays WHERE id = ?', [result.insertId]);
    res.json(matchday);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Matchday number already exists for this league' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH close matchday
router.patch('/:id/close', requireMod, async (req, res) => {
  try {
    await query(`UPDATE matches SET status = 'closed' WHERE matchday_id = ? AND status = 'open'`, [req.params.id]);
    await query(`UPDATE matchdays SET status = 'closed' WHERE id = ?`, [req.params.id]);
    const [matchday] = await query('SELECT * FROM matchdays WHERE id = ?', [req.params.id]);
    res.json(matchday);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
