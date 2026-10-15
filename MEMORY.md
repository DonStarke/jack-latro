# 🗃️ JACK-LATRO GLOBAL SYSTEM LOG

## 🧩 Active Codebase Map
* `index.html` - PLAYABLE shell (293 lines): original head + `<link styles.css>` + original body markup + script tags in order gameState, deckEngine, modifierEngine, shopEngine, simulator, uiFx, main (all `dist/*.js`). Only markup change vs original: Reroll button now calls `uiRerollShop()`.
* `styles.css` - CREATED (909 lines): verbatim copy of the original inline `<style>` block (orig L8-916); now linked by `index.html`.
* `gameState.ts` (src/) - compiles clean to dist/gameState.js (plain global script): shared types (Card, JokerInstance, ShopSlot types, BalanceConfig, GameState) + private `_state`/`_balanceConfig`/`_nextCardUid` with API: getState/getBalanceConfig/hasJoker, patchState/patchBalanceConfig, addMoney/spendMoney/addRoundScore, deck/shoe/hand setters, joker add/remove/move/patch, consumable/voucher/shop setters, takeNextCardUid/resetCardUid, setCardRank/addCardToShoe/markShopItemBought, resetRunState(freshDeck). Fields mirror original `state` + `balanceConfig` 1:1.
* `deckEngine.ts` (src/) - Logic-tested. Deck/shoe (`createStandardDeck`, `shuffle`, `buildShoeFromDeck`, `drawFromShoe`), `getCardChipValue` (Pit Boss: faces = 0), `evaluateBlackjackTotal` (soft aces, Bust Cushion 22->21), `evaluatePlayerHand`, plus Hand Tier logic: `HAND_TIERS` table and pure `classifyHand()` (BUST/CHARLIE/NATURAL/EXACT21/WIN/PUSH/LOSS, The House tie rule).
* `modifierEngine.ts` (src/) - Catalogs (19 Jokers, 4 Tarots, 4 Vouchers, 4 Boss Blinds; note 19th joker count corrected) + the ONE pure `scoreHand(ctx: ScoreContext): ScoreResult` (Safety Net, Push It Good, Chip Stacker scaling, ante hand scaling, per-card enhancements, all joker effects, Double Down). Returns animatable `steps[]`, `logs`, `moneyGained`, `chipStackerNewBonus`; never touches state/DOM. Tarot USE effects, Daredevil on-Hit scaling, and voucher application are NOT extracted yet.
* `shopEngine.ts` (src/) - Tested. Economy + shop + blind progression, UI-free (actions return result objects): `computeBlindTarget/Boss`, `computeBlindPayout` (blind reward $4/5/6, unused-deal cash capped by config, interest $1 per $5 max $5), `cashOutAndEnterShop` (pays out, advances blind/ante, resets reroll to $2, generates stock), `generateShopStock`, `rerollShop`, `buyShopItem` (joker/tarot/card/voucher), `applyVoucher`, `sellJoker` (half cost, min $1), `sellConsumable` ($1), `useConsumable` (4 Tarots), `configureBlindMetrics`, `beginBlindState`, `startNewRunState`.
* `simulator.ts` (src/) - Validated. Data + report text only (no DOM): `decideBotAction`, `scoreJokerPriorityForBot`, `simulateShopVisit`, `runBatchSimulationForBot(numRuns, botType, cfg)` (5 bots: vanilla/basic/synergy/highroller/charlie; 24-blind stats, outcome counters, joker/voucher stats), `formatBotReportSection`, `buildSingleBotReport`, `runBotSuite`. Uses shared `scoreHand`, `computeBlindTarget/Boss`, `calcBlindPayout`, `getVoucherDeltas`, catalogs. Never reads/writes live gameState. Sim DOM glue now lives in `main.ts`.
* uiFx.ts + main.ts (src/) - EXTRA files beyond the original seven (designer-approved layout kept the engines pure): uiFx.ts = confetti, WebAudio sounds, sleep (ported verbatim, typed). main.ts = ALL DOM/UI: render functions (updateAllUI, enderShop, modals, inspectors, sim results), animated flow (dealHand, playerHit/Stand/Double, esolveRound replays scoreHand().steps), ui* wrappers over engine actions (uiBuyShopItem, uiRerollShop, uiSellJoker, uiMoveJoker, uiSellConsumable, uiUseConsumable, uiCashOut), sim-lab buttons, boot (startNewRun() at file end). Holds no rules and no state; reads getState() only.

