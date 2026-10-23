"use strict";
/* ==========================================================
   deckEngine.ts - CARDS, SHOE & BLACKJACK TOTALS
   Pure card logic. Reads/writes state only through gameState.ts.
   No DOM, no audio, no UI calls.
   Depends on (global): gameState.ts
========================================================== */
const FACE_RANKS = ['J', 'Q', 'K'];
function createStandardDeck() {
    const suits = ['♠', '♥', '♣', '♦'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const s of suits) {
        for (const r of ranks) {
            deck.push({ uid: takeNextCardUid(), suit: s, rank: r, enhancement: null });
        }
    }
    return deck;
}
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
/** Chip value of a card when scored. Pit Boss makes face cards worth 0. */
function getCardChipValue(card, bossBlind = getState().bossBlind) {
    if (bossBlind && bossBlind.id === 'the_pit_boss' && FACE_RANKS.includes(card.rank)) {
        return 5;
    }
    if (FACE_RANKS.includes(card.rank))
        return 10;
    if (card.rank === 'A')
        return 11;
    return parseInt(card.rank, 10);
}
/** allow22As21 = Bust Cushion: bust ceiling becomes 22 and a 22 counts as 21. */
function evaluateBlackjackTotal(hand, allow22As21 = false) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
        if (c.rank === 'A') {
            aces++;
            total += 11;
        }
        else if (FACE_RANKS.includes(c.rank)) {
            total += 10;
        }
        else {
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
function evaluatePlayerHand(hand = getState().playerHand) {
    return evaluateBlackjackTotal(hand, hasJoker('bust_cushion'));
}
/** Fresh shuffled shoe built from copies of the current deck. */
function buildShoeFromDeck() {
    return shuffle(getState().deck.map(c => ({ ...c })));
}
/** Pops the next card, rebuilding the shoe from the deck when empty. */
function drawFromShoe() {
    if (getState().shoe.length === 0) {
        setShoe(buildShoeFromDeck());
        if (typeof patchState === 'function') {
            patchState({ cardsSeenThisBlind: [], runningCount: 0 });
        }
    }
    const card = popShoeCard();
    if (!card)
        throw new Error('drawFromShoe: deck is empty (no cards available to build a shoe).');
    return card;
}
/** Hi-Lo delta for card counting: 2-6: +1, 7-9: 0, 10-A: -1 */
function getHiLoDelta(rank) {
    if (['2', '3', '4', '5', '6'].includes(rank))
        return 1;
    if (['7', '8', '9'].includes(rank))
        return 0;
    if (FACE_RANKS.includes(rank) || rank === '10' || rank === 'A')
        return -1;
    return 0;
}
/** Computes running count from an array of seen cards with ranks */
function calculateRunningCount(cards) {
    let rc = 0;
    for (const c of cards) {
        rc += getHiLoDelta(c.rank);
    }
    return rc;
}
/** Computes absolute shoe advantage: (10s & Aces in shoe) - (2-6s in shoe) */
function calculateShoeCount(shoe) {
    let count = 0;
    for (const c of shoe) {
        if (['2', '3', '4', '5', '6'].includes(c.rank))
            count -= 1;
        else if (FACE_RANKS.includes(c.rank) || c.rank === '10' || c.rank === 'A')
            count += 1;
    }
    return count;
}
/** Base Chips x Mult for every scoring tier. */
const HAND_TIERS = {
    CHARLIE: { chips: 160, mult: 5 },
    NATURAL: { chips: 120, mult: 4 },
    EXACT21: { chips: 85, mult: 3 },
    WIN: { chips: 50, mult: 2 },
    PUSH: { chips: 30, mult: 1 }
};
/**
 * Decides which tier a finished hand falls into. Does NOT apply Joker
 * conversions (Safety Net / Push It Good); modifierEngine does that.
 * hasPushItGood is needed only because The House boss makes ties lose.
 */
function classifyHand(playerHand, dealerHand, allow22As21, bossBlind, hasPushItGood) {
    const pEval = evaluateBlackjackTotal(playerHand, allow22As21);
    const pTotal = pEval.total;
    const dTotal = evaluateBlackjackTotal(dealerHand, false).total;
    const pCount = playerHand.length;
    const dBust = dTotal > 21;
    const pBust = pTotal > 21;
    let outcomeType = 'LOSS';
    let outcomeLabel = 'DEALER WINS';
    if (pBust) {
        outcomeType = 'BUST';
        outcomeLabel = `BUSTED (${pTotal})`;
    }
    else if (pCount >= 5) {
        outcomeType = 'CHARLIE';
        outcomeLabel = '5-CARD CHARLIE!';
    }
    else if (pTotal === 21 && pCount === 2) {
        if (dTotal === 21 && dealerHand.length === 2) {
            outcomeType = 'PUSH';
            outcomeLabel = 'BLACKJACK PUSH';
        }
        else {
            outcomeType = 'NATURAL';
            outcomeLabel = 'NATURAL BLACKJACK!';
        }
    }
    else if (dBust || pTotal > dTotal) {
        if (pTotal === 21) {
            outcomeType = 'EXACT21';
            outcomeLabel = pEval.cushioned ? 'CUSHIONED 21 WIN!' : 'EXACT 21 WIN!';
        }
        else {
            outcomeType = 'WIN';
            outcomeLabel = dBust ? 'DEALER BUSTS! WIN!' : 'BEAT DEALER!';
        }
    }
    else if (pTotal === dTotal) {
        if (bossBlind && bossBlind.id === 'the_house' && !hasPushItGood) {
            outcomeType = 'LOSS';
            outcomeLabel = 'HOUSE WINS TIES';
        }
        else {
            outcomeType = 'PUSH';
            outcomeLabel = 'PUSH (TIE)';
        }
    }
    else {
        outcomeType = 'LOSS';
        outcomeLabel = `DEALER WINS (${dTotal} vs ${pTotal})`;
    }
    const tier = outcomeType in HAND_TIERS ? HAND_TIERS[outcomeType] : null;
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
    window.getHiLoDelta = getHiLoDelta;
    window.calculateRunningCount = calculateRunningCount;
    window.calculateShoeCount = calculateShoeCount;
}
