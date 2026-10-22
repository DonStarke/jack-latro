/* ==========================================================
   shopEngine.ts - ECONOMY, SHOP, CONSUMABLES & BLIND PROGRESSION
   Pricing, interest, payouts, buying/selling, Tarot effects and the
   state-side of moving between Blinds. No DOM, no audio, no alerts:
   every action returns a result object and the UI decides how to
   show it. All state access goes through gameState.ts.
   Depends on (global): gameState.ts, deckEngine.ts, modifierEngine.ts
========================================================== */

/* ---------- Constants ---------- */
const ANTE_TARGETS: ReadonlyArray<number> = [300, 600, 1200, 2400, 4500, 8500, 15000, 25000];
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
    const maxBase = ANTE_TARGETS[ANTE_TARGETS.length - 1]; // 25,000
    rawBase = Math.round(maxBase * Math.pow(1.6, ante - ANTE_TARGETS.length));
  }
  const base = Math.round(rawBase * (targetScalePct / 100));
  return Math.round(base * BLIND_TARGET_MULTS[Math.min(blindIndex, 2)]);
}

function computeBlindBoss(ante: number, blindIndex: number): BossBlindDef | null {
  return blindIndex >= 2 ? BOSS_BLINDS[(ante - 1) % BOSS_BLINDS.length] : null;
}

function computeInterest(money: number, maxInterest: number = INTEREST_CAP, interestPer: number = INTEREST_PER): number {
  return Math.min(maxInterest, Math.floor(money / interestPer));
}

function getJokerSellValue(j: { cost: number }): number {
  return Math.max(1, Math.floor(j.cost / 2));
}

/** Pure payout math (shared with simulator). */
function calcBlindPayout(
  blindIndex: number,
  dealsLeft: number,
  money: number,
  unusedDealCashCap: number,
  maxInterest: number = INTEREST_CAP,
  interestPer: number = INTEREST_PER,
  loanSharkFee: number = 0
): PendingPayout {
  const blindReward = BLIND_REWARDS[Math.min(blindIndex, 2)];
  const handBonus = Math.min(unusedDealCashCap, dealsLeft);
  const interest = computeInterest(money, maxInterest, interestPer);
  const totalEarned = Math.max(0, blindReward + handBonus + interest - loanSharkFee);
  return { blindReward, handBonus, interest, totalEarned };
}

/** Payout for clearing the current Blind, from current state. Does not modify state. */
function computeBlindPayout(): PendingPayout {
  const s = getState();
  const maxInterest = s.vouchersBought.includes('deep_pockets') ? 8 : INTEREST_CAP;
  const interestPer = s.vouchersBought.includes('liquidity_pass') ? 4 : INTEREST_PER;
  const loanSharkFee = s.jokers.some(j => j.id === 'loan_shark') ? 1 : 0;
  return calcBlindPayout(s.blindIndex, s.handsLeft, s.money, getBalanceConfig().unusedDealCashCap, maxInterest, interestPer, loanSharkFee);
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
  resetBlindOutcomeFlag();
  clearTarotsInHand();
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
    tempBonusChips: 0,
    handsWonInBlind: 0,
    previousHandTotal: null,
    roundCashEarned: 0
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
  recordMoneyEarned('blinds', payout.blindReward);
  recordMoneyEarned('unusedDeals', payout.handBonus);
  recordMoneyEarned('interest', payout.interest);

  if (s.jokers.some(j => j.id === 'loan_shark')) {
    recordMoneySpent('loanSharkFees', 1);
    recordJokerTrigger('loan_shark', 'Loan Shark');
  }

  let blindIndex = s.blindIndex + 1;
  let ante = s.ante;
  if (blindIndex > 2) {
    blindIndex = 0;
    ante++;
  }
  const rerollCost = s.vouchersBought.includes('clearance_sale') ? 1 : SHOP_BASE_REROLL;
  patchState({ blindClearedReady: false, blindIndex, ante, inShop: true, rerollCost });
  configureBlindMetrics();
  generateShopStock();
  return payout;
}

