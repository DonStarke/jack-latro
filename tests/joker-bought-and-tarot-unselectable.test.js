// Test suite verifying:
// 1. When buying a joker in a joker pack, button reads "Bought".
// 2. When in a tarot pack opening, if tarot requires cards, button is disabled/unselectable if 0 or too many cards selected.
// 3. Nostradamus button is disabled/unselectable if no tarot used yet or if Nostradamus was used last.

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

  console.log('\n--- TEST 1: BUYING A JOKER IN JOKER PACK SHOWS "Bought" ---');
  w.startNewRun();
  w.patchState({
    money: 50,
    jokers: [],
    maxJokers: 5,
    shopPacks: [{
      id: 'pack_joker_test',
      name: 'Buffoon Pack',
      packType: 'joker',
      cost: 4,
      cardsCount: 3,
      chooseCount: 1,
      desc: 'Choose 1 Joker',
      shopType: 'pack',
      bought: false
    }]
  });
  w.uiBuyPack(0);
  await sleep(20);

  const stage = $('ui-pack-stage');
  ck('Pack stage visible after buying Joker pack', stage !== null);
  const jokerBtn0 = stage.querySelector('.pack-option-card[data-opt-idx="0"] .btn-pack-choose');
  ck('Joker option button exists before picking', !!jokerBtn0);
  ck('Joker button initially says CHOOSE JOKER', jokerBtn0.textContent.includes('CHOOSE JOKER'));

  // Choose the joker
  w.uiChoosePackOption(0);
  ck('Joker button reads "Bought" after being chosen', jokerBtn0.textContent === 'Bought');
  ck('Joker button is disabled after being chosen', jokerBtn0.disabled === true);
  await sleep(100);

  console.log('\n--- TEST 2: TAROT PACK TARGETING: 0 CARDS, VALID CARDS, TOO MANY CARDS ---');
  const testDeckCards = [
    { uid: 101, rank: '7', suit: '♠', enhancement: null },
    { uid: 102, rank: '8', suit: '♥', enhancement: null },
    { uid: 103, rank: '9', suit: '♦', enhancement: null },
    { uid: 104, rank: '10', suit: '♣', enhancement: null },
    { uid: 105, rank: 'J', suit: '♠', enhancement: null }
  ];

  // Test Max 1 Tarot (Midas Touch or The Magician)
  w.patchState({
    activePackOpening: {
      pack: { id: 'pack_tarot_max1', name: 'Tarot Pack', packType: 'tarot', cost: 4, cardsCount: 3, chooseCount: 1, desc: '' },
      options: [
        { kind: 'tarot', data: { id: 'midas_touch', name: 'Midas Touch', cost: 4, desc: 'Convert 1 card to Gold' } }
      ],
      deckCards: testDeckCards.map(c => ({ ...c })),
      selectedDeckCardUids: [],
      selectedDeckCardUid: null,
      chosen: false
    }
  });
  w.renderPackOpeningScreen(false);

  const btnMax1 = stage.querySelector('.pack-option-card[data-opt-idx="0"] .btn-pack-choose');
  ck('Max 1: Button is disabled when 0 cards selected', btnMax1.disabled === true);
  ck('Max 1: Button text is SELECT A CARD when 0 cards selected', btnMax1.textContent.includes('SELECT A CARD'));

  // Select 1 card (valid)
  w.uiSelectPackDeckCard(101);
  ck('Max 1: Button is enabled when 1 card selected', btnMax1.disabled === false);
  ck('Max 1: Button text says USE ON 7♠', btnMax1.textContent.includes('USE ON 7♠'));

  // Select 2nd card (too many cards for max 1)
  w.uiSelectPackDeckCard(102);
  ck('Max 1: Button is disabled when 2 cards selected (too many)', btnMax1.disabled === true);
  ck('Max 1: Button text says TOO MANY CARDS (MAX 1)', btnMax1.textContent.includes('TOO MANY CARDS (MAX 1)'));

  // Deselect 2nd card back to 1
  w.uiSelectPackDeckCard(102);
  ck('Max 1: Button re-enables when back to 1 card', btnMax1.disabled === false);

  // Deselect 1st card back to 0
  w.uiSelectPackDeckCard(101);
  ck('Max 1: Button disabled again when back to 0 cards', btnMax1.disabled === true);

  // Test Max 2 Tarot (Card Forge)
  w.patchState({
    activePackOpening: {
      pack: { id: 'pack_tarot_max2', name: 'Tarot Pack', packType: 'tarot', cost: 4, cardsCount: 3, chooseCount: 1, desc: '' },
      options: [
        { kind: 'tarot', data: { id: 'card_forge', name: 'Card Forge', cost: 4, desc: '+1 rank up to 2 cards' } }
      ],
      deckCards: testDeckCards.map(c => ({ ...c })),
      selectedDeckCardUids: [],
      selectedDeckCardUid: null,
      chosen: false
    }
  });
  w.renderPackOpeningScreen(false);

  const btnMax2 = stage.querySelector('.pack-option-card[data-opt-idx="0"] .btn-pack-choose');
  ck('Max 2: Button is disabled when 0 cards selected', btnMax2.disabled === true);
  ck('Max 2: Button text says SELECT A CARD (UP TO 2)', btnMax2.textContent.includes('SELECT A CARD (UP TO 2)'));

  // Select 1 card (valid)
  w.uiSelectPackDeckCard(101);
  ck('Max 2: Button is enabled when 1 card selected', btnMax2.disabled === false);
  ck('Max 2: Button text says USE ON 7♠', btnMax2.textContent.includes('USE ON 7♠'));

  // Select 2 cards (valid)
  w.uiSelectPackDeckCard(102);
  ck('Max 2: Button is enabled when 2 cards selected', btnMax2.disabled === false);
  ck('Max 2: Button text says USE ON 2 CARDS', btnMax2.textContent.includes('USE ON 2 CARDS'));

  // Select 3 cards (too many for max 2)
  w.uiSelectPackDeckCard(103);
  ck('Max 2: Button is disabled when 3 cards selected (too many)', btnMax2.disabled === true);
  ck('Max 2: Button text says TOO MANY CARDS (MAX 2)', btnMax2.textContent.includes('TOO MANY CARDS (MAX 2)'));

  // Deselect 3rd card
  w.uiSelectPackDeckCard(103);
  ck('Max 2: Button re-enables when deselected back to 2', btnMax2.disabled === false);

  // Test Max 3 Tarot (The Sun)
  w.patchState({
    activePackOpening: {
      pack: { id: 'pack_tarot_max3', name: 'Tarot Pack', packType: 'tarot', cost: 4, cardsCount: 3, chooseCount: 1, desc: '' },
      options: [
        { kind: 'tarot', data: { id: 'the_sun', name: 'The Sun', cost: 4, desc: 'Convert up to 3 cards to Hearts' } }
      ],
      deckCards: testDeckCards.map(c => ({ ...c })),
      selectedDeckCardUids: [],
      selectedDeckCardUid: null,
      chosen: false
    }
  });
  w.renderPackOpeningScreen(false);

  const btnMax3 = stage.querySelector('.pack-option-card[data-opt-idx="0"] .btn-pack-choose');
  ck('Max 3: Button is disabled when 0 cards selected', btnMax3.disabled === true);

  w.uiSelectPackDeckCard(101);
  w.uiSelectPackDeckCard(102);
  w.uiSelectPackDeckCard(103);
  ck('Max 3: Button enabled with 3 cards', btnMax3.disabled === false && btnMax3.textContent.includes('USE ON 3 CARDS'));

  w.uiSelectPackDeckCard(104);
  ck('Max 3: Button disabled with 4 cards (too many)', btnMax3.disabled === true && btnMax3.textContent.includes('TOO MANY CARDS (MAX 3)'));

  // Calling uiChoosePackOption while disabled does NOT execute or close pack
  const chosenBefore = w.getState().activePackOpening.chosen;
  await w.uiChoosePackOption(0);
  ck('Calling uiChoosePackOption while disabled is blocked', w.getState().activePackOpening?.chosen === chosenBefore);

  console.log('\n--- TEST 3: NOSTRADAMUS BEHAVIOR IN TAROT PACK OPENING ---');
  // Sub-case 3A: No tarot has been used yet this run
  w.patchState({
    lastTarotUsedId: null,
    lastTarotUsedName: null,
    activePackOpening: {
      pack: { id: 'pack_tarot_nost', name: 'Tarot Pack', packType: 'tarot', cost: 4, cardsCount: 2, chooseCount: 1, desc: '' },
      options: [
        { kind: 'tarot', data: { id: 'nostradamus', name: 'Nostradamus', cost: 4, desc: 'Creates the last Tarot used' } }
      ],
      deckCards: testDeckCards.map(c => ({ ...c })),
      selectedDeckCardUids: [],
      selectedDeckCardUid: null,
      chosen: false
    }
  });
  w.renderPackOpeningScreen(false);

  const nostBtn = stage.querySelector('.pack-option-card[data-opt-idx="0"] .btn-pack-choose');
  ck('Nostradamus: Button is disabled when no tarot has been used yet', nostBtn.disabled === true);
  ck('Nostradamus: Button text indicates no tarot to copy', nostBtn.textContent.includes('NO TAROT TO COPY'));

  // Calling uiChoosePackOption on disabled Nostradamus does nothing
  await w.uiChoosePackOption(0);
  ck('Nostradamus: uiChoosePackOption blocked when no previous tarot', w.getState().activePackOpening?.chosen === false);

  // Sub-case 3B: Another tarot was used last (e.g. The Sun)
  w.patchState({
    lastTarotUsedId: 'the_sun',
    lastTarotUsedName: 'The Sun',
    activePackOpening: {
      pack: { id: 'pack_tarot_nost', name: 'Tarot Pack', packType: 'tarot', cost: 4, cardsCount: 2, chooseCount: 1, desc: '' },
      options: [
        { kind: 'tarot', data: { id: 'nostradamus', name: 'Nostradamus', cost: 4, desc: 'Creates the last Tarot used' } }
      ],
      deckCards: testDeckCards.map(c => ({ ...c })),
      selectedDeckCardUids: [],
      selectedDeckCardUid: null,
      chosen: false
    }
  });
  w.renderPackOpeningScreen(false);

  const nostBtnUsable = stage.querySelector('.pack-option-card[data-opt-idx="0"] .btn-pack-choose');
  ck('Nostradamus: Button is enabled when another tarot was used last', nostBtnUsable.disabled === false);
  ck('Nostradamus: Button text says COPY The Sun', nostBtnUsable.textContent.includes('COPY The Sun'));

  // Sub-case 3C: Nostradamus was used last
  w.patchState({
    lastTarotUsedId: 'nostradamus',
    lastTarotUsedName: 'Nostradamus',
    activePackOpening: {
      pack: { id: 'pack_tarot_nost', name: 'Tarot Pack', packType: 'tarot', cost: 4, cardsCount: 2, chooseCount: 1, desc: '' },
      options: [
        { kind: 'tarot', data: { id: 'nostradamus', name: 'Nostradamus', cost: 4, desc: 'Creates the last Tarot used' } }
      ],
      deckCards: testDeckCards.map(c => ({ ...c })),
      selectedDeckCardUids: [],
      selectedDeckCardUid: null,
      chosen: false
    }
  });
  w.renderPackOpeningScreen(false);

  const nostBtnSelf = stage.querySelector('.pack-option-card[data-opt-idx="0"] .btn-pack-choose');
  ck('Nostradamus: Button is disabled when Nostradamus was used last', nostBtnSelf.disabled === true);
  ck('Nostradamus: Button text indicates cannot copy Nostradamus', nostBtnSelf.textContent.includes('CANNOT COPY NOSTRADAMUS'));

  await w.uiChoosePackOption(0);
  ck('Nostradamus: uiChoosePackOption blocked when last used was Nostradamus', w.getState().activePackOpening?.chosen === false);

  console.log('\n--- TEST 4: TAROT BUTTON SAYS "APPLIED ✨" WHEN CHOSEN ---');
  w.patchState({
    deck: testDeckCards.map(c => ({ ...c })),
    activePackOpening: {
      pack: { id: 'pack_tarot_apply', name: 'Tarot Pack', packType: 'tarot', cost: 4, cardsCount: 1, chooseCount: 1, desc: '' },
      options: [
        { kind: 'tarot', data: { id: 'the_sun', name: 'The Sun', cost: 4, desc: 'Convert up to 3 cards to Hearts' } }
      ],
      deckCards: testDeckCards.map(c => ({ ...c })),
      selectedDeckCardUids: [101],
      selectedDeckCardUid: 101,
      chosen: false
    }
  });
  w.renderPackOpeningScreen(false);

  const tarotBtn = stage.querySelector('.pack-option-card[data-opt-idx="0"] .btn-pack-choose');
  w.uiChoosePackOption(0);
  ck('Tarot button reads "APPLIED ✨" after being chosen', tarotBtn.textContent.includes('APPLIED'));

  console.log('\n--- ALL JOKER BOUGHT & TAROT UNSELECTABLE CHECKS COMPLETED ---');
  results.forEach(r => console.log(r));

  if (errors.length > 0) {
    console.error('Errors encountered:');
    errors.forEach(e => console.error(e));
    process.exit(1);
  }
  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length > 0) {
    console.error(`\nFAILED ${failed.length} checks:`);
    failed.forEach(f => console.error(f));
    process.exit(1);
  }
  console.log(`\nSUCCESS: All ${results.length} checks passed cleanly!`);
  process.exit(0);
})();
