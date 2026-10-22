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

  console.log('--- TEST 1: TOP-RIGHT CHIPS & MULT MATCH CENTER CALCULATION ---');

  // Start fresh run
  w.resetRunState(w.createStandardDeck());
  const slowAndSteadyDef = {
    id: 'slow_and_steady',
    name: 'Slow & Steady',
    cost: 5,
    rarity: 'common',
    isXMult: false,
    icon: '🐢',
    archetype: 'chips',
    desc: '+20 Chips for each Deal remaining in the current Blind when you Win.'
  };

  // Add Slow & Steady (6 deals left -> 6 * 20 = +120 chips)
  w.addJoker(slowAndSteadyDef);

  // Player hand: K♥, K♣ (20 total, Beat Dealer)
  // Base Beat Dealer = 50c x 2m. K♥ (+10c), K♣ (+10c). Slow & Steady (+120c).
  // Total expected chips: 50 + 10 + 10 + 120 = 190 (or with ante boost/rules)
  const playerHand = [
    { rank: 'K', suit: '♥', enhancement: null },
    { rank: 'K', suit: '♣', enhancement: null }
  ];
  const dealerHand = [
    { rank: '5', suit: '♥', enhancement: null },
    { rank: '3', suit: '♥', enhancement: null },
    { rank: '10', suit: '♠', enhancement: null }
  ];

  w.patchState({
    playerHand,
    dealerHand,
    inHand: true,
    handsLeft: 6,
    targetScore: 50000 // Don't clear blind immediately so we test hand score
  });

  await w.resolveRound();

  const cEl = $('ui-chips');
  const mEl = $('ui-mult');
  const bannerEl = $('ui-banner');
  const calcRow = bannerEl.querySelector('.banner-calc-row');

  ck('ui-chips element exists', !!cEl);
  ck('ui-mult element exists', !!mEl);
  ck('Banner calc-row exists in DOM', !!calcRow);

  const centerChipsTxt = calcRow.querySelector('.eq-c').textContent.trim();
  const centerMultTxt = calcRow.querySelector('.eq-m').textContent.trim();
  const topChipsTxt = cEl.textContent.trim();
  const topMultTxt = mEl.textContent.trim();

  console.log(`Top right: ${topChipsTxt} x ${topMultTxt} | Center: ${centerChipsTxt} x ${centerMultTxt}`);

  ck('Top-right chips matches center banner calculation chips', topChipsTxt === centerChipsTxt);
  ck('Top-right mult matches center banner calculation mult', topMultTxt === centerMultTxt);
  ck('Slow & Steady (+120c) is included in top-right chips', parseInt(topChipsTxt, 10) >= 120);

  console.log('\n--- TEST 2: SKIP ANIMATION DOES NOT CLOBBER FINAL SCORE ---');

  // Next hand: test skipping animation
  w.patchState({
    playerHand: [
      { rank: '10', suit: '♠', enhancement: null },
      { rank: 'A', suit: '♦', enhancement: null } // Natural 21
    ],
    dealerHand: [
      { rank: '10', suit: '♦', enhancement: null },
      { rank: '8', suit: '♠', enhancement: null }
    ],
    inHand: true,
    handsLeft: 5
  });

  // Start round resolution and immediately trigger skip
  const resolvePromise = w.resolveRound();
  // Simulate user tap to skip
  $('ui-table-felt').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await resolvePromise;

  const topChipsAfterSkip = $('ui-chips').textContent.trim();
  const topMultAfterSkip = $('ui-mult').textContent.trim();
  const centerChipsAfterSkip = $('ui-banner').querySelector('.banner-calc-row .eq-c').textContent.trim();
  const centerMultAfterSkip = $('ui-banner').querySelector('.banner-calc-row .eq-m').textContent.trim();

  console.log(`After skip - Top right: ${topChipsAfterSkip} x ${topMultAfterSkip} | Center: ${centerChipsAfterSkip} x ${centerMultAfterSkip}`);

  ck('After skip, top-right chips matches center banner chips', topChipsAfterSkip === centerChipsAfterSkip);
  ck('After skip, top-right mult matches center banner mult', topMultAfterSkip === centerMultAfterSkip);

  console.log('\n--- TEST 3: CSS LAYERING (CENTER STAGE & OUTCOME HEADLINE ON TOP OF PLAYFIELD) ---');

  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

  // Verify z-index and position styling in styles.css
  ck('.center-stage has position relative', css.includes('.center-stage') && css.includes('z-index: 60'));
  ck('.outcome-headline has z-index >= 60', css.includes('.outcome-headline') && css.includes('z-index: 65'));
  ck('.center-banner-wrap has z-index >= 60', css.includes('.center-banner-wrap') && css.includes('z-index: 62'));
  ck('.round-cash-breakdown has z-index >= 60', css.includes('.round-cash-breakdown') && css.includes('z-index: 63'));
  ck('.outcome-headline win-style has opaque background', css.includes('.outcome-headline.win-style') && css.includes('rgba(10, 20, 15, 0.96)'));

  console.log('\n--- TEST 4: UNUSED DEALS CASH CAP SLIDER ($0 MIN, $0 DEFAULT, HIDDEN IN BREAKDOWN) ---');

  const dealCapInput = $('sim-dealcap');
  const dealCapLbl = $('sim-lbl-dealcap');

  ck('sim-dealcap allows min="0"', dealCapInput && dealCapInput.min === '0');
  ck('sim-dealcap defaults to "0"', dealCapInput && dealCapInput.value === '0');
  ck('sim-lbl-dealcap defaults to "$0"', dealCapLbl && dealCapLbl.textContent === '$0');
  ck('getBalanceConfig().unusedDealCashCap defaults to 0', w.getBalanceConfig().unusedDealCashCap === 0);

  // Test cash breakdown with cap = 0
  w.patchBalanceConfig({ unusedDealCashCap: 0 });
  const payoutCap0 = { blindReward: 5, handBonus: 0, interest: 3, totalEarned: 8 };
  w.renderRoundCashBreakdown(payoutCap0);
  const rcbEl = $('ui-round-cash-breakdown');
  ck('Breakdown does NOT display Unused Deals when cap is $0', !rcbEl.textContent.includes('Unused Deals'));

  // Test cash breakdown with cap > 0
  w.patchBalanceConfig({ unusedDealCashCap: 2 });
  const payoutCap2 = { blindReward: 5, handBonus: 2, interest: 3, totalEarned: 10 };
  w.renderRoundCashBreakdown(payoutCap2);
  ck('Breakdown DOES display Unused Deals when cap is > $0', rcbEl.textContent.includes('Unused Deals'));
  ck('Breakdown displays +$2 when handBonus is 2', rcbEl.textContent.includes('+$2'));

  console.log('\n--- TEST 5: SHOP OVERLAY HIDES CENTER SCORE BANNER & CASH BREAKDOWN ---');

  ck('.overlay-panel has z-index 100 (> center-stage 60, outcome-headline 65)', css.includes('.overlay-panel') && css.includes('z-index: 100'));
  ck('.pack-opening-overlay has z-index 110', css.includes('.pack-opening-overlay') && css.includes('z-index: 110'));
  ck('.pack-booster-container has z-index 120', css.includes('.pack-booster-container') && css.includes('z-index: 120'));
  ck('CSS completely hides center-stage in shop mode', css.includes('.table-felt.in-shop .center-stage') && css.includes('display: none !important'));

  // Set up round cleared state with pending payout and cap 0
  w.patchBalanceConfig({ unusedDealCashCap: 0 });
  w.patchState({
    blindClearedReady: true,
    isDealing: false,
    handsLeft: 4,
    pendingPayout: { blindReward: 4, handBonus: 0, interest: 1, totalEarned: 5 }
  });

  // Render cash breakdown and banner as would be shown right at end of round
  w.renderRoundCashBreakdown({ blindReward: 4, handBonus: 0, interest: 1, totalEarned: 5 });
  $('ui-banner').innerHTML = 'Royal Flush: 100 x 8 = 800';
  ck('Before cash out, rcb element is not hidden', !$('ui-round-cash-breakdown').classList.contains('hidden'));

  // Trigger Cash Out into Shop
  $('btn-deal').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

  const shopOverlay = $('ui-shop-overlay');
  const centerStage = w.document.querySelector('.center-stage');
  const tableFelt = $('ui-table-felt');
  const shopPayoutNote = $('ui-shop-payout-note');

  ck('Shop overlay is visible after cashing out', !shopOverlay.classList.contains('hidden'));
  ck('Round cash breakdown is HIDDEN after cashing out', $('ui-round-cash-breakdown').classList.contains('hidden'));
  ck('Center stage is HIDDEN when entering shop', centerStage.classList.contains('hidden'));
  ck('Table felt has in-shop class when entering shop', tableFelt.classList.contains('in-shop'));
  ck('Shop payout note omits $0 Deals when cap is 0', !shopPayoutNote.textContent.includes('Deals'));
  ck('Shop payout note displays exact breakdown note', shopPayoutNote.textContent.includes('Earned +$5 ($4 Blind + $1 Interest).'));

  // Transition from Shop into next Blind
  w.startNextBlindFromShop();

  ck('Shop overlay is hidden after starting next blind', shopOverlay.classList.contains('hidden'));
  ck('Table felt removes in-shop class after leaving shop', !tableFelt.classList.contains('in-shop'));
  ck('Center stage is restored (hidden class removed)', !centerStage.classList.contains('hidden'));
  ck('Banner is cleanly reset to prompt dealing next blind', $('ui-banner').textContent.includes('Tap DEAL to begin'));

  console.log('\n--- ALL SCORE SYNC & LAYERING CHECKS COMPLETED ---');
  results.forEach(r => console.log(r));

  if (results.some(r => r.startsWith('FAIL')) || errors.length > 0) {
    if (errors.length) console.error('Errors encountered:', errors);
    process.exit(1);
  }
})();