/* ---------- Weighted Rarity Rolling (Shared with Simulator) ---------- */
function rollWeightedJoker(excludedIds: string[]): JokerDef | null {
  const available = JOKER_CATALOG.filter(j => !excludedIds.includes(j.id));
  if (available.length === 0) return null;

  // Weights: Common 60%, Uncommon 30%, Rare 10%
  const roll = Math.random();
  let targetRarity: JokerRarity;
  if (roll < 0.60) {
    targetRarity = 'common';
  } else if (roll < 0.90) {
    targetRarity = 'uncommon';
  } else {
    targetRarity = 'rare';
  }

  let pool = available.filter(j => j.rarity === targetRarity);
  if (pool.length === 0) {
    // Fallback order: uncommon -> common -> any
    if (targetRarity === 'rare') pool = available.filter(j => j.rarity === 'uncommon');
    if (pool.length === 0) pool = available.filter(j => j.rarity === 'common');
    if (pool.length === 0) pool = available;
  }

  return shuffle(pool)[0] || null;
}

/* ---------- Pack Catalog & Generation ---------- */
const PACK_CATALOG: ReadonlyArray<PackDef> = [
  {
    id: 'pack_joker',
    name: 'Joker Pack',
    packType: 'joker',
    cost: 4,
    cardsCount: 3,
    chooseCount: 1,
    desc: 'Choose 1 of 3 Jokers to add to your collection.',
    badge: 'JOKERS',
    color: '#3b82f6'
  },
  {
    id: 'pack_tarot',
    name: 'Tarot Pack',
    packType: 'tarot',
    cost: 4,
    cardsCount: 3,
    chooseCount: 1,
    desc: 'Choose 1 of 3 Tarots to immediately modify a card from your Deck.',
    badge: 'TAROT',
    color: '#a855f7'
  },
  {
    id: 'pack_cheat',
    name: 'Cheat Pack',
    packType: 'cheat',
    cost: 4,
    cardsCount: 3,
    chooseCount: 1,
    desc: 'Choose 1 of 3 Table Cheats to hold in your inventory for play.',
    badge: 'CHEAT',
    color: '#f43f5e'
  },
  {
    id: 'pack_card',
    name: 'Playing Card Pack',
    packType: 'card',
    cost: 4,
    cardsCount: 3,
    chooseCount: 1,
    desc: 'Choose 1 of 3 Enhanced Playing Cards to add to your Deck.',
    badge: 'CARDS',
    color: '#eab308'
  },
  {
    id: 'pack_variety',
    name: 'Variety Pack',
    packType: 'variety',
    cost: 4,
    cardsCount: 3,
    chooseCount: 1,
    desc: 'Choose 1 of 3 mixed options (1 Joker, 1 Tarot, 1 Enhanced Card).',
    badge: 'VARIETY',
    color: '#10b981'
  }
];

