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

const CRIME_TIERS_BY_ID = {
  shoplift: { id: 'shoplift', name: '🛍️ Shoplifting', minReward: 80, maxReward: 200, jailYears: 1, baseRisk: 0.35 },
  pettytheft: { id: 'pettytheft', name: '👛 Petty Theft', minReward: 350, maxReward: 650, jailYears: 1, baseRisk: 0.45 },
  burglary: { id: 'burglary', name: '🏚️ Burglary', minReward: 1200, maxReward: 2200, jailYears: 4, baseRisk: 0.5 },
  grandtheft: { id: 'grandtheft', name: '🚗 Grand Theft Auto', minReward: 4000, maxReward: 6000, jailYears: 10, baseRisk: 0.6 },
};
const CRIME_COOLDOWN_MS = 12000;
const CRIME_RISK_MIN = 0.05;
const CRIME_STAT_MITIGATION = 0.5;
const COMMUNITY_SERVICE_COOLDOWN_MS = 60000;
const COMMUNITY_SERVICE_BASE_COST = 750;
const COMMUNITY_SERVICE_STREAK_REDUCTION = 2;

const GYM_BURN_LBS = 0.5;
const GYM_COST = 20;
const GYM_LOOKS_GAIN = 0.5;
const GYM_SPEED_GAIN = 0.6;
const STEROID_TIERS_BY_ID = {
  mild: { id: 'mild', name: '💊 Mild Cycle', mult: 1.75, jailChance: 0.2, jailClicks: 3 },
  standard: { id: 'standard', name: '💉 Standard Cycle', mult: 3, jailChance: 0.4, jailClicks: 5 },
  heavy: { id: 'heavy', name: '☠️ Heavy Cycle', mult: 5, jailChance: 0.6, jailClicks: 9 },
};
const ROID_ESCAPE_COST = GYM_COST * 4;

const CALORIES_PER_LB = 3500;
const DEFENSE_PER_LB = 1;
const SPEED_LOSS_PER_LB = 1;
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
const CONCEALED_APPLY_COST = 2000;
const CONCEALED_WAIT_MS = 10 * 60 * 1000;

const JAIL_WORKOUT_COOLDOWN_MS = 6000;
const JAIL_WORKOUT_GAIN_MIN = 0.1;
const JAIL_WORKOUT_GAIN_MAX = 0.25;
const JAIL_FIGHT_COOLDOWN_MS = 8000;
const JAIL_FIGHT_STAT_GAIN_MIN = 0.1;
const JAIL_FIGHT_STAT_GAIN_MAX = 0.3;
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

const JOB_RANKS = [
  { minAvg: 0, title: 'Trainee', payMin: 0.10, payMax: 0.50, cooldownMs: 2000 },
  { minAvg: 15, title: 'Associate', payMin: 0.20, payMax: 0.75, cooldownMs: 1800 },
  { minAvg: 35, title: 'Senior Associate', payMin: 0.40, payMax: 1.10, cooldownMs: 1600 },
  { minAvg: 55, title: 'Supervisor', payMin: 0.70, payMax: 1.80, cooldownMs: 1400 },
  { minAvg: 75, title: 'Manager', payMin: 1.15, payMax: 2.75, cooldownMs: 1200 },
  { minAvg: 95, title: 'Regional Manager', payMin: 1.80, payMax: 4.00, cooldownMs: 1000 },
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
};

const DRUG_ITEMS_BY_ID = {
  drugWeed: { id: 'drugWeed', name: '🌿 Weed', type: 'drug', wholesaleCost: 20, sellMin: 30, sellMax: 50, jailYearsPerUnit: 0.2, riskBase: 0.05, riskPerUnit: 0.02 },
  drugPills: { id: 'drugPills', name: '💊 Pills', type: 'drug', wholesaleCost: 60, sellMin: 90, sellMax: 140, jailYearsPerUnit: 0.5, riskBase: 0.12, riskPerUnit: 0.03 },
  drugMeth: { id: 'drugMeth', name: '🧪 Meth', type: 'drug', wholesaleCost: 100, sellMin: 160, sellMax: 260, jailYearsPerUnit: 1.5, riskBase: 0.25, riskPerUnit: 0.05 },
  drugCoke: { id: 'drugCoke', name: '❄️ Cocaine', type: 'drug', wholesaleCost: 150, sellMin: 220, sellMax: 320, jailYearsPerUnit: 1, riskBase: 0.2, riskPerUnit: 0.04 },
};

