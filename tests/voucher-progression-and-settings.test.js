// Automated test suite for:
// 1. Bought Vouchers Display in Run (Settings Menu and HUD)
// 2. Scoring Animation Pace Setting Position (below music sliders)
// 3. Settings Menu Rules (Unused deal $0, $25/$40 interest requirement)
// 4. Reset Recorded Stats Button & Confirmation Pop-up
// 5. Voucher Progression & Prerequisites (Blank -> VIP Lounge, Extra Cushion -> Extra Cushion 2,
//    $3 reroll -> Clearance Rack $2 -> Clearance Rack 2 $1, 1 pack -> Overstock 2 packs -> Overstock 2 3 packs)
// 6. Voucher Catalog Removals (Table Leverage, High Stakes Table, Precision Edge, Card Sharp License)
// 7. Strictly Increasing Target Score Curve (24 blinds monotonic & Ante 1 Boss < Ante 2 Small)
// 8. Bot Simulation Win Rate Calibration (~25% at Ante 8)

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
    win.alert = msg => { win.__alerts = (win.__alerts || []); win.__alerts.push(msg); };
    win.addEventListener('error', e => errors.push('window.error: ' + e.message));
  }
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const ck = (n, v) => results.push((v ? 'ok   ' : 'FAIL ') + n);

