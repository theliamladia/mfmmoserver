require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
  createUser,
  getUserByUsername,
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
} = require('./db');
const { hashPassword, checkPassword, issueToken, requireAuth } = require('./auth');
const {
  newCharacter,
  doWork,
  doSlut,
  doCrime,
  doWorkout,
  doSetSteroidTier,
  doRoidEscape,
  doBuyFood,
  doBuyMaxx,
  doBuyChips,
  doCashOut,
  doBjDeal,
  doBjHit,
  doBjStand,
  doSlotSpin,
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
  doStartFight,
  doCombatAction,
  doFlee,
  doAttemptCrime,
  doCommunityService,
  doHireLawyer,
  doJailWorkout,
  doJailFight,
  doBuyContraband,
  doCityHallRename,
  doMarriagePropose,
  doGunSafetyResult,
  doRangeShoot,
  doRangeDraw,
  doRangeReload,
  doCreateListing,
  doCancelListing,
  doBuyListing,
  creditSellerForSale,
  round2,
} = require('./gameLogic');

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
app.post('/hustle/slut', requireAuth, (req, res) => runAction(req, res, doSlut));
app.post('/hustle/crime', requireAuth, (req, res) => runAction(req, res, doCrime));

app.post('/gym/workout', requireAuth, (req, res) => runAction(req, res, doWorkout));
app.post('/gym/steroid-tier', requireAuth, (req, res) => {
  const { tierId } = req.body || {};
  runAction(req, res, doSetSteroidTier, tierId ?? null);
});
app.post('/gym/roid-escape', requireAuth, (req, res) => runAction(req, res, doRoidEscape));

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
  runAction(req, res, doMarriagePropose, name);
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
// client-side (trivially bypassable via devtools), now actually checked server-side too.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fishdoc15!';

function requireAdminPassword(req, res, next) {
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

app.listen(PORT, () => {
  console.log(`mfmmoalpha-server listening on port ${PORT}`);
});
