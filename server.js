require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
  createUser,
  getUserByUsername,
  getRandomOtherUserCharacterName,
  getUserById,
  saveCharacter,
  getOnlineUsers,
  touchLastSeen,
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
} = require('./db');
const { hashPassword, checkPassword, issueToken, requireAuth, verifyToken } = require('./auth');
const {
  newCharacter,
  doWork,
  doSlut,
  doCrime,
  doWorkout,
  doSetSteroidTier,
  doRoidEscape,
  doBodyExercise,
  doStretchForHeight,
  doBuyFood,
  doBuyMaxx,
  doBuyChips,
  doCashOut,
  doBjDeal,
  doBjHit,
  doBjStand,
  doSlotSpin,
  drawCard,
  handTotal,
  isBlackjack,
  computeTableBlackjackPayout,
  spinRoulette,
  evaluateRouletteBet,
  doBankDeposit,
  doBankWithdraw,
  doBankUpgrade,
  doBankApplyCredit,
  doBankCashAdvance,
  doBankPayCredit,
  doBuyGun,
  doBuyMelee,
  doBuyAmmo,
  doApplyConcealedPermit,
  doApplyGoodJob,
  doResignGoodJob,
  doGoodJobWork,
  doApplyBadJob,
  doResignBadJob,
  doBadJobWork,
  doBuyGear,
  doDealerQuickDeal,
  doBuyFromDealer,
  doSellDrugs,
  doRobbery,
  doRobPlayer,
  doStartFight,
  doCombatAction,
  doFlee,
  initDuelCombatants,
  resolveDuelTurn,
  applyDuelOutcome,
  doAttemptCrime,
  doCommunityService,
  doHireLawyer,
  doJailWorkout,
  doJailFight,
  doBuyContraband,
  doCityHallRename,
  doGunSafetyResult,
  doRangeShoot,
  doRangeDraw,
  doRangeReload,
  doCreateListing,
  doCancelListing,
  doBuyListing,
  creditSellerForSale,
  round2,
  LEADERBOARD_TITLES,
  computeLeaderboardWinners,
  buildLeaderboardBoard,
} = require('./gameLogic');

const app = express();
const PORT = process.env.PORT || 3000;

// A player counts as "online" if any authenticated request touched last_seen within this window.
// requireAuth updates last_seen on every call, and the client polls /players/online well inside
// this window, so anyone with the app open stays lit up here.
const ONLINE_WINDOW_MS = 60 * 1000;

// Players Online is scoped to New Milos City specifically -- the client sends a heartbeat every
// 10s while that tab is active, so 20s (2 missed beats) is a safe backstop for a dropped poll
// without keeping someone lit up long after they've actually left the room.
const MILOS_ONLINE_WINDOW_MS = 20 * 1000;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://mfmmo.com', 'https://www.mfmmo.com'];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// Leaderboard titles (LOOKSMAXXER / HIGHEST NET WORTH / HIGHEST LEVEL) are recomputed once a day,
// check-on-poll style like everything else in this codebase -- no cron. This middleware runs on
// every request so the daily rollover happens promptly no matter which page anyone is on, but the
// guard is a single cheap row read except on the one request that actually crosses the boundary.
const LEADERBOARD_RECHECK_MS = 24 * 60 * 60 * 1000;

function maybeRecomputeLeaderboard() {
  const state = getLeaderboardState();
  if (Date.now() - state.leaderboard_last_check < LEADERBOARD_RECHECK_MS) return;

  const rows = getAllUsersForLeaderboard();
  const users = rows.map((r) => ({ id: r.id, username: r.username, character: JSON.parse(r.character_json) }));
  if (!users.length) {
    updateLeaderboardState({ leaderboard_last_check: Date.now() });
    return;
  }

  const winners = computeLeaderboardWinners(users);
  const byId = new Map(users.map((u) => [u.id, u]));
  const prevLeaderKey = {
    looks: 'looks_leader_user_id',
    networth: 'networth_leader_user_id',
    level: 'level_leader_user_id',
    height: 'height_leader_user_id',
  };
  const touched = new Set();

  Object.keys(LEADERBOARD_TITLES).forEach((category) => {
    const titleId = LEADERBOARD_TITLES[category].id;
    const prevLeaderId = state[prevLeaderKey[category]];
    const newLeaderId = winners[category];
    if (prevLeaderId === newLeaderId) return;

    if (prevLeaderId && byId.has(prevLeaderId)) {
      const prevUser = byId.get(prevLeaderId);
      const idx = prevUser.character.titles.owned.indexOf(titleId);
      if (idx >= 0) prevUser.character.titles.owned.splice(idx, 1);
      if (prevUser.character.titles.equipped === titleId) prevUser.character.titles.equipped = null;
      touched.add(prevLeaderId);
    }

    if (newLeaderId && byId.has(newLeaderId)) {
      const newUser = byId.get(newLeaderId);
      if (!newUser.character.titles.owned.includes(titleId)) newUser.character.titles.owned.push(titleId);
      newUser.character.titles.equipped = titleId;
      touched.add(newLeaderId);
    }
  });

  touched.forEach((userId) => saveCharacter(userId, byId.get(userId).character));

  updateLeaderboardState({
    leaderboard_last_check: Date.now(),
    looks_leader_user_id: winners.looks,
    networth_leader_user_id: winners.networth,
    level_leader_user_id: winners.level,
    height_leader_user_id: winners.height,
  });
}

app.use((req, res, next) => {
  maybeRecomputeLeaderboard();
  next();
});

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

// The "Reset" button used to just wipe localStorage, back when that was the only save. Now the
// character lives server-side, so that button did nothing except reload the same character --
// this actually resets it, keeping the same account/login but wiping stats, cash, and everything else.
app.post('/character/reset', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const oldCharacter = JSON.parse(user.character_json);
  const character = newCharacter(oldCharacter.firstName, oldCharacter.lastName);
  saveCharacter(user.id, character);
  res.json({ ok: true, character });
});

app.get('/players/online', requireAuth, (req, res) => {
  const rows = getMilosOnlineUsers(Date.now() - MILOS_ONLINE_WINDOW_MS);
  // Send the full character so the client can compute the same title/rank badge it
  // shows for you, instead of duplicating that display logic server-side.
  const players = rows.map((row) => ({
    username: row.username,
    character: JSON.parse(row.character_json),
    you: row.username === req.user.username,
  }));

  // Piggyback pending duel-challenge notification on this same poll rather than adding a second
  // one -- the client already hits this endpoint every 15s while in Milos.
  const pending = getPendingDuelForTarget(req.user.sub);
  const pendingDuelChallenge = pending ? { id: pending.id, attackerName: pending.attacker_name } : null;

  const pendingMarriage = getPendingMarriageProposalForTarget(req.user.sub);
  const pendingMarriageProposal = pendingMarriage ? { id: pendingMarriage.id, proposerName: pendingMarriage.proposer_name } : null;

  res.json({ ok: true, players, pendingDuelChallenge, pendingMarriageProposal });
});

// New Milos City presence. Separate from last_seen (which just means "the app is open,
// somewhere") -- these two routes are the actual signal for "looking at this tab right now".
app.post('/milos/enter', requireAuth, (req, res) => {
  touchMilosPresence(req.user.sub);
  res.json({ ok: true });
});

// Also reachable via navigator.sendBeacon on tab close/refresh, which can't set an Authorization
// header -- so this route accepts the token in the body as a fallback and verifies it manually,
// same trust level as requireAuth, just a different transport.
app.post('/milos/leave', (req, res) => {
  const header = req.headers.authorization || '';
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = headerToken || (req.body && req.body.token);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ ok: false, reason: 'Invalid or expired token.' });

  clearMilosPresence(payload.sub);
  res.json({ ok: true });
});

