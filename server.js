require('dotenv').config();
// redeploy marker

const express = require('express');
const cors = require('cors');

const {
  createUser,
  getUserByUsername,
  getRandomOtherUserCharacterName,
  getUserById,
  saveCharacter,
  getCharacterRev,
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
  setServerMaintenance,
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
} = require('./db');
const { hashPassword, checkPassword, issueToken, requireAuth, verifyToken } = require('./auth');
const {
  newCharacter,
  resetCharacterKeepCosmetics,
  doWork,
  doSlut,
  doCrime,
  doWorkout,
  doSetSteroidTier,
  doRoidEscape,
  doStretchForHeight,
  doBuyFood,
  doBuyMaxx,
  doBuyChips,
  doCashOut,
  doBjDeal,
  doBjHit,
  doBjStand,
  doBjDouble,
  doBjSplit,
  doSlotSpin,
  drawCard,
  handTotal,
  isBlackjack,
  spinRoulette,
  evaluateRouletteBet,
  doRouletteSpin,
  doBankDeposit,
  doBankWithdraw,
  doBankUpgrade,
  doBankApplyCredit,
  doBankCashAdvance,
  doBankPayCredit,
  doBuyGun,
  doBuyMelee,
  doBuyAmmo,
  doBuyArmor,
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
  doSlimePlayer,
  isSlimed,
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
  round4,
  LEADERBOARD_TITLES,
  computeLeaderboardWinners,
  buildLeaderboardBoard,
  ensureFarmsState,
  doBuyFarmPlot,
  doPrepFarmPlot,
  doPlantFarmSeed,
  doCollectFarmHarvest,
  doBuyFarmSecurity,
  advanceFarmPlot,
  ensureCryptoState,
  doBuyCryptoUpgrade,
  doCollectCrypto,
  doSellFC,
  doBuyFC,
  ALTCOIN_SUPPLY,
  altcoinPriceAt,
  doMintAltcoin,
  doBuyAltcoinCoins,
  altcoinDumpPayout,
  altcoinFullBuyoutPayout,
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

// Auto-attaches the caller's current character_rev to any response that includes a `character` --
// powers /character/sync's stale-write check (see below) without having to thread rev through
// every single route by hand (60+ single-character routes via runAction, plus a dozen+
// two-character PvP/marketplace routes). Works because this wraps res.json before requireAuth
// runs, but only actually reads req.user at the moment the route handler calls res.json, by which
// point requireAuth (earlier in this same request's middleware chain) has already set it.
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && body.character && typeof body.rev === 'undefined' && req.user && req.user.sub) {
      body.rev = getCharacterRev(req.user.sub);
    }
    return originalJson(body);
  };
  next();
});

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

  res.json({ ok: true, token, character, rev: getCharacterRev(userId), serverTime: Date.now() });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = username ? getUserByUsername(username) : null;

  if (!user || !checkPassword(password || '', user.password_hash)) {
    return res.status(401).json({ ok: false, reason: 'Incorrect username or password.' });
  }

  touchLastSeen(user.id);
  const token = issueToken(user.id, user.username);
  res.json({ ok: true, token, character: JSON.parse(user.character_json), rev: user.character_rev, serverTime: Date.now() });
});

