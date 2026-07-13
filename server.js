require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { createUser, getUserByUsername, getUserById, saveCharacter, getOnlineUsers, touchLastSeen } = require('./db');
const { hashPassword, checkPassword, issueToken, requireAuth } = require('./auth');
const { newCharacter, doWork } = require('./gameLogic');

const app = express();
const PORT = process.env.PORT || 3000;

// A player counts as "online" if any authenticated request touched last_seen within this window.
// requireAuth updates last_seen on every call, and the client polls /players/online well inside
// this window, so anyone with the app open stays lit up here.
const ONLINE_WINDOW_MS = 60 * 1000;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://mfmmo.com', 'https://www.mfmmo.com'];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mfmmoalpha-server', time: new Date().toISOString() });
});

app.post('/auth/register', (req, res) => {
  const { username, password, firstName, lastName } = req.body || {};

  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ ok: false, reason: 'Username must be 3-20 characters: letters, numbers, underscores.' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ ok: false, reason: 'Password must be at least 4 characters.' });
  }
  if (!firstName || !lastName || firstName.length > 10 || lastName.length > 10) {
    return res.status(400).json({ ok: false, reason: 'First and last name are required (max 10 characters each).' });
  }
  if (getUserByUsername(username)) {
    return res.status(409).json({ ok: false, reason: 'That username is already taken.' });
  }

  const character = newCharacter(firstName, lastName);
  const userId = createUser(username, hashPassword(password), character);
  const token = issueToken(userId, username);

  res.json({ ok: true, token, character });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = username ? getUserByUsername(username) : null;

  if (!user || !checkPassword(password || '', user.password_hash)) {
    return res.status(401).json({ ok: false, reason: 'Incorrect username or password.' });
  }

  touchLastSeen(user.id);
  const token = issueToken(user.id, user.username);
  res.json({ ok: true, token, character: JSON.parse(user.character_json) });
});

app.get('/me', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  res.json({ ok: true, character: JSON.parse(user.character_json) });
});

app.get('/players/online', requireAuth, (req, res) => {
  const rows = getOnlineUsers(Date.now() - ONLINE_WINDOW_MS);
  // Send the full character so the client can compute the same title/rank badge it
  // shows for you, instead of duplicating that display logic server-side.
  const players = rows.map((row) => ({
    username: row.username,
    character: JSON.parse(row.character_json),
    you: row.username === req.user.username,
  }));
  res.json({ ok: true, players });
});

app.post('/hustle/work', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });

  const character = JSON.parse(user.character_json);
  const result = doWork(character);

  if (!result.ok) return res.status(429).json(result);

  saveCharacter(user.id, character);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`mfmmoalpha-server listening on port ${PORT}`);
});
