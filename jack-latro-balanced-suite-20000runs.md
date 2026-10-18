================================================================================
JACK-LATRO v1.7 // FULL 5-BOT COMPARATIVE TELEMETRY SUITE
Generated: 2026-10-17T22:44:33.445Z
Runs Per Bot: 4,000 (20,000 Total Simulated Games)
Settings: Deals=7, TargetScale=100%, DealCashCap=$6, PushRefund=true, AnteScale=true
================================================================================
HEAD-TO-HEAD BOT SUMMARY:
  vanilla      | Win Rate:   0.00% | Avg Ante:  1.46 | BJ Hand Win%:  44.39%
  basic        | Win Rate:  60.32% | Avg Ante:  6.51 | BJ Hand Win%:  46.91%
  synergy      | Win Rate:  69.58% | Avg Ante:  6.69 | BJ Hand Win%:  49.06%
  highroller   | Win Rate:  55.43% | Avg Ante:  6.56 | BJ Hand Win%:  45.79%
  charlie      | Win Rate:  67.47% | Avg Ante:  6.73 | BJ Hand Win%:  47.92%
================================================================================

================================================================================
BOT STRATEGY: No-Jokers Baseline (Vanilla Basic Strategy)
================================================================================
Runs Simulated        : 4,000 (1018 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : ON
Hand Tiers +15%/Ante  : ON
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 0.00% (0 / 4000)
  Avg Final Ante      : 1.46
  Total Hands Played  : 75,218 (Avg 18.8 hands/run)
  BJ Hand Win Rate    : 44.39%
  Cause of Death      : 39.2% Scaling Wall (1567) | 60.8% Cold Shoe (2433)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 75,218 total hands)
  Natural Blackjack   :     3594 (4.78%)
  5-Card Charlie      :      947 (1.26%)
  Exact 21 (3+ cards) :     3657 (4.86%)
  Standard Win        :    25195 (33.50%)
  Push (Tie)          :     5141 (6.83%)
  Dealer Win (Loss)   :    23671 (31.47%)
  Player Bust         :    13013 (17.30%)
  Double Down Win %   : 54.7% (3411/6232)
  Bust Cushion Saves  : 0 hands (22 converted to 21)
  Safety Net Saves    : 0 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  39.63% (1585 / 4000)
  Ante 2 Cleared      :   6.68% (267 / 4000)
  Ante 3 Cleared      :   0.05% (2 / 4000)
  Ante 4 Cleared      :   0.00% (0 / 4000)
  Ante 5 Cleared      :   0.00% (0 / 4000)
  Ante 6 Cleared      :   0.00% (0 / 4000)
  Ante 7 Cleared      :   0.00% (0 / 4000)
  Ante 8 Cleared      :   0.00% (0 / 4000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |    4000 |   91.0% |      488 |     4.21 |    $14.5 |        0 |     360
A1-Big     |     435 |    3640 |   79.6% |      574 |     5.03 |    $25.0 |      180 |     563
A1-Boss    |     600 |    2897 |   54.7% |      615 |     5.68 |    $38.2 |      592 |     720
A2-Small   |     600 |    1585 |   76.5% |      770 |     5.20 |    $50.1 |      106 |     267
A2-Big     |     870 |    1212 |   58.7% |      874 |     6.18 |    $62.3 |      269 |     231
A2-Boss    |    1200 |     712 |   37.5% |      959 |     6.80 |    $75.6 |      274 |     171
A3-Small   |    1100 |     267 |   56.2% |     1110 |     6.09 |    $87.4 |       52 |      65
A3-Big     |    1595 |     150 |   34.0% |     1245 |     6.98 |    $99.4 |       68 |      31
A3-Boss    |    2200 |      51 |    3.9% |     1049 |     6.51 |   $117.5 |       26 |      23
A4-Small   |    1800 |       2 |   50.0% |     1142 |     6.00 |   $129.0 |        0 |       1
A4-Big     |    2610 |       1 |    0.0% |      904 |     7.00 |        - |        0 |       1
--------------------------------------------------------------------------------
JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)
Joker Name         | Cost | Offered | Bought | EndHeld |  RunWin% | AvgAnte | Avg Scaling Bonus 
------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------
VOUCHER PERFORMANCE
  Extra Cushion        : Offered     0 | Bought     0 | Run Win Rate when bought: 0.0%
  Table Leverage       : Offered     0 | Bought     0 | Run Win Rate when bought: 0.0%
  VIP Lounge Pass      : Offered     0 | Bought     0 | Run Win Rate when bought: 0.0%
  High Stakes Table    : Offered     0 | Bought     0 | Run Win Rate when bought: 0.0%
  High Roller Credit   : Offered     0 | Bought     0 | Run Win Rate when bought: 0.0%
  Precision Edge       : Offered     0 | Bought     0 | Run Win Rate when bought: 0.0%


