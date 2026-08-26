// ---------- Game logic, ported from mfmmoalpha's client-side core.js/market.js ----------
// Same shape and constants as the client so a character row here is a drop-in match for what
// the client already knows how to render. Only the "work" hustle is wired up server-side so far --
// this is the first vertical slice proving the client/server split; everything else on the client
// still runs locally until it gets ported the same way.

const STAT_CAP = 100;
const COOLDOWN_MS = 10000;
const ALLIANCE_BUFF = 2; // legal work nudges toward Holy Good
const ALLIANCE_DEBUFF = 6; // getting caught (or committing crime) nudges toward Dirty Bad
const ALLIANCE_DEBUFF_MINOR = 3; // smaller nudge toward Dirty Bad for lower-stakes bad acts (e.g. Slut)
const GUZMAN_MIN_ALLIANCE = 60; // Bad Hustles require Bad or worse; also the floor a bust snaps you to
const CRIME_STREAK_MAX = 12; // cap on how much a record can escalate a sentence

// ---------- Da Skreetz starter ladder ----------
// Rebalanced so the three starter hustles form an actual ladder instead of Crime dwarfing
// everything else on day one. Work used to pay $2-10 (unusably bad) and Crime $100-1,000 (better
// than several mid-game systems, at a 30% bust rate, from minute one). Mirrored client-side --
// nothing displays these ranges today, but they must stay in step if anything ever does.
const WORK_PAY_MIN = 10;
const WORK_PAY_MAX = 30;
const SKREETZ_CRIME_PAY_MIN = 80;
const SKREETZ_CRIME_PAY_MAX = 400;

// Reward ranges are 20% below their original values (Drugs & Rugs balance pass -- crime pay down).
const CRIME_TIERS_BY_ID = {
  shoplift: { id: 'shoplift', name: '🛍️ Shoplifting', minReward: 64, maxReward: 160, jailYears: 1, baseRisk: 0.35 },
  pettytheft: { id: 'pettytheft', name: '👛 Petty Theft', minReward: 280, maxReward: 520, jailYears: 1, baseRisk: 0.45 },
  burglary: { id: 'burglary', name: '🏚️ Burglary', minReward: 960, maxReward: 1760, jailYears: 4, baseRisk: 0.5 },
  grandtheft: { id: 'grandtheft', name: '🚗 Grand Theft Auto', minReward: 1800, maxReward: 2000, jailYears: 6, baseRisk: 0.6 },
};
const CRIME_COOLDOWN_MS = 12000;
const CRIME_RISK_MIN = 0.05;
const CRIME_STAT_MITIGATION = 0.5;
const COMMUNITY_SERVICE_COOLDOWN_MS = 60000;
const COMMUNITY_SERVICE_BASE_COST = 750;
const COMMUNITY_SERVICE_STREAK_REDUCTION = 4;
// Was flat-linear (base * (1+streak)) -- a repeat offender's cost per streak point never got any
// worse than their first. This second factor makes the cost curve steeper the higher your pending
// punitive sentence (crimeRecord.streak, which lengthens every future jail sentence) already is, so
// washing away a heavily escalated record costs proportionally more, not just more in step with it.
// Unchanged at streak=0 (factor is exactly 1 there) -- only kicks in once you actually have a record.
const COMMUNITY_SERVICE_ESCALATION_RATE = 0.15;

function communityServiceCost(streak) {
  return Math.round(COMMUNITY_SERVICE_BASE_COST * (1 + streak) * (1 + streak * COMMUNITY_SERVICE_ESCALATION_RATE));
}

const GYM_BURN_LBS = 0.5;
const GYM_COST = 20;
const GYM_SPEED_GAIN = 0.6;
const STEROID_TIERS_BY_ID = {
  mild: { id: 'mild', name: '💊 Mild Cycle', mult: 1.75, jailChance: 0.2, jailClicks: 3 },
  standard: { id: 'standard', name: '💉 Standard Cycle', mult: 3, jailChance: 0.4, jailClicks: 5 },
  heavy: { id: 'heavy', name: '☠️ Heavy Cycle', mult: 5, jailChance: 0.6, jailClicks: 9 },
};
const ROID_ESCAPE_COST = GYM_COST * 4;

// Body is 90% of Looks, Face (Maxx items, see MAXX_ITEMS_BY_ID) is the other 10%. Body score is a
// single uncapped accumulator (character.gym.bodyScore) built up by Workouts and eating -- the old
// separate Body-tab exercise minigame was removed as unnecessarily confusing; Looks now grows as a
// side effect of the same actions you're already doing for Speed/Defense/weight. Eating costs a
// little Looks (slightly less than a Workout gains) so the two pull in opposite directions --
// working out nets you ahead, but you can't just eat your way to higher Looks.
const WORKOUT_LOOKS_GAIN = 0.05;
const FOOD_LOOKS_LOSS = 0.04;
const BODY_LOOKS_WEIGHT = 0.9;
const FACE_LOOKS_WEIGHT = 0.1;

const CALORIES_PER_LB = 3500;
const DEFENSE_PER_LB = 0.5;
const SPEED_LOSS_PER_LB = 1;
const MUSCLE_GAIN_RATIO = 0.3; // muscle builds slowly -- only this fraction of the fat burned per workout
const STRETCH_HEIGHT_COOLDOWN_MS = 30000;
const STRETCH_HEIGHT_MUSCLE_COST = 60;
const STRETCH_HEIGHT_GAIN_IN = 1;
const JOB_PERK_MIN_AVG = 55; // Supervisor/Lieutenant and up

const BANK_TIERS = [
  { name: '🏦 New Milos Discovery', cardName: 'NMB Discovery', maxBalance: 5000, upgradeCost: 0 },
  { name: '🏦 New Milos Bank Card', cardName: 'NMB Advantage Standard', maxBalance: 25000, upgradeCost: 10000 },
  { name: '🏦 New Milos Phalanx', cardName: 'NMB Advantage Elevated', maxBalance: 100000, upgradeCost: 50000 },
  { name: '🏦 New Milos Praetorian', cardName: 'NMB Endeavor Credit', maxBalance: 500000, upgradeCost: 250000 },
  { name: '🏦 New Milos Caesar Titanum', cardName: 'NMB Ti Casear', maxBalance: 2000000, upgradeCost: 1000000 },
];
const BANK_CREDIT_LIMIT_PCT = 0.5;
const CAESAR_TI_TITLE_ID = 'caesarTi';

// ---------- Grading District: three competing graders ----------
// What used to be "NMG" alone is now three rival grading authorities sharing one submission
// pipeline (the same 4 slots, the same slot table, the same reveal route). They differ only in
// price, id suffix, cert series, whether they roll SUBGAINS, and how much the market trusts them.
//
//   ccg  Cheap Cool Grading      -- 60% cheaper than NMG. Grade only. Market discounts it 0.5x.
//   nmg  New Milos Grading       -- the incumbent everyman grader. Grade only. The 1.0x baseline.
//   mga  Milos Grading Assoc.    -- triple NMG's price. Rolls SUBGAINS. Black Label lives here only.
//
// Every grader-specific fact lives in this one table so no other code has to branch on a grader
// string, and so a fourth grader would be a data change rather than a code change.
const NMG_MAX_SLOTS = 4;

const GRADERS = {
  ccg: {
    id: 'ccg',
    suffix: '_ccg',
    name: 'Cheap Cool Grading',
    short: 'CCG',
    pitch: 'Cheap. Cool. Graded. No notes.',
    subgains: false,
    blackLabel: false,
    // See the valuation note on GRADER_VALUE_MULT below -- this is an economy decision, not flavor.
    valueMult: 0.5,
    tiers: {
      '3hr': { cost: 2000, ms: 3 * 60 * 60 * 1000 },
      '1hr': { cost: 4000, ms: 60 * 60 * 1000 },
      '10min': { cost: 8000, ms: 10 * 60 * 1000 },
    },
    // CCG regrades deliberately do NOT use the 60%-of-(crack + tier) rule the other two use -- see
    // the long note above NMG_REGRADE_FEES. Flat 2x the tier fee.
    regradeFees: { '3hr': 4000, '1hr': 8000, '10min': 16000 },
  },
  nmg: {
    id: 'nmg',
    suffix: '_nmg',
    name: 'New Milos Grading',
    short: 'NMG',
    pitch: 'The standard. Everybody\'s first slab.',
    subgains: false,
    blackLabel: false,
    valueMult: 1,
    tiers: {
      '3hr': { cost: 5000, ms: 3 * 60 * 60 * 1000 },
      '1hr': { cost: 10000, ms: 60 * 60 * 1000 },
      '10min': { cost: 20000, ms: 10 * 60 * 1000 },
    },
    regradeFees: { '3hr': 33000, '1hr': 36000, '10min': 42000 },
  },
  mga: {
    id: 'mga',
    suffix: '_mga',
    name: 'Milos Grading Association',
    short: 'MGA',
    pitch: 'Triple the price, and they\'ll tell you your stitching is a 9.',
    subgains: true,
    blackLabel: true,
    valueMult: 1,
    tiers: {
      '3hr': { cost: 15000, ms: 3 * 60 * 60 * 1000 },
      '1hr': { cost: 30000, ms: 60 * 60 * 1000 },
      '10min': { cost: 60000, ms: 10 * 60 * 1000 },
    },
    regradeFees: { '3hr': 39000, '1hr': 48000, '10min': 66000 },
  },
};

const GRADER_IDS = Object.keys(GRADERS);
const DEFAULT_GRADER = 'nmg';

function getGrader(graderId) {
  return GRADERS[String(graderId || '').toLowerCase()] || null;
}

// Back-compat alias. Everything that used to say NMG_TIERS meant "the only grader's tiers"; the
// routes now resolve tiers off the chosen grader instead. Kept exported because the client's own
// mirrored constants and the admin surface still reference the NMG ladder by name.
const NMG_TIERS = GRADERS.nmg.tiers;

// Same convention as the client's PRESTIGE_ID_RE (mfmmoalpha/js/core.js:561) -- duplicated here
// since the server shares no code with the client -- so a prestiged stack (e.g. `cfHyperSapphire_p2`)
// unwraps to its base id before the eligibility check above.
const NMG_PRESTIGE_ID_RE = /^(.+)_p(\d+)$/;
function nmgBaseIdOf(stackId) {
  const m = NMG_PRESTIGE_ID_RE.exec(stackId);
  return m ? m[1] : stackId;
}

// A revealed grade is permanently baked into the id itself (see the client's GRADED_ID_RE in
// js/core.js) -- this is how the Portfolio Showcase and Player Market (below) tell a graded slab
// apart from any other opaque, client-trusted title id without needing a title catalog of their own.
//
// THREE grader suffixes now share this shape: `_nmg7`, `_mga7`, `_ccg7`. Disjointness against the
// other synthesized id shapes, verified on both sides of the client/server mirror:
//   * `_p\d+`   (prestige)  -- requires the literal `_p` immediately before the trailing digits.
//                              `x_mga7` ends `a7`, `x_ccg7` ends `g7`: neither matches. And a
//                              graded prestige id (`cfRuby_p2_mga7`) ends with the GRADE digits,
//                              so it never matches the prestige regex either -- which is exactly
//                              why the graded branch must be tried first in getItemDef().
//   * `_foil`   (foil)      -- literal word, no trailing digits. Cannot match a digit-terminated
//                              suffix, and `_foil_mga7`/`_foil_ccg7` compose exactly like
//                              `_foil_nmg7` does: the graded branch strips the grade and hands
//                              `${base}_foil` back to the foil branch.
//   * each other            -- the three suffixes are distinct 4-char literals (`_nmg`/`_mga`/
//                              `_ccg`); the alternation below is anchored so only one can match.
// No base title id in any catalog contains an underscore, so no base id can end in `_nmg`/`_mga`/
// `_ccg` and be mistaken for a suffix.
const NMG_GRADED_ID_RE = /^.+_(?:nmg|mga|ccg)\d{1,2}$/;
// Capturing variant -- Regrade (below) needs the pre-grade id back so it can re-mint the slab with
// a fresh suffix. Deliberately NOT nmgBaseIdOf(): that one also strips a `_p2` prestige level, which
// is right for the "which title is this, really" eligibility check but wrong here, where a regraded
// `cfRuby_p2_nmg7` must come back as `cfRuby_p2_nmg4`, not `cfRuby_nmg4`.
const NMG_GRADED_ID_CAPTURE_RE = /^(.+)_(nmg|mga|ccg)(\d{1,2})$/;
function isGradedTitleId(itemId) {
  return NMG_GRADED_ID_RE.test(String(itemId || ''));
}

// (Disjointness is asserted at module load just below the Foil constants, once FOIL_ID_RE exists.)

// ---------- Foil Ascension ----------
// Burn 3 copies of one plain title + $25,000 -> 1 Foil. A cosmetic sink whose real job is removing
// duplicate supply from the economy.
//
// Id shape `${baseId}_foil`. Verified non-colliding with the two existing synthesized id shapes on
// BOTH sides of the client/server mirror: NMG_PRESTIGE_ID_RE / the client's PRESTIGE_ID_RE both
// require `_p` followed by at least one DIGIT, and NMG_GRADED_ID_RE / the client's NMG_ID_RE both
// require `_nmg` followed by 1-2 digits. A literal `_foil` suffix satisfies neither. Foils are also
// only ever minted from a plain, un-prestiged, ungraded stack (see doFoilAscension), so a foil id
// never nests inside another synthesized shape either.
//
// isCosmeticInventoryId() is a DENY-list (not a gun/melee/ammo/armor/gear/drug id) so `_foil` ids
// already pass the /character/sync cosmetic check with no change needed there.
const FOIL_SUFFIX = '_foil';
const FOIL_ID_RE = /^(.+)_foil$/;
const FOIL_ASCENSION_COPIES = 3;
const FOIL_ASCENSION_COST = 25000;

function isFoilTitleId(itemId) {
  return FOIL_ID_RE.test(String(itemId || ''));
}

// Assert the id-shape disjointness claimed above NMG_GRADED_ID_RE at module load, so a future
// suffix change can never quietly break it. Runs here (not there) only because FOIL_ID_RE is a
// `const` declared in this section -- referencing it earlier would hit the temporal dead zone.
(function assertGradedIdShapesAreDisjoint() {
  const samples = ['cfRuby', 'cfRuby_p2', 'cfRuby_foil', 'cfRuby_p2_foil'];
  GRADER_IDS.forEach((g) => {
    samples.forEach((base) => {
      [1, 7, 10].forEach((grade) => {
        const id = `${base}${GRADERS[g].suffix}${grade}`;
        if (NMG_PRESTIGE_ID_RE.test(id)) throw new Error(`Graded id ${id} collides with the prestige id shape.`);
        if (FOIL_ID_RE.test(id)) throw new Error(`Graded id ${id} collides with the foil id shape.`);
        const parsed = NMG_GRADED_ID_CAPTURE_RE.exec(id);
        if (!parsed || parsed[1] !== base || parsed[2] !== g || Number(parsed[3]) !== grade) {
          throw new Error(`Graded id ${id} does not round-trip through NMG_GRADED_ID_CAPTURE_RE.`);
        }
      });
      if (isGradedTitleId(base)) throw new Error(`${base} must not read as a graded id.`);
    });
  });
})();

function doFoilAscension(character, stackId) {
  const id = String(stackId || '');
  if (!id) return { ok: false, reason: 'Unknown title.' };
  // Same permissive-by-default eligibility reasoning as /nmg/submit: the server has no title
  // catalog, so "not a known non-cosmetic id" is the check available.
  if (!isCosmeticInventoryId(id)) return { ok: false, reason: 'That is not a title.' };
  if (isFoilTitleId(id)) return { ok: false, reason: 'That is already a Foil.' };
  if (isGradedTitleId(id)) return { ok: false, reason: 'Graded slabs cannot be foiled -- crack it first.' };
  if (NMG_PRESTIGE_ID_RE.test(id)) return { ok: false, reason: 'Prestiged titles cannot be foiled.' };
  if (inventoryQty(character, id) < FOIL_ASCENSION_COPIES) {
    return { ok: false, reason: `You need ${FOIL_ASCENSION_COPIES} copies of that title.` };
  }
  if (character.cash < FOIL_ASCENSION_COST) return { ok: false, reason: 'Not enough Floydbucks.' };

  character.cash = round2(character.cash - FOIL_ASCENSION_COST);
  removeFromInventory(character, id, FOIL_ASCENSION_COPIES);
  const foilId = `${id}${FOIL_SUFFIX}`;
  addToInventory(character, foilId, 1);
  return {
    ok: true,
    message: `Foil Ascension complete -- ${FOIL_ASCENSION_COPIES} copies consumed, 1 Foil forged.`,
    cls: 'gain',
    character,
    foilId,
  };
}

// ---------- NMG Regrade ----------
// Resubmit an already-graded slab for a fresh roll. Occupies a real grading slot for the same
// turnaround as a normal submission of that tier; the new grade can be higher, lower, or identical.
//
// Owner's pricing constraint: a regrade must cost LESS than the existing workaround of cracking the
// slab and resubmitting it at the same tier. Crack is a flat $50,000 (mfmmoalpha/js/nmg.js
// NMG_CRACK_COST). Fee = 60% of (crack + tier cost), rounded to the nearest $1,000:
//   3hr    0.60 x (50,000 +  5,000 = 55,000) = 33,000  ->  $33,000  <  $55,000  (60.0%)
//   1hr    0.60 x (50,000 + 10,000 = 60,000) = 36,000  ->  $36,000  <  $60,000  (60.0%)
//   10min  0.60 x (50,000 + 20,000 = 70,000) = 42,000  ->  $42,000  <  $70,000  (60.0%)
// The inequality holds with a 40% margin at all three tiers, and it holds for the RIGHT reason:
// crack+resubmit also hands you a spare equippable copy along the way, so regrade being cheaper is
// paying purely for the reroll. NMG_REGRADE_FEES is asserted against NMG_TIERS at module load below
// so the two can never silently drift apart.
const NMG_REGRADE_CRACK_COST = 50000; // mirrors the client's NMG_CRACK_COST
const NMG_REGRADE_DISCOUNT = 0.6;
const NMG_REGRADE_FEES = GRADERS.nmg.regradeFees;

// The invariant that actually matters is the same for all three graders: REGRADING MUST COST LESS
// THAN CRACK ($50,000) + RESUBMIT AT THE SAME TIER AND GRADER. Asserted below for every grader.
//
// How each grader's number is derived differs, deliberately:
//   NMG  0.60 x (crack + tier)   ->  33,000 / 36,000 / 42,000   (vs 55k / 60k / 70k)
//   MGA  0.60 x (crack + tier)   ->  39,000 / 48,000 / 66,000   (vs 65k / 80k / 110k)
//   CCG  2 x tier                ->   4,000 /  8,000 / 16,000   (vs 52k / 54k / 58k)
//
// CCG breaks the 60%-of-(crack+tier) formula on purpose. Applying it would give 31,200 / 32,400 /
// 34,800 -- between 4x and 15x CCG's own grading fee -- which is absurd for the grader whose entire
// identity is "affordable slabs to flex", and would make the intended play (just grade another one)
// strictly better than regrading at every tier. The formula was only ever a way to satisfy the
// crack-parity invariant; at CCG's price point a flat 2x the tier undercuts crack+resubmit by
// 92-97% and still costs meaningfully more than grading a fresh copy, which is the right shape.
Object.entries(GRADERS).forEach(([graderId, grader]) => {
  Object.keys(grader.tiers).forEach((tier) => {
    const fee = grader.regradeFees[tier];
    const ceiling = NMG_REGRADE_CRACK_COST + grader.tiers[tier].cost;
    if (!(fee > 0 && fee < ceiling)) {
      throw new Error(`${graderId} regrade fee for "${tier}" ($${fee}) must be below crack+tier ($${ceiling}).`);
    }
  });
});

function nmgRegradeFee(tier, graderId = DEFAULT_GRADER) {
  const grader = getGrader(graderId);
  if (!grader) return null;
  return grader.regradeFees[tier] ?? null;
}

// Splits `${preGradeId}${graderSuffix}${grade}` back into its parts, or null if the id isn't a slab.
// `grader` is one of GRADER_IDS. Callers written before the three-grader split only read
// preGradeId/grade and keep working unchanged.
function parseGradedId(itemId) {
  const m = NMG_GRADED_ID_CAPTURE_RE.exec(String(itemId || ''));
  if (!m) return null;
  const grade = Number(m[3]);
  if (!(grade >= 1 && grade <= 10)) return null;
  return { preGradeId: m[1], grader: m[2], grade };
}

// ---------- SUBGAINS (MGA only) ----------
// MGA doesn't just hand you a number, it itemizes: four component scores -- Gloss, Stitching, Aura,
// Drip -- rolled at reveal alongside the main grade. Each is clamped to (main grade +/- 2, floor 1,
// ceiling 10) and weighted hard toward the main grade, so the subgains read as a breakdown OF the
// grade rather than four independent rolls that happen to sit next to it.
//
// Weight by distance from the main grade: 11 / 6 / 3 for d = 0 / 1 / 2.
// For a main grade of 10 the allowed set is {8,9,10} (d = 2,1,0), total weight 20, so
//   P(sub = 10) = 11/20 = 0.55  and  P(all four = 10) = 0.55^4 = 0.0915.
// That is BLACK LABEL: ~9.2% of MGA 10s, i.e. ~0.18% of all MGA submissions once NMG_GRADE_WEIGHTS'
// 2% chance of a 10 is folded in (~1 in 545). Rare enough to be the real chase, common enough that
// a dedicated player will actually see one.
const SUBGAIN_KEYS = ['gloss', 'stitch', 'aura', 'drip'];
const SUBGAIN_LABELS = { gloss: 'Gloss', stitch: 'Stitching', aura: 'Aura', drip: 'Drip' };
const SUBGAIN_SPREAD = 2;
const SUBGAIN_DISTANCE_WEIGHTS = [11, 6, 3]; // index = |sub - main|

function rollSubgain(mainGrade) {
  const candidates = [];
  let total = 0;
  for (let v = Math.max(1, mainGrade - SUBGAIN_SPREAD); v <= Math.min(10, mainGrade + SUBGAIN_SPREAD); v += 1) {
    const w = SUBGAIN_DISTANCE_WEIGHTS[Math.abs(v - mainGrade)];
    candidates.push({ v, w });
    total += w;
  }
  let r = Math.random() * total;
  for (const c of candidates) {
    if (r < c.w) return c.v;
    r -= c.w;
  }
  return mainGrade;
}

// Returns { gloss, stitch, aura, drip, blackLabel } for a grader that rolls subgains, or null for
// one that doesn't (CCG/NMG certs carry NULL subgain columns by definition, not just legacy ones).
function rollSubgains(graderId, mainGrade) {
  const grader = getGrader(graderId);
  if (!grader || !grader.subgains) return null;
  const subs = {};
  SUBGAIN_KEYS.forEach((k) => { subs[k] = rollSubgain(mainGrade); });
  subs.blackLabel = !!grader.blackLabel && mainGrade === 10 && SUBGAIN_KEYS.every((k) => subs[k] === 10);
  return subs;
}

// The old graded id ceases to exist the moment a regrade is submitted, so anything that pins a slab
// BY ID has to be cleaned up -- exactly what the client's crackNmgTitle() already does for the
// Portfolio Showcase. Player Market needs no handling for the same reason it doesn't there: a
// listed slab is already out of character.inventory (doCreateListing), so it fails the ownership
// check above and can never reach this point.
function detachGradedIdFromShowcases(character, gradedId) {
  if (character.profile && Array.isArray(character.profile.slabShowcaseIds)) {
    character.profile.slabShowcaseIds = character.profile.slabShowcaseIds.filter((id) => id !== gradedId);
  }
  if (character.profile && Array.isArray(character.profile.showcaseTitleIds)) {
    character.profile.showcaseTitleIds = character.profile.showcaseTitleIds.filter((id) => id !== gradedId);
  }
  if (character.profile && character.profile.bannerTitleId === gradedId) {
    character.profile.bannerTitleId = null;
  }
}

// 10 stays genuinely rare; "Worn" (7-4) is the bulk of outcomes; "Sub" (3-1) is a real but small
// tail. Sums to 100.
const NMG_GRADE_WEIGHTS = { 10: 2, 9: 8, 8: 15, 7: 20, 6: 20, 5: 15, 4: 10, 3: 6, 2: 3, 1: 1 };

function rollNmgGrade() {
  const total = Object.values(NMG_GRADE_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [grade, weight] of Object.entries(NMG_GRADE_WEIGHTS)) {
    if (r < weight) return Number(grade);
    r -= weight;
  }
  return 1;
}

// ---------- CosmetixxMarket ----------
// Mirrors mfmmoalpha/js/core.js's rarity-bearing catalogs (id/weight/rarity only, tagged with the
// parent crate's cost) -- EXCLUDING the two archived collections (Open Beta, GOOD Season 1) and the
// two RED/BLUE hidden Auto pulls (no independent weight, not directly drawable, so no fair way to
// price them). Needed only for this feature's random generation + pricing -- the server otherwise
// deliberately has no title catalog of its own (see isCosmeticInventoryId below). See the
// title-making skill (mfmmoalpha/.claude/skills/title-making/SKILL.md) for the checklist entry to
// keep this in sync whenever a new crate ships.
const COSMETIXX_MARKET_TITLES = [
  // ANIMA_CRATE_TITLES, crateCost 4500 -- ARCHIVED (no longer purchasable anywhere else)
  { id: 'animaCommonGoku', weight: 31.67, rarity: 'common', crateCost: 4500, archived: true },
  { id: 'animaCommonZoro', weight: 31.67, rarity: 'common', crateCost: 4500, archived: true },
  { id: 'animaCommonHatsune', weight: 31.66, rarity: 'common', crateCost: 4500, archived: true },
  { id: 'animaRareYujiro', weight: 1.5, rarity: 'uncommon', crateCost: 4500, archived: true },
  { id: 'animaRareCreator', weight: 1.5, rarity: 'uncommon', crateCost: 4500, archived: true },
  { id: 'animaRareJinwoo', weight: 1.5, rarity: 'uncommon', crateCost: 4500, archived: true },
  { id: 'animaMegaKirito', weight: 0.075, rarity: 'rare', crateCost: 4500, archived: true },
  { id: 'animaMegaItachi', weight: 0.075, rarity: 'rare', crateCost: 4500, archived: true },
  { id: 'animaMegaGodGoku', weight: 0.075, rarity: 'rare', crateCost: 4500, archived: true },
  { id: 'animaMegaLuffy', weight: 0.075, rarity: 'rare', crateCost: 4500, archived: true },
  { id: 'animaHyperGear5', weight: 0.05, rarity: 'mythic', crateCost: 4500, archived: true },
  { id: 'animaHyperMakima', weight: 0.05, rarity: 'mythic', crateCost: 4500, archived: true },
  // COUNTERFINISH_CRATE_TITLES, crateCost 3000 -- ARCHIVED
  { id: 'cfSafari', weight: 15, rarity: 'common', crateCost: 3000, archived: true },
  { id: 'cfTiger', weight: 15, rarity: 'common', crateCost: 3000, archived: true },
  { id: 'cfTronic', weight: 15, rarity: 'common', crateCost: 3000, archived: true },
  { id: 'cfFree', weight: 15, rarity: 'common', crateCost: 3000, archived: true },
  { id: 'cfLore', weight: 15, rarity: 'uncommon', crateCost: 3000, archived: true },
  { id: 'cfHowl', weight: 15, rarity: 'uncommon', crateCost: 3000, archived: true },
  { id: 'cfFade', weight: 15, rarity: 'uncommon', crateCost: 3000, archived: true },
  { id: 'cfSapphire', weight: 1.5, rarity: 'rare', crateCost: 3000, archived: true },
  { id: 'cfRuby', weight: 1.5, rarity: 'rare', crateCost: 3000, archived: true },
  { id: 'cfEmerald', weight: 1.5, rarity: 'rare', crateCost: 3000, archived: true },
  { id: 'cfHyperSapphire', weight: 0.17, rarity: 'mythic', crateCost: 3000, archived: true },
  { id: 'cfHyperRuby', weight: 0.17, rarity: 'mythic', crateCost: 3000, archived: true },
  { id: 'cfHyperEmerald', weight: 0.16, rarity: 'mythic', crateCost: 3000, archived: true },
  // RED_CRATE_TITLES, crateCost 20000 -- ARCHIVED (1,000-supply limited drop, long exhausted)
  { id: 'redTrumpFistUp', weight: 5, rarity: 'mythic', crateCost: 20000, archived: true },
  { id: 'redTrump', weight: 6.67, rarity: 'rare', crateCost: 20000, archived: true },
  { id: 'redBush', weight: 6.67, rarity: 'rare', crateCost: 20000, archived: true },
  { id: 'redRegan', weight: 6.66, rarity: 'rare', crateCost: 20000, archived: true },
  { id: 'redNixon', weight: 10, rarity: 'uncommon', crateCost: 20000, archived: true },
  { id: 'redMcconel', weight: 10, rarity: 'uncommon', crateCost: 20000, archived: true },
  { id: 'redDesantis', weight: 10, rarity: 'uncommon', crateCost: 20000, archived: true },
  { id: 'redMtg', weight: 15, rarity: 'common', crateCost: 20000, archived: true },
  { id: 'redLoomer', weight: 15, rarity: 'common', crateCost: 20000, archived: true },
  { id: 'redCruz', weight: 15, rarity: 'common', crateCost: 20000, archived: true },
  // BLUE_CRATE_TITLES, crateCost 20000 -- ARCHIVED (1,000-supply limited drop, long exhausted)
  { id: 'blueDarkBrandon', weight: 5, rarity: 'mythic', crateCost: 20000, archived: true },
  { id: 'blueBiden', weight: 6.67, rarity: 'rare', crateCost: 20000, archived: true },
  { id: 'blueObama', weight: 6.67, rarity: 'rare', crateCost: 20000, archived: true },
  { id: 'blueJfk', weight: 6.66, rarity: 'rare', crateCost: 20000, archived: true },
  { id: 'blueHarris', weight: 10, rarity: 'uncommon', crateCost: 20000, archived: true },
  { id: 'blueCarter', weight: 10, rarity: 'uncommon', crateCost: 20000, archived: true },
  { id: 'blueClinton', weight: 10, rarity: 'uncommon', crateCost: 20000, archived: true },
  { id: 'blueNewsome', weight: 15, rarity: 'common', crateCost: 20000, archived: true },
  { id: 'blueBernie', weight: 15, rarity: 'common', crateCost: 20000, archived: true },
  { id: 'blueAoc', weight: 15, rarity: 'common', crateCost: 20000, archived: true },
  // LEEMS_LARUDO_GOOD_TITLES, crateCost 20000
  { id: 'llgSkyCommon', weight: 19.475, rarity: 'common', crateCost: 20000 },
  { id: 'llgSkyRegistered', weight: 19.475, rarity: 'common', crateCost: 20000 },
  { id: 'llgGRegistered', weight: 19.475, rarity: 'common', crateCost: 20000 },
  { id: 'llgHappy', weight: 19.475, rarity: 'common', crateCost: 20000 },
  { id: 'llgRegisteredSkyAlt', weight: 8, rarity: 'uncommon', crateCost: 20000 },
  { id: 'llgHappyAlt', weight: 8, rarity: 'uncommon', crateCost: 20000 },
  { id: 'llgRegisteredAlt', weight: 3, rarity: 'rare', crateCost: 20000 },
  { id: 'llgTypeface', weight: 3, rarity: 'rare', crateCost: 20000 },
  { id: 'llgImpossible', weight: 0.05, rarity: 'mythic', crateCost: 20000 },
  { id: 'llgSpecialFont', weight: 0.05, rarity: 'mythic', crateCost: 20000 },
  // MILOS_LEGENDS_TITLES, crateCost 20000
  { id: 'mlConnie', weight: 15, rarity: 'common', crateCost: 20000 },
  { id: 'mlEliteUnit', weight: 15, rarity: 'common', crateCost: 20000 },
  { id: 'mlMrSerious', weight: 15, rarity: 'common', crateCost: 20000 },
  { id: 'mlOtaku', weight: 15, rarity: 'common', crateCost: 20000 },
  { id: 'mlPileit', weight: 15, rarity: 'common', crateCost: 20000 },
  { id: 'mlKhylil', weight: 8.3, rarity: 'uncommon', crateCost: 20000 },
  { id: 'mlHawken', weight: 8.3, rarity: 'uncommon', crateCost: 20000 },
  { id: 'mlSuperjailWarden', weight: 8.3, rarity: 'uncommon', crateCost: 20000 },
  { id: 'mlSpecialUnit', weight: 0.05, rarity: 'mythic', crateCost: 20000 },
  { id: 'mlKrogger', weight: 0.05, rarity: 'mythic', crateCost: 20000 },
  // ANIMA2_CRATE_TITLES, crateCost 20000
  { id: 'a2Naruto', weight: 10.5, rarity: 'common', crateCost: 20000 },
  { id: 'a2Ichigo', weight: 10.5, rarity: 'common', crateCost: 20000 },
  { id: 'a2Tanjiro', weight: 10.5, rarity: 'common', crateCost: 20000 },
  { id: 'a2Deku', weight: 10.5, rarity: 'common', crateCost: 20000 },
  { id: 'a2Fullmetal', weight: 10.5, rarity: 'common', crateCost: 20000 },
  { id: 'a2Chainsaw', weight: 10.5, rarity: 'common', crateCost: 20000 },
  { id: 'a2Killua', weight: 10.5, rarity: 'common', crateCost: 20000 },
  { id: 'a2Levi', weight: 4.5, rarity: 'uncommon', crateCost: 20000 },
  { id: 'a2Prince', weight: 4.5, rarity: 'uncommon', crateCost: 20000 },
  { id: 'a2Rumbling', weight: 4.5, rarity: 'uncommon', crateCost: 20000 },
  { id: 'a2CopyNinja', weight: 4.5, rarity: 'uncommon', crateCost: 20000 },
  { id: 'a2FlameHashira', weight: 4.5, rarity: 'uncommon', crateCost: 20000 },
  { id: 'a2OnePunch', weight: 1.3, rarity: 'rare', crateCost: 20000 },
  { id: 'a2Madara', weight: 1.3, rarity: 'rare', crateCost: 20000 },
  { id: 'a2DemonKing', weight: 1.3, rarity: 'rare', crateCost: 20000 },
  { id: 'a2KingOfCurses', weight: 0.05, rarity: 'mythic', crateCost: 20000 },
  { id: 'a2SixEyes', weight: 0.05, rarity: 'mythic', crateCost: 20000 },
  // RED_BLUE_HIDDEN_TITLES (mfmmoalpha/js/core.js) -- the secret autographed alternates. A spin that
  // lands on a side's Presidential Rare (weight 5) has a 1% chance to swap in the Auto instead (see
  // hiddenAuto on CRATE_RED/CRATE_BLUE in market.js), so their true pull rate is 5 * 0.01 = 0.05 --
  // as rare as a Milos Legends mythic, out of crates that are both archived AND supply-exhausted.
  // They are listed here ONLY so graded Autos can be valued (KOLLECTOR, and the client's
  // "Est. value" caption); rotationExcluded keeps them out of the purchasable daily rotation, since
  // being buyable would undo the whole point of a hidden pull that is "deliberately not reflected
  // anywhere in titles/odds".
  { id: 'redTrumpAuto', weight: 0.05, rarity: 'mythic', crateCost: 20000, archived: true, rotationExcluded: true },
  { id: 'blueBidenAuto', weight: 0.05, rarity: 'mythic', crateCost: 20000, archived: true, rotationExcluded: true },
  // WAIFU_CRATE_TITLES (mfmmoalpha/js/core.js), crateCost 50000
  { id: 'wfMakima', weight: 7.5, rarity: 'common', crateCost: 50000 },
  { id: 'wfNezuko', weight: 7.5, rarity: 'common', crateCost: 50000 },
  { id: 'wfMikasa', weight: 7.5, rarity: 'common', crateCost: 50000 },
  { id: 'wfMiku', weight: 7.5, rarity: 'common', crateCost: 50000 },
  { id: 'wfErza', weight: 7.5, rarity: 'common', crateCost: 50000 },
  { id: 'wfAsuna', weight: 7.5, rarity: 'common', crateCost: 50000 },
  { id: 'wfFrieren', weight: 7.5, rarity: 'common', crateCost: 50000 },
  { id: 'wfHinata', weight: 7.5, rarity: 'common', crateCost: 50000 },
  { id: 'wfZeroTwo', weight: 4.65, rarity: 'uncommon', crateCost: 50000 },
  { id: 'wfRem', weight: 4.65, rarity: 'uncommon', crateCost: 50000 },
  { id: 'wfMarin', weight: 4.65, rarity: 'uncommon', crateCost: 50000 },
  { id: 'wfYor', weight: 4.65, rarity: 'uncommon', crateCost: 50000 },
  { id: 'wfShinobu', weight: 4.65, rarity: 'uncommon', crateCost: 50000 },
  { id: 'wfRobin', weight: 4.65, rarity: 'uncommon', crateCost: 50000 },
  { id: 'wfBoaHancock', weight: 3, rarity: 'rare', crateCost: 50000 },
  { id: 'wfMai', weight: 3, rarity: 'rare', crateCost: 50000 },
  { id: 'wfKurisu', weight: 3, rarity: 'rare', crateCost: 50000 },
  { id: 'wfTsunade', weight: 3, rarity: 'rare', crateCost: 50000 },
  { id: 'wfPower', weight: 0.05, rarity: 'mythic', crateCost: 50000 },
  { id: 'wfRukia', weight: 0.05, rarity: 'mythic', crateCost: 50000 },
  // SHALOM_CRATE_TITLES (mfmmoalpha/js/core.js), crateCost 3333
  { id: 'shNetanyahu', weight: 0.5, rarity: 'mythic', crateCost: 3333 },
  { id: 'shGalGadot', weight: 2.5, rarity: 'rare', crateCost: 3333 },
  { id: 'shGoldaMeir', weight: 4, rarity: 'rare', crateCost: 3333 },
  { id: 'shIronDome', weight: 5, rarity: 'rare', crateCost: 3333 },
  { id: 'shMossad', weight: 5, rarity: 'rare', crateCost: 3333 },
  { id: 'shStartupNation', weight: 7, rarity: 'uncommon', crateCost: 3333 },
  { id: 'shKravMaga', weight: 7, rarity: 'uncommon', crateCost: 3333 },
  { id: 'shEurovision', weight: 7, rarity: 'uncommon', crateCost: 3333 },
  { id: 'shDeadSea', weight: 8, rarity: 'uncommon', crateCost: 3333 },
  { id: 'shIsraelFlag', weight: 16, rarity: 'common', crateCost: 3333 },
  { id: 'shHummus', weight: 16, rarity: 'common', crateCost: 3333 },
  { id: 'shBamba', weight: 11, rarity: 'common', crateCost: 3333 },
  { id: 'shShekel', weight: 11, rarity: 'common', crateCost: 3333 },
];

