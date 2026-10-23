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
  const w = dom.window;
  for (let i = 0; i < 60 && typeof w.getSimConfigFromInputs !== 'function'; i++) {
    await sleep(50);
  }

  const d = w.document;
  const $ = id => d.getElementById(id);

  console.log('\n--- TEST 1: NEW SIMULATION CONTROLS & SLIDERS IN DOM ---');
  ck('Endless depth slider #sim-endless exists', !!$('sim-endless'));
  ck('Endless depth default is 16', $('sim-endless').value === '16');
  ck('Endless depth min is 8 and max is 24', $('sim-endless').min === '8' && $('sim-endless').max === '24');
  ck('Starting cash slider #sim-start-cash exists', !!$('sim-start-cash'));
  ck('Starting cash default is 6', $('sim-start-cash').value === '6');
  ck('Starting cash min is 4 and max is 20', $('sim-start-cash').min === '4' && $('sim-start-cash').max === '20');
  ck('Max joker slots slider #sim-joker-slots exists', !!$('sim-joker-slots'));
  ck('Max joker slots default is 5', $('sim-joker-slots').value === '5');
  ck('Max joker slots min is 3 and max is 7', $('sim-joker-slots').min === '3' && $('sim-joker-slots').max === '7');
  ck('Runs selector has 1,000 option', !!$('sim-runs').querySelector('option[value="1000"]'));

  console.log('\n--- TEST 2: GET SIM CONFIG INCLUDES NEW CONTROLS ---');
  $('sim-endless').value = '18';
  $('sim-start-cash').value = '12';
  $('sim-joker-slots').value = '6';
  const parsedCfg = w.getSimConfigFromInputs();
  ck('getSimConfigFromInputs parses maxEndlessAnte: 18', parsedCfg.maxEndlessAnte === 18);
  ck('getSimConfigFromInputs parses startingMoney: 12', parsedCfg.startingMoney === 12);
  ck('getSimConfigFromInputs parses maxJokers: 6', parsedCfg.maxJokers === 6);

  console.log('\n--- TEST 3: ENDLESS SIMULATION PROGRESSION & SAFEGUARDS ---');
  // Run 100 runs of expert bot with endless depth 14
  const testCfg = {
    startingDeals: 7,
    targetScalePct: 50,
    unusedDealCashCap: 0,
    pushRefundsDeal: true,
    anteHandScaling: true,
    maxEndlessAnte: 14,
    startingMoney: 8,
    maxJokers: 5
  };

  const simData = w.runBatchSimulationForBot(100, 'expert', testCfg);
  ck('simData exists', !!simData);
  ck('simData tracks maxEndlessAnte: 14', simData.maxEndlessAnte === 14);
  ck('simData highestAnteReached >= 8', simData.highestAnteReached >= 8);
  ck('simData blindStats length matches 14 * 3 = 42 blinds', simData.blindStats.length === 42);
  ck('simData anteClearedCounts length is 15 (0..14)', simData.anteClearedCounts.length === 15);
  ck('simData endlessStats array exists', Array.isArray(simData.endlessStats));
  ck('endlessStats covers Ante 9 to 14', simData.endlessStats.length === 6);
  ck('endlessStats[0] is Ante 9', simData.endlessStats[0].ante === 9);

  console.log('\n--- TEST 4: TAROT & BATTLE CHEAT TELEMETRY (consumableStats) ---');
  ck('simData includes consumableStats', !!simData.consumableStats);
  ck('consumableStats tracks all tarots & cheats', Object.keys(simData.consumableStats).length >= 15);
  ck('the_guillotine is tracked in consumableStats', !!simData.consumableStats['the_guillotine']);
  ck('card_forge is tracked in consumableStats', !!simData.consumableStats['card_forge']);
  ck('double_vision is tracked in consumableStats as cheat', simData.consumableStats['double_vision'].category === 'cheat');
  ck('the_guillotine has category tarot', simData.consumableStats['the_guillotine'].category === 'tarot');

  const totalConsumablesOffered = Object.values(simData.consumableStats).reduce((sum, c) => sum + c.offered, 0);
  ck('Consumables were offered in shops and packs (> 0)', totalConsumablesOffered > 0);
  const totalConsumablesBought = Object.values(simData.consumableStats).reduce((sum, c) => sum + c.bought, 0);
  ck('Consumables were bought by bot (> 0)', totalConsumablesBought > 0);

  console.log('\n--- TEST 5: VOUCHER TELEMETRY EXTENSIONS ---');
  ck('simData includes voucherStats', !!simData.voucherStats);
  const totalVouchersBought = Object.values(simData.voucherStats).reduce((sum, v) => sum + v.bought, 0);
  ck('Vouchers were bought (> 0)', totalVouchersBought > 0);
  const sampleBoughtVoucher = Object.values(simData.voucherStats).find(v => v.bought > 0);
  ck('Bought voucher tracks anteSum >= bought', sampleBoughtVoucher ? sampleBoughtVoucher.anteSum >= sampleBoughtVoucher.bought : true);

  console.log('\n--- TEST 6: TABBED UI MODAL RENDERING & NAVIGATION ---');
  w.renderSimResultsToModal(simData);
  const resultsArea = $('sim-results-area');
  ck('Results area contains tab navigation (.sim-tabs-nav)', !!resultsArea.querySelector('.sim-tabs-nav'));

  const tabBtns = resultsArea.querySelectorAll('.sim-tab-btn');
  ck('5 tab buttons rendered', tabBtns.length === 5);

  const panes = resultsArea.querySelectorAll('.sim-tab-pane');
  ck('5 tab panes rendered', panes.length === 5);

  // Overview pane active initially
  const overviewPane = resultsArea.querySelector('.sim-tab-pane[data-pane="overview"]');
  ck('Overview pane is visible initially', !overviewPane.classList.contains('hidden'));

  // Switch to Jokers tab
  w.switchSimTab('jokers');
  const jokersPane = resultsArea.querySelector('.sim-tab-pane[data-pane="jokers"]');
  ck('Switching to jokers shows jokers pane', !jokersPane.classList.contains('hidden'));
  ck('Overview pane is hidden after switch', overviewPane.classList.contains('hidden'));

  // Switch to Tarots & Cheats tab
  w.switchSimTab('consumables');
  const consumablesPane = resultsArea.querySelector('.sim-tab-pane[data-pane="consumables"]');
  ck('Switching to consumables shows consumables pane', !consumablesPane.classList.contains('hidden'));
  ck('Consumables table renders TAROT or CHEAT badges', consumablesPane.innerHTML.includes('TAROT') || consumablesPane.innerHTML.includes('CHEAT'));

  // Switch to Vouchers tab
  w.switchSimTab('vouchers');
  const vouchersPane = resultsArea.querySelector('.sim-tab-pane[data-pane="vouchers"]');
  ck('Switching to vouchers shows vouchers pane', !vouchersPane.classList.contains('hidden'));
  ck('Vouchers table renders voucher rows', vouchersPane.querySelectorAll('table tbody tr').length > 0);

  // Switch to Endless tab
  w.switchSimTab('endless');
  const endlessPane = resultsArea.querySelector('.sim-tab-pane[data-pane="endless"]');
  ck('Switching to endless shows endless pane', !endlessPane.classList.contains('hidden'));
  ck('Endless pane displays Ante 9+ breakdown table', endlessPane.innerHTML.includes('Ante 9'));

  console.log('\n--- TEST 7: REPORT TEXT FORMATTING WITH ENDLESS & CONSUMABLES ---');
  const singleReport = w.buildSingleBotReport(simData);
  ck('Report includes Max Simulation Depth line', singleReport.includes('Max Simulation Depth'));
  ck('Report includes Starting Bankroll line', singleReport.includes('Starting Bankroll'));
  ck('Report includes Peak Endless Ante', singleReport.includes('Peak Endless Ante'));
  ck('Report includes TAROT & BATTLE CHEAT PERFORMANCE section', singleReport.includes('TAROT & BATTLE CHEAT PERFORMANCE LEADERBOARD'));
  ck('Report includes VOUCHER PERFORMANCE LEADERBOARD section', singleReport.includes('VOUCHER PERFORMANCE LEADERBOARD'));
  ck('Report includes ENDLESS MODE PROGRESSION BREAKDOWN section', singleReport.includes('ENDLESS MODE PROGRESSION BREAKDOWN (ANTE 9+)'));

  console.log('\n--- ALL ENDLESS SIMULATION & TELEMETRY TESTS COMPLETED ---');
  console.log(results.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.slice(0, 10).join('\n'));
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})();
