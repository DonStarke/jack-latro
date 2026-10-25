// Test suite for Joker Balance Hub, Ever-Owned Win Rate & Verdict Telemetry
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
  const d = w.document;
  for (let i = 0; i < 60 && typeof w.startNewRun !== 'function'; i++) await sleep(50);

  console.log('\n--- TEST 1: SIMULATION EXECUTION & EVER-OWNED JOKER TELEMETRY ---');
  const cfg = w.getBalanceConfig ? w.getBalanceConfig() : {};
  const simData = w.runBatchSimulationForBot(100, 'expert', cfg);

  ck('simData exists', !!simData);
  ck('jokerStats has entries', Object.keys(simData.jokerStats).length > 0);

  const sampleJoker = Object.values(simData.jokerStats).find(j => j.runsEverOwned > 0);
  ck('At least one joker was ever owned', !!sampleJoker);
  if (sampleJoker) {
    ck('joker tracks runsEverOwned as number', typeof sampleJoker.runsEverOwned === 'number');
    ck('joker tracks everOwnedWins as number', typeof sampleJoker.everOwnedWins === 'number');
    ck('joker tracks everOwnedAnteSum as number', typeof sampleJoker.everOwnedAnteSum === 'number');
    ck('joker tracks archetype', !!sampleJoker.archetype);
    ck('joker tracks icon', !!sampleJoker.icon);
  }

  console.log('\n--- TEST 2: JOKER BALANCE VERDICT FUNCTION ---');
  ck('getJokerBalanceVerdict exists on window', typeof w.getJokerBalanceVerdict === 'function');
  if (sampleJoker) {
    const baseWin = (simData.wins / simData.numRuns) * 100;
    const baseAnte = simData.totalFinalAnte / simData.numRuns;
    const verdict = w.getJokerBalanceVerdict(sampleJoker, baseWin, baseAnte);
    ck('verdict has status', typeof verdict.status === 'string');
    ck('verdict has label', typeof verdict.label === 'string');
    ck('verdict has badgeClass', typeof verdict.badgeClass === 'string');
    ck('verdict has tooltip', typeof verdict.tooltip === 'string');
  }

  console.log('\n--- TEST 3: UI SIMULATION MODAL RENDERS STREAMLINED BALANCE TABLE ---');
  w.renderSimResultsToModal(simData);
  w.switchSimTab('jokers');

  const jokersPane = d.querySelector('.sim-tab-pane[data-pane="jokers"]');
  ck('jokersPane is visible', !jokersPane.classList.contains('hidden'));
  ck('Table header contains Joker', jokersPane.innerHTML.includes('<th>Joker</th>'));
  ck('Table header contains Cost', jokersPane.innerHTML.includes('<th>Cost</th>'));
  ck('Table header contains Pick Win % (Lift)', jokersPane.innerHTML.includes('<th>Pick Win % (Lift)</th>'));
  ck('Table header contains Avg Ante (Lift)', jokersPane.innerHTML.includes('<th>Avg Ante (Lift)</th>'));
  ck('Table header contains Kept to End', jokersPane.innerHTML.includes('<th>Kept to End</th>'));
  ck('Table header contains Balance Verdict', jokersPane.innerHTML.includes('<th>Balance Verdict</th>'));

  const rows = d.querySelectorAll('#sim-jokers-tbody tr');
  ck('Table has rendered rows', rows.length > 0);
  const firstRow = rows[0];
  ck('Row has data-verdict attribute', !!firstRow.getAttribute('data-verdict'));
  ck('Row contains verdict-badge', firstRow.innerHTML.includes('verdict-badge'));

  console.log('\n--- TEST 4: FILTER PILLS FUNCTIONALITY ---');
  const filterPills = jokersPane.querySelectorAll('.joker-filter-pill');
  ck('Filter pills rendered', filterPills.length >= 5);
  ck('All filter pill exists', Array.from(filterPills).some(p => p.getAttribute('data-filter') === 'all'));
  ck('Needs Buff filter pill exists', Array.from(filterPills).some(p => p.getAttribute('data-filter') === 'buff'));
  ck('Carries filter pill exists', Array.from(filterPills).some(p => p.getAttribute('data-filter') === 'carry'));
  ck('Bridges filter pill exists', Array.from(filterPills).some(p => p.getAttribute('data-filter') === 'bridge'));
  ck('Econ filter pill exists', Array.from(filterPills).some(p => p.getAttribute('data-filter') === 'econ'));

  // Test filterSimJokers
  ck('filterSimJokers function exists on window', typeof w.filterSimJokers === 'function');
  w.filterSimJokers('buff');
  const buffPill = jokersPane.querySelector('.joker-filter-pill[data-filter="buff"]');
  ck('Needs Buff pill is active after click', buffPill.classList.contains('active'));

  // Reset to all
  w.filterSimJokers('all');
  const allPill = jokersPane.querySelector('.joker-filter-pill[data-filter="all"]');
  ck('All pill is active after resetting', allPill.classList.contains('active'));

  console.log('\n--- TEST 5: EXPORT REPORT CONTAINS JOKER BALANCE LEADERBOARD ---');
  const report = w.buildSingleBotReport(simData);
  ck('Report contains JOKER BALANCE LEADERBOARD', report.includes('JOKER BALANCE LEADERBOARD'));
  ck('Report header has PickWin%', report.includes('PickWin%'));
  ck('Report header has AnteLift', report.includes('AnteLift'));
  ck('Report header has Balance Verdict', report.includes('Balance Verdict'));

  console.log('\n--- ALL JOKER BALANCE HUB TESTS COMPLETED ---');
  console.log(results.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.slice(0, 10).join('\n'));
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})();
