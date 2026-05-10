const express = require('express');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireMod } = require('../middleware/auth');

const getGuildId = req => req.session?.activeGuild?.id;

// ── Helper: parse CSV text into array of trimmed string arrays ────────────────
function parseCSV(text) {
  return text.trim().split('\n')
    .map(line => line.trim().replace(/^["']|["']$/g, ''))
    .filter(line => line.length > 0)
    .map(line => {
      const sep = line.includes(';') ? ';' : ',';
      return line.split(sep).map(p => p.trim().replace(/^["']|["']$/g, ''));
    });
}

// ── Import Leagues ────────────────────────────────────────────────────────────
router.post('/leagues', requireMod, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  const { csv } = req.body;
  if (!csv?.trim()) return res.status(400).json({ error: 'csv is required' });

  const rows    = parseCSV(csv);
  const results = { created: 0, skipped: 0, errors: [] };

  for (const parts of rows) {
    // Skip header row
    if (parts[0].toLowerCase() === 'name') continue;
    if (parts.length < 2) continue;

    const [name, emoji, channelId] = parts;
    if (!name || !emoji) continue;

    try {
      // Check for duplicate name in this guild
      const existing = await query(
        'SELECT id FROM leagues WHERE guild_id = ? AND name = ?',
        [guildId, name]
      );
      if (existing.length) { results.skipped++; continue; }

      await query(
        'INSERT INTO leagues (guild_id, name, emoji, channel_id) VALUES (?, ?, ?, ?)',
        [guildId, name, emoji, channelId || null]
      );
      results.created++;
    } catch (e) {
      results.errors.push(`"${name}": ${e.message}`);
      results.skipped++;
    }
  }

  res.json(results);
});

// ── Import Teams ──────────────────────────────────────────────────────────────
router.post('/teams', requireMod, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  const { league_id, csv } = req.body;
  if (!csv?.trim()) return res.status(400).json({ error: 'csv is required' });

  const rows    = parseCSV(csv);
  const results = { created: 0, skipped: 0, errors: [] };

  for (const parts of rows) {
    if (parts[0].toLowerCase() === 'name') continue;
    if (parts.length < 3) continue;

    // Format: name;short_name;emoji;league_id(optional)
    const [name, shortName, emoji, csvLeagueId] = parts;
    if (!name || !emoji) continue;

    // Resolve league_id: from CSV column, or from the selected league
    const resolvedLeagueId = csvLeagueId || league_id;
    if (!resolvedLeagueId) {
      results.errors.push(`"${name}": no league_id provided`);
      results.skipped++;
      continue;
    }

    // Verify league belongs to this guild
    const [league] = await query(
      'SELECT id FROM leagues WHERE id = ? AND guild_id = ?',
      [resolvedLeagueId, guildId]
    );
    if (!league) {
      results.errors.push(`"${name}": league ${resolvedLeagueId} not found`);
      results.skipped++;
      continue;
    }

    try {
      const existing = await query(
        'SELECT team_id FROM teams WHERE name = ? AND league_id = ?',
        [name, resolvedLeagueId]
      );
      if (existing.length) { results.skipped++; continue; }

      await query(
        'INSERT INTO teams (name, short_name, emoji, league_id) VALUES (?, ?, ?, ?)',
        [name, shortName?.toUpperCase() || null, emoji, resolvedLeagueId]
      );
      results.created++;
    } catch (e) {
      results.errors.push(`"${name}": ${e.message}`);
      results.skipped++;
    }
  }

  res.json(results);
});

// ── Import Matches ────────────────────────────────────────────────────────────
router.post('/matches', requireMod, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });

  const { league_id, rows } = req.body;
  if (!league_id || !rows?.length) {
    return res.status(400).json({ error: 'league_id and rows are required' });
  }

  const [league] = await query('SELECT * FROM leagues WHERE id = ? AND guild_id = ?', [league_id, guildId]);
  if (!league) return res.status(404).json({ error: 'League not found' });

  const teams = await query('SELECT * FROM teams WHERE league_id = ? AND active = true', [league_id]);

  function findTeam(nameOrAbbr) {
    const n = nameOrAbbr.trim().toLowerCase();
    return (
      teams.find(t => t.short_name?.toLowerCase() === n) ||
      teams.find(t => t.name.toLowerCase() === n) ||
      teams.find(t => t.name.toLowerCase().startsWith(n)) ||
      teams.find(t => t.name.toLowerCase().split(/\s+/).some(w => w.startsWith(n)))
    );
  }

  const results       = { created: 0, skipped: 0, errors: [] };
  const matchdayCache = {};

  for (const row of rows) {
    try {
      const { matchday: matchdayNum, home, away, time } = row;
      const teamA = findTeam(home);
      const teamB = findTeam(away);

      if (!teamA) { results.errors.push(`Team not found: "${home}"`); results.skipped++; continue; }
      if (!teamB) { results.errors.push(`Team not found: "${away}"`); results.skipped++; continue; }

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

      let matchDate = null;
      if (time) {
        const [datePart, timePart] = time.split(' ');
        const [day, month, year]   = datePart.split('-');
        const isoStr = `${year}-${month}-${day}T${timePart}:00`;
        const naive  = new Date(isoStr + 'Z');
        const fmt    = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Europe/Berlin',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const pts    = fmt.formatToParts(naive);
        const get    = t => parseInt(pts.find(p => p.type === t).value);
        const loc    = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
        matchDate = new Date(naive.getTime() - (loc - naive));
      }

      const [dup] = await query(
        'SELECT id FROM matches WHERE league_id = ? AND team_a_id = ? AND team_b_id = ? AND match_date = ?',
        [league_id, teamA.team_id, teamB.team_id, matchDate]
      );
      if (dup) { results.skipped++; continue; }

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