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
* Rebalanced Outlier Jokers (Telemetry-Driven & Composition Overhaul):
  * **Runaway Carries Nerfed:**
    * `Fortune Teller` ($6, moved to Uncommon): +6 Chips & +1 Mult per Tarot/Cheat used, capped at +60 Chips / +10 Mult max (down from uncapped +15c/+2m).
    * `Bad Beat Jackpot` ($6): +1 Mult permanently capped at +10 Mult max and +$2 Cash on non-bust loss (down from uncapped mult and +$4 cash).
    * `Card Sharp` ($8): ×1.5 Mult on 2nd+ win in blind (down from ×1.75).
    * `BJ Tycoon` ($8): ×1.6 Mult on 21 or Natural BJ (down from ×2.0).
    * `The Shark` ($8): ×1.35 Mult on margin ≥ 3 or dealer bust (down from ×1.5).
  * **Underpowered Jokers Revived:**
    * `Tightrope Walker` ($6): Now triggers on 19, 20, 21, or 22 with +80 Chips & +8 Mult.
    * `Momentum` ($5): +25 Chips & +3 Mult baseline on a Win, plus +30 Chips & +4 Mult for each prior win in blind (stacks up to +145c/+19m).
    * `Safety Net` ($5): Bust salvage scales with Ante: `(40 × Ante) Chips × 2 Mult`.
    * `Kaleidoscope` ($5): Triggers on 2 different suits (+40c/+4m) and scales to +90c/+8m for 3+ suits.
    * `Pocket Rockets` ($6): Triggers on starting hand containing an Ace (+30c/+8m), doubled to +75c/+20m for Pair of Aces.
    * `Trips Ahoy` ($5): Triggers if winning with 3+ cards totaling 19-21 (+60c/+8m), doubled to +120c/+15m for 3-of-a-Kind.
    * `Side Bet` ($5): Starting Pair earns +$5 Cash & +50 Chips (+$10/+$100 for color pair); starting Suited cards earn +$2 Cash & +25 Chips.
    * `Card Counter` ($4): +45 Chips & +2 Mult per low card (2-6).
    * `Even Steven` ($4): +15 Chips & +5 Mult per even card.
    * `Odd Ball` ($4): +20 Chips & +4 Mult per odd card.
    * `Red Velvet` ($5): +35 Chips & +2 Mult per ♥ or ♦.
    * `Dark Knight` ($5): +15 Chips & +4 Mult per ♠ or ♣.
    * `Blowout` ($5): +25 Chips & +3 Mult per margin point over dealer.
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
  * Blind structure: 8 Antes x 3 Blinds + Endless Mode (Ante 9+ scaling). Strictly monotonic targets `[300, 540, 960, 1720, 3050, 5450, 9700, 17200]` x (1.0 / 1.35 / 1.7 for Small/Big/Boss), then scaled by $2.2^{\text{ante}-8}$ in endless mode. A1 Boss ($255$) < A2 Small ($270$), eliminating prior target ties.
  * Config (`balanceConfig`): startingDeals 7, targetScalePct 50, unusedDealCashCap 0 (default $0 cash per unused deal), pushRefundsDeal true, anteHandScaling true.
  * Economy: start $6; blind reward $4/$5/$6 (Small/Big/Boss); interest $1 per $5 held, max $5 (requires $25 saved, or $50 with High Roller, $100 with High Roller 2); shop reroll starts at $3 (reduced to $2 by Clearance Rack, $1 by Clearance Rack 2); shop starts with 1 booster pack (increased to 2 by Overstock Shelves, 3 by Overstock Shelves 2).
  * Vouchers (10 Total with Prerequisite Progression Trees):
    * `Blank Voucher` ($10) -> Unlocks `VIP Lounge Pass` (+1 Max Joker Slot).
    * `Extra Cushion` ($10, +1 Deal) -> Unlocks `Extra Cushion 2` ($10, +1 additional Deal).
    * `Clearance Rack` ($10, Rerolls start at $2) -> Unlocks `Clearance Rack 2` ($10, Rerolls start at $1).
    * `Overstock Shelves` ($10, 2 pack slots) -> Unlocks `Overstock Shelves 2` ($10, 3 pack slots).
    * `High Roller` ($10, max interest $10 on $50 saved) -> Unlocks `High Roller 2` ($10, max interest $20 on $100 saved).
    * (Removed: Liquid Assets, Table Leverage, High Stakes Table, Precision Edge, Card Sharp License).

