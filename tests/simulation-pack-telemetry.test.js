// Test suite for Booster Pack Monte Carlo Simulation & Telemetry
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

  const $ = id => d.getElementById(id);

  console.log('\n--- TEST 1: SIMULATION EXECUTION & BOOSTER PACK TELEMETRY DATA ---');
  const cfg = w.getBalanceConfig();
  const simData = w.runBatchSimulationForBot(50, 'expert', cfg);

  ck('simData exists', !!simData);
  ck('simData includes packStats object', typeof simData.packStats === 'object');
  ck('packStats tracks pack_joker', !!simData.packStats['pack_joker']);
  ck('packStats tracks pack_variety', !!simData.packStats['pack_variety']);
  ck('packStats tracks pack_tarot', !!simData.packStats['pack_tarot']);
  ck('packStats tracks pack_card', !!simData.packStats['pack_card']);
  ck('pack_joker offered > 0', simData.packStats['pack_joker'].offered > 0);
  ck('pack_joker bought > 0', simData.packStats['pack_joker'].bought > 0);
  ck('totalRerolls is a number', typeof simData.totalRerolls === 'number');

  console.log('\n--- TEST 2: JOKER OFFERED STATS REFLECT PACK CONTENTS ---');
  const totalJokersOffered = Object.values(simData.jokerStats).reduce((sum, j) => sum + j.offered, 0);
  ck('Jokers offered through packs > 0', totalJokersOffered > 0);

  console.log('\n--- TEST 3: EXPORT REPORT CONTAINS BOOSTER PACK BREAKDOWN ---');
  const report = w.buildSingleBotReport(simData);
  ck('Report contains BOOSTER PACK TELEMETRY section', report.includes('BOOSTER PACK TELEMETRY & SHOP REROLLS'));
  ck('Report includes Joker Pack line', report.includes('Joker Pack'));
  ck('Report includes Variety Pack line', report.includes('Variety Pack'));
  ck('Report includes Total Shop Rerolls line', report.includes('Total Shop Rerolls'));

  console.log('\n--- TEST 4: UI SIMULATION MODAL RENDERS PACK CHIPS ---');
  w.renderSimResultsToModal(simData);
  const resultsHtml = $('sim-results-area').innerHTML;
  ck('Sim modal HTML renders PACKS OPENED header', resultsHtml.includes('PACKS OPENED:'));
  ck('Sim modal HTML renders Jokers chip', resultsHtml.includes('Jokers:'));
  ck('Sim modal HTML renders Variety chip', resultsHtml.includes('Variety:'));
  ck('Sim modal HTML renders Tarots chip', resultsHtml.includes('Tarots:'));
  ck('Sim modal HTML renders Cards chip', resultsHtml.includes('Cards:'));
  ck('Sim modal HTML renders Rerolls chip', resultsHtml.includes('Rerolls:'));

  console.log('\n--- ALL SIMULATION PACK TESTS COMPLETED ---');
  console.log(results.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.slice(0, 10).join('\n'));
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})();