app.post('/players/pay', requireAuth, (req, res) => {
  const { targetUsername, amount } = req.body || {};
  if (!(amount > 0)) return res.status(429).json({ ok: false, reason: 'Enter a valid amount.' });

  const target = targetUsername ? getUserByUsername(targetUsername) : null;
  if (!target) return res.status(404).json({ ok: false, reason: 'Player not found.' });
  if (target.id === req.user.sub) return res.status(429).json({ ok: false, reason: "You can't pay yourself." });

  const payerUser = getUserById(req.user.sub);
  if (!payerUser) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const payerCharacter = JSON.parse(payerUser.character_json);
  if (payerCharacter.cash < amount) return res.status(429).json({ ok: false, reason: 'Not enough Floydbucks.' });

  payerCharacter.cash = round2(payerCharacter.cash - amount);
  saveCharacter(payerUser.id, payerCharacter);

  const targetCharacter = JSON.parse(target.character_json);
  targetCharacter.cash = round2(targetCharacter.cash + amount);
  saveCharacter(target.id, targetCharacter);
  createPaymentNotification(target.id, `${payerCharacter.firstName} ${payerCharacter.lastName}`, round2(amount));

  res.json({
    ok: true,
    message: `Paid $${amount.toFixed(2)} to ${targetCharacter.firstName} ${targetCharacter.lastName}.`,
    cls: 'gain',
    character: payerCharacter,
  });
});

function serializePaymentNotification(row) {
  return { id: row.id, payerName: row.payer_name, amount: row.amount, createdAt: row.created_at, seen: !!row.seen };
}

app.get('/notifications/payments', requireAuth, (req, res) => {
  res.json({
    ok: true,
    notifications: getPaymentNotifications(req.user.sub).map(serializePaymentNotification),
    unseenCount: getUnseenPaymentCount(req.user.sub),
  });
});

app.post('/notifications/payments/seen', requireAuth, (req, res) => {
  markPaymentNotificationsSeen(req.user.sub);
  res.json({
    ok: true,
    notifications: getPaymentNotifications(req.user.sub).map(serializePaymentNotification),
    unseenCount: getUnseenPaymentCount(req.user.sub),
  });
});

app.get('/leaderboard', requireAuth, (req, res) => {
  const rows = getAllUsersForLeaderboard();
  const users = rows.map((r) => ({ id: r.id, username: r.username, character: JSON.parse(r.character_json) }));
  const board = buildLeaderboardBoard(users);
  const state = getLeaderboardState();
  res.json({
    ok: true,
    looks: board.looks,
    networth: board.networth,
    level: board.level,
    height: board.height,
    nextRefreshAt: state.leaderboard_last_check + LEADERBOARD_RECHECK_MS,
  });
});

app.post('/players/rob', requireAuth, (req, res) => {
  const { targetUsername } = req.body || {};
  const targetUser = targetUsername ? getUserByUsername(targetUsername) : null;
  if (!targetUser) return res.status(404).json({ ok: false, reason: 'Player not found.' });
  if (targetUser.id === req.user.sub) return res.status(429).json({ ok: false, reason: "You can't rob yourself." });

  const attackerUser = getUserById(req.user.sub);
  if (!attackerUser) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const attackerCharacter = JSON.parse(attackerUser.character_json);
  const targetCharacter = JSON.parse(targetUser.character_json);

  const result = doRobPlayer(attackerCharacter, targetCharacter, targetUser.id, getServerState().modifier);
  if (!result.ok) return res.status(429).json(result);

  saveCharacter(attackerUser.id, attackerCharacter);
  saveCharacter(targetUser.id, targetCharacter);

  res.json({ ok: true, jailed: result.jailed, message: result.message, cls: result.cls, character: attackerCharacter });
});

function serializeCoinflipLobby(row) {
  return {
    id: row.id,
    creatorName: row.creator_name,
    joinerName: row.joiner_name,
    wager: row.wager,
    creatorSide: row.creator_side,
    status: row.status,
    resultSide: row.result_side,
    createdAt: row.created_at,
  };
}

