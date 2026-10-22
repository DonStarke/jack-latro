/* ==========================================================
   gameState.ts - SINGLE SOURCE OF TRUTH
   All mutable game state lives here. Other modules must use the
   exported functions below; they must never hold their own copies
   of score, hands, cash, interest-related values or jokers.
   Compiled as a plain global script (no import/export).
========================================================== */

/* ---------- Shared types ---------- */
type Suit = '♠' | '♥' | '♣' | '♦';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
type Enhancement = 'foil' | 'holo' | 'poly' | 'gold' | null;

interface Card {
  uid: number;
  suit: Suit;
  rank: Rank;
  enhancement: Enhancement;
}

type JokerRarity = 'common' | 'uncommon' | 'rare';
type JokerArchetype = 'mult' | 'chips' | 'econ' | 'utility' | 'suit';

interface JokerDef {
  id: string;
  name: string;
  cost: number;
  rarity: JokerRarity;
  isXMult: boolean;
  desc: string;
  bonusMult?: number;
  bonusChips?: number;
  icon?: string;
  archetype?: JokerArchetype;
  suitTheme?: Suit;
}

/** A Joker the player owns or that sits in the shop. */
interface JokerInstance extends JokerDef {
  shopType?: 'joker';
  bought?: boolean;
}

type ConsumableType = 'tarot' | 'cheat';

interface TarotDef {
  id: string;
  name: string;
  cost: number;
  desc: string;
  consumableType?: ConsumableType;
}

interface VoucherDef {
  id: string;
  name: string;
  cost: number;
  desc: string;
}

interface BossBlindDef {
  id: string;
  name: string;
  desc: string;
}

interface CardEffectDef {
  id: string;
  name: string;
  enhancement: 'foil' | 'holo' | 'poly' | 'gold';
  badge: string;
  icon: string;
  bonusText: string;
  desc: string;
  color: string;
  tarotSource: string;
}

interface ShopTarot extends TarotDef { shopType: 'tarot'; bought: boolean; }
interface ShopVoucher extends VoucherDef { shopType: 'voucher'; bought: boolean; }
interface ShopCardOffer {
  shopType: 'card';
  name: string;
  cost: number;
  desc: string;
  cardData: { rank: Rank; suit: Suit; enhancement: Enhancement };
  bought: boolean;
}
type PackType = 'joker' | 'tarot' | 'cheat' | 'card' | 'variety';

interface PackDef {
  id: string;
  name: string;
  packType: PackType;
  cost: number;
  cardsCount: number;
  chooseCount: number;
  desc: string;
  badge?: string;
  color?: string;
}

interface ShopPackSlot extends PackDef {
  shopType: 'pack';
  bought: boolean;
}

type PackCardOption =
  | { kind: 'joker'; data: JokerDef }
  | { kind: 'tarot'; data: TarotDef }
  | { kind: 'cheat'; data: TarotDef }
  | { kind: 'card'; data: { rank: Rank; suit: Suit; enhancement: Enhancement } };

interface ActivePackOpening {
  pack: ShopPackSlot;
  options: PackCardOption[];
  chosen: boolean;
  deckCards?: Card[];
  selectedDeckCardUid?: number | null;
}

type ShopJokerSlot = (JokerInstance & { shopType: 'joker'; bought: boolean }) | ShopTarot;
type ShopExtraSlot = ShopCardOffer | ShopVoucher;

interface PendingPayout {
  blindReward: number;
  handBonus: number;
  interest: number;
  totalEarned: number;
}

interface BalanceConfig {
  startingDeals: number;
  targetScalePct: number;
  unusedDealCashCap: number;
  pushRefundsDeal: boolean;
  anteHandScaling: boolean;
}

interface GameState {
  ante: number;
  blindIndex: number;
  bossBlind: BossBlindDef | null;
  targetScore: number;
  roundScore: number;
  money: number;
  maxHands: number;
  handsLeft: number;
  maxJokers: number;
  maxConsumables: number;
  baseWinChipBonus: number;
  baseWinMultBonus: number;

  deck: Card[];
  shoe: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  dealerHoleRevealed: boolean;
  inHand: boolean;
  isDealing: boolean;
  blindClearedReady: boolean;
  blindFailedReady: boolean;
  pendingPayout: PendingPayout | null;
  inShop: boolean;
  doubledDown: boolean;
  tempBonusChips: number;
  endlessMode?: boolean;
  handsWonInBlind?: number;
  previousHandTotal?: number | null;
  roundCashEarned?: number;

  jokers: JokerInstance[];
  consumables: (TarotDef | ShopTarot)[];
  vouchersBought: string[];

  rerollCost: number;
  shopJokers: ShopJokerSlot[];
  shopExtras: ShopExtraSlot[];
  shopPacks: ShopPackSlot[];
  activePackOpening: ActivePackOpening | null;