================================================================================
BOT STRATEGY: Strict Casino Basic Strategy AI (With Jokers)
================================================================================
Runs Simulated        : 4,000 (5016 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : ON
Hand Tiers +15%/Ante  : ON
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 60.32% (2413 / 4000)
  Avg Final Ante      : 6.51
  Total Hands Played  : 202,171 (Avg 50.5 hands/run)
  BJ Hand Win Rate    : 46.91%
  Cause of Death      : 5.4% Scaling Wall (86) | 94.6% Cold Shoe (1501)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 202,171 total hands)
  Natural Blackjack   :    13429 (6.64%)
  5-Card Charlie      :     2260 (1.12%)
  Exact 21 (3+ cards) :    12442 (6.15%)
  Standard Win        :    65330 (32.31%)
  Push (Tie)          :    18544 (9.17%)
  Dealer Win (Loss)   :    55141 (27.27%)
  Player Bust         :    35025 (17.32%)
  Double Down Win %   : 63.9% (4930/7711)
  Bust Cushion Saves  : 4322 hands (22 converted to 21)
  Safety Net Saves    : 7626 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  84.67% (3387 / 4000)
  Ante 2 Cleared      :  83.73% (3349 / 4000)
  Ante 3 Cleared      :  82.65% (3306 / 4000)
  Ante 4 Cleared      :  81.53% (3261 / 4000)
  Ante 5 Cleared      :  77.88% (3115 / 4000)
  Ante 6 Cleared      :  73.85% (2954 / 4000)
  Ante 7 Cleared      :  67.07% (2683 / 4000)
  Ante 8 Cleared      :  60.32% (2413 / 4000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |    4000 |   90.1% |      491 |     4.30 |    $35.1 |        0 |     394
A1-Big     |     435 |    3606 |   96.2% |     1289 |     3.01 |    $37.7 |        4 |     133
A1-Boss    |     600 |    3469 |   97.6% |     2431 |     2.49 |    $39.0 |        0 |      82
A2-Small   |     600 |    3387 |   99.6% |     3629 |     1.90 |    $40.7 |        0 |      13
A2-Big     |     870 |    3374 |   99.6% |     4470 |     2.01 |    $50.9 |        0 |      12
A2-Boss    |    1200 |    3362 |   99.6% |     5320 |     2.06 |    $64.1 |        0 |      13
A3-Small   |    1100 |    3349 |   99.8% |     6263 |     1.87 |    $76.0 |        0 |       8
A3-Big     |    1595 |    3341 |   99.8% |     7468 |     2.04 |    $98.0 |        0 |       8
A3-Boss    |    2200 |    3333 |   99.2% |     8880 |     2.24 |   $121.3 |        0 |      27
A4-Small   |    1800 |    3306 |   99.8% |     9479 |     2.02 |   $142.4 |        0 |       7
A4-Big     |    2610 |    3299 |   99.8% |    11264 |     2.29 |   $165.5 |        0 |       8
A4-Boss    |    3600 |    3291 |   99.1% |    13005 |     2.50 |   $190.6 |        0 |      30
A5-Small   |    2900 |    3261 |   99.5% |    14082 |     2.22 |   $212.5 |        0 |      17
A5-Big     |    4205 |    3244 |   99.1% |    16209 |     2.51 |   $236.6 |        0 |      30
A5-Boss    |    5800 |    3214 |   96.9% |    19963 |     2.96 |   $261.1 |        2 |      97
A6-Small   |    4500 |    3115 |   99.5% |    20097 |     2.41 |   $283.9 |        0 |      15
A6-Big     |    6525 |    3100 |   98.5% |    22659 |     2.79 |   $308.6 |        0 |      46
A6-Boss    |    9000 |    3054 |   96.7% |    26542 |     3.16 |   $334.7 |        9 |      91
A7-Small   |    7000 |    2954 |   99.1% |    27730 |     2.61 |   $357.8 |        0 |      27
A7-Big     |   10150 |    2927 |   97.6% |    31583 |     3.06 |   $382.8 |        5 |      66
A7-Boss    |   14000 |    2856 |   93.9% |    37931 |     3.29 |   $407.4 |       14 |     159
A8-Small   |   10500 |    2683 |   98.6% |    38040 |     2.81 |   $430.6 |        2 |      35
A8-Big     |   15225 |    2646 |   96.8% |    43190 |     3.24 |   $454.4 |       12 |      72
A8-Boss    |   21000 |    2562 |   94.2% |    50460 |     3.70 |   $478.8 |       38 |     111
--------------------------------------------------------------------------------
JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)
Joker Name         | Cost | Offered | Bought | EndHeld |  RunWin% | AvgAnte | Avg Scaling Bonus 
------------------------------------------------------------------------------------------------
Compound Edge      |   $6 |    7490 |   1190 |    1172 |    93.5% |    8.64 | -                 
Daredevil          |   $6 |    7466 |   1199 |    1198 |    79.3% |    8.27 | +12.2 Mult        
Minimalist         |   $6 |    3287 |   3275 |    3275 |    72.3% |    8.25 | -                 
The Shark          |   $7 |    3308 |   3292 |    3292 |    72.0% |    8.23 | -                 
Safety Net         |   $5 |    8598 |   1120 |     685 |    71.2% |    8.31 | -                 
BJ Tycoon          |   $7 |    3328 |   3321 |    3321 |    71.1% |    8.18 | -                 
Bust Cushion       |   $6 |    7595 |   1237 |    1215 |    68.4% |    8.05 | -                 
Chip Stacker       |   $5 |    8105 |   1038 |    1005 |    68.4% |    7.83 | +111.0 Chips      
VIP High Roller    |   $5 |    8739 |   1045 |     624 |    67.3% |    7.90 | -                 
Dark Knight        |   $5 |    8816 |   1037 |     636 |    65.3% |    8.03 | -                 
Ace Up Sleeve      |   $6 |    7727 |   1226 |    1207 |    61.0% |    7.72 | -                 
Lucky Sevens       |   $5 |    8857 |   1037 |     664 |    59.5% |    7.59 | -                 
Hit Me Baby        |   $5 |    8628 |   1099 |     698 |    58.2% |    7.57 | -                 
Red Velvet         |   $5 |    8672 |   1073 |     680 |    57.2% |    7.59 | -                 
Sweet Sixteen      |   $5 |    8919 |   1064 |     678 |    54.3% |    7.35 | -                 
Even Steven        |   $4 |   10194 |    930 |     128 |    46.1% |    6.26 | -                 
Push It Good       |   $4 |   10203 |    961 |     123 |    43.9% |    6.16 | -                 
Gold Parachute     |   $4 |   10125 |    969 |     146 |    32.2% |    5.84 | -                 
Card Counter       |   $4 |   10235 |    973 |     147 |    26.5% |    5.50 | -                 
--------------------------------------------------------------------------------
VOUCHER PERFORMANCE
  Extra Cushion        : Offered  3404 | Bought  3404 | Run Win Rate when bought: 70.9%
  Table Leverage       : Offered  3412 | Bought  3412 | Run Win Rate when bought: 70.7%
  VIP Lounge Pass      : Offered  3438 | Bought  3436 | Run Win Rate when bought: 70.2%
  High Stakes Table    : Offered  3421 | Bought  3421 | Run Win Rate when bought: 70.5%
  High Roller Credit   : Offered  3435 | Bought  3435 | Run Win Rate when bought: 70.2%
  Precision Edge       : Offered  3439 | Bought  3439 | Run Win Rate when bought: 70.2%


