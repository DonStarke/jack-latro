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
    return `Permanently gains +1 Mult on safe Hit on 15+ for the rest of run. (Currently: +${cur} Mult)`;
  }
  if (j.id === 'chip_stacker') {
    const cur = j.bonusChips || 0;
    return `Permanently gains +10 Chips for the rest of run every time you win with a Double Down or Exact 21. (Currently: +${cur} Chips)`;
  }
  if (j.id === 'compound_edge') {
    const sets = Math.min(15, Math.floor(getState().money / 5));
    return `+10 Chips for every $5 you currently hold (max +150 Chips). (Currently: +${sets * 10} Chips with $${getState().money})`;
  }
  if (j.id === 'hot_hand') {
    const cur = j.bonusMult || 0;
    return `Gains +2 Mult per consecutive winning hand (up to +20 Mult max). Resets to 0 on a loss or bust. (Currently: +${cur} Mult)`;
  }
  if (j.id === 'deja_vu') {
    const prev = getState().previousHandTotal;
    return `×1.5 Mult if your final hand total matches your final total from the previous hand. (${prev ? `Target: ${prev}` : 'No previous hand yet'})`;
  }
  return j.desc;
}

function getJokerMiniSubHTML(j: JokerInstance): string {
  if (j.id === 'daredevil') {
    const cur = j.bonusMult || 0;
    return `<span style="color:var(--mult);font-weight:900;">+${cur}m</span> (+1m on Hit 15+)`;
  }
  if (j.id === 'chip_stacker') {
    const cur = j.bonusChips || 0;
    return `<span style="color:var(--chips);font-weight:900;">+${cur}c</span> (+10c/Dbl/21)`;
  }
  if (j.id === 'compound_edge') {
    const sets = Math.min(15, Math.floor(getState().money / 5));
    return `<span style="color:var(--chips);font-weight:900;">+${sets * 10}c</span> (+10c/$5, max 150)`;
  }
  if (j.id === 'bust_cushion') return `22 = 21! (Bust 23+)`;
  if (j.id === 'card_counter') return `+40c / low (2-6)`;
  if (j.id === 'vip_high_roller') return `+10c, +5m / Face`;
  if (j.id === 'ace_up_sleeve') return `+50c, +5m on Ace`;
  if (j.id === 'sweet_16') return `+50c, +15m (≤16 Stand)`;
  if (j.id === 'lucky_sevens') return `+77c/+7m (7s), +7m`;
  if (j.id === 'hit_me_baby') return `+5m / card > 2`;
  if (j.id === 'golden_parachute') return `+$3, +40c on dBust`;
  if (j.id === 'push_it_good') return `Push = Win (+50c,+4m)`;
  if (j.id === 'blackjack_tycoon') return `×2m, +$2 on 21`;
  if (j.id === 'the_shark') return `×1.5m (Win ≥3/dBust)`;
  if (j.id === 'safety_net') return `Bust = 40c × 2m (Salvage)`;
  if (j.id === 'even_steven') return `+10c, +4m / Even`;
  if (j.id === 'red_velvet') return `+35c / ♥♦`;
  if (j.id === 'dark_knight') return `+10c, +3m / ♠♣`;
  if (j.id === 'minimalist') return `×1.8m 2-Card Win`;
  if (j.id === 'hot_hand') return `<span style="color:var(--mult);font-weight:900;">+${j.bonusMult || 0}m</span> (+2m/Streak)`;
  if (j.id === 'snake_eyes') return `×2.2m (Win ≤13)`;
  if (j.id === 'pocket_rockets') return `+50c, +25m (AA Pair)`;
  if (j.id === 'trips_ahoy') return `+100c, +10m (3-Kind)`;
  if (j.id === 'spade_slicer') return `+15c, +5m / ♠`;
  if (j.id === 'crimson_heart') return `+40c, +2m / ♥`;
  if (j.id === 'diamond_cutter') return `+30c, +$1 / ♦ Win`;
  if (j.id === 'club_sandwich') return `+6m / ♣ Win`;
  if (j.id === 'monochrome') return `×1.6m Flush (≥3)`;
  if (j.id === 'odd_ball') return `+15c, +3m / Odd`;
  if (j.id === 'the_grinder') return `+15c, +$1 / Safe Hit`;
  if (j.id === 'double_or_nothing') return `Double Down = ×3m`;
  if (j.id === 'slow_and_steady') return `+20c / Deal Left`;
  if (j.id === 'card_sharp_joker') return `×1.75m on 2nd+ Win`;
  if (j.id === 'loan_shark') return `+$15 Buy (-$1/Blind)`;
  if (j.id === 'deja_vu') {
    const prev = getState().previousHandTotal;
    return `×1.5m (${prev ? `Match ${prev}` : 'Match Prev'})`;
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

let scoringSpeedMultiplier = 0.10; // Default to 10% speed as requested
let skipScoringAnimation = false;

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
  }, Math.round(220 / scoringSpeedMultiplier));
}

function popJokerCard(jokerIdx: number): void {
  const row = $('ui-joker-row');
  const jEl = row.children[jokerIdx];
  if (!jEl) return;
  jEl.classList.add('active-pop');
  setTimeout(() => jEl.classList.remove('active-pop'), Math.round(240 / scoringSpeedMultiplier));
}

function updateScoringSpeed(multiplier: number): void {
  scoringSpeedMultiplier = Math.max(0.05, multiplier);
  const lbl = document.getElementById('ui-lbl-anim-speed');
  if (lbl) {
    if (multiplier <= 0.12) lbl.textContent = `${multiplier.toFixed(2)}× (Slow / Educational)`;
    else if (multiplier <= 0.3) lbl.textContent = `${multiplier.toFixed(2)}× (Relaxed)`;
    else if (multiplier <= 0.6) lbl.textContent = `${multiplier.toFixed(2)}× (Medium)`;
    else lbl.textContent = `${multiplier.toFixed(2)}× (Brisk)`;
  }
}

