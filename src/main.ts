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
let isPlayfieldLocked = false;

function setPlayfieldLocked(locked: boolean): void {
  isPlayfieldLocked = locked;
  const appEl = document.getElementById('app');
  if (appEl) {
    if (locked) {
      appEl.classList.add('playfield-locked');
    } else {
      appEl.classList.remove('playfield-locked');
    }
  }
}

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

let scoringSpeedMultiplier = 1.00; // Default to 1.00 (fastest / brisk speed)
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

/* ---------- Joker 3D Carousel Viewer & Inspector ---------- */

let currentJokerCarouselIndex = 0;
let jokerStageTouchAttached = false;

function initJokerTouchGestures(): void {
  if (jokerStageTouchAttached) return;
  const stage = $('ui-joker-carousel-stage');
  if (!stage) return;
  jokerStageTouchAttached = true;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  stage.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  stage.addEventListener('touchend', (e: TouchEvent) => {
    if (e.changedTouches.length !== 1) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const elapsed = Date.now() - startTime;

    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && elapsed < 800) {
      if (deltaX < 0) {
        uiJokerCarouselNavNext();
      } else {
        uiJokerCarouselNavPrev();
      }
    }
  }, { passive: true });

  // Mouse drag support for desktop
  let isMouseDown = false;
  let mouseStartX = 0;
  stage.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDown = true;
    mouseStartX = e.clientX;
  });
  window.addEventListener('mouseup', (e: MouseEvent) => {
    if (!isMouseDown) return;
    isMouseDown = false;
    const deltaX = e.clientX - mouseStartX;
    if (Math.abs(deltaX) > 45) {
      if (deltaX < 0) uiJokerCarouselNavNext();
      else uiJokerCarouselNavPrev();
    }
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const modal = $('ui-joker-carousel-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      uiJokerCarouselNavNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      uiJokerCarouselNavPrev();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeJokerCarousel();
    }
  });
}

function updateJokerCarouselLayout(): void {
  const stage = $('ui-joker-carousel-stage');
  if (!stage) return;
  const cards = stage.querySelectorAll<HTMLElement>('.joker-carousel-card');
  const total = cards.length;
  if (total === 0) return;

  if (currentJokerCarouselIndex < 0) currentJokerCarouselIndex = 0;
  if (currentJokerCarouselIndex >= total) currentJokerCarouselIndex = total - 1;

  cards.forEach((cardEl, idx) => {
    const delta = idx - currentJokerCarouselIndex;
    cardEl.classList.remove('pack-card-active', 'pack-card-prev', 'pack-card-next', 'pack-card-far-prev', 'pack-card-far-next');

    if (delta === 0) {
      cardEl.classList.add('pack-card-active');
      cardEl.style.transform = 'translateX(0px) scale(1) translateZ(0px) rotate(0deg)';
      cardEl.style.zIndex = '10';
      cardEl.style.opacity = '1';
      cardEl.style.filter = 'none';
      cardEl.style.pointerEvents = 'auto';
    } else if (delta === 1) {
      cardEl.classList.add('pack-card-next');
      cardEl.style.transform = 'translateX(min(130px, 34vw)) scale(0.86) translateZ(-60px) rotate(3deg)';
      cardEl.style.zIndex = '6';
      cardEl.style.opacity = '0.78';
      cardEl.style.filter = 'brightness(0.72)';
      cardEl.style.pointerEvents = 'auto';
    } else if (delta === 2) {
      cardEl.classList.add('pack-card-far-next');
      cardEl.style.transform = 'translateX(min(230px, 60vw)) scale(0.72) translateZ(-120px) rotate(6deg)';
      cardEl.style.zIndex = '3';
      cardEl.style.opacity = '0.52';
      cardEl.style.filter = 'brightness(0.50)';
      cardEl.style.pointerEvents = 'auto';
    } else if (delta > 2) {
      cardEl.classList.add('pack-card-far-next');
      cardEl.style.transform = 'translateX(min(290px, 78vw)) scale(0.58) translateZ(-180px) rotate(9deg)';
      cardEl.style.zIndex = '1';
      cardEl.style.opacity = '0';
      cardEl.style.filter = 'brightness(0.3)';
      cardEl.style.pointerEvents = 'none';
    } else if (delta === -1) {
      cardEl.classList.add('pack-card-prev');
      cardEl.style.transform = 'translateX(max(-130px, -34vw)) scale(0.86) translateZ(-60px) rotate(-3deg)';
      cardEl.style.zIndex = '6';
      cardEl.style.opacity = '0.78';
      cardEl.style.filter = 'brightness(0.72)';
      cardEl.style.pointerEvents = 'auto';
    } else if (delta === -2) {
      cardEl.classList.add('pack-card-far-prev');
      cardEl.style.transform = 'translateX(max(-230px, -60vw)) scale(0.72) translateZ(-120px) rotate(-6deg)';
      cardEl.style.zIndex = '3';
      cardEl.style.opacity = '0.52';
      cardEl.style.filter = 'brightness(0.50)';
      cardEl.style.pointerEvents = 'auto';
    } else {
      cardEl.classList.add('pack-card-far-prev');
      cardEl.style.transform = 'translateX(max(-290px, -78vw)) scale(0.58) translateZ(-180px) rotate(-9deg)';
      cardEl.style.zIndex = '1';
      cardEl.style.opacity = '0';
      cardEl.style.filter = 'brightness(0.3)';
      cardEl.style.pointerEvents = 'none';
    }
  });

  // Update navigation chevrons
  const prevBtn = $('btn-joker-prev');
  const nextBtn = $('btn-joker-next');
  if (prevBtn) {
    if (currentJokerCarouselIndex > 0) {
      prevBtn.classList.remove('disabled');
      prevBtn.style.opacity = '1';
      prevBtn.style.pointerEvents = 'auto';
    } else {
      prevBtn.classList.add('disabled');
      prevBtn.style.opacity = '0.15';
      prevBtn.style.pointerEvents = 'none';
    }
  }
  if (nextBtn) {
    if (currentJokerCarouselIndex < total - 1) {
      nextBtn.classList.remove('disabled');
      nextBtn.style.opacity = '1';
      nextBtn.style.pointerEvents = 'auto';
    } else {
      nextBtn.classList.add('disabled');
      nextBtn.style.opacity = '0.15';
      nextBtn.style.pointerEvents = 'none';
    }
  }

  // Update footer reorder buttons
  const reorderLeftBtn = $('btn-joker-reorder-left') as HTMLButtonElement | null;
  const reorderRightBtn = $('btn-joker-reorder-right') as HTMLButtonElement | null;
  if (reorderLeftBtn) {
    const disabled = currentJokerCarouselIndex <= 0 || total <= 1;
    reorderLeftBtn.disabled = disabled;
    reorderLeftBtn.style.opacity = disabled ? '0.25' : '1';
    reorderLeftBtn.style.pointerEvents = disabled ? 'none' : 'auto';
  }
  if (reorderRightBtn) {
    const disabled = currentJokerCarouselIndex >= total - 1 || total <= 1;
    reorderRightBtn.disabled = disabled;
    reorderRightBtn.style.opacity = disabled ? '0.25' : '1';
    reorderRightBtn.style.pointerEvents = disabled ? 'none' : 'auto';
  }

  // Update pagination dots
  const dotsEl = $('ui-joker-dots');
  if (dotsEl) {
    dotsEl.innerHTML = Array.from({ length: total }, (_, i) => `
      <span class="pack-dot ${i === currentJokerCarouselIndex ? 'active' : ''}" onclick="uiSetJokerCarouselActiveCard(${i})"></span>
    `).join('');
  }

  // Update hint text
  const hintEl = $('ui-joker-nav-hint');
  if (hintEl) {
    hintEl.textContent = `Joker ${currentJokerCarouselIndex + 1} of ${total} • Tap side arrows to browse • Reorder buttons arrange scoring`;
  }
}