================================================================================
BOT STRATEGY: Smart Synergy AI (Adapts to Jokers)
================================================================================
Runs Simulated        : 4,000 (4980 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : ON
Hand Tiers +15%/Ante  : ON
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 69.58% (2783 / 4000)
  Avg Final Ante      : 6.69
  Total Hands Played  : 193,160 (Avg 48.3 hands/run)
  BJ Hand Win Rate    : 49.06%
  Cause of Death      : 3.2% Scaling Wall (39) | 96.8% Cold Shoe (1178)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 193,160 total hands)
  Natural Blackjack   :    12873 (6.66%)
  5-Card Charlie      :     2069 (1.07%)
  Exact 21 (3+ cards) :    13481 (6.98%)
  Standard Win        :    62162 (32.18%)
  Push (Tie)          :    17982 (9.31%)
  Dealer Win (Loss)   :    51798 (26.82%)
  Player Bust         :    32795 (16.98%)
  Double Down Win %   : 63.1% (7595/12040)
  Bust Cushion Saves  : 5738 hands (22 converted to 21)
  Safety Net Saves    : 1049 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  86.08% (3443 / 4000)
  Ante 2 Cleared      :  85.08% (3403 / 4000)
  Ante 3 Cleared      :  83.88% (3355 / 4000)
  Ante 4 Cleared      :  82.40% (3296 / 4000)
  Ante 5 Cleared      :  80.08% (3203 / 4000)
  Ante 6 Cleared      :  77.98% (3119 / 4000)
  Ante 7 Cleared      :  73.67% (2947 / 4000)
  Ante 8 Cleared      :  69.58% (2783 / 4000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |    4000 |   90.8% |      498 |     4.27 |    $35.4 |        0 |     367
A1-Big     |     435 |    3633 |   97.1% |     1259 |     2.90 |    $38.1 |        1 |     104
A1-Boss    |     600 |    3528 |   97.6% |     2435 |     2.55 |    $39.4 |        2 |      83
A2-Small   |     600 |    3443 |   99.5% |     3521 |     1.88 |    $40.5 |        0 |      16
A2-Big     |     870 |    3427 |   99.7% |     4369 |     2.04 |    $48.4 |        0 |      11
A2-Boss    |    1200 |    3416 |   99.6% |     5001 |     2.14 |    $59.4 |        0 |      13
A3-Small   |    1100 |    3403 |   99.9% |     6410 |     1.93 |    $70.0 |        0 |       4
A3-Big     |    1595 |    3399 |   99.6% |     7482 |     2.04 |    $90.9 |        0 |      15
A3-Boss    |    2200 |    3384 |   99.1% |     9068 |     2.18 |   $113.3 |        0 |      29
A4-Small   |    1800 |    3355 |   99.7% |    10110 |     1.97 |   $133.7 |        0 |      10
A4-Big     |    2610 |    3345 |   99.4% |    12158 |     2.15 |   $155.9 |        0 |      19
A4-Boss    |    3600 |    3326 |   99.1% |    13626 |     2.36 |   $179.6 |        0 |      30
A5-Small   |    2900 |    3296 |   99.7% |    15743 |     2.08 |   $200.6 |        0 |       9
A5-Big     |    4205 |    3287 |   99.5% |    17814 |     2.27 |   $223.3 |        0 |      18
A5-Boss    |    5800 |    3269 |   98.0% |    21859 |     2.60 |   $246.4 |        0 |      66
A6-Small   |    4500 |    3203 |   99.5% |    22303 |     2.20 |   $267.7 |        0 |      15
A6-Big     |    6525 |    3188 |   99.2% |    24855 |     2.38 |   $290.4 |        0 |      25
A6-Boss    |    9000 |    3163 |   98.6% |    29760 |     2.65 |   $315.0 |        1 |      43
A7-Small   |    7000 |    3119 |   99.3% |    30776 |     2.32 |   $336.5 |        1 |      22
A7-Big     |   10150 |    3096 |   98.5% |    35772 |     2.55 |   $359.5 |        4 |      41
A7-Boss    |   14000 |    3051 |   96.6% |    40904 |     2.81 |   $382.8 |        7 |      97
A8-Small   |   10500 |    2947 |   99.0% |    41731 |     2.40 |   $404.2 |        1 |      29
A8-Big     |   15225 |    2917 |   98.4% |    48284 |     2.71 |   $427.3 |        5 |      42
A8-Boss    |   21000 |    2870 |   97.0% |    54275 |     3.04 |   $451.3 |       17 |      70
--------------------------------------------------------------------------------
JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)
Joker Name         | Cost | Offered | Bought | EndHeld |  RunWin% | AvgAnte | Avg Scaling Bonus 
------------------------------------------------------------------------------------------------
Compound Edge      |   $6 |    6103 |   1804 |    1754 |    94.0% |    8.70 | -                 
Daredevil          |   $6 |    6242 |   1786 |    1784 |    83.7% |    8.37 | +11.8 Mult        
The Shark          |   $7 |    3353 |   3331 |    3331 |    81.6% |    8.44 | -                 
BJ Tycoon          |   $7 |    3395 |   3382 |    3382 |    80.7% |    8.38 | -                 
Bust Cushion       |   $6 |    6370 |   1808 |    1775 |    80.6% |    8.40 | -                 
Chip Stacker       |   $5 |    6749 |   1662 |    1626 |    78.9% |    8.21 | +136.7 Chips      
Minimalist         |   $6 |    6394 |   1764 |    1764 |    77.7% |    8.28 | -                 
Ace Up Sleeve      |   $6 |    6397 |   1829 |    1793 |    76.0% |    8.19 | -                 
VIP High Roller    |   $5 |    7334 |   1634 |    1246 |    75.3% |    8.24 | -                 
Push It Good       |   $4 |    8793 |   1681 |     622 |    70.9% |    7.94 | -                 
Sweet Sixteen      |   $5 |    7559 |   1707 |    1284 |    70.3% |    7.92 | -                 
Card Counter       |   $4 |    8752 |   1661 |     610 |    62.5% |    7.58 | -                 
Lucky Sevens       |   $5 |   11040 |   1067 |      46 |     0.0% |    1.20 | -                 
Hit Me Baby        |   $5 |   11182 |   1035 |      39 |     0.0% |    1.26 | -                 
Gold Parachute     |   $4 |   11422 |    979 |      39 |     0.0% |    1.21 | -                 
Safety Net         |   $5 |   11175 |   1008 |      11 |     0.0% |    1.09 | -                 
Even Steven        |   $4 |   11223 |    910 |      17 |     0.0% |    1.35 | -                 
Red Velvet         |   $5 |   11043 |   1053 |      41 |     0.0% |    1.24 | -                 
Dark Knight        |   $5 |   11170 |   1035 |      21 |     0.0% |    1.38 | -                 
--------------------------------------------------------------------------------
VOUCHER PERFORMANCE
  Extra Cushion        : Offered  3462 | Bought  3462 | Run Win Rate when bought: 80.4%
  Table Leverage       : Offered  3467 | Bought  3467 | Run Win Rate when bought: 80.3%
  VIP Lounge Pass      : Offered  3481 | Bought  3481 | Run Win Rate when bought: 79.9%
  High Stakes Table    : Offered  3464 | Bought  3464 | Run Win Rate when bought: 80.3%
  High Roller Credit   : Offered  3484 | Bought  3484 | Run Win Rate when bought: 79.9%
  Precision Edge       : Offered  3492 | Bought  3492 | Run Win Rate when bought: 79.7%


