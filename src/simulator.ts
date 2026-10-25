/* ==========================================================
   simulator.ts - MONTE CARLO TELEMETRY & STRATEGY SIMULATION
   Data + report text only (no DOM). Runs on isolated throwaway
   SimRun objects without touching or corrupting the live gameState.
   Scoring, economy, catalogs, packs and vouchers all draw directly
   from the shared game engines (gameState, deckEngine, modifierEngine, shopEngine).
   No DOM: input reading, buttons, modal and downloads live in main.ts.
   Depends on (global): gameState.ts, deckEngine.ts, modifierEngine.ts, shopEngine.ts
========================================================== */

type BotType = 'expert' | 'synergy' | 'highroller' | 'charlie' | 'basic' | 'vanilla';
type BotAction = 'HIT' | 'STAND' | 'DOUBLE';
interface SimConfig extends BalanceConfig {
  maxEndlessAnte?: number;
  startingMoney?: number;
  maxJokers?: number;
}

const BOT_ORDER: ReadonlyArray<BotType> = ['expert', 'synergy', 'highroller', 'charlie', 'basic', 'vanilla'];

interface SimRun {
  ante: number;
  blindIndex: number;
  money: number;
  maxHands: number;
  maxJokers: number;
  maxConsumables: number;
  baseWinChipBonus: number;
  baseWinMultBonus: number;
  deck: Card[];
  jokers: JokerInstance[];
  vouchers: string[];
  consumables: TarotDef[];
  voucherAnte?: number;
  anteVoucher?: VoucherDef | null;
  anteVoucherBought?: boolean;
  handsWonInBlind?: number;
  previousHandTotal?: number | null;
  lastTarotUsedId?: string | null;
  usedTarots: Set<string>;
  usedCheats: Set<string>;
  voucherAnteBought: Record<string, number>;
}

interface BlindStat {
  ante: number;
  blindIdx: number;
  label: string;
  target: number;
  entered: number;
  cleared: number;
  scoreSum: number;
  dealsUsedSum: number;
  cashAfterSum: number;
  scalingDeaths: number;
  coldShoeDeaths: number;
}

interface OutcomeCounters {
  CHARLIE: number;
  NATURAL: number;
  EXACT21: number;
  WIN: number;
  PUSH: number;
  LOSS: number;
  BUST: number;
  cushioned22Saves: number;
  safetyNetSaves: number;
  doubleAttempts: number;
  doubleWins: number;
}

interface JokerStat {
  id: string;
  name: string;
  cost: number;
  rarity: JokerRarity;
  offered: number;
  bought: number;
  picks: number;
  wins: number;
  anteSum: number;
  scalingSum: number;
}

interface VoucherStat {
  id: string;
  name: string;
  offered: number;
  bought: number;
  wins: number;
  anteSum: number;
  runsWithVoucher: number;
}

interface ConsumableStat {
  id: string;
  name: string;
  category: 'tarot' | 'cheat';
  offered: number;
  bought: number;
  timesUsed: number;
  runsWithItem: number;
  runsWonWithItem: number;
  anteSum: number;
  specialImpactSum: number;
}

interface PackStat {
  id: string;
  name: string;
  offered: number;
  bought: number;
}

interface EndlessStat {
  ante: number;
  entered: number;
  cleared: number;
  clearRatePct: number;
  scalingDeaths: number;
  coldShoeDeaths: number;
}

interface SimData {
  numRuns: number;
  botType: BotType;
  cfg: SimConfig;
  elapsedMs: number;
  wins: number;
  totalFinalAnte: number;
  highestAnteReached: number;
  scalingDeaths: number;
  coldShoeDeaths: number;
  totalHandsWon: number;
  totalHandsPlayed: number;
  totalRerolls: number;
  anteClearedCounts: number[];
  blindStats: BlindStat[];
  outcomeCounters: OutcomeCounters;
  jokerStats: Record<string, JokerStat>;
  voucherStats: Record<string, VoucherStat>;
  consumableStats: Record<string, ConsumableStat>;
  packStats: Record<string, PackStat>;
  endlessStats: EndlessStat[];
  maxEndlessAnte: number;
}

/* ---------- Tarot Card Application Helper (Shared by Packs and Shop) ---------- */
function applySimTarotEffect(
  tarot: TarotDef,
  simRun: SimRun,
  botType: BotType,
  consumableStats?: Record<string, ConsumableStat>
): void {
  simRun.lastTarotUsedId = tarot.id;
  simRun.usedTarots.add(tarot.id);
  if (consumableStats && consumableStats[tarot.id]) {
    consumableStats[tarot.id].timesUsed++;
  }
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  if (tarot.id === 'the_guillotine') {
    // Destroy up to 2 low cards (2, 3, 4, 5)
    let destroyed = 0;
    for (let i = 0; i < 2; i++) {
      const idx = simRun.deck.findIndex(c => ['2', '3', '4', '5'].includes(c.rank));
      if (idx >= 0) {
        simRun.deck.splice(idx, 1);
        destroyed++;
      }
    }
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += destroyed;
    }
  } else if (tarot.id === 'card_forge') {
    // Increase rank of up to 2 cards by 1 (prefer upgrading high cards towards Ace)
    let count = 0;
    const preferredOrder: Rank[] = ['Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    for (const r of preferredOrder) {
      if (count >= 2) break;
      for (const card of simRun.deck) {
        if (count >= 2) break;
        if (card.rank === r) {
          const idx = ranks.indexOf(card.rank);
          if (idx >= 0 && idx < ranks.length - 1) {
            card.rank = ranks[idx + 1];
            count++;
          }
        }
      }
    }
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += count;
    }
  } else if (tarot.id === 'card_shave') {
    // Reduce rank of up to 2 cards by 1 (ideal for Charlie bot)
    let count = 0;
    const preferredOrder: Rank[] = ['7', '6', '5', '4', '3'];
    for (const r of preferredOrder) {
      if (count >= 2) break;
      for (const card of simRun.deck) {
        if (count >= 2) break;
        if (card.rank === r) {
          const idx = ranks.indexOf(card.rank);
          if (idx > 0) {
            card.rank = ranks[idx - 1];
            count++;
          }
        }
      }
    }
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += count;
    }
  } else if (tarot.id === 'polychrome_dice') {
    // Enhance up to 2 cards to Polychrome (x1.5 Mult)
    const targets = simRun.deck.filter(c => !c.enhancement && ['A', 'K', 'Q', 'J', '10'].includes(c.rank)).slice(0, 2);
    if (targets.length < 2) {
      const more = simRun.deck.filter(c => !c.enhancement && !targets.includes(c)).slice(0, 2 - targets.length);
      targets.push(...more);
    }
    targets.forEach(c => { c.enhancement = 'poly'; });
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += targets.length;
    }
  } else if (tarot.id === 'lucky_charm') {
    // Enhance up to 2 cards to Holo (+4 Mult)
    const targets = simRun.deck.filter(c => !c.enhancement && ['A', 'K', 'Q', 'J', '10'].includes(c.rank)).slice(0, 2);
    if (targets.length < 2) {
      const more = simRun.deck.filter(c => !c.enhancement && !targets.includes(c)).slice(0, 2 - targets.length);
      targets.push(...more);
    }
    targets.forEach(c => { c.enhancement = 'holo'; });
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += targets.length;
    }
  } else if (tarot.id === 'wild_suit' || tarot.id === 'prism_dye') {
    // Enhance up to 2 cards to Foil (+30 Chips)
    const targets = simRun.deck.filter(c => !c.enhancement).slice(0, 2);
    targets.forEach(c => { c.enhancement = 'foil'; });
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += targets.length;
    }
  } else if (tarot.id === 'midas_touch') {
    // Enhance 1 card to Gold (+$3)
    const target = simRun.deck.find(c => !c.enhancement && ['A', 'K', 'Q', '10'].includes(c.rank)) || simRun.deck.find(c => !c.enhancement);
    if (target) {
      target.enhancement = 'gold';
      if (consumableStats && consumableStats[tarot.id]) {
        consumableStats[tarot.id].specialImpactSum += 1;
      }
    }
  } else if (tarot.id === 'the_lovers') {
    // Turn 1 card Wild (★)
    const target = simRun.deck.find(c => c.suit !== '★');
    if (target) {
      target.suit = '★';
      if (consumableStats && consumableStats[tarot.id]) {
        consumableStats[tarot.id].specialImpactSum += 1;
      }
    }
  } else if (tarot.id === 'the_sun') {
    // Convert up to 3 cards to Hearts
    const converted = simRun.deck.filter(c => c.suit !== '♥').slice(0, 3);
    converted.forEach(c => { c.suit = '♥'; });
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += converted.length;
    }
  } else if (tarot.id === 'the_star') {
    // Convert up to 3 cards to Diamonds
    const converted = simRun.deck.filter(c => c.suit !== '♦').slice(0, 3);
    converted.forEach(c => { c.suit = '♦'; });
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += converted.length;
    }
  } else if (tarot.id === 'the_moon') {
    // Convert up to 3 cards to Clubs
    const converted = simRun.deck.filter(c => c.suit !== '♣').slice(0, 3);
    converted.forEach(c => { c.suit = '♣'; });
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += converted.length;
    }
  } else if (tarot.id === 'the_world') {
    // Convert up to 3 cards to Spades
    const converted = simRun.deck.filter(c => c.suit !== '♠').slice(0, 3);
    converted.forEach(c => { c.suit = '♠'; });
    if (consumableStats && consumableStats[tarot.id]) {
      consumableStats[tarot.id].specialImpactSum += converted.length;
    }
  } else if (tarot.id === 'judgement') {
    // Create random unowned Joker if room
    if (simRun.jokers.length < simRun.maxJokers) {
      const owned = simRun.jokers.map(j => j.id);
      const pool = JOKER_CATALOG.filter(j => !owned.includes(j.id));
      const rolled = pool.length > 0 ? shuffle(pool)[0] : shuffle(JOKER_CATALOG)[0];
      simRun.jokers.push({ ...rolled, bonusMult: 0, bonusChips: 0 });
      simRun.jokers.sort((a, b) => (a.isXMult ? 1 : 0) - (b.isXMult ? 1 : 0));
      if (consumableStats && consumableStats[tarot.id]) {
        consumableStats[tarot.id].specialImpactSum += 1;
      }
    }
  } else if (tarot.id === 'nostradamus') {
    // Copy last used tarot
    if (simRun.lastTarotUsedId && simRun.lastTarotUsedId !== 'nostradamus') {
      const prevDef = TAROT_CATALOG.find(x => x.id === simRun.lastTarotUsedId);
      if (prevDef) applySimTarotEffect(prevDef, simRun, botType, consumableStats);
    }
  }
}

