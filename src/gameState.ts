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

interface JokerDef {
  id: string;
  name: string;
  cost: number;
  rarity: JokerRarity;
  isXMult: boolean;
  desc: string;
  bonusMult?: number;
  bonusChips?: number;
}

/** A Joker the player owns or that sits in the shop. */
interface JokerInstance extends JokerDef {
  shopType?: 'joker';
  bought?: boolean;
}

interface TarotDef {
  id: string;
  name: string;
  cost: number;
  desc: string;
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
type PackType = 'joker' | 'tarot' | 'card' | 'variety';

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
  | { kind: 'card'; data: { rank: Rank; suit: Suit; enhancement: Enhancement } };

interface ActivePackOpening {
  pack: ShopPackSlot;
  options: PackCardOption[];
  chosen: boolean;
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
  targetScalePct: 100,
  unusedDealCashCap: 6,
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
  _state.runStats = createInitialRunStats();
}
