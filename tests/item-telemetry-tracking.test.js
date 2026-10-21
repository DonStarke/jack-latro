// Automated Suite: Item Lifetime Telemetry & Stats Tracking System
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
    // In-memory localStorage fallback for JSDOM file:// origin
    const storage = {};
    const mockStorage = {
      getItem(key) { return storage[key] !== undefined ? storage[key] : null; },
      setItem(key, val) { storage[key] = String(val); },
      removeItem(key) { delete storage[key]; },
      clear() { Object.keys(storage).forEach(k => delete storage[k]); }
    };
    try {
      Object.defineProperty(win, 'localStorage', { value: mockStorage, configurable: true, writable: true });
    } catch (e) {}
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

  console.log('\n--- TEST 1: INITIAL UNPLAYED TELEMETRY PLACEHOLDERS ---');
  // Reset lifetime telemetry to ensure clean state
  w.resetLifetimeTelemetry();

  const freshJoker = w.getItemTelemetryStats('jokers', 'the_shark');
  ck('Unencountered joker returns 6 metric slots', freshJoker.metrics.length === 6);
  ck('Unencountered joker Times Discovered is "--"', freshJoker.metrics.find(m => m.label === 'Times Discovered').value === '--');
  ck('Unencountered joker Rounds Held is "--"', freshJoker.metrics.find(m => m.label === 'Rounds Held').value === '--');
  ck('Unencountered joker Hands Triggered is "--"', freshJoker.metrics.find(m => m.label === 'Hands Triggered').value === '--');
  ck('Unencountered joker Chips Contributed is "--"', freshJoker.metrics.find(m => m.label === 'Chips Contributed').value === '--');
  ck('Unencountered joker Mult Contributed is "--"', freshJoker.metrics.find(m => m.label === 'Mult Contributed').value === '--');
  ck('Unencountered joker Win Rate When Held is "--%"', freshJoker.metrics.find(m => m.label === 'Win Rate When Held').value === '--%');

  const freshTarot = w.getItemTelemetryStats('tarots', 'loaded_ace');
  ck('Unused tarot Times Acquired is "--"', freshTarot.metrics.find(m => m.label === 'Times Acquired').value === '--');
  ck('Unused tarot Times Cast is "--"', freshTarot.metrics.find(m => m.label === 'Times Cast').value === '--');
  ck('Unused tarot Times Sold is "--"', freshTarot.metrics.find(m => m.label === 'Times Sold').value === '--');
  ck('Unused tarot Win Rate When Cast is "--%"', freshTarot.metrics.find(m => m.label === 'Win Rate When Cast').value === '--%');

  const freshVoucher = w.getItemTelemetryStats('vouchers', 'extra_hand');
  ck('Unredeemed voucher Times Redeemed is "--"', freshVoucher.metrics.find(m => m.label === 'Times Redeemed').value === '--');
  ck('Unredeemed voucher Earliest Ante Acquired is "--"', freshVoucher.metrics.find(m => m.label === 'Earliest Ante Acquired').value === '--');
  ck('Unredeemed voucher Runs Won With Voucher is "--"', freshVoucher.metrics.find(m => m.label === 'Runs Won With Voucher').value === '--');
  ck('Unredeemed voucher Est. Value Contributed is "--"', freshVoucher.metrics.find(m => m.label === 'Est. Value Contributed').value === '--');

  const freshEffect = w.getItemTelemetryStats('effects', 'poly');
  ck('Unused effect Cards Enhanced is "--"', freshEffect.metrics.find(m => m.label === 'Cards Enhanced').value === '--');
  ck('Unused effect Times Scored In Hand is "--"', freshEffect.metrics.find(m => m.label === 'Times Scored In Hand').value === '--');
  ck('Unused effect Bonus Impact is "--"', freshEffect.metrics.find(m => m.label === 'Bonus Impact').value === '--');
  ck('Unused effect Deck Saturation Peak is "--%"', freshEffect.metrics.find(m => m.label === 'Deck Saturation Peak').value === '--%');

  const freshPack = w.getItemTelemetryStats('packs', 'pack_joker');
  ck('Unopened pack Packs Opened is "--"', freshPack.metrics.find(m => m.label === 'Packs Opened').value === '--');
  ck('Unopened pack Cards Drafted is "--"', freshPack.metrics.find(m => m.label === 'Cards Drafted').value === '--');
  ck('Unopened pack Packs Skipped is "--"', freshPack.metrics.find(m => m.label === 'Packs Skipped').value === '--');
  ck('Unopened pack Total Money Invested is "$0"', freshPack.metrics.find(m => m.label === 'Total Money Invested').value === '$0');

  console.log('\n--- TEST 2: JOKER LIFETIME TELEMETRY TRACKING ---');
  // Record discovering, acquiring, and holding The Shark
  w.recordJokerDiscovered('the_shark');
  ck('Recording discovery increments Times Discovered to "1"', w.getItemTelemetryStats('jokers', 'the_shark').metrics.find(m => m.label === 'Times Discovered').value === '1');

  // Trigger scoring with chips and mult
  w.recordJokerTriggerStats('the_shark', 50, 4);
  const jStatsTrigger = w.getItemTelemetryStats('jokers', 'the_shark');
  ck('Hands Triggered increments to "1"', jStatsTrigger.metrics.find(m => m.label === 'Hands Triggered').value === '1');
  ck('Chips Contributed records "+50c"', jStatsTrigger.metrics.find(m => m.label === 'Chips Contributed').value === '+50c');
  ck('Mult Contributed records "+4m"', jStatsTrigger.metrics.find(m => m.label === 'Mult Contributed').value === '+4m');

  // Second trigger adds cumulative chips & mult
  w.recordJokerTriggerStats('the_shark', 25, 2.5);
  const jStatsTrigger2 = w.getItemTelemetryStats('jokers', 'the_shark');
  ck('Cumulative Hands Triggered is "2"', jStatsTrigger2.metrics.find(m => m.label === 'Hands Triggered').value === '2');
  ck('Cumulative Chips Contributed is "+75c"', jStatsTrigger2.metrics.find(m => m.label === 'Chips Contributed').value === '+75c');
  ck('Cumulative Mult Contributed is "+6.5m"', jStatsTrigger2.metrics.find(m => m.label === 'Mult Contributed').value === '+6.5m');

  // Win first blind while holding The Shark
  w.recordJokerRound('the_shark', true);
  const jStatsWin = w.getItemTelemetryStats('jokers', 'the_shark');
  ck('Rounds Held increments to "1"', jStatsWin.metrics.find(m => m.label === 'Rounds Held').value === '1');
  ck('Win rate with 1 win / 1 round is "100%"', jStatsWin.metrics.find(m => m.label === 'Win Rate When Held').value === '100%');

  // Lose second blind while holding The Shark
  w.recordJokerRound('the_shark', false);
  const jStatsLoss = w.getItemTelemetryStats('jokers', 'the_shark');
  ck('Rounds Held increments to "2"', jStatsLoss.metrics.find(m => m.label === 'Rounds Held').value === '2');
  ck('Win rate with 1 win / 2 rounds is "50%"', jStatsLoss.metrics.find(m => m.label === 'Win Rate When Held').value === '50%');

  console.log('\n--- TEST 3: TAROT CONSUMABLE TELEMETRY TRACKING ---');
  // Acquire tarot
  w.recordTarotAcquired('loaded_ace');
  ck('Tarot acquired increments Times Acquired to "1"', w.getItemTelemetryStats('tarots', 'loaded_ace').metrics.find(m => m.label === 'Times Acquired').value === '1');

  // Cast tarot in hand
  w.recordTarotCast('loaded_ace');
  ck('Tarot cast increments Times Cast to "1"', w.getItemTelemetryStats('tarots', 'loaded_ace').metrics.find(m => m.label === 'Times Cast').value === '1');

  // Hand is won with this tarot
  w.recordTarotHandWon('loaded_ace');
  ck('Win rate when cast on winning hand is "100%"', w.getItemTelemetryStats('tarots', 'loaded_ace').metrics.find(m => m.label === 'Win Rate When Cast').value === '100%');

  // Sell tarot
  w.recordTarotSold('loaded_ace');
  ck('Tarot sold increments Times Sold to "1"', w.getItemTelemetryStats('tarots', 'loaded_ace').metrics.find(m => m.label === 'Times Sold').value === '1');

  console.log('\n--- TEST 4: TABLE VOUCHER TELEMETRY TRACKING ---');
  // Redeem voucher in Ante 3
  w.recordVoucherRedeemed('table_leverage', 3);
  const vStats1 = w.getItemTelemetryStats('vouchers', 'table_leverage');
  ck('Times Redeemed is "1"', vStats1.metrics.find(m => m.label === 'Times Redeemed').value === '1');
  ck('Earliest Ante Acquired is "Ante 3"', vStats1.metrics.find(m => m.label === 'Earliest Ante Acquired').value === 'Ante 3');

  // Redeem same voucher in Ante 1 in a future run
  w.recordVoucherRedeemed('table_leverage', 1);
  const vStats2 = w.getItemTelemetryStats('vouchers', 'table_leverage');
  ck('Times Redeemed increments to "2"', vStats2.metrics.find(m => m.label === 'Times Redeemed').value === '2');
  ck('Earliest Ante Acquired updates to lowest ante ("Ante 1")', vStats2.metrics.find(m => m.label === 'Earliest Ante Acquired').value === 'Ante 1');

  // Conquer run with voucher
  w.recordVoucherRunWon('table_leverage');
  ck('Runs Won With Voucher increments to "1"', w.getItemTelemetryStats('vouchers', 'table_leverage').metrics.find(m => m.label === 'Runs Won With Voucher').value === '1');

  // Accumulate estimated value
  w.recordVoucherValue('table_leverage', 24);
  ck('Est. Value Contributed records "+$24"', w.getItemTelemetryStats('vouchers', 'table_leverage').metrics.find(m => m.label === 'Est. Value Contributed').value === '+$24');

  console.log('\n--- TEST 5: CARD EDITION SPECIAL EFFECTS TELEMETRY ---');
  // Foil enhancement
  w.recordEffectEnhanced('foil');
  w.recordEffectEnhanced('foil');
  ck('Foil Cards Enhanced records "2"', w.getItemTelemetryStats('effects', 'foil').metrics.find(m => m.label === 'Cards Enhanced').value === '2');

  // Scored in hand
  w.recordEffectScored('foil', 30, 0, false, 0);
  w.recordEffectScored('foil', 30, 0, false, 0);
  const foilStats = w.getItemTelemetryStats('effects', 'foil');
  ck('Foil Times Scored In Hand is "2"', foilStats.metrics.find(m => m.label === 'Times Scored In Hand').value === '2');
  ck('Foil Bonus Impact records "+60c"', foilStats.metrics.find(m => m.label === 'Bonus Impact').value === '+60c');

  // Deck saturation peak
  w.recordDeckSaturation('foil', 15.4);
  ck('Deck Saturation Peak records "15%"', w.getItemTelemetryStats('effects', 'foil').metrics.find(m => m.label === 'Deck Saturation Peak').value === '15%');
  // Lower peak should not override
  w.recordDeckSaturation('foil', 8.2);
  ck('Lower saturation does not lower peak (still "15%")', w.getItemTelemetryStats('effects', 'foil').metrics.find(m => m.label === 'Deck Saturation Peak').value === '15%');
  // Higher peak updates
  w.recordDeckSaturation('foil', 22.8);
  ck('Higher saturation updates peak ("23%")', w.getItemTelemetryStats('effects', 'foil').metrics.find(m => m.label === 'Deck Saturation Peak').value === '23%');

  // Gold enhancement
  w.recordEffectEnhanced('gold');
  w.recordEffectScored('gold', 0, 0, false, 6);
  const goldStats = w.getItemTelemetryStats('effects', 'gold');
  ck('Gold Bonus Impact records "+$6"', goldStats.metrics.find(m => m.label === 'Bonus Impact').value === '+$6');

  // Holo enhancement
  w.recordEffectEnhanced('holo');
  w.recordEffectScored('holo', 0, 8, false, 0);
  const holoStats = w.getItemTelemetryStats('effects', 'holo');
  ck('Holo Bonus Impact records "+8m"', holoStats.metrics.find(m => m.label === 'Bonus Impact').value === '+8m');

  console.log('\n--- TEST 6: BOOSTER PACK TELEMETRY TRACKING ---');
  // Open pack
  w.recordPackOpened('pack_joker', 4);
  w.recordPackOpened('pack_joker', 4);
  const packStats1 = w.getItemTelemetryStats('packs', 'pack_joker');
  ck('Packs Opened records "2"', packStats1.metrics.find(m => m.label === 'Packs Opened').value === '2');
  ck('Total Money Invested records "$8"', packStats1.metrics.find(m => m.label === 'Total Money Invested').value === '$8');

  // Draft card
  w.recordPackCardDrafted('pack_joker');
  ck('Cards Drafted records "1"', w.getItemTelemetryStats('packs', 'pack_joker').metrics.find(m => m.label === 'Cards Drafted').value === '1');

  // Skip pack
  w.recordPackSkipped('pack_joker');
  ck('Packs Skipped records "1"', w.getItemTelemetryStats('packs', 'pack_joker').metrics.find(m => m.label === 'Packs Skipped').value === '1');

  console.log('\n--- TEST 7: LOCALSTORAGE PERSISTENCE ACROSS SESSIONS ---');
  const storedJson = w.localStorage.getItem('jacklatro_library_telemetry');
  ck('Telemetry data is serialized into localStorage', !!storedJson && storedJson.length > 20);
  const parsed = JSON.parse(storedJson);
  ck('Serialized store contains the_shark telemetry', !!parsed.jokers.the_shark);
  ck('Serialized the_shark handsTriggered is 2', parsed.jokers.the_shark.handsTriggered === 2);
  ck('Serialized table_leverage earliestAnte is 1', parsed.vouchers.table_leverage.earliestAnte === 1);
  ck('Serialized foil deckSaturationPeak is 22.8', parsed.effects.foil.deckSaturationPeak === 22.8);

  console.log('\n--- TEST 8: DETAIL MODAL RENDERS REAL METRICS LIVE ---');
  w.openLibraryModal('jokers');
  await sleep(50);
  w.openLibraryDetail('jokers', 'the_shark');
  await sleep(50);

  const statsGrid = $('ui-lib-detail-stats-grid');
  ck('Detail modal renders stats grid', !!statsGrid);
  ck('Detail modal displays "Times Discovered" with tracked value "1"', statsGrid.textContent.includes('Times Discovered') && statsGrid.textContent.includes('1'));
  ck('Detail modal displays "Chips Contributed" with "+75c"', statsGrid.textContent.includes('Chips Contributed') && statsGrid.textContent.includes('+75c'));
  ck('Detail modal displays "Win Rate When Held" with "50%"', statsGrid.textContent.includes('Win Rate When Held') && statsGrid.textContent.includes('50%'));

  w.closeLibraryDetail();
  w.closeLibraryModal();

  console.log('\n--- TEST 9: VERSIONED SCHEMA MIGRATION & CORRUPTION RECOVERY ---');
  // 1. Migrate legacy unversioned raw save (v0 -> v1)
  const legacySave = {
    jokers: {
      the_shark: { discovered: 4, roundsHeld: 5, roundsWon: 3, handsTriggered: 12, chipsContributed: 450, multContributed: 30 },
      lucky_sevens: { discovered: 1, roundsHeld: 1, roundsWon: 1, handsTriggered: 2, chipsContributed: 140, multContributed: 14 }
    },
    tarots: {
      polychrome_dice: { discovered: 2, acquired: 2, cast: 2, castWon: 2, sold: 0 }
    },
    vouchers: {
      extra_hand: { discovered: 3, redeemed: 1, earliestAnte: 2, runsWon: 1, estValue: 12 }
    },
    effects: {
      poly: { enhanced: 3, timesScored: 8, bonusImpact: 4, deckSaturationPeak: 12.5 }
    },
    packs: {
      pack_variety: { discovered: 5, opened: 2, drafted: 2, skipped: 0, moneyInvested: 8 }
    }
  };

  const migrated = w.migrateTelemetryStore(legacySave);
  ck('Migrated store has schemaVersion 1', migrated.schemaVersion === 1);
  ck('Migrated store preserves the_shark handsTriggered (12)', migrated.jokers.the_shark.handsTriggered === 12);
  ck('Migrated store preserves lucky_sevens chipsContributed (140)', migrated.jokers.lucky_sevens.chipsContributed === 140);
  ck('Migrated store preserves polychrome_dice cast (2)', migrated.tarots.polychrome_dice.cast === 2);
  ck('Migrated store preserves extra_hand earliestAnte (2)', migrated.vouchers.extra_hand.earliestAnte === 2);
  ck('Migrated store preserves poly deckSaturationPeak (12.5)', migrated.effects.poly.deckSaturationPeak === 12.5);
  ck('Migrated store preserves pack_variety moneyInvested (8)', migrated.packs.pack_variety.moneyInvested === 8);

  // 2. Safe field sanitization against corrupt/malformed values
  const corruptFields = {
    jokers: {
      even_steven: { discovered: 'corrupt_string', roundsHeld: null, roundsWon: NaN, handsTriggered: 9, chipsContributed: Infinity, multContributed: 5 }
    }
  };
  const sanitized = w.migrateTelemetryStore(corruptFields);
  ck('Corrupt non-numeric discovered sanitized to default 0', sanitized.jokers.even_steven.discovered === 0);
  ck('Corrupt null roundsHeld sanitized to 0', sanitized.jokers.even_steven.roundsHeld === 0);
  ck('Corrupt NaN roundsWon sanitized to 0', sanitized.jokers.even_steven.roundsWon === 0);
  ck('Valid handsTriggered (9) preserved', sanitized.jokers.even_steven.handsTriggered === 9);
  ck('Corrupt Infinity chipsContributed sanitized to 0', sanitized.jokers.even_steven.chipsContributed === 0);
  ck('Valid multContributed (5) preserved', sanitized.jokers.even_steven.multContributed === 5);

  // 3. Dual persistence buffer: verify both primary and secondary backup keys exist
  w.saveLifetimeTelemetry();
  const primaryVal = w.localStorage.getItem('jacklatro_library_telemetry');
  const backupVal = w.localStorage.getItem('jacklatro_library_telemetry_backup');
  ck('Primary storage key is written', !!primaryVal);
  ck('Secondary backup key is written simultaneously', !!backupVal);
  ck('Backup key matches primary key content', primaryVal === backupVal);

  // 4. Emergency corrupt JSON handling & backup restore
  // Inject corrupted raw string into primary key while backup has good data
  w.localStorage.setItem('jacklatro_library_telemetry', '{"schemaVersion": 1, "jokers": MALFORMED_JSON_STRING!!!');
  const recoveredStore = w.loadLifetimeTelemetry();
  ck('Corrupt primary string recovered from secondary backup without crash', !!recoveredStore);
  ck('Recovered store has schemaVersion 1', recoveredStore.schemaVersion === 1);
  const archivedCorrupt = w.localStorage.getItem('jacklatro_library_telemetry_corrupted_raw');
  ck('Corrupted raw data was archived to safety key', !!archivedCorrupt && archivedCorrupt.includes('MALFORMED_JSON_STRING'));

  console.log('\n--- ALL ITEM TELEMETRY TESTS COMPLETED ---');
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
