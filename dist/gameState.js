"use strict";
/* ==========================================================
   gameState.ts - SINGLE SOURCE OF TRUTH
   All mutable game state lives here. Other modules must use the
   exported functions below; they must never hold their own copies
   of score, hands, cash, interest-related values or jokers.
   Compiled as a plain global script (no import/export).
========================================================== */
/** Run-start constants (shared with the simulator so it can't drift from the live game). */
const STARTING_MONEY = 6;
const STARTING_MAX_JOKERS = 5;
/* ---------- Private state (not reachable outside the API) ---------- */
const DEFAULT_BALANCE_CONFIG = {
    startingDeals: 7,
    targetScalePct: 50,
    unusedDealCashCap: 0,
    pushRefundsDeal: true,
    anteHandScaling: true,
    maxEndlessAnte: 16,
    startingMoney: 6,
    maxJokers: 5
};
let _balanceConfig = { ...DEFAULT_BALANCE_CONFIG };
let _nextCardUid = 1;
function createInitialRunStats() {
    return {
        handsPlayed: 0,
        handsWon: 0,
        handsLost: 0,
        handsPushed: 0,
        highestHandScore: 0,
        totalScore: 0,
        doubleDownAttempts: 0,
        doubleDownWins: 0,
        cardsDrawn: 0,
        tarotsUsed: 0,
        vouchersBoughtCount: 0,
        outcomes: {
            CHARLIE: { label: '5-Card Charlie', won: 0, lost: 0, push: 0 },
            NATURAL: { label: 'Natural Blackjack', won: 0, lost: 0, push: 0 },
            EXACT21: { label: 'Exact 21', won: 0, lost: 0, push: 0 },
            CUSHIONED: { label: 'Cushioned 21 (Rubber Table)', won: 0, lost: 0, push: 0 },
            WIN: { label: 'Standard Win (Beat Dealer)', won: 0, lost: 0, push: 0 },
            DEALER_BUST: { label: 'Dealer Bust', won: 0, lost: 0, push: 0 },
            PUSH: { label: 'Push (Tie)', won: 0, lost: 0, push: 0 },
            PUSH_IT_GOOD: { label: 'Push It Good Win', won: 0, lost: 0, push: 0 },
            SAFETY_NET: { label: 'Safety Net Salvage', won: 0, lost: 0, push: 0 },
            BUST: { label: 'Player Bust', won: 0, lost: 0, push: 0 },
            LOSS: { label: 'Dealer Wins (Outscored)', won: 0, lost: 0, push: 0 }
        },
        moneyEarned: {
            blinds: 0,
            unusedDeals: 0,
            interest: 0,
            inHandScoring: 0,
            sales: 0,
            loanShark: 0,
            total: 0
        },
        moneySpent: {
            jokers: 0,
            tarots: 0,
            cards: 0,
            vouchers: 0,
            rerolls: 0,
            loanSharkFees: 0,
            total: 0
        },
        jokerTriggers: {}
    };
}
let _state = {
    ante: 1,
    blindIndex: 0,
    bossBlind: null,
    targetScore: 300,
    roundScore: 0,
    money: 6,
    maxHands: 7,
    handsLeft: 7,
    maxJokers: 5,
    maxConsumables: 2,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    deck: [],
    shoe: [],
    playerHand: [],
    dealerHand: [],
    dealerHoleRevealed: false,
    inHand: false,
    isDealing: false,
    blindClearedReady: false,
    blindFailedReady: false,
    pendingPayout: null,
    inShop: false,
    doubledDown: false,
    tempBonusChips: 0,
    endlessMode: false,
    handsWonInBlind: 0,
    previousHandTotal: null,
    roundCashEarned: 0,
    cardsSeenThisBlind: [],
    runningCount: 0,
    jokers: [],
    consumables: [],
    vouchersBought: [],
    rerollCost: 2,
    shopJokers: [],
    shopExtras: [],
    shopPacks: [],
    activePackOpening: null,
    voucherAnte: 0,
    currentAnteVoucher: null,
    lastTarotUsedId: null,
    lastTarotUsedName: null,
    runStats: createInitialRunStats()
};
/* ---------- Read API ---------- */
/** Read-only view of the whole state. Never mutate the returned object. */
function getState() {
    return _state;
}
function getBalanceConfig() {
    return _balanceConfig;
}
function hasJoker(id) {
    return _state.jokers.some(j => j.id === id);
}
/* ---------- Write API ---------- */
/** Shallow-patch scalar/flag fields (score, flags, targets, bonuses...). */
function patchState(patch) {
    Object.assign(_state, patch);
}
function patchBalanceConfig(patch) {
    Object.assign(_balanceConfig, patch);
}
function addMoney(amount) {
    _state.money += amount;
}
/** Returns false (and changes nothing) if the player cannot afford it. */
function spendMoney(amount) {
    if (_state.money < amount)
        return false;
    _state.money -= amount;
    return true;
}
function addRoundScore(amount) {
    _state.roundScore += amount;
}
/* Card uid + deck/shoe/hand zones */
function takeNextCardUid() {
    return _nextCardUid++;
}
function resetCardUid() {
    _nextCardUid = 1;
}
function setDeck(deck) { _state.deck = deck; }
function setShoe(shoe) { _state.shoe = shoe; }
function popShoeCard() { return _state.shoe.pop(); }
function setPlayerHand(hand) { _state.playerHand = hand; }
function setDealerHand(hand) { _state.dealerHand = hand; }
function addCardToDeck(card) { _state.deck.push(card); }
function addCardToPlayerHand(card) { _state.playerHand.push(card); }
function addCardToDealerHand(card) { _state.dealerHand.push(card); }
function setCardEnhancement(card, enhancement) {
    card.enhancement = enhancement;
    const deckCard = _state.deck.find(c => c.uid === card.uid);
    if (deckCard) {
        deckCard.enhancement = enhancement;
    }
    const shoeCard = _state.shoe.find(c => c.uid === card.uid);
    if (shoeCard) {
        shoeCard.enhancement = enhancement;
    }
}
function setCardRank(card, rank) {
    card.rank = rank;
    const deckCard = _state.deck.find(c => c.uid === card.uid);
    if (deckCard) {
        deckCard.rank = rank;
    }
    const shoeCard = _state.shoe.find(c => c.uid === card.uid);
    if (shoeCard) {
        shoeCard.rank = rank;
    }
}
function setCardSuit(card, suit) {
    card.suit = suit;
    const deckCard = _state.deck.find(c => c.uid === card.uid);
    if (deckCard) {
        deckCard.suit = suit;
    }
    const shoeCard = _state.shoe.find(c => c.uid === card.uid);
    if (shoeCard) {
        shoeCard.suit = suit;
    }
}
function addCardToShoe(card) { _state.shoe.push(card); }
function removeCardFromGame(uid) {
    _state.deck = _state.deck.filter(c => c.uid !== uid);
    _state.shoe = _state.shoe.filter(c => c.uid !== uid);
    _state.playerHand = _state.playerHand.filter(c => c.uid !== uid);
}
function markShopItemBought(listName, idx) {
    const item = _state[listName][idx];
    if (item)
        item.bought = true;
}
/* Jokers */
function addJoker(joker) {
    if (_state.jokers.length >= _state.maxJokers)
        return false;
    _state.jokers.push(joker);
    return true;
}
function removeJokerAt(index) {
    if (index < 0 || index >= _state.jokers.length)
        return null;
    return _state.jokers.splice(index, 1)[0];
}
/** dir: -1 = left, +1 = right. */
function moveJokerAt(index, dir) {
    const target = index + dir;
    if (index < 0 || index >= _state.jokers.length)
        return;
    if (target < 0 || target >= _state.jokers.length)
        return;
    const tmp = _state.jokers[index];
    _state.jokers[index] = _state.jokers[target];
    _state.jokers[target] = tmp;
}
/** For scaling jokers (Daredevil / Chip Stacker). */
function patchJoker(id, patch) {
    for (const j of _state.jokers) {
        if (j.id === id)
            Object.assign(j, patch);
    }
}
/* Consumables, vouchers, shop */
function addConsumable(item) {
    if (_state.consumables.length >= _state.maxConsumables)
        return false;
    _state.consumables.push(item);
    return true;
}
function removeConsumableAt(index) {
    if (index < 0 || index >= _state.consumables.length)
        return null;
    return _state.consumables.splice(index, 1)[0];
}
function addVoucher(id) {
    if (!_state.vouchersBought.includes(id))
        _state.vouchersBought.push(id);
}
function markShopPackBought(idx) {
    const item = _state.shopPacks[idx];
    if (item)
        item.bought = true;
}
function setShopStock(jokers, extras, packs = []) {
    _state.shopJokers = jokers;
    _state.shopExtras = extras;
    _state.shopPacks = packs;
}
/* ---------- Run Statistics & Telemetry Helpers ---------- */
function getRunStats() {
    return _state.runStats;
}
function recordHandOutcomeStats(categoryKey, resultType, handScore, cardsCount, isDouble) {
    const stats = _state.runStats;
    stats.handsPlayed++;
    stats.totalScore += handScore;
    if (handScore > stats.highestHandScore) {
        stats.highestHandScore = handScore;
    }
    stats.cardsDrawn += cardsCount;
    if (isDouble) {
        stats.doubleDownAttempts++;
        if (resultType === 'won') {
            stats.doubleDownWins++;
        }
    }
    if (resultType === 'won')
        stats.handsWon++;
    else if (resultType === 'push')
        stats.handsPushed++;
    else
        stats.handsLost++;
    if (stats.outcomes[categoryKey]) {
        stats.outcomes[categoryKey][resultType]++;
    }
}
function recordJokerTrigger(id, name) {
    const stats = _state.runStats;
    if (!stats.jokerTriggers[id]) {
        let resolvedName = name;
        if (!resolvedName && typeof JOKER_CATALOG !== 'undefined') {
            const found = JOKER_CATALOG.find(j => j.id === id);
            if (found)
                resolvedName = found.name;
        }
        stats.jokerTriggers[id] = { id, name: resolvedName || id, count: 0 };
    }
    stats.jokerTriggers[id].count++;
}
function recordMoneyEarned(category, amount) {
    if (amount <= 0 || category === 'total')
        return;
    _state.runStats.moneyEarned[category] += amount;
    _state.runStats.moneyEarned.total += amount;
}
function recordMoneySpent(category, amount) {
    if (amount <= 0 || category === 'total')
        return;
    _state.runStats.moneySpent[category] += amount;
    _state.runStats.moneySpent.total += amount;
}
const GAME_VERSION = 'V0.12';
const CURRENT_TELEMETRY_SCHEMA_VERSION = 1;
const TELEMETRY_STORAGE_KEY = 'jacklatro_library_telemetry';
const TELEMETRY_BACKUP_KEY = 'jacklatro_library_telemetry_backup';
const TELEMETRY_CORRUPT_ARCHIVE_KEY = 'jacklatro_library_telemetry_corrupted_raw';
/* ---------- Safe Default Factory Templates ---------- */
function createDefaultJokerTelemetry() {
    return {
        discovered: 0,
        roundsHeld: 0,
        roundsWon: 0,
        handsTriggered: 0,
        chipsContributed: 0,
        multContributed: 0
    };
}
function createDefaultTarotTelemetry() {
    return {
        discovered: 0,
        acquired: 0,
        cast: 0,
        castWon: 0,
        sold: 0
    };
}
function createDefaultVoucherTelemetry() {
    return {
        discovered: 0,
        redeemed: 0,
        earliestAnte: null,
        runsWon: 0,
        estValue: 0
    };
}
function createDefaultEffectTelemetry() {
    return {
        enhanced: 0,
        timesScored: 0,
        bonusImpact: 0,
        deckSaturationPeak: 0
    };
}
function createDefaultPackTelemetry() {
    return {
        discovered: 0,
        opened: 0,
        drafted: 0,
        skipped: 0,
        moneyInvested: 0
    };
}
function createDefaultTelemetryStore() {
    return {
        schemaVersion: CURRENT_TELEMETRY_SCHEMA_VERSION,
        lastUpdated: Date.now(),
        jokers: {},
        tarots: {},
        vouchers: {},
        effects: {},
        packs: {}
    };
}
function sanitizeNumber(val, fallback = 0) {
    if (typeof val === 'number' && Number.isFinite(val)) {
        return val;
    }
    return fallback;
}
function sanitizeJokerData(raw) {
    const d = createDefaultJokerTelemetry();
    if (!raw || typeof raw !== 'object')
        return d;
    return {
        discovered: sanitizeNumber(raw.discovered, d.discovered),
        roundsHeld: sanitizeNumber(raw.roundsHeld, d.roundsHeld),
        roundsWon: sanitizeNumber(raw.roundsWon, d.roundsWon),
        handsTriggered: sanitizeNumber(raw.handsTriggered, d.handsTriggered),
        chipsContributed: sanitizeNumber(raw.chipsContributed, d.chipsContributed),
        multContributed: sanitizeNumber(raw.multContributed, d.multContributed)
    };
}
function sanitizeTarotData(raw) {
    const d = createDefaultTarotTelemetry();
    if (!raw || typeof raw !== 'object')
        return d;
    return {
        discovered: sanitizeNumber(raw.discovered, d.discovered),
        acquired: sanitizeNumber(raw.acquired, d.acquired),
        cast: sanitizeNumber(raw.cast, d.cast),
        castWon: sanitizeNumber(raw.castWon, d.castWon),
        sold: sanitizeNumber(raw.sold, d.sold)
    };
}
function sanitizeVoucherData(raw) {
    const d = createDefaultVoucherTelemetry();
    if (!raw || typeof raw !== 'object')
        return d;
    let earliest = null;
    if (raw.earliestAnte !== null && typeof raw.earliestAnte === 'number' && Number.isFinite(raw.earliestAnte) && raw.earliestAnte > 0) {
        earliest = raw.earliestAnte;
    }
    return {
        discovered: sanitizeNumber(raw.discovered, d.discovered),
        redeemed: sanitizeNumber(raw.redeemed, d.redeemed),
        earliestAnte: earliest,
        runsWon: sanitizeNumber(raw.runsWon, d.runsWon),
        estValue: sanitizeNumber(raw.estValue, d.estValue)
    };
}
function sanitizeEffectData(raw) {
    const d = createDefaultEffectTelemetry();
    if (!raw || typeof raw !== 'object')
        return d;
    return {
        enhanced: sanitizeNumber(raw.enhanced, d.enhanced),
        timesScored: sanitizeNumber(raw.timesScored, d.timesScored),
        bonusImpact: sanitizeNumber(raw.bonusImpact, d.bonusImpact),
        deckSaturationPeak: sanitizeNumber(raw.deckSaturationPeak, d.deckSaturationPeak)
    };
}
function sanitizePackData(raw) {
    const d = createDefaultPackTelemetry();
    if (!raw || typeof raw !== 'object')
        return d;
    return {
        discovered: sanitizeNumber(raw.discovered, d.discovered),
        opened: sanitizeNumber(raw.opened, d.opened),
        drafted: sanitizeNumber(raw.drafted, d.drafted),
        skipped: sanitizeNumber(raw.skipped, d.skipped),
        moneyInvested: sanitizeNumber(raw.moneyInvested, d.moneyInvested)
    };
}
/* ---------- Non-Destructive Store Migration Runner ---------- */
function migrateTelemetryStore(raw) {
    const store = createDefaultTelemetryStore();
    if (!raw || typeof raw !== 'object')
        return store;
    // Preserve timestamp if valid
    if (typeof raw.lastUpdated === 'number' && Number.isFinite(raw.lastUpdated)) {
        store.lastUpdated = raw.lastUpdated;
    }
    // Deep-merge all jokers
    if (raw.jokers && typeof raw.jokers === 'object') {
        for (const id of Object.keys(raw.jokers)) {
            store.jokers[id] = sanitizeJokerData(raw.jokers[id]);
        }
    }
    // Deep-merge all tarots
    if (raw.tarots && typeof raw.tarots === 'object') {
        for (const id of Object.keys(raw.tarots)) {
            store.tarots[id] = sanitizeTarotData(raw.tarots[id]);
        }
    }
    // Deep-merge all vouchers
    if (raw.vouchers && typeof raw.vouchers === 'object') {
        for (const id of Object.keys(raw.vouchers)) {
            store.vouchers[id] = sanitizeVoucherData(raw.vouchers[id]);
        }
    }
    // Deep-merge all card effects
    if (raw.effects && typeof raw.effects === 'object') {
        for (const id of Object.keys(raw.effects)) {
            store.effects[id] = sanitizeEffectData(raw.effects[id]);
        }
    }
    // Deep-merge all booster packs
    if (raw.packs && typeof raw.packs === 'object') {
        for (const id of Object.keys(raw.packs)) {
            store.packs[id] = sanitizePackData(raw.packs[id]);
        }
    }
    store.schemaVersion = CURRENT_TELEMETRY_SCHEMA_VERSION;
    return store;
}
let _lifetimeTelemetry = loadLifetimeTelemetry();
let _tarotsCastThisHand = [];
let _blindTelemetryRecorded = false;
function loadLifetimeTelemetry() {
    try {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(TELEMETRY_STORAGE_KEY);
            if (saved) {
                let parsed = null;
                try {
                    parsed = JSON.parse(saved);
                }
                catch (parseErr) {
                    // Emergency corrupt data archive to prevent permanent loss
                    try {
                        localStorage.setItem(TELEMETRY_CORRUPT_ARCHIVE_KEY, saved);
                        // Attempt to restore from secondary backup if present
                        const backup = localStorage.getItem(TELEMETRY_BACKUP_KEY);
                        if (backup) {
                            parsed = JSON.parse(backup);
                        }
                    }
                    catch (backupErr) { }
                }
                if (parsed) {
                    const migrated = migrateTelemetryStore(parsed);
                    // If migrated from older schema, persist updated schema
                    if (parsed.schemaVersion !== CURRENT_TELEMETRY_SCHEMA_VERSION) {
                        saveLifetimeTelemetry(migrated);
                    }
                    return migrated;
                }
            }
        }
    }
    catch (e) { }
    return createDefaultTelemetryStore();
}
function saveLifetimeTelemetry(storeToSave) {
    const store = storeToSave || _lifetimeTelemetry;
    store.schemaVersion = CURRENT_TELEMETRY_SCHEMA_VERSION;
    store.lastUpdated = Date.now();
    try {
        if (typeof localStorage !== 'undefined') {
            const serialized = JSON.stringify(store);
            localStorage.setItem(TELEMETRY_STORAGE_KEY, serialized);
            localStorage.setItem(TELEMETRY_BACKUP_KEY, serialized);
        }
    }
    catch (e) { }
}
function resetLifetimeTelemetry() {
    _lifetimeTelemetry = createDefaultTelemetryStore();
    saveLifetimeTelemetry();
}
function getLifetimeTelemetryStore() {
    return _lifetimeTelemetry;
}
/* ---------- Jokers Lifetime Telemetry ---------- */
function getJokerTelemetry(id) {
    if (!_lifetimeTelemetry.jokers[id]) {
        _lifetimeTelemetry.jokers[id] = {
            discovered: 0,
            roundsHeld: 0,
            roundsWon: 0,
            handsTriggered: 0,
            chipsContributed: 0,
            multContributed: 0
        };
    }
    return _lifetimeTelemetry.jokers[id];
}
function recordJokerDiscovered(id) {
    if (!id)
        return;
    const d = getJokerTelemetry(id);
    d.discovered++;
    saveLifetimeTelemetry();
}
function recordJokerAcquired(id) {
    if (!id)
        return;
    const d = getJokerTelemetry(id);
    if (d.discovered === 0)
        d.discovered = 1;
    saveLifetimeTelemetry();
}
function recordJokerRound(id, won) {
    if (!id)
        return;
    const d = getJokerTelemetry(id);
    d.roundsHeld++;
    if (won)
        d.roundsWon++;
    saveLifetimeTelemetry();
}
function recordJokerTriggerStats(id, deltaChips, deltaMult) {
    if (!id)
        return;
    const d = getJokerTelemetry(id);
    d.handsTriggered++;
    if (deltaChips > 0)
        d.chipsContributed += deltaChips;
    if (deltaMult > 0)
        d.multContributed += deltaMult;
    saveLifetimeTelemetry();
}
/* ---------- Tarots Lifetime Telemetry ---------- */
function getTarotTelemetry(id) {
    if (!_lifetimeTelemetry.tarots[id]) {
        _lifetimeTelemetry.tarots[id] = {
            discovered: 0,
            acquired: 0,
            cast: 0,
            castWon: 0,
            sold: 0
        };
    }
    return _lifetimeTelemetry.tarots[id];
}
function recordTarotDiscovered(id) {
    if (!id)
        return;
    const d = getTarotTelemetry(id);
    d.discovered++;
    saveLifetimeTelemetry();
}
function recordTarotAcquired(id) {
    if (!id)
        return;
    const d = getTarotTelemetry(id);
    if (d.discovered === 0)
        d.discovered = 1;
    d.acquired++;
    saveLifetimeTelemetry();
}
function recordTarotCast(id) {
    if (!id)
        return;
    const d = getTarotTelemetry(id);
    d.cast++;
    saveLifetimeTelemetry();
}
function recordTarotCastInHand(id) {
    recordTarotCast(id);
    _tarotsCastThisHand.push(id);
}
function recordTarotHandWon(id) {
    if (!id)
        return;
    const d = getTarotTelemetry(id);
    d.castWon++;
    saveLifetimeTelemetry();
}
function recordTarotSold(id) {
    if (!id)
        return;
    const d = getTarotTelemetry(id);
    d.sold++;
    saveLifetimeTelemetry();
}
function resolveTarotsHandResult(won) {
    if (won) {
        for (const id of _tarotsCastThisHand) {
            recordTarotHandWon(id);
        }
    }
    _tarotsCastThisHand = [];
}
function clearTarotsInHand() {
    _tarotsCastThisHand = [];
}
/* ---------- Vouchers Lifetime Telemetry ---------- */
function getVoucherTelemetry(id) {
    if (!_lifetimeTelemetry.vouchers[id]) {
        _lifetimeTelemetry.vouchers[id] = {
            discovered: 0,
            redeemed: 0,
            earliestAnte: null,
            runsWon: 0,
            estValue: 0
        };
    }
    return _lifetimeTelemetry.vouchers[id];
}
function recordVoucherDiscovered(id) {
    if (!id)
        return;
    const d = getVoucherTelemetry(id);
    d.discovered++;
    saveLifetimeTelemetry();
}
function recordVoucherRedeemed(id, ante) {
    if (!id)
        return;
    const d = getVoucherTelemetry(id);
    if (d.discovered === 0)
        d.discovered = 1;
    d.redeemed++;
    if (d.earliestAnte === null || ante < d.earliestAnte) {
        d.earliestAnte = ante;
    }
    saveLifetimeTelemetry();
}
function recordVoucherRunWon(id) {
    if (!id)
        return;
    const d = getVoucherTelemetry(id);
    d.runsWon++;
    saveLifetimeTelemetry();
}
function recordVoucherValue(id, value) {
    if (!id || value <= 0)
        return;
    const d = getVoucherTelemetry(id);
    d.estValue += Math.round(value);
    saveLifetimeTelemetry();
}
/* ---------- Card Effects Lifetime Telemetry ---------- */
function getEffectTelemetry(id) {
    if (!_lifetimeTelemetry.effects[id]) {
        _lifetimeTelemetry.effects[id] = {
            enhanced: 0,
            timesScored: 0,
            bonusImpact: 0,
            deckSaturationPeak: 0
        };
    }
    return _lifetimeTelemetry.effects[id];
}
function recordEffectEnhanced(id) {
    if (!id)
        return;
    const d = getEffectTelemetry(id);
    d.enhanced++;
    saveLifetimeTelemetry();
}
function recordEffectScored(id, deltaChips, deltaMult, isXMult, deltaMoney) {
    if (!id)
        return;
    const d = getEffectTelemetry(id);
    d.timesScored++;
    if (id === 'foil' && deltaChips > 0)
        d.bonusImpact += deltaChips;
    else if (id === 'holo' && deltaMult > 0)
        d.bonusImpact += deltaMult;
    else if (id === 'poly')
        d.bonusImpact = Math.round((d.bonusImpact + 0.5) * 10) / 10;
    else if (id === 'gold' && deltaMoney > 0)
        d.bonusImpact += deltaMoney;
    saveLifetimeTelemetry();
}
function recordDeckSaturation(id, pct) {
    if (!id)
        return;
    const d = getEffectTelemetry(id);
    if (pct > d.deckSaturationPeak) {
        d.deckSaturationPeak = Math.round(pct * 10) / 10;
        saveLifetimeTelemetry();
    }
}
/* ---------- Booster Packs Lifetime Telemetry ---------- */
function getPackTelemetry(id) {
    if (!_lifetimeTelemetry.packs[id]) {
        _lifetimeTelemetry.packs[id] = {
            discovered: 0,
            opened: 0,
            drafted: 0,
            skipped: 0,
            moneyInvested: 0
        };
    }
    return _lifetimeTelemetry.packs[id];
}
function recordPackDiscovered(id) {
    if (!id)
        return;
    const d = getPackTelemetry(id);
    d.discovered++;
    saveLifetimeTelemetry();
}
function recordPackOpened(id, cost) {
    if (!id)
        return;
    const d = getPackTelemetry(id);
    d.opened++;
    d.moneyInvested += cost;
    saveLifetimeTelemetry();
}
function recordPackCardDrafted(id) {
    if (!id)
        return;
    const d = getPackTelemetry(id);
    d.drafted++;
    saveLifetimeTelemetry();
}
function recordPackSkipped(id) {
    if (!id)
        return;
    const d = getPackTelemetry(id);
    d.skipped++;
    saveLifetimeTelemetry();
}
/* ---------- Blind Outcome Tracking Helpers ---------- */
function recordBlindOutcomeTelemetry(won) {
    if (_blindTelemetryRecorded)
        return;
    _blindTelemetryRecorded = true;
    for (const j of _state.jokers) {
        recordJokerRound(j.id, won);
    }
}
function resetBlindOutcomeFlag() {
    _blindTelemetryRecorded = false;
}
if (typeof window !== 'undefined') {
    window.getLifetimeTelemetryStore = getLifetimeTelemetryStore;
    window.resetLifetimeTelemetry = resetLifetimeTelemetry;
    window.getJokerTelemetry = getJokerTelemetry;
    window.getTarotTelemetry = getTarotTelemetry;
    window.getVoucherTelemetry = getVoucherTelemetry;
    window.getEffectTelemetry = getEffectTelemetry;
    window.getPackTelemetry = getPackTelemetry;
    window.recordJokerDiscovered = recordJokerDiscovered;
    window.recordJokerAcquired = recordJokerAcquired;
    window.recordJokerRound = recordJokerRound;
    window.recordJokerTriggerStats = recordJokerTriggerStats;
    window.recordTarotDiscovered = recordTarotDiscovered;
    window.recordTarotAcquired = recordTarotAcquired;
    window.recordTarotCast = recordTarotCast;
    window.recordTarotCastInHand = recordTarotCastInHand;
    window.recordTarotHandWon = recordTarotHandWon;
    window.recordTarotSold = recordTarotSold;
    window.resolveTarotsHandResult = resolveTarotsHandResult;
    window.clearTarotsInHand = clearTarotsInHand;
    window.recordVoucherDiscovered = recordVoucherDiscovered;
    window.recordVoucherRedeemed = recordVoucherRedeemed;
    window.recordVoucherRunWon = recordVoucherRunWon;
    window.recordVoucherValue = recordVoucherValue;
    window.recordEffectEnhanced = recordEffectEnhanced;
    window.recordEffectScored = recordEffectScored;
    window.recordDeckSaturation = recordDeckSaturation;
    window.recordPackDiscovered = recordPackDiscovered;
    window.recordPackOpened = recordPackOpened;
    window.recordPackCardDrafted = recordPackCardDrafted;
    window.recordPackSkipped = recordPackSkipped;
    window.recordBlindOutcomeTelemetry = recordBlindOutcomeTelemetry;
    window.resetBlindOutcomeFlag = resetBlindOutcomeFlag;
    window.migrateTelemetryStore = migrateTelemetryStore;
    window.CURRENT_TELEMETRY_SCHEMA_VERSION = CURRENT_TELEMETRY_SCHEMA_VERSION;
    window.GAME_VERSION = GAME_VERSION;
}
/* ---------- Lifecycle ---------- */
/** Resets everything that belongs to a single run. The deck is supplied by deckEngine. */
function resetRunState(freshDeck) {
    _state.ante = 1;
    _state.blindIndex = 0;
    _state.money = _balanceConfig.startingMoney ?? STARTING_MONEY;
    _state.maxHands = _balanceConfig.startingDeals;
    _state.maxJokers = _balanceConfig.maxJokers ?? STARTING_MAX_JOKERS;
    _state.baseWinChipBonus = 0;
    _state.baseWinMultBonus = 0;
    _state.jokers = [];
    _state.consumables = [];
    _state.vouchersBought = [];
    _state.deck = freshDeck;
    _state.inShop = false;
    _state.isDealing = false;
    _state.endlessMode = false;
    _state.voucherAnte = 0;
    _state.currentAnteVoucher = null;
    _state.shopPacks = [];
    _state.activePackOpening = null;
    _state.lastTarotUsedId = null;
    _state.lastTarotUsedName = null;
    _state.cardsSeenThisBlind = [];
    _state.runningCount = 0;
    _state.roundCashEarned = 0;
    _state.runStats = createInitialRunStats();
    clearTarotsInHand();
    resetBlindOutcomeFlag();
}
