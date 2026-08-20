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
  getListingsBySeller,
  deleteListing,
  getActivePenitentiaryRecord,
  createPenitentiaryRecord,
  updatePenitentiaryYearsRemaining,
  releasePenitentiaryRecord,
  addPenitentiaryCommissary,
  getAllPenitentiaryRecords,
  getPenitentiaryRecordById,
  getActiveNmgSlots,
  getNmgSlotById,
  createNmgSlot,
  revealNmgSlot,
  deleteNmgSlot,
  fastForwardAllActiveNmgSlots,
  getCertNosInActiveSlots,
  mintCert,
  getCertByNo,
  getCertBySeries,
  pickCertFifo,
  getLivingCertsFor,
  getLivingCertsForUser,
  getAllLivingCerts,
  getPopulationRows,
  appendCertHistory,
  setCertOwner,
  retireCert,
  updateCertOnRegrade,
  getAllUserIdsAndCharacters,
  getRegistryCompletion,
  recordRegistryCompletion,
  getServerState,
  setServerPaused,
  setServerModifier,
  setServerMaintenance,
  getCrateStock,
  trySpendCrateStock,
  refundCrateStock,
  tryClaimCosmetixxMarketRegen,
  getCosmetixxMarketGeneratedAt,
  getCosmetixxMarketSlots,
  replaceCosmetixxMarketSlots,
  getCosmetixxMarketSlotById,
  trySellCosmetixxMarketSlot,
  createChatMessage,
  getRecentChatMessages,
  seedStocksIfEmpty,
  getAllStocks,
  updateStockPrice,
  createInvestorChatMessage,
  getRecentInvestorChatMessages,
  getStockMarketState,
  setNextBotPostAt,
  setNextL2PostAt,
  createL2FeedPost,
  getRecentL2Feed,
  recordStockPricePoint,
  getStockPriceHistory,
  pruneOldStockPriceHistory,
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
  createMtnSaleNotification,
  getMtnSaleNotifications,
  getUnseenMtnSaleCount,
  markMtnSaleNotificationsSeen,
  createReport,
  getReportsPage,
  getReportById,
  resolveReport,
  createReportResolvedNotification,
  getReportResolvedNotifications,
  getUnseenReportResolvedCount,
  markReportResolvedNotificationsSeen,
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
  recordCityEvent,
  getRecentCityEvents,
} = require('./db');
const { hashPassword, checkPassword, issueToken, requireAuth, verifyToken } = require('./auth');
const {
  newCharacter,
  resetCharacterKeepCosmetics,
  resetCharacterSeasonWipe,
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
  doSpinRedBlueCrate,
  RED_BLUE_CRATE_COST,
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
  SECUMAX_TIERS,
  ensureSecumaxState,
  ensureSecumaxBilled,
  VARIETY_TIERS,
  VARIETY_RENOUNCE_COST,
  ensureVarietyState,
  isVarietyTimedOut,
  isEnjoyed,
  addVariety,
  CHILL_VARIETY_GAIN,
  doEnjoyPlayer,
  renounceVariety,
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
  addToInventory,
  removeFromInventory,
  inventoryQty,
  NMG_MAX_SLOTS,
  NMG_TIERS,
  GRADERS,
  GRADER_IDS,
  DEFAULT_GRADER,
  getGrader,
  rollSubgains,
  isFirstEditionEligible,
  doCrackSlab,
  NMG_CRACK_COST,
  isCosmeticInventoryId,
  nmgBaseIdOf,
  rollNmgGrade,
  doFoilAscension,
  nmgRegradeFee,
  parseGradedId,
  detachGradedIdFromShowcases,
  COSMETIXX_MARKET_ROTATION_MS,
  generateCosmetixxMarketSlots,
  REGISTRY_SETS,
  REGISTRY_REWARD_TITLES,
  REGISTRY_MASTER_SET_GPA,
  REGISTRY_PERFECT_SET_GPA,
  computeBestGradedHoldings,
  computeSetProgress,
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
  doAdvanceCryptoMachine,
  doPrestigeCryptoRig,
  doCollectCrypto,
  doSellFC,
  doBuyFC,
  doDepositColdStorage,
  doWithdrawColdStorage,
  doBuyColdStorageUpgrade,
  ALTCOIN_SUPPLY,
  altcoinPriceAt,
  doMintAltcoin,
  doBuyAltcoinCoins,
  altcoinDumpPayout,
  altcoinFullBuyoutPayout,
  STOCK_DEFINITIONS,
  advanceStockTicks,
  applyStockNewsShock,
  doBuyStock,
  doSellStock,
  generateInvestorBotPost,
  generateL2Post,
  pickRandom,
  randInt,
  STOCK_SPREAD,
  BANK_TIERS,
  ensureProfileState,
  doSetProfileStatus,
  doSetProfileBanner,
  doToggleProfilePrivacy,
  doAddShowcaseTitle,
  doRemoveShowcaseTitle,
  doAddSlabShowcase,
  doRemoveSlabShowcase,
  isGradedTitleId,
  PROFILE_SLAB_MARKET_MAX,
  doPostToWall,
  doDeleteWallPost,
  paginateWall,
  computeCharacterLevel,
} = require('./gameLogic');

const app = express();
const PORT = process.env.PORT || 3000;

// One-time seed: creates the ticker roster on first boot only, never touches existing rows.
seedStocksIfEmpty(STOCK_DEFINITIONS);

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

// credentials: true is required for navigator.sendBeacon's tab-close/background flush
// (flushCharacterSyncBeacon in mfmmoalpha's js/core.js) -- sendBeacon always sends cross-origin
// requests with implicit credentials, which triggers a CORS preflight since the beacon body is
// JSON, and without this flag the browser blocks that preflight outright (no
// Access-Control-Allow-Credentials header to satisfy it), silently failing the beacon every time.
// The client's normal fetch-based requests still authenticate via an Authorization header, not
// cookies, so this doesn't change how those work -- it only unblocks the beacon path.
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
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
    kollector: 'kollector_leader_user_id',
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
    kollector_leader_user_id: winners.kollector,
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

// ---------- Player Profiles ----------
// Sends the target's whole character (same "send the full blob, let the client resolve titles/
// display" approach as /players/online above) rather than pre-resolving title defs server-side --
// the titles catalog only exists in client JS. Viewable by anyone logged in, online or not.
app.get('/profile/:username', requireAuth, (req, res) => {
  const target = getUserByUsername(req.params.username);
  if (!target) return res.status(404).json({ ok: false, reason: 'Player not found.' });
  const character = JSON.parse(target.character_json);
  const profile = ensureProfileState(character);
  const { wallPage, wallTotalPages, wallPageNum } = paginateWall(profile, Number(req.query.page) || 1);
  const isOwner = target.id === req.user.sub;

  // Privacy toggles only actually hide anything from someone ELSE viewing this profile -- the
  // owner always sees their own real numbers (and needs to, to toggle the eye icon sensibly).
  if (!isOwner) {
    if (profile.privacy.cash) character.cash = null;
    if (profile.privacy.fc && character.crypto) character.crypto = { ...character.crypto, fc: null };
    if (profile.privacy.portfolio) character.stocks = { holdings: {} };
  }

  // Scoped to this one profile (not the full global MTN board) -- only graded slabs count, since
  // this is what backs the Player Market section, not a general listings feed.
  const slabMarketListings = getListingsBySeller(target.id)
    .filter((row) => isGradedTitleId(row.item_id))
    .map(serializeListing);

  res.json({
    ok: true,
    username: target.username,
    character,
    level: computeCharacterLevel(character),
    isOwner,
    wallPage,
    wallTotalPages,
    wallPageNum,
    slabMarketListings,
  });
});

app.post('/profile/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  runAction(req, res, doSetProfileStatus, status);
});

app.post('/profile/privacy/toggle', requireAuth, (req, res) => {
  const { field } = req.body || {};
  runAction(req, res, doToggleProfilePrivacy, field);
});

app.post('/profile/banner', requireAuth, (req, res) => {
  const { titleId } = req.body || {};
  runAction(req, res, doSetProfileBanner, titleId);
});

app.post('/profile/showcase/add', requireAuth, (req, res) => {
  const { titleId } = req.body || {};
  runAction(req, res, doAddShowcaseTitle, titleId);
});

app.post('/profile/showcase/remove', requireAuth, (req, res) => {
  const { titleId } = req.body || {};
  runAction(req, res, doRemoveShowcaseTitle, titleId);
});

app.post('/profile/slab-showcase/add', requireAuth, (req, res) => {
  const { titleId } = req.body || {};
  runAction(req, res, doAddSlabShowcase, titleId);
});

app.post('/profile/slab-showcase/remove', requireAuth, (req, res) => {
  const { titleId } = req.body || {};
  runAction(req, res, doRemoveSlabShowcase, titleId);
});