  /** The Ante number for which the current shop voucher was offered. */
  voucherAnte: number;
  /** The single voucher offered for this ante (persists across blinds until bought or next ante). */
  currentAnteVoucher: ShopVoucher | null;

  /** Comprehensive run telemetry and statistics. */
  runStats: RunStats;
}

interface OutcomeCounter {
  label: string;
  won: number;
  lost: number;
  push: number;
}

interface RunStats {
  handsPlayed: number;
  handsWon: number;
  handsLost: number;
  handsPushed: number;
  highestHandScore: number;
  totalScore: number;
  doubleDownAttempts: number;
  doubleDownWins: number;
  cardsDrawn: number;
  tarotsUsed: number;
  vouchersBoughtCount: number;

  outcomes: Record<string, OutcomeCounter>;

  moneyEarned: {
    blinds: number;
    unusedDeals: number;
    interest: number;
    inHandScoring: number;
    sales: number;
    loanShark: number;
    total: number;
  };
  moneySpent: {
    jokers: number;
    tarots: number;
    cards: number;
    vouchers: number;
    rerolls: number;
    loanSharkFees: number;
    total: number;
  };

  jokerTriggers: Record<string, { id: string; name: string; count: number }>;
}

/** Run-start constants (shared with the simulator so it can't drift from the live game). */
const STARTING_MONEY = 6;
const STARTING_MAX_JOKERS = 5;

/* ---------- Private state (not reachable outside the API) ---------- */
const DEFAULT_BALANCE_CONFIG: BalanceConfig = {
  startingDeals: 7,
  targetScalePct: 50,
  unusedDealCashCap: 0,
  pushRefundsDeal: true,
  anteHandScaling: true
};

let _balanceConfig: BalanceConfig = { ...DEFAULT_BALANCE_CONFIG };
let _nextCardUid = 1;

function createInitialRunStats(): RunStats {
  return {
    handsPlayed: 0,
    handsWon: 0,
    handsLost: 0,
    handsPushed: 0,
    highestHandScore: 0,
    totalScore: 0,
    doubleDownAttempts: 0,
    doubleDownWins: 0,
    cardsDrawn: 0,
    tarotsUsed: 0,
    vouchersBoughtCount: 0,
    outcomes: {
      CHARLIE: { label: '5-Card Charlie', won: 0, lost: 0, push: 0 },
      NATURAL: { label: 'Natural Blackjack', won: 0, lost: 0, push: 0 },
      EXACT21: { label: 'Exact 21', won: 0, lost: 0, push: 0 },
      CUSHIONED: { label: 'Cushioned 21 (Rubber Table)', won: 0, lost: 0, push: 0 },
      WIN: { label: 'Standard Win (Beat Dealer)', won: 0, lost: 0, push: 0 },
      DEALER_BUST: { label: 'Dealer Bust', won: 0, lost: 0, push: 0 },
      PUSH: { label: 'Push (Tie)', won: 0, lost: 0, push: 0 },
      PUSH_IT_GOOD: { label: 'Push It Good Win', won: 0, lost: 0, push: 0 },
      SAFETY_NET: { label: 'Safety Net Salvage', won: 0, lost: 0, push: 0 },
      BUST: { label: 'Player Bust', won: 0, lost: 0, push: 0 },
      LOSS: { label: 'Dealer Wins (Outscored)', won: 0, lost: 0, push: 0 }
    },
    moneyEarned: {
      blinds: 0,
      unusedDeals: 0,
      interest: 0,
      inHandScoring: 0,
      sales: 0,
      loanShark: 0,
      total: 0
    },
    moneySpent: {
      jokers: 0,
      tarots: 0,
      cards: 0,
      vouchers: 0,
      rerolls: 0,
      loanSharkFees: 0,
      total: 0
    },
    jokerTriggers: {}
  };
}

let _state: GameState = {
  ante: 1,
  blindIndex: 0,
  bossBlind: null,
  targetScore: 300,
  roundScore: 0,
  money: 6,
  maxHands: 7,
  handsLeft: 7,
  maxJokers: 5,
  maxConsumables: 2,
  baseWinChipBonus: 0,
  baseWinMultBonus: 0,

  deck: [],
  shoe: [],
  playerHand: [],
  dealerHand: [],
  dealerHoleRevealed: false,
  inHand: false,
  isDealing: false,
  blindClearedReady: false,
  blindFailedReady: false,
  pendingPayout: null,
  inShop: false,
  doubledDown: false,
  tempBonusChips: 0,
  endlessMode: false,
  handsWonInBlind: 0,
  previousHandTotal: null,
  roundCashEarned: 0,

  jokers: [],
  consumables: [],
  vouchersBought: [],

  rerollCost: 2,
  shopJokers: [],
  shopExtras: [],
  shopPacks: [],
  activePackOpening: null,

  voucherAnte: 0,
  currentAnteVoucher: null,
  runStats: createInitialRunStats()
};

