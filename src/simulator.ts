/* ==========================================================
   simulator.ts - MONTE CARLO TELEMETRY (data + report text only)
   Runs on its OWN throwaway run objects: it never reads or writes the
   live gameState. Scoring, economy, catalogs and vouchers all come from
   the shared engines so the sim cannot drift from the real game.
   No DOM: input reading, buttons, modal and downloads live in main.ts.
   Depends on (global): gameState.ts, deckEngine.ts, modifierEngine.ts, shopEngine.ts
========================================================== */

type BotType = 'vanilla' | 'basic' | 'synergy' | 'highroller' | 'charlie';
type BotAction = 'HIT' | 'STAND' | 'DOUBLE';
type SimConfig = BalanceConfig;

const BOT_ORDER: ReadonlyArray<BotType> = ['vanilla', 'basic', 'synergy', 'highroller', 'charlie'];

interface SimRun {
  ante: number;
  blindIndex: number;
  money: number;
  maxHands: number;
  maxJokers: number;
  baseWinChipBonus: number;
  baseWinMultBonus: number;
  deck: Card[];
  jokers: JokerInstance[];
  vouchers: string[];
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
  anteClearedCounts: number[];
  blindStats: BlindStat[];
  outcomeCounters: OutcomeCounters;
  jokerStats: Record<string, JokerStat>;
  voucherStats: Record<string, VoucherStat>;
}

