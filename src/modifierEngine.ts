/* ==========================================================
   modifierEngine.ts - JOKERS, TAROTS, VOUCHERS, BOSSES & SCORING
   Catalog data + the ONE pure scoring function used by both the
   live game and the simulator. It never touches gameState or the
   DOM: callers pass a ScoreContext and apply the returned result.
   Depends on (global): deckEngine.ts (types, classifyHand, tiers)
========================================================== */

/* ---------- Catalogs ---------- */
const JOKER_CATALOG: ReadonlyArray<JokerDef> = [
  { id: 'bust_cushion', name: 'Bust Cushion', cost: 6, isXMult: false, desc: 'Rubber Table: You only bust on 23+ (a total of 22 is treated as a valid 21!).' },
  { id: 'daredevil', name: 'Daredevil', cost: 6, isXMult: false, bonusMult: 0, desc: 'Permanently gains +1 Mult on safe Hit on 14+ (+2 Mult on 16+) for the rest of run.' },
  { id: 'chip_stacker', name: 'Chip Stacker', cost: 5, isXMult: false, bonusChips: 0, desc: 'Permanently gains +30 Chips for the rest of run every time you win with a Double Down or Exact 21.' },
  { id: 'card_counter', name: 'Card Counter', cost: 4, isXMult: false, desc: '+40 Chips for each low card (2-6) in your hand.' },
  { id: 'vip_high_roller', name: 'VIP High Roller', cost: 5, isXMult: false, desc: '+10 Chips & +5 Mult for each Face Card (J, Q, K) in your hand.' },
  { id: 'ace_up_sleeve', name: 'Ace Up Sleeve', cost: 6, isXMult: false, desc: '+50 Chips & +5 Mult if your hand contains an Ace.' },
  { id: 'sweet_16', name: 'Sweet Sixteen', cost: 5, isXMult: false, desc: 'Standing on 16 or less grants +50 Chips & +15 Mult on a Win or Push.' },
  { id: 'lucky_sevens', name: 'Lucky Sevens', cost: 5, isXMult: false, desc: 'Each 7 in hand grants +77 Chips & +7 Mult. Standing on 17 or 21 grants an extra +7 Mult.' },
  { id: 'hit_me_baby', name: 'Hit Me Baby', cost: 5, isXMult: false, desc: '+5 Mult for every card in your hand beyond 2.' },
  { id: 'golden_parachute', name: 'Gold Parachute', cost: 4, isXMult: false, desc: 'Earn +$3 and gain +40 Chips whenever the Dealer busts.' },
  { id: 'push_it_good', name: 'Push It Good', cost: 4, isXMult: false, desc: '+30 Chips on all scoring hands. Ties (Pushes) count as Wins and grant +100 Chips & +6 Mult.' },
  { id: 'blackjack_tycoon', name: 'BJ Tycoon', cost: 7, isXMult: true, desc: 'Scoring 21 or Natural BJ applies ×2 Mult and grants +$2.' },
  { id: 'the_shark', name: 'The Shark', cost: 7, isXMult: true, desc: '×1.5 Mult if your final total beats the Dealer by 3 or more, or if the Dealer busts.' },
  { id: 'safety_net', name: 'Safety Net', cost: 5, isXMult: false, desc: 'Busting still scores 50 Chips × 2 Mult instead of 0.' },
  { id: 'even_steven', name: 'Even Steven', cost: 4, isXMult: false, desc: '+10 Chips & +4 Mult for each even-numbered card (2,4,6,8,10) in hand.' },
  { id: 'red_velvet', name: 'Red Velvet', cost: 5, isXMult: false, desc: '+35 Chips for each ♥ or ♦ in your hand.' },
  { id: 'dark_knight', name: 'Dark Knight', cost: 5, isXMult: false, desc: '+10 Chips & +3 Mult for each ♠ or ♣ in your hand.' },
  { id: 'compound_edge', name: 'Compound Edge', cost: 6, isXMult: false, desc: '+20 Chips for every $5 you currently hold.' },
  { id: 'minimalist', name: 'Minimalist', cost: 6, isXMult: true, desc: '×1.8 Mult if you Win with exactly 2 cards.' }
];

const TAROT_CATALOG: ReadonlyArray<TarotDef> = [
  { id: 'x_ray', name: 'X-Ray Specs', cost: 3, desc: 'Reveal Dealer hole card and gain +75 Chips this hand.' },
  { id: 'loaded_ace', name: 'Loaded Ace', cost: 4, desc: 'Draw a Foil Ace of Spades directly into your hand.' },
  { id: 'card_shave', name: 'Card Shave', cost: 3, desc: 'Reduce your highest non-Ace card rank by 3.' },
  { id: 'midas_touch', name: 'Midas Touch', cost: 3, desc: 'Enhance rightmost card in hand to Gold (+$3 when scored).' },
  { id: 'double_vision', name: 'Double Vision', cost: 3, desc: 'Apply Double Down (×2 Mult) to your active hand without forcing a Stand.' },
  { id: 'polychrome_dice', name: 'Polychrome Dice', cost: 4, desc: 'Enhance leftmost card in hand to Polychrome (×1.5 Mult).' }
];

