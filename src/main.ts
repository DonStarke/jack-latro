/* ==========================================================
   main.ts - UI LAYER & PLAY FLOW
   Renders the page, runs the animated hand flow and wires buttons.
   Holds NO game rules and NO state of its own: it reads via
   getState() and changes the game only through the engine APIs
   (gameState / deckEngine / modifierEngine / shopEngine / simulator).
   Functions prefixed "ui" wrap an engine action with its UI refresh
   (their names differ from the engine functions on purpose, because
   all scripts share one global scope).
   Loaded last; boots the game at the bottom of this file.
   Depends on (global): every other script, plus uiFx.ts
========================================================== */

/** Typed getElementById that throws a clear error if the element is missing. */
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id} in index.html`);
  return el as T;
}

let lastSimReportText = '';
let lastSimFilename = 'jack-latro-telemetry.txt';

/* ---------- Joker text helpers ---------- */

function getJokerFullDesc(j: JokerInstance): string {
  if (j.id === 'daredevil') {
    const cur = j.bonusMult || 0;
    return `Permanently gains +3 Mult for the rest of the run every time you Hit on 14+ without busting. (Currently: +${cur} Mult)`;
  }
  if (j.id === 'chip_stacker') {
    const cur = j.bonusChips || 0;
    return `Permanently gains +15 Chips for the rest of the run every time you win with a Double Down. (Currently: +${cur} Chips)`;
  }
  return j.desc;
}

function getJokerMiniSubHTML(j: JokerInstance): string {
  if (j.id === 'daredevil') {
    const cur = j.bonusMult || 0;
    return `<span style="color:var(--mult);font-weight:900;">+${cur}m</span> (+3m/Hit 14+)`;
  }
  if (j.id === 'chip_stacker') {
    const cur = j.bonusChips || 0;
    return `<span style="color:var(--chips);font-weight:900;">+${cur}c</span> (+15c/Dbl Win)`;
  }
  if (j.id === 'bust_cushion') {
    return `22 = 21! (Bust 23+)`;
  }
  return j.desc;
}

/* ---------- Outcome headline ---------- */

function hideOutcomeHeadline(): void {
  const el = $('ui-outcome-headline');
  el.className = 'outcome-headline hidden';
}

function showOutcomeHeadline(text: string, styleType: 'WIN' | 'LOSS'): void {
  const el = $('ui-outcome-headline');
  el.textContent = text;
  el.className = `outcome-headline ${styleType === 'WIN' ? 'win-style' : 'loss-style'}`;
}

/* ---------- Score popups ---------- */

function popPlayerCard(cardIdx: number, text: string): void {
  const row = $('ui-player-cards');
  const cardEl = row.children[cardIdx];
  if (!cardEl) return;
  cardEl.classList.add('scoring-pop');
  const pop = document.createElement('div');
  pop.className = 'card-float-pop';
  pop.textContent = text;
  cardEl.appendChild(pop);
  setTimeout(() => {
    cardEl.classList.remove('scoring-pop');
    if (pop.parentNode) pop.remove();
  }, 360);
}

function popJokerCard(jokerIdx: number): void {
  const row = $('ui-joker-row');
  const jEl = row.children[jokerIdx];
  if (!jEl) return;
  jEl.classList.add('active-pop');
  setTimeout(() => jEl.classList.remove('active-pop'), 320);
}

/* ---------- Inspectors ---------- */

function inspectJoker(index: number): void {
  const state = getState();
  const j = state.jokers[index];
  if (!j) return;
  const sellVal = Math.max(1, Math.floor(j.cost / 2));
  const box = $('ui-inspect-content');
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3 style="color:var(--gold);">${j.name}</h3>
      <button class="btn btn-secondary" onclick="closeInspector()">Close</button>
    </div>
    <div style="font-size:13px; color:#e2e8f0; line-height:1.4;">${getJokerFullDesc(j)}</div>
    <div style="font-size:10px; color:#94a3b8;">Tip: Jokers trigger Left ➔ Right. Put +Mult Jokers to the left of ×Mult Jokers!</div>
    <div style="display:flex; gap:6px;">
      <button class="btn btn-secondary" style="flex:1;" onclick="uiMoveJoker(${index}, -1)" ${index === 0 ? 'disabled' : ''}>◀ Move Left</button>
      <button class="btn btn-secondary" style="flex:1;" onclick="uiMoveJoker(${index}, 1)" ${index === state.jokers.length - 1 ? 'disabled' : ''}>Move Right ▶</button>
    </div>
    <button class="btn btn-redeal" style="padding:10px;" onclick="uiSellJoker(${index})">Sell Joker for $${sellVal}</button>
  `;
  $('ui-inspect-modal').classList.remove('hidden');
}

