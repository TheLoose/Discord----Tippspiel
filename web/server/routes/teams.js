const express = require('express');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth, requireMod } = require('../middleware/auth');

// GET all teams, optionally filtered by league
router.get('/', requireAuth, async (req, res) => {
  try {
    const { league_id } = req.query;
    let sql = 'SELECT t.*, l.name AS league_name, l.emoji AS league_emoji FROM teams t JOIN leagues l ON t.league_id = l.id';
    const params = [];
    if (league_id) { sql += ' WHERE t.league_id = ?'; params.push(league_id); }
    sql += ' ORDER BY l.name, t.name';
    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create team
router.post('/', requireMod, async (req, res) => {
  const { name, emoji, league_id } = req.body;
  if (!name || !emoji || !league_id) return res.status(400).json({ error: 'name, emoji and league_id are required' });
  try {
    const result = await query(
      'INSERT INTO teams (name, emoji, league_id) VALUES (?, ?, ?)',
      [name, emoji, league_id]
    );
    const [team] = await query('SELECT * FROM teams WHERE team_id = ?', [result.insertId]);
    res.json(team);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Team already exists in this league' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH move team to another league
router.patch('/:id/move', requireMod, async (req, res) => {
  const { league_id } = req.body;
  if (!league_id) return res.status(400).json({ error: 'league_id is required' });
  try {
    await query('UPDATE teams SET league_id = ? WHERE team_id = ?', [league_id, req.params.id]);
    const [team] = await query('SELECT * FROM teams WHERE team_id = ?', [req.params.id]);
    res.json(team);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH deactivate/reactivate team
router.patch('/:id', requireMod, async (req, res) => {
  const { active, emoji } = req.body;
  try {
    await query(
      'UPDATE teams SET active = COALESCE(?, active), emoji = COALESCE(?, emoji) WHERE team_id = ?',
      [active ?? null, emoji ?? null, req.params.id]
    );
    const [team] = await query('SELECT * FROM teams WHERE team_id = ?', [req.params.id]);
    res.json(team);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