app.post('/coinflip/create', requireAuth, (req, res) => {
  const { wager, side } = req.body || {};
  if (!(wager > 0)) return res.status(429).json({ ok: false, reason: 'Enter a valid wager.' });
  if (side !== 'heads' && side !== 'tails') return res.status(400).json({ ok: false, reason: 'Pick heads or tails.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  if (character.cash < wager) return res.status(429).json({ ok: false, reason: 'Not enough Floydbucks.' });

  character.cash = round2(character.cash - wager);
  saveCharacter(user.id, character);
  const lobbyId = createCoinflipLobby(user.id, `${character.firstName} ${character.lastName}`, round2(wager), side);

  res.json({ ok: true, character, lobbyId, lobbies: getOpenCoinflipLobbies().map(serializeCoinflipLobby) });
});

app.get('/coinflip/lobbies', requireAuth, (req, res) => {
  res.json({ ok: true, lobbies: getOpenCoinflipLobbies().map(serializeCoinflipLobby) });
});

app.post('/coinflip/join', requireAuth, (req, res) => {
  const { lobbyId } = req.body || {};
  const lobby = getCoinflipLobbyById(lobbyId);
  if (!lobby || lobby.status !== 'open') return res.status(409).json({ ok: false, reason: 'That lobby is no longer available.' });
  if (lobby.creator_user_id === req.user.sub) return res.status(429).json({ ok: false, reason: "You can't join your own lobby." });

  const joinerUser = getUserById(req.user.sub);
  if (!joinerUser) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const joinerCharacter = JSON.parse(joinerUser.character_json);
  if (joinerCharacter.cash < lobby.wager) return res.status(429).json({ ok: false, reason: 'Not enough Floydbucks.' });

  // Escrow the joiner's wager, then attempt the guarded claim. If someone else already claimed it
  // (or the creator cancelled) in the meantime, `changes` will be 0 and we refund immediately.
  joinerCharacter.cash = round2(joinerCharacter.cash - lobby.wager);
  saveCharacter(joinerUser.id, joinerCharacter);

  const claim = joinCoinflipLobby(lobby.id, joinerUser.id, `${joinerCharacter.firstName} ${joinerCharacter.lastName}`);
  if (claim.changes === 0) {
    joinerCharacter.cash = round2(joinerCharacter.cash + lobby.wager);
    saveCharacter(joinerUser.id, joinerCharacter);
    return res.status(409).json({ ok: false, reason: 'That lobby is no longer available.', character: joinerCharacter });
  }

  const resultSide = Math.random() < 0.5 ? 'heads' : 'tails';
  const winnerIsCreator = resultSide === lobby.creator_side;
  const winnerUserId = winnerIsCreator ? lobby.creator_user_id : joinerUser.id;
  const pot = round2(lobby.wager * 2);

  if (winnerIsCreator) {
    const creatorUser = getUserById(lobby.creator_user_id);
    if (creatorUser) {
      const creatorCharacter = JSON.parse(creatorUser.character_json);
      creatorCharacter.cash = round2(creatorCharacter.cash + pot);
      saveCharacter(creatorUser.id, creatorCharacter);
    }
  } else {
    joinerCharacter.cash = round2(joinerCharacter.cash + pot);
    saveCharacter(joinerUser.id, joinerCharacter);
  }

  resolveCoinflipLobby(lobby.id, resultSide, winnerUserId);

  res.json({
    ok: true,
    character: joinerCharacter,
    lobby: serializeCoinflipLobby(getCoinflipLobbyById(lobby.id)),
    lobbies: getOpenCoinflipLobbies().map(serializeCoinflipLobby),
  });
});

app.post('/coinflip/cancel', requireAuth, (req, res) => {
  const { lobbyId } = req.body || {};
  const lobby = getCoinflipLobbyById(lobbyId);
  if (!lobby || lobby.status !== 'open') return res.status(409).json({ ok: false, reason: 'That lobby is no longer available.' });
  if (lobby.creator_user_id !== req.user.sub) return res.status(403).json({ ok: false, reason: 'You can only cancel your own lobby.' });

  const user = getUserById(lobby.creator_user_id);
  const character = JSON.parse(user.character_json);
  character.cash = round2(character.cash + lobby.wager);
  saveCharacter(user.id, character);
  cancelCoinflipLobby(lobby.id);

  res.json({ ok: true, character, lobbies: getOpenCoinflipLobbies().map(serializeCoinflipLobby) });
});

// PvP duels. State lives entirely in the `duels` row (not either player's character_json) since
// turns arrive as two separate players' independent requests, not one round trip like PvE combat.
const DUEL_TURN_TIMEOUT_MS = 45 * 1000;

function serializeDuel(row) {
  return {
    id: row.id,
    attackerUserId: row.attacker_user_id,
    attackerName: row.attacker_name,
    targetUserId: row.target_user_id,
    targetName: row.target_name,
    status: row.status,
    turnUserId: row.turn_user_id,
    attackerHp: row.attacker_hp,
    attackerMaxHp: row.attacker_max_hp,
    targetHp: row.target_hp,
    targetMaxHp: row.target_max_hp,
    winnerUserId: row.winner_user_id,
  };
}

function finishDuel(duel, winnerUserId) {
  const attackerUser = getUserById(duel.attacker_user_id);
  const targetUser = getUserById(duel.target_user_id);
  const attackerCharacter = JSON.parse(attackerUser.character_json);
  const targetCharacter = JSON.parse(targetUser.character_json);
  const winnerIsAttacker = winnerUserId === duel.attacker_user_id;
  const winnerCharacter = winnerIsAttacker ? attackerCharacter : targetCharacter;
  const loserCharacter = winnerIsAttacker ? targetCharacter : attackerCharacter;

  applyDuelOutcome(winnerCharacter, loserCharacter);
  saveCharacter(attackerUser.id, attackerCharacter);
  saveCharacter(targetUser.id, targetCharacter);
  updateDuel(duel.id, { status: 'finished', winner_user_id: winnerUserId, last_action_at: Date.now() });
  return getDuelById(duel.id);
}

// Auto-forfeits whoever's turn timed out. Called at the top of every duel route (poll or action)
// so an abandoned duel can't block the other player forever -- no cron, just a timestamp check.
function checkDuelTimeout(duel) {
  if (duel.status !== 'active' || Date.now() - duel.last_action_at <= DUEL_TURN_TIMEOUT_MS) return duel;
  const winnerUserId = duel.turn_user_id === duel.attacker_user_id ? duel.target_user_id : duel.attacker_user_id;
  return finishDuel(duel, winnerUserId);
}

app.post('/duels/challenge', requireAuth, (req, res) => {
  const { targetUsername } = req.body || {};
  const targetUser = targetUsername ? getUserByUsername(targetUsername) : null;
  if (!targetUser) return res.status(404).json({ ok: false, reason: 'Player not found.' });
  if (targetUser.id === req.user.sub) return res.status(429).json({ ok: false, reason: "You can't duel yourself." });

  if (getPendingOrActiveDuelForUser(req.user.sub)) {
    return res.status(429).json({ ok: false, reason: 'You already have a duel pending or in progress.' });
  }
  if (getPendingOrActiveDuelForUser(targetUser.id)) {
    return res.status(429).json({ ok: false, reason: 'That player already has a duel pending or in progress.' });
  }

  const attackerUser = getUserById(req.user.sub);
  const attackerCharacter = JSON.parse(attackerUser.character_json);
  const targetCharacter = JSON.parse(targetUser.character_json);
  if (attackerCharacter.jail.inJail) return res.status(429).json({ ok: false, reason: "You can't duel from jail." });
  if (targetCharacter.jail.inJail) return res.status(429).json({ ok: false, reason: 'That player is in jail.' });

  const duelId = createDuelChallenge(
    attackerUser.id,
    `${attackerCharacter.firstName} ${attackerCharacter.lastName}`,
    targetUser.id,
    `${targetCharacter.firstName} ${targetCharacter.lastName}`
  );
  res.json({ ok: true, duelId });
});

app.post('/duels/respond', requireAuth, (req, res) => {
  const { duelId, accept } = req.body || {};
  const duel = getDuelById(duelId);
  if (!duel) return res.status(404).json({ ok: false, reason: 'Duel not found.' });
  if (duel.target_user_id !== req.user.sub) return res.status(403).json({ ok: false, reason: 'This challenge is not yours to answer.' });
  if (duel.status !== 'pending') return res.status(429).json({ ok: false, reason: 'This challenge is no longer pending.' });

  if (!accept) {
    updateDuel(duel.id, { status: 'declined' });
    return res.json({ ok: true, duel: serializeDuel(getDuelById(duel.id)) });
  }

  const attackerUser = getUserById(duel.attacker_user_id);
  const targetUser = getUserById(duel.target_user_id);
  if (!attackerUser || !targetUser) return res.status(404).json({ ok: false, reason: 'A participant no longer exists.' });
  const attackerCharacter = JSON.parse(attackerUser.character_json);
  const targetCharacter = JSON.parse(targetUser.character_json);
  const combatants = initDuelCombatants(attackerCharacter, targetCharacter);

  updateDuel(duel.id, {
    status: 'active',
    turn_user_id: duel.attacker_user_id,
    attacker_hp: combatants.attackerHp,
    attacker_max_hp: combatants.attackerMaxHp,
    target_hp: combatants.targetHp,
    target_max_hp: combatants.targetMaxHp,
    last_action_at: Date.now(),
  });

  res.json({ ok: true, duel: serializeDuel(getDuelById(duel.id)) });
});

app.post('/duels/action', requireAuth, (req, res) => {
  const { duelId, action } = req.body || {};
  let duel = getDuelById(duelId);
  if (!duel) return res.status(404).json({ ok: false, reason: 'Duel not found.' });
  if (duel.attacker_user_id !== req.user.sub && duel.target_user_id !== req.user.sub) {
    return res.status(403).json({ ok: false, reason: 'Not your duel.' });
  }

  duel = checkDuelTimeout(duel);
  if (duel.status !== 'active') return res.json({ ok: true, duel: serializeDuel(duel) });
  if (duel.turn_user_id !== req.user.sub) return res.status(403).json({ ok: false, reason: "It's not your turn." });

  const actorSide = duel.attacker_user_id === req.user.sub ? 'attacker' : 'target';
  const opponentSide = actorSide === 'attacker' ? 'target' : 'attacker';
  const attackerUser = getUserById(duel.attacker_user_id);
  const targetUser = getUserById(duel.target_user_id);
  const attackerCharacter = JSON.parse(attackerUser.character_json);
  const targetCharacter = JSON.parse(targetUser.character_json);
  const actor = actorSide === 'attacker' ? attackerCharacter : targetCharacter;
  const opponent = actorSide === 'attacker' ? targetCharacter : attackerCharacter;

  const state = {
    attackerHp: duel.attacker_hp,
    targetHp: duel.target_hp,
    attackerGuarding: !!duel.attacker_guarding,
    targetGuarding: !!duel.target_guarding,
  };

  const result = resolveDuelTurn(state, actor, opponent, actorSide, action);
  if (!result.ok) return res.status(429).json(result);

  if (result.opponentDefeated) {
    updateDuel(duel.id, {
      attacker_hp: state.attackerHp,
      target_hp: state.targetHp,
      attacker_guarding: state.attackerGuarding ? 1 : 0,
      target_guarding: state.targetGuarding ? 1 : 0,
    });
    const winnerUserId = actorSide === 'attacker' ? duel.attacker_user_id : duel.target_user_id;
    const finished = finishDuel(getDuelById(duel.id), winnerUserId);
    return res.json({ ok: true, result, duel: serializeDuel(finished) });
  }

  const nextTurnUserId = opponentSide === 'attacker' ? duel.attacker_user_id : duel.target_user_id;
  updateDuel(duel.id, {
    attacker_hp: state.attackerHp,
    target_hp: state.targetHp,
    attacker_guarding: state.attackerGuarding ? 1 : 0,
    target_guarding: state.targetGuarding ? 1 : 0,
    turn_user_id: nextTurnUserId,
    last_action_at: Date.now(),
  });

  res.json({ ok: true, result, duel: serializeDuel(getDuelById(duel.id)) });
});

app.post('/duels/forfeit', requireAuth, (req, res) => {
  const { duelId } = req.body || {};
  const duel = getDuelById(duelId);
  if (!duel) return res.status(404).json({ ok: false, reason: 'Duel not found.' });
  if (duel.attacker_user_id !== req.user.sub && duel.target_user_id !== req.user.sub) {
    return res.status(403).json({ ok: false, reason: 'Not your duel.' });
  }
  if (duel.status !== 'active') return res.json({ ok: true, duel: serializeDuel(duel) });

  const winnerUserId = duel.attacker_user_id === req.user.sub ? duel.target_user_id : duel.attacker_user_id;
  const finished = finishDuel(duel, winnerUserId);
  res.json({ ok: true, duel: serializeDuel(finished) });
});

app.get('/duels/:id', requireAuth, (req, res) => {
  let duel = getDuelById(Number(req.params.id));
  if (!duel) return res.status(404).json({ ok: false, reason: 'Duel not found.' });
  if (duel.attacker_user_id !== req.user.sub && duel.target_user_id !== req.user.sub) {
    return res.status(403).json({ ok: false, reason: 'Not your duel.' });
  }
  duel = checkDuelTimeout(duel);
  res.json({ ok: true, duel: serializeDuel(duel) });
});

// Trust-based sync for everything that isn't server-authoritative yet (equipping titles/gear,
// stat gains, etc.). The client pushes its full local character after every save() so the roster
// and other read-only views elsewhere stay current. Not a security boundary -- same as every
// other client-driven mutation until it's ported to a real do<X>() endpoint like /hustle/work.
app.post('/character/sync', requireAuth, (req, res) => {
  const { character } = req.body || {};
  if (!character || typeof character !== 'object') {
    return res.status(400).json({ ok: false, reason: 'Missing character.' });
  }
  saveCharacter(req.user.sub, character);
  res.json({ ok: true });
});

// Loads the caller's character, runs a do<X>(character, ...args) action against it, and persists
// the result if it succeeded. Every server-authoritative action route is this same shape.
function runAction(req, res, actionFn, ...args) {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });

  const character = JSON.parse(user.character_json);
  const result = actionFn(character, ...args);

  if (!result.ok) return res.status(429).json(result);

  saveCharacter(user.id, character);
  res.json(result);
}

