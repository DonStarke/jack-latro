const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
const fs = require('fs');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail || e.message || e)));
vc.on('error', e => errors.push('console.error: ' + e));

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'file:///' + root.replace(/\\/g, '/') + '/index.html',
  runScripts: 'dangerously',
  resources: 'usable',
  virtualConsole: vc,
  pretendToBeVisual: true,
  beforeParse(win) {
    const realST = win.setTimeout.bind(win);
    win.setTimeout = (fn, ms, ...a) => realST(fn, Math.max(0, (ms || 0) / 25), ...a);
    win.HTMLCanvasElement.prototype.getContext = () => ({
      clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {}, set globalAlpha(v) {}, set fillStyle(v) {}
    });
    win.addEventListener('error', e => errors.push('window.error: ' + e.message));
  }
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0;
let failed = 0;
const ck = (n, v) => {
  if (v) {
    console.log('ok   ' + n);
    passed++;
  } else {
    console.error('FAIL ' + n);
    failed++;
  }
};

(async () => {
  console.log('\n--- TEST SUITE: 15 NEW JOKERS CONTENT & SYSTEM INTEGRATION ---');
  const w = dom.window, d = w.document;
  for (let i = 0; i < 60 && typeof w.uiStartGameFromMenu !== 'function'; i++) await sleep(50);

  w.uiStartGameFromMenu();
  await sleep(50);

  // 1. CATALOG VERIFICATION
  console.log('\n--- 1. CATALOG VERIFICATION (ALL 15 JOKERS) ---');
  ck('JOKER_CATALOG has 51 total Jokers', w.JOKER_CATALOG.length === 51);

  const expectedJokers = [
    { id: 'street_magician', rarity: 'uncommon', cost: 6, isX: false },
    { id: 'marked_deck', rarity: 'uncommon', cost: 6, isX: false },
    { id: 'fortune_teller', rarity: 'uncommon', cost: 6, isX: false },
    { id: 'crown_jewel', rarity: 'rare', cost: 7, isX: true },
    { id: 'the_bullseye', rarity: 'uncommon', cost: 6, isX: false },
    { id: 'blowout', rarity: 'common', cost: 5, isX: false },
    { id: 'bounty_hunter', rarity: 'common', cost: 5, isX: true },
    { id: 'push_the_limit', rarity: 'uncommon', cost: 5, isX: false },
    { id: 'bad_beat_jackpot', rarity: 'uncommon', cost: 6, isX: false },
    { id: 'tightrope_walker', rarity: 'uncommon', cost: 6, isX: false },
    { id: 'small_fry', rarity: 'common', cost: 4, isX: true },
    { id: 'kaleidoscope', rarity: 'common', cost: 5, isX: false },
    { id: 'momentum', rarity: 'common', cost: 5, isX: false },
    { id: 'the_banker', rarity: 'rare', cost: 7, isX: false },
    { id: 'side_bet', rarity: 'common', cost: 5, isX: false }
  ];

  for (const exp of expectedJokers) {
    const def = w.JOKER_CATALOG.find(j => j.id === exp.id);
    ck(`Joker ${exp.id} exists in catalog`, !!def);
    ck(`Joker ${exp.id} has rarity ${exp.rarity}`, def && def.rarity === exp.rarity);
    ck(`Joker ${exp.id} has cost $${exp.cost}`, def && def.cost === exp.cost);
    ck(`Joker ${exp.id} isXMult is ${exp.isX}`, def && def.isXMult === exp.isX);
  }

  // 2. MATHEMATICAL SCORING ENGINE TESTS
  console.log('\n--- 2. MATHEMATICAL SCORING ENGINE CHECKS ---');

  // Test Fortune Teller
  {
    const res = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '9', suit: '♥' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '7', suit: '♣' }],
      jokers: [{ id: 'fortune_teller', name: 'Fortune Teller', cost: 6, rarity: 'uncommon', isXMult: false, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false,
      tarotsUsed: 4
    });
    // Base Win: 50c x 2m. Cards: 10 + 9 = 19c. Fortune Teller: 4 * 6 = 24c, 4 * 1 = 4m.
    // Total Chips: 50 + 19 + 24 = 93c. Total Mult: 2 + 4 = 6m.
    ck('Fortune Teller adds +24c and +4m for 4 tarots used', res.chips === 93 && res.mult === 6);
    ck('Fortune Teller step appears in scoring steps', res.steps.some(s => s.jokerId === 'fortune_teller'));
  }

  // Test Crown Jewel
  {
    const res = w.scoreHand({
      playerHand: [{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '8', suit: '♣' }],
      jokers: [{ id: 'crown_jewel', name: 'Crown Jewel', cost: 7, rarity: 'rare', isXMult: true, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    // Natural BJ base: 120c x 4m. Cards: 11 + 10 = 21c. Crown Jewel: mult * 2.2 = 8.8m, +$4.
    ck('Crown Jewel multiplies Natural BJ by x2.2 Mult', res.mult === 8.8);
    ck('Crown Jewel awards +$4 Cash', res.moneyGained === 4);
    ck('Crown Jewel marked as isXMult step', res.steps.some(s => s.jokerId === 'crown_jewel' && s.isXMult));
  }

  // Test The Bullseye
  {
    const res = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '7', suit: '♥' }, { rank: '4', suit: '♣' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '9', suit: '♣' }],
      jokers: [{ id: 'the_bullseye', name: 'The Bullseye', cost: 6, rarity: 'uncommon', isXMult: false, bonusMult: 6, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    // Exact 21 base: 85c x 3m. Cards: 10 + 7 + 4 = 21c. The Bullseye: +6m. Total mult: 9m.
    ck('The Bullseye adds its accumulated bonusMult (+6m)', res.mult === 9);
    ck('The Bullseye step appears in scoring steps', res.steps.some(s => s.jokerId === 'the_bullseye'));
  }

  // Test Blowout
  {
    const res = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '10', suit: '♥' }], // 20
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '7', suit: '♣' }], // 17 (margin = 3)
      jokers: [{ id: 'blowout', name: 'Blowout', cost: 5, rarity: 'common', isXMult: false, archetype: 'chips' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    // Margin = 3. Blowout adds 3 * 25 = 75c, 3 * 3 = 9m.
    // Base Win: 50c x 2m. Cards: 10 + 10 = 20c. Total chips = 50 + 20 + 75 = 145c. Total mult = 2 + 9 = 11m.
    ck('Blowout adds +75c and +9m for 3-point victory margin', res.chips === 145 && res.mult === 11);
  }

  // Test Bounty Hunter
  {
    const res24 = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '8', suit: '♥' }], // 18
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '6', suit: '♣' }, { rank: '8', suit: '♠' }], // 24 (bust)
      jokers: [{ id: 'bounty_hunter', name: 'Bounty Hunter', cost: 5, rarity: 'common', isXMult: true, archetype: 'econ' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Bounty Hunter multiplies mult by x1.6 on dealer bust', res24.mult === 3.2);
    ck('Bounty Hunter awards +$4 on dealer bust under 25', res24.moneyGained === 4);

    const res26 = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '8', suit: '♥' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '6', suit: '♣' }, { rank: '10', suit: '♠' }], // 26 (bust >= 25)
      jokers: [{ id: 'bounty_hunter', name: 'Bounty Hunter', cost: 5, rarity: 'common', isXMult: true, archetype: 'econ' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Bounty Hunter doubles cash to +$8 when dealer busts on 25+', res26.moneyGained === 8);
  }

  // Test Push the Limit
  {
    const res = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '8', suit: '♥' }], // 18
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '8', suit: '♣' }], // 18 (Push)
      jokers: [{ id: 'push_the_limit', name: 'Push the Limit', cost: 5, rarity: 'uncommon', isXMult: false, archetype: 'utility' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    // Base Push: 30c x 1m. Cards: 10 + 8 = 18c. Push the Limit: +80c, +6m, +$2.
    // Chips = 30 + 18 + 80 = 128c. Mult = 1 + 6 = 7m. Money = +$2.
    ck('Push the Limit adds +80c and +6m on a tie', res.chips === 128 && res.mult === 7);
    ck('Push the Limit earns +$2 Cash on a tie', res.moneyGained === 2);
  }

  // Test Bad Beat Jackpot in scoring
  {
    const res = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '9', suit: '♥' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '7', suit: '♣' }],
      jokers: [{ id: 'bad_beat_jackpot', name: 'Bad Beat Jackpot', cost: 6, rarity: 'uncommon', isXMult: false, bonusMult: 5, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Bad Beat Jackpot adds its accumulated bonusMult (+5m) to hand mult', res.mult === 7);
  }

  // Test Tightrope Walker
  {
    const res21 = w.scoreHand({
      playerHand: [{ rank: '9', suit: '♠' }, { rank: '7', suit: '♥' }, { rank: '5', suit: '♦' }], // 21
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '8', suit: '♣' }],
      jokers: [{ id: 'tightrope_walker', name: 'Tightrope Walker', cost: 6, rarity: 'uncommon', isXMult: false, archetype: 'chips' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    // Exact 21: 85c x 3m. Cards: 9 + 7 + 5 = 21c. Tightrope: +80c, +8m.
    ck('Tightrope Walker triggers on 21 (+80c/+8m)', res21.steps.some(s => s.jokerId === 'tightrope_walker' && s.deltaChips === 80 && s.deltaMult === 8));

    const res18 = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '8', suit: '♥' }], // 18
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '7', suit: '♣' }],
      jokers: [{ id: 'tightrope_walker', name: 'Tightrope Walker', cost: 6, rarity: 'uncommon', isXMult: false, archetype: 'chips' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Tightrope Walker does not trigger on 18', !res18.steps.some(s => s.jokerId === 'tightrope_walker'));
  }

  // Test Small Fry
  {
    // 2 low cards (3, 4)
    const res2Lows = w.scoreHand({
      playerHand: [{ rank: '3', suit: '♠' }, { rank: '4', suit: '♥' }, { rank: '10', suit: '♣' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '6', suit: '♣' }],
      jokers: [{ id: 'small_fry', name: 'Small Fry', cost: 4, rarity: 'common', isXMult: true, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    // 2 lows = +30c, +4m (no xMult)
    const sfStep2 = res2Lows.steps.find(s => s.jokerId === 'small_fry');
    ck('Small Fry with 2 low cards adds +30c and +4m without xMult', sfStep2 && sfStep2.deltaChips === 30 && sfStep2.deltaMult === 4 && !sfStep2.isXMult);

    // 3 low cards (2, 3, 5)
    const res3Lows = w.scoreHand({
      playerHand: [{ rank: '2', suit: '♠' }, { rank: '3', suit: '♥' }, { rank: '5', suit: '♦' }, { rank: '8', suit: '♣' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '7', suit: '♣' }],
      jokers: [{ id: 'small_fry', name: 'Small Fry', cost: 4, rarity: 'common', isXMult: true, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    // Base Win: 50c x 2m. Cards: 2+3+5+8 = 18c. Small fry: +45c, +6m -> (2+6)*1.5 = 12m.
    const sfStep3 = res3Lows.steps.find(s => s.jokerId === 'small_fry');
    ck('Small Fry with 3 low cards applies x1.5 Mult capstone', sfStep3 && sfStep3.isXMult && res3Lows.mult === 12);
  }

  // Test Kaleidoscope
  {
    // 3 suits (♠, ♥, ♦)
    const res3Suits = w.scoreHand({
      playerHand: [{ rank: '6', suit: '♠' }, { rank: '6', suit: '♥' }, { rank: '6', suit: '♦' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '7', suit: '♣' }],
      jokers: [{ id: 'kaleidoscope', name: 'Kaleidoscope', cost: 5, rarity: 'common', isXMult: false, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Kaleidoscope triggers on 3 different suits (+90c/+8m)', res3Suits.steps.some(s => s.jokerId === 'kaleidoscope' && s.deltaChips === 90 && s.deltaMult === 8));

    // 2 suits (♠, ♠, ♥)
    const res2Suits = w.scoreHand({
      playerHand: [{ rank: '6', suit: '♠' }, { rank: '8', suit: '♠' }, { rank: '5', suit: '♥' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '7', suit: '♣' }],
      jokers: [{ id: 'kaleidoscope', name: 'Kaleidoscope', cost: 5, rarity: 'common', isXMult: false, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Kaleidoscope triggers on 2 different suits (+40c/+4m)', res2Suits.steps.some(s => s.jokerId === 'kaleidoscope' && s.deltaChips === 40 && s.deltaMult === 4));

    // 1 suit (all ♠)
    const res1Suit = w.scoreHand({
      playerHand: [{ rank: '6', suit: '♠' }, { rank: '8', suit: '♠' }, { rank: '5', suit: '♠' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '7', suit: '♣' }],
      jokers: [{ id: 'kaleidoscope', name: 'Kaleidoscope', cost: 5, rarity: 'common', isXMult: false, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Kaleidoscope does not trigger on only 1 suit', !res1Suit.steps.some(s => s.jokerId === 'kaleidoscope'));
  }

  // Test Momentum
  {
    const res2Wins = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '9', suit: '♥' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '7', suit: '♣' }],
      jokers: [{ id: 'momentum', name: 'Momentum', cost: 5, rarity: 'common', isXMult: false, archetype: 'mult' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false,
      handsWonInBlind: 2
    });
    // Baseline 25c + 2 * 30 = 85c, 3m + 2 * 4 = 11m
    ck('Momentum scales with handsWonInBlind (+85c/+11m on 2 prior wins)', res2Wins.steps.some(s => s.jokerId === 'momentum' && s.deltaChips === 85 && s.deltaMult === 11));
  }

  // Test Side Bet
  {
    // Color pair (both red: ♥ and ♦)
    const resColorPair = w.scoreHand({
      playerHand: [{ rank: '8', suit: '♥' }, { rank: '8', suit: '♦' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '6', suit: '♣' }],
      jokers: [{ id: 'side_bet', name: 'Side Bet', cost: 5, rarity: 'common', isXMult: false, archetype: 'econ' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Side Bet awards +100c and +$10 Cash for same-color pair', resColorPair.steps.some(s => s.jokerId === 'side_bet' && s.deltaChips === 100 && s.deltaMoney === 10));

    // Mixed color pair (♠ and ♥)
    const resMixedPair = w.scoreHand({
      playerHand: [{ rank: '8', suit: '♠' }, { rank: '8', suit: '♥' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '6', suit: '♣' }],
      jokers: [{ id: 'side_bet', name: 'Side Bet', cost: 5, rarity: 'common', isXMult: false, archetype: 'econ' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Side Bet awards +50c and +$5 Cash for mixed-color pair', resMixedPair.steps.some(s => s.jokerId === 'side_bet' && s.deltaChips === 50 && s.deltaMoney === 5));

    // Suited starting cards (♠ and ♠, not pair)
    const resSuited = w.scoreHand({
      playerHand: [{ rank: '10', suit: '♠' }, { rank: '7', suit: '♠' }],
      dealerHand: [{ rank: '10', suit: '♦' }, { rank: '6', suit: '♣' }],
      jokers: [{ id: 'side_bet', name: 'Side Bet', cost: 5, rarity: 'common', isXMult: false, archetype: 'econ' }],
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      anteHandScaling: false
    });
    ck('Side Bet awards +25c and +$2 Cash for suited cards', resSuited.steps.some(s => s.jokerId === 'side_bet' && s.deltaChips === 25 && s.deltaMoney === 2));
  }

  // 3. STATE & PROGRESSION HOOKS
  console.log('\n--- 3. STATE & PROGRESSION HOOKS ---');

  // Test The Banker in calcBlindPayout
  {
    const normalPayout = w.calcBlindPayout(0, 5, 25, 0, 5, 5, false);
    const bankerPayout = w.calcBlindPayout(0, 5, 25, 0, 5, 5, true);
    // Interest on $25: normal = 5. With Banker: ceil(5 * 1.5) = 8.
    ck('The Banker boosts interest by +50% ($5 -> $8)', normalPayout.interest === 5 && bankerPayout.interest === 8);
    ck('The Banker correctly increases total payout earned', bankerPayout.totalEarned === normalPayout.totalEarned + 3);
  }

  // Test Marked Deck at Blind Start
  {
    const markedJoker = w.JOKER_CATALOG.find(j => j.id === 'marked_deck');
    w.patchState({
      jokers: [{ ...markedJoker }],
      consumables: [],
      maxConsumables: 2,
      money: 10
    });

    const res = w.beginBlindState();
    ck('Marked Deck creates 1 cheat card at start of blind', w.getState().consumables.length === 1);
    ck('Created card is marked as consumableType cheat', w.getState().consumables[0].consumableType === 'cheat');
    ck('Created card id exists in CHEAT_CATALOG', w.CHEAT_CATALOG.some(c => c.id === w.getState().consumables[0].id));
    ck('Marked Deck trigger recorded in runStats', w.getState().runStats.jokerTriggers.marked_deck?.count >= 1);
    ck('beginBlindState returns markedDeckCreatedCheats', res.markedDeckCreatedCheats.length === 1);

    // Full inventory - must not create card if no room
    w.patchState({
      consumables: [
        { id: 'c1', name: 'Cheat 1', consumableType: 'cheat', cost: 3, desc: '' },
        { id: 'c2', name: 'Cheat 2', consumableType: 'cheat', cost: 3, desc: '' }
      ]
    });
    const resFull = w.beginBlindState();
    ck('Marked Deck does not create cheat when inventory is full', w.getState().consumables.length === 2);
    ck('beginBlindState markedDeckCreatedCheats is empty when full', resFull.markedDeckCreatedCheats.length === 0);

    // No Marked Deck - should not create cheat
    w.patchState({ jokers: [], consumables: [] });
    const resNoMD = w.beginBlindState();
    ck('No cheat card created when Marked Deck is not owned', w.getState().consumables.length === 0);
    ck('beginBlindState markedDeckCreatedCheats is empty without Marked Deck', resNoMD.markedDeckCreatedCheats.length === 0);
  }

  // Test The Banker extra deal at Blind Start
  {
    const bankerJoker = w.JOKER_CATALOG.find(j => j.id === 'the_banker');
    w.patchState({
      jokers: [{ ...bankerJoker }],
      money: 25,
      maxHands: 7,
      bossBlind: null
    });
    const res25 = w.beginBlindState();
    ck('The Banker grants +1 Deal at blind start with $25+', w.getState().handsLeft === 8);
    ck('The Banker trigger flag returned from beginBlindState', res25.bankerTriggered === true);

    w.patchState({
      jokers: [{ ...bankerJoker }],
      money: 24,
      maxHands: 7,
      bossBlind: null
    });
    const res24 = w.beginBlindState();
    ck('The Banker does NOT grant extra Deal when under $25', w.getState().handsLeft === 7);
    ck('The Banker trigger flag is false when under $25', res24.bankerTriggered === false);
  }

  // Test Marked Deck UI banner and consumable tray via startBlindPlay
  {
    const markedJoker = w.JOKER_CATALOG.find(j => j.id === 'marked_deck');
    w.patchState({
      jokers: [{ ...markedJoker }],
      consumables: [],
      maxConsumables: 2,
      money: 10
    });
    w.startNextBlindFromShop();
    const cRow = d.getElementById('ui-consumable-row');
    ck('UI consumable row renders cheat card after starting blind from shop', cRow && cRow.innerHTML.includes('cheat'));
    const bannerEl = d.getElementById('ui-banner');
    ck('Banner informs player Marked Deck created a cheat card', bannerEl && bannerEl.textContent.includes('Marked Deck created'));
  }

  // Test Descriptions and Subtexts
  console.log('\n--- 4. UI TEXT & BADGES ---');
  for (const exp of expectedJokers) {
    const inst = { id: exp.id, name: exp.id, cost: exp.cost, rarity: exp.rarity, isXMult: exp.isX, bonusMult: 2, bonusChips: 10 };
    const fullDesc = w.getJokerFullDesc(inst);
    const subHTML = w.getJokerMiniSubHTML(inst);
    ck(`${exp.id} generates valid fullDesc string`, typeof fullDesc === 'string' && fullDesc.length > 5);
    ck(`${exp.id} generates valid mini sub HTML`, typeof subHTML === 'string' && subHTML.length > 5);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`FAILED: ${failed} checks failed.`);
    process.exit(1);
  } else {
    console.log(`SUCCESS: All ${passed} checks passed cleanly!`);
    process.exit(0);
  }
})();
