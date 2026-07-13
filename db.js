const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    character_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen INTEGER NOT NULL DEFAULT 0
  );
`);

// Older databases created before `last_seen` existed won't have the column -- add it if missing.
const hasLastSeen = db.prepare('PRAGMA table_info(users)').all().some((col) => col.name === 'last_seen');
if (!hasLastSeen) {
  db.exec('ALTER TABLE users ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0');
}

function createUser(username, passwordHash, character) {
  const stmt = db.prepare(
    'INSERT INTO users (username, password_hash, character_json, created_at, last_seen) VALUES (?, ?, ?, ?, ?)'
  );
  const info = stmt.run(username, passwordHash, JSON.stringify(character), new Date().toISOString(), Date.now());
  return info.lastInsertRowid;
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function saveCharacter(userId, character) {
  db.prepare('UPDATE users SET character_json = ? WHERE id = ?').run(JSON.stringify(character), userId);
}

function touchLastSeen(userId) {
  db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(Date.now(), userId);
}

function getOnlineUsers(sinceTs) {
  return db.prepare('SELECT username, character_json FROM users WHERE last_seen >= ?').all(sinceTs);
}

module.exports = {
  db,
  createUser,
  getUserByUsername,
  getUserById,
  saveCharacter,
  touchLastSeen,
  getOnlineUsers,
};