app.post('/hustle/work', requireAuth, (req, res) => runAction(req, res, doWork));
app.post('/hustle/slut', requireAuth, (req, res) => runAction(req, res, doSlut, getRandomOtherUserCharacterName(req.user.sub)));
app.post('/hustle/crime', requireAuth, (req, res) => runAction(req, res, doCrime));

app.post('/gym/workout', requireAuth, (req, res) => runAction(req, res, doWorkout));
app.post('/gym/steroid-tier', requireAuth, (req, res) => {
  const { tierId } = req.body || {};
  runAction(req, res, doSetSteroidTier, tierId ?? null);
});
app.post('/gym/roid-escape', requireAuth, (req, res) => runAction(req, res, doRoidEscape));
app.post('/gym/exercise', requireAuth, (req, res) => {
  const { bodyPart, exerciseKey } = req.body || {};
  runAction(req, res, doBodyExercise, bodyPart, exerciseKey);
});
app.post('/gym/stretch-height', requireAuth, (req, res) => runAction(req, res, doStretchForHeight));

app.post('/market/food', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  runAction(req, res, doBuyFood, itemId);
});
app.post('/market/maxx', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  runAction(req, res, doBuyMaxx, itemId);
});

app.post('/casino/buy-chips', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doBuyChips, amount);
});
app.post('/casino/cash-out', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doCashOut, amount);
});
app.post('/casino/blackjack/deal', requireAuth, (req, res) => {
  const { bet } = req.body || {};
  runAction(req, res, doBjDeal, bet);
});
app.post('/casino/blackjack/hit', requireAuth, (req, res) => runAction(req, res, doBjHit));
app.post('/casino/blackjack/stand', requireAuth, (req, res) => runAction(req, res, doBjStand));
app.post('/casino/slots/spin', requireAuth, (req, res) => {
  const { bet } = req.body || {};
  runAction(req, res, doSlotSpin, bet);
});

app.post('/bank/deposit', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doBankDeposit, amount);
});
app.post('/bank/withdraw', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doBankWithdraw, amount);
});
app.post('/bank/upgrade', requireAuth, (req, res) => runAction(req, res, doBankUpgrade));
app.post('/bank/apply-credit', requireAuth, (req, res) => runAction(req, res, doBankApplyCredit));
app.post('/bank/cash-advance', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doBankCashAdvance, amount);
});
app.post('/bank/pay-credit', requireAuth, (req, res) => runAction(req, res, doBankPayCredit));

app.post('/gunclub/gun', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  runAction(req, res, doBuyGun, itemId, getServerState().modifier);
});
app.post('/gunclub/melee', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  runAction(req, res, doBuyMelee, itemId);
});
app.post('/gunclub/ammo', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  runAction(req, res, doBuyAmmo, itemId, getServerState().modifier);
});
app.post('/gunclub/concealed-permit', requireAuth, (req, res) => runAction(req, res, doApplyConcealedPermit));

app.post('/jobs/good/apply', requireAuth, (req, res) => {
  const { jobId } = req.body || {};
  runAction(req, res, doApplyGoodJob, jobId);
});
app.post('/jobs/good/resign', requireAuth, (req, res) => runAction(req, res, doResignGoodJob));
app.post('/jobs/good/work', requireAuth, (req, res) => {
  const { skillKey } = req.body || {};
  runAction(req, res, doGoodJobWork, skillKey);
});

app.post('/jobs/bad/apply', requireAuth, (req, res) => {
  const { jobId } = req.body || {};
  runAction(req, res, doApplyBadJob, jobId);
});
app.post('/jobs/bad/resign', requireAuth, (req, res) => runAction(req, res, doResignBadJob));
app.post('/jobs/bad/work', requireAuth, (req, res) => {
  const { skillKey } = req.body || {};
  runAction(req, res, doBadJobWork, skillKey);
});

app.post('/jobs/gear', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  runAction(req, res, doBuyGear, itemId);
});

app.post('/dealer/quick-deal', requireAuth, (req, res) => {
  const { dealerId } = req.body || {};
  runAction(req, res, doDealerQuickDeal, dealerId);
});
app.post('/dealer/buy', requireAuth, (req, res) => {
  const { dealerId, qty } = req.body || {};
  runAction(req, res, doBuyFromDealer, dealerId, qty);
});
app.post('/drugs/sell', requireAuth, (req, res) => {
  const { drugId, qty } = req.body || {};
  runAction(req, res, doSellDrugs, drugId, qty);
});
app.post('/robbery', requireAuth, (req, res) => runAction(req, res, doRobbery, getServerState().modifier));

