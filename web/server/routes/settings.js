const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth, requireMod } = require('../middleware/auth');

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN   = process.env.DISCORD_TOKEN;

const getGuildId = req => req.session?.activeGuild?.id;

// GET roles for the active guild
router.get('/roles', requireAuth, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  try {
    const rolesRes = await axios.get(`${DISCORD_API}/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const roles = rolesRes.data
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position);
    res.json(roles);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// GET current guild settings
router.get('/', requireAuth, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  try {
    const [settings] = await query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
    res.json(settings ?? { guild_id: guildId, mod_role_id: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST save guild settings
router.post('/', requireAuth, async (req, res) => {
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  const { mod_role_id } = req.body;
  try {
    await query(
      `INSERT INTO guild_settings (guild_id, mod_role_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE mod_role_id = VALUES(mod_role_id)`,
      [guildId, mod_role_id ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
