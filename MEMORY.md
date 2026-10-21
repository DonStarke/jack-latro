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
* Active Hand Tiers (Chips x Mult, before card/joker bonuses): 5-Card Charlie (5+ cards, not bust) 160 x 5; Natural Blackjack 120 x 4; Exact 21 (win) 75 x 3; Win 40 x 2; Push 25 x 1; Loss/Bust 0. Dealer natural vs player natural = Push. Double Down = final mult x2.
* Rebalanced Outlier Jokers (Telemetry-Driven):
  * Daredevil ($6): +1 Mult permanently on safe Hit on 15+ (down from +1 on 14 / +2 on 16).
  * Chip Stacker ($5): +10 Chips permanently on Double Down or Exact 21 win (down from +30).
  * Compound Edge ($6): +10 Chips for every $5 held, capped at +150 Chips (down from uncapped +20 per $5).
  * Push It Good ($5): Ties count as Wins and grant +50 Chips & +4 Mult; removed passive unconditional +30 Chips on all hands.
  * Safety Net ($5): Busting scores a salvage of 40 Chips × 2 Mult. Crucially, other Jokers, card enhancements, and Double Down are disabled on a bust to prevent 1-hand blind clears on busts.
* Passive Systems:
  * Blind structure: 8 Antes x 3 Blinds + Endless Mode. Targets `[300, 600, 1200, 2400, 4500, 8500, 15000, 25000]` x (1.0 / 1.45 / 2.0 for Small/Big/Boss). Boss rotates by ante.
  * Economy: start $6; blind reward $4/$5/$6 (Small/Big/Boss); +$1 per unused deal (capped at 6); interest $1 per $5 held, max $5; reroll starts $2; Gold card +$3 on score; Gold Parachute +$3 on dealer bust; BJ Tycoon +$2.
  * Vouchers: Extra Cushion (+1 deal), Table Leverage (+1 base mult on win/push), VIP Lounge (+1 joker slot), High Stakes Table (+30 base chips), High Roller Credit (interest cap $8), Precision Edge (+30c/+2m on Natural/Exact21).

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
  * Blind structure: 8 Antes x 3 Blinds + Endless Mode (Ante 9+ scaling). Targets `[300, 600, 1200, 2400, 4500, 8500, 15000, 25000]` x (1.0 / 1.45 / 2.0 for Small/Big/Boss), then scaled by $1.6^{\text{ante}-8}$ in endless mode.
  * Config (`balanceConfig`): startingDeals 7, targetScalePct 50, unusedDealCashCap 1, pushRefundsDeal true, anteHandScaling true.

## 🛠️ Last Modification & Structural Changes
* **Splash Screen Main Menu**: Created interactive splash overlay with glowing 3D fanned cards (Jack of Spades + Ace of Spades) featuring foil/holo sweep shimmer, floating neon suit particles, and options for "New Game" and "Settings".
* **Defeat / Run Over Flow**: Added dedicated defeat modal with run recap statistics and two clear options: "New Game" and "Main Menu".
* **Ante 8 Conquered Victory Flow**: Upon conquering Ante 8 Boss, the game pauses for 1.5 seconds allowing the final hand scoring to be appreciated, then launches festive confetti, starts a synthesized WebAudio Victory Music Loop (`startVictoryMusic()`), and opens the Victory Modal with three options: "Continue into endless", "New Game", and "Main Menu".
* **Endless Mode**: Full progression beyond Ante 8 with scaled blind targets and HUD updates (`Ante X (Endless)`).
* **Hand Outcome Sound Timing & Mapping**: Moved outcome sound dispatch to execute immediately after cards/dealer are settled, before the scoring animation cascade starts. Mapped outcomes: player win -> uplifting chime, push -> level neutral two-tone marimba ping (even when scoring), bust/loss -> fail/defeat sounds.
* Catalog Expansion & Rarity System (Stages 1 & 2 Completed):
  * **35 Jokers across 3 Rarities:**
    * **Rare (10% weight, 6 Jokers):** `The Shark`, `Blackjack Tycoon`, `Minimalist`, `Double or Nothing`, `Card Sharp`, `Deja Vu`.
    * **Uncommon (30% weight, 11 Jokers):** `Daredevil`, `Chip Stacker`, `Compound Edge`, `Bust Cushion`, `Push It Good`, `Safety Net`, `Hot Hand`, `Snake Eyes`, `Monochrome`, `Pocket Rockets`, `Sweet Sixteen`.
    * **Common (60% weight, 18 Jokers):** `Card Counter`, `Even Steven`, `Odd Ball`, `The Grinder`, `Loan Shark`, `Golden Parachute`, `VIP High Roller`, `Ace Up Sleeve`, `Lucky Sevens`, `Hit Me Baby`, `Red Velvet`, `Dark Knight`, `Spade Slicer`, `Crimson Heart`, `Diamond Cutter`, `Club Sandwich`, `Trips Ahoy`, `Slow & Steady`.
  * **10 Tarots:** The Magician, The Empress, The Wheel, The Tower, The Guillotine, Card Forge, Prism Dye, Lucky Charm, Wild Suit (The Fool/Chameleon).
  * **10 Vouchers:** Extra Cushion, Table Leverage, VIP Lounge, High Stakes Table, High Roller Credit, Precision Edge, Clearance Rack, Liquid Assets, Card Sharp License, Overstock Shelves.
  * **Rarity Visuals & Shop Integration:** `rollWeightedJoker()` in `shopEngine.ts` & `simulator.ts`; `.rarity-badge`, `.rarity-common`, `.rarity-uncommon`, `.rarity-rare` across shop items, inventory mini-cards, and inspector modals. Leaderboard telemetry outputs exact rarity column.
  * **Monte Carlo Baseline (1,000 Runs):** Smart Synergy 36.2%, Charlie 34.9%, Basic 24.8%, High-Roller 20.3%, Vanilla 0.0%. Rares offered ~500 times vs Commons ~1,000 times. All automated suites (30/30 new features, 21/21 UI smoke) passing cleanly.