// The subset the daily rotation may actually stock. Valuation code reads COSMETIXX_MARKET_TITLES
// directly (everything priceable), the store reads this.
const COSMETIXX_MARKET_ROTATION_POOL = COSMETIXX_MARKET_TITLES.filter((t) => !t.rotationExcluded);

const COSMETIXX_MARKET_SLOT_COUNT = 5;
const COSMETIXX_MARKET_ROTATION_MS = 24 * 60 * 60 * 1000;

// A "common" title's typical weight -- the 1x pricing reference point.
const COSMETIXX_MARKET_BASELINE_WEIGHT = 15;
// Ascending by grade NUMBER, not the grade's own pull weight -- NMG_GRADE_WEIGHTS makes grade 1
// almost as statistically rare as grade 10 (1% vs 2%), but grade 1 (Sub) is the worst outcome
// narratively, so pricing it above grade 10 (Elite) would read as backwards.
const COSMETIXX_MARKET_GRADE_MULT = {
  1: 0.4, 2: 0.45, 3: 0.5, // Sub
  4: 0.7, 5: 0.85, 6: 1, 7: 1.2, // Worn
  8: 1.7, // Good
  9: 2.4, // Mint
  10: 3.5, // Elite
};
const COSMETIXX_MARKET_MIN_PRICE = 500;
const COSMETIXX_MARKET_MAX_PRICE = 1500000; // safety clamp for active-collection titles
// Archived titles (Anima, Counterfinish, RED, BLUE -- see the `archived: true` flag above) can
// never be pulled from a crate again, only through this store. Without a real premium, "buy a cheap
// slab here + Crack a Title ($50,000, see doCrackTitle) to get back an equippable copy" would be a
// backdoor around a crate being archived -- effectively unarchiving it. 10x makes that backdoor
// expensive on top of the crack cost instead of a cheap shortcut, and the ceiling is raised to match
// since we WANT high-end archived slabs pricier than the normal cap.
const COSMETIXX_MARKET_ARCHIVED_MULT = 10;
const COSMETIXX_MARKET_ARCHIVED_MAX_PRICE = 3000000;

// sqrt(baseline/weight) scales price by a title's REAL pull rarity rather than its rarity label --
// cross-crate labels are inconsistent (RED/BLUE's "mythic" Presidential Rare is a 5% pull; Anima/
// LLG/Milos Legends "mythic" is 0.05%, 100x rarer) -- dampened by the square root so a 0.05%-weight
// title doesn't blow up to an absurd raw-inverse-probability price.
function cosmetixxSlabPrice(title, grade) {
  const rarityFactor = Math.sqrt(COSMETIXX_MARKET_BASELINE_WEIGHT / title.weight);
  const archivedMult = title.archived ? COSMETIXX_MARKET_ARCHIVED_MULT : 1;
  const raw = title.crateCost * rarityFactor * COSMETIXX_MARKET_GRADE_MULT[grade] * archivedMult;
  const rounded = Math.round(raw / 100) * 100;
  const max = title.archived ? COSMETIXX_MARKET_ARCHIVED_MAX_PRICE : COSMETIXX_MARKET_MAX_PRICE;
  return Math.min(max, Math.max(COSMETIXX_MARKET_MIN_PRICE, rounded));
}

// ---------- KOLLECTOR leaderboard (Graded Collection value) ----------
// Ranks players by the total CosmetixxMarket-equivalent value of every graded slab (`_nmgN`
// inventory stack) they own. Reuses cosmetixxSlabPrice() -- the established pricing authority --
// for plain slabs. Graded Foils get their own derivation below, since a foil isn't sold in
// CosmetixxMarket at all: its real cost basis comes from the Foil Ascension recipe itself (burn 3
// copies of the base title + $25,000 -> 1 Foil, see doFoilAscension/FOIL_ASCENSION_COST above), so
// a foil slab is valued as "3 pre-grade base slabs + the ascension fee, at the grade's multiplier."
//
// Titles outside COSMETIXX_MARKET_TITLES (Open Beta, GOOD Season 1 -- excluded from that catalog by
// design, see the comment above it) have no market price to draw on, so slabs of those titles value
// at 0 here too, for the same reason the market itself excludes them. Unknown/garbage inventory ids
// (never crash on a corrupt/foreign stack id) also value at 0.
function foilSlabValue(titleEntry, grade) {
  const rarityFactor = Math.sqrt(COSMETIXX_MARKET_BASELINE_WEIGHT / titleEntry.weight);
  const archivedMult = titleEntry.archived ? COSMETIXX_MARKET_ARCHIVED_MULT : 1;
  // Pre-grade value of one plain slab of this title -- same formula as cosmetixxSlabPrice() minus
  // the grade multiplier, since a foil doesn't carry a grade of its own until it's separately NMG'd.
  const basePreGrade = titleEntry.crateCost * rarityFactor * archivedMult;
  const raw = (3 * basePreGrade + FOIL_ASCENSION_COST) * COSMETIXX_MARKET_GRADE_MULT[grade];
  const rounded = Math.round(raw / 100) * 100;
  // Clamp mirrors cosmetixxSlabPrice()'s own clamp, scaled for the recipe: 3x the applicable normal/
  // archived slab cap (one per consumed copy) plus the flat ascension fee.
  const baseMax = titleEntry.archived ? COSMETIXX_MARKET_ARCHIVED_MAX_PRICE : COSMETIXX_MARKET_MAX_PRICE;
  const max = 3 * baseMax + 75000;
  return Math.min(max, Math.max(COSMETIXX_MARKET_MIN_PRICE, rounded));
}

// Resolves a graded stack's pre-grade id (foil or plain, possibly prestiged) back to its
// COSMETIXX_MARKET_TITLES catalog entry, or null if it's not a priced title (Open Beta / GOOD
// Season 1 / garbage id).
function findGradedCollectionEntry(preGradeId) {
  const foilMatch = FOIL_ID_RE.exec(preGradeId);
  const baseId = foilMatch ? nmgBaseIdOf(foilMatch[1]) : nmgBaseIdOf(preGradeId);
  const titleEntry = COSMETIXX_MARKET_TITLES.find((t) => t.id === baseId);
  return { titleEntry, isFoil: !!foilMatch };
}

// ---------- Registry Sets (PSA Set Registry parody) ----------
// Complete a graded slab (any grader, any grade) of EVERY title in a crate and you've "completed
// the set" -- same collector's-registry idea as the real PSA product. Grouped off
// COSMETIXX_MARKET_TITLES, the same catalog buildPopReport/CosmetixxMarket/KOLLECTOR already treat
// as the authority for "what titles exist and what crate they came from" -- every id in that
// catalog carries its crate's short prefix (anima/cf/red/blue/llg/ml/a2/wf, see the comment blocks
// above the catalog itself), so grouping by prefix reproduces the real crate boundaries with no
// second source of truth to drift out of sync. Open Beta / GOOD Season 1 have no entries in that
// catalog at all (excluded by design, see the note above it), so they get no registry set either --
// consistent with every other surface (Pop Report, CosmetixxMarket, KOLLECTOR) that already treats
// catalog membership as the on/off switch. RED/BLUE's hidden Autos are `rotationExcluded` and are
// deliberately left OUT of those two sets' required title lists below -- they're an unlisted ~0.05%
// secret pull from an archived, supply-exhausted crate, and requiring one would make RED/BLUE
// registry completion realistically impossible instead of just hard.
const REGISTRY_CRATE_DEFS = [
  { key: 'anima', name: 'ANIMA CRATE', prefix: 'anima' },
  { key: 'counterfinish', name: 'COUNTERFINISH CRATE', prefix: 'cf' },
  { key: 'red', name: 'RED CRATE', prefix: 'red' },
  { key: 'blue', name: 'BLUE CRATE', prefix: 'blue' },
  { key: 'llg', name: 'LEEMS LARUDO x GOOD®', prefix: 'llg' },
  { key: 'milosLegends', name: 'MILOS LEGENDS 1', prefix: 'ml' },
  { key: 'anima2', name: 'ANIMA 2 CRATE', prefix: 'a2' },
  { key: 'waifu', name: 'WAIFU CRATE', prefix: 'wf' },
];

// Computed once at module load -- COSMETIXX_MARKET_TITLES is a static literal, never mutated at
// runtime, so there is nothing to keep this in sync with beyond re-running this map, which happens
// automatically on every process start (i.e. every deploy that touches the catalog).
const REGISTRY_SETS = REGISTRY_CRATE_DEFS
  .map((def) => ({
    key: def.key,
    name: def.name,
    titleIds: COSMETIXX_MARKET_TITLES
      .filter((t) => !t.rotationExcluded && t.id.startsWith(def.prefix))
      .map((t) => t.id),
  }))
  .filter((c) => c.titleIds.length > 0);

// Achievement-title pattern (see maybeGrantAchievementTitle above): server only needs the id string,
// matching a client-side hardcoded def. No rarity/cost on any of the three -- same as PEAK CIVILIAN
// et al -- so they are unsellable and unprestigeable by construction, and PERMANENT once earned: a
// later crack that drops a player below completion does not strip the title back off. Real
// registries don't unring the bell either -- once a set graded PSA 10 across the board, that
// player's name stays on the all-time list even if they later crack a card out of the holder.
const REGISTRY_REWARD_TITLES = {
  registryCollector: { id: 'registryCollector', name: 'REGISTRY COLLECTOR' },
  masterSet: { id: 'masterSet', name: 'MASTER SET' },
  perfectSet: { id: 'perfectSet', name: 'PERFECT SET' },
};
const REGISTRY_MASTER_SET_GPA = 8;
const REGISTRY_PERFECT_SET_GPA = 10;

// A user's best-graded holding per base (catalog) title id, from inventory + escrowed MTN listings.
// `listedQty` is a Map of itemId -> qty, the caller's per-user slice of the MTN listings table -- a
// listed slab is still escrow, not a sale, so it counts (same convention reconcileCerts() uses for
// the exact same reason: doCreateListing() escrows the stack out of character.inventory, and not
// counting it here would make listing a slab for sale silently break your own set). Foil and
// prestiged slabs resolve to their base title via findGradedCollectionEntry(), which already strips
// both -- reused rather than re-implemented.
function computeBestGradedHoldings(character, listedQty) {
  const held = new Map();
  (character.inventory || []).forEach((stack) => {
    if (stack.qty > 0 && isGradedTitleId(stack.id)) held.set(stack.id, (held.get(stack.id) || 0) + stack.qty);
  });
  if (listedQty) {
    listedQty.forEach((qty, id) => {
      if (isGradedTitleId(id)) held.set(id, (held.get(id) || 0) + qty);
    });
  }

  const best = new Map(); // catalog titleId -> { grade, grader }
  held.forEach((qty, gradedId) => {
    const parsed = parseGradedId(gradedId);
    if (!parsed) return;
    const { titleEntry } = findGradedCollectionEntry(parsed.preGradeId);
    if (!titleEntry) return;
    const cur = best.get(titleEntry.id);
    // Best COPY counts, like a real registry -- keep the higher grade on a tie-break-free compare
    // (equal grades just keep whichever was seen first, which is fine: they're interchangeable).
    if (!cur || parsed.grade > cur.grade) best.set(titleEntry.id, { grade: parsed.grade, grader: parsed.grader });
  });
  return best;
}

// Progress (and, if complete, GPA/grader-mix) for one crate set against one user's best holdings.
// GPA is the mean of the best grade held per title -- "best copy counts" is the whole point of
// tracking best-by-title above instead of just checking "owns at least one".
function computeSetProgress(set, bestHoldings) {
  const have = [];
  const missing = [];
  set.titleIds.forEach((id) => {
    const h = bestHoldings.get(id);
    if (h) have.push({ id, grade: h.grade, grader: h.grader });
    else missing.push(id);
  });
  const complete = missing.length === 0;
  let gpa = null;
  let graderMix = null;
  if (complete) {
    gpa = round2(have.reduce((sum, h) => sum + h.grade, 0) / have.length);
    graderMix = {};
    have.forEach((h) => { graderMix[h.grader] = (graderMix[h.grader] || 0) + 1; });
  }
  return {
    key: set.key, name: set.name, total: set.titleIds.length, haveCount: have.length,
    missing, complete, gpa, graderMix,
  };
}

// ---------- Crack a Slab ----------
// Cracking used to be entirely client-side (js/nmg.js crackNmgTitle) on the reasoning that it has
// no timing or pricing property worth protecting. The cert registry changes that: a crack RETIRES a
// cert, and a retirement the server never hears about is a permanent, silent Pop Report lie. So
// crack now has a real route, and the client calls it instead of mutating locally.
// Cost and outcome are otherwise identical to the old client-side version.
const NMG_CRACK_COST = NMG_REGRADE_CRACK_COST;

function doCrackSlab(character, stackId) {
  const id = String(stackId || '');
  const parsed = parseGradedId(id);
  if (!parsed) return { ok: false, reason: 'That is not a graded slab.' };
  if (inventoryQty(character, id) < 1) return { ok: false, reason: "You don't own that slab." };
  if (character.cash < NMG_CRACK_COST) return { ok: false, reason: 'Not enough Floydbucks.' };

  character.cash = round2(character.cash - NMG_CRACK_COST);
  removeFromInventory(character, id, 1);
  addToInventory(character, parsed.preGradeId, 1);
  // Same cleanup regrade does -- the graded id ceases to exist, so nothing may keep pinning it.
  detachGradedIdFromShowcases(character, id);
  return {
    ok: true,
    message: 'Slab cracked. The title is equippable again.',
    cls: 'loss',
    character,
    crackedId: id,
    preGradeId: parsed.preGradeId,
    grader: parsed.grader,
  };
}

// ---------- First Edition ----------
// A cert is stamped FIRST EDITION at mint if the slab's source crate was NOT archived at that
// moment. Checked at mint time, never re-derived, so when a crate archives later its already-issued
// FE certs keep the stamp and everything graded afterwards simply doesn't get one -- no code runs at
// archive time at all, the `archived` flags in COSMETIXX_MARKET_TITLES are the only switch.
//
// DOCUMENTED EDGE CASE: Open Beta and GOOD(R) Season 1 titles are deliberately absent from
// COSMETIXX_MARKET_TITLES (they have no market price -- see the note above that catalog), so a
// lookup for them returns nothing. "Not in the catalog" is treated as ARCHIVED for FE purposes,
// i.e. no First Edition stamp. That is the conservative reading (FE is a scarcity flex; handing it
// out for titles the catalog can't even price would cheapen it) and it matches those two crates'
// real status -- both are long since unpurchasable.
function isFirstEditionEligible(preGradeId) {
  const { titleEntry } = findGradedCollectionEntry(preGradeId);
  if (!titleEntry) return false;
  return !titleEntry.archived;
}

// ---------- Grader trust multiplier ----------
// Applied to the CosmetixxMarket-equivalent value of a slab, in gradedCollectionValue() (KOLLECTOR)
// and mirrored in the client's estimatedSlabValue() ("Est. value" caption). Three deliberate calls:
//
//   NMG 1.0x  -- the baseline the whole pricing model was built against. Unchanged.
//   MGA 1.0x  -- NO premium, even though MGA costs 3x to grade at and rolls subgains. Grading fees
//                were never an input to slab value for NMG either (the formula prices the TITLE and
//                the GRADE, not what you paid the grader), and a Black Label premium should emerge
//                from what players will actually pay each other on MTN, not be minted by the
//                algorithm. Baking it in would also make MGA the mandatory KOLLECTOR play.
//   CCG 0.5x  -- a real discount, and the one place a grader changes value. At parity, CCG's 60%
//                discount would make it strictly dominant for KOLLECTOR value-farming: identical
//                score for 40% of the cash, which kills NMG grading outright. In-universe the
//                market simply doesn't take a CCG slab seriously -- they are affordable slabs to
//                flex, and the leaderboard prices them that way.
//
// Note this is NOT pop-scaled: value stays supply-blind by explicit owner decision (pop-scaled
// value creates hoarding feedback loops and crack-your-rival manipulation). The multiplier is a
// fixed per-grader constant, known in advance, not a function of the cert registry.
function graderValueMult(graderId) {
  const grader = getGrader(graderId);
  return grader ? grader.valueMult : 1;
}

function gradedCollectionValue(character) {
  let total = 0;
  (character.inventory || []).forEach((stack) => {
    if (!(stack.qty > 0)) return;
    const parsed = parseGradedId(stack.id);
    if (!parsed) return; // not a graded slab at all
    const { titleEntry, isFoil } = findGradedCollectionEntry(parsed.preGradeId);
    if (!titleEntry) return; // Open Beta / GOOD Season 1 / unknown id -- no market price
    const raw = isFoil ? foilSlabValue(titleEntry, parsed.grade) : cosmetixxSlabPrice(titleEntry, parsed.grade);
    const unitValue = Math.round(raw * graderValueMult(parsed.grader));
    total += unitValue * stack.qty;
  });
  return round2(total);
}

// Sampling without replacement -- the pool (60+ titles) is large relative to 5 picks, so a simple
// retry-on-duplicate loop converges immediately in practice rather than needing a real shuffle.
function pickDistinctCosmetixxTitles(count) {
  const picked = [];
  const usedIds = new Set();
  let guard = 0;
  while (picked.length < count && guard < count * 50) {
    guard += 1;
    const total = COSMETIXX_MARKET_ROTATION_POOL.reduce((sum, t) => sum + t.weight, 0);
    let r = Math.random() * total;
    let chosen = COSMETIXX_MARKET_ROTATION_POOL[0];
    for (const t of COSMETIXX_MARKET_ROTATION_POOL) {
      if (r < t.weight) { chosen = t; break; }
      r -= t.weight;
    }
    if (usedIds.has(chosen.id)) continue;
    usedIds.add(chosen.id);
    picked.push(chosen);
  }
  return picked;
}

// The rotation stocks all three graders rather than NMG alone. The store used to mint NMG and only
// NMG on the reasoning that the SYSTEM buys grading and the system uses the everyman grader -- but
// that made every shelf identical in case art, and hid two thirds of the grading feature from
// anyone who buys their slabs instead of grading them. Weighted so NMG still leads and an MGA slab
// on the shelf stays an event; tune here, nothing else reads these numbers.
const COSMETIXX_MARKET_GRADER_WEIGHTS = { ccg: 30, nmg: 45, mga: 25 };

function rollCosmetixxMarketGrader() {
  const entries = Object.entries(COSMETIXX_MARKET_GRADER_WEIGHTS);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [graderId, weight] of entries) {
    if (r < weight) return graderId;
    r -= weight;
  }
  return DEFAULT_GRADER;
}

function generateCosmetixxMarketSlots() {
  return pickDistinctCosmetixxTitles(COSMETIXX_MARKET_SLOT_COUNT).map((title, slotIndex) => {
    const graderId = rollCosmetixxMarketGrader();
    const grade = rollNmgGrade();
    // SUBGAINS are rolled HERE, at rotation, not at purchase -- unlike the cert, which is minted at
    // purchase because an unsold slab never existed. The subgains are part of what the shelf is
    // advertising: a buyer must be able to see the four numbers (and a BLACK LABEL case) before
    // paying, the same way they see the grade. The purchase then mints the cert with exactly these
    // values, so the slab you get is the slab you looked at.
    const subs = rollSubgains(graderId, grade);
    // Same mult, applied the same way, as the KOLLECTOR valuation in gradedCollectionValue() --
    // outside cosmetixxSlabPrice() rather than inside it, so there is one convention and no risk of
    // double-applying. A CCG slab therefore costs half, which is exactly what a CCG slab is worth.
    const price = Math.max(
      COSMETIXX_MARKET_MIN_PRICE,
      Math.round(cosmetixxSlabPrice(title, grade) * graderValueMult(graderId) / 100) * 100,
    );
    return { slotIndex, titleId: title.id, grader: graderId, grade, subgains: subs, price };
  });
}

const PISTOL_ITEMS_BY_ID = {
  glock19: { id: 'glock19', name: '🔫 Glock 19', type: 'pistol', caliber: '9mm', cost: 500, atkBonus: 6 },
  m9: { id: 'm9', name: '🔫 Beretta M9', type: 'pistol', caliber: '9mm', cost: 650, atkBonus: 7 },
};
const RIFLE_ITEMS_BY_ID = {
  ar15: { id: 'ar15', name: '🎯 AR-15', type: 'rifle', caliber: '5.56', cost: 2500, atkBonus: 12 },
  m4: { id: 'm4', name: '🎯 M4 Carbine', type: 'rifle', caliber: '5.56', cost: 3200, atkBonus: 14 },
};
const GUN_ITEMS_BY_ID = { ...PISTOL_ITEMS_BY_ID, ...RIFLE_ITEMS_BY_ID };
const MELEE_ITEMS_BY_ID = {
  knuckles: { id: 'knuckles', name: '👊 Brass Knuckles', type: 'melee', cost: 75, atkBonus: 2 },
  knife: { id: 'knife', name: '🔪 Switchblade Knife', type: 'melee', cost: 200, atkBonus: 4 },
};
const AMMO_ITEMS_BY_ID = {
  ammo9mm: { id: 'ammo9mm', name: '📦 9mm Ammo Box', type: 'ammo', caliber: '9mm', cost: 50 },
  ammo556: { id: 'ammo556', name: '📦 5.56 Ammo Box', type: 'ammo', caliber: '5.56', cost: 80 },
};
// Priced well above the priciest rifle so it reads as a serious one-time investment, not a normal
// gear buy -- consumed after the wearer's next PvP duel (win or lose), see applyDuelOutcome().
const ARMOR_ITEMS_BY_ID = {
  bodyArmor: { id: 'bodyArmor', name: '🦺 Body Armor', type: 'gear', slot: 'armor', cost: 8000, statBonuses: { defense: 15 } },
};
const CONCEALED_APPLY_COST = 2000;
const CONCEALED_WAIT_MS = 10 * 60 * 1000;

const JAIL_WORKOUT_COOLDOWN_MS = 6000;
const JAIL_WORKOUT_ATK_GAIN_MIN = 0.1;
const JAIL_WORKOUT_ATK_GAIN_MAX = 0.25;
const JAIL_WORKOUT_DEF_GAIN_MIN = 0.05;
const JAIL_WORKOUT_DEF_GAIN_MAX = 0.15;
const JAIL_FIGHT_COOLDOWN_MS = 8000;
const JAIL_FIGHT_ATK_GAIN_MIN = 0.1;
const JAIL_FIGHT_ATK_GAIN_MAX = 0.3;
const JAIL_FIGHT_DEF_GAIN_MIN = 0.05;
const JAIL_FIGHT_DEF_GAIN_MAX = 0.15;
const JAIL_FIGHT_LOSS_MIN = 5;
const JAIL_FIGHT_LOSS_MAX = 20;
// Was 1.75x -- with no jail-exclusive benefit that made contraband strictly worse than just
// waiting to buy the same item after release. Lowered to a believable "risk premium," and melee
// contraband now grants real immediate value (see doJailFight) instead of just sitting inert.
const JAIL_CONTRABAND_MARKUP = 1.2;

const RENAME_COST = 10000;
const RANGE_COOLDOWN_MS = 3000;

const GOOD_HUSTLE_MAX_ALLIANCE = 59; // Good Hustles allowed for Neutral or better, blocked for Bad
const JOB_SKILL_TRAIN_MIN = 0.02;
const JOB_SKILL_TRAIN_MAX = 0.06;
const LOOKS_TRAIN_BONUS_MAX = 1.2;
// Everyone starts at 10 Looks, so a raw sqrt(looks/100) curve already hands new characters most of
// the bonus before they've invested a cent. Normalize so the *starting* stat yields exactly 0% and
// 100 Looks still yields the same +120% cap -- same diminishing-returns shape, just re-based so the
// bonus reflects actual investment instead of a freebie built into the starting stats.
const LOOKS_TRAIN_BASE = 10;
const LOOKS_TRAIN_K = LOOKS_TRAIN_BONUS_MAX / (1 - Math.sqrt(LOOKS_TRAIN_BASE / 100));
// Late-game payoff for staying Good: once you've both maxed out the Good job ladder AND kept your
// alliance actually Good (not just Neutral), Good Hustle pay gets a real multiplier -- previously
// there was no long-term reason to stay Good over just avoiding Bad.
const GOOD_CEO_MULTIPLIER = 1.6;
const GOOD_CEO_MIN_AVG = 95; // Regional Manager rank