function renderJokerCarousel(): void {
  const state = getState();
  const jokers = state.jokers;
  const total = jokers.length;
  const modal = $('ui-joker-carousel-modal');
  if (!modal || total === 0) {
    if (modal) modal.classList.add('hidden');
    return;
  }

  initJokerTouchGestures();

  if (currentJokerCarouselIndex < 0) currentJokerCarouselIndex = 0;
  if (currentJokerCarouselIndex >= total) currentJokerCarouselIndex = total - 1;

  const badgeEl = $('ui-joker-carousel-badge');
  if (badgeEl) badgeEl.textContent = `ACTIVE JOKERS (${total}/${state.maxJokers})`;

  const stage = $('ui-joker-carousel-stage');
  if (!stage) return;

  stage.innerHTML = jokers.map((j, idx) => {
    const sellVal = Math.max(1, Math.floor(j.cost / 2));
    const arch = j.archetype || 'utility';
    const icon = j.icon || '🃏';
    const rarity = j.rarity || 'common';
    const fullDesc = getJokerFullDesc(j);

    const ord = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;

    return `
      <div class="joker-carousel-card pack-opt-joker rarity-${rarity} archetype-${arch}"
           data-joker-idx="${idx}"
           onclick="uiClickJokerCarouselCard(${idx})">
        <div class="pack-opt-watermark">${icon}</div>
        <div class="pack-opt-inner">
          <div class="pack-opt-badge-row">
            <span class="pack-opt-type">JOKER • ${rarity.toUpperCase()}</span>
            <span class="pack-opt-archetype">${arch.toUpperCase()}</span>
          </div>

          <div class="joker-order-pill">
            <span>⚡ Trigger Slot #${idx + 1} of ${total}</span>
            <span style="opacity:0.75; font-size:9.5px;">(${ord})</span>
          </div>

          <div class="pack-card-art-box"><span class="pack-card-big-icon">${icon}</span></div>
          <div class="pack-opt-title">${j.name}</div>
          <div class="pack-opt-desc">${fullDesc}</div>
        </div>

        <div class="joker-card-controls">
          <button class="btn btn-redeal btn-joker-sell"
                  onclick="event.stopPropagation(); uiSellJokerInCarousel(${idx})"
                  title="Sell this joker for cash">
            Sell Joker for $${sellVal}
          </button>
        </div>
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');
  updateJokerCarouselLayout();
}

function uiJokerCarouselNavNext(): void {
  const total = getState().jokers.length;
  if (currentJokerCarouselIndex < total - 1) {
    currentJokerCarouselIndex++;
    if (typeof (window as any).playCardSlideSound === 'function') {
      (window as any).playCardSlideSound();
    }
    updateJokerCarouselLayout();
  }
}

function uiJokerCarouselNavPrev(): void {
  if (currentJokerCarouselIndex > 0) {
    currentJokerCarouselIndex--;
    if (typeof (window as any).playCardSlideSound === 'function') {
      (window as any).playCardSlideSound();
    }
    updateJokerCarouselLayout();
  }
}

function uiSetJokerCarouselActiveCard(idx: number): void {
  const total = getState().jokers.length;
  if (idx >= 0 && idx < total && idx !== currentJokerCarouselIndex) {
    currentJokerCarouselIndex = idx;
    if (typeof (window as any).playCardSlideSound === 'function') {
      (window as any).playCardSlideSound();
    }
    updateJokerCarouselLayout();
  }
}

function uiClickJokerCarouselCard(idx: number): void {
  if (isPlayfieldLocked) return;
  if (idx !== currentJokerCarouselIndex) {
    uiSetJokerCarouselActiveCard(idx);
  }
}

function handleJokerStageClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (!target) return;
  if (target.closest('button') || target.closest('.pack-dot')) return;
  if (target.closest('.joker-carousel-card')) return;

  const stage = $('ui-joker-carousel-stage');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const clickX = e.clientX;
  if (clickX > rect.left + rect.width * 0.6) {
    uiJokerCarouselNavNext();
  } else if (clickX < rect.left + rect.width * 0.4) {
    uiJokerCarouselNavPrev();
  }
}

function uiMoveJokerInCarousel(dir: -1 | 1): void {
  if (isPlayfieldLocked) return;
  const state = getState();
  const currentIdx = currentJokerCarouselIndex;
  const targetIdx = currentIdx + dir;
  if (targetIdx < 0 || targetIdx >= state.jokers.length) return;

  moveJokerAt(currentIdx, dir);
  currentJokerCarouselIndex = targetIdx;

  if (typeof (window as any).playCardSlideSound === 'function') {
    (window as any).playCardSlideSound();
  }

  updateAllUI();
  renderJokerCarousel();
}

function uiSellJokerInCarousel(idx: number): void {
  if (isPlayfieldLocked) return;
  const res = sellJoker(idx);
  if (res === null) return;

  if (typeof (window as any).playCardDealSound === 'function') {
    (window as any).playCardDealSound();
  }

  const remaining = getState().jokers.length;
  if (remaining === 0) {
    closeJokerCarousel();
  } else {
    if (currentJokerCarouselIndex >= remaining) {
      currentJokerCarouselIndex = remaining - 1;
    }
    renderJokerCarousel();
  }
  updateAllUI();
  if (getState().inShop) renderShop();
}

function closeJokerCarousel(): void {
  const modal = $('ui-joker-carousel-modal');
  if (modal) modal.classList.add('hidden');
}

function inspectJoker(index: number): void {
  if (isPlayfieldLocked) return;
  const state = getState();
  if (!state.jokers || state.jokers.length === 0) return;
  if (index < 0 || index >= state.jokers.length) index = 0;

  currentJokerCarouselIndex = index;
  renderJokerCarousel();

  if (typeof (window as any).playCardDealSound === 'function') {
    (window as any).playCardDealSound();
  }
}

function inspectConsumable(index: number): void {
  if (isPlayfieldLocked) return;
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
  $('ui-inspect-modal')?.classList.add('hidden');
  closeJokerCarousel();
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
    if (step.deltaMoney && step.deltaMoney > 0) {
      bracket += `+$${step.deltaMoney}`;
    }
    if (bracket) {
      parts.push(`${name}[${bracket}]`);
    }
  }

  // 4. Double Down / Double or Nothing:
  const doubleStep = res.steps.find(s => s.kind === 'double');
  if (doubleStep) {
    const dMult = formatScoringVal(doubleStep.deltaMult || 2);
    const dName = (doubleStep.deltaMult === 3 || (doubleStep.sourceName && doubleStep.sourceName.includes('Double or Nothing'))) ? 'Double or Nothing' : 'Double Down';
    parts.push(`${dName}[×${dMult}<span class="eq-m">m</span>]`);
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
      if (step.deltaMoney && step.deltaMoney > 0) bVal += `+$${step.deltaMoney}`;
      if (bVal) parts.push(`${name}[${bVal}]`);
    }
    const doubleStep = res.steps.find(s => s.kind === 'double');
    if (doubleStep) {
      const dMult = formatScoringVal(doubleStep.deltaMult || 2);
      const dName = (doubleStep.deltaMult === 3 || (doubleStep.sourceName && doubleStep.sourceName.includes('Double or Nothing'))) ? 'Double or Nothing' : 'Double Down';
      parts.push(`${dName}[×${dMult}m]`);
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

function renderCardHTML(card: Card, faceDown: boolean = false, extraClasses: string = '', onClickAttr: string = ''): string {
  if (faceDown) return `<div class="playing-card face-down ${extraClasses}" ${onClickAttr}></div>`;
  const isRed = ['♥', '♦'].includes(card.suit);
  const enhClass = card.enhancement ? `enh-${card.enhancement}` : '';
  const enhLabel = card.enhancement ? `<div class="card-enh-tag">${card.enhancement.toUpperCase()}</div>` : '';
  const chipVal = getCardChipValue(card);

  return `
    <div class="playing-card ${isRed ? 'red' : 'black'} ${enhClass} ${extraClasses}" ${onClickAttr}>
      <div class="card-corner-top">${card.rank}<br>${card.suit}</div>
      <div class="card-suit-center">${card.suit}</div>
      ${enhLabel}
      <div class="card-corner-bottom">+${chipVal}c</div>
    </div>
  `;
}

function renderShop() {
  const state = getState();
  const packGrid = document.getElementById('ui-shop-packs');
  const jGrid = document.getElementById('ui-shop-jokers');
  const eGrid = document.getElementById('ui-shop-extras');
  const rerollBtn = document.getElementById('btn-reroll') as HTMLButtonElement | null;
  if (rerollBtn) rerollBtn.textContent = `Reroll ($${state.rerollCost})`;

  if (packGrid) {
    packGrid.innerHTML = state.shopPacks.map((item, idx) => {
      const badgeText = item.badge || item.packType.toUpperCase();
      const badgeClass = `pack-badge-${item.packType}`;
      let packIcon = '🃏';
      if (item.packType === 'tarot') packIcon = '🔮';
      else if (item.packType === 'card') packIcon = '🎴';
      else if (item.packType === 'variety') packIcon = '🎲';

      return `
        <div class="shop-item shop-pack type-pack shop-pack-wrapper pack-booster-wrapper pack-${item.packType} ${item.bought ? 'pack-bought' : ''}">
          <div class="pack-booster-crimp top"></div>
          <div class="pack-booster-foil-sheen"></div>
          <div class="pack-booster-badge ${badgeClass}">${badgeText} PACK</div>
          <div class="pack-booster-icon">${packIcon}</div>
          <div class="pack-booster-name">${item.name}</div>
          <div class="pack-booster-tagline">${item.desc}</div>
          <div class="shop-pack-action">
            <button class="btn btn-deal btn-buy-pack" style="width:100%; padding:6px 10px; font-size:12px;"
              onclick="uiBuyPack(${idx})"
              ${item.bought || state.money < item.cost ? 'disabled' : ''}>
              ${item.bought ? 'OPENED' : 'OPEN $' + item.cost}
            </button>
          </div>
          <div class="pack-booster-crimp bottom"></div>
        </div>
      `;
    }).join('');
  }

  if (jGrid) {
    jGrid.innerHTML = state.shopJokers.map((item, idx) => {
      const isJoker = item.shopType === 'joker';
      const jokerItem = isJoker ? (item as JokerInstance) : null;
      const rarityClass = jokerItem && jokerItem.rarity ? `rarity-${jokerItem.rarity}` : '';
      const archClass = jokerItem && jokerItem.archetype ? `archetype-${jokerItem.archetype}` : '';
      const icon = jokerItem?.icon || '🃏';
      const badgeHtml = jokerItem && jokerItem.rarity
        ? `<span class="rarity-badge rarity-${jokerItem.rarity}">${jokerItem.rarity.toUpperCase()}</span>`
        : '';
      const watermarkHtml = isJoker ? `<div class="shop-item-watermark">${icon}</div>` : '';
      const titleHtml = isJoker
        ? `<span class="joker-icon-mini">${icon}</span> ${item.name}`
        : item.name;
      return `
      <div class="shop-item type-${item.shopType} ${rarityClass} ${archClass}">
        ${watermarkHtml}
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
            <div class="shop-item-sub">${item.shopType}</div>
            ${badgeHtml}
          </div>
          <div class="shop-item-title">${titleHtml}</div>
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
  }

  if (eGrid) {
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
    jRow.innerHTML = state.jokers.map((j, i) => {
      const arch = j.archetype || 'utility';
      const suitClass = j.suitTheme ? `suit-${j.suitTheme === '♥' ? 'hearts' : j.suitTheme === '♦' ? 'diamonds' : j.suitTheme === '♠' ? 'spades' : 'clubs'}` : '';
      const icon = j.icon || '🃏';
      return `
        <div class="mini-card rarity-${j.rarity || 'common'} archetype-${arch} ${suitClass}" onclick="inspectJoker(${i})" title="${getJokerFullDesc(j)}">
          <div class="mini-card-watermark">${icon}</div>
          <div class="mini-card-name"><span class="joker-icon-mini">${icon}</span><span>${j.name}</span></div>
          <div class="mini-card-sub">${getJokerMiniSubHTML(j)}</div>
        </div>
      `;
    }).join('');
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
    dealBtn.disabled = state.isDealing || isPlayfieldLocked;
    hitBtn.classList.add('hidden');
  } else {
    dealBtn.className = 'btn btn-deal';
    dealBtn.textContent = `DEAL (${state.handsLeft})`;
    dealBtn.disabled = state.inHand || state.isDealing || state.handsLeft <= 0 || state.blindFailedReady || isPlayfieldLocked;
    hitBtn.classList.remove('hidden');
  }

  hitBtn.disabled = !state.inHand || state.isDealing || isPlayfieldLocked;
  standBtn.disabled = !state.inHand || state.isDealing || isPlayfieldLocked;
  const anchorBoss = state.bossBlind && state.bossBlind.id === 'the_anchor';
  doubleBtn.disabled = !state.inHand || state.isDealing || state.playerHand.length !== 2 || !!anchorBoss || isPlayfieldLocked;
}

/* ---------- Modals ---------- */

function toggleBlindModal(show: boolean): void {
  if (isPlayfieldLocked && show) return;
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
  if (isPlayfieldLocked && show) return;
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
  if (isPlayfieldLocked && show) return;
  $('ui-sim-modal').classList.toggle('hidden', !show);
}

function toggleDeckModal(show: boolean): void {
  if (isPlayfieldLocked && show) return;
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
        return renderCardHTML(c, false, extraClass, `onclick="inspectDeckCard(${c.uid})" title="Tap to inspect ${c.rank}${c.suit}"`);
      }).join('');

      return `<div class="deck-suit-row">${cardsHtml}</div>`;
    }).join('');
  } else {
    closeDeckCardModal();
  }
  modal.classList.toggle('hidden', !show);
}

