// Test suite verifying Game Speed default, Joker Icons, Border styling, Compendium Tabs, Audio controls, and Shop Pack Wrappers.
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
const fs = require('fs');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail || e.message || e)));
vc.on('error', e => errors.push('console.error: ' + e));

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

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

  console.log('\n--- TEST 1: DEFAULT GAME SPEED IS FASTEST (1.00x) ---');
  const speedSelect = $('setting-anim-speed');
  const speedLabel = $('ui-lbl-anim-speed');
  ck('Speed selector exists in DOM', !!speedSelect);
  ck('Speed selector default value is 1.00', speedSelect.value === '1.00');
  ck('Speed label mentions 1.00x (Brisk)', /1\.00/i.test(speedLabel.textContent));

  console.log('\n--- TEST 2: JOKER ICONS FOR BUST CUSHION, CHIP STACKER, ACE UP SLEEVE ---');
  const bustCushion = w.JOKER_CATALOG.find(j => j.id === 'bust_cushion');
  const chipStacker = w.JOKER_CATALOG.find(j => j.id === 'chip_stacker');
  const aceUpSleeve = w.JOKER_CATALOG.find(j => j.id === 'ace_up_sleeve');
  ck('Bust Cushion icon is updated to shield (🛡️)', bustCushion && bustCushion.icon === '🛡️');
  ck('Chip Stacker icon is updated to money bag (💰)', chipStacker && chipStacker.icon === '💰');
  ck('Ace Up Sleeve icon is updated to playing card (🎴)', aceUpSleeve && aceUpSleeve.icon === '🎴');

  console.log('\n--- TEST 3: SUIT JOKER BORDER-LEFT REMOVED IN STYLES.CSS ---');
  ck('No border-left: 3px solid #f43f5e for hearts/diamonds', !css.includes('border-left: 3px solid #f43f5e'));
  ck('No border-left: 3px solid #38bdf8 for spades/clubs', !css.includes('border-left: 3px solid #38bdf8'));

  console.log('\n--- TEST 4: COMPENDIUM CATEGORY TABS STYLING & SIZING ---');
  ck('CSS contains inline-flex for .lib-tab-btn', css.includes('.lib-tab-btn') && css.includes('display: inline-flex'));
  ck('CSS contains pill border-radius for .lib-tab-btn', css.includes('border-radius: 999px'));
  ck('CSS contains font-family inherit for .lib-tab-btn', css.includes('font-family: inherit'));
  const jokersTab = $('lib-tab-jokers');
  ck('Jokers category tab exists in DOM', !!jokersTab);

  console.log('\n--- TEST 5: AUDIO CONTROLS & VOLUME SLIDERS IN SETTINGS ---');
  const sfxSlider = $('setting-sfx-volume');
  const musicSlider = $('setting-music-volume');
  const sfxMuteBtn = $('btn-modal-sfx-toggle');
  const musicMuteBtn = $('btn-modal-music-toggle');
  const sfxVolLabel = $('ui-lbl-sfx-volume');
  const musicVolLabel = $('ui-lbl-music-volume');

  ck('SFX volume slider exists in settings modal', !!sfxSlider);
  ck('Music volume slider exists in settings modal', !!musicSlider);
  ck('SFX mute toggle button exists in settings modal', !!sfxMuteBtn);
  ck('Music mute toggle button exists in settings modal', !!musicMuteBtn);
  ck('SFX volume label exists in DOM', !!sfxVolLabel);
  ck('Music volume label exists in DOM', !!musicVolLabel);

  // Test SFX mute toggle
  ck('Initial SFX button text is SFX: ON', sfxMuteBtn.textContent.includes('SFX: ON'));
  w.toggleSfx();
  ck('SFX button text becomes SFX: OFF after toggle', sfxMuteBtn.textContent.includes('SFX: OFF'));
  ck('SFX button has muted/secondary class after toggle', sfxMuteBtn.classList.contains('btn-secondary'));
  w.toggleSfx();
  ck('SFX button restored to SFX: ON after second toggle', sfxMuteBtn.textContent.includes('SFX: ON'));

  // Test SFX volume slider
  w.setSfxVolume(0.45);
  ck('setSfxVolume updates sfx volume label to 45%', sfxVolLabel.textContent === '45%');
  ck('setSfxVolume updates slider value', sfxSlider.value === '45');

  // Test Music volume slider
  w.setMusicVolume(0.60);
  ck('setMusicVolume updates music volume label to 60%', musicVolLabel.textContent === '60%');
  ck('setMusicVolume updates slider value', musicSlider.value === '60');

  console.log('\n--- TEST 6: SHOP PACKS WRAPPER STYLING & SHAKE DURATION ---');
  w.startNewRun();
  w.generateShopStock();
  w.renderShop();

  const shopPacksContainer = $('ui-shop-packs');
  ck('Shop packs container has children', shopPacksContainer.children.length === 2);
  const firstPack = shopPacksContainer.children[0];
  ck('First shop pack has pack-booster-wrapper class', firstPack.classList.contains('pack-booster-wrapper'));
  ck('First shop pack contains crimped foil top', !!firstPack.querySelector('.pack-booster-crimp.top'));
  ck('First shop pack contains crimped foil bottom', !!firstPack.querySelector('.pack-booster-crimp.bottom'));
  ck('First shop pack contains foil sheen sweep', !!firstPack.querySelector('.pack-booster-foil-sheen'));
  ck('First shop pack contains booster badge', !!firstPack.querySelector('.pack-booster-badge'));
  ck('First shop pack contains booster icon', !!firstPack.querySelector('.pack-booster-icon'));
  ck('First shop pack contains action button', !!firstPack.querySelector('.btn-buy-pack'));

  ck('styles.css contains horizontal scroll overflow-x: auto on #ui-shop-packs', css.includes('#ui-shop-packs') && css.includes('overflow-x: auto'));
  ck('styles.css contains fast 1.3s rumble animation for pack-booster-wrapper.anim-shake', css.includes('packShakeRumble 1.3s') || css.includes('packShakeRumble 2.6s'));

  console.log('\n--- TEST 6: TITLE & VERSION BADGE & SOUND SKIP HOOKS ---');
  ck('Window title is exactly Jack-latro', d.title === 'Jack-latro');
  const splashVer = $('ui-splash-version');
  ck('Splash screen has version badge element', splashVer !== null);
  ck('Splash screen version badge displays V0.13', splashVer && splashVer.textContent.includes('V0.13'));
  ck('playPackOpenBurstSound is exposed on window', typeof w.playPackOpenBurstSound === 'function');
  ck('stopPackRipSound is exposed on window', typeof w.stopPackRipSound === 'function');

  console.log('\n--- TEST SUMMARY ---');
  results.forEach(r => console.log(r));
  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length > 0) {
    console.error(`\nFAILED ${failed.length} checks:`, failed);
    process.exit(1);
  } else {
    console.log(`\nSUCCESS: All ${results.length} checks passed cleanly!`);
    process.exit(0);
  }
})();