const DEALER_TIERS_BY_ID = {
  guzman: { id: 'guzman', name: '🕴️ Guzman Nestor', drugId: 'drugWeed', unlockUnits: 0 },
  esteban: { id: 'esteban', name: '🕴️ Esteban Vico', drugId: 'drugPills', unlockUnits: 40 },
  ramon: { id: 'ramon', name: '🕴️ Ramon Castillo', drugId: 'drugMeth', unlockUnits: 100 },
  dmitri: { id: 'dmitri', name: '🕴️ Dmitri Kovash', drugId: 'drugCoke', unlockUnits: 200 },
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
};
const NPC_CITIZEN = NPC_TYPES.citizen;

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

const MAXX_ITEMS_BY_ID = {
  mewing: { id: 'mewing', name: '💋 Mewing Course', cost: 500, looks: 1, desc: '+1 Looks' },
  bonesmash: { id: 'bonesmash', name: '🔨 Bone Smashing Kit', cost: 1600, looks: 2, desc: '+2 Looks' },
  hairline: { id: 'hairline', name: '💇 Hair Transplant', cost: 3200, looks: 3, desc: '+3 Looks' },
  jaw: { id: 'jaw', name: '💉 Jawline Filler', cost: 5200, looks: 4, desc: '+4 Looks' },
  canthal: { id: 'canthal', name: '👁️ Canthal Tilt Surgery', cost: 10000, looks: 6, desc: '+6 Looks' },
  limblength: { id: 'limblength', name: '🦴 Limb Lengthening Surgery', cost: 12000, height: 1, speed: 1, desc: '+1" Height, +1 Speed' },
};

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const SLOT_SYMBOLS = [
  { symbol: '\u{1F352}', weight: 35, three: 2 }, // cherries
  { symbol: '\u{1F34B}', weight: 25, three: 3 }, // lemon
  { symbol: '\u{1F514}', weight: 20, three: 5 }, // bell
  { symbol: '⭐', weight: 12, three: 10 }, // star
  { symbol: '7️⃣', weight: 6, three: 20 }, // seven
  { symbol: '\u{1F48E}', weight: 2, three: 50 }, // diamond
];

