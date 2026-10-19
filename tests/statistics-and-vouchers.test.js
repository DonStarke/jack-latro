// Comprehensive automated tests for:
// 1. "Double or Nothing" Joker math & display consistency (x3 Mult)
// 2. 1 Voucher per Ante mechanics (persisting across blinds until bought, no extra voucher in same ante, refreshing next ante)
// 3. Statistics button and Statistics Modal (Victory & Defeat screens, hand outcomes, money breakdown, joker triggers)

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
  const click = id => $(id).click();
  const isHidden = el => el.classList.contains('hidden');

  // Dismiss splash menu to start fresh run
  w.uiStartGameFromMenu();
  await sleep(50);

  // -------------------------------------------------------------
  // TEST 1: Double or Nothing Joker Scoring Math & Display
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: DOUBLE OR NOTHING JOKER MATH & DISPLAY ---');

  // Test standard double down WITHOUT Double or Nothing
  const standardHand = [
    { uid: 1, rank: '10', suit: '♠', enhancement: null },
    { uid: 2, rank: '9', suit: '♥', enhancement: null }
  ];
  const dealerHand = [
    { uid: 3, rank: '10', suit: '♦', enhancement: null },
    { uid: 4, rank: '7', suit: '♣', enhancement: null }
  ];

  const standardRes = w.scoreHand({
    playerHand: standardHand,
    dealerHand: dealerHand,
    jokers: [],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: true,
    anteHandScaling: false
  });

  ck('Standard double down applies x2 Mult', standardRes.mult === 4); // base WIN is 50c x 2m -> x2 double = 4m
  const standardEq = w.buildScoreEquationHTML(standardRes, standardHand);
  ck('Standard double down displays Double Down[×2m] in equation', standardEq.includes('Double Down[×2<span class="eq-m">m</span>]'));

  // Test WITH Double or Nothing Joker
  const donJoker = w.JOKER_CATALOG.find(j => j.id === 'double_or_nothing');
  ck('Double or Nothing exists in catalog', !!donJoker);
  ck('Double or Nothing catalog text describes x3 instead of x2', donJoker.desc.includes('×3 instead of ×2'));

  const donRes = w.scoreHand({
    playerHand: standardHand,
    dealerHand: dealerHand,
    jokers: [donJoker],
    bossBlind: null,
    ante: 1,
    money: 10,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    doubledDown: true,
    anteHandScaling: false
  });

  ck('Double or Nothing applies x3 Mult (2 base * 3 = 6)', donRes.mult === 6);
  const donStep = donRes.steps.find(s => s.kind === 'double');
  ck('Double step deltaMult is 3', donStep && donStep.deltaMult === 3);
  ck('Double step jokerId is double_or_nothing', donStep && donStep.jokerId === 'double_or_nothing');

  const donEq = w.buildScoreEquationHTML(donRes, standardHand);
  ck('Double or Nothing displays Double or Nothing[×3m] in equation', donEq.includes('Double or Nothing[×3<span class="eq-m">m</span>]'));
  ck('Equation does NOT contain hardcoded ×2m for Double or Nothing', !donEq.includes('×2<span class="eq-m">m</span>'));

  // Test banner breakdown rendering
  w.renderScoringBanner(donRes, standardHand, 'NORMAL');
  const bannerBreakdown = $('ui-breakdown').innerHTML;
  ck('Banner breakdown displays Double or Nothing[×3m]', bannerBreakdown.includes('Double or Nothing[×3m]'));
  ck('Banner breakdown does NOT display Double Down[×2m]', !bannerBreakdown.includes('Double Down[×2m]'));

  // -------------------------------------------------------------
  // TEST 2: 1 Voucher per Ante Offer Mechanics
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: 1 VOUCHER PER ANTE MECHANICS ---');

  // Start fresh run
  w.startNewRun();
  await sleep(50);
  ck('Fresh run starts at Ante 1', w.getState().ante === 1);
  ck('Fresh run voucherAnte is 0', w.getState().voucherAnte === 0);

  // Generate shop stock for Blind 0
  w.generateShopStock();
  const shop1 = w.getState();
  const vSlot1 = shop1.shopExtras.find(e => e.shopType === 'voucher');
  ck('Ante 1 Blind 0 shop offers 1 voucher', !!vSlot1);
  const voucherIdAnte1 = vSlot1.id;
  ck('Voucher offer is stored in currentAnteVoucher', shop1.currentAnteVoucher && shop1.currentAnteVoucher.id === voucherIdAnte1);
  ck('voucherAnte is now 1', shop1.voucherAnte === 1);

  // Reroll shop: should keep the SAME voucher!
  w.patchState({ money: 50 }); // Give cash to reroll
  w.rerollShop();
  const shopReroll = w.getState();
  const vSlotReroll = shopReroll.shopExtras.find(e => e.shopType === 'voucher');
  ck('Rerolling shop keeps the exact same voucher', vSlotReroll && vSlotReroll.id === voucherIdAnte1);

  // Clear Blind 0 into Blind 1 (same Ante 1):
  w.patchState({ blindIndex: 0, blindClearedReady: true, pendingPayout: { blindReward: 4, handBonus: 3, interest: 1, totalEarned: 8 } });
  w.cashOutAndEnterShop();
  const shop2 = w.getState();
  ck('Now entering Blind 1 (Big Blind)', shop2.blindIndex === 1 && shop2.ante === 1);
  const vSlot2 = shop2.shopExtras.find(e => e.shopType === 'voucher');
  ck('Blind 1 in Ante 1 offers the EXACT SAME voucher', vSlot2 && vSlot2.id === voucherIdAnte1);

  // Buy the voucher in Blind 1
  const vIdx = shop2.shopExtras.findIndex(e => e.shopType === 'voucher');
  const buyRes = w.buyShopItem('shopExtras', vIdx);
  ck('Voucher purchase succeeded', buyRes.ok);
  ck('Bought voucher marked bought in currentAnteVoucher', w.getState().currentAnteVoucher.bought === true);
  ck('Voucher added to vouchersBought', w.getState().vouchersBought.includes(voucherIdAnte1));

  // Reroll after buying: voucher remains bought / no new voucher offered
  w.rerollShop();
  const afterBuyExtras = w.getState().shopExtras;
  const newVoucherAfterBuy = afterBuyExtras.find(e => e.shopType === 'voucher' && !e.bought);
  ck('Reroll after buy does NOT offer a new voucher in the same ante', !newVoucherAfterBuy);

  // Advance to Blind 2 (Boss Blind of Ante 1)
  w.patchState({ blindIndex: 1, blindClearedReady: true, pendingPayout: { blindReward: 5, handBonus: 2, interest: 1, totalEarned: 8 } });
  w.cashOutAndEnterShop();
  const shop3 = w.getState();
  ck('Now entering Blind 2 (Boss Blind) in Ante 1', shop3.blindIndex === 2 && shop3.ante === 1);
  const vSlot3Unbought = shop3.shopExtras.find(e => e.shopType === 'voucher' && !e.bought);
  ck('Boss Blind shop in same ante does NOT offer another voucher', !vSlot3Unbought);

  // Clear Boss Blind: advance to Ante 2!
  w.patchState({ blindIndex: 2, blindClearedReady: true, pendingPayout: { blindReward: 6, handBonus: 4, interest: 2, totalEarned: 12 } });
  w.cashOutAndEnterShop();
  const shopAnte2 = w.getState();
  ck('Now in Ante 2', shopAnte2.ante === 2 && shopAnte2.blindIndex === 0);
  ck('voucherAnte updated to 2', shopAnte2.voucherAnte === 2);
  const vSlotAnte2 = shopAnte2.shopExtras.find(e => e.shopType === 'voucher');
  ck('Ante 2 offers a fresh voucher', !!vSlotAnte2);
  ck('Ante 2 voucher is DIFFERENT from Ante 1 voucher', vSlotAnte2 && vSlotAnte2.id !== voucherIdAnte1);
  ck('Ante 2 voucher is not bought', vSlotAnte2 && !vSlotAnte2.bought);

  // -------------------------------------------------------------
  // TEST 3: Statistics Button & Modal on Victory & Defeat Screens
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: STATISTICS BUTTON & SCREEN ---');

  const defeatModal = $('ui-defeat-modal');
  const victoryModal = $('ui-victory-modal');
  const statsModal = $('ui-stats-modal');

  ck('Stats modal exists in DOM', !!statsModal);
  ck('Stats modal initially hidden', isHidden(statsModal));

  // Check buttons on Defeat and Victory modals
  const defeatStatsBtn = $('btn-defeat-stats');
  const victoryStatsBtn = $('btn-victory-stats');
  ck('Defeat modal has Statistics button', !!defeatStatsBtn);
  ck('Victory modal has Statistics button', !!victoryStatsBtn);

  // Test opening stats modal from Defeat screen
  w.showDefeatModal();
  ck('Defeat modal visible', !isHidden(defeatModal));
  defeatStatsBtn.click();
  await sleep(50);
  ck('Clicking stats button hides Defeat modal', isHidden(defeatModal));
  ck('Clicking stats button shows Stats modal', !isHidden(statsModal));

  // Verify Stats Modal contents
  ck('Stats modal renders Ante info', $('ui-stats-ante').textContent.length > 0);
  ck('Stats modal renders Total Score', $('ui-stats-total-score').textContent.length > 0);
  ck('Stats modal renders Outcomes breakdown grid', !!$('ui-stats-outcomes-wins-list') && !!$('ui-stats-outcomes-losses-list'));
  ck('Stats modal renders Money Earned section', $('ui-stats-earned-total').textContent.startsWith('+$'));
  ck('Stats modal renders Money Spent section', $('ui-stats-spent-total').textContent.startsWith('-$'));
  ck('Stats modal renders Joker triggers container', !!$('ui-stats-joker-triggers'));

  // Test closing stats modal returns to Defeat screen
  statsModal.querySelector('button[onclick*="uiHideStatsModal"]').click();
  await sleep(50);
  ck('Closing stats modal hides Stats modal', isHidden(statsModal));
  ck('Closing stats modal restores Defeat modal', !isHidden(defeatModal));
  w.hideDefeatModal();

  // Test opening stats modal from Victory screen
  w.showVictoryModal();
  ck('Victory modal visible', !isHidden(victoryModal));
  victoryStatsBtn.click();
  await sleep(50);
  ck('Clicking stats button hides Victory modal', isHidden(victoryModal));
  ck('Clicking stats button shows Stats modal', !isHidden(statsModal));

  // Test closing stats modal returns to Victory screen
  statsModal.querySelector('button[onclick*="uiHideStatsModal"]').click();
  await sleep(50);
  ck('Closing stats modal hides Stats modal', isHidden(statsModal));
  ck('Closing stats modal restores Victory modal', !isHidden(victoryModal));
  w.hideVictoryModal();

  // -------------------------------------------------------------
  // TEST 4: Telemetry Data Verification (Hand Outcomes, Money, Joker Triggers)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: RUN TELEMETRY & JOKER TRIGGER TRACKING ---');

  // Play a round with Double or Nothing and verify stats update
  w.startNewRun();
  w.addJoker({ ...donJoker, bonusMult: 0, bonusChips: 0 });

  w.patchState({
    playerHand: [
      { uid: 301, rank: '10', suit: '♠', enhancement: null },
      { uid: 302, rank: '9', suit: '♥', enhancement: null }
    ],
    dealerHand: [
      { uid: 303, rank: '10', suit: '♦', enhancement: null },
      { uid: 304, rank: '8', suit: '♣', enhancement: null }
    ],
    doubledDown: true,
    inHand: false,
    handsLeft: 6,
    targetScore: 999999
  });

  await w.resolveRound();

  const runStats = w.getRunStats();
  ck('RunStats recorded 1 hand played', runStats.handsPlayed === 1);
  ck('RunStats recorded 1 hand won', runStats.handsWon === 1);
  ck('RunStats recorded 1 double down attempt', runStats.doubleDownAttempts === 1);
  ck('RunStats recorded 1 double down win', runStats.doubleDownWins === 1);
  ck('RunStats recorded standard WIN outcome', runStats.outcomes['WIN'].won === 1);
  ck('RunStats recorded Double or Nothing trigger', runStats.jokerTriggers['double_or_nothing'] && runStats.jokerTriggers['double_or_nothing'].count === 1);

  // Render stats modal and verify Double or Nothing appears in joker triggers list!
  w.renderRunStats();
  const jtHTML = $('ui-stats-joker-triggers').innerHTML;
  ck('Stats UI shows Double or Nothing in joker activations list', jtHTML.includes('Double or Nothing') && jtHTML.includes('1 trigger'));

  // -------------------------------------------------------------
  // TEST 5: Loss & Victory Playfield Lockout + Stats Preservation
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: LOSS & VICTORY LOCKOUT & STATS PRESERVATION ---');

  // Set up a game about to lose on last hand (handsLeft = 0 after play)
  w.startNewRun();
  w.addJoker({ ...donJoker, bonusMult: 0, bonusChips: 0 });

  w.patchState({
    playerHand: [
      { uid: 401, rank: '10', suit: '♠', enhancement: null },
      { uid: 402, rank: '6', suit: '♥', enhancement: null }
    ],
    dealerHand: [
      { uid: 403, rank: '10', suit: '♦', enhancement: null },
      { uid: 404, rank: '9', suit: '♣', enhancement: null }
    ],
    inHand: false,
    handsLeft: 0,
    targetScore: 999999
  });

  await w.resolveRound();

  const dealBtnEl = $('btn-deal');
  ck('Deal button text stays DEAL on loss (does NOT become NEW RUN)', /DEAL/.test(dealBtnEl.textContent));
  ck('Deal button class is btn-deal (not btn-newrun)', !dealBtnEl.classList.contains('btn-newrun'));
  ck('Deal button is disabled on loss', dealBtnEl.disabled === true);
  ck('Playfield is locked on loss', w.isPlayfieldLocked() === true);
  ck('App element has playfield-locked class', $('app').classList.contains('playfield-locked'));

  // Attempt to click deal button during the loss lockout: must NOT reset the run
  dealBtnEl.click();
  ck('Clicking deal button during loss does NOT reset runStats handsPlayed', w.getRunStats().handsPlayed === 1);

  // Wait for defeat modal to display
  await sleep(1200);
  ck('Defeat modal appears after defeat delay', !isHidden(defeatModal));

  // Open statistics from defeat modal
  $('btn-defeat-stats').click();
  await sleep(50);
  ck('Stats modal displays after clicking STATISTICS on defeat screen', !isHidden(statsModal));

  // Verify Base Hand Outcomes breakdown contains rows with data from the lost run
  const lossesHTML = $('ui-stats-outcomes-losses-list').innerHTML;
  ck('Outcomes breakdown displays rows for played game', lossesHTML.includes('Dealer Wins (Outscored)') && lossesHTML.includes('1'));

  // Close stats modal
  statsModal.querySelector('button[onclick*="uiHideStatsModal"]').click();
  await sleep(50);

  // Restarting from Defeat screen unlocks playfield and resets for new game
  $('ui-defeat-modal').querySelector('.btn-defeat-play').click();
  ck('Restarting from defeat modal resets playfield lock', w.isPlayfieldLocked() === false);
  ck('Restarting from defeat modal removes playfield-locked class from app', !$('app').classList.contains('playfield-locked'));

  // Test Ante 8 victory lockout
  w.startNewRun();
  w.patchState({
    ante: 8,
    blindIndex: 2,
    endlessMode: false,
    roundScore: 999999,
    targetScore: 100,
    playerHand: [
      { uid: 501, rank: '10', suit: '♠', enhancement: null },
      { uid: 502, rank: 'A', suit: '♥', enhancement: null }
    ],
    dealerHand: [
      { uid: 503, rank: '10', suit: '♦', enhancement: null },
      { uid: 504, rank: '8', suit: '♣', enhancement: null }
    ],
    inHand: false,
    handsLeft: 5
  });

  await w.resolveRound();
  ck('Ante 8 victory immediately locks playfield', w.isPlayfieldLocked() === true);
  ck('Ante 8 victory keeps deal button as DEAL (does NOT become CASH OUT)', /DEAL/.test($('btn-deal').textContent));
  ck('Deal button is disabled on Ante 8 victory', $('btn-deal').disabled === true);

  await sleep(1600);
  ck('Victory modal visible after victory delay', !isHidden(victoryModal));

  // Restart from victory unlocks playfield
  w.uiRestartFromVictory();
  ck('Restarting from victory unlocks playfield', w.isPlayfieldLocked() === false);

  console.log('\n--- ALL TESTS COMPLETED ---');
  console.log(results.join('\n'));

  if (errors.length) {
    console.error('\nErrors encountered:', errors);
    process.exit(1);
  }
  process.exit(0);
})();
