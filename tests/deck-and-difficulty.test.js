// Comprehensive automated test suite for Unique Decks and Difficulty System
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
let passed = 0;
let failed = 0;

function ck(name, condition) {
  if (condition) {
    results.push('ok   ' + name);
    passed++;
  } else {
    results.push('FAIL ' + name);
    failed++;
    console.error('FAILED CHECK:', name);
  }
}

(async () => {
  console.log('\n--- TEST SUITE: UNIQUE DECKS & DIFFICULTY PROGRESSION ---');
  const w = dom.window, d = w.document;
  for (let i = 0; i < 60 && typeof w.updateAllUI !== 'function'; i++) {
    await sleep(50);
  }

  const $ = id => d.getElementById(id);
  const click = id => $(id).click();
  const text = id => $(id).textContent;
  const isHidden = el => !el || el.classList.contains('hidden') || el.style.display === 'none';

    // Clear any existing progress
  if (typeof w.resetDeckProgress === 'function') {
    w.resetDeckProgress();
  }

    // 1. VERIFY REMOVAL OF SNAKE EYES AND THE SPOTTER
  console.log('\n--- 1. JOKER REMOVAL VERIFICATION ---');
  const snakeDef = w.JOKER_CATALOG.find(j => j.id === 'snake_eyes');
  const spotterDef = w.JOKER_CATALOG.find(j => j.id === 'the_spotter');
  ck('Snake Eyes is NOT in JOKER_CATALOG', !snakeDef);
  ck('The Spotter is NOT in JOKER_CATALOG', !spotterDef);
  ck('JOKER_CATALOG total is exactly 49 Jokers', w.JOKER_CATALOG.length === 49);

  // 2. DECK CATALOG & GENERATORS
  console.log('\n--- 2. DECK CATALOG & COMPOSITION ---');
  ck('DECK_CATALOG is defined', Array.isArray(w.DECK_CATALOG));
  ck('DECK_CATALOG has at least 2 decks', w.DECK_CATALOG.length >= 2);

  const stdDeckDef = w.getDeckDef('standard');
  ck('Standard Deck definition exists', !!stdDeckDef);
  ck('Standard Deck cardCount is 52', stdDeckDef.cardCount === 52);

  const stdCards = stdDeckDef.createDeck();
  ck('Standard Deck generates 52 cards', stdCards.length === 52);
  const stdFaces = stdCards.filter(c => ['J', 'Q', 'K'].includes(c.rank));
  ck('Standard Deck contains 12 Face Cards (J, Q, K)', stdFaces.length === 12);
  const stdAces = stdCards.filter(c => c.rank === 'A');
  ck('Standard Deck contains 4 Aces', stdAces.length === 4);

  const revoltDef = w.getDeckDef('the_revolt');
  ck('The Revolt deck definition exists', !!revoltDef);
  ck('The Revolt name is "The Revolt"', revoltDef.name === 'The Revolt');
  ck('The Revolt cardCount is 40', revoltDef.cardCount === 40);

  const revoltCards = revoltDef.createDeck();
  ck('The Revolt generates exactly 40 cards', revoltCards.length === 40);
  const revoltFaces = revoltCards.filter(c => ['J', 'Q', 'K'].includes(c.rank));
  ck('The Revolt has ZERO Kings, Queens, or Jacks', revoltFaces.length === 0);
  const revoltAces = revoltCards.filter(c => c.rank === 'A');
  ck('The Revolt retains exactly 4 Aces', revoltAces.length === 4);
  const revoltNumbers = revoltCards.filter(c => ['2','3','4','5','6','7','8','9','10'].includes(c.rank));
  ck('The Revolt retains exactly 36 number cards (4 of each 2-10)', revoltNumbers.length === 36);

  // 3. DIFFICULTY CATALOG & TARGET SCALING
  console.log('\n--- 3. DIFFICULTY CATALOG & SCALING MATH ---');
  ck('DIFFICULTY_CATALOG is defined', Array.isArray(w.DIFFICULTY_CATALOG));
  ck('DIFFICULTY_CATALOG has 3 difficulties', w.DIFFICULTY_CATALOG.length === 3);

  const bronzeDef = w.getDifficultyDef('bronze');
  const silverDef = w.getDifficultyDef('silver');
  const goldDef = w.getDifficultyDef('gold');

  ck('Bronze difficulty exists', !!bronzeDef);
  ck('Bronze targetScalePct is 50%', bronzeDef.targetScalePct === 50);
  ck('Bronze medal icon is 🥉', bronzeDef.medalIcon === '🥉');

  ck('Silver difficulty exists', !!silverDef);
  ck('Silver targetScalePct is 75%', silverDef.targetScalePct === 75);
  ck('Silver medal icon is 🥈', silverDef.medalIcon === '🥈');

  ck('Gold difficulty exists', !!goldDef);
  ck('Gold targetScalePct is 100%', goldDef.targetScalePct === 100);
  ck('Gold medal icon is 🥇', goldDef.medalIcon === '🥇');

  // Verify scale math for blinds
  // Ante 1 base is 300
  // Bronze (50%): Small Blind = round(300 * 0.5 * 1.0) = 150
  // Silver (75%): Small Blind = round(300 * 0.75 * 1.0) = 225
  // Gold (100%): Small Blind = round(300 * 1.0 * 1.0) = 300
  w.startNewRun('standard', 'bronze');
  ck('Bronze run sets balanceConfig targetScalePct to 50', w.getBalanceConfig().targetScalePct === 50);
  ck('Bronze Ante 1 Small Blind target is 150', w.computeBlindTarget(1, 0, w.getBalanceConfig().targetScalePct) === 150);

  w.startNewRun('standard', 'silver');
  ck('Silver run sets balanceConfig targetScalePct to 75', w.getBalanceConfig().targetScalePct === 75);
  ck('Silver Ante 1 Small Blind target is 225 (75% scaling)', w.computeBlindTarget(1, 0, w.getBalanceConfig().targetScalePct) === 225);

  w.startNewRun('standard', 'gold');
  ck('Gold run sets balanceConfig targetScalePct to 100', w.getBalanceConfig().targetScalePct === 100);
  ck('Gold Ante 1 Small Blind target is 300 (100% scaling)', w.computeBlindTarget(1, 0, w.getBalanceConfig().targetScalePct) === 300);

    // 4. LOCK / UNLOCK PROGRESSION SYSTEM
  console.log('\n--- 4. UNLOCK PROGRESSION LOGIC ---');
  w.resetDeckProgress();

  // Fresh state: only Bronze is unlocked
  ck('Standard Bronze is unlocked initially', w.isDifficultyUnlocked('standard', 'bronze') === true);
  ck('Standard Silver is LOCKED initially', w.isDifficultyUnlocked('standard', 'silver') === false);
  ck('Standard Gold is LOCKED initially', w.isDifficultyUnlocked('standard', 'gold') === false);

  ck('The Revolt Bronze is unlocked initially', w.isDifficultyUnlocked('the_revolt', 'bronze') === true);
  ck('The Revolt Silver is LOCKED initially', w.isDifficultyUnlocked('the_revolt', 'silver') === false);
  ck('The Revolt Gold is LOCKED initially', w.isDifficultyUnlocked('the_revolt', 'gold') === false);

  // Neither deck has beaten any difficulty yet
  ck('Standard Bronze not beaten initially', w.hasBeatenDifficulty('standard', 'bronze') === false);
  ck('The Revolt Bronze not beaten initially', w.hasBeatenDifficulty('the_revolt', 'bronze') === false);

  // Player beats Ante 8 on Standard Bronze
  w.recordDeckVictory('standard', 'bronze');
  ck('Standard Bronze recorded as beaten', w.hasBeatenDifficulty('standard', 'bronze') === true);
  ck('Standard Silver is now UNLOCKED after beating Bronze', w.isDifficultyUnlocked('standard', 'silver') === true);
  ck('Standard Gold is still LOCKED', w.isDifficultyUnlocked('standard', 'gold') === false);

  // Crucial requirement: "only for that deck" - The Revolt Silver must still be locked!
  ck('The Revolt Silver remains LOCKED when beating Bronze on Standard', w.isDifficultyUnlocked('the_revolt', 'silver') === false);

  // Player beats Ante 8 on Standard Silver
  w.recordDeckVictory('standard', 'silver');
  ck('Standard Silver recorded as beaten', w.hasBeatenDifficulty('standard', 'silver') === true);
  ck('Standard Gold is now UNLOCKED after beating Silver', w.isDifficultyUnlocked('standard', 'gold') === true);

  // Player beats Ante 8 on Standard Gold
  w.recordDeckVictory('standard', 'gold');
  ck('Standard Gold recorded as beaten', w.hasBeatenDifficulty('standard', 'gold') === true);

  // Now beat Bronze on The Revolt
  w.recordDeckVictory('the_revolt', 'bronze');
  ck('The Revolt Bronze recorded as beaten', w.hasBeatenDifficulty('the_revolt', 'bronze') === true);
  ck('The Revolt Silver is now UNLOCKED for The Revolt', w.isDifficultyUnlocked('the_revolt', 'silver') === true);
  ck('The Revolt Gold remains LOCKED for The Revolt', w.isDifficultyUnlocked('the_revolt', 'gold') === false);

  // 5. DECK SELECTION MODAL & UI RENDERING
  console.log('\n--- 5. DECK SELECTION MODAL DOM & RENDERING ---');
  const deckModal = $('ui-deck-selection-modal');
  ck('Deck selection modal exists in DOM', !!deckModal);
  ck('Deck selection modal is initially hidden', isHidden(deckModal));

  // Open modal via function or New Game button
  w.uiOpenDeckSelectModal();
  ck('uiOpenDeckSelectModal() reveals deck selection modal', !isHidden(deckModal));

  const grid = $('ui-deck-select-grid');
  ck('Deck select grid element exists', !!grid);
  ck('Grid renders Standard Deck card', grid.innerHTML.includes('Standard Deck'));
  ck('Grid renders The Revolt card', grid.innerHTML.includes('The Revolt'));

  // Medal verification:
  // Standard has beaten Bronze (🥉), Silver (🥈), Gold (🥇)
  // The Revolt has beaten Bronze (🥉) only
  ck('Grid displays Bronze medal 🥉 for Standard Deck', grid.innerHTML.includes('🥉'));
  ck('Grid displays Silver medal 🥈 for Standard Deck', grid.innerHTML.includes('🥈'));
  ck('Grid displays Gold medal 🥇 for Standard Deck', grid.innerHTML.includes('🥇'));

  // Locked verification:
  // The Revolt Gold is locked: must show locked symbol 🔒 next to greyed out difficulty text
  const lockedDiffCards = grid.querySelectorAll('.diff-level-card.locked');
  ck('Locked difficulty cards exist in grid', lockedDiffCards.length > 0);
  const firstLocked = lockedDiffCards[0];
  ck('Locked card contains lock symbol 🔒', firstLocked.innerHTML.includes('🔒') || firstLocked.querySelector('.diff-lock-icon'));
  ck('Locked card has locked class with greyed out name', !!firstLocked.querySelector('.diff-name.locked'));

  // Unlocked selection
  w.uiSelectDeck('the_revolt');
  w.uiSelectDifficulty('the_revolt', 'bronze');
  const startBtn = $('btn-deck-select-start');
  ck('Start Run button exists in deck select modal', !!startBtn);

  // Confirm selection starts the game with The Revolt on Bronze
  w.uiConfirmDeckSelection();
  ck('Deck modal is hidden after starting run', isHidden(deckModal));
  ck('Active deck in gameState is "the_revolt"', w.getState().activeDeckId === 'the_revolt');
  ck('Active difficulty in gameState is "bronze"', w.getState().activeDifficultyId === 'bronze');
  ck('The Revolt starting deck has exactly 40 cards', w.getState().deck.length === 40);

  // Verify top HUD clean on mobile: ui-deck-indicator removed to avoid horizontal overflow
  ck('Top HUD header does NOT have overflowing deck indicator', !$('ui-deck-indicator'));

  // Info button in HUD
  const infoBtn = $('btn-vouchers-hud');
  ck('HUD info button exists in header', !!infoBtn);
  ck('HUD info button displays ℹ️ symbol', infoBtn.textContent.includes('ℹ'));

  // Open Run Info modal and verify deck and difficulty are displayed
  w.openRunInfoModal();
  const infoModal = $('ui-vouchers-modal');
  ck('Run info modal is opened', !isHidden(infoModal));
  ck('Run info modal displays active deck (The Revolt)', $('ui-run-info-deck-diff').textContent.includes('The Revolt'));
  ck('Run info modal displays active difficulty (Bronze) with medal 🥉', $('ui-run-info-deck-diff').textContent.includes('Bronze') && $('ui-run-info-deck-diff').textContent.includes('🥉'));
  w.toggleVouchersModal(false);
  ck('Closing info modal hides it', isHidden(infoModal));

  // 6. DEFEAT & VICTORY NEW GAME FLOW
  console.log('\n--- 6. RESTART / NEW GAME NAVIGATION ---');
  // Trigger defeat restart
  w.uiRestartFromDefeat();
  ck('uiRestartFromDefeat() opens deck selection modal', !isHidden(deckModal));
  ck('uiRestartFromDefeat() resets ante to 1', w.getState().ante === 1);

  // Close modal
  w.uiCloseDeckSelectModal();

  // Trigger victory restart
  w.uiRestartFromVictory();
  ck('uiRestartFromVictory() opens deck selection modal', !isHidden(deckModal));

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0 || errors.length > 0) {
    if (errors.length > 0) console.error('Encountered errors during test:', errors);
    process.exit(1);
  } else {
    console.log('SUCCESS: All 54 Unique Decks & Difficulty checks passed cleanly!\n');
    process.exit(0);
  }
})().catch(err => {
  console.error('Fatal error during test:', err); console.error(err.stack);
  process.exit(1);
});
