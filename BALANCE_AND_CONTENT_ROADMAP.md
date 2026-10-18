# 🃏 JACK-LATRO: BALANCE, CONTENT & SIMULATION UPGRADE ROADMAP
> **Purpose**: Master execution tracker for game balance, content expansion, rarity implementation, and expert simulation. If starting a new chat or continuing work, use this document to prompt the assistant with the exact active phase.
> *Note: This file can be safely deleted once all 4 stages are completed.*

---

## 🚦 Overall Status
- [x] **Phase 0: Outlier Joker Rebalance** (Completed & Verified)
  - Daredevil: +1 Mult on safe Hit on 15+ (down from +1/+2). Win rate 84% ➔ 60.8%, Avg Mult +18.9m ➔ +7.3m.
  - Chip Stacker: +10 Chips on Double/Exact21 win (down from +30). Win rate 77% ➔ 56.0%, Avg Chips +139c ➔ +55c.
  - Compound Edge: +10 Chips per $5 held, capped at +150 Chips (down from uncapped +20c/$5). Win rate 93% ➔ 61.6%.
  - Push It Good: Ties = Wins (+50c, +4m); removed passive +30c on all hands. Win rate 78% ➔ 45.6%.
  - Safety Net: Salvage 40c × 2m on bust; **disabled other jokers, enhancements, and double-down on bust**. Charlie win rate 83.5% ➔ 54.2%.
- [x] **Stage 1: Content Expansion** (Completed & Telemetry-Verified)
  - 16 New Jokers added (Catalog 19 ➔ 35): Hot Hand, Snake Eyes, Pocket Rockets, Trips Ahoy, Spade Slicer, Crimson Heart, Diamond Cutter, Club Sandwich, Monochrome, Odd Ball, The Grinder, Double or Nothing, Slow & Steady, Card Sharp, Loan Shark, Deja Vu.
  - 4 New Tarots added (Catalog 6 ➔ 10): The Guillotine (deck thinning), Card Forge (rank upgrade), Prism Dye (Foil), Lucky Charm (Holo).
  - 4 New Vouchers added (Catalog 6 ➔ 10): Clearance Rack ($1 rerolls), Liquid Assets (interest per $4), Card Sharp License (+1 deal, +20c), Overstock Shelves (+1 shop slot).
  - 1,000-run simulation verified: Synergy win rate naturally balanced to 40.8% and Charlie to 35.8% through catalog variety.
- [x] **Stage 2: Rarity System Integration** (Completed & Telemetry-Verified)
  - Assigned Common (60%), Uncommon (30%), Rare (10%) rarities across all 35 Jokers:
    - **Rare (6):** `The Shark`, `Blackjack Tycoon`, `Minimalist`, `Double or Nothing`, `Card Sharp`, `Deja Vu`.
    - **Uncommon (11):** `Daredevil`, `Chip Stacker`, `Compound Edge`, `Bust Cushion`, `Push It Good`, `Safety Net`, `Hot Hand`, `Snake Eyes`, `Monochrome`, `Pocket Rockets`, `Sweet Sixteen`.
    - **Common (18):** `Card Counter`, `Even Steven`, `Odd Ball`, `The Grinder`, `Loan Shark`, `Golden Parachute`, `VIP High Roller`, `Ace Up Sleeve`, `Lucky Sevens`, `Hit Me Baby`, `Red Velvet`, `Dark Knight`, `Spade Slicer`, `Crimson Heart`, `Diamond Cutter`, `Club Sandwich`, `Trips Ahoy`, `Slow & Steady`.
  - Implemented weighted rarity picker `rollWeightedJoker()` shared across `shopEngine.ts` and `simulator.ts`.
  - Added visual badges and rarity glowing borders in UI (`.rarity-badge`, `.rarity-common`, `.rarity-uncommon`, `.rarity-rare`) across shop item cards, inventory mini-cards, and inspector modals.
  - Added Rarity column to Monte Carlo telemetry leaderboard. Verified in 1,000-run simulation: Common jokers rolled ~1,000 times, Uncommons ~850 times, Rares ~520 times. Win rates well distributed (Smart Synergy 36.2%, Charlie 34.9%, Basic 24.8%, High-Roller 20.3%).
- [x] **Stage 3: Ante 4–8 Target Curve Rescaling** (Completed & Telemetry-Verified)
  - Rescaled `ANTE_TARGETS`: `[300, 600, 1200, 2400, 4500, 8500, 15000, 25000]`.
  - Updated `src/shopEngine.ts`, `Jack-latro6Sim.html`, `GAME_RULES_AND_MECHANICS.md`, and automated test suites.
  - Eliminated the 1-deal blind sweep in mid-to-late Antes. Verified in 1,000-run Monte Carlo simulations:
    - Average deals used per blind scaled smoothly from 3.1–4.1 in Ante 4 up to 6.7–8.5 in Ante 8, forcing deep shoe and hand execution.
    - Automated test suites (53/53 new features, 21/21 UI smoke) all passing cleanly.