================================================================================
BOT STRATEGY: High-Roller 21 AI (Faces/Aces/Doubles)
================================================================================
Runs Simulated        : 4,000 (5118 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : ON
Hand Tiers +15%/Ante  : ON
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 55.43% (2217 / 4000)
  Avg Final Ante      : 6.56
  Total Hands Played  : 217,930 (Avg 54.5 hands/run)
  BJ Hand Win Rate    : 45.79%
  Cause of Death      : 1.6% Scaling Wall (28) | 98.4% Cold Shoe (1755)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 217,930 total hands)
  Natural Blackjack   :    14299 (6.56%)
  5-Card Charlie      :     2372 (1.09%)
  Exact 21 (3+ cards) :    11611 (5.33%)
  Standard Win        :    70751 (32.47%)
  Push (Tie)          :    19475 (8.94%)
  Dealer Win (Loss)   :    60822 (27.91%)
  Player Bust         :    38600 (17.71%)
  Double Down Win %   : 58.2% (10522/18093)
  Bust Cushion Saves  : 2156 hands (22 converted to 21)
  Safety Net Saves    : 2640 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  86.58% (3463 / 4000)
  Ante 2 Cleared      :  85.60% (3424 / 4000)
  Ante 3 Cleared      :  84.47% (3379 / 4000)
  Ante 4 Cleared      :  82.55% (3302 / 4000)
  Ante 5 Cleared      :  77.88% (3115 / 4000)
  Ante 6 Cleared      :  73.67% (2947 / 4000)
  Ante 7 Cleared      :  65.10% (2604 / 4000)
  Ante 8 Cleared      :  55.43% (2217 / 4000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |    4000 |   91.2% |      491 |     4.21 |    $35.0 |        0 |     351
A1-Big     |     435 |    3649 |   96.9% |     1297 |     2.93 |    $37.3 |        5 |     108
A1-Boss    |     600 |    3536 |   97.9% |     2507 |     2.51 |    $38.7 |        1 |      72
A2-Small   |     600 |    3463 |   99.7% |     3604 |     1.90 |    $39.9 |        0 |       9
A2-Big     |     870 |    3454 |   99.5% |     4492 |     1.99 |    $48.8 |        0 |      16
A2-Boss    |    1200 |    3438 |   99.6% |     5371 |     2.13 |    $60.9 |        0 |      14
A3-Small   |    1100 |    3424 |   99.9% |     6669 |     1.90 |    $71.7 |        0 |       4
A3-Big     |    1595 |    3420 |   99.8% |     7697 |     2.09 |    $92.5 |        0 |       7
A3-Boss    |    2200 |    3413 |   99.0% |     8873 |     2.29 |   $114.8 |        0 |      34
A4-Small   |    1800 |    3379 |   99.6% |     9414 |     2.10 |   $134.9 |        0 |      12
A4-Big     |    2610 |    3367 |   99.3% |    11350 |     2.38 |   $157.1 |        0 |      22
A4-Boss    |    3600 |    3345 |   98.7% |    11903 |     2.68 |   $181.4 |        0 |      43
A5-Small   |    2900 |    3302 |   99.3% |    12723 |     2.36 |   $202.7 |        0 |      22
A5-Big     |    4205 |    3280 |   98.9% |    15023 |     2.68 |   $226.1 |        0 |      35
A5-Boss    |    5800 |    3245 |   96.0% |    17024 |     3.24 |   $249.7 |        0 |     130
A6-Small   |    4500 |    3115 |   99.0% |    16487 |     2.60 |   $271.5 |        0 |      31
A6-Big     |    6525 |    3084 |   98.5% |    19486 |     3.05 |   $295.4 |        0 |      47
A6-Boss    |    9000 |    3037 |   97.0% |    23093 |     3.58 |   $321.9 |        1 |      89
A7-Small   |    7000 |    2947 |   98.2% |    21052 |     2.97 |   $344.5 |        0 |      53
A7-Big     |   10150 |    2894 |   97.9% |    26282 |     3.48 |   $369.5 |        0 |      60
A7-Boss    |   14000 |    2834 |   91.9% |    29958 |     3.96 |   $395.9 |        5 |     225
A8-Small   |   10500 |    2604 |   97.8% |    28693 |     3.31 |   $419.2 |        0 |      57
A8-Big     |   15225 |    2547 |   95.1% |    33281 |     3.94 |   $444.8 |        2 |     124
A8-Boss    |   21000 |    2421 |   91.6% |    40954 |     4.58 |   $472.5 |       14 |     190
--------------------------------------------------------------------------------
JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)
Joker Name         | Cost | Offered | Bought | EndHeld |  RunWin% | AvgAnte | Avg Scaling Bonus 
------------------------------------------------------------------------------------------------
Daredevil          |   $6 |    8101 |   1216 |     893 |    73.8% |    8.02 | +13.3 Mult        
Minimalist         |   $6 |    3350 |   3334 |    3334 |    64.9% |    8.11 | -                 
The Shark          |   $7 |    3352 |   3344 |    3344 |    64.6% |    8.08 | -                 
Chip Stacker       |   $5 |    3545 |   3207 |    3187 |    64.3% |    8.05 | +107.6 Chips      
BJ Tycoon          |   $7 |    3397 |   3379 |    3379 |    64.0% |    8.04 | -                 
Ace Up Sleeve      |   $6 |    3503 |   3241 |    3241 |    63.5% |    8.05 | -                 
VIP High Roller    |   $5 |    3721 |   3181 |    2957 |    62.2% |    8.05 | -                 
Compound Edge      |   $6 |    9104 |   1181 |     141 |    61.0% |    6.55 | -                 
Bust Cushion       |   $6 |    9434 |   1191 |     175 |    35.4% |    6.11 | -                 
Safety Net         |   $5 |   10036 |   1084 |      42 |    26.2% |    4.95 | -                 
Dark Knight        |   $5 |   10222 |   1060 |      59 |    20.3% |    4.61 | -                 
Sweet Sixteen      |   $5 |   10093 |   1082 |      97 |    11.3% |    3.51 | -                 
Hit Me Baby        |   $5 |   10063 |   1075 |      89 |    11.2% |    3.69 | -                 
Lucky Sevens       |   $5 |   10098 |   1103 |      88 |     9.1% |    3.48 | -                 
Red Velvet         |   $5 |   10076 |   1108 |      86 |     5.8% |    3.26 | -                 
Card Counter       |   $4 |   10772 |    945 |      50 |     2.0% |    1.78 | -                 
Gold Parachute     |   $4 |   10682 |    967 |      51 |     0.0% |    1.49 | -                 
Push It Good       |   $4 |   10643 |   1041 |      30 |     0.0% |    1.60 | -                 
Even Steven        |   $4 |   10638 |    912 |      24 |     0.0% |    1.79 | -                 
--------------------------------------------------------------------------------
VOUCHER PERFORMANCE
  Extra Cushion        : Offered  3479 | Bought  3478 | Run Win Rate when bought: 63.7%
  Table Leverage       : Offered  3489 | Bought  3489 | Run Win Rate when bought: 63.5%
  VIP Lounge Pass      : Offered  3497 | Bought  3497 | Run Win Rate when bought: 63.4%
  High Stakes Table    : Offered  3486 | Bought  3485 | Run Win Rate when bought: 63.6%
  High Roller Credit   : Offered  3509 | Bought  3508 | Run Win Rate when bought: 63.2%
  Precision Edge       : Offered  3506 | Bought  3506 | Run Win Rate when bought: 63.2%


