// Headless smoke test: boots index.html in jsdom, plays through real button clicks, reports any errors.
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
    win.setTimeout = (fn, ms, ...a) => realST(fn, Math.max(0, (ms || 0) / 25), ...a); // speed up animations
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
  await sleep(600);
  const $ = id => d.getElementById(id);
  const click = id => $(id).click();
  const text = id => $(id).textContent;
  const waitIdle = async () => { for (let i = 0; i < 400; i++) { await sleep(10); if (!$('btn-deal').disabled || !$('btn-hit').disabled) return; } };

  ck('scripts loaded without errors', errors.length === 0);
  ck('boot: deal button shows 7 deals', /DEAL \(7\)/.test(text('btn-deal')));
  ck('boot: money $6, ante 1/8', text('ui-money') === '$6' && /Ante 1\/8/.test(text('ui-ante')));
  ck('boot: target 300', text('ui-target-score') === '300');
  ck('boot: shoe 52/52', text('ui-shoe-count') === '52/52');

  // Play hands: deal, then stand/hit like a simple bot until the blind ends
  let handsPlayed = 0, cleared = false, failed = false;
  // Make the target reachable so the win path (confetti, cash out, shop) gets exercised: one scoring hand clears it.
  w.patchState({ roundScore: w.getState().targetScore - 1 }); w.updateAllUI();
  for (let guard = 0; guard < 40 && !cleared && !failed; guard++) {
    click('btn-deal'); await sleep(250); await waitIdle();
    if ($('btn-hit').disabled && $('btn-stand').disabled) { await sleep(300); await waitIdle(); }
    // basic strategy-ish: hit below 15
    for (let k = 0; k < 6 && !$('btn-hit').disabled; k++) {
      const pt = text('ui-player-total').replace(/\D/g, '');
      if (parseInt(pt, 10) < 15) { click('btn-hit'); await sleep(250); await waitIdle(); } else break;
    }
    if (!$('btn-stand').disabled) { click('btn-stand'); await sleep(400); await waitIdle(); }
    handsPlayed++;
    await sleep(150);
    cleared = /CASH OUT/.test(text('btn-deal'));
    failed = !$('ui-defeat-modal').classList.contains('hidden') || w.getState().blindFailedReady;
  }
  ck('played hands without errors (' + handsPlayed + ' hands, cleared=' + cleared + ', failed=' + failed + ')', errors.length === 0 && (cleared || failed));
  ck('banner has text after play', text('ui-banner').length > 0);

  if (cleared) {
    click('btn-deal'); await sleep(200);
    ck('shop overlay visible after cash out', !$('ui-shop-overlay').classList.contains('hidden'));
    ck('shop shows items', $('ui-shop-jokers').children.length === 3 && $('ui-shop-extras').children.length >= 2);
    ck('shop payout note', /^Earned \+\$\d+/.test(text('ui-shop-payout-note')));
    ck('target now 435 (Big Blind)', text('ui-target-score') === '435');
    // buy anything affordable
    const buys = [...$('ui-shop-jokers').querySelectorAll('button'), ...$('ui-shop-extras').querySelectorAll('button')].filter(b => !b.disabled);
    if (buys.length) { buys[0].click(); await sleep(50); ck('bought an item (a button now says SOLD)', /SOLD/.test($('ui-shop-jokers').textContent + $('ui-shop-extras').textContent)); }
    const moneyBefore = text('ui-money');
    click('btn-reroll'); await sleep(50);
    ck('reroll ran without errors', errors.length === 0);
    d.querySelector('#ui-shop-overlay .btn-deal[onclick*="startNextBlindFromShop"]').click(); await sleep(100);
    ck('back to play, shop hidden', $('ui-shop-overlay').classList.contains('hidden') && /DEAL \(7\)/.test(text('btn-deal')));
  }

  // Modals & inspectors
  w.toggleDeckModal(true); await sleep(20); ck('deck modal renders 52 cards', $('ui-deck-list').querySelectorAll('.playing-card').length >= 52); w.toggleDeckModal(false);
  w.toggleBlindModal(true); ck('blind modal shows target', text('ui-modal-blind-target').length > 0); w.toggleBlindModal(false);
  w.toggleCogModal(true); w.toggleCogModal(false);

  // Simulator lab through the UI
  w.toggleSimModal(true);
  $('sim-runs').value = '200';
  w.runMonteCarloSimulation(); await sleep(1500);
  ck('sim modal results rendered', $('sim-results-area').textContent.includes('Ante 8 Win Rate'));
  ck('export/copy enabled after sim', !$('btn-export-txt').disabled && !$('btn-copy-txt').disabled);

  // Balance lab apply
  $('sim-deals').value = '9';
  w.applySimConfigToLiveGame(); await sleep(50);
  ck('apply to game: 9 deals', /DEAL \(9\)/.test(text('btn-deal')));

  // New run via cog
  w.startNewRun(); await sleep(50);
  ck('new run resets money', text('ui-money') === '$6');

  ck('NO errors at any point', errors.length === 0);
  console.log(results.join('\n'));
  if (errors.length) console.log('\nERRORS:\n' + errors.slice(0, 10).join('\n'));
  if (w.__alerts) console.log('alerts:', w.__alerts);
  process.exit(0);
})();
