// Automated Suite: View Library Compendium & Item Inspection Telemetry
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
  const w = dom.window, d = w.document;
  for (let i = 0; i < 60 && typeof w.openLibraryModal !== 'function'; i++) await sleep(50);
  const $ = id => d.getElementById(id);
  const click = id => $(id).click();
  const text = id => $(id).textContent;
  const isHidden = el => !el || el.classList.contains('hidden') || el.style.display === 'none';

  console.log('\n--- TEST 1: MAIN/INTRO SCREEN "VIEW LIBRARY" BUTTON ---');
  const splash = $('ui-splash-screen');
  ck('Splash screen exists on boot', !!splash);
  ck('Splash screen is visible on initial load', !isHidden(splash));

  const libBtn = $('btn-splash-library');
  ck('View library button exists on main screen', !!libBtn);
  ck('View library button text contains "VIEW LIBRARY"', /VIEW LIBRARY/i.test(libBtn.textContent));
  ck('View library button has library icon', libBtn.textContent.includes('📖'));

  const libraryModal = $('ui-library-modal');
  ck('Library modal element exists in DOM', !!libraryModal);
  ck('Library modal is initially hidden', isHidden(libraryModal));

  console.log('\n--- TEST 2: OPENING LIBRARY LANDING PAGE & CATEGORY OPTIONS ---');
  click('btn-splash-library');
  await sleep(50);
  ck('Clicking View Library opens library modal', !isHidden(libraryModal));

  const catPage = $('ui-lib-categories-page');
  const itemsPage = $('ui-lib-items-page');
  const catTabs = $('ui-lib-category-tabs');
  ck('Categories selection page is visible on initial open', !isHidden(catPage));
  ck('Items grid page is hidden on initial open', isHidden(itemsPage));
  ck('Category tabs bar is hidden on categories landing page', isHidden(catTabs));

  const titleEl = $('ui-lib-title');
  const backLabel = $('ui-lib-back-label');
  ck('Library header title is ARCHIVES & COMPENDIUM', titleEl && /ARCHIVES/i.test(titleEl.textContent));
  ck('Library back button reads "Main Menu"', backLabel && backLabel.textContent.includes('Main Menu'));

  // Check the 5 required category choices
  const cardJokers = $('lib-cat-card-jokers');
  const cardTarots = $('lib-cat-card-tarots');
  const cardVouchers = $('lib-cat-card-vouchers');
  const cardEffects = $('lib-cat-card-effects');
  const cardPacks = $('lib-cat-card-packs');

  ck('Category choice for Jokers exists', !!cardJokers);
  ck('Jokers category displays "37 CARDS"', cardJokers && cardJokers.textContent.includes('37 CARDS'));
  ck('Category choice for Tarots exists', !!cardTarots);
  ck('Tarots category displays "17 CONSUMABLES"', cardTarots && cardTarots.textContent.includes('17 CONSUMABLES'));
  ck('Category choice for Vouchers exists', !!cardVouchers);
  ck('Vouchers category displays "10 UPGRADES"', cardVouchers && cardVouchers.textContent.includes('10 UPGRADES'));
  ck('Category choice for Card Effects exists', !!cardEffects);
  ck('Card Effects category displays "4 SPECIAL EFFECTS"', cardEffects && cardEffects.textContent.includes('4 SPECIAL EFFECTS'));
  ck('Category choice for Packs exists', !!cardPacks);
  ck('Packs category displays "5 BOOSTER PACKS"', cardPacks && cardPacks.textContent.includes('5 BOOSTER PACKS'));

  console.log('\n--- TEST 3: NAVIGATING TO JOKERS CATEGORY & SUBFILTERS ---');
  cardJokers.click();
  await sleep(50);
  ck('Selecting Jokers hides categories landing page', isHidden(catPage));
  ck('Selecting Jokers shows items grid page', !isHidden(itemsPage));
  ck('Category tabs bar is now visible', !isHidden(catTabs));
  ck('Jokers category tab has active class', $('lib-tab-jokers') && $('lib-tab-jokers').classList.contains('active'));
  ck('Library header title updates to Jokers compendium', titleEl && /JOKERS/i.test(titleEl.textContent));
  ck('Back button updates to "Categories"', backLabel && backLabel.textContent.includes('Categories'));

  const itemsGrid = $('ui-lib-items-grid');
  const jokerCards = itemsGrid.querySelectorAll('.lib-joker-card');
  ck(`Items grid renders all ${w.JOKER_CATALOG.length} Jokers`, jokerCards.length === w.JOKER_CATALOG.length);

  const subfilterBar = $('ui-lib-subfilter-bar');
  ck('Jokers category renders subfilter bar', !isHidden(subfilterBar));
  const rareFilterBtn = subfilterBar.querySelector('.filter-rare');
  ck('Rare filter pill exists', !!rareFilterBtn);

  rareFilterBtn.click();
  await sleep(50);
  const rareCards = itemsGrid.querySelectorAll('.lib-joker-card');
  const expectedRareCount = w.JOKER_CATALOG.filter(j => j.rarity === 'rare').length;
  ck(`Filtering by Rare renders exactly ${expectedRareCount} Rare Jokers`, rareCards.length === expectedRareCount);

  const allFilterBtn = subfilterBar.querySelector('.lib-filter-pill');
  allFilterBtn.click();
  await sleep(50);
  ck(`Restoring ALL filter renders ${w.JOKER_CATALOG.length} Jokers again`, itemsGrid.querySelectorAll('.lib-joker-card').length === w.JOKER_CATALOG.length);

  console.log('\n--- TEST 4: JOKER ENLARGED DETAIL & TELEMETRY STATS MODAL ---');
  const detailModal = $('ui-lib-detail-modal');
  ck('Item detail modal is initially hidden', isHidden(detailModal));

  // Click on Shark joker
  w.openLibraryDetail('jokers', 'the_shark');
  await sleep(50);
  ck('Clicking a Joker opens detail modal', !isHidden(detailModal));

  const detailStage = $('ui-lib-detail-stage');
  const detailTitle = $('ui-lib-detail-title');
  const detailBadge = $('ui-lib-detail-badge');
  const detailCost = $('ui-lib-detail-cost');
  const detailDesc = $('ui-lib-detail-desc');
  const statsGrid = $('ui-lib-detail-stats-grid');
  const statsStatus = $('ui-lib-detail-stats-status');

  ck('Detail stage renders enlarged Joker card', detailStage && !!detailStage.querySelector('.lib-stage-joker-card'));
  ck('Detail badge shows RARE', detailBadge && detailBadge.textContent === 'RARE');
  ck('Detail title shows The Shark', detailTitle && detailTitle.textContent.includes('The Shark'));
  ck('Detail cost shows $8', detailCost && detailCost.textContent === '$8');
  ck('Detail description contains Shark multiplier rule', detailDesc && detailDesc.textContent.includes('beats the Dealer by 3'));

  ck('Telemetry stats status indicates upcoming tracking', statsStatus && statsStatus.textContent.includes('Joker Lifetime Telemetry'));
  const statBoxes = statsGrid.querySelectorAll('.lib-stat-box');
  ck('Telemetry stats grid renders structured metric boxes (6 metrics)', statBoxes.length === 6);
  ck('Stats box includes "Times Discovered" with placeholder "--"', statsGrid.textContent.includes('Times Discovered') && statsGrid.textContent.includes('--'));
  ck('Stats box includes "Hands Triggered" with placeholder "--"', statsGrid.textContent.includes('Hands Triggered'));
  ck('Stats box includes "Win Rate When Held" with placeholder "--%"', statsGrid.textContent.includes('Win Rate When Held') && statsGrid.textContent.includes('--%'));

  w.closeLibraryDetail();
  await sleep(50);
  ck('Closing detail modal hides detail modal', isHidden(detailModal));
  ck('Items grid remains visible after closing detail modal', !isHidden(itemsPage));

  console.log('\n--- TEST 5: TAROTS CATEGORY & DETAIL INSPECTION ---');
  w.switchLibraryCategory('tarots');
  await sleep(50);
  ck('Tarots category tab is active', $('lib-tab-tarots').classList.contains('active'));
  ck('Header title indicates TAROT SPELLS', titleEl.textContent.includes('TAROT'));
  const tarotCards = itemsGrid.querySelectorAll('.lib-tarot-card');
  ck('Items grid renders all Tarots', tarotCards.length === w.TAROT_CATALOG.length);

  w.openLibraryDetail('tarots', 'polychrome_dice');
  await sleep(50);
  ck('Opening Tarot detail displays enlarged tarot card', !isHidden(detailModal));
  ck('Tarot detail title shows Polychrome Dice', detailTitle.textContent.includes('Polychrome Dice'));
  ck('Tarot detail stage renders enlarged tarot stage', detailStage && !!detailStage.querySelector('.lib-stage-tarot-card'));
  ck('Tarot detail description describes Polychrome enhancement', detailDesc.textContent.includes('×1.5 Mult'));
  ck('Tarot telemetry includes Times Cast metric', statsGrid.textContent.includes('Times Cast'));

  w.closeLibraryDetail();
  await sleep(50);

  console.log('\n--- TEST 6: VOUCHERS CATEGORY & DETAIL INSPECTION ---');
  w.switchLibraryCategory('vouchers');
  await sleep(50);
  ck('Vouchers category tab is active', $('lib-tab-vouchers').classList.contains('active'));
  ck('Header title indicates VOUCHERS (10)', titleEl.textContent.includes('VOUCHERS'));
  const voucherCards = itemsGrid.querySelectorAll('.lib-voucher-card');
  ck('Items grid renders all 10 Vouchers', voucherCards.length === 10);

  w.openLibraryDetail('vouchers', 'clearance_sale');
  await sleep(50);
  ck('Opening Voucher detail displays enlarged voucher', !isHidden(detailModal));
  ck('Voucher detail title shows Clearance Rack', detailTitle.textContent.includes('Clearance Rack'));
  ck('Voucher detail stage renders enlarged voucher stage', detailStage && !!detailStage.querySelector('.lib-stage-voucher-card'));
  ck('Voucher description indicates shop rerolls discount', detailDesc.textContent.includes('$1'));
  ck('Voucher telemetry includes Times Redeemed metric', statsGrid.textContent.includes('Times Redeemed'));

  w.closeLibraryDetail();
  await sleep(50);

  console.log('\n--- TEST 7: CARD EFFECTS CATEGORY (HOLO, POLY, FOIL, GOLD) ---');
  w.switchLibraryCategory('effects');
  await sleep(50);
  ck('Card Effects category tab is active', $('lib-tab-effects').classList.contains('active'));
  ck('Header title indicates CARD SPECIAL EFFECTS (4)', titleEl.textContent.includes('EFFECTS'));
  const effectCards = itemsGrid.querySelectorAll('.lib-effect-card');
  ck('Items grid renders all 4 Card Effects', effectCards.length === 4);
  ck('Grid includes Foil effect (+30 Chips)', itemsGrid.textContent.includes('Foil') && itemsGrid.textContent.includes('+30 Chips'));
  ck('Grid includes Holographic effect (+4 Mult)', itemsGrid.textContent.includes('Holographic') && itemsGrid.textContent.includes('+4 Mult'));
  ck('Grid includes Polychrome effect (×1.5 Mult)', itemsGrid.textContent.includes('Polychrome') && itemsGrid.textContent.includes('×1.5 Mult'));
  ck('Grid includes Gold effect (+$3 Cash)', itemsGrid.textContent.includes('Gold') && itemsGrid.textContent.includes('+$3 Cash'));

  w.openLibraryDetail('effects', 'poly');
  await sleep(50);
  ck('Opening Polychrome detail displays enlarged card', !isHidden(detailModal));
  ck('Card Effect detail renders zoomed card with enh-poly shader', detailStage && !!detailStage.querySelector('.playing-card.card-zoomed.enh-poly'));
  ck('Card Effect detail title indicates Polychrome Edition', detailTitle.textContent.includes('Polychrome'));
  ck('Card Effect telemetry includes Cards Enhanced metric', statsGrid.textContent.includes('Cards Enhanced'));

  w.closeLibraryDetail();
  await sleep(50);

  console.log('\n--- TEST 8: BOOSTER PACKS CATEGORY & DETAIL INSPECTION ---');
  w.switchLibraryCategory('packs');
  await sleep(50);
  ck('Packs category tab is active', $('lib-tab-packs').classList.contains('active'));
  ck('Header title indicates BOOSTER PACKS (5)', titleEl.textContent.includes('PACKS'));
  const packCards = itemsGrid.querySelectorAll('.lib-pack-card');
  ck('Items grid renders all 5 Booster Packs', packCards.length === 5);
  ck('Grid includes Joker Pack', itemsGrid.textContent.includes('Joker Pack'));
  ck('Grid includes Tarot Pack', itemsGrid.textContent.includes('Tarot Pack'));
  ck('Grid includes Cheat Pack', itemsGrid.textContent.includes('Cheat Pack'));
  ck('Grid includes Playing Card Pack', itemsGrid.textContent.includes('Playing Card Pack'));
  ck('Grid includes Variety Pack', itemsGrid.textContent.includes('Variety Pack'));

  w.openLibraryDetail('packs', 'pack_joker');
  await sleep(50);
  ck('Opening Booster Pack detail displays enlarged pack wrapper', !isHidden(detailModal));
  ck('Booster Pack detail stage renders crimped pack card', detailStage && !!detailStage.querySelector('.lib-stage-pack-card.pack-joker'));
  ck('Booster Pack description describes choosing 1 of 3 Jokers', detailDesc.textContent.includes('Choose 1 of 3 Jokers'));
  ck('Booster Pack telemetry includes Packs Opened metric', statsGrid.textContent.includes('Packs Opened'));

  w.closeLibraryDetail();
  await sleep(50);

  console.log('\n--- TEST 9: NAVIGATION & HIERARCHY BACK FLOW ---');
  // While inside category items page, clicking Back should return to categories landing page
  click('btn-library-back');
  await sleep(50);
  ck('Clicking Back from items page returns to Categories selection page', !isHidden(catPage));
  ck('Items page is hidden after returning to categories', isHidden(itemsPage));
  ck('Category tabs bar is hidden on categories landing page', isHidden(catTabs));
  ck('Back button text resets to "Main Menu"', backLabel.textContent.includes('Main Menu'));

  // Clicking Back from categories landing page should close library and return to main/intro screen
  click('btn-library-back');
  await sleep(50);
  ck('Clicking Back from categories page closes library modal', isHidden(libraryModal));
  ck('Splash screen remains active and visible', !isHidden(splash));

  console.log('\n--- TEST 10: IN-GAME COG SETTINGS LAUNCHER ---');
  // Test opening library from Settings cog modal
  w.toggleCogModal(true);
  await sleep(50);
  const cogModal = $('ui-cog-modal');
  ck('Cog Settings modal is visible', !isHidden(cogModal));
  const cogLibBtn = $('btn-modal-library');
  ck('Cog modal has View Library button', !!cogLibBtn);

  click('btn-modal-library');
  await sleep(50);
  ck('Opening library from Cog modal hides Cog modal', isHidden(cogModal));
  ck('Opening library from Cog modal opens library modal', !isHidden(libraryModal));

  w.closeLibraryModal();
  await sleep(50);
  ck('Library modal closes cleanly', isHidden(libraryModal));

  console.log('\n--- ALL LIBRARY TESTS COMPLETED ---');
  results.forEach(r => console.log(r));

  if (errors.length > 0) {
    console.error('Errors encountered during tests:', errors);
    process.exit(1);
  }

  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length > 0) {
    console.error(`FAILED: ${failed.length} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\nSUCCESS: All ${results.length} checks passed cleanly!`);
    process.exit(0);
  }
})();
