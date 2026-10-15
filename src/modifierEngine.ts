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
  { id: 'daredevil', name: 'Daredevil', cost: 5, isXMult: false, bonusMult: 0, desc: 'Permanently gains +3 Mult for the rest of the run every time you Hit on 14+ without busting.' },
  { id: 'chip_stacker', name: 'Chip Stacker', cost: 5, isXMult: false, bonusChips: 0, desc: 'Permanently gains +15 Chips for the rest of the run every time you win with a Double Down.' },
  { id: 'card_counter', name: 'Card Counter', cost: 4, isXMult: false, desc: '+25 Chips for each low card (2-6) in your hand.' },
  { id: 'vip_high_roller', name: 'VIP High Roller', cost: 5, isXMult: false, desc: '+4 Mult for each Face Card (J, Q, K) in your hand.' },
  { id: 'ace_up_sleeve', name: 'Ace Up Sleeve', cost: 6, isXMult: false, desc: '+40 Chips & +4 Mult if your hand contains an Ace.' },
  { id: 'sweet_16', name: 'Sweet Sixteen', cost: 5, isXMult: false, desc: 'Standing on 16 or less grants +10 Mult.' },
  { id: 'lucky_sevens', name: 'Lucky Sevens', cost: 6, isXMult: false, desc: 'Each 7 in your hand grants +77 Chips & +7 Mult.' },
  { id: 'hit_me_baby', name: 'Hit Me Baby', cost: 5, isXMult: false, desc: '+4 Mult for every card in your hand beyond 2.' },
  { id: 'golden_parachute', name: 'Gold Parachute', cost: 5, isXMult: false, desc: 'Earn +$3 whenever the Dealer busts.' },
  { id: 'push_it_good', name: 'Push It Good', cost: 4, isXMult: false, desc: 'Ties (Pushes) count as Wins and grant +80 Chips & +5 Mult.' },
  { id: 'blackjack_tycoon', name: 'BJ Tycoon', cost: 7, isXMult: true, desc: 'Scoring 21 or Natural BJ applies ×2 Mult and grants +$2.' },
  { id: 'the_shark', name: 'The Shark', cost: 7, isXMult: true, desc: '×1.5 Mult if your final total beats the Dealer by 3 or more.' },
  { id: 'safety_net', name: 'Safety Net', cost: 5, isXMult: false, desc: 'Busting still scores 50 Chips × 2 Mult instead of 0.' },
  { id: 'even_steven', name: 'Even Steven', cost: 4, isXMult: false, desc: '+3 Mult for each even-numbered card (2,4,6,8,10) in hand.' },
  { id: 'red_velvet', name: 'Red Velvet', cost: 5, isXMult: false, desc: '+20 Chips for each ♥ or ♦ in your hand.' },
  { id: 'dark_knight', name: 'Dark Knight', cost: 5, isXMult: false, desc: '+3 Mult for each ♠ or ♣ in your hand.' },
  { id: 'compound_edge', name: 'Compound Edge', cost: 6, isXMult: false, desc: '+20 Chips for every $5 you currently hold.' },
  { id: 'minimalist', name: 'Minimalist', cost: 6, isXMult: true, desc: '×1.75 Mult if you Win with exactly 2 cards.' }
];

const TAROT_CATALOG: ReadonlyArray<TarotDef> = [
  { id: 'x_ray', name: 'X-Ray Specs', cost: 3, desc: 'Reveal Dealer hole card and gain +50 Chips this hand.' },
  { id: 'loaded_ace', name: 'Loaded Ace', cost: 4, desc: 'Draw a Foil Ace of Spades directly into your hand.' },
  { id: 'card_shave', name: 'Card Shave', cost: 3, desc: 'Reduce your highest non-Ace card rank by 3.' },
  { id: 'midas_touch', name: 'Midas Touch', cost: 3, desc: 'Enhance rightmost card in hand to Gold (+$3 when scored).' }
];

const VOUCHER_CATALOG: ReadonlyArray<VoucherDef> = [
  { id: 'extra_hand', name: 'Extra Cushion', cost: 7, desc: '+1 Max Deal per Blind permanently.' },
  { id: 'table_leverage', name: 'Table Leverage', cost: 6, desc: '+1 Base Mult on all Winning & Push hands permanently.' },
  { id: 'joker_slot', name: 'VIP Lounge Pass', cost: 8, desc: '+1 Max Joker Slot permanently.' },
  { id: 'base_boost', name: 'High Stakes Table', cost: 7, desc: '+30 Base Chips on all Winning & Push hands.' }
];

