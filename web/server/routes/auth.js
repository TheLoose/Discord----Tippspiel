const express = require('express');
const axios   = require('axios');
const router  = express.Router();
require('dotenv').config();

const DISCORD_API   = 'https://discord.com/api/v10';
const REDIRECT_URI  = process.env.WEB_REDIRECT_URI;
const CLIENT_ID     = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const MOD_ROLE_ID   = process.env.MOD_ROLE_ID;
const BOT_TOKEN     = process.env.DISCORD_TOKEN;

// Step 1 — redirect user to Discord OAuth2
router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'identify guilds guilds.members.read',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// Step 2 — Discord redirects back here with a code
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login?error=no_code');

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      `${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenRes.data;

    // Fetch the user's profile
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const discordUser = userRes.data;

    // Get all guilds bot is in to find a default guild and check mod role
    const botGuildsRes = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const botGuilds = botGuildsRes.data;

    // Check mod role in first shared guild (can be refined later)
    let isMod = false;
    if (botGuilds.length > 0) {
      try {
        const memberRes = await axios.get(
          `${DISCORD_API}/guilds/${botGuilds[0].id}/members/${discordUser.id}`,
          { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
        );
        isMod = memberRes.data.roles.includes(MOD_ROLE_ID);
      } catch {}
    }

    req.session.user = {
      id:          discordUser.id,
      username:    discordUser.username,
      avatar:      discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null,
      isMod,
      accessToken: access_token,
    };

    res.redirect(process.env.WEB_CLIENT_URL ?? 'http://localhost:5173');
  } catch (e) {
    console.error('OAuth2 error:', e.response?.data ?? e.message);
    res.redirect('/auth/login?error=oauth_failed');
  }
});

// Get current session user
router.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ user: null });
  res.json({ user: req.session.user });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Fetch guilds the user shares with the bot
router.get('/guilds', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    // Get all guilds the bot is in
    const botGuildsRes = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const botGuilds   = botGuildsRes.data;
    const botGuildIds = new Set(botGuilds.map(g => g.id));

    // Get guilds the user is in
    const userGuildsRes = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${req.session.user.accessToken}` }
    });

    // Return only guilds where bot is also present
    const shared = userGuildsRes.data.filter(g => botGuildIds.has(g.id));
    res.json(shared);
  } catch (e) {
    console.error('Failed to fetch guilds:', e.response?.data ?? e.message);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

// Set active guild for this session
router.post('/guild', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  const { guild_id, guild_name, guild_icon } = req.body;
  if (!guild_id) return res.status(400).json({ error: 'guild_id required' });
  req.session.activeGuild = { id: guild_id, name: guild_name, icon: guild_icon };

  // Also update isMod for the selected guild
  const BOT_TOKEN_LOCAL = BOT_TOKEN;
  axios.get(`${DISCORD_API}/guilds/${guild_id}/members/${req.session.user.id}`, {
    headers: { Authorization: `Bot ${BOT_TOKEN_LOCAL}` }
  }).then(r => {
    req.session.user.isMod = r.data.roles.includes(MOD_ROLE_ID);
  }).catch(() => {});

  res.json({ ok: true });
});

// Get active guild
router.get('/guild', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ guild: req.session.activeGuild ?? null });
});

// Fetch text channels for the active guild
router.get('/channels', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  const guildId = req.session.activeGuild?.id;
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  try {
    const channelRes = await axios.get(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const textChannels = channelRes.data
      .filter(c => c.type === 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(textChannels);
  } catch (e) {
    console.error('Failed to fetch channels:', e.message);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Fetch custom emojis for the active guild
router.get('/emojis', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  const guildId = req.session.activeGuild?.id;
  if (!guildId) return res.status(400).json({ error: 'No active guild selected' });
  try {
    const emojiRes = await axios.get(`${DISCORD_API}/guilds/${guildId}/emojis`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    res.json(emojiRes.data);
  } catch (e) {
    console.error('Failed to fetch emojis:', e.message);
    res.status(500).json({ error: 'Failed to fetch emojis' });
  }
});

module.exports = router;