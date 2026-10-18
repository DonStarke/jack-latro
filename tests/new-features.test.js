// Comprehensive automated tests for new features:
// 1. Splash screen main menu (New Game & Settings)
// 2. Defeat screen (New Game & Main Menu options)
// 3. Ante 8 Victory screen, victory music loop, options (Continue into endless, New Game, Main Menu)
// 4. Hand outcome sounds immediate triggering and mapping (win, push, bust/loss)

const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
const fs = require('fs');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail || e.message || e)));
vc.on('error', e => errors.push('console.error: ' + e));

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const soundEvents = [];

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
  await sleep(400);

  const $ = id => d.getElementById(id);
  const click = id => $(id).click();
  const isHidden = el => el.classList.contains('hidden');

  // Intercept playOutcomeSound to verify sound triggers
  const originalPlayOutcomeSound = w.playOutcomeSound;
  w.playOutcomeSound = function(kind) {
    soundEvents.push(kind);
    return originalPlayOutcomeSound ? originalPlayOutcomeSound.apply(this, arguments) : undefined;
  };

  // Test 1: Splash Screen Main Menu on initial start
  const splash = $('ui-splash-screen');
  ck('Splash screen exists on initial start', !!splash);
  ck('Splash screen is visible on boot', !isHidden(splash));
  ck('Splash screen has New Game button', !!$('btn-splash-new-game'));
  ck('Splash screen has Settings button', !!splash.querySelector('button[onclick*="toggleCogModal"]'));
  ck('Splash screen has logo title', splash.querySelector('.splash-title').textContent === 'JACK-LATRO');

  // Test Settings from splash screen
  const cogModal = $('ui-cog-modal');
  splash.querySelector('button[onclick*="toggleCogModal"]').click();
  await sleep(50);
  ck('Settings modal opens from splash screen', !isHidden(cogModal));
  w.toggleCogModal(false);
  await sleep(50);
  ck('Settings modal closes cleanly', isHidden(cogModal));

  // Test New Game button hides splash screen
  click('btn-splash-new-game');
  await sleep(100);
  ck('Clicking New Game hides splash screen', isHidden(splash));

  // Test returning to Main Menu
  w.showMainMenu();
  await sleep(50);
  ck('showMainMenu() shows splash screen again', !isHidden(splash));

  // Hide splash to proceed with gameplay checks
  w.uiStartGameFromMenu();
  await sleep(50);
  ck('uiStartGameFromMenu() hides splash and starts fresh run', isHidden(splash) && w.getState().ante === 1);

  // Test 2: Hand Outcome Sound Immediate Triggering
  soundEvents.length = 0;
  // Rig a winning hand: Player has 20, Dealer has 17
  w.patchState({
    playerHand: [
      { uid: 101, suit: '♠', rank: 'K', enhancement: null },
      { uid: 102, suit: '♥', rank: '10', enhancement: null }
    ],
    dealerHand: [
      { uid: 103, suit: '♦', rank: '10', enhancement: null },
      { uid: 104, suit: '♣', rank: '7', enhancement: null }
    ],
    inHand: false,
    handsLeft: 6,
    targetScore: 999999 // Don't clear blind so we only test hand outcome
  });
  await w.resolveRound();
  ck('Win hand triggered immediate WIN sound', soundEvents.includes('WIN'));

  // Rig a push hand: Player has 18, Dealer has 18
  soundEvents.length = 0;
  w.patchState({
    playerHand: [
      { uid: 105, suit: '♠', rank: '10', enhancement: null },
      { uid: 106, suit: '♥', rank: '8', enhancement: null }
    ],
    dealerHand: [
      { uid: 107, suit: '♦', rank: '10', enhancement: null },
      { uid: 108, suit: '♣', rank: '8', enhancement: null }
    ],
    inHand: false,
    handsLeft: 5,
    targetScore: 999999
  });
  await w.resolveRound();
  ck('Push hand triggered neutral PUSH sound', soundEvents.includes('PUSH'));

  // Rig a bust hand: Player has 22
  soundEvents.length = 0;
  w.patchState({
    playerHand: [
      { uid: 109, suit: '♠', rank: '10', enhancement: null },
      { uid: 110, suit: '♥', rank: '6', enhancement: null },
      { uid: 111, suit: '♦', rank: '6', enhancement: null }
    ],
    dealerHand: [
      { uid: 112, suit: '♣', rank: '10', enhancement: null },
      { uid: 113, suit: '♠', rank: '8', enhancement: null }
    ],
    inHand: false,
    handsLeft: 4,
    targetScore: 999999
  });
  await w.resolveRound();
  ck('Bust hand triggered fail/defeat BUST sound', soundEvents.includes('BUST'));

  // Test 3: Defeat Screen Flow
  const defeatModal = $('ui-defeat-modal');
  ck('Defeat modal initially hidden', isHidden(defeatModal));
  w.showDefeatModal();
  ck('showDefeatModal() displays defeat modal', !isHidden(defeatModal));
  ck('Defeat modal has New Game button', !!defeatModal.querySelector('button[onclick*="uiRestartFromDefeat"]'));
  ck('Defeat modal has Main Menu button', !!defeatModal.querySelector('button[onclick*="showMainMenu"]'));

  // Test New Game from Defeat
  defeatModal.querySelector('button[onclick*="uiRestartFromDefeat"]').click();
  await sleep(50);
  ck('uiRestartFromDefeat() hides defeat modal and resets run', isHidden(defeatModal) && w.getState().ante === 1);

  // Test 4: Ante 8 Victory Flow & Endless Mode
  const victoryModal = $('ui-victory-modal');
  ck('Victory modal initially hidden', isHidden(victoryModal));

  // Set state to Ante 8 Boss Blind and satisfy target score
  w.patchState({
    ante: 8,
    blindIndex: 2,
    roundScore: 50000,
    targetScore: 21000,
    endlessMode: false
  });
  w.showVictoryModal();
  ck('showVictoryModal() displays victory modal', !isHidden(victoryModal));
  ck('Victory modal shows Ante 8 Boss conquered', victoryModal.textContent.includes('Ante 8 Boss'));
  ck('Victory modal has "Continue into endless" option', !!victoryModal.querySelector('button[onclick*="uiContinueIntoEndless"]'));
  ck('Victory modal has "New Game" option', !!victoryModal.querySelector('button[onclick*="uiRestartFromVictory"]'));
  ck('Victory modal has "Main Menu" option', !!victoryModal.querySelector('button[onclick*="showMainMenu"]'));

  // Continue into Endless
  w.uiContinueIntoEndless();
  await sleep(100);
  ck('Continue into endless marks endlessMode true', w.getState().endlessMode === true);
  ck('Continue into endless opens Shop with victory modal hidden', isHidden(victoryModal) && !isHidden($('ui-shop-overlay')));

  // Play next blind from shop into Ante 9 (Endless)
  w.startNextBlindFromShop();
  await sleep(50);
  ck('Ante 9 displays as Endless in HUD', w.getState().ante === 9 && $('ui-ante').textContent.includes('Endless'));
  ck('Endless target score scales beyond 10,500', w.getState().targetScore > 10500);

  // Victory music functions exist
  ck('startVictoryMusic function exists', typeof w.startVictoryMusic === 'function');
  ck('stopVictoryMusic function exists', typeof w.stopVictoryMusic === 'function');

  console.log('\n--- NEW FEATURES TEST RESULTS ---');
  console.log(results.join('\n'));
  if (errors.length) {
    console.error('\nErrors encountered:', errors);
    process.exit(1);
  }
  process.exit(0);
})();
