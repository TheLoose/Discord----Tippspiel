const express = require('express');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth, requireMod } = require('../middleware/auth');

// GET all leagues
router.get('/', requireAuth, async (req, res) => {
  try {
    const leagues = await query('SELECT * FROM leagues ORDER BY name');
    res.json(leagues);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create league
router.post('/', requireMod, async (req, res) => {
  const { name, emoji, channel_id } = req.body;
  if (!name || !emoji) return res.status(400).json({ error: 'name and emoji are required' });
  try {
    const result = await query(
      'INSERT INTO leagues (name, emoji, channel_id) VALUES (?, ?, ?)',
      [name, emoji, channel_id ?? null]
    );
    const [league] = await query('SELECT * FROM leagues WHERE id = ?', [result.insertId]);
    res.json(league);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH update league
router.patch('/:id', requireMod, async (req, res) => {
  const { name, emoji, channel_id, active } = req.body;
  try {
    await query(
      'UPDATE leagues SET name = COALESCE(?, name), emoji = COALESCE(?, emoji), channel_id = COALESCE(?, channel_id), active = COALESCE(?, active) WHERE id = ?',
      [name ?? null, emoji ?? null, channel_id ?? null, active ?? null, req.params.id]
    );
    const [league] = await query('SELECT * FROM leagues WHERE id = ?', [req.params.id]);
    res.json(league);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