function generatePackOptions(pack: PackDef, ownedJokerIds?: string[]): PackCardOption[] {
  const ownedIds = ownedJokerIds !== undefined ? ownedJokerIds : getState().jokers.map(j => j.id);
  const options: PackCardOption[] = [];

  if (pack.packType === 'joker') {
    const excluded = [...ownedIds];
    for (let i = 0; i < pack.cardsCount; i++) {
      let rolled = rollWeightedJoker(excluded);
      if (!rolled) {
        const inPackIds = options.filter(o => o.kind === 'joker').map(o => (o as any).data.id);
        const avail = JOKER_CATALOG.filter(j => !inPackIds.includes(j.id));
        rolled = avail.length > 0 ? shuffle(avail)[0] : shuffle(JOKER_CATALOG)[0];
      }
      if (rolled) {
        excluded.push(rolled.id);
        options.push({ kind: 'joker', data: rolled });
      }
    }
  } else if (pack.packType === 'tarot') {
    const shuffled = shuffle([...DECK_TAROT_CATALOG]);
    const picked = shuffled.slice(0, pack.cardsCount);
    for (const t of picked) {
      options.push({ kind: 'tarot', data: t });
    }
  } else if (pack.packType === 'cheat') {
    const shuffled = shuffle([...CHEAT_CATALOG]);
    const picked = shuffled.slice(0, pack.cardsCount);
    for (const c of picked) {
      options.push({ kind: 'cheat', data: c });
    }
  } else if (pack.packType === 'card') {
    const enhancements: ReadonlyArray<Exclude<Enhancement, null>> = ['foil', 'holo', 'poly', 'gold'];
    const highRanks: ReadonlyArray<Rank> = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
    const suits: ReadonlyArray<Suit> = ['♠', '♥', '♣', '♦'];
    for (let i = 0; i < pack.cardsCount; i++) {
      const enh = enhancements[Math.floor(Math.random() * enhancements.length)];
      const r = highRanks[Math.floor(Math.random() * highRanks.length)];
      const su = suits[Math.floor(Math.random() * suits.length)];
      options.push({
        kind: 'card',
        data: { rank: r, suit: su, enhancement: enh }
      });
    }
  } else if (pack.packType === 'variety') {
    // 1 Joker
    const j = rollWeightedJoker(ownedIds) || shuffle(JOKER_CATALOG)[0];
    options.push({ kind: 'joker', data: j });

    // 1 Deck Tarot
    const t = shuffle([...DECK_TAROT_CATALOG])[0];
    options.push({ kind: 'tarot', data: t });

    // 1 Playing card
    const enhancements: ReadonlyArray<Exclude<Enhancement, null>> = ['foil', 'holo', 'poly', 'gold'];
    const highRanks: ReadonlyArray<Rank> = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
    const suits: ReadonlyArray<Suit> = ['♠', '♥', '♣', '♦'];
    const enh = enhancements[Math.floor(Math.random() * enhancements.length)];
    const r = highRanks[Math.floor(Math.random() * highRanks.length)];
    const su = suits[Math.floor(Math.random() * suits.length)];
    options.push({
      kind: 'card',
      data: { rank: r, suit: su, enhancement: enh }
    });
  }

  return options;
}

function drawPackDeckCards(deck: ReadonlyArray<Card>, count: number = 5): Card[] {
  if (!deck || deck.length === 0) return [];
  const shuffled = shuffle([...deck]);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));
  // Ensure at least one card eligible for Card Forge (non-Ace, non-King) is included if the deck has any
  if (picked.every(c => c.rank === 'A' || c.rank === 'K')) {
    const forgeEligible = shuffled.find(c => c.rank !== 'A' && c.rank !== 'K') || shuffled.find(c => c.rank !== 'A');
    if (forgeEligible && picked.length > 0) {
      picked[0] = forgeEligible;
    }
  }
  return picked.map(c => ({ ...c }));
}

function applyTarotToDeckCard(tarot: TarotDef, targetCard: Card): { ok: boolean; message?: string; warning?: string } {
  if (!targetCard) return { ok: false, warning: 'No target card selected!' };

  let message = '';
  if (tarot.id === 'midas_touch') {
    setCardEnhancement(targetCard, 'gold');
    recordEffectEnhanced('gold');
    message = `${tarot.name}: ${targetCard.rank}${targetCard.suit} turned Gold (+$3 when scored)!`;
  } else if (tarot.id === 'polychrome_dice') {
    setCardEnhancement(targetCard, 'poly');
    recordEffectEnhanced('poly');
    message = `${tarot.name}: ${targetCard.rank}${targetCard.suit} enhanced to Polychrome (×1.5 Mult)!`;
  } else if (tarot.id === 'wild_suit') {
    setCardEnhancement(targetCard, 'foil');
    recordEffectEnhanced('foil');
    message = `${tarot.name}: ${targetCard.rank}${targetCard.suit} enhanced to Foil (+30 Chips)!`;
  } else if (tarot.id === 'lucky_charm') {
    setCardEnhancement(targetCard, 'holo');
    recordEffectEnhanced('holo');
    message = `${tarot.name}: ${targetCard.rank}${targetCard.suit} enhanced to Holo (+4 Mult)!`;
  } else if (tarot.id === 'the_guillotine') {
    const rankSuit = `${targetCard.rank}${targetCard.suit}`;
    removeCardFromGame(targetCard.uid);
    message = `The Guillotine permanently destroyed ${rankSuit} from your deck!`;
  } else if (tarot.id === 'card_forge') {
    if (targetCard.rank === 'A' || targetCard.rank === 'K') {
      return { ok: false, warning: `${targetCard.rank === 'A' ? 'Aces' : 'Kings'} cannot be upgraded!` };
    }
    const oldRankSuit = `${targetCard.rank}${targetCard.suit}`;
    const rankOrder: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const curIdx = rankOrder.indexOf(targetCard.rank);
    const newIdx = Math.min(rankOrder.length - 1, curIdx + 2);
    setCardRank(targetCard, rankOrder[newIdx]);
    message = `Card Forge upgraded ${oldRankSuit} to ${targetCard.rank}${targetCard.suit}!`;
  } else if (tarot.id === 'card_shave') {
    if (targetCard.rank === 'A' || targetCard.rank === '2') {
      return { ok: false, warning: 'This card cannot be shaved!' };
    }
    const oldRankSuit = `${targetCard.rank}${targetCard.suit}`;
    const val = FACE_RANKS.includes(targetCard.rank) ? 10 : parseInt(targetCard.rank, 10);
    const newRank = String(Math.max(2, val - 3)) as Rank;
    setCardRank(targetCard, newRank);
    message = `Card Shave reduced ${oldRankSuit} to ${targetCard.rank}${targetCard.suit}!`;
  } else {
    return { ok: false, warning: 'This card cannot be applied to deck cards!' };
  }

  return { ok: true, message };
}

