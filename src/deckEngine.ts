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
    return 0;
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
  }
  const card = popShoeCard();
  if (!card) throw new Error('drawFromShoe: deck is empty (no cards available to build a shoe).');
  return card;
}

/* ==========================================================
   HAND TIER CLASSIFICATION (pure, shared by live game + simulator)
========================================================== */
type OutcomeType = 'BUST' | 'CHARLIE' | 'NATURAL' | 'EXACT21' | 'WIN' | 'PUSH' | 'LOSS';

/** Base Chips x Mult for every scoring tier. */
const HAND_TIERS: Readonly<Record<'CHARLIE' | 'NATURAL' | 'EXACT21' | 'WIN' | 'PUSH', { chips: number; mult: number }>> = {
  CHARLIE: { chips: 160, mult: 5 },
  NATURAL: { chips: 120, mult: 4 },
  EXACT21: { chips: 75, mult: 3 },
  WIN: { chips: 40, mult: 2 },
  PUSH: { chips: 25, mult: 1 }
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