* Rescaled Target Curve & Expert Bot (Stages 3 & 4 Completed):
  * **Rescaled ANTE_TARGETS:** `[300, 600, 1200, 2400, 4500, 8500, 15000, 25000]`. Eliminates mid-to-late Ante 1-deal blind sweeps; average deals used scales cleanly from 3.1 in Ante 4 up to 8.5 in Ante 8.
  * **Expert Strategy Bot Added:** Full AI model in `simulator.ts`, `Jack-latro6Sim.html`, and UI with Clearance Rack-aware rerolls, compound interest thresholds ($5/$15/$25), target-aware standing, and proactive tarot deck modification (Guillotine thinning, Card Forge rank ups, Foil/Holo/Poly enhancements).
  * **Verified Benchmarking:** 5,000-run simulation and 6-bot comparative suite (`jack-latro-stage4-telemetry-suite.txt`) executed. 53/53 new features and 21/21 UI smoke tests pass cleanly. All 4 Roadmap stages 100% complete!
* **Compendium & Archives Library System**:
  * **Main Screen Integration:** Added `VIEW LIBRARY` button on the main/intro splash screen (`#btn-splash-library`) and in-game cog settings menu (`#btn-modal-library`).
  * **Interactive Categories Landing Page:** Allows player to choose from 5 categories: Jokers (35), Tarots (10), Vouchers (10), Card Effects (4: Foil, Holo, Poly, Gold), and Booster Packs (4: Joker, Tarot, Card, Variety).
  * **Category Items Grid:** Dedicated browsable views for each category with rarity filtering for Jokers (All/Common/Uncommon/Rare), full item descriptions, cost, badges, and artwork.
  * **Enlarged Center Stage & Stat Telemetry Inspection:** Clicking any item opens an enlarged detail modal centered on the screen with full visuals, archetype/rarity badges, game strategy tips, and a structured lifetime telemetry stats panel prepared for future stat tracking.
  * **Automated Verification:** Added `tests/library.test.js` validating all 97 checks across navigation, categories, zoom modals, and placeholder stats. All suites passing cleanly.