/** Pure helper to generate packs for a shop visit (shared with simulator). */
function generateShopPacks(ante: number, jokersCount: number, hasOverstock: boolean): PackDef[] {
  const numPacks = hasOverstock ? 3 : 2;
  const packsOffered: PackDef[] = [];
  const chosenIds: string[] = [];

  // In Ante 1 with 0 jokers, offer a Joker Pack in first slot to help player build early synergy
  if (ante === 1 && jokersCount === 0) {
    const jokerPack = PACK_CATALOG.find(p => p.id === 'pack_joker') || PACK_CATALOG[0];
    packsOffered.push(jokerPack);
    chosenIds.push(jokerPack.id);
  }

  while (packsOffered.length < numPacks) {
    const unpicked = PACK_CATALOG.filter(p => !chosenIds.includes(p.id));
    const pool = unpicked.length > 0 ? unpicked : PACK_CATALOG;
    const rolled = shuffle([...pool])[0];
    packsOffered.push(rolled);
    chosenIds.push(rolled.id);
  }

  return packsOffered;
}

/* ---------- Shop stock ---------- */
function generateShopStock(): void {
  const s = getState();
  const hasOverstock = s.vouchersBought.includes('overstock');
  const packs = generateShopPacks(s.ante, s.jokers.length, hasOverstock);
  const packsOffered: ShopPackSlot[] = packs.map(p => ({ ...p, shopType: 'pack', bought: false }));

  // Voucher handling: 1 voucher per ante, persisting across blinds until bought or next ante
  let voucherOffer: ShopVoucher[] = [];
  if (s.voucherAnte !== s.ante) {
    // New ante! Refresh voucher offer
    const availVouchers = VOUCHER_CATALOG.filter(v => !s.vouchersBought.includes(v.id));
    if (availVouchers.length > 0) {
      const rolled = shuffle(availVouchers)[0];
      const newVoucher: ShopVoucher = { ...rolled, shopType: 'voucher' as const, bought: false };
      patchState({ voucherAnte: s.ante, currentAnteVoucher: newVoucher });
      voucherOffer = [newVoucher];
    } else {
      patchState({ voucherAnte: s.ante, currentAnteVoucher: null });
    }
  } else if (s.currentAnteVoucher) {
    // Same ante: offer the existing voucher unless already bought (unless a special effect allows another)
    if (!s.currentAnteVoucher.bought || canOfferExtraVoucher(s)) {
      voucherOffer = [{ ...s.currentAnteVoucher }];
    }
  }

  setShopStock([], voucherOffer, packsOffered);

  // Lifetime Telemetry: Record offered items
  for (const p of packsOffered) {
    recordPackDiscovered(p.id);
  }
  if (voucherOffer.length > 0 && !voucherOffer[0].bought) {
    recordVoucherDiscovered(voucherOffer[0].id);
  }
}

