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

// Optimistic-concurrency guard for /character/sync (see server.js) -- a stale tab/device pushing
// its own out-of-date character blob would otherwise silently roll back whatever a newer session
// already saved (a real incident: a player's FC and titles reverted ~2 hours after a stale second
// tab synced over them). Bumped on every saveCharacter() call regardless of source.
const hasCharacterRev = db.prepare('PRAGMA table_info(users)').all().some((col) => col.name === 'character_rev');
if (!hasCharacterRev) {
  db.exec('ALTER TABLE users ADD COLUMN character_rev INTEGER NOT NULL DEFAULT 0');
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
['leaderboard_last_check', 'looks_leader_user_id', 'networth_leader_user_id', 'level_leader_user_id', 'height_leader_user_id'].forEach((col) => {
  const has = db.prepare('PRAGMA table_info(server_state)').all().some((c) => c.name === col);
  if (!has) {
    const type = col === 'leaderboard_last_check' ? 'INTEGER NOT NULL DEFAULT 0' : 'INTEGER';
    db.exec(`ALTER TABLE server_state ADD COLUMN ${col} ${type}`);
  }
});

// Maintenance mode: takes over every non-admin client's screen until the admin (see
// ADMIN_USERNAME in server.js) turns it back off. Same single shared row and bolt-on-column
// approach as the leaderboard fields above, since server_state already exists in production.
if (!db.prepare('PRAGMA table_info(server_state)').all().some((c) => c.name === 'maintenance')) {
  db.exec('ALTER TABLE server_state ADD COLUMN maintenance INTEGER NOT NULL DEFAULT 0');
}

function getServerState() {
  return db.prepare('SELECT paused, modifier, maintenance FROM server_state WHERE id = 1').get();
}

function getLeaderboardState() {
  return db
    .prepare(
      'SELECT leaderboard_last_check, looks_leader_user_id, networth_leader_user_id, level_leader_user_id, height_leader_user_id FROM server_state WHERE id = 1'
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

function setServerMaintenance(on) {
  db.prepare('UPDATE server_state SET maintenance = ? WHERE id = 1').run(on ? 1 : 0);
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
// Bolt-on column: lets the client apply the equipped title's name-recolor style to chat senders,
// same trust level as title_text (client-supplied, never validated server-side).
if (!db.prepare('PRAGMA table_info(chat_messages)').all().some((c) => c.name === 'title_id')) {
  db.exec('ALTER TABLE chat_messages ADD COLUMN title_id TEXT');
}
const CHAT_HISTORY_LIMIT = 50;

function createChatMessage(userId, senderName, titleText, message, titleId) {
  const stmt = db.prepare(
    'INSERT INTO chat_messages (user_id, sender_name, title_text, message, sent_at, title_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(userId, senderName, titleText, message, Date.now(), titleId || null);
  return info.lastInsertRowid;
}

function getRecentChatMessages() {
  const rows = db.prepare('SELECT * FROM chat_messages ORDER BY sent_at DESC LIMIT ?').all(CHAT_HISTORY_LIMIT);
  return rows.reverse();
}

// Stock Market: one shared row per ticker (not per-character) -- price/fairValue/lastTickAt are
// server-authoritative and identical for every player, ticked forward lazily on read (see
// advanceStockTicks in gameLogic.js).
db.exec(`
  CREATE TABLE IF NOT EXISTS stocks (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sector TEXT NOT NULL,
    tier TEXT NOT NULL,
    price REAL NOT NULL,
    fair_value REAL NOT NULL,
    last_tick_at INTEGER NOT NULL
  );
`);

// Seeds the ticker roster on first boot only -- never overwrites existing rows, so restarts don't
// reset anyone's market back to launch prices.
function seedStocksIfEmpty(definitions) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM stocks').get().n;
  if (count > 0) return;
  const insert = db.prepare(
    'INSERT INTO stocks (symbol, name, sector, tier, price, fair_value, last_tick_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const now = Date.now();
  definitions.forEach((d) => insert.run(d.symbol, d.name, d.sector, d.tier, d.startPrice, d.startPrice, now));
}

function getAllStocks() {
  return db.prepare('SELECT * FROM stocks').all();
}

function updateStockPrice(symbol, price, fairValue, lastTickAt) {
  db.prepare('UPDATE stocks SET price = ?, fair_value = ?, last_tick_at = ? WHERE symbol = ?')
    .run(price, fairValue, lastTickAt, symbol);
}

// Investors Chat: a separate room from the New Milos City chat (chat_messages above) -- never
// mixed together, its own table/routes/UI. user_id is nullable since NPC bot posts have no real
// account behind them.
db.exec(`
  CREATE TABLE IF NOT EXISTS investor_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    sender_name TEXT NOT NULL,
    title_text TEXT,
    title_id TEXT,
    message TEXT NOT NULL,
    is_bot INTEGER NOT NULL DEFAULT 0,
    sent_at INTEGER NOT NULL
  );
`);
const INVESTOR_CHAT_HISTORY_LIMIT = 50;

function createInvestorChatMessage(userId, senderName, titleText, message, titleId, isBot) {
  const stmt = db.prepare(
    'INSERT INTO investor_chat_messages (user_id, sender_name, title_text, title_id, message, is_bot, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(userId || null, senderName, titleText || null, titleId || null, message, isBot ? 1 : 0, Date.now());
  return info.lastInsertRowid;
}

function getRecentInvestorChatMessages() {
  const rows = db.prepare('SELECT * FROM investor_chat_messages ORDER BY sent_at DESC LIMIT ?').all(INVESTOR_CHAT_HISTORY_LIMIT);
  return rows.reverse();
}

// Single shared row tracking when the next random NPC investor-chat post is due. Unlike stock
// ticks, bot-post cadence doesn't need to replay history perfectly on catch-up -- it just resumes
// from "now" (see maybeSpawnInvestorBotPost in server.js), so a plain next-timestamp is enough.
db.exec(`
  CREATE TABLE IF NOT EXISTS stock_market_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    next_bot_post_at INTEGER NOT NULL
  );
`);

function getStockMarketState() {
  let row = db.prepare('SELECT * FROM stock_market_state WHERE id = 1').get();
  if (!row) {
    const nextAt = Date.now() + 30 * 1000;
    db.prepare('INSERT INTO stock_market_state (id, next_bot_post_at) VALUES (1, ?)').run(nextAt);
    row = { id: 1, next_bot_post_at: nextAt };
  }
  return row;
}

function setNextBotPostAt(ts) {
  db.prepare('UPDATE stock_market_state SET next_bot_post_at = ? WHERE id = 1').run(ts);
}

function createUser(username, passwordHash, character) {
  const stmt = db.prepare(
    'INSERT INTO users (username, password_hash, character_json, created_at, last_seen) VALUES (?, ?, ?, ?, ?)'
  );
  const info = stmt.run(username, passwordHash, JSON.stringify(character), new Date().toISOString(), Date.now());
  return info.lastInsertRowid;
}

// Case-insensitive so "Bob"/"bob"/"BOB" are the same account for both login and the registration
// uniqueness check (both already call this function) -- original casing is preserved as typed at
// registration for display, this only affects matching.
function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
}

// Picks a random other account's in-game name for flavor text (e.g. Slut hustle messages) --
// falls back to a generic placeholder if this is the only account that exists yet.
function getRandomOtherUserCharacterName(excludeUserId) {
  const row = db.prepare('SELECT character_json FROM users WHERE id != ? ORDER BY RANDOM() LIMIT 1').get(excludeUserId);
  if (!row) return 'a rando';
  const c = JSON.parse(row.character_json);
  return `${c.firstName} ${c.lastName}`;
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// Bumps character_rev on every single save, from any source (a normal action or a /character/sync
// call) -- this is what lets /character/sync detect a stale write (see server.js): the client
// echoes back the rev it last saw, and a mismatch means something else already saved a newer
// version since then (a second tab/device is the common case). Returns the new rev so the caller
// can hand it back to the client.
function getCharacterRev(userId) {
  const row = db.prepare('SELECT character_rev FROM users WHERE id = ?').get(userId);
  return row ? row.character_rev : null;
}

function saveCharacter(userId, character) {
  db.prepare('UPDATE users SET character_json = ?, character_rev = character_rev + 1 WHERE id = ?').run(JSON.stringify(character), userId);
  return db.prepare('SELECT character_rev FROM users WHERE id = ?').get(userId).character_rev;
}

// Transaction log: an audit trail of every action that actually moves a player's cash (Floydbucks)
// balance -- workouts, title equips, etc. never touch cash and so never produce a row here. A
// real shared table (not character_json) since it has to survive a character reset/wipe and needs
// to be browsable across all players at once, not just one at a time.
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    delta REAL NOT NULL,
    balance_after REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id)');

function logTransaction(userId, userName, action, delta, balanceAfter) {
  db.prepare(
    'INSERT INTO transactions (user_id, user_name, action, delta, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, userName, action, delta, balanceAfter, Date.now());
}

function getRecentTransactions(limit, beforeId) {
  if (beforeId) {
    return db.prepare('SELECT * FROM transactions WHERE id < ? ORDER BY id DESC LIMIT ?').all(beforeId, limit);
  }
  return db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT ?').all(limit);
}

function getTransactionsForUser(userId, limit) {
  return db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, limit);
}

// Powers the admin Transaction Log dashboard -- aggregates computed directly in SQL rather than
// paging the raw table client-side, so this stays cheap regardless of how large the log gets.
function getTransactionSummary() {
  const totals = db
    .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(delta), 0) AS netChange, COALESCE(SUM(ABS(delta)), 0) AS volume FROM transactions')
    .get();
  const byActionGains = db
    .prepare('SELECT action, SUM(delta) AS total, COUNT(*) AS count FROM transactions WHERE delta > 0 GROUP BY action ORDER BY total DESC LIMIT 10')
    .all();
  const byActionSinks = db
    .prepare('SELECT action, SUM(delta) AS total, COUNT(*) AS count FROM transactions WHERE delta < 0 GROUP BY action ORDER BY total ASC LIMIT 10')
    .all();
  const topEarners = db
    .prepare('SELECT user_id AS userId, user_name AS userName, SUM(delta) AS net FROM transactions GROUP BY user_id ORDER BY net DESC LIMIT 5')
    .all();
  const topLosers = db
    .prepare('SELECT user_id AS userId, user_name AS userName, SUM(delta) AS net FROM transactions GROUP BY user_id ORDER BY net ASC LIMIT 5')
    .all();
  return { totals, byActionGains, byActionSinks, topEarners, topLosers };
}

// Bounds disk usage on a small droplet -- called once at boot and on a daily interval (see
// server.js), not a real OS-level cron job.
function pruneOldTransactions(maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;
  return db.prepare('DELETE FROM transactions WHERE created_at < ?').run(cutoff).changes;
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

// Real marriage handshake -- mirrors the duels table's pending/respond shape, minus the combat
// fields duels needs. "accepted" is permanent for now; divorce is out of scope.
db.exec(`
  CREATE TABLE IF NOT EXISTS marriage_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposer_user_id INTEGER NOT NULL,
    proposer_name TEXT NOT NULL,
    target_user_id INTEGER NOT NULL,
    target_name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

function createMarriageProposal(proposerId, proposerName, targetId, targetName) {
  const stmt = db.prepare(
    'INSERT INTO marriage_proposals (proposer_user_id, proposer_name, target_user_id, target_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(proposerId, proposerName, targetId, targetName, 'pending', Date.now());
  return info.lastInsertRowid;
}

function getMarriageProposalById(id) {
  return db.prepare('SELECT * FROM marriage_proposals WHERE id = ?').get(id);
}

function getPendingMarriageProposalForTarget(targetId) {
  return db.prepare("SELECT * FROM marriage_proposals WHERE target_user_id = ? AND status = 'pending'").get(targetId);
}

function getPendingOrAcceptedProposalForUser(userId) {
  return db
    .prepare(
      "SELECT * FROM marriage_proposals WHERE status IN ('pending', 'accepted') AND (proposer_user_id = ? OR target_user_id = ?)"
    )
    .get(userId, userId);
}

function updateMarriageProposal(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  db.prepare(`UPDATE marriage_proposals SET ${setClause} WHERE id = ?`).run(...values, id);
}

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

// Robbery notifications: same reasoning as payment_notifications -- the victim needs to learn
// they were robbed even though they never triggered the request. Unlike payments (a quiet bell
// badge), robberies pop an alert modal client-side, so the client fetches unseen rows directly
// rather than a count.
db.exec(`
  CREATE TABLE IF NOT EXISTS robbery_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_user_id INTEGER NOT NULL,
    robber_name TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at INTEGER NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0
  );
`);
const ROBBERY_NOTIFICATION_LIMIT = 20;

function createRobberyNotification(recipientUserId, robberName, amount) {
  db.prepare(
    'INSERT INTO robbery_notifications (recipient_user_id, robber_name, amount, created_at, seen) VALUES (?, ?, ?, ?, 0)'
  ).run(recipientUserId, robberName, amount, Date.now());
}

function getUnseenRobberyNotifications(userId) {
  return db
    .prepare('SELECT * FROM robbery_notifications WHERE recipient_user_id = ? AND seen = 0 ORDER BY created_at ASC LIMIT ?')
    .all(userId, ROBBERY_NOTIFICATION_LIMIT);
}

function markRobberyNotificationsSeen(userId) {
  db.prepare('UPDATE robbery_notifications SET seen = 1 WHERE recipient_user_id = ? AND seen = 0').run(userId);
}

// Slime notifications: same idiom as robbery_notifications (alert modal, not a quiet bell badge).
// `outcome` is 'slimed' (the recipient got locked out -- `until` carries the lockout end time so
// the client can enter the SLIMED OUT gate straight from this row, no extra fetch) or 'blocked'
// (someone tried and their own Body Armor stopped it).
db.exec(`
  CREATE TABLE IF NOT EXISTS slime_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_user_id INTEGER NOT NULL,
    shooter_name TEXT NOT NULL,
    outcome TEXT NOT NULL,
    until INTEGER,
    created_at INTEGER NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0
  );
`);
const SLIME_NOTIFICATION_LIMIT = 20;

function createSlimeNotification(recipientUserId, shooterName, outcome, until) {
  db.prepare(
    'INSERT INTO slime_notifications (recipient_user_id, shooter_name, outcome, until, created_at, seen) VALUES (?, ?, ?, ?, ?, 0)'
  ).run(recipientUserId, shooterName, outcome, until || null, Date.now());
}

function getUnseenSlimeNotifications(userId) {
  return db
    .prepare('SELECT * FROM slime_notifications WHERE recipient_user_id = ? AND seen = 0 ORDER BY created_at ASC LIMIT ?')
    .all(userId, SLIME_NOTIFICATION_LIMIT);
}

function markSlimeNotificationsSeen(userId) {
  db.prepare('UPDATE slime_notifications SET seen = 1 WHERE recipient_user_id = ? AND seen = 0').run(userId);
}

// Altcoins: a real shared table, same reasoning as mtn_listings -- an altcoin's remaining-supply
// count has to be visible to every player, not just its creator. Holdings live in a separate table
// (one row per user per coin) so per-user qty/cost-basis stays queryable without ever exposing it
// in a public listing -- see the Altcoins routes in server.js for what actually gets serialized out.
db.exec(`
  CREATE TABLE IF NOT EXISTS altcoins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    creator_user_id INTEGER NOT NULL,
    creator_name TEXT NOT NULL,
    supply INTEGER NOT NULL,
    sold INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    price_override REAL,
    created_at INTEGER NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS altcoin_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    altcoin_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0,
    cost_basis_fc REAL NOT NULL DEFAULT 0
  );
`);

function createAltcoin(name, creatorUserId, creatorName, supply) {
  const info = db.prepare(
    'INSERT INTO altcoins (name, creator_user_id, creator_name, supply, sold, status, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
  ).run(name, creatorUserId, creatorName, supply, 'active', Date.now());
  return info.lastInsertRowid;
}

function getActiveAltcoinByCreator(creatorUserId) {
  return db.prepare("SELECT * FROM altcoins WHERE creator_user_id = ? AND status = 'active'").get(creatorUserId);
}

function getAllAltcoins() {
  return db.prepare('SELECT * FROM altcoins ORDER BY created_at DESC').all();
}

function getAltcoinById(id) {
  return db.prepare('SELECT * FROM altcoins WHERE id = ?').get(id);
}

function updateAltcoinSold(id, sold) {
  db.prepare('UPDATE altcoins SET sold = ? WHERE id = ?').run(sold, id);
}

function setAltcoinStatus(id, status, priceOverride = null) {
  db.prepare('UPDATE altcoins SET status = ?, price_override = ? WHERE id = ?').run(status, priceOverride, id);
}

function getAltcoinHoldings(altcoinId) {
  return db.prepare('SELECT * FROM altcoin_holdings WHERE altcoin_id = ? AND qty > 0').all(altcoinId);
}

function getAltcoinHoldingForUser(altcoinId, userId) {
  return db.prepare('SELECT * FROM altcoin_holdings WHERE altcoin_id = ? AND user_id = ?').get(altcoinId, userId);
}

// Majority holder = whoever holds the plurality of coins sold so far, recomputed live every time
// it's needed (rug/buyout eligibility) rather than cached, since holdings shift as coins change hands.
function getAltcoinMajorityHolder(altcoinId) {
  return db
    .prepare('SELECT * FROM altcoin_holdings WHERE altcoin_id = ? AND qty > 0 ORDER BY qty DESC, user_id ASC LIMIT 1')
    .get(altcoinId);
}

function addAltcoinHolding(altcoinId, userId, userName, qty, costBasisFc) {
  const existing = getAltcoinHoldingForUser(altcoinId, userId);
  if (existing) {
    db.prepare('UPDATE altcoin_holdings SET qty = qty + ?, cost_basis_fc = cost_basis_fc + ? WHERE id = ?')
      .run(qty, costBasisFc, existing.id);
  } else {
    db.prepare('INSERT INTO altcoin_holdings (altcoin_id, user_id, user_name, qty, cost_basis_fc) VALUES (?, ?, ?, ?, ?)')
      .run(altcoinId, userId, userName, qty, costBasisFc);
  }
}

function zeroAltcoinHolding(holdingId) {
  db.prepare('UPDATE altcoin_holdings SET qty = 0 WHERE id = ?').run(holdingId);
}

module.exports = {
  db,
  createUser,
  getUserByUsername,
  getRandomOtherUserCharacterName,
  getUserById,
  saveCharacter,
  getCharacterRev,
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
  setServerMaintenance,
  createChatMessage,
  getRecentChatMessages,
  seedStocksIfEmpty,
  getAllStocks,
  updateStockPrice,
  createInvestorChatMessage,
  getRecentInvestorChatMessages,
  getStockMarketState,
  setNextBotPostAt,
  touchMilosPresence,
  clearMilosPresence,
  getMilosOnlineUsers,
  createDuelChallenge,
  getDuelById,
  getPendingDuelForTarget,
  getActiveDuelForUser,
  getPendingOrActiveDuelForUser,
  updateDuel,
  createMarriageProposal,
  getMarriageProposalById,
  getPendingMarriageProposalForTarget,
  getPendingOrAcceptedProposalForUser,
  updateMarriageProposal,
  createCoinflipLobby,
  getOpenCoinflipLobbies,
  getCoinflipLobbyById,
  joinCoinflipLobby,
  resolveCoinflipLobby,
  cancelCoinflipLobby,
  createPaymentNotification,
  getPaymentNotifications,
  getUnseenPaymentCount,
  markPaymentNotificationsSeen,
  createRobberyNotification,
  getUnseenRobberyNotifications,
  markRobberyNotificationsSeen,
  createSlimeNotification,
  getUnseenSlimeNotifications,
  markSlimeNotificationsSeen,
  logTransaction,
  getRecentTransactions,
  getTransactionsForUser,
  pruneOldTransactions,
  getTransactionSummary,
  getLeaderboardState,
  updateLeaderboardState,
  getAllUsersForLeaderboard,
  createAltcoin,
  getActiveAltcoinByCreator,
  getAllAltcoins,
  getAltcoinById,
  updateAltcoinSold,
  setAltcoinStatus,
  getAltcoinHoldings,
  getAltcoinHoldingForUser,
  getAltcoinMajorityHolder,
  addAltcoinHolding,
  zeroAltcoinHolding,
};