/* ---------- Read API ---------- */
/** Read-only view of the whole state. Never mutate the returned object. */
function getState(): Readonly<GameState> {
  return _state;
}

function getBalanceConfig(): Readonly<BalanceConfig> {
  return _balanceConfig;
}

function hasJoker(id: string): boolean {
  return _state.jokers.some(j => j.id === id);
}

/* ---------- Write API ---------- */
/** Shallow-patch scalar/flag fields (score, flags, targets, bonuses...). */
function patchState(patch: Partial<GameState>): void {
  Object.assign(_state, patch);
}

function patchBalanceConfig(patch: Partial<BalanceConfig>): void {
  Object.assign(_balanceConfig, patch);
}

function addMoney(amount: number): void {
  _state.money += amount;
}

/** Returns false (and changes nothing) if the player cannot afford it. */
function spendMoney(amount: number): boolean {
  if (_state.money < amount) return false;
  _state.money -= amount;
  return true;
}

function addRoundScore(amount: number): void {
  _state.roundScore += amount;
}

/* Card uid + deck/shoe/hand zones */
function takeNextCardUid(): number {
  return _nextCardUid++;
}

function resetCardUid(): void {
  _nextCardUid = 1;
}

function setDeck(deck: Card[]): void { _state.deck = deck; }
function setShoe(shoe: Card[]): void { _state.shoe = shoe; }
function popShoeCard(): Card | undefined { return _state.shoe.pop(); }
function setPlayerHand(hand: Card[]): void { _state.playerHand = hand; }
function setDealerHand(hand: Card[]): void { _state.dealerHand = hand; }
function addCardToDeck(card: Card): void { _state.deck.push(card); }
function addCardToPlayerHand(card: Card): void { _state.playerHand.push(card); }
function addCardToDealerHand(card: Card): void { _state.dealerHand.push(card); }

function setCardEnhancement(card: Card, enhancement: Enhancement): void {
  card.enhancement = enhancement;
  const deckCard = _state.deck.find(c => c.uid === card.uid);
  if (deckCard) {
    deckCard.enhancement = enhancement;
  }
  const shoeCard = _state.shoe.find(c => c.uid === card.uid);
  if (shoeCard) {
    shoeCard.enhancement = enhancement;
  }
}

function setCardRank(card: Card, rank: Rank): void {
  card.rank = rank;
  const deckCard = _state.deck.find(c => c.uid === card.uid);
  if (deckCard) {
    deckCard.rank = rank;
  }
  const shoeCard = _state.shoe.find(c => c.uid === card.uid);
  if (shoeCard) {
    shoeCard.rank = rank;
  }
}

function setCardSuit(card: Card, suit: Suit): void {
  card.suit = suit;
  const deckCard = _state.deck.find(c => c.uid === card.uid);
  if (deckCard) {
    deckCard.suit = suit;
  }
  const shoeCard = _state.shoe.find(c => c.uid === card.uid);
  if (shoeCard) {
    shoeCard.suit = suit;
  }
}

function addCardToShoe(card: Card): void { _state.shoe.push(card); }

function removeCardFromGame(uid: number): void {
  _state.deck = _state.deck.filter(c => c.uid !== uid);
  _state.shoe = _state.shoe.filter(c => c.uid !== uid);
  _state.playerHand = _state.playerHand.filter(c => c.uid !== uid);
}

function markShopItemBought(listName: 'shopJokers' | 'shopExtras', idx: number): void {
  const item = _state[listName][idx];
  if (item) item.bought = true;
}

/* Jokers */
function addJoker(joker: JokerInstance): boolean {
  if (_state.jokers.length >= _state.maxJokers) return false;
  _state.jokers.push(joker);
  return true;
}

function removeJokerAt(index: number): JokerInstance | null {
  if (index < 0 || index >= _state.jokers.length) return null;
  return _state.jokers.splice(index, 1)[0];
}

/** dir: -1 = left, +1 = right. */
function moveJokerAt(index: number, dir: -1 | 1): void {
  const target = index + dir;
  if (index < 0 || index >= _state.jokers.length) return;
  if (target < 0 || target >= _state.jokers.length) return;
  const tmp = _state.jokers[index];
  _state.jokers[index] = _state.jokers[target];
  _state.jokers[target] = tmp;
}

/** For scaling jokers (Daredevil / Chip Stacker). */
function patchJoker(id: string, patch: Partial<JokerInstance>): void {
  for (const j of _state.jokers) {
    if (j.id === id) Object.assign(j, patch);
  }
}

/* Consumables, vouchers, shop */
function addConsumable(item: TarotDef | ShopTarot): boolean {
  if (_state.consumables.length >= _state.maxConsumables) return false;
  _state.consumables.push(item);
  return true;
}