app.get('/me', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  res.json({ ok: true, character: JSON.parse(user.character_json), serverTime: Date.now() });
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
  logTransaction(payerUser.id, `${payerCharacter.firstName} ${payerCharacter.lastName}`, 'players/pay', -round2(amount), payerCharacter.cash);
  saveCharacter(payerUser.id, payerCharacter);

  const targetCharacter = JSON.parse(target.character_json);
  targetCharacter.cash = round2(targetCharacter.cash + amount);
  logTransaction(target.id, `${targetCharacter.firstName} ${targetCharacter.lastName}`, 'players/pay:received', round2(amount), targetCharacter.cash);
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

function serializeRobberyNotification(row) {
  return { id: row.id, robberName: row.robber_name, amount: row.amount, createdAt: row.created_at };
}

app.get('/notifications/robberies', requireAuth, (req, res) => {
  res.json({ ok: true, notifications: getUnseenRobberyNotifications(req.user.sub).map(serializeRobberyNotification) });
});

app.post('/notifications/robberies/seen', requireAuth, (req, res) => {
  markRobberyNotificationsSeen(req.user.sub);
  res.json({ ok: true });
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

  if (result.gain) {
    logTransaction(attackerUser.id, `${attackerCharacter.firstName} ${attackerCharacter.lastName}`, 'players/rob', result.gain, attackerCharacter.cash);
    logTransaction(targetUser.id, `${targetCharacter.firstName} ${targetCharacter.lastName}`, 'players/rob:victim', -result.gain, targetCharacter.cash);
  }
  saveCharacter(attackerUser.id, attackerCharacter);
  saveCharacter(targetUser.id, targetCharacter);
  if (result.gain) {
    createRobberyNotification(targetUser.id, `${attackerCharacter.firstName} ${attackerCharacter.lastName}`, result.gain);
  }

  res.json({ ok: true, jailed: result.jailed, message: result.message, cls: result.cls, character: attackerCharacter });
});

app.post('/players/slime', requireAuth, (req, res) => {
  const { targetUsername } = req.body || {};
  const targetUser = targetUsername ? getUserByUsername(targetUsername) : null;
  if (!targetUser) return res.status(404).json({ ok: false, reason: 'Player not found.' });
  if (targetUser.id === req.user.sub) return res.status(429).json({ ok: false, reason: "You can't slime yourself." });

  const shooterUser = getUserById(req.user.sub);
  if (!shooterUser) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const shooterCharacter = JSON.parse(shooterUser.character_json);
  if (isSlimed(shooterCharacter)) return res.status(423).json({ ok: false, reason: 'You just got slimed. Try again once the lockout ends.' });
  const targetCharacter = JSON.parse(targetUser.character_json);
  if (isSlimed(targetCharacter)) return res.status(429).json({ ok: false, reason: `${targetCharacter.firstName} is already slimed.` });

  const result = doSlimePlayer(shooterCharacter, targetCharacter, targetUser.id);
  if (!result.ok) return res.status(429).json(result);

  saveCharacter(shooterUser.id, shooterCharacter);
  saveCharacter(targetUser.id, targetCharacter);

  // `target` is always the passive side here (the API caller -- `shooter` -- already gets the
  // full outcome synchronously in this response, whichever way it went), so any async
  // notification only ever goes to target: either "someone tried to slime you and it was
  // blocked" or, if they actually got slimed, the lockout notice itself.
  if (result.armorBlocked) {
    createSlimeNotification(targetUser.id, `${shooterCharacter.firstName} ${shooterCharacter.lastName}`, 'blocked', null);
  } else if (result.slimedSide === 'target') {
    createSlimeNotification(targetUser.id, `${shooterCharacter.firstName} ${shooterCharacter.lastName}`, 'slimed', targetCharacter.slime.until);
  }

  res.json({
    ok: true,
    jailed: result.jailed,
    armorBlocked: result.armorBlocked,
    duel: result.duel,
    message: result.message,
    cls: result.cls,
    character: shooterCharacter,
  });
});

function serializeSlimeNotification(row) {
  return { id: row.id, shooterName: row.shooter_name, outcome: row.outcome, until: row.until, createdAt: row.created_at };
}

app.get('/notifications/slimes', requireAuth, (req, res) => {
  res.json({ ok: true, notifications: getUnseenSlimeNotifications(req.user.sub).map(serializeSlimeNotification) });
});

app.post('/notifications/slimes/seen', requireAuth, (req, res) => {
  markSlimeNotificationsSeen(req.user.sub);
  res.json({ ok: true });
});

// Titles are trust-based/client-side (see gameLogic.js's comment on that exception), but the name-
// recolor perk needs to show up for OTHER players too (MTN listings, coinflip lobbies) who only
// ever hand the client a plain seller/creator name string -- so look up whichever title they
// currently have equipped, live, from their own character_json.
function getEquippedTitleId(userId) {
  if (!userId) return null;
  const user = getUserById(userId);
  if (!user) return null;
  try {
    return JSON.parse(user.character_json).titles.equipped || null;
  } catch {
    return null;
  }
}

function serializeCoinflipLobby(row) {
  return {
    id: row.id,
    creatorName: row.creator_name,
    creatorTitleId: getEquippedTitleId(row.creator_user_id),
    joinerName: row.joiner_name,
    joinerTitleId: getEquippedTitleId(row.joiner_user_id),
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
  logTransaction(user.id, `${character.firstName} ${character.lastName}`, 'coinflip/create', -round2(wager), character.cash);
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
    // Race lost (someone else claimed it, or it was cancelled) -- refund is a pure no-op, not a
    // real economic event, so it's deliberately not logged.
    joinerCharacter.cash = round2(joinerCharacter.cash + lobby.wager);
    saveCharacter(joinerUser.id, joinerCharacter);
    return res.status(409).json({ ok: false, reason: 'That lobby is no longer available.', character: joinerCharacter });
  }

  logTransaction(joinerUser.id, `${joinerCharacter.firstName} ${joinerCharacter.lastName}`, 'coinflip/join', -round2(lobby.wager), joinerCharacter.cash);

  const resultSide = Math.random() < 0.5 ? 'heads' : 'tails';
  const winnerIsCreator = resultSide === lobby.creator_side;
  const winnerUserId = winnerIsCreator ? lobby.creator_user_id : joinerUser.id;
  const pot = round2(lobby.wager * 2);

  if (winnerIsCreator) {
    const creatorUser = getUserById(lobby.creator_user_id);
    if (creatorUser) {
      const creatorCharacter = JSON.parse(creatorUser.character_json);
      creatorCharacter.cash = round2(creatorCharacter.cash + pot);
      logTransaction(creatorUser.id, `${creatorCharacter.firstName} ${creatorCharacter.lastName}`, 'coinflip/win', pot, creatorCharacter.cash);
      saveCharacter(creatorUser.id, creatorCharacter);
    }
  } else {
    joinerCharacter.cash = round2(joinerCharacter.cash + pot);
    logTransaction(joinerUser.id, `${joinerCharacter.firstName} ${joinerCharacter.lastName}`, 'coinflip/win', pot, joinerCharacter.cash);
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
  logTransaction(user.id, `${character.firstName} ${character.lastName}`, 'coinflip/cancel:refund', round2(lobby.wager), character.cash);
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

  const reward = applyDuelOutcome(winnerCharacter, loserCharacter);
  if (reward) {
    const winnerUser = winnerIsAttacker ? attackerUser : targetUser;
    const loserUser = winnerIsAttacker ? targetUser : attackerUser;
    logTransaction(winnerUser.id, `${winnerCharacter.firstName} ${winnerCharacter.lastName}`, 'duels/win', reward, winnerCharacter.cash);
    logTransaction(loserUser.id, `${loserCharacter.firstName} ${loserCharacter.lastName}`, 'duels/loss', -reward, loserCharacter.cash);
  }
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
//
// Also reachable via navigator.sendBeacon on tab close/background, which can't set an
// Authorization header -- so, same as /milos/leave, this route accepts the token in the body as a
// fallback and verifies it manually. This matters because save() debounces this push by 1s; without
// a beacon-based flush on visibilitychange/pagehide, anything saved in that last second (a crate
// win, a title purchase) is silently lost if the tab closes before the timer fires.
app.post('/character/sync', (req, res) => {
  const header = req.headers.authorization || '';
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = headerToken || (req.body && req.body.token);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ ok: false, reason: 'Invalid or expired token.' });
  if (isMaintenanceBlocked({ user: payload })) return res.status(503).json({ ok: false, reason: MAINTENANCE_MESSAGE });

  const { character, expectedRev } = req.body || {};
  if (!character || typeof character !== 'object') {
    return res.status(400).json({ ok: false, reason: 'Missing character.' });
  }

  // Rejects a stale write instead of blindly overwriting -- a real incident this prevents: a
  // second tab/device left open with an older in-memory character silently rolling back whatever
  // a newer session had already saved (titles and FC both vanished at once, since they're just
  // fields inside this same blob). `expectedRev` is the rev this client last saw; a mismatch means
  // something else already saved a newer version since then. Missing/non-numeric expectedRev
  // skips the check (an older client build that predates this guard) rather than hard-failing.
  if (typeof expectedRev === 'number') {
    const currentRev = getCharacterRev(payload.sub);
    if (currentRev !== null && expectedRev !== currentRev) {
      return res.status(409).json({ ok: false, reason: 'stale_sync', currentRev });
    }
  }

  const rev = saveCharacter(payload.sub, character);
  res.json({ ok: true, rev });
});

// Loads the caller's character, runs a do<X>(character, ...args) action against it, and persists
// the result if it succeeded. Every server-authoritative action route is this same shape.
// Every single-character action (work, buy, sell, gamble, etc.) funnels through here, so this is
// the one place a before/after cash diff catches all of them for the transaction log -- no need to
// instrument each of the 60+ individual routes below. `actionFn.name` (e.g. "doWork", "doBuyFood")
// doubles as a free, readable action label. The handful of two-character routes (pay, rob,
// coinflip, mtn, bail/commissary, duels) don't go through here and log explicitly at their own
// cash-mutation points instead.
function runAction(req, res, actionFn, ...args) {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  if (isMaintenanceBlocked(req)) return res.status(503).json({ ok: false, reason: MAINTENANCE_MESSAGE });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });

  const character = JSON.parse(user.character_json);
  if (isSlimed(character)) return res.status(423).json({ ok: false, reason: 'You just got slimed. Try again once the lockout ends.' });
  const cashBefore = character.cash;
  const result = actionFn(character, ...args);

  if (!result.ok) return res.status(429).json(result);

  const delta = round2(character.cash - cashBefore);
  if (delta !== 0) {
    logTransaction(user.id, `${character.firstName} ${character.lastName}`, actionFn.name, delta, character.cash);
  }

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
app.post('/casino/blackjack/double', requireAuth, (req, res) => runAction(req, res, doBjDouble));
app.post('/casino/blackjack/split', requireAuth, (req, res) => runAction(req, res, doBjSplit));
app.post('/casino/slots/spin', requireAuth, (req, res) => {
  const { machine, bet } = req.body || {};
  runAction(req, res, doSlotSpin, machine, bet);
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
app.post('/gunclub/armor', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  runAction(req, res, doBuyArmor, itemId);
});
app.post('/gunclub/concealed-permit', requireAuth, (req, res) => runAction(req, res, doApplyConcealedPermit));

// ---------- Milos Outlook Farms ----------
app.get('/farms/state', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const farms = ensureFarmsState(character);
  farms.plots.forEach((p) => advanceFarmPlot(p));
  saveCharacter(user.id, character);
  res.json({ ok: true, farms, unitsSold: character.drugDealer.unitsSold });
});
app.post('/farms/plot/buy', requireAuth, (req, res) => runAction(req, res, doBuyFarmPlot));
app.post('/farms/plot/prep', requireAuth, (req, res) => {
  const { plotId } = req.body || {};
  runAction(req, res, doPrepFarmPlot, plotId);
});
app.post('/farms/plot/plant', requireAuth, (req, res) => {
  const { plotId, drugId } = req.body || {};
  runAction(req, res, doPlantFarmSeed, plotId, drugId);
});
app.post('/farms/plot/collect', requireAuth, (req, res) => {
  const { plotId } = req.body || {};
  runAction(req, res, doCollectFarmHarvest, plotId);
});
app.post('/farms/security/buy', requireAuth, (req, res) => runAction(req, res, doBuyFarmSecurity));