const VOUCHER_CATALOG: ReadonlyArray<VoucherDef> = [
  { id: 'extra_hand', name: 'Extra Cushion', cost: 7, desc: '+1 Max Deal per Blind permanently.' },
  { id: 'table_leverage', name: 'Table Leverage', cost: 6, desc: '+1 Base Mult on all Winning & Push hands permanently.' },
  { id: 'joker_slot', name: 'VIP Lounge Pass', cost: 8, desc: '+1 Max Joker Slot permanently.' },
  { id: 'base_boost', name: 'High Stakes Table', cost: 7, desc: '+30 Base Chips on all Winning & Push hands.' },
  { id: 'deep_pockets', name: 'High Roller Credit', cost: 7, desc: 'Raises interest cap from $5 to $8 (earn interest up to $40).' },
  { id: 'card_sharp', name: 'Precision Edge', cost: 7, desc: '+30 Chips & +2 Mult on all Natural Blackjacks and Exact 21s.' }
];

const BOSS_BLINDS: ReadonlyArray<BossBlindDef> = [
  { id: 'the_house', name: 'The House', desc: 'Ties (Pushes) go to the Dealer unless you have Push It Good.' },
  { id: 'the_pit_boss', name: 'The Pit Boss', desc: 'Face cards (J, Q, K) contribute half chips (5 chips) when scored.' },
  { id: 'the_cooler', name: 'The Cooler', desc: 'Start this Blind with -1 Deal.' },
  { id: 'the_anchor', name: 'The Anchor', desc: 'Double Down is disabled during this Blind.' }
];

/* ---------- Scoring ---------- */
interface ScoreContext {
  playerHand: ReadonlyArray<Card>;
  dealerHand: ReadonlyArray<Card>;
  jokers: ReadonlyArray<JokerInstance>;
  bossBlind: BossBlindDef | null;
  ante: number;
  /** Cash held when the hand resolves (Compound Edge reads it). */
  money: number;
  baseWinChipBonus: number;
  baseWinMultBonus: number;
  tempBonusChips: number;
  doubledDown: boolean;
  anteHandScaling: boolean;
  vouchers?: ReadonlyArray<string>;
}

type ScoreStepKind = 'base' | 'card' | 'joker' | 'double';

/** One animatable stage of the score cascade; chips/mult are running totals AFTER the step. */
interface ScoreStep {
  kind: ScoreStepKind;
  chips: number;
  mult: number;
  cardIndex?: number;
  jokerIndex?: number;
  popLabel?: string;
  deltaChips?: number;
  deltaMult?: number;
  isXMult?: boolean;
  deltaMoney?: number;
  sourceName?: string;
}

interface ScoreResult {
  /** Tier BEFORE Safety Net / Push It Good conversions (what telemetry counts). */
  rawOutcomeType: OutcomeType;
  /** Tier after conversions (Push It Good turns PUSH into WIN). */
  outcomeType: OutcomeType;
  outcomeLabel: string;
  isScoring: boolean;
  isWin: boolean;
  pTotal: number;
  dTotal: number;
  pBust: boolean;
  dBust: boolean;
  cushioned: boolean;
  safetyNetSaved: boolean;
  steps: ScoreStep[];
  logs: string[];
  chips: number;
  mult: number;
  handScore: number;
  /** Cash earned during scoring (Gold cards, Gold Parachute, BJ Tycoon). */
  moneyGained: number;
  /** If set, caller must set Chip Stacker's bonusChips to this value. */
  chipStackerNewBonus: number | null;
}