const DEALER_TIER_IDS = ['guzman', 'esteban', 'ramon', 'dmitri'];
const CRIME_TIER_IDS = ['shoplift', 'pettytheft', 'burglary', 'grandtheft'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function clampStat(v) {
  return Math.max(0, Math.min(STAT_CAP, v));
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function round2(v) {
  return Math.round(v * 100) / 100;
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
  return 1 + Math.max(0, Math.sqrt(character.stats.looks / 100) - Math.sqrt(LOOKS_TRAIN_BASE / 100)) * LOOKS_TRAIN_K;
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
    weightGained: 0,
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
    gym: { steroidTier: null, roidJailClicksRemaining: 0 },
    jail: { inJail: false, crime: null, yearsRemaining: 0, serving: false, contrabandAtkBonus: 0 },
    settings: { hideMilosWarning: false },
    titles: { owned: [], equipped: null, customTitles: [] },
    marriage: { proposedTo: null, spouseName: null },
    licenses: { gunSafety: false, concealedPermit: false, concealedPendingUntil: 0 },
    inventory: [],
    equipment: { helmet: null, chest: null, pants: null, feet: null, holsterL: null, holsterR: null, openCarry: null, melee: null },
    weaponSkills: { shooting: 0, draw: 0, magReload: 0 },
    bank: { tier: 0, balance: 0, hasCreditCard: false, creditBalance: 0, lastBillTs: Date.now() },
    arrestRecord: [],
    jobs: { currentJob: null, skills: { skill1: 0, skill2: 0, skill3: 0, skill4: 0 }, pizzaPerkGranted: false },
    badJobs: { currentJob: null, skills: { skill1: 0, skill2: 0, skill3: 0, skill4: 0 } },
    drugDealer: { unitsSold: 0 },
    crimeRecord: { streak: 0 },
    moralsCenter: { choice: null, lastTickTs: Date.now() },
    mtnHistory: [],
    maxxPurchased: [],
    blackjack: { phase: 'betting', playerCards: [], dealerCards: [], bet: 0 },
    combat: { active: false, enemyKey: null, enemyHp: 0, enemyMaxHp: 0, playerHp: 0, playerMaxHp: 0, turn: null, guarding: false },
  };
}

// Accounts created before blackjack moved server-side won't have this field yet.
function ensureBlackjackState(character) {
  if (!character.blackjack) {
    character.blackjack = { phase: 'betting', playerCards: [], dealerCards: [], bet: 0 };
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

function getRemainingCooldown(character, key, durationMs = COOLDOWN_MS) {
  const last = character.cooldowns[key] || 0;
  const remaining = durationMs - (Date.now() - last);
  return remaining > 0 ? remaining : 0;
}

// Mirrors the client's doHustle('work') branch exactly, but takes character as a parameter
// (no shared global) and enforces the cooldown server-side instead of trusting the caller.
function doWork(character) {
  const remaining = getRemainingCooldown(character, 'work', COOLDOWN_MS);
  if (remaining > 0) {
    return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  }

  const gain = randInt(2, 10);
  character.cash += gain;
  character.alliance = clampStat(character.alliance - ALLIANCE_BUFF);
  character.cooldowns.work = Date.now();

  return { ok: true, message: `Worked a shift: +${gain} Floydbucks.`, cls: 'gain', character };
}

// Mirrors the client's doHustle('slut') branch exactly.
function doSlut(character) {
  const remaining = getRemainingCooldown(character, 'slut', COOLDOWN_MS);
  if (remaining > 0) {
    return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  }

  const messages = [];
  const gain = randInt(5, 60);
  character.cash += gain;
  character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF_MINOR);
  messages.push({ message: `Turned a trick: +${gain} Floydbucks.`, cls: 'gain' });
  if (Math.random() < 0.3) {
    character.cash = Math.max(0, character.cash - gain);
    messages.push({ message: `You got robbed! -${gain} Floydbucks.`, cls: 'loss' });
  }
  character.cooldowns.slut = Date.now();

  return { ok: true, messages, character };
}

// Mirrors the client's doHustle('crime') branch exactly, including the jail-bust path.
function doCrime(character) {
  const remaining = getRemainingCooldown(character, 'crime', COOLDOWN_MS);
  if (remaining > 0) {
    return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };
  }

  character.cooldowns.crime = Date.now();

  if (Math.random() < 0.3) {
    const years = 1 + character.crimeRecord.streak;
    character.crimeRecord.streak = Math.min(CRIME_STREAK_MAX, character.crimeRecord.streak + 1);
    character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
    character.jail.inJail = true;
    character.jail.crime = 'Crime';
    character.jail.yearsRemaining = years;
    character.jail.serving = false;
    const streakNote = years > 1 ? ` Repeat offender: +${years - 1} year(s) added to your usual sentence.` : '';
    return {
      ok: true,
      messages: [{ message: `Busted committing a crime! Sentenced to ${years} year(s).${streakNote}`, cls: 'loss' }],
      jailed: true,
      character,
    };
  }

  const gain = randInt(100, 1000);
  character.cash += gain;
  character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF);

  return { ok: true, messages: [{ message: `Pulled off a crime: +${gain} Floydbucks.`, cls: 'gain' }], jailed: false, character };
}

