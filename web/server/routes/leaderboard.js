const express = require('express');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth } = require('../middleware/auth');

// GET leaderboard for a league
router.get('/:league_id', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.*, l.name AS league_name, l.emoji AS league_emoji
       FROM points p
       JOIN leagues l ON p.league_id = l.id
       WHERE p.league_id = ?
       ORDER BY p.total DESC, p.correct DESC
       LIMIT 50`,
      [req.params.league_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