app.post('/combat/start', requireAuth, (req, res) => runAction(req, res, doStartFight));
app.post('/combat/action', requireAuth, (req, res) => {
  const { action } = req.body || {};
  runAction(req, res, doCombatAction, action, getServerState().modifier);
});
app.post('/combat/flee', requireAuth, (req, res) => runAction(req, res, doFlee));

app.post('/crime/attempt', requireAuth, (req, res) => {
  const { tierId } = req.body || {};
  runAction(req, res, doAttemptCrime, tierId);
});
app.post('/crime/community-service', requireAuth, (req, res) => runAction(req, res, doCommunityService));

app.post('/jail/hire-lawyer', requireAuth, (req, res) => runAction(req, res, doHireLawyer));
app.post('/jail/workout', requireAuth, (req, res) => runAction(req, res, doJailWorkout));
app.post('/jail/fight', requireAuth, (req, res) => runAction(req, res, doJailFight));
app.post('/jail/contraband', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  runAction(req, res, doBuyContraband, itemId);
});

app.post('/cityhall/rename', requireAuth, (req, res) => {
  const { first, last } = req.body || {};
  runAction(req, res, doCityHallRename, first, last);
});
app.post('/cityhall/propose', requireAuth, (req, res) => {
  const { name } = req.body || {};
  const targetUser = name ? getUserByUsername(name) : null;
  if (!targetUser) return res.status(404).json({ ok: false, reason: 'Player not found.' });
  if (targetUser.id === req.user.sub) return res.status(429).json({ ok: false, reason: "You can't propose to yourself." });

  const proposerUser = getUserById(req.user.sub);
  const proposerCharacter = JSON.parse(proposerUser.character_json);
  const targetCharacter = JSON.parse(targetUser.character_json);
  if (proposerCharacter.marriage.spouseUserId) return res.status(429).json({ ok: false, reason: 'You are already married.' });
  if (targetCharacter.marriage.spouseUserId) return res.status(429).json({ ok: false, reason: 'That player is already married.' });
  if (getPendingOrAcceptedProposalForUser(req.user.sub)) {
    return res.status(429).json({ ok: false, reason: 'You already have a proposal pending.' });
  }
  if (getPendingOrAcceptedProposalForUser(targetUser.id)) {
    return res.status(429).json({ ok: false, reason: 'That player already has a proposal pending.' });
  }

  const proposalId = createMarriageProposal(
    proposerUser.id,
    `${proposerCharacter.firstName} ${proposerCharacter.lastName}`,
    targetUser.id,
    `${targetCharacter.firstName} ${targetCharacter.lastName}`
  );
  proposerCharacter.marriage.proposedTo = `${targetCharacter.firstName} ${targetCharacter.lastName}`;
  saveCharacter(proposerUser.id, proposerCharacter);
  res.json({
    ok: true,
    proposalId,
    message: `Proposal sent to ${targetCharacter.firstName} ${targetCharacter.lastName}.`,
    cls: 'gain',
    character: proposerCharacter,
  });
});
app.post('/cityhall/respond', requireAuth, (req, res) => {
  const { proposalId, accept } = req.body || {};
  const proposal = getMarriageProposalById(proposalId);
  if (!proposal) return res.status(404).json({ ok: false, reason: 'Proposal not found.' });
  if (proposal.target_user_id !== req.user.sub) return res.status(403).json({ ok: false, reason: 'This proposal is not yours to answer.' });
  if (proposal.status !== 'pending') return res.status(429).json({ ok: false, reason: 'This proposal is no longer pending.' });

  if (!accept) {
    updateMarriageProposal(proposal.id, { status: 'declined' });
    const proposerUser = getUserById(proposal.proposer_user_id);
    if (proposerUser) {
      const proposerCharacter = JSON.parse(proposerUser.character_json);
      proposerCharacter.marriage.proposedTo = null;
      saveCharacter(proposerUser.id, proposerCharacter);
    }
    return res.json({ ok: true, accepted: false });
  }

  const proposerUser = getUserById(proposal.proposer_user_id);
  const targetUser = getUserById(proposal.target_user_id);
  if (!proposerUser || !targetUser) return res.status(404).json({ ok: false, reason: 'A participant no longer exists.' });
  const proposerCharacter = JSON.parse(proposerUser.character_json);
  const targetCharacter = JSON.parse(targetUser.character_json);

  proposerCharacter.marriage.spouseUserId = targetUser.id;
  proposerCharacter.marriage.spouseName = `${targetCharacter.firstName} ${targetCharacter.lastName}`;
  proposerCharacter.marriage.proposedTo = null;
  targetCharacter.marriage.spouseUserId = proposerUser.id;
  targetCharacter.marriage.spouseName = `${proposerCharacter.firstName} ${proposerCharacter.lastName}`;
  targetCharacter.marriage.proposedTo = null;
  saveCharacter(proposerUser.id, proposerCharacter);
  saveCharacter(targetUser.id, targetCharacter);

  updateMarriageProposal(proposal.id, { status: 'accepted' });
  res.json({ ok: true, accepted: true, character: targetCharacter });
});
app.post('/cityhall/gun-safety-result', requireAuth, (req, res) => {
  const { passed } = req.body || {};
  runAction(req, res, doGunSafetyResult, !!passed);
});

app.post('/range/shoot', requireAuth, (req, res) => {
  const { weaponId } = req.body || {};
  runAction(req, res, doRangeShoot, weaponId);
});
app.post('/range/draw', requireAuth, (req, res) => runAction(req, res, doRangeDraw));
app.post('/range/reload', requireAuth, (req, res) => runAction(req, res, doRangeReload));

// Matches the shape the client's localStorage-backed market used to store: id/sellerName/itemId/
// qty/pricePerUnit/listedAt.
function serializeListing(row) {
  return {
    id: row.id,
    sellerName: row.seller_name,
    itemId: row.item_id,
    qty: row.qty,
    pricePerUnit: row.price_per_unit,
    listedAt: row.listed_at,
  };
}

app.get('/mtn/listings', requireAuth, (req, res) => {
  res.json({ ok: true, listings: getAllListings().map(serializeListing) });
});

app.post('/mtn/list', requireAuth, (req, res) => {
  const { itemId, qty, pricePerUnit } = req.body || {};
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });

  const character = JSON.parse(user.character_json);
  const result = doCreateListing(character, itemId, qty, pricePerUnit);
  if (!result.ok) return res.status(429).json(result);

  createListing(user.id, `${character.firstName} ${character.lastName}`, itemId, qty, round2(pricePerUnit));
  saveCharacter(user.id, character);
  res.json({ ...result, listings: getAllListings().map(serializeListing) });
});

app.post('/mtn/cancel', requireAuth, (req, res) => {
  const { listingId } = req.body || {};
  const listing = getListingById(listingId);
  if (!listing) return res.status(404).json({ ok: false, reason: 'That listing is no longer available.' });
  if (listing.seller_user_id !== req.user.sub) {
    return res.status(403).json({ ok: false, reason: 'You can only cancel your own listings.' });
  }

  const user = getUserById(req.user.sub);
  const character = JSON.parse(user.character_json);
  const result = doCancelListing(character, listing.item_id, listing.qty);

  deleteListing(listing.id);
  saveCharacter(user.id, character);
  res.json({ ...result, listings: getAllListings().map(serializeListing) });
});