## 📈 Current Mechanical Systems Balance
* Active Hand Tiers (Chips x Mult, before card/joker bonuses): 5-Card Charlie (5+ cards, not bust) 160 x 5; Natural Blackjack 120 x 4; Exact 21 (win) 75 x 3; Win 40 x 2; Push 25 x 1; Loss/Bust 0 (Safety Net: Bust = 50 x 2). Dealer natural vs player natural = Push. Double Down = final mult x2.
* Passive Systems:
  * Blind structure: 8 Antes x 3 Blinds. Targets `[300,600,1100,1800,2900,4500,7000,10500]` x (1.0 / 1.45 / 2.0 for Small/Big/Boss). Boss rotates by ante.
  * Config (`balanceConfig`): startingDeals 7, targetScalePct 100, unusedDealCashCap 6, pushRefundsDeal false, anteHandScaling false (if on: +15% per ante to tier base values).
  * Economy: start $6; blind reward $4/$5/$6 (Small/Big/Boss); +$1 per unused deal (capped at 6); interest $1 per $5 held, max $5; reroll starts $2; Gold card +$3 on score; Gold Parachute +$3 on dealer bust; BJ Tycoon +$2.
  * Card chips: per `getCardChipValue` (Pit Boss boss zeroes face cards); Foil +30 chips, Holo +4 mult, Poly x1.5 mult.
  * Scaling jokers: Daredevil (+3 mult per safe Hit on 14+), Chip Stacker (+15 chips per Double-Down win).
  * Vouchers: Extra Cushion (+1 deal), Table Leverage (+1 base mult on win/push), VIP Lounge (+1 joker slot), High Stakes Table (+30 base chips).
  * Boss Blinds: The House (pushes lose unless Push It Good), The Pit Boss (faces = 0 chips), The Cooler (-1 deal), The Anchor (no double).
  * Consumables (max 2): X-Ray Specs, Loaded Ace, Card Shave, Midas Touch.

## 🛠️ Last Modification & Structural Changes
* Created `src/uiFx.ts` (original L1209-1381) and `src/main.ts` (render blocks L1408-1433, 1563-1572, 1785-1806, 2235-2305, 2349-2609, 2614-2653, 3271-3387 extracted programmatically then typed, plus hand-written flow). Inside render functions a local `const state = getState();` shadows the old global, so template code is unchanged; writes were rewritten to engine/state APIs (`applySimConfigToLiveGame` now uses `patchBalanceConfig`).
* Naming: UI wrappers are `ui*` because all scripts share one global scope (engine `rerollShop/buyShopItem/sellJoker/...` must not collide). Inline `onclick` strings in templates and the Reroll button were renamed accordingly.
* `resolveRound` now calls the pure `scoreHand()` and animates `result.steps`; cash earned during scoring (Gold cards, Parachute, Tycoon) is added after the animation but BEFORE the payout is computed (original added it mid-animation; only the on-screen money tick timing differs).
* Type-only fixes while compiling: `String(...)` around numeric `textContent` (3 places) and `!!anchorBoss` for a boolean|null. No behavior change.
* Tooling: added `jsdom` devDependency and `tests/ui-smoke.js` (headless: boots index.html, real button clicks through deal/hit/stand/win/cash-out/shop buy+reroll/next blind, deck+blind modals, sim lab run, apply-to-game, new run). Run: `node tests\ui-smoke.js`.
* Validation: `tsc` exits 0. Smoke test: 21/21 checks pass with zero script/console errors, including the win path (confetti, cash out, shop). NOT yet verified: look/feel and audio in a real browser, joker/tarot inspector clicks (their engine logic is unit-tested).
* Earlier: all engines + simulator validated vs original (scoring differential test 60k hands; sim win rates within noise), tsconfig `module: es2020`, Node v24 (`npm.cmd`/`npx.cmd`). `Jack-latro6Sim.html` untouched as reference.

## 🏁 Immediate Roadmap & Next Strategic Goals
1. Designer playtest of `index.html` in a real browser (visuals, audio, animations, inspectors); report anything that looks or plays differently from `Jack-latro6Sim.html`.
2. After sign-off, retire `Jack-latro6Sim.html` (or keep as archive), then begin new feature design work on top of the modular codebase.

---