const BOSS_BLINDS: ReadonlyArray<BossBlindDef> = [
  { id: 'the_house', name: 'The House', desc: 'Ties (Pushes) go to the Dealer unless you have Push It Good.' },
  { id: 'the_pit_boss', name: 'The Pit Boss', desc: 'Face cards (J, Q, K) contribute 0 Chips when scored.' },
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
    baseChips += 80; baseMult += 5;
    outcomeLabel = 'PUSH IT GOOD WIN!';
    logs.push('Push It Good (+80c, +5m)');
  }

  const isWin = WIN_TIERS.includes(outcomeType);

  let chipStackerNewBonus: number | null = null;
  const stacker = ctx.jokers.find(j => j.id === 'chip_stacker');
  if (ctx.doubledDown && isWin && stacker) {
    chipStackerNewBonus = (stacker.bonusChips || 0) + 15;
    logs.push(`Chip Stacker Scaled (+15c ➔ +${chipStackerNewBonus}c)`);
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

  let chips = baseChips + ctx.baseWinChipBonus + ctx.tempBonusChips;
  let mult = baseMult + ctx.baseWinMultBonus;
  let money = ctx.money;
  steps.push({ kind: 'base', chips, mult });

  // Cards, left to right
  ctx.playerHand.forEach((c, i) => {
    const cVal = getCardChipValue(c, ctx.bossBlind);
    chips += cVal;
    let popLabel = `+${cVal}c`;
    if (c.enhancement === 'foil') { chips += 30; popLabel = `+${cVal + 30}c`; logs.push(`${c.rank}${c.suit} +30c`); }
    if (c.enhancement === 'holo') { mult += 4; popLabel += ' +4m'; logs.push(`${c.rank}${c.suit} +4m`); }
    if (c.enhancement === 'poly') { mult = round1(mult * 1.5); popLabel += ' ×1.5m'; logs.push(`${c.rank}${c.suit} ×1.5m`); }
    if (c.enhancement === 'gold') { money += 3; popLabel += ' +$3'; logs.push(`${c.rank}${c.suit} +$3`); }
    steps.push({ kind: 'card', cardIndex: i, chips, mult, popLabel });
  });

  // Jokers, left to right
  const hand = ctx.playerHand;
  ctx.jokers.forEach((j, jIdx) => {
    let triggered = false;
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
        if (lows > 0) { chips += lows * 25; logs.push(`Counter +${lows * 25}c`); triggered = true; }
        break;
      }
      case 'vip_high_roller': {
        const faces = hand.filter(c => FACE_RANKS.includes(c.rank)).length;
        if (faces > 0) { mult += faces * 4; logs.push(`VIP +${faces * 4}m`); triggered = true; }
        break;
      }
      case 'ace_up_sleeve':
        if (hand.some(c => c.rank === 'A')) { chips += 40; mult += 4; logs.push('Ace Sleeve +40c/+4m'); triggered = true; }
        break;
      case 'sweet_16':
        if (pTotal <= 16 && !pBust) { mult += 10; logs.push('Sweet 16 +10m'); triggered = true; }
        break;
      case 'lucky_sevens': {
        const sevens = hand.filter(c => c.rank === '7').length;
        if (sevens > 0) { chips += sevens * 77; mult += sevens * 7; logs.push(`7s +${sevens * 77}c/+${sevens * 7}m`); triggered = true; }
        break;
      }
      case 'hit_me_baby': {
        const extra = Math.max(0, hand.length - 2);
        if (extra > 0) { mult += extra * 4; logs.push(`Hit Me +${extra * 4}m`); triggered = true; }
        break;
      }
      case 'golden_parachute':
        if (dBust) { money += 3; logs.push('Parachute +$3'); triggered = true; }
        break;
      case 'blackjack_tycoon':
        if (pTotal === 21) { mult *= 2; money += 2; logs.push('Tycoon ×2m/+$2'); triggered = true; }
        break;
      case 'the_shark':
        if (!pBust && (dBust || (pTotal - dTotal >= 3))) { mult = round1(mult * 1.5); logs.push('Shark ×1.5m'); triggered = true; }
        break;
      case 'even_steven': {
        const evens = hand.filter(c => ['2', '4', '6', '8', '10'].includes(c.rank)).length;
        if (evens > 0) { mult += evens * 3; logs.push(`Even +${evens * 3}m`); triggered = true; }
        break;
      }
      case 'red_velvet': {
        const reds = hand.filter(c => c.suit === '♥' || c.suit === '♦').length;
        if (reds > 0) { chips += reds * 20; logs.push(`Red +${reds * 20}c`); triggered = true; }
        break;
      }
      case 'dark_knight': {
        const blacks = hand.filter(c => c.suit === '♠' || c.suit === '♣').length;
        if (blacks > 0) { mult += blacks * 3; logs.push(`Dark +${blacks * 3}m`); triggered = true; }
        break;
      }
      case 'compound_edge': {
        const sets = Math.floor(money / 5);
        if (sets > 0) { chips += sets * 20; logs.push(`Compound +${sets * 20}c`); triggered = true; }
        break;
      }
      case 'minimalist':
        if (hand.length === 2 && outcomeType !== 'PUSH') { mult = round1(mult * 1.75); logs.push('Minimalist ×1.75m'); triggered = true; }
        break;
    }
    if (triggered) steps.push({ kind: 'joker', jokerIndex: jIdx, chips, mult });
  });

  if (ctx.doubledDown) {
    mult *= 2;
    logs.push('Double Down ×2m');
    steps.push({ kind: 'double', chips, mult });
  }

  result.chips = chips;
  result.mult = mult;
  result.handScore = Math.round(chips * mult);
  result.moneyGained = money - ctx.money;
  return result;
}