function removeConsumableAt(index: number): TarotDef | ShopTarot | null {
  if (index < 0 || index >= _state.consumables.length) return null;
  return _state.consumables.splice(index, 1)[0];
}

function addVoucher(id: string): void {
  if (!_state.vouchersBought.includes(id)) _state.vouchersBought.push(id);
}

function markShopPackBought(idx: number): void {
  const item = _state.shopPacks[idx];
  if (item) item.bought = true;
}

function setShopStock(jokers: ShopJokerSlot[], extras: ShopExtraSlot[], packs: ShopPackSlot[] = []): void {
  _state.shopJokers = jokers;
  _state.shopExtras = extras;
  _state.shopPacks = packs;
}

/* ---------- Run Statistics & Telemetry Helpers ---------- */
function getRunStats(): RunStats {
  return _state.runStats;
}

function recordHandOutcomeStats(
  categoryKey: string,
  resultType: 'won' | 'lost' | 'push',
  handScore: number,
  cardsCount: number,
  isDouble: boolean
): void {
  const stats = _state.runStats;
  stats.handsPlayed++;
  stats.totalScore += handScore;
  if (handScore > stats.highestHandScore) {
    stats.highestHandScore = handScore;
  }
  stats.cardsDrawn += cardsCount;
  if (isDouble) {
    stats.doubleDownAttempts++;
    if (resultType === 'won') {
      stats.doubleDownWins++;
    }
  }
  if (resultType === 'won') stats.handsWon++;
  else if (resultType === 'push') stats.handsPushed++;
  else stats.handsLost++;

  if (stats.outcomes[categoryKey]) {
    stats.outcomes[categoryKey][resultType]++;
  }
}

function recordJokerTrigger(id: string, name?: string): void {
  const stats = _state.runStats;
  if (!stats.jokerTriggers[id]) {
    let resolvedName = name;
    if (!resolvedName && typeof JOKER_CATALOG !== 'undefined') {
      const found = JOKER_CATALOG.find(j => j.id === id);
      if (found) resolvedName = found.name;
    }
    stats.jokerTriggers[id] = { id, name: resolvedName || id, count: 0 };
  }
  stats.jokerTriggers[id].count++;
}

function recordMoneyEarned(category: keyof RunStats['moneyEarned'], amount: number): void {
  if (amount <= 0 || category === 'total') return;
  _state.runStats.moneyEarned[category] += amount;
  _state.runStats.moneyEarned.total += amount;
}

function recordMoneySpent(category: keyof RunStats['moneySpent'], amount: number): void {
  if (amount <= 0 || category === 'total') return;
  _state.runStats.moneySpent[category] += amount;
  _state.runStats.moneySpent.total += amount;
}

/* ==========================================================
   LIFETIME ITEM TELEMETRY & COMPENDIUM TRACKING
   Persists across all runs into localStorage
========================================================== */
interface JokerTelemetryData {
  discovered: number;
  roundsHeld: number;
  roundsWon: number;
  handsTriggered: number;
  chipsContributed: number;
  multContributed: number;
}

interface TarotTelemetryData {
  discovered: number;
  acquired: number;
  cast: number;
  castWon: number;
  sold: number;
}

interface VoucherTelemetryData {
  discovered: number;
  redeemed: number;
  earliestAnte: number | null;
  runsWon: number;
  estValue: number;
}

interface EffectTelemetryData {
  enhanced: number;
  timesScored: number;
  bonusImpact: number;
  deckSaturationPeak: number;
}

interface PackTelemetryData {
  discovered: number;
  opened: number;
  drafted: number;
  skipped: number;
  moneyInvested: number;
}

interface LifetimeTelemetryStore {
  schemaVersion: number;
  lastUpdated?: number;
  jokers: Record<string, JokerTelemetryData>;
  tarots: Record<string, TarotTelemetryData>;
  vouchers: Record<string, VoucherTelemetryData>;
  effects: Record<string, EffectTelemetryData>;
  packs: Record<string, PackTelemetryData>;
}

const GAME_VERSION = 'V0.12';
const CURRENT_TELEMETRY_SCHEMA_VERSION = 1;
const TELEMETRY_STORAGE_KEY = 'jacklatro_library_telemetry';
const TELEMETRY_BACKUP_KEY = 'jacklatro_library_telemetry_backup';
const TELEMETRY_CORRUPT_ARCHIVE_KEY = 'jacklatro_library_telemetry_corrupted_raw';

/* ---------- Safe Default Factory Templates ---------- */
function createDefaultJokerTelemetry(): JokerTelemetryData {
  return {
    discovered: 0,
    roundsHeld: 0,
    roundsWon: 0,
    handsTriggered: 0,
    chipsContributed: 0,
    multContributed: 0
  };
}

function createDefaultTarotTelemetry(): TarotTelemetryData {
  return {
    discovered: 0,
    acquired: 0,
    cast: 0,
    castWon: 0,
    sold: 0
  };
}

