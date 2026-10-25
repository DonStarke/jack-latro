/* ==========================================================
   deckEngine.ts - CARDS, SHOE & BLACKJACK TOTALS
   Pure card logic. Reads/writes state only through gameState.ts.
   No DOM, no audio, no UI calls.
   Depends on (global): gameState.ts
========================================================== */

interface BlackjackEval {
  total: number;
  isSoft: boolean;
  /** True when Bust Cushion turned a 22 into a valid 21. */
  cushioned: boolean;
}

const FACE_RANKS: ReadonlyArray<Rank> = ['J', 'Q', 'K'];

function createStandardDeck(): Card[] {
  const suits: Suit[] = ['♠', '♥', '♣', '♦'];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({ uid: takeNextCardUid(), suit: s, rank: r, enhancement: null });
    }
  }
  return deck;
}

function createRevoltDeck(): Card[] {
  const suits: Suit[] = ['♠', '♥', '♣', '♦'];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  const deck: Card[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({ uid: takeNextCardUid(), suit: s, rank: r, enhancement: null });
    }
  }
  return deck;
}

const DECK_CATALOG: DeckDef[] = [
  {
    id: 'standard',
    name: 'Standard Deck',
    description: 'Basic standard 52 card deck. Balanced starting layout with all 4 suits and ranks 2 through Ace.',
    cardCount: 52,
    icon: '🃏',
    badge: '52 Cards',
    createDeck: createStandardDeck
  },
  {
    id: 'the_revolt',
    name: 'The Revolt',
    description: 'The royals have been overthrown! No Kings, Queens, or Jacks. Retains all 4 Aces and 4 of each number (2–10).',
    cardCount: 40,
    icon: '⚔️',
    badge: '40 Cards',
    createDeck: createRevoltDeck
  }
];

const DIFFICULTY_CATALOG: DifficultyDef[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    targetScalePct: 50,
    color: '#cd7f32',
    medalIcon: '🥉',
    desc: 'Default score scaling (50%)'
  },
  {
    id: 'silver',
    name: 'Silver',
    targetScalePct: 75,
    color: '#cbd5e1',
    medalIcon: '🥈',
    desc: 'Score scaling of 75%'
  },
  {
    id: 'gold',
    name: 'Gold',
    targetScalePct: 100,
    color: '#fbbf24',
    medalIcon: '🥇',
    desc: 'Score scaling of 100%'
  }
];

function getDeckDef(id: string): DeckDef | undefined {
  return DECK_CATALOG.find(d => d.id === id);
}

function getDifficultyDef(id: DifficultyId): DifficultyDef | undefined {
  return DIFFICULTY_CATALOG.find(d => d.id === id);
}

function shuffle<T>(array: ReadonlyArray<T>): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Chip value of a card when scored. Pit Boss makes face cards worth 0. */
function getCardChipValue(card: Card, bossBlind: BossBlindDef | null = getState().bossBlind): number {
  if (bossBlind && bossBlind.id === 'the_pit_boss' && FACE_RANKS.includes(card.rank)) {
    return 5;
  }
  if (FACE_RANKS.includes(card.rank)) return 10;
  if (card.rank === 'A') return 11;
  return parseInt(card.rank, 10);
}

/** allow22As21 = Bust Cushion: bust ceiling becomes 22 and a 22 counts as 21. */
function evaluateBlackjackTotal(hand: ReadonlyArray<Card>, allow22As21: boolean = false): BlackjackEval {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === 'A') {
      aces++;
      total += 11;
    } else if (FACE_RANKS.includes(c.rank)) {
      total += 10;
    } else {
      total += parseInt(c.rank, 10);
    }
  }
  const bustCeiling = allow22As21 ? 22 : 21;
  while (total > bustCeiling && aces > 0) {
    total -= 10;
    aces--;
  }
  let cushioned = false;
  if (allow22As21 && total === 22) {
    total = 21;
    cushioned = true;
  }
  return { total, isSoft: aces > 0, cushioned };
}

/** Evaluates the live player hand, honoring Bust Cushion if owned. */
function evaluatePlayerHand(hand: ReadonlyArray<Card> = getState().playerHand): BlackjackEval {
  return evaluateBlackjackTotal(hand, hasJoker('bust_cushion'));
}

/** Fresh shuffled shoe built from copies of the current deck. */
function buildShoeFromDeck(): Card[] {
  return shuffle(getState().deck.map(c => ({ ...c })));
}

/** Pops the next card, rebuilding the shoe from the deck when empty. */
function drawFromShoe(): Card {
  if (getState().shoe.length === 0) {
    setShoe(buildShoeFromDeck());
    if (typeof patchState === 'function') {
      patchState({ cardsSeenThisBlind: [], runningCount: 0 });
    }
  }
  const card = popShoeCard();
  if (!card) throw new Error('drawFromShoe: deck is empty (no cards available to build a shoe).');
  return card;
}

/** Hi-Lo delta for card counting: 2-6: +1, 7-9: 0, 10-A: -1 */
function getHiLoDelta(rank: Rank): number {
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['7', '8', '9'].includes(rank)) return 0;
  if (FACE_RANKS.includes(rank) || rank === '10' || rank === 'A') return -1;
  return 0;
}