// Not a plain runAction() -- like /mtn/list, this needs the shared mtn_listings DB row inserted
// alongside the character mutation. Reuses the exact same doCreateListing/createListing pair as
// the generic MTN market (a listing doesn't care which UI created it), just gated to graded slabs
// only and capped at PROFILE_SLAB_MARKET_MAX active listings, and always qty 1 -- these are meant
// to read as one slab per listing, not a stackable quantity.
app.post('/profile/slab-market/list', requireAuth, (req, res) => {
  const { itemId, price } = req.body || {};
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  if (isMaintenanceBlocked(req)) return res.status(503).json({ ok: false, reason: MAINTENANCE_MESSAGE });
  if (!isGradedTitleId(itemId)) return res.status(400).json({ ok: false, reason: 'Only graded slabs can be listed here.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });

  const activeCount = getListingsBySeller(user.id).filter((row) => isGradedTitleId(row.item_id)).length;
  if (activeCount >= PROFILE_SLAB_MARKET_MAX) {
    return res.status(429).json({ ok: false, reason: `You already have ${PROFILE_SLAB_MARKET_MAX} slabs listed -- cancel one first.` });
  }

  const character = JSON.parse(user.character_json);
  if (isSlimed(character)) return res.status(423).json({ ok: false, reason: 'You just got slimed. Try again once the lockout ends.' });

  const result = doCreateListing(character, itemId, 1, price);
  if (!result.ok) return res.status(429).json(result);

  createListing(user.id, `${character.firstName} ${character.lastName}`, itemId, 1, round2(price));
  saveCharacter(user.id, character);
  res.json(result);
});

// Wall posts mutate the TARGET's save, not the caller's -- same two-character shape as
// /players/pay above, so this doesn't go through runAction (which always loads req.user's own
// character). Returns the target's fresh wall page, never the caller's own `character`.
app.post('/profile/wall/post', requireAuth, (req, res) => {
  const { targetUsername, text } = req.body || {};
  const target = targetUsername ? getUserByUsername(targetUsername) : null;
  if (!target) return res.status(404).json({ ok: false, reason: 'Player not found.' });

  const author = getUserById(req.user.sub);
  if (!author) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const authorCharacter = JSON.parse(author.character_json);

  const targetCharacter = JSON.parse(target.character_json);
  const result = doPostToWall(targetCharacter, author.username, `${authorCharacter.firstName} ${authorCharacter.lastName}`, text);
  if (!result.ok) return res.status(429).json(result);
  saveCharacter(target.id, targetCharacter);

  const profile = ensureProfileState(targetCharacter);
  const { wallPage, wallTotalPages, wallPageNum } = paginateWall(profile, 1);
  res.json({ ok: true, message: 'Posted.', wallPage, wallTotalPages, wallPageNum });
});

app.post('/profile/wall/delete', requireAuth, (req, res) => {
  const { targetUsername, postId, page } = req.body || {};
  if (targetUsername !== req.user.username) {
    return res.status(403).json({ ok: false, reason: 'You can only delete posts on your own wall.' });
  }
  const target = getUserByUsername(targetUsername);
  if (!target) return res.status(404).json({ ok: false, reason: 'Player not found.' });
  const targetCharacter = JSON.parse(target.character_json);
  doDeleteWallPost(targetCharacter, postId);
  saveCharacter(target.id, targetCharacter);

  const profile = ensureProfileState(targetCharacter);
  const { wallPage, wallTotalPages, wallPageNum } = paginateWall(profile, Number(page) || 1);
  res.json({ ok: true, message: 'Deleted.', wallPage, wallTotalPages, wallPageNum });
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

function serializeMtnSaleNotification(row) {
  return {
    id: row.id,
    buyerName: row.buyer_name,
    itemId: row.item_id,
    qty: row.qty,
    total: row.total,
    createdAt: row.created_at,
    seen: !!row.seen,
  };
}

app.get('/notifications/mtn-sales', requireAuth, (req, res) => {
  res.json({
    ok: true,
    notifications: getMtnSaleNotifications(req.user.sub).map(serializeMtnSaleNotification),
    unseenCount: getUnseenMtnSaleCount(req.user.sub),
  });
});

app.post('/notifications/mtn-sales/seen', requireAuth, (req, res) => {
  markMtnSaleNotificationsSeen(req.user.sub);
  res.json({
    ok: true,
    notifications: getMtnSaleNotifications(req.user.sub).map(serializeMtnSaleNotification),
    unseenCount: getUnseenMtnSaleCount(req.user.sub),
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
    kollector: board.kollector,
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

// ---------- Enjoying & Variety ----------
app.post('/players/enjoy', requireAuth, (req, res) => {
  const { targetUsername } = req.body || {};
  const targetUser = targetUsername ? getUserByUsername(targetUsername) : null;
  if (!targetUser) return res.status(404).json({ ok: false, reason: 'Player not found.' });
  if (targetUser.id === req.user.sub) return res.status(429).json({ ok: false, reason: "You can't enjoy yourself. Well, you know what we mean." });

  const attackerUser = getUserById(req.user.sub);
  if (!attackerUser) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const attackerCharacter = JSON.parse(attackerUser.character_json);
  const targetCharacter = JSON.parse(targetUser.character_json);

  const result = doEnjoyPlayer(attackerCharacter, targetCharacter, targetUser.id);
  if (!result.ok) return res.status(429).json(result);

  saveCharacter(attackerUser.id, attackerCharacter);
  saveCharacter(targetUser.id, targetCharacter);

  if (result.chatAnnouncement) {
    createChatMessage(attackerUser.id, 'Milos City Announcer', 'SYSTEM', result.chatAnnouncement, null);
  }

  res.json({
    ok: true,
    blocked: result.blocked,
    success: result.success,
    message: result.message,
    cls: result.cls,
    character: attackerCharacter,
  });
});

app.get('/variety/state', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  ensureVarietyState(character);
  saveCharacter(user.id, character);
  res.json({
    ok: true,
    variety: character.variety,
    timedOut: isVarietyTimedOut(character),
    timeoutUntil: character.varietyTimeout.until,
    enjoyed: isEnjoyed(character),
    enjoyedUntil: character.enjoyed.until,
    enjoyedByName: character.enjoyed.byName,
    renounceCost: VARIETY_RENOUNCE_COST,
    tiers: VARIETY_TIERS,
  });
});

app.post('/variety/renounce', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const result = renounceVariety(character);
  if (!result.ok) return res.status(429).json(result);
  saveCharacter(user.id, character);
  logTransaction(user.id, `${character.firstName} ${character.lastName}`, 'variety/renounce', -VARIETY_RENOUNCE_COST, character.cash);
  res.json({ ok: true, message: result.message, cls: result.cls, character });
});

// ---------- Secumax ----------
app.get('/secumax/state', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const sec = ensureSecumaxBilled(character);
  saveCharacter(user.id, character);
  res.json({ ok: true, secumax: sec, tiers: SECUMAX_TIERS, character });
});

app.post('/secumax/subscribe', requireAuth, (req, res) => {
  const { tier } = req.body || {};
  const tierDef = SECUMAX_TIERS[tier];
  if (!tierDef) return res.status(400).json({ ok: false, reason: 'Unknown tier.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const sec = ensureSecumaxBilled(character);
  if (character.cash < tierDef.costPerDay) return res.status(429).json({ ok: false, reason: 'Not enough Floydbucks for the first day.' });

  character.cash = round2(character.cash - tierDef.costPerDay);
  sec.tier = tier;
  sec.lastBillTs = Date.now();
  sec.robBlocksUsed = 0;
  sec.enjoyBlocksUsed = 0;
  sec.slimeBlocksUsed = 0;
  saveCharacter(user.id, character);
  logTransaction(user.id, `${character.firstName} ${character.lastName}`, 'secumax/subscribe', -tierDef.costPerDay, character.cash);
  res.json({ ok: true, message: `Subscribed to ${tierDef.name}.`, cls: 'gain', character, secumax: sec });
});

app.post('/secumax/cancel', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const sec = ensureSecumaxBilled(character);
  sec.tier = null;
  saveCharacter(user.id, character);
  res.json({ ok: true, message: 'Secumax cancelled. No refund for today.', cls: '', character, secumax: sec });
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
  try {
    const loserName = winnerIsAttacker ? `${targetCharacter.firstName} ${targetCharacter.lastName}` : `${attackerCharacter.firstName} ${attackerCharacter.lastName}`;
    // No cash amount here on purpose -- the duel reward is a PvP transfer from the loser, same
    // privacy line as robbery/slime amounts, so only the outcome is public flavor.
    recordCityEvent('duel', `⚔️ ${winnerCharacter.firstName} ${winnerCharacter.lastName} defeated ${loserName} in a duel`);
  } catch {
    // Ticker is best-effort flavor -- never let a logging failure break the duel-finish path.
  }
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

// RED vs. BLUE Crate: globally limited to 1,000 openings per side, so this can't reuse the generic
// runAction() helper -- stock has to be reserved atomically BEFORE the cash check, then refunded if
// the cash check fails (character.cash could've changed since the client's own last-known balance).
app.get('/crates/redblue/stock', requireAuth, (req, res) => {
  const stock = getCrateStock();
  res.json({ ok: true, red: stock.red_crate_remaining, blue: stock.blue_crate_remaining, cost: RED_BLUE_CRATE_COST });
});

app.post('/crates/redblue/spin', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  if (isMaintenanceBlocked(req)) return res.status(503).json({ ok: false, reason: MAINTENANCE_MESSAGE });

  const { crate, qty } = req.body || {};
  const crateKey = crate === 'red' || crate === 'blue' ? crate : null;
  if (!crateKey) return res.status(400).json({ ok: false, reason: 'Unknown crate.' });
  const spinQty = Math.max(1, Math.min(10, Math.round(Number(qty) || 1)));

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  if (isSlimed(character)) return res.status(423).json({ ok: false, reason: 'You just got slimed. Try again once the lockout ends.' });

  if (!trySpendCrateStock(crateKey, spinQty)) {
    return res.status(409).json({ ok: false, reason: `Sold out! No ${crateKey.toUpperCase()} Crate supply remaining.` });
  }

  const cashBefore = character.cash;
  const result = doSpinRedBlueCrate(character, spinQty);
  if (!result.ok) {
    refundCrateStock(crateKey, spinQty);
    return res.status(429).json(result);
  }

  const delta = round2(character.cash - cashBefore);
  if (delta !== 0) {
    logTransaction(user.id, `${character.firstName} ${character.lastName}`, 'doSpinRedBlueCrate', delta, character.cash);
  }
  saveCharacter(user.id, character);

  const stock = getCrateStock();
  res.json({ ok: true, character, remaining: crateKey === 'red' ? stock.red_crate_remaining : stock.blue_crate_remaining });
});

// ---------- Grading cert registry: hooks, reconcile, Pop Report, Cert Lookup ----------
// Read the long fungibility-contract comment above the grading_certs table in db.js first -- it
// explains why inventory stays fungible and what the FIFO pick does and does not guarantee.
//
// EVERY HOOK POINT, in one list, so a future path can be checked against it:
//   mint    /nmg/reveal (fresh submission)      source 'graded'
//   mint    /cosmetixx-market/buy               source 'market'   (at PURCHASE, see note there)
//   mint    reconcileCerts()                    source 'legacy'   (backfill + drift repair)
//   update  /nmg/reveal (regrade)               same cert_no, new graded_id/subgains, history event
//   retire  /nmg/crack
//   move    /mtn/buy                            seller -> buyer, with the sale price in history
// There is no separate player-to-player trade route in this codebase -- MTN is the only path an
// item moves between players -- so 'trade' exists in the event vocabulary but nothing emits it yet.
// MTN list/cancel deliberately do NOT touch certs: a listed slab leaves character.inventory but is
// still the seller's property in escrow, so its cert keeps the seller as owner and reconcileCerts()
// counts active listings as held (below). A cancel is then a no-op rather than a re-mint.

function certDisplayName(character) {
  return `${character.firstName} ${character.lastName}`;
}

function certEvent(type, fields = {}) {
  return { t: Date.now(), type, ...fields };
}

function mintCertForSlab({ userId, gradedId, source, event, subs, mintedAt = Date.now() }) {
  const parsed = parseGradedId(gradedId);
  if (!parsed) return null;
  return mintCert({
    grader: parsed.grader,
    gradedId,
    ownerUserId: userId,
    mintedAt,
    source,
    firstEdition: isFirstEditionEligible(parsed.preGradeId),
    subs: subs || null,
    event: event || null,
  });
}

// Moves ONE cert of `gradedId` from `fromUserId` to `toUserId`, FIFO. Returns the cert row moved,
// or null if the seller had no living cert for it (possible only on pre-existing drift, which
// reconcileCerts() repairs -- never a reason to fail the trade itself).
function transferCertFifo(fromUserId, toUserId, gradedId, event) {
  const cert = pickCertFifo(fromUserId, gradedId);
  if (!cert) return null;
  setCertOwner(cert.cert_no, toUserId);
  if (event) appendCertHistory(cert.cert_no, event);
  return cert;
}

function retireCertFifo(userId, gradedId, event) {
  const cert = pickCertFifo(userId, gradedId);
  if (!cert) return null;
  if (event) appendCertHistory(cert.cert_no, event);
  retireCert(cert.cert_no, Date.now());
  return cert;
}

function certLabel(row) {
  const grader = getGrader(row.grader);
  return `${grader ? grader.short : row.grader.toUpperCase()} #${String(row.series_no).padStart(6, '0')}`;
}

function serializeCert(row) {
  let history = [];
  try {
    const parsedHistory = JSON.parse(row.history);
    if (Array.isArray(parsedHistory)) history = parsedHistory;
  } catch {
    // A corrupt history blob must never take down a lookup -- the cert's identity is the real
    // payload here and the timeline is decoration.
  }
  const parsed = parseGradedId(row.graded_id) || {};
  return {
    certNo: row.cert_no,
    grader: row.grader,
    seriesNo: row.series_no,
    label: certLabel(row),
    gradedId: row.graded_id,
    preGradeId: parsed.preGradeId || null,
    grade: parsed.grade ?? null,
    mintedAt: row.minted_at,
    source: row.source,
    firstEdition: !!row.first_edition,
    // NULL subgains render as "--" client-side: CCG/NMG certs never have them by definition, and
    // legacy NMG certs predate the registry entirely.
    subgains: row.sub_gloss === null ? null : {
      gloss: row.sub_gloss, stitch: row.sub_stitch, aura: row.sub_aura, drip: row.sub_drip,
    },
    blackLabel: !!row.black_label,
    retiredAt: row.retired_at,
    history,
  };
}

// ---------- Reconcile / backfill ----------
// One function does both jobs, because they are the same job: make the registry agree with what
// players actually hold. Idempotent, so it is safe to run at boot (which it is -- see the call at
// the bottom of this file) and safe to re-run by hand from the admin panel.
//
// A user's EFFECTIVE holdings of a graded id = inventory qty + their own active MTN listings of it.
// Listings matter because doCreateListing() escrows the item out of character.inventory; without
// counting them, a boot reconcile would retire the certs of every slab currently up for sale.
// Certs pinned to an in-flight regrade slot are excluded from the comparison entirely for the same
// reason (the slab is legitimately nowhere right now, and the cert is waiting for its reveal).
function reconcileCerts({ dryRun = false } = {}) {
  const now = Date.now();
  const pinnedCertNos = new Set(getCertNosInActiveSlots());
  const listings = getAllListings();
  const result = { minted: 0, retired: 0, checkedUsers: 0, feMinted: 0 };

  const listedByUser = new Map();
  listings.forEach((l) => {
    if (!isGradedTitleId(l.item_id)) return;
    if (!listedByUser.has(l.seller_user_id)) listedByUser.set(l.seller_user_id, new Map());
    const m = listedByUser.get(l.seller_user_id);
    m.set(l.item_id, (m.get(l.item_id) || 0) + l.qty);
  });

  getAllUserIdsAndCharacters().forEach(({ id, character_json: json }) => {
    let character;
    try {
      character = JSON.parse(json);
    } catch {
      return; // an unparseable character is a bigger problem than cert drift; skip, don't destroy.
    }
    result.checkedUsers += 1;

    const held = new Map();
    (character.inventory || []).forEach((stack) => {
      if (!(stack.qty > 0) || !isGradedTitleId(stack.id)) return;
      held.set(stack.id, (held.get(stack.id) || 0) + stack.qty);
    });
    (listedByUser.get(id) || new Map()).forEach((qty, itemId) => {
      held.set(itemId, (held.get(itemId) || 0) + qty);
    });

    // Every graded id this user has EITHER a holding or a living cert for.
    const gradedIds = new Set(held.keys());
    getLivingCertsForUser(id).forEach((c) => gradedIds.add(c.graded_id));

    gradedIds.forEach((gradedId) => {
      const want = held.get(gradedId) || 0;
      const certs = getLivingCertsFor(id, gradedId).filter((c) => !pinnedCertNos.has(c.cert_no));
      if (certs.length < want) {
        const missing = want - certs.length;
        for (let i = 0; i < missing; i += 1) {
          if (dryRun) { result.minted += 1; continue; }
          const parsed = parseGradedId(gradedId);
          if (!parsed) continue;
          // BACKFILL RULE (owner-approved generosity): a legacy cert gets FIRST EDITION iff its
          // crate is still active at migration time. Everything graded from an archived crate --
          // Counterfinish, Anima, RED, BLUE, and the uncatalogued Open Beta / GOOD S1 -- misses out,
          // which is the same test a freshly graded slab faces today.
          const fe = isFirstEditionEligible(parsed.preGradeId);
          // No subgains: nothing in the registry knows what a pre-registry MGA roll would have
          // been, and inventing them would be fabricating provenance. Legacy MGA certs cannot exist
          // anyway (MGA is new), so in practice every legacy cert is NMG.
          mintCert({
            grader: parsed.grader,
            gradedId,
            ownerUserId: id,
            mintedAt: now,
            source: 'legacy',
            firstEdition: fe,
            subs: null,
            event: certEvent('graded', { by: certDisplayName(character), grade: parsed.grade, legacy: true }),
          });
          result.minted += 1;
          if (fe) result.feMinted += 1;
        }
      } else if (certs.length > want) {
        // Retire the NEWEST surplus certs, not the oldest -- FIFO gives away the oldest cert first
        // everywhere else, so the low, desirable numbers are the ones a real holder keeps, and
        // drift should not be able to take one away.
        const surplus = certs.slice(want);
        surplus.forEach((c) => {
          if (dryRun) { result.retired += 1; return; }
          appendCertHistory(c.cert_no, certEvent('cracked', { reconciled: true }));
          retireCert(c.cert_no, now);
          result.retired += 1;
        });
      }
    });
  });

  // Certs whose owner no longer exists (deleted account) are retired -- they are not in anybody's
  // inventory, so counting them in a population would be a lie.
  const knownUserIds = new Set(getAllUserIdsAndCharacters().map((u) => u.id));
  getAllLivingCerts().forEach((c) => {
    if (c.owner_user_id !== null && !knownUserIds.has(c.owner_user_id)) {
      if (dryRun) { result.retired += 1; return; }
      retireCert(c.cert_no, now);
      result.retired += 1;
    }
  });

  return result;
}

// ---------- Pop Report ----------
// Cached in-memory for 60s. The game has no rate limiting anywhere (see HANDOFF Open Items), and
// this is the one route that aggregates the whole registry, so the cache is doing real work: it
// bounds the query to once a minute no matter how many clients sit on the tab.
const POP_REPORT_CACHE_MS = 60 * 1000;
let popReportCache = { at: 0, payload: null };

function buildPopReport() {
  const rows = getPopulationRows();
  const byGrader = {};
  GRADER_IDS.forEach((g) => { byGrader[g] = { grader: g, short: GRADERS[g].short, name: GRADERS[g].name, total: 0, titles: {} }; });
  rows.forEach((row) => {
    const bucket = byGrader[row.grader];
    if (!bucket) return; // an id from a grader that no longer exists -- ignore rather than crash.
    const parsed = parseGradedId(row.graded_id);
    if (!parsed) return;
    if (!bucket.titles[parsed.preGradeId]) bucket.titles[parsed.preGradeId] = { preGradeId: parsed.preGradeId, total: 0, grades: [] };
    const t = bucket.titles[parsed.preGradeId];
    t.grades.push({ grade: parsed.grade, pop: row.pop, fePop: row.fe_pop, blPop: row.bl_pop });
    t.total += row.pop;
    bucket.total += row.pop;
  });
  // Grade descending within a title; the client does the crate grouping and rarity ordering, since
  // the crate catalogs (and their rarity words) live client-side.
  Object.values(byGrader).forEach((bucket) => {
    bucket.titles = Object.values(bucket.titles).map((t) => ({
      ...t,
      grades: t.grades.sort((a, b) => b.grade - a.grade),
    }));
  });
  return { graders: GRADER_IDS.map((g) => byGrader[g]), generatedAt: Date.now() };
}

app.get('/grading/pop-report', requireAuth, (req, res) => {
  const now = Date.now();
  if (!popReportCache.payload || now - popReportCache.at > POP_REPORT_CACHE_MS) {
    popReportCache = { at: now, payload: buildPopReport() };
  }
  res.json({ ok: true, ...popReportCache.payload, cachedAt: popReportCache.at });
});

// Cert Lookup. Addressed by the DISPLAY series (grader + number), which is what is printed on the
// slab and what a player will actually type in -- the global cert_no is an internal id.
app.get('/grading/cert/:grader/:seriesNo', requireAuth, (req, res) => {
  const grader = getGrader(req.params.grader);
  const seriesNo = Number(req.params.seriesNo);
  if (!grader || !Number.isInteger(seriesNo) || seriesNo < 1) {
    return res.status(400).json({ ok: false, reason: 'Unknown cert number.' });
  }
  const row = getCertBySeries(grader.id, seriesNo);
  if (!row) return res.status(404).json({ ok: false, reason: 'No such cert.' });

  const cert = serializeCert(row);
  // Owner name is denormalized at read time (not stored) so a rename shows the current name.
  // A retired cert has no current owner -- the slab does not exist any more.
  let ownerName = null;
  if (!row.retired_at && row.owner_user_id) {
    const owner = getUserById(row.owner_user_id);
    if (owner) {
      try {
        ownerName = certDisplayName(JSON.parse(owner.character_json));
      } catch {
        ownerName = null;
      }
    }
  }
  res.json({ ok: true, cert: { ...cert, ownerName } });
});

// The caller's own certs, so the client can print a cert number on a slab it is rendering.
app.get('/grading/my-certs', requireAuth, (req, res) => {
  res.json({ ok: true, certs: getLivingCertsForUser(req.user.sub).map(serializeCert) });
});

// Grader catalog -- prices, pitches, which one rolls subgains. Mirrored client-side for display,
// authoritative here for what is actually charged.
app.get('/grading/graders', requireAuth, (req, res) => {
  res.json({
    ok: true,
    graders: GRADER_IDS.map((id) => {
      const g = GRADERS[id];
      return {
        id, name: g.name, short: g.short, pitch: g.pitch,
        subgains: g.subgains, blackLabel: g.blackLabel,
        tiers: Object.fromEntries(Object.entries(g.tiers).map(([t, d]) => [t, { cost: d.cost }])),
        regradeFees: g.regradeFees,
      };
    }),
    crackCost: NMG_CRACK_COST,
  });
});

// ---------- Registry Sets ----------
// Same 60s in-memory cache pattern as Pop Report above, for the same reason: this route aggregates
// every player's full inventory + MTN listings, so bounding it to once a minute keeps the cost flat
// no matter how many clients sit on the tab. Completion is ALSO where achievement-title grants
// happen -- one recompute both answers the request and (idempotently, see the `.includes()` guards
// below) grants any title a newly-complete or newly-qualifying set has earned. Grants are permanent
// once written to titles.owned; nothing in this file ever removes registryCollector/masterSet/
// perfectSet again, including on a later crack that drops the holder below completion -- see the
// long comment above REGISTRY_REWARD_TITLES in gameLogic.js for why that's the intended design, not
// an oversight.
const REGISTRY_CACHE_MS = 60 * 1000;
let registryCache = { at: 0, payload: null };

function buildRegistrySnapshot() {
  const now = Date.now();
  const listings = getAllListings();
  const listedByUser = new Map();
  listings.forEach((l) => {
    if (!isGradedTitleId(l.item_id)) return;
    if (!listedByUser.has(l.seller_user_id)) listedByUser.set(l.seller_user_id, new Map());
    const m = listedByUser.get(l.seller_user_id);
    m.set(l.item_id, (m.get(l.item_id) || 0) + l.qty);
  });

  const users = getAllUsersForLeaderboard(); // [{ id, username, character_json }]
  const perCrate = {};
  REGISTRY_SETS.forEach((s) => { perCrate[s.key] = []; });
  const progressByUser = new Map();
  const touched = new Set();
  const charById = new Map();

  users.forEach((u) => {
    let character;
    try {
      character = JSON.parse(u.character_json);
    } catch {
      return; // an unparseable character is a bigger problem than a missed registry check; skip it.
    }
    charById.set(u.id, character);

    const bestHoldings = computeBestGradedHoldings(character, listedByUser.get(u.id));
    const sets = REGISTRY_SETS.map((set) => computeSetProgress(set, bestHoldings));
    progressByUser.set(u.id, sets);

    sets.forEach((progress) => {
      if (!progress.complete) return;

      // Stable "who finished first" tiebreak, independent of this 60s cache -- see the table
      // comment in db.js for why write-once (INSERT OR IGNORE) is exactly right here.
      let completion = getRegistryCompletion(u.id, progress.key);
      if (!completion) {
        recordRegistryCompletion(u.id, progress.key, now);
        completion = { first_completed_at: now };
      }

      if (!character.titles.owned.includes(REGISTRY_REWARD_TITLES.registryCollector.id)) {
        character.titles.owned.push(REGISTRY_REWARD_TITLES.registryCollector.id);
        touched.add(u.id);
      }
      if (progress.gpa >= REGISTRY_MASTER_SET_GPA && !character.titles.owned.includes(REGISTRY_REWARD_TITLES.masterSet.id)) {
        character.titles.owned.push(REGISTRY_REWARD_TITLES.masterSet.id);
        touched.add(u.id);
      }
      if (progress.gpa >= REGISTRY_PERFECT_SET_GPA && !character.titles.owned.includes(REGISTRY_REWARD_TITLES.perfectSet.id)) {
        character.titles.owned.push(REGISTRY_REWARD_TITLES.perfectSet.id);
        touched.add(u.id);
      }

      perCrate[progress.key].push({
        userId: u.id,
        username: u.username,
        name: certDisplayName(character),
        gpa: progress.gpa,
        graderMix: progress.graderMix,
        completedAt: completion.first_completed_at,
      });
    });
  });

  touched.forEach((userId) => saveCharacter(userId, charById.get(userId)));

  // Ranked highest GPA first; ties broken by earlier completion time (see the completedAt note
  // above), matching a real registry's own tiebreak convention.
  Object.keys(perCrate).forEach((key) => {
    perCrate[key].sort((a, b) => b.gpa - a.gpa || a.completedAt - b.completedAt);
  });

  return {
    generatedAt: now,
    sets: REGISTRY_SETS.map((s) => ({ key: s.key, name: s.name, total: s.titleIds.length })),
    registry: perCrate,
    progressByUser,
  };
}

app.get('/grading/registry', requireAuth, (req, res) => {
  const now = Date.now();
  if (!registryCache.payload || now - registryCache.at > REGISTRY_CACHE_MS) {
    registryCache = { at: now, payload: buildRegistrySnapshot() };
  }
  const snap = registryCache.payload;
  const yourProgress = snap.progressByUser.get(req.user.sub)
    || REGISTRY_SETS.map((s) => ({
      key: s.key, name: s.name, total: s.titleIds.length, haveCount: 0,
      missing: s.titleIds, complete: false, gpa: null, graderMix: null,
    }));
  res.json({
    ok: true,
    generatedAt: snap.generatedAt,
    sets: snap.sets,
    yourProgress,
    registry: snap.registry,
    cachedAt: registryCache.at,
  });
});

// New Milos Grading (NMG): submit/reveal can't reuse the generic runAction() helper -- both need
// direct nmg_slots row work interleaved with the character mutation, same reason the RED/BLUE
// crate routes above bypass it. Slot state deliberately lives in its own table, never inside
// character_json (see the nmg_slots table comment in db.js) -- character_json's only sync path,
// POST /character/sync, applies zero field validation, so a ready_at timestamp stored there would
// be trivially spoofable and would make the paid turnaround tiers meaningless.
app.get('/nmg/state', requireAuth, (req, res) => {
  const slots = getActiveNmgSlots(req.user.sub);
  res.json({
    ok: true,
    slots: slots.map((s) => ({
      id: s.id,
      slotIndex: s.slot_index,
      titleId: s.title_id,
      tier: s.tier,
      grader: s.grader || DEFAULT_GRADER,
      isRegrade: s.cert_no !== null && s.cert_no !== undefined,
      submittedAt: s.submitted_at,
      readyAt: s.ready_at,
      ready: Date.now() >= s.ready_at,
    })),
  });
});

app.post('/nmg/submit', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  if (isMaintenanceBlocked(req)) return res.status(503).json({ ok: false, reason: MAINTENANCE_MESSAGE });

  const { stackId, tier } = req.body || {};
  // `grader` is new with the three-grader split. An older client that doesn't send one gets NMG,
  // which is exactly what it used to get -- so no client/server version skew during a deploy.
  const grader = getGrader((req.body || {}).grader || DEFAULT_GRADER);
  if (!grader) return res.status(400).json({ ok: false, reason: 'Unknown grader.' });
  const tierDef = grader.tiers[tier];
  if (!tierDef) return res.status(400).json({ ok: false, reason: 'Unknown turnaround tier.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  if (isSlimed(character)) return res.status(423).json({ ok: false, reason: 'You just got slimed. Try again once the lockout ends.' });

  const active = getActiveNmgSlots(user.id);
  if (active.length >= NMG_MAX_SLOTS) return res.status(409).json({ ok: false, reason: 'All 4 grading slots are full.' });

  const baseId = nmgBaseIdOf(stackId);
  // Every title is gradeable -- the server has no title catalog of its own (see
  // isCosmeticInventoryId), so "not a known non-title equipment id" (gun/melee/ammo/armor/wrestling
  // gear/drug) is the only thing that's actually checkable here, and is permissive-by-default for
  // any current or future title/crate instead of needing a manually maintained allowlist (which had
  // already missed two real crates -- Milos Legends and Leems Larudo x GOOD -- by the time this was
  // caught).
  if (!isCosmeticInventoryId(baseId)) return res.status(400).json({ ok: false, reason: 'This title cannot be graded.' });
  // Foils ARE gradeable (the earlier blanket exclusion has been reversed). `${base}_foil_nmg${N}`
  // needs no special handling anywhere: nmgBaseIdOf() only strips a `_p\d+` prestige level, so the
  // eligibility check above sees `${base}_foil` and passes it through isCosmeticInventoryId's
  // deny-list unchanged, and /nmg/reveal's `${row.title_id}_nmg${grade}` mint produces the graded
  // foil id directly. Prestige remains the one thing a Foil can never do.
  if (inventoryQty(character, stackId) < 1) return res.status(400).json({ ok: false, reason: "You don't own that title." });
  if (character.cash < tierDef.cost) return res.status(402).json({ ok: false, reason: 'Not enough Floydbucks.' });

  const cashBefore = character.cash;
  character.cash = round2(character.cash - tierDef.cost);
  removeFromInventory(character, stackId, 1);

  const usedIndexes = new Set(active.map((s) => s.slot_index));
  const slotIndex = [0, 1, 2, 3].find((i) => !usedIndexes.has(i));
  const now = Date.now();
  // Testing/demo override for the admin account only -- full tier price still applies, only the
  // wait is shortened, so the reveal flow can be exercised on production without a real multi-day
  // wait. ADMIN_USERNAME is declared later in this file but already initialized by the time any
  // request handler actually runs (full module load completes before the server accepts traffic).
  const isAdminTester = (req.user?.username || '').toLowerCase() === ADMIN_USERNAME;
  const durationMs = isAdminTester ? 5000 : tierDef.ms;
  const readyAt = now + durationMs;
  const rowId = createNmgSlot(user.id, slotIndex, stackId, tier, tierDef.cost, now, readyAt, grader.id, null);

  logTransaction(user.id, `${character.firstName} ${character.lastName}`, 'doNmgSubmit', round2(character.cash - cashBefore), character.cash);
  saveCharacter(user.id, character);
  res.json({ ok: true, character, slot: { id: rowId, slotIndex, titleId: stackId, tier, grader: grader.id, submittedAt: now, readyAt } });
});

// Regrade: resubmit an owned slab for a fresh roll. Structurally the same as /nmg/submit -- it
// consumes a slot, charges up front, and the actual roll happens later at /nmg/reveal -- with two
// differences: it burns the GRADED id instead of a plain title, and it stores the slab's pre-grade
// id as the slot's title_id, so /nmg/reveal's existing `${row.title_id}_nmg${grade}` mint produces
// the re-suffixed slab with no changes needed there at all.
app.post('/nmg/regrade', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  if (isMaintenanceBlocked(req)) return res.status(503).json({ ok: false, reason: MAINTENANCE_MESSAGE });

  const { stackId, tier } = req.body || {};
  const parsed = parseGradedId(stackId);
  if (!parsed) return res.status(400).json({ ok: false, reason: 'That is not a graded slab.' });

  // A slab goes back to the grader that graded it -- the grader is read off the slab's own id, never
  // taken from the request. An MGA slab regrades at MGA prices with fresh SUBGAINS; a CCG slab at
  // CCG prices with none. Cross-grader "re-holdering" is deliberately not a thing: it would let a
  // player launder a $2,000 CCG slab into an MGA one for the price of a regrade.
  const grader = getGrader(parsed.grader);
  if (!grader) return res.status(400).json({ ok: false, reason: 'Unknown grader on that slab.' });
  const tierDef = grader.tiers[tier];
  if (!tierDef) return res.status(400).json({ ok: false, reason: 'Unknown turnaround tier.' });
  const fee = nmgRegradeFee(tier, grader.id);
  if (fee === null) return res.status(400).json({ ok: false, reason: 'Unknown turnaround tier.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  if (isSlimed(character)) return res.status(423).json({ ok: false, reason: 'You just got slimed. Try again once the lockout ends.' });

  const active = getActiveNmgSlots(user.id);
  if (active.length >= NMG_MAX_SLOTS) return res.status(409).json({ ok: false, reason: 'All 4 grading slots are full.' });

  if (inventoryQty(character, stackId) < 1) return res.status(400).json({ ok: false, reason: "You don't own that slab." });
  if (character.cash < fee) return res.status(402).json({ ok: false, reason: 'Not enough Floydbucks.' });

  const cashBefore = character.cash;
  character.cash = round2(character.cash - fee);
  removeFromInventory(character, stackId, 1);
  // The old graded id is gone from here on -- unpin it anywhere it was displayed by id.
  detachGradedIdFromShowcases(character, stackId);

  const usedIndexes = new Set(active.map((s) => s.slot_index));
  const slotIndex = [0, 1, 2, 3].find((i) => !usedIndexes.has(i));
  const now = Date.now();
  const isAdminTester = (req.user?.username || '').toLowerCase() === ADMIN_USERNAME;
  const durationMs = isAdminTester ? 5000 : tierDef.ms;
  const readyAt = now + durationMs;
  // CERT CONTINUITY: the cert SURVIVES a regrade with its number intact. Pick it FIFO now, before
  // the slab leaves inventory, and pin it to the slot so /nmg/reveal updates that same row instead
  // of minting a new one. A regrade is a chapter in the slab's story, not a death and a birth --
  // which is what makes "NMG #000482, graded 6, regraded to 9 three weeks later" a story at all.
  const cert = pickCertFifo(user.id, stackId);
  const rowId = createNmgSlot(user.id, slotIndex, parsed.preGradeId, tier, fee, now, readyAt, grader.id, cert ? cert.cert_no : null);

  logTransaction(user.id, `${character.firstName} ${character.lastName}`, 'doNmgRegrade', round2(character.cash - cashBefore), character.cash);
  saveCharacter(user.id, character);
  res.json({
    ok: true,
    character,
    slot: { id: rowId, slotIndex, titleId: parsed.preGradeId, tier, grader: grader.id, submittedAt: now, readyAt },
    previousGrade: parsed.grade,
    grader: grader.id,
  });
});

// Foil Ascension (Cosmetixxx): 3 copies of one plain title + $25,000 -> 1 `${baseId}_foil`.
// Plain runAction() -- no shared/DB-table state involved, unlike the NMG routes above.
app.post('/cosmetics/foil-ascension', requireAuth, (req, res) => {
  const { stackId } = req.body || {};
  runAction(req, res, doFoilAscension, stackId);
});

app.post('/nmg/reveal', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  if (isMaintenanceBlocked(req)) return res.status(503).json({ ok: false, reason: MAINTENANCE_MESSAGE });

  const { slotId } = req.body || {};
  const row = getNmgSlotById(slotId);
  if (!row || row.user_id !== req.user.sub) return res.status(404).json({ ok: false, reason: 'Unknown slot.' });
  if (row.grade !== null) return res.status(409).json({ ok: false, reason: 'Already revealed.' });
  if (Date.now() < row.ready_at) return res.status(409).json({ ok: false, reason: 'Not ready yet.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);

  const grader = getGrader(row.grader) || GRADERS[DEFAULT_GRADER];
  const grade = rollNmgGrade();
  // SUBGAINS are rolled here, at reveal, for BOTH fresh grades and regrades -- and only for a
  // grader that has them (MGA). CCG/NMG get null and their certs carry NULL subgain columns.
  const subs = rollSubgains(grader.id, grade);
  const gradedId = `${row.title_id}${grader.suffix}${grade}`;
  addToInventory(character, gradedId, 1);

  const name = certDisplayName(character);
  let cert = null;
  if (row.cert_no) {
    // Regrade: same cert_no, new graded_id, fresh subgains, and the grade change appended.
    const prev = getCertByNo(row.cert_no);
    updateCertOnRegrade(row.cert_no, gradedId, subs);
    appendCertHistory(row.cert_no, certEvent('regraded', {
      by: name,
      grade,
      fromGrade: prev ? (parseGradedId(prev.graded_id) || {}).grade ?? null : null,
      subs: subs ? { gloss: subs.gloss, stitch: subs.stitch, aura: subs.aura, drip: subs.drip } : null,
    }));
    cert = getCertByNo(row.cert_no);
  } else {
    const minted = mintCertForSlab({
      userId: user.id,
      gradedId,
      source: 'graded',
      subs,
      event: certEvent('graded', {
        by: name,
        grade,
        subs: subs ? { gloss: subs.gloss, stitch: subs.stitch, aura: subs.aura, drip: subs.drip } : null,
      }),
    });
    cert = minted ? getCertByNo(minted.certNo) : null;
  }

  revealNmgSlot(row.id, grade, Date.now());
  deleteNmgSlot(row.id);
  saveCharacter(user.id, character);

  try {
    // High-signal only -- every reveal (including low grades) would drown out the rest of the
    // ticker, so only near-perfect slabs get a city-wide callout. A Black Label is loud regardless
    // of anything else: it is the rarest outcome in the whole grading system.
    if (subs && subs.blackLabel) {
      recordCityEvent('nmg', `🖤 ${name} pulled a BLACK LABEL MGA 10 on ${prettifyTitleId(row.title_id)} -- all four SUBGAINS perfect`);
    } else if (grade >= 8) {
      recordCityEvent('nmg', `💎 ${name} pulled a ${grader.short} ${grade} on ${prettifyTitleId(row.title_id)}`);
    }
  } catch {
    // Ticker is best-effort flavor -- never let a logging failure break the reveal route.
  }

  res.json({
    ok: true,
    character,
    result: {
      baseTitleId: row.title_id,
      gradedId,
      grade,
      grader: grader.id,
      subgains: subs ? { gloss: subs.gloss, stitch: subs.stitch, aura: subs.aura, drip: subs.drip } : null,
      blackLabel: !!(subs && subs.blackLabel),
      cert: cert ? serializeCert(cert) : null,
    },
  });
});

// Crack a Slab. Moved server-side by the cert registry: a crack RETIRES a cert, and a retirement
// the server never hears about is a permanent, silent Pop Report lie. The old client-side version
// (js/nmg.js crackNmgTitle) now just calls this.
app.post('/nmg/crack', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  if (isMaintenanceBlocked(req)) return res.status(503).json({ ok: false, reason: MAINTENANCE_MESSAGE });

  const { stackId } = req.body || {};
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  if (isSlimed(character)) return res.status(423).json({ ok: false, reason: 'You just got slimed. Try again once the lockout ends.' });

  const cashBefore = character.cash;
  const result = doCrackSlab(character, stackId);
  if (!result.ok) return res.status(400).json(result);

  // Retire the cert BEFORE saving, and pick it FIFO from the pre-crack holding.
  const cert = retireCertFifo(user.id, result.crackedId, certEvent('cracked', { by: certDisplayName(character) }));

  logTransaction(user.id, certDisplayName(character), 'doNmgCrack', round2(character.cash - cashBefore), character.cash);
  saveCharacter(user.id, character);
  res.json({ ...result, cert: cert ? certLabel(cert) : null });
});

// ---------- CosmetixxMarket ----------
// Lazy 24h regen, same "check-and-claim on the next relevant request, no cron job" idiom used
// everywhere else server-side (pause/maintenance checks, the Milos heartbeat, etc).
app.get('/cosmetixx-market/state', requireAuth, (req, res) => {
  const now = Date.now();
  const staleBefore = now - COSMETIXX_MARKET_ROTATION_MS;
  if (tryClaimCosmetixxMarketRegen(now, staleBefore)) {
    replaceCosmetixxMarketSlots(generateCosmetixxMarketSlots());
  }
  const slots = getCosmetixxMarketSlots().map((row) => ({
    id: row.id,
    slotIndex: row.slot_index,
    titleId: row.title_id,
    grade: row.grade,
    price: row.price,
    sold: !!row.sold,
  }));
  res.json({ ok: true, slots, nextRotationAt: getCosmetixxMarketGeneratedAt() + COSMETIXX_MARKET_ROTATION_MS });
});

app.post('/cosmetixx-market/buy', requireAuth, (req, res) => {
  if (getServerState().paused) return res.status(423).json({ ok: false, reason: 'The game is paused.' });
  if (isMaintenanceBlocked(req)) return res.status(503).json({ ok: false, reason: MAINTENANCE_MESSAGE });

  const { slotId } = req.body || {};
  const row = getCosmetixxMarketSlotById(slotId);
  if (!row || row.sold) return res.status(404).json({ ok: false, reason: 'That slab is no longer available.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  if (isSlimed(character)) return res.status(423).json({ ok: false, reason: 'You just got slimed. Try again once the lockout ends.' });
  if (character.cash < row.price) return res.status(402).json({ ok: false, reason: 'Not enough Floydbucks.' });

  // Checked cash BEFORE claiming the slot above -- a lost race here never needs a cash rollback,
  // unlike the RED/BLUE crate's reserve-then-refund flow.
  if (!trySellCosmetixxMarketSlot(row.id, req.user.sub)) {
    return res.status(409).json({ ok: false, reason: 'Someone already bought that slab.' });
  }

  const cashBefore = character.cash;
  character.cash = round2(character.cash - row.price);
  // CosmetixxMarket mints NMG slabs and only NMG slabs, deliberately: the store is the SYSTEM
  // buying grading, and the system uses the everyman grader. MGA is a player prestige path you opt
  // into and pay triple for, and CCG is a player budget choice -- neither is something the game
  // should hand out on rotation.
  const gradedId = `${row.title_id}${GRADERS.nmg.suffix}${row.grade}`;
  addToInventory(character, gradedId, 1);

  // CERT MINTED AT PURCHASE, not at rotation generation. A rotation slab that nobody buys never
  // existed as a physical object -- minting at generation would inflate every population by up to
  // 5 phantom slabs a day, and those phantoms would be unownable and uncrackable forever. Certs are
  // a registry of things that EXIST, so the object comes into being when someone pays for it.
  const buyerName = certDisplayName(character);
  mintCertForSlab({
    userId: user.id,
    gradedId,
    source: 'market',
    subs: null,
    event: certEvent('market_buy', { to: buyerName, price: row.price, grade: row.grade }),
  });

  logTransaction(user.id, `${character.firstName} ${character.lastName}`, 'cosmetixxMarket/buy', round2(character.cash - cashBefore), character.cash);
  saveCharacter(user.id, character);

  try {
    // Purchase price is public flavor here (a market listing, not PvP theft), unlike duel/robbery
    // amounts -- see the privacy note on recordCityEvent call sites.
    recordCityEvent('cosmetixxMarket', `🏪 ${character.firstName} ${character.lastName} bought an NMG ${row.grade} ${prettifyTitleId(row.title_id)} slab for $${row.price.toLocaleString()} on CosmetixxMarket`);
  } catch {
    // Ticker is best-effort flavor -- never let a logging failure break the buy route.
  }

  res.json({ ok: true, character, result: { gradedId, price: row.price } });
});

// `count` is the x5 batch size (clamped server-side in each doX -- see clampBatchCount).
app.post('/hustle/work', requireAuth, (req, res) => runAction(req, res, doWork, (req.body || {}).count));
app.post('/hustle/slut', requireAuth, (req, res) => runAction(req, res, doSlut, getRandomOtherUserCharacterName(req.user.sub), (req.body || {}).count));
app.post('/hustle/crime', requireAuth, (req, res) => runAction(req, res, doCrime, (req.body || {}).count));

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
  const { plotId, drugId, qty } = req.body || {};
  runAction(req, res, doPlantFarmSeed, plotId, drugId, qty);
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
app.post('/crypto/advance-machine', requireAuth, (req, res) => runAction(req, res, doAdvanceCryptoMachine));
app.post('/crypto/prestige', requireAuth, (req, res) => runAction(req, res, doPrestigeCryptoRig));
app.post('/crypto/collect', requireAuth, (req, res) => runAction(req, res, doCollectCrypto));
app.post('/crypto/sell', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doSellFC, Number(amount));
});
app.post('/crypto/buy', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doBuyFC, Number(amount));
});
app.post('/crypto/cold-storage/deposit', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doDepositColdStorage, Number(amount));
});
app.post('/crypto/cold-storage/withdraw', requireAuth, (req, res) => {
  const { amount } = req.body || {};
  runAction(req, res, doWithdrawColdStorage, Number(amount));
});
app.post('/crypto/cold-storage/upgrade', requireAuth, (req, res) => runAction(req, res, doBuyColdStorageUpgrade));

app.post('/jobs/good/apply', requireAuth, (req, res) => {
  const { jobId } = req.body || {};
  runAction(req, res, doApplyGoodJob, jobId);
});
app.post('/jobs/good/resign', requireAuth, (req, res) => runAction(req, res, doResignGoodJob));
// `count` is the x10 batch size. Clamped inside doGoodJobWork/doBadJobWork (clampBatchCount) rather
// than here, so a direct API call can't request 1,000 shifts on one cooldown.
app.post('/jobs/good/work', requireAuth, (req, res) => {
  const { skillKey, count } = req.body || {};
  runAction(req, res, doGoodJobWork, skillKey, count);
});

app.post('/jobs/bad/apply', requireAuth, (req, res) => {
  const { jobId } = req.body || {};
  runAction(req, res, doApplyBadJob, jobId);
});
app.post('/jobs/bad/resign', requireAuth, (req, res) => runAction(req, res, doResignBadJob));
app.post('/jobs/bad/work', requireAuth, (req, res) => {
  const { skillKey, count } = req.body || {};
  runAction(req, res, doBadJobWork, skillKey, count);
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
  try {
    recordCityEvent('marriage', `💍 ${proposerCharacter.firstName} ${proposerCharacter.lastName} married ${targetCharacter.firstName} ${targetCharacter.lastName}`);
  } catch {
    // Ticker is best-effort flavor -- never let a logging failure break the marriage route.
  }
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
      // Cert transfer: one cert per unit sold, FIFO from the seller's living certs. The sale PRICE
      // goes into the provenance event -- public flavor, consistent with the city ticker precedent
      // that already broadcasts CosmetixxMarket purchase prices.
      if (isGradedTitleId(listing.item_id)) {
        const buyerName = `${buyerCharacter.firstName} ${buyerCharacter.lastName}`;
        const sellerName = `${sellerCharacter.firstName} ${sellerCharacter.lastName}`;
        for (let i = 0; i < listing.qty; i += 1) {
          transferCertFifo(sellerUser.id, buyerUser.id, listing.item_id, certEvent('mtn_sale', {
            from: sellerName, to: buyerName, price: round2(listing.price_per_unit),
          }));
        }
      }
      creditSellerForSale(sellerCharacter, listing.item_id, listing.qty, total, `${buyerCharacter.firstName} ${buyerCharacter.lastName}`);
      logTransaction(sellerUser.id, `${sellerCharacter.firstName} ${sellerCharacter.lastName}`, 'mtn/sell', total, sellerCharacter.cash);
      saveCharacter(sellerUser.id, sellerCharacter);
      createMtnSaleNotification(sellerUser.id, `${buyerCharacter.firstName} ${buyerCharacter.lastName}`, listing.item_id, listing.qty, total);
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
      try {
        recordCityEvent('arrest', `🚨 ${character.firstName} ${character.lastName} got arrested for ${character.jail.crime || 'Crime'}`);
      } catch {
        // Ticker is best-effort flavor -- never let a logging failure break the jail sync route.
      }
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

// ---------- Reports (bug/wipe/suggestion) ----------
const REPORT_TYPES = ['bug', 'wipe', 'suggestion'];
const REPORT_MESSAGE_MAX_LEN = 2000;
const REPORT_PAGE_SIZE = 20;

app.post('/reports/submit', requireAuth, (req, res) => {
  const { type, message } = req.body || {};
  const trimmed = (message || '').trim();
  if (!REPORT_TYPES.includes(type)) return res.status(400).json({ ok: false, reason: 'Unknown report type.' });
  if (!trimmed) return res.status(400).json({ ok: false, reason: 'Enter a message.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  createReport(user.id, user.username, type, trimmed.slice(0, REPORT_MESSAGE_MAX_LEN));
  res.json({ ok: true, message: 'Submitted. Thanks!' });
});

function serializeReport(row) {
  return {
    id: row.id,
    username: row.username,
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
    resolved: !!row.resolved,
    resolvedComment: row.resolved_comment,
    resolvedAt: row.resolved_at,
  };
}

app.get('/reports/list', requireAuth, requireAdminPassword, (req, res) => {
  const page = Math.max(0, parseInt(req.query.page, 10) || 0);
  const typeFilter = REPORT_TYPES.includes(req.query.type) ? req.query.type : null;
  const { rows, total } = getReportsPage(page, REPORT_PAGE_SIZE, typeFilter);
  res.json({ ok: true, reports: rows.map(serializeReport), total, page, pageSize: REPORT_PAGE_SIZE });
});

const REPORT_RESOLVE_COMMENT_MAX_LEN = 1000;

app.post('/reports/:id/resolve', requireAuth, requireAdminPassword, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const comment = (req.body?.comment || '').trim();
  if (!id) return res.status(400).json({ ok: false, reason: 'Unknown report.' });
  if (!comment) return res.status(400).json({ ok: false, reason: 'Enter a comment for the reporter.' });

  const report = getReportById(id);
  if (!report) return res.status(404).json({ ok: false, reason: 'Report not found.' });
  if (report.resolved) return res.status(409).json({ ok: false, reason: 'Already resolved.' });

  const trimmedComment = comment.slice(0, REPORT_RESOLVE_COMMENT_MAX_LEN);
  resolveReport(id, trimmedComment, Date.now());
  createReportResolvedNotification(report.user_id, report.type, trimmedComment);
  res.json({ ok: true, report: serializeReport(getReportById(id)) });
});

function serializeReportResolvedNotification(row) {
  return { id: row.id, reportType: row.report_type, comment: row.comment, createdAt: row.created_at, seen: !!row.seen };
}

app.get('/notifications/report-resolved', requireAuth, (req, res) => {
  res.json({
    ok: true,
    notifications: getReportResolvedNotifications(req.user.sub).map(serializeReportResolvedNotification),
    unseenCount: getUnseenReportResolvedCount(req.user.sub),
  });
});

app.post('/notifications/report-resolved/seen', requireAuth, (req, res) => {
  markReportResolvedNotificationsSeen(req.user.sub);
  res.json({
    ok: true,
    notifications: getReportResolvedNotifications(req.user.sub).map(serializeReportResolvedNotification),
    unseenCount: getUnseenReportResolvedCount(req.user.sub),
  });
});

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

// Update 4 season wipe: everyone's inventory clears except crate-won titles (Cosmetixxx crates,
// GOOD, VISIONS, Milos Legends 1) and NMG-graded titles; every titles.owned entry (achievement
// titles, cash-bought Cosmetixxx titles) is dropped; Farms/Crypto/Altcoins/jobs/bank/etc. reset to
// defaults, same as /admin/reset-all-stats. The one difference: cash is not zeroed, it converts
// down 100,000:1,000 ($100k -> $1k). One-time, irreversible -- same gate as every other admin action.
app.post('/admin/season-wipe', requireAuth, requireAdminPassword, (req, res) => {
  const users = getAllUsersForLeaderboard();
  users.forEach((row) => {
    const character = JSON.parse(row.character_json);
    saveCharacter(row.id, resetCharacterSeasonWipe(character));
  });
  res.json({ ok: true, message: `Season wipe applied to ${users.length} player(s). Crate/graded titles and cash (converted 100k:1k) kept.`, cls: 'gain' });
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

// Grants an arbitrary inventory stack to any player by username -- e.g. hand-awarding a prestige
// title id like cfHowl_p4. Reuses the same addToInventory/saveCharacter pair every other inventory
// mutation in this file goes through, so it's subject to the same known race as
// /admin/reset-all-stats: if the target is mid-session, their next /character/sync can clobber this
// if it lands first. Fine for the rare, deliberate admin grant this exists for.
app.post('/admin/grant-item', requireAuth, requireAdminPassword, (req, res) => {
  const { username, itemId, qty } = req.body || {};
  const targetUsername = (username || '').trim();
  const targetItemId = (itemId || '').trim();
  const targetQty = Math.floor(+qty) || 1;
  if (!targetUsername || !targetItemId) return res.status(400).json({ ok: false, reason: 'Enter a username and item id.' });
  if (targetQty < 1) return res.status(400).json({ ok: false, reason: 'Quantity must be at least 1.' });

  const user = getUserByUsername(targetUsername);
  if (!user) return res.status(404).json({ ok: false, reason: `No player named "${targetUsername}" found.` });

  const character = JSON.parse(user.character_json);
  addToInventory(character, targetItemId, targetQty);
  saveCharacter(user.id, character);
  res.json({ ok: true, message: `Gave ${targetQty}x ${targetItemId} to ${user.username}.` });
});

// Same shape as /admin/grant-item, but for cash -- logs a transaction (unlike grant-item) since
// every other cash mutation in this file does, for the same audit-trail reason.
app.post('/admin/grant-cash', requireAuth, requireAdminPassword, (req, res) => {
  const { username, amount } = req.body || {};
  const targetUsername = (username || '').trim();
  const targetAmount = round2(+amount);
  if (!targetUsername) return res.status(400).json({ ok: false, reason: 'Enter a username.' });
  if (!(targetAmount > 0)) return res.status(400).json({ ok: false, reason: 'Amount must be a positive number.' });

  const user = getUserByUsername(targetUsername);
  if (!user) return res.status(404).json({ ok: false, reason: `No player named "${targetUsername}" found.` });

  const character = JSON.parse(user.character_json);
  character.cash = round2(character.cash + targetAmount);
  saveCharacter(user.id, character);
  logTransaction(user.id, `${character.firstName} ${character.lastName}`, 'admin/grant-cash', targetAmount, character.cash);
  res.json({ ok: true, message: `Gave $${targetAmount.toLocaleString()} to ${user.username}.` });
});

// Clears the NMG grading backlog across every player at once -- marks every still-pending slot
// ready now. Players still have to click REVEAL themselves (the grade is still rolled at reveal
// time, same as always); this only skips the wait.
app.post('/admin/nmg-fast-forward-all', requireAuth, requireAdminPassword, (req, res) => {
  const count = fastForwardAllActiveNmgSlots(Date.now());
  res.json({ ok: true, message: `Fast-forwarded ${count} pending grading slot(s) to ready.` });
});

// Regen is normally lazy (only triggered by the next /cosmetixx-market/state request once the 24h
// timer expires) and never retroactive -- a rotation already live when a pricing change deploys
// keeps its old prices until it naturally rotates. This forces an immediate regeneration with
// current pricing/catalog logic instead of waiting out the rest of the 24h window.
// Rebuild the cert registry from an inventory scan: mints 'legacy' certs for anything holding a
// slab with no cert, retires certs nobody holds. Same function that runs at boot -- this is the
// manual trigger for when a bug is suspected. `dryRun` reports what it WOULD do and changes nothing.
app.post('/admin/grading-reconcile', requireAuth, requireAdminPassword, (req, res) => {
  const dryRun = !!(req.body || {}).dryRun;
  const result = reconcileCerts({ dryRun });
  // Only a real run moves counts -- a dry run must not evict a perfectly good cached report.
  if (!dryRun) popReportCache = { at: 0, payload: null };
  res.json({ ok: true, dryRun, ...result });
});

app.post('/admin/cosmetixx-market-regen', requireAuth, requireAdminPassword, (req, res) => {
  const now = Date.now();
  tryClaimCosmetixxMarketRegen(now, now + 1); // +1 guarantees the claim succeeds regardless of current timestamp
  replaceCosmetixxMarketSlots(generateCosmetixxMarketSlots());
  res.json({ ok: true, message: 'CosmetixxMarket regenerated with 5 new slabs.' });
});

// Every player's Bank/Cold Storage balances in one list -- read-only, admin-only. Reuses
// getAllUsersForLeaderboard (already just {id, username, character_json} for every user) rather
// than adding a new bespoke query, same as /admin/reset-all-stats above.
app.get('/admin/bank-balances', requireAuth, requireAdminPassword, (req, res) => {
  const rows = getAllUsersForLeaderboard().map((row) => {
    const character = JSON.parse(row.character_json);
    const bank = character.bank || { tier: 0, balance: 0, hasCreditCard: false, creditBalance: 0 };
    const tierDef = BANK_TIERS[bank.tier];
    return {
      username: row.username,
      name: `${character.firstName} ${character.lastName}`,
      tier: bank.tier,
      tierName: tierDef ? tierDef.name : 'Unknown',
      balance: bank.balance,
      hasCreditCard: !!bank.hasCreditCard,
      creditBalance: bank.creditBalance || 0,
      pocketCash: character.cash || 0,
    };
  }).sort((a, b) => b.balance - a.balance);
  res.json({ ok: true, balances: rows });
});

app.get('/admin/crypto-balances', requireAuth, requireAdminPassword, (req, res) => {
  const rows = getAllUsersForLeaderboard().map((row) => {
    const character = JSON.parse(row.character_json);
    const crypto = character.crypto || { fc: 0 };
    const coldStorage = crypto.coldStorage || { fc: 0, tier: 0 };
    return {
      username: row.username,
      name: `${character.firstName} ${character.lastName}`,
      hotWalletFc: crypto.fc || 0,
      coldStorageFc: coldStorage.fc || 0,
      coldStorageTier: coldStorage.tier || 0,
      totalFc: round4((crypto.fc || 0) + (coldStorage.fc || 0)),
    };
  }).sort((a, b) => b.totalFc - a.totalFc);
  res.json({ ok: true, balances: rows });
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
    badgeId: row.badge_id,
    message: row.message,
    sentAt: row.sent_at,
  };
}

// ---------- City Pulse ----------
// Cosmetic title ids are opaque camelCase/underscore strings (see the "no title catalog" note near
// isCosmeticInventoryId) -- the server has no display-name lookup for them, so this just turns
// `animaHyperGear5` / `og_gutter_rat` into "Anima Hyper Gear5" / "Og Gutter Rat" for ticker flavor
// text. Good enough for a comedic one-liner; not meant to match the client's real title names.
function prettifyTitleId(titleId) {
  return String(titleId || '')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const CITY_EVENTS_FEED_LIMIT = 30;

app.get('/city/events', requireAuth, (req, res) => {
  res.json({ ok: true, events: getRecentCityEvents(CITY_EVENTS_FEED_LIMIT).map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
  })) });
});

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

  // "Chill in Chat" -- typing exactly "chill" (any case/whitespace) bumps Variety +1%, on top of
  // posting the message normally.
  if (trimmed.toLowerCase() === 'chill') {
    addVariety(character, CHILL_VARIETY_GAIN);
    saveCharacter(user.id, character);
  }

  // Read the sender's equipped badge straight off their own already-loaded character (not a
  // client-supplied param like titleId) -- the server has it right here, no reason to trust a
  // second client-sent value that could drift from what's actually equipped.
  const badgeId = (character.badges && character.badges.equipped) || null;

  createChatMessage(user.id, senderName, safeTitleText, trimmed.slice(0, CHAT_MESSAGE_MAX_LEN), safeTitleId, badgeId);
  res.json({ ok: true, messages: getRecentChatMessages().map(serializeChatMessage) });
});

// ---------- Stock Market ----------
// Reads every ticker's DB row and ticks each one forward by however many 32s intervals have
// elapsed since it was last touched, persisting only the ones that actually moved. Called at the
// top of every stock/investor-chat route so price is always current before anything reads it.
function ensureStocksTicked() {
  const now = Date.now();
  return getAllStocks().map((row) => {
    const stock = {
      symbol: row.symbol,
      name: row.name,
      sector: row.sector,
      tier: row.tier,
      price: row.price,
      fairValue: row.fair_value,
      lastTickAt: row.last_tick_at,
    };
    if (advanceStockTicks(stock, now)) {
      updateStockPrice(stock.symbol, stock.price, stock.fairValue, stock.lastTickAt);
      recordStockPricePoint(stock.symbol, stock.price, now);
    }
    return stock;
  });
}

function serializeStock(s) {
  return { symbol: s.symbol, name: s.name, sector: s.sector, tier: s.tier, price: s.price, spread: STOCK_SPREAD };
}

const STOCK_HISTORY_RANGE_MS = {
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
};
const STOCK_HISTORY_MAX_POINTS = 200;

// Simple stride downsampling -- keeps the chart payload small regardless of range, while always
// including the most recent point so the right edge of the chart matches the current price.
function downsampleStockHistory(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const stride = Math.ceil(points.length / maxPoints);
  const sampled = [];
  for (let i = 0; i < points.length; i += stride) sampled.push(points[i]);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

app.get('/stocks/:symbol/history', requireAuth, (req, res) => {
  const { symbol } = req.params;
  const range = req.query.range || '1d';
  const stocks = ensureStocksTicked();
  const stock = stocks.find((s) => s.symbol === symbol);
  if (!stock) return res.status(404).json({ ok: false, reason: 'Unknown stock.' });

  const sinceTs = range === 'all' ? 0 : Date.now() - (STOCK_HISTORY_RANGE_MS[range] || STOCK_HISTORY_RANGE_MS['1d']);
  const rows = getStockPriceHistory(symbol, sinceTs);
  const points = downsampleStockHistory(rows.map((r) => ({ price: r.price, ts: r.recorded_at })), STOCK_HISTORY_MAX_POINTS);
  res.json({ ok: true, symbol, range, points });
});

const BOT_POST_MIN_GAP_MS = 45 * 1000;
const BOT_POST_MAX_GAP_MS = 90 * 1000;

// Fires at most one NPC Investors Chat post per call, only once the shared cadence timer says
// it's due -- unlike price ticks, a bot post doesn't need to replay history on catch-up, it just
// resumes from "now". A "real" post also jolts the price it references.
function maybeSpawnInvestorBotPost(stocks) {
  const state = getStockMarketState();
  const now = Date.now();
  if (now < state.next_bot_post_at) return;

  const post = generateInvestorBotPost(stocks);
  createInvestorChatMessage(null, post.senderName, null, post.message, null, true);

  if (post.isReal && post.stockSymbol) {
    const stock = stocks.find((s) => s.symbol === post.stockSymbol);
    if (stock) {
      applyStockNewsShock(stock, post.bullish);
      updateStockPrice(stock.symbol, stock.price, stock.fairValue, stock.lastTickAt);
    }
  }

  setNextBotPostAt(now + randInt(BOT_POST_MIN_GAP_MS, BOT_POST_MAX_GAP_MS));
}

// ---------- Level II Research feed ----------
const INVESTOR_L2_POST_INTERVAL_MS = 5 * 60 * 1000;

// Same "fires at most one post per call, once due" shape as maybeSpawnInvestorBotPost above, but
// on a fixed 5-minute cadence and reporting the picked stock's REAL price move over that window
// (see generateL2Post in gameLogic.js for the accurate/inaccurate roll) rather than banter.
function maybeSpawnL2Post(stocks) {
  const state = getStockMarketState();
  const now = Date.now();
  if (state.next_l2_post_at && now < state.next_l2_post_at) return;
  if (!stocks.length) return;

  const stock = pickRandom(stocks);
  const history = getStockPriceHistory(stock.symbol, now - INVESTOR_L2_POST_INTERVAL_MS);
  const oldPrice = history.length ? history[0].price : stock.price;
  const post = generateL2Post(stock, oldPrice);
  createL2FeedPost(post.symbol, post.direction, post.pct, post.accurate, post.message, now);

  setNextL2PostAt(now + INVESTOR_L2_POST_INTERVAL_MS);
}

function serializeL2Post(row) {
  return { id: row.id, symbol: row.symbol, direction: row.direction, pct: row.pct, message: row.message, sentAt: row.sent_at };
}

app.get('/investors/l2/feed', requireAuth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);

  if (!character.investorL2 || !character.investorL2.active) {
    return res.json({ ok: true, subscribed: false, posts: [] });
  }

  const stocks = ensureStocksTicked();
  maybeSpawnL2Post(stocks);
  res.json({ ok: true, subscribed: true, posts: getRecentL2Feed().map(serializeL2Post) });
});

app.get('/stocks', requireAuth, (req, res) => {
  const stocks = ensureStocksTicked();
  maybeSpawnInvestorBotPost(stocks);
  res.json({ ok: true, stocks: stocks.map(serializeStock) });
});

app.post('/stocks/buy', requireAuth, (req, res) => {
  const { symbol, qty } = req.body || {};
  const stocks = ensureStocksTicked();
  const stock = stocks.find((s) => s.symbol === symbol);
  if (!stock) return res.status(404).json({ ok: false, reason: 'Unknown stock.' });
  runAction(req, res, doBuyStock, stock, qty);
});

app.post('/stocks/sell', requireAuth, (req, res) => {
  const { symbol, qty } = req.body || {};
  const stocks = ensureStocksTicked();
  const stock = stocks.find((s) => s.symbol === symbol);
  if (!stock) return res.status(404).json({ ok: false, reason: 'Unknown stock.' });
  runAction(req, res, doSellStock, stock, qty);
});

// ---------- Investors Chat ----------
// A separate chat room from New Milos City's (chat_messages/createChatMessage above) -- its own
// table, its own routes, never merged with the main chat. Real player posts sit alongside NPC bot
// posts (see maybeSpawnInvestorBotPost) in the same feed.
const INVESTOR_CHAT_MESSAGE_MAX_LEN = 500;

function serializeInvestorChatMessage(row) {
  return {
    id: row.id,
    senderName: row.sender_name,
    titleText: row.title_text,
    titleId: row.title_id,
    message: row.message,
    isBot: !!row.is_bot,
    sentAt: row.sent_at,
  };
}

app.get('/investors/chat/messages', requireAuth, (req, res) => {
  const stocks = ensureStocksTicked();
  maybeSpawnInvestorBotPost(stocks);
  res.json({ ok: true, messages: getRecentInvestorChatMessages().map(serializeInvestorChatMessage) });
});

app.post('/investors/chat/send', requireAuth, (req, res) => {
  const { titleText, message, titleId } = req.body || {};
  const trimmed = (message || '').trim();
  if (!trimmed) return res.status(400).json({ ok: false, reason: 'Enter a message.' });

  const user = getUserById(req.user.sub);
  if (!user) return res.status(404).json({ ok: false, reason: 'User not found.' });
  const character = JSON.parse(user.character_json);
  const senderName = `${character.firstName} ${character.lastName}`;
  const safeTitleText = (titleText || 'CIVILIAN').slice(0, CHAT_TITLE_MAX_LEN);
  const safeTitleId = typeof titleId === 'string' ? titleId.slice(0, CHAT_TITLE_MAX_LEN) : null;

  createInvestorChatMessage(user.id, senderName, safeTitleText, trimmed.slice(0, INVESTOR_CHAT_MESSAGE_MAX_LEN), safeTitleId, false);
  res.json({ ok: true, messages: getRecentInvestorChatMessages().map(serializeInvestorChatMessage) });
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

// Same idea for the stock price history the sidebar chart reads -- nothing needs data older than
// a month, and a tick every 32s adds up (~2,700 rows/ticker/day) if left unbounded.
const STOCK_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
function pruneStockHistory() {
  const removed = pruneOldStockPriceHistory(STOCK_HISTORY_RETENTION_MS);
  if (removed > 0) console.log(`Pruned ${removed} stock price history row(s) older than 30 days.`);
}
pruneStockHistory();
setInterval(pruneStockHistory, TRANSACTION_PRUNE_INTERVAL_MS);

// Cert registry backfill / drift repair.
//
// DECISION: this runs automatically at boot rather than being an admin route you remember to
// trigger once. Reconcile is idempotent by construction (it compares certs against holdings and
// only closes the gap), so a no-op boot costs one scan of ~15 characters; and running it every boot
// means the registry self-heals if some future code path moves a graded id without a cert hook,
// instead of silently drifting until someone notices a wrong population. The admin route
// (/admin/grading-reconcile) still exists for an on-demand run and for a dry-run report.
//
// The very first boot after deploy IS the backfill: every existing slab in every inventory has no
// cert yet, so all of them mint as source 'legacy'.
try {
  const reconciled = reconcileCerts();
  console.log(
    `Grading cert reconcile: ${reconciled.minted} minted (${reconciled.feMinted} First Edition), `
    + `${reconciled.retired} retired, across ${reconciled.checkedUsers} character(s).`
  );
} catch (err) {
  // A reconcile failure must never stop the server from booting -- the game works fine with a
  // stale registry, and a crash loop here would take the whole game down over a cosmetics feature.
  console.error('Grading cert reconcile failed at boot:', err);
}

app.listen(PORT, () => {
  console.log(`mfmmoalpha-server listening on port ${PORT}`);
});