function createDefaultVoucherTelemetry(): VoucherTelemetryData {
  return {
    discovered: 0,
    redeemed: 0,
    earliestAnte: null,
    runsWon: 0,
    estValue: 0
  };
}

function createDefaultEffectTelemetry(): EffectTelemetryData {
  return {
    enhanced: 0,
    timesScored: 0,
    bonusImpact: 0,
    deckSaturationPeak: 0
  };
}

function createDefaultPackTelemetry(): PackTelemetryData {
  return {
    discovered: 0,
    opened: 0,
    drafted: 0,
    skipped: 0,
    moneyInvested: 0
  };
}

function createDefaultTelemetryStore(): LifetimeTelemetryStore {
  return {
    schemaVersion: CURRENT_TELEMETRY_SCHEMA_VERSION,
    lastUpdated: Date.now(),
    jokers: {},
    tarots: {},
    vouchers: {},
    effects: {},
    packs: {}
  };
}

function sanitizeNumber(val: any, fallback: number = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  return fallback;
}

function sanitizeJokerData(raw: any): JokerTelemetryData {
  const d = createDefaultJokerTelemetry();
  if (!raw || typeof raw !== 'object') return d;
  return {
    discovered: sanitizeNumber(raw.discovered, d.discovered),
    roundsHeld: sanitizeNumber(raw.roundsHeld, d.roundsHeld),
    roundsWon: sanitizeNumber(raw.roundsWon, d.roundsWon),
    handsTriggered: sanitizeNumber(raw.handsTriggered, d.handsTriggered),
    chipsContributed: sanitizeNumber(raw.chipsContributed, d.chipsContributed),
    multContributed: sanitizeNumber(raw.multContributed, d.multContributed)
  };
}

function sanitizeTarotData(raw: any): TarotTelemetryData {
  const d = createDefaultTarotTelemetry();
  if (!raw || typeof raw !== 'object') return d;
  return {
    discovered: sanitizeNumber(raw.discovered, d.discovered),
    acquired: sanitizeNumber(raw.acquired, d.acquired),
    cast: sanitizeNumber(raw.cast, d.cast),
    castWon: sanitizeNumber(raw.castWon, d.castWon),
    sold: sanitizeNumber(raw.sold, d.sold)
  };
}

function sanitizeVoucherData(raw: any): VoucherTelemetryData {
  const d = createDefaultVoucherTelemetry();
  if (!raw || typeof raw !== 'object') return d;
  let earliest: number | null = null;
  if (raw.earliestAnte !== null && typeof raw.earliestAnte === 'number' && Number.isFinite(raw.earliestAnte) && raw.earliestAnte > 0) {
    earliest = raw.earliestAnte;
  }
  return {
    discovered: sanitizeNumber(raw.discovered, d.discovered),
    redeemed: sanitizeNumber(raw.redeemed, d.redeemed),
    earliestAnte: earliest,
    runsWon: sanitizeNumber(raw.runsWon, d.runsWon),
    estValue: sanitizeNumber(raw.estValue, d.estValue)
  };
}

function sanitizeEffectData(raw: any): EffectTelemetryData {
  const d = createDefaultEffectTelemetry();
  if (!raw || typeof raw !== 'object') return d;
  return {
    enhanced: sanitizeNumber(raw.enhanced, d.enhanced),
    timesScored: sanitizeNumber(raw.timesScored, d.timesScored),
    bonusImpact: sanitizeNumber(raw.bonusImpact, d.bonusImpact),
    deckSaturationPeak: sanitizeNumber(raw.deckSaturationPeak, d.deckSaturationPeak)
  };
}

function sanitizePackData(raw: any): PackTelemetryData {
  const d = createDefaultPackTelemetry();
  if (!raw || typeof raw !== 'object') return d;
  return {
    discovered: sanitizeNumber(raw.discovered, d.discovered),
    opened: sanitizeNumber(raw.opened, d.opened),
    drafted: sanitizeNumber(raw.drafted, d.drafted),
    skipped: sanitizeNumber(raw.skipped, d.skipped),
    moneyInvested: sanitizeNumber(raw.moneyInvested, d.moneyInvested)
  };
}

