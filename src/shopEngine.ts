/* ==========================================================
   shopEngine.ts - ECONOMY, SHOP, CONSUMABLES & BLIND PROGRESSION
   Pricing, interest, payouts, buying/selling, Tarot effects and the
   state-side of moving between Blinds. No DOM, no audio, no alerts:
   every action returns a result object and the UI decides how to
   show it. All state access goes through gameState.ts.
   Depends on (global): gameState.ts, deckEngine.ts, modifierEngine.ts
========================================================== */

/* ---------- Constants ---------- */
const ANTE_TARGETS: ReadonlyArray<number> = [300, 540, 960, 1720, 3050, 5450, 9700, 17200];
/** Target multiplier per Blind (Small, Big, Boss). */
const BLIND_TARGET_MULTS: ReadonlyArray<number> = [1.0, 1.35, 1.7];
/** Cash reward per Blind (Small, Big, Boss). */
const BLIND_REWARDS: ReadonlyArray<number> = [4, 5, 6];
const INTEREST_PER = 5;
const INTEREST_CAP = 5;
const SHOP_BASE_REROLL = 3;

/** Helper to determine if a voucher is available in the pool (enforcing prerequisite trees). */
function isVoucherAvailable(vId: string, vouchersBought: ReadonlyArray<string>): boolean {
  if (vouchersBought.includes(vId)) return false;
  if (vId === 'joker_slot') {
    return vouchersBought.includes('blank_voucher');
  }
  if (vId === 'extra_hand_2') {
    return vouchersBought.includes('extra_hand');
  }
  if (vId === 'clearance_sale_2') {
    return vouchersBought.includes('clearance_sale');
  }
  if (vId === 'overstock_2') {
    return vouchersBought.includes('overstock');
  }
  return true;
}

