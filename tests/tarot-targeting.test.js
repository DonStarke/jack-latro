// Automated tests for Tarot Card Selection and Targeting Mode:
// 1. Tarots enter targeting mode upon clicking Use
// 2. Outlines (.tarot-selectable) appear on eligible player cards
// 3. User can select ANY card in their hand to receive the tarot effect
// 4. Clicking outside the outline cancels the effect without consuming the tarot
// 5. Instant non-card tarots trigger immediately without entering targeting mode
// 6. Deck synchronization of enhancements, ranks, and card destruction

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
    win.addEventListener('error', e => errors.push('window.error: ' + e.message));
  }
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const ck = (n, v) => results.push((v ? 'ok   ' : 'FAIL ') + n);

(async () => {
  const w = dom.window, d = w.document;
  for (let i = 0; i < 60 && typeof w.uiStartGameFromMenu !== 'function'; i++) await sleep(50);

  const $ = id => d.getElementById(id);

  // Dismiss splash screen
  w.uiStartGameFromMenu();
  await sleep(50);

  console.log('\n--- TEST 1: TAROT TARGETING ACTIVATION & OUTLINES ---');

  // Deal a hand
  w.handlePrimaryDealBtn();
  while (w.getState().isDealing) await sleep(50);
  await sleep(50);

  const state = w.getState();
  ck('Hand is active and dealt', state.inHand && state.playerHand.length >= 2);

  // Give player a card-targeting tarot: Midas Touch
  state.consumables = [{ id: 'midas_touch', name: 'Midas Touch', cost: 3, desc: 'Enhance a selected card in hand to Gold' }];
  w.updateAllUI();

  // Tap tarot to inspect
  w.inspectConsumable(0);
  ck('Inspect modal visible', !$('ui-inspect-modal').classList.contains('hidden'));

  // Click Use Tarot Now
  w.uiUseConsumable(0);
  ck('Inspect modal closed on use', $('ui-inspect-modal').classList.contains('hidden'));
  ck('Tarot targeting is active', w.isTarotTargetingActive());
  ck('Target backdrop is visible', !$('ui-tarot-target-backdrop').classList.contains('hidden'));
  ck('Target backdrop displays title', $('ui-tarot-target-title').textContent.includes('MIDAS TOUCH'));
  ck('Target backdrop displays instruction hint', $('ui-tarot-target-hint').textContent.includes('Tap an outlined card'));

  const selectableCards = d.querySelectorAll('#ui-player-cards .playing-card.tarot-selectable');
  ck('All cards in hand have tarot-selectable class', selectableCards.length === state.playerHand.length);
  ck('Selectable card has TARGET badge', d.querySelector('.tarot-target-tag') !== null);

  console.log('\n--- TEST 2: CANCELLING OUTSIDE THE OUTLINE ---');

  // Cancel via cancel button or clicking outside
  w.cancelTarotTargeting();
  ck('Targeting is no longer active after cancel', !w.isTarotTargetingActive());
  ck('Backdrop is hidden after cancel', $('ui-tarot-target-backdrop').classList.contains('hidden'));
  ck('Cards no longer have tarot-selectable class', d.querySelectorAll('#ui-player-cards .playing-card.tarot-selectable').length === 0);
  ck('Tarot was NOT consumed on cancel', state.consumables.length === 1 && state.consumables[0].id === 'midas_touch');

  console.log('\n--- TEST 3: SELECTING A SPECIFIC MIDDLE CARD ---');

  // Ensure hand has 3 cards: Card 0, Card 1 (middle), Card 2
  while (state.playerHand.length < 3) {
    const card = { uid: w.takeNextCardUid(), rank: '7', suit: '♣', enhancement: null };
    w.addCardToDeck({ ...card });
    w.addCardToPlayerHand(card);
  }
  w.updateAllUI();

  const middleCard = state.playerHand[1];
  const middleCardUid = middleCard.uid;
  const leftCard = state.playerHand[0];
  const rightCard = state.playerHand[state.playerHand.length - 1];

  // Activate Midas Touch and target middle card
  w.uiUseConsumable(0);
  ck('Targeting active for middle card selection', w.isTarotTargetingActive());

  // Click middle card
  w.uiSelectCardForTarot(middleCardUid);
  ck('Targeting closed after selection', !w.isTarotTargetingActive());
  ck('Midas Touch consumed from inventory', state.consumables.length === 0);
  ck('Middle card received Gold enhancement', middleCard.enhancement === 'gold');
  ck('Left card was NOT modified', leftCard.enhancement !== 'gold');
  ck('Right card was NOT modified', rightCard.enhancement !== 'gold');

  const deckMiddleCard = state.deck.find(c => c.uid === middleCardUid);
  ck('Middle card Gold enhancement synced to deck', deckMiddleCard && deckMiddleCard.enhancement === 'gold');

  console.log('\n--- TEST 4: TARGETING WITH PRISM DYE (FOIL), LUCKY CHARM (HOLO), & POLY DYE ---');

  // Test Prism Dye on right card
  state.consumables = [{ id: 'wild_suit', name: 'Prism Dye', cost: 3, desc: 'Enhance selected card to Foil' }];
  w.uiUseConsumable(0);
  w.uiSelectCardForTarot(rightCard.uid);
  ck('Right card enhanced to Foil', rightCard.enhancement === 'foil');
  const deckRightCard = state.deck.find(c => c.uid === rightCard.uid);
  ck('Right card Foil synced to deck', deckRightCard && deckRightCard.enhancement === 'foil');

  // Test Lucky Charm on left card
  state.consumables = [{ id: 'lucky_charm', name: 'Lucky Charm', cost: 4, desc: 'Enhance selected card to Holo' }];
  w.uiUseConsumable(0);
  w.uiSelectCardForTarot(leftCard.uid);
  ck('Left card enhanced to Holo', leftCard.enhancement === 'holo');
  const deckLeftCard = state.deck.find(c => c.uid === leftCard.uid);
  ck('Left card Holo synced to deck', deckLeftCard && deckLeftCard.enhancement === 'holo');

  console.log('\n--- TEST 5: THE GUILLOTINE DESTROYS SELECTED CARD ---');

  const cardToDestroy = state.playerHand[1];
  const destroyUid = cardToDestroy.uid;
  const handLenBefore = state.playerHand.length;
  const deckLenBefore = state.deck.length;

  state.consumables = [{ id: 'the_guillotine', name: 'The Guillotine', cost: 4, desc: 'Permanently destroy a selected card' }];
  w.uiUseConsumable(0);
  w.uiSelectCardForTarot(destroyUid);
  w.uiConfirmTarotTargeting();

  ck('Player hand length reduced by 1', state.playerHand.length === handLenBefore - 1);
  ck('Destroyed card removed from player hand', !state.playerHand.some(c => c.uid === destroyUid));
  ck('Deck length reduced by 1', state.deck.length === deckLenBefore - 1);
  ck('Destroyed card permanently removed from deck', !state.deck.some(c => c.uid === destroyUid));

  console.log('\n--- TEST 6: INSTANT TAROTS BYPASS TARGETING ---');

  state.consumables = [{ id: 'x_ray', name: 'X-Ray Specs', cost: 3, desc: 'Reveal Dealer hole card' }];
  w.uiUseConsumable(0);
  ck('X-Ray Specs does NOT activate card targeting', !w.isTarotTargetingActive());
  ck('X-Ray Specs revealed dealer hole card', state.dealerHoleRevealed === true);
  ck('X-Ray Specs consumed', state.consumables.length === 0);

  state.consumables = [{ id: 'double_vision', name: 'Double Vision', cost: 3, desc: 'Apply Double Down' }];
  w.uiUseConsumable(0);
  ck('Double Vision does NOT activate card targeting', !w.isTarotTargetingActive());
  ck('Double Vision doubled hand down', state.doubledDown === true);
  ck('Double Vision consumed', state.consumables.length === 0);

  console.log('\n--- ALL TAROT TARGETING TESTS COMPLETED ---');
  results.forEach(r => console.log(r));

  const fails = results.filter(r => r.startsWith('FAIL'));
  if (fails.length > 0) {
    console.error(`\nFAILED: ${fails.length} checks failed.`);
    process.exit(1);
  } else {
    console.log(`\nSUCCESS: All ${results.length} checks passed cleanly!`);
    process.exit(0);
  }
})();