/* ---------- Non-Destructive Store Migration Runner ---------- */
function migrateTelemetryStore(raw: any): LifetimeTelemetryStore {
  const store = createDefaultTelemetryStore();
  if (!raw || typeof raw !== 'object') return store;

  // Preserve timestamp if valid
  if (typeof raw.lastUpdated === 'number' && Number.isFinite(raw.lastUpdated)) {
    store.lastUpdated = raw.lastUpdated;
  }

  // Deep-merge all jokers
  if (raw.jokers && typeof raw.jokers === 'object') {
    for (const id of Object.keys(raw.jokers)) {
      store.jokers[id] = sanitizeJokerData(raw.jokers[id]);
    }
  }

  // Deep-merge all tarots
  if (raw.tarots && typeof raw.tarots === 'object') {
    for (const id of Object.keys(raw.tarots)) {
      store.tarots[id] = sanitizeTarotData(raw.tarots[id]);
    }
  }

  // Deep-merge all vouchers
  if (raw.vouchers && typeof raw.vouchers === 'object') {
    for (const id of Object.keys(raw.vouchers)) {
      store.vouchers[id] = sanitizeVoucherData(raw.vouchers[id]);
    }
  }

  // Deep-merge all card effects
  if (raw.effects && typeof raw.effects === 'object') {
    for (const id of Object.keys(raw.effects)) {
      store.effects[id] = sanitizeEffectData(raw.effects[id]);
    }
  }

  // Deep-merge all booster packs
  if (raw.packs && typeof raw.packs === 'object') {
    for (const id of Object.keys(raw.packs)) {
      store.packs[id] = sanitizePackData(raw.packs[id]);
    }
  }

  store.schemaVersion = CURRENT_TELEMETRY_SCHEMA_VERSION;
  return store;
}

let _lifetimeTelemetry: LifetimeTelemetryStore = loadLifetimeTelemetry();
let _tarotsCastThisHand: string[] = [];
let _blindTelemetryRecorded = false;

function loadLifetimeTelemetry(): LifetimeTelemetryStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(TELEMETRY_STORAGE_KEY);
      if (saved) {
        let parsed: any = null;
        try {
          parsed = JSON.parse(saved);
        } catch (parseErr) {
          // Emergency corrupt data archive to prevent permanent loss
          try {
            localStorage.setItem(TELEMETRY_CORRUPT_ARCHIVE_KEY, saved);
            // Attempt to restore from secondary backup if present
            const backup = localStorage.getItem(TELEMETRY_BACKUP_KEY);
            if (backup) {
              parsed = JSON.parse(backup);
            }
          } catch (backupErr) {}
        }

        if (parsed) {
          const migrated = migrateTelemetryStore(parsed);
          // If migrated from older schema, persist updated schema
          if (parsed.schemaVersion !== CURRENT_TELEMETRY_SCHEMA_VERSION) {
            saveLifetimeTelemetry(migrated);
          }
          return migrated;
        }
      }
    }
  } catch (e) {}
  return createDefaultTelemetryStore();
}

function saveLifetimeTelemetry(storeToSave?: LifetimeTelemetryStore): void {
  const store = storeToSave || _lifetimeTelemetry;
  store.schemaVersion = CURRENT_TELEMETRY_SCHEMA_VERSION;
  store.lastUpdated = Date.now();
  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(store);
      localStorage.setItem(TELEMETRY_STORAGE_KEY, serialized);
      localStorage.setItem(TELEMETRY_BACKUP_KEY, serialized);
    }
  } catch (e) {}
}

function resetLifetimeTelemetry(): void {
  _lifetimeTelemetry = createDefaultTelemetryStore();
  saveLifetimeTelemetry();
}

function getLifetimeTelemetryStore(): LifetimeTelemetryStore {
  return _lifetimeTelemetry;
}

/* ---------- Jokers Lifetime Telemetry ---------- */
function getJokerTelemetry(id: string): JokerTelemetryData {
  if (!_lifetimeTelemetry.jokers[id]) {
    _lifetimeTelemetry.jokers[id] = {
      discovered: 0,
      roundsHeld: 0,
      roundsWon: 0,
      handsTriggered: 0,
      chipsContributed: 0,
      multContributed: 0
    };
  }
  return _lifetimeTelemetry.jokers[id];
}

function recordJokerDiscovered(id: string): void {
  if (!id) return;
  const d = getJokerTelemetry(id);
  d.discovered++;
  saveLifetimeTelemetry();
}

function recordJokerAcquired(id: string): void {
  if (!id) return;
  const d = getJokerTelemetry(id);
  if (d.discovered === 0) d.discovered = 1;
  saveLifetimeTelemetry();
}

function recordJokerRound(id: string, won: boolean): void {
  if (!id) return;
  const d = getJokerTelemetry(id);
  d.roundsHeld++;
  if (won) d.roundsWon++;
  saveLifetimeTelemetry();
}

function recordJokerTriggerStats(id: string, deltaChips: number, deltaMult: number): void {
  if (!id) return;
  const d = getJokerTelemetry(id);
  d.handsTriggered++;
  if (deltaChips > 0) d.chipsContributed += deltaChips;
  if (deltaMult > 0) d.multContributed += deltaMult;
  saveLifetimeTelemetry();
}

/* ---------- Tarots Lifetime Telemetry ---------- */
function getTarotTelemetry(id: string): TarotTelemetryData {
  if (!_lifetimeTelemetry.tarots[id]) {
    _lifetimeTelemetry.tarots[id] = {
      discovered: 0,
      acquired: 0,
      cast: 0,
      castWon: 0,
      sold: 0
    };
  }
  return _lifetimeTelemetry.tarots[id];
}

