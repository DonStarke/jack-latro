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
const results = [];
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
  console.log('\n--- TEST: RAIN MAN & THE SPOTTER COUNTING JOKERS ---');
  const w = dom.window, d = w.document;
  for (let i = 0; i < 60 && typeof w.uiStartGameFromMenu !== 'function'; i++) await sleep(50);

  // Dismiss splash menu to start fresh run
  w.uiStartGameFromMenu();
  await sleep(50);

  // 1. CATALOG VERIFICATION
  console.log('\n--- 1. CATALOG SPECIFICATIONS ---');
  const rainManDef = w.JOKER_CATALOG.find(j => j.id === 'rain_man');
  const spotterDef = w.JOKER_CATALOG.find(j => j.id === 'the_spotter');

  ck('Rain Man exists in catalog', !!rainManDef);
  ck('Rain Man is Rare', rainManDef && rainManDef.rarity === 'rare');
  ck('Rain Man cost is $8', rainManDef && rainManDef.cost === 8);
  ck('Rain Man is xMult', rainManDef && rainManDef.isXMult === true);
  ck('Rain Man desc explains Hi-Lo count formula', rainManDef && rainManDef.desc.includes('2-6: +1') && rainManDef.desc.includes('10-A: -1'));
  ck('Rain Man desc explains Count >= +2 Double Down & 21 bonus', rainManDef && rainManDef.desc.includes('Count ≥ +2') && rainManDef.desc.includes('×3 Mult'));

  ck('The Spotter exists in catalog', !!spotterDef);
  ck('The Spotter is Rare', spotterDef && spotterDef.rarity === 'rare');
  ck('The Spotter cost is $8', spotterDef && spotterDef.cost === 8);
  ck('The Spotter desc explains Shoe Count formula', spotterDef && spotterDef.desc.includes('(Remaining 10s & Aces) - (Remaining 2-6s)'));
  ck('The Spotter desc explains +15 Chips & +2 Mult scaling', spotterDef && spotterDef.desc.includes('+15 Chips & +2 Mult'));

  // 2. MATH HELPERS (Hi-Lo and Shoe Count)
  console.log('\n--- 2. MATHEMATICAL CARD COUNTING ENGINE ---');
  ck('getHiLoDelta low cards (2..6) return +1',
    w.getHiLoDelta('2') === 1 &&
    w.getHiLoDelta('3') === 1 &&
    w.getHiLoDelta('4') === 1 &&
    w.getHiLoDelta('5') === 1 &&
    w.getHiLoDelta('6') === 1
  );
  ck('getHiLoDelta neutral cards (7..9) return 0',
    w.getHiLoDelta('7') === 0 &&
    w.getHiLoDelta('8') === 0 &&
    w.getHiLoDelta('9') === 0
  );
  ck('getHiLoDelta high cards (10, J, Q, K, A) return -1',
    w.getHiLoDelta('10') === -1 &&
    w.getHiLoDelta('J') === -1 &&
    w.getHiLoDelta('Q') === -1 &&
    w.getHiLoDelta('K') === -1 &&
    w.getHiLoDelta('A') === -1
  );

  const testHand = [{ rank: '2' }, { rank: '5' }, { rank: 'K' }, { rank: 'A' }, { rank: '8' }];
  ck('calculateRunningCount of balanced set sums to 0', w.calculateRunningCount(testHand) === 0);

  const hotDealt = [{ rank: '2' }, { rank: '3' }, { rank: '4' }, { rank: '5' }, { rank: '6' }];
  ck('calculateRunningCount of 5 low cards is +5', w.calculateRunningCount(hotDealt) === 5);

  const coldDealt = [{ rank: '10' }, { rank: 'J' }, { rank: 'Q' }, { rank: 'K' }, { rank: 'A' }];
  ck('calculateRunningCount of 5 high cards is -5', w.calculateRunningCount(coldDealt) === -5);

  // Standard 52 card deck shoe advantage: 20 highs - 20 lows = 0
  const stdDeck = w.createStandardDeck();
  ck('Standard 52-card deck has exactly 0 Shoe Advantage count', w.calculateShoeCount(stdDeck) === 0);

  // Altered deck: remove all four 2s and four 3s (Guillotine pruning)
  const prunedDeck = stdDeck.filter(c => c.rank !== '2' && c.rank !== '3');
  ck('Pruned deck (removed 8 low cards) has +8 Shoe Advantage', w.calculateShoeCount(prunedDeck) === 8);

  // Altered deck: add five extra Aces and Kings
  const loadedDeck = [
    ...stdDeck,
    { uid: 991, rank: 'A', suit: '♠', enhancement: null },
    { uid: 992, rank: 'K', suit: '♠', enhancement: null },
    { uid: 993, rank: 'Q', suit: '♥', enhancement: null }
  ];
  ck('Loaded deck (+3 high cards) has +3 Shoe Advantage', w.calculateShoeCount(loadedDeck) === 3);

  // 3. THE SPOTTER SCORING TESTS (Option 1)
  console.log('\n--- 3. THE SPOTTER SCORING (Option 1) ---');
  // Baseline hand: 10 + 9 = 19 (Win)
  const pHand = [{ rank: '10', suit: '♠', enhancement: null }, { rank: '9', suit: '♥', enhancement: null }];
  const dHand = [{ rank: '10', suit: '♦', enhancement: null }, { rank: '7', suit: '♣', enhancement: null }];

  // Shoe with +4 advantage: (e.g. 14 Highs vs 10 Lows)
  const testShoeAdv4 = [
    { rank: '10', suit: '♠' }, { rank: 'K', suit: '♠' }, { rank: 'A', suit: '♠' }, { rank: 'Q', suit: '♠' }
  ];

  const resSpotterAdv4 = w.scoreHand({
    playerHand: pHand,
    dealerHand: dHand,
    jokers: [{ id: 'the_spotter', name: 'The Spotter' }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: false,
    anteHandScaling: false,
    shoe: testShoeAdv4
  });

  // Base WIN is 50c x 2m. Hand cards: 10 (10c) + 9 (9c) = +19c. Base = 69c x 2m.
  // The Spotter with +4 count adds: 4 * 15 = +60 Chips, 4 * 2 = +8 Mult!
  // Final chips = 69 + 60 = 129c. Final mult = 2 + 8 = 10m!
  ck('The Spotter adds +60 Chips when Shoe Count is +4', resSpotterAdv4.chips === 129);
  ck('The Spotter adds +8 Mult when Shoe Count is +4', resSpotterAdv4.mult === 10);
  ck('The Spotter step appears in scoring steps', resSpotterAdv4.steps.some(s => s.jokerId === 'the_spotter' && s.deltaChips === 60 && s.deltaMult === 8));

  // Shoe with 0 or negative advantage (e.g. 4 Low cards: -4 count)
  const testShoeAdvNeg = [{ rank: '2' }, { rank: '3' }, { rank: '4' }, { rank: '5' }];
  const resSpotterNeg = w.scoreHand({
    playerHand: pHand,
    dealerHand: dHand,
    jokers: [{ id: 'the_spotter', name: 'The Spotter' }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: false,
    anteHandScaling: false,
    shoe: testShoeAdvNeg
  });
  ck('The Spotter does not add chips/mult on negative shoe advantage', resSpotterNeg.chips === 69 && resSpotterNeg.mult === 2);

  // 4. RAIN MAN SCORING TESTS (Option 2)
  console.log('\n--- 4. RAIN MAN SCORING (Option 2) ---');
  // Scenario A: Running count < +2 (Inactive)
  const resRainManCold = w.scoreHand({
    playerHand: pHand,
    dealerHand: dHand,
    jokers: [{ id: 'rain_man', name: 'Rain Man', isXMult: true }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: true,
    anteHandScaling: false,
    runningCount: 1 // less than +2
  });
  // Double down at count +1 is standard x2 Mult (2 * 2 = 4m)
  ck('Rain Man with Count < +2 uses standard Double Down x2 Mult', resRainManCold.mult === 4);

  // Scenario B: Running count >= +2 (Active) on Double Down!
  const resRainManHotDouble = w.scoreHand({
    playerHand: pHand,
    dealerHand: dHand,
    jokers: [{ id: 'rain_man', name: 'Rain Man', isXMult: true }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: true,
    anteHandScaling: false,
    runningCount: 3 // Active!
  });
  // Double down at count >= +2 becomes x3 Mult (2 * 3 = 6m)
  ck('Rain Man with Count >= +2 multiplies Double Down by x3 Mult', resRainManHotDouble.mult === 6);
  ck('Double step has deltaMult 3 and jokerId rain_man', resRainManHotDouble.steps.some(s => s.kind === 'double' && s.deltaMult === 3 && s.jokerId === 'rain_man'));

  // Scenario C: Running count >= +2 on Natural Blackjack / Exact 21!
  const pHandBJ = [{ rank: 'A', suit: '♠', enhancement: null }, { rank: 'K', suit: '♠', enhancement: null }];
  const dHand17 = [{ rank: '10', suit: '♦', enhancement: null }, { rank: '7', suit: '♣', enhancement: null }];
  const resRainManBJ = w.scoreHand({
    playerHand: pHandBJ,
    dealerHand: dHand17,
    jokers: [{ id: 'rain_man', name: 'Rain Man', isXMult: true }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: false,
    anteHandScaling: false,
    runningCount: 2
  });
  // Natural Blackjack base is 120c x 4m. Card chips: 11 (A) + 10 (K) = 141c.
  // Rain Man at Count >= +2 triggers on 21: x1.5 Mult and +$2 cash!
  // Mult = 4 * 1.5 = 6m. Money gained = +$2.
  ck('Rain Man with Count >= +2 applies x1.5 Mult on Blackjack', resRainManBJ.mult === 6);
  ck('Rain Man with Count >= +2 awards +$2 cash on Blackjack', resRainManBJ.moneyGained === 2);
  ck('Rain Man step appears in scoring steps on Blackjack', resRainManBJ.steps.some(s => s.jokerId === 'rain_man' && s.isXMult === true));

  // Scenario D: Rain Man + Double or Nothing combined!
  const resBothDoubles = w.scoreHand({
    playerHand: pHand,
    dealerHand: dHand,
    jokers: [
      { id: 'double_or_nothing', name: 'Double or Nothing', isXMult: true },
      { id: 'rain_man', name: 'Rain Man', isXMult: true }
    ],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: true,
    anteHandScaling: false,
    runningCount: 4
  });
  // Double or Nothing + Rain Man (count >= 2) compounds to x4 Mult! (2 * 4 = 8m)
  ck('Double or Nothing + Rain Man compounds to x4 Mult', resBothDoubles.mult === 8);

  // 5. UI & TABLE APPEARANCE TESTS
  console.log('\n--- 5. TABLE & DECK WIDGET APPEARANCE ---');
  w.resetRunState(w.createStandardDeck());
  w.beginBlindState();

  const shoeWidget = d.getElementById('ui-shoe-widget');
  const counterHud = d.getElementById('ui-deck-counter-hud');

  ck('Shoe widget exists in DOM', !!shoeWidget);
  ck('Deck counter HUD exists in DOM', !!counterHud);

  // Without counter jokers
  w.updateAllUI();
  ck('Without counting jokers, shoe widget has no counter classes', !shoeWidget.classList.contains('has-counter-joker'));
  ck('Without counting jokers, deck counter HUD is hidden', counterHud.classList.contains('hidden'));

  // Add Rain Man with cold count
  w.getState().jokers = [{ id: 'rain_man', name: 'Rain Man', rarity: 'rare', icon: '🧠', archetype: 'mult' }];
  w.getState().runningCount = 1;
  w.updateAllUI();
  ck('With Rain Man, shoe widget gets has-rain-man class', shoeWidget.classList.contains('has-rain-man'));
  ck('With Count 1, shoe widget is NOT hot', !shoeWidget.classList.contains('is-hot'));
  ck('Deck counter HUD is visible with Rain Man', !counterHud.classList.contains('hidden'));
  ck('Deck counter HUD renders Rain Man RC pill', counterHud.innerHTML.includes('rain-man-pill') && counterHud.innerHTML.includes('RC'));

  // Rain Man with HOT count (>= +2)
  w.getState().runningCount = 3;
  w.updateAllUI();
  ck('With Count >= 2, shoe widget gets is-hot class', shoeWidget.classList.contains('is-hot'));
  ck('Deck counter HUD renders HOT! badge on pill', counterHud.innerHTML.includes('HOT!'));

  // Add The Spotter
  w.getState().jokers.push({ id: 'the_spotter', name: 'The Spotter', rarity: 'rare', icon: '🔭', archetype: 'chips' });
  w.updateAllUI();
  ck('With both jokers, shoe widget gets has-both-counters class', shoeWidget.classList.contains('has-both-counters'));
  ck('Deck counter HUD renders both Rain Man and Spotter pills', counterHud.innerHTML.includes('rain-man-pill') && counterHud.innerHTML.includes('spotter-pill'));

  // Mini Subtext and Full Description
  const rmJokerInst = w.getState().jokers[0];
  const spJokerInst = w.getState().jokers[1];
  const rmSub = w.getJokerMiniSubHTML(rmJokerInst);
  const spSub = w.getJokerMiniSubHTML(spJokerInst);
  const rmDesc = w.getJokerFullDesc(rmJokerInst);
  const spDesc = w.getJokerFullDesc(spJokerInst);

  ck('Rain Man mini subtext displays current RC count', rmSub.includes('RC +3'));
  ck('Rain Man full desc shows active status and formula', rmDesc.includes('Hi-Lo Count') && rmDesc.includes('ACTIVE'));
  ck('The Spotter mini subtext displays Shoe count', spSub.includes('Shoe'));
  ck('The Spotter full desc shows formula and yielded chips/mult', spDesc.includes('(Remaining 10s & Aces) - (Remaining 2-6s)'));

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0 || errors.length > 0) {
    if (errors.length > 0) console.error('Encountered errors:', errors);
    process.exit(1);
  } else {
    console.log('SUCCESS: All 36 Rain Man & The Spotter checks passed cleanly!\n');
    process.exit(0);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