// ---------- Floydcoin (crypto) ----------
app.get('/crypto/state', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  res.json({ ok: true, crypto: ensureCryptoState(character) });
});
app.post('/crypto/upgrade', requireAuth, (req, res) => {
  const { track } = req.body || {};
  runAction(req, res, doBuyCryptoUpgrade, track);
});
app.post('/crypto/collect', requireAuth, (req, res) => runAction(req, res, doCollectCrypto));
app.post('/crypto/sell', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doSellFC, Number(amount));
});
app.post('/crypto/buy', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doBuyFC, Number(amount));
});

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
    sellerTitleId: getEquippedTitleId(row.seller_user_id),
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
    logTransaction(buyerUser.id, `${buyerCharacter.firstName} ${buyerCharacter.lastName}`, 'mtn/buy', -total, buyerCharacter.cash);
    const sellerUser = getUserById(listing.seller_user_id);
    deleteListing(listing.id);
    saveCharacter(buyerUser.id, buyerCharacter);
    if (sellerUser) {
      const sellerCharacter = JSON.parse(sellerUser.character_json);
      creditSellerForSale(sellerCharacter, listing.item_id, listing.qty, total, `${buyerCharacter.firstName} ${buyerCharacter.lastName}`);
      logTransaction(sellerUser.id, `${sellerCharacter.firstName} ${sellerCharacter.lastName}`, 'mtn/sell', total, sellerCharacter.cash);
      saveCharacter(sellerUser.id, sellerCharacter);
    }
  }

  res.json({ ...result, listings: getAllListings().map(serializeListing) });
});