## 🛠️ Last Modification & Structural Changes
* **Splash Screen Main Menu**: Created interactive splash overlay with glowing 3D fanned cards (Jack of Spades + Ace of Spades) featuring foil/holo sweep shimmer, floating neon suit particles, and options for "New Game" and "Settings".
* **Defeat / Run Over Flow**: Added dedicated defeat modal with run recap statistics and two clear options: "New Game" and "Main Menu".
* **Ante 8 Conquered Victory Flow**: Upon conquering Ante 8 Boss, the game pauses for 1.5 seconds allowing the final hand scoring to be appreciated, then launches festive confetti, starts a synthesized WebAudio Victory Music Loop (`startVictoryMusic()`), and opens the Victory Modal with three options: "Continue into endless", "New Game", and "Main Menu".
* **Endless Mode**: Full progression beyond Ante 8 with scaled blind targets and HUD updates (`Ante X (Endless)`).
* **Hand Outcome Sound Timing & Mapping**: Moved outcome sound dispatch to execute immediately after cards/dealer are settled, before the scoring animation cascade starts. Mapped outcomes: player win -> uplifting chime, push -> level neutral two-tone marimba ping (even when scoring), bust/loss -> fail/defeat sounds.
* Catalog Expansion & Rarity System (Stages 1, 2 & Content Expansion to 52 Jokers):
  * **51 Jokers across 3 Rarities:**
    * **Rare (10% weight, 10 Jokers):** `The Shark`, `Blackjack Tycoon`, `Minimalist`, `Double or Nothing`, `Card Sharp`, `Deja Vu`, `Rain Man`, `The Spotter`, `Crown Jewel`, `The Banker`.
    * **Uncommon (30% weight, 17 Jokers):** `Daredevil`, `Chip Stacker`, `Compound Edge`, `Bust Cushion`, `Push It Good`, `Safety Net`, `Hot Hand`, `Snake Eyes`, `Monochrome`, `Pocket Rockets`, `Sweet Sixteen`, `Street Magician`, `Marked Deck`, `The Bullseye`, `Push the Limit`, `Bad Beat Jackpot`, `Tightrope Walker`.
    * **Common (60% weight, 24 Jokers):** `Card Counter`, `Even Steven`, `Odd Ball`, `The Grinder`, `Golden Parachute`, `VIP High Roller`, `Ace Up Sleeve`, `Lucky Sevens`, `Hit Me Baby`, `Red Velvet`, `Dark Knight`, `Spade Slicer`, `Crimson Heart`, `Diamond Cutter`, `Club Sandwich`, `Trips Ahoy`, `Slow & Steady`, `Fortune Teller`, `Blowout`, `Bounty Hunter`, `Small Fry`, `Kaleidoscope`, `Momentum`, `Side Bet`.
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
  * **Modern Simulation Architecture Overhaul & Clean Rebuild**:
  * **Legacy Monolith Archival**: Safely archived legacy `Jack-latro6Sim.html` into `archive/Jack-latro6Sim.html`, eliminating redundant code divergence.
  * **Zero-Drift Modular Simulator**: Rebuilt `src/simulator.ts` to seamlessly integrate with all modern systems:
    * **Full Shop Shelf Coverage**: Bots now evaluate and buy both single Jokers and single Tarots from the shelf, ending the prior blind spot where shelf Tarots were ignored.
    * **Comprehensive Tarot & Cheat Support**: Properly models in-hand Cheats (`x_ray`, `loaded_ace`, `double_vision`) and permanent deck Tarots (`the_guillotine`, `card_forge`, `card_shave`, `polychrome_dice`, `lucky_charm`, `wild_suit`, `midas_touch`, `the_lovers`, `the_sun`, `the_star`, `the_moon`, `the_world`, `judgement`, `nostradamus`).
    * **Archetype-Driven Bot AI**:
      * `vanilla`: Mathematical basic strategy benchmark (no meta purchases).
      * `basic`: Standard basic strategy with opportunistic Joker/Tarot purchases.
      * `charlie`: Aggressive 5-card Charlie specialist, hits <= 15, prioritizes low-rank Jokers and Card Shave / Guillotine.
      * `highroller`: High-Roller 21 specialist, aggressive doubling, prioritizes face cards and Card Forge.
      * `synergy`: Adaptive combo builder, leans into owned Joker synergies (Bust Cushion, Daredevil, Chip Stacker, Sweet 16, Snake Eyes, Deja Vu).
      * `expert`: Optimal tournament AI with tempo-first early game bankroll, deck sculpting, XMult positioning, and Clearance Rack rerolls.
  * **Automated Verification**: All 17 test suites (500+ unit and integration checks) passing 100%.