// Pay ranges are 16x their prior values now (was already 32% above original -- 10% from the first
// Drugs & Rugs balance pass, 20% from Update 4's second Good Hustle buff -- then multiplied 16x
// again so a starting Trainee averages ~$5-8/click instead of ~$0.40). Must match JOB_RANKS
// in mfmmoalpha/js/core.js exactly.
const JOB_RANKS = [
  { minAvg: 0, title: 'Trainee', payMin: 2.112, payMax: 10.56, cooldownMs: 2000 },
  { minAvg: 15, title: 'Associate', payMin: 4.224, payMax: 15.936, cooldownMs: 1800 },
  { minAvg: 35, title: 'Senior Associate', payMin: 8.448, payMax: 23.232, cooldownMs: 1600 },
  { minAvg: 55, title: 'Supervisor', payMin: 14.784, payMax: 38.016, cooldownMs: 1400 },
  { minAvg: 75, title: 'Manager', payMin: 24.384, payMax: 58.176, cooldownMs: 1200 },
  { minAvg: 95, title: 'Regional Manager', payMin: 38.016, payMax: 84.48, cooldownMs: 1000 },
];
const BAD_JOB_RANKS = [
  { minAvg: 0, title: 'Rookie', payMin: 5, payMax: 25, cooldownMs: 2000 },
  { minAvg: 15, title: 'Associate', payMin: 10, payMax: 37.5, cooldownMs: 1800 },
  { minAvg: 35, title: 'Enforcer', payMin: 20, payMax: 55, cooldownMs: 1600 },
  { minAvg: 55, title: 'Lieutenant', payMin: 35, payMax: 90, cooldownMs: 1400 },
  { minAvg: 75, title: 'Underboss', payMin: 57.5, payMax: 137.5, cooldownMs: 1200 },
  { minAvg: 95, title: 'Boss', payMin: 90, payMax: 200, cooldownMs: 1000 },
];

const GOOD_JOBS_BY_ID = {
  milos11: { id: 'milos11', name: '🏪 Milos11' },
  pizza: { id: 'pizza', name: "🍕 Pete'sza Delivery" },
  wrestler: { id: 'wrestler', name: '🤼 Krogue Wrestler Gear' },
};
const BAD_JOBS_BY_ID = {
  getaway: { id: 'getaway', name: '🏎️ Getaway Driver' },
  fence: { id: 'fence', name: '🕴️ The Fence' },
};

const BAD_JOB_BUST_BASE = 0.08;
const BAD_JOB_BUST_MIN = 0.02;
const BAD_JOB_JAIL_YEARS = 1;

const WRESTLING_GEAR_ITEMS_BY_ID = {
  wrestHeadgear: { id: 'wrestHeadgear', name: '🪖 Wrestling Headgear', type: 'gear', slot: 'helmet', cost: 2000, statBonuses: { defense: 3, health: 5 } },
  wrestBelt: { id: 'wrestBelt', name: '🏆 Championship Belt', type: 'gear', slot: 'chest', cost: 3000, statBonuses: { defense: 6 } },
  wrestSinglet: { id: 'wrestSinglet', name: '🥋 Singlet Padding', type: 'gear', slot: 'pants', cost: 2500, statBonuses: { attack: 4 } },
  wrestBoots: { id: 'wrestBoots', name: '🥾 Grappling Boots', type: 'gear', slot: 'feet', cost: 2200, statBonuses: { speed: 5 } },
};

const FOOD_ITEMS_BY_ID = {
  pizza: { id: 'pizza', name: '🍕 Pizza Slice', cost: 1, calories: 285 },
  calzone: { id: 'calzone', name: '🥟 Calzone', cost: 3, calories: 650 },
  pizzamax: { id: 'pizzamax', name: '🍕 Pizzamax (Whole Pie)', cost: 10, calories: 2000 },
  dinuguan: { id: 'dinuguan', name: '🍲 Dinuguan', cost: 15, calories: 900 },
  halohalo: { id: 'halohalo', name: '🍧 Halo Halo', cost: 20, calories: 1000 },
  primerib: { id: 'primerib', name: '🥩 Prime Rib', cost: 30, calories: 1200 },
};

// Rebalanced (was too easy to exploit -- spamming small qty=1 sales kept per-transaction risk/jail
// time flat forever, since jailYearsPerUnit*qty never accounted for how much you'd already sold).
// wholesaleCost +25%, sellMin/sellMax -10% -- both squeeze margin from opposite ends instead of
// just one big number, and jail time now also escalates with lifetime units sold (see
// drugJailEscalationMultiplier below), so grinding small sales no longer stays low-risk forever.
const DRUG_ITEMS_BY_ID = {
  drugWeed: { id: 'drugWeed', name: '🌿 Weed', type: 'drug', wholesaleCost: 25, sellMin: 27, sellMax: 45, jailYearsPerUnit: 0.2, riskBase: 0.05, riskPerUnit: 0.02 },
  drugPills: { id: 'drugPills', name: '💊 Pills', type: 'drug', wholesaleCost: 75, sellMin: 81, sellMax: 126, jailYearsPerUnit: 0.5, riskBase: 0.12, riskPerUnit: 0.03 },
  drugMeth: { id: 'drugMeth', name: '🧪 Meth', type: 'drug', wholesaleCost: 125, sellMin: 144, sellMax: 234, jailYearsPerUnit: 1.5, riskBase: 0.25, riskPerUnit: 0.05 },
  drugCoke: { id: 'drugCoke', name: '❄️ Cocaine', type: 'drug', wholesaleCost: 190, sellMin: 198, sellMax: 288, jailYearsPerUnit: 1, riskBase: 0.2, riskPerUnit: 0.04 },
};

// Unlock thresholds are 10x their original values (Drugs & Rugs: makes clearing a dealer -- and
// unlocking Milos Outlook Farms, see FARM_UNLOCK_UNITS_SOLD -- a much bigger grind).
const DEALER_TIERS_BY_ID = {
  guzman: { id: 'guzman', name: '🕴️ Guzman Nestor', drugId: 'drugWeed', unlockUnits: 0 },
  esteban: { id: 'esteban', name: '🕴️ Esteban Vico', drugId: 'drugPills', unlockUnits: 400 },
  ramon: { id: 'ramon', name: '🕴️ Ramon Castillo', drugId: 'drugMeth', unlockUnits: 1000 },
  dmitri: { id: 'dmitri', name: '🕴️ Dmitri Kovash', drugId: 'drugCoke', unlockUnits: 2000 },
};
const DEALER_QUICK_MIN = 3;
const DEALER_QUICK_MAX = 12;
const DEALER_QUICK_COOLDOWN_MS = 15000;
const DEALER_QUICK_SUCCESS_CHANCE = 0.85;

const ROBBERY_COOLDOWN_MS = 10000;
const ROBBERY_MIN = 20;
const ROBBERY_MAX = 150;
const ROBBERY_JAIL_YEARS = 1;

const NPC_TYPES = {
  citizen: { name: '🧍 Citizen', hp: 20, attack: 5, defense: 2, minReward: 30, maxReward: 90 },
  cop: { name: '👮 Cop', hp: 50, attack: 14, defense: 9, minReward: 90, maxReward: 220 },
  thug: { name: '🥷 Thug', hp: 30, attack: 8, defense: 4, minReward: 65, maxReward: 160 },
  gangster: { name: '🕴️ Gangster', hp: 45, attack: 12, defense: 7, minReward: 130, maxReward: 300 },
  goon: { name: '🥊 Goon', hp: 32, attack: 9, defense: 5, minReward: 70, maxReward: 170 },
  gangbanger: { name: '🔫 Gangbanger', hp: 48, attack: 13, defense: 7, minReward: 140, maxReward: 320 },
  vagabond: { name: '🎒 Vagabond', hp: 18, attack: 4, defense: 2, minReward: 25, maxReward: 80 },
  miscreant: { name: '🃏 Miscreant', hp: 35, attack: 9, defense: 5, minReward: 60, maxReward: 150 },
  // Ultra-rare (1/1000) boss fight, rollable regardless of alliance -- effectively unbeatable, a
  // jackpot easter egg rather than a normal fight.
  milos: { name: '👹 Milos', hp: 100000, attack: 50, defense: 40, minReward: 100000, maxReward: 500000 },
};
const NPC_CITIZEN = NPC_TYPES.citizen;
const MILOS_BOSS_CHANCE = 0.001;

const COMBAT_GOOD_MAX_ALLIANCE = 39; // Combat: Good alignment (not Neutral) fights Gangsters/Thugs
const COMBAT_COOLDOWN_MS = 5000;
const HEAVY_STRIKE_MULT = 1.6;
const HEAVY_STRIKE_MISS_CHANCE = 0.25;
const WEAPON_ATTACK_MULT = 1.5;
const WEAPON_ATTACK_JAM_CHANCE = 0.10;
const GUARD_DAMAGE_REDUCTION = 0.7;
const GUARD_RIPOSTE_CHANCE = 0.2;
const COMBAT_STAT_GAIN_CHANCE = 0.4;
const COMBAT_STAT_GAIN_MIN = 0.1;
const COMBAT_STAT_GAIN_MAX = 0.3;

// Face is only 10% of Looks (see computeFaceLooksScore/computeBodyLooksScore) but costs scale up
// ~1.5x from the old all-looks pricing so that small slice stays just as hard to max as Body.
const MAXX_ITEMS_BY_ID = {
  mewing: { id: 'mewing', name: '💋 Mewing Course', cost: 750, looks: 1, desc: '+1 Face Looks' },
  bonesmash: { id: 'bonesmash', name: '🔨 Bone Smashing Kit', cost: 2400, looks: 1, desc: '+1 Face Looks' },
  hairline: { id: 'hairline', name: '💇 Hair Transplant', cost: 4800, looks: 2, desc: '+2 Face Looks' },
  jaw: { id: 'jaw', name: '💉 Jawline Filler', cost: 7800, looks: 2, desc: '+2 Face Looks' },
  canthal: { id: 'canthal', name: '👁️ Canthal Tilt Surgery', cost: 15000, looks: 4, desc: '+4 Face Looks' },
  limblength: { id: 'limblength', name: '🦴 Limb Lengthening Surgery', cost: 12000, height: 1, speed: 1, desc: '+1" Height, +1 Speed' },
};
const MAXX_COMPLETE_MULTIPLIER = 1.25; // ongoing passive Good Hustle pay bonus once all 6 items are owned
function isMaxxComplete(character) {
  return Object.keys(MAXX_ITEMS_BY_ID).every((id) => (character.maxxPurchased || []).includes(id));
}

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const SURVIVOR_SLOT_SYMBOLS = [
  { symbol: '\u{1F352}', weight: 35, match: 2 }, // cherries
  { symbol: '\u{1F34B}', weight: 25, match: 3 }, // lemon
  { symbol: '\u{1F514}', weight: 20, match: 5 }, // bell
  { symbol: '⭐', weight: 12, match: 10 }, // star
  { symbol: '7️⃣', weight: 6, match: 20 }, // seven
  { symbol: '\u{1F48E}', weight: 2, match: 50 }, // diamond
];

const ZEUS_SLOT_SYMBOLS = [
  { symbol: '☁️', weight: 30, match: 5 },
  { symbol: '🌧️', weight: 24, match: 8 },
  { symbol: '⚡', weight: 18, match: 20 },
  { symbol: '🌩️', weight: 12, match: 50 },
  { symbol: '🔱', weight: 6, match: 150 },
  { symbol: '👑', weight: 2, match: 750 },
];

const ELITE_SLOT_SYMBOLS = [
  { symbol: '💵', weight: 30, match: 10 },
  { symbol: '💎', weight: 22, match: 30 },
  { symbol: '🏆', weight: 16, match: 100 },
  { symbol: '🎰', weight: 10, match: 300 },
  { symbol: '🔥', weight: 5, match: 1000 },
  { symbol: '👑', weight: 1, match: 10000 },
];

const SLOT_MACHINES = {
  survivor: { label: 'Lone Slotvivor', minBet: 10, reelCount: 3, symbols: SURVIVOR_SLOT_SYMBOLS },
  zeus: { label: 'Zeus: King of Storms', minBet: 100, reelCount: 4, symbols: ZEUS_SLOT_SYMBOLS },
  elite: { label: 'ELITE Slots', minBet: 10000, reelCount: 6, symbols: ELITE_SLOT_SYMBOLS },
};

const DEALER_TIER_IDS = ['guzman', 'esteban', 'ramon', 'dmitri'];
const CRIME_TIER_IDS = ['shoplift', 'pettytheft', 'burglary', 'grandtheft'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// Rounds to 2 decimals *before* clamping -- without this, repeated round2()-ed increments summed
// onto a stat over time drift into float noise (e.g. 11.555553333333), which then flows straight
// into combat HP math/display with no further cleanup. Rounding at the source fixes every
// downstream reader in one place instead of patching each display site individually.
function clampStat(v) {
  return Math.max(0, Math.min(STAT_CAP, Math.round(v * 100) / 100));
}

// Same rounding/floor as clampStat but no upper bound -- Looks (and the body-exercise counters
// that feed it) are meant to grind past 100 as a flex/vanity number. Every gameplay BENEFIT
// derived from Looks still reads it through Math.min(..., STAT_CAP) at the point of use, so the
// uncapped number never buys more than the effective 100 worth of bonus.
function clampStatUncapped(v) {
  return Math.max(0, Math.round(v * 100) / 100);
}

// Body score: a single uncapped accumulator built up by Workouts and eating (see doWorkout/
// doBuyFood), scaled to fill its 90% share of Looks.
function computeBodyLooksScore(character) {
  if (!character.gym) character.gym = {};
  return (character.gym.bodyScore || 0) * BODY_LOOKS_WEIGHT;
}

// Face score: sum of purchased Maxx items' looks values -- MAXX_ITEMS_BY_ID is calibrated so a full
// set sums to exactly STAT_CAP * FACE_LOOKS_WEIGHT (10).
function computeFaceLooksScore(character) {
  const purchased = character.maxxPurchased || [];
  return Object.values(MAXX_ITEMS_BY_ID).reduce((sum, item) => (
    purchased.includes(item.id) && item.looks ? sum + item.looks : sum
  ), 0);
}

function recomputeLooks(character) {
  character.stats.looks = clampStatUncapped(computeBodyLooksScore(character) + computeFaceLooksScore(character));
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// FC amounts need finer precision than cash (dollar-rounded via round2) -- Floydcoin prices sit in
// the 0.10-0.15 range and hourly mining accrual is a fraction of a per-day rate, so round2 would
// silently floor small gains to 0.00 forever (they'd never cross the 1-cent threshold to
// accumulate). Used for every read/write of character.crypto.fc.
function round4(v) {
  return Math.round(v * 10000) / 10000;
}

// Mirrors the client's jobPerkActive('milos11', false) exactly -- Pete'sza's employee discount.
function hasMilos11Discount(character) {
  const s = character.jobs.skills;
  const avg = (s.skill1 + s.skill2 + s.skill3 + s.skill4) / 4;
  return character.jobs.currentJob === 'milos11' && avg >= JOB_PERK_MIN_AVG;
}

// Mirrors the client's jobPerkActive('fence', true) exactly -- the Fence's Gun Club discount.
function hasFenceDiscount(character) {
  const s = character.badJobs.skills;
  const avg = (s.skill1 + s.skill2 + s.skill3 + s.skill4) / 4;
  return character.badJobs.currentJob === 'fence' && avg >= JOB_PERK_MIN_AVG;
}

// Mirrors the client's gunPriceFactor() exactly -- guns/ammo go to $0 during Riotlandia.
function gunPriceFactor(character, activeModifier) {
  if (activeModifier === 'riot') return 0;
  return hasFenceDiscount(character) ? 0.85 : 1;
}

function rankFor(ranks, avg) {
  let current = ranks[0];
  for (const rank of ranks) {
    if (avg >= rank.minAvg) current = rank;
  }
  return current;
}

function nextRankFor(ranks, avg) {
  return ranks.find((rank) => rank.minAvg > avg) || null;
}

function goodJobSkillAvg(character) {
  const s = character.jobs.skills;
  return (s.skill1 + s.skill2 + s.skill3 + s.skill4) / 4;
}

function goodJobRank(character) {
  return rankFor(JOB_RANKS, goodJobSkillAvg(character));
}

function goodJobPerkActive(character, jobId) {
  return character.jobs.currentJob === jobId && goodJobSkillAvg(character) >= JOB_PERK_MIN_AVG;
}

// sqrt curve so early Looks gains matter, not just Looks near the cap -- re-based against
// LOOKS_TRAIN_BASE (see constant comment) so the starting stat itself grants no bonus.
function looksTrainMult(character) {
  const looks = Math.min(character.stats.looks, STAT_CAP);
  return 1 + Math.max(0, Math.sqrt(looks / 100) - Math.sqrt(LOOKS_TRAIN_BASE / 100)) * LOOKS_TRAIN_K;
}

function goodJobSkillTrainMult(character) {
  return looksTrainMult(character);
}

function badJobSkillAvg(character) {
  const s = character.badJobs.skills;
  return (s.skill1 + s.skill2 + s.skill3 + s.skill4) / 4;
}

function badJobRank(character) {
  return rankFor(BAD_JOB_RANKS, badJobSkillAvg(character));
}

function badJobPerkActive(character, jobId) {
  return character.badJobs.currentJob === jobId && badJobSkillAvg(character) >= JOB_PERK_MIN_AVG;
}

function badJobSkillTrainMult(character) {
  return looksTrainMult(character);
}

function badJobBustChance(character) {
  const avg = badJobSkillAvg(character);
  const base = Math.max(BAD_JOB_BUST_MIN, BAD_JOB_BUST_BASE - (avg / 100) * (BAD_JOB_BUST_BASE - BAD_JOB_BUST_MIN));
  const evasion = (character.stats.speed / 100) * 0.02 + (character.stats.defense / 100) * 0.01;
  const perkReduction = badJobPerkActive(character, 'getaway') ? 0.03 : 0;
  return Math.max(BAD_JOB_BUST_MIN, base - evasion - perkReduction);
}

const SKILL_KEYS = ['skill1', 'skill2', 'skill3', 'skill4'];

function newCharacter(firstName, lastName) {
  return {
    firstName,
    lastName,
    stats: { health: 10, attack: 10, speed: 10, defense: 10, looks: 10 },
    height: 65,
    fatGained: 0,
    muscleGained: 0,
    cash: 0,
    chips: 0,
    alliance: 50,
    cooldowns: {
      work: 0, slut: 0, crime: 0, combat: 0, rangeShoot: 0, rangeDraw: 0, rangeReload: 0, robbery: 0,
      jobWork: 0, jobSkill1: 0, jobSkill2: 0, jobSkill3: 0, jobSkill4: 0,
      badJobWork: 0, badJobSkill1: 0, badJobSkill2: 0, badJobSkill3: 0, badJobSkill4: 0,
      communityService: 0, jailWorkout: 0, jailFight: 0,
      ...Object.fromEntries(DEALER_TIER_IDS.map((id) => [`dealer_${id}`, 0])),
      ...Object.fromEntries(CRIME_TIER_IDS.map((id) => [`crime_${id}`, 0])),
    },
    gym: {
      steroidTier: null,
      roidJailClicksRemaining: 0,
      bodyScore: 0,
    },
    jail: { inJail: false, crime: null, yearsRemaining: 0, serving: false, contrabandAtkBonus: 0 },
    settings: { hideMilosWarning: false },
    titles: { owned: [], equipped: null, customTitles: [] },
    achievements: { foodEaten: 0, slutCount: 0 },
    marriage: { proposedTo: null, spouseName: null, spouseUserId: null },
    licenses: { gunSafety: false, concealedPermit: false, concealedPendingUntil: 0 },
    inventory: [],
    equipment: { helmet: null, chest: null, pants: null, feet: null, holsterL: null, holsterR: null, openCarry: null, melee: null, armor: null },
    weaponSkills: { shooting: 0, draw: 0, magReload: 0 },
    bank: { tier: 0, balance: 0, hasCreditCard: false, creditBalance: 0, lastBillTs: Date.now() },
    arrestRecord: [],
    jobs: { currentJob: null, skills: { skill1: 0, skill2: 0, skill3: 0, skill4: 0 }, pizzaPerkGranted: false },
    badJobs: { currentJob: null, skills: { skill1: 0, skill2: 0, skill3: 0, skill4: 0 } },
    drugDealer: { unitsSold: 0 },
    farms: { plots: [], securityTier: 0 },
    crypto: { machineTier: 0, ramTier: 0, cpuTier: 0, gpuTier: 0, prestigeLevel: 0, fc: 0, lastCollectedAt: Date.now() },
    crimeRecord: { streak: 0 },
    slime: { active: false, until: 0, byName: null },
    slimeRecord: [],
    variety: 0,
    varietyTimeout: { until: 0 },
    enjoyed: { active: false, until: 0, byName: null },
    secumax: { tier: null, lastBillTs: Date.now(), robBlocksUsed: 0, enjoyBlocksUsed: 0, slimeBlocksUsed: 0 },
    badges: { equipped: null },
    visions: { equipped: null },
    moralsCenter: { choice: null, lastTickTs: Date.now() },
    mtnHistory: [],
    maxxPurchased: [],
    blackjack: { phase: 'betting', playerCards: [], dealerCards: [], bet: 0 },
    combat: { active: false, enemyKey: null, enemyHp: 0, enemyMaxHp: 0, playerHp: 0, playerMaxHp: 0, turn: null, guarding: false },
    profile: { bannerTitleId: null, showcaseTitleIds: [], status: '', wall: [] },
  };
}

// Everything ownable that lives in character.inventory as a stack falls into one of these known
// non-cosmetic catalogs (guns, melee, ammo, armor, wrestling gear, drugs). Titles are the only
// other kind of inventory stack in the game and are purely client-known/trust-based (their catalog
// is large and cosmetic-only, never validated server-side) -- so "not a known non-cosmetic id" is
// the reliable way to identify a title/cosmetic stack without needing the client's title catalog.
function isCosmeticInventoryId(id) {
  return !GUN_ITEMS_BY_ID[id] && !MELEE_ITEMS_BY_ID[id] && !AMMO_ITEMS_BY_ID[id]
    && !ARMOR_ITEMS_BY_ID[id] && !WRESTLING_GEAR_ITEMS_BY_ID[id] && !DRUG_ITEMS_BY_ID[id];
}

// Admin "reset all stats" action: wipes a character back to newCharacter() defaults (stats, cash,
// chips, jobs, bank, equipment, jail, farms, crypto, everything) but keeps titles (owned/equipped/
// customTitles) and any cosmetic inventory stacks (crate-won titles), since those are meant to
// survive a stats wipe.
function resetCharacterKeepCosmetics(character) {
  const fresh = newCharacter(character.firstName, character.lastName);
  fresh.titles = character.titles;
  fresh.badges = character.badges || { equipped: null };
  fresh.visions = character.visions || { equipped: null };
  fresh.inventory = (character.inventory || []).filter((stack) => isCosmeticInventoryId(stack.id));
  return fresh;
}

// Season wipe (Update 4 launch): goes further than resetCharacterKeepCosmetics -- titles.owned is
// dropped entirely too, not just carried over. Per the user's explicit rule, "Cosmetic Titles are
// any bought from the Crates" -- those are inventory stacks (same isCosmeticInventoryId filter
// already handles them, NMG-graded titles included), never entries in titles.owned. Everything
// that DOES live in titles.owned (achievement titles like LOOKSMAXXER/HIGHEST_LEVEL/PEAK CIVILIAN,
// and any cash-bought Cosmetixxx title) is "earned" or "purchased," not "cosmetic" by that
// definition, so it does not survive. `equipped` is left as-is rather than nulled out -- the
// client's getDisplayTitle() already checks isTitleOwned(equippedId) before rendering a badge, so
// a stale id pointing at a wiped achievement title just renders no badge, no crash.
// Cash is not zeroed: it converts down at a fixed 100,000:1,000 ratio (i.e. /100, rounded).
function resetCharacterSeasonWipe(character) {
  const fresh = newCharacter(character.firstName, character.lastName);
  fresh.titles = {
    owned: [],
    equipped: character.titles.equipped,
    customTitles: character.titles.customTitles || [],
  };
  fresh.badges = character.badges || { equipped: null };
  fresh.visions = character.visions || { equipped: null };
  fresh.inventory = (character.inventory || []).filter((stack) => isCosmeticInventoryId(stack.id));
  fresh.cash = Math.round((character.cash || 0) / 100);
  return fresh;
}

// Accounts created before blackjack moved server-side (or before split/double support) won't have
// the `hands` array yet -- migrate the old single-hand shape into hands[0] on first touch.
function ensureBlackjackState(character) {
  if (!character.blackjack) {
    character.blackjack = { phase: 'betting', dealerCards: [], hands: [], activeHand: 0 };
  } else if (!character.blackjack.hands) {
    const bj = character.blackjack;
    character.blackjack = {
      phase: bj.phase || 'betting',
      dealerCards: bj.dealerCards || [],
      hands: bj.bet > 0 || (bj.playerCards || []).length
        ? [{ cards: bj.playerCards || [], bet: bj.bet || 0, done: false }]
        : [],
      activeHand: 0,
    };
  }
  return character.blackjack;
}

// Accounts created before Combat moved server-side won't have this field yet.
function ensureCombatState(character) {
  if (!character.combat) {
    character.combat = { active: false, enemyKey: null, enemyHp: 0, enemyMaxHp: 0, playerHp: 0, playerMaxHp: 0, turn: null, guarding: false };
  }
  return character.combat;
}

function ensureAchievementsState(character) {
  if (!character.achievements) character.achievements = { foodEaten: 0, slutCount: 0 };
  return character.achievements;
}

// Migrates the old single weightGained field into the fat/muscle split -- existing fuel carries
// over as fat (that's what it always represented: unburned calories from eating), muscle starts at 0.
function ensureWeightState(character) {
  if (character.fatGained === undefined) {
    character.fatGained = character.weightGained || 0;
    character.muscleGained = 0;
    delete character.weightGained;
  }
}

function getRemainingCooldown(character, key, durationMs = COOLDOWN_MS) {
  const last = character.cooldowns[key] || 0;
  const remaining = durationMs - (Date.now() - last);
  return remaining > 0 ? remaining : 0;
}

// Flavor-text pools for the three Da Skreetz hustles -- one random line per success, replacing
// the old bland "${job}: +$X" message. Slut lines also take a {player} placeholder, filled with a
// random other real account's name (getRandomOtherUserCharacterName in db.js) so it reads like
// something actually happened to someone in the city, not just a number going up.
const WORK_FLAVOR_LINES = [
  'Worker bee ass, you just earned like ${amount}!',
  'Brahhh at the 9-5 again. WORKER BEE made ${amount}!',
  'Bro is allergic to real bread. Take this measly ${amount}.',
  'Haha, clock out jimbo, take your ${amount}.',
];
const SLUT_FLAVOR_LINES = [
  'You just gagged on {player}, and they paid you ${amount}.',
  'INSANE VARIETY, you rode {player} for ${amount}.',
  'BRAHHH, please stop gobblin on {player} and take ${amount}.',
  'MEAT RIDER! You saddled up {player} for ${amount}.',
];
const CRIME_FLAVOR_LINES = [
  'YOU HITTA LICK ON EM FOR ${amount}!!!',
  'FINESSER!!! Walked off the plug w/ ${amount}!!!',
  'You hit an Amazon DNA for ${amount}...DAT SHIT NEVER CAME.',
  'Walked em down like 10 toe!!! Ran off da opp for ${amount}.',
];

// Achievement titles: earned automatically, not purchased -- server only needs the id string
// (matching the client's hardcoded title catalog in core.js), same as any other titles.owned
// entry (e.g. PEAK_TITLE's client-side auto-grant).
const FAT_FUCK_THRESHOLD = 10000;
const LOOSE_TITLE_THRESHOLD = 500;

function maybeGrantAchievementTitle(character, titleId, thresholdMet) {
  if (!thresholdMet || character.titles.owned.includes(titleId)) return null;
  character.titles.owned.push(titleId);
  return { message: '🏅 Achievement unlocked -- new title added to your Inventory!', cls: 'gain' };
}

function pickFlavorLine(pool, amount, playerName) {
  const line = pool[randInt(0, pool.length - 1)];
  return line.replace('${amount}', `$${amount}`).replace('{player}', playerName || '');
}

// ---------- Arrest asset seizure ----------
// Every path that sets jail.inJail = true also runs this: the NMPD confiscates a flat percentage
// of CASH ON HAND. Banked money is deliberately untouched -- this is the whole point of the change,
// it gives the Bank a real job (a safe) instead of being a pure flavor sink. Centralized here
// rather than inlined at each of the ~8 jail-entry sites so the rate can never drift between them.
// Returns the amount seized so each bust message can append arrestSeizureNote().
const ARREST_SEIZURE_PCT = 0.15;

function applyArrestSeizure(character) {
  const cash = Math.max(0, character.cash || 0);
  const seized = round2(cash * ARREST_SEIZURE_PCT);
  if (seized <= 0) return 0;
  character.cash = round2(character.cash - seized);
  return seized;
}

function arrestSeizureNote(seized) {
  if (!seized || seized <= 0) return '';
  return ` NMPD seized $${seized.toFixed(2)} in asset forfeiture.`;
}

// Mirrors the client's doHustle('work') branch exactly, but takes character as a parameter
// (no shared global) and enforces the cooldown server-side instead of trusting the caller.
// ---------- Batch actions ----------
// "xN" batch variants for the click-heaviest earners. The rule for every one of them: N INDEPENDENT
// rolls (never one roll times N), N applications of whatever per-click side effects the single
// version has, and a cooldown of N x the single cooldown. That keeps $/hr byte-for-byte identical
// to spamming the single button -- this is purely click reduction, never a rate change.
//
// The cooldown is stamped into the FUTURE (now + (N-1)*duration) rather than adding a separate
// "multiplier" field, because getRemainingCooldown() -- and its hand-mirrored client twin -- is
// `duration - (now - last)`. A last-used stamp N-1 durations ahead therefore reads back as exactly
// N x duration remaining, with zero changes needed on either side of the mirror.
const BATCH_HUSTLE_MAX = 5; // Da Skreetz Work / Slut / Crime
const BATCH_JOB_MAX = 10; // Good/Bad job skill shifts

function clampBatchCount(count, max) {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(max, n);
}

function stampBatchCooldown(character, key, count, durationMs) {
  character.cooldowns[key] = Date.now() + (count - 1) * durationMs;
}

// Mirrors the client's doHustle('work') branch exactly, but takes character as a parameter
// (no shared global) and enforces the cooldown server-side instead of trusting the caller.
function doWork(character, count) {
  if (character.jail && character.jail.inJail) return { ok: false, reason: 'You are in jail.' };
  const remaining = getRemainingCooldown(character, 'work', COOLDOWN_MS);
  if (remaining > 0) {
    return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  }

  const n = clampBatchCount(count, BATCH_HUSTLE_MAX);
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    total = round2(total + round2(randInt(WORK_PAY_MIN, WORK_PAY_MAX) * varietyPayMultiplier(character)));
    character.alliance = clampStat(character.alliance - ALLIANCE_BUFF);
  }
  character.cash = round2(character.cash + total);
  stampBatchCooldown(character, 'work', n, COOLDOWN_MS);

  const message = n > 1
    ? `Worked ${n} shifts back to back: +$${total.toFixed(2)}.`
    : pickFlavorLine(WORK_FLAVOR_LINES, total);
  return { ok: true, message, cls: 'gain', character };
}

// Mirrors the client's doHustle('slut') branch exactly. `otherPlayerName` is looked up by the
// route (getRandomOtherUserCharacterName in db.js) since gameLogic.js has no DB access of its own.
function doSlut(character, otherPlayerName, count) {
  if (character.jail && character.jail.inJail) return { ok: false, reason: 'You are in jail.' };
  const remaining = getRemainingCooldown(character, 'slut', COOLDOWN_MS);
  if (remaining > 0) {
    return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  }

  const n = clampBatchCount(count, BATCH_HUSTLE_MAX);
  const messages = [];
  let net = 0;
  let robbedCount = 0;
  for (let i = 0; i < n; i += 1) {
    const gain = randInt(5, 60);
    character.cash += gain;
    net += gain;
    character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF_MINOR);
    if (n === 1) messages.push({ message: pickFlavorLine(SLUT_FLAVOR_LINES, gain, otherPlayerName), cls: 'gain' });
    // Independent robbery roll per trick, exactly as the single-click version does it.
    if (Math.random() < 0.3) {
      const lost = Math.min(gain, character.cash);
      character.cash = Math.max(0, character.cash - gain);
      net -= lost;
      robbedCount += 1;
      if (n === 1) messages.push({ message: `You got robbed! -${gain} Floydbucks.`, cls: 'loss' });
    }
  }
  if (n > 1) {
    messages.push({ message: `Turned ${n} tricks: net +$${round2(net).toFixed(2)}${robbedCount ? ` (robbed ${robbedCount}x along the way)` : ''}.`, cls: net >= 0 ? 'gain' : 'loss' });
  }
  stampBatchCooldown(character, 'slut', n, COOLDOWN_MS);
  const achievements = ensureAchievementsState(character);
  achievements.slutCount += n;
  const grantedTitle = maybeGrantAchievementTitle(character, 'looseTitle', achievements.slutCount >= LOOSE_TITLE_THRESHOLD);
  if (grantedTitle) messages.push(grantedTitle);

  return { ok: true, messages, character };
}

