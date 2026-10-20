/* ==========================================================
   modifierEngine.ts - JOKERS, TAROTS, VOUCHERS, BOSSES & SCORING
   Catalog data + the ONE pure scoring function used by both the
   live game and the simulator. It never touches gameState or the
   DOM: callers pass a ScoreContext and apply the returned result.
   Depends on (global): deckEngine.ts (types, classifyHand, tiers)
========================================================== */

/* ---------- Catalogs ---------- */
const JOKER_CATALOG: ReadonlyArray<JokerDef> = [
  { id: 'bust_cushion', name: 'Bust Cushion', cost: 6, rarity: 'uncommon', isXMult: false, icon: '🛟', archetype: 'utility', desc: 'Rubber Table: You only bust on 23+ (a total of 22 is treated as a valid 21!).' },
  { id: 'daredevil', name: 'Daredevil', cost: 6, rarity: 'uncommon', isXMult: false, bonusMult: 0, icon: '⚡', archetype: 'mult', desc: 'Permanently gains +1 Mult on safe Hit on 15+ for the rest of run.' },
  { id: 'chip_stacker', name: 'Chip Stacker', cost: 6, rarity: 'uncommon', isXMult: false, bonusChips: 0, icon: '🪙', archetype: 'chips', desc: 'Permanently gains +10 Chips for the rest of run every time you win with a Double Down or Exact 21.' },
  { id: 'card_counter', name: 'Card Counter', cost: 4, rarity: 'common', isXMult: false, icon: '🧮', archetype: 'chips', desc: '+40 Chips for each low card (2-6) in your hand.' },
  { id: 'vip_high_roller', name: 'VIP High Roller', cost: 5, rarity: 'common', isXMult: false, icon: '👑', archetype: 'mult', desc: '+10 Chips & +5 Mult for each Face Card (J, Q, K) in your hand.' },
  { id: 'ace_up_sleeve', name: 'Ace Up Sleeve', cost: 5, rarity: 'common', isXMult: false, icon: '🪄', archetype: 'chips', desc: '+50 Chips & +5 Mult if your hand contains an Ace.' },
  { id: 'sweet_16', name: 'Sweet Sixteen', cost: 5, rarity: 'uncommon', isXMult: false, icon: '🎂', archetype: 'mult', desc: 'Standing on 16 or less grants +50 Chips & +15 Mult on a Win or Push.' },
  { id: 'lucky_sevens', name: 'Lucky Sevens', cost: 5, rarity: 'common', isXMult: false, icon: '🎰', archetype: 'mult', desc: 'Each 7 in hand grants +77 Chips & +7 Mult. Standing on 17 or 21 grants an extra +7 Mult.' },
  { id: 'hit_me_baby', name: 'Hit Me Baby', cost: 5, rarity: 'common', isXMult: false, icon: '🥊', archetype: 'mult', desc: '+5 Mult for every card in your hand beyond 2.' },
  { id: 'golden_parachute', name: 'Gold Parachute', cost: 4, rarity: 'common', isXMult: false, icon: '🪂', archetype: 'econ', desc: 'Earn +$3 and gain +40 Chips whenever the Dealer busts.' },
  { id: 'push_it_good', name: 'Push It Good', cost: 5, rarity: 'uncommon', isXMult: false, icon: '🤝', archetype: 'utility', desc: 'Ties (Pushes) count as Wins and grant +50 Chips & +4 Mult.' },
  { id: 'blackjack_tycoon', name: 'BJ Tycoon', cost: 8, rarity: 'rare', isXMult: true, icon: '🎩', archetype: 'mult', desc: 'Scoring 21 or Natural BJ applies ×2 Mult and grants +$2.' },
  { id: 'the_shark', name: 'The Shark', cost: 8, rarity: 'rare', isXMult: true, icon: '🦈', archetype: 'mult', desc: '×1.5 Mult if your final total beats the Dealer by 3 or more, or if the Dealer busts.' },
  { id: 'safety_net', name: 'Safety Net', cost: 5, rarity: 'uncommon', isXMult: false, icon: '🕸️', archetype: 'utility', desc: 'Busting still scores a salvage of 40 Chips × 2 Mult (other Jokers and enhancements do not trigger on a bust).' },
  { id: 'even_steven', name: 'Even Steven', cost: 4, rarity: 'common', isXMult: false, icon: '⚖️', archetype: 'chips', desc: '+10 Chips & +4 Mult for each even-numbered card (2,4,6,8,10) in hand.' },
  { id: 'red_velvet', name: 'Red Velvet', cost: 5, rarity: 'common', isXMult: false, icon: '🌹', archetype: 'suit', suitTheme: '♥', desc: '+35 Chips for each ♥ or ♦ in your hand.' },
  { id: 'dark_knight', name: 'Dark Knight', cost: 5, rarity: 'common', isXMult: false, icon: '♞', archetype: 'suit', suitTheme: '♠', desc: '+10 Chips & +3 Mult for each ♠ or ♣ in your hand.' },
  { id: 'compound_edge', name: 'Compound Edge', cost: 6, rarity: 'uncommon', isXMult: false, icon: '📈', archetype: 'chips', desc: '+10 Chips for every $5 you currently hold (max +150 Chips).' },
  { id: 'minimalist', name: 'Minimalist', cost: 7, rarity: 'rare', isXMult: true, icon: '⭕', archetype: 'mult', desc: '×1.8 Mult if you Win with exactly 2 cards.' },
  { id: 'hot_hand', name: 'Hot Hand', cost: 6, rarity: 'uncommon', isXMult: false, bonusMult: 0, icon: '🔥', archetype: 'mult', desc: 'Gains +2 Mult per consecutive winning hand (up to +20 Mult max). Resets to 0 on a loss or bust.' },
  { id: 'snake_eyes', name: 'Snake Eyes', cost: 6, rarity: 'uncommon', isXMult: true, icon: '🎲', archetype: 'mult', desc: '×2.2 Mult if you Win standing on a total of 13 or less.' },
  { id: 'pocket_rockets', name: 'Pocket Rockets', cost: 6, rarity: 'uncommon', isXMult: false, icon: '🚀', archetype: 'mult', desc: '+50 Chips & +25 Mult if your starting 2 cards are both Aces.' },
  { id: 'trips_ahoy', name: 'Trips Ahoy', cost: 5, rarity: 'common', isXMult: false, icon: '⚓', archetype: 'chips', desc: '+100 Chips & +10 Mult if your hand contains three cards of the same rank.' },
  { id: 'spade_slicer', name: 'Spade Slicer', cost: 5, rarity: 'common', isXMult: false, icon: '🗡️', archetype: 'suit', suitTheme: '♠', desc: '+15 Chips & +5 Mult for each ♠ in your hand.' },
  { id: 'crimson_heart', name: 'Crimson Heart', cost: 5, rarity: 'common', isXMult: false, icon: '❤️', archetype: 'suit', suitTheme: '♥', desc: '+40 Chips & +2 Mult for each ♥ in your hand.' },
  { id: 'diamond_cutter', name: 'Diamond Cutter', cost: 5, rarity: 'common', isXMult: false, icon: '💎', archetype: 'suit', suitTheme: '♦', desc: '+30 Chips and earn +$1 for each ♦ in your hand on a Win.' },
  { id: 'club_sandwich', name: 'Club Sandwich', cost: 5, rarity: 'common', isXMult: false, icon: '🥪', archetype: 'suit', suitTheme: '♣', desc: '+6 Mult for each ♣ in your hand on a Win.' },
  { id: 'monochrome', name: 'Monochrome', cost: 6, rarity: 'uncommon', isXMult: true, icon: '🏁', archetype: 'mult', desc: '×1.6 Mult if all cards in your hand share the same suit (minimum 3 cards).' },
  { id: 'odd_ball', name: 'Odd Ball', cost: 4, rarity: 'common', isXMult: false, icon: '🎱', archetype: 'chips', desc: '+15 Chips & +3 Mult for each odd-numbered card (3, 5, 7, 9) in hand.' },
  { id: 'the_grinder', name: 'The Grinder', cost: 4, rarity: 'common', isXMult: false, icon: '⚙️', archetype: 'econ', desc: 'Earn +$1 and +15 Chips for every safe Hit in the round.' },
  { id: 'double_or_nothing', name: 'Double or Nothing', cost: 8, rarity: 'rare', isXMult: true, icon: '💥', archetype: 'mult', desc: 'Doubling Down multiplies Mult by ×3 instead of ×2.' },
  { id: 'slow_and_steady', name: 'Slow & Steady', cost: 5, rarity: 'common', isXMult: false, icon: '🐢', archetype: 'chips', desc: '+20 Chips for each Deal remaining in the current Blind when you Win.' },
  { id: 'card_sharp_joker', name: 'Card Sharp', cost: 8, rarity: 'rare', isXMult: true, icon: '🪒', archetype: 'mult', desc: '×1.75 Mult if you have already won a hand in this Blind.' },
  { id: 'loan_shark', name: 'Loan Shark', cost: 4, rarity: 'common', isXMult: false, icon: '💼', archetype: 'econ', desc: 'Grants +$15 immediately when bought. Costs -$1 at the end of each Blind.' },
  { id: 'deja_vu', name: 'Deja Vu', cost: 8, rarity: 'rare', isXMult: true, icon: '🌀', archetype: 'mult', desc: '×1.5 Mult if your final hand total matches your final total from the previous hand.' }
];

