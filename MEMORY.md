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

* `index.html` - PLAYABLE shell: includes `#ui-splash-screen` (animated card fan, foil/holo shimmer, floating suits, New Game, Settings), `#ui-defeat-modal` (New Game, Main Menu), `#ui-victory-modal` (Continue into Endless, New Game, Main Menu), updated `#ui-cog-modal` with Main Menu button.
* `styles.css` - Full styling and keyframe animations for Splash Screen, floating suits, Defeat Modal, and Ante 8 Victory Modal.
* `gameState.ts` - Added `endlessMode` state flag.
* `shopEngine.ts` - Updated `computeBlindTarget` with smooth exponential scaling for Ante > 8 (Endless Mode).
* `uiFx.ts` - Refined hand outcome tones (bright win chime, level neutral push marimba ping, loss defeat tone, bust low buzz/thump); synthesized WebAudio upbeat Fanfare Victory Music loop (`startVictoryMusic()` / `stopVictoryMusic()`); updated music UI synchronization.
* `main.ts` - Immediate hand outcome sound dispatch at round resolution start before scoring cascade; Ante 8 boss celebration flow with score reveal pause, victory music loop, and victory modal; defeat screen flow with run stats and options; endless mode continuation and HUD formatting; main menu navigation.
* `tests/new-features.test.js` - Automated suite validating splash screen, defeat flow, victory flow, endless mode, and immediate sound mappings (30/30 checks pass).

## 📈 Current Mechanical Systems Balance
* Active Hand Tiers (Chips x Mult, before card/joker bonuses): 5-Card Charlie (5+ cards, not bust) 160 x 5; Natural Blackjack 120 x 4; Exact 21 (win) 75 x 3; Win 40 x 2; Push 25 x 1; Loss/Bust 0 (Safety Net: Bust = 50 x 2). Dealer natural vs player natural = Push. Double Down = final mult x2.
* Passive Systems:
  * Blind structure: 8 Antes x 3 Blinds + Endless Mode (Ante 9+ scaling). Targets `[300,600,1100,1800,2900,4500,7000,10500]` x (1.0 / 1.45 / 2.0 for Small/Big/Boss), then scaled by $1.6^{\text{ante}-8}$ in endless mode.
  * Config (`balanceConfig`): startingDeals 7, targetScalePct 100, unusedDealCashCap 6, pushRefundsDeal true, anteHandScaling true.

## 🛠️ Last Modification & Structural Changes
* **Splash Screen Main Menu**: Created interactive splash overlay with glowing 3D fanned cards (Jack of Spades + Ace of Spades) featuring foil/holo sweep shimmer, floating neon suit particles, and options for "New Game" and "Settings".
* **Defeat / Run Over Flow**: Added dedicated defeat modal with run recap statistics and two clear options: "New Game" and "Main Menu".
* **Ante 8 Conquered Victory Flow**: Upon conquering Ante 8 Boss, the game pauses for 1.5 seconds allowing the final hand scoring to be appreciated, then launches festive confetti, starts a synthesized WebAudio Victory Music Loop (`startVictoryMusic()`), and opens the Victory Modal with three options: "Continue into endless", "New Game", and "Main Menu".
* **Endless Mode**: Full progression beyond Ante 8 with scaled blind targets and HUD updates (`Ante X (Endless)`).
* **Hand Outcome Sound Timing & Mapping**: Moved outcome sound dispatch to execute immediately after cards/dealer are settled, before the scoring animation cascade starts. Mapped outcomes: player win -> uplifting chime, push -> level neutral two-tone marimba ping (even when scoring), bust/loss -> fail/defeat sounds.
* **Testing & Build**: Built via `tsc` and `prepare-www.js` (syncing `www/` and `android/` assets). Both `ui-smoke.js` (21/21) and `new-features.test.js` (30/30) pass with zero errors.