/* ---------- Bot decision-making ---------- */
function decideBotAction(
  pHand: ReadonlyArray<Card>,
  dUpCard: Card,
  simRun: SimRun,
  botType: BotType,
  bossBlind: BossBlindDef | null
): BotAction {
  const ownsJoker = (id: string): boolean => simRun.jokers.some(j => j.id === id);
  const hasCushion = ownsJoker('bust_cushion');
  const pEval = evaluateBlackjackTotal(pHand, hasCushion);
  const pTotal = pEval.total;
  const isSoft = pEval.isSoft;
  const dUp = evaluateBlackjackTotal([dUpCard], false).total;
  const canDouble = pHand.length === 2 && (!bossBlind || bossBlind.id !== 'the_anchor');

  if (botType === 'synergy' || botType === 'charlie') {
    if (hasCushion && !isSoft && pTotal === 12) {
      return 'HIT';
    }
    if (ownsJoker('daredevil')) {
      if (isSoft && pTotal >= 14 && pTotal <= 17) return 'HIT';
      if ((hasCushion || ownsJoker('safety_net')) && pTotal >= 14 && pTotal <= 15) return 'HIT';
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
  if (joker.id === 'daredevil') score += (joker.bonusMult || 0) * 0.6;
  if (joker.id === 'chip_stacker') score += (joker.bonusChips || 0) * 0.12;

  if (botType === 'highroller' && ['blackjack_tycoon', 'vip_high_roller', 'ace_up_sleeve', 'chip_stacker', 'minimalist', 'the_shark'].includes(joker.id)) score += 6;
  if (botType === 'charlie' && ['bust_cushion', 'daredevil', 'card_counter', 'hit_me_baby', 'sweet_16', 'safety_net'].includes(joker.id)) score += 6;
  if (botType === 'synergy' && ['bust_cushion', 'daredevil', 'chip_stacker', 'the_shark', 'blackjack_tycoon', 'ace_up_sleeve', 'vip_high_roller', 'push_it_good'].includes(joker.id)) score += 5;
  return score;
}

function simulateShopVisit(
  simRun: SimRun,
  botType: BotType,
  jokerStats: Record<string, JokerStat>,
  voucherStats: Record<string, VoucherStat>
): void {
  if (botType === 'vanilla') return;

  const availVouchers = VOUCHER_CATALOG.filter(v => !simRun.vouchers.includes(v.id));
  if (availVouchers.length > 0) {
    const v = availVouchers[Math.floor(Math.random() * availVouchers.length)];
    voucherStats[v.id].offered++;
    if (simRun.money >= v.cost + 2) {
      simRun.money -= v.cost;
      simRun.vouchers.push(v.id);
      voucherStats[v.id].bought++;
      const d = getVoucherDeltas(v.id);
      simRun.maxHands += d.maxHands || 0;
      simRun.baseWinMultBonus += d.baseWinMultBonus || 0;
      simRun.maxJokers += d.maxJokers || 0;
      simRun.baseWinChipBonus += d.baseWinChipBonus || 0;
    }
  }

  const ownedIds = simRun.jokers.map(j => j.id);
  const offers: JokerInstance[] = shuffle(JOKER_CATALOG.filter(j => !ownedIds.includes(j.id))).slice(0, 2);
  offers.forEach(o => { jokerStats[o.id].offered++; });
  offers.sort((a, b) => scoreJokerPriorityForBot(b, botType) - scoreJokerPriorityForBot(a, botType));

  for (const j of offers) {
    if (simRun.money >= j.cost) {
      if (simRun.jokers.length < simRun.maxJokers) {
        simRun.money -= j.cost;
        jokerStats[j.id].bought++;
        simRun.jokers.push({ ...j, bonusMult: 0, bonusChips: 0 });
      } else {
        let weakestIdx = 0;
        let weakestVal = 999;
        simRun.jokers.forEach((owned, idx) => {
          const val = scoreJokerPriorityForBot(owned, botType);
          if (val < weakestVal) { weakestVal = val; weakestIdx = idx; }
        });
        if (scoreJokerPriorityForBot(j, botType) > weakestVal + 2) {
          const sellPrice = getJokerSellValue(simRun.jokers[weakestIdx]);
          simRun.money += sellPrice - j.cost;
          jokerStats[j.id].bought++;
          simRun.jokers[weakestIdx] = { ...j, bonusMult: 0, bonusChips: 0 };
        }
      }
    }
  }

  simRun.jokers.sort((a, b) => (a.isXMult ? 1 : 0) - (b.isXMult ? 1 : 0));

  if (simRun.money >= 9) {
    const enhs: Exclude<Enhancement, null>[] = ['foil', 'holo', 'poly', 'gold'];
    const ranks: Rank[] = botType === 'charlie' ? ['2', '4', '6', '7', 'A'] : ['A', 'K', 'Q', 'J', '10', '7'];
    const suits: Suit[] = ['♠', '♥', '♣', '♦'];
    simRun.money -= 4;
    simRun.deck.push({
      uid: 9999,
      rank: ranks[Math.floor(Math.random() * ranks.length)],
      suit: suits[Math.floor(Math.random() * suits.length)],
      enhancement: enhs[Math.floor(Math.random() * enhs.length)]
    });
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
      id: j.id, name: j.name, cost: j.cost,
      offered: 0, bought: 0, picks: 0, wins: 0, anteSum: 0, scalingSum: 0
    };
  });

  const voucherStats: Record<string, VoucherStat> = {};
  VOUCHER_CATALOG.forEach(v => {
    voucherStats[v.id] = { id: v.id, name: v.name, offered: 0, bought: 0, wins: 0 };
  });

  for (let r = 0; r < numRuns; r++) {
    const simRun: SimRun = {
      ante: 1,
      blindIndex: 0,
      money: STARTING_MONEY,
      maxHands: cfg.startingDeals,
      maxJokers: STARTING_MAX_JOKERS,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      deck: baseDeckTemplate.slice(),
      jokers: [],
      vouchers: []
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
        const hasCushion = simRun.jokers.some(j => j.id === 'bust_cushion');

        while (dealsLeft > 0 && roundScore < targetScore) {
          dealsLeft--;
          dealsUsedThisBlind++;
          totalHandsPlayed++;

          const pHand: Card[] = [draw(), draw()];
          const dHand: Card[] = [draw(), draw()];
          let doubled = false;

          if (evaluateBlackjackTotal(pHand, hasCushion).total < 21) {
            while (true) {
              const act = decideBotAction(pHand, dHand[0], simRun, botType, bossBlind);
              if (act === 'DOUBLE') {
                doubled = true;
                pHand.push(draw());
                break;
              } else if (act === 'HIT') {
                const preHitTotal = evaluateBlackjackTotal(pHand, hasCushion).total;
                pHand.push(draw());
                const postHitTotal = evaluateBlackjackTotal(pHand, hasCushion).total;

                if (preHitTotal >= 14 && postHitTotal <= 21) {
                  for (const j of simRun.jokers) {
                    if (j.id === 'daredevil') {
                      j.bonusMult = (j.bonusMult || 0) + 3;
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

          const res = scoreHand({
            playerHand: pHand,
            dealerHand: dHand,
            jokers: simRun.jokers,
            bossBlind,
            ante: simRun.ante,
            money: simRun.money,
            baseWinChipBonus: simRun.baseWinChipBonus,
            baseWinMultBonus: simRun.baseWinMultBonus,
            tempBonusChips: 0,
            doubledDown: doubled,
            anteHandScaling: cfg.anteHandScaling
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
              if (j.id === 'chip_stacker') j.bonusChips = (j.bonusChips || 0) + 15;
            }
          }
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
          }
        } else {
          bStat.cleared++;
          simRun.money += calcBlindPayout(b, dealsLeft, simRun.money, cfg.unusedDealCashCap).totalEarned;
          bStat.cashAfterSum += simRun.money;

          simulateShopVisit(simRun, botType, jokerStats, voucherStats);
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
      }
      for (const vId of simRun.vouchers) {
        if (voucherStats[vId]) voucherStats[vId].wins++;
      }
    }
  }

  const elapsedMs = Math.round(performance.now() - t0);
  return {
    numRuns, botType, cfg, elapsedMs, wins, totalFinalAnte,
    scalingDeaths, coldShoeDeaths, totalHandsWon, totalHandsPlayed,
    anteClearedCounts, blindStats, outcomeCounters, jokerStats, voucherStats
  };
}

/* ---------- Report text (pure) ---------- */
function formatBotReportSection(simData: SimData): string {
  const {
    numRuns, botType, cfg, elapsedMs, wins, totalFinalAnte,
    scalingDeaths, coldShoeDeaths, totalHandsWon, totalHandsPlayed,
    anteClearedCounts, blindStats, outcomeCounters, jokerStats, voucherStats
  } = simData;

  const botNames: Record<BotType, string> = {
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
  lines.push(`${pad('Joker Name', 18)} | ${padL('Cost', 4)} | ${padL('Offered', 7)} | ${padL('Bought', 6)} | ${padL('EndHeld', 7)} | ${padL('RunWin%', 8)} | ${padL('AvgAnte', 7)} | ${pad('Avg Scaling Bonus', 18)}`);
  lines.push('-'.repeat(96));

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
    }
    lines.push(
      `${pad(j.name, 18)} | ${padL('$' + j.cost, 4)} | ${padL(j.offered, 7)} | ${padL(j.bought, 6)} | ${padL(j.picks, 7)} | ${padL(winPct, 8)} | ${padL(avgA, 7)} | ${pad(scaleNote, 18)}`
    );
  }

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
  /** Synergy bot data, for the on-screen modal. */
  synergyData: SimData | null;
}

/** Runs all 5 bots and assembles the comparative report text. */
function runBotSuite(numRuns: number, cfg: SimConfig): SuiteResult {
  const reports: string[] = [];
  const summaryRows: string[] = [];
  let synergyData: SimData | null = null;

  for (const bType of BOT_ORDER) {
    const simData = runBatchSimulationForBot(numRuns, bType, cfg);
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
    `JACK-LATRO v1.7 // FULL 5-BOT COMPARATIVE TELEMETRY SUITE`,
    `Generated: ${new Date().toISOString()}`,
    `Runs Per Bot: ${numRuns.toLocaleString()} (${(numRuns * 5).toLocaleString()} Total Simulated Games)`,
    `Settings: Deals=${cfg.startingDeals}, TargetScale=${cfg.targetScalePct}%, DealCashCap=$${cfg.unusedDealCashCap}, PushRefund=${cfg.pushRefundsDeal}, AnteScale=${cfg.anteHandScaling}`,
    `================================================================================`,
    `HEAD-TO-HEAD BOT SUMMARY:`,
    ...summaryRows,
    `================================================================================\n\n`
  ].join('\n');

  return { reportText: masterHeader + reports.join('\n\n'), synergyData };
}
