================================================================================
JACK-LATRO v1.7 // FULL 5-BOT COMPARATIVE TELEMETRY SUITE
Generated: 2026-10-15T07:28:57.130Z
Runs Per Bot: 20,000 (100,000 Total Simulated Games)
Settings: Deals=7, TargetScale=100%, DealCashCap=$6, PushRefund=false, AnteScale=false
================================================================================
HEAD-TO-HEAD BOT SUMMARY:
  vanilla      | Win Rate:   0.00% | Avg Ante:  1.30 | BJ Hand Win%:  44.23%
  basic        | Win Rate:  18.27% | Avg Ante:  3.92 | BJ Hand Win%:  46.44%
  synergy      | Win Rate:  22.25% | Avg Ante:  4.10 | BJ Hand Win%:  49.23%
  highroller   | Win Rate:   9.52% | Avg Ante:  3.80 | BJ Hand Win%:  45.63%
  charlie      | Win Rate:  29.28% | Avg Ante:  4.20 | BJ Hand Win%:  46.92%
================================================================================

================================================================================
BOT STRATEGY: No-Jokers Baseline (Vanilla Basic Strategy)
================================================================================
Runs Simulated        : 20,000 (349 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : OFF
Hand Tiers +15%/Ante  : OFF
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 0.00% (0 / 20000)
  Avg Final Ante      : 1.30
  Total Hands Played  : 302,819 (Avg 15.1 hands/run)
  BJ Hand Win Rate    : 44.23%
  Cause of Death      : 36.1% Scaling Wall (7216) | 63.9% Cold Shoe (12784)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 302,819 total hands)
  Natural Blackjack   :    14592 (4.82%)
  5-Card Charlie      :     3882 (1.28%)
  Exact 21 (3+ cards) :    14991 (4.95%)
  Standard Win        :   100469 (33.18%)
  Push (Tie)          :    20544 (6.78%)
  Dealer Win (Loss)   :    95679 (31.60%)
  Player Bust         :    52662 (17.39%)
  Double Down Win %   : 54.0% (13561/25132)
  Bust Cushion Saves  : 0 hands (22 converted to 21)
  Safety Net Saves    : 0 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  28.98% (5795 / 20000)
  Ante 2 Cleared      :   0.69% (138 / 20000)
  Ante 3 Cleared      :   0.00% (0 / 20000)
  Ante 4 Cleared      :   0.00% (0 / 20000)
  Ante 5 Cleared      :   0.00% (0 / 20000)
  Ante 6 Cleared      :   0.00% (0 / 20000)
  Ante 7 Cleared      :   0.00% (0 / 20000)
  Ante 8 Cleared      :   0.00% (0 / 20000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |   20000 |   83.7% |      469 |     4.47 |    $14.0 |        0 |    3256
A1-Big     |     435 |   16744 |   69.2% |      532 |     5.12 |    $24.2 |     1447 |    3714
A1-Boss    |     600 |   11583 |   50.0% |      576 |     5.78 |    $37.0 |     2772 |    3016
A2-Small   |     600 |    5795 |   53.1% |      592 |     5.69 |    $48.5 |     1245 |    1475
A2-Big     |     870 |    3075 |   33.2% |      667 |     6.38 |    $60.4 |     1092 |     963
A2-Boss    |    1200 |    1020 |   13.5% |      680 |     6.82 |    $73.4 |      567 |     315
A3-Small   |    1100 |     138 |   21.0% |      709 |     6.67 |    $84.0 |       73 |      36
A3-Big     |    1595 |      29 |    3.4% |      663 |     6.93 |    $98.0 |       20 |       8
A3-Boss    |    2200 |       1 |    0.0% |      320 |     6.00 |        - |        0 |       1
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


================================================================================
BOT STRATEGY: Strict Casino Basic Strategy AI (With Jokers)
================================================================================
Runs Simulated        : 20,000 (1553 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : OFF
Hand Tiers +15%/Ante  : OFF
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 18.27% (3655 / 20000)
  Avg Final Ante      : 3.92
  Total Hands Played  : 782,748 (Avg 39.1 hands/run)
  BJ Hand Win Rate    : 46.44%
  Cause of Death      : 9.0% Scaling Wall (1474) | 91.0% Cold Shoe (14871)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 782,748 total hands)
  Natural Blackjack   :    43546 (5.56%)
  5-Card Charlie      :     9584 (1.22%)
  Exact 21 (3+ cards) :    47161 (6.03%)
  Standard Win        :   257061 (32.84%)
  Push (Tie)          :    64145 (8.19%)
  Dealer Win (Loss)   :   227389 (29.05%)
  Player Bust         :   133862 (17.10%)
  Double Down Win %   : 56.2% (18608/33081)
  Bust Cushion Saves  : 13281 hands (22 converted to 21)
  Safety Net Saves    : 23924 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  61.51% (12302 / 20000)
  Ante 2 Cleared      :  53.27% (10654 / 20000)
  Ante 3 Cleared      :  49.12% (9824 / 20000)
  Ante 4 Cleared      :  44.23% (8846 / 20000)
  Ante 5 Cleared      :  35.41% (7081 / 20000)
  Ante 6 Cleared      :  27.25% (5449 / 20000)
  Ante 7 Cleared      :  21.13% (4226 / 20000)
  Ante 8 Cleared      :  18.27% (3655 / 20000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |   20000 |   83.6% |      469 |     4.46 |    $14.0 |        0 |    3279
A1-Big     |     435 |   16721 |   86.5% |      744 |     4.18 |    $10.4 |      209 |    2048
A1-Boss    |     600 |   14464 |   85.1% |     1014 |     4.26 |    $11.9 |      243 |    1919
A2-Small   |     600 |   12302 |   95.1% |     1227 |     3.37 |    $10.6 |       10 |     592
A2-Big     |     870 |   11700 |   95.2% |     1645 |     3.44 |    $11.9 |       25 |     531
A2-Boss    |    1200 |   11144 |   95.6% |     2241 |     3.39 |    $13.9 |       24 |     466
A3-Small   |    1100 |   10654 |   98.7% |     2575 |     2.62 |    $15.5 |        3 |     134
A3-Big     |    1595 |   10517 |   98.3% |     3326 |     2.87 |    $22.3 |        2 |     177
A3-Boss    |    2200 |   10338 |   95.0% |     4086 |     3.18 |    $31.3 |       14 |     500
A4-Small   |    1800 |    9824 |   98.5% |     4063 |     2.76 |    $40.7 |        0 |     150
A4-Big     |    2610 |    9674 |   96.8% |     5190 |     3.20 |    $51.7 |        9 |     299
A4-Boss    |    3600 |    9366 |   94.4% |     6473 |     3.65 |    $64.0 |       62 |     458
A5-Small   |    2900 |    8846 |   96.9% |     6561 |     3.06 |    $74.7 |       19 |     251
A5-Big     |    4205 |    8576 |   94.3% |     8165 |     3.57 |    $86.4 |       69 |     424
A5-Boss    |    5800 |    8083 |   87.6% |    10277 |     4.16 |    $99.0 |      175 |     827
A6-Small   |    4500 |    7081 |   95.6% |    10015 |     3.20 |   $110.1 |       28 |     285
A6-Big     |    6525 |    6768 |   91.7% |    12641 |     3.68 |   $122.1 |      103 |     461
A6-Boss    |    9000 |    6204 |   87.8% |    15728 |     4.08 |   $135.3 |      225 |     530
A7-Small   |    7000 |    5449 |   95.3% |    15989 |     3.16 |   $146.7 |       46 |     210
A7-Big     |   10150 |    5193 |   92.4% |    19970 |     3.56 |   $159.1 |       85 |     310
A7-Boss    |   14000 |    4798 |   88.1% |    24457 |     3.67 |   $172.0 |       84 |     488
A8-Small   |   10500 |    4226 |   97.2% |    24049 |     2.97 |   $183.8 |       10 |     108
A8-Big     |   15225 |    4108 |   95.4% |    29741 |     3.42 |   $196.4 |       16 |     173
A8-Boss    |   21000 |    3919 |   93.3% |    36614 |     3.90 |   $210.2 |       13 |     251
--------------------------------------------------------------------------------
JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)
Joker Name         | Cost | Offered | Bought | EndHeld |  RunWin% | AvgAnte | Avg Scaling Bonus 
------------------------------------------------------------------------------------------------
Daredevil          |   $5 |   19832 |   3690 |    3662 |    62.3% |    7.46 | +24.6 Mult        
Compound Edge      |   $6 |   19833 |   4301 |    4225 |    50.7% |    6.39 | -                 
The Shark          |   $7 |   13985 |   9863 |    9863 |    35.6% |    6.58 | -                 
BJ Tycoon          |   $7 |   14197 |   9936 |    9936 |    35.3% |    6.51 | -                 
Minimalist         |   $6 |   13319 |   9952 |    9952 |    35.2% |    6.51 | -                 
Bust Cushion       |   $6 |   20871 |   4260 |    4186 |    28.0% |    5.90 | -                 
Safety Net         |   $5 |   22358 |   3655 |    2337 |    26.9% |    6.03 | -                 
Lucky Sevens       |   $6 |   21266 |   4206 |    4131 |    24.0% |    5.70 | -                 
Dark Knight        |   $5 |   22481 |   3633 |    2260 |    23.1% |    6.08 | -                 
Ace Up Sleeve      |   $6 |   21562 |   4139 |    4057 |    22.9% |    5.59 | -                 
VIP High Roller    |   $5 |   22902 |   3627 |    2358 |    20.3% |    5.72 | -                 
Hit Me Baby        |   $5 |   23205 |   3628 |    2419 |    17.7% |    5.41 | -                 
Chip Stacker       |   $5 |   23170 |   3729 |    3364 |    17.4% |    5.11 | +11.1 Chips       
Red Velvet         |   $5 |   23454 |   3645 |    2563 |    14.9% |    5.05 | -                 
Gold Parachute     |   $5 |   24033 |   3705 |    2647 |    14.1% |    4.80 | -                 
Sweet Sixteen      |   $5 |   23439 |   3727 |    2613 |    13.5% |    4.91 | -                 
Push It Good       |   $4 |   25580 |   3409 |     922 |     6.8% |    3.85 | -                 
Even Steven        |   $4 |   25695 |   3342 |     791 |     5.7% |    4.04 | -                 
Card Counter       |   $4 |   26038 |   3411 |    1025 |     3.8% |    3.46 | -                 
--------------------------------------------------------------------------------
VOUCHER PERFORMANCE
  Extra Cushion        : Offered 15552 | Bought 13499 | Run Win Rate when bought: 27.1%
  Table Leverage       : Offered 14076 | Bought 13141 | Run Win Rate when bought: 27.8%
  VIP Lounge Pass      : Offered 17012 | Bought 14041 | Run Win Rate when bought: 26.0%
  High Stakes Table    : Offered 15012 | Bought 13185 | Run Win Rate when bought: 27.7%


================================================================================
BOT STRATEGY: Smart Synergy AI (Adapts to Jokers)
================================================================================
Runs Simulated        : 20,000 (1628 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : OFF
Hand Tiers +15%/Ante  : OFF
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 22.25% (4449 / 20000)
  Avg Final Ante      : 4.10
  Total Hands Played  : 816,558 (Avg 40.8 hands/run)
  BJ Hand Win Rate    : 49.23%
  Cause of Death      : 9.4% Scaling Wall (1469) | 90.6% Cold Shoe (14082)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 816,558 total hands)
  Natural Blackjack   :    47235 (5.78%)
  5-Card Charlie      :    10046 (1.23%)
  Exact 21 (3+ cards) :    56920 (6.97%)
  Standard Win        :   264390 (32.38%)
  Push (Tie)          :    70004 (8.57%)
  Dealer Win (Loss)   :   229704 (28.13%)
  Player Bust         :   138259 (16.93%)
  Double Down Win %   : 57.4% (27794/48447)
  Bust Cushion Saves  : 23605 hands (22 converted to 21)
  Safety Net Saves    : 7516 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  61.40% (12280 / 20000)
  Ante 2 Cleared      :  54.04% (10808 / 20000)
  Ante 3 Cleared      :  50.36% (10071 / 20000)
  Ante 4 Cleared      :  46.05% (9211 / 20000)
  Ante 5 Cleared      :  39.54% (7908 / 20000)
  Ante 6 Cleared      :  32.36% (6472 / 20000)
  Ante 7 Cleared      :  26.15% (5229 / 20000)
  Ante 8 Cleared      :  22.25% (4449 / 20000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |   20000 |   83.0% |      468 |     4.51 |    $14.0 |        0 |    3393
A1-Big     |     435 |   16607 |   86.6% |      734 |     4.19 |    $10.4 |      172 |    2052
A1-Boss    |     600 |   14383 |   85.4% |     1007 |     4.21 |    $11.9 |      237 |    1866
A2-Small   |     600 |   12280 |   95.6% |     1214 |     3.30 |    $10.6 |       13 |     525
A2-Big     |     870 |   11742 |   96.0% |     1645 |     3.33 |    $11.9 |       17 |     455
A2-Boss    |    1200 |   11270 |   95.9% |     2233 |     3.30 |    $13.8 |       18 |     444
A3-Small   |    1100 |   10808 |   98.7% |     2601 |     2.56 |    $15.0 |        1 |     141
A3-Big     |    1595 |   10666 |   98.4% |     3363 |     2.81 |    $20.4 |        4 |     167
A3-Boss    |    2200 |   10495 |   96.0% |     4247 |     3.10 |    $27.6 |       14 |     410
A4-Small   |    1800 |   10071 |   98.7% |     4205 |     2.71 |    $35.2 |        2 |     124
A4-Big     |    2610 |    9945 |   97.3% |     5354 |     3.14 |    $45.2 |       11 |     259
A4-Boss    |    3600 |    9675 |   95.2% |     6516 |     3.58 |    $56.9 |       56 |     408
A5-Small   |    2900 |    9211 |   97.9% |     6362 |     2.94 |    $67.2 |       14 |     182
A5-Big     |    4205 |    9015 |   95.7% |     8176 |     3.39 |    $78.8 |       56 |     331
A5-Boss    |    5800 |    8628 |   91.7% |    10109 |     3.93 |    $91.3 |      149 |     571
A6-Small   |    4500 |    7908 |   96.7% |     9420 |     3.08 |   $102.3 |       25 |     236
A6-Big     |    6525 |    7647 |   93.6% |    11880 |     3.60 |   $114.3 |      129 |     364
A6-Boss    |    9000 |    7154 |   90.5% |    14711 |     4.06 |   $127.5 |      227 |     455
A7-Small   |    7000 |    6472 |   96.6% |    13947 |     3.18 |   $138.7 |       55 |     165
A7-Big     |   10150 |    6252 |   94.1% |    17663 |     3.63 |   $151.0 |      103 |     266
A7-Boss    |   14000 |    5883 |   88.9% |    21834 |     3.93 |   $163.6 |       91 |     563
A8-Small   |   10500 |    5229 |   97.7% |    20109 |     3.14 |   $175.1 |       13 |     108
A8-Big     |   15225 |    5108 |   95.1% |    25568 |     3.77 |   $187.7 |       24 |     226
A8-Boss    |   21000 |    4858 |   91.6% |    30972 |     4.38 |   $201.2 |       38 |     371
--------------------------------------------------------------------------------
JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)
Joker Name         | Cost | Offered | Bought | EndHeld |  RunWin% | AvgAnte | Avg Scaling Bonus 
------------------------------------------------------------------------------------------------
Daredevil          |   $5 |   13624 |   7542 |    7519 |    58.9% |    7.53 | +27.9 Mult        
The Shark          |   $7 |   14282 |  10134 |   10134 |    42.6% |    6.93 | -                 
BJ Tycoon          |   $7 |   14407 |  10227 |   10227 |    41.7% |    6.85 | -                 
Bust Cushion       |   $6 |   16362 |   7646 |    7521 |    39.5% |    6.63 | -                 
Minimalist         |   $6 |   16605 |   7655 |    7655 |    37.2% |    6.56 | -                 
Chip Stacker       |   $5 |   17082 |   7845 |    7601 |    33.9% |    6.28 | +27.7 Chips       
Ace Up Sleeve      |   $6 |   17293 |   7650 |    7516 |    33.4% |    6.38 | -                 
VIP High Roller    |   $5 |   17451 |   7598 |    6285 |    30.1% |    6.42 | -                 
Push It Good       |   $4 |   19608 |   7812 |    4264 |    21.0% |    5.64 | -                 
Card Counter       |   $4 |   28940 |   3282 |     455 |     0.0% |    1.82 | -                 
Sweet Sixteen      |   $5 |   28531 |   3093 |     553 |     0.0% |    2.16 | -                 
Lucky Sevens       |   $6 |   27973 |   3363 |     760 |     0.0% |    2.25 | -                 
Hit Me Baby        |   $5 |   28516 |   3076 |     391 |     0.0% |    2.09 | -                 
Gold Parachute     |   $5 |   28755 |   3262 |     650 |     0.0% |    1.94 | -                 
Safety Net         |   $5 |   28244 |   3191 |     249 |     0.0% |    2.11 | -                 
Even Steven        |   $4 |   28814 |   3323 |     282 |     0.0% |    1.78 | -                 
Red Velvet         |   $5 |   28453 |   3165 |     504 |     0.0% |    2.20 | -                 
Dark Knight        |   $5 |   28302 |   3056 |     229 |     0.0% |    2.25 | -                 
Compound Edge      |   $6 |   28270 |   3355 |     818 |     0.0% |    1.93 | -                 
--------------------------------------------------------------------------------
VOUCHER PERFORMANCE
  Extra Cushion        : Offered 15396 | Bought 13429 | Run Win Rate when bought: 33.1%
  Table Leverage       : Offered 14130 | Bought 13218 | Run Win Rate when bought: 33.7%
  VIP Lounge Pass      : Offered 16956 | Bought 14027 | Run Win Rate when bought: 31.7%
  High Stakes Table    : Offered 14944 | Bought 13140 | Run Win Rate when bought: 33.9%


================================================================================
BOT STRATEGY: High-Roller 21 AI (Faces/Aces/Doubles)
================================================================================
Runs Simulated        : 20,000 (1439 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : OFF
Hand Tiers +15%/Ante  : OFF
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 9.52% (1903 / 20000)
  Avg Final Ante      : 3.80
  Total Hands Played  : 782,990 (Avg 39.1 hands/run)
  BJ Hand Win Rate    : 45.63%
  Cause of Death      : 8.3% Scaling Wall (1507) | 91.7% Cold Shoe (16590)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 782,990 total hands)
  Natural Blackjack   :    42963 (5.49%)
  5-Card Charlie      :     9202 (1.18%)
  Exact 21 (3+ cards) :    42847 (5.47%)
  Standard Win        :   258383 (33.00%)
  Push (Tie)          :    62464 (7.98%)
  Dealer Win (Loss)   :   233962 (29.88%)
  Player Bust         :   133169 (17.01%)
  Double Down Win %   : 53.3% (36384/68230)
  Bust Cushion Saves  : 7878 hands (22 converted to 21)
  Safety Net Saves    : 12802 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  61.63% (12327 / 20000)
  Ante 2 Cleared      :  53.97% (10795 / 20000)
  Ante 3 Cleared      :  49.99% (9999 / 20000)
  Ante 4 Cleared      :  44.20% (8839 / 20000)
  Ante 5 Cleared      :  33.51% (6702 / 20000)
  Ante 6 Cleared      :  22.42% (4484 / 20000)
  Ante 7 Cleared      :  13.91% (2781 / 20000)
  Ante 8 Cleared      :   9.52% (1903 / 20000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |   20000 |   83.4% |      467 |     4.47 |    $14.0 |        0 |    3317
A1-Big     |     435 |   16683 |   86.6% |      744 |     4.16 |    $10.4 |      182 |    2048
A1-Boss    |     600 |   14453 |   85.3% |     1019 |     4.20 |    $12.0 |      253 |    1873
A2-Small   |     600 |   12327 |   95.6% |     1229 |     3.31 |    $10.6 |       12 |     527
A2-Big     |     870 |   11788 |   95.5% |     1647 |     3.40 |    $12.0 |        8 |     524
A2-Boss    |    1200 |   11256 |   95.9% |     2265 |     3.35 |    $13.9 |       19 |     442
A3-Small   |    1100 |   10795 |   98.9% |     2641 |     2.57 |    $15.3 |        2 |     115
A3-Big     |    1595 |   10678 |   98.3% |     3409 |     2.88 |    $21.4 |        4 |     179
A3-Boss    |    2200 |   10495 |   95.3% |     4244 |     3.18 |    $29.3 |        7 |     489
A4-Small   |    1800 |    9999 |   98.3% |     4255 |     2.82 |    $37.5 |        1 |     166
A4-Big     |    2610 |    9832 |   96.6% |     5469 |     3.29 |    $47.5 |        9 |     327
A4-Boss    |    3600 |    9496 |   93.1% |     6590 |     3.89 |    $59.0 |       40 |     617
A5-Small   |    2900 |    8839 |   96.4% |     6481 |     3.26 |    $68.9 |        6 |     308
A5-Big     |    4205 |    8525 |   93.0% |     8181 |     3.83 |    $79.8 |       33 |     566
A5-Boss    |    5800 |    7926 |   84.6% |    10028 |     4.51 |    $91.7 |      146 |    1078
A6-Small   |    4500 |    6702 |   93.7% |     9595 |     3.62 |   $102.1 |       27 |     395
A6-Big     |    6525 |    6280 |   87.8% |    11686 |     4.18 |   $113.7 |       92 |     673
A6-Boss    |    9000 |    5515 |   81.3% |    14143 |     4.68 |   $126.4 |      224 |     807
A7-Small   |    7000 |    4484 |   91.6% |    13604 |     3.74 |   $137.3 |       36 |     339
A7-Big     |   10150 |    4109 |   85.9% |    16972 |     4.30 |   $149.2 |      121 |     458
A7-Boss    |   14000 |    3530 |   78.8% |    21005 |     4.42 |   $161.6 |      121 |     628
A8-Small   |   10500 |    2781 |   91.8% |    19985 |     3.71 |   $172.8 |       34 |     195
A8-Big     |   15225 |    2552 |   89.6% |    25243 |     4.19 |   $184.6 |       52 |     213
A8-Boss    |   21000 |    2287 |   83.2% |    30893 |     4.80 |   $197.4 |       78 |     306
--------------------------------------------------------------------------------
JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)
Joker Name         | Cost | Offered | Bought | EndHeld |  RunWin% | AvgAnte | Avg Scaling Bonus 
------------------------------------------------------------------------------------------------
Daredevil          |   $5 |   19454 |   3468 |    3076 |    52.1% |    7.20 | +25.6 Mult        
The Shark          |   $7 |   13946 |   9875 |    9875 |    18.4% |    6.13 | -                 
Minimalist         |   $6 |   13337 |   9971 |    9971 |    18.2% |    6.10 | -                 
BJ Tycoon          |   $7 |   14159 |  10021 |   10021 |    18.0% |    6.05 | -                 
Ace Up Sleeve      |   $6 |   13917 |   9733 |    9733 |    16.2% |    5.99 | -                 
Chip Stacker       |   $5 |   13713 |  10089 |    9941 |    15.0% |    5.81 | +22.4 Chips       
VIP High Roller    |   $5 |   13325 |   9331 |    8679 |    12.5% |    6.00 | -                 
Compound Edge      |   $6 |   22227 |   3770 |    1574 |    11.4% |    3.56 | -                 
Dark Knight        |   $5 |   23650 |   3447 |     650 |     1.1% |    3.88 | -                 
Lucky Sevens       |   $6 |   22402 |   3810 |    1975 |     0.8% |    4.00 | -                 
Safety Net         |   $5 |   23486 |   3504 |     667 |     0.7% |    3.85 | -                 
Bust Cushion       |   $6 |   22301 |   3799 |    1951 |     0.5% |    4.02 | -                 
Red Velvet         |   $5 |   23818 |   3494 |    1082 |     0.3% |    3.26 | -                 
Even Steven        |   $4 |   24745 |   3542 |     382 |     0.3% |    2.42 | -                 
Gold Parachute     |   $5 |   24352 |   3499 |    1210 |     0.2% |    3.01 | -                 
Hit Me Baby        |   $5 |   23837 |   3372 |     899 |     0.2% |    3.43 | -                 
Card Counter       |   $4 |   25029 |   3377 |     524 |     0.0% |    2.22 | -                 
Sweet Sixteen      |   $5 |   23948 |   3574 |    1123 |     0.0% |    3.16 | -                 
Push It Good       |   $4 |   24824 |   3382 |     500 |     0.0% |    2.35 | -                 
--------------------------------------------------------------------------------
VOUCHER PERFORMANCE
  Extra Cushion        : Offered 15426 | Bought 13500 | Run Win Rate when bought: 14.1%
  Table Leverage       : Offered 14053 | Bought 13198 | Run Win Rate when bought: 14.4%
  VIP Lounge Pass      : Offered 16915 | Bought 14067 | Run Win Rate when bought: 13.5%
  High Stakes Table    : Offered 14981 | Bought 13265 | Run Win Rate when bought: 14.3%


================================================================================
BOT STRATEGY: Low-Card Charlie AI (Hits Low Cards)
================================================================================
Runs Simulated        : 20,000 (1724 ms)
Starting Deals/Blind  : 7
Target Score Scaling  : 100%
Unused Deal Cash Cap  : $6
Pushes Refund Deal    : OFF
Hand Tiers +15%/Ante  : OFF
--------------------------------------------------------------------------------
OVERALL KPI SUMMARY
  Ante 8 Victory Rate : 29.28% (5856 / 20000)
  Avg Final Ante      : 4.20
  Total Hands Played  : 817,558 (Avg 40.9 hands/run)
  BJ Hand Win Rate    : 46.92%
  Cause of Death      : 9.9% Scaling Wall (1403) | 90.1% Cold Shoe (12741)
--------------------------------------------------------------------------------
HAND OUTCOME BREAKDOWN (% of 817,558 total hands)
  Natural Blackjack   :    41761 (5.11%)
  5-Card Charlie      :    16676 (2.04%)
  Exact 21 (3+ cards) :    67536 (8.26%)
  Standard Win        :   254433 (31.12%)
  Push (Tie)          :    68586 (8.39%)
  Dealer Win (Loss)   :   220379 (26.96%)
  Player Bust         :   148187 (18.13%)
  Double Down Win %   : 52.1% (2870/5504)
  Bust Cushion Saves  : 27531 hands (22 converted to 21)
  Safety Net Saves    : 61278 busts scored
--------------------------------------------------------------------------------
ANTE SURVIVAL FUNNEL (% of runs clearing all 3 Blinds of Ante)
  Ante 1 Cleared      :  60.64% (12128 / 20000)
  Ante 2 Cleared      :  53.97% (10795 / 20000)
  Ante 3 Cleared      :  50.68% (10136 / 20000)
  Ante 4 Cleared      :  47.70% (9539 / 20000)
  Ante 5 Cleared      :  41.40% (8281 / 20000)
  Ante 6 Cleared      :  35.13% (7027 / 20000)
  Ante 7 Cleared      :  30.89% (6177 / 20000)
  Ante 8 Cleared      :  29.28% (5856 / 20000)
--------------------------------------------------------------------------------
BLIND-BY-BLIND PROGRESSION & DEATH DIAGNOSTICS (24 BLINDS)
Blind      |  Target | Entered |  Clear% | AvgScore | AvgDeals | AvgCash$ | ScaleDth | ShoeDth
------------------------------------------------------------------------------------------------
A1-Small   |     300 |   20000 |   81.7% |      463 |     4.64 |    $13.9 |        0 |    3667
A1-Big     |     435 |   16333 |   86.9% |      711 |     4.24 |    $10.3 |      196 |    1939
A1-Boss    |     600 |   14198 |   85.4% |      969 |     4.27 |    $11.9 |      245 |    1825
A2-Small   |     600 |   12128 |   96.1% |     1161 |     3.29 |    $10.6 |        5 |     462
A2-Big     |     870 |   11661 |   96.2% |     1578 |     3.34 |    $11.9 |        9 |     436
A2-Boss    |    1200 |   11216 |   96.2% |     2163 |     3.27 |    $13.7 |       16 |     405
A3-Small   |    1100 |   10795 |   98.9% |     2549 |     2.48 |    $14.9 |        1 |     120
A3-Big     |    1595 |   10674 |   98.6% |     3252 |     2.72 |    $20.4 |        2 |     149
A3-Boss    |    2200 |   10523 |   96.3% |     4008 |     3.00 |    $27.8 |       10 |     377
A4-Small   |    1800 |   10136 |   99.2% |     3769 |     2.55 |    $35.9 |        0 |      82
A4-Big     |    2610 |   10054 |   98.1% |     4775 |     2.93 |    $46.4 |       13 |     175
A4-Boss    |    3600 |    9866 |   96.7% |     5899 |     3.35 |    $58.7 |       44 |     283
A5-Small   |    2900 |    9539 |   98.3% |     5499 |     2.79 |    $69.5 |       13 |     151
A5-Big     |    4205 |    9375 |   96.4% |     7044 |     3.27 |    $81.4 |       57 |     278
A5-Boss    |    5800 |    9040 |   91.6% |     8881 |     3.90 |    $94.4 |      184 |     575
A6-Small   |    4500 |    8281 |   97.6% |     7989 |     2.91 |   $105.6 |       39 |     161
A6-Big     |    6525 |    8081 |   94.6% |    10321 |     3.41 |   $118.1 |      111 |     327
A6-Boss    |    9000 |    7643 |   91.9% |    12978 |     3.85 |   $131.6 |      221 |     395
A7-Small   |    7000 |    7027 |   97.4% |    11937 |     2.88 |   $143.2 |       41 |     145
A7-Big     |   10150 |    6841 |   96.2% |    15483 |     3.34 |   $155.8 |       88 |     174
A7-Boss    |   14000 |    6579 |   93.9% |    19285 |     3.67 |   $168.4 |       84 |     318
A8-Small   |   10500 |    6177 |   99.2% |    17022 |     2.85 |   $180.1 |        9 |      41
A8-Big     |   15225 |    6127 |   98.4% |    22069 |     3.43 |   $192.8 |        8 |      90
A8-Boss    |   21000 |    6029 |   97.1% |    28038 |     4.03 |   $206.3 |        7 |     166
--------------------------------------------------------------------------------
JOKER PERFORMANCE LEADERBOARD (Sorted by End-of-Run Win Rate)
Joker Name         | Cost | Offered | Bought | EndHeld |  RunWin% | AvgAnte | Avg Scaling Bonus 
------------------------------------------------------------------------------------------------
Daredevil          |   $5 |   13308 |   7462 |    7462 |    78.4% |    8.08 | +38.4 Mult        
Safety Net         |   $5 |   15432 |   7480 |    7480 |    55.9% |    7.35 | -                 
Hit Me Baby        |   $5 |   16158 |   7572 |    7572 |    49.0% |    7.07 | -                 
Bust Cushion       |   $6 |   16961 |   7771 |    7771 |    48.7% |    6.85 | -                 
Minimalist         |   $6 |   17891 |   7330 |    7330 |    47.6% |    6.86 | -                 
Card Counter       |   $4 |   16628 |   7780 |    7780 |    47.4% |    6.79 | -                 
The Shark          |   $7 |   18245 |   7225 |    7225 |    47.3% |    6.85 | -                 
BJ Tycoon          |   $7 |   18461 |   7388 |    7388 |    46.3% |    6.75 | -                 
Sweet Sixteen      |   $5 |   17269 |   7879 |    7879 |    44.4% |    6.61 | -                 
Chip Stacker       |   $5 |   29570 |   3143 |     913 |    11.0% |    3.54 | +24.4 Chips       
VIP High Roller    |   $5 |   29763 |   3013 |     280 |     0.0% |    2.10 | -                 
Ace Up Sleeve      |   $6 |   29625 |   3166 |     589 |     0.0% |    2.23 | -                 
Lucky Sevens       |   $6 |   29335 |   3176 |     587 |     0.0% |    2.17 | -                 
Gold Parachute     |   $5 |   30229 |   3026 |     503 |     0.0% |    1.96 | -                 
Push It Good       |   $4 |   29889 |   3324 |     355 |     0.0% |    1.89 | -                 
Even Steven        |   $4 |   29944 |   3271 |     227 |     0.0% |    1.89 | -                 
Red Velvet         |   $5 |   29899 |   3030 |     436 |     0.0% |    1.95 | -                 
Dark Knight        |   $5 |   29880 |   3021 |     210 |     0.0% |    2.06 | -                 
Compound Edge      |   $6 |   29871 |   3170 |     720 |     0.0% |    1.88 | -                 
--------------------------------------------------------------------------------
VOUCHER PERFORMANCE
  Extra Cushion        : Offered 15203 | Bought 13263 | Run Win Rate when bought: 44.2%
  Table Leverage       : Offered 13962 | Bought 13033 | Run Win Rate when bought: 44.9%
  VIP Lounge Pass      : Offered 16725 | Bought 13867 | Run Win Rate when bought: 42.2%
  High Stakes Table    : Offered 14818 | Bought 13113 | Run Win Rate when bought: 44.7%