function inspectDeckCard(uid: number): void {
  const state = getState();
  const card = state.deck.find(c => c.uid === uid);
  if (!card) return;

  const hiddenHoleCard = (!state.dealerHoleRevealed && state.dealerHand.length >= 2)
    ? state.dealerHand[1]
    : null;
  const unrevealedUids = new Set(state.shoe.map(c => c.uid));
  if (hiddenHoleCard) {
    unrevealedUids.add(hiddenHoleCard.uid);
  }
  const isUnseen = unrevealedUids.has(card.uid);

  const nameEl = $('ui-deck-zoom-card-name');
  const stageEl = $('ui-deck-zoom-card-render');
  const statusEl = $('ui-deck-zoom-card-status');
  const blurbEl = $('ui-deck-zoom-card-blurb');

  const suitNames: Record<Suit, string> = { '♠': 'Spades', '♥': 'Hearts', '♣': 'Clubs', '♦': 'Diamonds' };
  const rankNames: Record<Rank, string> = {
    'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack',
    '10': '10', '9': '9', '8': '8', '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2'
  };

  const fullName = `${rankNames[card.rank] || card.rank} of ${suitNames[card.suit] || card.suit} (${card.rank}${card.suit})`;
  if (nameEl) nameEl.textContent = fullName;

  if (stageEl) {
    // Rendered normally without dealt-out class, in enlarged card-zoomed view
    stageEl.innerHTML = renderCardHTML(card, false, 'card-zoomed');
  }

  if (statusEl) {
    if (isUnseen) {
      statusEl.className = 'deck-card-status-badge status-unseen';
      statusEl.textContent = '🟢 IN SHOE / DECK (UNSEEN)';
    } else {
      statusEl.className = 'deck-card-status-badge status-played';
      statusEl.textContent = '⚪ PLAYED / IN HAND THIS BLIND';
    }
  }

  if (blurbEl) {
    const chipVal = getCardChipValue(card);
    let enhHtml = '';
    if (card.enhancement === 'foil') {
      enhHtml = `
        <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #334155;">
          <strong style="color:var(--chips);">✨ FOIL ENHANCEMENT</strong><br>
          Adds <strong style="color:var(--chips);">+30 Chips</strong> permanently to this card when scored in your final hand.
        </div>
      `;
    } else if (card.enhancement === 'holo') {
      enhHtml = `
        <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #334155;">
          <strong style="color:var(--mult);">🌈 HOLOGRAPHIC ENHANCEMENT</strong><br>
          Adds <strong style="color:var(--mult);">+4 Mult</strong> permanently to this card when scored in your final hand.
        </div>
      `;
    } else if (card.enhancement === 'poly') {
      enhHtml = `
        <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #334155;">
          <strong style="color:var(--purple);">🔮 POLYCHROME ENHANCEMENT</strong><br>
          Multiplies your total Mult by <strong style="color:var(--purple);">×1.5</strong> permanently when scored in your final hand.
        </div>
      `;
    } else if (card.enhancement === 'gold') {
      enhHtml = `
        <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #334155;">
          <strong style="color:var(--gold);">💰 GOLD ENHANCEMENT</strong><br>
          Earns <strong style="color:var(--gold);">+$3 bonus cash</strong> permanently whenever a scoring hand is won with this card.
        </div>
      `;
    } else {
      enhHtml = `
        <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #334155; font-size:12px; color:#94a3b8;">
          <em>Standard card with no active enhancements. Can be permanently upgraded with Tarots from the Pit Boss Shop.</em>
        </div>
      `;
    }

    const bjValStr = card.rank === 'A' ? '11 or 1' : (FACE_RANKS.includes(card.rank) ? '10' : card.rank);

    blurbEl.innerHTML = `
      <div>
        <strong>Blackjack Value:</strong> ${bjValStr} &nbsp;•&nbsp; <strong>Base Chips:</strong> +${chipVal}c
      </div>
      ${enhHtml}
    `;
  }

  const modal = $('ui-deck-card-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeDeckCardModal(): void {
  const modal = $('ui-deck-card-modal');
  if (modal) modal.classList.add('hidden');
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

    <div style="background:#0b0e14; padding:8px 12px; border-radius:8px; border:1px solid #283246; margin-bottom:10px; display:flex; flex-wrap:wrap; gap:12px; font-size:11px; align-items:center; justify-content:space-between;">
      <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
        <span style="font-weight:bold; color:var(--gold);">📦 PACKS OPENED:</span>
        <span>🃏 Jokers: <strong style="color:#38bdf8;">${simData.packStats?.pack_joker?.bought ?? 0}</strong></span>
        <span style="color:#475569;">|</span>
        <span>🌀 Variety: <strong style="color:#10b981;">${simData.packStats?.pack_variety?.bought ?? 0}</strong></span>
        <span style="color:#475569;">|</span>
        <span>🔮 Tarots: <strong style="color:#a855f7;">${simData.packStats?.pack_tarot?.bought ?? 0}</strong></span>
        <span style="color:#475569;">|</span>
        <span>🎴 Cards: <strong style="color:#eab308;">${simData.packStats?.pack_card?.bought ?? 0}</strong></span>
      </div>
      <div>
        <span style="color:#cbd5e1;">🔄 Rerolls: <strong style="color:var(--gold);">${(simData.totalRerolls ?? 0).toLocaleString()}</strong></span>
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
  setPlayfieldLocked(false);
  startNewRunState();
  $('ui-rules-deals-count').textContent = String(getBalanceConfig().startingDeals);
  $('ui-shop-overlay').classList.add('hidden');
  const packOverlay = document.getElementById('ui-pack-overlay');
  if (packOverlay) packOverlay.classList.add('hidden');
  refreshBlindStartUI();
}

function startBlindPlay(): void {
  stopConfetti();
  beginBlindState();
  refreshBlindStartUI();
}

function startNextBlindFromShop(): void {
  $('ui-shop-overlay').classList.add('hidden');
  const packOverlay = document.getElementById('ui-pack-overlay');
  if (packOverlay) packOverlay.classList.add('hidden');
  startBlindPlay();
}

function uiCashOut(): void {
  if (isPlayfieldLocked) return;
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
  if (isPlayfieldLocked || state.isDealing || state.blindFailedReady) return;
  const splash = $('ui-splash-screen');
  if (splash && !splash.classList.contains('hidden')) {
    splash.classList.add('hidden');
  }
  if (state.blindClearedReady) {
    uiCashOut();
  } else {
    void dealHand();
  }
}

/* ==========================================================
   SHOP / INVENTORY UI WRAPPERS
========================================================== */
function uiRerollShop(): void {
  if (isPlayfieldLocked) return;
  if (!rerollShop().ok) return;
  renderShop();
  updateAllUI();
}

function uiBuyShopItem(listName: 'shopJokers' | 'shopExtras', idx: number): void {
  if (isPlayfieldLocked) return;
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

let currentPackCardIndex = 0;
let packAnimTimer1: any = null;
let packAnimTimer2: any = null;
let packStageTouchAttached = false;

function clearPackAnimationTimers(): void {
  if (packAnimTimer1) { clearTimeout(packAnimTimer1); packAnimTimer1 = null; }
  if (packAnimTimer2) { clearTimeout(packAnimTimer2); packAnimTimer2 = null; }
}

function uiSkipPackAnimation(): void {
  clearPackAnimationTimers();
  const animContainer = $('ui-pack-booster-container');
  if (animContainer) animContainer.classList.add('hidden');
  const flash = $('ui-pack-burst-flash');
  if (flash) flash.classList.remove('active');
  const stage = $('ui-pack-stage');
  if (stage) {
    stage.classList.remove('pack-cards-hidden');
    stage.classList.remove('pack-cards-reveal');
  }
  updatePackCardsLayout();
}

function updatePackCardsLayout(): void {
  const stage = $('ui-pack-stage');
  if (!stage) return;
  const cards = stage.querySelectorAll<HTMLElement>('.pack-option-card');
  const total = cards.length;
  if (total === 0) return;

  if (currentPackCardIndex < 0) currentPackCardIndex = 0;
  if (currentPackCardIndex >= total) currentPackCardIndex = total - 1;

  cards.forEach((cardEl, idx) => {
    const delta = idx - currentPackCardIndex;
    cardEl.classList.remove('pack-card-active', 'pack-card-prev', 'pack-card-next', 'pack-card-far-prev', 'pack-card-far-next');

    if (delta === 0) {
      cardEl.classList.add('pack-card-active');
      cardEl.style.transform = 'translateX(0px) scale(1) translateZ(0px) rotate(0deg)';
      cardEl.style.zIndex = '10';
      cardEl.style.opacity = '1';
      cardEl.style.filter = 'none';
      cardEl.style.pointerEvents = 'auto';
    } else if (delta === 1) {
      cardEl.classList.add('pack-card-next');
      cardEl.style.transform = 'translateX(min(130px, 34vw)) scale(0.86) translateZ(-60px) rotate(3deg)';
      cardEl.style.zIndex = '6';
      cardEl.style.opacity = '0.78';
      cardEl.style.filter = 'brightness(0.72)';
      cardEl.style.pointerEvents = 'auto';
    } else if (delta === 2) {
      cardEl.classList.add('pack-card-far-next');
      cardEl.style.transform = 'translateX(min(230px, 60vw)) scale(0.72) translateZ(-120px) rotate(6deg)';
      cardEl.style.zIndex = '3';
      cardEl.style.opacity = '0.52';
      cardEl.style.filter = 'brightness(0.50)';
      cardEl.style.pointerEvents = 'auto';
    } else if (delta > 2) {
      cardEl.classList.add('pack-card-far-next');
      cardEl.style.transform = 'translateX(min(290px, 78vw)) scale(0.58) translateZ(-180px) rotate(9deg)';
      cardEl.style.zIndex = '1';
      cardEl.style.opacity = '0';
      cardEl.style.filter = 'brightness(0.3)';
      cardEl.style.pointerEvents = 'none';
    } else if (delta === -1) {
      cardEl.classList.add('pack-card-prev');
      cardEl.style.transform = 'translateX(max(-130px, -34vw)) scale(0.86) translateZ(-60px) rotate(-3deg)';
      cardEl.style.zIndex = '6';
      cardEl.style.opacity = '0.78';
      cardEl.style.filter = 'brightness(0.72)';
      cardEl.style.pointerEvents = 'auto';
    } else if (delta === -2) {
      cardEl.classList.add('pack-card-far-prev');
      cardEl.style.transform = 'translateX(max(-230px, -60vw)) scale(0.72) translateZ(-120px) rotate(-6deg)';
      cardEl.style.zIndex = '3';
      cardEl.style.opacity = '0.52';
      cardEl.style.filter = 'brightness(0.50)';
      cardEl.style.pointerEvents = 'auto';
    } else {
      cardEl.classList.add('pack-card-far-prev');
      cardEl.style.transform = 'translateX(max(-290px, -78vw)) scale(0.58) translateZ(-180px) rotate(-9deg)';
      cardEl.style.zIndex = '1';
      cardEl.style.opacity = '0';
      cardEl.style.filter = 'brightness(0.3)';
      cardEl.style.pointerEvents = 'none';
    }
  });

  // Update nav arrows
  const prevBtn = $('btn-pack-prev');
  const nextBtn = $('btn-pack-next');
  if (prevBtn) {
    if (currentPackCardIndex > 0) {
      prevBtn.classList.remove('disabled');
      prevBtn.style.opacity = '1';
      prevBtn.style.pointerEvents = 'auto';
    } else {
      prevBtn.classList.add('disabled');
      prevBtn.style.opacity = '0.15';
      prevBtn.style.pointerEvents = 'none';
    }
  }
  if (nextBtn) {
    if (currentPackCardIndex < total - 1) {
      nextBtn.classList.remove('disabled');
      nextBtn.style.opacity = '1';
      nextBtn.style.pointerEvents = 'auto';
    } else {
      nextBtn.classList.add('disabled');
      nextBtn.style.opacity = '0.15';
      nextBtn.style.pointerEvents = 'none';
    }
  }

  // Update hint text
  const hintEl = $('ui-pack-nav-hint');
  if (hintEl) {
    hintEl.textContent = `Card ${currentPackCardIndex + 1} of ${total} • Swipe or click arrows to browse`;
  }
}

function uiPackNavNext(): void {
  const state = getState();
  const total = state.activePackOpening?.options.length || 0;
  if (currentPackCardIndex < total - 1) {
    currentPackCardIndex++;
    if (typeof (window as any).playCardSlideSound === 'function') {
      (window as any).playCardSlideSound();
    }
    updatePackCardsLayout();
  }
}

function uiPackNavPrev(): void {
  if (currentPackCardIndex > 0) {
    currentPackCardIndex--;
    if (typeof (window as any).playCardSlideSound === 'function') {
      (window as any).playCardSlideSound();
    }
    updatePackCardsLayout();
  }
}

function uiSetPackActiveCard(idx: number): void {
  const state = getState();
  const total = state.activePackOpening?.options.length || 0;
  if (idx >= 0 && idx < total && idx !== currentPackCardIndex) {
    currentPackCardIndex = idx;
    if (typeof (window as any).playCardSlideSound === 'function') {
      (window as any).playCardSlideSound();
    }
    updatePackCardsLayout();
  }
}

function uiClickPackCard(optIdx: number): void {
  if (isPlayfieldLocked) return;
  if (optIdx !== currentPackCardIndex) {
    uiSetPackActiveCard(optIdx);
  } else {
    uiChoosePackOption(optIdx);
  }
}

function handlePackStageClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (!target) return;
  if (target.closest('button') || target.closest('.pack-dot')) return;
  if (target.closest('.pack-option-card')) return;

  const stage = $('ui-pack-stage');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const clickX = e.clientX;
  if (clickX > rect.left + rect.width * 0.6) {
    uiPackNavNext();
  } else if (clickX < rect.left + rect.width * 0.4) {
    uiPackNavPrev();
  }
}

function initPackTouchGestures(): void {
  if (packStageTouchAttached) return;
  const stage = $('ui-pack-stage');
  if (!stage) return;
  packStageTouchAttached = true;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  stage.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  stage.addEventListener('touchend', (e: TouchEvent) => {
    if (e.changedTouches.length !== 1) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const elapsed = Date.now() - startTime;

    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && elapsed < 800) {
      if (deltaX < 0) {
        uiPackNavNext();
      } else {
        uiPackNavPrev();
      }
    }
  }, { passive: true });

  // Mouse drag support for desktop
  let isMouseDown = false;
  let mouseStartX = 0;
  stage.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDown = true;
    mouseStartX = e.clientX;
  });
  window.addEventListener('mouseup', (e: MouseEvent) => {
    if (!isMouseDown) return;
    isMouseDown = false;
    const deltaX = e.clientX - mouseStartX;
    if (Math.abs(deltaX) > 45) {
      if (deltaX < 0) uiPackNavNext();
      else uiPackNavPrev();
    }
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const overlay = $('ui-pack-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      uiPackNavNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      uiPackNavPrev();
    }
  });
}

