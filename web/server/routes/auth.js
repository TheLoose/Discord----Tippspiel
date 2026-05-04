const express = require('express');
const axios   = require('axios');
const router  = express.Router();
require('dotenv').config({ path: '../../.env' });

const DISCORD_API    = 'https://discord.com/api/v10';
const REDIRECT_URI   = process.env.WEB_REDIRECT_URI;  // e.g. http://localhost:3001/auth/callback
const CLIENT_ID      = process.env.CLIENT_ID;
const CLIENT_SECRET  = process.env.DISCORD_CLIENT_SECRET;
const GUILD_ID       = process.env.GUILD_ID;
const MOD_ROLE_ID    = process.env.MOD_ROLE_ID;
const BOT_TOKEN      = process.env.DISCORD_TOKEN;

// Step 1 — redirect user to Discord OAuth2
router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'identify guilds.members.read',
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

    // Fetch their membership in the guild using the bot token (more reliable)
    const memberRes = await axios.get(
      `${DISCORD_API}/guilds/${GUILD_ID}/members/${discordUser.id}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    );
    const member = memberRes.data;
    const isMod  = member.roles.includes(MOD_ROLE_ID);

    // Save to session
    req.session.user = {
      id:       discordUser.id,
      username: discordUser.username,
      avatar:   discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null,
      isMod,
    };

    res.redirect(process.env.WEB_CLIENT_URL ?? 'http://localhost:5173');
  } catch (e) {
    console.error('OAuth2 error:', e.response?.data ?? e.message);
    res.redirect('/auth/login?error=oauth_failed');
  }
});

// Get current session user (called by React on load)
router.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ user: null });
  res.json({ user: req.session.user });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Fetch all text channels for the guild (used by channel pickers)
router.get('/channels', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const channelRes = await axios.get(`${DISCORD_API}/guilds/${GUILD_ID}/channels`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    // Only return text channels (type 0) and sort by name
    const textChannels = channelRes.data
      .filter(c => c.type === 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(textChannels);
  } catch (e) {
    console.error('Failed to fetch channels:', e.message);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Fetch all custom emojis for the guild (used by the emoji picker)
router.get('/emojis', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const emojiRes = await axios.get(`${DISCORD_API}/guilds/${GUILD_ID}/emojis`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    res.json(emojiRes.data);
  } catch (e) {
    console.error('Failed to fetch emojis:', e.message);
    res.status(500).json({ error: 'Failed to fetch emojis' });
  }
});

module.exports = router;