/* ---------- Bot Blackjack Decision-Making ---------- */
function decideBotAction(
  pHand: ReadonlyArray<Card>,
  dUpCard: Card,
  simRun: SimRun,
  botType: BotType,
  bossBlind: BossBlindDef | null,
  roundScore: number = 0,
  targetScore: number = 0,
  dealsLeft: number = 7
): BotAction {
  const ownsJoker = (id: string): boolean => simRun.jokers.some(j => j.id === id);
  const hasCushion = ownsJoker('bust_cushion');
  const pEval = evaluateBlackjackTotal(pHand, hasCushion);
  const pTotal = pEval.total;
  const isSoft = pEval.isSoft;
  const dUp = evaluateBlackjackTotal([dUpCard], false).total;
  const canDouble = pHand.length === 2 && (!bossBlind || bossBlind.id !== 'the_anchor');

  // 1. Charlie Bot Archetype: Low card drawing / 5-card Charlie specialist
  if (botType === 'charlie') {
    if (pHand.length >= 2 && pHand.length < 5 && pTotal <= (hasCushion ? 16 : 15)) {
      return 'HIT';
    }
    if (isSoft && pTotal <= 17) return 'HIT';
    if (pTotal <= 11) return 'HIT';
    if (pTotal >= 17) return 'STAND';
    return (dUp >= 7) ? 'HIT' : 'STAND';
  }

  // 2. High-Roller Bot Archetype: Doubling Down & High Face/Ace totals
  if (botType === 'highroller') {
    if (canDouble && !ownsJoker('minimalist')) {
      if (pTotal === 10 || pTotal === 11) return 'DOUBLE';
      if (pTotal === 9 && dUp >= 3 && dUp <= 6) return 'DOUBLE';
      if (isSoft && pTotal >= 16 && pTotal <= 19 && dUp >= 4 && dUp <= 6) return 'DOUBLE';
    }
    if (ownsJoker('minimalist') && pHand.length === 2 && pTotal >= 17) return 'STAND';
    if (pTotal >= 17) return 'STAND';
    if (isSoft) {
      if (pTotal >= 19) return 'STAND';
      if (pTotal === 18) return (dUp >= 9) ? 'HIT' : 'STAND';
      return 'HIT';
    }
    if (pTotal >= 13 && pTotal <= 16) return (dUp >= 2 && dUp <= 6) ? 'STAND' : 'HIT';
    if (pTotal === 12) return (dUp >= 4 && dUp <= 6) ? 'STAND' : 'HIT';
    return 'HIT';
  }

  // 3. Synergy & Expert Joker Synergies
  if (botType === 'synergy' || botType === 'expert') {
    // Sweet 16: standing on 16 or less grants +50c & +15m on win/push
    if (ownsJoker('sweet_16') && pTotal >= 13 && pTotal <= 16 && dUp <= 6) {
      return 'STAND';
    }
    // Snake Eyes: x2.2 Mult standing on 11-13
    if (ownsJoker('snake_eyes') && pTotal >= 11 && pTotal <= 13 && dUp <= 6) {
      return 'STAND';
    }
    // Deja Vu: x1.5 Mult if matching previous winning total
    if (ownsJoker('deja_vu') && simRun.previousHandTotal && pTotal === simRun.previousHandTotal && pTotal >= 16) {
      return 'STAND';
    }
    // Daredevil: safe hits on 15+ permanently gain +1 Mult
    if (ownsJoker('daredevil') && isSoft && pTotal >= 15 && pTotal <= 18) {
      return 'HIT';
    }
    // Bust Cushion: 22 converted to 21, so 12 is 100% safe to hit
    if (hasCushion && !isSoft && pTotal === 12) {
      return 'HIT';
    }
    // Double Down synergizers
    if (canDouble && !ownsJoker('minimalist')) {
      if (ownsJoker('double_or_nothing') && (pTotal === 10 || pTotal === 11 || (pTotal === 9 && dUp <= 7))) {
        return 'DOUBLE';
      }
      if (ownsJoker('chip_stacker') && (pTotal === 10 || pTotal === 11 || (pTotal === 9 && dUp <= 6))) {
        return 'DOUBLE';
      }
    }
  }

  // 4. Standard High-EV Doubling Down
  if (canDouble && !ownsJoker('minimalist')) {
    if (pTotal === 11) return 'DOUBLE';
    if (pTotal === 10 && dUp <= 9) return 'DOUBLE';
    if (pTotal === 9 && dUp >= 3 && dUp <= 6) return 'DOUBLE';
    if (isSoft && (pTotal === 17 || pTotal === 18) && dUp >= 4 && dUp <= 6) return 'DOUBLE';
  }

  // 5. Standard Basic Strategy (EV optimal)
  if (isSoft) {
    if (pTotal >= 19) return 'STAND';
    if (pTotal === 18) return (dUp >= 9) ? 'HIT' : 'STAND';
    return 'HIT';
  } else {
    if (pTotal >= 17) return 'STAND';
    if (hasCushion && pTotal === 12) return 'HIT';
    if (pTotal >= 13 && pTotal <= 16) {
      return (dUp >= 2 && dUp <= 6) ? 'STAND' : 'HIT';
    }
    if (pTotal === 12) {
      return (dUp >= 4 && dUp <= 6) ? 'STAND' : 'HIT';
    }
    return 'HIT';
  }
}

/* ---------- Joker Valuation Scoring ---------- */
function scoreJokerPriorityForBot(joker: JokerInstance, botType: BotType): number {
  let score = 10; // Baseline positive: any joker is better than an empty slot
  if (joker.isXMult) score += 8;
  if (joker.rarity === 'rare') score += 6;
  if (joker.rarity === 'uncommon') score += 3;

  // Scaling progress bonus
  if (joker.id === 'daredevil') score += 6 + (joker.bonusMult || 0) * 1.0;
  if (joker.id === 'chip_stacker') score += 5 + (joker.bonusChips || 0) * 0.2;
  if (joker.id === 'hot_hand') score += 6 + (joker.bonusMult || 0) * 0.5;
  if (joker.id === 'the_bullseye') score += 6 + (joker.bonusMult || 0) * 1.0;
  if (joker.id === 'bad_beat_jackpot') score += 5 + (joker.bonusMult || 0) * 0.8;
  if (joker.id === 'fortune_teller') score += 5;

  if (botType === 'expert') {
    if (['bust_cushion', 'the_shark', 'blackjack_tycoon', 'card_sharp_joker', 'double_or_nothing', 'deja_vu', 'monochrome', 'rain_man', 'the_spotter', 'crown_jewel', 'the_banker', 'the_bullseye', 'marked_deck', 'street_magician', 'tightrope_walker', 'pocket_rockets'].includes(joker.id)) score += 6;
    if (['golden_parachute', 'diamond_cutter', 'the_grinder', 'compound_edge', 'side_bet', 'bounty_hunter'].includes(joker.id)) score += 4;
    if (['vip_high_roller', 'ace_up_sleeve', 'push_it_good', 'trips_ahoy', 'spade_slicer', 'crimson_heart', 'club_sandwich', 'slow_and_steady', 'sweet_16', 'card_counter', 'even_steven', 'odd_ball', 'red_velvet', 'dark_knight', 'kaleidoscope', 'momentum', 'blowout'].includes(joker.id)) score += 4;
    return score;
  }

  if (botType === 'charlie') {
    if (['bust_cushion', 'safety_net', 'hit_me_baby', 'card_counter', 'even_steven', 'odd_ball', 'the_grinder', 'trips_ahoy', 'small_fry', 'street_magician', 'kaleidoscope', 'momentum'].includes(joker.id)) score += 8;
  } else if (botType === 'highroller') {
    if (['vip_high_roller', 'ace_up_sleeve', 'blackjack_tycoon', 'minimalist', 'double_or_nothing', 'the_shark', 'pocket_rockets', 'trips_ahoy', 'rain_man', 'crown_jewel', 'the_bullseye', 'tightrope_walker', 'side_bet', 'blowout'].includes(joker.id)) score += 8;
  } else if (botType === 'synergy') {
    if (['bust_cushion', 'daredevil', 'chip_stacker', 'the_shark', 'blackjack_tycoon', 'ace_up_sleeve', 'push_it_good', 'compound_edge', 'hot_hand', 'spade_slicer', 'crimson_heart', 'diamond_cutter', 'club_sandwich', 'monochrome', 'card_sharp_joker', 'slow_and_steady', 'the_spotter', 'rain_man', 'kaleidoscope', 'momentum', 'pocket_rockets', 'trips_ahoy', 'even_steven', 'odd_ball', 'card_counter', 'dark_knight', 'red_velvet', 'tightrope_walker', 'safety_net'].includes(joker.id)) score += 6;
  }
  return score;
}

