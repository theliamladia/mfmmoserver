// ---------- Game logic, ported from mfmmoalpha's client-side core.js/market.js ----------
// Same shape and constants as the client so a character row here is a drop-in match for what
// the client already knows how to render. Only the "work" hustle is wired up server-side so far --
// this is the first vertical slice proving the client/server split; everything else on the client
// still runs locally until it gets ported the same way.

const STAT_CAP = 100;
const COOLDOWN_MS = 10000;
const ALLIANCE_BUFF = 2; // legal work nudges toward Holy Good

const DEALER_TIER_IDS = ['guzman', 'esteban', 'ramon', 'dmitri'];
const CRIME_TIER_IDS = ['shoplift', 'pettytheft', 'burglary', 'grandtheft'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampStat(v) {
  return Math.max(0, Math.min(STAT_CAP, v));
}

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
    jail: { inJail: false, crime: null, yearsRemaining: 0, serving: false },
    settings: { hideMilosWarning: false },
    titles: { owned: [], equipped: null },
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
  };
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

module.exports = { newCharacter, doWork, getRemainingCooldown, COOLDOWN_MS };
