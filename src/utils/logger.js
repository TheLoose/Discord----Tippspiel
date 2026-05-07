const { query } = require('../db/database');

async function log(type, guildId, matchId, details = {}) {
  try {
    await query(
      'INSERT INTO logs (guild_id, type, match_id, details) VALUES (?, ?, ?, ?)',
      [guildId, type, matchId, JSON.stringify(details)]
    );
  } catch (e) {
    console.error('Failed to write log:', e.message);
  }
}

module.exports = { log };