- [x] **Stage 4: Expert AI Simulation & Telemetry Benchmarking** (Completed & Telemetry-Verified)
  - Added `expert` bot (`Expert Strategy AI`) across `simulator.ts`, `Jack-latro6Sim.html`, `main.ts`, and `index.html`.
  - Implemented expert systems:
    - Smart shop rerolls with Clearance Rack awareness ($1 rerolls).
    - Interest threshold management (preserving $5 / $15 / $25 caps while funding power spikes).
    - Target-aware standing & desperation hits/doubles (conservative when close to clear, aggressive on final deal).
    - Permanent deck optimization via Tarot auto-use (Guillotine thinning, Card Forge rank ups, Foil/Holo/Poly enhancements).
  - Executed 5,000-game Expert benchmark and 6,000-game (1,000 runs × 6 bots) comparative telemetry suite:
    - Successfully verified late-game progression, deck cycling, and balance curves under the rescaled Ante 4–8 targets.
    - Exported full benchmark report to `jack-latro-stage4-telemetry-suite.txt`.
    - All automated suites (53/53 new features, 21/21 UI smoke) passing with zero errors.

---

## 🏆 Final Roadmap Summary
All 4 core balance, content, rarity, and simulation milestones are 100% complete, fully implemented, and validated through extensive telemetry benchmarks.

## 📦 Stage 1: Content Expansion Details

### A. 16 New Jokers (Catalog expanding from 19 to 35)
1. **Hot Hand** ($5): Gains +2 Mult per consecutive winning hand (up to +20 Mult max). Resets to 0 on a loss or bust. *(Streak)*
2. **Snake Eyes** ($6, isXMult): ×2.2 Mult if you Win standing on a total of 13 or less. *(Risk/Low Total)*
3. **Pocket Rockets** ($6): +25 Mult & +50 Chips if your starting 2 cards are both Aces. *(Pair/Starting Hand)*
4. **Trips Ahoy** ($5): +100 Chips & +10 Mult if your hand contains three cards of the same rank. *(Sets)*
5. **Spade Slicer** ($5): +15 Chips & +5 Mult for each ♠ in hand on a scoring hand. *(Suit: Spades)*
6. **Crimson Heart** ($5): +40 Chips & +2 Mult for each ♥ in hand on a scoring hand. *(Suit: Hearts)*
7. **Diamond Cutter** ($5): +30 Chips & earn +$1 for each ♦ in hand on a Win. *(Suit: Diamonds/Economy)*
8. **Club Sandwich** ($5): +6 Mult for each ♣ in hand on a Win. *(Suit: Clubs)*
9. **Monochrome** ($6, isXMult): ×1.6 Mult if all cards in your hand share the same suit (min 3 cards). *(Flush)*
10. **Odd Ball** ($4): +15 Chips & +3 Mult for each odd-numbered card (3, 5, 7, 9) in hand. *(Odd rank counterpart)*
11. **The Grinder** ($4): Earn +$1 and +15 Chips for every safe Hit in the round. *(Hit tempo)*
12. **Double or Nothing** ($7, isXMult): Doubling Down multiplies Mult by ×3 instead of ×2 (losses still score 0). *(High Roller)*
13. **Slow & Steady** ($5): +20 Chips for each Deal remaining in the current Blind when you Win. *(Efficiency)*
14. **Card Sharp** ($6, isXMult): ×1.75 Mult if you have already won a hand in this Blind. *(Blind tempo)*
15. **Loan Shark** ($4): Grants +$15 immediately when bought. Costs -$1 at the end of each Blind. *(Cash injection)*
16. **Deja Vu** ($7, isXMult): ×1.5 Mult if your final hand total matches your final total from the previous hand. *(Pattern)*

### B. 4 New Tarots (Catalog expanding from 6 to 10)
1. **The Guillotine** ($4): Permanently destroy the leftmost card in your hand from your deck. *(Deck thinning)*
2. **Card Forge** ($3): Increase the rank of your highest non-Ace card by 2 (or turn 10/J/Q into K). *(Rank manipulation)*
3. **Prism Dye** ($3): Enhance a selected card to Foil (+30 Chips permanently). *(Targeted enhancement)*
4. **Lucky Charm** ($4): Apply Holo (+4 Mult) to your rightmost card permanently. *(Targeted enhancement)*

### C. 4 New Vouchers (Catalog expanding from 6 to 10)
1. **Clearance Rack** ($6): Shop reroll starting cost is reduced from $2 to $1 permanently.
2. **Liquid Assets** ($7): Earn interest for every $4 held instead of every $5 permanently.
3. **Card Sharp License** ($8): +1 Max Deal and +20 Base Chips on all hands permanently.
4. **Overstock Shelves** ($7): Shop offers +1 additional card/item slot permanently.

---

## 🎯 Next Step Prompting Guide (For Continuation)
If you need to resume this work in a new conversation, prompt with:
> *"We are following BALANCE_AND_CONTENT_ROADMAP.md. [Specify: Proceed with Stage 1 / Stage 2 / Stage 3 / Stage 4]. Please inspect the roadmap and execute the next milestone."*
