const express = require('express');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth } = require('../middleware/auth');

const getGuildId = req => req.session?.activeGuild?.id;

// GET logs for active guild
router.get('/', requireAuth, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  try {
    const { type, limit } = req.query;
    const limitNum = Math.min(parseInt(limit) || 100, 500);
    let sql = `
      SELECT l.*,
             t1.name AS team_a, t1.emoji AS team_a_emoji,
             t2.name AS team_b, t2.emoji AS team_b_emoji,
             lg.name AS league_name, lg.emoji AS league_emoji
      FROM logs l
      JOIN matches m  ON l.match_id = m.id
      JOIN teams t1   ON m.team_a_id = t1.team_id
      JOIN teams t2   ON m.team_b_id = t2.team_id
      JOIN leagues lg ON m.league_id = lg.id
      WHERE l.guild_id = ?
    `;
    const params = [guildId];
    if (type) { sql += ' AND l.type = ?'; params.push(type); }
    sql += ` ORDER BY l.created_at DESC LIMIT ${limitNum}`;
    const rows = await query(sql, params);
    // Safely parse JSON details field
    res.json(rows.map(r => {
      let details = r.details;
      if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch { details = {}; }
      }
      return { ...r, details: details ?? {} };
    }));
  } catch (e) {
    console.error('Logs query error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;