// Mirrors the client's doHustle('crime') branch exactly, including the jail-bust path.
function doCrime(character, count) {
  if (character.jail && character.jail.inJail) return { ok: false, reason: 'You are in jail.' };
  const remaining = getRemainingCooldown(character, 'crime', COOLDOWN_MS);
  if (remaining > 0) {
    return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  }

  const n = clampBatchCount(count, BATCH_HUSTLE_MAX);
  const messages = [];
  let total = 0;
  let done = 0;

  for (let i = 0; i < n; i += 1) {
    if (Math.random() < 0.3) {
      // Bust ends the batch here. The successful portion is still paid out (already added to
      // total below), and the cooldown is stamped for the attempts actually made, not the full N --
      // being jailed is punishment enough without also eating the unused cooldown.
      done = i + 1;
      if (total > 0) character.cash = round2(character.cash + total);
      const years = 1 + character.crimeRecord.streak;
      character.crimeRecord.streak = Math.min(CRIME_STREAK_MAX, character.crimeRecord.streak + 1);
      character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
      character.jail.inJail = true;
      character.jail.crime = 'Crime';
      character.jail.yearsRemaining = years;
      character.jail.serving = false;
      const seized = applyArrestSeizure(character);
      stampBatchCooldown(character, 'crime', done, COOLDOWN_MS);
      const streakNote = years > 1 ? ` Repeat offender: +${years - 1} year(s) added to your usual sentence.` : '';
      const batchNote = n > 1 && i > 0 ? ` (${i} of ${n} jobs landed first, +$${total.toFixed(2)}.)` : '';
      return {
        ok: true,
        messages: [{ message: `Busted committing a crime! Sentenced to ${years} year(s).${streakNote}${batchNote}${arrestSeizureNote(seized)}`, cls: 'loss' }],
        jailed: true,
        character,
      };
    }
    total = round2(total + round2(randInt(SKREETZ_CRIME_PAY_MIN, SKREETZ_CRIME_PAY_MAX) * varietyPayMultiplier(character)));
    character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF);
    done = i + 1;
  }

  character.cash = round2(character.cash + total);
  stampBatchCooldown(character, 'crime', done, COOLDOWN_MS);
  messages.push(n > 1
    ? { message: `Pulled ${n} jobs clean: +$${total.toFixed(2)}.`, cls: 'gain' }
    : { message: pickFlavorLine(CRIME_FLAVOR_LINES, total), cls: 'gain' });

  return { ok: true, messages, jailed: false, character };
}

// Mirrors the client's doWorkout() exactly. No cooldown -- gated by fuel (fatGained) and cash
// only, same as the client.
function doWorkout(character) {
  ensureWeightState(character);
  const tier = character.gym.steroidTier ? STEROID_TIERS_BY_ID[character.gym.steroidTier] : null;
  const cost = GYM_COST * (tier ? tier.mult : 1);
  if (character.fatGained < GYM_BURN_LBS) return { ok: false, reason: 'Not enough fuel -- eat at Pete\'sza first.' };
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };

  character.cash -= cost;
  character.fatGained = Math.max(0, character.fatGained - GYM_BURN_LBS);

  if (character.gym.roidJailClicksRemaining > 0) {
    character.gym.roidJailClicksRemaining -= 1;
    return { ok: true, message: 'Roid jail workout: paid, burned fuel, got nothing. Ouch.', cls: 'loss', character };
  }
  if (tier && Math.random() < tier.jailChance) {
    character.gym.roidJailClicksRemaining = tier.jailClicks;
    return { ok: true, message: `${tier.name} backfired! Thrown into Roid Jail for ${tier.jailClicks} clicks.`, cls: 'loss', character };
  }
  const mult = tier ? tier.mult : 1;
  const speedGain = GYM_SPEED_GAIN * mult;
  // Fat burns fast (the full GYM_BURN_LBS above); muscle builds slowly off the back of it.
  const muscleGain = GYM_BURN_LBS * MUSCLE_GAIN_RATIO * mult;
  character.muscleGained += muscleGain;
  const defenseGain = muscleGain * DEFENSE_PER_LB;
  character.stats.speed = clampStat(character.stats.speed + speedGain);
  character.stats.defense = clampStat(character.stats.defense + defenseGain);
  character.gym.bodyScore = round2((character.gym.bodyScore || 0) + WORKOUT_LOOKS_GAIN);
  recomputeLooks(character);
  return {
    ok: true,
    message: `Workout complete: +${round1(speedGain)} Speed, +${round2(muscleGain)} lbs Muscle, +${round1(defenseGain)} Defense, +Looks.`,
    cls: 'gain',
    character,
  };
}

// Trades muscle mass for height -- costs a fixed 60 lbs of Muscle per inch.
function doStretchForHeight(character) {
  ensureWeightState(character);
  const remaining = getRemainingCooldown(character, 'stretchHeight', STRETCH_HEIGHT_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  if (character.muscleGained < STRETCH_HEIGHT_MUSCLE_COST) {
    return { ok: false, reason: `Need at least ${STRETCH_HEIGHT_MUSCLE_COST} lbs of Muscle -- hit the gym first.` };
  }

  character.cooldowns.stretchHeight = Date.now();
  character.muscleGained = round2(Math.max(0, character.muscleGained - STRETCH_HEIGHT_MUSCLE_COST));
  character.height += STRETCH_HEIGHT_GAIN_IN;
  return {
    ok: true,
    message: `Stretched for height: -${STRETCH_HEIGHT_MUSCLE_COST} lbs Muscle, +${STRETCH_HEIGHT_GAIN_IN}" Height.`,
    cls: 'gain',
    character,
  };
}

// Mirrors the client's doSetSteroidTier() exactly -- just a free toggle, no cash/cooldown involved.
function doSetSteroidTier(character, tierId) {
  if (tierId !== null && !STEROID_TIERS_BY_ID[tierId]) {
    return { ok: false, reason: 'Unknown steroid tier.' };
  }
  character.gym.steroidTier = tierId;
  return { ok: true, character };
}

// Mirrors the client's doRoidEscape() exactly.
function doRoidEscape(character) {
  if (character.cash < ROID_ESCAPE_COST) {
    return { ok: false, reason: 'Not enough Floydbucks to bribe your way out of Roid Jail.' };
  }
  character.cash -= ROID_ESCAPE_COST;
  character.gym.roidJailClicksRemaining = 0;
  return { ok: true, message: `Paid $${ROID_ESCAPE_COST} to escape Roid Jail early.`, cls: 'gain', character };
}

// Mirrors the client's doBuyFood() exactly.
function doBuyFood(character, itemId) {
  ensureWeightState(character);
  const item = FOOD_ITEMS_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'Unknown food item.' };

  const cost = round2(item.cost * (hasMilos11Discount(character) ? 0.8 : 1));
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };

  character.cash -= cost;
  const lbs = item.calories / CALORIES_PER_LB;
  character.fatGained += lbs;
  character.stats.speed = clampStat(character.stats.speed - lbs * SPEED_LOSS_PER_LB);
  character.gym.bodyScore = Math.max(0, round2((character.gym.bodyScore || 0) - FOOD_LOOKS_LOSS));
  recomputeLooks(character);

  const achievements = ensureAchievementsState(character);
  achievements.foodEaten += 1;
  const grantedTitle = maybeGrantAchievementTitle(character, 'fatFuck', achievements.foodEaten >= FAT_FUCK_THRESHOLD);

  return {
    ok: true,
    messages: [
      { message: `Ate a ${item.name}: +${round1(lbs)} lbs Fat (fuel for the gym), -${round1(lbs * SPEED_LOSS_PER_LB)} Speed, -Looks.`, cls: 'loss' },
      ...(grantedTitle ? [grantedTitle] : []),
    ],
    character,
  };
}

// Each Maxx item is a one-time procedure (you don't get a second Jawline Filler) -- this also
// closes the pricing loophole where re-buying a cheap item repeatedly could out-value a pricier
// one for less money, since repeat purchases are no longer possible at all.
function doBuyMaxx(character, itemId) {
  const item = MAXX_ITEMS_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'Unknown item.' };
  if (!character.maxxPurchased) character.maxxPurchased = [];
  if (character.maxxPurchased.includes(itemId)) return { ok: false, reason: 'Already purchased.' };
  if (character.cash < item.cost) return { ok: false, reason: 'Not enough Floydbucks.' };

  character.cash -= item.cost;
  character.maxxPurchased.push(itemId);
  if (item.speed) character.stats.speed = clampStat(character.stats.speed + item.speed);
  if (item.height) character.height += item.height;
  recomputeLooks(character);
  return { ok: true, message: `Purchased ${item.name}: ${item.desc}.`, cls: 'gain', character };
}

// Mirrors the client's doBuyChips() exactly.
function doBuyChips(character, amount) {
  if (!amount || amount < 1) return { ok: false, reason: 'Enter a valid amount.' };
  if (character.cash < amount) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= amount;
  character.chips += amount;
  return { ok: true, character };
}

// Mirrors the client's doCashOut() exactly.
function doCashOut(character, amount) {
  if (!amount || amount < 1) return { ok: false, reason: 'Enter a valid amount.' };
  if (character.chips < amount) return { ok: false, reason: 'Not enough Chips.' };
  character.chips -= amount;
  character.cash += amount;
  return { ok: true, character };
}

function drawCard() {
  return { rank: RANKS[randInt(0, RANKS.length - 1)], suit: SUITS[randInt(0, SUITS.length - 1)] };
}

function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return parseInt(rank, 10);
}

function handTotal(cards) {
  let total = cards.reduce((sum, c) => sum + cardValue(c.rank), 0);
  let aces = cards.filter((c) => c.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isBlackjack(cards) {
  return cards.length === 2 && handTotal(cards) === 21;
}

// Settles one hand against an already-resolved dealer hand. `splitHand` disables the 3:2 natural
// blackjack payout, matching standard house rules that a post-split 21 counts as a plain 21.
function settleBlackjackHand(hand, dealerCards, splitHand) {
  const dealerTotal = handTotal(dealerCards);
  const dealerBJ = isBlackjack(dealerCards);
  const playerTotal = handTotal(hand.cards);
  const playerBJ = !splitHand && isBlackjack(hand.cards);

  if (playerTotal > 21) return { payout: 0, msg: `Busted with ${playerTotal}. You lose.` };
  if (playerBJ && dealerBJ) return { payout: hand.bet, msg: 'Both blackjack! Push.' };
  if (playerBJ) return { payout: Math.floor(hand.bet * 2.5), msg: 'Blackjack! You win 3:2.' };
  if (dealerBJ) return { payout: 0, msg: 'Dealer blackjack. You lose.' };
  if (dealerTotal > 21) return { payout: hand.bet * 2, msg: `Dealer busts with ${dealerTotal}. You win!` };
  if (playerTotal > dealerTotal) return { payout: hand.bet * 2, msg: `You win ${playerTotal} vs ${dealerTotal}.` };
  if (playerTotal === dealerTotal) return { payout: hand.bet, msg: `Push at ${playerTotal}.` };
  return { payout: 0, msg: `Dealer wins ${dealerTotal} vs ${playerTotal}.` };
}

// Dealer draws to 17 once (shared across every hand, split or not), then every hand is settled
// independently and payouts summed -- mirrors the old single-hand resolveBlackjack but fans out
// across bj.hands so split hands each get their own payout/message.
function resolveBlackjack(character) {
  const bj = character.blackjack;
  const anyoneStillIn = bj.hands.some((h) => handTotal(h.cards) <= 21);
  if (anyoneStillIn) {
    while (handTotal(bj.dealerCards) < 17) bj.dealerCards.push(drawCard());
  }

  const splitHands = bj.hands.length > 1;
  let totalPayout = 0;
  let totalBet = 0;
  const messages = bj.hands.map((hand, i) => {
    const { payout, msg } = settleBlackjackHand(hand, bj.dealerCards, splitHands);
    totalPayout += payout;
    totalBet += hand.bet;
    return splitHands ? `Hand ${i + 1}: ${msg}` : msg;
  });

  character.chips += totalPayout;
  const cls = totalPayout > totalBet ? 'gain' : (totalPayout === totalBet ? '' : 'loss');
  bj.phase = 'betting';
  bj.hands = [];
  bj.activeHand = 0;
  return {
    ok: true,
    message: `${messages.join(' ')} (bet ${totalBet}, payout ${totalPayout})`,
    cls,
    resolved: true,
    character,
  };
}

// Advances to the next hand still in play (not done, not busted, not already 21), or resolves the
// round with the dealer if every hand has finished acting.
function advanceBlackjackHand(character) {
  const bj = character.blackjack;
  const next = bj.hands.findIndex((h, i) => i > bj.activeHand && !h.done);
  if (next !== -1) {
    bj.activeHand = next;
    return { ok: true, resolved: false, character };
  }
  bj.phase = 'dealerTurn';
  return resolveBlackjack(character);
}

// ---------- Roulette ----------
const ROULETTE_COLOR_BY_NUMBER = (() => {
  const red = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const map = {};
  for (let n = 0; n <= 36; n += 1) {
    map[n] = n === 0 ? 'green' : red.has(n) ? 'red' : 'black';
  }
  return map;
})();

function spinRoulette() {
  return randInt(0, 36);
}

// bet: { type: 'straight'|'redblack'|'evenodd'|'highlow'|'dozen'|'column', value: number|string, amount }
// Payouts are the total returned (stake + profit), same convention as doSlotSpin/doBjDeal's payout
// values -- e.g. a straight-up win returns 36x the bet (35:1 profit plus the original bet back).
function evaluateRouletteBet(bet, resultNumber) {
  const color = ROULETTE_COLOR_BY_NUMBER[resultNumber];
  if (bet.type === 'straight') {
    return Number(bet.value) === resultNumber ? bet.amount * 36 : 0;
  }
  if (resultNumber === 0) return 0; // house number -- all even-money and dozen/column bets lose
  if (bet.type === 'redblack') {
    return bet.value === color ? bet.amount * 2 : 0;
  }
  if (bet.type === 'evenodd') {
    const isEven = resultNumber % 2 === 0;
    return (bet.value === 'even') === isEven ? bet.amount * 2 : 0;
  }
  if (bet.type === 'highlow') {
    const isHigh = resultNumber >= 19;
    return (bet.value === 'high') === isHigh ? bet.amount * 2 : 0;
  }
  if (bet.type === 'dozen') {
    const inDozen = Math.ceil(resultNumber / 12) === Number(bet.value);
    return inDozen ? bet.amount * 3 : 0;
  }
  if (bet.type === 'column') {
    const inColumn = (resultNumber - Number(bet.value)) % 3 === 0;
    return inColumn ? bet.amount * 3 : 0;
  }
  return 0;
}

// Single-player Roulette: place any number of bets in one go, spin once, resolve every bet against
// the same result. No cooldown, same shape as doSlotSpin -- gated only by chip balance.
function doRouletteSpin(character, bets) {
  if (!Array.isArray(bets) || !bets.length) return { ok: false, reason: 'Place at least one bet.' };

  const total = bets.reduce((sum, b) => sum + (Number(b.amount) > 0 ? Number(b.amount) : 0), 0);
  if (!total || total < 1) return { ok: false, reason: 'Enter a valid bet.' };
  if (total > character.chips) return { ok: false, reason: 'Not enough Chips.' };

  character.chips -= total;
  const resultNumber = spinRoulette();
  const color = ROULETTE_COLOR_BY_NUMBER[resultNumber];
  const payout = bets.reduce((sum, b) => sum + evaluateRouletteBet(b, resultNumber), 0);
  character.chips = round2(character.chips + payout);

  const net = payout - total;
  const message = payout > 0
    ? `Ball lands on ${resultNumber} (${color}). Won ${payout} chips${net > 0 ? ` (net +${net})` : net < 0 ? ` (net ${net})` : ''}.`
    : `Ball lands on ${resultNumber} (${color}). No winning bets -- lost ${total} chips.`;
  return { ok: true, character, resultNumber, color, totalBet: total, payout, message, cls: payout > total ? 'gain' : payout === total ? '' : 'loss' };
}

function doBjDeal(character, bet) {
  const bj = ensureBlackjackState(character);
  if (!bet || bet < 1) return { ok: false, reason: 'Enter a valid bet.' };
  if (bet > character.chips) return { ok: false, reason: 'Not enough Chips.' };

  character.chips -= bet;
  character.blackjack = {
    phase: 'playerTurn',
    dealerCards: [drawCard(), drawCard()],
    hands: [{ cards: [drawCard(), drawCard()], bet, done: false }],
    activeHand: 0,
  };

  if (isBlackjack(character.blackjack.hands[0].cards) || isBlackjack(character.blackjack.dealerCards)) {
    character.blackjack.hands[0].done = true;
    return resolveBlackjack(character);
  }
  return { ok: true, resolved: false, character };
}

function doBjHit(character) {
  const bj = ensureBlackjackState(character);
  if (bj.phase !== 'playerTurn') return { ok: false, reason: 'No hand in progress.' };
  const hand = bj.hands[bj.activeHand];

  hand.cards.push(drawCard());
  if (handTotal(hand.cards) > 21) {
    hand.done = true;
    return advanceBlackjackHand(character);
  }
  return { ok: true, resolved: false, character };
}

function doBjStand(character) {
  const bj = ensureBlackjackState(character);
  if (bj.phase !== 'playerTurn') return { ok: false, reason: 'No hand in progress.' };
  bj.hands[bj.activeHand].done = true;
  return advanceBlackjackHand(character);
}

// Doubles the active hand's bet, draws exactly one card, then stands it -- only legal as the
// hand's first decision (still holding its original two cards).
function doBjDouble(character) {
  const bj = ensureBlackjackState(character);
  if (bj.phase !== 'playerTurn') return { ok: false, reason: 'No hand in progress.' };
  const hand = bj.hands[bj.activeHand];
  if (hand.cards.length !== 2) return { ok: false, reason: 'Can only double on your first two cards.' };
  if (hand.bet > character.chips) return { ok: false, reason: 'Not enough Chips to double.' };

  character.chips -= hand.bet;
  hand.bet *= 2;
  hand.cards.push(drawCard());
  hand.done = true;
  return advanceBlackjackHand(character);
}

// Splits the active hand into two hands of one card each (plus a fresh second card apiece) when
// both starting cards share the same value -- only legal as that hand's first decision, and only
// once per round (no re-splitting a hand that already came from a split).
function doBjSplit(character) {
  const bj = ensureBlackjackState(character);
  if (bj.phase !== 'playerTurn') return { ok: false, reason: 'No hand in progress.' };
  if (bj.hands.length > 1) return { ok: false, reason: 'Already split this round.' };
  const hand = bj.hands[bj.activeHand];
  if (hand.cards.length !== 2) return { ok: false, reason: 'Can only split your first two cards.' };
  if (cardValue(hand.cards[0].rank) !== cardValue(hand.cards[1].rank)) return { ok: false, reason: 'Cards must match to split.' };
  if (hand.bet > character.chips) return { ok: false, reason: 'Not enough Chips to split.' };

  character.chips -= hand.bet;
  const [cardA, cardB] = hand.cards;
  bj.hands = [
    { cards: [cardA, drawCard()], bet: hand.bet, done: false },
    { cards: [cardB, drawCard()], bet: hand.bet, done: false },
  ];
  bj.activeHand = 0;
  return { ok: true, resolved: false, character };
}

function weightedSlotSymbol(symbols) {
  const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * totalWeight;
  for (const s of symbols) {
    if (r < s.weight) return s;
    r -= s.weight;
  }
  return symbols[0];
}

// Single spin function shared by all three machines -- reel count, min bet, symbol weights, and
// match payouts all come from SLOT_MACHINES[machineKey]. A non-full match still refunds the bet
// if the lowest-tier (highest-weight) symbol lands on at least half the reels, same consolation
// idea as the original 3-reel "two cherries" rule, just scaled to more reels.
function doSlotSpin(character, machineKey, bet) {
  const machine = SLOT_MACHINES[machineKey];
  if (!machine) return { ok: false, reason: 'Unknown slot machine.' };
  if (!bet || bet < machine.minBet) return { ok: false, reason: `Minimum bet is ${machine.minBet}.` };
  if (bet > character.chips) return { ok: false, reason: 'Not enough Chips.' };
  character.chips -= bet;

  const reels = Array.from({ length: machine.reelCount }, () => weightedSlotSymbol(machine.symbols));

  let payout = 0;
  let msg = '';
  const allMatch = reels.every((s) => s.symbol === reels[0].symbol);
  if (allMatch) {
    payout = bet * reels[0].match;
    msg = `${machine.reelCount}x ${reels[0].symbol}! +${payout} chips.`;
  } else {
    const filler = machine.symbols[0];
    const fillerCount = reels.filter((s) => s.symbol === filler.symbol).length;
    const threshold = Math.max(2, Math.ceil(machine.reelCount / 2));
    if (fillerCount >= threshold) {
      payout = bet;
      msg = `${fillerCount}x ${filler.symbol} — bet refunded.`;
    } else {
      msg = 'No match. Better luck next spin.';
    }
  }

  character.chips = round2(character.chips + payout);
  return {
    ok: true,
    machine: machineKey,
    reels: reels.map((s) => s.symbol),
    message: `${msg} (bet ${bet})`,
    cls: payout > bet ? 'gain' : (payout === bet ? '' : 'loss'),
    character,
  };
}

function addToInventory(character, itemId, qty) {
  const existing = character.inventory.find((i) => i.id === itemId);
  if (existing) existing.qty += qty;
  else character.inventory.push({ id: itemId, qty });
}

function removeFromInventory(character, itemId, qty) {
  const existing = character.inventory.find((i) => i.id === itemId);
  if (!existing) return;
  existing.qty -= qty;
  if (existing.qty <= 0) character.inventory = character.inventory.filter((i) => i.id !== itemId);
}

function inventoryQty(character, itemId) {
  const existing = character.inventory.find((i) => i.id === itemId);
  return existing ? existing.qty : 0;
}

function bankCreditLimit(character) {
  return Math.round(character.bank.balance * BANK_CREDIT_LIMIT_PCT);
}

// Mirrors the client's doBankDeposit() exactly.
function doBankDeposit(character, amount) {
  const bank = character.bank;
  const tier = BANK_TIERS[bank.tier];
  if (!amount || amount <= 0) return { ok: false, reason: 'Enter a valid amount.' };
  if (amount > character.cash) return { ok: false, reason: 'Not enough Floydbucks on hand.' };
  const room = tier.maxBalance - bank.balance;
  if (room <= 0) return { ok: false, reason: 'Your account is already at its max balance. Upgrade to deposit more.' };
  const deposited = Math.min(amount, room);
  character.cash = round2(character.cash - deposited);
  bank.balance = round2(bank.balance + deposited);
  return { ok: true, message: `Deposited $${deposited.toFixed(2)}.`, cls: 'gain', character };
}

// Mirrors the client's doBankWithdraw() exactly.
function doBankWithdraw(character, amount) {
  const bank = character.bank;
  if (!amount || amount <= 0) return { ok: false, reason: 'Enter a valid amount.' };
  if (amount > bank.balance) return { ok: false, reason: 'Not enough in your bank balance.' };
  bank.balance = round2(bank.balance - amount);
  character.cash = round2(character.cash + amount);
  return { ok: true, message: `Withdrew $${amount.toFixed(2)}.`, cls: 'gain', character };
}

// Mirrors the client's doBankUpgrade() exactly, including the Caesar Ti title grant at max tier.
function doBankUpgrade(character) {
  const bank = character.bank;
  const nextTier = BANK_TIERS[bank.tier + 1];
  if (!nextTier) return { ok: false, reason: 'You have the highest tier account available.' };
  if (character.cash < nextTier.upgradeCost) return { ok: false, reason: 'Not enough Floydbucks.' };

  character.cash = round2(character.cash - nextTier.upgradeCost);
  bank.tier += 1;
  const messages = [{ message: `Upgraded to ${nextTier.name}!`, cls: 'gain' }];
  if (nextTier === BANK_TIERS[BANK_TIERS.length - 1]) {
    addToInventory(character, CAESAR_TI_TITLE_ID, 1);
    messages.push({ message: 'CAESAR Ti title added to your Inventory.', cls: 'gain' });
  }
  return { ok: true, messages, character };
}

// Mirrors the client's doBankApplyCredit() exactly.
function doBankApplyCredit(character) {
  const bank = character.bank;
  if (bank.balance <= 0) return { ok: false, reason: 'You need a bank balance to qualify for a credit card.' };
  bank.hasCreditCard = true;
  return { ok: true, message: `Credit card approved with a $${bankCreditLimit(character).toLocaleString()} limit.`, cls: 'gain', character };
}

// Mirrors the client's doBankCashAdvance() exactly.
function doBankCashAdvance(character, amount) {
  const bank = character.bank;
  const available = bankCreditLimit(character) - bank.creditBalance;
  const clamped = Math.max(0, Math.min(available, amount || 0));
  if (clamped <= 0) return { ok: false, reason: 'No credit available.' };
  bank.creditBalance = round2(bank.creditBalance + clamped);
  character.cash = round2(character.cash + clamped);
  return { ok: true, message: `Cash advance: +$${clamped.toFixed(2)}. Owed $${bank.creditBalance.toFixed(2)}.`, cls: 'gain', character };
}

// Mirrors the client's doBankPayCredit() exactly.
function doBankPayCredit(character) {
  const bank = character.bank;
  const amount = Math.min(bank.creditBalance, character.cash);
  if (amount <= 0) return { ok: false, reason: 'Not enough Floydbucks on hand.' };
  character.cash = round2(character.cash - amount);
  bank.creditBalance = round2(bank.creditBalance - amount);
  return { ok: true, message: `Paid off $${amount.toFixed(2)} of your credit card balance.`, cls: 'gain', character };
}

// Mirrors the client's doBuyGun() exactly. Requires the Gun Safety License, same as the client's
// disabled-button gating (enforced here instead of just trusted from a disabled attribute).
function doBuyGun(character, itemId, activeModifier) {
  const item = GUN_ITEMS_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'Unknown weapon.' };
  if (!character.licenses.gunSafety) return { ok: false, reason: 'Take the Gun Safety Course at City Hall first.' };
  const cost = round2(item.cost * gunPriceFactor(character, activeModifier));
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= cost;
  addToInventory(character, item.id, 1);
  return {
    ok: true,
    message: `Purchased a ${item.name} for $${cost.toFixed(2)}. It's in your Inventory -- equip it to carry it.`,
    cls: 'gain',
    character,
  };
}

// RED vs. BLUE Crate: cash + character.titles/inventory stay client-authoritative like every other
// crate (see market.js), but the 1,000-per-crate global cap has to be enforced server-side since
// it's shared across every player -- this only handles the cash side; the stock reservation itself
// happens in server.js (db.trySpendCrateStock) before this runs.
const RED_BLUE_CRATE_COST = 20000;
function doSpinRedBlueCrate(character, qty) {
  const totalCost = RED_BLUE_CRATE_COST * qty;
  if (character.cash < totalCost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= totalCost;
  return { ok: true, character };
}

// SHALOM CRATE: exact same split as RED/BLUE above -- cash + character.titles/inventory stay
// client-authoritative, the 333-total global cap is enforced server-side (db.trySpendShalomCrateStock,
// reserved in server.js before this runs) since it's shared across every player. This only handles
// the cash side.
const SHALOM_CRATE_COST = 3333;
function doSpinShalomCrate(character, qty) {
  const totalCost = SHALOM_CRATE_COST * qty;
  if (character.cash < totalCost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= totalCost;
  return { ok: true, character };
}

// Mirrors the client's doBuyMelee() exactly -- no license needed.
function doBuyMelee(character, itemId) {
  const item = MELEE_ITEMS_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'Unknown weapon.' };
  const cost = round2(item.cost * (hasFenceDiscount(character) ? 0.85 : 1));
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= cost;
  addToInventory(character, item.id, 1);
  return {
    ok: true,
    message: `Purchased a ${item.name} for $${cost.toFixed(2)}. It's in your Inventory -- equip it to carry it.`,
    cls: 'gain',
    character,
  };
}

// No license/discount gating -- a straightforward expensive one-time buy. Consumed automatically
// after the wearer's next PvP duel, see applyDuelOutcome().
function doBuyArmor(character, itemId) {
  const item = ARMOR_ITEMS_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'Unknown armor.' };
  if (character.cash < item.cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= item.cost;
  addToInventory(character, item.id, 1);
  return {
    ok: true,
    message: `Purchased ${item.name} for $${item.cost.toFixed(2)}. It's in your Inventory -- equip it to carry it. Gone after your next duel.`,
    cls: 'gain',
    character,
  };
}

// Mirrors the client's doBuyAmmo() exactly.
function doBuyAmmo(character, itemId, activeModifier) {
  const item = AMMO_ITEMS_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'Unknown ammo.' };
  const cost = round2(item.cost * gunPriceFactor(character, activeModifier));
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= cost;
  addToInventory(character, item.id, 1);
  return { ok: true, message: `Purchased a ${item.name} for $${cost.toFixed(2)}.`, cls: 'gain', character };
}

// Mirrors the client's doApplyConcealedPermit() exactly.
function doApplyConcealedPermit(character) {
  const licenses = character.licenses;
  if (!licenses.gunSafety) return { ok: false, reason: 'Take the Gun Safety Course at City Hall first.' };
  if (licenses.concealedPermit) return { ok: false, reason: 'You already have a Concealed Carry Permit.' };
  if (licenses.concealedPendingUntil > Date.now()) return { ok: false, reason: 'Your application is already pending.' };
  if (character.cash < CONCEALED_APPLY_COST) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= CONCEALED_APPLY_COST;
  licenses.concealedPendingUntil = Date.now() + CONCEALED_WAIT_MS;
  return {
    ok: true,
    message: `Applied for a Concealed Carry Permit for $${CONCEALED_APPLY_COST.toLocaleString()}. Approval in 10 minutes.`,
    cls: 'gain',
    character,
  };
}

// Mirrors the client's doApplyGoodJob() exactly.
function doApplyGoodJob(character, jobId) {
  if (character.jobs.currentJob) return { ok: false, reason: 'Resign from your current job first.' };
  const job = GOOD_JOBS_BY_ID[jobId];
  if (!job) return { ok: false, reason: 'Unknown job.' };
  character.jobs.currentJob = jobId;
  character.jobs.skills = { skill1: 0, skill2: 0, skill3: 0, skill4: 0 };
  return { ok: true, message: `Hired at ${job.name}. Starting at base rank.`, cls: 'gain', character };
}

// Mirrors the client's doResignGoodJob() exactly.
function doResignGoodJob(character) {
  const job = GOOD_JOBS_BY_ID[character.jobs.currentJob];
  character.jobs.currentJob = null;
  character.jobs.skills = { skill1: 0, skill2: 0, skill3: 0, skill4: 0 };
  return { ok: true, message: job ? `Resigned from ${job.name}.` : 'Resigned.', cls: '', character };
}

// Mirrors the client's doGoodJobWork() exactly, but derives the cooldown key from the skill key
// server-side (jobSkill1..4) instead of trusting a client-supplied cooldown key, and enforces the
// cooldown itself -- the client only disabled the button, it never validated this internally.
function doGoodJobWork(character, skillKey, count) {
  if (isVarietyAutoFired(character)) return { ok: false, reason: 'Your Variety is too high -- you were fired. Renounce Variety at the Morals Center to work again.' };
  const job = GOOD_JOBS_BY_ID[character.jobs.currentJob];
  if (!job) return { ok: false, reason: 'You are not employed.' };
  const skillIndex = SKILL_KEYS.indexOf(skillKey);
  if (skillIndex === -1) return { ok: false, reason: 'Unknown skill.' };

  const cooldownKey = `jobSkill${skillIndex + 1}`;
  const rank = goodJobRank(character);
  const remaining = getRemainingCooldown(character, cooldownKey, rank.cooldownMs);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  const n = clampBatchCount(count, BATCH_JOB_MAX);
  // ceoActive/maxxActive are evaluated once for the whole shift rather than re-checked per payout:
  // both depend on the skill average, which the batch itself raises, and re-checking mid-batch would
  // let a x10 shift cross the CEO threshold partway and pay MORE per click than 10 single clicks
  // would have. Locking them at the pre-batch value keeps $/hr exactly identical.
  const ceoActive = goodJobSkillAvg(character) >= GOOD_CEO_MIN_AVG && character.alliance <= COMBAT_GOOD_MAX_ALLIANCE;
  const maxxActive = isMaxxComplete(character);
  let gain = 0;
  for (let i = 0; i < n; i += 1) {
    gain = round2(gain + round2(randFloat(rank.payMin, rank.payMax)
      * (ceoActive ? GOOD_CEO_MULTIPLIER : 1)
      * (maxxActive ? MAXX_COMPLETE_MULTIPLIER : 1)
      * varietyPayMultiplier(character)));
    const skillGain = randFloat(JOB_SKILL_TRAIN_MIN, JOB_SKILL_TRAIN_MAX) * goodJobSkillTrainMult(character);
    character.jobs.skills[skillKey] = clampStat(character.jobs.skills[skillKey] + skillGain);
    character.alliance = clampStat(character.alliance - ALLIANCE_BUFF);
  }
  character.cash = round2(character.cash + gain);
  stampBatchCooldown(character, cooldownKey, n, rank.cooldownMs);

  const bonusNote = `${ceoActive ? ' (👔 CEO Bonus)' : ''}${maxxActive ? ' (💈 Maxxed Bonus)' : ''}`;
  const shiftNote = n > 1 ? ` x${n} shift` : '';
  const messages = [{ message: `${job.name}${shiftNote}: +$${gain.toFixed(2)}${bonusNote}.`, cls: 'gain' }];
  if (job.id === 'pizza' && !character.jobs.pizzaPerkGranted && goodJobPerkActive(character, 'pizza')) {
    character.stats.speed = clampStat(character.stats.speed + 2);
    character.jobs.pizzaPerkGranted = true;
    messages.push({ message: 'Perk unlocked -- 🏃 Delivery Legs: permanent +2 Speed!', cls: 'gain' });
  }
  return { ok: true, messages, character };
}

// Mirrors the client's doApplyBadJob() exactly.
function doApplyBadJob(character, jobId) {
  if (character.badJobs.currentJob) return { ok: false, reason: 'Resign from your current job first.' };
  const job = BAD_JOBS_BY_ID[jobId];
  if (!job) return { ok: false, reason: 'Unknown job.' };
  character.badJobs.currentJob = jobId;
  character.badJobs.skills = { skill1: 0, skill2: 0, skill3: 0, skill4: 0 };
  return { ok: true, message: `You're in with ${job.name}. Starting at base rank.`, cls: 'gain', character };
}

// Mirrors the client's doResignBadJob() exactly.
function doResignBadJob(character) {
  const job = BAD_JOBS_BY_ID[character.badJobs.currentJob];
  character.badJobs.currentJob = null;
  character.badJobs.skills = { skill1: 0, skill2: 0, skill3: 0, skill4: 0 };
  return { ok: true, message: job ? `Cut ties with ${job.name}.` : 'Resigned.', cls: '', character };
}

// Mirrors the client's doBadJobWork() exactly, including the jail-bust path. Same cooldown-key
// derivation and internal cooldown enforcement as doGoodJobWork().
function doBadJobWork(character, skillKey, count) {
  if (isVarietyAutoFired(character)) return { ok: false, reason: 'Your Variety is too high -- you were fired. Renounce Variety at the Morals Center to work again.' };
  const job = BAD_JOBS_BY_ID[character.badJobs.currentJob];
  if (!job) return { ok: false, reason: 'You are not employed.' };
  const skillIndex = SKILL_KEYS.indexOf(skillKey);
  if (skillIndex === -1) return { ok: false, reason: 'Unknown skill.' };

  const cooldownKey = `badJobSkill${skillIndex + 1}`;
  const rank = badJobRank(character);
  const remaining = getRemainingCooldown(character, cooldownKey, rank.cooldownMs);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  const n = clampBatchCount(count, BATCH_JOB_MAX);
  // Bust chance is snapshotted for the same reason the CEO/Maxx bonuses are in doGoodJobWork: it
  // derives from the skill average this batch is actively raising, so re-rolling it against a
  // mid-batch average would make a x10 shift statistically safer than 10 single clicks.
  const bustChance = badJobBustChance(character);
  let gain = 0;
  for (let i = 0; i < n; i += 1) {
    if (Math.random() < bustChance) {
      // Stop at the first bust: pay out what was already earned, jail as usual, and only charge
      // cooldown for the shifts actually attempted.
      if (gain > 0) character.cash = round2(character.cash + gain);
      stampBatchCooldown(character, cooldownKey, i + 1, rank.cooldownMs);
      const years = BAD_JOB_JAIL_YEARS + character.crimeRecord.streak;
      character.crimeRecord.streak = Math.min(CRIME_STREAK_MAX, character.crimeRecord.streak + 1);
      character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
      character.jail.inJail = true;
      character.jail.crime = job.name;
      character.jail.yearsRemaining = years;
      character.jail.serving = false;
      const seized = applyArrestSeizure(character);
      const streakNote = years > BAD_JOB_JAIL_YEARS ? ` (${BAD_JOB_JAIL_YEARS} base + ${years - BAD_JOB_JAIL_YEARS} repeat-offender)` : '';
      const batchNote = n > 1 && i > 0 ? ` (${i} of ${n} shifts paid out first, +$${gain.toFixed(2)}.)` : '';
      return {
        ok: true,
        jailed: true,
        message: `Busted working for ${job.name}! Sentenced to ${years} year(s)${streakNote}.${batchNote}${arrestSeizureNote(seized)}`,
        cls: 'loss',
        character,
      };
    }
    gain = round2(gain + round2(randFloat(rank.payMin, rank.payMax) * varietyPayMultiplier(character)));
    const skillGain = randFloat(JOB_SKILL_TRAIN_MIN, JOB_SKILL_TRAIN_MAX) * badJobSkillTrainMult(character);
    character.badJobs.skills[skillKey] = clampStat(character.badJobs.skills[skillKey] + skillGain);
    character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF);
  }

  character.cash = round2(character.cash + gain);
  stampBatchCooldown(character, cooldownKey, n, rank.cooldownMs);
  const shiftNote = n > 1 ? ` x${n} shift` : '';
  return { ok: true, jailed: false, message: `${job.name}${shiftNote}: +$${gain.toFixed(2)}.`, cls: 'gain', character };
}