function recordTarotDiscovered(id: string): void {
  if (!id) return;
  const d = getTarotTelemetry(id);
  d.discovered++;
  saveLifetimeTelemetry();
}

function recordTarotAcquired(id: string): void {
  if (!id) return;
  const d = getTarotTelemetry(id);
  if (d.discovered === 0) d.discovered = 1;
  d.acquired++;
  saveLifetimeTelemetry();
}

function recordTarotCast(id: string): void {
  if (!id) return;
  const d = getTarotTelemetry(id);
  d.cast++;
  saveLifetimeTelemetry();
}

function recordTarotCastInHand(id: string): void {
  recordTarotCast(id);
  _tarotsCastThisHand.push(id);
}

function recordTarotHandWon(id: string): void {
  if (!id) return;
  const d = getTarotTelemetry(id);
  d.castWon++;
  saveLifetimeTelemetry();
}

function recordTarotSold(id: string): void {
  if (!id) return;
  const d = getTarotTelemetry(id);
  d.sold++;
  saveLifetimeTelemetry();
}

function resolveTarotsHandResult(won: boolean): void {
  if (won) {
    for (const id of _tarotsCastThisHand) {
      recordTarotHandWon(id);
    }
  }
  _tarotsCastThisHand = [];
}

function clearTarotsInHand(): void {
  _tarotsCastThisHand = [];
}

/* ---------- Vouchers Lifetime Telemetry ---------- */
function getVoucherTelemetry(id: string): VoucherTelemetryData {
  if (!_lifetimeTelemetry.vouchers[id]) {
    _lifetimeTelemetry.vouchers[id] = {
      discovered: 0,
      redeemed: 0,
      earliestAnte: null,
      runsWon: 0,
      estValue: 0
    };
  }
  return _lifetimeTelemetry.vouchers[id];
}

function recordVoucherDiscovered(id: string): void {
  if (!id) return;
  const d = getVoucherTelemetry(id);
  d.discovered++;
  saveLifetimeTelemetry();
}

function recordVoucherRedeemed(id: string, ante: number): void {
  if (!id) return;
  const d = getVoucherTelemetry(id);
  if (d.discovered === 0) d.discovered = 1;
  d.redeemed++;
  if (d.earliestAnte === null || ante < d.earliestAnte) {
    d.earliestAnte = ante;
  }
  saveLifetimeTelemetry();
}

function recordVoucherRunWon(id: string): void {
  if (!id) return;
  const d = getVoucherTelemetry(id);
  d.runsWon++;
  saveLifetimeTelemetry();
}

function recordVoucherValue(id: string, value: number): void {
  if (!id || value <= 0) return;
  const d = getVoucherTelemetry(id);
  d.estValue += Math.round(value);
  saveLifetimeTelemetry();
}

/* ---------- Card Effects Lifetime Telemetry ---------- */
function getEffectTelemetry(id: string): EffectTelemetryData {
  if (!_lifetimeTelemetry.effects[id]) {
    _lifetimeTelemetry.effects[id] = {
      enhanced: 0,
      timesScored: 0,
      bonusImpact: 0,
      deckSaturationPeak: 0
    };
  }
  return _lifetimeTelemetry.effects[id];
}

function recordEffectEnhanced(id: string): void {
  if (!id) return;
  const d = getEffectTelemetry(id);
  d.enhanced++;
  saveLifetimeTelemetry();
}

function recordEffectScored(id: string, deltaChips: number, deltaMult: number, isXMult: boolean, deltaMoney: number): void {
  if (!id) return;
  const d = getEffectTelemetry(id);
  d.timesScored++;
  if (id === 'foil' && deltaChips > 0) d.bonusImpact += deltaChips;
  else if (id === 'holo' && deltaMult > 0) d.bonusImpact += deltaMult;
  else if (id === 'poly') d.bonusImpact = Math.round((d.bonusImpact + 0.5) * 10) / 10;
  else if (id === 'gold' && deltaMoney > 0) d.bonusImpact += deltaMoney;
  saveLifetimeTelemetry();
}

function recordDeckSaturation(id: string, pct: number): void {
  if (!id) return;
  const d = getEffectTelemetry(id);
  if (pct > d.deckSaturationPeak) {
    d.deckSaturationPeak = Math.round(pct * 10) / 10;
    saveLifetimeTelemetry();
  }
}

/* ---------- Booster Packs Lifetime Telemetry ---------- */
function getPackTelemetry(id: string): PackTelemetryData {
  if (!_lifetimeTelemetry.packs[id]) {
    _lifetimeTelemetry.packs[id] = {
      discovered: 0,
      opened: 0,
      drafted: 0,
      skipped: 0,
      moneyInvested: 0
    };
  }
  return _lifetimeTelemetry.packs[id];
}