const TAROT_CATALOG: ReadonlyArray<TarotDef> = [
  { id: 'x_ray', name: 'X-Ray Specs', cost: 3, desc: 'Reveal Dealer hole card and gain +75 Chips this hand.' },
  { id: 'loaded_ace', name: 'Loaded Ace', cost: 4, desc: 'Draw a Foil Ace of Spades directly into your hand.' },
  { id: 'card_shave', name: 'Card Shave', cost: 3, desc: 'Reduce your highest non-Ace card rank by 3.' },
  { id: 'midas_touch', name: 'Midas Touch', cost: 3, desc: 'Enhance rightmost card in hand to Gold (+$3 when scored).' },
  { id: 'double_vision', name: 'Double Vision', cost: 3, desc: 'Apply Double Down (×2 Mult) to your active hand without forcing a Stand.' },
  { id: 'polychrome_dice', name: 'Polychrome Dice', cost: 4, desc: 'Enhance leftmost card in hand to Polychrome (×1.5 Mult).' },
  { id: 'the_guillotine', name: 'The Guillotine', cost: 4, desc: 'Permanently destroy the leftmost card in your hand from your deck.' },
  { id: 'card_forge', name: 'Card Forge', cost: 3, desc: 'Increase the rank of your highest non-Ace card by 2.' },
  { id: 'wild_suit', name: 'Prism Dye', cost: 3, desc: 'Enhance leftmost card in hand to Foil (+30 Chips permanently).' },
  { id: 'lucky_charm', name: 'Lucky Charm', cost: 4, desc: 'Enhance rightmost card in hand to Holo (+4 Mult permanently).' }
];