/** Computes running count from an array of seen cards with ranks */
function calculateRunningCount(cards: ReadonlyArray<{ rank: Rank }>): number {
  let rc = 0;
  for (const c of cards) {
    rc += getHiLoDelta(c.rank);
  }
  return rc;
}

/** Computes absolute shoe advantage: (10s & Aces in shoe) - (2-6s in shoe) */
function calculateShoeCount(shoe: ReadonlyArray<Card>): number {
  let count = 0;
  for (const c of shoe) {
    if (['2', '3', '4', '5', '6'].includes(c.rank)) count -= 1;
    else if (FACE_RANKS.includes(c.rank) || c.rank === '10' || c.rank === 'A') count += 1;
  }
  return count;
}

/* ==========================================================
   HAND TIER CLASSIFICATION (pure, shared by live game + simulator)
========================================================== */
type OutcomeType = 'BUST' | 'CHARLIE' | 'NATURAL' | 'EXACT21' | 'WIN' | 'PUSH' | 'LOSS';

/** Base Chips x Mult for every scoring tier. */
const HAND_TIERS: Readonly<Record<'CHARLIE' | 'NATURAL' | 'EXACT21' | 'WIN' | 'PUSH', { chips: number; mult: number }>> = {
  CHARLIE: { chips: 160, mult: 5 },
  NATURAL: { chips: 120, mult: 4 },
  EXACT21: { chips: 85, mult: 3 },
  WIN: { chips: 50, mult: 2 },
  PUSH: { chips: 30, mult: 1 }
};

interface HandClassification {
  outcomeType: OutcomeType;
  outcomeLabel: string;
  baseChips: number;
  baseMult: number;
  pTotal: number;
  dTotal: number;
  pBust: boolean;
  dBust: boolean;
  cushioned: boolean;
}

/**
 * Decides which tier a finished hand falls into. Does NOT apply Joker
 * conversions (Safety Net / Push It Good); modifierEngine does that.
 * hasPushItGood is needed only because The House boss makes ties lose.
 */
function classifyHand(
  playerHand: ReadonlyArray<Card>,
  dealerHand: ReadonlyArray<Card>,
  allow22As21: boolean,
  bossBlind: BossBlindDef | null,
  hasPushItGood: boolean
): HandClassification {
  const pEval = evaluateBlackjackTotal(playerHand, allow22As21);
  const pTotal = pEval.total;
  const dTotal = evaluateBlackjackTotal(dealerHand, false).total;
  const pCount = playerHand.length;
  const dBust = dTotal > 21;
  const pBust = pTotal > 21;

  let outcomeType: OutcomeType = 'LOSS';
  let outcomeLabel = 'DEALER WINS';

  if (pBust) {
    outcomeType = 'BUST';
    outcomeLabel = `BUSTED (${pTotal})`;
  } else if (pCount >= 5) {
    outcomeType = 'CHARLIE';
    outcomeLabel = '5-CARD CHARLIE!';
  } else if (pTotal === 21 && pCount === 2) {
    if (dTotal === 21 && dealerHand.length === 2) {
      outcomeType = 'PUSH';
      outcomeLabel = 'BLACKJACK PUSH';
    } else {
      outcomeType = 'NATURAL';
      outcomeLabel = 'NATURAL BLACKJACK!';
    }
  } else if (dBust || pTotal > dTotal) {
    if (pTotal === 21) {
      outcomeType = 'EXACT21';
      outcomeLabel = pEval.cushioned ? 'CUSHIONED 21 WIN!' : 'EXACT 21 WIN!';
    } else {
      outcomeType = 'WIN';
      outcomeLabel = dBust ? 'DEALER BUSTS! WIN!' : 'BEAT DEALER!';
    }
  } else if (pTotal === dTotal) {
    if (bossBlind && bossBlind.id === 'the_house' && !hasPushItGood) {
      outcomeType = 'LOSS';
      outcomeLabel = 'HOUSE WINS TIES';
    } else {
      outcomeType = 'PUSH';
      outcomeLabel = 'PUSH (TIE)';
    }
  } else {
    outcomeType = 'LOSS';
    outcomeLabel = `DEALER WINS (${dTotal} vs ${pTotal})`;
  }

  const tier = outcomeType in HAND_TIERS ? HAND_TIERS[outcomeType as keyof typeof HAND_TIERS] : null;
  return {
    outcomeType,
    outcomeLabel,
    baseChips: tier ? tier.chips : 0,
    baseMult: tier ? tier.mult : 0,
    pTotal,
    dTotal,
    pBust,
    dBust,
    cushioned: pEval.cushioned
  };
}

if (typeof window !== 'undefined') {
  (window as any).getHiLoDelta = getHiLoDelta;
  (window as any).calculateRunningCount = calculateRunningCount;
  (window as any).calculateShoeCount = calculateShoeCount;
  (window as any).createStandardDeck = createStandardDeck;
  (window as any).createRevoltDeck = createRevoltDeck;
  (window as any).DECK_CATALOG = DECK_CATALOG;
  (window as any).DIFFICULTY_CATALOG = DIFFICULTY_CATALOG;
  (window as any).getDeckDef = getDeckDef;
  (window as any).getDifficultyDef = getDifficultyDef;
}