// ---------- Altcoins (rug-pull system) ----------
// Public view: name, remaining supply, current price, status. NEVER includes who holds coins or
// at what price they bought in -- that stays server-side only, per the design doc's visibility rule.
function serializeAltcoin(coin) {
  return {
    id: coin.id,
    name: coin.name,
    creatorName: coin.creator_name,
    supply: coin.supply,
    sold: coin.sold,
    remaining: coin.supply - coin.sold,
    status: coin.status,
    price: coin.price_override !== null && coin.price_override !== undefined ? coin.price_override : altcoinPriceAt(coin.sold),
  };
}

app.get('/altcoins/list', requireAuth, (req, res) => {
  res.json({ ok: true, coins: getAllAltcoins().map(serializeAltcoin) });
});

// Private to the caller: their own holdings across every coin, plus whether they currently have an
// active mint of their own (gates whether Mint is available).
app.get('/altcoins/mine', requireAuth, (req, res) => {
  const coins = getAllAltcoins();
  const holdings = coins
    .map((coin) => ({ coin, holding: getAltcoinHoldingForUser(coin.id, req.user.sub) }))
    .filter((x) => x.holding && x.holding.qty > 0)
    .map((x) => ({ altcoinId: x.coin.id, name: x.coin.name, qty: x.holding.qty, status: x.coin.status }));
  const myActiveMint = getActiveAltcoinByCreator(req.user.sub);
  res.json({ ok: true, holdings, myActiveMintId: myActiveMint ? myActiveMint.id : null });
});