/* ---------- Pure economy helpers (shared with simulator) ---------- */
function computeBlindTarget(ante: number, blindIndex: number, targetScalePct: number): number {
  let rawBase: number;
  if (ante <= ANTE_TARGETS.length) {
    rawBase = ANTE_TARGETS[ante - 1];
  } else {
    const maxBase = ANTE_TARGETS[ANTE_TARGETS.length - 1]; // 17,200
    rawBase = Math.round(maxBase * Math.pow(2.2, ante - ANTE_TARGETS.length));
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
  hasBanker: boolean = false
): PendingPayout {
  const blindReward = BLIND_REWARDS[Math.min(blindIndex, 2)];
  const handBonus = Math.min(unusedDealCashCap, dealsLeft);
  let interest = computeInterest(money, maxInterest, interestPer);
  if (hasBanker) {
    interest = Math.ceil(interest * 1.5);
  }
  const totalEarned = Math.max(0, blindReward + handBonus + interest);
  return { blindReward, handBonus, interest, totalEarned };
}

/** Payout for clearing the current Blind, from current state. Does not modify state. */
function computeBlindPayout(): PendingPayout {
  const s = getState();
  const maxInterest = s.vouchersBought.includes('deep_pockets') ? 8 : INTEREST_CAP;
  const interestPer = s.vouchersBought.includes('liquidity_pass') ? 4 : INTEREST_PER;
  const hasBanker = s.jokers.some(j => j.id === 'the_banker');
  return calcBlindPayout(s.blindIndex, s.handsLeft, s.money, getBalanceConfig().unusedDealCashCap, maxInterest, interestPer, hasBanker);
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
function beginBlindState(): { bankerTriggered: boolean; markedDeckCreatedCheats: TarotDef[] } {
  const s = getState();
  let handsLeft = s.maxHands;
  if (s.bossBlind && s.bossBlind.id === 'the_cooler') {
    handsLeft = Math.max(1, handsLeft - 1);
  }
  let bankerTriggered = false;
  if (s.jokers.some(j => j.id === 'the_banker') && s.money >= 25) {
    handsLeft += 1;
    bankerTriggered = true;
    recordJokerTrigger('the_banker', 'The Banker');
    recordJokerTriggerStats('the_banker', 0, 0);
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
    roundCashEarned: 0,
    cardsSeenThisBlind: [],
    runningCount: 0
  });
  setShoe(buildShoeFromDeck());

  const markedDeckCreatedCheats: TarotDef[] = [];
  const markedDecks = s.jokers.filter(j => j.id === 'marked_deck');
  for (const _ of markedDecks) {
    const cur = getState();
    if (cur.consumables.length < cur.maxConsumables) {
      const cheat = CHEAT_CATALOG[Math.floor(Math.random() * CHEAT_CATALOG.length)];
      const cheatCopy: TarotDef = { ...cheat, consumableType: 'cheat' };
      addConsumable(cheatCopy);
      recordTarotAcquired(cheat.id);
      recordJokerTrigger('marked_deck', 'Marked Deck');
      recordJokerTriggerStats('marked_deck', 0, 0);
      markedDeckCreatedCheats.push(cheatCopy);
    }
  }

  return { bankerTriggered, markedDeckCreatedCheats };
}

/** Full new-run reset: fresh uids + deck, first Blind configured and begun. */
function startNewRunState(): { bankerTriggered: boolean; markedDeckCreatedCheats: TarotDef[] } {
  resetCardUid();
  resetRunState(createStandardDeck());
  configureBlindMetrics();
  return beginBlindState();
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


  let blindIndex = s.blindIndex + 1;
  let ante = s.ante;
  if (blindIndex > 2) {
    blindIndex = 0;
    ante++;
  }
  const rerollCost = s.vouchersBought.includes('clearance_sale_2') ? 1 : (s.vouchersBought.includes('clearance_sale') ? 2 : SHOP_BASE_REROLL);
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

function pickDistinctCards<T extends { id: string }>(catalog: ReadonlyArray<T>, count: number, excludeIds: string[]): T[] {
  const unowned = catalog.filter(item => !excludeIds.includes(item.id));
  const pool = unowned.length > 0 ? unowned : catalog;
  const shuffled = shuffle([...pool]);
  if (shuffled.length >= count) {
    return shuffled.slice(0, count);
  }
  const picked = [...shuffled];
  const remaining = catalog.filter(item => !picked.some(p => p.id === item.id));
  const extra = shuffle([...remaining]).slice(0, count - picked.length);
  return [...picked, ...extra];
}

function generatePackOptions(pack: PackDef, ownedJokerIds?: string[], ownedConsumableIds?: string[]): PackCardOption[] {
  const ownedIds = ownedJokerIds !== undefined ? ownedJokerIds : getState().jokers.map(j => j.id);
  const ownedConsumables = ownedConsumableIds !== undefined ? ownedConsumableIds : (getState().consumables || []).map(c => c.id);
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
    const picked = pickDistinctCards(DECK_TAROT_CATALOG, pack.cardsCount, ownedConsumables);
    for (const t of picked) {
      options.push({ kind: 'tarot', data: t });
    }
  } else if (pack.packType === 'cheat') {
    const picked = pickDistinctCards(CHEAT_CATALOG, pack.cardsCount, ownedConsumables);
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
    const availTarots = DECK_TAROT_CATALOG.filter(t => !ownedConsumables.includes(t.id));
    const t = shuffle([...(availTarots.length > 0 ? availTarots : DECK_TAROT_CATALOG)])[0];
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

function applyTarotToDeckCards(tarot: TarotDef, targetCards: Card[]): { ok: boolean; message?: string; warning?: string } {
  if (!targetCards || targetCards.length === 0) return { ok: false, warning: 'No target card selected!' };

  let message = '';
  if (tarot.id === 'midas_touch') {
    const targetCard = targetCards[0];
    setCardEnhancement(targetCard, 'gold');
    recordEffectEnhanced('gold');
    message = `${tarot.name}: ${targetCard.rank}${targetCard.suit} turned Gold (+$3 when scored)!`;
  } else if (tarot.id === 'polychrome_dice') {
    targetCards.forEach(c => {
      setCardEnhancement(c, 'poly');
      recordEffectEnhanced('poly');
    });
    const names = targetCards.map(c => `${c.rank}${c.suit}`).join(', ');
    message = `Polychrome Dice enhanced ${names} to Polychrome (×1.5 Mult)!`;
  } else if (tarot.id === 'wild_suit' || tarot.id === 'prism_dye') {
    targetCards.forEach(c => {
      setCardEnhancement(c, 'foil');
      recordEffectEnhanced('foil');
    });
    const names = targetCards.map(c => `${c.rank}${c.suit}`).join(', ');
    message = `Prism Dye enhanced ${names} to Foil (+30 Chips)!`;
  } else if (tarot.id === 'lucky_charm') {
    targetCards.forEach(c => {
      setCardEnhancement(c, 'holo');
      recordEffectEnhanced('holo');
    });
    const names = targetCards.map(c => `${c.rank}${c.suit}`).join(', ');
    message = `Lucky Charm enhanced ${names} to Holo (+4 Mult)!`;
  } else if (tarot.id === 'the_lovers') {
    const targetCard = targetCards[0];
    setCardSuit(targetCard, '★');
    message = `${tarot.name}: ${targetCard.rank}★ turned Wild (counts as any suit)!`;
  } else if (tarot.id === 'the_sun') {
    targetCards.forEach(c => setCardSuit(c, '♥'));
    message = `The Sun converted ${targetCards.length} card(s) to Hearts!`;
  } else if (tarot.id === 'the_star') {
    targetCards.forEach(c => setCardSuit(c, '♦'));
    message = `The Star converted ${targetCards.length} card(s) to Diamonds!`;
  } else if (tarot.id === 'the_moon') {
    targetCards.forEach(c => setCardSuit(c, '♣'));
    message = `The Moon converted ${targetCards.length} card(s) to Clubs!`;
  } else if (tarot.id === 'the_world') {
    targetCards.forEach(c => setCardSuit(c, '♠'));
    message = `The World converted ${targetCards.length} card(s) to Spades!`;
  } else if (tarot.id === 'the_guillotine') {
    const names = targetCards.map(c => `${c.rank}${c.suit}`).join(', ');
    targetCards.forEach(c => removeCardFromGame(c.uid));
    message = `The Guillotine permanently destroyed ${names} from your deck!`;
  } else if (tarot.id === 'card_forge') {
    const rankOrder: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const upgradedNames: string[] = [];
    for (const targetCard of targetCards) {
      if (targetCard.rank === 'A') continue;
      const curIdx = rankOrder.indexOf(targetCard.rank);
      if (curIdx < rankOrder.length - 1) {
        setCardRank(targetCard, rankOrder[curIdx + 1]);
        upgradedNames.push(`${targetCard.rank}${targetCard.suit}`);
      }
    }
    if (upgradedNames.length === 0) {
      return { ok: false, warning: 'Aces cannot be upgraded!' };
    }
    message = `Card Forge upgraded ${upgradedNames.join(', ')}!`;
  } else if (tarot.id === 'card_shave') {
    const rankOrder: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const shavedNames: string[] = [];
    for (const targetCard of targetCards) {
      if (targetCard.rank === '2') continue;
      const curIdx = rankOrder.indexOf(targetCard.rank);
      if (curIdx > 0) {
        setCardRank(targetCard, rankOrder[curIdx - 1]);
        shavedNames.push(`${targetCard.rank}${targetCard.suit}`);
      }
    }
    if (shavedNames.length === 0) {
      return { ok: false, warning: 'This card cannot be shaved (already 2)!' };
    }
    message = `Card Shave reduced ${shavedNames.join(', ')}!`;
  } else {
    return { ok: false, warning: 'This card cannot be applied to deck cards!' };
  }

  return { ok: true, message };
}

function applyTarotToDeckCard(tarot: TarotDef, targetCard: Card): { ok: boolean; message?: string; warning?: string } {
  return applyTarotToDeckCards(tarot, targetCard ? [targetCard] : []);
}

/** Pure helper to generate packs for a shop visit (shared with simulator). */
function generateShopPacks(ante: number, jokersCount: number, vouchersBoughtOrOverstock?: ReadonlyArray<string> | boolean): PackDef[] {
  let numPacks = 1;
  if (Array.isArray(vouchersBoughtOrOverstock)) {
    if (vouchersBoughtOrOverstock.includes('overstock_2')) {
      numPacks = 3;
    } else if (vouchersBoughtOrOverstock.includes('overstock')) {
      numPacks = 2;
    } else {
      numPacks = 1;
    }
  } else if (typeof vouchersBoughtOrOverstock === 'boolean') {
    numPacks = vouchersBoughtOrOverstock ? 2 : 1;
  }
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

/* ---------- Single Cards (Jokers & Tarots) Generation ---------- */
function generateShopSingleCards(ante: number, jokersCount: number, ownedJokerIds?: string[], ownedConsumableIds?: string[]): ShopJokerSlot[] {
  const ownedIds = ownedJokerIds !== undefined ? [...ownedJokerIds] : getState().jokers.map(j => j.id);
  const ownedConsumables = ownedConsumableIds !== undefined ? [...ownedConsumableIds] : (getState().consumables || []).map(c => c.id);
  const excludedJokerIds = [...ownedIds];
  const excludedTarotIds: string[] = [...ownedConsumables];
  const slots: ShopJokerSlot[] = [];

  // Balatro standard shop offers 2 single card slots
  const slotCount = 2;

  for (let i = 0; i < slotCount; i++) {
    // In Ante 1 with 0 jokers, guarantee at least 1 Joker in slot 0 to jumpstart synergy
    const forceJoker = (ante === 1 && jokersCount === 0 && i === 0);
    // Standard Balatro distribution: ~65% Joker, ~35% Tarot
    const rollIsJoker = forceJoker || Math.random() < 0.65;

    if (rollIsJoker) {
      const rolled = rollWeightedJoker(excludedJokerIds);
      if (rolled) {
        excludedJokerIds.push(rolled.id);
        slots.push({
          ...rolled,
          bonusMult: 0,
          bonusChips: 0,
          shopType: 'joker' as const,
          bought: false
        });
        continue;
      }
    }

    // Roll Tarot / Consumable
    const unpickedTarots = TAROT_CATALOG.filter(t => !excludedTarotIds.includes(t.id));
    const pool = unpickedTarots.length > 0 ? unpickedTarots : TAROT_CATALOG.filter(t => !ownedConsumables.includes(t.id));
    const finalPool = pool.length > 0 ? pool : TAROT_CATALOG;
    const rolledTarot = shuffle([...finalPool])[0];
    if (rolledTarot) {
      excludedTarotIds.push(rolledTarot.id);
      slots.push({
        ...rolledTarot,
        shopType: 'tarot' as const,
        bought: false
      });
    } else {
      // Fallback to any available Joker
      const anyJoker = rollWeightedJoker(excludedJokerIds) || shuffle(JOKER_CATALOG)[0];
      slots.push({
        ...anyJoker,
        bonusMult: 0,
        bonusChips: 0,
        shopType: 'joker' as const,
        bought: false
      });
    }
  }

  return slots;
}

/* ---------- Shop stock ---------- */
function generateShopStock(): void {
  const s = getState();
  const packs = generateShopPacks(s.ante, s.jokers.length, s.vouchersBought);
  const packsOffered: ShopPackSlot[] = packs.map(p => ({ ...p, shopType: 'pack', bought: false }));

  // Generate single cards (Jokers and Tarots)
  const singleCards = generateShopSingleCards(s.ante, s.jokers.length, s.jokers.map(j => j.id), s.consumables.map(c => c.id));

  // Voucher handling: 1 voucher per ante, persisting across blinds until bought or next ante
  let voucherOffer: ShopVoucher[] = [];
  if (s.voucherAnte !== s.ante) {
    // New ante! Refresh voucher offer
    const availVouchers = VOUCHER_CATALOG.filter(v => isVoucherAvailable(v.id, s.vouchersBought));
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

  setShopStock(singleCards, voucherOffer, packsOffered);

  // Lifetime Telemetry: Record offered items
  for (const c of singleCards) {
    if (c.shopType === 'joker') recordJokerDiscovered(c.id);
    else if (c.shopType === 'tarot') recordTarotDiscovered(c.id);
  }
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
  if (s.vouchersBought.includes('clearance_sale_2')) {
    recordVoucherValue('clearance_sale_2', 1);
    recordVoucherValue('clearance_sale', 1);
  } else if (s.vouchersBought.includes('clearance_sale')) {
    recordVoucherValue('clearance_sale', 1);
  }
  patchState({ rerollCost: s.rerollCost + 1 });

  // Reroll ONLY single cards; packs and voucher remain fixed
  const freshSingleCards = generateShopSingleCards(s.ante, s.jokers.length, s.jokers.map(j => j.id), s.consumables.map(c => c.id));
  setShopStock(freshSingleCards, s.shopExtras, s.shopPacks);

  // Record discovery telemetry for newly rolled single cards
  for (const c of freshSingleCards) {
    if (c.shopType === 'joker') recordJokerDiscovered(c.id);
    else if (c.shopType === 'tarot') recordTarotDiscovered(c.id);
  }

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
  if (id === 'extra_hand' || id === 'extra_hand_2') return { maxHands: 1 };
  if (id === 'joker_slot') return { maxJokers: 1 };
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
    patch.rerollCost = Math.min(s.rerollCost, 2);
  } else if (id === 'clearance_sale_2') {
    patch.rerollCost = Math.min(s.rerollCost, 1);
  } else if (id === 'overstock' || id === 'overstock_2') {
    if (s.inShop) {
      const updatedPacks = generateShopPacks(s.ante, s.jokers.length, [...s.vouchersBought, id]);
      patch.shopPacks = updatedPacks.map(p => ({ ...p, shopType: 'pack', bought: false }));
    }
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

  const options = generatePackOptions(pack, s.jokers.map(j => j.id), s.consumables.map(c => c.id));
  for (const opt of options) {
    if (opt.kind === 'joker' && opt.data) recordJokerDiscovered(opt.data.id);
    else if ((opt.kind === 'tarot' || opt.kind === 'cheat') && opt.data) recordTarotDiscovered(opt.data.id);
  }

  const hasTarotOption = options.some(o => o.kind === 'tarot');
  const deckCards = hasTarotOption ? drawPackDeckCards(s.deck, 5) : undefined;

  const active: ActivePackOpening = {
    pack,
    options,
    chosen: false,
    deckCards,
    selectedDeckCardUid: null,
    selectedDeckCardUids: []
  };

  patchState({ activePackOpening: active });
  return { ok: true, pack, options };
}

function selectPackDeckCard(cardUid: number | string | null): boolean {
  const s = getState();
  const active = s.activePackOpening;
  if (!active || !active.deckCards) return false;
  if (!active.selectedDeckCardUids) {
    active.selectedDeckCardUids = active.selectedDeckCardUid !== null && active.selectedDeckCardUid !== undefined
      ? [active.selectedDeckCardUid]
      : [];
  }
  if (cardUid === null) {
    active.selectedDeckCardUid = null;
    active.selectedDeckCardUids = [];
    patchState({ activePackOpening: { ...active } });
    return true;
  }
  const numUid = typeof cardUid === 'number' ? cardUid : Number(cardUid);
  const found = active.deckCards.find(c => c.uid === numUid);
  if (!found) return false;

  const idx = active.selectedDeckCardUids.indexOf(numUid);
  if (idx >= 0) {
    // Tapping the currently selected card deselects it
    active.selectedDeckCardUids.splice(idx, 1);
  } else {
    // Player can select as many cards as they want without limit
    active.selectedDeckCardUids.push(numUid);
  }
  active.selectedDeckCardUid = active.selectedDeckCardUids.length > 0 ? active.selectedDeckCardUids[active.selectedDeckCardUids.length - 1] : null;
  patchState({ activePackOpening: { ...active } });
  return true;
}

function pickPackOption(optIdx: number, targetCardUid?: number | string | (number | string)[]): { ok: boolean; reason?: ShopFailReason; picked?: PackCardOption; targetCard?: Card; targetCards?: Card[]; message?: string; warning?: string } {
  const s = getState();
  const active = s.activePackOpening;
  if (!active || active.chosen) return { ok: false, reason: 'invalid' };

  const opt = active.options[optIdx];
  if (!opt) return { ok: false, reason: 'invalid' };

  let resultMessage: string | undefined;
  let modifiedCard: Card | undefined;
  let targetCardsResult: Card[] = [];

  if (opt.kind === 'joker') {
    if (s.jokers.length >= s.maxJokers) {
      return { ok: false, reason: 'jokers_full' };
    }
    addJoker({ ...opt.data, bonusMult: 0, bonusChips: 0 });
    recordJokerAcquired(opt.data.id);
    resultMessage = `Added ${opt.data.name} to your Jokers!`;
  } else if (opt.kind === 'cheat') {
    if (s.consumables.length >= s.maxConsumables) {
      return { ok: false, reason: 'tarots_full' };
    }
    addConsumable({ ...opt.data, consumableType: 'cheat' });
    recordTarotAcquired(opt.data.id);
  } else if (opt.kind === 'tarot') {
    const t = opt.data;
    const max = getTarotMaxCards(t.id);
    let uids: number[] = [];
    if (Array.isArray(targetCardUid)) {
      uids = targetCardUid.map(x => Number(x));
    } else if (targetCardUid !== undefined && targetCardUid !== null) {
      uids = [Number(targetCardUid)];
    } else if (active.selectedDeckCardUids && active.selectedDeckCardUids.length > 0) {
      uids = [...active.selectedDeckCardUids];
    } else if (active.selectedDeckCardUid !== null && active.selectedDeckCardUid !== undefined) {
      uids = [active.selectedDeckCardUid];
    }

    if (max === 0) {
      if (t.id === 'judgement') {
        if (s.jokers.length >= s.maxJokers) {
          return { ok: false, reason: 'jokers_full', warning: 'No room for another Joker (slots full)!' };
        }
        const ownedIds = s.jokers.map(j => j.id);
        const unowned = JOKER_CATALOG.filter(j => !ownedIds.includes(j.id));
        const chosen = unowned.length > 0 ? shuffle(unowned)[0] : shuffle(JOKER_CATALOG)[0];
        addJoker({ ...chosen, bonusMult: 0, bonusChips: 0 });
        recordJokerAcquired(chosen.id);
        recordTarotAcquired(t.id);
        recordTarotCast(t.id);
        _state.runStats.tarotsUsed++;
        patchState({ lastTarotUsedId: t.id, lastTarotUsedName: t.name });
        resultMessage = `Judgement created ${chosen.name}!`;
      } else if (t.id === 'nostradamus') {
        if (!s.lastTarotUsedId || s.lastTarotUsedId === 'nostradamus') {
          return { ok: false, reason: 'invalid', warning: 'Cannot be used: last tarot used was Nostradamus or none!' };
        }
        const prevDef = TAROT_CATALOG.find(x => x.id === s.lastTarotUsedId) || DECK_TAROT_CATALOG.find(x => x.id === s.lastTarotUsedId);
        if (!prevDef) {
          return { ok: false, reason: 'invalid', warning: 'Previous Tarot not found!' };
        }
        if (s.consumables.length >= s.maxConsumables) {
          return { ok: false, reason: 'tarots_full', warning: 'No room in consumable inventory!' };
        }
        addConsumable({ ...prevDef });
        recordTarotAcquired(prevDef.id);
        recordTarotAcquired(t.id);
        recordTarotCast(t.id);
        _state.runStats.tarotsUsed++;
        patchState({ lastTarotUsedId: t.id, lastTarotUsedName: t.name });
        resultMessage = `Nostradamus created ${prevDef.name}!`;
      }
    } else {
      // Card-targeted tarots
      if (uids.length > max) {
        return {
          ok: false,
          reason: 'invalid',
          warning: `Too many cards selected! ${t.name} allows up to ${max} cards (currently ${uids.length}).`
        };
      }

      const pool = (active.deckCards && active.deckCards.length > 0) ? active.deckCards : s.deck;
      let targets: Card[] = uids.map(uid => pool.find(c => c.uid === uid) || s.deck.find(c => c.uid === uid)).filter((c): c is Card => !!c);

      for (const tgt of targets) {
        if (!isCardEligibleForTarot(t.id, tgt)) {
          return { ok: false, reason: 'invalid', warning: `The selected card ${tgt.rank}${tgt.suit} is not eligible for ${t.name}!` };
        }
      }

      // Fallback if no cards in deck hand (e.g. mock test)
      if (targets.length === 0 && (!active.deckCards || active.deckCards.length === 0)) {
        const fallback = pool.find(c => isCardEligibleForTarot(t.id, c)) || s.deck.find(c => isCardEligibleForTarot(t.id, c));
        if (fallback) targets = [fallback];
      }

      if (targets.length === 0) {
        return { ok: false, reason: 'invalid', warning: max > 1 ? `Please select up to ${max} playing cards from below!` : 'Please select a playing card from below!' };
      }

      const deckRefs = targets.map(tgt => s.deck.find(c => c.uid === tgt.uid) || tgt);
      const applyRes = applyTarotToDeckCards(t, deckRefs);
      if (!applyRes.ok) {
        return { ok: false, reason: 'invalid', warning: applyRes.warning };
      }

      // Sync active.deckCards copies with deck
      targets.forEach((tgt, idx) => {
        const ref = deckRefs[idx];
        tgt.rank = ref.rank;
        tgt.suit = ref.suit;
        tgt.enhancement = ref.enhancement;
      });

      recordTarotAcquired(t.id);
      recordTarotCast(t.id);
      _state.runStats.tarotsUsed++;
      patchState({ lastTarotUsedId: t.id, lastTarotUsedName: t.name });

      modifiedCard = deckRefs[0];
      targetCardsResult = deckRefs;
      resultMessage = applyRes.message;
    }
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
  return { ok: true, picked: opt, targetCard: modifiedCard, targetCards: targetCardsResult, message: resultMessage };
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
  /** Target cards modified by this tarot. */
  targetCards?: Card[];
}

function useConsumable(index: number, targetCardUid?: number | string | (number | string)[]): ConsumableResult {
  const s = getState();
  const c = s.consumables[index];
  if (!c) return { ok: false };

  const inHand = s.inHand && !s.isDealing;
  const isPackDeck = !inHand && !!(s.activePackOpening && s.activePackOpening.deckCards && s.activePackOpening.deckCards.length > 0);
  const isSelfCasting = ['judgement', 'nostradamus'].includes(c.id);

  if (!inHand && !isPackDeck && !isSelfCasting) {
    return { ok: false, warning: 'You can only use this card while a hand is actively in progress!' };
  }

  if (['x_ray', 'loaded_ace', 'double_vision'].includes(c.id) && !inHand) {
    return { ok: false, warning: 'Table Cheats can only be used during an active hand!' };
  }

  let message = '';
  let targetCardsResult: Card[] = [];
  if (c.id === 'x_ray') {
    patchState({ dealerHoleRevealed: true, tempBonusChips: s.tempBonusChips + 75 });
    message = 'X-Ray Specs: Hole card revealed & +75 Chips!';
  } else if (c.id === 'loaded_ace') {
    const ace: Card = { uid: takeNextCardUid(), rank: 'A', suit: '♠', enhancement: 'foil' };
    addCardToDeck({ ...ace });
    addCardToPlayerHand(ace);
    recordEffectEnhanced('foil');
    message = 'Loaded Ace drawn into hand!';
  } else if (c.id === 'double_vision') {
    patchState({ doubledDown: true });
    const hasDoN = s.jokers.some(j => j.id === 'double_or_nothing');
    const hasRainMan = s.jokers.some(j => j.id === 'rain_man') && (s.runningCount || 0) >= 2;
    const dblMult = (hasDoN && hasRainMan) ? 4 : (hasDoN || hasRainMan ? 3 : 2);
    message = `Double Vision: Hand Doubled Down (×${dblMult} Mult)!`;
  } else if (c.id === 'judgement') {
    if (s.jokers.length >= s.maxJokers) {
      return { ok: false, warning: 'No room for another Joker (slots full)!' };
    }
    const ownedIds = s.jokers.map(j => j.id);
    const unowned = JOKER_CATALOG.filter(j => !ownedIds.includes(j.id));
    const chosen = unowned.length > 0 ? shuffle(unowned)[0] : shuffle(JOKER_CATALOG)[0];
    addJoker({ ...chosen, bonusMult: 0, bonusChips: 0 });
    recordJokerAcquired(chosen.id);
    recordTarotAcquired(c.id);
    recordTarotCast(c.id);
    if (inHand) recordTarotCastInHand(c.id);
    _state.runStats.tarotsUsed++;
    patchState({ lastTarotUsedId: c.id, lastTarotUsedName: c.name });
    removeConsumableAt(index);
    return { ok: true, message: `Judgement summoned ${chosen.name}!` };
  } else if (c.id === 'nostradamus') {
    if (!s.lastTarotUsedId || s.lastTarotUsedId === 'nostradamus') {
      return { ok: false, warning: 'Cannot be used: last tarot used was Nostradamus or none!' };
    }
    const prevDef = TAROT_CATALOG.find(x => x.id === s.lastTarotUsedId) || DECK_TAROT_CATALOG.find(x => x.id === s.lastTarotUsedId);
    if (!prevDef) {
      return { ok: false, warning: 'Previous Tarot not found!' };
    }
    removeConsumableAt(index);
    addConsumable({ ...prevDef });
    recordTarotAcquired(prevDef.id);
    recordTarotCast(c.id);
    if (inHand) recordTarotCastInHand(c.id);
    _state.runStats.tarotsUsed++;
    patchState({ lastTarotUsedId: c.id, lastTarotUsedName: c.name });
    return { ok: true, message: `Nostradamus created ${prevDef.name}!` };
  } else {
    // Card-targeted tarots
    const max = getTarotMaxCards(c.id) || 1;
    let uids: number[] = [];
    if (Array.isArray(targetCardUid)) {
      uids = targetCardUid.map(Number);
    } else if (targetCardUid !== undefined && targetCardUid !== null) {
      uids = [Number(targetCardUid)];
    } else if (isPackDeck && s.activePackOpening?.selectedDeckCardUids?.length) {
      uids = [...s.activePackOpening.selectedDeckCardUids];
    } else if (isPackDeck && s.activePackOpening?.selectedDeckCardUid != null) {
      uids = [s.activePackOpening.selectedDeckCardUid];
    }

    if (uids.length > max) {
      return { ok: false, warning: `Too many cards selected! ${c.name} allows up to ${max} cards (currently ${uids.length}).` };
    }

    if (isPackDeck) {
      const packCards = s.activePackOpening!.deckCards || [];
      let targetCards: Card[] = [];
      for (const u of uids) {
        const found = packCards.find(card => card.uid === u) || s.deck.find(card => card.uid === u);
        if (!found) {
          return { ok: false, warning: 'Selected card is not in the pack tray!' };
        }
        targetCards.push(found);
      }
      if (targetCards.length === 0) {
        return { ok: false, warning: max > 1 ? `Please select up to ${max} playing cards from below!` : 'Please select a playing card from below!' };
      }
      for (const tgt of targetCards) {
        if (!isCardEligibleForTarot(c.id, tgt)) {
          return { ok: false, warning: `The selected card ${tgt.rank}${tgt.suit} is not eligible for ${c.name}!` };
        }
      }
      const deckRefs = targetCards.map(tgt => s.deck.find(d => d.uid === tgt.uid) || tgt);
      const applyRes = applyTarotToDeckCards(c, deckRefs);
      if (!applyRes.ok) {
        return { ok: false, warning: applyRes.warning };
      }
      // Sync pack deck cards with deck
      targetCards.forEach((tgt, i) => {
        const ref = deckRefs[i];
        tgt.rank = ref.rank;
        tgt.suit = ref.suit;
        tgt.enhancement = ref.enhancement;
      });
      if (c.id === 'the_guillotine') {
        if (s.activePackOpening && s.activePackOpening.deckCards) {
          s.activePackOpening.deckCards = s.activePackOpening.deckCards.filter(d => !uids.includes(d.uid));
        }
      }
      if (s.activePackOpening) {
        s.activePackOpening.selectedDeckCardUids = [];
        s.activePackOpening.selectedDeckCardUid = null;
      }
      recordTarotCast(c.id);
      _state.runStats.tarotsUsed++;
      patchState({ lastTarotUsedId: c.id, lastTarotUsedName: c.name });
      removeConsumableAt(index);
      targetCardsResult = targetCards;
      return { ok: true, message: applyRes.message, targetCards: targetCardsResult };
    }

    let targetCards: Card[] = [];
    if (uids.length > 0) {
      for (const u of uids) {
        const found = s.playerHand.find(card => card.uid === u);
        if (!found) {
          return { ok: false, warning: 'Selected card is not in your active hand!' };
        }
        targetCards.push(found);
      }
    } else {
      const eligible = s.playerHand.filter(card => isCardEligibleForTarot(c.id, card));
      if (eligible.length === 0) {
        return { ok: false, warning: `No eligible card in hand for ${c.name}!` };
      }
      targetCards = eligible.slice(0, max);
    }

    if (targetCards.length === 0) {
      return { ok: false, warning: 'No eligible card selected!' };
    }

    for (const card of targetCards) {
      if (!isCardEligibleForTarot(c.id, card)) {
        return { ok: false, warning: `Card ${card.rank}${card.suit} is not eligible for ${c.name}!` };
      }
    }

    if (c.id === 'midas_touch') {
      const tc = targetCards[0];
      setCardEnhancement(tc, 'gold');
      recordEffectEnhanced('gold');
      message = `${tc.rank}${tc.suit} turned Gold!`;
    } else if (c.id === 'polychrome_dice') {
      targetCards.forEach(tc => {
        setCardEnhancement(tc, 'poly');
        recordEffectEnhanced('poly');
      });
      const names = targetCards.map(tc => `${tc.rank}${tc.suit}`).join(', ');
      message = `Polychrome Dice enhanced ${names} to Polychrome (×1.5 Mult)!`;
    } else if (c.id === 'wild_suit' || c.id === 'prism_dye') {
      targetCards.forEach(tc => {
        setCardEnhancement(tc, 'foil');
        recordEffectEnhanced('foil');
      });
      const names = targetCards.map(tc => `${tc.rank}${tc.suit}`).join(', ');
      message = `Prism Dye enhanced ${names} to Foil (+30 Chips)!`;
    } else if (c.id === 'lucky_charm') {
      targetCards.forEach(tc => {
        setCardEnhancement(tc, 'holo');
        recordEffectEnhanced('holo');
      });
      const names = targetCards.map(tc => `${tc.rank}${tc.suit}`).join(', ');
      message = `Lucky Charm enhanced ${names} to Holo (+4 Mult)!`;
    } else if (c.id === 'the_lovers') {
      const tc = targetCards[0];
      setCardSuit(tc, '★');
      message = `${tc.rank}★ turned Wild!`;
    } else if (c.id === 'the_sun') {
      targetCards.forEach(tc => setCardSuit(tc, '♥'));
      message = `The Sun converted ${targetCards.length} card(s) to Hearts!`;
    } else if (c.id === 'the_star') {
      targetCards.forEach(tc => setCardSuit(tc, '♦'));
      message = `The Star converted ${targetCards.length} card(s) to Diamonds!`;
    } else if (c.id === 'the_moon') {
      targetCards.forEach(tc => setCardSuit(tc, '♣'));
      message = `The Moon converted ${targetCards.length} card(s) to Clubs!`;
    } else if (c.id === 'the_world') {
      targetCards.forEach(tc => setCardSuit(tc, '♠'));
      message = `The World converted ${targetCards.length} card(s) to Spades!`;
    } else if (c.id === 'the_guillotine') {
      const names = targetCards.map(tc => `${tc.rank}${tc.suit}`).join(', ');
      targetCards.forEach(tc => removeCardFromGame(tc.uid));
      message = `The Guillotine permanently destroyed ${names}!`;
    } else if (c.id === 'card_forge') {
      const rankOrder: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const upgraded: string[] = [];
      for (const tc of targetCards) {
        if (tc.rank === 'A') continue;
        const curIdx = rankOrder.indexOf(tc.rank);
        if (curIdx < rankOrder.length - 1) {
          setCardRank(tc, rankOrder[curIdx + 1]);
          upgraded.push(`${tc.rank}${tc.suit}`);
        }
      }
      message = `Card Forge upgraded ${upgraded.join(', ')}!`;
    } else if (c.id === 'card_shave') {
      const rankOrder: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const shaved: string[] = [];
      for (const tc of targetCards) {
        if (tc.rank === '2') continue;
        const curIdx = rankOrder.indexOf(tc.rank);
        if (curIdx > 0) {
          setCardRank(tc, rankOrder[curIdx - 1]);
          shaved.push(`${tc.rank}${tc.suit}`);
        }
      }
      message = `Card Shave reduced ${shaved.join(', ')}!`;
    }

    // Sync modified card properties to the persistent deck
    targetCards.forEach(tc => {
      const deckRef = s.deck.find(d => d.uid === tc.uid);
      if (deckRef) {
        deckRef.rank = tc.rank;
        deckRef.suit = tc.suit;
        deckRef.enhancement = tc.enhancement;
      }
    });
    targetCardsResult = targetCards;
  }

  recordTarotCastInHand(c.id);
  _state.runStats.tarotsUsed++;
  patchState({ lastTarotUsedId: c.id, lastTarotUsedName: c.name });
  removeConsumableAt(index);
  return { ok: true, message, targetCards: targetCardsResult.length > 0 ? targetCardsResult : undefined };
}

if (typeof window !== 'undefined') {
  (window as any).useConsumable = useConsumable;
  (window as any).selectPackDeckCard = selectPackDeckCard;
  (window as any).applyTarotToDeckCards = applyTarotToDeckCards;
  (window as any).applyTarotToDeckCard = applyTarotToDeckCard;
  (window as any).generateShopSingleCards = generateShopSingleCards;
  (window as any).generateShopPacks = generateShopPacks;
  (window as any).generatePackOptions = generatePackOptions;
  (window as any).PACK_CATALOG = PACK_CATALOG;
  (window as any).beginBlindState = beginBlindState;
  (window as any).startNewRunState = startNewRunState;
  (window as any).cashOutAndEnterShop = cashOutAndEnterShop;
  (window as any).calcBlindPayout = calcBlindPayout;
  (window as any).computeBlindPayout = computeBlindPayout;
  (window as any).isVoucherAvailable = isVoucherAvailable;
  (window as any).ANTE_TARGETS = ANTE_TARGETS;
  (window as any).BLIND_TARGET_MULTS = BLIND_TARGET_MULTS;
  (window as any).SHOP_BASE_REROLL = SHOP_BASE_REROLL;
}