/* ---------- Tarot & Consumable Valuation Scoring ---------- */
function scoreTarotPriorityForBot(tarot: TarotDef, botType: BotType, simRun: SimRun): number {
  if (tarot.id === 'the_guillotine') {
    const hasLow = simRun.deck.some(c => ['2', '3', '4', '5'].includes(c.rank));
    return (botType === 'charlie') ? 2 : (hasLow ? 12 : 2);
  }
  if (tarot.id === 'card_forge') {
    const hasNonAce = simRun.deck.some(c => c.rank !== 'A');
    return (botType === 'charlie') ? 3 : (hasNonAce ? 11 : 2);
  }
  if (tarot.id === 'card_shave') {
    return (botType === 'charlie') ? 12 : 5;
  }
  if (tarot.id === 'polychrome_dice') return 13;
  if (tarot.id === 'lucky_charm') return 10;
  if (tarot.id === 'wild_suit' || tarot.id === 'prism_dye') return 9;
  if (tarot.id === 'midas_touch') return 8;
  if (tarot.id === 'the_lovers') return 10;
  if (['the_sun', 'the_star', 'the_moon', 'the_world'].includes(tarot.id)) return 8;
  if (tarot.id === 'judgement') return simRun.jokers.length < simRun.maxJokers ? 12 : 3;
  if (tarot.id === 'nostradamus') return 8;

  // Battle Cheats
  if (['double_vision', 'loaded_ace', 'x_ray'].includes(tarot.id)) {
    return (simRun.consumables.length < simRun.maxConsumables) ? 9 : 0;
  }
  return 6;
}

/* ---------- Booster Pack Valuation Scoring ---------- */
function scorePackPriority(pack: PackDef, simRun: SimRun, botType: BotType): number {
  const jokersNeeded = simRun.maxJokers - simRun.jokers.length;

  if (pack.packType === 'joker') {
    if (jokersNeeded >= 3) return 100;
    if (jokersNeeded >= 1) return 85;
    return 60;
  }
  if (pack.packType === 'variety') {
    if (jokersNeeded >= 2) return 80;
    return 65;
  }
  if (pack.packType === 'tarot') {
    return 70;
  }
  if (pack.packType === 'cheat') {
    return simRun.consumables.length < simRun.maxConsumables ? 65 : 10;
  }
  if (pack.packType === 'card') {
    return 55;
  }
  return 40;
}

/* ---------- Pack Option Evaluation & Selection ---------- */
function evaluateAndPickPackOption(
  options: PackCardOption[],
  simRun: SimRun,
  botType: BotType,
  jokerStats: Record<string, JokerStat>,
  consumableStats: Record<string, ConsumableStat>
): boolean {
  let bestIdx = -1;
  let bestScore = -1;
  let bestSellJokerIdx: number | null = null;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    let score = -1;
    let sellJokerIdx: number | null = null;

    if (opt.kind === 'joker') {
      const jDef = opt.data;
      const baseScore = scoreJokerPriorityForBot(jDef, botType);
      if (simRun.jokers.length < simRun.maxJokers) {
        score = baseScore;
      } else {
        let weakestIdx = 0;
        let weakestVal = 999;
        simRun.jokers.forEach((owned, idx) => {
          const val = scoreJokerPriorityForBot(owned, botType);
          if (val < weakestVal) { weakestVal = val; weakestIdx = idx; }
        });
        if (baseScore > weakestVal + 2) {
          score = baseScore - weakestVal + 5;
          sellJokerIdx = weakestIdx;
        }
      }
    } else if (opt.kind === 'tarot') {
      score = scoreTarotPriorityForBot(opt.data, botType, simRun);
    } else if (opt.kind === 'cheat') {
      score = (simRun.consumables.length < simRun.maxConsumables) ? 8 : 0;
    } else if (opt.kind === 'card') {
      score = opt.data.enhancement ? 8 : 4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestSellJokerIdx = sellJokerIdx;
    }
  }

  if (bestIdx < 0 || bestScore <= 0) return false;

  const chosen = options[bestIdx];
  if (chosen.kind === 'joker') {
    const j = chosen.data;
    if (bestSellJokerIdx !== null) {
      const sellPrice = getJokerSellValue(simRun.jokers[bestSellJokerIdx]);
      simRun.money += sellPrice;
      simRun.jokers[bestSellJokerIdx] = { ...j, bonusMult: 0, bonusChips: 0 };
    } else {
      simRun.jokers.push({ ...j, bonusMult: 0, bonusChips: 0 });
    }
    if (jokerStats[j.id]) jokerStats[j.id].bought++;
    // Keep XMult at the end so it multiplies after additive bonuses
    simRun.jokers.sort((a, b) => (a.isXMult ? 1 : 0) - (b.isXMult ? 1 : 0));
  } else if (chosen.kind === 'tarot') {
    if (consumableStats[chosen.data.id]) consumableStats[chosen.data.id].bought++;
    simRun.usedTarots.add(chosen.data.id);
    applySimTarotEffect(chosen.data, simRun, botType, consumableStats);
  } else if (chosen.kind === 'cheat') {
    if (consumableStats[chosen.data.id]) consumableStats[chosen.data.id].bought++;
    if (simRun.consumables.length < simRun.maxConsumables) {
      simRun.consumables.push(chosen.data);
    }
  } else if (chosen.kind === 'card') {
    simRun.deck.push({
      uid: 9999,
      rank: chosen.data.rank,
      suit: chosen.data.suit,
      enhancement: chosen.data.enhancement
    });
  }

  return true;
}