function renderPackOpeningScreen(triggerAnim: boolean = false): void {
  const state = getState();
  const active = state.activePackOpening;
  const overlay = $('ui-pack-overlay');
  if (!active || !overlay) {
    if (overlay) overlay.classList.add('hidden');
    clearPackAnimationTimers();
    return;
  }

  currentPackCardIndex = 0;
  initPackTouchGestures();

  const badgeEl = $('ui-pack-badge');
  const titleEl = $('ui-pack-title');
  const subEl = $('ui-pack-sub');
  if (badgeEl) badgeEl.textContent = (active.pack.badge || active.pack.packType).toUpperCase() + ' PACK';
  if (titleEl) titleEl.textContent = active.pack.name;
  if (subEl) subEl.textContent = `Choose ${active.pack.chooseCount} of ${active.options.length} options to take`;

  const stage = $('ui-pack-stage');
  if (!stage) return;

  stage.innerHTML = active.options.map((opt, optIdx) => {
    let cardContentHtml = '';
    let cardTypeLabel = '';
    let cardTitle = '';
    let cardSub = '';
    let extraCardClass = '';
    let chooseBtnText = 'CHOOSE';

    if (opt.kind === 'joker') {
      const j = opt.data;
      const icon = j.icon || '🃏';
      const arch = j.archetype || 'utility';
      cardTypeLabel = `JOKER • ${(j.rarity || 'common').toUpperCase()}`;
      cardTitle = j.name;
      cardSub = getJokerFullDesc(j);
      extraCardClass = `pack-opt-joker rarity-${j.rarity || 'common'} archetype-${arch}`;
      chooseBtnText = 'CHOOSE JOKER';
      cardContentHtml = `
        <div class="pack-opt-watermark">${icon}</div>
        <div class="pack-opt-inner">
          <div class="pack-opt-badge-row">
            <span class="pack-opt-type">${cardTypeLabel}</span>
            <span class="pack-opt-archetype">${arch.toUpperCase()}</span>
          </div>
          <div class="pack-card-art-box"><span class="pack-card-big-icon">${icon}</span></div>
          <div class="pack-opt-title">${cardTitle}</div>
          <div class="pack-opt-desc">${cardSub}</div>
        </div>
      `;
    } else if (opt.kind === 'tarot') {
      const t = opt.data;
      cardTypeLabel = 'TAROT CONSUMABLE';
      cardTitle = t.name;
      cardSub = t.desc;
      extraCardClass = 'pack-opt-tarot';
      chooseBtnText = 'TAKE TAROT';
      cardContentHtml = `
        <div class="pack-opt-inner">
          <div class="pack-opt-badge-row">
            <span class="pack-opt-type">${cardTypeLabel}</span>
            <span class="pack-opt-archetype">SPELL</span>
          </div>
          <div class="pack-card-art-box"><span class="pack-card-big-icon">🔮</span></div>
          <div class="pack-opt-title">${cardTitle}</div>
          <div class="pack-opt-desc">${cardSub}</div>
        </div>
      `;
    } else if (opt.kind === 'card') {
      const c = opt.data;
      const isRed = ['♥', '♦'].includes(c.suit);
      const enhName = c.enhancement ? c.enhancement.toUpperCase() : 'STANDARD';
      cardTypeLabel = `PLAYING CARD • ${enhName}`;
      cardTitle = `${c.rank}${c.suit}`;
      let enhBlurb = 'Standard card (+chips in hand)';
      if (c.enhancement === 'foil') enhBlurb = '+30 Chips';
      else if (c.enhancement === 'holo') enhBlurb = '+4 Mult';
      else if (c.enhancement === 'poly') enhBlurb = '×1.5 Mult';
      else if (c.enhancement === 'gold') enhBlurb = '+$3 Bonus Cash';
      cardSub = enhBlurb;
      extraCardClass = `pack-opt-card enh-${c.enhancement || 'none'} ${isRed ? 'card-red' : 'card-black'}`;
      chooseBtnText = 'ADD TO DECK';

      const cardVisual = renderCardHTML({ uid: 0, rank: c.rank, suit: c.suit, enhancement: c.enhancement }, false, 'pack-showcase-card');

      cardContentHtml = `
        <div class="pack-opt-inner">
          <div class="pack-opt-badge-row">
            <span class="pack-opt-type">${cardTypeLabel}</span>
            <span class="pack-opt-archetype">${enhName}</span>
          </div>
          <div class="pack-card-playing-box">${cardVisual}</div>
          <div class="pack-opt-title">${cardTitle}</div>
          <div class="pack-opt-desc">${cardSub}</div>
        </div>
      `;
    }

    return `
      <div class="pack-option-card ${extraCardClass}" onclick="uiClickPackCard(${optIdx})">
        ${cardContentHtml}
        <button class="btn btn-deal btn-pack-choose" onclick="event.stopPropagation(); uiChoosePackOption(${optIdx})">
          ${chooseBtnText}
        </button>
      </div>
    `;
  }).join('');

  overlay.classList.remove('hidden');
  updatePackCardsLayout();

  // Check if headless test environment
  const isHeadlessTest = typeof navigator !== 'undefined' && (/jsdom/i.test(navigator.userAgent) || !!(window as any).__TEST__);

  clearPackAnimationTimers();
  const boosterContainer = $('ui-pack-booster-container');
  const boosterWrapper = $('ui-pack-booster-wrapper');
  const burstFlash = $('ui-pack-burst-flash');

  if (triggerAnim && boosterContainer && boosterWrapper && !isHeadlessTest) {
    const packType = active.pack.packType;
    let packIcon = '🃏';
    if (packType === 'tarot') packIcon = '🔮';
    else if (packType === 'card') packIcon = '🎴';
    else if (packType === 'variety') packIcon = '🎲';

    const bBadge = $('ui-pack-booster-badge');
    const bIcon = $('ui-pack-booster-icon');
    const bName = $('ui-pack-booster-name');
    const bTag = $('ui-pack-booster-tag');

    if (bBadge) bBadge.textContent = (active.pack.badge || packType).toUpperCase() + ' PACK';
    if (bIcon) bIcon.textContent = packIcon;
    if (bName) bName.textContent = active.pack.name;
    if (bTag) bTag.textContent = `Choose ${active.pack.chooseCount} of ${active.options.length}`;

    boosterWrapper.className = `pack-booster-wrapper pack-${packType} anim-shake`;
    boosterContainer.classList.remove('hidden');
    if (burstFlash) burstFlash.classList.remove('active');

    stage.classList.add('pack-cards-hidden');

    if (typeof (window as any).playPackRipPopSound === 'function') {
      (window as any).playPackRipPopSound();
    } else if (typeof playPackRipPopSound === 'function') {
      playPackRipPopSound();
    }

    // Step 2: Pop burst at 2600ms (slowed down to 25% of current shaking speed)
    packAnimTimer1 = setTimeout(() => {
      boosterWrapper.classList.remove('anim-shake');
      boosterWrapper.classList.add('anim-burst');
      if (burstFlash) burstFlash.classList.add('active');

      stage.classList.remove('pack-cards-hidden');
      stage.classList.add('pack-cards-reveal');

      // Step 3: Complete animation at 360ms after pop
      packAnimTimer2 = setTimeout(() => {
        uiSkipPackAnimation();
      }, 360);
    }, 2600);
  } else {
    if (boosterContainer) boosterContainer.classList.add('hidden');
    stage.classList.remove('pack-cards-hidden');
    stage.classList.remove('pack-cards-reveal');
  }
}

function uiBuyPack(idx: number): void {
  if (isPlayfieldLocked) return;
  const res = buyAndOpenPack(idx);
  if (!res.ok) {
    if (res.reason === 'too_poor') alert('Not enough cash to open this pack!');
    return;
  }
  playCardDealSound();
  renderShop();
  updateAllUI();
  renderPackOpeningScreen(true);
}

