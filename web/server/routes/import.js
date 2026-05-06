const express = require('express');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireMod } = require('../middleware/auth');

const getGuildId = req => req.session?.activeGuild?.id;

/**
 * POST /api/import/matches
 * Body: { league_id, rows: [{ matchday, home, away, time }] }
 *
 * For each row:
 * 1. Find or create the matchday
 * 2. Find team by name (case-insensitive, also checks abbreviation-style short names)
 * 3. Insert the match as 'scheduled'
 */
router.post('/matches', requireMod, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });

  const { league_id, rows } = req.body;
  if (!league_id || !rows?.length) {
    return res.status(400).json({ error: 'league_id and rows are required' });
  }

  // Verify league belongs to this guild
  const [league] = await query('SELECT * FROM leagues WHERE id = ? AND guild_id = ?', [league_id, guildId]);
  if (!league) return res.status(404).json({ error: 'League not found' });

  // Load all teams for this league
  const teams = await query('SELECT * FROM teams WHERE league_id = ? AND active = true', [league_id]);

  // Helper: find team by short_name first, then fall back to name matching
  function findTeam(nameOrAbbr) {
    const n = nameOrAbbr.trim().toLowerCase();
    return (
      // 1. Exact short_name match (e.g. "GER" → short_name = "GER")
      teams.find(t => t.short_name?.toLowerCase() === n) ||
      // 2. Exact full name match
      teams.find(t => t.name.toLowerCase() === n) ||
      // 3. Full name starts with abbreviation
      teams.find(t => t.name.toLowerCase().startsWith(n)) ||
      // 4. Any word in the name starts with the abbreviation
      teams.find(t => t.name.toLowerCase().split(/\s+/).some(w => w.startsWith(n)))
    );
  }

  const results   = { created: 0, skipped: 0, errors: [] };
  const matchdayCache = {}; // { number: id }

  for (const row of rows) {
    try {
      const { matchday: matchdayNum, home, away, time } = row;

      // Find teams
      const teamA = findTeam(home);
      const teamB = findTeam(away);

      if (!teamA) { results.errors.push(`Team not found: "${home}"`); results.skipped++; continue; }
      if (!teamB) { results.errors.push(`Team not found: "${away}"`); results.skipped++; continue; }

      // Find or create matchday
      if (!matchdayCache[matchdayNum]) {
        const [existing] = await query(
          'SELECT * FROM matchdays WHERE league_id = ? AND number = ?',
          [league_id, matchdayNum]
        );
        if (existing) {
          matchdayCache[matchdayNum] = existing.id;
        } else {
          const result = await query(
            'INSERT INTO matchdays (league_id, number, label, channel_id) VALUES (?, ?, ?, ?)',
            [league_id, matchdayNum, `Matchday ${matchdayNum}`, league.channel_id]
          );
          matchdayCache[matchdayNum] = result.insertId;
        }
      }

      // Parse date — format: "15-05-2026 16:20" → convert to UTC from Europe/Berlin
      let matchDate = null;
      if (time) {
        const [datePart, timePart] = time.split(' ');
        const [day, month, year]   = datePart.split('-');
        const isoStr = `${year}-${month}-${day}T${timePart}:00`;
        // Treat as Europe/Berlin time
        const naive = new Date(isoStr + 'Z');
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Europe/Berlin',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const parts    = formatter.formatToParts(naive);
        const get      = type => parseInt(parts.find(p => p.type === type).value);
        const localEquiv = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
        const offsetMs   = localEquiv - naive;
        matchDate = new Date(naive.getTime() - offsetMs);
      }

      // Check for duplicate
      const [duplicate] = await query(
        'SELECT id FROM matches WHERE league_id = ? AND team_a_id = ? AND team_b_id = ? AND match_date = ?',
        [league_id, teamA.team_id, teamB.team_id, matchDate]
      );
      if (duplicate) { results.skipped++; continue; }

      await query(
        `INSERT INTO matches (league_id, matchday_id, team_a_id, team_b_id, match_date, status)
         VALUES (?, ?, ?, ?, ?, 'scheduled')`,
        [league_id, matchdayCache[matchdayNum], teamA.team_id, teamB.team_id, matchDate]
      );
      results.created++;

    } catch (e) {
      results.errors.push(`Row error: ${e.message}`);
      results.skipped++;
    }
  }

  res.json(results);
});

module.exports = router;