function recordPackDiscovered(id: string): void {
  if (!id) return;
  const d = getPackTelemetry(id);
  d.discovered++;
  saveLifetimeTelemetry();
}

function recordPackOpened(id: string, cost: number): void {
  if (!id) return;
  const d = getPackTelemetry(id);
  d.opened++;
  d.moneyInvested += cost;
  saveLifetimeTelemetry();
}

function recordPackCardDrafted(id: string): void {
  if (!id) return;
  const d = getPackTelemetry(id);
  d.drafted++;
  saveLifetimeTelemetry();
}

function recordPackSkipped(id: string): void {
  if (!id) return;
  const d = getPackTelemetry(id);
  d.skipped++;
  saveLifetimeTelemetry();
}

/* ---------- Blind Outcome Tracking Helpers ---------- */
function recordBlindOutcomeTelemetry(won: boolean): void {
  if (_blindTelemetryRecorded) return;
  _blindTelemetryRecorded = true;
  for (const j of _state.jokers) {
    recordJokerRound(j.id, won);
  }
}

function resetBlindOutcomeFlag(): void {
  _blindTelemetryRecorded = false;
}

if (typeof window !== 'undefined') {
  (window as any).getLifetimeTelemetryStore = getLifetimeTelemetryStore;
  (window as any).resetLifetimeTelemetry = resetLifetimeTelemetry;
  (window as any).getJokerTelemetry = getJokerTelemetry;
  (window as any).getTarotTelemetry = getTarotTelemetry;
  (window as any).getVoucherTelemetry = getVoucherTelemetry;
  (window as any).getEffectTelemetry = getEffectTelemetry;
  (window as any).getPackTelemetry = getPackTelemetry;
  (window as any).recordJokerDiscovered = recordJokerDiscovered;
  (window as any).recordJokerAcquired = recordJokerAcquired;
  (window as any).recordJokerRound = recordJokerRound;
  (window as any).recordJokerTriggerStats = recordJokerTriggerStats;
  (window as any).recordTarotDiscovered = recordTarotDiscovered;
  (window as any).recordTarotAcquired = recordTarotAcquired;
  (window as any).recordTarotCast = recordTarotCast;
  (window as any).recordTarotCastInHand = recordTarotCastInHand;
  (window as any).recordTarotHandWon = recordTarotHandWon;
  (window as any).recordTarotSold = recordTarotSold;
  (window as any).resolveTarotsHandResult = resolveTarotsHandResult;
  (window as any).clearTarotsInHand = clearTarotsInHand;
  (window as any).recordVoucherDiscovered = recordVoucherDiscovered;
  (window as any).recordVoucherRedeemed = recordVoucherRedeemed;
  (window as any).recordVoucherRunWon = recordVoucherRunWon;
  (window as any).recordVoucherValue = recordVoucherValue;
  (window as any).recordEffectEnhanced = recordEffectEnhanced;
  (window as any).recordEffectScored = recordEffectScored;
  (window as any).recordDeckSaturation = recordDeckSaturation;
  (window as any).recordPackDiscovered = recordPackDiscovered;
  (window as any).recordPackOpened = recordPackOpened;
  (window as any).recordPackCardDrafted = recordPackCardDrafted;
  (window as any).recordPackSkipped = recordPackSkipped;
  (window as any).recordBlindOutcomeTelemetry = recordBlindOutcomeTelemetry;
  (window as any).resetBlindOutcomeFlag = resetBlindOutcomeFlag;
  (window as any).migrateTelemetryStore = migrateTelemetryStore;
  (window as any).CURRENT_TELEMETRY_SCHEMA_VERSION = CURRENT_TELEMETRY_SCHEMA_VERSION;
  (window as any).GAME_VERSION = GAME_VERSION;
}

/* ---------- Lifecycle ---------- */
/** Resets everything that belongs to a single run. The deck is supplied by deckEngine. */
function resetRunState(freshDeck: Card[]): void {
  _state.ante = 1;
  _state.blindIndex = 0;
  _state.money = STARTING_MONEY;
  _state.maxHands = _balanceConfig.startingDeals;
  _state.maxJokers = STARTING_MAX_JOKERS;
  _state.baseWinChipBonus = 0;
  _state.baseWinMultBonus = 0;
  _state.jokers = [];
  _state.consumables = [];
  _state.vouchersBought = [];
  _state.deck = freshDeck;
  _state.inShop = false;
  _state.isDealing = false;
  _state.endlessMode = false;
  _state.voucherAnte = 0;
  _state.currentAnteVoucher = null;
  _state.shopPacks = [];
  _state.activePackOpening = null;
  _state.roundCashEarned = 0;
  _state.runStats = createInitialRunStats();
  clearTarotsInHand();
  resetBlindOutcomeFlag();
}