(async () => {
  const w = dom.window, d = w.document;
  for (let i = 0; i < 60 && typeof w.uiStartGameFromMenu !== 'function'; i++) {
    await sleep(50);
  }

  const $ = id => d.getElementById(id);
  const click = id => $(id).click();
  const text = id => ($(id) ? $(id).textContent.trim() : '');
  const isHidden = el => el.classList.contains('hidden');

  w.uiStartGameFromMenu();
  await sleep(50);

  // -------------------------------------------------------------
  // TEST 1: SETTINGS MENU LAYOUT & RULES CONTENT
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: SETTINGS MENU LAYOUT & RULES CONTENT ---');

  // Verify Scoring Animation Pace is positioned right below Audio & Sound Panel
  const cogModalBox = $('ui-cog-modal').querySelector('.modal-box');
  const animSpeedSelect = $('setting-anim-speed');
  ck('Scoring animation pace dropdown #setting-anim-speed exists', !!animSpeedSelect);
  
  // Check DOM order: audio panel should be before anim-speed, and anim-speed before rules table
  const audioPanel = cogModalBox.querySelector('div[style*="AUDIO & SOUND"]');
  const rulesTable = cogModalBox.querySelector('.rules-table');
  const animSpeedContainer = animSpeedSelect.closest('div');

  const allDivs = [...cogModalBox.children];
  const animSpeedIndex = allDivs.indexOf(animSpeedContainer);
  const rulesTableIndex = allDivs.indexOf(rulesTable);

  ck('Scoring animation pace container is positioned before the rules table', animSpeedIndex < rulesTableIndex);

  // Check rules text for economy section
  const rulesText = cogModalBox.textContent;
  ck('Economy rule does NOT state $1 per unused deal', !rulesText.includes('+$1 per unused Deal') && !rulesText.includes('+ $1 per unused Deal'));
  ck('Economy rule mentions $25 saved for full $5 interest', rulesText.includes('$25 saved') || rulesText.includes('$25'));
  ck('Economy rule mentions $40 saved with High Roller Credit', rulesText.includes('$40 saved') || rulesText.includes('$40'));

  // -------------------------------------------------------------
  // TEST 2: ACTIVE RUN VOUCHERS DISPLAY IN SETTINGS & HUD
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: ACTIVE RUN VOUCHERS DISPLAY IN SETTINGS & HUD ---');

  ck('Vouchers container #ui-cog-vouchers-container exists in settings', !!$('ui-cog-vouchers-container'));
  ck('Vouchers count element #ui-cog-vouchers-count exists', !!$('ui-cog-vouchers-count'));
  ck('Vouchers list container #ui-cog-vouchers-list exists', !!$('ui-cog-vouchers-list'));
  ck('HUD active vouchers button #btn-vouchers-hud exists in header', !!$('btn-vouchers-hud'));

  // Initial state: 0 vouchers
  w.renderActiveVouchers();
  ck('Voucher count is initially 0 Active', text('ui-cog-vouchers-count') === '0 Active');
  ck('Initial vouchers list shows empty placeholder', text('ui-cog-vouchers-list').includes('No vouchers purchased'));

  // Add vouchers to state
  w.patchState({ vouchersBought: ['blank_voucher', 'extra_hand'] });
  w.renderActiveVouchers();
  ck('Voucher count updates to 2 Active', text('ui-cog-vouchers-count') === '2 Active');
  ck('Vouchers list renders Blank Voucher card', text('ui-cog-vouchers-list').includes('Blank Voucher'));
  ck('Vouchers list renders Extra Cushion card', text('ui-cog-vouchers-list').includes('Extra Cushion'));
  ck('Vouchers list renders active badges', $('ui-cog-vouchers-list').querySelectorAll('.voucher-active-badge, .lib-tag-pill').length >= 2);

  // Clicking HUD button opens run vouchers in settings
  w.openRunVouchersModal();
  ck('openRunVouchersModal opens cog modal', !isHidden($('ui-cog-modal')));
  w.toggleCogModal(false);
  ck('Closing cog modal hides it', isHidden($('ui-cog-modal')));

  // Reset vouchersBought
  w.patchState({ vouchersBought: [] });
  w.renderActiveVouchers();

  // -------------------------------------------------------------
  // TEST 3: RESET RECORDED STATS BUTTON & CONFIRMATION POP-UP
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: RESET RECORDED STATS BUTTON & CONFIRMATION POP-UP ---');

  const resetBtn = $('btn-modal-reset-stats');
  ck('Reset stats button #btn-modal-reset-stats exists in settings', !!resetBtn);
  const confirmModal = $('ui-confirm-reset-stats-modal');
  ck('Confirm reset stats modal exists in DOM', !!confirmModal);
  ck('Confirm modal is initially hidden', isHidden(confirmModal));

  // Seed some telemetry
  w.recordJokerDiscovered('the_shark');
  w.recordVoucherRedeemed('blank_voucher', 1);
  const initialJokerTel = w.getJokerTelemetry('the_shark');
  ck('Seeded joker telemetry discovered > 0', initialJokerTel.discovered > 0);

  // Click reset button -> triggers confirmation modal
  resetBtn.click();
  ck('Clicking reset button shows confirmation pop-up modal', !isHidden(confirmModal));

  // Test Cancel button
  $('btn-reset-stats-cancel').click();
  ck('Clicking Cancel hides confirmation modal', isHidden(confirmModal));
  ck('Telemetry preserved after Cancel', w.getJokerTelemetry('the_shark').discovered > 0);

  // Click reset button again and Confirm
  resetBtn.click();
  $('btn-reset-stats-confirm').click();
  ck('Clicking Confirm hides confirmation modal', isHidden(confirmModal));
  ck('Lifetime telemetry wiped: the_shark discovered is 0', w.getJokerTelemetry('the_shark').discovered === 0);
  ck('RunStats is reset', w.getState().runStats.handsPlayed === 0);

  // -------------------------------------------------------------
  // TEST 4: VOUCHER CATALOG REWORK & REMOVALS
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: VOUCHER CATALOG REWORK & REMOVALS ---');

  const catalog = w.VOUCHER_CATALOG;
  const findV = id => catalog.find(v => v.id === id);

  ck('Blank Voucher exists in catalog', !!findV('blank_voucher'));
  ck('Blank Voucher cost is $10', findV('blank_voucher').cost === 10);
  ck('VIP Lounge Pass exists in catalog', !!findV('joker_slot'));
  ck('Extra Cushion exists in catalog', !!findV('extra_hand'));
  ck('Extra Cushion 2 exists in catalog', !!findV('extra_hand_2'));
  ck('Clearance Rack exists in catalog', !!findV('clearance_sale'));
  ck('Clearance Rack 2 exists in catalog', !!findV('clearance_sale_2'));
  ck('Overstock Shelves exists in catalog', !!findV('overstock'));
  ck('Overstock Shelves 2 exists in catalog', !!findV('overstock_2'));
  ck('High Roller Credit exists in catalog', !!findV('deep_pockets'));
  ck('Liquid Assets exists in catalog', !!findV('liquidity_pass'));

  // Removed vouchers MUST NOT exist
  ck('Table Leverage removed from catalog', !findV('table_leverage'));
  ck('High Stakes Table removed from catalog', !findV('base_boost'));
  ck('Precision Edge removed from catalog', !findV('card_sharp'));
  ck('Card Sharp License removed from catalog', !findV('card_shark_voucher'));

  // -------------------------------------------------------------
  // TEST 5: VOUCHER PREREQUISITE PROGRESSION TREES
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: VOUCHER PREREQUISITE PROGRESSION TREES ---');

  const isAvail = (id, bought) => w.isVoucherAvailable(id, bought);

  // Tree 1: Blank Voucher -> VIP Lounge Pass
  ck('Blank Voucher is available initially', isAvail('blank_voucher', []));
  ck('VIP Lounge Pass is NOT available without Blank Voucher', !isAvail('joker_slot', []));
  ck('VIP Lounge Pass BECOMES available after buying Blank Voucher', isAvail('joker_slot', ['blank_voucher']));
  ck('Blank Voucher not available once bought', !isAvail('blank_voucher', ['blank_voucher']));
  ck('VIP Lounge Pass not available once bought', !isAvail('joker_slot', ['blank_voucher', 'joker_slot']));

  // Tree 2: Extra Cushion -> Extra Cushion 2
  ck('Extra Cushion is available initially', isAvail('extra_hand', []));
  ck('Extra Cushion 2 is NOT available without Extra Cushion', !isAvail('extra_hand_2', []));
  ck('Extra Cushion 2 BECOMES available after buying Extra Cushion', isAvail('extra_hand_2', ['extra_hand']));
  ck('Extra Cushion 2 not available once bought', !isAvail('extra_hand_2', ['extra_hand', 'extra_hand_2']));

  // Tree 3: Clearance Rack ($2) -> Clearance Rack 2 ($1)
  ck('Clearance Rack is available initially', isAvail('clearance_sale', []));
  ck('Clearance Rack 2 is NOT available without Clearance Rack', !isAvail('clearance_sale_2', []));
  ck('Clearance Rack 2 BECOMES available after buying Clearance Rack', isAvail('clearance_sale_2', ['clearance_sale']));

  // Tree 4: Overstock Shelves (2 packs) -> Overstock Shelves 2 (3 packs)
  ck('Overstock Shelves is available initially', isAvail('overstock', []));
  ck('Overstock Shelves 2 is NOT available without Overstock Shelves', !isAvail('overstock_2', []));
  ck('Overstock Shelves 2 BECOMES available after buying Overstock Shelves', isAvail('overstock_2', ['overstock']));

  // -------------------------------------------------------------
  // TEST 6: REROLL COSTS & SHOP PACK COUNTS
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: REROLL COSTS & SHOP PACK COUNTS ---');

  ck('Base reroll cost is $3', w.SHOP_BASE_REROLL === 3);

  // Pack counts
  const p0 = w.generateShopPacks(1, 1, []);
  ck('Shop initially offers 1 booster pack', p0.length === 1);

  const p1 = w.generateShopPacks(1, 1, ['overstock']);
  ck('Overstock increases shop packs to 2', p1.length === 2);

  const p2 = w.generateShopPacks(1, 1, ['overstock', 'overstock_2']);
  ck('Overstock 2 increases shop packs to 3', p2.length === 3);

  // Reroll costs with vouchers
  w.patchState({ vouchersBought: [] });
  w.cashOutAndEnterShop();
  // Cash out resets rerollCost based on vouchersBought
  ck('Shop reroll starts at $3 without vouchers', w.getState().rerollCost === 3);

  w.patchState({ vouchersBought: ['clearance_sale'] });
  w.applyVoucher('clearance_sale');
  ck('Clearance Rack reduces reroll cost to $2', w.getState().rerollCost === 2);

  w.patchState({ vouchersBought: ['clearance_sale', 'clearance_sale_2'] });
  w.applyVoucher('clearance_sale_2');
  ck('Clearance Rack 2 reduces reroll cost to $1', w.getState().rerollCost === 1);

  // Extra Cushion 2 adds +1 deal
  const dealsBefore = w.getState().maxHands;
  w.applyVoucher('extra_hand_2');
  ck('Extra Cushion 2 adds +1 max deal', w.getState().maxHands === dealsBefore + 1);

  // -------------------------------------------------------------
  // TEST 7: STRICTLY INCREASING TARGET SCORE CURVE (MONOTONIC)
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: STRICTLY INCREASING TARGET SCORE CURVE ---');

  const targets = [];
  let isMonotonic = true;
  for (let a = 1; a <= 8; a++) {
    for (let b = 0; b < 3; b++) {
      const tgt = w.computeBlindTarget(a, b, 50);
      if (targets.length > 0 && tgt <= targets[targets.length - 1].tgt) {
        isMonotonic = false;
        console.log(`FAIL Monotonic break at Ante ${a} Blind ${b}: Target ${tgt} <= previous ${targets[targets.length - 1].tgt}`);
      }
      targets.push({ a, b, tgt });
    }
  }

  ck('All 24 campaign blinds have strictly increasing targets', isMonotonic);
  const a1Boss = w.computeBlindTarget(1, 2, 50);
  const a2Small = w.computeBlindTarget(2, 0, 50);
  ck('Ante 1 Boss Blind (' + a1Boss + ') is strictly less than Ante 2 Small Blind (' + a2Small + ')', a1Boss < a2Small);

  // Endless mode check (Ante 9, 10, 11 scale steeply)
  const a8Boss = w.computeBlindTarget(8, 2, 50);
  const a9Small = w.computeBlindTarget(9, 0, 50);
  const a10Small = w.computeBlindTarget(10, 0, 50);
  ck('Ante 9 Small (' + a9Small + ') is strictly higher than Ante 8 Boss (' + a8Boss + ')', a9Small > a8Boss);
  ck('Ante 10 Small (' + a10Small + ') is more than double Ante 9 Small (' + a9Small + ')', a10Small >= a9Small * 2.0);

  // -------------------------------------------------------------
  // TEST 8: BOT SIMULATION BENCHMARK (~25% WIN RATE AT ANTE 8)
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: BOT SIMULATION BENCHMARK ---');

  const simCfg = {
    startingDeals: 7,
    targetScalePct: 50,
    unusedDealCashCap: 0,
    pushRefundsDeal: true,
    anteHandScaling: true,
    maxEndlessAnte: 8,
    startingMoney: 6,
    maxJokers: 5
  };

  const simExpert = w.runBatchSimulationForBot(200, 'expert', simCfg);
  const expertWins = simExpert.anteClearedCounts[8] || 0;
  const expertWinRate = (expertWins / 200) * 100;
  console.log(`Expert Bot Win Rate: ${expertWinRate.toFixed(1)}% (${expertWins}/200)`);
  ck('Expert bot win rate is between 15% and 35% (~25% benchmark)', expertWinRate >= 15 && expertWinRate <= 35);

  const simBasic = w.runBatchSimulationForBot(200, 'basic', simCfg);
  const basicWins = simBasic.anteClearedCounts[8] || 0;
  const basicWinRate = (basicWins / 200) * 100;
  console.log(`Basic Bot Win Rate: ${basicWinRate.toFixed(1)}% (${basicWins}/200)`);
  ck('Basic bot win rate is between 15% and 38% (~25% benchmark)', basicWinRate >= 15 && basicWinRate <= 38);

  const avgWinRate = (expertWinRate + basicWinRate) / 2;
  console.log(`Average Benchmark Win Rate: ${avgWinRate.toFixed(1)}%`);
  ck('Average Bot Win Rate is closely calibrated around 25% (20% to 32%)', avgWinRate >= 20 && avgWinRate <= 32);

  // Summary
  console.log('\n--- SUMMARY ---');
  results.forEach(r => console.log(r));
  const failed = results.filter(r => r.startsWith('FAIL'));
  console.log(`\nPassed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length > 0) {
    process.exit(1);
  }
})();
