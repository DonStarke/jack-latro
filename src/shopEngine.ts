/* ==========================================================
   shopEngine.ts - ECONOMY, SHOP, CONSUMABLES & BLIND PROGRESSION
   Pricing, interest, payouts, buying/selling, Tarot effects and the
   state-side of moving between Blinds. No DOM, no audio, no alerts:
   every action returns a result object and the UI decides how to
   show it. All state access goes through gameState.ts.
   Depends on (global): gameState.ts, deckEngine.ts, modifierEngine.ts
========================================================== */

/* ---------- Constants ---------- */
const ANTE_TARGETS: ReadonlyArray<number> = [300, 600, 1100, 1800, 2900, 4500, 7000, 10500];
/** Target multiplier per Blind (Small, Big, Boss). */
const BLIND_TARGET_MULTS: ReadonlyArray<number> = [1.0, 1.45, 2.0];
/** Cash reward per Blind (Small, Big, Boss). */
const BLIND_REWARDS: ReadonlyArray<number> = [4, 5, 6];
const INTEREST_PER = 5;
const INTEREST_CAP = 5;
const SHOP_BASE_REROLL = 2;

/* ---------- Pure economy helpers (shared with simulator) ---------- */
function computeBlindTarget(ante: number, blindIndex: number, targetScalePct: number): number {
  let rawBase: number;
  if (ante <= ANTE_TARGETS.length) {
    rawBase = ANTE_TARGETS[ante - 1];
  } else {
    const maxBase = ANTE_TARGETS[ANTE_TARGETS.length - 1]; // 10,500
    rawBase = Math.round(maxBase * Math.pow(1.6, ante - ANTE_TARGETS.length));
  }
  const base = Math.round(rawBase * (targetScalePct / 100));
  return Math.round(base * BLIND_TARGET_MULTS[Math.min(blindIndex, 2)]);
}

function computeBlindBoss(ante: number, blindIndex: number): BossBlindDef | null {
  return blindIndex >= 2 ? BOSS_BLINDS[(ante - 1) % BOSS_BLINDS.length] : null;
}

function computeInterest(money: number, maxInterest: number = INTEREST_CAP): number {
  return Math.min(maxInterest, Math.floor(money / INTEREST_PER));
}

function getJokerSellValue(j: { cost: number }): number {
  return Math.max(1, Math.floor(j.cost / 2));
}

/** Pure payout math (shared with simulator). */
function calcBlindPayout(blindIndex: number, dealsLeft: number, money: number, unusedDealCashCap: number, maxInterest: number = INTEREST_CAP): PendingPayout {
  const blindReward = BLIND_REWARDS[Math.min(blindIndex, 2)];
  const handBonus = Math.min(unusedDealCashCap, dealsLeft);
  const interest = computeInterest(money, maxInterest);
  return { blindReward, handBonus, interest, totalEarned: blindReward + handBonus + interest };
}

/** Payout for clearing the current Blind, from current state. Does not modify state. */
function computeBlindPayout(): PendingPayout {
  const s = getState();
  const maxInterest = s.vouchersBought.includes('deep_pockets') ? 8 : INTEREST_CAP;
  return calcBlindPayout(s.blindIndex, s.handsLeft, s.money, getBalanceConfig().unusedDealCashCap, maxInterest);
}

/* ---------- Blind progression (state side only) ---------- */
/** Sets target score + boss for the current ante/blind and zeroes the round score. */
function configureBlindMetrics(): void {
  const s = getState();
  patchState({
    targetScore: computeBlindTarget(s.ante, s.blindIndex, getBalanceConfig().targetScalePct),
    bossBlind: computeBlindBoss(s.ante, s.blindIndex),
    roundScore: 0
  });
}

/** Resets per-Blind play state and builds a fresh shoe. UI refresh is the caller's job. */
function beginBlindState(): void {
  const s = getState();
  let handsLeft = s.maxHands;
  if (s.bossBlind && s.bossBlind.id === 'the_cooler') {
    handsLeft = Math.max(1, handsLeft - 1);
  }
  patchState({
    inShop: false,
    isDealing: false,
    blindClearedReady: false,
    blindFailedReady: false,
    pendingPayout: null,
    handsLeft,
    playerHand: [],
    dealerHand: [],
    inHand: false,
    dealerHoleRevealed: false,
    doubledDown: false,
    tempBonusChips: 0
  });
  setShoe(buildShoeFromDeck());
}

