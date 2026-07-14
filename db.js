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

// Separate from `last_seen` (which just means "authenticated recently, anywhere in the app"):
// this tracks whether the player is actually looking at the New Milos City tab right now, so the
// Players Online roster can reflect real presence in that room instead of global app activity.
const hasMilosLastSeen = db.prepare('PRAGMA table_info(users)').all().some((col) => col.name === 'milos_last_seen');
if (!hasMilosLastSeen) {
  db.exec('ALTER TABLE users ADD COLUMN milos_last_seen INTEGER NOT NULL DEFAULT 0');
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

// Leaderboard title-holder tracking, bolted onto the same single shared row: who currently holds
// each daily-refreshed crown, and when the crown was last recomputed, so a repeat check on every
// request stays a cheap single-row read except on the one day-boundary crossing it actually does
// the full recompute.
['leaderboard_last_check', 'looks_leader_user_id', 'networth_leader_user_id', 'level_leader_user_id'].forEach((col) => {
  const has = db.prepare('PRAGMA table_info(server_state)').all().some((c) => c.name === col);
  if (!has) {
    const type = col === 'leaderboard_last_check' ? 'INTEGER NOT NULL DEFAULT 0' : 'INTEGER';
    db.exec(`ALTER TABLE server_state ADD COLUMN ${col} ${type}`);
  }
});

function getServerState() {
  return db.prepare('SELECT paused, modifier FROM server_state WHERE id = 1').get();
}

function getLeaderboardState() {
  return db
    .prepare(
      'SELECT leaderboard_last_check, looks_leader_user_id, networth_leader_user_id, level_leader_user_id FROM server_state WHERE id = 1'
    )
    .get();
}

function updateLeaderboardState(fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  db.prepare(`UPDATE server_state SET ${setClause} WHERE id = 1`).run(...values);
}

function getAllUsersForLeaderboard() {
  return db.prepare('SELECT id, username, character_json FROM users').all();
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

// New Milos City chat: a shared table (unlike character_json) since every message needs to be
// visible to everyone in the room, not just its sender.
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sender_name TEXT NOT NULL,
    title_text TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at INTEGER NOT NULL
  );
`);
const CHAT_HISTORY_LIMIT = 50;

function createChatMessage(userId, senderName, titleText, message) {
  const stmt = db.prepare(
    'INSERT INTO chat_messages (user_id, sender_name, title_text, message, sent_at) VALUES (?, ?, ?, ?, ?)'
  );
  const info = stmt.run(userId, senderName, titleText, message, Date.now());
  return info.lastInsertRowid;
}

function getRecentChatMessages() {
  const rows = db.prepare('SELECT * FROM chat_messages ORDER BY sent_at DESC LIMIT ?').all(CHAT_HISTORY_LIMIT);
  return rows.reverse();
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

function touchMilosPresence(userId) {
  db.prepare('UPDATE users SET milos_last_seen = ? WHERE id = ?').run(Date.now(), userId);
}

function clearMilosPresence(userId) {
  db.prepare('UPDATE users SET milos_last_seen = 0 WHERE id = ?').run(userId);
}

function getMilosOnlineUsers(sinceTs) {
  return db.prepare('SELECT username, character_json FROM users WHERE milos_last_seen >= ?').all(sinceTs);
}

// PvP duels: a real shared table (unlike character.combat, which is PvE-only and resolved
// synchronously inside a single request) since both participants -- and their two separate
// browsers polling independently -- need to see the same authoritative turn/HP state.
db.exec(`
  CREATE TABLE IF NOT EXISTS duels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attacker_user_id INTEGER NOT NULL,
    attacker_name TEXT NOT NULL,
    target_user_id INTEGER NOT NULL,
    target_name TEXT NOT NULL,
    status TEXT NOT NULL,
    turn_user_id INTEGER,
    attacker_hp INTEGER,
    attacker_max_hp INTEGER,
    target_hp INTEGER,
    target_max_hp INTEGER,
    attacker_guarding INTEGER NOT NULL DEFAULT 0,
    target_guarding INTEGER NOT NULL DEFAULT 0,
    winner_user_id INTEGER,
    last_action_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

function createDuelChallenge(attackerId, attackerName, targetId, targetName) {
  const now = Date.now();
  const stmt = db.prepare(
    'INSERT INTO duels (attacker_user_id, attacker_name, target_user_id, target_name, status, last_action_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(attackerId, attackerName, targetId, targetName, 'pending', now, now);
  return info.lastInsertRowid;
}

function getDuelById(id) {
  return db.prepare('SELECT * FROM duels WHERE id = ?').get(id);
}

function getPendingDuelForTarget(targetId) {
  return db.prepare("SELECT * FROM duels WHERE target_user_id = ? AND status = 'pending'").get(targetId);
}

function getActiveDuelForUser(userId) {
  return db
    .prepare("SELECT * FROM duels WHERE status = 'active' AND (attacker_user_id = ? OR target_user_id = ?)")
    .get(userId, userId);
}

function getPendingOrActiveDuelForUser(userId) {
  return db
    .prepare(
      "SELECT * FROM duels WHERE status IN ('pending', 'active') AND (attacker_user_id = ? OR target_user_id = ?)"
    )
    .get(userId, userId);
}

function updateDuel(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  db.prepare(`UPDATE duels SET ${setClause} WHERE id = ?`).run(...values, id);
}

// Coinflip lobbies: a real shared table so an open lobby is visible to every other online player
// until someone joins it, same reasoning as mtn_listings.
db.exec(`
  CREATE TABLE IF NOT EXISTS coinflip_lobbies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_user_id INTEGER NOT NULL,
    creator_name TEXT NOT NULL,
    joiner_user_id INTEGER,
    joiner_name TEXT,
    wager REAL NOT NULL,
    creator_side TEXT NOT NULL,
    status TEXT NOT NULL,
    result_side TEXT,
    winner_user_id INTEGER,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  );
`);

function createCoinflipLobby(creatorId, creatorName, wager, creatorSide) {
  const stmt = db.prepare(
    'INSERT INTO coinflip_lobbies (creator_user_id, creator_name, wager, creator_side, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(creatorId, creatorName, wager, creatorSide, 'open', Date.now());
  return info.lastInsertRowid;
}

function getOpenCoinflipLobbies() {
  return db.prepare("SELECT * FROM coinflip_lobbies WHERE status = 'open' ORDER BY created_at DESC").all();
}

function getCoinflipLobbyById(id) {
  return db.prepare('SELECT * FROM coinflip_lobbies WHERE id = ?').get(id);
}

// Guarded compare-and-set: only succeeds if the lobby is still open and un-joined, so two
// simultaneous joiners can't both win the race. Callers must check `changes` on the result.
function joinCoinflipLobby(id, joinerId, joinerName) {
  const stmt = db.prepare(
    "UPDATE coinflip_lobbies SET joiner_user_id = ?, joiner_name = ? WHERE id = ? AND status = 'open' AND joiner_user_id IS NULL"
  );
  return stmt.run(joinerId, joinerName, id);
}

function resolveCoinflipLobby(id, resultSide, winnerId) {
  db.prepare(
    "UPDATE coinflip_lobbies SET status = 'resolved', result_side = ?, winner_user_id = ?, resolved_at = ? WHERE id = ?"
  ).run(resultSide, winnerId, Date.now(), id);
}

function cancelCoinflipLobby(id) {
  db.prepare("UPDATE coinflip_lobbies SET status = 'cancelled', resolved_at = ? WHERE id = ?").run(Date.now(), id);
}

// Multiplayer casino tables: table lifecycle (blackjack + roulette) lives in real shared rows so
// up to 5 seated players' browsers, each polling independently, see the same authoritative seat
// list, countdown deadline, and dealer/wheel state.
db.exec(`
  CREATE TABLE IF NOT EXISTS casino_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game TEXT NOT NULL,
    phase TEXT NOT NULL,
    round_ends_at INTEGER,
    dealer_cards_json TEXT,
    roulette_result INTEGER,
    created_at INTEGER NOT NULL
  );
`);

// A child table (not JSON-in-row) so each of up to 5 seats can be updated independently without a
// read-modify-write race on a single shared blob.
db.exec(`
  CREATE TABLE IF NOT EXISTS casino_table_seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,
    seat_index INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    bet REAL NOT NULL DEFAULT 0,
    bj_cards_json TEXT,
    bj_phase TEXT,
    roulette_bets_json TEXT,
    left_table INTEGER NOT NULL DEFAULT 0,
    UNIQUE(table_id, seat_index)
  );
`);

function createCasinoTable(game) {
  const stmt = db.prepare('INSERT INTO casino_tables (game, phase, created_at) VALUES (?, ?, ?)');
  const info = stmt.run(game, 'waiting', Date.now());
  return info.lastInsertRowid;
}

function getCasinoTableById(id) {
  return db.prepare('SELECT * FROM casino_tables WHERE id = ?').get(id);
}

// Finds a table with the given game that still has room, preferring the most recently created one.
function getOpenCasinoTable(game) {
  const candidates = db
    .prepare("SELECT * FROM casino_tables WHERE game = ? AND phase IN ('waiting', 'countdown') ORDER BY created_at DESC")
    .all(game);
  for (const table of candidates) {
    const activeSeats = db
      .prepare('SELECT COUNT(*) AS c FROM casino_table_seats WHERE table_id = ? AND left_table = 0')
      .get(table.id).c;
    if (activeSeats < 5) return table;
  }
  return null;
}

function updateCasinoTable(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  db.prepare(`UPDATE casino_tables SET ${setClause} WHERE id = ?`).run(...values, id);
}

function getSeatsForTable(tableId) {
  return db
    .prepare('SELECT * FROM casino_table_seats WHERE table_id = ? AND left_table = 0 ORDER BY seat_index ASC')
    .all(tableId);
}

// Takes the lowest free seat index (0-4) for this user at this table, inside a transaction so a
// 6th simultaneous joiner can't slip past the 5-seat cap.
const takeSeatTxn = db.transaction((tableId, userId, playerName) => {
  const taken = db
    .prepare('SELECT seat_index FROM casino_table_seats WHERE table_id = ? AND left_table = 0')
    .all(tableId)
    .map((r) => r.seat_index);
  if (taken.length >= 5) return null;
  let seatIndex = 0;
  while (taken.includes(seatIndex)) seatIndex += 1;
  const info = db
    .prepare(
      'INSERT INTO casino_table_seats (table_id, seat_index, user_id, player_name, bet) VALUES (?, ?, ?, ?, 0)'
    )
    .run(tableId, seatIndex, userId, playerName);
  return info.lastInsertRowid;
});

function takeSeat(tableId, userId, playerName) {
  return takeSeatTxn(tableId, userId, playerName);
}

function getSeatForUser(tableId, userId) {
  return db
    .prepare('SELECT * FROM casino_table_seats WHERE table_id = ? AND user_id = ? AND left_table = 0')
    .get(tableId, userId);
}

function updateSeat(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  db.prepare(`UPDATE casino_table_seats SET ${setClause} WHERE id = ?`).run(...values, id);
}

function leaveSeat(id) {
  db.prepare('UPDATE casino_table_seats SET left_table = 1 WHERE id = ?').run(id);
}

function deleteCasinoTableIfEmpty(tableId) {
  const remaining = db
    .prepare('SELECT COUNT(*) AS c FROM casino_table_seats WHERE table_id = ? AND left_table = 0')
    .get(tableId).c;
  if (remaining === 0) {
    db.prepare('DELETE FROM casino_table_seats WHERE table_id = ?').run(tableId);
    db.prepare('DELETE FROM casino_tables WHERE id = ?').run(tableId);
  }
}

// Payment notifications: a real shared table (not character_json) since the recipient needs to
// learn about an incoming payment even though they weren't the one who triggered the request --
// the header bell polls this globally, independent of which page the recipient is on.
db.exec(`
  CREATE TABLE IF NOT EXISTS payment_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_user_id INTEGER NOT NULL,
    payer_name TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at INTEGER NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0
  );
`);
const PAYMENT_NOTIFICATION_LIMIT = 20;

function createPaymentNotification(recipientUserId, payerName, amount) {
  db.prepare(
    'INSERT INTO payment_notifications (recipient_user_id, payer_name, amount, created_at, seen) VALUES (?, ?, ?, ?, 0)'
  ).run(recipientUserId, payerName, amount, Date.now());
}

function getPaymentNotifications(userId) {
  return db
    .prepare('SELECT * FROM payment_notifications WHERE recipient_user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, PAYMENT_NOTIFICATION_LIMIT);
}

function getUnseenPaymentCount(userId) {
  return db
    .prepare('SELECT COUNT(*) AS c FROM payment_notifications WHERE recipient_user_id = ? AND seen = 0')
    .get(userId).c;
}

function markPaymentNotificationsSeen(userId) {
  db.prepare('UPDATE payment_notifications SET seen = 1 WHERE recipient_user_id = ? AND seen = 0').run(userId);
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
  createChatMessage,
  getRecentChatMessages,
  touchMilosPresence,
  clearMilosPresence,
  getMilosOnlineUsers,
  createDuelChallenge,
  getDuelById,
  getPendingDuelForTarget,
  getActiveDuelForUser,
  getPendingOrActiveDuelForUser,
  updateDuel,
  createCoinflipLobby,
  getOpenCoinflipLobbies,
  getCoinflipLobbyById,
  joinCoinflipLobby,
  resolveCoinflipLobby,
  cancelCoinflipLobby,
  createCasinoTable,
  getCasinoTableById,
  getOpenCasinoTable,
  updateCasinoTable,
  getSeatsForTable,
  takeSeat,
  getSeatForUser,
  updateSeat,
  leaveSeat,
  deleteCasinoTableIfEmpty,
  createPaymentNotification,
  getPaymentNotifications,
  getUnseenPaymentCount,
  markPaymentNotificationsSeen,
  getLeaderboardState,
  updateLeaderboardState,
  getAllUsersForLeaderboard,
};