// Mirrors the client's doBuyGear() exactly -- Wrestling Gear Store, unlocked by the wrestler perk.
function doBuyGear(character, itemId) {
  const item = WRESTLING_GEAR_ITEMS_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'Unknown item.' };
  if (character.cash < item.cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= item.cost;
  addToInventory(character, item.id, 1);
  return { ok: true, message: `Purchased ${item.name}. Equip it in Character > Equipment.`, cls: 'gain', character };
}

// Mirrors the client's doDealerQuickDeal() exactly, with cooldown enforcement added server-side
// (the client only disabled the button -- same gap fixed for the job-work actions above).
function doDealerQuickDeal(character, dealerId) {
  const dealer = DEALER_TIERS_BY_ID[dealerId];
  if (!dealer) return { ok: false, reason: 'Unknown dealer.' };
  const cooldownKey = `dealer_${dealerId}`;
  const remaining = getRemainingCooldown(character, cooldownKey, DEALER_QUICK_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  character.cooldowns[cooldownKey] = Date.now();
  if (Math.random() < DEALER_QUICK_SUCCESS_CHANCE) {
    const gain = round2(randFloat(DEALER_QUICK_MIN, DEALER_QUICK_MAX));
    character.cash = round2(character.cash + gain);
    return { ok: true, message: `Quick deal with ${dealer.name}: +$${gain.toFixed(2)}.`, cls: 'gain', character };
  }
  character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF);
  return { ok: true, message: `${dealer.name} stiffed you. No payout.`, cls: 'loss', character };
}

// Mirrors the client's doBuyFromDealer() exactly.
function doBuyFromDealer(character, dealerId, qty) {
  const dealer = DEALER_TIERS_BY_ID[dealerId];
  if (!dealer) return { ok: false, reason: 'Unknown dealer.' };
  if (!qty || qty < 1) return { ok: false, reason: 'Enter a valid quantity.' };
  const drug = DRUG_ITEMS_BY_ID[dealer.drugId];
  const cost = drug.wholesaleCost * qty;
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - cost);
  addToInventory(character, drug.id, qty);
  return { ok: true, message: `Bought ${qty}x ${drug.name} from ${dealer.name} for $${cost.toLocaleString()}.`, cls: 'gain', character };
}

// Same shape as crimeFailChance()'s stat mitigation (Speed+Attack reduce a base risk, floored at
// a minimum) -- selling risk is "getting caught/busted", same theme as a crime bust.
const DRUG_SELL_RISK_MIN = 0.03;
const DRUG_SELL_STAT_MITIGATION = 0.5; // max reduction to risk from Speed+Attack at 100/100

function drugSellRiskChance(character, drug, qty) {
  const baseRisk = Math.min(0.9, drug.riskBase + (qty - 1) * drug.riskPerUnit);
  const statScore = (character.stats.speed + character.stats.attack) / (2 * STAT_CAP);
  const reduction = Math.min(DRUG_SELL_STAT_MITIGATION, statScore * DRUG_SELL_STAT_MITIGATION);
  return Math.max(DRUG_SELL_RISK_MIN, baseRisk - reduction);
}

// The exploit: jail time used to be purely `jailYearsPerUnit * qty` for THIS transaction, with no
// memory of past sales -- spamming qty=1 sales kept the sentence flat and cheap forever no matter
// how much you'd sold lifetime. Ties the sentence to character.drugDealer.unitsSold (already
// tracked for dealer-unlock thresholds) instead: every 100 lifetime units sold adds another 25% to
// the jail time you get if busted, capped at 6x so it stays severe without being absurd for the
// highest-volume grinders (dmitri's own unlock threshold is 2,000 units).
const DRUG_JAIL_ESCALATION_STEP_UNITS = 100;
const DRUG_JAIL_ESCALATION_PER_STEP = 0.25;
const DRUG_JAIL_ESCALATION_MAX_MULT = 6;

function drugJailEscalationMultiplier(character) {
  const unitsSold = (character.drugDealer && character.drugDealer.unitsSold) || 0;
  const steps = Math.floor(unitsSold / DRUG_JAIL_ESCALATION_STEP_UNITS);
  return Math.min(DRUG_JAIL_ESCALATION_MAX_MULT, 1 + steps * DRUG_JAIL_ESCALATION_PER_STEP);
}

// Looks is this game's "charisma" stat elsewhere (speeds up job skill training) -- here it's a
// smooth-talking/street-cred revenue bonus on top of the flat per-unit price roll.
const DRUG_SELL_LOOKS_BONUS_MAX = 0.25; // up to +25% revenue at 100 Looks

function drugSellRevenueMultiplier(character) {
  const looksScore = Math.min(character.stats.looks, STAT_CAP) / STAT_CAP;
  return 1 + looksScore * DRUG_SELL_LOOKS_BONUS_MAX;
}

// Mirrors the client's doSellDrugs() exactly, plus one addition: the client trusted its own UI to
// clamp the sell quantity to what you actually own, but a direct API call has no such UI in the
// way, so an unowned-quantity sale would otherwise mint Floydbucks from nothing. Added an
// ownership check the original never needed.
function doSellDrugs(character, drugId, qty) {
  const drug = DRUG_ITEMS_BY_ID[drugId];
  if (!drug) return { ok: false, reason: 'Unknown drug.' };
  if (!qty || qty < 1) return { ok: false, reason: 'Enter a valid quantity.' };
  if (qty > inventoryQty(character, drugId)) return { ok: false, reason: "You don't have that many to sell." };

  const riskChance = drugSellRiskChance(character, drug, qty);
  if (Math.random() < riskChance) {
    const years = Math.max(1, Math.round(drug.jailYearsPerUnit * qty * drugJailEscalationMultiplier(character)));
    removeFromInventory(character, drugId, qty);
    character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
    character.jail.inJail = true;
    character.jail.crime = `Selling ${drug.name}`;
    character.jail.yearsRemaining = years;
    character.jail.serving = false;
    const seized = applyArrestSeizure(character);
    return { ok: true, jailed: true, message: `Busted selling ${qty}x ${drug.name}! Sentenced to ${years} year(s).${arrestSeizureNote(seized)}`, cls: 'loss', character };
  }

  const unitPrice = randFloat(drug.sellMin, drug.sellMax) * drugSellRevenueMultiplier(character);
  const total = round2(unitPrice * qty);
  character.cash = round2(character.cash + total);
  removeFromInventory(character, drugId, qty);
  character.drugDealer.unitsSold += qty;
  return { ok: true, jailed: false, message: `Sold ${qty}x ${drug.name} for $${total.toFixed(2)}.`, cls: 'gain', character };
}

// Mirrors the client's doRobbery() exactly, plus the "Peace & Prosperity" modifier disabling
// Robbery entirely -- previously enforced only by disabling the button client-side.
function doRobbery(character, activeModifier) {
  if (activeModifier === 'peace') return { ok: false, reason: 'Robbery is disabled -- Peace & Prosperity.' };
  const remaining = getRemainingCooldown(character, 'robbery', ROBBERY_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  character.cooldowns.robbery = Date.now();
  const speed = character.stats.speed;
  const looks = Math.min(character.stats.looks, STAT_CAP);
  const findOutChance = Math.max(0.1, Math.min(0.55, 0.55 - (speed / 100) * 0.35 - (looks / 100) * 0.10));

  if (Math.random() >= findOutChance) {
    const gain = round2(randFloat(ROBBERY_MIN, ROBBERY_MAX));
    character.cash = round2(character.cash + gain);
    character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF);
    return { ok: true, jailed: false, message: `Robbed a stranger for $${gain.toFixed(2)} and got away clean.`, cls: 'gain', character };
  }

  const winChance = Math.max(0.15, Math.min(0.85, 0.5 + (character.stats.attack - NPC_CITIZEN.attack) * 0.015));
  if (Math.random() < winChance) {
    const gain = round2(randFloat(ROBBERY_MIN, ROBBERY_MAX) * 0.5);
    character.cash = round2(character.cash + gain);
    character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF);
    return {
      ok: true,
      jailed: false,
      message: `They noticed and fought back! You won the scuffle and got away with $${gain.toFixed(2)}.`,
      cls: 'gain',
      character,
    };
  }

  character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
  character.jail.inJail = true;
  character.jail.crime = 'Attempted Robbery';
  character.jail.yearsRemaining = ROBBERY_JAIL_YEARS;
  character.jail.serving = false;
  const seized = applyArrestSeizure(character);
  return { ok: true, jailed: true, message: `They noticed, fought back, and beat you! Sentenced to ${ROBBERY_JAIL_YEARS} year.${arrestSeizureNote(seized)}`, cls: 'loss', character };
}

// PvP robbery of a specific real target (as opposed to doRobbery's flavor-text "stranger"). Same
// risk profile as the PvE version -- same odds math, same jail penalty on failure -- but the cash
// actually moves between two real characters, and the cooldown is keyed to this specific
// attacker-target pair so hitting someone doesn't lock you out of robbing anyone else.
const PVP_ROBBERY_COOLDOWN_MS = 5 * 60 * 1000;
// Reward is now a cut of what the victim actually has, not a flat range -- robbing a broke player
// nets little, robbing a rich one is genuinely worth the risk. Fight-back-win pays half as much,
// same ratio the old flat-range version used.
const ROBBERY_PCT = 0.20;

function doRobPlayer(attacker, target, targetUserId, activeModifier) {
  if (activeModifier === 'peace') return { ok: false, reason: 'Robbery is disabled -- Peace & Prosperity.' };

  const cooldownKey = `rob_${targetUserId}`;
  const remaining = getRemainingCooldown(attacker, cooldownKey, PVP_ROBBERY_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `You need to wait ${Math.ceil(remaining / 1000)}s before robbing them again.` };

  attacker.cooldowns[cooldownKey] = Date.now();

  const { blocked } = checkSecumaxBlock(target, 'rob');
  if (blocked) {
    return {
      ok: true,
      jailed: false,
      blocked: true,
      message: `${target.firstName} has Secumax protection -- your robbery attempt was stopped.`,
      cls: 'loss',
      attacker,
      target,
    };
  }

  const speed = attacker.stats.speed;
  const looks = Math.min(attacker.stats.looks, STAT_CAP);
  const findOutChance = Math.max(0.1, Math.min(0.55, 0.55 - (speed / 100) * 0.35 - (looks / 100) * 0.10));

  if (Math.random() >= findOutChance) {
    const gain = round2(target.cash * ROBBERY_PCT);
    attacker.cash = round2(attacker.cash + gain);
    target.cash = round2(target.cash - gain);
    attacker.alliance = clampStat(attacker.alliance + ALLIANCE_DEBUFF);
    const bonusNotes = [tryInterceptFarmShipment(attacker, target), tryDrainCryptoWallet(attacker, target)].filter(Boolean);
    const message = `Robbed ${target.firstName} ${target.lastName} for $${gain.toFixed(2)} and got away clean.${bonusNotes.length ? ` ${bonusNotes.join(' ')}` : ''}`;
    return { ok: true, jailed: false, message, cls: 'gain', attacker, target, gain };
  }

  const winChance = Math.max(0.15, Math.min(0.85, 0.5 + (attacker.stats.attack - target.stats.attack) * 0.015));
  if (Math.random() < winChance) {
    const gain = round2(target.cash * ROBBERY_PCT * 0.5);
    attacker.cash = round2(attacker.cash + gain);
    target.cash = round2(target.cash - gain);
    attacker.alliance = clampStat(attacker.alliance + ALLIANCE_DEBUFF);
    const bonusNotes = [tryInterceptFarmShipment(attacker, target), tryDrainCryptoWallet(attacker, target)].filter(Boolean);
    return {
      ok: true,
      jailed: false,
      message: `${target.firstName} noticed and fought back! You won the scuffle and got away with $${gain.toFixed(2)}.${bonusNotes.length ? ` ${bonusNotes.join(' ')}` : ''}`,
      cls: 'gain',
      attacker,
      target,
      gain,
    };
  }

  const years = ROBBERY_JAIL_YEARS + attacker.crimeRecord.streak;
  attacker.crimeRecord.streak = Math.min(CRIME_STREAK_MAX, attacker.crimeRecord.streak + 1);
  attacker.alliance = clampStat(Math.max(attacker.alliance, GUZMAN_MIN_ALLIANCE));
  attacker.jail.inJail = true;
  attacker.jail.crime = 'Attempted Robbery';
  attacker.jail.yearsRemaining = years;
  attacker.jail.serving = false;
  const seized = applyArrestSeizure(attacker);
  const streakNote = years > ROBBERY_JAIL_YEARS ? ` (${ROBBERY_JAIL_YEARS} base + ${years - ROBBERY_JAIL_YEARS} repeat-offender)` : '';
  return {
    ok: true,
    jailed: true,
    message: `${target.firstName} noticed, fought back, and beat you! Sentenced to ${years} year(s)${streakNote}.${arrestSeizureNote(seized)}`,
    cls: 'loss',
    attacker,
    target,
  };
}

// ---------- Sliming ----------
// A gun-required PvP action: consume an equipped gun to shoot another player. Unarmed target ->
// straight hit-chance roll scaled by the shooter's Shooting skill. Armed target -> both burn their
// gun and roll 1-20, higher roll wins (ties favor the shooter). Whoever loses gets "slimed" (locked
// out of the game for 10 minutes) UNLESS they have Body Armor equipped, in which case the armor
// silently blocks it (consumed either way) and the would-be winner is jailed for the attempt instead.
const SLIME_COOLDOWN_MS = 5 * 60 * 1000;
const SLIME_LOCKOUT_MS = 10 * 60 * 1000;
const SLIME_JAIL_YEARS = 2;
const SLIME_BASE_HIT_CHANCE = 0.5;
const SLIME_SHOOTING_HIT_BONUS_MAX = 0.4; // up to +40% hit chance at 100 Shooting skill
const SLIME_HIT_CHANCE_MAX = 0.9;
// Mirrors the client's (client-only, unenforced) doIllegalGearCheck()/JAIL_YEARS_WEAPON in
// js/milos.js exactly -- same 50% bust chance, same 20-year sentence -- but for real, server-side,
// since firing the gun during a Sliming attempt is the one moment that system is fully
// authoritative. openCarry is unconditionally illegal; holsterL/holsterR need the permit.
const ILLEGAL_GUN_BUST_CHANCE = 0.5;
const JAIL_YEARS_ILLEGAL_GUN = 20;

function ensureSlimeState(character) {
  if (!character.slime) character.slime = { active: false, until: 0, byName: null };
  if (!character.slimeRecord) character.slimeRecord = [];
  return character.slime;
}

function isSlimed(character) {
  const slime = ensureSlimeState(character);
  return slime.active && Date.now() < slime.until;
}

// Returns the equipped gun's slot name ('holsterL'/'holsterR'/'openCarry'), or null if unarmed.
function equippedGunSlot(character) {
  if (GUN_ITEMS_BY_ID[character.equipment.holsterL]) return 'holsterL';
  if (GUN_ITEMS_BY_ID[character.equipment.holsterR]) return 'holsterR';
  if (GUN_ITEMS_BY_ID[character.equipment.openCarry]) return 'openCarry';
  return null;
}

// Mirrors consumeArmorIfEquipped()'s shape -- unequips + burns one unit, but from whichever gun
// slot is actually holding one.
function consumeEquippedGun(character) {
  const slot = equippedGunSlot(character);
  if (!slot) return;
  const gunId = character.equipment[slot];
  character.equipment[slot] = null;
  removeFromInventory(character, gunId, 1);
}

function isGunSlotIllegal(character, slot) {
  if (slot === 'openCarry') return true;
  return !character.licenses.concealedPermit;
}

// Busts `character` for the gun in `slot` if it's illegally carried and the roll catches them --
// forfeits that gun and jails them. Returns whether it happened so the caller can react (e.g. an
// armed defender whose gun gets confiscated mid-shootout never gets to use it).
// Returns { busted, seized } rather than a plain boolean now that every jail entry also triggers
// asset forfeiture -- the caller needs the seized amount to append to its own message, and a bare
// number can't be used as the busted flag (a broke player is legitimately busted for $0).
function checkIllegalGunBust(character, slot) {
  if (!isGunSlotIllegal(character, slot)) return { busted: false, seized: 0 };
  if (Math.random() >= ILLEGAL_GUN_BUST_CHANCE) return { busted: false, seized: 0 };
  const gunId = character.equipment[slot];
  character.equipment[slot] = null;
  removeFromInventory(character, gunId, 1);
  character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
  character.jail.inJail = true;
  character.jail.crime = 'Illegal Firearm Possession';
  character.jail.yearsRemaining = JAIL_YEARS_ILLEGAL_GUN;
  character.jail.serving = false;
  return { busted: true, seized: applyArrestSeizure(character) };
}

function slimeShootingHitChance(character) {
  const skillScore = Math.min(character.weaponSkills.shooting, STAT_CAP) / STAT_CAP;
  return Math.min(SLIME_HIT_CHANCE_MAX, SLIME_BASE_HIT_CHANCE + skillScore * SLIME_SHOOTING_HIT_BONUS_MAX);
}

// Sentences `character` for a failed (armor-blocked) sliming attempt -- same template every other
// PvP failure (robbery, crime) already uses: crimeRecord streak escalation + alliance floor-snap.
function jailForFailedSlime(character) {
  const years = SLIME_JAIL_YEARS + character.crimeRecord.streak;
  character.crimeRecord.streak = Math.min(CRIME_STREAK_MAX, character.crimeRecord.streak + 1);
  character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
  character.jail.inJail = true;
  character.jail.crime = 'Attempted Sliming';
  character.jail.yearsRemaining = years;
  character.jail.serving = false;
  return { years, seized: applyArrestSeizure(character) };
}

function slimeCharacter(character, byName) {
  const slime = ensureSlimeState(character);
  slime.active = true;
  slime.until = Date.now() + SLIME_LOCKOUT_MS;
  slime.byName = byName;
  character.slimeRecord.push({ byName, at: Date.now() });
}

// `shooter`/`target` are the two character objects; targetUserId is only used for the cooldown key
// (same idiom as doRobPlayer). Returns which side ended up jailed/slimed (if either) as plain
// 'shooter'/'target' tags, plus duel roll info when a gunfight happened, so server.js can create
// the right notification without re-deriving any of this from the mutated characters.
function doSlimePlayer(shooter, target, targetUserId) {
  ensureSlimeState(shooter);
  ensureSlimeState(target);

  const cooldownKey = `slime_${targetUserId}`;
  const remaining = getRemainingCooldown(shooter, cooldownKey, SLIME_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `You need to wait ${Math.ceil(remaining / 1000)}s before sliming them again.` };

  const shooterSlot = equippedGunSlot(shooter);
  if (!shooterSlot) return { ok: false, reason: 'You need a gun equipped to slime someone.' };

  shooter.cooldowns[cooldownKey] = Date.now();

  const { blocked, counterslime } = checkSecumaxBlock(target, 'slime');
  if (blocked) {
    if (counterslime) slimeCharacter(shooter, `${target.firstName} ${target.lastName} (Secumax counterslime)`);
    return {
      ok: true,
      jailed: false,
      blocked: true,
      counterslime,
      message: counterslime
        ? `${target.firstName} has SecuMaximum -- your attempt was stopped AND you got countersLimed! You're locked out for 10 minutes.`
        : `${target.firstName} has Secumax protection -- your sliming attempt was stopped.`,
      cls: 'loss',
      shooter,
      target,
      duel: null,
    };
  }

  // Caught before you even get a shot off -- gun confiscated, attempt never happens.
  const shooterGunBust = checkIllegalGunBust(shooter, shooterSlot);
  if (shooterGunBust.busted) {
    return {
      ok: true,
      jailed: true,
      illegalGunBust: true,
      message: `A cop spotted your illegally carried gun before you could even fire! Confiscated, and you're sentenced to ${JAIL_YEARS_ILLEGAL_GUN} years.${arrestSeizureNote(shooterGunBust.seized)}`,
      cls: 'loss',
      shooter,
      target,
      duel: null,
    };
  }
  consumeEquippedGun(shooter);

  const targetSlot = equippedGunSlot(target);
  let targetArmed = !!targetSlot;
  let targetGunConfiscated = false;
  if (targetArmed) {
    targetGunConfiscated = checkIllegalGunBust(target, targetSlot).busted;
    if (targetGunConfiscated) {
      targetArmed = false; // confiscated mid-fight -- never gets to use it in self-defense
    } else {
      consumeEquippedGun(target);
    }
  }
  const confiscatedNote = targetGunConfiscated
    ? ` (A cop grabbed ${target.firstName}'s illegal gun mid-fight and hauled them off too!)`
    : '';

  let loserSide;
  let duel = null;

  if (targetArmed) {
    const shooterRoll = randInt(1, 20);
    const targetRoll = randInt(1, 20);
    loserSide = shooterRoll >= targetRoll ? 'target' : 'shooter';
    duel = { shooterRoll, targetRoll };
  } else {
    const hit = Math.random() < slimeShootingHitChance(shooter);
    if (!hit) {
      return {
        ok: true,
        jailed: false,
        message: `You shot at ${target.firstName} ${target.lastName} and missed! They never even noticed.${confiscatedNote}`,
        cls: 'loss',
        shooter,
        target,
        duel: null,
      };
    }
    loserSide = 'target';
  }

  const loser = loserSide === 'target' ? target : shooter;
  const winnerSide = loserSide === 'target' ? 'shooter' : 'target';
  const winner = winnerSide === 'shooter' ? shooter : target;
  const loserName = `${loser.firstName} ${loser.lastName}`;
  const winnerName = `${winner.firstName} ${winner.lastName}`;

  if (loser.equipment.armor) {
    removeFromInventory(loser, loser.equipment.armor, 1);
    loser.equipment.armor = null;
    const { years, seized } = jailForFailedSlime(winner);
    // Message is always written from the shooter's (the API caller's) point of view -- in a duel
    // the shooter can end up on either side of "who got jailed", so this can't just assume "you"
    // means the winner. The forfeiture note only shows on the branch where the caller is the one
    // who lost the cash; the other side learns about their own seizure from their own client.
    const message = winnerSide === 'shooter'
      ? `${duel ? `You won the shootout (${duel.shooterRoll} vs ${duel.targetRoll}), but` : `You shot at ${loserName}, but`} their body armor absorbed the shot! You're sentenced to ${years} year(s) for the attempt.${arrestSeizureNote(seized)}${confiscatedNote}`
      : `${loserName} shot back at you. They won the shootout (${duel.targetRoll} vs ${duel.shooterRoll}), but your body armor absorbed it! They're sentenced to ${years} year(s) for the attempt.`;
    return {
      ok: true,
      jailed: winnerSide === 'shooter',
      armorBlocked: true,
      jailedSide: winnerSide,
      duel,
      message,
      cls: winnerSide === 'shooter' ? 'loss' : 'gain',
      shooter,
      target,
    };
  }

  slimeCharacter(loser, winnerName);
  const duelNote = duel ? ` You won the shootout (${winnerSide === 'shooter' ? duel.shooterRoll : duel.targetRoll} vs ${winnerSide === 'shooter' ? duel.targetRoll : duel.shooterRoll})!` : '!';
  return {
    ok: true,
    jailed: false,
    armorBlocked: false,
    slimedSide: loserSide,
    duel,
    message: winnerSide === 'shooter'
      ? `You slimed ${loserName}${duelNote} They're locked out for 10 minutes.${confiscatedNote}`
      : `${loserName} shot back and slimed YOU${duelNote} You're locked out for 10 minutes.`,
    cls: winnerSide === 'shooter' ? 'gain' : 'loss',
    shooter,
    target,
  };
}

// ---------- Secumax ----------
// Subscription-based Rob/Enjoy/Slime shield, billed daily via a lazy tick (same idiom as every
// other passive-accrual system in this file -- charge for however many full days elapsed since
// lastBillTs, rather than a real cron). Block counts reset every time a new billing day starts.
// Per-tier limits transcribed directly from the update4 spec, not invented: Basic stops 5
// Robs + 5 Enjoys/day (no Sliming protection at all); Plus stops unlimited Rob/Enjoy + 1
// Sliming/day; Max stops everything unlimited and countersliming the attacker back.
const SECUMAX_BILL_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SECUMAX_TIERS = {
  basic: { id: 'basic', name: 'Secumax Basic', costPerDay: 10000, robLimit: 5, enjoyLimit: 5, slimeLimit: 0, counterslime: false },
  plus: { id: 'plus', name: 'Secumax Plus', costPerDay: 50000, robLimit: Infinity, enjoyLimit: Infinity, slimeLimit: 1, counterslime: false },
  max: { id: 'max', name: 'SecuMaximum', costPerDay: 90000, robLimit: Infinity, enjoyLimit: Infinity, slimeLimit: Infinity, counterslime: true },
};

function ensureSecumaxState(character) {
  if (!character.secumax) {
    character.secumax = { tier: null, lastBillTs: Date.now(), robBlocksUsed: 0, enjoyBlocksUsed: 0, slimeBlocksUsed: 0 };
  }
  return character.secumax;
}

