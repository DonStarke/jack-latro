// Comprehensive test suite for Booster Pack Opening Animation and 3D Carousel Navigation
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
  const isHidden = el => el.classList.contains('hidden');

  console.log('\n--- TEST 1: BOOSTER PACK OPENING ANIMATION ELEMENTS ---');
  w.startNewRun();
  w.patchState({
    money: 30,
    shopPacks: [{ id: 'pack_joker', name: 'Joker Pack', packType: 'joker', cost: 4, cardsCount: 3, chooseCount: 1, desc: '', shopType: 'pack', bought: false }]
  });

  const boosterContainer = $('ui-pack-booster-container');
  const boosterWrapper = $('ui-pack-booster-wrapper');
  const burstFlash = $('ui-pack-burst-flash');
  const prevBtn = $('btn-pack-prev');
  const nextBtn = $('btn-pack-next');
  const navHint = $('ui-pack-nav-hint');

  ck('Booster anim container exists in DOM', !!boosterContainer);
  ck('Booster anim wrapper exists in DOM', !!boosterWrapper);
  ck('Burst flash ring exists in DOM', !!burstFlash);
  ck('Left nav chevron exists in DOM', !!prevBtn);
  ck('Right nav chevron exists in DOM', !!nextBtn);
  ck('Prev and Next footer buttons removed from pack overlay', !$('btn-pack-prev-foot') && !$('btn-pack-next-foot'));
  ck('Pagination dots removed from pack overlay', !$('ui-pack-dots'));
  ck('Navigation hint exists in DOM', !!navHint);

  console.log('\n--- TEST 2: PACK BUYING & INITIAL CARD FOCUS ---');
  w.uiBuyPack(0);
  await sleep(50);

  ck('Pack overlay is open', !isHidden($('ui-pack-overlay')));
  ck('Current active card index initialized to 0', w.getCurrentPackPackIndex ? w.getCurrentPackPackIndex() === 0 : w.getCurrentPackCardIndex() === 0);

  const stage = $('ui-pack-stage');
  const cards = stage.querySelectorAll('.pack-option-card');
  ck('Stage contains exactly 3 card options', cards.length === 3);

  // Card 0 must be active
  ck('Card 0 has pack-card-active class', cards[0].classList.contains('pack-card-active'));
  ck('Card 1 has pack-card-next class', cards[1].classList.contains('pack-card-next'));
  ck('Card 2 has pack-card-far-next class', cards[2].classList.contains('pack-card-far-next'));

  // Left arrow should be disabled initially (at index 0)
  ck('Left nav arrow is disabled on first card', prevBtn.classList.contains('disabled'));
  ck('Right nav arrow is enabled on first card', !nextBtn.classList.contains('disabled'));
  ck('Hint indicates Card 1 of 3', navHint.textContent.includes('Card 1 of 3'));

  console.log('\n--- TEST 3: SCROLLING TO NEXT CARD (SWIPE / RIGHT CLICK) ---');
  // Click Next button or call uiPackNavNext
  w.uiPackNavNext();
  await sleep(20);

  ck('Current active card index advanced to 1', w.getCurrentPackCardIndex() === 1);
  ck('Card 0 moved to pack-card-prev', cards[0].classList.contains('pack-card-prev'));
  ck('Card 1 is now pack-card-active', cards[1].classList.contains('pack-card-active'));
  ck('Card 2 moved to pack-card-next', cards[2].classList.contains('pack-card-next'));
  ck('Left nav arrow is now enabled', !prevBtn.classList.contains('disabled'));
  ck('Right nav arrow remains enabled', !nextBtn.classList.contains('disabled'));
  ck('Hint indicates Card 2 of 3', navHint.textContent.includes('Card 2 of 3'));

  console.log('\n--- TEST 4: SCROLLING TO THIRD CARD ---');
  w.uiPackNavNext();
  await sleep(20);

  ck('Current active card index advanced to 2', w.getCurrentPackCardIndex() === 2);
  ck('Card 0 is now pack-card-far-prev', cards[0].classList.contains('pack-card-far-prev'));
  ck('Card 1 is now pack-card-prev', cards[1].classList.contains('pack-card-prev'));
  ck('Card 2 is now pack-card-active', cards[2].classList.contains('pack-card-active'));
  ck('Left nav arrow is enabled', !prevBtn.classList.contains('disabled'));
  ck('Right nav arrow is now disabled on last card', nextBtn.classList.contains('disabled'));
  ck('Hint indicates Card 3 of 3', navHint.textContent.includes('Card 3 of 3'));

  // Attempting to advance past the end does nothing
  w.uiPackNavNext();
  ck('Cannot advance beyond index 2', w.getCurrentPackCardIndex() === 2);

  console.log('\n--- TEST 5: SCROLLING BACK (SWIPE RIGHT / LEFT CLICK) ---');
  w.uiPackNavPrev();
  await sleep(20);

  ck('Navigated back to index 1', w.getCurrentPackCardIndex() === 1);
  ck('Card 1 is pack-card-active again', cards[1].classList.contains('pack-card-active'));

  w.uiPackNavPrev();
  await sleep(20);

  ck('Navigated back to index 0', w.getCurrentPackCardIndex() === 0);
  ck('Card 0 is pack-card-active again', cards[0].classList.contains('pack-card-active'));
  ck('Left nav arrow is disabled again on index 0', prevBtn.classList.contains('disabled'));

  console.log('\n--- TEST 6: DIRECT BACKGROUND CARD CLICK & JUMP TO CARD ---');
  // Clicking card 2 directly from background
  w.uiClickPackCard(2);
  await sleep(20);
  ck('Clicking card 2 directly brought it to active focus', w.getCurrentPackCardIndex() === 2);
  ck('Card 2 is pack-card-active', cards[2].classList.contains('pack-card-active'));

  // Programmatic jump to card 0 via uiSetPackActiveCard
  w.uiSetPackActiveCard(0);
  await sleep(20);
  ck('uiSetPackActiveCard(0) directly brought card 0 into active focus', w.getCurrentPackCardIndex() === 0);
  ck('Card 0 is pack-card-active', cards[0].classList.contains('pack-card-active'));

  console.log('\n--- TEST 7: CHOOSING ACTIVE CARD ADDS TO INVENTORY ---');
  const activeJoker = w.getState().activePackOpening.options[0].data;
  w.uiChoosePackOption(0);
  await sleep(50);

  ck('Overlay closed after choosing card', isHidden($('ui-pack-overlay')));
  ck('Chosen joker present in player jokers', w.getState().jokers.some(j => j.id === activeJoker.id));

  console.log('\n--- ALL PACK CAROUSEL & ANIMATION TESTS COMPLETED ---');
  for (const r of results) console.log(r);

  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length > 0 || errors.length > 0) {
    if (errors.length) console.error('Errors encountered:', errors);
    process.exit(1);
  }
})();