function uiChoosePackOption(optIdx: number): void {
  if (isPlayfieldLocked) return;
  const res = pickPackOption(optIdx);
  if (!res.ok) {
    if (res.reason === 'jokers_full') alert('Joker slots full! Tap an active Joker at the top to sell it, or tap Skip Pack.');
    if (res.reason === 'tarots_full') alert('Tarot slots full! Tap an active Tarot at the top to use/sell it, or tap Skip Pack.');
    return;
  }
  uiSkipPackAnimation();
  playCardDealSound();
  const overlay = $('ui-pack-overlay');
  if (overlay) overlay.classList.add('hidden');

  let pickedName = '';
  if (res.picked?.kind === 'joker') pickedName = res.picked.data.name;
  else if (res.picked?.kind === 'tarot') pickedName = res.picked.data.name;
  else if (res.picked?.kind === 'card') pickedName = `${res.picked.data.rank}${res.picked.data.suit}`;

  setBanner(`Added ${pickedName} to your collection!`, 'Pit Boss Shop');
  renderShop();
  updateAllUI();
}

function uiSkipPack(): void {
  if (isPlayfieldLocked) return;
  uiSkipPackAnimation();
  skipPackOpening();
  const overlay = $('ui-pack-overlay');
  if (overlay) overlay.classList.add('hidden');
  setBanner('Skipped pack.', 'Pit Boss Shop');
  renderShop();
  updateAllUI();
}

function uiMoveJoker(index: number, dir: number): void {
  if (isPlayfieldLocked) return;
  const target = index + dir;
  if (target < 0 || target >= getState().jokers.length) return;
  moveJokerAt(index, dir < 0 ? -1 : 1);
  updateAllUI();
  inspectJoker(target);
}

function uiSellJoker(index: number): void {
  if (isPlayfieldLocked) return;
  if (sellJoker(index) === null) return;
  closeInspector();
  updateAllUI();
  if (getState().inShop) renderShop();
}

function uiSellConsumable(index: number): void {
  if (isPlayfieldLocked) return;
  if (!sellConsumable(index)) return;
  closeInspector();
  updateAllUI();
}

