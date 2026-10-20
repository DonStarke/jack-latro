// Comprehensive automated tests for Chip Stacker scaling:
// 1. Double Down win (not 21) -> +10 Chips
// 2. Exact 21 win (not doubled down) -> +10 Chips
// 3. Double Down win AS WELL AS Exact 21 -> +20 Chips (+10 for Double Down AND +10 for Exact 21)
// 4. Natural 21 win -> +10 Chips
// 5. Score calculation text in the middle of the playerfield (banner-calc-row and banner-breakdown-items)
// 6. UI joker card reflection and pop animation

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
const ck = (n, v) => results.push((v ? 'ok   ' : 'FAIL ') + n);

(async () => {
  const w = dom.window, d = w.document;
  for (let i = 0; i < 60 && typeof w.uiStartGameFromMenu !== 'function'; i++) await sleep(50);

  const $ = id => d.getElementById(id);

  // Dismiss splash menu to start fresh run
  w.uiStartGameFromMenu();
  await sleep(50);

  console.log('\n--- TEST 1: CHIP STACKER ENGINE SCALING MATH ---');

  const chipStackerDef = w.JOKER_CATALOG.find(j => j.id === 'chip_stacker');
  ck('Chip Stacker exists in catalog', !!chipStackerDef);

  // 1A. Double Down WIN with non-21 (e.g. 5 + 6 + 9 = 20 vs 18)
  const dblWinHand = [
    { uid: 1, rank: '5', suit: '♠', enhancement: null },
    { uid: 2, rank: '6', suit: '♥', enhancement: null },
    { uid: 3, rank: '9', suit: '♦', enhancement: null }
  ];
  const dealerHand18 = [
    { uid: 10, rank: '10', suit: '♣', enhancement: null },
    { uid: 11, rank: '8', suit: '♠', enhancement: null }
  ];

  const resDblWin = w.scoreHand({
    playerHand: dblWinHand,
    dealerHand: dealerHand18,
    jokers: [{ ...chipStackerDef, bonusChips: 0 }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: true,
    anteHandScaling: false
  });

  ck('Double down win (non-21) scales by +10', resDblWin.chipStackerNewBonus === 10);
  const stackerStep1 = resDblWin.steps.find(s => s.kind === 'joker' && s.jokerId === 'chip_stacker');
  ck('Double down win includes Chip Stacker step with +10 chips', !!stackerStep1 && stackerStep1.deltaChips === 10);
  ck('Double down win chips total includes 10 chips from Chip Stacker', resDblWin.chips >= 10);

  // 1B. Exact 21 WIN (not doubled down) (e.g. 7 + 7 + 7 = 21 vs 18)
  const exact21Hand = [
    { uid: 4, rank: '7', suit: '♠', enhancement: null },
    { uid: 5, rank: '7', suit: '♥', enhancement: null },
    { uid: 6, rank: '7', suit: '♦', enhancement: null }
  ];

  const resExact21Win = w.scoreHand({
    playerHand: exact21Hand,
    dealerHand: dealerHand18,
    jokers: [{ ...chipStackerDef, bonusChips: 0 }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: false,
    anteHandScaling: false
  });

  ck('Exact 21 win (not doubled) scales by +10', resExact21Win.chipStackerNewBonus === 10);
  const stackerStep2 = resExact21Win.steps.find(s => s.kind === 'joker' && s.jokerId === 'chip_stacker');
  ck('Exact 21 win includes Chip Stacker step with +10 chips', !!stackerStep2 && stackerStep2.deltaChips === 10);

  // 1C. Double Down WIN AS WELL AS Exact 21 WIN! (e.g. 5 + 6 + 10 = 21 vs 18, doubled down)
  const dblExact21Hand = [
    { uid: 7, rank: '5', suit: '♠', enhancement: null },
    { uid: 8, rank: '6', suit: '♥', enhancement: null },
    { uid: 9, rank: '10', suit: '♦', enhancement: null }
  ];

  const resBothWin = w.scoreHand({
    playerHand: dblExact21Hand,
    dealerHand: dealerHand18,
    jokers: [{ ...chipStackerDef, bonusChips: 0 }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: true,
    anteHandScaling: false
  });

  ck('Double down win AS WELL AS Exact 21 scales by +20 chips', resBothWin.chipStackerNewBonus === 20);
  const stackerStepBoth = resBothWin.steps.find(s => s.kind === 'joker' && s.jokerId === 'chip_stacker');
  ck('Chip Stacker step contributes +20 chips on Double Down Exact 21', !!stackerStepBoth && stackerStepBoth.deltaChips === 20);
  const doubleStep = resBothWin.steps.find(s => s.kind === 'double');
  ck('Double step also present in steps', !!doubleStep && doubleStep.deltaMult === 2);

  // 1D. Scaling when Chip Stacker ALREADY had prior chips (e.g. bonusChips: 30)
  const resBothWithPrior = w.scoreHand({
    playerHand: dblExact21Hand,
    dealerHand: dealerHand18,
    jokers: [{ ...chipStackerDef, bonusChips: 30 }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: true,
    anteHandScaling: false
  });

  ck('Double down Exact 21 adds +20 to existing 30 chips (total 50)', resBothWithPrior.chipStackerNewBonus === 50);
  const stackerStepPrior = resBothWithPrior.steps.find(s => s.kind === 'joker' && s.jokerId === 'chip_stacker');
  ck('Chip Stacker step contributes 50 chips to the hand score', !!stackerStepPrior && stackerStepPrior.deltaChips === 50);

  // 1E. Natural Blackjack WIN (A + K = 21 vs 18)
  const naturalHand = [
    { uid: 20, rank: 'A', suit: '♠', enhancement: null },
    { uid: 21, rank: 'K', suit: '♥', enhancement: null }
  ];
  const resNatural = w.scoreHand({
    playerHand: naturalHand,
    dealerHand: dealerHand18,
    jokers: [{ ...chipStackerDef, bonusChips: 0 }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: false,
    anteHandScaling: false
  });

  ck('Natural 21 win scales Chip Stacker by +10 chips', resNatural.chipStackerNewBonus === 10);
  const stackerStepNatural = resNatural.steps.find(s => s.kind === 'joker' && s.jokerId === 'chip_stacker');
  ck('Natural 21 win includes Chip Stacker step with +10 chips', !!stackerStepNatural && stackerStepNatural.deltaChips === 10);

  // 1F. Double Down LOSS (e.g. 5 + 6 + 7 = 18 vs 20)
  const dealerHand20 = [
    { uid: 12, rank: '10', suit: '♣', enhancement: null },
    { uid: 13, rank: '10', suit: '♠', enhancement: null }
  ];
  const resLoss = w.scoreHand({
    playerHand: dblWinHand, // 20 vs 20 -> push, or let's use 18 vs 20
    dealerHand: dealerHand20,
    jokers: [{ ...chipStackerDef, bonusChips: 10 }],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: true,
    anteHandScaling: false
  });
  ck('Double down tie/loss does not scale Chip Stacker', resLoss.chipStackerNewBonus === null);

  console.log('\n--- TEST 2: SCORE CALCULATION TEXT & UI DISPLAY ---');

  // Test renderScoringBanner with Double Down Exact 21
  w.renderScoringBanner(resBothWin, dblExact21Hand, 'NORMAL');
  const bannerHTML = $('ui-banner').innerHTML;
  const breakdownHTML = $('ui-breakdown').innerHTML;

  ck('Banner contains banner-calc-row with Chips calculation', bannerHTML.includes('banner-calc-row'));
  ck('Banner calculation line displays exact hand chips', bannerHTML.includes(`${resBothWin.chips}</span> Chips`));
  ck('Banner calculation line displays exact hand mult', bannerHTML.includes(`${resBothWin.mult}</span> Mult`));
  ck('Breakdown items container rendered in middle of playerfield', breakdownHTML.includes('banner-breakdown-items'));
  ck('Breakdown displays Chip Stacker[+20c]', breakdownHTML.includes('Chip Stacker[+20c]'));
  ck('Breakdown displays Double Down[×2m]', breakdownHTML.includes('Double Down[×2m]'));

  // Test with prior chips (30 + 20 = 50c)
  w.renderScoringBanner(resBothWithPrior, dblExact21Hand, 'NORMAL');
  const breakdownHTML50 = $('ui-breakdown').innerHTML;
  ck('Breakdown with prior bonus displays Chip Stacker[+50c]', breakdownHTML50.includes('Chip Stacker[+50c]'));

  // Test Natural 21 render
  w.renderScoringBanner(resNatural, naturalHand, 'NORMAL');
  const breakdownNatural = $('ui-breakdown').innerHTML;
  ck('Natural 21 breakdown displays Chip Stacker[+10c]', breakdownNatural.includes('Chip Stacker[+10c]'));

  console.log('\n--- TEST 3: LIVE RUN RESOLUTION & JOKER PATCHING ---');

  // Setup game state with Chip Stacker
  w.resetRunState(w.createStandardDeck());
  w.addJoker({ ...chipStackerDef, bonusChips: 0 });
  ck('State has Chip Stacker with 0 bonusChips initially', w.getState().jokers[0].bonusChips === 0);

  // Simulate player hand: [5, 6, 10] = 21, doubled down, dealer has 18
  w.patchState({
    playerHand: dblExact21Hand,
    dealerHand: dealerHand18,
    doubledDown: true,
    inHand: true,
    handsLeft: 5
  });

  // Resolve the round
  await w.resolveRound();

  const postState = w.getState();
  const stackerAfter = postState.jokers.find(j => j.id === 'chip_stacker');
  ck('After resolving round, Chip Stacker in gameState has 20 bonusChips', !!stackerAfter && stackerAfter.bonusChips === 20);

  // Check UI joker row rendered updated bonus
  const jRowHTML = $('ui-joker-row').innerHTML;
  ck('UI joker card shows +20c', jRowHTML.includes('+20c'));
  ck('UI joker card subtext shows (+10c/Dbl/21)', jRowHTML.includes('(+10c/Dbl/21)'));

  // Verify center playerfield text after live resolution
  const liveBanner = $('ui-banner').innerHTML;
  const liveBreakdown = $('ui-breakdown').innerHTML;
  ck('Live center banner calc-row contains chips', liveBanner.includes('banner-calc-row'));
  ck('Live center breakdown contains Chip Stacker[+20c]', liveBreakdown.includes('Chip Stacker[+20c]'));
  ck('Live center breakdown contains Double Down[×2m]', liveBreakdown.includes('Double Down[×2m]'));

  console.log('\n--- ALL CHIP STACKER TESTS COMPLETED ---');
  results.forEach(r => console.log(r));

  if (results.some(r => r.startsWith('FAIL')) || errors.length > 0) {
    if (errors.length) console.error('Errors encountered:', errors);
    process.exit(1);
  }
  process.exit(0);
})();
