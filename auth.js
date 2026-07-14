const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { touchLastSeen } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set -- refusing to start without one.');
}

const TOKEN_EXPIRY = '30d';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function checkPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function issueToken(userId, username) {
  return jwt.sign({ sub: userId, username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Express middleware: requires a valid `Authorization: Bearer <token>` header.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, reason: 'Missing auth token.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    touchLastSeen(req.user.sub);
    next();
  } catch {
    res.status(401).json({ ok: false, reason: 'Invalid or expired token.' });
  }
}

// Used only by routes that can't rely on a normal Authorization header -- e.g. navigator.sendBeacon,
// which can't set custom headers, so the token has to travel in the beacon's body instead.
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { hashPassword, checkPassword, issueToken, requireAuth, verifyToken };