// Charges one day's fee per full day elapsed since the last bill. Auto-cancels (tier -> null) the
// instant a due payment can't be covered rather than letting debt accrue -- "can't afford it, lose
// the perk," not a credit mechanic. Also resets the daily block counters on every new billing day,
// even if the tier itself didn't change.
function ensureSecumaxBilled(character) {
  const sec = ensureSecumaxState(character);
  if (!sec.tier || !SECUMAX_TIERS[sec.tier]) {
    sec.tier = null;
    return sec;
  }
  const tierDef = SECUMAX_TIERS[sec.tier];
  const now = Date.now();
  let daysElapsed = Math.floor((now - sec.lastBillTs) / SECUMAX_BILL_INTERVAL_MS);
  while (daysElapsed > 0) {
    if (character.cash < tierDef.costPerDay) {
      sec.tier = null;
      sec.lastBillTs = now;
      sec.robBlocksUsed = 0;
      sec.enjoyBlocksUsed = 0;
      sec.slimeBlocksUsed = 0;
      return sec;
    }
    character.cash = round2(character.cash - tierDef.costPerDay);
    sec.lastBillTs += SECUMAX_BILL_INTERVAL_MS;
    sec.robBlocksUsed = 0;
    sec.enjoyBlocksUsed = 0;
    sec.slimeBlocksUsed = 0;
    daysElapsed -= 1;
  }
  return sec;
}

// Called on the VICTIM's character before resolving a Rob/Enjoy/Slime attempt against them.
// `kind` is 'rob' | 'enjoy' | 'slime'. Returns { blocked, counterslime } -- counterslime is only
// ever true for a blocked Slime attempt at Max tier.
function checkSecumaxBlock(target, kind) {
  const sec = ensureSecumaxBilled(target);
  if (!sec.tier) return { blocked: false, counterslime: false };
  const tierDef = SECUMAX_TIERS[sec.tier];
  const limitKey = `${kind}Limit`;
  const usedKey = `${kind}BlocksUsed`;
  if (sec[usedKey] >= tierDef[limitKey]) return { blocked: false, counterslime: false };
  sec[usedKey] += 1;
  return { blocked: true, counterslime: kind === 'slime' && tierDef.counterslime };
}

// ---------- Variety & Enjoying ----------
// Variety is a 0-100 subtrait (0 = never enjoyed/chilled, 100 = maxed out) with a 4-tier debuff
// ladder, per the update4 spec's "Dangers of Variety" table -- transcribed directly, not invented.
const VARIETY_TIERS = [
  { min: 100, jobDebuffPct: 1.00, timeoutMs: 24 * 60 * 60 * 1000 },
  { min: 75, jobDebuffPct: 0.90, blockCosmetics: true },
  { min: 50, jobDebuffPct: 0.50, forceDirtyBad: true },
  { min: 20, jobDebuffPct: 0.20, autoFired: true },
];
const ENJOY_VICTIM_VARIETY_GAIN = 20;
const ENJOY_ATTACKER_VARIETY_GAIN = 5;
const CHILL_VARIETY_GAIN = 1;
const VARIETY_RENOUNCE_COST = 5000; // reuses Morals Center's stance-change price for consistency
const VARIETY_RENOUNCE_AMOUNT = 25;

function ensureVarietyState(character) {
  if (typeof character.variety !== 'number') character.variety = 0;
  if (!character.varietyTimeout) character.varietyTimeout = { until: 0 };
  if (!character.enjoyed) character.enjoyed = { active: false, until: 0, byName: null };
  return character.variety;
}

// The per-attempt 1-minute victim lockout ("the same timeout screen as Sliming, but for just 1
// minute") -- distinct from varietyTimeout, which is the 24-hour consequence of hitting 100%
// Variety. Same {active, until, byName} shape as character.slime for easy client-side reuse.
function isEnjoyed(character) {
  ensureVarietyState(character);
  return character.enjoyed.active && Date.now() < character.enjoyed.until;
}

const ENJOY_LOCKOUT_MS = 60 * 1000;

function varietyTierFor(variety) {
  return VARIETY_TIERS.find((t) => variety >= t.min) || null;
}

// Multiplies job pay -- Slut is exempt per spec ("except Slut"), so callers must skip this for
// the Slut hustle specifically.
function varietyPayMultiplier(character) {
  ensureVarietyState(character);
  const tier = varietyTierFor(character.variety);
  return tier ? 1 - tier.jobDebuffPct : 1;
}

function isVarietyAutoFired(character) {
  ensureVarietyState(character);
  const tier = varietyTierFor(character.variety);
  return !!(tier && tier.autoFired);
}

function isVarietyCosmeticsBlocked(character) {
  ensureVarietyState(character);
  const tier = varietyTierFor(character.variety);
  return !!(tier && tier.blockCosmetics);
}

function isVarietyForcedDirtyBad(character) {
  ensureVarietyState(character);
  const tier = varietyTierFor(character.variety);
  return !!(tier && tier.forceDirtyBad);
}

function isVarietyTimedOut(character) {
  ensureVarietyState(character);
  return character.varietyTimeout.until > Date.now();
}

// Raises variety and, on crossing into the 100% tier, starts the 1-day timeout and auto-fires from
// any current job (20%+ tier already blocks working, but this makes the state change immediate
// rather than waiting for the next job-action attempt to notice).
function addVariety(character, amount) {
  ensureVarietyState(character);
  character.variety = Math.max(0, Math.min(100, character.variety + amount));
  const tier = varietyTierFor(character.variety);
  if (tier && tier.timeoutMs) {
    character.varietyTimeout.until = Date.now() + tier.timeoutMs;
  }
  if (tier && tier.autoFired) {
    character.jobs.currentJob = null;
    character.badJobs.currentJob = null;
  }
}

const ENJOY_COOLDOWN_MS = 5 * 60 * 1000;

// Success chance is the attacker's (Looks + Attack) average vs. the target's Defense, same
// clamped-linear shape doRobPlayer's winChance already uses -- the update4 spec only says "based
// on your Looks and Attack," so the target's Defense as the resisting stat (rather than an
// unopposed roll) is this file's own call, made for consistency with every other PvP formula here.
function doEnjoyPlayer(attacker, target, targetUserId) {
  ensureVarietyState(attacker);
  ensureVarietyState(target);

  const cooldownKey = `enjoy_${targetUserId}`;
  const remaining = getRemainingCooldown(attacker, cooldownKey, ENJOY_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `You need to wait ${Math.ceil(remaining / 1000)}s before trying that again.` };
  if (isVarietyTimedOut(target)) return { ok: false, reason: `${target.firstName} is already in Variety timeout.` };
  if (isEnjoyed(target)) return { ok: false, reason: `${target.firstName} is already enjoyed.` };

  attacker.cooldowns[cooldownKey] = Date.now();

  const { blocked, counterslime } = checkSecumaxBlock(target, 'enjoy');
  if (blocked) {
    return {
      ok: true,
      blocked: true,
      counterslime,
      message: `${target.firstName} has Secumax protection -- your attempt was stopped.`,
      cls: 'loss',
      attacker,
      target,
    };
  }

  const attackerScore = (Math.min(attacker.stats.looks, STAT_CAP) + Math.min(attacker.stats.attack, STAT_CAP)) / 2;
  const enjoyChance = Math.max(0.15, Math.min(0.85, 0.5 + (attackerScore - target.stats.defense) * 0.015));
  if (Math.random() >= enjoyChance) {
    return { ok: true, blocked: false, success: false, message: `${target.firstName} fought you off. No dice.`, cls: 'loss', attacker, target };
  }

  addVariety(target, ENJOY_VICTIM_VARIETY_GAIN);
  addVariety(attacker, ENJOY_ATTACKER_VARIETY_GAIN);
  target.enjoyed = { active: true, until: Date.now() + ENJOY_LOCKOUT_MS, byName: `${attacker.firstName} ${attacker.lastName}` };

  return {
    ok: true,
    blocked: false,
    success: true,
    message: `You enjoyed ${target.firstName} ${target.lastName}! They're locked out for 1 minute.`,
    chatAnnouncement: `I'm ${target.firstName} ${target.lastName} and I just got enjoyed by ${attacker.firstName} ${attacker.lastName}, I couldn't do a THING!`,
    cls: 'gain',
    attacker,
    target,
  };
}

// Costs a flat fee and knocks a flat amount off Variety -- exact price/amount are this file's own
// call (the update4 spec only says "renounce Variety... to bring your percentage back down"),
// reusing Morals Center's $5,000 stance-change price for a consistent "meaningful but not
// prohibitive" feel rather than inventing a new number.
function renounceVariety(character) {
  ensureVarietyState(character);
  if (character.variety <= 0) return { ok: false, reason: "You don't have any Variety to renounce." };
  if (character.cash < VARIETY_RENOUNCE_COST) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - VARIETY_RENOUNCE_COST);
  character.variety = Math.max(0, character.variety - VARIETY_RENOUNCE_AMOUNT);
  return { ok: true, message: `Renounced Variety. Now at ${character.variety}%.`, cls: 'gain' };
}

// Minimal version of the client's getItemDef() -- only the fields Combat needs (atkBonus,
// statBonuses), so only the item tables that carry those.
function combatItemDef(itemId) {
  return GUN_ITEMS_BY_ID[itemId] || MELEE_ITEMS_BY_ID[itemId] || WRESTLING_GEAR_ITEMS_BY_ID[itemId] || ARMOR_ITEMS_BY_ID[itemId] || null;
}

function pickOpponentPool(character) {
  if (character.alliance <= COMBAT_GOOD_MAX_ALLIANCE) return ['gangster', 'thug', 'gangbanger', 'goon'];
  if (character.alliance >= GUZMAN_MIN_ALLIANCE) return ['citizen', 'cop', 'vagabond', 'miscreant'];
  return ['citizen', 'cop', 'thug', 'gangster', 'goon', 'gangbanger', 'vagabond', 'miscreant'];
}

const GOOD_FIGHT_NPC_KEYS = new Set(['gangster', 'thug', 'gangbanger', 'goon']);

function heightHpBonus(character) {
  return Math.round(Math.max(0, character.height - 65) * 0.4);
}

function heightAtkBonus(character) {
  return Math.round(Math.max(0, character.height - 65) * 0.05 * 10) / 10;
}

function equippedWeaponAtkBonus(character) {
  const ids = [character.equipment.holsterL, character.equipment.holsterR, character.equipment.openCarry, character.equipment.melee].filter(Boolean);
  return ids.reduce((sum, id) => {
    const item = combatItemDef(id);
    return sum + (item && item.atkBonus ? item.atkBonus : 0);
  }, 0);
}

function gearStatBonus(character, stat) {
  const ids = [character.equipment.helmet, character.equipment.chest, character.equipment.pants, character.equipment.feet, character.equipment.armor].filter(Boolean);
  return ids.reduce((sum, id) => {
    const item = combatItemDef(id);
    return sum + (item && item.statBonuses && item.statBonuses[stat] ? item.statBonuses[stat] : 0);
  }, 0);
}

function baseCombatAttack(character) {
  return character.stats.attack + heightAtkBonus(character) + gearStatBonus(character, 'attack');
}

function combatDefense(character) {
  return character.stats.defense + gearStatBonus(character, 'defense');
}

function speedDodgeChance(character) {
  const effectiveSpeed = character.stats.speed + gearStatBonus(character, 'speed');
  return Math.min(0.45, (effectiveSpeed / 100) * 0.35);
}