* **Booster Pack Opening Animation & 3D Carousel Showcase**:
  * **Tactile Shake & Pop Reveal Animation:** Foil booster wrapper styled to pack archetype (Joker, Tarot, Playing Card, Variety) with crimped metallic ridges, sweeping holographic sheen, energetic 420ms anticipation rumble/shake, a synthesized WebAudio foil rip + resonant pop burst chime (`playPackRipPopSound`), radiant flash ring (`#ui-pack-burst-flash`), and cards bursting into view. Tap-to-skip supported for rapid opening.
  * **Large Un-Squashed Card Stage:** Replaced side-by-side cramped 3-card layout (which squeezed cards into 110px) with full-sized 255px x 375px cards featuring generous typography, dedicated icon/art showcase box, clear archetype/rarity badges, and prominent selection buttons.
  * **3D Depth-Stacked Carousel (Coverflow):** First card is displayed front-and-center in large format. The other 2 cards appear staggered to the right in the background (scaled down to 0.84x and 0.70x, dimmed, with depth perspective). Scrolling smoothly slides cards with 3D transforms (`translateZ`, `rotate`, `scale`).
  * **Bi-Directional Gestures & Multi-Input Navigation:**
    * **Touch Swipes:** Horizontal swipe gestures (`touchstart`, `touchend`) to flick back and forth between cards.
    * **Screen Sides Click & Tap:** Floating glass chevrons (`#btn-pack-prev`, `#btn-pack-next`) and tap zones on left/right screen sides.
    * **Direct Background Card Click:** Tapping any background card immediately glides it into front focus.
    * **Pagination Dots & Counter:** Interactive pagination dots (`● ○ ○`) and dynamic counter (`Card 1 of 3`).
    * **Keyboard Controls:** Left and right arrow keys scroll cards.
  * **Automated Verification:** Added `tests/pack-carousel-animation.test.js` validating all 38 checks across DOM elements, initial 3D positions, bi-directional navigation, card focus transitions, and inventory additions. All 9 test suites passing 100%.
* **Quality of Life, Settings, Sound & Visual Polish**:
  * **Default Fastest Game Speed**: Initialized `scoringSpeedMultiplier` to 1.00 (fastest / brisk speed) and marked `1.00× (Brisk / Original)` as selected by default in `#setting-anim-speed` and `#ui-lbl-anim-speed`.
  * **Joker Icons Replaced**: Replaced missing glyphs (tofu boxes) with universally supported emojis:
    * `Bust Cushion`: `🛡️` (Shield)
    * `Chip Stacker`: `💰` (Money Bag)
    * `Ace Up Sleeve`: `🎴` (Flower Playing Card)
    * Also updated Gold enhancement icon to `💰`.
  * **Clean Joker Rarity Borders**: Removed left border suit overrides (`border-left: 3px solid #f43f5e;` and `border-left: 3px solid #38bdf8;`) from suit-themed jokers so that full uniform rarity borders display cleanly without broken left stripes.
  * **Compendium Category Tabs Alignment**: Converted `.lib-tab-btn` to `display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-family: inherit; line-height: 1;` so all compendium tabs have proper sizing, centered vertical alignment, and matching pill aesthetics.
  * **Audio Settings & Dual Volume Sliders**:
    * Added comprehensive Sound & Audio panel in the settings modal with volume sliders for both Sound Effects (`#setting-sfx-volume`) and Background Music (`#setting-music-volume`) with live percentage labels.
    * Added dedicated Sound Effects mute button (`#btn-modal-sfx-toggle`) next to Background Music mute button.
    * Integrated `sfxMasterGain` bus in `src/uiFx.ts` controlling all sound effects, and persisted volume settings to `localStorage`.
  * **Shop Booster Pack Wrappers & Slower Anticipation Shake**:
    * Transformed shop booster packs to match the opening animation styling: metallic crimps top and bottom, foil sheen sweep, archetype badges, large icons, titles, taglines, and action buttons.
    * Converted `#ui-shop-packs` into a smooth horizontal scroll container (`overflow-x: auto`) to accommodate the booster pack wrappers.
    * Slowed down the initial pack anticipation shake rumble to 25% speed (2.6s duration) with synchronized foil rip and pop burst audio.
  * **Automated Verification**: Added `tests/settings-sound-packs.test.js` validating all 36 checks across speed, icons, borders, tabs, audio sliders/mutes, and shop pack wrappers. All 11 test suites passing 100%.
* **Starting Rules & Monte Carlo Balance Lab Calibration**:
  * **Starting Target Score Scaling**: Set default starting `targetScalePct` to `50` (50% target scaling). Ante 1 Small Blind starts at 150 (down from 300) and Big Blind starts at 218.
  * **Starting Unused Deal Cash Cap**: Set default starting `unusedDealCashCap` to `1` ($1 per blind clear for unused deals).
  * **Monte Carlo Balance Lab Slider Range Expansion**: Modified `#sim-dealcap` range input from `min="2"` to `min="1"` so players can configure and test a $1 deal cash cap directly in the Balance Lab. Initialized both `#sim-dealcap` and `#sim-scale` default values to $1 and 50% respectively.