/** Hook for special effects (like a future joker or voucher) that allow additional vouchers per ante. */
function canOfferExtraVoucher(s: GameState): boolean {
  return false;
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
  recordMoneySpent('rerolls', s.rerollCost);
  if (s.vouchersBought.includes('clearance_sale')) {
    recordVoucherValue('clearance_sale', 1);
  }
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
  if (id === 'card_shark_voucher') return { maxHands: 1, baseWinChipBonus: 20 };
  return {};
}

function applyVoucher(id: string): void {
  const s = getState();
  const d = getVoucherDeltas(id);
  addVoucher(id);
  recordVoucherRedeemed(id, s.ante);
  const patch: Partial<GameState> = {
    maxHands: s.maxHands + (d.maxHands || 0),
    baseWinMultBonus: s.baseWinMultBonus + (d.baseWinMultBonus || 0),
    maxJokers: s.maxJokers + (d.maxJokers || 0),
    baseWinChipBonus: s.baseWinChipBonus + (d.baseWinChipBonus || 0)
  };
  if (id === 'clearance_sale') {
    patch.rerollCost = 1;
  }
  patchState(patch);
}

/* ---------- Pack Actions & Opening ---------- */
function buyAndOpenPack(idx: number): { ok: boolean; reason?: ShopFailReason; pack?: ShopPackSlot; options?: PackCardOption[] } {
  const s = getState();
  const pack = s.shopPacks[idx];
  if (!pack || pack.bought) return { ok: false, reason: 'invalid' };
  if (s.money < pack.cost) return { ok: false, reason: 'too_poor' };

  spendMoney(pack.cost);

  // Record money spent
  if (pack.packType === 'joker') recordMoneySpent('jokers', pack.cost);
  else if (pack.packType === 'tarot' || pack.packType === 'cheat') recordMoneySpent('tarots', pack.cost);
  else if (pack.packType === 'card') recordMoneySpent('cards', pack.cost);
  else recordMoneySpent('cards', pack.cost);

  markShopPackBought(idx);
  recordPackOpened(pack.id, pack.cost);

  const options = generatePackOptions(pack);
  for (const opt of options) {
    if (opt.kind === 'joker' && opt.data) recordJokerDiscovered(opt.data.id);
    else if ((opt.kind === 'tarot' || opt.kind === 'cheat') && opt.data) recordTarotDiscovered(opt.data.id);
  }

  const hasTarotOption = options.some(o => o.kind === 'tarot');
  const deckCards = hasTarotOption ? drawPackDeckCards(s.deck, 5) : undefined;
  let selectedDeckCardUid: number | null = null;
  if (deckCards && deckCards.length > 0) {
    const firstTarot = options.find(o => o.kind === 'tarot');
    const defaultEligible = firstTarot
      ? (deckCards.find(c => isCardEligibleForTarot(firstTarot.data.id, c)) || deckCards[0])
      : deckCards[0];
    selectedDeckCardUid = defaultEligible ? defaultEligible.uid : null;
  }

  const active: ActivePackOpening = {
    pack,
    options,
    chosen: false,
    deckCards,
    selectedDeckCardUid
  };

  patchState({ activePackOpening: active });
  return { ok: true, pack, options };
}

function selectPackDeckCard(cardUid: number | string | null): boolean {
  const s = getState();
  const active = s.activePackOpening;
  if (!active || !active.deckCards) return false;
  if (cardUid === null) {
    active.selectedDeckCardUid = null;
    patchState({ activePackOpening: { ...active } });
    return true;
  }
  const numUid = typeof cardUid === 'number' ? cardUid : Number(cardUid);
  const found = active.deckCards.find(c => c.uid === numUid);
  if (!found) return false;
  if (active.selectedDeckCardUid === numUid) {
    // Tapping the currently selected card deselects and lowers it
    active.selectedDeckCardUid = null;
  } else {
    active.selectedDeckCardUid = numUid;
  }
  patchState({ activePackOpening: { ...active } });
  return true;
}