app.post('/altcoins/mint', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  const { name } = req.body || {};
  const existing = getActiveAltcoinByCreator(req.user.sub);
  if (existing) return res.status(429).json({ ok: false, reason: 'You already have an active altcoin. Only one at a time.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const result = doMintAltcoin(character, name);
  if (!result.ok) return res.status(429).json(result);

  saveCharacter(user.id, character);
  const creatorName = `${character.firstName} ${character.lastName}`;
  const coinId = createAltcoin(result.name, user.id, creatorName, ALTCOIN_SUPPLY);
  res.json({ ok: true, message: `Minted ${result.name}!`, cls: 'gain', character, coin: serializeAltcoin(getAltcoinById(coinId)) });
});

app.post('/altcoins/buy', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  const { altcoinId, qty } = req.body || {};
  const coin = getAltcoinById(altcoinId);
  if (!coin) return res.status(404).json({ ok: false, reason: 'Unknown coin.' });
  if (coin.status !== 'active') return res.status(429).json({ ok: false, reason: 'This coin is no longer trading.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const result = doBuyAltcoinCoins(character, { sold: coin.sold, supply: coin.supply }, Number(qty));
  if (!result.ok) return res.status(429).json(result);

  saveCharacter(user.id, character);
  updateAltcoinSold(coin.id, coin.sold + Number(qty));
  addAltcoinHolding(coin.id, user.id, `${character.firstName} ${character.lastName}`, Number(qty), result.cost);
  res.json({ ...result, character, coin: serializeAltcoin(getAltcoinById(coin.id)) });
});

// Rug (pre-sellout) and "Sell Now" (post-sellout) are the same action -- whoever currently holds
// the plurality of coins drains the pool at the current price and the coin craters. Only the real
// majority holder (recomputed live, not the original minter) can ever call this.
app.post('/altcoins/dump', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  const { altcoinId } = req.body || {};
  const coin = getAltcoinById(altcoinId);
  if (!coin) return res.status(404).json({ ok: false, reason: 'Unknown coin.' });
  if (coin.status !== 'active') return res.status(429).json({ ok: false, reason: 'This coin is no longer trading.' });

  const majority = getAltcoinMajorityHolder(coin.id);
  if (!majority || majority.user_id !== req.user.sub) {
    return res.status(403).json({ ok: false, reason: 'Only the current majority holder can do this.' });
  }

  const user = getUserById(req.user.sub);
  const character = JSON.parse(user.character_json);
  const crypto = ensureCryptoState(character);
  const { payoutFc, newPrice } = altcoinDumpPayout(coin, majority.qty);
  crypto.fc = round4(crypto.fc + payoutFc);
  saveCharacter(user.id, character);

  zeroAltcoinHolding(majority.id);
  setAltcoinStatus(coin.id, 'rugged', newPrice);

  res.json({
    ok: true,
    message: `Dumped ${majority.qty} coins for ${payoutFc.toFixed(3)} FC. ${coin.name} crashed to ${newPrice.toFixed(4)} FC/coin.`,
    cls: 'gain',
    character,
    coin: serializeAltcoin(getAltcoinById(coin.id)),
  });
});

// The "honest ending" -- only offered once fully sold out, pays every holder pro-rata instead of
// just draining value to the majority holder. Genuinely different code path from dump/Sell Now.
app.post('/altcoins/buyout', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  const { altcoinId } = req.body || {};
  const coin = getAltcoinById(altcoinId);
  if (!coin) return res.status(404).json({ ok: false, reason: 'Unknown coin.' });
  if (coin.status !== 'active') return res.status(429).json({ ok: false, reason: 'This coin is no longer trading.' });
  if (coin.sold < coin.supply) return res.status(429).json({ ok: false, reason: 'This coin has not fully sold out yet.' });

  const majority = getAltcoinMajorityHolder(coin.id);
  if (!majority || majority.user_id !== req.user.sub) {
    return res.status(403).json({ ok: false, reason: 'Only the current majority holder can do this.' });
  }

  const holdings = getAltcoinHoldings(coin.id).map((h) => ({ userId: h.user_id, qty: h.qty, holdingId: h.id }));
  const payouts = altcoinFullBuyoutPayout(coin, holdings);
  payouts.forEach(({ userId, payoutFc }) => {
    const holderUser = getUserById(userId);
    if (!holderUser) return;
    const holderCharacter = JSON.parse(holderUser.character_json);
    const crypto = ensureCryptoState(holderCharacter);
    crypto.fc = round4(crypto.fc + payoutFc);
    saveCharacter(holderUser.id, holderCharacter);
  });
  holdings.forEach((h) => zeroAltcoinHolding(h.holdingId));
  setAltcoinStatus(coin.id, 'bought_out');

  const callerUser = getUserById(req.user.sub);
  res.json({
    ok: true,
    message: `Full Buyout complete -- every holder of ${coin.name} paid out pro-rata.`,
    cls: 'gain',
    character: JSON.parse(callerUser.character_json),
    coin: serializeAltcoin(getAltcoinById(coin.id)),
  });
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
  logTransaction(payerUser.id, `${payerCharacter.firstName} ${payerCharacter.lastName}`, 'penitentiary/bail', -cost, payerCharacter.cash);
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
    logTransaction(payerUser.id, `${payerCharacter.firstName} ${payerCharacter.lastName}`, 'penitentiary/commissary', -amount, payerCharacter.cash);
    saveCharacter(payerUser.id, payerCharacter);
    const inmateUser = getUserById(record.user_id);
    if (inmateUser) {
      const inmateCharacter = JSON.parse(inmateUser.character_json);
      inmateCharacter.cash = round2(inmateCharacter.cash + amount);
      logTransaction(inmateUser.id, `${inmateCharacter.firstName} ${inmateCharacter.lastName}`, 'penitentiary/commissary:received', amount, inmateCharacter.cash);
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

// Restricted to a single allowed username -- req.user.username comes from the signed JWT (see
// auth.js), so unlike a client-supplied value this can't be spoofed.
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'mrleems').toLowerCase();

function requireAdminPassword(req, res, next) {
  if ((req.user?.username || '').toLowerCase() !== ADMIN_USERNAME) {
    return res.status(403).json({ ok: false, reason: 'Not authorized.' });
  }
  next();
}

// Maintenance mode blocks every server-authoritative action (and the trust-based sync) for
// everyone except the admin account, so mrleems can still play/test while it's on. Referenced by
// runAction and /character/sync above, both defined earlier in the file -- safe, since neither
// handler runs until a request comes in, well after the whole module (including this) has loaded.
const MAINTENANCE_MESSAGE = 'MAINTENANCE MODE - GAME IS BEING UPDATED - PLEASE FORWARD ALL COMPLAINTS TO NICK Q.';

function isMaintenanceBlocked(req) {
  return !!getServerState().maintenance && (req.user?.username || '').toLowerCase() !== ADMIN_USERNAME;
}

// Server state (pause + modifier + maintenance) is public to any logged-in player -- everyone
// needs to see the pause/maintenance banner and active modifier, not just admins.
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

app.post('/admin/maintenance', requireAuth, requireAdminPassword, (req, res) => {
  const { maintenance } = req.body || {};
  setServerMaintenance(!!maintenance);
  res.json({ ok: true, state: getServerState() });
});

// Wipes every player's character back to newCharacter() defaults (stats, cash, chips, jobs, bank,
// equipment, jail, Farms/Crypto/Altcoins state -- everything) but keeps titles and cosmetic
// inventory stacks. Irreversible, so gated same as every other admin action.
app.post('/admin/reset-all-stats', requireAuth, requireAdminPassword, (req, res) => {
  const users = getAllUsersForLeaderboard();
  users.forEach((row) => {
    const character = JSON.parse(row.character_json);
    saveCharacter(row.id, resetCharacterKeepCosmetics(character));
  });
  res.json({ ok: true, message: `Reset stats for ${users.length} player(s). Cosmetics kept.`, cls: 'gain' });
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

function serializeTransaction(row) {
  return {
    id: row.id,
    userName: row.user_name,
    action: row.action,
    delta: row.delta,
    balanceAfter: row.balance_after,
    createdAt: row.created_at,
  };
}

const TRANSACTIONS_PAGE_SIZE = 200;

// Optional ?username=<name> filters to one player; optional ?beforeId=<id> pages backward through
// the full log (newest first) without re-fetching everything already seen.
app.get('/admin/transactions', requireAuth, requireAdminPassword, (req, res) => {
  const { username, beforeId } = req.query || {};
  if (username) {
    const user = getUserByUsername(String(username).trim());
    if (!user) return res.status(404).json({ ok: false, reason: `No player named "${username}" found.` });
    return res.json({ ok: true, transactions: getTransactionsForUser(user.id, TRANSACTIONS_PAGE_SIZE).map(serializeTransaction) });
  }
  const parsedBeforeId = beforeId ? Number(beforeId) : null;
  res.json({ ok: true, transactions: getRecentTransactions(TRANSACTIONS_PAGE_SIZE, parsedBeforeId).map(serializeTransaction) });
});

app.get('/admin/transactions/summary', requireAuth, requireAdminPassword, (req, res) => {
  res.json({ ok: true, summary: getTransactionSummary() });
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
    titleId: row.title_id,
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
  const { titleText, message, titleId } = req.body || {};
  const trimmed = (message || '').trim();
  if (!trimmed) return res.status(400).json({ ok: false, reason: 'Enter a message.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const senderName = `${character.firstName} ${character.lastName}`;
  const safeTitleText = (titleText || 'CIVILIAN').slice(0, CHAT_TITLE_MAX_LEN);
  const safeTitleId = typeof titleId === 'string' ? titleId.slice(0, CHAT_TITLE_MAX_LEN) : null;

  createChatMessage(user.id, senderName, safeTitleText, trimmed.slice(0, CHAT_MESSAGE_MAX_LEN), safeTitleId);
  res.json({ ok: true, messages: getRecentChatMessages().map(serializeChatMessage) });
});

// ---------- Roulette ----------
app.post('/casino/roulette/spin', requireAuth, (req, res) => {
  const { bets } = req.body || {};
  runAction(req, res, doRouletteSpin, bets);
});

// Safety net: an uncaught throw inside any route handler (sync or via next(err)) used to crash the
// whole process, taking down every player's session until PM2 restarted it -- see the casino
// seat-taking race that did exactly this. This must be registered after every route.
app.use((err, req, res, next) => {
  console.error('Unhandled route error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, reason: 'Something went wrong. Please try again.' });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server staying up):', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (server staying up):', err);
});

// Bounds the transaction log's disk footprint on the droplet -- no OS-level cron, just an interval
// that outlives the process's own lifetime (runs once at boot, then daily).
const TRANSACTION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const TRANSACTION_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day
function pruneTransactionLog() {
  const removed = pruneOldTransactions(TRANSACTION_RETENTION_MS);
  if (removed > 0) console.log(`Pruned ${removed} transaction log row(s) older than 90 days.`);
}
pruneTransactionLog();
setInterval(pruneTransactionLog, TRANSACTION_PRUNE_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`mfmmoalpha-server listening on port ${PORT}`);
});