================================================================================
BOT STRATEGY: Low-Card Charlie AI (Hits Low Cards)
================================================================================
Runs Simulated        : 4,000 (5722 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : ON
Hand Tiers +15%/Ante  : ON
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 67.47% (2699 / 4000)
  Avg Final Ante      : 6.73
  Total Hands Played  : 212,671 (Avg 53.2 hands/run)
  BJ Hand Win Rate    : 47.92%
  Cause of Death      : 6.0% Scaling Wall (78) | 94.0% Cold Shoe (1223)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 212,671 total hands)
  Natural Blackjack   :    11137 (5.24%)
  5-Card Charlie      :     5969 (2.81%)
  Exact 21 (3+ cards) :    19580 (9.21%)
  Standard Win        :    64745 (30.44%)
  Push (Tie)          :    18696 (8.79%)
  Dealer Win (Loss)   :    58712 (27.61%)
  Player Bust         :    33832 (15.91%)
  Double Down Win %   : 63.3% (4081/6450)
  Bust Cushion Saves  : 8956 hands (22 converted to 21)
  Safety Net Saves    : 15865 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  86.22% (3449 / 4000)
  Ante 2 Cleared      :  85.38% (3415 / 4000)
  Ante 3 Cleared      :  84.52% (3381 / 4000)
  Ante 4 Cleared      :  83.73% (3349 / 4000)
  Ante 5 Cleared      :  81.00% (3240 / 4000)
  Ante 6 Cleared      :  78.83% (3153 / 4000)
  Ante 7 Cleared      :  73.38% (2935 / 4000)
  Ante 8 Cleared      :  67.47% (2699 / 4000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |    4000 |   91.0% |      482 |     4.26 |    $36.0 |        0 |     361
A1-Big     |     435 |    3639 |   97.1% |     1245 |     2.94 |    $39.0 |        2 |     104
A1-Boss    |     600 |    3533 |   97.6% |     2421 |     2.51 |    $40.6 |        1 |      83
A2-Small   |     600 |    3449 |   99.7% |     3764 |     1.85 |    $42.3 |        0 |      12
A2-Big     |     870 |    3437 |   99.7% |     4196 |     1.91 |    $51.5 |        0 |       9
A2-Boss    |    1200 |    3428 |   99.6% |     4927 |     2.06 |    $64.9 |        0 |      13
A3-Small   |    1100 |    3415 |   99.8% |     5470 |     1.85 |    $77.4 |        0 |       7
A3-Big     |    1595 |    3408 |   99.8% |     5784 |     2.03 |   $100.7 |        0 |       7
A3-Boss    |    2200 |    3401 |   99.4% |     6440 |     2.23 |   $126.0 |        0 |      20
A4-Small   |    1800 |    3381 |   99.8% |     6520 |     1.97 |   $149.0 |        0 |       7
A4-Big     |    2610 |    3374 |   99.7% |     7413 |     2.21 |   $174.4 |        0 |      10
A4-Boss    |    3600 |    3364 |   99.6% |     8588 |     2.45 |   $202.3 |        0 |      15
A5-Small   |    2900 |    3349 |   99.7% |     8403 |     2.15 |   $226.5 |        0 |       9
A5-Big     |    4205 |    3340 |   99.4% |     9935 |     2.51 |   $253.5 |        0 |      19
A5-Boss    |    5800 |    3321 |   97.6% |    12148 |     3.00 |   $281.4 |        4 |      77
A6-Small   |    4500 |    3240 |   99.4% |    11076 |     2.40 |   $306.5 |        0 |      21
A6-Big     |    6525 |    3219 |   99.3% |    13486 |     2.77 |   $334.4 |        0 |      21
A6-Boss    |    9000 |    3198 |   98.6% |    16275 |     3.22 |   $365.3 |        3 |      42
A7-Small   |    7000 |    3153 |   99.1% |    15110 |     2.74 |   $391.7 |        2 |      25
A7-Big     |   10150 |    3126 |   98.7% |    18730 |     3.18 |   $421.1 |        2 |      38
A7-Boss    |   14000 |    3086 |   95.1% |    22153 |     3.61 |   $452.3 |       13 |     138
A8-Small   |   10500 |    2935 |   99.1% |    20067 |     2.90 |   $479.6 |        2 |      24
A8-Big     |   15225 |    2909 |   96.9% |    25233 |     3.58 |   $509.7 |       17 |      73
A8-Boss    |   21000 |    2819 |   95.7% |    30171 |     4.14 |   $542.9 |       32 |      88
--------------------------------------------------------------------------------
JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)
Joker Name         | Cost | Offered | Bought | EndHeld |  RunWin% | AvgAnte | Avg Scaling Bonus 
------------------------------------------------------------------------------------------------
Daredevil          |   $6 |    5411 |   2088 |    2088 |    88.8% |    8.57 | +18.6 Mult        
Safety Net         |   $5 |    5654 |   1987 |    1987 |    82.4% |    8.62 | -                 
Chip Stacker       |   $5 |    9599 |   1035 |     560 |    78.8% |    8.03 | +209.4 Chips      
Even Steven        |   $4 |    5865 |   1928 |    1928 |    78.7% |    8.43 | -                 
Bust Cushion       |   $6 |    5555 |   2140 |    2140 |    78.0% |    8.40 | -                 
Hit Me Baby        |   $5 |    5950 |   2012 |    2012 |    75.7% |    8.28 | -                 
Card Counter       |   $4 |    5994 |   1958 |    1958 |    75.5% |    8.27 | -                 
The Shark          |   $7 |    5631 |   2139 |    2139 |    75.4% |    8.29 | -                 
Minimalist         |   $6 |    5968 |   2010 |    2010 |    73.6% |    8.25 | -                 
BJ Tycoon          |   $7 |    5807 |   2091 |    2091 |    73.4% |    8.17 | -                 
Sweet Sixteen      |   $5 |    5940 |   2044 |    2044 |    70.7% |    8.12 | -                 
VIP High Roller    |   $5 |   11330 |   1024 |      28 |     0.0% |    1.29 | -                 
Ace Up Sleeve      |   $6 |   10883 |   1147 |      48 |     0.0% |    1.23 | -                 
Lucky Sevens       |   $5 |   11045 |    992 |      36 |     0.0% |    1.14 | -                 
Gold Parachute     |   $4 |   11172 |    943 |      38 |     0.0% |    1.11 | -                 
Push It Good       |   $4 |   11428 |    944 |      24 |     0.0% |    1.08 | -                 
Red Velvet         |   $5 |   11061 |   1031 |      32 |     0.0% |    1.16 | -                 
Dark Knight        |   $5 |   11236 |   1024 |      17 |     0.0% |    1.12 | -                 
Compound Edge      |   $6 |   10917 |   1078 |      28 |     0.0% |    1.36 | -                 
--------------------------------------------------------------------------------
VOUCHER PERFORMANCE
  Extra Cushion        : Offered  3477 | Bought  3477 | Run Win Rate when bought: 77.6%
  Table Leverage       : Offered  3477 | Bought  3476 | Run Win Rate when bought: 77.6%
  VIP Lounge Pass      : Offered  3484 | Bought  3484 | Run Win Rate when bought: 77.5%
  High Stakes Table    : Offered  3482 | Bought  3481 | Run Win Rate when bought: 77.5%
  High Roller Credit   : Offered  3498 | Bought  3497 | Run Win Rate when bought: 77.2%
  Precision Edge       : Offered  3485 | Bought  3485 | Run Win Rate when bought: 77.4%