function pickPackOption(optIdx: number, targetCardUid?: number | string): { ok: boolean; reason?: ShopFailReason; picked?: PackCardOption; targetCard?: Card; message?: string; warning?: string } {
  const s = getState();
  const active = s.activePackOpening;
  if (!active || active.chosen) return { ok: false, reason: 'invalid' };

  const opt = active.options[optIdx];
  if (!opt) return { ok: false, reason: 'invalid' };

  let resultMessage: string | undefined;
  let modifiedCard: Card | undefined;

  if (opt.kind === 'joker') {
    if (s.jokers.length >= s.maxJokers) {
      return { ok: false, reason: 'jokers_full' };
    }
    addJoker({ ...opt.data, bonusMult: 0, bonusChips: 0 });
    recordJokerAcquired(opt.data.id);
    if (opt.data.id === 'loan_shark') {
      addMoney(15);
      recordMoneyEarned('loanShark', 15);
      recordJokerTrigger('loan_shark', opt.data.name);
    }
  } else if (opt.kind === 'cheat') {
    if (s.consumables.length >= s.maxConsumables) {
      return { ok: false, reason: 'tarots_full' };
    }
    addConsumable({ ...opt.data, consumableType: 'cheat' });
    recordTarotAcquired(opt.data.id);
  } else if (opt.kind === 'tarot') {
    // Balatro-style Tarot Pack: immediately use the picked Tarot on a selected card from the deck!
    const t = opt.data;
    const pool = (active.deckCards && active.deckCards.length > 0) ? active.deckCards : s.deck;
    const explicitUid = targetCardUid !== undefined
      ? (typeof targetCardUid === 'number' ? targetCardUid : Number(targetCardUid))
      : active.selectedDeckCardUid;

    let target: Card | undefined;
    if (active.deckCards && active.deckCards.length > 0) {
      if (explicitUid === null || explicitUid === undefined) {
        return { ok: false, reason: 'invalid', warning: 'Please select a playing card from your deck hand below first!' };
      }
      target = pool.find(c => c.uid === explicitUid) || s.deck.find(c => c.uid === explicitUid);
      if (!target || !isCardEligibleForTarot(t.id, target)) {
        return { ok: false, reason: 'invalid', warning: `The selected card is not eligible for ${t.name}!` };
      }
    } else {
      target = explicitUid !== null && explicitUid !== undefined
        ? pool.find(c => c.uid === explicitUid) || s.deck.find(c => c.uid === explicitUid)
        : undefined;
      if (!target || !isCardEligibleForTarot(t.id, target)) {
        target = pool.find(c => isCardEligibleForTarot(t.id, c)) || s.deck.find(c => isCardEligibleForTarot(t.id, c));
      }
    }

    if (!target) {
      return { ok: false, reason: 'invalid', warning: `No eligible card available for ${t.name}!` };
    }

    const deckRef = s.deck.find(c => c.uid === target!.uid) || target;
    const applyRes = applyTarotToDeckCard(t, deckRef);
    if (!applyRes.ok) {
      return { ok: false, reason: 'invalid', warning: applyRes.warning };
    }

    // Keep active.deckCards copy in sync
    target.rank = deckRef.rank;
    target.suit = deckRef.suit;
    target.enhancement = deckRef.enhancement;

    recordTarotAcquired(t.id);
    recordTarotCast(t.id);
    _state.runStats.tarotsUsed++;

    modifiedCard = deckRef;
    resultMessage = applyRes.message;
  } else if (opt.kind === 'card') {
    const newCard: Card = { uid: takeNextCardUid(), rank: opt.data.rank, suit: opt.data.suit, enhancement: opt.data.enhancement };
    addCardToDeck(newCard);
    addCardToShoe({ ...newCard });
    if (opt.data.enhancement) {
      recordEffectEnhanced(opt.data.enhancement);
    }
  }

  recordPackCardDrafted(active.pack.id);
  active.chosen = true;
  patchState({ activePackOpening: null });
  return { ok: true, picked: opt, targetCard: modifiedCard, message: resultMessage };
}

function skipPackOpening(): boolean {
  const s = getState();
  if (!s.activePackOpening) return false;
  recordPackSkipped(s.activePackOpening.pack.id);
  patchState({ activePackOpening: null });
  return true;
}

