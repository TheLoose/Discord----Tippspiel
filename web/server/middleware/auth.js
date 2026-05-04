/**
 * Middleware to protect API routes.
 * Checks that the user is logged in via Discord OAuth2 and has the mod role.
 */
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireMod(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!req.session.user.isMod) {
    return res.status(403).json({ error: 'Missing moderator role' });
  }
  next();
}

module.exports = { requireAuth, requireMod };