const WIN_TIERS: ReadonlyArray<OutcomeType> = ['CHARLIE', 'NATURAL', 'EXACT21', 'WIN'];

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function scoreHand(ctx: ScoreContext): ScoreResult {
  const owns = (id: string): boolean => ctx.jokers.some(j => j.id === id);
  const cls = classifyHand(ctx.playerHand, ctx.dealerHand, owns('bust_cushion'), ctx.bossBlind, owns('push_it_good'));
  const { pTotal, dTotal, pBust, dBust } = cls;

  const rawOutcomeType = cls.outcomeType;
  let outcomeType = cls.outcomeType;
  let outcomeLabel = cls.outcomeLabel;
  let baseChips = cls.baseChips;
  let baseMult = cls.baseMult;
  const logs: string[] = [];
  const steps: ScoreStep[] = [];

  if (cls.cushioned) logs.push('Bust Cushion (22➔21!)');

  let isScoring = rawOutcomeType !== 'BUST' && rawOutcomeType !== 'LOSS';
  let safetyNetSaved = false;

  if (outcomeType === 'BUST' && owns('safety_net')) {
    isScoring = true;
    baseChips = 50; baseMult = 2;
    outcomeLabel = 'SAVED BY SAFETY NET!';
    logs.push('Safety Net (50×2)');
    safetyNetSaved = true;
  }

  if (outcomeType === 'PUSH' && owns('push_it_good')) {
    outcomeType = 'WIN';
    baseChips += 100; baseMult += 6;
    outcomeLabel = 'PUSH IT GOOD WIN!';
    logs.push('Push It Good (+100c, +6m)');
  }

  const isWin = WIN_TIERS.includes(outcomeType);

  let chipStackerNewBonus: number | null = null;
  const stacker = ctx.jokers.find(j => j.id === 'chip_stacker');
  if ((ctx.doubledDown || outcomeType === 'EXACT21') && isWin && stacker) {
    chipStackerNewBonus = (stacker.bonusChips || 0) + 30;
    logs.push(`Chip Stacker Scaled (+30c ➔ +${chipStackerNewBonus}c)`);
  }

  const result: ScoreResult = {
    rawOutcomeType, outcomeType, outcomeLabel, isScoring, isWin,
    pTotal, dTotal, pBust, dBust, cushioned: cls.cushioned, safetyNetSaved,
    steps, logs, chips: 0, mult: 0, handScore: 0, moneyGained: 0, chipStackerNewBonus
  };
  if (!isScoring) return result;

  if (ctx.anteHandScaling && ctx.ante > 1) {
    const f = 1 + (ctx.ante - 1) * 0.15;
    baseChips = Math.round(baseChips * f);
    baseMult = round1(baseMult * f);
  }

  let chips = Math.round(baseChips + ctx.baseWinChipBonus + ctx.tempBonusChips);
  let mult = round1(baseMult + ctx.baseWinMultBonus);
  let money = ctx.money;

  // Precision Edge voucher bonus on Natural & Exact 21
  if (ctx.vouchers && ctx.vouchers.includes('card_sharp') && (outcomeType === 'NATURAL' || outcomeType === 'EXACT21')) {
    chips += 30;
    mult = round1(mult + 2);
    logs.push('Precision Edge (+30c, +2m)');
  }

  steps.push({ kind: 'base', chips, mult, deltaChips: chips, deltaMult: mult, sourceName: outcomeLabel });

  // Cards, left to right
  ctx.playerHand.forEach((c, i) => {
    const prevChips = chips;
    const prevMult = mult;
    const prevMoney = money;
    const cVal = getCardChipValue(c, ctx.bossBlind);
    chips += cVal;
    let popLabel = `+${cVal}c`;
    let isX = false;
    if (c.enhancement === 'foil') { chips += 30; popLabel = `+${cVal + 30}c`; logs.push(`${c.rank}${c.suit} +30c`); }
    if (c.enhancement === 'holo') { mult = round1(mult + 4); popLabel += ' +4m'; logs.push(`${c.rank}${c.suit} +4m`); }
    if (c.enhancement === 'poly') { mult = round1(mult * 1.5); isX = true; popLabel += ' ×1.5m'; logs.push(`${c.rank}${c.suit} ×1.5m`); }
    if (c.enhancement === 'gold') { money += 3; popLabel += ' +$3'; logs.push(`${c.rank}${c.suit} +$3`); }
    steps.push({
      kind: 'card',
      cardIndex: i,
      chips: Math.round(chips),
      mult: round1(mult),
      popLabel,
      deltaChips: Math.round(chips - prevChips),
      deltaMult: isX ? 1.5 : round1(mult - prevMult),
      isXMult: isX,
      deltaMoney: money - prevMoney,
      sourceName: `${c.rank}${c.suit}`
    });
  });

  // Jokers, left to right
  const hand = ctx.playerHand;
  ctx.jokers.forEach((j, jIdx) => {
    let triggered = false;
    const prevChips = chips;
    const prevMult = mult;
    const prevMoney = money;
    switch (j.id) {
      case 'daredevil': {
        const bm = j.bonusMult || 0;
        if (bm > 0) { mult += bm; logs.push(`Daredevil +${bm}m`); triggered = true; }
        break;
      }
      case 'chip_stacker': {
        const bc = chipStackerNewBonus !== null ? chipStackerNewBonus : (j.bonusChips || 0);
        if (bc > 0) { chips += bc; logs.push(`Chip Stacker +${bc}c`); triggered = true; }
        break;
      }
      case 'card_counter': {
        const lows = hand.filter(c => ['2', '3', '4', '5', '6'].includes(c.rank)).length;
        if (lows > 0) { chips += lows * 40; logs.push(`Counter +${lows * 40}c`); triggered = true; }
        break;
      }
      case 'vip_high_roller': {
        const faces = hand.filter(c => FACE_RANKS.includes(c.rank)).length;
        if (faces > 0) { mult += faces * 5; chips += faces * 10; logs.push(`VIP +${faces * 10}c/+${faces * 5}m`); triggered = true; }
        break;
      }
      case 'ace_up_sleeve':
        if (hand.some(c => c.rank === 'A')) { chips += 50; mult += 5; logs.push('Ace Sleeve +50c/+5m'); triggered = true; }
        break;
      case 'sweet_16':
        if (pTotal <= 16 && !pBust && (isWin || outcomeType === 'PUSH')) { chips += 50; mult += 15; logs.push('Sweet 16 +50c/+15m'); triggered = true; }
        break;
      case 'lucky_sevens': {
        const sevens = hand.filter(c => c.rank === '7').length;
        if (sevens > 0) { chips += sevens * 77; mult += sevens * 7; logs.push(`7s +${sevens * 77}c/+${sevens * 7}m`); triggered = true; }
        if (pTotal === 17 || pTotal === 21) { mult += 7; logs.push('Lucky Total +7m'); triggered = true; }
        break;
      }
      case 'hit_me_baby': {
        const extra = Math.max(0, hand.length - 2);
        if (extra > 0) { mult += extra * 5; logs.push(`Hit Me +${extra * 5}m`); triggered = true; }
        break;
      }
      case 'golden_parachute':
        if (dBust) { money += 3; chips += 40; logs.push('Parachute +40c/+$3'); triggered = true; }
        break;
      case 'push_it_good':
        chips += 30; logs.push('Push It Good +30c'); triggered = true;
        break;
      case 'blackjack_tycoon':
        if (pTotal === 21) { mult *= 2; money += 2; logs.push('Tycoon ×2m/+$2'); triggered = true; }
        break;
      case 'the_shark':
        if (!pBust && (dBust || (pTotal - dTotal >= 3))) { mult = round1(mult * 1.5); logs.push('Shark ×1.5m'); triggered = true; }
        break;
      case 'even_steven': {
        const evens = hand.filter(c => ['2', '4', '6', '8', '10'].includes(c.rank)).length;
        if (evens > 0) { mult += evens * 4; chips += evens * 10; logs.push(`Even +${evens * 10}c/+${evens * 4}m`); triggered = true; }
        break;
      }
      case 'red_velvet': {
        const reds = hand.filter(c => c.suit === '♥' || c.suit === '♦').length;
        if (reds > 0) { chips += reds * 35; logs.push(`Red +${reds * 35}c`); triggered = true; }
        break;
      }
      case 'dark_knight': {
        const blacks = hand.filter(c => c.suit === '♠' || c.suit === '♣').length;
        if (blacks > 0) { mult += blacks * 3; chips += blacks * 10; logs.push(`Dark +${blacks * 10}c/+${blacks * 3}m`); triggered = true; }
        break;
      }
      case 'compound_edge': {
        const sets = Math.floor(money / 5);
        if (sets > 0) { chips += sets * 20; logs.push(`Compound +${sets * 20}c`); triggered = true; }
        break;
      }
      case 'minimalist':
        if (hand.length === 2 && outcomeType !== 'PUSH') { mult = round1(mult * 1.8); logs.push('Minimalist ×1.8m'); triggered = true; }
        break;
    }
    if (triggered) {
      const isX = j.isXMult || ['the_shark', 'blackjack_tycoon', 'minimalist'].includes(j.id);
      const dMult = isX ? (prevMult > 0 ? round1(mult / prevMult) : mult) : round1(mult - prevMult);
      steps.push({
        kind: 'joker',
        jokerIndex: jIdx,
        chips: Math.round(chips),
        mult: round1(mult),
        deltaChips: Math.round(chips - prevChips),
        deltaMult: dMult,
        isXMult: isX,
        deltaMoney: money - prevMoney,
        sourceName: j.name
      });
    }
  });

  if (ctx.doubledDown) {
    mult = round1(mult * 2);
    logs.push('Double Down ×2m');
    steps.push({ kind: 'double', chips: Math.round(chips), mult: round1(mult), deltaMult: 2, isXMult: true, sourceName: 'Double Down' });
  }

  result.chips = Math.round(chips);
  result.mult = round1(mult);
  result.handScore = Math.round(chips * mult);
  result.moneyGained = money - ctx.money;
  return result;
}

if (typeof window !== 'undefined') {
  (window as any).JOKER_CATALOG = JOKER_CATALOG;
  (window as any).TAROT_CATALOG = TAROT_CATALOG;
  (window as any).VOUCHER_CATALOG = VOUCHER_CATALOG;
  (window as any).BOSS_BLINDS = BOSS_BLINDS;
}