function formatScoringVal(val: number): string {
  if (typeof val !== 'number' || isNaN(val)) return '0';
  const rounded = Math.round(val * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

async function sleepScore(ms: number): Promise<void> {
  if (skipScoringAnimation) return;
  const scaledMs = Math.round(ms / scoringSpeedMultiplier);
  await sleep(scaledMs);
}

function animateNumberRoll(el: HTMLElement, fromVal: number, toVal: number, durationMs: number = 700, isDecimal: boolean = false): Promise<void> {
  return new Promise(resolve => {
    const finalFormatted = formatScoringVal(toVal);
    if (fromVal === toVal || durationMs <= 0 || typeof window === 'undefined') {
      el.textContent = finalFormatted;
      resolve();
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      if (skipScoringAnimation) {
        el.textContent = finalFormatted;
        resolve();
        return;
      }
      const progress = Math.min(1, (now - start) / durationMs);
      const ease = 1 - Math.pow(1 - progress, 3);
      const cur = fromVal + (toVal - fromVal) * ease;
      el.textContent = isDecimal ? formatScoringVal(cur) : String(Math.round(cur));
      if (progress < 1) {
        const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb: any) => setTimeout(cb, 16);
        raf(tick);
      } else {
        el.textContent = finalFormatted;
        resolve();
      }
    };
    const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb: any) => setTimeout(cb, 16);
    raf(tick);
  });
}

