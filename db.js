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

// Server-wide state (pause + active modifier): a single shared row, same reasoning as the other
// shared tables -- the admin's pause/modifier toggle has to be visible to every player, not just
// stored per-character. Previously this lived in each browser's own local storage, which meant
// every player effectively had their own private "server state" -- pausing did nothing for anyone else.
db.exec(`
  CREATE TABLE IF NOT EXISTS server_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    paused INTEGER NOT NULL DEFAULT 0,
    modifier TEXT
  );
`);
db.prepare('INSERT OR IGNORE INTO server_state (id, paused, modifier) VALUES (1, 0, NULL)').run();

function getServerState() {
  return db.prepare('SELECT paused, modifier FROM server_state WHERE id = 1').get();
}

function setServerPaused(paused) {
  db.prepare('UPDATE server_state SET paused = ? WHERE id = 1').run(paused ? 1 : 0);
}

function setServerModifier(modifier) {
  db.prepare('UPDATE server_state SET modifier = ? WHERE id = 1').run(modifier);
}

// Milos Trading Network: a real shared table (unlike everything else, which lives inside a single
// user's character_json) since a listing must be visible to every player, not just its seller.
db.exec(`
  CREATE TABLE IF NOT EXISTS mtn_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_user_id INTEGER NOT NULL,
    seller_name TEXT NOT NULL,
    item_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    price_per_unit REAL NOT NULL,
    listed_at INTEGER NOT NULL
  );
`);

function createListing(sellerUserId, sellerName, itemId, qty, pricePerUnit) {
  const stmt = db.prepare(
    'INSERT INTO mtn_listings (seller_user_id, seller_name, item_id, qty, price_per_unit, listed_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(sellerUserId, sellerName, itemId, qty, pricePerUnit, Date.now());
  return info.lastInsertRowid;
}

function getAllListings() {
  return db.prepare('SELECT * FROM mtn_listings ORDER BY listed_at DESC').all();
}

function getListingById(id) {
  return db.prepare('SELECT * FROM mtn_listings WHERE id = ?').get(id);
}

function deleteListing(id) {
  db.prepare('DELETE FROM mtn_listings WHERE id = ?').run(id);
}

// New Milos Penitentiary: also a shared table, same reasoning as mtn_listings -- the public
// arrest registry has to show every player's real jail state, not just your own.
db.exec(`
  CREATE TABLE IF NOT EXISTS penitentiary_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    crime TEXT NOT NULL,
    years_total REAL NOT NULL,
    years_remaining REAL NOT NULL,
    arrested_at INTEGER NOT NULL,
    released_at INTEGER,
    commissary_received REAL NOT NULL DEFAULT 0
  );
`);

function getActivePenitentiaryRecord(userId) {
  return db.prepare('SELECT * FROM penitentiary_records WHERE user_id = ? AND released_at IS NULL').get(userId);
}

function createPenitentiaryRecord(userId, playerName, crime, yearsRemaining) {
  const stmt = db.prepare(
    'INSERT INTO penitentiary_records (user_id, player_name, crime, years_total, years_remaining, arrested_at, released_at, commissary_received) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)'
  );
  const info = stmt.run(userId, playerName, crime, yearsRemaining, yearsRemaining, Date.now());
  return info.lastInsertRowid;
}

function updatePenitentiaryYearsRemaining(id, yearsRemaining) {
  db.prepare('UPDATE penitentiary_records SET years_remaining = ? WHERE id = ?').run(yearsRemaining, id);
}

function releasePenitentiaryRecord(id) {
  db.prepare('UPDATE penitentiary_records SET released_at = ?, years_remaining = 0 WHERE id = ?').run(Date.now(), id);
}

function addPenitentiaryCommissary(id, amount) {
  db.prepare('UPDATE penitentiary_records SET commissary_received = commissary_received + ? WHERE id = ?').run(amount, id);
}

function getAllPenitentiaryRecords() {
  return db.prepare('SELECT * FROM penitentiary_records ORDER BY arrested_at DESC').all();
}

function getPenitentiaryRecordById(id) {
  return db.prepare('SELECT * FROM penitentiary_records WHERE id = ?').get(id);
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
  createListing,
  getAllListings,
  getListingById,
  deleteListing,
  getActivePenitentiaryRecord,
  createPenitentiaryRecord,
  updatePenitentiaryYearsRemaining,
  releasePenitentiaryRecord,
  addPenitentiaryCommissary,
  getAllPenitentiaryRecords,
  getPenitentiaryRecordById,
  getServerState,
  setServerPaused,
  setServerModifier,
};