/* ---------- Shop Simulation (Balatro-style Shelf, Packs & Vouchers) ---------- */
function simulateShopVisit(
  simRun: SimRun,
  botType: BotType,
  jokerStats: Record<string, JokerStat>,
  voucherStats: Record<string, VoucherStat>,
  consumableStats: Record<string, ConsumableStat>,
  packStats: Record<string, PackStat>,
  trackReroll: () => void
): void {
  if (botType === 'vanilla') return;

  const maxInterest = simRun.vouchers.includes('deep_pockets') ? 8 : 5;
  const interestPer = simRun.vouchers.includes('liquidity_pass') ? 4 : 5;
  const capCash = maxInterest * interestPer;

  // Staged bankroll targets: prioritize filling joker slots before hoarding interest
  const interestReserve = (simRun.jokers.length < simRun.maxJokers) ? 0 : (botType === 'expert' ? 15 : 5);

  // 1. Vouchers (1 per Ante)
  if (simRun.voucherAnte !== simRun.ante) {
    simRun.voucherAnte = simRun.ante;
    simRun.anteVoucherBought = false;
    const avail = VOUCHER_CATALOG.filter(v => !simRun.vouchers.includes(v.id));
    simRun.anteVoucher = avail.length > 0 ? shuffle(avail)[0] : null;
    if (simRun.anteVoucher && voucherStats[simRun.anteVoucher.id]) {
      voucherStats[simRun.anteVoucher.id].offered++;
    }
  }

  if (simRun.anteVoucher && !simRun.anteVoucherBought) {
    const v = simRun.anteVoucher;
    const reserve = (simRun.jokers.length < 3) ? 0 : Math.floor(interestReserve * 0.5);
    if (simRun.money >= v.cost + reserve) {
      simRun.money -= v.cost;
      simRun.vouchers.push(v.id);
      simRun.anteVoucherBought = true;
      simRun.voucherAnteBought[v.id] = simRun.ante;
      if (voucherStats[v.id]) voucherStats[v.id].bought++;
      const d = getVoucherDeltas(v.id);
      simRun.maxHands += d.maxHands || 0;
      simRun.baseWinMultBonus += d.baseWinMultBonus || 0;
      simRun.maxJokers += d.maxJokers || 0;
      simRun.baseWinChipBonus += d.baseWinChipBonus || 0;
    }
  }

  // 2. Buy from Single Cards Shelf (Jokers AND Tarots!)
  const processSingleCards = (cards: ShopJokerSlot[]): void => {
    for (const card of cards) {
      if (card.bought) continue;
      if (card.shopType === 'joker') {
        if (jokerStats[card.id]) jokerStats[card.id].offered++;
        const jScore = scoreJokerPriorityForBot(card, botType);
        const minReserve = (simRun.jokers.length < 2) ? 0 : 2;

        if (simRun.jokers.length < simRun.maxJokers) {
          if (simRun.money >= card.cost + minReserve) {
            simRun.money -= card.cost;
            card.bought = true;
            simRun.jokers.push({ ...card, bonusMult: 0, bonusChips: 0 });
            if (jokerStats[card.id]) jokerStats[card.id].bought++;
            simRun.jokers.sort((a, b) => (a.isXMult ? 1 : 0) - (b.isXMult ? 1 : 0));
          }
        } else if (botType === 'expert' || botType === 'synergy') {
          // Check if worth replacing weakest owned joker
          let weakestIdx = 0;
          let weakestScore = 999;
          simRun.jokers.forEach((owned, idx) => {
            const sc = scoreJokerPriorityForBot(owned, botType);
            if (sc < weakestScore) { weakestScore = sc; weakestIdx = idx; }
          });
          if (jScore > weakestScore + 4 && simRun.money >= card.cost) {
            const sellVal = getJokerSellValue(simRun.jokers[weakestIdx]);
            simRun.money += sellVal - card.cost;
            simRun.jokers[weakestIdx] = { ...card, bonusMult: 0, bonusChips: 0 };
            card.bought = true;
            if (jokerStats[card.id]) jokerStats[card.id].bought++;
            simRun.jokers.sort((a, b) => (a.isXMult ? 1 : 0) - (b.isXMult ? 1 : 0));
          }
        }
      } else if (card.shopType === 'tarot') {
        if (consumableStats[card.id]) consumableStats[card.id].offered++;
        const tScore = scoreTarotPriorityForBot(card, botType, simRun);
        const minReserve = (simRun.jokers.length < 2) ? 0 : 2;
        if (simRun.money >= card.cost + minReserve && tScore >= 6) {
          if (['x_ray', 'loaded_ace', 'double_vision'].includes(card.id)) {
            if (simRun.consumables.length < simRun.maxConsumables) {
              simRun.money -= card.cost;
              card.bought = true;
              if (consumableStats[card.id]) consumableStats[card.id].bought++;
              simRun.consumables.push(card);
            }
          } else {
            simRun.money -= card.cost;
            card.bought = true;
            if (consumableStats[card.id]) consumableStats[card.id].bought++;
            simRun.usedTarots.add(card.id);
            applySimTarotEffect(card, simRun, botType, consumableStats);
          }
        }
      }
    }
  };

  // 3. Buy Booster Packs
  const processPacks = (packs: PackDef[]): void => {
    const sortedPacks = packs.slice().sort((a, b) =>
      scorePackPriority(b, simRun, botType) - scorePackPriority(a, simRun, botType)
    );

    for (const pack of sortedPacks) {
      if (packStats[pack.id]) packStats[pack.id].offered++;
      const minReserve = (simRun.jokers.length < 2) ? 0 : 2;

      if (simRun.money >= pack.cost + minReserve) {
        simRun.money -= pack.cost;
        if (packStats[pack.id]) packStats[pack.id].bought++;

        const options = generatePackOptions(pack, simRun.jokers.map(j => j.id), simRun.consumables.map(c => c.id));
        options.forEach(opt => {
          if (opt.kind === 'joker' && jokerStats[opt.data.id]) {
            jokerStats[opt.data.id].offered++;
          } else if ((opt.kind === 'tarot' || opt.kind === 'cheat') && consumableStats[opt.data.id]) {
            consumableStats[opt.data.id].offered++;
          }
        });

        evaluateAndPickPackOption(options, simRun, botType, jokerStats, consumableStats);
      }
    }
  };

  // Initial shelf items & packs
  let currentSingleCards = generateShopSingleCards(simRun.ante, simRun.jokers.length, simRun.jokers.map(j => j.id), simRun.consumables.map(c => c.id));
  processSingleCards(currentSingleCards);

  const hasOverstock = simRun.vouchers.includes('overstock');
  const packs = generateShopPacks(simRun.ante, simRun.jokers.length, hasOverstock);
  processPacks(packs);

  // 4. Shop Rerolls (Clearance Rack aware)
  const rerollCost = simRun.vouchers.includes('clearance_sale') ? 1 : 2;
  const maxRerolls = (botType === 'expert') ? 2 : 1;
  let rerollsDone = 0;

  while (rerollsDone < maxRerolls) {
    const jokersNeeded = simRun.maxJokers - simRun.jokers.length;
    const canAfford = simRun.money >= interestReserve + rerollCost + 3;
    const wantsReroll = jokersNeeded > 0 || (botType === 'expert' && simRun.ante >= 3 && simRun.money >= interestReserve + 6);
    if (!canAfford || !wantsReroll) break;

    simRun.money -= rerollCost;
    trackReroll();
    rerollsDone++;

    currentSingleCards = generateShopSingleCards(simRun.ante, simRun.jokers.length, simRun.jokers.map(j => j.id), simRun.consumables.map(c => c.id));
    processSingleCards(currentSingleCards);
  }
}