function buyShopItem(listName: 'shopJokers' | 'shopExtras' | 'shopPacks', idx: number): ShopActionResult {
  if (listName === 'shopPacks') {
    const res = buyAndOpenPack(idx);
    return { ok: res.ok, reason: res.reason };
  }
  const s = getState();
  const item: ShopJokerSlot | ShopExtraSlot | undefined = (s as any)[listName]?.[idx];
  if (!item || item.bought) return { ok: false, reason: 'invalid' };
  if (s.money < item.cost) return { ok: false, reason: 'too_poor' };

  if (item.shopType === 'joker') {
    if (s.jokers.length >= s.maxJokers) return { ok: false, reason: 'jokers_full' };
    spendMoney(item.cost);
    recordMoneySpent('jokers', item.cost);
    markShopItemBought(listName as any, idx);
    addJoker({ ...item, bonusMult: item.bonusMult || 0, bonusChips: item.bonusChips || 0 });
    recordJokerAcquired(item.id);
    if (item.id === 'loan_shark') {
      addMoney(15);
      recordMoneyEarned('loanShark', 15);
      recordJokerTrigger('loan_shark', item.name);
    }
  } else if (item.shopType === 'tarot') {
    if (s.consumables.length >= s.maxConsumables) return { ok: false, reason: 'tarots_full' };
    spendMoney(item.cost);
    recordMoneySpent('tarots', item.cost);
    markShopItemBought(listName as any, idx);
    addConsumable({ ...item });
    recordTarotAcquired(item.id);
  } else if (item.shopType === 'card') {
    spendMoney(item.cost);
    recordMoneySpent('cards', item.cost);
    markShopItemBought(listName as any, idx);
    const newCard: Card = { uid: takeNextCardUid(), ...item.cardData };
    addCardToDeck(newCard);
    addCardToShoe({ ...newCard });
    if (item.cardData?.enhancement) {
      recordEffectEnhanced(item.cardData.enhancement);
    }
  } else if (item.shopType === 'voucher') {
    spendMoney(item.cost);
    recordMoneySpent('vouchers', item.cost);
    markShopItemBought(listName as any, idx);
    applyVoucher(item.id);
    if (s.currentAnteVoucher && s.currentAnteVoucher.id === item.id) {
      patchState({ currentAnteVoucher: { ...s.currentAnteVoucher, bought: true } });
    }
    _state.runStats.vouchersBoughtCount++;
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
  recordMoneyEarned('sales', value);
  return value;
}

function sellConsumable(index: number): boolean {
  const s = getState();
  const c = s.consumables[index];
  if (!removeConsumableAt(index)) return false;
  if (c) recordTarotSold(c.id);
  addMoney(1);
  recordMoneyEarned('sales', 1);
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

function useConsumable(index: number, targetCardUid?: number | string): ConsumableResult {
  const s = getState();
  if (!s.inHand || s.isDealing) return { ok: false };
  const c = s.consumables[index];
  if (!c) return { ok: false };

  const numUid = targetCardUid !== undefined ? (typeof targetCardUid === 'number' ? targetCardUid : Number(targetCardUid)) : undefined;
  let targetCard = numUid !== undefined ? s.playerHand.find(card => card.uid === numUid) : undefined;
  if (targetCardUid !== undefined && !targetCard) {
    return { ok: false, warning: 'Selected card is not in your active hand!' };
  }

  let message = '';
  if (c.id === 'x_ray') {
    patchState({ dealerHoleRevealed: true, tempBonusChips: s.tempBonusChips + 75 });
    message = 'X-Ray Specs: Hole card revealed & +75 Chips!';
  } else if (c.id === 'loaded_ace') {
    const ace: Card = { uid: takeNextCardUid(), rank: 'A', suit: '♠', enhancement: 'foil' };
    addCardToDeck({ ...ace });
    addCardToPlayerHand(ace);
    recordEffectEnhanced('foil');
    message = 'Loaded Ace drawn into hand!';
  } else if (c.id === 'card_shave') {
    if (!targetCard) {
      targetCard = s.playerHand.find(card => card.rank !== 'A' && card.rank !== '2') || s.playerHand.find(card => card.rank !== 'A');
    }
    if (!targetCard) return { ok: false, warning: 'No eligible high card available to shave!' };
    if (targetCard.rank === 'A') return { ok: false, warning: 'Aces cannot be shaved!' };
    const val = FACE_RANKS.includes(targetCard.rank) ? 10 : parseInt(targetCard.rank, 10);
    const newRank = String(Math.max(2, val - 3)) as Rank;
    setCardRank(targetCard, newRank);
    message = `Card Shave reduced rank to ${targetCard.rank}!`;
  } else if (c.id === 'midas_touch') {
    if (!targetCard) {
      targetCard = s.playerHand[s.playerHand.length - 1];
    }
    if (!targetCard) return { ok: false, warning: 'No card in hand to enhance!' };
    setCardEnhancement(targetCard, 'gold');
    recordEffectEnhanced('gold');
    message = `${targetCard.rank}${targetCard.suit} turned Gold!`;
  } else if (c.id === 'double_vision') {
    patchState({ doubledDown: true });
    const dblMult = s.jokers.some(j => j.id === 'double_or_nothing') ? 3 : 2;
    message = `Double Vision: Hand Doubled Down (×${dblMult} Mult)!`;
  } else if (c.id === 'polychrome_dice') {
    if (!targetCard) {
      targetCard = s.playerHand[0];
    }
    if (!targetCard) return { ok: false, warning: 'No card in hand to enhance!' };
    setCardEnhancement(targetCard, 'poly');
    recordEffectEnhanced('poly');
    message = `${targetCard.rank}${targetCard.suit} enhanced to Polychrome (×1.5 Mult)!`;
  } else if (c.id === 'the_guillotine') {
    if (s.playerHand.length === 0) return { ok: false, warning: 'No card in hand to destroy!' };
    if (!targetCard) {
      targetCard = s.playerHand[0];
    }
    removeCardFromGame(targetCard.uid);
    message = `The Guillotine permanently destroyed ${targetCard.rank}${targetCard.suit}!`;
  } else if (c.id === 'card_forge') {
    if (!targetCard) {
      const nonAces = s.playerHand.filter(card => card.rank !== 'A');
      if (nonAces.length === 0) return { ok: false, warning: 'No non-Ace card in hand!' };
      const rankOrder: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      nonAces.sort((a, b) => rankOrder.indexOf(b.rank) - rankOrder.indexOf(a.rank));
      targetCard = nonAces[0];
    }
    if (targetCard.rank === 'A') return { ok: false, warning: 'Aces cannot be upgraded!' };
    const rankOrder: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const curIdx = rankOrder.indexOf(targetCard.rank);
    const newIdx = Math.min(rankOrder.length - 1, curIdx + 2);
    setCardRank(targetCard, rankOrder[newIdx]);
    message = `Card Forge upgraded card to ${targetCard.rank}!`;
  } else if (c.id === 'wild_suit') {
    if (!targetCard) {
      targetCard = s.playerHand[0];
    }
    if (!targetCard) return { ok: false, warning: 'No card in hand to enhance!' };
    setCardEnhancement(targetCard, 'foil');
    recordEffectEnhanced('foil');
    message = `${targetCard.rank}${targetCard.suit} enhanced to Foil (+30 Chips)!`;
  } else if (c.id === 'lucky_charm') {
    if (!targetCard) {
      targetCard = s.playerHand[s.playerHand.length - 1];
    }
    if (!targetCard) return { ok: false, warning: 'No card in hand to enhance!' };
    setCardEnhancement(targetCard, 'holo');
    recordEffectEnhanced('holo');
    message = `${targetCard.rank}${targetCard.suit} enhanced to Holo (+4 Mult)!`;
  }

  recordTarotCastInHand(c.id);
  _state.runStats.tarotsUsed++;
  removeConsumableAt(index);
  return { ok: true, message };
}

if (typeof window !== 'undefined') {
  (window as any).useConsumable = useConsumable;
  (window as any).selectPackDeckCard = selectPackDeckCard;
  (window as any).applyTarotToDeckCard = applyTarotToDeckCard;
}