const VOUCHER_CATALOG: ReadonlyArray<VoucherDef> = [
  { id: 'extra_hand', name: 'Extra Cushion', cost: 7, desc: '+1 Max Deal per Blind permanently.' },
  { id: 'table_leverage', name: 'Table Leverage', cost: 6, desc: '+1 Base Mult on all Winning & Push hands permanently.' },
  { id: 'joker_slot', name: 'VIP Lounge Pass', cost: 8, desc: '+1 Max Joker Slot permanently.' },
  { id: 'base_boost', name: 'High Stakes Table', cost: 7, desc: '+30 Base Chips on all Winning & Push hands.' },
  { id: 'deep_pockets', name: 'High Roller Credit', cost: 7, desc: 'Raises interest cap from $5 to $8 (earn interest up to $40).' },
  { id: 'card_sharp', name: 'Precision Edge', cost: 7, desc: '+30 Chips & +2 Mult on all Natural Blackjacks and Exact 21s.' },
  { id: 'clearance_sale', name: 'Clearance Rack', cost: 6, desc: 'Shop rerolls start at $1 permanently.' },
  { id: 'liquidity_pass', name: 'Liquid Assets', cost: 7, desc: 'Earn interest for every $4 held instead of every $5 permanently.' },
  { id: 'card_shark_voucher', name: 'Card Sharp License', cost: 8, desc: '+1 Max Deal and +20 Base Chips on all hands permanently.' },
  { id: 'overstock', name: 'Overstock Shelves', cost: 7, desc: 'Shop offers +1 additional card/item slot permanently.' }
];