/* ---------- Batch Simulation Runner ---------- */
function runBatchSimulationForBot(numRuns: number, botType: BotType, cfg: SimConfig): SimData {
  const baseDeckTemplate = createStandardDeck();
  const t0 = performance.now();

  const maxEndlessAnte = Math.min(cfg.maxEndlessAnte && cfg.maxEndlessAnte >= 8 ? cfg.maxEndlessAnte : 16, 30);
  const startMoney = cfg.startingMoney ?? STARTING_MONEY;
  const startMaxJokers = cfg.maxJokers ?? STARTING_MAX_JOKERS;

  let wins = 0;
  let totalFinalAnte = 0;
  let highestAnteReached = 1;
  let scalingDeaths = 0;
  let coldShoeDeaths = 0;
  let totalHandsWon = 0;
  let totalHandsPlayed = 0;
  let totalRerolls = 0;

  const anteClearedCounts: number[] = new Array(maxEndlessAnte + 1).fill(0);

  // Dynamic Blinds telemetry (Ante 1..maxEndlessAnte x Blind 0..2)
  const blindStats: BlindStat[] = [];
  for (let a = 1; a <= maxEndlessAnte; a++) {
    for (let b = 0; b < 3; b++) {
      blindStats.push({
        ante: a,
        blindIdx: b,
        label: `A${a}-${b === 0 ? 'Small' : b === 1 ? 'Big' : 'Boss'}`,
        target: computeBlindTarget(a, b, cfg.targetScalePct),
        entered: 0,
        cleared: 0,
        scoreSum: 0,
        dealsUsedSum: 0,
        cashAfterSum: 0,
        scalingDeaths: 0,
        coldShoeDeaths: 0
      });
    }
  }

  const outcomeCounters: OutcomeCounters = {
    CHARLIE: 0, NATURAL: 0, EXACT21: 0, WIN: 0, PUSH: 0, LOSS: 0, BUST: 0,
    cushioned22Saves: 0, safetyNetSaves: 0, doubleAttempts: 0, doubleWins: 0
  };

  const jokerStats: Record<string, JokerStat> = {};
  JOKER_CATALOG.forEach(j => {
    jokerStats[j.id] = {
      id: j.id, name: j.name, cost: j.cost, rarity: j.rarity,
      offered: 0, bought: 0, picks: 0, wins: 0, anteSum: 0, scalingSum: 0
    };
  });

  const voucherStats: Record<string, VoucherStat> = {};
  VOUCHER_CATALOG.forEach(v => {
    voucherStats[v.id] = { id: v.id, name: v.name, offered: 0, bought: 0, wins: 0, anteSum: 0, runsWithVoucher: 0 };
  });

  const consumableStats: Record<string, ConsumableStat> = {};
  TAROT_CATALOG.forEach(t => {
    consumableStats[t.id] = {
      id: t.id,
      name: t.name,
      category: isCheatConsumable(t.id) ? 'cheat' : 'tarot',
      offered: 0,
      bought: 0,
      timesUsed: 0,
      runsWithItem: 0,
      runsWonWithItem: 0,
      anteSum: 0,
      specialImpactSum: 0
    };
  });

  const packStats: Record<string, PackStat> = {};
  const packCatalogList = (typeof PACK_CATALOG !== 'undefined') ? PACK_CATALOG : [
    { id: 'pack_joker', name: 'Joker Pack' },
    { id: 'pack_tarot', name: 'Tarot Pack' },
    { id: 'pack_cheat', name: 'Cheat Pack' },
    { id: 'pack_card', name: 'Playing Card Pack' },
    { id: 'pack_variety', name: 'Variety Pack' }
  ];
  packCatalogList.forEach(p => {
    packStats[p.id] = { id: p.id, name: p.name, offered: 0, bought: 0 };
  });

  for (let r = 0; r < numRuns; r++) {
    const simRun: SimRun = {
      ante: 1,
      blindIndex: 0,
      money: startMoney,
      maxHands: cfg.startingDeals,
      maxJokers: startMaxJokers,
      maxConsumables: 2,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      deck: baseDeckTemplate.map(c => ({ ...c })),
      jokers: [],
      vouchers: [],
      consumables: [],
      usedTarots: new Set<string>(),
      usedCheats: new Set<string>(),
      voucherAnteBought: {}
    };

    let runFailed = false;
    let campaignWon = false;
    let runTotalHands = 0;
    let finalAnte = 1;

    for (let a = 1; a <= maxEndlessAnte && !runFailed; a++) {
      simRun.ante = a;
      for (let b = 0; b < 3 && !runFailed; b++) {
        simRun.blindIndex = b;
        const bIdx = (a - 1) * 3 + b;
        const bStat = blindStats[bIdx];
        bStat.entered++;

        const targetScore = bStat.target;
        const bossBlind = computeBlindBoss(a, b);

        let dealsLeft = simRun.maxHands;
        if (bossBlind && bossBlind.id === 'the_cooler') dealsLeft = Math.max(1, dealsLeft - 1);
        if (simRun.jokers.some(j => j.id === 'the_banker') && simRun.money >= 25) dealsLeft += 1;
        for (const _ of simRun.jokers.filter(j => j.id === 'marked_deck')) {
          if (simRun.consumables.length < simRun.maxConsumables) {
            const c = CHEAT_CATALOG[Math.floor(Math.random() * CHEAT_CATALOG.length)];
            simRun.consumables.push({ ...c, consumableType: 'cheat' });
          }
        }

        let shoe = shuffle(simRun.deck.map(c => ({ ...c })));
        let simRunningCount = 0;
        const draw = (): Card => {
          if (shoe.length === 0) {
            shoe = shuffle(simRun.deck.map(c => ({ ...c })));
            simRunningCount = 0;
          }
          const c = shoe.pop() as Card;
          if (typeof getHiLoDelta === 'function') {
            simRunningCount += getHiLoDelta(c.rank);
          }
          return c;
        };

        let roundScore = 0;
        let blindWins = 0;
        let dealsUsedThisBlind = 0;
        simRun.handsWonInBlind = 0;
        const hasCushion = simRun.jokers.some(j => j.id === 'bust_cushion');

        while (dealsLeft > 0 && roundScore < targetScore) {
          // Safeguard 1: Max 30 deals per blind
          if (dealsUsedThisBlind >= 30) break;

          dealsLeft--;
          dealsUsedThisBlind++;
          totalHandsPlayed++;
          runTotalHands++;

          // Safeguard 2: Max 300 hands per run
          if (runTotalHands >= 300) {
            runFailed = true;
            break;
          }

          const pHand: Card[] = [draw(), draw()];
          const dHand: Card[] = [draw(), draw()];
          let doubled = false;
          let simRunTempChips = 0;

          // Battle Cheats
          if (simRun.consumables.length > 0) {
            const xIdx = simRun.consumables.findIndex(c => c.id === 'x_ray');
            if (xIdx >= 0) {
              simRunTempChips += 75;
              simRun.consumables.splice(xIdx, 1);
              simRun.usedCheats.add('x_ray');
              if (consumableStats['x_ray']) {
                consumableStats['x_ray'].timesUsed++;
                consumableStats['x_ray'].specialImpactSum += 75;
              }
            }
            const aceIdx = simRun.consumables.findIndex(c => c.id === 'loaded_ace');
            if (aceIdx >= 0 && evaluateBlackjackTotal(pHand, hasCushion).total <= 10) {
              pHand.push({ uid: 9998, rank: 'A', suit: '♠', enhancement: 'foil' });
              simRun.consumables.splice(aceIdx, 1);
              simRun.usedCheats.add('loaded_ace');
              if (consumableStats['loaded_ace']) {
                consumableStats['loaded_ace'].timesUsed++;
                consumableStats['loaded_ace'].specialImpactSum += 1;
              }
            }
          }

          if (evaluateBlackjackTotal(pHand, hasCushion).total < 21) {
            while (true) {
              const act = decideBotAction(pHand, dHand[0], simRun, botType, bossBlind, roundScore, targetScore, dealsLeft);
              if (act === 'DOUBLE') {
                doubled = true;
                pHand.push(draw());
                break;
              } else if (act === 'HIT') {
                const preHitTotal = evaluateBlackjackTotal(pHand, hasCushion).total;
                pHand.push(draw());
                const postHitTotal = evaluateBlackjackTotal(pHand, hasCushion).total;

                if (preHitTotal >= 15 && postHitTotal <= 21) {
                  for (const j of simRun.jokers) {
                    if (j.id === 'daredevil') {
                      j.bonusMult = (j.bonusMult || 0) + 1;
                    }
                  }
                }
                if (postHitTotal >= 21 || pHand.length >= 5) break;
              } else {
                break;
              }
            }
          }

          if (evaluateBlackjackTotal(pHand, hasCushion).total <= 21) {
            while (evaluateBlackjackTotal(dHand, false).total < 17) {
              dHand.push(draw());
            }
          }

          // Double vision cheat
          const pTot = evaluateBlackjackTotal(pHand, hasCushion).total;
          if (simRun.consumables.length > 0 && !doubled && pTot >= 19 && pTot <= 21) {
            const dvIdx = simRun.consumables.findIndex(c => c.id === 'double_vision');
            if (dvIdx >= 0) {
              doubled = true;
              simRun.consumables.splice(dvIdx, 1);
              simRun.usedCheats.add('double_vision');
              if (consumableStats['double_vision']) {
                consumableStats['double_vision'].timesUsed++;
                consumableStats['double_vision'].specialImpactSum += 1;
              }
            }
          }

          const res = scoreHand({
            playerHand: pHand,
            dealerHand: dHand,
            jokers: simRun.jokers,
            bossBlind,
            ante: simRun.ante,
            money: simRun.money,
            baseWinChipBonus: simRun.baseWinChipBonus,
            baseWinMultBonus: simRun.baseWinMultBonus,
            tempBonusChips: simRunTempChips,
            doubledDown: doubled,
            anteHandScaling: cfg.anteHandScaling,
            vouchers: simRun.vouchers,
            handsLeft: dealsLeft,
            handsWonInBlind: simRun.handsWonInBlind || 0,
            previousHandTotal: simRun.previousHandTotal,
            runningCount: simRunningCount,
            shoe,
            tarotsUsed: simRun.usedTarots.size + simRun.usedCheats.size
          });

          outcomeCounters[res.rawOutcomeType]++;
          if (res.cushioned) outcomeCounters.cushioned22Saves++;
          if (res.safetyNetSaved) outcomeCounters.safetyNetSaves++;
          if (doubled) {
            outcomeCounters.doubleAttempts++;
            if (res.isWin) outcomeCounters.doubleWins++;
          }
          if (res.chipStackerNewBonus !== null) {
            for (const j of simRun.jokers) {
              if (j.id === 'chip_stacker') j.bonusChips = res.chipStackerNewBonus;
            }
          }

          // Hot Hand tracking
          for (const j of simRun.jokers) {
            if (j.id === 'hot_hand') {
              if (res.isWin) j.bonusMult = Math.min(20, (j.bonusMult || 0) + 2);
              else if (res.rawOutcomeType === 'LOSS' || res.rawOutcomeType === 'BUST') j.bonusMult = 0;
            }
          }

          // The Bullseye tracking
          if (res.isWin && (res.outcomeType === 'EXACT21' || res.cushioned)) {
            for (const j of simRun.jokers) {
              if (j.id === 'the_bullseye') j.bonusMult = (j.bonusMult || 0) + 2;
            }
          }

          // Bad Beat Jackpot tracking
          if (res.rawOutcomeType === 'LOSS' && !res.pBust) {
            for (const j of simRun.jokers) {
              if (j.id === 'bad_beat_jackpot') {
                j.bonusMult = Math.min(10, (j.bonusMult || 0) + 1);
                simRun.money += 2;
              }
            }
          }

          // Street Magician tracking
          if (res.isWin && (res.outcomeType === 'EXACT21' || res.outcomeType === 'CHARLIE')) {
            if (simRun.jokers.some(j => j.id === 'street_magician') && simRun.consumables.length < simRun.maxConsumables) {
              const t = DECK_TAROT_CATALOG[Math.floor(Math.random() * DECK_TAROT_CATALOG.length)];
              simRun.consumables.push({ ...t, consumableType: 'tarot' });
            }
          }

          if (res.isWin) {
            simRun.handsWonInBlind = (simRun.handsWonInBlind || 0) + 1;
            simRun.previousHandTotal = res.pTotal;
            blindWins++;
            totalHandsWon++;
          }

          simRun.money += res.moneyGained;
          roundScore += res.handScore;

          if (res.rawOutcomeType === 'PUSH' && cfg.pushRefundsDeal) {
            dealsLeft++;
          }
        }

        bStat.scoreSum += roundScore;
        bStat.dealsUsedSum += dealsUsedThisBlind;

        if (roundScore < targetScore) {
          runFailed = true;
          finalAnte = a;
          if (a > highestAnteReached) highestAnteReached = a;

          const isScalingDeath = blindWins >= Math.ceil(simRun.maxHands * 0.42);
          if (isScalingDeath) {
            scalingDeaths++;
            bStat.scalingDeaths++;
          } else {
            coldShoeDeaths++;
            bStat.coldShoeDeaths++;
          }
        } else {
          bStat.cleared++;
          const maxInterest = simRun.vouchers.includes('deep_pockets') ? 8 : 5;
          const interestPer = simRun.vouchers.includes('liquidity_pass') ? 4 : 5;
          const hasBanker = simRun.jokers.some(j => j.id === 'the_banker');
          simRun.money += calcBlindPayout(b, dealsLeft, simRun.money, cfg.unusedDealCashCap, maxInterest, interestPer, hasBanker).totalEarned;
          bStat.cashAfterSum += simRun.money;

          simulateShopVisit(simRun, botType, jokerStats, voucherStats, consumableStats, packStats, () => { totalRerolls++; });
        }
      }

      if (!runFailed) {
        anteClearedCounts[a]++;
        if (a === 8) {
          campaignWon = true;
          wins++;
        }
      }
    }

    if (!runFailed) {
      finalAnte = maxEndlessAnte;
      if (maxEndlessAnte > highestAnteReached) highestAnteReached = maxEndlessAnte;
      if (!campaignWon && maxEndlessAnte >= 8) {
        campaignWon = true;
        wins++;
      }
    }

    totalFinalAnte += finalAnte;

    // End-of-run item attribution
    for (const j of simRun.jokers) {
      if (jokerStats[j.id]) {
        jokerStats[j.id].picks++;
        jokerStats[j.id].anteSum += finalAnte;
        if (campaignWon) jokerStats[j.id].wins++;
        if (j.id === 'daredevil') jokerStats[j.id].scalingSum += (j.bonusMult || 0);
        if (j.id === 'chip_stacker') jokerStats[j.id].scalingSum += (j.bonusChips || 0);
        if (j.id === 'hot_hand') jokerStats[j.id].scalingSum += (j.bonusMult || 0);
        if (j.id === 'the_bullseye') jokerStats[j.id].scalingSum += (j.bonusMult || 0);
        if (j.id === 'bad_beat_jackpot') jokerStats[j.id].scalingSum += (j.bonusMult || 0);
      }
    }
    for (const vId of simRun.vouchers) {
      if (voucherStats[vId]) {
        voucherStats[vId].runsWithVoucher++;
        voucherStats[vId].anteSum += (simRun.voucherAnteBought[vId] || 1);
        if (campaignWon) voucherStats[vId].wins++;
      }
    }
    const combinedUsed = new Set<string>([...simRun.usedTarots, ...simRun.usedCheats]);
    for (const cId of combinedUsed) {
      if (consumableStats[cId]) {
        consumableStats[cId].runsWithItem++;
        consumableStats[cId].anteSum += finalAnte;
        if (campaignWon) consumableStats[cId].runsWonWithItem++;
      }
    }
  }

  // Endless breakdown metrics (Ante 9+)
  const endlessStats: EndlessStat[] = [];
  if (maxEndlessAnte > 8) {
    for (let a = 9; a <= maxEndlessAnte; a++) {
      const bIdx0 = (a - 1) * 3;
      const entered = blindStats[bIdx0]?.entered || 0;
      const cleared = anteClearedCounts[a] || 0;
      const sD = (blindStats[bIdx0]?.scalingDeaths || 0) + (blindStats[bIdx0 + 1]?.scalingDeaths || 0) + (blindStats[bIdx0 + 2]?.scalingDeaths || 0);
      const cD = (blindStats[bIdx0]?.coldShoeDeaths || 0) + (blindStats[bIdx0 + 1]?.coldShoeDeaths || 0) + (blindStats[bIdx0 + 2]?.coldShoeDeaths || 0);
      endlessStats.push({
        ante: a,
        entered,
        cleared,
        clearRatePct: entered > 0 ? (cleared / entered) * 100 : 0,
        scalingDeaths: sD,
        coldShoeDeaths: cD
      });
    }
  }

  const elapsedMs = Math.round(performance.now() - t0);
  return {
    numRuns, botType, cfg, elapsedMs, wins, totalFinalAnte, highestAnteReached,
    scalingDeaths, coldShoeDeaths, totalHandsWon, totalHandsPlayed, totalRerolls,
    anteClearedCounts, blindStats, outcomeCounters, jokerStats, voucherStats, consumableStats, packStats, endlessStats, maxEndlessAnte
  };
}