// Mirrors the client's doWorkout() exactly. No cooldown -- gated by fuel (weightGained) and cash
// only, same as the client.
function doWorkout(character) {
  const tier = character.gym.steroidTier ? STEROID_TIERS_BY_ID[character.gym.steroidTier] : null;
  const cost = GYM_COST * (tier ? tier.mult : 1);
  if (character.weightGained < GYM_BURN_LBS) return { ok: false, reason: 'Not enough fuel -- eat at Pete\'sza first.' };
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };

  character.cash -= cost;
  character.weightGained = Math.max(0, character.weightGained - GYM_BURN_LBS);

  if (character.gym.roidJailClicksRemaining > 0) {
    character.gym.roidJailClicksRemaining -= 1;
    return { ok: true, message: 'Roid jail workout: paid, burned fuel, got nothing. Ouch.', cls: 'loss', character };
  }
  if (tier && Math.random() < tier.jailChance) {
    character.gym.roidJailClicksRemaining = tier.jailClicks;
    return { ok: true, message: `${tier.name} backfired! Thrown into Roid Jail for ${tier.jailClicks} clicks.`, cls: 'loss', character };
  }
  const mult = tier ? tier.mult : 1;
  const looksGain = GYM_LOOKS_GAIN * mult;
  const speedGain = GYM_SPEED_GAIN * mult;
  character.stats.looks = clampStat(character.stats.looks + looksGain);
  character.stats.speed = clampStat(character.stats.speed + speedGain);
  return { ok: true, message: `Workout complete: +${round1(looksGain)} Looks, +${round1(speedGain)} Speed.`, cls: 'gain', character };
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
  const item = FOOD_ITEMS_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'Unknown food item.' };

  const cost = round2(item.cost * (hasMilos11Discount(character) ? 0.8 : 1));
  if (character.cash < cost) return { ok: false, reason: 'Not enough Floydbucks.' };

  character.cash -= cost;
  const lbs = item.calories / CALORIES_PER_LB;
  character.weightGained += lbs;
  character.stats.defense = clampStat(character.stats.defense + lbs * DEFENSE_PER_LB);
  character.stats.speed = clampStat(character.stats.speed - lbs * SPEED_LOSS_PER_LB);
  return {
    ok: true,
    message: `Ate a ${item.name}: +${round1(lbs)} lbs, +${round1(lbs * DEFENSE_PER_LB)} Defense, -${round1(lbs * SPEED_LOSS_PER_LB)} Speed.`,
    cls: 'loss',
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
  if (item.looks) character.stats.looks = clampStat(character.stats.looks + item.looks);
  if (item.speed) character.stats.speed = clampStat(character.stats.speed + item.speed);
  if (item.height) character.height += item.height;
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

// Mirrors the client's doResolveBlackjack() exactly -- dealer draws to 17, then settles the bet.
function resolveBlackjack(character) {
  const bj = character.blackjack;
  while (handTotal(bj.dealerCards) < 17) {
    bj.dealerCards.push(drawCard());
  }
  const playerTotal = handTotal(bj.playerCards);
  const dealerTotal = handTotal(bj.dealerCards);
  const playerBJ = isBlackjack(bj.playerCards);
  const dealerBJ = isBlackjack(bj.dealerCards);

  let payout = 0;
  let msg = '';
  if (playerBJ && dealerBJ) {
    payout = bj.bet;
    msg = 'Both blackjack! Push.';
  } else if (playerBJ) {
    payout = Math.floor(bj.bet * 2.5);
    msg = 'Blackjack! You win 3:2.';
  } else if (dealerBJ) {
    payout = 0;
    msg = 'Dealer blackjack. You lose.';
  } else if (dealerTotal > 21) {
    payout = bj.bet * 2;
    msg = `Dealer busts with ${dealerTotal}. You win!`;
  } else if (playerTotal > dealerTotal) {
    payout = bj.bet * 2;
    msg = `You win ${playerTotal} vs ${dealerTotal}.`;
  } else if (playerTotal === dealerTotal) {
    payout = bj.bet;
    msg = `Push at ${playerTotal}.`;
  } else {
    payout = 0;
    msg = `Dealer wins ${dealerTotal} vs ${playerTotal}.`;
  }

  character.chips += payout;
  const cls = payout > bj.bet ? 'gain' : (payout === bj.bet ? '' : 'loss');
  bj.phase = 'betting';
  return { ok: true, message: `${msg} (bet ${bj.bet}, payout ${payout})`, cls, resolved: true, character };
}

// Multiplayer table blackjack reuses drawCard/handTotal/isBlackjack (already module-scope, not
// character-specific) plus this standalone payout function -- unlike the single-player
// resolveBlackjack, a bust has to be handled as a branch here instead of being intercepted at hit
// time, since a table round's payout only happens once, together, after every seat is done.
function computeTableBlackjackPayout(playerCards, dealerCards, bet) {
  const playerTotal = handTotal(playerCards);
  const dealerTotal = handTotal(dealerCards);
  const playerBJ = isBlackjack(playerCards);
  const dealerBJ = isBlackjack(dealerCards);

  if (playerTotal > 21) return { payout: 0, message: `Busted with ${playerTotal}. You lose.` };
  if (playerBJ && dealerBJ) return { payout: bet, message: 'Both blackjack! Push.' };
  if (playerBJ) return { payout: Math.floor(bet * 2.5), message: 'Blackjack! You win 3:2.' };
  if (dealerBJ) return { payout: 0, message: 'Dealer blackjack. You lose.' };
  if (dealerTotal > 21) return { payout: bet * 2, message: `Dealer busts with ${dealerTotal}. You win!` };
  if (playerTotal > dealerTotal) return { payout: bet * 2, message: `You win ${playerTotal} vs ${dealerTotal}.` };
  if (playerTotal === dealerTotal) return { payout: bet, message: `Push at ${playerTotal}.` };
  return { payout: 0, message: `Dealer wins ${dealerTotal} vs ${playerTotal}.` };
}

// ---------- Roulette (multiplayer tables only -- no single-player version existed before) ----------
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

// bet: { type: 'straight'|'redblack'|'evenodd'|'highlow', value: number|string, amount }
function evaluateRouletteBet(bet, resultNumber) {
  const color = ROULETTE_COLOR_BY_NUMBER[resultNumber];
  if (bet.type === 'straight') {
    return Number(bet.value) === resultNumber ? bet.amount * 36 : 0;
  }
  if (resultNumber === 0) return 0; // house number -- all even-money outside bets lose
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
  return 0;
}

// Mirrors the client's doBjDeal() exactly, including the natural-blackjack auto-resolve.
function doBjDeal(character, bet) {
  const bj = ensureBlackjackState(character);
  if (!bet || bet < 1) return { ok: false, reason: 'Enter a valid bet.' };
  if (bet > character.chips) return { ok: false, reason: 'Not enough Chips.' };

  character.chips -= bet;
  character.blackjack = { phase: 'playerTurn', playerCards: [drawCard(), drawCard()], dealerCards: [drawCard(), drawCard()], bet };

  if (isBlackjack(character.blackjack.playerCards) || isBlackjack(character.blackjack.dealerCards)) {
    return resolveBlackjack(character);
  }
  return { ok: true, resolved: false, character };
}

// Mirrors the client's doBjHit() exactly, including the instant-bust resolve.
function doBjHit(character) {
  const bj = ensureBlackjackState(character);
  if (bj.phase !== 'playerTurn') return { ok: false, reason: 'No hand in progress.' };

  bj.playerCards.push(drawCard());
  const total = handTotal(bj.playerCards);
  if (total > 21) {
    bj.phase = 'betting';
    const bet = bj.bet;
    bj.bet = 0;
    return { ok: true, message: `Busted with ${total}! You lose. (bet ${bet}, payout 0)`, cls: 'loss', resolved: true, character };
  }
  return { ok: true, resolved: false, character };
}

// Mirrors the client's doBjStand() exactly -- moves to the dealer's turn and settles.
function doBjStand(character) {
  const bj = ensureBlackjackState(character);
  if (bj.phase !== 'playerTurn') return { ok: false, reason: 'No hand in progress.' };
  bj.phase = 'dealerTurn';
  return resolveBlackjack(character);
}

function weightedSlotSymbol() {
  const totalWeight = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * totalWeight;
  for (const s of SLOT_SYMBOLS) {
    if (r < s.weight) return s;
    r -= s.weight;
  }
  return SLOT_SYMBOLS[0];
}

// Mirrors the client's doSlotSpin() exactly.
function doSlotSpin(character, bet) {
  if (!bet || bet < 1) return { ok: false, reason: 'Enter a valid bet.' };
  if (bet > character.chips) return { ok: false, reason: 'Not enough Chips.' };
  character.chips -= bet;

  const reels = [weightedSlotSymbol(), weightedSlotSymbol(), weightedSlotSymbol()];

  let payout = 0;
  let msg = '';
  if (reels[0].symbol === reels[1].symbol && reels[1].symbol === reels[2].symbol) {
    payout = bet * reels[0].three;
    msg = `Triple ${reels[0].symbol}! +${payout} chips.`;
  } else {
    const cherryCount = reels.filter((s) => s.symbol === SLOT_SYMBOLS[0].symbol).length;
    if (cherryCount >= 2) {
      payout = bet;
      msg = 'Two cherries — bet refunded.';
    } else {
      msg = 'No match. Better luck next spin.';
    }
  }

  character.chips += payout;
  return {
    ok: true,
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
function doGoodJobWork(character, skillKey) {
  const job = GOOD_JOBS_BY_ID[character.jobs.currentJob];
  if (!job) return { ok: false, reason: 'You are not employed.' };
  const skillIndex = SKILL_KEYS.indexOf(skillKey);
  if (skillIndex === -1) return { ok: false, reason: 'Unknown skill.' };

  const cooldownKey = `jobSkill${skillIndex + 1}`;
  const rank = goodJobRank(character);
  const remaining = getRemainingCooldown(character, cooldownKey, rank.cooldownMs);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  const ceoActive = goodJobSkillAvg(character) >= GOOD_CEO_MIN_AVG && character.alliance <= COMBAT_GOOD_MAX_ALLIANCE;
  const gain = round2(randFloat(rank.payMin, rank.payMax) * (ceoActive ? GOOD_CEO_MULTIPLIER : 1));
  character.cash = round2(character.cash + gain);
  const skillGain = randFloat(JOB_SKILL_TRAIN_MIN, JOB_SKILL_TRAIN_MAX) * goodJobSkillTrainMult(character);
  character.jobs.skills[skillKey] = clampStat(character.jobs.skills[skillKey] + skillGain);
  character.cooldowns[cooldownKey] = Date.now();
  character.alliance = clampStat(character.alliance - ALLIANCE_BUFF);

  const messages = [{ message: `${job.name}: +$${gain.toFixed(2)}${ceoActive ? ' (👔 CEO Bonus)' : ''}.`, cls: 'gain' }];
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
function doBadJobWork(character, skillKey) {
  const job = BAD_JOBS_BY_ID[character.badJobs.currentJob];
  if (!job) return { ok: false, reason: 'You are not employed.' };
  const skillIndex = SKILL_KEYS.indexOf(skillKey);
  if (skillIndex === -1) return { ok: false, reason: 'Unknown skill.' };

  const cooldownKey = `badJobSkill${skillIndex + 1}`;
  const rank = badJobRank(character);
  const remaining = getRemainingCooldown(character, cooldownKey, rank.cooldownMs);
  if (remaining > 0) return { ok: false, reason: `Still on cooldown for ${Math.ceil(remaining / 1000)}s.` };

  character.cooldowns[cooldownKey] = Date.now();
  if (Math.random() < badJobBustChance(character)) {
    const years = BAD_JOB_JAIL_YEARS + character.crimeRecord.streak;
    character.crimeRecord.streak = Math.min(CRIME_STREAK_MAX, character.crimeRecord.streak + 1);
    character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
    character.jail.inJail = true;
    character.jail.crime = job.name;
    character.jail.yearsRemaining = years;
    character.jail.serving = false;
    const streakNote = years > BAD_JOB_JAIL_YEARS ? ` (${BAD_JOB_JAIL_YEARS} base + ${years - BAD_JOB_JAIL_YEARS} repeat-offender)` : '';
    return {
      ok: true,
      jailed: true,
      message: `Busted working for ${job.name}! Sentenced to ${years} year(s)${streakNote}.`,
      cls: 'loss',
      character,
    };
  }

  const gain = round2(randFloat(rank.payMin, rank.payMax));
  character.cash = round2(character.cash + gain);
  const skillGain = randFloat(JOB_SKILL_TRAIN_MIN, JOB_SKILL_TRAIN_MAX) * badJobSkillTrainMult(character);
  character.badJobs.skills[skillKey] = clampStat(character.badJobs.skills[skillKey] + skillGain);
  character.alliance = clampStat(character.alliance + ALLIANCE_DEBUFF);
  return { ok: true, jailed: false, message: `${job.name}: +$${gain.toFixed(2)}.`, cls: 'gain', character };
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

// Mirrors the client's doSellDrugs() exactly, plus one addition: the client trusted its own UI to
// clamp the sell quantity to what you actually own, but a direct API call has no such UI in the
// way, so an unowned-quantity sale would otherwise mint Floydbucks from nothing. Added an
// ownership check the original never needed.
function doSellDrugs(character, drugId, qty) {
  const drug = DRUG_ITEMS_BY_ID[drugId];
  if (!drug) return { ok: false, reason: 'Unknown drug.' };
  if (!qty || qty < 1) return { ok: false, reason: 'Enter a valid quantity.' };
  if (qty > inventoryQty(character, drugId)) return { ok: false, reason: "You don't have that many to sell." };

  const riskChance = Math.min(0.9, drug.riskBase + (qty - 1) * drug.riskPerUnit);
  if (Math.random() < riskChance) {
    const years = Math.max(1, Math.round(drug.jailYearsPerUnit * qty));
    removeFromInventory(character, drugId, qty);
    character.alliance = clampStat(Math.max(character.alliance, GUZMAN_MIN_ALLIANCE));
    character.jail.inJail = true;
    character.jail.crime = `Selling ${drug.name}`;
    character.jail.yearsRemaining = years;
    character.jail.serving = false;
    return { ok: true, jailed: true, message: `Busted selling ${qty}x ${drug.name}! Sentenced to ${years} year(s).`, cls: 'loss', character };
  }

  const unitPrice = randFloat(drug.sellMin, drug.sellMax);
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
  const looks = character.stats.looks;
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
  return { ok: true, jailed: true, message: `They noticed, fought back, and beat you! Sentenced to ${ROBBERY_JAIL_YEARS} year.`, cls: 'loss', character };
}

// PvP robbery of a specific real target (as opposed to doRobbery's flavor-text "stranger"). Same
// risk profile as the PvE version -- same odds math, same jail penalty on failure -- but the cash
// actually moves between two real characters, and the cooldown is keyed to this specific
// attacker-target pair so hitting someone doesn't lock you out of robbing anyone else.
const PVP_ROBBERY_COOLDOWN_MS = 5 * 60 * 1000;

function doRobPlayer(attacker, target, targetUserId, activeModifier) {
  if (activeModifier === 'peace') return { ok: false, reason: 'Robbery is disabled -- Peace & Prosperity.' };

  const cooldownKey = `rob_${targetUserId}`;
  const remaining = getRemainingCooldown(attacker, cooldownKey, PVP_ROBBERY_COOLDOWN_MS);
  if (remaining > 0) return { ok: false, reason: `You need to wait ${Math.ceil(remaining / 1000)}s before robbing them again.` };

  attacker.cooldowns[cooldownKey] = Date.now();
  const speed = attacker.stats.speed;
  const looks = attacker.stats.looks;
  const findOutChance = Math.max(0.1, Math.min(0.55, 0.55 - (speed / 100) * 0.35 - (looks / 100) * 0.10));

  if (Math.random() >= findOutChance) {
    const gain = Math.min(round2(randFloat(ROBBERY_MIN, ROBBERY_MAX)), target.cash);
    attacker.cash = round2(attacker.cash + gain);
    target.cash = round2(target.cash - gain);
    attacker.alliance = clampStat(attacker.alliance + ALLIANCE_DEBUFF);
    return { ok: true, jailed: false, message: `Robbed ${target.firstName} ${target.lastName} for $${gain.toFixed(2)} and got away clean.`, cls: 'gain', attacker, target };
  }

  const winChance = Math.max(0.15, Math.min(0.85, 0.5 + (attacker.stats.attack - target.stats.attack) * 0.015));
  if (Math.random() < winChance) {
    const gain = Math.min(round2(randFloat(ROBBERY_MIN, ROBBERY_MAX) * 0.5), target.cash);
    attacker.cash = round2(attacker.cash + gain);
    target.cash = round2(target.cash - gain);
    attacker.alliance = clampStat(attacker.alliance + ALLIANCE_DEBUFF);
    return {
      ok: true,
      jailed: false,
      message: `${target.firstName} noticed and fought back! You won the scuffle and got away with $${gain.toFixed(2)}.`,
      cls: 'gain',
      attacker,
      target,
    };
  }

  const years = ROBBERY_JAIL_YEARS + attacker.crimeRecord.streak;
  attacker.crimeRecord.streak = Math.min(CRIME_STREAK_MAX, attacker.crimeRecord.streak + 1);
  attacker.alliance = clampStat(Math.max(attacker.alliance, GUZMAN_MIN_ALLIANCE));
  attacker.jail.inJail = true;
  attacker.jail.crime = 'Attempted Robbery';
  attacker.jail.yearsRemaining = years;
  attacker.jail.serving = false;
  const streakNote = years > ROBBERY_JAIL_YEARS ? ` (${ROBBERY_JAIL_YEARS} base + ${years - ROBBERY_JAIL_YEARS} repeat-offender)` : '';
  return {
    ok: true,
    jailed: true,
    message: `${target.firstName} noticed, fought back, and beat you! Sentenced to ${years} year(s)${streakNote}.`,
    cls: 'loss',
    attacker,
    target,
  };
}

// Minimal version of the client's getItemDef() -- only the fields Combat needs (atkBonus,
// statBonuses), so only the item tables that carry those.
function combatItemDef(itemId) {
  return GUN_ITEMS_BY_ID[itemId] || MELEE_ITEMS_BY_ID[itemId] || WRESTLING_GEAR_ITEMS_BY_ID[itemId] || null;
}

function pickOpponentPool(character) {
  if (character.alliance <= COMBAT_GOOD_MAX_ALLIANCE) return ['gangster', 'thug'];
  if (character.alliance >= GUZMAN_MIN_ALLIANCE) return ['citizen', 'cop'];
  return ['citizen', 'cop', 'thug', 'gangster'];
}

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
  const ids = [character.equipment.helmet, character.equipment.chest, character.equipment.pants, character.equipment.feet].filter(Boolean);
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
  const key = pool[randInt(0, pool.length - 1)];
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
  const wasGoodFight = character.combat.enemyKey === 'gangster' || character.combat.enemyKey === 'thug';
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

// Applies the flat cash prize from loser to winner once a duel ends, whether by knockout or
// forfeit -- mutates both character objects, caller saves them.
function applyDuelOutcome(winnerCharacter, loserCharacter) {
  const reward = Math.min(loserCharacter.cash, randInt(DUEL_CASH_REWARD_MIN, DUEL_CASH_REWARD_MAX));
  loserCharacter.cash = round2(loserCharacter.cash - reward);
  winnerCharacter.cash = round2(winnerCharacter.cash + reward);
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
    const streakNote = years > tier.jailYears ? ` (${tier.jailYears} base + ${years - tier.jailYears} repeat-offender)` : '';
    return { ok: true, jailed: true, message: `Busted committing ${tier.name}! Sentenced to ${years} year(s)${streakNote}.`, cls: 'loss', character };
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
  const cost = COMMUNITY_SERVICE_BASE_COST * (1 + character.crimeRecord.streak);
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
  const atkGain = round2(randFloat(JAIL_WORKOUT_GAIN_MIN, JAIL_WORKOUT_GAIN_MAX));
  const defGain = round2(randFloat(JAIL_WORKOUT_GAIN_MIN, JAIL_WORKOUT_GAIN_MAX));
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
    const amount = round2(randFloat(JAIL_FIGHT_STAT_GAIN_MIN, JAIL_FIGHT_STAT_GAIN_MAX));
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

// Mirrors the client's doMarriagePropose() exactly -- no real recipient handshake yet (that needs
// the other player's account, not just their name), same as before this was ported.
function doMarriagePropose(character, name) {
  if (!name) return { ok: false, reason: 'Enter a username.' };
  character.marriage.proposedTo = name;
  return { ok: true, message: `Proposal sent to ${name}. They'll see it in their City Hall once multiplayer is live.`, cls: 'gain', character };
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

// ---------- Leaderboard (Looks / Net Worth / Level) ----------
// Title ids must match the client's title catalog (core.js) exactly -- these are the only
// server-known title ids, since granting/revoking them is the one case where the server needs to
// understand a specific title rather than treating character.titles as opaque client data.
const LEADERBOARD_TITLES = {
  looks: { id: 'looksmaxxer', name: 'LOOKSMAXXER' },
  networth: { id: 'highestNetWorth', name: 'HIGHEST NET WORTH' },
  level: { id: 'highestLevel', name: 'HIGHEST LEVEL' },
};

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
  return computeCharacterLevel(character);
}

// Ties broken by lowest user id (i.e. whoever got there first), so the crown doesn't flicker
// between tied players on every recheck.
function computeLeaderboardWinners(users) {
  const winners = {};
  ['looks', 'networth', 'level'].forEach((category) => {
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
  ['looks', 'networth', 'level'].forEach((category) => {
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

module.exports = {
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
  drawCard,
  handTotal,
  isBlackjack,
  computeTableBlackjackPayout,
  spinRoulette,
  evaluateRouletteBet,
  ROULETTE_COLOR_BY_NUMBER,
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
  doMarriagePropose,
  doGunSafetyResult,
  doRangeShoot,
  doRangeDraw,
  doRangeReload,
  doCreateListing,
  doCancelListing,
  doBuyListing,
  creditSellerForSale,
  LEADERBOARD_TITLES,
  computeCharacterLevel,
  looksTrainMult,
  computeNetWorth,
  computeLeaderboardWinners,
  buildLeaderboardBoard,
  getRemainingCooldown,
  round2,
  COOLDOWN_MS,
};
