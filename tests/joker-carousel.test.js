// Comprehensive test suite for Active Joker 3D Carousel & In-Game Reordering
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

  console.log('\n--- TEST 1: JOKER CAROUSEL MODAL DOM ELEMENTS ---');
  w.startNewRun();

  const modal = $('ui-joker-carousel-modal');
  const stage = $('ui-joker-carousel-stage');
  const prevBtn = $('btn-joker-prev');
  const nextBtn = $('btn-joker-next');
  const prevFootBtn = $('btn-joker-prev-foot');
  const nextFootBtn = $('btn-joker-next-foot');
  const dots = $('ui-joker-dots');
  const hint = $('ui-joker-nav-hint');

  ck('Joker carousel modal exists in DOM', !!modal);
  ck('Joker carousel stage exists in DOM', !!stage);
  ck('Left nav chevron exists in DOM', !!prevBtn);
  ck('Right nav chevron exists in DOM', !!nextBtn);
  ck('Prev footer button exists in DOM', !!prevFootBtn);
  ck('Next footer button exists in DOM', !!nextFootBtn);
  ck('Dots container exists in DOM', !!dots);
  ck('Nav hint exists in DOM', !!hint);
  ck('Modal initially hidden', isHidden(modal));

  console.log('\n--- TEST 2: OPENING JOKER CAROUSEL FROM PLAYFIELD ---');
  // Setup 3 active jokers in gameState
  w.patchState({
    jokers: [
      { id: 'vip_high_roller', name: 'VIP High Roller', archetype: 'mult', rarity: 'common', cost: 4, icon: '👑' },
      { id: 'the_gambler', name: 'The Gambler', archetype: 'mult', rarity: 'uncommon', cost: 6, icon: '🎲' },
      { id: 'chip_stacker', name: 'Chip Stacker', archetype: 'chips', rarity: 'common', cost: 5, icon: '🥞', bonusChips: 10 }
    ]
  });

  // Clicking joker at index 1 ("The Gambler")
  w.inspectJoker(1);
  await sleep(20);

  ck('Joker carousel modal is visible', !isHidden(modal));
  ck('Current active joker index initialized to 1', w.getCurrentJokerCarouselIndex() === 1);

  const cards = stage.querySelectorAll('.joker-carousel-card');
  ck('Stage contains exactly 3 active joker cards', cards.length === 3);

  // Card 1 must be active in center
  ck('Card 1 is pack-card-active', cards[1].classList.contains('pack-card-active'));
  ck('Card 0 is pack-card-prev', cards[0].classList.contains('pack-card-prev'));
  ck('Card 2 is pack-card-next', cards[2].classList.contains('pack-card-next'));

  // Trigger slot pills
  ck('Card 0 pill mentions Slot #1 of 3', cards[0].querySelector('.joker-order-pill').textContent.includes('Slot #1 of 3'));
  ck('Card 1 pill mentions Slot #2 of 3', cards[1].querySelector('.joker-order-pill').textContent.includes('Slot #2 of 3'));
  ck('Card 2 pill mentions Slot #3 of 3', cards[2].querySelector('.joker-order-pill').textContent.includes('Slot #3 of 3'));

  // Card 1 buttons
  const card1Moves = cards[1].querySelectorAll('.btn-joker-move');
  ck('Card 1 has Move Left button enabled', !card1Moves[0].disabled);
  ck('Card 1 has Move Right button enabled', !card1Moves[1].disabled);

  // Card 0 buttons
  const card0Moves = cards[0].querySelectorAll('.btn-joker-move');
  ck('Card 0 (first slot) has Move Left button disabled', card0Moves[0].disabled);
  ck('Card 0 has Move Right button enabled', !card0Moves[1].disabled);

  // Card 2 buttons
  const card2Moves = cards[2].querySelectorAll('.btn-joker-move');
  ck('Card 2 has Move Left button enabled', !card2Moves[0].disabled);
  ck('Card 2 (last slot) has Move Right button disabled', card2Moves[1].disabled);

  // Dots
  const dotEls = dots.querySelectorAll('.pack-dot');
  ck('Renders 3 pagination dots', dotEls.length === 3);
  ck('Dot 1 is marked active', dotEls[1].classList.contains('active'));

  console.log('\n--- TEST 3: REORDERING JOKER FOR SCORING BENEFITS ---');
  // Currently The Gambler is at slot 1. Move it to the right (slot 2) so it triggers after Chip Stacker
  w.uiMoveJokerInCarousel(1);
  await sleep(20);

  let stateJokers = w.getState().jokers;
  ck('The Gambler moved to index 2 in state.jokers', stateJokers[2].id === 'the_gambler');
  ck('Chip Stacker moved to index 1 in state.jokers', stateJokers[1].id === 'chip_stacker');
  ck('Active carousel index updated to 2', w.getCurrentJokerCarouselIndex() === 2);

  const updatedCards = stage.querySelectorAll('.joker-carousel-card');
  ck('Active card (index 2) is still The Gambler', updatedCards[2].querySelector('.pack-opt-title').textContent.includes('The Gambler'));
  ck('Active card has pack-card-active class', updatedCards[2].classList.contains('pack-card-active'));
  ck('Active card trigger pill now shows Slot #3 of 3', updatedCards[2].querySelector('.joker-order-pill').textContent.includes('Slot #3 of 3'));

  const activeMoves = updatedCards[2].querySelectorAll('.btn-joker-move');
  ck('Active card Move Right button is now disabled (at end)', activeMoves[1].disabled);
  ck('Active card Move Left button is enabled', !activeMoves[0].disabled);

  // Move it left twice all the way to slot 0
  w.uiMoveJokerInCarousel(-1);
  await sleep(10);
  w.uiMoveJokerInCarousel(-1);
  await sleep(10);

  stateJokers = w.getState().jokers;
  ck('The Gambler is now at index 0 (first slot)', stateJokers[0].id === 'the_gambler');
  ck('Active carousel index updated to 0', w.getCurrentJokerCarouselIndex() === 0);

  const cardsAt0 = stage.querySelectorAll('.joker-carousel-card');
  const movesAt0 = cardsAt0[0].querySelectorAll('.btn-joker-move');
  ck('The Gambler Move Left button is now disabled (at start)', movesAt0[0].disabled);
  ck('The Gambler Move Right button is enabled', !movesAt0[1].disabled);

  console.log('\n--- TEST 4: BROWSING CARDS (SWIPING & ARROWS) ---');
  // Browse to next card without changing order
  w.uiJokerCarouselNavNext();
  await sleep(10);
  ck('Carousel index advanced to 1', w.getCurrentJokerCarouselIndex() === 1);
  ck('state.jokers order remained unchanged', w.getState().jokers[0].id === 'the_gambler');

  // Jump to card 2 directly
  w.uiSetJokerCarouselActiveCard(2);
  await sleep(10);
  ck('Carousel index jumped to 2', w.getCurrentJokerCarouselIndex() === 2);

  console.log('\n--- TEST 5: SELLING JOKER IN CAROUSEL ---');
  const preMoney = w.getState().money;
  // Sell active card at index 2 (VIP High Roller, cost 4 -> sell value $2)
  w.uiSellJokerInCarousel(2);
  await sleep(20);

  ck('Money increased after selling joker', w.getState().money > preMoney);
  ck('state.jokers has 2 jokers remaining', w.getState().jokers.length === 2);
  ck('Modal remains open with remaining jokers', !isHidden(modal));
  ck('Carousel re-rendered with 2 cards', stage.querySelectorAll('.joker-carousel-card').length === 2);
  ck('Index adjusted to valid range (1)', w.getCurrentJokerCarouselIndex() <= 1);

  console.log('\n--- TEST 6: CLOSING CAROUSEL ---');
  w.closeJokerCarousel();
  await sleep(10);
  ck('Joker carousel modal is hidden after close', isHidden(modal));

  // Sell remaining jokers until 0 closes modal automatically
  w.inspectJoker(0);
  w.uiSellJokerInCarousel(0);
  w.uiSellJokerInCarousel(0);
  await sleep(20);

  ck('0 jokers left in inventory', w.getState().jokers.length === 0);
  ck('Modal closed automatically when 0 jokers left', isHidden(modal));

  // Print results
  console.log('\n--- ALL JOKER CAROUSEL TESTS COMPLETED ---');
  results.forEach(r => console.log(r));
  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length > 0 || errors.length > 0) {
    if (errors.length) console.error('Errors encountered:', errors);
    process.exit(1);
  }
})();
