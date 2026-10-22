/* ==========================================================
   simulator.ts - MONTE CARLO TELEMETRY (data + report text only)
   Runs on its OWN throwaway run objects: it never reads or writes the
   live gameState. Scoring, economy, catalogs and vouchers all come from
   the shared engines so the sim cannot drift from the real game.
   No DOM: input reading, buttons, modal and downloads live in main.ts.
   Depends on (global): gameState.ts, deckEngine.ts, modifierEngine.ts, shopEngine.ts
========================================================== */

type BotType = 'expert' | 'synergy' | 'highroller' | 'charlie' | 'basic' | 'vanilla';
type BotAction = 'HIT' | 'STAND' | 'DOUBLE';
type SimConfig = BalanceConfig;

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
  consumables: string[];
  voucherAnte?: number;
  anteVoucher?: VoucherDef | null;
  anteVoucherBought?: boolean;
  handsWonInBlind?: number;
  previousHandTotal?: number | null;
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
}

interface PackStat {
  id: string;
  name: string;
  offered: number;
  bought: number;
}

interface SimData {
  numRuns: number;
  botType: BotType;
  cfg: SimConfig;
  elapsedMs: number;
  wins: number;
  totalFinalAnte: number;
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
  packStats: Record<string, PackStat>;
}

/* ---------- Bot decision-making ---------- */
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

  if (botType === 'expert') {
    const scoreDeficit = Math.max(0, targetScore - roundScore);

    // 1. Target Awareness: Desperation play on final deal if far behind
    if (dealsLeft === 0 && scoreDeficit > 2500) {
      if (canDouble && !ownsJoker('minimalist')) return 'DOUBLE';
      if (pTotal <= 17) return 'HIT';
    }

    // Target Awareness: If blind is virtually cleared, avoid risky busts
    if (scoreDeficit <= 350) {
      if (pTotal >= 17) return 'STAND';
      if (pTotal >= 14 && dUp >= 7) return 'STAND';
    }

    // 2. Joker Synergies
    if (ownsJoker('minimalist') && pHand.length === 2 && pTotal >= 17) {
      return 'STAND';
    }
    if (ownsJoker('snake_eyes') && pTotal <= 13 && pTotal >= 11 && dUp <= 6) {
      return 'STAND';
    }
    if (ownsJoker('deja_vu') && simRun.previousHandTotal && pTotal === simRun.previousHandTotal && pTotal >= 16) {
      return 'STAND';
    }
    if (ownsJoker('sweet_16') && pTotal >= 13 && pTotal <= 16 && dUp <= 6) {
      return 'STAND';
    }
    if (hasCushion && !isSoft && pTotal === 12) {
      return 'HIT';
    }
    if (ownsJoker('daredevil')) {
      if (isSoft && pTotal >= 15 && pTotal <= 18) return 'HIT';
      if (hasCushion && pTotal === 15) return 'HIT';
    }
    if (canDouble && !ownsJoker('minimalist')) {
      if (ownsJoker('double_or_nothing')) {
        if (pTotal === 11 || pTotal === 10 || (pTotal === 9 && dUp <= 7)) return 'DOUBLE';
        if (isSoft && pTotal >= 16 && pTotal <= 18 && dUp <= 6) return 'DOUBLE';
      }
      if (ownsJoker('chip_stacker')) {
        if (pTotal === 11 || pTotal === 10 || (pTotal === 9 && dUp <= 6)) return 'DOUBLE';
      }
    }

    // Standard high-EV Doubling
    if (canDouble && !ownsJoker('minimalist')) {
      if (pTotal === 11) return 'DOUBLE';
      if (pTotal === 10 && dUp <= 9) return 'DOUBLE';
      if (pTotal === 9 && dUp >= 3 && dUp <= 6) return 'DOUBLE';
      if (isSoft && (pTotal === 17 || pTotal === 18) && dUp >= 4 && dUp <= 6) return 'DOUBLE';
    }

    // Basic Strategy Soft/Hard Play
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

  if (botType === 'synergy' || botType === 'charlie') {
    if (hasCushion && !isSoft && pTotal === 12) {
      return 'HIT';
    }
    if (ownsJoker('daredevil')) {
      if (isSoft && pTotal >= 15 && pTotal <= 17) return 'HIT';
      if (hasCushion && pTotal === 15) return 'HIT';
    }
    if (ownsJoker('chip_stacker') && canDouble) {
      if (pTotal === 11 || pTotal === 10 || (pTotal === 9 && dUp <= 6) || (hasCushion && pTotal === 12)) {
        return 'DOUBLE';
      }
    }
    if (ownsJoker('sweet_16') && pTotal >= 13 && pTotal <= 16 && dUp <= 6) {
      return 'STAND';
    }
    if ((ownsJoker('hit_me_baby') || botType === 'charlie') && pTotal <= (hasCushion ? 14 : 13)) {
      return 'HIT';
    }
    if (ownsJoker('safety_net') && pTotal <= 15 && dUp >= 7) {
      return 'HIT';
    }
  }

  if (botType === 'highroller' && canDouble && (pTotal === 10 || pTotal === 11 || (pTotal === 9 && dUp <= 6))) {
    return 'DOUBLE';
  }

  if (canDouble) {
    if (!ownsJoker('minimalist')) {
      if (pTotal === 11) return 'DOUBLE';
      if (pTotal === 10 && dUp <= 9) return 'DOUBLE';
      if (pTotal === 9 && dUp >= 3 && dUp <= 6) return 'DOUBLE';
    }
  }

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

function scoreJokerPriorityForBot(joker: JokerInstance, botType: BotType): number {
  let score = joker.cost;
  if (joker.isXMult) score += 5;
  if (joker.id === 'daredevil') score += (joker.bonusMult || 0) * 0.8;
  if (joker.id === 'chip_stacker') score += (joker.bonusChips || 0) * 0.15;

  if (botType === 'expert') {
    if (joker.isXMult) score += 8;
    if (joker.id === 'daredevil') score += 6 + (joker.bonusMult || 0) * 1.0;
    if (joker.id === 'chip_stacker') score += 5 + (joker.bonusChips || 0) * 0.2;
    if (joker.id === 'hot_hand') score += 6 + (joker.bonusMult || 0) * 0.4;
    if (['bust_cushion', 'the_shark', 'blackjack_tycoon', 'card_sharp_joker', 'double_or_nothing', 'deja_vu', 'monochrome'].includes(joker.id)) score += 8;
    if (['golden_parachute', 'loan_shark', 'diamond_cutter', 'the_grinder', 'compound_edge'].includes(joker.id)) score += 6;
    if (['vip_high_roller', 'ace_up_sleeve', 'push_it_good', 'trips_ahoy', 'spade_slicer', 'crimson_heart', 'club_sandwich', 'slow_and_steady', 'sweet_16'].includes(joker.id)) score += 5;
    return score;
  }

  if (botType === 'highroller' && ['blackjack_tycoon', 'vip_high_roller', 'ace_up_sleeve', 'chip_stacker', 'minimalist', 'the_shark', 'pocket_rockets', 'double_or_nothing', 'deja_vu', 'trips_ahoy'].includes(joker.id)) score += 6;
  if (botType === 'charlie' && ['bust_cushion', 'daredevil', 'card_counter', 'hit_me_baby', 'sweet_16', 'safety_net', 'even_steven', 'snake_eyes', 'the_grinder', 'odd_ball', 'trips_ahoy'].includes(joker.id)) score += 6;
  if (botType === 'synergy' && ['bust_cushion', 'daredevil', 'chip_stacker', 'the_shark', 'blackjack_tycoon', 'ace_up_sleeve', 'vip_high_roller', 'push_it_good', 'card_counter', 'sweet_16', 'compound_edge', 'hot_hand', 'spade_slicer', 'crimson_heart', 'diamond_cutter', 'club_sandwich', 'monochrome', 'card_sharp_joker', 'slow_and_steady'].includes(joker.id)) score += 5;
  return score;
}

function evaluateAndPickPackOption(
  options: PackCardOption[],
  simRun: SimRun,
  botType: BotType,
  jokerStats: Record<string, JokerStat>
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
      const t = opt.data;
      if (t.id === 'the_guillotine') {
        const hasLow = simRun.deck.some(c => ['2', '3', '4', '5'].includes(c.rank));
        score = (botType === 'charlie') ? 2 : (hasLow ? 11 : 0);
      } else if (t.id === 'card_forge') {
        const hasNonAce = simRun.deck.some(c => c.rank !== 'A' && c.rank !== 'K');
        score = hasNonAce ? 10 : 0;
      } else if (t.id === 'polychrome_dice') {
        const hasUnenhanced = simRun.deck.some(c => !c.enhancement);
        score = hasUnenhanced ? 12 : 0;
      } else if (t.id === 'lucky_charm') {
        const hasUnenhanced = simRun.deck.some(c => !c.enhancement);
        score = hasUnenhanced ? 10 : 0;
      } else if (t.id === 'wild_suit') {
        const hasUnenhanced = simRun.deck.some(c => !c.enhancement);
        score = hasUnenhanced ? 9 : 0;
      } else if (t.id === 'midas_touch') {
        const hasUnenhanced = simRun.deck.some(c => !c.enhancement);
        score = hasUnenhanced ? 8 : 0;
      } else {
        score = 6;
      }
    } else if (opt.kind === 'cheat') {
      const c = opt.data;
      if (simRun.consumables.length < simRun.maxConsumables) {
        if (c.id === 'double_vision') score = 9;
        else if (c.id === 'loaded_ace') score = 8;
        else if (c.id === 'x_ray') score = 7;
        else score = 6;
      } else {
        score = -1;
      }
    } else if (opt.kind === 'card') {
      const card = opt.data;
      let rankVal = 4;
      if (botType === 'charlie' && ['2', '4', '6', '7', 'A'].includes(card.rank)) {
        rankVal = 8;
      } else if (['A', 'K', 'Q', 'J', '10', '7'].includes(card.rank)) {
        rankVal = 8;
      }
      let enhVal = 0;
      if (card.enhancement === 'poly') enhVal = 6;
      else if (card.enhancement === 'holo') enhVal = 4;
      else if (card.enhancement === 'foil') enhVal = 3;
      else if (card.enhancement === 'gold') enhVal = 3;

      score = rankVal + enhVal;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestSellJokerIdx = sellJokerIdx;
    }
  }

  if (bestIdx < 0 || bestScore <= 0) {
    return false; // Skip taking anything from this pack
  }

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
    jokerStats[j.id].bought++;
    if (j.id === 'loan_shark') simRun.money += 15;
    simRun.jokers.sort((a, b) => (a.isXMult ? 1 : 0) - (b.isXMult ? 1 : 0));
  } else if (chosen.kind === 'tarot') {
    const t = chosen.data;
    if (t.id === 'the_guillotine') {
      const lowIdx = simRun.deck.findIndex(c => ['2', '3', '4', '5'].includes(c.rank));
      if (lowIdx >= 0) simRun.deck.splice(lowIdx, 1);
    } else if (t.id === 'card_forge') {
      const nonAce = simRun.deck.find(c => c.rank !== 'A' && c.rank !== 'K');
      if (nonAce) {
        const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const idx = ranks.indexOf(nonAce.rank);
        if (idx >= 0) nonAce.rank = ranks[Math.min(ranks.length - 1, idx + 2)];
      }
    } else if (t.id === 'wild_suit') {
      const unenhanced = simRun.deck.find(c => !c.enhancement);
      if (unenhanced) unenhanced.enhancement = 'foil';
    } else if (t.id === 'lucky_charm') {
      const unenhanced = simRun.deck.find(c => !c.enhancement);
      if (unenhanced) unenhanced.enhancement = 'holo';
    } else if (t.id === 'polychrome_dice') {
      const unenhanced = simRun.deck.find(c => !c.enhancement);
      if (unenhanced) unenhanced.enhancement = 'poly';
    } else if (t.id === 'midas_touch') {
      const unenhanced = simRun.deck.find(c => !c.enhancement);
      if (unenhanced) unenhanced.enhancement = 'gold';
    }
  } else if (chosen.kind === 'cheat') {
    const c = chosen.data;
    if (simRun.consumables.length < simRun.maxConsumables) {
      simRun.consumables.push(c.id);
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

function scorePackPriority(pack: PackDef, simRun: SimRun, botType: BotType): number {
  const jokersNeeded = simRun.maxJokers - simRun.jokers.length;
  const weakestScore = simRun.jokers.length > 0
    ? Math.min(...simRun.jokers.map(j => scoreJokerPriorityForBot(j, botType)))
    : 0;

  if (pack.packType === 'joker') {
    if (jokersNeeded >= 3) return 100;
    if (jokersNeeded >= 1) return 85;
    if (weakestScore < 10) return 65;
    if (weakestScore < 13) return 45;
    return 15;
  }
  if (pack.packType === 'variety') {
    if (jokersNeeded >= 2) return 80;
    if (jokersNeeded >= 1) return 75;
    if (weakestScore < 12) return 60;
    return 50;
  }
  if (pack.packType === 'tarot') {
    if (jokersNeeded >= 3) return 20;
    if (jokersNeeded >= 1) return 40;
    return 65;
  }
  if (pack.packType === 'cheat') {
    if (simRun.consumables.length >= simRun.maxConsumables) return 5;
    if (jokersNeeded >= 3) return 18;
    if (jokersNeeded >= 1) return 38;
    return 58;
  }
  if (pack.packType === 'card') {
    if (jokersNeeded >= 3) return 15;
    if (jokersNeeded >= 1) return 35;
    return 60;
  }
  return 30;
}

function simulateExpertShopVisit(
  simRun: SimRun,
  jokerStats: Record<string, JokerStat>,
  voucherStats: Record<string, VoucherStat>,
  packStats: Record<string, PackStat>,
  trackReroll: () => void
): void {
  const interestPer = simRun.vouchers.includes('liquidity_pass') ? 4 : 5;
  const maxInterest = simRun.vouchers.includes('deep_pockets') ? 8 : 5;
  const capCash = maxInterest * interestPer;
  const targetBank = simRun.ante === 1 ? 5 : (simRun.ante === 2 ? 15 : capCash);

  // 1. High-value Vouchers (1 per Ante)
  const voucherPriority = [
    'joker_slot',
    'clearance_sale',
    'liquidity_pass',
    'table_leverage',
    'card_shark_voucher',
    'base_boost',
    'deep_pockets',
    'card_sharp',
    'extra_hand',
    'overstock'
  ];
  if (simRun.voucherAnte !== simRun.ante) {
    simRun.voucherAnte = simRun.ante;
    simRun.anteVoucherBought = false;
    const availVouchers = VOUCHER_CATALOG
      .filter(v => !simRun.vouchers.includes(v.id))
      .sort((a, b) => voucherPriority.indexOf(a.id) - voucherPriority.indexOf(b.id));
    simRun.anteVoucher = availVouchers.length > 0 ? availVouchers[0] : null;
    if (simRun.anteVoucher) {
      voucherStats[simRun.anteVoucher.id].offered++;
    }
  }

  if (simRun.anteVoucher && !simRun.anteVoucherBought) {
    const v = simRun.anteVoucher;
    const reserve = (v.id === 'joker_slot' || v.id === 'clearance_sale') ? 0 : Math.floor(targetBank * 0.5);
    if (simRun.money >= v.cost + reserve) {
      simRun.money -= v.cost;
      simRun.vouchers.push(v.id);
      simRun.anteVoucherBought = true;
      voucherStats[v.id].bought++;
      const d = getVoucherDeltas(v.id);
      simRun.maxHands += d.maxHands || 0;
      simRun.baseWinMultBonus += d.baseWinMultBonus || 0;
      simRun.maxJokers += d.maxJokers || 0;
      simRun.baseWinChipBonus += d.baseWinChipBonus || 0;
    }
  }

  // 2. Booster Pack Shopping
  const processPacks = (packs: PackDef[]): void => {
    const sortedPacks = packs.slice().sort((a, b) =>
      scorePackPriority(b, simRun, 'expert') - scorePackPriority(a, simRun, 'expert')
    );

    for (const pack of sortedPacks) {
      const jokersNeeded = simRun.maxJokers - simRun.jokers.length;
      const reserve = (jokersNeeded >= 4) ? 0 : (jokersNeeded >= 2 ? Math.floor(targetBank * 0.3) : Math.floor(targetBank * 0.7));
      if (simRun.money < pack.cost + reserve) continue;

      simRun.money -= pack.cost;
      packStats[pack.id].bought++;

      const options = generatePackOptions(pack, simRun.jokers.map(j => j.id));
      for (const opt of options) {
        if (opt.kind === 'joker') {
          jokerStats[opt.data.id].offered++;
        }
      }

      evaluateAndPickPackOption(options, simRun, 'expert', jokerStats);
    }
  };

  const hasOverstock = simRun.vouchers.includes('overstock');
  let currentPacks = generateShopPacks(simRun.ante, simRun.jokers.length, hasOverstock);
  currentPacks.forEach(p => { packStats[p.id].offered++; });
  processPacks(currentPacks);

  // 3. Shop Rerolls
  let rerollCost = simRun.vouchers.includes('clearance_sale') ? 1 : 2;
  let rerollsDone = 0;
  const maxRerolls = 2;

  while (rerollsDone < maxRerolls) {
    const jokersNeeded = simRun.maxJokers - simRun.jokers.length;
    const weakestScore = simRun.jokers.length > 0
      ? Math.min(...simRun.jokers.map(j => scoreJokerPriorityForBot(j, 'expert')))
      : 0;
    const wantsBetter = jokersNeeded > 0 || weakestScore < 12;

    if (!wantsBetter) break;
    if (simRun.money < targetBank + rerollCost + 4) break;

    simRun.money -= rerollCost;
    trackReroll();
    if (!simRun.vouchers.includes('clearance_sale')) {
      rerollCost++;
    }
    rerollsDone++;

    currentPacks = generateShopPacks(simRun.ante, simRun.jokers.length, hasOverstock);
    currentPacks.forEach(p => { packStats[p.id].offered++; });
    processPacks(currentPacks);
  }
}

function simulateShopVisit(
  simRun: SimRun,
  botType: BotType,
  jokerStats: Record<string, JokerStat>,
  voucherStats: Record<string, VoucherStat>,
  packStats: Record<string, PackStat>,
  trackReroll: () => void
): void {
  if (botType === 'vanilla') return;
  if (botType === 'expert') {
    simulateExpertShopVisit(simRun, jokerStats, voucherStats, packStats, trackReroll);
    return;
  }

  // 1. Voucher Handling (1 per Ante)
  if (simRun.voucherAnte !== simRun.ante) {
    simRun.voucherAnte = simRun.ante;
    simRun.anteVoucherBought = false;
    const availVouchers = VOUCHER_CATALOG.filter(v => !simRun.vouchers.includes(v.id));
    simRun.anteVoucher = availVouchers.length > 0 ? availVouchers[Math.floor(Math.random() * availVouchers.length)] : null;
    if (simRun.anteVoucher) {
      voucherStats[simRun.anteVoucher.id].offered++;
    }
  }

  if (simRun.anteVoucher && !simRun.anteVoucherBought) {
    const v = simRun.anteVoucher;
    if (simRun.money >= v.cost + 2) {
      simRun.money -= v.cost;
      simRun.vouchers.push(v.id);
      simRun.anteVoucherBought = true;
      voucherStats[v.id].bought++;
      const d = getVoucherDeltas(v.id);
      simRun.maxHands += d.maxHands || 0;
      simRun.baseWinMultBonus += d.baseWinMultBonus || 0;
      simRun.maxJokers += d.maxJokers || 0;
      simRun.baseWinChipBonus += d.baseWinChipBonus || 0;
    }
  }

  // 2. Booster Pack Shopping
  const processPacks = (packs: PackDef[]): void => {
    const sortedPacks = packs.slice().sort((a, b) =>
      scorePackPriority(b, simRun, botType) - scorePackPriority(a, simRun, botType)
    );

    for (const pack of sortedPacks) {
      const minReserve = (simRun.jokers.length === 0) ? 0 : 2;
      if (simRun.money < pack.cost + minReserve) continue;

      simRun.money -= pack.cost;
      packStats[pack.id].bought++;

      const options = generatePackOptions(pack, simRun.jokers.map(j => j.id));
      for (const opt of options) {
        if (opt.kind === 'joker') {
          jokerStats[opt.data.id].offered++;
        }
      }

      evaluateAndPickPackOption(options, simRun, botType, jokerStats);
    }
  };

  const hasOverstock = simRun.vouchers.includes('overstock');
  let packs = generateShopPacks(simRun.ante, simRun.jokers.length, hasOverstock);
  packs.forEach(p => { packStats[p.id].offered++; });
  processPacks(packs);

  // Occasional reroll if flush with cash but lacking jokers
  const rerollCost = simRun.vouchers.includes('clearance_sale') ? 1 : 2;
  if (simRun.money >= 12 && simRun.jokers.length < 2) {
    simRun.money -= rerollCost;
    trackReroll();
    packs = generateShopPacks(simRun.ante, simRun.jokers.length, hasOverstock);
    packs.forEach(p => { packStats[p.id].offered++; });
    processPacks(packs);
  }
}

/* ---------- Batch simulation ---------- */
function runBatchSimulationForBot(numRuns: number, botType: BotType, cfg: SimConfig): SimData {
  // Note: this advances the shared card uid counter (uids stay unique; gaps are harmless).
  // It never touches the live deck, shoe, hands, money or jokers.
  const baseDeckTemplate = createStandardDeck();
  const t0 = performance.now();

  let wins = 0;
  let totalFinalAnte = 0;
  let scalingDeaths = 0;
  let coldShoeDeaths = 0;
  let totalHandsWon = 0;
  let totalHandsPlayed = 0;

  const anteClearedCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0];

  // 24 Blinds telemetry (Ante 1..8 x Blind 0..2)
  const blindStats: BlindStat[] = [];
  for (let a = 1; a <= 8; a++) {
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
    voucherStats[v.id] = { id: v.id, name: v.name, offered: 0, bought: 0, wins: 0 };
  });

  const packStats: Record<string, PackStat> = {};
  PACK_CATALOG.forEach(p => {
    packStats[p.id] = { id: p.id, name: p.name, offered: 0, bought: 0 };
  });
  let totalRerolls = 0;

  for (let r = 0; r < numRuns; r++) {
    const simRun: SimRun = {
      ante: 1,
      blindIndex: 0,
      money: STARTING_MONEY,
      maxHands: cfg.startingDeals,
      maxJokers: STARTING_MAX_JOKERS,
      maxConsumables: 2,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      deck: baseDeckTemplate.slice(),
      jokers: [],
      vouchers: [],
      consumables: []
    };

    let runFailed = false;

    for (let a = 1; a <= 8 && !runFailed; a++) {
      simRun.ante = a;
      for (let b = 0; b < 3 && !runFailed; b++) {
        simRun.blindIndex = b;
        const bStat = blindStats[(a - 1) * 3 + b];
        bStat.entered++;

        const targetScore = bStat.target;
        const bossBlind = computeBlindBoss(a, b);

        let dealsLeft = simRun.maxHands;
        if (bossBlind && bossBlind.id === 'the_cooler') dealsLeft = Math.max(1, dealsLeft - 1);

        let shoe = shuffle(simRun.deck);
        const draw = (): Card => {
          if (shoe.length === 0) shoe = shuffle(simRun.deck);
          return shoe.pop() as Card;
        };

        let roundScore = 0;
        let blindWins = 0;
        let dealsUsedThisBlind = 0;
        simRun.handsWonInBlind = 0;
        simRun.previousHandTotal = null;
        const hasCushion = simRun.jokers.some(j => j.id === 'bust_cushion');

        while (dealsLeft > 0 && roundScore < targetScore) {
          dealsLeft--;
          dealsUsedThisBlind++;
          totalHandsPlayed++;

          const pHand: Card[] = [draw(), draw()];
          const dHand: Card[] = [draw(), draw()];
          let doubled = false;
          let simRunTempChips = 0;

          // Bot uses opening tarots if beneficial
          if (simRun.consumables.length > 0) {
            const xIdx = simRun.consumables.indexOf('x_ray');
            if (xIdx >= 0) {
              simRunTempChips += 75;
              simRun.consumables.splice(xIdx, 1);
            }
          }
          if (simRun.consumables.length > 0 && pHand.length === 2 && evaluateBlackjackTotal(pHand, hasCushion).total <= 10) {
            const aceIdx = simRun.consumables.indexOf('loaded_ace');
            if (aceIdx >= 0) {
              pHand.push({ uid: 9998, rank: 'A', suit: '♠', enhancement: 'foil' });
              simRun.consumables.splice(aceIdx, 1);
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
                  const gain = 1;
                  for (const j of simRun.jokers) {
                    if (j.id === 'daredevil') {
                      j.bonusMult = (j.bonusMult || 0) + gain;
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

          // Bot uses resolution tarots
          const pTot = evaluateBlackjackTotal(pHand, hasCushion).total;
          if (simRun.consumables.length > 0 && !doubled && pTot >= 19 && pTot <= 21) {
            const dvIdx = simRun.consumables.indexOf('double_vision');
            if (dvIdx >= 0) {
              doubled = true;
              simRun.consumables.splice(dvIdx, 1);
            }
          }
          if (simRun.consumables.length > 0) {
            const polyIdx = simRun.consumables.indexOf('polychrome_dice');
            if (polyIdx >= 0 && pHand.length > 0 && !pHand[0].enhancement) {
              pHand[0].enhancement = 'poly';
              simRun.consumables.splice(polyIdx, 1);
            }
          }
          if (simRun.consumables.length > 0) {
            const midasIdx = simRun.consumables.indexOf('midas_touch');
            if (midasIdx >= 0 && pHand.length > 0) {
              pHand[pHand.length - 1].enhancement = 'gold';
              simRun.consumables.splice(midasIdx, 1);
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
            previousHandTotal: simRun.previousHandTotal
          });

          // Apply the result to the simulated run + telemetry
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

          if (res.isWin) simRun.handsWonInBlind = (simRun.handsWonInBlind || 0) + 1;
          simRun.previousHandTotal = res.pBust ? null : res.pTotal;

          simRun.money += res.moneyGained;
          roundScore += res.handScore;

          if (res.isWin) {
            blindWins++;
            totalHandsWon++;
          }
          if (res.rawOutcomeType === 'PUSH' && cfg.pushRefundsDeal) {
            dealsLeft++;
          }
        }

        bStat.scoreSum += roundScore;
        bStat.dealsUsedSum += dealsUsedThisBlind;

        if (roundScore < targetScore) {
          runFailed = true;
          totalFinalAnte += a;
          const isScalingDeath = blindWins >= Math.ceil(simRun.maxHands * 0.42);
          if (isScalingDeath) {
            scalingDeaths++;
            bStat.scalingDeaths++;
          } else {
            coldShoeDeaths++;
            bStat.coldShoeDeaths++;
          }

          for (const j of simRun.jokers) {
            jokerStats[j.id].picks++;
            jokerStats[j.id].anteSum += a;
            if (j.id === 'daredevil') jokerStats[j.id].scalingSum += (j.bonusMult || 0);
            if (j.id === 'chip_stacker') jokerStats[j.id].scalingSum += (j.bonusChips || 0);
            if (j.id === 'hot_hand') jokerStats[j.id].scalingSum += (j.bonusMult || 0);
          }
        } else {
          bStat.cleared++;
          const maxInterest = simRun.vouchers.includes('deep_pockets') ? 8 : 5;
          const interestPer = simRun.vouchers.includes('liquidity_pass') ? 4 : 5;
          const loanSharkFee = simRun.jokers.some(j => j.id === 'loan_shark') ? 1 : 0;
          simRun.money += calcBlindPayout(b, dealsLeft, simRun.money, cfg.unusedDealCashCap, maxInterest, interestPer, loanSharkFee).totalEarned;
          bStat.cashAfterSum += simRun.money;

          simulateShopVisit(simRun, botType, jokerStats, voucherStats, packStats, () => { totalRerolls++; });
        }
      }
      if (!runFailed) {
        anteClearedCounts[a]++;
      }
    }

    if (!runFailed) {
      wins++;
      totalFinalAnte += 8;
      for (const j of simRun.jokers) {
        jokerStats[j.id].picks++;
        jokerStats[j.id].wins++;
        jokerStats[j.id].anteSum += 9;
        if (j.id === 'daredevil') jokerStats[j.id].scalingSum += (j.bonusMult || 0);
        if (j.id === 'chip_stacker') jokerStats[j.id].scalingSum += (j.bonusChips || 0);
        if (j.id === 'hot_hand') jokerStats[j.id].scalingSum += (j.bonusMult || 0);
      }
      for (const vId of simRun.vouchers) {
        if (voucherStats[vId]) voucherStats[vId].wins++;
      }
    }
  }

  const elapsedMs = Math.round(performance.now() - t0);
  return {
    numRuns, botType, cfg, elapsedMs, wins, totalFinalAnte,
    scalingDeaths, coldShoeDeaths, totalHandsWon, totalHandsPlayed, totalRerolls,
    anteClearedCounts, blindStats, outcomeCounters, jokerStats, voucherStats, packStats
  };
}

/* ---------- Report text (pure) ---------- */
function formatBotReportSection(simData: SimData): string {
  const {
    numRuns, botType, cfg, elapsedMs, wins, totalFinalAnte,
    scalingDeaths, coldShoeDeaths, totalHandsWon, totalHandsPlayed, totalRerolls,
    anteClearedCounts, blindStats, outcomeCounters, jokerStats, voucherStats, packStats
  } = simData;

  const botNames: Record<BotType, string> = {
    expert: 'Expert Strategy AI (Rerolls, Interest & Target Aware)',
    synergy: 'Smart Synergy AI (Adapts to Jokers)',
    highroller: 'High-Roller 21 AI (Faces/Aces/Doubles)',
    charlie: 'Low-Card Charlie AI (Hits Low Cards)',
    basic: 'Strict Casino Basic Strategy AI (With Jokers)',
    vanilla: 'No-Jokers Baseline (Vanilla Basic Strategy)'
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
  lines.push(`Starting Deals/Blind  : ${cfg.startingDeals}`);
  lines.push(`Target Score Scaling  : ${cfg.targetScalePct}%`);
  lines.push(`Unused Deal Cash Cap  : $${cfg.unusedDealCashCap}`);
  lines.push(`Pushes Refund Deal    : ${cfg.pushRefundsDeal ? 'ON' : 'OFF'}`);
  lines.push(`Hand Tiers +15%/Ante  : ${cfg.anteHandScaling ? 'ON' : 'OFF'}`);
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`OVERALL KPI SUMMARY`);
  lines.push(`  Ante 8 Victory Rate : ${winRate}% (${wins} / ${numRuns})`);
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
  for (let a = 1; a <= 8; a++) {
    const c = anteClearedCounts[a];
    const p = ((c / numRuns) * 100).toFixed(2);
    lines.push(`  Ante ${a} Cleared      : ${padL(p + '%', 7)} (${c} / ${numRuns})`);
  }
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)`);
  lines.push(`${pad('Blind', 10)} | ${padL('Target', 7)} | ${padL('Entered', 7)} | ${padL('Clear%', 7)} | ${padL('AvgScore', 8)} | ${padL('AvgDeals', 8)} | ${padL('AvgCash$', 8)} | ${padL('ScaleDth', 8)} | ${padL('ShoeDth', 7)}`);
  lines.push('-'.repeat(96));
  for (const b of blindStats) {
    if (b.entered === 0) continue;
    const clrPct = ((b.cleared / b.entered) * 100).toFixed(1) + '%';
    const avgScr = Math.round(b.scoreSum / b.entered);
    const avgDls = (b.dealsUsedSum / b.entered).toFixed(2);
    const avgCsh = b.cleared > 0 ? '$' + (b.cashAfterSum / b.cleared).toFixed(1) : '-';
    lines.push(
      `${pad(b.label, 10)} | ${padL(b.target, 7)} | ${padL(b.entered, 7)} | ${padL(clrPct, 7)} | ${padL(avgScr, 8)} | ${padL(avgDls, 8)} | ${padL(avgCsh, 8)} | ${padL(b.scalingDeaths, 8)} | ${padL(b.coldShoeDeaths, 7)}`
    );
  }
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)`);
  lines.push(`${pad('Joker Name', 18)} | ${pad('Rarity', 8)} | ${padL('Cost', 4)} | ${padL('Offered', 7)} | ${padL('Bought', 6)} | ${padL('EndHeld', 7)} | ${padL('RunWin%', 8)} | ${padL('AvgAnte', 7)} | ${pad('Avg Scaling Bonus', 18)}`);
  lines.push('-'.repeat(107));

  const sortedJokers = Object.values(jokerStats)
    .filter(j => j.picks > 0 || j.offered > 0)
    .sort((a, b) => {
      const wrA = a.picks > 0 ? a.wins / a.picks : -1;
      const wrB = b.picks > 0 ? b.wins / b.picks : -1;
      return wrB - wrA;
    });

  for (const j of sortedJokers) {
    const winPct = j.picks > 0 ? ((j.wins / j.picks) * 100).toFixed(1) + '%' : '0.0%';
    const avgA = j.picks > 0 ? (j.anteSum / j.picks).toFixed(2) : '-';
    let scaleNote = '-';
    if (j.id === 'daredevil' && j.picks > 0) {
      scaleNote = `+${(j.scalingSum / j.picks).toFixed(1)} Mult`;
    } else if (j.id === 'chip_stacker' && j.picks > 0) {
      scaleNote = `+${(j.scalingSum / j.picks).toFixed(1)} Chips`;
    } else if (j.id === 'hot_hand' && j.picks > 0) {
      scaleNote = `+${(j.scalingSum / j.picks).toFixed(1)} Mult`;
    }
    lines.push(
      `${pad(j.name, 18)} | ${pad(j.rarity.toUpperCase(), 8)} | ${padL('$' + j.cost, 4)} | ${padL(j.offered, 7)} | ${padL(j.bought, 6)} | ${padL(j.picks, 7)} | ${padL(winPct, 8)} | ${padL(avgA, 7)} | ${pad(scaleNote, 18)}`
    );
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
  lines.push(`VOUCHER PERFORMANCE`);
  for (const v of Object.values(voucherStats)) {
    const vWinPct = v.bought > 0 ? ((v.wins / v.bought) * 100).toFixed(1) + '%' : '0.0%';
    lines.push(`  ${pad(v.name, 20)} : Offered ${padL(v.offered, 5)} | Bought ${padL(v.bought, 5)} | Run Win Rate when bought: ${vWinPct}`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Full text for a single-bot run (header + section). */
function buildSingleBotReport(simData: SimData): string {
  const header = [
    `JACK-LATRO v1.7 // MONTE CARLO TELEMETRY REPORT`,
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
    const avgA = (simData.totalFinalAnte / numRuns).toFixed(2);
    const bjWin = ((simData.totalHandsWon / Math.max(1, simData.totalHandsPlayed)) * 100).toFixed(2) + '%';
    summaryRows.push(
      `  ${bType.padEnd(12, ' ')} | Win Rate: ${winPct.padStart(7, ' ')} | Avg Ante: ${avgA.padStart(5, ' ')} | BJ Hand Win%: ${bjWin.padStart(7, ' ')}`
    );
  }

  const masterHeader = [
    `================================================================================`,
    `JACK-LATRO v1.7 // FULL 6-BOT COMPARATIVE TELEMETRY SUITE`,
    `Generated: ${new Date().toISOString()}`,
    `Runs Per Bot: ${numRuns.toLocaleString()} (${(numRuns * BOT_ORDER.length).toLocaleString()} Total Simulated Games)`,
    `Settings: Deals=${cfg.startingDeals}, TargetScale=${cfg.targetScalePct}%, DealCashCap=$${cfg.unusedDealCashCap}, PushRefund=${cfg.pushRefundsDeal}, AnteScale=${cfg.anteHandScaling}`,
    `================================================================================`,
    `HEAD-TO-HEAD BOT SUMMARY:`,
    ...summaryRows,
    `================================================================================\n\n`
  ].join('\n');

  return { reportText: masterHeader + reports.join('\n\n'), expertData, synergyData };
}