function inspectConsumable(index: number): void {
  const state = getState();
  const c = state.consumables[index];
  if (!c) return;
  const box = $('ui-inspect-content');
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3 style="color:#d8b4fe;">${c.name}</h3>
      <button class="btn btn-secondary" onclick="closeInspector()">Close</button>
    </div>
    <div style="font-size:13px; color:#e2e8f0;">${c.desc}</div>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-double" style="flex:1; padding:10px;" onclick="uiUseConsumable(${index})" ${!state.inHand || state.isDealing ? 'disabled' : ''}>
        ${state.inHand ? 'Use Tarot Now' : 'Deal a Hand to Use'}
      </button>
      <button class="btn btn-redeal" style="padding:10px;" onclick="uiSellConsumable(${index})">Sell $1</button>
    </div>
  `;
  $('ui-inspect-modal').classList.remove('hidden');
}

function closeInspector(): void {
  $('ui-inspect-modal').classList.add('hidden');
}

/* ---------- HUD, cards, shop rendering ---------- */

function getBlindName() {
  const state = getState();
  if (state.blindIndex === 0) return 'Small Blind';
  if (state.blindIndex === 1) return 'Big Blind';
  return `BOSS: ${state.bossBlind ? state.bossBlind.name : 'The House'}`;
}

function getBlindFullDescription() {
  const state = getState();
  if (state.bossBlind) return state.bossBlind.desc;
  if (state.blindIndex === 0) return 'Standard Blackjack table rules with no special restrictions.';
  return 'Big Blind table rules with a higher score requirement.';
}

function getBlindReward() {
  const state = getState();
  return state.blindIndex === 0 ? 4 : state.blindIndex === 1 ? 5 : 6;
}

function setEquationUI(chips: number, mult: number, pop: boolean = false): void {
  const cEl = $('ui-chips');
  const mEl = $('ui-mult');
  cEl.textContent = String(chips);
  mEl.textContent = String(mult);
  if (pop) {
    cEl.classList.add('pill-pop');
    mEl.classList.add('pill-pop');
    setTimeout(() => {
      cEl.classList.remove('pill-pop');
      mEl.classList.remove('pill-pop');
    }, 110);
  }
}

function setBanner(msg: string, sub?: string): void {
  $('ui-banner').textContent = msg;
  $('ui-breakdown').textContent = sub || '';
}

function renderCardHTML(card: Card, faceDown: boolean = false, extraClasses: string = ''): string {
  if (faceDown) return `<div class="playing-card face-down ${extraClasses}"></div>`;
  const isRed = ['♥', '♦'].includes(card.suit);
  const enhClass = card.enhancement ? `enh-${card.enhancement}` : '';
  const enhLabel = card.enhancement ? `<div class="card-enh-tag">${card.enhancement.toUpperCase()}</div>` : '';
  const chipVal = getCardChipValue(card);

  return `
    <div class="playing-card ${isRed ? 'red' : 'black'} ${enhClass} ${extraClasses}">
      <div class="card-corner-top">${card.rank}<br>${card.suit}</div>
      <div class="card-suit-center">${card.suit}</div>
      ${enhLabel}
      <div class="card-corner-bottom">+${chipVal}c</div>
    </div>
  `;
}

function renderShop() {
  const state = getState();
  const jGrid = $('ui-shop-jokers');
  const eGrid = $('ui-shop-extras');
  $<HTMLButtonElement>('btn-reroll').textContent = `Reroll ($${state.rerollCost})`;

  jGrid.innerHTML = state.shopJokers.map((item, idx) => `
    <div class="shop-item type-${item.shopType}">
      <div>
        <div class="shop-item-sub">${item.shopType}</div>
        <div class="shop-item-title">${item.name}</div>
        <div class="shop-item-desc">${item.shopType === 'joker' ? getJokerFullDesc(item) : item.desc}</div>
      </div>
      <button class="btn btn-deal" style="padding:6px; font-size:10px;"
        onclick="uiBuyShopItem('shopJokers', ${idx})"
        ${item.bought || state.money < item.cost ? 'disabled' : ''}>
        ${item.bought ? 'SOLD' : 'BUY $' + item.cost}
      </button>
    </div>
  `).join('');

  eGrid.innerHTML = state.shopExtras.map((item, idx) => `
    <div class="shop-item type-${item.shopType}">
      <div>
        <div class="shop-item-sub">${item.shopType === 'card' ? 'Shoe Card' : 'Voucher'}</div>
        <div class="shop-item-title">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
      </div>
      <button class="btn btn-hit" style="padding:6px; font-size:10px;"
        onclick="uiBuyShopItem('shopExtras', ${idx})"
        ${item.bought || state.money < item.cost ? 'disabled' : ''}>
        ${item.bought ? 'SOLD' : 'BUY $' + item.cost}
      </button>
    </div>
  `).join('');
}

function updateAllUI() {
  const state = getState();
  const tagEl = $('ui-blind-tag');
  const hudBottom = $('ui-hud-bottom');
  const eqBox = $('ui-eq-box');
  const roundScoreWrap = $('ui-round-score-wrap');
  const scoreBarBg = $('ui-score-bar-bg');

  if (state.inShop) {
    tagEl.textContent = 'UP NEXT';
    tagEl.style.background = 'var(--green)';
    hudBottom.classList.add('shop-mode');
    eqBox.classList.add('hidden');
    roundScoreWrap.textContent = 'Upcoming Blind Target';
    scoreBarBg.classList.add('hidden');
  } else {
    tagEl.textContent = 'BLIND';
    tagEl.style.background = 'var(--gold)';
    hudBottom.classList.remove('shop-mode');
    eqBox.classList.remove('hidden');
    roundScoreWrap.innerHTML = `Score: <span id="ui-round-score">${state.roundScore.toLocaleString()}</span>`;
    scoreBarBg.classList.remove('hidden');
  }

  $('ui-blind-name').textContent = getBlindName();
  $('ui-blind-desc').textContent = getBlindFullDescription();
  $('ui-target-score').textContent = state.targetScore.toLocaleString();

  const pct = Math.min(100, Math.round((state.roundScore / state.targetScore) * 100));
  $('ui-score-bar').style.width = pct + '%';

  $('ui-money').textContent = '$' + state.money;
  $('ui-ante').textContent = `Ante ${state.ante}/8`;
  $('ui-shoe-count').textContent = `${state.shoe.length}/${state.deck.length}`;

  $('ui-joker-slots').textContent = `JOKERS ${state.jokers.length}/${state.maxJokers}`;
  const jRow = $('ui-joker-row');
  if (state.jokers.length === 0) {
    jRow.innerHTML = `<span style="font-size:10px; color:#64748b;">No active Jokers</span>`;
  } else {
    jRow.innerHTML = state.jokers.map((j, i) => `
      <div class="mini-card" onclick="inspectJoker(${i})" title="${getJokerFullDesc(j)}">
        <div class="mini-card-name">${j.name}</div>
        <div class="mini-card-sub">${getJokerMiniSubHTML(j)}</div>
      </div>
    `).join('');
  }

  $('ui-consumable-slots').textContent = `TAROT ${state.consumables.length}/${state.maxConsumables}`;
  const cRow = $('ui-consumable-row');
  if (state.consumables.length === 0) {
    cRow.innerHTML = `<span style="font-size:10px; color:#64748b;">Empty</span>`;
  } else {
    cRow.innerHTML = state.consumables.map((c, i) => `
      <div class="mini-card tarot" onclick="inspectConsumable(${i})">
        <div class="mini-card-name">${c.name}</div>
        <div class="mini-card-sub">Tap to use</div>
      </div>
    `).join('');
  }

  $('ui-dealer-cards').innerHTML = state.dealerHand.map((c, idx) =>
    renderCardHTML(c, idx === 1 && !state.dealerHoleRevealed)
  ).join('');

  if (state.dealerHand.length === 0) {
    $('ui-dealer-total').textContent = '?';
  } else if (!state.dealerHoleRevealed) {
    const firstVal = evaluateBlackjackTotal([state.dealerHand[0]], false).total;
    $('ui-dealer-total').textContent = firstVal + '+?';
  } else {
    const dEval = evaluateBlackjackTotal(state.dealerHand, false);
    $('ui-dealer-total').textContent = String(dEval.total);
  }

  $('ui-player-cards').innerHTML = state.playerHand.map(c => renderCardHTML(c, false)).join('');
  if (state.playerHand.length === 0) {
    $('ui-player-total').textContent = '0';
  } else {
    const pEval = evaluatePlayerHand();
    if (pEval.cushioned) {
      $('ui-player-total').textContent = '21 (22!)';
    } else {
      $('ui-player-total').textContent =
        (pEval.isSoft && pEval.total < 21 ? 'Soft ' : '') + pEval.total;
    }
  }

  const dealBtn = $<HTMLButtonElement>('btn-deal');
  const hitBtn = $<HTMLButtonElement>('btn-hit');
  const standBtn = $<HTMLButtonElement>('btn-stand');
  const doubleBtn = $<HTMLButtonElement>('btn-double');

  if (state.blindClearedReady && state.pendingPayout) {
    dealBtn.className = 'btn btn-cashout';
    dealBtn.textContent = `CASH OUT (+$${state.pendingPayout.totalEarned}) ➔`;
    dealBtn.disabled = state.isDealing;
    hitBtn.classList.add('hidden');
  } else if (state.blindFailedReady) {
    dealBtn.className = 'btn btn-newrun';
    dealBtn.textContent = `NEW RUN ↻`;
    dealBtn.disabled = state.isDealing;
    hitBtn.classList.add('hidden');
  } else {
    dealBtn.className = 'btn btn-deal';
    dealBtn.textContent = `DEAL (${state.handsLeft})`;
    dealBtn.disabled = state.inHand || state.isDealing || state.handsLeft <= 0;
    hitBtn.classList.remove('hidden');
  }

  hitBtn.disabled = !state.inHand || state.isDealing;
  standBtn.disabled = !state.inHand || state.isDealing;
  const anchorBoss = state.bossBlind && state.bossBlind.id === 'the_anchor';
  doubleBtn.disabled = !state.inHand || state.isDealing || state.playerHand.length !== 2 || !!anchorBoss;
}

/* ---------- Modals ---------- */

function toggleBlindModal(show: boolean): void {
  const state = getState();
  const modal = $('ui-blind-modal');
  if (show) {
    const tag = $('ui-modal-blind-tag');
    tag.textContent = state.inShop ? 'UPCOMING BLIND (AFTER SHOP)' : 'CURRENT BLIND';
    tag.style.background = state.inShop ? 'var(--green)' : 'var(--gold)';
    $('ui-modal-blind-name').textContent = getBlindName();
    $('ui-modal-blind-desc').textContent = getBlindFullDescription();
    $('ui-modal-blind-target').textContent = state.targetScore.toLocaleString();
    $('ui-modal-blind-reward').textContent = '$' + getBlindReward();
  }
  modal.classList.toggle('hidden', !show);
}

function toggleCogModal(show: boolean): void {
  $('ui-cog-modal').classList.toggle('hidden', !show);
}

function toggleSimModal(show: boolean): void {
  $('ui-sim-modal').classList.toggle('hidden', !show);
}

function toggleDeckModal(show: boolean): void {
  const state = getState();
  const modal = $('ui-deck-modal');
  if (show) {
    const hiddenHoleCard = (!state.dealerHoleRevealed && state.dealerHand.length >= 2)
      ? state.dealerHand[1]
      : null;

    const unrevealedUids = new Set(state.shoe.map(c => c.uid));
    if (hiddenHoleCard) {
      unrevealedUids.add(hiddenHoleCard.uid);
    }

    $('ui-deck-modal-title').textContent =
      `DECK (${unrevealedUids.size} of ${state.deck.length} Unseen)`;

    const rankOrder: Record<string, number> = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
    const suits = ['♠', '♥', '♣', '♦'];

    const listEl = $('ui-deck-list');
    listEl.innerHTML = suits.map(suit => {
      const suitCards = state.deck
        .filter(c => c.suit === suit)
        .sort((a, b) => rankOrder[b.rank] - rankOrder[a.rank]);

      const cardsHtml = suitCards.map(c => {
        const isUnseen = unrevealedUids.has(c.uid);
        const extraClass = `deck-mini ${isUnseen ? '' : 'dealt-out'}`;
        return renderCardHTML(c, false, extraClass);
      }).join('');

      return `<div class="deck-suit-row">${cardsHtml}</div>`;
    }).join('');
  }
  modal.classList.toggle('hidden', !show);
}

/* ---------- Sim lab DOM glue ---------- */

function applySimConfigToLiveGame(): void {
  patchBalanceConfig(getSimConfigFromInputs());

  toggleSimModal(false);
  startNewRun();
  const cfg = getBalanceConfig();
  setBanner('Applied Balance Lab settings to Live Game!', `Starting Deals: ${cfg.startingDeals} • Target Scale: ${cfg.targetScalePct}%`);
}

function triggerTextFileDownload(textContent: string, filename: string): void {
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

function downloadLastSimReport() {
  if (!lastSimReportText) return;
  triggerTextFileDownload(lastSimReportText, lastSimFilename);
}

function copyLastSimReport() {
  if (!lastSimReportText) return;
  navigator.clipboard.writeText(lastSimReportText).then(() => {
    const btn = $<HTMLButtonElement>('btn-copy-txt');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1400);
  });
}

function renderSimResultsToModal(simData: SimData): void {
  const {
    numRuns, elapsedMs, wins, totalFinalAnte,
    scalingDeaths, totalHandsWon, totalHandsPlayed,
    anteClearedCounts, jokerStats
  } = simData;

  const winRate = ((wins / numRuns) * 100).toFixed(1);
  const avgAnte = (totalFinalAnte / numRuns).toFixed(2);
  const handWinPct = ((totalHandsWon / Math.max(1, totalHandsPlayed)) * 100).toFixed(1);
  const totalDeaths = Math.max(1, numRuns - wins);
  const scalingDeathPct = Math.round((scalingDeaths / totalDeaths) * 100);
  const coldShoeDeathPct = 100 - scalingDeathPct;

  const sortedJokers = Object.values(jokerStats)
    .filter(j => j.picks > 0)
    .sort((a, b) => (b.wins / b.picks) - (a.wins / a.picks));

  const funnelHtml = [1,2,3,4,5,6,7,8].map(a => {
    const pct = ((anteClearedCounts[a] / numRuns) * 100).toFixed(1);
    return `
      <div class="funnel-row">
        <span style="width:58px; font-weight:bold; color:var(--gold);">Ante ${a}</span>
        <div class="funnel-bar-bg">
          <div class="funnel-bar-fill" style="width:${pct}%"></div>
        </div>
        <span style="width:48px; text-align:right; font-weight:bold;">${pct}%</span>
      </div>
    `;
  }).join('');

  const topJokersHtml = sortedJokers.length > 0 ? sortedJokers.map(j => {
    const wPct = ((j.wins / j.picks) * 100).toFixed(1);
    const avgA = (j.anteSum / j.picks).toFixed(1);
    let extra = '';
    if (j.id === 'daredevil') extra = ` <span style="color:var(--mult);font-size:10px;">(Avg +${(j.scalingSum / j.picks).toFixed(1)}m)</span>`;
    if (j.id === 'chip_stacker') extra = ` <span style="color:var(--chips);font-size:10px;">(Avg +${(j.scalingSum / j.picks).toFixed(1)}c)</span>`;
    return `
      <tr>
        <td><strong>${j.name}</strong>${extra}</td>
        <td>${j.picks}</td>
        <td style="color:var(--green); font-weight:bold;">${wPct}%</td>
        <td>Ante ${avgA}</td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No Jokers purchased (No-Jokers Baseline active)</td></tr>`;

  $('sim-results-area').innerHTML = `
    <div class="sim-kpi-row">
      <div class="sim-kpi">
        <div class="sim-kpi-val">${winRate}%</div>
        <div class="sim-kpi-lbl">Ante 8 Win Rate</div>
      </div>
      <div class="sim-kpi">
        <div class="sim-kpi-val" style="color:var(--gold);">${avgAnte}</div>
        <div class="sim-kpi-lbl">Avg Death Ante</div>
      </div>
      <div class="sim-kpi">
        <div class="sim-kpi-val" style="color:var(--chips);">${handWinPct}%</div>
        <div class="sim-kpi-lbl">BJ Hand Win %</div>
      </div>
      <div class="sim-kpi">
        <div class="sim-kpi-val" style="color:#cbd5e1;">${elapsedMs}ms</div>
        <div class="sim-kpi-lbl">${numRuns.toLocaleString()} Runs Time</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
      <div style="background:#0b0e14; padding:10px; border-radius:8px; border:1px solid #283246;">
        <div style="font-size:11px; font-weight:bold; color:var(--gold); margin-bottom:6px;">ANTE SURVIVAL FUNNEL (% CLEARED)</div>
        ${funnelHtml}
      </div>

      <div style="background:#0b0e14; padding:10px; border-radius:8px; border:1px solid #283246; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="font-size:11px; font-weight:bold; color:var(--gold); margin-bottom:6px;">CAUSE OF DEATH DIAGNOSTIC</div>
          <div style="font-size:11px; color:#e2e8f0; margin-bottom:6px;">
            • <strong style="color:var(--mult);">Scaling Wall (${scalingDeathPct}% of losses):</strong> Bot won plenty of Blackjack hands in the Blind, but its Chips × Mult couldn't reach the Target Score.
          </div>
          <div style="font-size:11px; color:#e2e8f0;">
            • <strong style="color:var(--chips);">Cold Shoe / Dealer Streak (${coldShoeDeathPct}% of losses):</strong> Dealer drew hot totals or player busted repeatedly, scoring too few hands.
          </div>
        </div>
        <div style="font-size:10px; color:var(--green); border-top:1px solid #1e293b; padding-top:6px;">
          ✓ Telemetry ready! Click <strong>💾 Export Last Sim (.TXT)</strong> above to save the full 24-blind report.
        </div>
      </div>
    </div>

    <div style="background:#0b0e14; padding:10px; border-radius:8px; border:1px solid #283246;">
      <div style="font-size:11px; font-weight:bold; color:var(--gold); margin-bottom:6px;">JOKER PERFORMANCE LEADERBOARD (END-OF-RUN)</div>
      <table class="rules-table">
        <thead>
          <tr>
            <th>Joker</th>
            <th>Times Held</th>
            <th>Run Win %</th>
            <th>Avg Ante Reached</th>
          </tr>
        </thead>
        <tbody>
          ${topJokersHtml}
        </tbody>
      </table>
    </div>
  `;
}

function getSimConfigFromInputs(): SimConfig {
  return {
    startingDeals: parseInt($<HTMLInputElement>('sim-deals').value, 10),
    targetScalePct: parseInt($<HTMLInputElement>('sim-scale').value, 10),
    unusedDealCashCap: parseInt($<HTMLInputElement>('sim-dealcap').value, 10),
    pushRefundsDeal: $<HTMLInputElement>('sim-push-refund').checked,
    anteHandScaling: $<HTMLInputElement>('sim-ante-leveling').checked
  };
}

/* ---------- Sim lab: run buttons (engine calls + DOM feedback) ---------- */
function runMonteCarloSimulation(): void {
  const runBtn = $<HTMLButtonElement>('btn-run-sim');
  runBtn.textContent = '⏳ Simulating...';
  runBtn.disabled = true;

  setTimeout(() => {
    const numRuns = parseInt($<HTMLInputElement>('sim-runs').value, 10);
    const botType = $<HTMLSelectElement>('sim-bot').value as BotType;
    const cfg = getSimConfigFromInputs();

    const simData = runBatchSimulationForBot(numRuns, botType, cfg);
    renderSimResultsToModal(simData);

    lastSimReportText = buildSingleBotReport(simData);
    lastSimFilename = `jack-latro-sim-${botType}-${numRuns}runs.txt`;

    $<HTMLButtonElement>('btn-export-txt').disabled = false;
    $<HTMLButtonElement>('btn-copy-txt').disabled = false;
    runBtn.textContent = '▶ Run Simulation';
    runBtn.disabled = false;
  }, 20);
}

function runAllBotsSuiteAndExport(): void {
  const suiteBtn = $<HTMLButtonElement>('btn-suite-txt');
  suiteBtn.textContent = '⏳ Running All 5 Bots...';
  suiteBtn.disabled = true;

  setTimeout(() => {
    const numRuns = parseInt($<HTMLInputElement>('sim-runs').value, 10);
    const cfg = getSimConfigFromInputs();

    const suite = runBotSuite(numRuns, cfg);
    if (suite.synergyData) {
      renderSimResultsToModal(suite.synergyData);
    }

    lastSimReportText = suite.reportText;
    lastSimFilename = `jack-latro-5bot-suite-${numRuns}runs.txt`;

    $<HTMLButtonElement>('btn-export-txt').disabled = false;
    $<HTMLButtonElement>('btn-copy-txt').disabled = false;
    suiteBtn.textContent = '🚀 Run All 5 Bots & Export (.TXT)';
    suiteBtn.disabled = false;

    triggerTextFileDownload(lastSimReportText, lastSimFilename);
  }, 30);
}

/* ==========================================================
   RUN / BLIND FLOW (engine state change + UI refresh)
========================================================== */
function refreshBlindStartUI(): void {
  hideOutcomeHeadline();
  setEquationUI(0, 0);
  setBanner('Tap DEAL to begin playing this Blind.', 'Tap the deck on the left to view your remaining cards.');
  updateAllUI();
}

function startNewRun(): void {
  stopConfetti();
  startNewRunState();
  $('ui-rules-deals-count').textContent = String(getBalanceConfig().startingDeals);
  $('ui-shop-overlay').classList.add('hidden');
  refreshBlindStartUI();
}

function startBlindPlay(): void {
  stopConfetti();
  beginBlindState();
  refreshBlindStartUI();
}

function startNextBlindFromShop(): void {
  $('ui-shop-overlay').classList.add('hidden');
  startBlindPlay();
}

function uiCashOut(): void {
  const payout = cashOutAndEnterShop();
  if (!payout) return;

  stopConfetti();
  hideOutcomeHeadline();
  $('ui-shop-payout-note').textContent =
    `Earned +$${payout.totalEarned} ($${payout.blindReward} Blind + $${payout.handBonus} Deals + $${payout.interest} Interest).`;
  renderShop();
  $('ui-shop-overlay').classList.remove('hidden');
  updateAllUI();
}

function handlePrimaryDealBtn(): void {
  const state = getState();
  if (state.isDealing) return;
  if (state.blindClearedReady) {
    uiCashOut();
  } else if (state.blindFailedReady) {
    startNewRun();
  } else {
    void dealHand();
  }
}

/* ==========================================================
   SHOP / INVENTORY UI WRAPPERS
========================================================== */
function uiRerollShop(): void {
  if (!rerollShop().ok) return;
  renderShop();
  updateAllUI();
}

function uiBuyShopItem(listName: 'shopJokers' | 'shopExtras', idx: number): void {
  const res = buyShopItem(listName, idx);
  if (!res.ok) {
    if (res.reason === 'jokers_full') alert('Joker slots full! Tap an active Joker at the top to sell it.');
    if (res.reason === 'tarots_full') alert('Tarot slots full!');
    return;
  }
  playCardDealSound();
  renderShop();
  updateAllUI();
}

function uiMoveJoker(index: number, dir: number): void {
  const target = index + dir;
  if (target < 0 || target >= getState().jokers.length) return;
  moveJokerAt(index, dir < 0 ? -1 : 1);
  updateAllUI();
  inspectJoker(target);
}

function uiSellJoker(index: number): void {
  if (sellJoker(index) === null) return;
  closeInspector();
  updateAllUI();
  if (getState().inShop) renderShop();
}

function uiSellConsumable(index: number): void {
  if (!sellConsumable(index)) return;
  closeInspector();
  updateAllUI();
}

function uiUseConsumable(index: number): void {
  const res = useConsumable(index);
  if (!res.ok) {
    if (res.warning) alert(res.warning);
    return;
  }
  playCardDealSound();
  if (res.message) setBanner(res.message, '');
  closeInspector();
  updateAllUI();
}

/* ==========================================================
   PLAYER ACTIONS (animated)
========================================================== */
async function dealCardAnimated(target: 'player' | 'dealer'): Promise<void> {
  const card = drawFromShoe();
  if (target === 'player') addCardToPlayerHand(card);
  else addCardToDealerHand(card);
  playCardDealSound();
  updateAllUI();
  await sleep(DEAL_DELAY_MS);
}

async function dealHand(): Promise<void> {
  const state = getState();
  if (state.inHand || state.isDealing || state.handsLeft <= 0 || state.blindClearedReady || state.blindFailedReady) return;

  hideOutcomeHeadline();
  patchState({
    handsLeft: state.handsLeft - 1,
    inHand: true,
    isDealing: true,
    doubledDown: false,
    dealerHoleRevealed: false,
    tempBonusChips: 0,
    playerHand: [],
    dealerHand: []
  });

  setEquationUI(0, 0);
  setBanner('Dealing cards...', '');
  updateAllUI();

  await dealCardAnimated('player');
  await dealCardAnimated('dealer');
  await dealCardAnimated('player');
  await dealCardAnimated('dealer');

  patchState({ isDealing: false });
  setBanner('Your turn: Hit, Stand, or Double Down.', '');
  updateAllUI();

  if (evaluatePlayerHand().total === 21) {
    await playerStand();
  }
}

async function playerHit(): Promise<void> {
  const state = getState();
  if (!state.inHand || state.isDealing) return;
  patchState({ isDealing: true });

  const preHitEval = evaluatePlayerHand();
  updateAllUI();

  await dealCardAnimated('player');
  const postHitEval = evaluatePlayerHand();

  if (preHitEval.total >= 14 && postHitEval.total <= 21) {
    let scaledAny = false;
    state.jokers.forEach((j, idx) => {
      if (j.id === 'daredevil') {
        patchJoker('daredevil', { bonusMult: (j.bonusMult || 0) + 3 });
        scaledAny = true;
        popJokerCard(idx);
      }
    });
    if (scaledAny) {
      playScoreTickSound(6);
      setBanner('Daredevil scaled! (+3 Mult permanently added)', '');
      updateAllUI();
      await sleep(180);
    }
  }

  patchState({ isDealing: false });
  updateAllUI();

  if (postHitEval.total > 21) {
    await resolveRound();
  } else if (state.playerHand.length >= 5 || postHitEval.total === 21) {
    await playerStand();
  }
}

async function playerStand(): Promise<void> {
  const state = getState();
  if (!state.inHand || state.isDealing) return;
  patchState({ isDealing: true, dealerHoleRevealed: true });
  playCardDealSound();
  updateAllUI();
  await sleep(DEAL_DELAY_MS);

  while (evaluateBlackjackTotal(state.dealerHand, false).total < 17) {
    await dealCardAnimated('dealer');
  }
  patchState({ isDealing: false });
  await resolveRound();
}

async function playerDouble(): Promise<void> {
  const state = getState();
  if (!state.inHand || state.isDealing || state.playerHand.length !== 2) return;
  if (state.bossBlind && state.bossBlind.id === 'the_anchor') return;

  patchState({ isDealing: true, doubledDown: true });
  updateAllUI();

  await dealCardAnimated('player');

  patchState({ dealerHoleRevealed: true });
  playCardDealSound();
  updateAllUI();
  await sleep(DEAL_DELAY_MS);

  const pEval = evaluatePlayerHand();
  if (pEval.total <= 21) {
    while (evaluateBlackjackTotal(state.dealerHand, false).total < 17) {
      await dealCardAnimated('dealer');
    }
  }
  patchState({ isDealing: false });
  await resolveRound();
}

/* ==========================================================
   SCORING RESOLUTION: engine computes, UI replays the cascade
========================================================== */
async function resolveRound(): Promise<void> {
  const state = getState();
  patchState({ inHand: false, isDealing: true, dealerHoleRevealed: true });
  updateAllUI();

  const res = scoreHand({
    playerHand: state.playerHand,
    dealerHand: state.dealerHand,
    jokers: state.jokers,
    bossBlind: state.bossBlind,
    ante: state.ante,
    money: state.money,
    baseWinChipBonus: state.baseWinChipBonus,
    baseWinMultBonus: state.baseWinMultBonus,
    tempBonusChips: state.tempBonusChips,
    doubledDown: state.doubledDown,
    anteHandScaling: getBalanceConfig().anteHandScaling
  });

  if (res.rawOutcomeType === 'PUSH' && getBalanceConfig().pushRefundsDeal) {
    patchState({ handsLeft: state.handsLeft + 1 });
  }

  if (res.chipStackerNewBonus !== null) {
    patchJoker('chip_stacker', { bonusChips: res.chipStackerNewBonus });
    updateAllUI();
  }

  if (res.isScoring) {
    let tickStep = 0;
    for (const step of res.steps) {
      const shownMult = Math.round(step.mult * 10) / 10;
      if (step.kind === 'base') {
        setEquationUI(step.chips, step.mult, true);
        setBanner(`${res.outcomeLabel} — Counting score...`, '');
        playScoreTickSound(tickStep++);
        await sleep(140);
      } else if (step.kind === 'card') {
        popPlayerCard(step.cardIndex as number, step.popLabel as string);
        setEquationUI(Math.round(step.chips), shownMult, true);
        playScoreTickSound(tickStep++);
        await sleep(125);
      } else if (step.kind === 'joker') {
        popJokerCard(step.jokerIndex as number);
        setEquationUI(Math.round(step.chips), shownMult, true);
        playScoreTickSound(tickStep++);
        await sleep(130);
      } else {
        setEquationUI(Math.round(step.chips), shownMult, true);
        playScoreTickSound(tickStep++);
        await sleep(120);
      }
    }
  } else {
    setEquationUI(0, 0);
  }

  // Cash earned during scoring (Gold cards, Parachute, Tycoon) lands before the payout is computed.
  addMoney(res.moneyGained);
  addRoundScore(res.handScore);
  patchState({ isDealing: false });

  const handScore = res.handScore;
  if (state.roundScore >= state.targetScore) {
    const payout = computeBlindPayout();
    patchState({ blindClearedReady: true, pendingPayout: payout });

    const winTitle = (state.ante >= 8 && state.blindIndex === 2) ? 'ANTE 8 CONQUERED!' : 'YOU WON!';
    showOutcomeHeadline(winTitle, 'WIN');
    launchConfetti();
    playOutcomeSound('BLIND_WIN');

    setBanner(
      `${res.outcomeLabel} (+${handScore.toLocaleString()} pts) — BLIND CLEARED!`,
      `Tap CASH OUT (+$${payout.totalEarned}) below when you're ready to visit the Shop.`
    );
    updateAllUI();
  } else if (state.handsLeft <= 0) {
    patchState({ blindFailedReady: true });
    showOutcomeHeadline('BUSTED OUT!', 'LOSS');
    playOutcomeSound('BUST');

    const felt = $('ui-table-felt');
    felt.classList.remove('shake-loss');
    void felt.offsetWidth;
    felt.classList.add('shake-loss');

    setBanner(
      `${res.outcomeLabel} (+${handScore.toLocaleString()} pts) — Target Missed (${state.roundScore.toLocaleString()}/${state.targetScore.toLocaleString()})`,
      `Out of Deals on Ante ${state.ante}. Tap NEW RUN below whenever you're ready.`
    );
    updateAllUI();
  } else {
    if (res.isWin) {
      playOutcomeSound('WIN');
    } else if (res.outcomeType === 'PUSH') {
      playOutcomeSound('PUSH');
    } else if (res.outcomeType === 'BUST') {
      playOutcomeSound('BUST');
    } else {
      playOutcomeSound('LOSS');
    }

    setBanner(
      `${res.outcomeLabel} → +${handScore.toLocaleString()} pts`,
      res.logs.length ? res.logs.join(' • ') : 'Tap DEAL for your next hand.'
    );
    updateAllUI();
  }
}

/* ==========================================================
   BOOT
========================================================== */
startNewRun();