/** Full new-run reset: fresh uids + deck, first Blind configured and begun. */
function startNewRunState(): void {
  resetCardUid();
  resetRunState(createStandardDeck());
  configureBlindMetrics();
  beginBlindState();
}

/* ---------- Cash-out & shop entry ---------- */
/**
 * Pays out the pending reward, advances to the next Blind/Ante, configures
 * its metrics, and generates a fresh shop. Returns the payout, or null if
 * there is nothing to cash out.
 */
function cashOutAndEnterShop(): PendingPayout | null {
  const s = getState();
  if (!s.blindClearedReady || !s.pendingPayout) return null;

  const payout = s.pendingPayout;
  addMoney(payout.totalEarned);

  let blindIndex = s.blindIndex + 1;
  let ante = s.ante;
  if (blindIndex > 2) {
    blindIndex = 0;
    ante++;
  }
  patchState({ blindClearedReady: false, blindIndex, ante, inShop: true, rerollCost: SHOP_BASE_REROLL });
  configureBlindMetrics();
  generateShopStock();
  return payout;
}

/* ---------- Shop stock ---------- */
function generateShopStock(): void {
  const s = getState();
  const ownedIds = s.jokers.map(j => j.id);
  const availableJokers = shuffle(JOKER_CATALOG.filter(j => !ownedIds.includes(j.id))).slice(0, 2);
  const tarot = shuffle(TAROT_CATALOG)[0];

  const shopJokers: ShopJokerSlot[] = [
    ...availableJokers.map(j => ({ ...j, bonusMult: 0, bonusChips: 0, shopType: 'joker' as const, bought: false })),
    { ...tarot, shopType: 'tarot' as const, bought: false }
  ];

  const enhancements: ReadonlyArray<{ key: Exclude<Enhancement, null>; label: string; cost: number }> = [
    { key: 'foil', label: 'Foil (+30c)', cost: 4 },
    { key: 'holo', label: 'Holo (+4m)', cost: 4 },
    { key: 'poly', label: 'Poly (×1.5m)', cost: 5 },
    { key: 'gold', label: 'Gold (+$3)', cost: 4 }
  ];
  const highRanks: ReadonlyArray<Rank> = ['A', 'K', 'Q', 'J', '10', '7'];
  const suits: ReadonlyArray<Suit> = ['♠', '♥', '♣', '♦'];

  const cardOffers: ShopCardOffer[] = [0, 1].map(() => {
    const enh = enhancements[Math.floor(Math.random() * enhancements.length)];
    const r = highRanks[Math.floor(Math.random() * highRanks.length)];
    const su = suits[Math.floor(Math.random() * suits.length)];
    return {
      shopType: 'card' as const,
      name: `${r}${su} [${enh.key.toUpperCase()}]`,
      cost: enh.cost,
      desc: `Add ${r}${su} with ${enh.label} to Deck.`,
      cardData: { rank: r, suit: su, enhancement: enh.key },
      bought: false
    };
  });

  const availVouchers = VOUCHER_CATALOG.filter(v => !s.vouchersBought.includes(v.id));
  const voucherOffer: ShopVoucher[] = availVouchers.length > 0
    ? [{ ...shuffle(availVouchers)[0], shopType: 'voucher' as const, bought: false }]
    : [];

  setShopStock(shopJokers, [...cardOffers, ...voucherOffer]);
}

/* ---------- Shop actions ---------- */
type ShopFailReason = 'invalid' | 'too_poor' | 'jokers_full' | 'tarots_full';
interface ShopActionResult {
  ok: boolean;
  reason?: ShopFailReason;
}

function rerollShop(): ShopActionResult {
  const s = getState();
  if (s.money < s.rerollCost) return { ok: false, reason: 'too_poor' };
  spendMoney(s.rerollCost);
  patchState({ rerollCost: s.rerollCost + 1 });
  generateShopStock();
  return { ok: true };
}

interface VoucherDeltas {
  maxHands?: number;
  baseWinMultBonus?: number;
  maxJokers?: number;
  baseWinChipBonus?: number;
}

/** Pure description of what a Voucher grants (shared with simulator). */
function getVoucherDeltas(id: string): VoucherDeltas {
  if (id === 'extra_hand') return { maxHands: 1 };
  if (id === 'table_leverage') return { baseWinMultBonus: 1 };
  if (id === 'joker_slot') return { maxJokers: 1 };
  if (id === 'base_boost') return { baseWinChipBonus: 30 };
  return {};
}

