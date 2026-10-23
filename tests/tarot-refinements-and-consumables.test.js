const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

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

  console.log('\n--- TEST 1: NOSTRADAMUS IN SHOP SHOWS LAST TAROT USED ---');
  {
    w.patchState({
      inShop: true,
      lastTarotUsedId: 'the_sun',
      lastTarotUsedName: 'The Sun',
      shopJokers: [{
        id: 'nostradamus',
        name: 'Nostradamus',
        cost: 4,
        desc: 'Creates the last Tarot used (excluding Nostradamus).',
        consumableType: 'tarot',
        shopType: 'tarot',
        bought: false
      }]
    });

    w.renderShop();
    const shopJokersEl = $('ui-shop-jokers');
    ck('Shop shows Nostradamus with last used name in title', shopJokersEl.innerHTML.includes('Nostradamus (The Sun)'));
    ck('Shop shows Nostradamus with last used name in desc', shopJokersEl.innerHTML.includes('Creates the last Tarot used (The Sun).'));

    // Without any previous tarot used
    w.patchState({
      lastTarotUsedId: null,
      lastTarotUsedName: null
    });
    w.renderShop();
    ck('Shop shows Nostradamus (None) when no previous tarot used', shopJokersEl.innerHTML.includes('Nostradamus (None)'));
    ck('Shop shows no previous tarot found desc', shopJokersEl.innerHTML.includes('No previous Tarot found'));
  }

  console.log('\n--- TEST 2: MIDAS TOUCH TAROT DESCRIPTION ---');
  {
    const midasDef = w.DECK_TAROT_CATALOG.find(t => t.id === 'midas_touch');
    ck('Midas Touch exists in DECK_TAROT_CATALOG', !!midasDef);
    ck('Midas Touch desc reads "Enhance a single card to Gold (+$3 when scored)."', midasDef.desc === 'Enhance a single card to Gold (+$3 when scored).');
  }

  console.log('\n--- TEST 3: CONSUMABLE SLOT LABEL READS "CAST x/2" ---');
  {
    const slotLabel = $('ui-consumable-slots');
    ck('Consumable slot element exists in DOM', !!slotLabel);
    w.patchState({ consumables: [] });
    w.updateAllUI();
    ck('Consumable slots label reads "CAST 0/2"', slotLabel.textContent === 'CAST 0/2');

    w.addConsumable({ id: 'midas_touch', name: 'Midas Touch', cost: 3, consumableType: 'tarot', desc: 'test' });
    w.updateAllUI();
    ck('Consumable slots label updates to "CAST 1/2"', slotLabel.textContent === 'CAST 1/2');
  }

  console.log('\n--- TEST 4: SINGLE CHEAT CARDS IN STORE COLOR SCHEME (RED) ---');
  {
    w.patchState({
      inShop: true,
      shopJokers: [{
        id: 'x_ray',
        name: 'X-Ray Specs',
        cost: 3,
        desc: 'Reveal dealer hole card',
        consumableType: 'cheat',
        shopType: 'tarot',
        bought: false
      }]
    });
    w.renderShop();
    const shopItem = d.querySelector('#ui-shop-jokers .shop-item');
    ck('Single cheat card has class "type-cheat"', shopItem.classList.contains('type-cheat'));
    ck('Single cheat card does NOT have class "type-tarot"', !shopItem.classList.contains('type-tarot'));
    ck('styles.css contains .shop-item.type-cheat styling', css.includes('.shop-item.type-cheat'));
    ck('.shop-item.type-cheat uses red border #f43f5e', css.includes('border-color: #f43f5e;'));
  }

  console.log('\n--- TEST 5: DUPLICATE CANCEL BUTTON REMOVED FROM TARGETING BACKDROP ---');
  {
    const banner = d.querySelector('#ui-tarot-target-backdrop .tarot-target-banner');
    ck('Tarot target banner exists', !!banner);
    // Banner direct children should be title and hint, not an extra cancel button
    const directButtons = banner.querySelectorAll(':scope > button');
    ck('No duplicate cancel button as a direct child of .tarot-target-banner', directButtons.length === 0);

    // When active tarot selection is updated, cancel button inside hint exists
    w.patchState({
      inHand: true,
      playerHand: [{ uid: 1, rank: '10', suit: '♠' }]
    });
    w.startTarotTargeting(0);
    const hintButtons = banner.querySelectorAll('#ui-tarot-target-hint button');
    ck('Hint container contains Apply and Cancel buttons on same plane', hintButtons.length === 2);
    ck('First button is APPLY', hintButtons[0].textContent.includes('APPLY'));
    ck('Second button is Cancel', hintButtons[1].textContent.trim() === 'Cancel');
    w.cancelTarotTargeting(false);
  }

  console.log('\n--- TEST 6: CONSUMABLE TAROT USAGE DURING PACK OPENING ---');
  {
    const testDeckCards = [
      { uid: 501, rank: '7', suit: '♦' },
      { uid: 502, rank: '10', suit: '♠' },
      { uid: 503, rank: 'A', suit: '♥' }
    ];
    w.patchState({
      inHand: false,
      inShop: true,
      deck: [...testDeckCards],
      consumables: [
        { id: 'midas_touch', name: 'Midas Touch', cost: 3, consumableType: 'tarot', desc: 'Enhance a single card to Gold (+$3 when scored).' }
      ],
      activePackOpening: {
        pack: { id: 'pack_tarot', name: 'Tarot Pack', cost: 4, packType: 'tarot', cardsCount: 3, shopType: 'pack', bought: true },
        options: [
          { kind: 'tarot', data: { id: 'the_sun', name: 'The Sun', cost: 3, consumableType: 'tarot', desc: 'Hearts' } }
        ],
        chosen: false,
        deckCards: [...testDeckCards],
        selectedDeckCardUid: null,
        selectedDeckCardUids: []
      }
    });

    // Inspect consumable when 0 deck cards are selected
    w.inspectConsumable(0);
    const inspectBtn = d.querySelector('#ui-inspect-content .btn-double');
    ck('Inspect button exists', !!inspectBtn);
    ck('Button reads "Select a card(s) to use" when 0 pack deck cards selected', inspectBtn.textContent.trim() === 'Select a card(s) to use');
    ck('Button is enabled allowing player to close and prompt', !inspectBtn.disabled);

    // Clicking "Select a card(s) to use" closes inspector and prompts player
    inspectBtn.click();
    ck('Inspector is closed', $('ui-inspect-modal').classList.contains('hidden'));

    // Player selects card 501 in pack deck tray
    w.selectPackDeckCard(501);
    ck('Card 501 is selected in activePackOpening', w.getState().activePackOpening.selectedDeckCardUids.includes(501));

    // Inspect consumable again with card selected
    w.inspectConsumable(0);
    const useBtnWithCard = d.querySelector('#ui-inspect-content .btn-double');
    ck('Button now reads "Use on 7♦"', useBtnWithCard.textContent.trim() === 'Use on 7♦');
    ck('Button is enabled', !useBtnWithCard.disabled);

    // Click use button
    useBtnWithCard.click();
    ck('Midas Touch was consumed from consumable slot', w.getState().consumables.length === 0);
    const updatedDeckCard = w.getState().deck.find(c => c.uid === 501);
    ck('Deck card 501 was enhanced to Gold', updatedDeckCard && updatedDeckCard.enhancement === 'gold');
    const updatedPackCard = w.getState().activePackOpening.deckCards.find(c => c.uid === 501);
    ck('Pack deck card 501 was enhanced to Gold', updatedPackCard && updatedPackCard.enhancement === 'gold');
    ck('Active pack opening remains open', w.getState().activePackOpening !== null);
    ck('Selected deck cards were cleared after use', w.getState().activePackOpening.selectedDeckCardUids.length === 0);
  }

  console.log('\n--- TEST 7: JUDGEMENT USABLE IN SHOP & PACK OPENING ---');
  {
    w.patchState({
      inHand: false,
      inShop: true,
      jokers: [],
      maxJokers: 5,
      consumables: [
        { id: 'judgement', name: 'Judgement', cost: 4, consumableType: 'tarot', desc: 'Create a random Joker' }
      ]
    });

    // In shop (not in hand)
    w.inspectConsumable(0);
    const judgeBtn = d.querySelector('#ui-inspect-content .btn-double');
    ck('Judgement button does NOT say "Deal a Hand to Use" in shop', !judgeBtn.textContent.includes('Deal a Hand'));
    ck('Judgement button reads "Use Tarot Now"', judgeBtn.textContent.trim() === 'Use Tarot Now');
    ck('Judgement button is enabled when joker slots have space', !judgeBtn.disabled);

    // Click to use Judgement in shop
    judgeBtn.click();
    ck('Judgement consumed', w.getState().consumables.length === 0);
    ck('Joker was summoned into player jokers', w.getState().jokers.length === 1);

    // Test full joker slots lockout
    w.patchState({
      jokers: [{}, {}, {}, {}, {}], // 5 jokers
      consumables: [
        { id: 'judgement', name: 'Judgement', cost: 4, consumableType: 'tarot', desc: 'Create a random Joker' }
      ]
    });
    w.inspectConsumable(0);
    const fullJudgeBtn = d.querySelector('#ui-inspect-content .btn-double');
    ck('Judgement button reads "Joker Slots Full" when maxed', fullJudgeBtn.textContent.trim() === 'Joker Slots Full');
    ck('Judgement button is disabled when maxed', fullJudgeBtn.disabled);
    w.closeInspector();
  }

  console.log('\n--- TEST 8: SHOP & PACK OFFER DEDUPLICATION AGAINST CONSUMABLES ---');
  {
    // Player has 'the_sun' and 'x_ray' in consumables
    w.patchState({
      consumables: [
        { id: 'the_sun', name: 'The Sun', cost: 3, consumableType: 'tarot', desc: 'Convert to Hearts' },
        { id: 'x_ray', name: 'X-Ray Specs', cost: 3, consumableType: 'cheat', desc: 'X-Ray' }
      ]
    });

    // Test single cards in shop
    for (let trial = 0; trial < 20; trial++) {
      const singles = w.generateShopSingleCards(1, 0, []);
      const singleIds = singles.map(s => s.id);
      ck(`Trial ${trial + 1}: Single cards do not contain owned the_sun`, !singleIds.includes('the_sun'));
      ck(`Trial ${trial + 1}: Single cards do not contain owned x_ray`, !singleIds.includes('x_ray'));
    }

    // Test Tarot Pack
    const tarotPackDef = { id: 'pack_tarot', name: 'Tarot Pack', cost: 4, packType: 'tarot', cardsCount: 3 };
    for (let trial = 0; trial < 20; trial++) {
      const opts = w.generatePackOptions(tarotPackDef);
      const optIds = opts.map(o => o.data.id);
      ck(`Trial ${trial + 1}: Tarot Pack does not offer owned the_sun`, !optIds.includes('the_sun'));
    }

    // Test Cheat Pack
    const cheatPackDef = { id: 'pack_cheat', name: 'Cheat Pack', cost: 4, packType: 'cheat', cardsCount: 2 };
    for (let trial = 0; trial < 20; trial++) {
      const opts = w.generatePackOptions(cheatPackDef);
      const optIds = opts.map(o => o.data.id);
      ck(`Trial ${trial + 1}: Cheat Pack does not offer owned x_ray`, !optIds.includes('x_ray'));
    }

    // Test rerollShop preserves deduplication
    w.patchState({
      money: 100,
      rerollCost: 2,
      inShop: true
    });
    w.rerollShop();
    const shopSingleIds = w.getState().shopJokers.map(j => j.id);
    ck('Rerolled shop does not contain the_sun', !shopSingleIds.includes('the_sun'));
    ck('Rerolled shop does not contain x_ray', !shopSingleIds.includes('x_ray'));
  }

  console.log('\n--- TEST 9: PACK CLOSING DELAY VERIFICATION ---');
  {
    const mainTsCode = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');
    ck('Pack close delay in main.ts is set to 1500ms', mainTsCode.includes('await sleep(1500);'));
    ck('Old 800ms pack close delay removed', !mainTsCode.includes('await sleep(800);'));
  }

  console.log('\n--- TEST 10: 3-CARD SUIT TAROT FEEDBACK ON ALL 3 CARDS ---');
  {
    // Part A: In hand
    const handCards = [
      { uid: 701, rank: '5', suit: '♠' },
      { uid: 702, rank: '9', suit: '♣' },
      { uid: 703, rank: 'Q', suit: '♥' }
    ];
    w.patchState({
      inHand: true,
      playerHand: [...handCards],
      deck: [...handCards],
      consumables: [
        { id: 'the_star', name: 'The Star', cost: 3, consumableType: 'tarot', desc: 'Convert up to 3 cards to Diamonds.' }
      ]
    });
    w.updateAllUI();

    w.startTarotTargeting(0);
    w.uiSelectCardForTarot(701);
    w.uiSelectCardForTarot(702);
    w.uiSelectCardForTarot(703);

    w.uiConfirmTarotTargeting();

    // Check that all 3 cards have the float pop element with "♦ DIAMONDS"
    const cardEl1 = d.querySelector('#ui-player-cards .playing-card[data-uid="701"] .card-float-pop');
    const cardEl2 = d.querySelector('#ui-player-cards .playing-card[data-uid="702"] .card-float-pop');
    const cardEl3 = d.querySelector('#ui-player-cards .playing-card[data-uid="703"] .card-float-pop');

    ck('Card 1 has float pop element', !!cardEl1);
    ck('Card 1 float pop text is ♦ DIAMONDS', cardEl1 && cardEl1.textContent.includes('DIAMONDS'));
    ck('Card 2 has float pop element', !!cardEl2);
    ck('Card 2 float pop text is ♦ DIAMONDS', cardEl2 && cardEl2.textContent.includes('DIAMONDS'));
    ck('Card 3 has float pop element', !!cardEl3);
    ck('Card 3 float pop text is ♦ DIAMONDS', cardEl3 && cardEl3.textContent.includes('DIAMONDS'));

    // Part B: In pack opening where one card UID happens to also exist in another container
    const packCards = [
      { uid: 701, rank: 'K', suit: '♠' }, // same UID as hand card
      { uid: 802, rank: '3', suit: '♥' },
      { uid: 803, rank: '8', suit: '♣' }
    ];
    w.patchState({
      inHand: false,
      inShop: true,
      deck: [...packCards],
      consumables: [
        { id: 'the_star', name: 'The Star', cost: 3, consumableType: 'tarot', desc: 'Convert up to 3 cards to Diamonds.' }
      ],
      activePackOpening: {
        pack: { id: 'pack_tarot', name: 'Tarot Pack', cost: 4, packType: 'tarot', cardsCount: 3, shopType: 'pack', bought: true },
        options: [
          { kind: 'tarot', data: { id: 'the_world', name: 'The World', cost: 3, consumableType: 'tarot', desc: 'Spades' } }
        ],
        chosen: false,
        deckCards: [...packCards],
        selectedDeckCardUid: null,
        selectedDeckCardUids: [701, 802, 803]
      }
    });

    w.renderPackOpeningScreen(false);
    w.renderPackDeckHand();
    w.uiUseConsumable(0);

    const packPop1 = d.querySelector('#ui-pack-deck-cards .playing-card[data-uid="701"] .card-float-pop');
    const packPop2 = d.querySelector('#ui-pack-deck-cards .playing-card[data-uid="802"] .card-float-pop');
    const packPop3 = d.querySelector('#ui-pack-deck-cards .playing-card[data-uid="803"] .card-float-pop');

    ck('Pack tray Card 701 has float pop', !!packPop1);
    ck('Pack tray Card 701 text is ♦ DIAMONDS', packPop1 && packPop1.textContent.includes('DIAMONDS'));
    ck('Pack tray Card 802 has float pop', !!packPop2);
    ck('Pack tray Card 802 text is ♦ DIAMONDS', packPop2 && packPop2.textContent.includes('DIAMONDS'));
    ck('Pack tray Card 803 has float pop', !!packPop3);
    ck('Pack tray Card 803 text is ♦ DIAMONDS', packPop3 && packPop3.textContent.includes('DIAMONDS'));
  }

  console.log('\n--- TEST 11: DEJA VU REMEMBERS PREVIOUS WINNING HAND THROUGH SHOP ---');
  {
    const dejaDef = w.JOKER_CATALOG.find(j => j.id === 'deja_vu');
    ck('Deja Vu exists in catalog', !!dejaDef);
    ck('Deja Vu catalog description mentions previous winning hand', dejaDef.desc.includes('previous winning hand'));

    // Check full desc and mini sub text
    const fullDesc = w.getJokerFullDesc(dejaDef);
    ck('getJokerFullDesc mentions previous winning hand', fullDesc.includes('previous winning hand'));

    // Initial state: no previous hand
    w.patchState({
      previousHandTotal: null,
      jokers: [{ ...dejaDef, bonusMult: 0, bonusChips: 0 }]
    });
    ck('getJokerMiniSubHTML shows "Match Prev Win" when no prev win', w.getJokerMiniSubHTML(dejaDef).includes('Match Prev Win'));

    // Player wins a hand with total 19
    w.patchState({
      inHand: true,
      playerHand: [{ uid: 1, rank: '10', suit: '♠' }, { uid: 2, rank: '9', suit: '♥' }],
      dealerHand: [{ uid: 3, rank: '10', suit: '♦' }, { uid: 4, rank: '7', suit: '♣' }]
    });

    // Score hand
    w.playerStand();
    await sleep(200);

    ck('previousHandTotal recorded as 19 after winning hand', w.getState().previousHandTotal === 19);
    ck('Mini sub displays "Match 19"', w.getJokerMiniSubHTML(dejaDef).includes('Match 19'));

    // Now player goes to the shop and starts next blind
    w.patchState({
      blindClearedReady: true,
      pendingPayout: { blindReward: 4, handBonus: 2, interest: 1, totalEarned: 7 }
    });
    w.uiCashOut();
    ck('In shop after cash out', w.getState().inShop === true);
    ck('previousHandTotal is STILL 19 during shop phase', w.getState().previousHandTotal === 19);

    // Leave shop to begin next blind
    w.beginBlindState();
    ck('previousHandTotal is STILL 19 after beginBlindState', w.getState().previousHandTotal === 19);

    // Now test a LOSS: Player stands on 17, dealer has 20 (loss)
    // Deja Vu should NOT overwrite 19 with 17 because 17 was a loss!
    w.patchState({
      inHand: true,
      playerHand: [{ uid: 11, rank: '10', suit: '♠' }, { uid: 12, rank: '7', suit: '♥' }],
      dealerHand: [{ uid: 13, rank: '10', suit: '♦' }, { uid: 14, rank: 'K', suit: '♣' }]
    });
    w.playerStand();
    await sleep(200);

    ck('Loss does NOT overwrite previousHandTotal; remains 19', w.getState().previousHandTotal === 19);

    // Now player scores 19 and Deja Vu triggers!
    w.patchState({
      inHand: true,
      playerHand: [{ uid: 21, rank: '9', suit: '♠' }, { uid: 22, rank: '10', suit: '♣' }],
      dealerHand: [{ uid: 23, rank: '10', suit: '♦' }, { uid: 24, rank: '8', suit: '♣' }]
    });
    const scoreRes = w.evaluateBlackjackTotal(w.getState().playerHand, false);
    ck('Player hand total is 19', scoreRes.total === 19);

    const calc = w.scoreHand({
      playerHand: w.getState().playerHand,
      dealerHand: w.getState().dealerHand,
      jokers: w.getState().jokers,
      bossBlind: null,
      ante: 1,
      money: 10,
      baseWinChipBonus: 0,
      baseWinMultBonus: 0,
      tempBonusChips: 0,
      doubledDown: false,
      previousHandTotal: w.getState().previousHandTotal
    });

    const dejaStep = calc.steps.find(s => s.jokerId === 'deja_vu');
    ck('Deja Vu triggered for matching previous winning total 19', !!dejaStep);
    ck('Deja Vu applied ×1.5 Mult', dejaStep && dejaStep.deltaMult === 1.5);
  }

  results.forEach(r => console.log(r));
  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length > 0) {
    console.error(`\nFAILED: ${failed.length} checks failed!`);
    process.exit(1);
  }
  console.log(`\nSUCCESS: All ${results.length} Tarot refinement & consumable checks passed cleanly!`);
  process.exit(0);
})();
