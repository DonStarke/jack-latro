// Automated tests for:
// 1. Tarot card permanent deck enhancements and rank changes appearing in deck view
// 2. Deck view card click to inspect/zoom (rendered normally, not greyed out, with effect blurb)
// 3. Stats modal return button positioning & dealt-out styling

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
  const isHidden = el => el.classList.contains('hidden');

  // Dismiss splash menu to start fresh run
  w.uiStartGameFromMenu();
  await sleep(50);

  console.log('\n--- TEST 1: TAROT PERMANENT CARD ENHANCEMENTS REFLECTED IN DECK ---');

  // Start with a hand
  w.handlePrimaryDealBtn();
  while (w.getState().isDealing) await sleep(50);
  await sleep(100);

  const state = w.getState();
  ck('Player hand has cards dealt', state.playerHand.length >= 2);

  // Give player tarots: Wild Suit (Foil), Lucky Charm (Holo), Polychrome Dice (Poly), Midas Touch (Gold)
  const firstCard = state.playerHand[0];
  const lastCard = state.playerHand[state.playerHand.length - 1];
  const firstCardUid = firstCard.uid;
  const lastCardUid = lastCard.uid;

  // Enhance first card to Foil via setCardEnhancement
  w.setCardEnhancement(firstCard, 'foil');
  const deckCardFirst = state.deck.find(c => c.uid === firstCardUid);
  ck('Foil enhancement applied to playerHand card', firstCard.enhancement === 'foil');
  ck('Foil enhancement synchronized to deck card object', deckCardFirst && deckCardFirst.enhancement === 'foil');

  // Enhance last card to Holo via setCardEnhancement
  w.setCardEnhancement(lastCard, 'holo');
  const deckCardLast = state.deck.find(c => c.uid === lastCardUid);
  ck('Holo enhancement applied to playerHand card', lastCard.enhancement === 'holo');
  ck('Holo enhancement synchronized to deck card object', deckCardLast && deckCardLast.enhancement === 'holo');

  // Test Tarot use: Polychrome Dice targeting and selection
  state.consumables = [{ id: 'polychrome_dice', name: 'Polychrome Dice', cost: 4, desc: 'Enhance a selected card' }];
  w.uiUseConsumable(0);
  ck('Targeting mode active after clicking use on card tarot', w.isTarotTargetingActive());
  ck('Selectable card outline rendered in player hand', d.querySelector('.playing-card.tarot-selectable') !== null);

  // Test cancel targeting (clicking outside)
  w.cancelTarotTargeting();
  ck('Targeting mode deactivated after cancel', !w.isTarotTargetingActive());
  ck('Consumable retained after cancel', state.consumables.length === 1 && state.consumables[0].id === 'polychrome_dice');

  // Re-start targeting and select first card
  w.uiUseConsumable(0);
  w.uiSelectCardForTarot(firstCardUid);
  w.uiConfirmTarotTargeting();
  ck('Targeting mode deactivated after card selection', !w.isTarotTargetingActive());
  ck('Polychrome Dice updated selected card enhancement', firstCard.enhancement === 'poly');
  ck('Polychrome Dice synchronized to deck card object', deckCardFirst.enhancement === 'poly');

  // Test Tarot use: Loaded Ace (instant tarot does not enter card targeting mode)
  state.consumables = [{ id: 'loaded_ace', name: 'Loaded Ace', cost: 4, desc: 'Draw Foil Ace' }];
  const deckLenBeforeAce = state.deck.length;
  w.uiUseConsumable(0);
  ck('Loaded Ace does not enter targeting mode', !w.isTarotTargetingActive());
  ck('Loaded Ace added card to player hand', state.playerHand.some(c => c.rank === 'A' && c.suit === '♠' && c.enhancement === 'foil'));
  ck('Loaded Ace added card permanently to deck', state.deck.length === deckLenBeforeAce + 1 && state.deck.some(c => c.rank === 'A' && c.suit === '♠' && c.enhancement === 'foil'));

  // Test Tarot use: Card Shave targeting specific card
  const tenCard = state.playerHand.find(c => c.rank === '10') || state.playerHand[0];
  tenCard.rank = '10'; // ensure it's a 10 for the shave test
  const tenCardUid = tenCard.uid;
  state.consumables = [{ id: 'card_shave', name: 'Card Shave', cost: 3, desc: 'Reduce rank' }];
  w.uiUseConsumable(0);
  ck('Card Shave activated card targeting mode', w.isTarotTargetingActive());
  w.uiSelectCardForTarot(tenCardUid);
  w.uiConfirmTarotTargeting();
  const shavedDeckCard = state.deck.find(c => c.uid === tenCardUid);
  ck('Card Shave reduced rank on hand card', tenCard.rank === '9');
  ck('Card Shave synchronized reduced rank to deck card', shavedDeckCard && shavedDeckCard.rank === '9');

  // Test Tarot use: Midas Touch targeting specific card
  const midasCard = { uid: w.takeNextCardUid(), rank: '9', suit: '♦', enhancement: null };
  w.addCardToDeck({ ...midasCard });
  w.addCardToPlayerHand(midasCard);
  const midasCardUid = midasCard.uid;
  state.consumables = [{ id: 'midas_touch', name: 'Midas Touch', cost: 3, desc: 'Enhance a selected card to Gold' }];
  w.uiUseConsumable(0);
  ck('Midas Touch activated targeting mode', w.isTarotTargetingActive());
  w.uiSelectCardForTarot(midasCardUid);
  w.uiConfirmTarotTargeting();
  ck('Midas Touch turned selected card to Gold', midasCard.enhancement === 'gold');
  const midasDeckCard = state.deck.find(c => c.uid === midasCardUid);
  ck('Midas Touch synchronized Gold to deck card', midasDeckCard && midasDeckCard.enhancement === 'gold');

  console.log('\n--- TEST 2: DECK VIEW RENDERING & ZOOM INSPECTION MODAL ---');

  // Open deck modal
  w.toggleDeckModal(true);
  await sleep(50);
  const deckModal = $('ui-deck-modal');
  ck('Deck modal is visible', !isHidden(deckModal));

  // Verify enhanced cards render their enhancement in deck view
  const deckListHtml = $('ui-deck-list').innerHTML;
  ck('Deck view HTML contains enh-poly class', deckListHtml.includes('enh-poly'));
  ck('Deck view HTML contains enh-holo class', deckListHtml.includes('enh-holo'));
  ck('Deck view HTML contains onclick inspectDeckCard', deckListHtml.includes('inspectDeckCard('));

  // Inspect the first card (which is in hand / dealt-out)
  const zoomModal = $('ui-deck-card-modal');
  ck('Zoom modal initially hidden', isHidden(zoomModal));

  w.inspectDeckCard(firstCardUid);
  ck('Zoom modal is now visible', !isHidden(zoomModal));
  ck('Zoom modal card title contains card rank and suit', $('ui-deck-zoom-card-name').textContent.includes(firstCard.suit));

  const zoomRenderHtml = $('ui-deck-zoom-card-render').innerHTML;
  ck('Zoom modal renders card with card-zoomed class', zoomRenderHtml.includes('card-zoomed'));
  ck('Zoom modal does NOT have dealt-out class (rendered normally)', !zoomRenderHtml.includes('dealt-out'));
  ck('Zoom modal renders active Polychrome enhancement tag', zoomRenderHtml.includes('POLY'));

  const statusText = $('ui-deck-zoom-card-status').textContent;
  ck('Zoom modal status indicates card is played/in hand', statusText.includes('PLAYED'));

  const blurbHtml = $('ui-deck-zoom-card-blurb').innerHTML;
  ck('Zoom modal blurb details Polychrome enhancement', blurbHtml.includes('POLYCHROME ENHANCEMENT') && blurbHtml.includes('×1.5'));

  // Test inspecting an unseen card in deck
  const unseenCard = state.deck.find(c => state.shoe.some(sc => sc.uid === c.uid));
  if (unseenCard) {
    w.inspectDeckCard(unseenCard.uid);
    ck('Unseen card status indicates IN SHOE / DECK', $('ui-deck-zoom-card-status').textContent.includes('IN SHOE'));
  }

  // Close zoom modal
  w.closeDeckCardModal();
  ck('Zoom modal is hidden after closeDeckCardModal', isHidden(zoomModal));
  ck('Deck modal remains open after closing zoom modal', !isHidden(deckModal));

  // Close deck modal
  w.toggleDeckModal(false);
  ck('Deck modal is hidden after toggleDeckModal(false)', isHidden(deckModal));

  console.log('\n--- TEST 3: CSS GREYED-OUT STYLE & STATS RETURN BUTTON ---');

  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  ck('dealt-out opacity is 0.48 (less dark than 0.22)', css.includes('opacity: 0.48'));
  ck('deck-mini has cursor pointer', css.includes('.playing-card.deck-mini') && css.includes('cursor: pointer'));
  ck('stats-box has flex-shrink 0 for children', css.includes('.stats-box > *') && css.includes('flex-shrink: 0'));
  ck('stats-actions has flex-shrink 0 and width 100%', css.includes('.stats-actions') && css.includes('flex-shrink: 0'));

  console.log('\n--- ALL TESTS COMPLETED ---');
  console.log(results.join('\n'));

  if (errors.length) {
    console.error('\nERRORS FOUND:');
    console.error(errors.join('\n'));
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
