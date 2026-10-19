// Comprehensive test suite for Booster Pack buying, opening, and picking system.
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
  await sleep(400);

  const $ = id => d.getElementById(id);
  const click = id => $(id).click();
  const text = id => $(id).textContent;
  const isHidden = el => el.classList.contains('hidden');

  console.log('\n--- TEST 1: SHOP OFFERS PACKS INSTEAD OF INDIVIDUAL CARDS ---');
  w.startNewRun();
  w.generateShopStock();
  const s1 = w.getState();

  ck('Shop offers booster packs array', Array.isArray(s1.shopPacks));
  ck('Default shop offers 2 packs', s1.shopPacks.length === 2);
  ck('Ante 1 Blind 0 offers at least one Joker pack', s1.shopPacks.some(p => p.packType === 'joker'));
  ck('Shop extras contains the Ante voucher', s1.shopExtras.some(e => e.shopType === 'voucher'));
  ck('Shop jokers is empty (no individual cards sold)', s1.shopJokers.length === 0);

  w.renderShop();
  ck('Packs grid renders in shop UI', $('ui-shop-packs').children.length === 2);
  ck('Vouchers grid renders in shop UI', $('ui-shop-extras').children.length >= 1);

  console.log('\n--- TEST 2: OVERSTOCK VOUCHER EXPANDS SHOP TO 3 PACKS ---');
  w.applyVoucher('overstock');
  w.generateShopStock();
  const sOverstock = w.getState();
  ck('Overstock increases packs offered to 3', sOverstock.shopPacks.length === 3);

  console.log('\n--- TEST 3: BUYING A JOKER PACK & OPENING SCREEN ---');
  // Give cash
  w.patchState({ money: 20 });
  w.renderShop();

  // Find joker pack index
  let jokerPackIdx = w.getState().shopPacks.findIndex(p => p.packType === 'joker');
  if (jokerPackIdx < 0) {
    // Generate until we have one
    w.generateShopStock();
    jokerPackIdx = w.getState().shopPacks.findIndex(p => p.packType === 'joker');
  }

  const initialMoney = w.getState().money;
  const packCost = w.getState().shopPacks[jokerPackIdx].cost;
  const packOverlay = $('ui-pack-overlay');

  ck('Pack overlay initially hidden', isHidden(packOverlay));
  w.uiBuyPack(jokerPackIdx);
  await sleep(50);

  const sAfterBuy = w.getState();
  ck('Money deducted by pack cost', sAfterBuy.money === initialMoney - packCost);
  ck('Pack marked bought in state', sAfterBuy.shopPacks[jokerPackIdx].bought === true);
  ck('activePackOpening exists in state', !!sAfterBuy.activePackOpening);
  ck('Pack overlay is now visible', !isHidden(packOverlay));
  ck('Pack badge shows JOKERS', text('ui-pack-badge').includes('JOKER'));
  ck('Pack stage renders 3 options', $('ui-pack-stage').children.length === 3);

  // Check revealed options
  const revealedOptions = sAfterBuy.activePackOpening.options;
  ck('All 3 options in Joker pack are jokers', revealedOptions.every(o => o.kind === 'joker'));
  const firstJoker = revealedOptions[0].data;

  // Choose the first joker option
  w.uiChoosePackOption(0);
  await sleep(50);

  const sAfterChoose = w.getState();
  ck('Pack overlay closed after picking option', isHidden(packOverlay));
  ck('activePackOpening cleared in state', sAfterChoose.activePackOpening === null);
  ck('Chosen joker added to player jokers', sAfterChoose.jokers.some(j => j.id === firstJoker.id));
  ck('Banner updated with added card message', text('ui-banner').includes(firstJoker.name));

  console.log('\n--- TEST 4: JOKER SLOTS FULL HANDLING & SKIP OPTION ---');
  // Fill jokers up to max (5/5)
  while (w.getState().jokers.length < w.getState().maxJokers) {
    w.addJoker({ id: 'dummy_' + w.getState().jokers.length, name: 'Dummy Joker', cost: 2, rarity: 'common', isXMult: false, desc: '' });
  }
  ck('Jokers are now at max capacity (5/5)', w.getState().jokers.length === w.getState().maxJokers);

  // Force buy another joker pack
  w.patchState({
    money: 20,
    shopPacks: [{ id: 'pack_joker', name: 'Joker Pack', packType: 'joker', cost: 4, cardsCount: 3, chooseCount: 1, desc: '', shopType: 'pack', bought: false }]
  });
  w.uiBuyPack(0);
  await sleep(50);

  // Try choosing a joker when full
  w.__alerts = [];
  w.uiChoosePackOption(0);
  ck('Alert shown when trying to pick joker with full slots', (w.__alerts || []).some(m => m.includes('Joker slots full')));
  ck('Pack overlay remains open so player does not lose pack', !isHidden(packOverlay));

  // Player clicks Skip Pack
  w.uiSkipPack();
  await sleep(50);
  ck('Pack overlay hidden after skip', isHidden(packOverlay));
  ck('activePackOpening is null after skip', w.getState().activePackOpening === null);

  console.log('\n--- TEST 5: BUYING A TAROT PACK ---');
  w.patchState({
    money: 20,
    shopPacks: [{ id: 'pack_tarot', name: 'Tarot Pack', packType: 'tarot', cost: 4, cardsCount: 3, chooseCount: 1, desc: '', shopType: 'pack', bought: false }]
  });
  w.uiBuyPack(0);
  await sleep(50);

  const sTarotPack = w.getState();
  ck('Tarot pack opened', !!sTarotPack.activePackOpening);
  ck('All 3 options in Tarot pack are tarots', sTarotPack.activePackOpening.options.every(o => o.kind === 'tarot'));
  const chosenTarot = sTarotPack.activePackOpening.options[0].data;

  w.uiChoosePackOption(0);
  await sleep(50);
  ck('Chosen tarot added to player consumables', w.getState().consumables.some(c => c.id === chosenTarot.id));

  console.log('\n--- TEST 6: BUYING A PLAYING CARD PACK ---');
  const deckCountBefore = w.getState().deck.length;
  w.patchState({
    money: 20,
    shopPacks: [{ id: 'pack_card', name: 'Playing Card Pack', packType: 'card', cost: 4, cardsCount: 3, chooseCount: 1, desc: '', shopType: 'pack', bought: false }]
  });
  w.uiBuyPack(0);
  await sleep(50);

  const sCardPack = w.getState();
  ck('Playing card pack opened', !!sCardPack.activePackOpening);
  ck('All 3 options in Card pack are playing cards', sCardPack.activePackOpening.options.every(o => o.kind === 'card'));
  const chosenCard = sCardPack.activePackOpening.options[0].data;

  w.uiChoosePackOption(0);
  await sleep(50);
  ck('Card permanently added to player deck', w.getState().deck.length === deckCountBefore + 1);
  const newlyAdded = w.getState().deck[w.getState().deck.length - 1];
  ck('Added card has rank and suit matching choice', newlyAdded.rank === chosenCard.rank && newlyAdded.suit === chosenCard.suit);

  console.log('\n--- TEST 7: BUYING A VARIETY PACK ---');
  w.patchState({
    money: 20,
    shopPacks: [{ id: 'pack_variety', name: 'Variety Pack', packType: 'variety', cost: 4, cardsCount: 3, chooseCount: 1, desc: '', shopType: 'pack', bought: false }]
  });
  w.uiBuyPack(0);
  await sleep(50);

  const sVariety = w.getState();
  ck('Variety pack opened', !!sVariety.activePackOpening);
  const kinds = sVariety.activePackOpening.options.map(o => o.kind);
  ck('Variety pack contains 1 joker, 1 tarot, and 1 card', kinds.includes('joker') && kinds.includes('tarot') && kinds.includes('card'));
  w.uiSkipPack();

  console.log('\n--- TEST 8: REROLL SHOP REFRESHES PACKS ---');
  w.patchState({ money: 50, rerollCost: 2 });
  w.generateShopStock();
  w.uiRerollShop();
  await sleep(50);
  ck('Reroll generates unbought fresh packs', w.getState().shopPacks.every(p => p.bought === false));

  console.log('\n--- TEST 9: VOUCHERS UNTOUCHED & REMAIN 1 PER ANTE ---');
  const vSlot = w.getState().shopExtras.find(e => e.shopType === 'voucher');
  ck('Voucher offer remains available in shopExtras', !!vSlot);
  ck('Voucher persists 1 per ante', typeof vSlot.cost === 'number' && vSlot.cost > 0 && vSlot.shopType === 'voucher');

  console.log('\n--- ALL PACK OPENING TESTS COMPLETED ---');
  for (const r of results) console.log(r);

  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length > 0 || errors.length > 0) {
    if (errors.length) console.error('Errors encountered:', errors);
    process.exit(1);
  }
})();