function spawnFloatingToken(
  fromEl: HTMLElement | { x: number; y: number },
  toEl: HTMLElement,
  type: 'chip' | 'mult-plus' | 'mult-x' | 'cash',
  text: string,
  onArrival?: () => void
): void {
  try {
    const fromRect = fromEl instanceof HTMLElement ? fromEl.getBoundingClientRect() : { left: fromEl.x, top: fromEl.y, width: 0, height: 0 };
    const toRect = toEl.getBoundingClientRect();
    const startX = fromRect.left + (fromRect.width ? fromRect.width / 2 : 0);
    const startY = fromRect.top + (fromRect.height ? fromRect.height / 2 : 0);
    const endX = toRect.left + (toRect.width ? toRect.width / 2 : 0);
    const endY = toRect.top + (toRect.height ? toRect.height / 2 : 0);

    const token = document.createElement('div');
    token.className = `floating-token token-${type}`;
    token.textContent = text;
    token.style.left = `${startX}px`;
    token.style.top = `${startY}px`;
    document.body.appendChild(token);

    if (skipScoringAnimation) {
      token.remove();
      if (onArrival) onArrival();
      return;
    }

    const duration = Math.min(2600, Math.round(360 / scoringSpeedMultiplier));

    if (typeof (token as any).animate === 'function') {
      const anim = (token as any).animate([
        { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
        { offset: 0.16, transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1 },
        { offset: 0.84, transform: `translate(${endX - startX}px, ${endY - startY}px) scale(1.0)`, opacity: 1 },
        { transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.2)`, opacity: 0 }
      ], {
        duration,
        easing: 'cubic-bezier(0.22, 0.9, 0.36, 1)'
      });
      anim.onfinish = () => {
        token.remove();
        if (onArrival) onArrival();
      };
    } else {
      token.remove();
      if (onArrival) onArrival();
    }
  } catch (e) {
    if (onArrival) onArrival();
  }
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
      <div style="display:flex; align-items:center; gap:8px;">
        <h3 style="color:var(--gold); margin:0;">${j.name}</h3>
        <span class="rarity-badge rarity-${j.rarity || 'common'}">${(j.rarity || 'common').toUpperCase()}</span>
      </div>
      <button class="btn btn-secondary" onclick="closeInspector()">Close</button>
    </div>
    <div style="font-size:13px; color:#e2e8f0; line-height:1.4;">${getJokerFullDesc(j)}</div>
    <div style="font-size:12px; color:#94a3b8;">Tip: Jokers trigger Left ➔ Right. Put +Mult Jokers to the left of ×Mult Jokers!</div>
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
  cEl.textContent = formatScoringVal(chips);
  mEl.textContent = formatScoringVal(mult);
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
  $('ui-banner').innerHTML = msg;
  $('ui-breakdown').innerHTML = sub || '';
}

function buildScoreEquationHTML(res: ScoreResult, playerHand: ReadonlyArray<Card>): string {
  if (!res.isScoring) {
    return `${res.outcomeLabel} → 0 pts`;
  }

  const parts: string[] = [];

  // 1. Base outcome tier: e.g. "PUSH (TIE)[30c+1m]"
  const baseStep = res.steps.find(s => s.kind === 'base');
  const baseChips = baseStep ? (baseStep.deltaChips !== undefined ? baseStep.deltaChips : baseStep.chips) : 0;
  const baseMult = baseStep ? (baseStep.deltaMult !== undefined ? baseStep.deltaMult : baseStep.mult) : 0;
  parts.push(
    `${res.outcomeLabel}[${formatScoringVal(baseChips)}<span class="eq-c">c</span>+${formatScoringVal(baseMult)}<span class="eq-m">m</span>]`
  );

  // 2. Card contributions: e.g. "10♣[10]" or "7♠[7]"
  const cardSteps = res.steps.filter(s => s.kind === 'card');
  for (const step of cardSteps) {
    const card = playerHand[step.cardIndex as number];
    if (!card) continue;
    const isRed = ['♥', '♦'].includes(card.suit);
    const suitClass = isRed ? 'suit-red' : 'suit-black';
    const cardSymbol = `${card.rank}<span class="${suitClass}">${card.suit}</span>`;

    let bracketContent = '';
    const dChips = step.deltaChips || 0;
    const dMult = step.deltaMult || 0;

    if (card.enhancement === 'foil') {
      bracketContent = `${formatScoringVal(dChips)}<span class="eq-c">c</span>`;
    } else if (card.enhancement === 'holo') {
      const baseCardVal = getCardChipValue(card);
      bracketContent = `${formatScoringVal(baseCardVal)}<span class="eq-c">c</span>+${formatScoringVal(dMult)}<span class="eq-m">m</span>`;
    } else if (card.enhancement === 'poly') {
      const baseCardVal = getCardChipValue(card);
      bracketContent = `${formatScoringVal(baseCardVal)}<span class="eq-c">c</span> ×${formatScoringVal(dMult)}<span class="eq-m">m</span>`;
    } else if (card.enhancement === 'gold') {
      bracketContent = `${formatScoringVal(dChips)}<span class="eq-c">c</span>+$3`;
    } else {
      bracketContent = `${formatScoringVal(dChips)}`;
    }

    parts.push(`${cardSymbol}[${bracketContent}]`);
  }

  // 3. Jokers: e.g. "VIP[+10c/+5m]"
  const jokerSteps = res.steps.filter(s => s.kind === 'joker');
  for (const step of jokerSteps) {
    const name = step.sourceName || 'Joker';
    let bracket = '';
    if (step.isXMult) {
      bracket = `×${formatScoringVal(step.deltaMult || 1)}<span class="eq-m">m</span>`;
    } else if (step.deltaChips && step.deltaMult) {
      bracket = `+${formatScoringVal(step.deltaChips)}<span class="eq-c">c</span>+${formatScoringVal(step.deltaMult)}<span class="eq-m">m</span>`;
    } else if (step.deltaChips) {
      bracket = `+${formatScoringVal(step.deltaChips)}<span class="eq-c">c</span>`;
    } else if (step.deltaMult) {
      bracket = `+${formatScoringVal(step.deltaMult)}<span class="eq-m">m</span>`;
    }
    if (bracket) {
      parts.push(`${name}[${bracket}]`);
    }
  }

  // 4. Double Down:
  const doubleStep = res.steps.find(s => s.kind === 'double');
  if (doubleStep) {
    parts.push(`Double Down[×2<span class="eq-m">m</span>]`);
  }

  const leftHandSide = parts.join(' + ');
  const rightHandSide = `${formatScoringVal(res.chips)}<span class="eq-c">c</span> × ${formatScoringVal(res.mult)}<span class="eq-m">m</span> = <span class="eq-total">${res.handScore.toLocaleString()} pts</span>`;

  return `${leftHandSide} = ${rightHandSide}`;
}

function renderScoringBanner(
  res: ScoreResult,
  playerHand: ReadonlyArray<Card>,
  status: 'NORMAL' | 'BLIND_CLEARED' | 'ANTE8_VICTORY' | 'BUSTED_OUT',
  payoutEarned?: number
): void {
  const state = getState();

  // 1. Hand Outcome Pill Badge
  let outcomeClass = 'outcome-win';
  let outcomeIcon = '🏆';
  if (res.outcomeType === 'EXACT21') { outcomeClass = 'outcome-win'; outcomeIcon = '🎯'; }
  else if (res.outcomeType === 'NATURAL') { outcomeClass = 'outcome-win'; outcomeIcon = '🃏'; }
  else if (res.outcomeType === 'CHARLIE') { outcomeClass = 'outcome-win'; outcomeIcon = '👑'; }
  else if (res.outcomeType === 'PUSH') { outcomeClass = 'outcome-push'; outcomeIcon = '🤝'; }
  else if (res.outcomeType === 'BUST' || res.outcomeType === 'LOSS') {
    outcomeClass = 'outcome-loss';
    outcomeIcon = res.outcomeType === 'BUST' ? '💥' : '💀';
  }

  const outcomeBadge = `<span class="outcome-pill ${outcomeClass}">${outcomeIcon} ${res.outcomeLabel}</span>`;

  // 2. High-level Event Badge (Blind Cleared / Ante 8 Conquered / Target Missed)
  let statusBadge = '';
  if (status === 'ANTE8_VICTORY') {
    statusBadge = `<span class="outcome-pill outcome-conquered">👑 ANTE 8 CONQUERED! 👑</span>`;
  } else if (status === 'BLIND_CLEARED') {
    statusBadge = `<span class="outcome-pill outcome-cleared">✨ BLIND CLEARED! ✨</span>`;
  } else if (status === 'BUSTED_OUT') {
    statusBadge = `<span class="outcome-pill outcome-busted">💀 TARGET MISSED</span>`;
  }

  // 3. Clear Calculation Line
  let calcRowHTML = '';
  if (res.isScoring) {
    calcRowHTML = `
      <div class="banner-calc-row">
        <span class="calc-part"><span class="eq-c">${formatScoringVal(res.chips)}</span> Chips</span>
        <span class="calc-op">×</span>
        <span class="calc-part"><span class="eq-m">${formatScoringVal(res.mult)}</span> Mult</span>
        <span class="calc-op">=</span>
        <span class="calc-total">+${res.handScore.toLocaleString()} pts</span>
      </div>
    `;
  } else {
    calcRowHTML = `
      <div class="banner-calc-row">
        <span class="calc-zero">0 pts scored on this hand</span>
      </div>
    `;
  }

  const topHTML = `
    <div class="banner-top-badges">
      ${outcomeBadge}
      ${statusBadge}
    </div>
    ${calcRowHTML}
  `;

  // 4. Breakdown Row: Itemized Contributions & Guidance Subtext
  const parts: string[] = [];
  if (res.isScoring) {
    const baseStep = res.steps.find(s => s.kind === 'base');
    if (baseStep) {
      parts.push(`Base[${formatScoringVal(baseStep.deltaChips || baseStep.chips)}c+${formatScoringVal(baseStep.deltaMult || baseStep.mult)}m]`);
    }
    const cardSteps = res.steps.filter(s => s.kind === 'card');
    for (const step of cardSteps) {
      const card = playerHand[step.cardIndex as number];
      if (!card) continue;
      const isRed = ['♥', '♦'].includes(card.suit);
      const suitClass = isRed ? 'suit-red' : 'suit-black';
      const cSym = `${card.rank}<span class="${suitClass}">${card.suit}</span>`;
      let bVal = '';
      if (card.enhancement === 'foil') bVal = `+${formatScoringVal(step.deltaChips || 0)}c`;
      else if (card.enhancement === 'holo') bVal = `+${formatScoringVal(getCardChipValue(card))}c+${formatScoringVal(step.deltaMult || 0)}m`;
      else if (card.enhancement === 'poly') bVal = `+${formatScoringVal(getCardChipValue(card))}c ×${formatScoringVal(step.deltaMult || 1.5)}m`;
      else if (card.enhancement === 'gold') bVal = `+${formatScoringVal(step.deltaChips || 0)}c+$3`;
      else bVal = `+${formatScoringVal(step.deltaChips || 0)}c`;
      parts.push(`${cSym}[${bVal}]`);
    }
    const jokerSteps = res.steps.filter(s => s.kind === 'joker');
    for (const step of jokerSteps) {
      const name = step.sourceName || 'Joker';
      let bVal = '';
      if (step.isXMult) bVal = `×${formatScoringVal(step.deltaMult || 1)}m`;
      else if (step.deltaChips && step.deltaMult) bVal = `+${formatScoringVal(step.deltaChips)}c+${formatScoringVal(step.deltaMult)}m`;
      else if (step.deltaChips) bVal = `+${formatScoringVal(step.deltaChips)}c`;
      else if (step.deltaMult) bVal = `+${formatScoringVal(step.deltaMult)}m`;
      if (bVal) parts.push(`${name}[${bVal}]`);
    }
    if (res.steps.some(s => s.kind === 'double')) {
      parts.push(`Double Down[×2m]`);
    }
  }

  let subGuidance = '';
  if (status === 'ANTE8_VICTORY') {
    subGuidance = `<div class="banner-subtext gold-txt">Boss Blind Defeated! Taking in the victory...</div>`;
  } else if (status === 'BLIND_CLEARED') {
    subGuidance = `<div class="banner-subtext gold-txt">Tap <strong>CASH OUT (+$${payoutEarned || 0})</strong> below when you're ready to visit the Shop.</div>`;
  } else if (status === 'BUSTED_OUT') {
    subGuidance = `<div class="banner-subtext red-txt">Out of Deals on Ante ${state.ante} (${state.roundScore.toLocaleString()} / ${state.targetScore.toLocaleString()} pts).</div>`;
  } else {
    const dealsMsg = `${state.handsLeft} Deal${state.handsLeft === 1 ? '' : 's'} remaining`;
    subGuidance = `<div class="banner-subtext">${dealsMsg} — Tap <strong>DEAL</strong> for your next hand.</div>`;
  }

  const breakdownHTML = `
    ${parts.length ? `<div class="banner-breakdown-items">${parts.join(' • ')}</div>` : ''}
    ${subGuidance}
  `;

  setBanner(topHTML, breakdownHTML);
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

  jGrid.innerHTML = state.shopJokers.map((item, idx) => {
    const isJoker = item.shopType === 'joker';
    const rarityClass = isJoker && item.rarity ? `rarity-${item.rarity}` : '';
    const badgeHtml = isJoker && item.rarity
      ? `<span class="rarity-badge rarity-${item.rarity}">${item.rarity.toUpperCase()}</span>`
      : '';
    return `
    <div class="shop-item type-${item.shopType} ${rarityClass}">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
          <div class="shop-item-sub">${item.shopType}</div>
          ${badgeHtml}
        </div>
        <div class="shop-item-title">${item.name}</div>
        <div class="shop-item-desc">${item.shopType === 'joker' ? getJokerFullDesc(item) : item.desc}</div>
      </div>
      <button class="btn btn-deal" style="padding:6px; font-size:12px;"
        onclick="uiBuyShopItem('shopJokers', ${idx})"
        ${item.bought || state.money < item.cost ? 'disabled' : ''}>
        ${item.bought ? 'SOLD' : 'BUY $' + item.cost}
      </button>
    </div>
  `;
  }).join('');

  eGrid.innerHTML = state.shopExtras.map((item, idx) => `
    <div class="shop-item type-${item.shopType}">
      <div>
        <div class="shop-item-sub">${item.shopType === 'card' ? 'Shoe Card' : 'Voucher'}</div>
        <div class="shop-item-title">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
      </div>
      <button class="btn btn-hit" style="padding:6px; font-size:12px;"
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
  $('ui-ante').textContent = state.ante > 8 ? `Ante ${state.ante} (Endless)` : `Ante ${state.ante}/8`;
  $('ui-shoe-count').textContent = `${state.shoe.length}/${state.deck.length}`;

  $('ui-joker-slots').textContent = `JOKERS ${state.jokers.length}/${state.maxJokers}`;
  const jRow = $('ui-joker-row');
  if (state.jokers.length === 0) {
    jRow.innerHTML = `<span style="font-size:12px; font-weight:700; color:#94a3b8;">No active Jokers</span>`;
  } else {
    jRow.innerHTML = state.jokers.map((j, i) => `
      <div class="mini-card rarity-${j.rarity || 'common'}" onclick="inspectJoker(${i})" title="${getJokerFullDesc(j)}">
        <div class="mini-card-name">${j.name}</div>
        <div class="mini-card-sub">${getJokerMiniSubHTML(j)}</div>
      </div>
    `).join('');
  }

  $('ui-consumable-slots').textContent = `TAROT ${state.consumables.length}/${state.maxConsumables}`;
  const cRow = $('ui-consumable-row');
  if (state.consumables.length === 0) {
    cRow.innerHTML = `<span style="font-size:12px; font-weight:700; color:#94a3b8;">Empty</span>`;
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
  const modal = $('ui-cog-modal');
  if (show) {
    const splash = $('ui-splash-screen');
    const isFromSplash = splash && !splash.classList.contains('hidden');
    const newRunBtn = document.getElementById('btn-modal-new-run');
    const mainMenuBtn = document.getElementById('btn-modal-main-menu');
    const actionsGrid = document.getElementById('ui-cog-modal-actions');

    if (newRunBtn) newRunBtn.style.display = isFromSplash ? 'none' : '';
    if (mainMenuBtn) mainMenuBtn.style.display = isFromSplash ? 'none' : '';
    if (actionsGrid) {
      actionsGrid.style.gridTemplateColumns = isFromSplash ? '1fr' : '1fr 1fr 1fr';
    }
  }
  modal.classList.toggle('hidden', !show);
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
    if (j.id === 'hot_hand') extra = ` <span style="color:var(--mult);font-size:10px;">(Avg +${(j.scalingSum / j.picks).toFixed(1)}m)</span>`;
    const rBadge = `<span class="rarity-badge rarity-${j.rarity || 'common'}" style="font-size:9px; padding:1px 4px; margin-left:4px;">${(j.rarity || 'common').toUpperCase()}</span>`;
    return `
      <tr>
        <td><strong>${j.name}</strong> ${rBadge}${extra}</td>
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
  suiteBtn.textContent = '⏳ Running All 6 Bots...';
  suiteBtn.disabled = true;

  setTimeout(() => {
    const numRuns = parseInt($<HTMLInputElement>('sim-runs').value, 10);
    const cfg = getSimConfigFromInputs();

    const suite = runBotSuite(numRuns, cfg);
    const displayData = suite.expertData || suite.synergyData;
    if (displayData) {
      renderSimResultsToModal(displayData);
    }

    lastSimReportText = suite.reportText;
    lastSimFilename = `jack-latro-6bot-suite-${numRuns}runs.txt`;

    $<HTMLButtonElement>('btn-export-txt').disabled = false;
    $<HTMLButtonElement>('btn-copy-txt').disabled = false;
    suiteBtn.textContent = '🚀 Run All 6 Bots & Export (.TXT)';
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
  hideDefeatModal();
  hideVictoryModal();
  stopVictoryMusic();
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
  const splash = $('ui-splash-screen');
  if (splash && !splash.classList.contains('hidden')) {
    splash.classList.add('hidden');
  }
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

  if (preHitEval.total >= 15 && postHitEval.total <= 21) {
    let scaledAny = false;
    const gain = 1;
    state.jokers.forEach((j, idx) => {
      if (j.id === 'daredevil') {
        patchJoker('daredevil', { bonusMult: (j.bonusMult || 0) + gain });
        scaledAny = true;
        popJokerCard(idx);
      }
    });
    if (scaledAny) {
      playScoreTickSound(6);
      setBanner(`Daredevil scaled! (+1 Mult permanently added)`, '');
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
    anteHandScaling: getBalanceConfig().anteHandScaling,
    vouchers: state.vouchersBought,
    handsLeft: state.handsLeft,
    handsWonInBlind: state.handsWonInBlind || 0,
    previousHandTotal: state.previousHandTotal
  });

  // Hand outcome sound plays IMMEDIATELY after player and dealer finish playing, just before scoring
  if (res.rawOutcomeType === 'BUST') {
    playOutcomeSound('BUST');
  } else if (res.rawOutcomeType === 'LOSS') {
    playOutcomeSound('LOSS');
  } else if (res.rawOutcomeType === 'PUSH' && !res.isWin) {
    playOutcomeSound('PUSH');
  } else if (res.isWin) {
    playOutcomeSound('WIN');
  } else {
    playOutcomeSound('LOSS');
  }

  if (res.rawOutcomeType === 'PUSH' && getBalanceConfig().pushRefundsDeal) {
    patchState({ handsLeft: state.handsLeft + 1 });
  }

  if (res.chipStackerNewBonus !== null) {
    patchJoker('chip_stacker', { bonusChips: res.chipStackerNewBonus });
    updateAllUI();
  }

  // Hot Hand streak tracking
  const hotHand = state.jokers.find(j => j.id === 'hot_hand');
  if (hotHand) {
    if (res.isWin) {
      patchJoker('hot_hand', { bonusMult: Math.min(20, (hotHand.bonusMult || 0) + 2) });
    } else if (res.rawOutcomeType === 'LOSS' || res.rawOutcomeType === 'BUST') {
      patchJoker('hot_hand', { bonusMult: 0 });
    }
    updateAllUI();
  }

  // Update hands won in blind & previous hand total
  if (res.isWin) {
    patchState({ handsWonInBlind: (state.handsWonInBlind || 0) + 1 });
  }
  patchState({ previousHandTotal: res.pBust ? null : res.pTotal });

  skipScoringAnimation = false;

  if (res.isScoring) {
    let tickStep = 0;
    const chipsEl = $('ui-chips');
    const multEl = $('ui-mult');
    const moneyEl = $('ui-money');
    const plaqueEl = $('ui-tier-plaque');
    const jRow = $('ui-joker-row');
    const pCardsRow = $('ui-player-cards');

    let curDisplayChips = 0;
    let curDisplayMult = 0;

    // Reset equation UI to 0 x 0 initially so the player sees the count-up from scratch!
    setEquationUI(0, 0);

    for (const step of res.steps) {
      if (skipScoringAnimation) break;
      const targetMult = Math.round(step.mult * 10) / 10;
      const targetChips = Math.round(step.chips);

      if (step.kind === 'base') {
        $('ui-tier-plaque-title').textContent = res.outcomeLabel;
        $('ui-tier-plaque-chips').textContent = `+${formatScoringVal(step.deltaChips || step.chips)}c`;
        $('ui-tier-plaque-mult').textContent = `+${formatScoringVal(step.deltaMult || step.mult)}m`;
        plaqueEl.classList.remove('hidden');
        setBanner(`${res.outcomeLabel} — Baseline established!`, 'Tap table felt to skip');
        await sleepScore(200);

        // Spawn chips token from plaque to ui-chips
        spawnFloatingToken(
          $('ui-tier-plaque-chips'),
          chipsEl,
          'chip',
          `+${formatScoringVal(step.deltaChips || step.chips)}c`,
          () => {
            void animateNumberRoll(chipsEl, curDisplayChips, targetChips, Math.round(300 / scoringSpeedMultiplier), false);
            curDisplayChips = targetChips;
            chipsEl.classList.remove('chip-absorbed');
            void chipsEl.offsetWidth;
            chipsEl.classList.add('chip-absorbed');
            playChipSound();
          }
        );

        // Spawn mult token from plaque to ui-mult
        spawnFloatingToken(
          $('ui-tier-plaque-mult'),
          multEl,
          'mult-plus',
          `+${formatScoringVal(step.deltaMult || step.mult)}m`,
          () => {
            void animateNumberRoll(multEl, curDisplayMult, targetMult, Math.round(300 / scoringSpeedMultiplier), targetMult % 1 !== 0);
            curDisplayMult = targetMult;
            multEl.classList.remove('mult-absorbed-plus');
            void multEl.offsetWidth;
            multEl.classList.add('mult-absorbed-plus');
            playMultPlusSound(tickStep++);
          }
        );

        await sleepScore(250);
        plaqueEl.classList.add('hidden');
        await sleepScore(80);

      } else if (step.kind === 'card') {
        const cardEl = pCardsRow.children[step.cardIndex as number] as HTMLElement | undefined;
        if (cardEl) {
          popPlayerCard(step.cardIndex as number, step.popLabel as string);

          if (step.deltaChips && step.deltaChips > 0) {
            spawnFloatingToken(
              cardEl,
              chipsEl,
              'chip',
              `+${formatScoringVal(step.deltaChips)}c`,
              () => {
                void animateNumberRoll(chipsEl, curDisplayChips, targetChips, Math.round(300 / scoringSpeedMultiplier), false);
                curDisplayChips = targetChips;
                chipsEl.classList.remove('chip-absorbed');
                void chipsEl.offsetWidth;
                chipsEl.classList.add('chip-absorbed');
                playChipSound();
              }
            );
          }

          if (step.deltaMult && step.deltaMult > 0) {
            const isX = step.isXMult;
            spawnFloatingToken(
              cardEl,
              multEl,
              isX ? 'mult-x' : 'mult-plus',
              isX ? `×${formatScoringVal(step.deltaMult)}m` : `+${formatScoringVal(step.deltaMult)}m`,
              () => {
                void animateNumberRoll(multEl, curDisplayMult, targetMult, Math.round(300 / scoringSpeedMultiplier), targetMult % 1 !== 0);
                curDisplayMult = targetMult;
                multEl.classList.remove(isX ? 'mult-absorbed-x' : 'mult-absorbed-plus');
                void multEl.offsetWidth;
                multEl.classList.add(isX ? 'mult-absorbed-x' : 'mult-absorbed-plus');
                if (isX) playMultXSound();
                else playMultPlusSound(tickStep++);
              }
            );
          }

          if (step.deltaMoney && step.deltaMoney > 0) {
            spawnFloatingToken(cardEl, moneyEl, 'cash', `+$${step.deltaMoney}`, () => playMoneyCoinSound());
          }
        } else {
          setEquationUI(targetChips, targetMult, true);
          curDisplayChips = targetChips;
          curDisplayMult = targetMult;
        }
        await sleepScore(220);

      } else if (step.kind === 'joker') {
        const jEl = jRow.children[step.jokerIndex as number] as HTMLElement | undefined;
        if (jEl) {
          // Dim other jokers and highlight active joker
          jRow.classList.add('joker-row-scoring');
          jEl.classList.add('scoring-focus');

          // Smoothly scroll active joker into view so player can look up and see it!
          if (typeof jEl.scrollIntoView === 'function') {
            jEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }
          playCardSlideSound();

          setBanner(`${step.sourceName || 'Joker'} triggered!`, 'Tap table felt to skip');
          await sleepScore(180);

          if (step.deltaChips && step.deltaChips > 0) {
            spawnFloatingToken(
              jEl,
              chipsEl,
              'chip',
              `+${formatScoringVal(step.deltaChips)}c`,
              () => {
                void animateNumberRoll(chipsEl, curDisplayChips, targetChips, Math.round(300 / scoringSpeedMultiplier), false);
                curDisplayChips = targetChips;
                chipsEl.classList.remove('chip-absorbed');
                void chipsEl.offsetWidth;
                chipsEl.classList.add('chip-absorbed');
                playChipSound();
              }
            );
          }

          if (step.deltaMult && step.deltaMult > 0) {
            const isX = step.isXMult;
            spawnFloatingToken(
              jEl,
              multEl,
              isX ? 'mult-x' : 'mult-plus',
              isX ? `×${formatScoringVal(step.deltaMult)}m` : `+${formatScoringVal(step.deltaMult)}m`,
              () => {
                void animateNumberRoll(multEl, curDisplayMult, targetMult, Math.round(300 / scoringSpeedMultiplier), targetMult % 1 !== 0);
                curDisplayMult = targetMult;
                multEl.classList.remove(isX ? 'mult-absorbed-x' : 'mult-absorbed-plus');
                void multEl.offsetWidth;
                multEl.classList.add(isX ? 'mult-absorbed-x' : 'mult-absorbed-plus');
                if (isX) playMultXSound();
                else playMultPlusSound(tickStep++);
              }
            );
          }

          if (step.deltaMoney && step.deltaMoney > 0) {
            spawnFloatingToken(jEl, moneyEl, 'cash', `+$${step.deltaMoney}`, () => playMoneyCoinSound());
          }

          await sleepScore(240);
          jEl.classList.remove('scoring-focus');
          jRow.classList.remove('joker-row-scoring');
        } else {
          setEquationUI(targetChips, targetMult, true);
          curDisplayChips = targetChips;
          curDisplayMult = targetMult;
          await sleepScore(150);
        }

      } else if (step.kind === 'double') {
        setBanner('Double Down: ×2 Mult!', 'Tap table felt to skip');
        spawnFloatingToken(
          $('ui-table-felt'),
          multEl,
          'mult-x',
          '×2m',
          () => {
            void animateNumberRoll(multEl, curDisplayMult, targetMult, Math.round(300 / scoringSpeedMultiplier), false);
            curDisplayMult = targetMult;
            multEl.classList.remove('mult-absorbed-x');
            void multEl.offsetWidth;
            multEl.classList.add('mult-absorbed-x');
            playMultXSound();
          }
        );
        await sleepScore(240);
      }
    }

    $('ui-joker-row').classList.remove('joker-row-scoring');
    $('ui-tier-plaque').classList.add('hidden');
    setEquationUI(res.chips, res.mult, true);
    await sleepScore(140);
  } else {
    setEquationUI(0, 0);
  }

  // Cash earned during scoring (Gold cards, Parachute, Tycoon) lands before the payout is computed.
  addMoney(res.moneyGained);
  addRoundScore(res.handScore);
  patchState({ isDealing: false });

  if (state.roundScore >= state.targetScore) {
    const payout = computeBlindPayout();
    patchState({ blindClearedReady: true, pendingPayout: payout });

    const isAnte8Victory = (state.ante === 8 && state.blindIndex === 2 && !state.endlessMode);
    const winTitle = isAnte8Victory ? 'ANTE 8 CONQUERED!' : 'YOU WON!';
    showOutcomeHeadline(winTitle, 'WIN');
    launchConfetti();

    if (isAnte8Victory) {
      renderScoringBanner(res, state.playerHand, 'ANTE8_VICTORY');
      updateAllUI();

      // Give the player a moment to see the last hand and scoring animations!
      await sleep(1500);

      startVictoryMusic();
      showVictoryModal();
    } else {
      playOutcomeSound('BLIND_WIN');
      renderScoringBanner(res, state.playerHand, 'BLIND_CLEARED', payout.totalEarned);
      updateAllUI();
    }
  } else if (state.handsLeft <= 0) {
    patchState({ blindFailedReady: true });
    showOutcomeHeadline('BUSTED OUT!', 'LOSS');
    playOutcomeSound('BUST');

    const felt = $('ui-table-felt');
    felt.classList.remove('shake-loss');
    void felt.offsetWidth;
    felt.classList.add('shake-loss');

    renderScoringBanner(res, state.playerHand, 'BUSTED_OUT');
    updateAllUI();

    setTimeout(() => {
      showDefeatModal();
    }, 1100);
  } else {
    // Note: Hand outcome sound was already played immediately before scoring!
    renderScoringBanner(res, state.playerHand, 'NORMAL');
    updateAllUI();
  }
}

/* ==========================================================
   MAIN MENU, DEFEAT & VICTORY FLOW
========================================================== */
function showMainMenu(): void {
  closeTableInspection();
  hideDefeatModal();
  hideVictoryModal();
  toggleCogModal(false);
  toggleBlindModal(false);
  toggleDeckModal(false);
  toggleSimModal(false);
  closeInspector();
  $('ui-shop-overlay').classList.add('hidden');
  stopConfetti();
  stopVictoryMusic();

  const splash = $('ui-splash-screen');
  if (splash) splash.classList.remove('hidden');
  if (!musicMuted && !isMusicPlaying) {
    startMusic();
  }
  updateMusicUI();
}

function uiStartGameFromMenu(): void {
  closeTableInspection();
  toggleCogModal(false);
  const splash = $('ui-splash-screen');
  if (splash) splash.classList.add('hidden');
  playCardDealSound();
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  startMusic();
  startNewRun();
}

function showDefeatModal(): void {
  const s = getState();
  const anteEl = $('ui-defeat-stat-ante');
  const tgtEl = $('ui-defeat-stat-target');
  const scEl = $('ui-defeat-stat-score');
  const mEl = $('ui-defeat-stat-money');
  const jEl = $('ui-defeat-jokers');
  const subEl = $('ui-defeat-sub');

  if (anteEl) anteEl.textContent = s.ante > 8 ? `Ante ${s.ante} (Endless)` : `Ante ${s.ante}`;
  if (tgtEl) tgtEl.textContent = s.targetScore.toLocaleString();
  if (scEl) scEl.textContent = s.roundScore.toLocaleString();
  if (mEl) mEl.textContent = '$' + s.money;
  if (subEl) subEl.textContent = `You ran out of Deals on Ante ${s.ante} before reaching ${s.targetScore.toLocaleString()} pts.`;

  if (jEl) {
    if (s.jokers.length === 0) {
      jEl.innerHTML = '<span style="color:#94a3b8; font-style:italic;">No Jokers in hand</span>';
    } else {
      jEl.innerHTML = s.jokers.map(j => `
        <span class="joker-tag" style="background:#1e293b; border:1px solid #475569; padding:2px 8px; border-radius:4px; font-size:11px;">
          ${j.name}
        </span>
      `).join('');
    }
  }

  $('ui-defeat-modal').classList.remove('hidden');
}

function hideDefeatModal(): void {
  const m = $('ui-defeat-modal');
  if (m) m.classList.add('hidden');
}

function uiRestartFromDefeat(): void {
  closeTableInspection();
  hideDefeatModal();
  startNewRun();
}

function showVictoryModal(): void {
  const s = getState();
  const scEl = $('ui-victory-stat-score');
  const mEl = $('ui-victory-stat-money');
  const dealsEl = $('ui-victory-stat-deals');
  const jEl = $('ui-victory-jokers');

  if (scEl) scEl.textContent = s.roundScore.toLocaleString();
  if (mEl) mEl.textContent = '$' + s.money;
  if (dealsEl) dealsEl.textContent = String(s.handsLeft);

  if (jEl) {
    if (s.jokers.length === 0) {
      jEl.innerHTML = '<span style="color:#94a3b8; font-style:italic;">No Jokers equipped</span>';
    } else {
      jEl.innerHTML = s.jokers.map(j => `
        <span class="joker-tag" style="background:#1e293b; border:1px solid var(--gold); color:#fef08a; padding:3px 8px; border-radius:4px; font-size:12px; font-weight:700;">
          🃏 ${j.name}
        </span>
      `).join('');
    }
  }

  $('ui-victory-modal').classList.remove('hidden');
}

function hideVictoryModal(): void {
  const m = $('ui-victory-modal');
  if (m) m.classList.add('hidden');
}

function uiContinueIntoEndless(): void {
  closeTableInspection();
  hideVictoryModal();
  stopVictoryMusic();
  patchState({ endlessMode: true });
  startMusic();
  const s = getState();
  if (!s.blindClearedReady || !s.pendingPayout) {
    const payout = computeBlindPayout();
    patchState({ blindClearedReady: true, pendingPayout: payout });
  }
  uiCashOut();
}

function uiRestartFromVictory(): void {
  closeTableInspection();
  hideVictoryModal();
  stopVictoryMusic();
  startMusic();
  startNewRun();
}

/* ---------- Table Inspection / Hide Modal Mode ---------- */
let tableInspectionActiveModal: 'VICTORY' | 'DEFEAT' | null = null;

function uiHideModalToViewTable(kind: 'VICTORY' | 'DEFEAT'): void {
  tableInspectionActiveModal = kind;
  if (kind === 'VICTORY') {
    hideVictoryModal();
  } else {
    hideDefeatModal();
  }
  const appEl = $('app');
  if (appEl) appEl.classList.add('table-inspect-active');
  const shield = $('ui-inspect-touch-shield');
  if (shield) shield.classList.remove('hidden');
  const bar = $('ui-view-table-bar');
  if (bar) {
    bar.classList.remove('hidden');
    const lbl = $('ui-view-table-label');
    const btn = $('btn-return-modal');
    if (lbl) lbl.textContent = kind === 'VICTORY' ? 'Ante 8 Victory Table' : 'Final Hand (Busted Out)';
    if (btn) btn.innerHTML = kind === 'VICTORY' ? '<span>🔙 RETURN TO VICTORY SCREEN</span>' : '<span>🔙 RETURN TO BUST SCREEN</span>';
  }
}

function uiRestoreModal(): void {
  const appEl = $('app');
  if (appEl) appEl.classList.remove('table-inspect-active');
  const shield = $('ui-inspect-touch-shield');
  if (shield) shield.classList.add('hidden');
  const bar = $('ui-view-table-bar');
  if (bar) bar.classList.add('hidden');

  const kind = tableInspectionActiveModal;
  tableInspectionActiveModal = null;
  if (kind === 'VICTORY') {
    showVictoryModal();
  } else if (kind === 'DEFEAT') {
    showDefeatModal();
  }
}

function closeTableInspection(): void {
  const appEl = $('app');
  if (appEl) appEl.classList.remove('table-inspect-active');
  const shield = $('ui-inspect-touch-shield');
  if (shield) shield.classList.add('hidden');
  const bar = $('ui-view-table-bar');
  if (bar) bar.classList.add('hidden');
  tableInspectionActiveModal = null;
}

(window as any).showMainMenu = showMainMenu;
(window as any).uiStartGameFromMenu = uiStartGameFromMenu;
(window as any).showDefeatModal = showDefeatModal;
(window as any).hideDefeatModal = hideDefeatModal;
(window as any).uiRestartFromDefeat = uiRestartFromDefeat;
(window as any).showVictoryModal = showVictoryModal;
(window as any).hideVictoryModal = hideVictoryModal;
(window as any).uiContinueIntoEndless = uiContinueIntoEndless;
(window as any).uiRestartFromVictory = uiRestartFromVictory;
(window as any).uiHideModalToViewTable = uiHideModalToViewTable;
(window as any).uiRestoreModal = uiRestoreModal;
(window as any).closeTableInspection = closeTableInspection;
(window as any).toggleCogModal = toggleCogModal;
(window as any).toggleBlindModal = toggleBlindModal;
(window as any).toggleDeckModal = toggleDeckModal;
(window as any).toggleSimModal = toggleSimModal;
(window as any).inspectJoker = inspectJoker;
(window as any).inspectConsumable = inspectConsumable;
(window as any).closeInspector = closeInspector;
(window as any).uiBuyShopItem = uiBuyShopItem;
(window as any).uiRerollShop = uiRerollShop;
(window as any).uiMoveJoker = uiMoveJoker;
(window as any).uiSellJoker = uiSellJoker;
(window as any).uiSellConsumable = uiSellConsumable;
(window as any).uiUseConsumable = uiUseConsumable;
(window as any).startNextBlindFromShop = startNextBlindFromShop;
(window as any).dealHand = dealHand;
(window as any).playerHit = playerHit;
(window as any).playerStand = playerStand;
(window as any).playerDouble = playerDouble;
(window as any).handlePrimaryDealBtn = handlePrimaryDealBtn;
(window as any).runMonteCarloSimulation = runMonteCarloSimulation;
(window as any).runAllBotsSuiteAndExport = runAllBotsSuiteAndExport;
(window as any).downloadLastSimReport = downloadLastSimReport;
(window as any).copyLastSimReport = copyLastSimReport;
(window as any).applySimConfigToLiveGame = applySimConfigToLiveGame;

/* ==========================================================
   BOOT
========================================================== */
$('ui-table-felt').addEventListener('click', () => {
  const s = getState();
  if (!s.inHand && s.isDealing) {
    skipScoringAnimation = true;
  }
});

startNewRun();