app.post('/mtn/buy', requireAuth, (req, res) => {
  const { listingId } = req.body || {};
  const listing = getListingById(listingId);
  if (!listing) return res.status(404).json({ ok: false, reason: 'That listing is no longer available.' });

  const buyerUser = getUserById(req.user.sub);
  if (!buyerUser) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const buyerCharacter = JSON.parse(buyerUser.character_json);
  const total = round2(listing.price_per_unit * listing.qty);

  const result = doBuyListing(buyerCharacter, listing.item_id, listing.qty, total, listing.seller_name);
  if (!result.ok) return res.status(429).json(result);

  if (listing.seller_user_id === req.user.sub) {
    // Buying your own listing: credit the same character back (net zero), same outcome as the
    // single-player version's self-purchase special case.
    creditSellerForSale(buyerCharacter, listing.item_id, listing.qty, total, `${buyerCharacter.firstName} ${buyerCharacter.lastName}`);
    deleteListing(listing.id);
    saveCharacter(buyerUser.id, buyerCharacter);
  } else {
    const sellerUser = getUserById(listing.seller_user_id);
    deleteListing(listing.id);
    saveCharacter(buyerUser.id, buyerCharacter);
    if (sellerUser) {
      const sellerCharacter = JSON.parse(sellerUser.character_json);
      creditSellerForSale(sellerCharacter, listing.item_id, listing.qty, total, `${buyerCharacter.firstName} ${buyerCharacter.lastName}`);
      saveCharacter(sellerUser.id, sellerCharacter);
    }
  }

  res.json({ ...result, listings: getAllListings().map(serializeListing) });
});

const BAIL_RATE_PER_YEAR = 150; // matches Hire Lawyer's rate

function serializePenitentiaryRecord(row) {
  return {
    id: row.id,
    playerName: row.player_name,
    crime: row.crime,
    yearsTotal: row.years_total,
    yearsRemaining: row.years_remaining,
    arrestedAt: row.arrested_at,
    releasedAt: row.released_at,
    commissaryReceived: row.commissary_received,
  };
}

// Mirrors the client's syncPenitentiaryRecord() exactly, but against the shared table instead of
// localStorage, keyed by real user id instead of name-matching. The client calls this on every
// render (same as before), so any jail-state change -- server-side bust or client-side serve-time
// release -- shows up in the public registry.
app.post('/penitentiary/sync', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const active = getActivePenitentiaryRecord(user.id);

  if (character.jail.inJail) {
    if (!active) {
      createPenitentiaryRecord(user.id, `${character.firstName} ${character.lastName}`, character.jail.crime || 'Crime', character.jail.yearsRemaining);
    } else if (active.years_remaining !== character.jail.yearsRemaining) {
      updatePenitentiaryYearsRemaining(active.id, character.jail.yearsRemaining);
    }
  } else if (active) {
    releasePenitentiaryRecord(active.id);
  }
  res.json({ ok: true });
});

app.get('/penitentiary/records', requireAuth, (req, res) => {
  res.json({ ok: true, records: getAllPenitentiaryRecords().map(serializePenitentiaryRecord) });
});

app.post('/penitentiary/bail', requireAuth, (req, res) => {
  const { recordId } = req.body || {};
  const record = getPenitentiaryRecordById(recordId);
  if (!record || record.released_at !== null || record.years_remaining <= 0) {
    return res.status(429).json({ ok: false, reason: 'Already released.' });
  }

  const payerUser = getUserById(req.user.sub);
  if (!payerUser) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const payerCharacter = JSON.parse(payerUser.character_json);
  const cost = Math.round(record.years_remaining * BAIL_RATE_PER_YEAR);
  if (payerCharacter.cash < cost) return res.status(429).json({ ok: false, reason: 'Not enough Floydbucks.' });

  payerCharacter.cash = round2(payerCharacter.cash - cost);
  releasePenitentiaryRecord(record.id);

  if (record.user_id === payerUser.id) {
    payerCharacter.jail.inJail = false;
    payerCharacter.jail.crime = null;
    payerCharacter.jail.yearsRemaining = 0;
    payerCharacter.jail.serving = false;
    saveCharacter(payerUser.id, payerCharacter);
  } else {
    saveCharacter(payerUser.id, payerCharacter);
    const inmateUser = getUserById(record.user_id);
    if (inmateUser) {
      const inmateCharacter = JSON.parse(inmateUser.character_json);
      inmateCharacter.jail.inJail = false;
      inmateCharacter.jail.crime = null;
      inmateCharacter.jail.yearsRemaining = 0;
      inmateCharacter.jail.serving = false;
      saveCharacter(inmateUser.id, inmateCharacter);
    }
  }

  res.json({
    ok: true,
    message: `Posted bail for ${record.player_name} ($${cost.toLocaleString()}).`,
    cls: 'gain',
    character: payerCharacter,
    records: getAllPenitentiaryRecords().map(serializePenitentiaryRecord),
  });
});

app.post('/penitentiary/commissary', requireAuth, (req, res) => {
  const { recordId, amount } = req.body || {};
  if (!(amount > 0)) return res.status(429).json({ ok: false, reason: 'Enter a valid amount.' });
  const record = getPenitentiaryRecordById(recordId);
  if (!record) return res.status(429).json({ ok: false, reason: 'That inmate is no longer listed.' });

  const payerUser = getUserById(req.user.sub);
  if (!payerUser) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const payerCharacter = JSON.parse(payerUser.character_json);
  if (payerCharacter.cash < amount) return res.status(429).json({ ok: false, reason: 'Not enough Floydbucks.' });

  payerCharacter.cash = round2(payerCharacter.cash - amount);
  addPenitentiaryCommissary(record.id, amount);

  if (record.user_id === payerUser.id) {
    // Sending to yourself nets back to zero, same as the single-player version's special case.
    payerCharacter.cash = round2(payerCharacter.cash + amount);
    saveCharacter(payerUser.id, payerCharacter);
  } else {
    saveCharacter(payerUser.id, payerCharacter);
    const inmateUser = getUserById(record.user_id);
    if (inmateUser) {
      const inmateCharacter = JSON.parse(inmateUser.character_json);
      inmateCharacter.cash = round2(inmateCharacter.cash + amount);
      saveCharacter(inmateUser.id, inmateCharacter);
    }
  }

  res.json({
    ok: true,
    message: `Sent $${amount.toFixed(2)} to ${record.player_name}'s commissary.`,
    cls: 'gain',
    character: payerCharacter,
    records: getAllPenitentiaryRecords().map(serializePenitentiaryRecord),
  });
});

// Matches the client's hardcoded admin password gate (js/admin.js) -- previously only enforced
// client-side (trivially bypassable via devtools), now actually checked server-side too. Also
// restricted to a single allowed username -- req.user.username comes from the signed JWT (see
// auth.js), so unlike a client-supplied value this can't be spoofed.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fishdoc15!';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'mrleems').toLowerCase();

function requireAdminPassword(req, res, next) {
  if ((req.user?.username || '').toLowerCase() !== ADMIN_USERNAME) {
    return res.status(403).json({ ok: false, reason: 'Not authorized.' });
  }
  if (req.body?.adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ ok: false, reason: 'Incorrect admin password.' });
  }
  next();
}

// Server state (pause + modifier) is public to any logged-in player -- everyone needs to see the
// pause banner and active modifier, not just admins.
app.get('/admin/state', requireAuth, (req, res) => {
  res.json({ ok: true, state: getServerState() });
});

app.post('/admin/pause', requireAuth, requireAdminPassword, (req, res) => {
  const { paused } = req.body || {};
  setServerPaused(!!paused);
  res.json({ ok: true, state: getServerState() });
});

app.post('/admin/modifier', requireAuth, requireAdminPassword, (req, res) => {
  const { modifier } = req.body || {};
  setServerModifier(modifier || null);
  res.json({ ok: true, state: getServerState() });
});

app.post('/admin/inventory', requireAuth, requireAdminPassword, (req, res) => {
  const { username } = req.body || {};
  const query = (username || '').trim();
  if (!query) return res.status(400).json({ ok: false, reason: 'Enter a username.' });

  const user = getUserByUsername(query);
  if (!user) return res.status(404).json({ ok: false, reason: `No player named "${query}" found.` });

  const character = JSON.parse(user.character_json);
  res.json({
    ok: true,
    name: `${character.firstName} ${character.lastName}`,
    inventory: character.inventory,
    equipment: character.equipment,
  });
});