const BOSS_BLINDS: ReadonlyArray<BossBlindDef> = [
  { id: 'the_house', name: 'The House', desc: 'Ties (Pushes) go to the Dealer unless you have Push It Good.' },
  { id: 'the_pit_boss', name: 'The Pit Boss', desc: 'Face cards (J, Q, K) contribute half chips (5 chips) when scored.' },
  { id: 'the_cooler', name: 'The Cooler', desc: 'Start this Blind with -1 Deal.' },
  { id: 'the_anchor', name: 'The Anchor', desc: 'Double Down is disabled during this Blind.' }
];

const CARD_EFFECTS_CATALOG: ReadonlyArray<CardEffectDef> = [
  {
    id: 'foil',
    name: 'Foil',
    enhancement: 'foil',
    badge: 'FOIL',
    icon: '✨',
    bonusText: '+30 Chips',
    desc: 'Adds +30 Chips permanently to this card when scored in your final hand.',
    color: '#38bdf8',
    tarotSource: 'Prism Dye Tarot & Booster Packs'
  },
  {
    id: 'holo',
    name: 'Holographic',
    enhancement: 'holo',
    badge: 'HOLO',
    icon: '🌈',
    bonusText: '+4 Mult',
    desc: 'Adds +4 Mult permanently to this card when scored in your final hand.',
    color: '#f87171',
    tarotSource: 'Lucky Charm Tarot & Booster Packs'
  },
  {
    id: 'poly',
    name: 'Polychrome',
    enhancement: 'poly',
    badge: 'POLY',
    icon: '🔮',
    bonusText: '×1.5 Mult',
    desc: 'Multiplies your total hand Mult by ×1.5 permanently when scored in your final hand.',
    color: '#c084fc',
    tarotSource: 'Polychrome Dice Tarot & Booster Packs'
  },
  {
    id: 'gold',
    name: 'Gold',
    enhancement: 'gold',
    badge: 'GOLD',
    icon: '🪙',
    bonusText: '+$3 Cash',
    desc: 'Earns +$3 bonus cash permanently whenever a scoring hand is won with this card.',
    color: '#eab308',
    tarotSource: 'Midas Touch Tarot & Booster Packs'
  }
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
  handsLeft?: number;
  handsWonInBlind?: number;
  previousHandTotal?: number | null;
}

type ScoreStepKind = 'base' | 'card' | 'joker' | 'double';