// Mirrors the client's doStartFight() exactly.
function doStartFight(character) {
  const combat = ensureCombatState(character);
  if (combat.active) return { ok: false, reason: 'Already in a fight.' };
  const remaining = getRemainingCooldown(character, 'combat', COMBAT_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  const pool = pickOpponentPool(character);
  const key = Math.random() < MILOS_BOSS_CHANCE ? 'milos' : pool[randInt(0, pool.length - 1)];
  const npc = NPC_TYPES[key];
  const maxHp = character.stats.health + heightHpBonus(character) + gearStatBonus(character, 'health');
  character.combat = {
    active: true,
    enemyKey: key,
    enemyHp: npc.hp,
    enemyMaxHp: npc.hp,
    playerHp: maxHp,
    playerMaxHp: maxHp,
    turn: 'player',
    guarding: false,
  };
  return { ok: true, message: `A ${npc.name} steps out of the shadows.`, cls: '', character };
}

// Mirrors the client's doPlayerAction() exactly.
function doPlayerAction(character, action) {
  const combat = character.combat;
  const npc = NPC_TYPES[combat.enemyKey];
  const base = baseCombatAttack(character);
  const weaponBonus = equippedWeaponAtkBonus(character);

  if (action === 'guard') {
    combat.guarding = true;
    if (Math.random() < GUARD_RIPOSTE_CHANCE) {
      const dmg = Math.max(1, Math.round(base * 0.5 - npc.defense * 0.4 + randInt(-2, 2)));
      combat.enemyHp = Math.max(0, combat.enemyHp - dmg);
      return { action, npc, dmg, missed: false, riposted: true, enemyDefeated: combat.enemyHp <= 0 };
    }
    return { action, npc, dmg: 0, missed: false, riposted: false, enemyDefeated: false };
  }

  if (action === 'heavy') {
    if (Math.random() < HEAVY_STRIKE_MISS_CHANCE) {
      return { action, npc, dmg: 0, missed: true, riposted: false, enemyDefeated: false };
    }
    const dmg = Math.max(1, Math.round(base * HEAVY_STRIKE_MULT + weaponBonus * 0.5 - npc.defense * 0.4 + randInt(-3, 3)));
    combat.enemyHp = Math.max(0, combat.enemyHp - dmg);
    return { action, npc, dmg, missed: false, riposted: false, enemyDefeated: combat.enemyHp <= 0 };
  }

  if (action === 'weapon') {
    if (weaponBonus <= 0) return { action, npc, dmg: 0, missed: true, riposted: false, enemyDefeated: false };
    if (Math.random() < WEAPON_ATTACK_JAM_CHANCE) {
      return { action, npc, dmg: 0, missed: true, riposted: false, jammed: true, enemyDefeated: false };
    }
    const dmg = Math.max(1, Math.round(base + weaponBonus * WEAPON_ATTACK_MULT - npc.defense * 0.4 + randInt(-3, 3)));
    combat.enemyHp = Math.max(0, combat.enemyHp - dmg);
    return { action, npc, dmg, missed: false, riposted: false, enemyDefeated: combat.enemyHp <= 0 };
  }

  // punch: reliable, no miss chance, modest weapon assist
  const dmg = Math.max(1, Math.round(base + weaponBonus * 0.5 - npc.defense * 0.4 + randInt(-3, 3)));
  combat.enemyHp = Math.max(0, combat.enemyHp - dmg);
  return { action, npc, dmg, missed: false, riposted: false, enemyDefeated: combat.enemyHp <= 0 };
}

// Mirrors the client's doEnemyAttack() exactly.
function doEnemyAttack(character) {
  const combat = character.combat;
  const npc = NPC_TYPES[combat.enemyKey];
  const wasGuarding = combat.guarding;
  combat.guarding = false;

  if (Math.random() < speedDodgeChance(character)) {
    return { dmg: 0, npc, dodged: true, guarded: false, playerDefeated: false };
  }
  let dmg = Math.max(1, Math.round(npc.attack - combatDefense(character) * 0.4 + randInt(-3, 3)));
  if (wasGuarding) dmg = Math.max(0, Math.round(dmg * (1 - GUARD_DAMAGE_REDUCTION)));
  combat.playerHp = Math.max(0, combat.playerHp - dmg);
  return { dmg, npc, dodged: false, guarded: wasGuarding, playerDefeated: combat.playerHp <= 0 };
}

// Mirrors the client's doWinCombat() exactly, including the Riotlandia 2x reward bonus.
function doWinCombat(character, npc, activeModifier) {
  const reward = randInt(npc.minReward, npc.maxReward) * (activeModifier === 'riot' ? 2 : 1);
  character.cash += reward;
  const wasGoodFight = GOOD_FIGHT_NPC_KEYS.has(character.combat.enemyKey);
  character.alliance = clampStat(wasGoodFight ? character.alliance - ALLIANCE_BUFF : character.alliance + ALLIANCE_DEBUFF);
  character.combat.active = false;
  character.combat.turn = null;
  character.cooldowns.combat = Date.now();

  let statGain = null;
  if (Math.random() < COMBAT_STAT_GAIN_CHANCE) {
    const stat = Math.random() < 0.5 ? 'attack' : 'health';
    const amount = round2(randFloat(COMBAT_STAT_GAIN_MIN, COMBAT_STAT_GAIN_MAX));
    character.stats[stat] = clampStat(character.stats[stat] + amount);
    statGain = { stat, amount };
  }
  return { reward, statGain };
}

// Mirrors the client's doLoseCombat() exactly.
function doLoseCombat(character) {
  const toughness = Math.min(0.5, character.stats.health / 200);
  const lost = Math.min(character.cash, Math.round(randInt(10, 40) * (1 - toughness)));
  character.cash -= lost;
  character.combat.active = false;
  character.combat.turn = null;
  character.cooldowns.combat = Date.now();
  return { lost };
}

// Combines the client's handleCombatAction() + enemyTurn() into one round trip: the client used
// a setTimeout to pace the "enemy's turn" reveal, but that was just a UI delay -- the underlying
// logic already ran immediately, so resolving both here loses nothing and avoids a second
// network round trip (and a window where the fight state could be raced) per player action.
function doCombatAction(character, action, activeModifier) {
  const combat = ensureCombatState(character);
  if (!combat.active || combat.turn !== 'player') return { ok: false, reason: 'No fight in progress.' };
  if (!['punch', 'heavy', 'guard', 'weapon'].includes(action)) return { ok: false, reason: 'Unknown action.' };

  const playerResult = doPlayerAction(character, action);

  if (playerResult.enemyDefeated) {
    const winResult = doWinCombat(character, playerResult.npc, activeModifier);
    return { ok: true, playerResult, resolved: 'won', winResult, character };
  }

  combat.turn = 'enemy';
  const enemyResult = doEnemyAttack(character);

  if (enemyResult.playerDefeated) {
    const loseResult = doLoseCombat(character);
    return { ok: true, playerResult, enemyResult, resolved: 'lost', loseResult, character };
  }

  combat.turn = 'player';
  return { ok: true, playerResult, enemyResult, resolved: 'continue', character };
}

// Mirrors the client's doFlee() exactly.
function doFlee(character) {
  const combat = ensureCombatState(character);
  if (!combat.active) return { ok: false, reason: 'No fight in progress.' };
  combat.active = false;
  combat.turn = null;
  character.cooldowns.combat = Date.now();
  return { ok: true, character };
}

// ---------- PvP duels ----------
// Reuses the same combat math as PvE (baseCombatAttack/combatDefense/equippedWeaponAtkBonus/
// speedDodgeChance and the same hit-chance constants), but against a real opponent character
// instead of an NPC entry, and against a `duels` row's hp/guarding fields instead of
// character.combat -- duel state has to outlive a single request since turns alternate between
// two separate players' requests.
const DUEL_CASH_REWARD_MIN = 50;
const DUEL_CASH_REWARD_MAX = 150;

function initDuelCombatants(attackerCharacter, targetCharacter) {
  const attackerMaxHp = attackerCharacter.stats.health + heightHpBonus(attackerCharacter) + gearStatBonus(attackerCharacter, 'health');
  const targetMaxHp = targetCharacter.stats.health + heightHpBonus(targetCharacter) + gearStatBonus(targetCharacter, 'health');
  return {
    attackerHp: attackerMaxHp,
    attackerMaxHp,
    targetHp: targetMaxHp,
    targetMaxHp,
  };
}

// `state` is a plain object with attackerHp/targetHp/attackerGuarding/targetGuarding -- the
// caller is responsible for loading it from (and persisting it back to) the duels row.
function resolveDuelTurn(state, actor, opponent, actorSide, action) {
  if (!['punch', 'heavy', 'guard', 'weapon'].includes(action)) return { ok: false, reason: 'Unknown action.' };

  const opponentSide = actorSide === 'attacker' ? 'target' : 'attacker';
  const actorGuardKey = actorSide === 'attacker' ? 'attackerGuarding' : 'targetGuarding';
  const opponentGuardKey = opponentSide === 'attacker' ? 'attackerGuarding' : 'targetGuarding';
  const opponentHpKey = opponentSide === 'attacker' ? 'attackerHp' : 'targetHp';

  if (action === 'guard') {
    state[actorGuardKey] = true;
    if (Math.random() < GUARD_RIPOSTE_CHANCE) {
      const base = baseCombatAttack(actor);
      const dmg = Math.max(1, Math.round(base * 0.5 - combatDefense(opponent) * 0.4 + randInt(-2, 2)));
      state[opponentHpKey] = Math.max(0, state[opponentHpKey] - dmg);
      return { ok: true, action, dmg, missed: false, riposted: true, opponentDefeated: state[opponentHpKey] <= 0 };
    }
    return { ok: true, action, dmg: 0, missed: false, riposted: false, opponentDefeated: false };
  }

  // The defender's speed lets them dodge outright, mirroring the PvE model's chance for the
  // player to dodge the enemy's attack -- here both sides get that chance on defense.
  if (Math.random() < speedDodgeChance(opponent)) {
    return { ok: true, action, dmg: 0, missed: false, dodged: true, opponentDefeated: false };
  }

  const base = baseCombatAttack(actor);
  const weaponBonus = equippedWeaponAtkBonus(actor);
  let dmg;
  if (action === 'heavy') {
    if (Math.random() < HEAVY_STRIKE_MISS_CHANCE) return { ok: true, action, dmg: 0, missed: true, opponentDefeated: false };
    dmg = Math.max(1, Math.round(base * HEAVY_STRIKE_MULT + weaponBonus * 0.5 - combatDefense(opponent) * 0.4 + randInt(-3, 3)));
  } else if (action === 'weapon') {
    if (weaponBonus <= 0) return { ok: true, action, dmg: 0, missed: true, opponentDefeated: false };
    if (Math.random() < WEAPON_ATTACK_JAM_CHANCE) return { ok: true, action, dmg: 0, missed: true, jammed: true, opponentDefeated: false };
    dmg = Math.max(1, Math.round(base + weaponBonus * WEAPON_ATTACK_MULT - combatDefense(opponent) * 0.4 + randInt(-3, 3)));
  } else {
    dmg = Math.max(1, Math.round(base + weaponBonus * 0.5 - combatDefense(opponent) * 0.4 + randInt(-3, 3)));
  }

  if (state[opponentGuardKey]) {
    dmg = Math.max(0, Math.round(dmg * (1 - GUARD_DAMAGE_REDUCTION)));
    state[opponentGuardKey] = false;
  }

  state[opponentHpKey] = Math.max(0, state[opponentHpKey] - dmg);
  return { ok: true, action, dmg, missed: false, opponentDefeated: state[opponentHpKey] <= 0 };
}

// Body Armor is a one-duel consumable regardless of outcome -- worn into the fight, worn out by
// the end of it either way. Unequips it and burns one unit from inventory.
function consumeArmorIfEquipped(character) {
  const armorId = character.equipment.armor;
  if (!armorId) return;
  character.equipment.armor = null;
  removeFromInventory(character, armorId, 1);
}

// Applies the flat cash prize from loser to winner once a duel ends, whether by knockout or
// forfeit -- mutates both character objects, caller saves them.
function applyDuelOutcome(winnerCharacter, loserCharacter) {
  const reward = Math.min(loserCharacter.cash, randInt(DUEL_CASH_REWARD_MIN, DUEL_CASH_REWARD_MAX));
  loserCharacter.cash = round2(loserCharacter.cash - reward);
  winnerCharacter.cash = round2(winnerCharacter.cash + reward);
  consumeArmorIfEquipped(winnerCharacter);
  consumeArmorIfEquipped(loserCharacter);
  return reward;
}

// Mirrors the client's crimeFailChance() exactly.
function crimeFailChance(character, tier) {
  const statScore = (character.stats.speed + character.stats.attack) / 200;
  const reduction = Math.min(CRIME_STAT_MITIGATION, statScore * CRIME_STAT_MITIGATION);
  return Math.max(CRIME_RISK_MIN, tier.baseRisk - reduction);
}

// Mirrors the client's doAttemptCrime() exactly, with cooldown enforcement added server-side
// (same gap as the other tiered-hustle actions -- the client only disabled the button).
function doAttemptCrime(character, tierId) {
  const tier = CRIME_TIERS_BY_ID[tierId];
  if (!tier) return { ok: false, reason: 'Unknown crime.' };
  const cooldownKey = `crime_${tier.id}`;
  const remaining = getRemainingCooldown(character, cooldownKey, CRIME_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  character.cooldowns[cooldownKey] = Date.now();
  const risk = crimeFailChance(character, tier);
  if (Math.random() < risk) {
    const years = tier.jailYears + character.crimeRecord.streak;
    character.crimeRecord.streak = Math.min(CRIME_STREAK_MAX, character.crimeRecord.streak + 1);
    character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
    character.jail.inJail = true;
    character.jail.crime = tier.name;
    character.jail.yearsRemaining = years;
    character.jail.serving = false;
    const seized = applyArrestSeizure(character);
    const streakNote = years > tier.jailYears ? ` (${tier.jailYears} base + ${years - tier.jailYears} repeat-offender)` : '';
    return { ok: true, jailed: true, message: `Busted committing ${tier.name}! Sentenced to ${years} year(s)${streakNote}.${arrestSeizureNote(seized)}`, cls: 'loss', character };
  }

  const gain = round2(randFloat(tier.minReward, tier.maxReward));
  character.cash = round2(character.cash + gain);
  character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF);
  return { ok: true, jailed: false, message: `Pulled off ${tier.name}: +$${gain.toFixed(2)}.`, cls: 'gain', character };
}

// Mirrors the client's doCommunityService() exactly.
function doCommunityService(character) {
  const remaining = getRemainingCooldown(character, 'communityService', COMMUNITY_SERVICE_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  if (character.crimeRecord.streak <= 0) return { ok: false, reason: 'Your record is already clean.' };
  const cost = communityServiceCost(character.crimeRecord.streak);
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - cost);
  character.crimeRecord.streak = Math.max(0, character.crimeRecord.streak - COMMUNITY_SERVICE_STREAK_REDUCTION);
  character.cooldowns.communityService = Date.now();
  return { ok: true, message: `Completed community service for $${cost.toLocaleString()}. Your criminal record improved.`, cls: 'gain', character };
}

// Mirrors the client's doHireLawyer() + releaseFromJail() exactly -- pays to skip the rest of the
// sentence and clears jail state in one step (the client did this as two separate calls, but
// there's no reason a bought release should ever fail after payment succeeds).
function doHireLawyer(character) {
  if (!character.jail.inJail) return { ok: false, reason: 'You are not in jail.' };
  const cost = character.jail.yearsRemaining * 150;
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks to hire a lawyer.' };
  character.cash -= cost;
  character.jail.inJail = false;
  character.jail.crime = null;
  character.jail.yearsRemaining = 0;
  character.jail.serving = false;
  return { ok: true, character };
}

// Mirrors the client's doJailWorkout() exactly.
function doJailWorkout(character) {
  const remaining = getRemainingCooldown(character, 'jailWorkout', JAIL_WORKOUT_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  character.cooldowns.jailWorkout = Date.now();
  const atkGain = round2(randFloat(JAIL_WORKOUT_ATK_GAIN_MIN, JAIL_WORKOUT_ATK_GAIN_MAX));
  const defGain = round2(randFloat(JAIL_WORKOUT_DEF_GAIN_MIN, JAIL_WORKOUT_DEF_GAIN_MAX));
  character.stats.attack = clampStat(character.stats.attack + atkGain);
  character.stats.defense = clampStat(character.stats.defense + defGain);
  return { ok: true, message: `Yard workout: +${atkGain.toFixed(2)} Attack, +${defGain.toFixed(2)} Defense.`, cls: 'gain', character };
}

// Mirrors the client's doJailFight() exactly.
function doJailFight(character) {
  const remaining = getRemainingCooldown(character, 'jailFight', JAIL_FIGHT_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  character.cooldowns.jailFight = Date.now();
  const contrabandBonus = character.jail.contrabandAtkBonus || 0;
  const myPower = character.stats.attack + character.stats.defense + gearStatBonus(character, 'attack') + gearStatBonus(character, 'defense') + contrabandBonus;
  const inmatePower = 20;
  const winChance = Math.max(0.2, Math.min(0.85, 0.5 + (myPower - inmatePower) * 0.01));
  // A smuggled weapon is a one-time edge on your very next fight, then it's used up -- same spirit
  // as consuming an item, not a permanent equip.
  character.jail.contrabandAtkBonus = 0;
  const bonusNote = contrabandBonus > 0 ? ` (used your smuggled weapon: +${contrabandBonus} Attack)` : '';

  if (Math.random() < winChance) {
    const stat = Math.random() < 0.5 ? 'attack' : 'defense';
    const amount = stat === 'attack'
      ? round2(randFloat(JAIL_FIGHT_ATK_GAIN_MIN, JAIL_FIGHT_ATK_GAIN_MAX))
      : round2(randFloat(JAIL_FIGHT_DEF_GAIN_MIN, JAIL_FIGHT_DEF_GAIN_MAX));
    character.stats[stat] = clampStat(character.stats[stat] + amount);
    const label = stat === 'attack' ? 'Attack' : 'Defense';
    return { ok: true, won: true, message: `You won the yard fight! +${amount.toFixed(2)} ${label}${bonusNote}.`, cls: 'gain', character };
  }
  const lost = Math.min(character.cash, randInt(JAIL_FIGHT_LOSS_MIN, JAIL_FIGHT_LOSS_MAX));
  character.cash -= lost;
  return { ok: true, won: false, message: `You lost the yard fight and got shaken down for $${lost}${bonusNote}.`, cls: 'loss', character };
}

function jailContrabandItemDef(itemId) {
  return MELEE_ITEMS_BY_ID[itemId] || DRUG_ITEMS_BY_ID[itemId] || null;
}

// Melee contraband now grants a real, jail-exclusive edge (a one-time Attack bonus consumed on
// your next Yard Fight, see doJailFight) instead of just sitting in inventory until release, which
// is when the same item could always be bought cheaper anyway. Drug contraband stays a "have it
// ready to sell the moment you're out" convenience buy -- the lower markup (see JAIL_CONTRABAND_MARKUP)
// makes that a small-but-real time-saver instead of a straight loss.
function doBuyContraband(character, itemId) {
  const item = jailContrabandItemDef(itemId);
  if (!item) return { ok: false, reason: 'Unknown item.' };
  const cost = round2((item.cost !== undefined ? item.cost : item.wholesaleCost) * JAIL_CONTRABAND_MARKUP);
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - cost);

  if (item.type === 'melee') {
    character.jail.contrabandAtkBonus = (character.jail.contrabandAtkBonus || 0) + item.atkBonus;
    return { ok: true, message: `Smuggled in ${item.name} for $${cost.toFixed(2)} -- +${item.atkBonus} Attack on your next Yard Fight.`, cls: 'gain', character };
  }

  addToInventory(character, item.id, 1);
  return { ok: true, message: `Smuggled in ${item.name} for $${cost.toFixed(2)}.`, cls: 'gain', character };
}

// Mirrors the client's doCityHallRename() exactly.
function doCityHallRename(character, first, last) {
  if (!first || !last) return { ok: false, reason: 'Enter both a first and last name.' };
  if (first.length > 10 || last.length > 10) return { ok: false, reason: 'Names must be 10 characters or fewer.' };
  if (character.cash < RENAME_COST) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash -= RENAME_COST;
  character.firstName = first;
  character.lastName = last;
  return { ok: true, message: `Name legally changed to ${first} ${last}.`, cls: 'gain', character };
}

// Mirrors the client's doGunSafetyResult() exactly. The quiz question bank (with answers) still
// ships to the client either way, so grading server-side wouldn't add real security here -- this
// just records the outcome once the client tells us the player passed or failed.
function doGunSafetyResult(character, passed) {
  if (passed) {
    character.licenses.gunSafety = true;
    return { ok: true, message: 'Gun Safety Course passed! License granted.', cls: 'gain', character };
  }
  return { ok: true, message: 'Gun Safety Course failed. You can try again anytime.', cls: 'loss', character };
}

// Mirrors the client's doRangeShoot() exactly.
function doRangeShoot(character, weaponId) {
  const remaining = getRemainingCooldown(character, 'rangeShoot', RANGE_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  const item = combatItemDef(weaponId);
  const weaponName = item ? item.name : 'weapon';
  const score = Math.round((Math.random() * 0.09 + 0.01) * 100) / 100;
  character.weaponSkills.shooting = clampStat(character.weaponSkills.shooting + score);
  character.cooldowns.rangeShoot = Date.now();
  const flavor = score >= 0.09 ? 'Bullseye!' : score >= 0.05 ? 'Solid hit.' : 'Grazed it.';
  return { ok: true, message: `Fired the ${weaponName}: +${score.toFixed(2)} SHOOTING. ${flavor}`, cls: 'gain', character };
}

// Mirrors the client's doRangeDraw() exactly.
function doRangeDraw(character) {
  const remaining = getRemainingCooldown(character, 'rangeDraw', RANGE_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  character.weaponSkills.draw = clampStat(character.weaponSkills.draw + 0.01);
  character.cooldowns.rangeDraw = Date.now();
  return { ok: true, message: '+0.01 DRAW.', cls: 'gain', character };
}

// Mirrors the client's doRangeReload() exactly.
function doRangeReload(character) {
  const remaining = getRemainingCooldown(character, 'rangeReload', RANGE_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  character.weaponSkills.magReload = clampStat(character.weaponSkills.magReload + 0.01);
  character.cooldowns.rangeReload = Date.now();
  return { ok: true, message: '+0.01 MAG RELOAD.', cls: 'gain', character };
}

// Minimal version of the client's getItemDef() -- covers the item tables that exist server-side.
// Titles aren't ported (their catalog is large and purely cosmetic), so a listed/sold title just
// falls back to showing its raw id -- the client already resolves the real name for display.
function mtnItemName(itemId) {
  const item = GUN_ITEMS_BY_ID[itemId] || MELEE_ITEMS_BY_ID[itemId] || AMMO_ITEMS_BY_ID[itemId]
    || DRUG_ITEMS_BY_ID[itemId] || WRESTLING_GEAR_ITEMS_BY_ID[itemId];
  return item ? item.name : itemId;
}

// Mirrors the client's doCreateListing() exactly, minus the DB write (the caller in server.js
// handles inserting the shared mtn_listings row, since that table lives outside any one
// character's document).
function doCreateListing(character, itemId, qty, pricePerUnit) {
  if (!itemId || !(qty > 0) || !(pricePerUnit > 0)) return { ok: false, reason: 'Enter a valid item, quantity, and price.' };
  if (inventoryQty(character, itemId) < qty) return { ok: false, reason: "You don't have that many to list." };

  removeFromInventory(character, itemId, qty);
  character.mtnHistory.push({ type: 'listed', itemId, qty, totalPrice: round2(pricePerUnit * qty), ts: Date.now(), counterpartyName: null });
  return { ok: true, message: `Listed ${qty}x ${mtnItemName(itemId)} for $${(pricePerUnit * qty).toFixed(2)}.`, cls: 'gain', character };
}

// Mirrors the client's doCancelListing() exactly, minus the DB delete (handled by the caller).
function doCancelListing(character, itemId, qty) {
  addToInventory(character, itemId, qty);
  character.mtnHistory.push({ type: 'cancelled', itemId, qty, totalPrice: 0, ts: Date.now(), counterpartyName: null });
  return { ok: true, message: `Cancelled listing: ${qty}x ${mtnItemName(itemId)} returned to your Inventory.`, cls: '', character };
}

// Mirrors the client's doBuyListing() exactly, minus the DB delete (handled by the caller) and
// the seller credit (now a real other account -- see creditSellerForSale below -- instead of the
// single-player "buying your own listing nets back to zero" special case).
function doBuyListing(character, itemId, qty, total, sellerName) {
  if (character.cash < total) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - total);
  addToInventory(character, itemId, qty);
  character.mtnHistory.push({ type: 'bought', itemId, qty, totalPrice: total, ts: Date.now(), counterpartyName: sellerName });
  return { ok: true, message: `Bought ${qty}x ${mtnItemName(itemId)} for $${total.toFixed(2)}.`, cls: 'gain', character };
}

// Credits the seller's own character once a real buyer (not the seller re-buying their own
// listing) completes a purchase -- new behavior the single-player version never needed, since it
// only ever had one save file to test against.
function creditSellerForSale(sellerCharacter, itemId, qty, total, buyerName) {
  sellerCharacter.cash = round2(sellerCharacter.cash + total);
  sellerCharacter.mtnHistory.push({ type: 'sold', itemId, qty, totalPrice: total, ts: Date.now(), counterpartyName: buyerName });
}

// ---------- Drugs & Rugs: Milos Outlook Farms ----------
// Unlocks once you've cleared Guzman and unlocked Esteban (i.e. sold enough weed to hit the new
// 10x'd unlock threshold below) -- "clear a drug dealer" per the design doc.
const FARM_UNLOCK_UNITS_SOLD = 400;
const FARM_PLOT_COST = 50000;
const FARM_PREP_COST = 1200; // till + water + fertilizer, bundled into one action
const FARM_SEED_COST_BY_DRUG = { drugWeed: 150, drugCoke: 1200 };
const FARM_GROW_MS = 60 * 60 * 1000;
const FARM_PACKAGE_MS = 5 * 60 * 1000;
const FARM_SHIP_MS = 60 * 60 * 1000;
const FARM_MAX_QTY = 4; // packages planted per grow cycle -- seed cost and harvest yield both scale with it
const FARM_CONFISCATION_BASE = 0.30;
const FARM_CONFISCATION_FLOOR = 0.05;
const FARM_SECURITY_MAX_TIER = 5; // each tier -5%, hits the floor at tier 5
const FARM_SECURITY_TIER_COST = 10000; // flat per tier, scales with tier number below
// Recommended-but-unconfirmed by the project owner: cap plots at 1 per player so Farms doesn't
// outpace the rest of the intentional economy slowdown. Flag before raising this.
const FARM_MAX_PLOTS = 1;

// A harvested "package" is a BRICK, not a single street unit. Before this, a harvest granted
// plot.qty raw drug units, which made farming strictly worse than doing nothing: a max weed run
// cost $1,800 (prep $1,200 + 4 seeds x $150) and yielded 4 units worth ~$144. Each package now
// grants this many units.
//
// EV at max security (5% confiscation), using the midpoint street price and no Looks bonus:
//   Weed  4 packages x 20 units x $36 avg = $2,880 gross; 0.95 x 2,880 - $1,800 = ~+$936
//   Coke  4 packages x 12 units x $243 avg = $11,664 gross; 0.95 x 11,664 - $6,000 = ~+$5,080
// At the unimproved 30% confiscation rate coke still nets ~+$2,165, so security upgrades are worth
// buying without being mandatory. Coke was raised from the originally specced 8 units because 8
// landed the max run at only ~+$1,400 EV, below the $3-6k target for an endgame system whose plot
// alone costs $50,000. Note these are GROSS street values -- doSellDrugs' own per-quantity bust
// risk still applies when the player actually offloads the bricks.
const FARM_PACKAGE_UNITS_BY_DRUG = { drugWeed: 20, drugCoke: 12 };
const FARM_PACKAGE_UNITS_DEFAULT = 10;

function farmPackageUnits(drugId) {
  return FARM_PACKAGE_UNITS_BY_DRUG[drugId] || FARM_PACKAGE_UNITS_DEFAULT;
}

function ensureFarmsState(character) {
  if (!character.farms) character.farms = { plots: [], securityTier: 0 };
  if (character.farms.securityTier === undefined) character.farms.securityTier = 0;
  return character.farms;
}

function farmConfiscationChance(securityTier) {
  return Math.max(FARM_CONFISCATION_FLOOR, FARM_CONFISCATION_BASE - securityTier * 0.05);
}

// Lazily advances a plot's grow/package/ship timers based on wall-clock elapsed time -- called at
// the top of every farm action instead of running a real background job, same "compute on read"
// approach the rest of this codebase uses for anything time-based.
function advanceFarmPlot(plot) {
  const now = Date.now();
  if (plot.stage === 'growing' && now >= plot.stageReadyAt) {
    plot.stage = 'packaging';
    plot.stageReadyAt = plot.stageReadyAt + FARM_PACKAGE_MS;
  }
  if (plot.stage === 'packaging' && now >= plot.stageReadyAt) {
    plot.stage = 'shipping';
    plot.stageReadyAt = plot.stageReadyAt + FARM_SHIP_MS;
  }
  if (plot.stage === 'shipping' && now >= plot.stageReadyAt) {
    plot.stage = 'ready';
  }
  return plot;
}

function doBuyFarmPlot(character) {
  const farms = ensureFarmsState(character);
  if ((character.drugDealer.unitsSold || 0) < FARM_UNLOCK_UNITS_SOLD) {
    return { ok: false, reason: 'Sell more product to Guzman first -- Milos Outlook Farms unlocks once Esteban does.' };
  }
  if (farms.plots.length >= FARM_MAX_PLOTS) return { ok: false, reason: 'You already own the maximum number of plots.' };
  if (character.cash < FARM_PLOT_COST) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - FARM_PLOT_COST);
  farms.plots.push({
    id: `plot_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    drugType: null,
    qty: 0,
    prepped: false,
    stage: 'empty',
    stageReadyAt: 0,
    confiscated: false,
  });
  return { ok: true, message: `Bought a farm plot for $${FARM_PLOT_COST.toLocaleString()}.`, cls: 'gain', character };
}

function findFarmPlot(character, plotId) {
  const farms = ensureFarmsState(character);
  return farms.plots.find((p) => p.id === plotId);
}

function doPrepFarmPlot(character, plotId) {
  const plot = findFarmPlot(character, plotId);
  if (!plot) return { ok: false, reason: 'Unknown plot.' };
  advanceFarmPlot(plot);
  if (plot.stage !== 'empty') return { ok: false, reason: 'This plot is already in a grow cycle.' };
  if (character.cash < FARM_PREP_COST) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - FARM_PREP_COST);
  plot.prepped = true;
  return { ok: true, message: `Tilled, watered, and fertilized for $${FARM_PREP_COST.toLocaleString()}.`, cls: 'gain', character };
}

function doPlantFarmSeed(character, plotId, drugId, qty) {
  const plot = findFarmPlot(character, plotId);
  if (!plot) return { ok: false, reason: 'Unknown plot.' };
  advanceFarmPlot(plot);
  if (plot.stage !== 'empty') return { ok: false, reason: 'This plot is already in a grow cycle.' };
  if (!plot.prepped) return { ok: false, reason: 'Till, water, and fertilize this plot first.' };
  const perSeedCost = FARM_SEED_COST_BY_DRUG[drugId];
  if (!perSeedCost) return { ok: false, reason: 'Unknown seed type.' };
  const plantQty = Math.floor(Number(qty));
  if (!Number.isInteger(plantQty) || plantQty < 1 || plantQty > FARM_MAX_QTY) {
    return { ok: false, reason: `Choose 1-${FARM_MAX_QTY} packages to plant.` };
  }
  if (drugId === 'drugCoke' && (character.drugDealer.unitsSold || 0) < DEALER_TIERS_BY_ID.dmitri.unlockUnits) {
    return { ok: false, reason: 'Cocaine seeds unlock once Dmitri does.' };
  }
  const seedCost = round2(perSeedCost * plantQty);
  if (character.cash < seedCost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - seedCost);

  const farms = ensureFarmsState(character);
  const chance = farmConfiscationChance(farms.securityTier);
  const confiscated = Math.random() < chance;

  plot.drugType = drugId;
  plot.qty = plantQty;
  plot.prepped = false;
  plot.stage = 'growing';
  plot.stageReadyAt = Date.now() + FARM_GROW_MS;
  plot.confiscated = confiscated;

  const riskNote = confiscated
    ? `Bad news: this run's already busted (${Math.round(chance * 100)}% odds) -- it'll still take the full cycle, but the harvest is a write-off.`
    : `Risk rolled and cleared (${Math.round(chance * 100)}% odds) -- this run is safe from confiscation.`;
  return {
    ok: true,
    message: `Planted ${plantQty}x ${DRUG_ITEMS_BY_ID[drugId].name} seed${plantQty > 1 ? 's' : ''} (${plantQty * farmPackageUnits(drugId)} units at harvest). ${riskNote}`,
    cls: confiscated ? 'loss' : 'gain',
    character,
  };
}

function doCollectFarmHarvest(character, plotId) {
  const plot = findFarmPlot(character, plotId);
  if (!plot) return { ok: false, reason: 'Unknown plot.' };
  advanceFarmPlot(plot);
  if (plot.stage !== 'ready') return { ok: false, reason: 'This grow is not ready to collect yet.' };

  const drugName = DRUG_ITEMS_BY_ID[plot.drugType].name;
  let message;
  let cls;
  if (plot.confiscated) {
    message = `Confiscated: your ${drugName} shipment was seized. No bricks.`;
    cls = 'loss';
  } else {
    const perBrick = farmPackageUnits(plot.drugType);
    const units = plot.qty * perBrick;
    addToInventory(character, plot.drugType, units);
    message = `Shipment landed! ${plot.qty} brick${plot.qty > 1 ? 's' : ''} = ${units} units of ${drugName} added to your Inventory.`;
    cls = 'gain';
  }
  plot.drugType = null;
  plot.qty = 0;
  plot.prepped = false;
  plot.stage = 'empty';
  plot.stageReadyAt = 0;
  plot.confiscated = false;
  return { ok: true, message, cls, character };
}

function doBuyFarmSecurity(character) {
  const farms = ensureFarmsState(character);
  if (farms.securityTier >= FARM_SECURITY_MAX_TIER) return { ok: false, reason: 'Security is already maxed out.' };
  const cost = FARM_SECURITY_TIER_COST * (farms.securityTier + 1);
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - cost);
  farms.securityTier += 1;
  return {
    ok: true,
    message: `Security upgraded (tier ${farms.securityTier}) -- confiscation risk down to ${Math.round(farmConfiscationChance(farms.securityTier) * 100)}%.`,
    cls: 'gain',
    character,
  };
}

// Called from a successful NMC robbery (doRobPlayer) against a victim who has a plot currently in
// its 1-hour shipping window -- the "shipment interception" risk from the design doc. Advances the
// victim's plot first so a stage that finished mid-robbery doesn't get double-counted.
function tryInterceptFarmShipment(attacker, target) {
  const farms = ensureFarmsState(target);
  const plot = farms.plots.find((p) => {
    advanceFarmPlot(p);
    return p.stage === 'shipping';
  });
  if (!plot) return null;

  const chance = Math.min(0.25, (attacker.stats.speed / 100) * 0.3);
  if (Math.random() >= chance) return null;

  const drugName = DRUG_ITEMS_BY_ID[plot.drugType].name;
  let note;
  if (plot.confiscated) {
    note = `You tracked their shipment location, but it was already busted -- nothing to take.`;
  } else {
    addToInventory(attacker, plot.drugType, plot.qty);
    note = `You also tracked down their in-transit ${drugName} shipment and intercepted ${plot.qty}x package${plot.qty > 1 ? 's' : ''}!`;
  }
  plot.drugType = null;
  plot.qty = 0;
  plot.prepped = false;
  plot.stage = 'empty';
  plot.stageReadyAt = 0;
  plot.confiscated = false;
  return note;
}

// ---------- Drugs & Rugs: Floydcoin (crypto) ----------
const FC_START_PRICE = 10000; // flavor/display only -- the fixed rate doSellFC() actually uses
const FC_COLLECT_MIN_INTERVAL_MS = 60 * 60 * 1000; // hourly
// 10 named machines, each mined with its own RAM/CPU/GPU upgrade tracks (3 tiers apiece). Once all
// 3 tracks are maxed on the current machine, the player can advance to the next machine, which
// resets RAM/CPU/GPU back to tier 0. Every machine's RAM/CPU/GPU costs and addRates are 1.5x the
// previous machine's (MACHINE_SCALING), so upgrades matter as much on the top end as the bottom.
// Maxing every track on the last machine (index 9) unlocks Prestige: resets back to machine 0,
// but permanently multiplies rate by 1.5x and cost by 2x per prestige level, stacking on repeats.
const CRYPTO_MACHINES = [
  { name: 'MyShitter900', baseRate: 0.05 },
  { name: 'iFminer', baseRate: 0.15 },
  { name: 'iFminer360', baseRate: 0.30 },
  { name: 'iFminer720', baseRate: 0.50 },
  { name: 'iFminerX', baseRate: 0.80 },
  { name: 'DBL Azeroth Mining Rig', baseRate: 1.20 },
  { name: 'DBL Azeroth Mining Array', baseRate: 1.75 },
  { name: 'DBL Blackhawk Mining Array', baseRate: 2.50 },
  { name: 'KRG White//White Configured Mining Solution', baseRate: 3.50 },
  { name: 'UNT Prototype Quantum Miner', baseRate: 5.00 },
];
const MACHINE_UPGRADE_SCALING = 1.5;
const CRYPTO_UPGRADE_TIERS = {
  ram: [
    { addRate: 0.02, cost: 2000 },
    { addRate: 0.05, cost: 5000 },
    { addRate: 0.10, cost: 10000 },
  ],
  cpu: [
    { addRate: 0.05, cost: 5000 },
    { addRate: 0.12, cost: 12000 },
    { addRate: 0.25, cost: 25000 },
  ],
  gpu: [
    { addRate: 0.10, cost: 10000 },
    { addRate: 0.25, cost: 25000 },
    { addRate: 0.50, cost: 50000 },
  ],
};

// Cold Storage: an offline FC vault sitting alongside the hot wallet (crypto.fc) -- capacity-
// capped, upgradeable with cash, and immune to tryDrainCryptoWallet below since that function only
// ever touches crypto.fc, never crypto.coldStorage.fc.
const COLD_STORAGE_BASE_CAP = 10;
const COLD_STORAGE_UPGRADE_TIERS = [
  { addCap: 15, cost: 5000 },
  { addCap: 25, cost: 12000 },
  { addCap: 50, cost: 25000 },
];

function ensureCryptoState(character) {
  if (!character.crypto) {
    character.crypto = { machineTier: 0, ramTier: 0, cpuTier: 0, gpuTier: 0, prestigeLevel: 0, fc: 0, lastCollectedAt: Date.now() };
  }
  if (character.crypto.machineTier === undefined) character.crypto.machineTier = 0;
  if (character.crypto.ramTier === undefined) character.crypto.ramTier = 0;
  if (character.crypto.cpuTier === undefined) character.crypto.cpuTier = 0;
  if (character.crypto.gpuTier === undefined) character.crypto.gpuTier = 0;
  if (character.crypto.prestigeLevel === undefined) character.crypto.prestigeLevel = 0;
  if (!character.crypto.coldStorage) {
    character.crypto.coldStorage = { fc: 0, tier: 0 };
  }
  return character.crypto;
}

function coldStorageCapacity(coldStorage) {
  return COLD_STORAGE_BASE_CAP + COLD_STORAGE_UPGRADE_TIERS.slice(0, coldStorage.tier).reduce((sum, t) => sum + t.addCap, 0);
}

function doDepositColdStorage(character, amount) {
  const crypto = ensureCryptoState(character);
  if (!amount || amount <= 0) return { ok: false, reason: 'Enter a valid amount.' };
  if (amount > crypto.fc) return { ok: false, reason: "You don't have that much FC in your hot wallet." };
  const capacity = coldStorageCapacity(crypto.coldStorage);
  const room = round4(capacity - crypto.coldStorage.fc);
  if (amount > room) return { ok: false, reason: `Cold Storage only has room for ${room.toFixed(4)} more FC.` };
  crypto.fc = round4(crypto.fc - amount);
  crypto.coldStorage.fc = round4(crypto.coldStorage.fc + amount);
  return { ok: true, message: `Moved ${amount} FC into Cold Storage.`, cls: 'gain', character };
}

function doWithdrawColdStorage(character, amount) {
  const crypto = ensureCryptoState(character);
  if (!amount || amount <= 0) return { ok: false, reason: 'Enter a valid amount.' };
  if (amount > crypto.coldStorage.fc) return { ok: false, reason: "You don't have that much FC in Cold Storage." };
  crypto.coldStorage.fc = round4(crypto.coldStorage.fc - amount);
  crypto.fc = round4(crypto.fc + amount);
  return { ok: true, message: `Moved ${amount} FC back to your hot wallet.`, cls: '', character };
}

function doBuyColdStorageUpgrade(character) {
  const crypto = ensureCryptoState(character);
  const tiers = COLD_STORAGE_UPGRADE_TIERS;
  if (crypto.coldStorage.tier >= tiers.length) return { ok: false, reason: 'Already maxed out.' };
  const next = tiers[crypto.coldStorage.tier];
  if (character.cash < next.cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - next.cost);
  crypto.coldStorage.tier += 1;
  return {
    ok: true,
    message: `Cold Storage upgraded to tier ${crypto.coldStorage.tier} (capacity now ${coldStorageCapacity(crypto.coldStorage)} FC).`,
    cls: 'gain',
    character,
  };
}

function cryptoPrestigeRateMultiplier(prestigeLevel) {
  return Math.pow(1.5, prestigeLevel);
}

function cryptoPrestigeCostMultiplier(prestigeLevel) {
  return Math.pow(2, prestigeLevel);
}

function cryptoMachineScaling(machineTier) {
  return Math.pow(MACHINE_UPGRADE_SCALING, machineTier);
}

// De-compounded (rebalance): the machine-tier scaling multiplier used to be applied to the RATE as
// well as the cost, so each of the 10 machines multiplied BOTH its own tabled baseRate and every
// upgrade's tabled addRate by 1.5^tier -- on the last machine that's 1.5^9 = 38.4x on top of an
// already-10x-higher base rate, and a maxed rig produced ~220 FC/day (~$2.2M/day). Rates are now
// exactly what the tables say: machine = baseRate, upgrades = addRate. A maxed rig is 5.00 +
// (0.17 ram + 0.42 cpu + 0.85 gpu) = 6.44 FC/day (~$64k/day) before prestige.
//
// The scaling deliberately STAYS in cryptoNextTrackCost() -- upgrades still get 1.5x more expensive
// per machine tier, so advancing the rig is still a real investment, it just no longer compounds
// into a runaway rate curve. Prestige multipliers are untouched.
function cryptoTrackAddRate(crypto, track) {
  const tier = crypto[`${track}Tier`];
  return CRYPTO_UPGRADE_TIERS[track].slice(0, tier).reduce((sum, t) => sum + t.addRate, 0);
}

function cryptoNextTrackCost(crypto, track) {
  const tiers = CRYPTO_UPGRADE_TIERS[track];
  const tier = crypto[`${track}Tier`];
  if (tier >= tiers.length) return null;
  const next = tiers[tier];
  return Math.round(next.cost * cryptoMachineScaling(crypto.machineTier) * cryptoPrestigeCostMultiplier(crypto.prestigeLevel));
}

function cryptoTracksMaxed(crypto) {
  return ['ram', 'cpu', 'gpu'].every((track) => crypto[`${track}Tier`] >= CRYPTO_UPGRADE_TIERS[track].length);
}

function cryptoDailyRate(crypto) {
  const machine = CRYPTO_MACHINES[crypto.machineTier];
  // No cryptoMachineScaling() here -- see the comment on cryptoTrackAddRate above.
  const machineRate = machine.baseRate;
  const upgradeRate = cryptoTrackAddRate(crypto, 'ram') + cryptoTrackAddRate(crypto, 'cpu') + cryptoTrackAddRate(crypto, 'gpu');
  return (machineRate + upgradeRate) * cryptoPrestigeRateMultiplier(crypto.prestigeLevel);
}

function doBuyCryptoUpgrade(character, track) {
  const tiers = CRYPTO_UPGRADE_TIERS[track];
  if (!tiers) return { ok: false, reason: 'Unknown upgrade track.' };
  const crypto = ensureCryptoState(character);
  const tierKey = `${track}Tier`;
  if (crypto[tierKey] >= tiers.length) return { ok: false, reason: 'Already maxed out on this machine.' };
  const cost = cryptoNextTrackCost(crypto, track);
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - cost);
  crypto[tierKey] += 1;
  return { ok: true, message: `${track.toUpperCase()} upgraded to tier ${crypto[tierKey]}.`, cls: 'gain', character };
}

function doAdvanceCryptoMachine(character) {
  const crypto = ensureCryptoState(character);
  if (!cryptoTracksMaxed(crypto)) {
    return { ok: false, reason: 'Max out RAM, CPU, and GPU on your current machine first.' };
  }
  if (crypto.machineTier >= CRYPTO_MACHINES.length - 1) {
    return { ok: false, reason: 'Already on the last machine -- Prestige to reset and mine even faster.' };
  }
  crypto.machineTier += 1;
  crypto.ramTier = 0;
  crypto.cpuTier = 0;
  crypto.gpuTier = 0;
  return { ok: true, message: `Upgraded to ${CRYPTO_MACHINES[crypto.machineTier].name}.`, cls: 'gain', character };
}

function doPrestigeCryptoRig(character) {
  const crypto = ensureCryptoState(character);
  if (crypto.machineTier < CRYPTO_MACHINES.length - 1 || !cryptoTracksMaxed(crypto)) {
    return { ok: false, reason: 'Max out RAM, CPU, and GPU on your last machine before you can Prestige.' };
  }
  crypto.prestigeLevel += 1;
  crypto.machineTier = 0;
  crypto.ramTier = 0;
  crypto.cpuTier = 0;
  crypto.gpuTier = 0;
  return {
    ok: true,
    message: `Prestiged to level ${crypto.prestigeLevel} -- mining rate up 50%, upgrade costs up 100%.`,
    cls: 'gain',
    character,
  };
}

function doCollectCrypto(character) {
  const crypto = ensureCryptoState(character);
  const remaining = FC_COLLECT_MIN_INTERVAL_MS - (Date.now() - crypto.lastCollectedAt);
  if (remaining > 0) return { ok: false, reason: `Come back in ${Math.ceil(remaining / (60 * 1000))}m.` };
  const elapsedDays = (Date.now() - crypto.lastCollectedAt) / (24 * 60 * 60 * 1000);
  const earned = round4(cryptoDailyRate(crypto) * elapsedDays);
  crypto.fc = round4(crypto.fc + earned);
  crypto.lastCollectedAt = Date.now();
  return { ok: true, message: `Collected ${earned.toFixed(4)} FC.`, cls: 'gain', character };
}

function doSellFC(character, amount) {
  const crypto = ensureCryptoState(character);
  if (!amount || amount <= 0) return { ok: false, reason: 'Enter a valid amount.' };
  if (amount > crypto.fc) return { ok: false, reason: "You don't have that much FC." };
  crypto.fc = round4(crypto.fc - amount);
  const payout = round2(amount * FC_START_PRICE);
  character.cash = round2(character.cash + payout);
  return { ok: true, message: `Sold ${amount} FC for $${payout.toFixed(2)}.`, cls: 'gain', character };
}

// Direct cash -> FC purchase at the same fixed rate doSellFC uses, for players who don't want to
// wait on passive mining.
function doBuyFC(character, amount) {
  const crypto = ensureCryptoState(character);
  if (!amount || amount <= 0) return { ok: false, reason: 'Enter a valid amount.' };
  const cost = round2(amount * FC_START_PRICE);
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };
  character.cash = round2(character.cash - cost);
  crypto.fc = round4(crypto.fc + amount);
  return { ok: true, message: `Bought ${amount} FC for $${cost.toFixed(2)}.`, cls: 'gain', character };
}

// Called from a successful NMC robbery against a victim with an FC balance -- the "wallet-drain"
// risk from the design doc, same speed-scaled shape as the shipment-interception roll. Drain rate
// cut ~90% (was 10-30% of balance, now 1-3%) and hard-capped at 3 FC total per robbery -- draining
// a bystander's entire mining payout in one hit was too punishing relative to how passive FC
// income is. Cold Storage (see above) is the intended way to protect a stash from this entirely.
const FC_ROBBERY_DRAIN_MIN = 0.01;
const FC_ROBBERY_DRAIN_MAX = 0.03;
const FC_ROBBERY_MAX_TOTAL = 3;

function tryDrainCryptoWallet(attacker, target) {
  const targetCrypto = ensureCryptoState(target);
  if (targetCrypto.fc <= 0) return null;
  const chance = Math.min(0.25, (attacker.stats.speed / 100) * 0.3);
  if (Math.random() >= chance) return null;

  const drained = round4(Math.min(targetCrypto.fc * randFloat(FC_ROBBERY_DRAIN_MIN, FC_ROBBERY_DRAIN_MAX), FC_ROBBERY_MAX_TOTAL));
  if (drained <= 0) return null;
  targetCrypto.fc = round4(targetCrypto.fc - drained);
  const attackerCrypto = ensureCryptoState(attacker);
  attackerCrypto.fc = round4(attackerCrypto.fc + drained);
  return `You also cracked their wallet and drained ${drained.toFixed(2)} FC!`;
}

// ---------- Drugs & Rugs: Altcoins (rug-pull system) ----------
// Rows live in a real shared DB table (altcoins.js in db.js), same reasoning as mtn_listings --
// visible to every player, not just the creator. These are the pure math helpers gameLogic.js can
// own without DB access; server.js glues them to the actual rows.
const ALTCOIN_MINT_COST_FC = 10;
const ALTCOIN_SUPPLY = 1000;
const ALTCOIN_START_PRICE = 0.10;
const ALTCOIN_END_PRICE = 0.15;
const ALTCOIN_RUG_FLOOR_PCT = 0.05; // price craters to 5-10% of pre-rug value, not to zero
const ALTCOIN_RUG_CEIL_PCT = 0.10;
const ALTCOIN_NAME_MAX_LEN = 24;
// City Hall's rename (doCityHallRename) only enforces a length cap, no profanity list -- but a
// coin name is public and highly visible (every player sees it in the Altcoins list), so it needs
// real moderation. Minimal starter list -- extend as needed.
const PROFANITY_WORDS = ['fuck', 'shit', 'cunt', 'nigger', 'faggot', 'retard'];

function altcoinPriceAt(sold) {
  return ALTCOIN_START_PRICE + (ALTCOIN_END_PRICE - ALTCOIN_START_PRICE) * (sold / ALTCOIN_SUPPLY);
}

// Exact cost for `qty` coins bought starting at `sold` -- the price curve is linear, so the average
// of the start/end unit price over the range times qty is exact, not an approximation.
function altcoinBuyCost(sold, qty) {
  const startPrice = altcoinPriceAt(sold);
  const endPrice = altcoinPriceAt(sold + qty);
  return round2(((startPrice + endPrice) / 2) * qty * 1000) / 1000; // keep 3 decimals, FC amounts are small
}

// Total FC actually raised so far (everyone's cumulative purchase cost) -- exact trapezoid from 0
// to `sold` on the linear price curve. This is "the pool," and it's what makes rugging so much
// better than a fair sale: a fair sale only nets your OWN stake's worth, but a rug drains the
// entire pool -- both what you put in AND what every other buyer put in. See the worked example in
// the design doc: 501 coins bought fairly nets ~68.9 FC, but rugging the same position nets the
// full ~125 FC pool.
function altcoinPoolRaised(sold) {
  return round2(((ALTCOIN_START_PRICE + altcoinPriceAt(sold)) / 2) * sold * 1000) / 1000;
}

function validateAltcoinName(name) {
  if (!name || typeof name !== 'string') return { ok: false, reason: 'Name is required.' };
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > ALTCOIN_NAME_MAX_LEN) {
    return { ok: false, reason: `Name must be 2-${ALTCOIN_NAME_MAX_LEN} characters.` };
  }
  if (PROFANITY_WORDS.some((word) => trimmed.toLowerCase().includes(word))) {
    return { ok: false, reason: 'That name is not allowed.' };
  }
  return { ok: true, name: trimmed };
}

// Rug (pre-sellout) and "Sell Now" (post-sellout) are mechanically identical -- the majority
// holder drains the ENTIRE pool (not just their own stake's worth -- that's what makes rugging
// dramatically more profitable than a fair sale, see altcoinPoolRaised above) and everyone else's
// remaining stake craters. Full Buyout is the one genuinely different code path (see
// altcoinFullBuyoutPayout below): it splits the same pool pro-rata instead of handing it all to one
// player. `dumperQty` isn't used in the payout math -- it's kept as a parameter for callers that
// want to log/display how large the dumper's own position was.
function altcoinDumpPayout(coin, dumperQty) {
  const preRugPrice = altcoinPriceAt(coin.sold);
  const payoutFc = altcoinPoolRaised(coin.sold);
  const crashPct = randFloat(ALTCOIN_RUG_FLOOR_PCT, ALTCOIN_RUG_CEIL_PCT);
  const newPrice = round2(preRugPrice * crashPct * 10000) / 10000;
  return { payoutFc, newPrice };
}

// Validates + deducts the mint cost only -- the actual row insert (and the "one active altcoin per
// creator" check, which needs a DB query) happens in server.js.
function doMintAltcoin(character, name) {
  const validated = validateAltcoinName(name);
  if (!validated.ok) return validated;
  const crypto = ensureCryptoState(character);
  if (crypto.fc < ALTCOIN_MINT_COST_FC) return { ok: false, reason: `Minting costs ${ALTCOIN_MINT_COST_FC} FC.` };
  crypto.fc = round4(crypto.fc - ALTCOIN_MINT_COST_FC);
  return { ok: true, name: validated.name, character };
}

// `coin` is a plain {sold, supply} snapshot -- server.js updates the real row's `sold` count after
// a successful buy.
function doBuyAltcoinCoins(character, coin, qty) {
  if (!qty || qty < 1) return { ok: false, reason: 'Enter a valid quantity.' };
  if (coin.sold + qty > ALTCOIN_SUPPLY) return { ok: false, reason: 'Not enough coins left in this run.' };
  const crypto = ensureCryptoState(character);
  const cost = altcoinBuyCost(coin.sold, qty);
  if (crypto.fc < cost) return { ok: false, reason: 'Not enough FC.' };
  crypto.fc = round4(crypto.fc - cost);
  return { ok: true, cost, message: `Bought ${qty} coin(s) for ${cost.toFixed(3)} FC.`, cls: 'gain', character };
}

// Pays every current holder pro-rata at the final sellout price -- the "honest ending," a genuinely
// different payout shape than the dump (everyone gets their share, not just the majority holder).
function altcoinFullBuyoutPayout(coin, holdings) {
  const pool = altcoinPoolRaised(coin.sold);
  const totalHeld = holdings.reduce((sum, h) => sum + h.qty, 0);
  if (totalHeld <= 0) return [];
  return holdings.map((h) => ({
    userId: h.userId,
    payoutFc: round2((h.qty / totalHeld) * pool * 1000) / 1000,
  }));
}

// ---------- Player Profiles ----------
const PROFILE_SHOWCASE_MAX = 4;
const PROFILE_SLAB_SHOWCASE_MAX = 8;
const PROFILE_SLAB_MARKET_MAX = 6;
const PROFILE_STATUS_MAX_LEN = 100;
const PROFILE_WALL_POST_MAX_LEN = 300;
const PROFILE_WALL_PAGE_SIZE = 5;

const PROFILE_PRIVACY_FIELDS = ['cash', 'fc', 'portfolio'];

function ensureProfileState(character) {
  if (!character.profile) character.profile = { bannerTitleId: null, showcaseTitleIds: [], slabShowcaseIds: [], status: '', wall: [] };
  if (character.profile.bannerTitleId === undefined) character.profile.bannerTitleId = null;
  if (!character.profile.showcaseTitleIds) character.profile.showcaseTitleIds = [];
  if (!character.profile.slabShowcaseIds) character.profile.slabShowcaseIds = [];
  if (typeof character.profile.status !== 'string') character.profile.status = '';
  if (!character.profile.wall) character.profile.wall = [];
  if (!character.profile.privacy) character.profile.privacy = { cash: false, fc: false, portfolio: false };
  PROFILE_PRIVACY_FIELDS.forEach((f) => {
    if (typeof character.profile.privacy[f] !== 'boolean') character.profile.privacy[f] = false;
  });
  return character.profile;
}

// Titles are opaque, client-trusted ids everywhere else in this codebase (see the comment above
// the inventory catalogs) -- this mirrors that same trust level, just checking that the caller
// actually owns *some* stack/flag with this id rather than validating what the title even is.
function characterOwnsTitle(character, titleId) {
  if ((character.titles.owned || []).includes(titleId)) return true;
  if ((character.titles.customTitles || []).some((t) => t.id === titleId)) return true;
  return (character.inventory || []).some((s) => s.id === titleId && s.qty > 0);
}

function doSetProfileStatus(character, status) {
  const profile = ensureProfileState(character);
  const trimmed = String(status || '').trim().slice(0, PROFILE_STATUS_MAX_LEN);
  profile.status = trimmed;
  return { ok: true, message: 'Status updated.', cls: 'gain', character };
}

function doToggleProfilePrivacy(character, field) {
  const profile = ensureProfileState(character);
  if (!PROFILE_PRIVACY_FIELDS.includes(field)) return { ok: false, reason: 'Unknown field.' };
  profile.privacy[field] = !profile.privacy[field];
  return {
    ok: true,
    message: `${field} is now ${profile.privacy[field] ? 'private' : 'public'} on your profile.`,
    cls: 'gain',
    character,
  };
}

function doSetProfileBanner(character, titleId) {
  const profile = ensureProfileState(character);
  if (!titleId) {
    profile.bannerTitleId = null;
    return { ok: true, message: 'Banner reset to your equipped title.', cls: 'gain', character };
  }
  if (!characterOwnsTitle(character, titleId)) return { ok: false, reason: "You don't own that title." };
  profile.bannerTitleId = titleId;
  return { ok: true, message: 'Profile banner updated.', cls: 'gain', character };
}

function doAddShowcaseTitle(character, titleId) {
  const profile = ensureProfileState(character);
  if (!titleId) return { ok: false, reason: 'Unknown title.' };
  if (!characterOwnsTitle(character, titleId)) return { ok: false, reason: "You don't own that title." };
  if (profile.showcaseTitleIds.includes(titleId)) return { ok: false, reason: 'Already in your showcase.' };
  if (profile.showcaseTitleIds.length >= PROFILE_SHOWCASE_MAX) {
    return { ok: false, reason: `Showcase is full (max ${PROFILE_SHOWCASE_MAX}) -- remove one first.` };
  }
  profile.showcaseTitleIds.push(titleId);
  return { ok: true, message: 'Added to Title Showcase.', cls: 'gain', character };
}

function doRemoveShowcaseTitle(character, titleId) {
  const profile = ensureProfileState(character);
  profile.showcaseTitleIds = profile.showcaseTitleIds.filter((id) => id !== titleId);
  return { ok: true, message: 'Removed from Title Showcase.', cls: '', character };
}

// Portfolio Showcase: same shape as the Title Showcase above, but restricted to graded slabs (the
// point is the full slab art, which only a graded title has) and rendered full-size on the client
// instead of the small badge chip.
function doAddSlabShowcase(character, titleId) {
  const profile = ensureProfileState(character);
  if (!titleId) return { ok: false, reason: 'Unknown title.' };
  if (!isGradedTitleId(titleId)) return { ok: false, reason: 'Only graded slabs can go in the Portfolio Showcase.' };
  if (!characterOwnsTitle(character, titleId)) return { ok: false, reason: "You don't own that slab." };
  if (profile.slabShowcaseIds.includes(titleId)) return { ok: false, reason: 'Already in your Portfolio Showcase.' };
  if (profile.slabShowcaseIds.length >= PROFILE_SLAB_SHOWCASE_MAX) {
    return { ok: false, reason: `Portfolio Showcase is full (max ${PROFILE_SLAB_SHOWCASE_MAX}) -- remove one first.` };
  }
  profile.slabShowcaseIds.push(titleId);
  return { ok: true, message: 'Added to Portfolio Showcase.', cls: 'gain', character };
}

function doRemoveSlabShowcase(character, titleId) {
  const profile = ensureProfileState(character);
  profile.slabShowcaseIds = profile.slabShowcaseIds.filter((id) => id !== titleId);
  return { ok: true, message: 'Removed from Portfolio Showcase.', cls: '', character };
}

// Wall posts live on the PROFILE OWNER's own save (like custom titles) -- unlike everything else
// in gameLogic.js, doPostToWall/doDeleteWallPost each act on a character that may not belong to
// the caller, so they don't fit the runAction(character-of-req.user) shape and are wired directly
// in server.js the same way /players/pay handles a separate payer/target pair.
function doPostToWall(targetCharacter, authorUsername, authorName, text) {
  const profile = ensureProfileState(targetCharacter);
  const trimmed = String(text || '').trim().slice(0, PROFILE_WALL_POST_MAX_LEN);
  if (!trimmed) return { ok: false, reason: 'Write something first.' };
  profile.wall.push({
    id: `wall_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    authorUsername,
    authorName,
    text: trimmed,
    ts: Date.now(),
  });
  return { ok: true };
}

function doDeleteWallPost(targetCharacter, postId) {
  const profile = ensureProfileState(targetCharacter);
  profile.wall = profile.wall.filter((p) => p.id !== postId);
}

// Newest-first, paginated -- returns the requested page plus the total page count.
function paginateWall(profile, page) {
  const sorted = [...profile.wall].reverse();
  const totalPages = Math.max(1, Math.ceil(sorted.length / PROFILE_WALL_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * PROFILE_WALL_PAGE_SIZE;
  return { wallPage: sorted.slice(start, start + PROFILE_WALL_PAGE_SIZE), wallTotalPages: totalPages, wallPageNum: safePage };
}

// ---------- Leaderboard (Looks / Net Worth / Level) ----------
// Title ids must match the client's title catalog (core.js) exactly -- these are the only
// server-known title ids, since granting/revoking them is the one case where the server needs to
// understand a specific title rather than treating character.titles as opaque client data.
const LEADERBOARD_TITLES = {
  looks: { id: 'looksmaxxer', name: 'LOOKSMAXXER' },
  networth: { id: 'highestNetWorth', name: 'HIGHEST NET WORTH' },
  level: { id: 'highestLevel', name: 'HIGHEST LEVEL' },
  height: { id: 'heightmaxxed', name: 'HeightMAXXED' },
  // No existing leaderboard title uses an id prefix (looksmaxxer/highestNetWorth/highestLevel/
  // heightmaxxed are all bare words) -- kollector matches that convention rather than inventing one.
  kollector: { id: 'kollector', name: 'KOLLECTOR' },
};

const LEADERBOARD_CATEGORIES = ['looks', 'networth', 'level', 'height', 'kollector'];

// Mirrors the client's computeLevel() in core.js exactly.
function computeCharacterLevel(character) {
  const s = character.stats;
  const avg = (s.health + s.attack + s.speed + s.defense + s.looks) / 5;
  return Math.max(1, Math.floor(avg / 10));
}

// Cash + bank balance + casino chips, minus any owed credit card balance.
function computeNetWorth(character) {
  const bank = character.bank || {};
  return round2((character.cash || 0) + (bank.balance || 0) + (character.chips || 0) - (bank.creditBalance || 0));
}

function leaderboardValue(character, category) {
  if (category === 'looks') return character.stats.looks;
  if (category === 'networth') return computeNetWorth(character);
  if (category === 'height') return character.height;
  if (category === 'kollector') return gradedCollectionValue(character);
  return computeCharacterLevel(character);
}

// Ties broken by lowest user id (i.e. whoever got there first), so the crown doesn't flicker
// between tied players on every recheck.
function computeLeaderboardWinners(users) {
  const winners = {};
  LEADERBOARD_CATEGORIES.forEach((category) => {
    let best = null;
    users.forEach((u) => {
      const value = leaderboardValue(u.character, category);
      if (!best || value > best.value || (value === best.value && u.id < best.id)) {
        best = { id: u.id, value };
      }
    });
    winners[category] = best ? best.id : null;
  });
  return winners;
}

// Read-only ranked view for the leaderboard tab -- top N per category with each entry's current
// value and whether they presently hold that category's title.
function buildLeaderboardBoard(users, limit = 10) {
  const board = {};
  LEADERBOARD_CATEGORIES.forEach((category) => {
    const titleId = LEADERBOARD_TITLES[category].id;
    board[category] = users
      .map((u) => ({
        userId: u.id,
        username: u.username,
        name: `${u.character.firstName} ${u.character.lastName}`,
        value: leaderboardValue(u.character, category),
        holdsTitle: (u.character.titles.owned || []).includes(titleId),
      }))
      .sort((a, b) => b.value - a.value || a.userId - b.userId)
      .slice(0, limit);
  });
  return board;
}

// ---------- Stock Market ----------
// Price/fairValue live in a shared DB row per ticker (not per-character) -- server.js ticks them
// forward lazily on read (see advanceStockTicks), same "catch up since last visit" trick as
// advanceFarmPlot/ensureCryptoState, so every player sees the exact same price at any instant with
// no cron process required.
const STOCK_TIER_CONFIG = {
  // pull: fraction of the gap to fairValue closed per tick (mean reversion "leash" strength).
  // vol: max +/- fractional jitter applied per tick.
  megabluechip: { pull: 0.08, vol: 0.0015 },
  bluechip: { pull: 0.05, vol: 0.004 },
  growth: { pull: 0.02, vol: 0.012 },
  volatile: { pull: 0.008, vol: 0.025 },
  meme: { pull: 0.003, vol: 0.045 },
};

const STOCK_DEFINITIONS = [
  { symbol: 'DBLK', name: 'D Block Industries', sector: 'Technology (New Milos City)', tier: 'growth', startPrice: 64 },
  { symbol: 'COPP', name: 'Consolidated Objective Permanence Projects', sector: 'Biopharma (New Milos City)', tier: 'volatile', startPrice: 18 },
  { symbol: '3OAK', name: '3 Oaks Parametrics', sector: 'Military (New Milos City)', tier: 'bluechip', startPrice: 210 },
  { symbol: 'AJD', name: '&Drujian Pharmaceuticalls', sector: 'Pharmaceuticals (China)', tier: 'volatile', startPrice: 9 },
  { symbol: 'NGR', name: 'Netizen Gamble Registry', sector: 'Casino & Hospitality', tier: 'growth', startPrice: 47 },
  { symbol: 'UNT', name: 'UNITS the Company', sector: 'Diversified Holdings', tier: 'megabluechip', startPrice: 48500 },
  { symbol: 'JRK', name: 'Jericho Capital', sector: 'Finance', tier: 'growth', startPrice: 132 },
  { symbol: 'PRK', name: 'PORK Judaism', sector: 'Novelty Goods', tier: 'meme', startPrice: 2.4 },
  { symbol: 'NIQ', name: 'Q Corp', sector: 'Conglomerate', tier: 'bluechip', startPrice: 305 },
  { symbol: 'LUQ', name: 'Luqunior Ent', sector: 'Fashion', tier: 'meme', startPrice: 6.5 },
];

const STOCK_TICK_MS = 32 * 1000;
// Safety valve: if the server was down a long stretch, still resolve in one pass instead of a
// pathologically long loop -- price just settles wherever this many ticks lands it.
const STOCK_TICK_CATCHUP_CAP = 2000;
const STOCK_SPREAD = 0.01; // 1% each side on buy/sell, matching a real bid/ask spread

function tickStockOnce(stock) {
  const cfg = STOCK_TIER_CONFIG[stock.tier];
  stock.price += (stock.fairValue - stock.price) * cfg.pull;
  stock.price *= 1 + randFloat(-cfg.vol, cfg.vol);
  stock.price = Math.max(stock.price, stock.fairValue * 0.1, 0.01);
  // fairValue itself slow-walks too (at a tenth the ticker's usual jitter) so a "blue chip" isn't
  // anchored to its launch price forever -- just moves far more gradually than the price itself.
  stock.fairValue *= 1 + randFloat(-cfg.vol * 0.15, cfg.vol * 0.15);
  stock.fairValue = Math.max(stock.fairValue, 0.01);
}

// Mutates `stock` (price/fairValue/lastTickAt) in place and returns whether anything changed, so
// the caller only needs to persist when this returns true.
function advanceStockTicks(stock, now) {
  const elapsed = now - stock.lastTickAt;
  let ticks = Math.floor(elapsed / STOCK_TICK_MS);
  if (ticks <= 0) return false;
  ticks = Math.min(ticks, STOCK_TICK_CATCHUP_CAP);
  for (let i = 0; i < ticks; i += 1) tickStockOnce(stock);
  stock.lastTickAt += ticks * STOCK_TICK_MS;
  stock.price = round2(stock.price);
  stock.fairValue = round2(stock.fairValue);
  return true;
}

// A "real" Investors Chat news post jolts the price once, on top of whatever the normal tick does
// -- roughly 4 ticks' worth of movement landing all at once, in the direction the post implied.
function applyStockNewsShock(stock, bullish) {
  const cfg = STOCK_TIER_CONFIG[stock.tier];
  const magnitude = cfg.vol * 4 * (0.6 + Math.random() * 0.8);
  stock.price *= 1 + (bullish ? magnitude : -magnitude);
  stock.price = Math.max(stock.price, stock.fairValue * 0.1, 0.01);
  stock.price = round2(stock.price);
}

// Accounts created before the Stock Market (or before the performance log) shipped won't have
// these fields yet.
const STOCK_TRANSACTION_HISTORY_LIMIT = 200;

function ensureStocksState(character) {
  if (!character.stocks) character.stocks = { holdings: {} };
  if (!character.stocks.transactions) character.stocks.transactions = [];
  if (typeof character.stocks.realizedPl !== 'number') character.stocks.realizedPl = 0;
  return character.stocks;
}

// Newest first -- callers paginate straight off the front of the array with no reversal needed.
function recordStockTransaction(character, entry) {
  character.stocks.transactions.unshift(entry);
  if (character.stocks.transactions.length > STOCK_TRANSACTION_HISTORY_LIMIT) {
    character.stocks.transactions.length = STOCK_TRANSACTION_HISTORY_LIMIT;
  }
}

function doBuyStock(character, stock, qty) {
  ensureStocksState(character);
  if (!stock) return { ok: false, reason: 'Unknown stock.' };
  const q = Math.floor(qty);
  if (!q || q < 1) return { ok: false, reason: 'Enter a valid quantity.' };

  const buyPrice = round2(stock.price * (1 + STOCK_SPREAD));
  const cost = round2(buyPrice * q);
  if (cost > character.cash) return { ok: false, reason: 'Not enough Floydbucks.' };

  character.cash = round2(character.cash - cost);
  const holding = character.stocks.holdings[stock.symbol] || { qty: 0, avgCost: 0 };
  const newQty = holding.qty + q;
  holding.avgCost = round2(((holding.avgCost * holding.qty) + (buyPrice * q)) / newQty);
  holding.qty = newQty;
  character.stocks.holdings[stock.symbol] = holding;

  recordStockTransaction(character, {
    type: 'buy', symbol: stock.symbol, qty: q, price: buyPrice, total: cost, pl: null, ts: Date.now(),
  });

  return {
    ok: true,
    character,
    message: `Bought ${q}x ${stock.symbol} @ $${buyPrice.toLocaleString()}. Total: $${cost.toLocaleString()}.`,
    cls: '',
  };
}

function doSellStock(character, stock, qty) {
  ensureStocksState(character);
  if (!stock) return { ok: false, reason: 'Unknown stock.' };
  const holding = character.stocks.holdings[stock.symbol];
  const q = Math.floor(qty);
  if (!holding || !q || q < 1 || q > holding.qty) return { ok: false, reason: 'You do not own that many shares.' };

  const sellPrice = round2(stock.price * (1 - STOCK_SPREAD));
  const proceeds = round2(sellPrice * q);
  const costBasis = round2(holding.avgCost * q);
  character.cash = round2(character.cash + proceeds);
  holding.qty -= q;
  if (holding.qty <= 0) delete character.stocks.holdings[stock.symbol];

  const netPl = round2(proceeds - costBasis);
  character.stocks.realizedPl = round2(character.stocks.realizedPl + netPl);
  recordStockTransaction(character, {
    type: 'sell', symbol: stock.symbol, qty: q, price: sellPrice, total: proceeds, pl: netPl, ts: Date.now(),
  });

  const sign = netPl >= 0 ? '+' : '-';
  const message = `Sold ${q}x ${stock.symbol} @ $${sellPrice.toLocaleString()}. Proceeds: $${proceeds.toLocaleString()} (${sign}$${Math.abs(netPl).toLocaleString()} vs cost).`;
  return { ok: true, character, message, cls: netPl > 0 ? 'gain' : netPl < 0 ? 'loss' : '' };
}

// ---------- Investors Chat bot posts ----------
// A pool of fake trader handles -- posts from these read exactly like a real player's chat message
// (same rendering), just with no title badge and no real account behind them.
const INVESTOR_BOT_HANDLES = [
  '@WallStreetWendell', '@MilosBull22', '@ShortKingSam', '@PapaPump', '@DiamondHandsDan',
  '@FadeEveryRally', '@InsiderIrene', '@QuietQuitTrader', '@TendieTom', '@BearMarketBrenda',
  '@YoloYolanda', '@ChartGoblin', '@StonksOnlyUp', '@MarginCallMarv', '@RumorHasItRhonda',
  '@BuyTheDipBrian', '@PennyStockPete', '@OptionsOllie', '@CandlestickCarl', '@FOMOFelicia',
  '@GrindsetGary', '@LeverageLarry', '@ContrarianCathy', '@ExitLiquidityEd', '@AlphaSeekerAva',
];

const INVESTOR_NOISE_TEMPLATES = [
  'market’s just vibes today 🤷',
  'anyone else just staring at charts doing absolutely nothing',
  'buying the dip, selling the rip, you know how it goes',
  'my portfolio and my sleep schedule are both in shambles',
  'is it too late to become a farmer',
  'this market has the emotional range of a rock today',
  'checked my portfolio 40 times today, still broke',
  'volume’s dead, nobody’s doing anything',
  'the real gains were the friends we made along the way',
  'somebody talk me out of an all-in',
  'why does every trading day feel like a personality test',
  'not financial advice but also definitely financial advice',
];

// {symbol}/{name} get swapped for a randomly chosen ticker -- whether a given post is actually
// true (and moves the price) is decided independently of which template got picked, so the same
// bullish/bearish phrasing shows up on both real and fake posts. That's the whole point: you can't
// tell from the writing, only by watching whether the price actually moves afterward.
const INVESTOR_NEWS_TEMPLATES_BULLISH = [
  '🚨 hearing {name} ({symbol}) just landed a massive contract',
  '{symbol} insider buying is off the charts right now',
  'leaked memo says {name} is about to blow earnings out of the water',
  'everyone’s sleeping on {symbol}, this is about to run',
  '{name} ({symbol}) expansion rumors are heating up',
  'somebody at {name} let it slip they’re about to announce something big',
];

const INVESTOR_NEWS_TEMPLATES_BEARISH = [
  '⚠️ {name} ({symbol}) missing earnings again... yikes',
  'word is {symbol} leadership is jumping ship',
  '{name} just got hit with a nasty lawsuit, {symbol} not looking good',
  'heard {symbol}’s supply chain is a mess right now',
  '{name} ({symbol}) downgrade incoming, get out while you can',
  'pretty sure {name} is quietly laying people off',
];

function pickRandom(arr) {
  return arr[randInt(0, arr.length - 1)];
}

// Generates one NPC Investors Chat post. Half the time it's pure banter with no mechanical
// effect; the other half it's a ticker-specific "news" post that is only actually true ~35% of the
// time. Returns { senderName, message, stockSymbol, isReal, bullish } -- the caller applies
// applyStockNewsShock() when isReal is true and stockSymbol is set.
function generateInvestorBotPost(stocks) {
  const senderName = pickRandom(INVESTOR_BOT_HANDLES);
  const isNews = Math.random() < 0.5 && stocks.length > 0;

  if (!isNews) {
    return { senderName, message: pickRandom(INVESTOR_NOISE_TEMPLATES), stockSymbol: null, isReal: false, bullish: null };
  }

  const stock = pickRandom(stocks);
  const bullish = Math.random() < 0.5;
  const template = pickRandom(bullish ? INVESTOR_NEWS_TEMPLATES_BULLISH : INVESTOR_NEWS_TEMPLATES_BEARISH);
  const message = template.replace('{symbol}', stock.symbol).replace('{name}', stock.name);
  const isReal = Math.random() < 0.35;
  return { senderName, message, stockSymbol: stock.symbol, isReal, bullish };
}

// ---------- Level II Research feed ----------
// A paid, read-only feed (see character.investorL2 client-side, and /investors/l2/feed in
// server.js) reporting each stock's REAL price movement over the last posting interval -- unlike
// the free InvestorsChat bot posts, which are banter/rumors that only sometimes move the price,
// this is meant to read as "actual data" the player paid for. The 10% inaccurate roll is what
// keeps it from being a strictly-better version of watching the chart yourself: it's usually right,
// but a report can't be blindly trusted, matching the "sparse, not perfect" pitch in the ad.
const INVESTOR_L2_INACCURATE_CHANCE = 0.1;

// oldPrice is the price at (now - posting interval) for this stock, already looked up by the
// caller (server.js has DB access for stock_price_history; this function stays a pure calculation
// so it's testable/callable without a DB, matching generateInvestorBotPost's shape above).
function generateL2Post(stock, oldPrice) {
  const actualPct = oldPrice > 0 ? ((stock.price - oldPrice) / oldPrice) * 100 : 0;
  const accurate = Math.random() >= INVESTOR_L2_INACCURATE_CHANCE;

  // A fabricated report still needs to look like a real reading -- roll an independent plausible
  // move (same rough magnitude a 5-minute report could show) rather than just flipping the sign,
  // so it can occasionally land close to the truth by coincidence instead of always reading as an
  // obvious inversion.
  const reportedPct = accurate ? actualPct : randFloat(-4, 4);

  const direction = reportedPct >= 0 ? 'up' : 'down';
  const arrow = direction === 'up' ? '▲' : '▼';
  const message = `${stock.symbol} ${arrow} ${Math.abs(reportedPct).toFixed(2)}% / 5min`;
  return { symbol: stock.symbol, direction, pct: round2(reportedPct), accurate, message };
}

module.exports = {
  newCharacter,
  resetCharacterKeepCosmetics,
  resetCharacterSeasonWipe,
  SECUMAX_TIERS,
  ensureSecumaxState,
  ensureSecumaxBilled,
  checkSecumaxBlock,
  VARIETY_TIERS,
  VARIETY_RENOUNCE_COST,
  VARIETY_RENOUNCE_AMOUNT,
  ensureVarietyState,
  varietyTierFor,
  isVarietyTimedOut,
  isEnjoyed,
  addVariety,
  CHILL_VARIETY_GAIN,
  doEnjoyPlayer,
  renounceVariety,
  doWork,
  doSlut,
  doCrime,
  doSpinRedBlueCrate,
  RED_BLUE_CRATE_COST,
  doSpinShalomCrate,
  SHALOM_CRATE_COST,
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
  doBjDouble,
  doBjSplit,
  doSlotSpin,
  drawCard,
  handTotal,
  isBlackjack,
  spinRoulette,
  evaluateRouletteBet,
  ROULETTE_COLOR_BY_NUMBER,
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
  ensureFarmsState,
  doBuyFarmPlot,
  doPrepFarmPlot,
  doPlantFarmSeed,
  doCollectFarmHarvest,
  doBuyFarmSecurity,
  advanceFarmPlot,
  FARM_UNLOCK_UNITS_SOLD,
  FARM_PLOT_COST,
  FARM_PREP_COST,
  FARM_SEED_COST_BY_DRUG,
  FARM_SECURITY_MAX_TIER,
  FARM_MAX_QTY,
  farmConfiscationChance,
  ensureCryptoState,
  doBuyCryptoUpgrade,
  doAdvanceCryptoMachine,
  doPrestigeCryptoRig,
  cryptoNextTrackCost,
  cryptoTracksMaxed,
  doCollectCrypto,
  doSellFC,
  doBuyFC,
  COLD_STORAGE_BASE_CAP,
  COLD_STORAGE_UPGRADE_TIERS,
  coldStorageCapacity,
  doDepositColdStorage,
  doWithdrawColdStorage,
  doBuyColdStorageUpgrade,
  cryptoDailyRate,
  cryptoPrestigeRateMultiplier,
  cryptoPrestigeCostMultiplier,
  cryptoMachineScaling,
  CRYPTO_MACHINES,
  CRYPTO_UPGRADE_TIERS,
  FC_START_PRICE,
  ALTCOIN_MINT_COST_FC,
  ALTCOIN_SUPPLY,
  ALTCOIN_START_PRICE,
  ALTCOIN_END_PRICE,
  altcoinPriceAt,
  altcoinBuyCost,
  altcoinPoolRaised,
  doMintAltcoin,
  doBuyAltcoinCoins,
  altcoinDumpPayout,
  altcoinFullBuyoutPayout,
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
  ensureSlimeState,
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
  LEADERBOARD_TITLES,
  LEADERBOARD_CATEGORIES,
  ensureProfileState,
  characterOwnsTitle,
  doSetProfileStatus,
  doSetProfileBanner,
  doToggleProfilePrivacy,
  doAddShowcaseTitle,
  doRemoveShowcaseTitle,
  doAddSlabShowcase,
  doRemoveSlabShowcase,
  isGradedTitleId,
  doPostToWall,
  doDeleteWallPost,
  paginateWall,
  PROFILE_SHOWCASE_MAX,
  PROFILE_SLAB_SHOWCASE_MAX,
  PROFILE_SLAB_MARKET_MAX,
  PROFILE_STATUS_MAX_LEN,
  PROFILE_WALL_POST_MAX_LEN,
  computeCharacterLevel,
  looksTrainMult,
  computeNetWorth,
  computeLeaderboardWinners,
  buildLeaderboardBoard,
  gradedCollectionValue,
  foilSlabValue,
  getRemainingCooldown,
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
  graderValueMult,
  rollSubgains,
  SUBGAIN_KEYS,
  SUBGAIN_LABELS,
  SUBGAIN_SPREAD,
  isFirstEditionEligible,
  doCrackSlab,
  NMG_CRACK_COST,
  isCosmeticInventoryId,
  nmgBaseIdOf,
  rollNmgGrade,
  isFoilTitleId,
  doFoilAscension,
  FOIL_ASCENSION_COST,
  FOIL_ASCENSION_COPIES,
  NMG_REGRADE_FEES,
  nmgRegradeFee,
  parseGradedId,
  detachGradedIdFromShowcases,
  COSMETIXX_MARKET_SLOT_COUNT,
  COSMETIXX_MARKET_ROTATION_MS,
  generateCosmetixxMarketSlots,
  COSMETIXX_MARKET_GRADER_WEIGHTS,
  REGISTRY_SETS,
  REGISTRY_REWARD_TITLES,
  REGISTRY_MASTER_SET_GPA,
  REGISTRY_PERFECT_SET_GPA,
  computeBestGradedHoldings,
  computeSetProgress,
  clampStat,
  NPC_TYPES,
  COOLDOWN_MS,
  recomputeLooks,
  computeBodyLooksScore,
  computeFaceLooksScore,
  isMaxxComplete,
  doStretchForHeight,
  ensureWeightState,
  STOCK_DEFINITIONS,
  STOCK_TICK_MS,
  advanceStockTicks,
  applyStockNewsShock,
  ensureStocksState,
  doBuyStock,
  doSellStock,
  generateInvestorBotPost,
  generateL2Post,
  pickRandom,
  randInt,
  randFloat,
  STOCK_SPREAD,
  BANK_TIERS,
};
