const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const { query } = require('../../../src/db/database');
const { requireAuth } = require('../middleware/auth');

const DISCORD_API        = 'https://discord.com/api/v10';
const BOT_TOKEN          = process.env.DISCORD_TOKEN;
const MANAGE_SERVER_FLAG = 0x20n; // BigInt for bitwise check
const ADMINISTRATOR_FLAG = 0x8n;

const getGuildId = req => req.session?.activeGuild?.id;

// Check if the user has Manage Server or Administrator in the active guild
async function requireGuildAdmin(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  const guildId = getGuildId(req);
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });

  try {
    const memberRes = await axios.get(`${DISCORD_API}/guilds/${guildId}/members/${req.session.user.id}`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });

    // Get the guild roles to check permissions
    const rolesRes = await axios.get(`${DISCORD_API}/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });

    const memberRoleIds = new Set(memberRes.data.roles);
    const guildRoles    = rolesRes.data;

    // Calculate combined permissions from all roles the member has
    let perms = 0n;
    for (const role of guildRoles) {
      if (memberRoleIds.has(role.id) || role.name === '@everyone') {
        perms |= BigInt(role.permissions);
      }
    }

    const isAdmin = (perms & ADMINISTRATOR_FLAG) === ADMINISTRATOR_FLAG;
    const canManage = (perms & MANAGE_SERVER_FLAG) === MANAGE_SERVER_FLAG;

    if (!isAdmin && !canManage) {
      return res.status(403).json({ error: 'You need Manage Server permission to change these settings' });
    }

    next();
  } catch (e) {
    console.error('Permission check failed:', e.message);
    res.status(500).json({ error: 'Failed to verify permissions' });
  }
}

// GET roles for the active guild
router.get('/roles', requireGuildAdmin, async (req, res) => {
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
router.get('/', requireGuildAdmin, async (req, res) => {
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
router.post('/', requireGuildAdmin, async (req, res) => {
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