const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth, requireMod } = require('../middleware/auth');

const getGuildId = req => req.session?.activeGuild?.id;

// GET matchdays scoped to guild via league join
router.get('/', requireAuth, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  try {
    const { league_id } = req.query;
    let sql = `
      SELECT md.*, l.name AS league_name, l.emoji AS league_emoji,
             COUNT(m.id) AS match_count,
             SUM(CASE WHEN m.status = 'evaluated' THEN 1 ELSE 0 END) AS evaluated_count
      FROM matchdays md
      JOIN leagues l ON md.league_id = l.id
      LEFT JOIN matches m ON m.matchday_id = md.id
      WHERE l.guild_id = ?
    `;
    const params = [guildId];
    if (league_id) { sql += ' AND md.league_id = ?'; params.push(league_id); }
    sql += ' GROUP BY md.id ORDER BY l.name, md.number';
    res.json(await query(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create matchday — verify league belongs to guild
router.post('/', requireMod, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  const { league_id, number, label, channel_id } = req.body;
  if (!league_id || !number) return res.status(400).json({ error: 'league_id and number are required' });
  try {
    const [league] = await query('SELECT * FROM leagues WHERE id = ? AND guild_id = ?', [league_id, guildId]);
    if (!league) return res.status(404).json({ error: 'League not found' });
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST post all scheduled matches in a matchday to Discord immediately
router.post('/:id/post', requireMod, async (req, res) => {
  const secret = process.env.INTERNAL_SECRET;
  const port   = process.env.INTERNAL_PORT ?? 3002;
  const host   = process.env.BOT_INTERNAL_HOST ?? '127.0.0.1';
  try {
    const result = await axios.post(
      `http://${host}:${port}/post-matchday`,
      { matchdayId: parseInt(req.params.id) },
      { headers: { 'x-internal-secret': secret }, timeout: 30000 }
    );
    res.json(result.data);
  } catch (e) {
    const msg = e.response?.data?.error ?? e.message;
    console.error('post-matchday error:', msg);
    res.status(500).json({ error: msg });
  }
});

module.exports = router;