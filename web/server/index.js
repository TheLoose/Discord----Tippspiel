require('dotenv').config({ path: '../../.env' });
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const { initDB } = require('../../src/db/database');

const app  = express();
const PORT = process.env.WEB_PORT ?? 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.WEB_CLIENT_URL ?? 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret:            process.env.SESSION_SECRET ?? 'change-this-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   false,        // set to true in production with HTTPS
    httpOnly: true,
    maxAge:   1000 * 60 * 60 * 24 * 7  // 7 days
  }
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth',        require('./routes/auth'));
app.use('/api/leagues',     require('./routes/leagues'));
app.use('/api/teams',       require('./routes/teams'));
app.use('/api/matchdays',   require('./routes/matchdays'));
app.use('/api/matches',     require('./routes/matches'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));

app.get('/health', (_, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  await initDB();
  app.listen(PORT, () => console.log(`🌐 Web server running on http://localhost:${PORT}`));
})();