function applyVoucher(id: string): void {
  const s = getState();
  const d = getVoucherDeltas(id);
  addVoucher(id);
  patchState({
    maxHands: s.maxHands + (d.maxHands || 0),
    baseWinMultBonus: s.baseWinMultBonus + (d.baseWinMultBonus || 0),
    maxJokers: s.maxJokers + (d.maxJokers || 0),
    baseWinChipBonus: s.baseWinChipBonus + (d.baseWinChipBonus || 0)
  });
}

function buyShopItem(listName: 'shopJokers' | 'shopExtras', idx: number): ShopActionResult {
  const s = getState();
  const item: ShopJokerSlot | ShopExtraSlot | undefined = s[listName][idx];
  if (!item || item.bought) return { ok: false, reason: 'invalid' };
  if (s.money < item.cost) return { ok: false, reason: 'too_poor' };

  if (item.shopType === 'joker') {
    if (s.jokers.length >= s.maxJokers) return { ok: false, reason: 'jokers_full' };
    spendMoney(item.cost);
    markShopItemBought(listName, idx);
    addJoker({ ...item, bonusMult: item.bonusMult || 0, bonusChips: item.bonusChips || 0 });
  } else if (item.shopType === 'tarot') {
    if (s.consumables.length >= s.maxConsumables) return { ok: false, reason: 'tarots_full' };
    spendMoney(item.cost);
    markShopItemBought(listName, idx);
    addConsumable({ ...item });
  } else if (item.shopType === 'card') {
    spendMoney(item.cost);
    markShopItemBought(listName, idx);
    const newCard: Card = { uid: takeNextCardUid(), ...item.cardData };
    addCardToDeck(newCard);
    addCardToShoe({ ...newCard });
  } else if (item.shopType === 'voucher') {
    spendMoney(item.cost);
    markShopItemBought(listName, idx);
    applyVoucher(item.id);
  }
  return { ok: true };
}

/* ---------- Inventory ---------- */
/** Sells a Joker; returns cash received or null if the index is invalid. */
function sellJoker(index: number): number | null {
  const j = removeJokerAt(index);
  if (!j) return null;
  const value = getJokerSellValue(j);
  addMoney(value);
  return value;
}

function sellConsumable(index: number): boolean {
  if (!removeConsumableAt(index)) return false;
  addMoney(1);
  return true;
}

/* ---------- Tarot use (only while a hand is in progress) ---------- */
interface ConsumableResult {
  ok: boolean;
  /** Banner text on success. */
  message?: string;
  /** Warning text on failure (UI may show it in an alert). */
  warning?: string;
}

function useConsumable(index: number): ConsumableResult {
  const s = getState();
  if (!s.inHand || s.isDealing) return { ok: false };
  const c = s.consumables[index];
  if (!c) return { ok: false };

  let message = '';
  if (c.id === 'x_ray') {
    patchState({ dealerHoleRevealed: true, tempBonusChips: s.tempBonusChips + 75 });
    message = 'X-Ray Specs: Hole card revealed & +75 Chips!';
  } else if (c.id === 'loaded_ace') {
    addCardToPlayerHand({ uid: takeNextCardUid(), rank: 'A', suit: '♠', enhancement: 'foil' });
    message = 'Loaded Ace drawn into hand!';
  } else if (c.id === 'card_shave') {
    const target = s.playerHand.find(card => !['A', '2', '3'].includes(card.rank));
    if (!target) return { ok: false, warning: 'No high card available to shave!' };
    const val = FACE_RANKS.includes(target.rank) ? 10 : parseInt(target.rank, 10);
    setCardRank(target, String(Math.max(2, val - 3)) as Rank);
    message = `Card Shave reduced rank to ${target.rank}!`;
  } else if (c.id === 'midas_touch') {
    const lastCard = s.playerHand[s.playerHand.length - 1];
    if (lastCard) {
      setCardEnhancement(lastCard, 'gold');
      message = `${lastCard.rank}${lastCard.suit} turned Gold!`;
    }
  } else if (c.id === 'double_vision') {
    patchState({ doubledDown: true });
    message = 'Double Vision: Hand Doubled Down (×2 Mult)!';
  } else if (c.id === 'polychrome_dice') {
    const firstCard = s.playerHand[0];
    if (firstCard) {
      setCardEnhancement(firstCard, 'poly');
      message = `${firstCard.rank}${firstCard.suit} enhanced to Polychrome (×1.5 Mult)!`;
    }
  }

  removeConsumableAt(index);
  return { ok: true, message };
}
