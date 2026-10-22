// Automated test suite for New Tarots & Multi-Card Picker Mechanics
// Verifies:
// 1. Multi-card card picker in Tarot pack opening screen (picking 1, 2, or 3 cards)
// 2. Card Forge (+1 rank, up to 2 cards)
// 3. Card Shave (-1 rank, up to 2 cards, in tarot pack instead of cheat pack)
// 4. The Guillotine (destroy up to 2 cards)
// 5. The Lovers / Wild Suit (★ counts as any suit for suit jokers & monochrome)
// 6. 4 Suit Tarots (The Sun, The Star, The Moon, The World - up to 3 cards each)
// 7. Judgement (Random Joker if space available, blocked if full)
// 8. Nostradamus (Creates last tarot used, shows name, blocked if last was Nostradamus or none)

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

  console.log('\n--- TEST 1: CATALOG VERIFICATION ---');
  const deckTarotIds = (w.DECK_TAROT_CATALOG || []).map(t => t.id);
  const cheatIds = (w.CHEAT_CATALOG || []).map(c => c.id);

  ck('Card Shave is in DECK_TAROT_CATALOG', deckTarotIds.includes('card_shave'));
  ck('Card Shave is NOT in CHEAT_CATALOG', !cheatIds.includes('card_shave'));
  ck('The Lovers is in DECK_TAROT_CATALOG', deckTarotIds.includes('the_lovers'));
  ck('The Sun is in DECK_TAROT_CATALOG', deckTarotIds.includes('the_sun'));
  ck('The Star is in DECK_TAROT_CATALOG', deckTarotIds.includes('the_star'));
  ck('The Moon is in DECK_TAROT_CATALOG', deckTarotIds.includes('the_moon'));
  ck('The World is in DECK_TAROT_CATALOG', deckTarotIds.includes('the_world'));
  ck('Judgement is in DECK_TAROT_CATALOG', deckTarotIds.includes('judgement'));
  ck('Nostradamus is in DECK_TAROT_CATALOG', deckTarotIds.includes('nostradamus'));

  console.log('\n--- TEST 2: TAROT PACK MULTI-CARD PICKER FUNCTIONALITY ---');
  // Open a custom Tarot Pack offering The Sun (up to 3 cards) and Card Forge (up to 2 cards)
  const theSun = w.DECK_TAROT_CATALOG.find(t => t.id === 'the_sun');
  const cardForge = w.DECK_TAROT_CATALOG.find(t => t.id === 'card_forge');
  const testDeckCards = [
    { uid: 901, rank: '5', suit: '♠', enhancement: null },
    { uid: 902, rank: '7', suit: '♣', enhancement: null },
    { uid: 903, rank: '9', suit: '♦', enhancement: null },
    { uid: 904, rank: 'J', suit: '♠', enhancement: null },
    { uid: 905, rank: 'Q', suit: '♣', enhancement: null }
  ];

  w.patchState({
    deck: testDeckCards.map(c => ({ ...c })),
    activePackOpening: {
      pack: { id: 'pack_tarot', name: 'Tarot Pack', packType: 'tarot', cost: 4, cardsCount: 2, chooseCount: 1, desc: '', shopType: 'pack', bought: false },
      options: [
        { kind: 'tarot', data: theSun },
        { kind: 'tarot', data: cardForge }
      ],
      chosen: false,
      deckCards: testDeckCards.map(c => ({ ...c })),
      selectedDeckCardUid: null,
      selectedDeckCardUids: []
    }
  });

  const overlay = $('ui-pack-overlay');
  overlay.classList.remove('hidden');
  w.renderPackOpeningScreen(false);
  w.renderPackDeckHand();

  const tarotBtn0 = () => $('ui-pack-stage').querySelector('.pack-option-card[data-opt-idx="0"] .btn-pack-choose');
  ck('When 0 cards selected, button is disabled', tarotBtn0() && tarotBtn0().disabled === true);
  ck('When 0 cards selected, button prompts to select', tarotBtn0() && tarotBtn0().textContent.includes('SELECT A CARD'));

  // Select 1 card for The Sun
  w.uiSelectPackDeckCard(901);
  ck('Selected 1 card: 901 in selectedDeckCardUids', w.getState().activePackOpening.selectedDeckCardUids.includes(901));
  ck('Button enabled for 1 card', !tarotBtn0().disabled);
  ck('Button displays USE ON 5♠', tarotBtn0().textContent.includes('USE ON 5♠'));

  // Select 2nd card for The Sun (allowing up to 3 cards)
  w.uiSelectPackDeckCard(902);
  ck('Selected 2 cards: length is 2', w.getState().activePackOpening.selectedDeckCardUids.length === 2);
  ck('Button displays USE ON 2 CARDS', tarotBtn0().textContent.includes('USE ON 2 CARDS'));

  // Select 3rd card for The Sun
  w.uiSelectPackDeckCard(903);
  ck('Selected 3 cards: length is 3', w.getState().activePackOpening.selectedDeckCardUids.length === 3);
  ck('Button displays USE ON 3 CARDS', tarotBtn0().textContent.includes('USE ON 3 CARDS'));

  // Select 4th card for The Sun (allowed to pick as many as player wants!)
  w.uiSelectPackDeckCard(904);
  ck('Player can pick 4 cards (no block while selecting)', w.getState().activePackOpening.selectedDeckCardUids.length === 4);
  const tooManyRes = w.pickPackOption(0);
  ck('Using tarot on 4 cards fails (too many cards)', tooManyRes.ok === false && tooManyRes.warning.includes('Too many cards'));

  // Deselect 4th card
  w.uiSelectPackDeckCard(904);
  ck('Deselected 4th card, remaining is 3', w.getState().activePackOpening.selectedDeckCardUids.length === 3);

  // Deselect 2nd card by tapping it again
  w.uiSelectPackDeckCard(902);
  ck('Tapping card 902 again deselects it', !w.getState().activePackOpening.selectedDeckCardUids.includes(902));
  ck('Remaining selected count is 2', w.getState().activePackOpening.selectedDeckCardUids.length === 2);
  ck('Button updates to USE ON 2 CARDS', tarotBtn0().textContent.includes('USE ON 2 CARDS'));

  // Use The Sun on the 2 selected cards (901 and 903)
  w.uiChoosePackOption(0);
  const sDeck = w.getState().deck;
  const c901 = sDeck.find(c => c.uid === 901);
  const c902 = sDeck.find(c => c.uid === 902);
  const c903 = sDeck.find(c => c.uid === 903);
  ck('Card 901 suit changed to Hearts', c901 && c901.suit === '♥');
  ck('Card 902 suit was untouched (still Clubs)', c902 && c902.suit === '♣');
  ck('Card 903 suit changed to Hearts', c903 && c903.suit === '♥');
  ck('Last tarot used recorded as the_sun', w.getState().lastTarotUsedId === 'the_sun');
  ck('Last tarot name recorded as The Sun', w.getState().lastTarotUsedName === 'The Sun');

  console.log('\n--- TEST 3: CARD FORGE (+1 RANK FOR UP TO 2 CARDS) ---');
  // Card Forge upgrades rank by 1 each (max 2 cards)
  const forgeDeckCards = [
    { uid: 801, rank: '10', suit: '♠', enhancement: null },
    { uid: 802, rank: 'K', suit: '♥', enhancement: null }
  ];
  w.patchState({
    inHand: true,
    isDealing: false,
    playerHand: forgeDeckCards.map(c => ({ ...c })),
    deck: forgeDeckCards.map(c => ({ ...c })),
    consumables: [{ id: 'card_forge', name: 'Card Forge', cost: 3, desc: 'Increase rank of up to 2 cards by 1' }]
  });

  w.uiUseConsumable(0);
  ck('Targeting active for Card Forge', w.isTarotTargetingActive());
  w.uiSelectCardForTarot(801); // 10 -> J
  w.uiSelectCardForTarot(802); // K -> A
  w.uiConfirmTarotTargeting();

  const f801 = w.getState().playerHand.find(c => c.uid === 801);
  const f802 = w.getState().playerHand.find(c => c.uid === 802);
  ck('10 upgraded by 1 to J in hand', f801 && f801.rank === 'J');
  ck('K upgraded by 1 to A in hand', f802 && f802.rank === 'A');
  const fDeck801 = w.getState().deck.find(c => c.uid === 801);
  const fDeck802 = w.getState().deck.find(c => c.uid === 802);
  ck('Card Forge synced J to deck', fDeck801 && fDeck801.rank === 'J');
  ck('Card Forge synced A to deck', fDeck802 && fDeck802.rank === 'A');

  console.log('\n--- TEST 4: CARD SHAVE (-1 RANK FOR UP TO 2 CARDS) ---');
  // Card Shave reduces rank by 1 each
  const shaveDeckCards = [
    { uid: 701, rank: 'J', suit: '♠', enhancement: null },
    { uid: 702, rank: '3', suit: '♦', enhancement: null }
  ];
  w.patchState({
    inHand: true,
    isDealing: false,
    playerHand: shaveDeckCards.map(c => ({ ...c })),
    deck: shaveDeckCards.map(c => ({ ...c })),
    consumables: [{ id: 'card_shave', name: 'Card Shave', cost: 3, desc: 'Reduce rank of up to 2 cards by 1' }]
  });

  w.uiUseConsumable(0);
  ck('Targeting active for Card Shave', w.isTarotTargetingActive());
  w.uiSelectCardForTarot(701); // J -> 10
  w.uiSelectCardForTarot(702); // 3 -> 2
  w.uiConfirmTarotTargeting();

  const s701 = w.getState().playerHand.find(c => c.uid === 701);
  const s702 = w.getState().playerHand.find(c => c.uid === 702);
  ck('J reduced by 1 to 10 in hand', s701 && s701.rank === '10');
  ck('3 reduced by 1 to 2 in hand', s702 && s702.rank === '2');

  console.log('\n--- TEST 5: THE GUILLOTINE (DESTROY UP TO 2 CARDS) ---');
  const guilDeckCards = [
    { uid: 601, rank: '2', suit: '♠', enhancement: null },
    { uid: 602, rank: '3', suit: '♥', enhancement: null },
    { uid: 603, rank: 'K', suit: '♦', enhancement: null }
  ];
  w.patchState({
    inHand: true,
    isDealing: false,
    playerHand: guilDeckCards.map(c => ({ ...c })),
    deck: guilDeckCards.map(c => ({ ...c })),
    consumables: [{ id: 'the_guillotine', name: 'The Guillotine', cost: 4, desc: 'Permanently destroy up to 2 cards' }]
  });

  w.uiUseConsumable(0);
  w.uiSelectCardForTarot(601);
  w.uiSelectCardForTarot(602);
  w.uiConfirmTarotTargeting();

  ck('Player hand has only 1 card left', w.getState().playerHand.length === 1);
  ck('Card 601 destroyed', !w.getState().playerHand.some(c => c.uid === 601));
  ck('Card 602 destroyed', !w.getState().playerHand.some(c => c.uid === 602));
  ck('Card 603 kept', w.getState().playerHand.some(c => c.uid === 603));
  ck('Deck has only 1 card left', w.getState().deck.length === 1);

  console.log('\n--- TEST 6: THE LOVERS / WILD SUIT (COUNTS AS ANY SUIT) ---');
  const wildCard = { uid: 501, rank: '10', suit: '♠', enhancement: null };
  w.patchState({
    inHand: true,
    isDealing: false,
    playerHand: [wildCard],
    deck: [{ ...wildCard }],
    consumables: [{ id: 'the_lovers', name: 'The Lovers', cost: 3, desc: 'Change suit to Wild Suit (★)' }]
  });

  w.uiUseConsumable(0);
  w.uiSelectCardForTarot(501); // 1-card tarot selected and raised
  w.uiConfirmTarotTargeting(); // apply tarot
  ck('Card suit changed to ★ (Wild)', w.getState().playerHand[0].suit === '★');
  ck('Deck card suit synced to ★', w.getState().deck[0].suit === '★');

  // Verify Wild suit triggers suit jokers
  const testHand = [
    { uid: 501, rank: '10', suit: '★', enhancement: null },
    { uid: 502, rank: '7', suit: '♠', enhancement: null }
  ];

  // Test Spade Slicer (+15 Chips & +5 Mult per Spade)
  const spadeScore = w.scoreHand({
    playerHand: testHand,
    dealerHand: [{ uid: 1, rank: '2', suit: '♦', enhancement: null }, { uid: 2, rank: '3', suit: '♣', enhancement: null }],
    doubledDown: false,
    jokers: [{ id: 'spade_slicer', name: 'Spade Slicer', cost: 5, rarity: 'common', isXMult: false, archetype: 'suit' }],
    vouchers: [],
    money: 10,
    ante: 1,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    anteHandScaling: false,
    bossBlind: null
  });
  // 1 standard Spade + 1 Wild card = 2 Spades (2 * 15 chips = +30c, 2 * 5 mult = +10m)
  ck('Spade Slicer treats Wild card as Spades (chips >= 50 base + 30)', spadeScore.chips >= 80);
  ck('Spade Slicer mult is 2 base + 10 = 12', spadeScore.mult === 12);

  // Test Crimson Heart (+40 Chips & +2 Mult per Heart)
  const heartScore = w.scoreHand({
    playerHand: testHand,
    dealerHand: [{ uid: 1, rank: '2', suit: '♦', enhancement: null }, { uid: 2, rank: '3', suit: '♣', enhancement: null }],
    doubledDown: false,
    jokers: [{ id: 'crimson_heart', name: 'Crimson Heart', cost: 5, rarity: 'common', isXMult: false, archetype: 'suit' }],
    vouchers: [],
    money: 10,
    ante: 1,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    anteHandScaling: false,
    bossBlind: null
  });
  // 0 standard Hearts + 1 Wild card = 1 Heart (1 * 40 chips = +40c, 1 * 2 mult = +2m)
  ck('Crimson Heart treats Wild card as Hearts (+40c)', heartScore.chips >= 90);
  ck('Crimson Heart mult is 2 base + 2 = 4', heartScore.mult === 4);

  // Test Monochrome (Flush x1.6 mult with min 3 cards)
  const flushHand = [
    { uid: 510, rank: '2', suit: '♥', enhancement: null },
    { uid: 511, rank: '4', suit: '♥', enhancement: null },
    { uid: 512, rank: '6', suit: '★', enhancement: null } // Wild card completes the Heart flush!
  ];
  const monoScore = w.scoreHand({
    playerHand: flushHand,
    dealerHand: [{ uid: 1, rank: '2', suit: '♦', enhancement: null }, { uid: 2, rank: '3', suit: '♣', enhancement: null }],
    doubledDown: false,
    jokers: [{ id: 'monochrome', name: 'Monochrome', cost: 6, rarity: 'uncommon', isXMult: true }],
    vouchers: [],
    money: 10,
    ante: 1,
    baseWinChipBonus: 0,
    baseWinMultBonus: 0,
    tempBonusChips: 0,
    anteHandScaling: false,
    bossBlind: null
  });
  ck('Monochrome triggered with 2 Hearts + 1 Wild card (mult 2 * 1.6 = 3.2)', monoScore.mult === 3.2);

  console.log('\n--- TEST 7: 4 SUIT TAROTS (HEARTS, DIAMONDS, CLUBS, SPADES) ---');
  const cards4 = [
    { uid: 401, rank: '10', suit: '♣', enhancement: null },
    { uid: 402, rank: 'J', suit: '♣', enhancement: null },
    { uid: 403, rank: 'Q', suit: '♣', enhancement: null }
  ];
  w.patchState({
    inHand: true,
    isDealing: false,
    playerHand: cards4.map(c => ({ ...c })),
    deck: cards4.map(c => ({ ...c })),
    consumables: [{ id: 'the_sun', name: 'The Sun', cost: 3, desc: 'Convert up to 3 cards to Hearts' }]
  });

  w.uiUseConsumable(0);
  w.uiSelectCardForTarot(401);
  w.uiSelectCardForTarot(402);
  w.uiSelectCardForTarot(403);
  w.uiConfirmTarotTargeting();

  ck('The Sun converted all 3 cards to Hearts', w.getState().playerHand.every(c => c.suit === '♥'));

  // Test The World (Spades)
  w.patchState({
    consumables: [{ id: 'the_world', name: 'The World', cost: 3, desc: 'Convert up to 3 cards to Spades' }]
  });
  w.uiUseConsumable(0);
  w.uiSelectCardForTarot(401);
  w.uiConfirmTarotTargeting(); // Picked just 1 card!
  ck('The World converted card 401 to Spades', w.getState().playerHand.find(c => c.uid === 401).suit === '♠');
  ck('Other cards remained Hearts', w.getState().playerHand.find(c => c.uid === 402).suit === '♥');

  console.log('\n--- TEST 8: JUDGEMENT (RANDOM JOKER) ---');
  w.patchState({
    maxJokers: 5,
    jokers: [],
    inHand: true,
    isDealing: false,
    consumables: [{ id: 'judgement', name: 'Judgement', cost: 4, desc: 'Creates a random Joker' }]
  });

  w.uiUseConsumable(0);
  ck('Judgement created a random joker', w.getState().jokers.length === 1);
  ck('Judgement consumed', w.getState().consumables.length === 0);

  // When slots full
  w.patchState({
    maxJokers: 1,
    jokers: [{ id: 'the_shark', name: 'The Shark', cost: 8, rarity: 'rare', isXMult: true }],
    consumables: [{ id: 'judgement', name: 'Judgement', cost: 4, desc: 'Creates a random Joker' }]
  });
  const failRes = w.useConsumable(0);
  ck('Judgement fails when joker slots full', !failRes.ok && failRes.warning.includes('full'));
  ck('Judgement not consumed when failed', w.getState().consumables.length === 1);

  console.log('\n--- TEST 9: NOSTRADAMUS (CREATES LAST TAROT USED) ---');
  // State has lastTarotUsedId = 'the_world', lastTarotUsedName = 'The World'
  w.patchState({
    lastTarotUsedId: 'the_world',
    lastTarotUsedName: 'The World',
    consumables: [{ id: 'nostradamus', name: 'Nostradamus', cost: 4, desc: 'Creates last tarot' }]
  });

  w.updateAllUI();
  const subEl = d.querySelector('#ui-consumable-row .mini-card-sub');
  ck('Nostradamus shows [The World] on card subtext', subEl && subEl.textContent.includes('The World'));

  w.uiUseConsumable(0);
  ck('Using Nostradamus created The World in consumables', w.getState().consumables.some(c => c.id === 'the_world'));
  ck('Last tarot used updated to nostradamus', w.getState().lastTarotUsedId === 'nostradamus');

  // Now last tarot used IS Nostradamus. Nostradamus CANNOT be used!
  w.patchState({
    consumables: [{ id: 'nostradamus', name: 'Nostradamus', cost: 4, desc: 'Creates last tarot' }]
  });
  const nostradamusFail = w.useConsumable(0);
  ck('Nostradamus cannot be used if last tarot was Nostradamus', !nostradamusFail.ok && nostradamusFail.warning.includes('Nostradamus'));

  console.log('\n--- ALL NEW TAROT TESTS COMPLETED ---');
  results.forEach(r => console.log(r));

  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length > 0 || errors.length > 0) {
    if (errors.length > 0) console.error('Errors encountered during tests:', errors);
    console.error(`\nFAILED: ${failed.length} checks failed.`);
    process.exit(1);
  } else {
    console.log(`\nSUCCESS: All ${results.length} checks passed cleanly!`);
    process.exit(0);
  }
})();