function uiUseConsumable(index: number): void {
  if (isPlayfieldLocked) return;
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
  if (isPlayfieldLocked || state.inHand || state.isDealing || state.handsLeft <= 0 || state.blindClearedReady || state.blindFailedReady) return;

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
  if (isPlayfieldLocked || !state.inHand || state.isDealing) return;
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
        recordJokerTrigger('daredevil', 'Daredevil');
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
  if (isPlayfieldLocked || !state.inHand || state.isDealing) return;
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
  if (isPlayfieldLocked || !state.inHand || state.isDealing || state.playerHand.length !== 2) return;
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
    const stackerIdx = state.jokers.findIndex(j => j.id === 'chip_stacker');
    if (stackerIdx >= 0) {
      popJokerCard(stackerIdx);
    }
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
        const isDoN = step.deltaMult === 3 || step.jokerId === 'double_or_nothing';
        const bannerTitle = isDoN ? 'Double or Nothing: ×3 Mult!' : 'Double Down: ×2 Mult!';
        setBanner(bannerTitle, 'Tap table felt to skip');

        let tokenSource: HTMLElement = $('ui-table-felt');
        let jEl: HTMLElement | null = null;
        if (isDoN) {
          const jIdx = step.jokerIndex !== undefined ? step.jokerIndex : getState().jokers.findIndex(j => j.id === 'double_or_nothing');
          if (jIdx !== -1 && jRow.children[jIdx]) {
            jEl = jRow.children[jIdx] as HTMLElement;
            tokenSource = jEl;
            jRow.classList.add('joker-row-scoring');
            jEl.classList.add('scoring-focus');
            if (typeof jEl.scrollIntoView === 'function') {
              jEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
            playCardSlideSound();
          }
        }

        spawnFloatingToken(
          tokenSource,
          multEl,
          'mult-x',
          `×${formatScoringVal(step.deltaMult || 2)}m`,
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
        if (jEl) {
          jEl.classList.remove('scoring-focus');
          jRow.classList.remove('joker-row-scoring');
        }
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

  // Telemetry: record hand outcome, scores & cards drawn
  let outcomeCategory = 'LOSS';
  if (res.rawOutcomeType === 'CHARLIE') outcomeCategory = 'CHARLIE';
  else if (res.rawOutcomeType === 'NATURAL') outcomeCategory = 'NATURAL';
  else if (res.cushioned) outcomeCategory = 'CUSHIONED';
  else if (res.safetyNetSaved) outcomeCategory = 'SAFETY_NET';
  else if (res.outcomeLabel.includes('PUSH IT GOOD')) outcomeCategory = 'PUSH_IT_GOOD';
  else if (res.rawOutcomeType === 'EXACT21') outcomeCategory = 'EXACT21';
  else if (res.rawOutcomeType === 'WIN') outcomeCategory = res.dBust ? 'DEALER_BUST' : 'WIN';
  else if (res.rawOutcomeType === 'PUSH') outcomeCategory = 'PUSH';
  else if (res.rawOutcomeType === 'BUST') outcomeCategory = 'BUST';
  else outcomeCategory = 'LOSS';

  const resType: 'won' | 'lost' | 'push' = res.isWin ? 'won' : (res.outcomeType === 'PUSH' ? 'push' : 'lost');
  recordHandOutcomeStats(
    outcomeCategory,
    resType,
    res.handScore,
    state.playerHand.length + state.dealerHand.length,
    state.doubledDown
  );

  if (res.moneyGained > 0) {
    recordMoneyEarned('inHandScoring', res.moneyGained);
  }

  // Record joker triggers from this hand
  for (const step of res.steps) {
    if (step.kind === 'joker' && step.jokerId) {
      recordJokerTrigger(step.jokerId, step.sourceName);
    } else if (step.kind === 'double' && step.jokerId === 'double_or_nothing') {
      recordJokerTrigger('double_or_nothing', 'Double or Nothing');
    }
  }
  if (res.cushioned) {
    recordJokerTrigger('bust_cushion', 'Bust Cushion');
  }
  if (res.safetyNetSaved) {
    recordJokerTrigger('safety_net', 'Safety Net');
  }
  if (res.rawOutcomeType === 'PUSH' && state.jokers.some(j => j.id === 'push_it_good')) {
    recordJokerTrigger('push_it_good', 'Push It Good');
  }
  if (res.chipStackerNewBonus !== null && !res.steps.some(s => s.kind === 'joker' && s.jokerId === 'chip_stacker')) {
    recordJokerTrigger('chip_stacker', 'Chip Stacker');
  }

  if (state.roundScore >= state.targetScore) {
    const isAnte8Victory = (state.ante === 8 && state.blindIndex === 2 && !state.endlessMode);
    if (isAnte8Victory) {
      setPlayfieldLocked(true);
      const payout = computeBlindPayout();
      patchState({ pendingPayout: payout });

      showOutcomeHeadline('ANTE 8 CONQUERED!', 'WIN');
      launchConfetti();
      renderScoringBanner(res, state.playerHand, 'ANTE8_VICTORY');
      updateAllUI();

      // Give the player a moment to see the last hand and scoring animations!
      await sleep(1500);

      startVictoryMusic();
      showVictoryModal();
    } else {
      const payout = computeBlindPayout();
      patchState({ blindClearedReady: true, pendingPayout: payout });

      playOutcomeSound('BLIND_WIN');
      showOutcomeHeadline('YOU WON!', 'WIN');
      launchConfetti();
      renderScoringBanner(res, state.playerHand, 'BLIND_CLEARED', payout.totalEarned);
      updateAllUI();
    }
  } else if (state.handsLeft <= 0) {
    setPlayfieldLocked(true);
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
   LIBRARY / COMPENDIUM VIEWS & STATS PLACEHOLDERS
========================================================== */

type LibraryCategory = 'jokers' | 'tarots' | 'vouchers' | 'effects' | 'packs';

let currentLibraryCategory: LibraryCategory | null = null;
let currentLibraryJokerFilter: 'all' | 'common' | 'uncommon' | 'rare' = 'all';

interface ItemTelemetryStats {
  statusText?: string;
  metrics: Array<{ label: string; value: string; hint?: string }>;
}

function getItemTelemetryStats(category: LibraryCategory, itemId: string): ItemTelemetryStats {
  // Primed for future telemetry persistence; displays clean structured placeholders for now
  if (category === 'jokers') {
    return {
      statusText: 'Joker Lifetime Telemetry',
      metrics: [
        { label: 'Times Discovered', value: '--', hint: 'Seen in shop & booster packs' },
        { label: 'Rounds Held', value: '--', hint: 'Active blinds with this joker' },
        { label: 'Hands Triggered', value: '--', hint: 'Scoring activations recorded' },
        { label: 'Chips Contributed', value: '--', hint: 'Total chips generated' },
        { label: 'Mult Contributed', value: '--', hint: 'Total mult generated' },
        { label: 'Win Rate When Held', value: '--%', hint: 'Ante clears when owned' }
      ]
    };
  } else if (category === 'tarots') {
    return {
      statusText: 'Consumable Spell Telemetry',
      metrics: [
        { label: 'Times Acquired', value: '--', hint: 'Purchased in shop or packs' },
        { label: 'Times Cast', value: '--', hint: 'Used during active hands' },
        { label: 'Times Sold', value: '--', hint: 'Liquidated for cash' },
        { label: 'Win Rate When Cast', value: '--%', hint: 'Victories on cast hands' }
      ]
    };
  } else if (category === 'vouchers') {
    return {
      statusText: 'Table Voucher Telemetry',
      metrics: [
        { label: 'Times Redeemed', value: '--', hint: 'Purchased across all runs' },
        { label: 'Earliest Ante Acquired', value: '--', hint: 'Earliest ante redeemed' },
        { label: 'Runs Won With Voucher', value: '--', hint: 'Ante 8 victories with perk' },
        { label: 'Est. Value Contributed', value: '--', hint: 'Bonus chips, deals, money' }
      ]
    };
  } else if (category === 'effects') {
    return {
      statusText: 'Card Edition Telemetry',
      metrics: [
        { label: 'Cards Enhanced', value: '--', hint: 'Permanent upgrades created' },
        { label: 'Times Scored In Hand', value: '--', hint: 'Played in scoring hands' },
        { label: 'Bonus Impact', value: '--', hint: 'Total chips/mult/cash scored' },
        { label: 'Deck Saturation Peak', value: '--%', hint: 'Highest % of deck enhanced' }
      ]
    };
  } else {
    return {
      statusText: 'Booster Pack Telemetry',
      metrics: [
        { label: 'Packs Opened', value: '--', hint: 'Purchased in Pit Boss Shop' },
        { label: 'Cards Drafted', value: '--', hint: 'Options chosen from pack' },
        { label: 'Packs Skipped', value: '--', hint: 'Pack contents bypassed' },
        { label: 'Total Money Invested', value: '$0', hint: 'Cash spent on this pack' }
      ]
    };
  }
}

function openLibraryModal(initialCategory?: LibraryCategory): void {
  playCardSlideSound();
  const modal = $('ui-library-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  if (initialCategory) {
    openLibraryCategory(initialCategory);
  } else {
    showLibraryCategories();
  }
}

function closeLibraryModal(): void {
  closeLibraryDetail();
  const modal = $('ui-library-modal');
  if (modal) modal.classList.add('hidden');
  currentLibraryCategory = null;
}

function showLibraryCategories(): void {
  currentLibraryCategory = null;
  const categoriesPage = $('ui-lib-categories-page');
  const itemsPage = $('ui-lib-items-page');
  const tabs = $('ui-lib-category-tabs');
  const title = $('ui-lib-title');
  const subtitle = $('ui-lib-subtitle');
  const backLabel = $('ui-lib-back-label');

  if (categoriesPage) categoriesPage.classList.remove('hidden');
  if (itemsPage) itemsPage.classList.add('hidden');
  if (tabs) tabs.classList.add('hidden');

  if (title) title.textContent = 'ARCHIVES & COMPENDIUM';
  if (subtitle) subtitle.textContent = 'Select a collection to view all cards, upgrades & effects';
  if (backLabel) backLabel.textContent = 'Main Menu';
}

function openLibraryCategory(category: LibraryCategory): void {
  playCardSlideSound();
  currentLibraryCategory = category;
  const categoriesPage = $('ui-lib-categories-page');
  const itemsPage = $('ui-lib-items-page');
  const tabs = $('ui-lib-category-tabs');
  const title = $('ui-lib-title');
  const subtitle = $('ui-lib-subtitle');
  const backLabel = $('ui-lib-back-label');

  if (categoriesPage) categoriesPage.classList.add('hidden');
  if (itemsPage) itemsPage.classList.remove('hidden');
  if (tabs) tabs.classList.remove('hidden');

  if (backLabel) backLabel.textContent = 'Categories';

  const tabBtns = document.querySelectorAll('.lib-tab-btn');
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.id === `lib-tab-${category}`);
  });

  const catMeta: Record<LibraryCategory, { title: string; subtitle: string }> = {
    jokers: {
      title: `JOKERS COMPENDIUM (${JOKER_CATALOG.length})`,
      subtitle: 'Passive scoring jokers, suit synergies and rule-bending abilities'
    },
    tarots: {
      title: `TAROT SPELLS (${TAROT_CATALOG.length})`,
      subtitle: 'Consumable spells that enhance cards, forge ranks, or alter game rules'
    },
    vouchers: {
      title: `VOUCHERS (${VOUCHER_CATALOG.length})`,
      subtitle: 'Permanent table upgrades active for the duration of the run'
    },
    effects: {
      title: `CARD SPECIAL EFFECTS (${CARD_EFFECTS_CATALOG.length})`,
      subtitle: 'Permanent card edition enhancements with custom visual shaders'
    },
    packs: {
      title: `BOOSTER PACKS (${PACK_CATALOG.length})`,
      subtitle: 'Card booster packs available for purchase in the Pit Boss Shop'
    }
  };

  const meta = catMeta[category];
  if (title) title.textContent = meta.title;
  if (subtitle) subtitle.textContent = meta.subtitle;

  renderLibraryItems();
}

function switchLibraryCategory(category: LibraryCategory): void {
  closeLibraryDetail();
  openLibraryCategory(category);
}

function handleLibraryBack(): void {
  const detailModal = $('ui-lib-detail-modal');
  if (detailModal && !detailModal.classList.contains('hidden')) {
    closeLibraryDetail();
    return;
  }
  if (currentLibraryCategory !== null) {
    showLibraryCategories();
  } else {
    closeLibraryModal();
  }
}

function setLibraryJokerFilter(filter: 'all' | 'common' | 'uncommon' | 'rare'): void {
  currentLibraryJokerFilter = filter;
  renderLibraryItems();
}

function renderLibraryItems(): void {
  const grid = $('ui-lib-items-grid');
  const subfilter = $('ui-lib-subfilter-bar');
  if (!grid) return;

  if (currentLibraryCategory === 'jokers') {
    if (subfilter) {
      subfilter.classList.remove('hidden');
      const counts = {
        all: JOKER_CATALOG.length,
        common: JOKER_CATALOG.filter(j => j.rarity === 'common').length,
        uncommon: JOKER_CATALOG.filter(j => j.rarity === 'uncommon').length,
        rare: JOKER_CATALOG.filter(j => j.rarity === 'rare').length
      };
      subfilter.innerHTML = `
        <div class="lib-subfilter-pills">
          <button class="lib-filter-pill ${currentLibraryJokerFilter === 'all' ? 'active' : ''}" onclick="setLibraryJokerFilter('all')">ALL (${counts.all})</button>
          <button class="lib-filter-pill filter-common ${currentLibraryJokerFilter === 'common' ? 'active' : ''}" onclick="setLibraryJokerFilter('common')">COMMON (${counts.common})</button>
          <button class="lib-filter-pill filter-uncommon ${currentLibraryJokerFilter === 'uncommon' ? 'active' : ''}" onclick="setLibraryJokerFilter('uncommon')">UNCOMMON (${counts.uncommon})</button>
          <button class="lib-filter-pill filter-rare ${currentLibraryJokerFilter === 'rare' ? 'active' : ''}" onclick="setLibraryJokerFilter('rare')">RARE (${counts.rare})</button>
        </div>
      `;
    }

    const filtered = JOKER_CATALOG.filter(j => currentLibraryJokerFilter === 'all' || j.rarity === currentLibraryJokerFilter);
    grid.innerHTML = filtered.map(j => {
      const arch = j.archetype || 'utility';
      const icon = j.icon || '🃏';
      return `
        <div class="lib-item-card lib-joker-card rarity-${j.rarity} archetype-${arch}" onclick="openLibraryDetail('jokers', '${j.id}')">
          <div class="lib-item-watermark">${icon}</div>
          <div class="lib-item-header">
            <span class="rarity-badge rarity-${j.rarity}">${j.rarity.toUpperCase()}</span>
            <span class="archetype-badge archetype-${arch}">${arch.toUpperCase()}</span>
          </div>
          <div class="lib-item-main">
            <span class="lib-item-icon">${icon}</span>
            <div class="lib-item-name">${j.name}</div>
          </div>
          <div class="lib-item-desc">${j.desc}</div>
          <div class="lib-item-footer">
            <span class="lib-item-cost">$${j.cost}</span>
            <span class="lib-item-action-hint">🔍 Inspect</span>
          </div>
        </div>
      `;
    }).join('');

  } else {
    if (subfilter) {
      subfilter.classList.add('hidden');
      subfilter.innerHTML = '';
    }

    if (currentLibraryCategory === 'tarots') {
      grid.innerHTML = TAROT_CATALOG.map(t => `
        <div class="lib-item-card lib-tarot-card" onclick="openLibraryDetail('tarots', '${t.id}')">
          <div class="lib-item-watermark">🔮</div>
          <div class="lib-item-header">
            <span class="tarot-badge">TAROT</span>
            <span class="lib-tag-pill">CONSUMABLE</span>
          </div>
          <div class="lib-item-main">
            <span class="lib-item-icon">🔮</span>
            <div class="lib-item-name" style="color:#d8b4fe;">${t.name}</div>
          </div>
          <div class="lib-item-desc">${t.desc}</div>
          <div class="lib-item-footer">
            <span class="lib-item-cost">$${t.cost}</span>
            <span class="lib-item-action-hint">🔍 Inspect</span>
          </div>
        </div>
      `).join('');

    } else if (currentLibraryCategory === 'vouchers') {
      grid.innerHTML = VOUCHER_CATALOG.map(v => `
        <div class="lib-item-card lib-voucher-card" onclick="openLibraryDetail('vouchers', '${v.id}')">
          <div class="lib-item-watermark">🎟️</div>
          <div class="lib-item-header">
            <span class="voucher-badge">VOUCHER</span>
            <span class="lib-tag-pill">PERMANENT</span>
          </div>
          <div class="lib-item-main">
            <span class="lib-item-icon">🎟️</span>
            <div class="lib-item-name" style="color:var(--gold);">${v.name}</div>
          </div>
          <div class="lib-item-desc">${v.desc}</div>
          <div class="lib-item-footer">
            <span class="lib-item-cost">$${v.cost}</span>
            <span class="lib-item-action-hint">🔍 Inspect</span>
          </div>
        </div>
      `).join('');

    } else if (currentLibraryCategory === 'effects') {
      grid.innerHTML = CARD_EFFECTS_CATALOG.map(e => `
        <div class="lib-item-card lib-effect-card enh-${e.enhancement}" onclick="openLibraryDetail('effects', '${e.id}')">
          <div class="lib-item-header">
            <span class="card-enh-tag" style="position:static; transform:none;">${e.badge}</span>
            <span class="lib-tag-pill" style="color:${e.color}; font-weight:800;">${e.bonusText}</span>
          </div>
          <div class="lib-effect-preview-row">
            ${renderCardHTML({ uid: 0, rank: 'A', suit: '♠', enhancement: e.enhancement }, false, 'deck-mini')}
            <div class="lib-item-main" style="margin:0;">
              <div class="lib-item-name" style="color:${e.color}; font-size:16px;">${e.name} Edition</div>
              <div style="font-size:11px; color:#94a3b8;">${e.tarotSource}</div>
            </div>
          </div>
          <div class="lib-item-desc">${e.desc}</div>
          <div class="lib-item-footer">
            <span class="lib-item-cost" style="color:${e.color};">${e.bonusText}</span>
            <span class="lib-item-action-hint">🔍 Inspect</span>
          </div>
        </div>
      `).join('');

    } else if (currentLibraryCategory === 'packs') {
      grid.innerHTML = PACK_CATALOG.map(p => `
        <div class="lib-item-card lib-pack-card pack-${p.packType}" onclick="openLibraryDetail('packs', '${p.id}')">
          <div class="lib-item-header">
            <span class="pack-badge pack-badge-${p.packType}">${p.badge || p.packType.toUpperCase()}</span>
            <span class="lib-tag-pill">SHOP PACK</span>
          </div>
          <div class="lib-item-main">
            <span class="lib-item-icon">📦</span>
            <div class="lib-item-name" style="color:#ffffff;">${p.name}</div>
          </div>
          <div class="lib-item-desc">${p.desc}</div>
          <div class="lib-item-footer">
            <span class="lib-item-cost">$${p.cost}</span>
            <span class="lib-item-action-hint">🔍 Inspect</span>
          </div>
        </div>
      `).join('');
    }
  }
}

function openLibraryDetail(category: LibraryCategory, itemId: string): void {
  playChipSound();
  const detailModal = $('ui-lib-detail-modal');
  const stage = $('ui-lib-detail-stage');
  const title = $('ui-lib-detail-title');
  const badge = $('ui-lib-detail-badge');
  const typeEl = $('ui-lib-detail-type');
  const costEl = $('ui-lib-detail-cost');
  const descEl = $('ui-lib-detail-desc');
  const tipEl = $('ui-lib-detail-tip');
  const statsGrid = $('ui-lib-detail-stats-grid');
  const statsStatus = $('ui-lib-detail-stats-status');

  if (!detailModal) return;

  if (category === 'jokers') {
    const j = JOKER_CATALOG.find(x => x.id === itemId);
    if (!j) return;
    const arch = j.archetype || 'utility';
    const icon = j.icon || '🃏';

    if (badge) {
      badge.className = `lib-detail-badge rarity-${j.rarity}`;
      badge.textContent = j.rarity.toUpperCase();
    }
    if (typeEl) typeEl.textContent = `${arch.toUpperCase()} JOKER`;
    if (title) title.innerHTML = `<span style="font-size:24px; vertical-align:middle; margin-right:6px;">${icon}</span> ${j.name}`;
    if (costEl) costEl.textContent = `$${j.cost}`;
    if (descEl) descEl.textContent = j.desc;
    if (tipEl) {
      tipEl.innerHTML = `<strong>Gameplay Strategy:</strong> Jokers trigger left-to-right. Position +Chips and +Mult Jokers to the left of ×Mult Jokers to maximize exponential scoring returns.`;
    }

    if (stage) {
      stage.innerHTML = `
        <div class="lib-stage-joker-card rarity-${j.rarity} archetype-${arch}">
          <div class="lib-stage-watermark">${icon}</div>
          <div class="lib-stage-header">
            <span class="rarity-badge rarity-${j.rarity}">${j.rarity.toUpperCase()}</span>
            <span class="archetype-badge archetype-${arch}">${arch.toUpperCase()}</span>
          </div>
          <div class="lib-stage-art">${icon}</div>
          <div class="lib-stage-name">${j.name}</div>
          <div class="lib-stage-cost-row">
            <span>Shop Cost</span>
            <span class="lib-stage-cost-val">$${j.cost}</span>
          </div>
        </div>
      `;
    }

  } else if (category === 'tarots') {
    const t = TAROT_CATALOG.find(x => x.id === itemId);
    if (!t) return;

    if (badge) {
      badge.className = 'lib-detail-badge tarot-badge';
      badge.textContent = 'TAROT SPELL';
    }
    if (typeEl) typeEl.textContent = 'SINGLE-USE CONSUMABLE';
    if (title) title.innerHTML = `<span style="font-size:24px; vertical-align:middle; margin-right:6px;">🔮</span> ${t.name}`;
    if (costEl) costEl.textContent = `$${t.cost}`;
    if (descEl) descEl.textContent = t.desc;
    if (tipEl) {
      tipEl.innerHTML = `<strong>Pit Boss Shop Consumable:</strong> Store up to 2 Tarots in your inventory. Cast during an active hand to modify card values or trigger immediate bonuses.`;
    }

    if (stage) {
      stage.innerHTML = `
        <div class="lib-stage-tarot-card">
          <div class="lib-stage-watermark">🔮</div>
          <div class="lib-stage-header">
            <span class="tarot-badge">TAROT</span>
            <span class="lib-tag-pill">MYSTIC</span>
          </div>
          <div class="lib-stage-art">🎴</div>
          <div class="lib-stage-name" style="color:#d8b4fe;">${t.name}</div>
          <div class="lib-stage-cost-row">
            <span>Shop Cost</span>
            <span class="lib-stage-cost-val" style="color:#d8b4fe;">$${t.cost}</span>
          </div>
        </div>
      `;
    }

  } else if (category === 'vouchers') {
    const v = VOUCHER_CATALOG.find(x => x.id === itemId);
    if (!v) return;

    if (badge) {
      badge.className = 'lib-detail-badge voucher-badge';
      badge.textContent = 'TABLE VOUCHER';
    }
    if (typeEl) typeEl.textContent = 'PERMANENT RUN UPGRADE';
    if (title) title.innerHTML = `<span style="font-size:24px; vertical-align:middle; margin-right:6px;">🎟️</span> ${v.name}`;
    if (costEl) costEl.textContent = `$${v.cost}`;
    if (descEl) descEl.textContent = v.desc;
    if (tipEl) {
      tipEl.innerHTML = `<strong>Table Perk:</strong> Exactly 1 Voucher is offered per Ante in the shop. Once purchased, its passive benefits remain active permanently for the rest of your run.`;
    }

    if (stage) {
      stage.innerHTML = `
        <div class="lib-stage-voucher-card">
          <div class="lib-stage-watermark">🎟️</div>
          <div class="lib-stage-header">
            <span class="voucher-badge">VOUCHER</span>
            <span class="lib-tag-pill">PERMANENT</span>
          </div>
          <div class="lib-stage-art">🎟️</div>
          <div class="lib-stage-name" style="color:var(--gold);">${v.name}</div>
          <div class="lib-stage-cost-row">
            <span>Shop Cost</span>
            <span class="lib-stage-cost-val" style="color:var(--gold);">$${v.cost}</span>
          </div>
        </div>
      `;
    }

  } else if (category === 'effects') {
    const e = CARD_EFFECTS_CATALOG.find(x => x.id === itemId);
    if (!e) return;

    if (badge) {
      badge.className = 'lib-detail-badge';
      badge.style.background = e.color;
      badge.style.color = '#000000';
      badge.textContent = e.badge;
    }
    if (typeEl) typeEl.textContent = 'SPECIAL CARD EDITION';
    if (title) title.innerHTML = `<span style="font-size:24px; vertical-align:middle; margin-right:6px;">${e.icon}</span> ${e.name} Edition`;
    if (costEl) costEl.innerHTML = `<span style="color:${e.color}; font-weight:800;">${e.bonusText}</span>`;
    if (descEl) descEl.textContent = e.desc;
    if (tipEl) {
      tipEl.innerHTML = `<strong>Source & Stacking:</strong> Applied via ${e.tarotSource}. Enhanced cards retain their special properties across all subsequent deals, reshuffles, and antes.`;
    }

    if (stage) {
      stage.innerHTML = `
        <div class="lib-stage-effect-wrap">
          ${renderCardHTML({ uid: 0, rank: 'A', suit: '♠', enhancement: e.enhancement }, false, 'card-zoomed')}
          <div class="lib-stage-effect-caption" style="color:${e.color};">
            <strong>${e.badge} EDITION</strong> • ${e.bonusText}
          </div>
        </div>
      `;
    }

  } else if (category === 'packs') {
    const p = PACK_CATALOG.find(x => x.id === itemId);
    if (!p) return;

    if (badge) {
      badge.className = `lib-detail-badge pack-badge-${p.packType}`;
      badge.textContent = p.badge || p.packType.toUpperCase();
    }
    if (typeEl) typeEl.textContent = 'PIT BOSS BOOSTER PACK';
    if (title) title.innerHTML = `<span style="font-size:24px; vertical-align:middle; margin-right:6px;">📦</span> ${p.name}`;
    if (costEl) costEl.textContent = `$${p.cost}`;
    if (descEl) descEl.textContent = p.desc;
    if (tipEl) {
      tipEl.innerHTML = `<strong>Drafting Mechanics:</strong> Opening this pack reveals ${p.cardsCount} options. Select ${p.chooseCount} to permanently add to your run, or skip to save inventory space.`;
    }

    if (stage) {
      stage.innerHTML = `
        <div class="lib-stage-pack-card pack-${p.packType}">
          <div class="lib-stage-pack-crimped top"></div>
          <div class="lib-stage-header">
            <span class="pack-badge pack-badge-${p.packType}">${p.badge || p.packType.toUpperCase()}</span>
            <span class="lib-tag-pill">$${p.cost}</span>
          </div>
          <div class="lib-stage-art">📦</div>
          <div class="lib-stage-name">${p.name}</div>
          <div class="lib-stage-pack-sub">Choose ${p.chooseCount} of ${p.cardsCount}</div>
          <div class="lib-stage-pack-crimped bottom"></div>
        </div>
      `;
    }
  }

  // Populate structured telemetry stats placeholders
  const stats = getItemTelemetryStats(category, itemId);
  if (statsStatus && stats.statusText) {
    statsStatus.textContent = stats.statusText;
  }
  if (statsGrid) {
    statsGrid.innerHTML = stats.metrics.map(m => `
      <div class="lib-stat-box">
        <div class="lib-stat-label">${m.label}</div>
        <div class="lib-stat-val">${m.value}</div>
        ${m.hint ? `<div class="lib-stat-hint">${m.hint}</div>` : ''}
      </div>
    `).join('');
  }

  detailModal.classList.remove('hidden');
}

function closeLibraryDetail(): void {
  const detailModal = $('ui-lib-detail-modal');
  if (detailModal) detailModal.classList.add('hidden');
}

/* ==========================================================
   MAIN MENU, DEFEAT & VICTORY FLOW
========================================================== */
function showMainMenu(): void {
  closeLibraryModal();
  closeTableInspection();
  hideDefeatModal();
  hideVictoryModal();
  setPlayfieldLocked(false);
  toggleCogModal(false);
  toggleBlindModal(false);
  toggleDeckModal(false);
  closeDeckCardModal();
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
  closeLibraryModal();
  closeTableInspection();
  toggleCogModal(false);
  setPlayfieldLocked(false);
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
  setPlayfieldLocked(true);
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
          ${j.icon || '🃏'} ${j.name}
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
  setPlayfieldLocked(true);
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
          ${j.icon || '🃏'} ${j.name}
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
  setPlayfieldLocked(false);
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

/* ---------- Run Statistics Screen ---------- */
let statsReturnModal: 'VICTORY' | 'DEFEAT' | null = null;

function uiShowStatsModal(source: 'VICTORY' | 'DEFEAT'): void {
  statsReturnModal = source;
  if (source === 'VICTORY') {
    hideVictoryModal();
  } else {
    hideDefeatModal();
  }
  renderRunStats();
  const m = $('ui-stats-modal');
  if (m) m.classList.remove('hidden');
}

function uiHideStatsModal(): void {
  const m = $('ui-stats-modal');
  if (m) m.classList.add('hidden');
  const returnTo = statsReturnModal;
  statsReturnModal = null;
  if (returnTo === 'VICTORY') {
    showVictoryModal();
  } else if (returnTo === 'DEFEAT') {
    showDefeatModal();
  }
}

function renderRunStats(): void {
  const state = getState();
  const stats = state.runStats;

  // Header / Status
  const statusEl = $('ui-stats-status');
  if (statusEl) {
    if (state.ante >= 8 && state.blindIndex === 2 && !state.endlessMode && state.roundScore >= state.targetScore) {
      statusEl.innerHTML = `<span class="gold-txt" style="font-weight:900;">👑 ANTE 8 VICTORY</span>`;
    } else if (state.endlessMode) {
      statusEl.innerHTML = `<span class="gold-txt" style="font-weight:900;">🚀 ENDLESS MODE (Ante ${state.ante})</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:#f87171; font-weight:900;">💀 RUN OVER (Ante ${state.ante})</span>`;
    }
  }

  // Overview stats
  const setTxt = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  const winRate = stats.handsPlayed > 0 ? ((stats.handsWon / stats.handsPlayed) * 100).toFixed(1) + '%' : '0.0%';
  const dblWinRate = stats.doubleDownAttempts > 0 ? ((stats.doubleDownWins / stats.doubleDownAttempts) * 100).toFixed(1) + '%' : 'N/A';

  setTxt('ui-stats-ante', `Ante ${state.ante} (${getBlindName()})`);
  setTxt('ui-stats-total-score', stats.totalScore.toLocaleString());
  setTxt('ui-stats-high-score', stats.highestHandScore.toLocaleString());
  setTxt('ui-stats-hands-played', `${stats.handsPlayed} (W: ${stats.handsWon} / L: ${stats.handsLost} / P: ${stats.handsPushed})`);
  setTxt('ui-stats-winrate', winRate);
  setTxt('ui-stats-doubles', `${stats.doubleDownWins}/${stats.doubleDownAttempts} (${dblWinRate})`);
  setTxt('ui-stats-cards-drawn', String(stats.cardsDrawn));
  setTxt('ui-stats-tarots-used', String(stats.tarotsUsed));
  setTxt('ui-stats-vouchers-bought', String(stats.vouchersBoughtCount));

  // Hand Outcomes Breakdown Grid
  const winsListEl = $('ui-stats-outcomes-wins-list');
  const lossesListEl = $('ui-stats-outcomes-losses-list');
  const winsTotalEl = $('ui-stats-outcomes-wins-total');
  const lossesTotalEl = $('ui-stats-outcomes-losses-total');

  if (winsTotalEl) {
    winsTotalEl.textContent = `${stats.handsWon} Won`;
  }
  if (lossesTotalEl) {
    lossesTotalEl.textContent = `${stats.handsLost} Lost • ${stats.handsPushed} Push`;
  }

  if (winsListEl && lossesListEl) {
    if (stats.handsPlayed === 0) {
      winsListEl.innerHTML = `
        <div style="color:#94a3b8; font-style:italic; font-size:11px; padding:6px 0; text-align:center;">
          No winning hands recorded yet.
        </div>
      `;
      lossesListEl.innerHTML = `
        <div style="color:#94a3b8; font-style:italic; font-size:11px; padding:6px 0; text-align:center;">
          No losses or ties recorded yet.
        </div>
      `;
    } else {
      const winningDefinitions: { key: string; label: string }[] = [
        { key: 'NATURAL', label: 'Natural Blackjack' },
        { key: 'EXACT21', label: 'Exact 21' },
        { key: 'WIN', label: 'Standard Win (Beat Dealer)' },
        { key: 'DEALER_BUST', label: 'Dealer Bust' },
        { key: 'CHARLIE', label: '5-Card Charlie' },
        { key: 'CUSHIONED', label: 'Cushioned 21 (Rubber Table)' },
        { key: 'PUSH_IT_GOOD', label: 'Push It Good Win' },
        { key: 'SAFETY_NET', label: 'Safety Net Salvage' },
      ];

      // Any extra non-standard outcome recorded in stats.outcomes
      const knownKeys = new Set([...winningDefinitions.map(d => d.key), 'BUST', 'LOSS', 'PUSH']);
      for (const [k, o] of Object.entries(stats.outcomes)) {
        if (!knownKeys.has(k)) {
          winningDefinitions.push({ key: k, label: o.label || k });
        }
      }

      winningDefinitions.sort((a, b) => {
        const countA = stats.outcomes[a.key]?.won || 0;
        const countB = stats.outcomes[b.key]?.won || 0;
        return countB - countA;
      });

      winsListEl.innerHTML = winningDefinitions.map(item => {
        const count = stats.outcomes[item.key]?.won || 0;
        const isActive = count > 0;
        const rowClass = isActive ? 'eco-row stats-row-active' : 'eco-row stats-row-empty';
        const valHtml = isActive
          ? `<span class="gold-txt" style="font-weight:800;">${count}</span>`
          : `<span style="color:#64748b;">0</span>`;
        return `
          <div class="${rowClass}">
            <span style="${isActive ? 'color:#f8fafc; font-weight:600;' : ''}">${item.label}</span>
            ${valHtml}
          </div>
        `;
      }).join('');

      const lossDefinitions: { key: string; label: string; count: number; isLoss: boolean }[] = [
        { key: 'BUST', label: 'Player Bust', count: stats.outcomes['BUST']?.lost || 0, isLoss: true },
        { key: 'LOSS', label: 'Dealer Wins (Outscored)', count: stats.outcomes['LOSS']?.lost || 0, isLoss: true },
        { key: 'PUSH', label: 'Push (Tie)', count: stats.outcomes['PUSH']?.push || 0, isLoss: false },
      ];

      lossDefinitions.sort((a, b) => b.count - a.count);

      lossesListEl.innerHTML = lossDefinitions.map(item => {
        const isActive = item.count > 0;
        const rowClass = isActive ? 'eco-row stats-row-active' : 'eco-row stats-row-empty';
        const valColor = item.isLoss ? '#f87171' : '#cbd5e1';
        const valHtml = isActive
          ? `<span style="color:${valColor}; font-weight:800;">${item.count}</span>`
          : `<span style="color:#64748b;">0</span>`;
        return `
          <div class="${rowClass}">
            <span style="${isActive ? 'color:#f8fafc; font-weight:600;' : ''}">${item.label}</span>
            ${valHtml}
          </div>
        `;
      }).join('');
    }
  }

  // Money Breakdown
  setTxt('ui-stats-earned-total', `+$${stats.moneyEarned.total}`);
  setTxt('ui-stats-earned-blinds', `+$${stats.moneyEarned.blinds}`);
  setTxt('ui-stats-earned-deals', `+$${stats.moneyEarned.unusedDeals}`);
  setTxt('ui-stats-earned-interest', `+$${stats.moneyEarned.interest}`);
  setTxt('ui-stats-earned-scoring', `+$${stats.moneyEarned.inHandScoring}`);
  setTxt('ui-stats-earned-sales', `+$${stats.moneyEarned.sales}`);
  setTxt('ui-stats-earned-loan', `+$${stats.moneyEarned.loanShark}`);

  setTxt('ui-stats-spent-total', `-$${stats.moneySpent.total}`);
  setTxt('ui-stats-spent-jokers', `-$${stats.moneySpent.jokers}`);
  setTxt('ui-stats-spent-tarots', `-$${stats.moneySpent.tarots}`);
  setTxt('ui-stats-spent-cards', `-$${stats.moneySpent.cards}`);
  setTxt('ui-stats-spent-vouchers', `-$${stats.moneySpent.vouchers}`);
  setTxt('ui-stats-spent-rerolls', `-$${stats.moneySpent.rerolls}`);
  setTxt('ui-stats-spent-loan', `-$${stats.moneySpent.loanSharkFees}`);

  const netCash = stats.moneyEarned.total - stats.moneySpent.total;
  setTxt('ui-stats-net-cash', (netCash >= 0 ? `+$${netCash}` : `-$${Math.abs(netCash)}`));
  setTxt('ui-stats-final-money', `$${state.money}`);

  // Joker Triggers Breakdown
  const jokerTriggersEl = $('ui-stats-joker-triggers');
  if (jokerTriggersEl) {
    const list = Object.values(stats.jokerTriggers).sort((a, b) => b.count - a.count);
    const triggeredIds = new Set(list.map(t => t.id));
    const unTriggeredJokers = state.jokers.filter(j => !triggeredIds.has(j.id));

    if (list.length === 0 && unTriggeredJokers.length === 0) {
      jokerTriggersEl.innerHTML = `
        <div class="joker-trigger-empty">
          <span>🃏 No Jokers were equipped or triggered during this run.</span>
        </div>
      `;
    } else {
      const getJokerIcon = (id: string) => {
        const found = JOKER_CATALOG.find(j => j.id === id);
        return found?.icon || '🃏';
      };
      const activeHtml = list.map(jt => `
        <div class="joker-trigger-card">
          <div class="jt-name">${getJokerIcon(jt.id)} ${jt.name}</div>
          <div class="jt-badge">${jt.count} trigger${jt.count === 1 ? '' : 's'}</div>
        </div>
      `).join('');

      const unTriggeredHtml = unTriggeredJokers.map(j => `
        <div class="joker-trigger-card jt-untriggered">
          <div class="jt-name">${j.icon || getJokerIcon(j.id)} ${j.name}</div>
          <div class="jt-badge jt-badge-zero">0 triggers</div>
        </div>
      `).join('');

      jokerTriggersEl.innerHTML = activeHtml + unTriggeredHtml;
    }
  }
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
(window as any).uiShowStatsModal = uiShowStatsModal;
(window as any).uiHideStatsModal = uiHideStatsModal;
(window as any).renderRunStats = renderRunStats;
(window as any).toggleCogModal = toggleCogModal;
(window as any).toggleBlindModal = toggleBlindModal;
(window as any).toggleDeckModal = toggleDeckModal;
(window as any).inspectDeckCard = inspectDeckCard;
(window as any).closeDeckCardModal = closeDeckCardModal;
(window as any).toggleSimModal = toggleSimModal;
(window as any).inspectJoker = inspectJoker;
(window as any).inspectConsumable = inspectConsumable;
(window as any).closeInspector = closeInspector;
(window as any).closeJokerCarousel = closeJokerCarousel;
(window as any).renderJokerCarousel = renderJokerCarousel;
(window as any).updateJokerCarouselLayout = updateJokerCarouselLayout;
(window as any).uiJokerCarouselNavNext = uiJokerCarouselNavNext;
(window as any).uiJokerCarouselNavPrev = uiJokerCarouselNavPrev;
(window as any).uiSetJokerCarouselActiveCard = uiSetJokerCarouselActiveCard;
(window as any).uiClickJokerCarouselCard = uiClickJokerCarouselCard;
(window as any).handleJokerStageClick = handleJokerStageClick;
(window as any).uiMoveJokerInCarousel = uiMoveJokerInCarousel;
(window as any).uiSellJokerInCarousel = uiSellJokerInCarousel;
(window as any).getCurrentJokerCarouselIndex = () => currentJokerCarouselIndex;
(window as any).uiBuyShopItem = uiBuyShopItem;
(window as any).uiBuyPack = uiBuyPack;
(window as any).uiChoosePackOption = uiChoosePackOption;
(window as any).uiSkipPack = uiSkipPack;
(window as any).renderPackOpeningScreen = renderPackOpeningScreen;
(window as any).uiPackNavNext = uiPackNavNext;
(window as any).uiPackNavPrev = uiPackNavPrev;
(window as any).uiSetPackActiveCard = uiSetPackActiveCard;
(window as any).uiClickPackCard = uiClickPackCard;
(window as any).uiSkipPackAnimation = uiSkipPackAnimation;
(window as any).handlePackStageClick = handlePackStageClick;
(window as any).getCurrentPackCardIndex = () => currentPackCardIndex;
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
(window as any).isPlayfieldLocked = () => isPlayfieldLocked;
(window as any).setPlayfieldLocked = setPlayfieldLocked;
(window as any).openLibraryModal = openLibraryModal;
(window as any).closeLibraryModal = closeLibraryModal;
(window as any).openLibraryCategory = openLibraryCategory;
(window as any).switchLibraryCategory = switchLibraryCategory;
(window as any).showLibraryCategories = showLibraryCategories;
(window as any).handleLibraryBack = handleLibraryBack;
(window as any).setLibraryJokerFilter = setLibraryJokerFilter;
(window as any).renderLibraryItems = renderLibraryItems;
(window as any).openLibraryDetail = openLibraryDetail;
(window as any).closeLibraryDetail = closeLibraryDetail;
(window as any).getItemTelemetryStats = getItemTelemetryStats;
(window as any).CARD_EFFECTS_CATALOG = CARD_EFFECTS_CATALOG;

/* ==========================================================
   BOOT
========================================================== */
$('ui-table-felt').addEventListener('click', () => {
  if (isPlayfieldLocked) return;
  const s = getState();
  if (!s.inHand && s.isDealing) {
    skipScoringAnimation = true;
  }
});

startNewRun();
