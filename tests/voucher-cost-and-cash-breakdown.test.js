// Automated tests for:
// 1. All vouchers priced at $10 (in catalog, shop extras, and library)
// 2. Cash earned breakdown once player has won the current round (on table felt, in state, and in shop)

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
  for (let i = 0; i < 50 && !w.toggleCogModal; i++) await sleep(20);
  await sleep(100);

  const $ = id => d.getElementById(id);
  const isHidden = el => el.classList.contains('hidden');

  console.log('\n--- TEST 1: ALL VOUCHERS IN CATALOG COST $10 ---');
  const catalog = w.VOUCHER_CATALOG;
  ck('VOUCHER_CATALOG exists', Array.isArray(catalog) && catalog.length === 10);
  const allTen = catalog.every(v => v.cost === 10);
  ck('All 10 vouchers in VOUCHER_CATALOG have cost === 10', allTen);

  for (const v of catalog) {
    ck(`Voucher "${v.name}" (${v.id}) cost is $10`, v.cost === 10);
  }

  console.log('\n--- TEST 2: SHOP EXTRA OFFERS VOUCHER AT $10 ---');
  w.startNewRun();
  await sleep(50);
  w.generateShopStock();
  const stateShop = w.getState();
  const vOffer = stateShop.shopExtras.find(e => e.shopType === 'voucher');
  ck('Shop extras offers a voucher', !!vOffer);
  ck('Offered voucher in shop has cost === 10', vOffer && vOffer.cost === 10);

  console.log('\n--- TEST 3: COMPENDIUM / LIBRARY DISPLAYS $10 FOR ALL VOUCHERS ---');
  w.openLibraryModal();
  w.switchLibraryCategory('vouchers');
  const voucherCards = d.querySelectorAll('.lib-voucher-card');
  ck('Compendium renders 10 voucher cards', voucherCards.length === 10);
  let allCardsShow10 = true;
  voucherCards.forEach(c => {
    const costText = c.querySelector('.lib-item-cost')?.textContent;
    if (costText !== '$10') allCardsShow10 = false;
  });
  ck('All voucher cards in compendium display $10', allCardsShow10);
  w.closeLibraryModal();

  console.log('\n--- TEST 4: ROUND WON CASH BREAKDOWN PANEL IN DOM ---');
  const rcbEl = $('ui-round-cash-breakdown');
  ck('ui-round-cash-breakdown exists in DOM', !!rcbEl);
  ck('ui-round-cash-breakdown is initially hidden', isHidden(rcbEl));

  console.log('\n--- TEST 5: CASH BREAKDOWN DISPLAYED WHEN ROUND IS WON ---');
  // Start fresh run and set money & deals for testing breakdown
  w.startNewRun();
  await sleep(50);
  w.patchState({
    money: 25,
    handsLeft: 5,
    targetScore: 200,
    roundScore: 50,
    blindIndex: 0 // Small Blind ($4 reward)
  });

  ck('Before winning round, cash breakdown is hidden', isHidden(rcbEl));

  // Simulate a winning hand that reaches the target score (250 >= 200)
  const winningHandRes = {
    chips: 100,
    mult: 3,
    handScore: 300,
    isWin: true,
    isScoring: true,
    outcomeType: 'WIN',
    rawOutcomeType: 'WIN',
    outcomeLabel: 'WIN',
    dBust: false,
    moneyGained: 0,
    steps: [{ kind: 'base', chips: 100, mult: 3, deltaChips: 100, deltaMult: 3 }],
    logs: [],
    chipStackerNewBonus: null,
    cushioned: false,
    safetyNetSaved: false
  };

  // Give 2 cards to player Hand for scoring banner
  w.setPlayerHand([
    { uid: 1, rank: '10', suit: '♠', value: 10 },
    { uid: 2, rank: 'K', suit: '♦', value: 10 }
  ]);

  // Set roundScore directly and trigger resolution
  w.patchState({ roundScore: 300 }); // Exceeds target 200

  // 1. When cap is $0 (default), Unused Deals is NOT displayed
  const payoutDefault = w.computeBlindPayout();
  w.renderRoundCashBreakdown(payoutDefault);
  ck('Breakdown does NOT include Unused Deals when cap is 0', !rcbEl.textContent.includes('Unused Deals'));
  ck('Breakdown displays total payout +$9 with cap 0', rcbEl.textContent.includes('+$9'));

  // 2. When cap is $1, Unused Deals IS displayed
  w.patchBalanceConfig({ unusedDealCashCap: 1 });
  const payout = w.computeBlindPayout(); // Small Blind (4) + 5 Deals (1) + 25 Money / 5 (5) = 10
  w.renderRoundCashBreakdown(payout);

  ck('Cash breakdown panel is visible once round is won', !isHidden(rcbEl));
  const rcbText = rcbEl.textContent;
  ck('Breakdown header mentions CASH EARNED BREAKDOWN', rcbText.includes('CASH EARNED BREAKDOWN'));
  ck('Breakdown includes Small Blind Clear Reward', rcbText.includes('Small Blind Clear Reward'));
  ck('Breakdown displays +$4 for Small Blind reward', rcbText.includes('+$4'));
  ck('Breakdown includes Unused Deals', rcbText.includes('Unused Deals'));
  ck('Breakdown mentions 5 deals saved', rcbText.includes('5 deals saved'));
  ck('Breakdown includes Interest Earned', rcbText.includes('Interest Earned'));
  ck('Breakdown displays $25 held', rcbText.includes('$25 held'));
  ck('Breakdown displays $1 per $5', rcbText.includes('$1 per $5'));
  ck('Breakdown displays total payout +$10', rcbText.includes('+$10'));

  console.log('\n--- TEST 6: IN-HAND CASH (GOLD CARDS) TRACKED IN BREAKDOWN ---');
  w.patchState({ roundCashEarned: 3 });
  w.renderRoundCashBreakdown(payout);
  ck('Breakdown includes In-Hand Cash line when gold card/joker cash was earned', rcbEl.textContent.includes('In-Hand Cash'));
  ck('Breakdown displays +$3 for In-Hand Cash', rcbEl.textContent.includes('+$3'));


  console.log('\n--- TEST 8: BREAKDOWN HIDES ON NEXT BLIND OR NEW DEAL ---');
  w.hideRoundCashBreakdown();
  ck('hideRoundCashBreakdown hides panel', isHidden(rcbEl));

  // Show it again, then test startBlindPlay
  w.renderRoundCashBreakdown(payout);
  ck('Breakdown visible again', !isHidden(rcbEl));
  w.startBlindPlay();
  ck('startBlindPlay hides the breakdown panel for next blind', isHidden(rcbEl));

  // Show it again, then test startNewRun
  w.renderRoundCashBreakdown(payout);
  ck('Breakdown visible again', !isHidden(rcbEl));
  w.startNewRun();
  ck('startNewRun hides the breakdown panel for fresh run', isHidden(rcbEl));

  console.log('\n--- TEST 9: SHOP PAYOUT NOTE MATCHES BREAKDOWN ---');
  w.patchState({
    blindClearedReady: true,
    pendingPayout: { blindReward: 4, handBonus: 1, interest: 5, totalEarned: 10 }
  });
  w.uiCashOut();
  const shopPayoutNote = $('ui-shop-payout-note').textContent;
  ck('Shop payout note mentions Earned +$10', shopPayoutNote.includes('Earned +$10'));
  ck('Shop payout note includes $4 Blind breakdown', shopPayoutNote.includes('$4 Blind'));
  ck('Shop payout note includes $1 Deals breakdown', shopPayoutNote.includes('$1 Deals'));
  ck('Shop payout note includes $5 Interest breakdown', shopPayoutNote.includes('$5 Interest'));

  console.log('\n--- ALL CHECKS COMPLETED ---');
  const fails = results.filter(r => r.startsWith('FAIL'));
  results.forEach(r => console.log(r));

  if (fails.length > 0 || errors.length > 0) {
    console.error(`\nFAILED: ${fails.length} checks failed, ${errors.length} errors.`);
    errors.forEach(e => console.error(e));
    process.exit(1);
  } else {
    console.log(`\nSUCCESS: All ${results.length} checks passed cleanly!`);
    process.exit(0);
  }
})();