/* ---------- Report Formatting ---------- */
function formatBotReportSection(simData: SimData): string {
  const {
    numRuns, botType, cfg, elapsedMs, wins, totalFinalAnte, highestAnteReached,
    scalingDeaths, coldShoeDeaths, totalHandsWon, totalHandsPlayed, totalRerolls,
    anteClearedCounts, blindStats, outcomeCounters, jokerStats, voucherStats, consumableStats, packStats, endlessStats, maxEndlessAnte
  } = simData;

  const botNames: Record<BotType, string> = {
    expert: 'Expert Strategy AI (Dynamic Bankroll, Deck Sculpting & Rerolls)',
    synergy: 'Smart Synergy AI (Adapts to Owned Jokers & Mechanics)',
    highroller: 'High-Roller 21 AI (Faces, Aces & Aggressive Doubles)',
    charlie: 'Low-Card Charlie AI (5-Card Charlie Specialist)',
    basic: 'Strict Casino Basic Strategy AI (Casual Joker Buyer)',
    vanilla: 'No-Jokers Baseline (Vanilla Basic Strategy Control)'
  };

  const winRate = ((wins / numRuns) * 100).toFixed(2);
  const avgAnte = (totalFinalAnte / numRuns).toFixed(2);
  const handWinPct = ((totalHandsWon / Math.max(1, totalHandsPlayed)) * 100).toFixed(2);
  const totalDeaths = Math.max(1, numRuns - wins);
  const scalingDeathPct = ((scalingDeaths / totalDeaths) * 100).toFixed(1);
  const coldShoeDeathPct = ((coldShoeDeaths / totalDeaths) * 100).toFixed(1);

  const pad = (str: string | number, len: number): string => String(str).padEnd(len, ' ');
  const padL = (str: string | number, len: number): string => String(str).padStart(len, ' ');

  const lines: string[] = [];
  lines.push('================================================================================');
  lines.push(`BOT STRATEGY: ${botNames[botType] || botType}`);
  lines.push('================================================================================');
  lines.push(`Runs Simulated        : ${numRuns.toLocaleString()} (${elapsedMs} ms)`);
  lines.push(`Max Simulation Depth  : Ante ${maxEndlessAnte} ${maxEndlessAnte > 8 ? '(Endless Mode Active)' : '(Campaign Mode Only)'}`);
  lines.push(`Starting Deals/Blind  : ${cfg.startingDeals}`);
  lines.push(`Starting Bankroll     : $${cfg.startingMoney ?? STARTING_MONEY}`);
  lines.push(`Max Joker Slots       : ${cfg.maxJokers ?? STARTING_MAX_JOKERS}`);
  lines.push(`Target Score Scaling  : ${cfg.targetScalePct}%`);
  lines.push(`Unused Deal Cash Cap  : $${cfg.unusedDealCashCap}`);
  lines.push(`Pushes Refund Deal    : ${cfg.pushRefundsDeal ? 'ON' : 'OFF'}`);
  lines.push(`Hand Tiers +15%/Ante  : ${cfg.anteHandScaling ? 'ON' : 'OFF'}`);
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`OVERALL KPI SUMMARY`);
  lines.push(`  Ante 8 Victory Rate : ${winRate}% (${wins} / ${numRuns})`);
  lines.push(`  Peak Endless Ante   : Ante ${highestAnteReached || 8}`);
  lines.push(`  Avg Final Ante      : ${avgAnte}`);
  lines.push(`  Total Hands Played  : ${totalHandsPlayed.toLocaleString()} (Avg ${(totalHandsPlayed / numRuns).toFixed(1)} hands/run)`);
  lines.push(`  BJ Hand Win Rate    : ${handWinPct}%`);
  lines.push(`  Cause of Death      : ${scalingDeathPct}% Scaling Wall (${scalingDeaths}) | ${coldShoeDeathPct}% Cold Shoe (${coldShoeDeaths})`);
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`HAND OUTCOME BREAKDOWN (% of ${totalHandsPlayed.toLocaleString()} total hands)`);
  const pctOfHands = (n: number): string => ((n / Math.max(1, totalHandsPlayed)) * 100).toFixed(2) + '%';
  lines.push(`  Natural Blackjack   : ${padL(outcomeCounters.NATURAL, 8)} (${pctOfHands(outcomeCounters.NATURAL)})`);
  lines.push(`  5-Card Charlie      : ${padL(outcomeCounters.CHARLIE, 8)} (${pctOfHands(outcomeCounters.CHARLIE)})`);
  lines.push(`  Exact 21 (3+ cards) : ${padL(outcomeCounters.EXACT21, 8)} (${pctOfHands(outcomeCounters.EXACT21)})`);
  lines.push(`  Standard Win        : ${padL(outcomeCounters.WIN, 8)} (${pctOfHands(outcomeCounters.WIN)})`);
  lines.push(`  Push (Tie)          : ${padL(outcomeCounters.PUSH, 8)} (${pctOfHands(outcomeCounters.PUSH)})`);
  lines.push(`  Dealer Win (Loss)   : ${padL(outcomeCounters.LOSS, 8)} (${pctOfHands(outcomeCounters.LOSS)})`);
  lines.push(`  Player Bust         : ${padL(outcomeCounters.BUST, 8)} (${pctOfHands(outcomeCounters.BUST)})`);
  lines.push(`  Double Down Win %   : ${outcomeCounters.doubleAttempts > 0 ? ((outcomeCounters.doubleWins / outcomeCounters.doubleAttempts) * 100).toFixed(1) + '%' : 'N/A'} (${outcomeCounters.doubleWins}/${outcomeCounters.doubleAttempts})`);
  lines.push(`  Bust Cushion Saves  : ${outcomeCounters.cushioned22Saves} hands (22 converted to 21)`);
  lines.push(`  Safety Net Saves    : ${outcomeCounters.safetyNetSaves} busts scored`);
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)`);
  for (let a = 1; a <= maxEndlessAnte; a++) {
    const c = anteClearedCounts[a] || 0;
    const p = ((c / numRuns) * 100).toFixed(2);
    const tag = a > 8 ? ' (Endless)' : '';
    lines.push(`  Ante ${pad(a + tag, 14)} : ${padL(p + '%', 7)} (${c} / ${numRuns})`);
  }
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (${blindStats.length} BLINDS)`);
  lines.push(`${pad('Blind', 10)} | ${padL('Target', 8)} | ${padL('Entered', 7)} | ${padL('Clear%', 7)} | ${padL('AvgScore', 8)} | ${padL('AvgDeals', 8)} | ${padL('AvgCash$', 8)} | ${padL('ScaleDth', 8)} | ${padL('ShoeDth', 7)}`);
  lines.push('-'.repeat(97));
  for (const b of blindStats) {
    if (b.entered === 0) continue;
    const clrPct = ((b.cleared / b.entered) * 100).toFixed(1) + '%';
    const avgScr = Math.round(b.scoreSum / b.entered);
    const avgDls = (b.dealsUsedSum / b.entered).toFixed(2);
    const avgCsh = b.cleared > 0 ? '$' + (b.cashAfterSum / b.cleared).toFixed(1) : '-';
    lines.push(
      `${pad(b.label, 10)} | ${padL(b.target, 8)} | ${padL(b.entered, 7)} | ${padL(clrPct, 7)} | ${padL(avgScr, 8)} | ${padL(avgDls, 8)} | ${padL(avgCsh, 8)} | ${padL(b.scalingDeaths, 8)} | ${padL(b.coldShoeDeaths, 7)}`
    );
  }
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)`);
  lines.push(`${pad('Joker Name', 18)} | ${pad('Rarity', 8)} | ${padL('Cost', 4)} | ${padL('Offered', 7)} | ${padL('Bought', 6)} | ${padL('EndHeld', 7)} | ${padL('RunWin%', 8)} | ${padL('Lift%', 7)} | ${padL('AvgAnte', 7)} | ${pad('Avg Scaling Bonus', 18)}`);
  lines.push('-'.repeat(117));

  const sortedJokers = Object.values(jokerStats)
    .filter(j => j.picks > 0 || j.offered > 0)
    .sort((a, b) => {
      const wrA = a.picks > 0 ? a.wins / a.picks : -1;
      const wrB = b.picks > 0 ? b.wins / b.picks : -1;
      return wrB - wrA;
    });

  const baseWinPctVal = (wins / numRuns) * 100;

  for (const j of sortedJokers) {
    const winPct = j.picks > 0 ? ((j.wins / j.picks) * 100).toFixed(1) + '%' : '0.0%';
    const rawWinPct = j.picks > 0 ? (j.wins / j.picks) * 100 : 0;
    const liftPct = j.picks > 0 ? (rawWinPct - baseWinPctVal).toFixed(1) : '0.0';
    const liftStr = (Number(liftPct) >= 0 ? '+' : '') + liftPct + '%';
    const avgA = j.picks > 0 ? (j.anteSum / j.picks).toFixed(2) : '-';
    let scaleNote = '-';
    if (j.id === 'daredevil' && j.picks > 0) {
      scaleNote = `+${(j.scalingSum / j.picks).toFixed(1)} Mult`;
    } else if (j.id === 'chip_stacker' && j.picks > 0) {
      scaleNote = `+${(j.scalingSum / j.picks).toFixed(1)} Chips`;
    } else if (j.id === 'hot_hand' && j.picks > 0) {
      scaleNote = `+${(j.scalingSum / j.picks).toFixed(1)} Mult`;
    } else if (j.id === 'the_bullseye' && j.picks > 0) {
      scaleNote = `+${(j.scalingSum / j.picks).toFixed(1)} Mult`;
    } else if (j.id === 'bad_beat_jackpot' && j.picks > 0) {
      scaleNote = `+${(j.scalingSum / j.picks).toFixed(1)} Mult`;
    }
    lines.push(
      `${pad(j.name, 18)} | ${pad(j.rarity.toUpperCase(), 8)} | ${padL('$' + j.cost, 4)} | ${padL(j.offered, 7)} | ${padL(j.bought, 6)} | ${padL(j.picks, 7)} | ${padL(winPct, 8)} | ${padL(liftStr, 7)} | ${padL(avgA, 7)} | ${pad(scaleNote, 18)}`
    );
  }

  if (consumableStats && Object.keys(consumableStats).length > 0) {
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`TAROT & BATTLE CHEAT PERFORMANCE LEADERBOARD (Sorted by Win Rate Lift)`);
    lines.push(`${pad('Consumable Name', 18)} | ${pad('Type', 6)} | ${padL('Offered', 7)} | ${padL('Bought', 6)} | ${padL('Used', 6)} | ${padL('Runs', 6)} | ${padL('Win%', 7)} | ${padL('Lift%', 7)} | ${padL('AvgAnte', 7)} | ${pad('Tactical Impact', 20)}`);
    lines.push('-'.repeat(117));

    const sortedConsumables = Object.values(consumableStats)
      .filter(c => c.offered > 0 || c.bought > 0 || c.runsWithItem > 0)
      .sort((a, b) => {
        const wrA = a.runsWithItem > 0 ? a.runsWonWithItem / a.runsWithItem : -1;
        const wrB = b.runsWithItem > 0 ? b.runsWonWithItem / b.runsWithItem : -1;
        return wrB - wrA;
      });

    for (const c of sortedConsumables) {
      const cWinPct = c.runsWithItem > 0 ? ((c.runsWonWithItem / c.runsWithItem) * 100).toFixed(1) + '%' : '0.0%';
      const rawCWin = c.runsWithItem > 0 ? (c.runsWonWithItem / c.runsWithItem) * 100 : 0;
      const cLift = c.runsWithItem > 0 ? (rawCWin - baseWinPctVal).toFixed(1) : '0.0';
      const cLiftStr = (Number(cLift) >= 0 ? '+' : '') + cLift + '%';
      const cAvgA = c.runsWithItem > 0 ? (c.anteSum / c.runsWithItem).toFixed(2) : '-';
      let impactNote = '-';
      if (c.id === 'the_guillotine' && c.runsWithItem > 0) impactNote = `${(c.specialImpactSum / c.runsWithItem).toFixed(1)} cards pruned`;
      else if (c.id === 'card_forge' && c.runsWithItem > 0) impactNote = `${(c.specialImpactSum / c.runsWithItem).toFixed(1)} cards ranked up`;
      else if (c.id === 'card_shave' && c.runsWithItem > 0) impactNote = `${(c.specialImpactSum / c.runsWithItem).toFixed(1)} cards shaved`;
      else if (c.id === 'polychrome_dice' && c.runsWithItem > 0) impactNote = `${(c.specialImpactSum / c.runsWithItem).toFixed(1)} poly cards`;
      else if (c.id === 'lucky_charm' && c.runsWithItem > 0) impactNote = `${(c.specialImpactSum / c.runsWithItem).toFixed(1)} holo cards`;
      else if ((c.id === 'wild_suit' || c.id === 'prism_dye') && c.runsWithItem > 0) impactNote = `${(c.specialImpactSum / c.runsWithItem).toFixed(1)} foil cards`;
      else if (c.id === 'midas_touch' && c.runsWithItem > 0) impactNote = `${(c.specialImpactSum / c.runsWithItem).toFixed(1)} gold cards`;
      else if (c.id === 'x_ray' && c.runsWithItem > 0) impactNote = `+${c.specialImpactSum.toLocaleString()} bonus chips`;
      else if (c.id === 'loaded_ace' && c.runsWithItem > 0) impactNote = `${c.specialImpactSum.toLocaleString()} aces summoned`;
      else if (c.id === 'double_vision' && c.runsWithItem > 0) impactNote = `${c.specialImpactSum.toLocaleString()} x2 mult hands`;

      lines.push(
        `${pad(c.name, 18)} | ${pad(c.category.toUpperCase(), 6)} | ${padL(c.offered, 7)} | ${padL(c.bought, 6)} | ${padL(c.timesUsed, 6)} | ${padL(c.runsWithItem, 6)} | ${padL(cWinPct, 7)} | ${padL(cLiftStr, 7)} | ${padL(cAvgA, 7)} | ${pad(impactNote, 20)}`
      );
    }
  }

  lines.push('--------------------------------------------------------------------------------');
  lines.push(`BOOSTER PACK TELEMETRY & SHOP REROLLS`);
  lines.push(`${pad('Pack Name', 22)} | ${padL('Offered', 8)} | ${padL('Opened', 8)} | ${padL('Open Rate', 10)} | ${padL('Avg/Run', 8)}`);
  lines.push('-'.repeat(66));
  for (const p of Object.values(packStats)) {
    const openRate = p.offered > 0 ? ((p.bought / p.offered) * 100).toFixed(1) + '%' : '0.0%';
    const avgRun = (p.bought / numRuns).toFixed(2);
    lines.push(`${pad(p.name, 22)} | ${padL(p.offered, 8)} | ${padL(p.bought, 8)} | ${padL(openRate, 10)} | ${padL(avgRun, 8)}`);
  }
  lines.push(`  Total Shop Rerolls    : ${totalRerolls.toLocaleString()} (Avg ${(totalRerolls / numRuns).toFixed(2)} rerolls/run)`);

  lines.push('--------------------------------------------------------------------------------');
  lines.push(`VOUCHER PERFORMANCE LEADERBOARD`);
  lines.push(`${pad('Voucher Name', 22)} | ${padL('Offered', 7)} | ${padL('Bought', 6)} | ${padL('BuyRate', 7)} | ${padL('Win%', 7)} | ${padL('Lift%', 7)} | ${padL('AvgAnteBought', 13)}`);
  lines.push('-'.repeat(88));
  for (const v of Object.values(voucherStats)) {
    const vBuyRate = v.offered > 0 ? ((v.bought / v.offered) * 100).toFixed(1) + '%' : '0.0%';
    const vWinPct = v.bought > 0 ? ((v.wins / v.bought) * 100).toFixed(1) + '%' : '0.0%';
    const rawVWin = v.bought > 0 ? (v.wins / v.bought) * 100 : 0;
    const vLift = v.bought > 0 ? (rawVWin - baseWinPctVal).toFixed(1) : '0.0';
    const vLiftStr = (Number(vLift) >= 0 ? '+' : '') + vLift + '%';
    const vAvgA = v.bought > 0 ? (v.anteSum / v.bought).toFixed(1) : '-';
    lines.push(
      `${pad(v.name, 22)} | ${padL(v.offered, 7)} | ${padL(v.bought, 6)} | ${padL(vBuyRate, 7)} | ${padL(vWinPct, 7)} | ${padL(vLiftStr, 7)} | ${padL('Ante ' + vAvgA, 13)}`
    );
  }

  if (endlessStats && endlessStats.length > 0) {
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`ENDLESS MODE PROGRESSION BREAKDOWN (ANTE 9+)`);
    lines.push(`${pad('Ante', 10)} | ${padL('Target (Small)', 14)} | ${padL('Entered', 8)} | ${padL('Cleared', 8)} | ${padL('Survival%', 10)} | ${padL('ScaleDeaths', 11)} | ${padL('ShoeDeaths', 10)}`);
    lines.push('-'.repeat(88));
    for (const e of endlessStats) {
      if (e.entered === 0) continue;
      const smallTarget = computeBlindTarget(e.ante, 0, cfg.targetScalePct);
      lines.push(
        `${pad(`Ante ${e.ante}`, 10)} | ${padL(smallTarget.toLocaleString(), 14)} | ${padL(e.entered, 8)} | ${padL(e.cleared, 8)} | ${padL(e.clearRatePct.toFixed(1) + '%', 10)} | ${padL(e.scalingDeaths, 11)} | ${padL(e.coldShoeDeaths, 10)}`
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}

/** Full text for a single-bot run (header + section). */
function buildSingleBotReport(simData: SimData): string {
  const header = [
    `JACK-LATRO v1.8 // MONTE CARLO TELEMETRY REPORT`,
    `Generated: ${new Date().toISOString()}`,
    ''
  ].join('\n');
  return header + formatBotReportSection(simData);
}