// New Milos City chat. senderName is always derived from the caller's own authoritative
// character (can't be spoofed); titleText is client-supplied since the title catalog itself is
// only known client-side (crate titles etc.) -- same trust level as titles.equipped already has
// everywhere else (nothing server-side has ever validated title ownership on that field).
function serializeChatMessage(row) {
  return {
    id: row.id,
    senderName: row.sender_name,
    titleText: row.title_text,
    message: row.message,
    sentAt: row.sent_at,
  };
}

const CHAT_MESSAGE_MAX_LEN = 500;
const CHAT_TITLE_MAX_LEN = 40;

app.get('/chat/messages', requireAuth, (req, res) => {
  res.json({ ok: true, messages: getRecentChatMessages().map(serializeChatMessage) });
});

app.post('/chat/send', requireAuth, (req, res) => {
  const { titleText, message } = req.body || {};
  const trimmed = (message || '').trim();
  if (!trimmed) return res.status(400).json({ ok: false, reason: 'Enter a message.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const senderName = `${character.firstName} ${character.lastName}`;
  const safeTitleText = (titleText || 'CIVILIAN').slice(0, CHAT_TITLE_MAX_LEN);

  createChatMessage(user.id, senderName, safeTitleText, trimmed.slice(0, CHAT_MESSAGE_MAX_LEN));
  res.json({ ok: true, messages: getRecentChatMessages().map(serializeChatMessage) });
});

// ---------- Multiplayer casino tables (Blackjack + Roulette) ----------
// Table lifecycle lives in casino_tables/casino_table_seats (shared rows), not character_json --
// up to 5 seated players' browsers, each polling independently, need the same authoritative seat
// list, countdown deadline, and dealer/wheel state. Every route checks the deadline first (same
// check-on-poll idiom as duel timeouts) and advances the round if it's passed -- no cron.
const TABLE_COUNTDOWN_MS = 30 * 1000;
const TABLE_ROUND_TIMEOUT_MS = 30 * 1000;

function serializeCasinoTable(table, seats) {
  return {
    id: table.id,
    game: table.game,
    phase: table.phase,
    roundEndsAt: table.round_ends_at,
    dealerCards: table.dealer_cards_json ? JSON.parse(table.dealer_cards_json) : [],
    rouletteResult: table.roulette_result,
    seats: seats.map((s) => ({
      seatIndex: s.seat_index,
      userId: s.user_id,
      playerName: s.player_name,
      bet: s.bet,
      bjCards: s.bj_cards_json ? JSON.parse(s.bj_cards_json) : [],
      bjPhase: s.bj_phase,
      rouletteBets: s.roulette_bets_json ? JSON.parse(s.roulette_bets_json) : [],
    })),
  };
}

function resolveBlackjackTableRound(table, seats) {
  const dealerCards = JSON.parse(table.dealer_cards_json);
  // Dealer draws to 17 exactly once, shared by every seated hand -- unless every bettor already
  // busted, in which case there's nothing left to settle against and drawing further is pointless.
  const anyoneStillIn = seats.some((s) => s.bet > 0 && handTotal(JSON.parse(s.bj_cards_json)) <= 21);
  if (anyoneStillIn) {
    while (handTotal(dealerCards) < 17) dealerCards.push(drawCard());
  }
  const outcomes = [];
  seats.filter((s) => s.bet > 0).forEach((seat) => {
    const cards = JSON.parse(seat.bj_cards_json);
    const { payout, message } = computeTableBlackjackPayout(cards, dealerCards, seat.bet);
    const user = getUserById(seat.user_id);
    if (user) {
      const character = JSON.parse(user.character_json);
      character.chips += payout;
      saveCharacter(user.id, character);
    }
    outcomes.push({ userId: seat.user_id, playerName: seat.player_name, payout, message });
    updateSeat(seat.id, { bet: 0, bj_cards_json: null, bj_phase: null });
  });
  updateCasinoTable(table.id, {
    phase: 'countdown',
    round_ends_at: Date.now() + TABLE_COUNTDOWN_MS,
    dealer_cards_json: null,
  });
  return { dealerCards, outcomes };
}

function resolveRouletteTableRound(table, seats) {
  const resultNumber = spinRoulette();
  const outcomes = [];
  seats.filter((s) => s.roulette_bets_json).forEach((seat) => {
    const bets = JSON.parse(seat.roulette_bets_json);
    const totalPayout = bets.reduce((sum, bet) => sum + evaluateRouletteBet(bet, resultNumber), 0);
    const user = getUserById(seat.user_id);
    if (user && totalPayout > 0) {
      const character = JSON.parse(user.character_json);
      character.chips += totalPayout;
      saveCharacter(user.id, character);
    }
    outcomes.push({ userId: seat.user_id, playerName: seat.player_name, payout: totalPayout });
    updateSeat(seat.id, { roulette_bets_json: null });
  });
  updateCasinoTable(table.id, {
    phase: 'countdown',
    round_ends_at: Date.now() + TABLE_COUNTDOWN_MS,
    roulette_result: resultNumber,
  });
  return { resultNumber, outcomes };
}

// Deals every seat that placed a bet, plus the dealer -- natural blackjacks (either side) lock
// that seat immediately, same rule as the single-player version.
function startBlackjackRound(table, seats) {
  const dealerCards = [drawCard(), drawCard()];
  const dealerBJ = isBlackjack(dealerCards);
  const bettingSeats = seats.filter((s) => s.bet > 0);

  if (bettingSeats.length === 0) {
    updateCasinoTable(table.id, { phase: 'countdown', round_ends_at: Date.now() + TABLE_COUNTDOWN_MS });
    return;
  }

  bettingSeats.forEach((seat) => {
    const cards = [drawCard(), drawCard()];
    const phase = dealerBJ || isBlackjack(cards) ? 'done' : 'playerTurn';
    updateSeat(seat.id, { bj_cards_json: JSON.stringify(cards), bj_phase: phase });
  });

  updateCasinoTable(table.id, {
    phase: 'in_round',
    dealer_cards_json: JSON.stringify(dealerCards),
    round_ends_at: Date.now() + TABLE_ROUND_TIMEOUT_MS,
  });
}

// Auto-stands any seat still mid-hand once the round timer runs out, so one AFK player can't
// stall the table forever, then resolves. Called only when the deadline has actually passed.
function forceResolveStalledBlackjackRound(table, seats) {
  seats.filter((s) => s.bet > 0 && s.bj_phase === 'playerTurn').forEach((seat) => {
    updateSeat(seat.id, { bj_phase: 'done' });
  });
  return resolveBlackjackTableRound(table, getSeatsForTable(table.id));
}

// The single check-on-poll entry point: advances countdown -> round-start, and (for blackjack)
// resolves a round once every seat is done or the round timer has lapsed. `lastRoundResult` is
// only set the moment a round resolves, so the client can show the final hand/payout once even
// though the table itself has already reset to a fresh countdown for the next round.
function advanceCasinoTableIfDue(table) {
  const seats = getSeatsForTable(table.id);

  if (table.phase === 'countdown' && Date.now() >= table.round_ends_at) {
    let lastRoundResult = null;
    if (table.game === 'blackjack') startBlackjackRound(table, seats);
    else lastRoundResult = { roulette: resolveRouletteTableRound(table, seats) };
    return { table: getCasinoTableById(table.id), seats: getSeatsForTable(table.id), lastRoundResult };
  }

  if (table.game === 'blackjack' && table.phase === 'in_round') {
    const bettingSeats = seats.filter((s) => s.bet > 0);
    const allDone = bettingSeats.length > 0 && bettingSeats.every((s) => s.bj_phase === 'done');
    if (allDone) {
      const result = resolveBlackjackTableRound(table, seats);
      return { table: getCasinoTableById(table.id), seats: getSeatsForTable(table.id), lastRoundResult: { blackjack: result } };
    }
    if (Date.now() >= table.round_ends_at) {
      const result = forceResolveStalledBlackjackRound(table, seats);
      return { table: getCasinoTableById(table.id), seats: getSeatsForTable(table.id), lastRoundResult: { blackjack: result } };
    }
  }

  return { table, seats, lastRoundResult: null };
}

app.post('/casino/table/join', requireAuth, (req, res) => {
  const { game } = req.body || {};
  if (game !== 'blackjack' && game !== 'roulette') return res.status(400).json({ ok: false, reason: 'Unknown table game.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);

  let table = getOpenCasinoTable(game);
  if (!table) {
    const tableId = createCasinoTable(game);
    table = getCasinoTableById(tableId);
  }

  const existingSeat = getSeatForUser(table.id, user.id);
  if (!existingSeat) {
    const seatId = takeSeat(table.id, user.id, `${character.firstName} ${character.lastName}`);
    if (seatId === null) return res.status(409).json({ ok: false, reason: 'That table just filled up. Try again.' });
    if (table.phase === 'waiting') {
      updateCasinoTable(table.id, { phase: 'countdown', round_ends_at: Date.now() + TABLE_COUNTDOWN_MS });
    }
  }

  const advanced = advanceCasinoTableIfDue(getCasinoTableById(table.id));
  res.json({ ok: true, lastRoundResult: advanced.lastRoundResult, ...serializeCasinoTable(advanced.table, advanced.seats) });
});

app.post('/casino/table/leave', requireAuth, (req, res) => {
  const { tableId } = req.body || {};
  const table = getCasinoTableById(tableId);
  if (!table) return res.status(404).json({ ok: false, reason: 'Table not found.' });
  const seat = getSeatForUser(table.id, req.user.sub);
  if (seat) leaveSeat(seat.id);
  deleteCasinoTableIfEmpty(table.id);
  res.json({ ok: true });
});

app.get('/casino/table/:id', requireAuth, (req, res) => {
  const table = getCasinoTableById(Number(req.params.id));
  if (!table) return res.status(404).json({ ok: false, reason: 'Table not found.' });
  const advanced = advanceCasinoTableIfDue(table);
  res.json({ ok: true, lastRoundResult: advanced.lastRoundResult, ...serializeCasinoTable(advanced.table, advanced.seats) });
});

app.post('/casino/table/blackjack/bet', requireAuth, (req, res) => {
  const { tableId, bet } = req.body || {};
  if (!(bet > 0)) return res.status(429).json({ ok: false, reason: 'Enter a valid bet.' });
  let table = getCasinoTableById(tableId);
  if (!table || table.game !== 'blackjack') return res.status(404).json({ ok: false, reason: 'Table not found.' });

  table = advanceCasinoTableIfDue(table).table;
  if (table.phase !== 'countdown') return res.status(429).json({ ok: false, reason: 'Betting is closed for this round.' });

  const seat = getSeatForUser(table.id, req.user.sub);
  if (!seat) return res.status(404).json({ ok: false, reason: 'You are not seated at this table.' });
  if (seat.bet > 0) return res.status(429).json({ ok: false, reason: 'You already placed a bet this round.' });

  const user = getUserById(req.user.sub);
  const character = JSON.parse(user.character_json);
  if (character.chips < bet) return res.status(429).json({ ok: false, reason: 'Not enough Chips.' });

  character.chips -= bet;
  saveCharacter(user.id, character);
  updateSeat(seat.id, { bet });

  const advanced = advanceCasinoTableIfDue(getCasinoTableById(table.id));
  res.json({ ok: true, character, lastRoundResult: advanced.lastRoundResult, ...serializeCasinoTable(advanced.table, advanced.seats) });
});

app.post('/casino/table/blackjack/hit', requireAuth, (req, res) => {
  const { tableId } = req.body || {};
  let table = getCasinoTableById(tableId);
  if (!table || table.game !== 'blackjack') return res.status(404).json({ ok: false, reason: 'Table not found.' });

  table = advanceCasinoTableIfDue(table).table;
  const seat = getSeatForUser(table.id, req.user.sub);
  if (!seat) return res.status(404).json({ ok: false, reason: 'You are not seated at this table.' });
  if (table.phase !== 'in_round' || seat.bj_phase !== 'playerTurn') {
    return res.status(429).json({ ok: false, reason: 'No hand in progress.' });
  }

  const cards = JSON.parse(seat.bj_cards_json);
  cards.push(drawCard());
  const total = handTotal(cards);
  const phase = total >= 21 ? 'done' : 'playerTurn';
  updateSeat(seat.id, { bj_cards_json: JSON.stringify(cards), bj_phase: phase });

  const advanced = advanceCasinoTableIfDue(getCasinoTableById(table.id));
  res.json({ ok: true, lastRoundResult: advanced.lastRoundResult, ...serializeCasinoTable(advanced.table, advanced.seats) });
});

app.post('/casino/table/blackjack/stand', requireAuth, (req, res) => {
  const { tableId } = req.body || {};
  let table = getCasinoTableById(tableId);
  if (!table || table.game !== 'blackjack') return res.status(404).json({ ok: false, reason: 'Table not found.' });

  table = advanceCasinoTableIfDue(table).table;
  const seat = getSeatForUser(table.id, req.user.sub);
  if (!seat) return res.status(404).json({ ok: false, reason: 'You are not seated at this table.' });
  if (table.phase !== 'in_round' || seat.bj_phase !== 'playerTurn') {
    return res.status(429).json({ ok: false, reason: 'No hand in progress.' });
  }

  updateSeat(seat.id, { bj_phase: 'done' });

  const advanced = advanceCasinoTableIfDue(getCasinoTableById(table.id));
  res.json({ ok: true, lastRoundResult: advanced.lastRoundResult, ...serializeCasinoTable(advanced.table, advanced.seats) });
});

app.post('/casino/table/roulette/bet', requireAuth, (req, res) => {
  const { tableId, bets } = req.body || {};
  if (!Array.isArray(bets) || bets.length === 0) return res.status(429).json({ ok: false, reason: 'Place at least one bet.' });
  let table = getCasinoTableById(tableId);
  if (!table || table.game !== 'roulette') return res.status(404).json({ ok: false, reason: 'Table not found.' });

  table = advanceCasinoTableIfDue(table).table;
  if (table.phase !== 'countdown') return res.status(429).json({ ok: false, reason: 'Betting is closed for this round.' });

  const seat = getSeatForUser(table.id, req.user.sub);
  if (!seat) return res.status(404).json({ ok: false, reason: 'You are not seated at this table.' });
  if (seat.roulette_bets_json) return res.status(429).json({ ok: false, reason: 'You already placed bets this round.' });

  const total = bets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  if (!(total > 0)) return res.status(429).json({ ok: false, reason: 'Enter valid bet amounts.' });

  const user = getUserById(req.user.sub);
  const character = JSON.parse(user.character_json);
  if (character.chips < total) return res.status(429).json({ ok: false, reason: 'Not enough Chips.' });

  character.chips -= total;
  saveCharacter(user.id, character);
  updateSeat(seat.id, { roulette_bets_json: JSON.stringify(bets) });

  const advanced = advanceCasinoTableIfDue(getCasinoTableById(table.id));
  res.json({ ok: true, character, lastRoundResult: advanced.lastRoundResult, ...serializeCasinoTable(advanced.table, advanced.seats) });
});

app.listen(PORT, () => {
  console.log(`mfmmoalpha-server listening on port ${PORT}`);
});
