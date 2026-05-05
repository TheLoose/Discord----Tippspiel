const express = require('express');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth, requireMod } = require('../middleware/auth');

const getGuildId = req => req.session?.activeGuild?.id;

router.get('/', requireAuth, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  try {
    res.json(await query('SELECT * FROM leagues WHERE guild_id = ? ORDER BY name', [guildId]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireMod, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  const { name, emoji, channel_id } = req.body;
  if (!name || !emoji) return res.status(400).json({ error: 'name and emoji are required' });
  try {
    const result = await query(
      'INSERT INTO leagues (guild_id, name, emoji, channel_id) VALUES (?, ?, ?, ?)',
      [guildId, name, emoji, channel_id ?? null]
    );
    const [league] = await query('SELECT * FROM leagues WHERE id = ?', [result.insertId]);
    res.json(league);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', requireMod, async (req, res) => {
  const guildId = getGuildId(req);
  const { name, emoji, channel_id, active } = req.body;
  try {
    await query(
      'UPDATE leagues SET name = COALESCE(?, name), emoji = COALESCE(?, emoji), channel_id = COALESCE(?, channel_id), active = COALESCE(?, active) WHERE id = ? AND guild_id = ?',
      [name ?? null, emoji ?? null, channel_id ?? null, active ?? null, req.params.id, guildId]
    );
    const [league] = await query('SELECT * FROM leagues WHERE id = ?', [req.params.id]);
    res.json(league);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