interface SuiteResult {
  reportText: string;
  expertData: SimData | null;
  /** Synergy bot data, for the on-screen modal. */
  synergyData: SimData | null;
}

/** Runs all 6 bots and assembles the comparative report text. */
function runBotSuite(numRuns: number, cfg: SimConfig): SuiteResult {
  const reports: string[] = [];
  const summaryRows: string[] = [];
  let expertData: SimData | null = null;
  let synergyData: SimData | null = null;

  for (const bType of BOT_ORDER) {
    const simData = runBatchSimulationForBot(numRuns, bType, cfg);
    if (bType === 'expert') expertData = simData;
    if (bType === 'synergy') synergyData = simData;
    reports.push(formatBotReportSection(simData));

    const winPct = ((simData.wins / numRuns) * 100).toFixed(2) + '%';
    const peakA = simData.highestAnteReached || 8;
    const avgA = (simData.totalFinalAnte / numRuns).toFixed(2);
    const bjWin = ((simData.totalHandsWon / Math.max(1, simData.totalHandsPlayed)) * 100).toFixed(2) + '%';
    summaryRows.push(
      `  ${bType.padEnd(12, ' ')} | Win Rate: ${winPct.padStart(7, ' ')} | Peak Ante: ${String('Ante ' + peakA).padStart(8, ' ')} | Avg Ante: ${avgA.padStart(5, ' ')} | BJ Hand Win%: ${bjWin.padStart(7, ' ')}`
    );
  }

  const masterHeader = [
    `================================================================================`,
    `JACK-LATRO v1.8 // FULL 6-BOT COMPARATIVE TELEMETRY SUITE`,
    `Generated: ${new Date().toISOString()}`,
    `Runs Per Bot: ${numRuns.toLocaleString()} (${(numRuns * BOT_ORDER.length).toLocaleString()} Total Simulated Games)`,
    `Settings: Depth=Ante ${cfg.maxEndlessAnte ?? 16}, Cash=$${cfg.startingMoney ?? STARTING_MONEY}, Jokers=${cfg.maxJokers ?? STARTING_MAX_JOKERS}, Deals=${cfg.startingDeals}, TargetScale=${cfg.targetScalePct}%, DealCashCap=$${cfg.unusedDealCashCap}, PushRefund=${cfg.pushRefundsDeal}, AnteScale=${cfg.anteHandScaling}`,
    `================================================================================`,
    `HEAD-TO-HEAD BOT SUMMARY:`,
    ...summaryRows,
    `================================================================================\n\n`
  ].join('\n');

  return { reportText: masterHeader + reports.join('\n\n'), expertData, synergyData };
}

if (typeof window !== 'undefined') {
  (window as any).runBatchSimulationForBot = runBatchSimulationForBot;
  (window as any).formatBotReportSection = formatBotReportSection;
  (window as any).buildSingleBotReport = buildSingleBotReport;
  (window as any).runBotSuite = runBotSuite;
  (window as any).decideBotAction = decideBotAction;
}
