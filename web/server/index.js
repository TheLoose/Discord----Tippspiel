require('dotenv').config({ path: '../../.env' });
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');
const { initDB } = require('../../src/db/database');

const app        = express();
const PORT       = process.env.WEB_PORT ?? 3001;
const isProd     = process.env.NODE_ENV === 'production';

// Required for Railway/any reverse proxy — allows secure cookies over HTTPS
if (isProd) app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      isProd ? process.env.WEB_CLIENT_URL : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret:            process.env.SESSION_SECRET ?? 'change-this-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProd,   // true in production (HTTPS), false locally
    httpOnly: true,
    maxAge:   1000 * 60 * 60 * 24 * 7  // 7 days
  }
}));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/auth',            require('./routes/auth'));
app.use('/api/leagues',     require('./routes/leagues'));
app.use('/api/teams',       require('./routes/teams'));
app.use('/api/matchdays',   require('./routes/matchdays'));
app.use('/api/matches',     require('./routes/matches'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

app.get('/health', (_, res) => res.json({ ok: true }));

// ── Serve React app in production ─────────────────────────────────────────────
if (isProd) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  // Any route not matched by API returns the React app
  app.get('*', (_, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  await initDB();
  app.listen(PORT, () => console.log(`🌐 Web server running on http://localhost:${PORT}`));
})();