/** One animatable stage of the score cascade; chips/mult are running totals AFTER the step. */
interface ScoreStep {
  kind: ScoreStepKind;
  chips: number;
  mult: number;
  cardIndex?: number;
  jokerIndex?: number;
  jokerId?: string;
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
    baseChips = 40; baseMult = 2;
    outcomeLabel = 'SAVED BY SAFETY NET!';
    logs.push('Safety Net (40×2 Salvage)');
    safetyNetSaved = true;
  }

  if (outcomeType === 'PUSH' && owns('push_it_good')) {
    outcomeType = 'WIN';
    baseChips += 50; baseMult += 4;
    outcomeLabel = 'PUSH IT GOOD WIN!';
    logs.push('Push It Good (+50c, +4m)');
  }

  const isWin = WIN_TIERS.includes(outcomeType);

  let chipStackerNewBonus: number | null = null;
  const stacker = ctx.jokers.find(j => j.id === 'chip_stacker');
  if (isWin && stacker) {
    let stackerGain = 0;
    const isExact21 = outcomeType === 'EXACT21' || pTotal === 21;
    if (ctx.doubledDown) stackerGain += 10;
    if (isExact21) stackerGain += 10;

    if (stackerGain > 0) {
      chipStackerNewBonus = (stacker.bonusChips || 0) + stackerGain;
      logs.push(`Chip Stacker Scaled (+${stackerGain}c ➔ +${chipStackerNewBonus}c)`);
    }
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
    // On a bust saved by Safety Net, card enhancements do not trigger
    if (!safetyNetSaved) {
      if (c.enhancement === 'foil') { chips += 30; popLabel = `+${cVal + 30}c`; logs.push(`${c.rank}${c.suit} +30c`); }
      if (c.enhancement === 'holo') { mult = round1(mult + 4); popLabel += ' +4m'; logs.push(`${c.rank}${c.suit} +4m`); }
      if (c.enhancement === 'poly') { mult = round1(mult * 1.5); isX = true; popLabel += ' ×1.5m'; logs.push(`${c.rank}${c.suit} ×1.5m`); }
      if (c.enhancement === 'gold') { money += 3; popLabel += ' +$3'; logs.push(`${c.rank}${c.suit} +$3`); }
    }
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

  // Jokers, left to right (if saved by Safety Net, other jokers do NOT trigger on a bust!)
  const hand = ctx.playerHand;
  ctx.jokers.forEach((j, jIdx) => {
    if (safetyNetSaved) {
      return;
    }
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
        // Tie bonus is applied in base scoring on PUSH hands
        break;
      case 'blackjack_tycoon':
        if (pTotal === 21) { mult = round1(mult * 2); money += 2; logs.push('Tycoon ×2m/+$2'); triggered = true; }
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
        const sets = Math.min(15, Math.floor(money / 5));
        if (sets > 0) { chips += sets * 10; logs.push(`Compound +${sets * 10}c`); triggered = true; }
        break;
      }
      case 'minimalist':
        if (isWin && hand.length === 2) { mult = round1(mult * 1.8); logs.push('Minimalist ×1.8m'); triggered = true; }
        break;
      case 'hot_hand': {
        const hm = j.bonusMult || 0;
        if (hm > 0) { mult += hm; logs.push(`Hot Hand +${hm}m`); triggered = true; }
        break;
      }
      case 'snake_eyes':
        if (isWin && pTotal <= 13 && !pBust) { mult = round1(mult * 2.2); logs.push('Snake Eyes ×2.2m'); triggered = true; }
        break;
      case 'pocket_rockets':
        if (hand.length >= 2 && hand[0].rank === 'A' && hand[1].rank === 'A') {
          chips += 50; mult += 25; logs.push('Pocket Rockets +50c/+25m'); triggered = true;
        }
        break;
      case 'trips_ahoy': {
        const counts: Record<string, number> = {};
        hand.forEach(c => { counts[c.rank] = (counts[c.rank] || 0) + 1; });
        if (Object.values(counts).some(cnt => cnt >= 3)) {
          chips += 100; mult += 10; logs.push('Trips Ahoy +100c/+10m'); triggered = true;
        }
        break;
      }
      case 'spade_slicer': {
        const spades = hand.filter(c => c.suit === '♠').length;
        if (spades > 0) { chips += spades * 15; mult += spades * 5; logs.push(`Spades +${spades * 15}c/+${spades * 5}m`); triggered = true; }
        break;
      }
      case 'crimson_heart': {
        const hearts = hand.filter(c => c.suit === '♥').length;
        if (hearts > 0) { chips += hearts * 40; mult += hearts * 2; logs.push(`Hearts +${hearts * 40}c/+${hearts * 2}m`); triggered = true; }
        break;
      }
      case 'diamond_cutter': {
        if (isWin) {
          const diamonds = hand.filter(c => c.suit === '♦').length;
          if (diamonds > 0) { chips += diamonds * 30; money += diamonds; logs.push(`Diamonds +${diamonds * 30}c/+$${diamonds}`); triggered = true; }
        }
        break;
      }
      case 'club_sandwich': {
        if (isWin) {
          const clubs = hand.filter(c => c.suit === '♣').length;
          if (clubs > 0) { mult += clubs * 6; logs.push(`Clubs +${clubs * 6}m`); triggered = true; }
        }
        break;
      }
      case 'monochrome':
        if (hand.length >= 3 && hand.every(c => c.suit === hand[0].suit)) {
          mult = round1(mult * 1.6); logs.push('Monochrome ×1.6m'); triggered = true;
        }
        break;
      case 'odd_ball': {
        const odds = hand.filter(c => ['3', '5', '7', '9'].includes(c.rank)).length;
        if (odds > 0) { chips += odds * 15; mult += odds * 3; logs.push(`Odd +${odds * 15}c/+${odds * 3}m`); triggered = true; }
        break;
      }
      case 'the_grinder':
        if (!pBust && hand.length > 2) {
          const hits = hand.length - 2;
          chips += hits * 15; money += hits; logs.push(`Grinder +${hits * 15}c/+$${hits}`); triggered = true;
        }
        break;
      case 'double_or_nothing':
        // Handled in Double Down resolution below
        break;
      case 'slow_and_steady': {
        const left = ctx.handsLeft || 0;
        if (isWin && left > 0) {
          chips += left * 20; logs.push(`Slow & Steady +${left * 20}c`); triggered = true;
        }
        break;
      }
      case 'card_sharp_joker':
        if ((ctx.handsWonInBlind || 0) > 0) {
          mult = round1(mult * 1.75); logs.push('Card Sharp ×1.75m'); triggered = true;
        }
        break;
      case 'loan_shark':
        // Financial effect handled on purchase and payout
        break;
      case 'deja_vu':
        if (!pBust && ctx.previousHandTotal && ctx.previousHandTotal === pTotal) {
          mult = round1(mult * 1.5); logs.push(`Deja Vu (${pTotal}) ×1.5m`); triggered = true;
        }
        break;
    }
    if (triggered) {
      const isX = j.isXMult || ['the_shark', 'blackjack_tycoon', 'minimalist', 'snake_eyes', 'monochrome', 'card_sharp_joker', 'deja_vu'].includes(j.id);
      const dMult = isX ? (prevMult > 0 ? round1(mult / prevMult) : mult) : round1(mult - prevMult);
      steps.push({
        kind: 'joker',
        jokerId: j.id,
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

  if (ctx.doubledDown && !safetyNetSaved) {
    const hasDoN = owns('double_or_nothing');
    const dblMult = hasDoN ? 3 : 2;
    mult = round1(mult * dblMult);
    const label = hasDoN ? 'Double or Nothing ×3m' : 'Double Down ×2m';
    logs.push(label);
    const donIdx = hasDoN ? ctx.jokers.findIndex(j => j.id === 'double_or_nothing') : undefined;
    steps.push({
      kind: 'double',
      chips: Math.round(chips),
      mult: round1(mult),
      deltaMult: dblMult,
      isXMult: true,
      sourceName: label,
      jokerId: hasDoN ? 'double_or_nothing' : undefined,
      jokerIndex: donIdx !== undefined && donIdx >= 0 ? donIdx : undefined
    });
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