* **Endless Mode Bot Simulation & Comprehensive Telemetry Expansion (v1.8)**:
  * **Endless Mode Simulation with Strict Safeguards**:
    * Outer simulation loop now supports configurable `maxEndlessAnte` from Ante 8 (Campaign) up to Ante 24 (Endless), with a hard internal circuit-breaker ceiling of Ante 30.
    * Integrated dual anti-infinite safeguards: max 30 deals per blind and max 300 hands per run, preventing infinite push-refund or card loops.
    * Tracks `highestAnteReached`, `endlessStats` (Ante 9+ entered, cleared, survival %, scaling deaths vs cold shoe deaths).
  * **Full Tarot & Battle Cheat Telemetry (`consumableStats`)**:
    * Tracks offered, bought, timesUsed, runsWithItem, runsWonWithItem, win rate lift % vs baseline, avg death ante, and tactical impacts (cards pruned by Guillotine, ranks forged/shaved, poly/holo/foil/gold editions created, X-Ray bonus chips, Loaded Aces summoned, Double Vision 2x mults).
  * **Extended Voucher Telemetry**:
    * Tracks offered, bought, buy rate %, run win rate when bought, win rate lift %, and average ante purchased.
  * **New Interactive Configuration Sliders**:
    * Added **Endless Mode Max Depth** slider (`#sim-endless`: Ante 8 to 24, default Ante 16).
    * Added **Starting Cash** slider (`#sim-start-cash`: $4 to $20, default $6).
    * Added **Max Joker Slots** slider (`#sim-joker-slots`: 3 to 7 slots, default 5).
    * Added **1,000 Runs** fast preset to `#sim-runs`.
    * Clarified Target Score Scaling label with `(Normal 50%)`.
  * **Tabbed Results Modal**:
    * Converted simulation results area into 5 responsive glassmorphic tabs:
      1. `📊 KPI Overview`: 4 KPI cards (Win Rate, Peak Endless Ante, Avg Death Ante, BJ Hand Win %), Packs Opened/Rerolls, Ante Survival Funnel (1..maxEndlessAnte), Cause of Death Diagnostic.
      2. `🃏 Jokers`: Full leaderboard with Rarity, Cost, Times Held, Run Win %, Win Lift %, Avg Ante.
      3. `🔮 Tarots & Cheats`: Leaderboard with Type badge, Offered, Bought, Used, Runs, Win %, Win Lift %, Avg Ante, Tactical Impact.
      4. `🎟️ Vouchers`: Leaderboard with Offered, Bought, Buy Rate %, Win %, Win Lift %, Avg Ante Bought.
      5. `♾️ Endless Depth`: Peak Ante banner, Ante 9+ progression table with targets, survival %, and scaling wall bottlenecks.
  * **Automated Verification**:
    * Added `tests/endless-simulation-and-stats.test.js` validating all 48 checks across DOM sliders, parsing, endless loop progression, safeguards, consumable telemetry, voucher extensions, tab navigation, and report formatting.
    * All 18 test suites passing 100%.










