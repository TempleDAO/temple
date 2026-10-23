# FixedPriceAuction invariants

The properties the contracts must always keep. The fuzz and invariant suites are built from this list: each property names where it's checked, and a property with no check is a test gap.

"Owed" means the auction's liability counters, `bidOwed` and `fillOwed`. "Excluded" means the bid tokens `exclude` has moved out of the fill into `excluded[account]`. "Claimants" means the depositors plus the treasury. "Stray" means tokens sent to the auction by plain transfer rather than through `deposit` or `fund`.

## Solvency

| ID | Property | Checked by |
|---|---|---|
| S1 | The auction's balance of each token is at least what it owes, and equals it once stray transfers are subtracted. | `invariant_balancesCoverOwed`; `afterInvariant` after the drain; fuzz `test_fuzz_liabilitiesAlwaysHeld` after every step and `_checkClaims` |
| S2 | `totalDeposits` equals the sum of every account's `deposits`; excluded balances aren't in it. | `invariant_totalDepositsIsSumOfDeposits` |
| S3 | Before an outcome, `bidOwed` equals `totalDeposits` plus every excluded balance, and `fillOwed` equals funding minus excess withdrawn. | `invariant_owedMatchesBooks` |
| S4 | After an outcome, what's owed covers every unpaid claim (users and treasury) and every excluded balance in each token, with a surplus under one wei per claimant. | `invariant_owedCoversClaims` |
| S5 | `recoverToken` never takes the balance below what's owed. | handler `recoverToken` ("recoverToken took owed funds", "recoverToken != stray tally"); `invariant_balancesCoverOwed` |
| S6 | Liveness: once unpaused, unblocked and past `fulfillmentEnd` (or cancelled), every depositor and the treasury can claim and every excluded balance can be withdrawn without a revert, and afterwards what's owed is under the number of claimants. | `afterInvariant` (handler `drain`: lifts rescue mode, pause, both compliance lists and the fill token's blocklist, then every depositor and the treasury claim and every excluded balance is withdrawn, with no try/catch; "excluded balance not paid out"); fuzz `test_fuzz_liabilitiesAlwaysHeld` finish |

## Settlement maths

| ID | Property | Checked by |
|---|---|---|
| M1 | `filledDeposits + userRefund == totalDeposits`, and `userFunding + funderRefund` equals `fillOwed` at settlement. | `invariant_settlementMaths`; fuzz `_checkSplit` |
| M2 | Required funding rounds up; `userFunding` is at most `filledDeposits × price / priceDenominator`, rounded down. | `invariant_settlementMaths`; handler `withdrawExcess` (funding left after withdrawing the full excess still covers every deposit); fuzz `_checkSplit` |
| M3 | `filledDeposits` is the rounded-up cost of `userFunding`, so in aggregate bidders never pay for a fraction of a fill-token wei they don't get. Each bidder's fill and refund round down separately, so a bidder can lose dust. In a settled auction, funding that covers the rounded-up requirement makes `userFunding` equal `floor(totalDeposits × price / priceDenominator)`, and only bid tokens worth less than one fill-token wei are refunded. | `invariant_settlementMaths`; fuzz `_checkSplit` (a quarter of runs fund exactly the rounded-up requirement) |
| M4 | `userFunding == 0` implies `filledDeposits == 0`: no bid tokens are taken for nothing. | `invariant_settlementMaths`; fuzz `_checkSplit` |
| M5 | Each bidder's fill and refund are within one wei of their exact pro-rata share, and never above it. | fuzz `_checkClaims` in `test_fuzz_settlementMaths*`: each share equals OpenZeppelin `Math.mulDiv(deposit, pool, totalDeposits)`, the exact pro-rata share rounded down |
| M6 | A cancel refunds exactly: every depositor gets their whole deposit and the funder all its funding, with no dust. | `invariant_cancelRefundsExactly`; `afterInvariant` (no dust after a cancel); fuzz `test_fuzz_liabilitiesAlwaysHeld` (owed is zero after a cancel) |
| M7 | Once `fulfillmentEnd` passes, the phase is final and `previewSettlement` equals the snapshot the auction eventually stores. | `invariant_outcomeFrozen` ("not final at fulfillmentEnd"); handler `_checkPreviewAfterEnd` ("settlement preview moved after fulfillmentEnd"), run after every action and the drain |

## Lifecycle

| ID | Property | Checked by |
|---|---|---|
| L1 | Once set, the outcome, the settlement snapshot and `settledAt` never change, and Settled and Cancelled are exclusive. | `invariant_outcomeFrozen`; `invariant_outcomeEmittedOnceAndMatchesSnapshot` ("both settled and cancelled") |
| L2 | Each action works only in its phase: deposits and withdrawals in Deposit, funding and excess withdrawal in Fulfillment, `cancel` while unsettled and before `fulfillmentEnd`, claims once Settled or Cancelled. | handler phase checks on every successful call (`_checkPhase`, "claim before an outcome", "cancel after an outcome or fulfillmentEnd", "msig cancel not exactly while open", "endFulfillment refused in Fulfillment"); unit `FixedPriceAuctionLifecycleTest` |
| L3 | No account and no treasury claims twice. | handler `_bookClaim` ("account claimed twice") and `_bookTreasuryClaim` ("treasury claimed twice") |
| L4 | `AuctionSettled` is emitted exactly once, with fields equal to the stored snapshot; `AuctionCancelled` exactly once on cancel; never both. | handler `_countOutcomeEvents` (each event's fields against the stored settlement; logs of reverted claims dropped); `invariant_outcomeEmittedOnceAndMatchesSnapshot`, also after the drain |
| L5 | `withdrawableExcess()` is exactly what `withdrawExcess` accepts: one wei more reverts, and it's zero while paused or outside Fulfillment. | handler `withdrawExcess` ("withdrawExcess disagrees with withdrawableExcess", tries the view, the view plus one wei and random amounts) |

## Pause and rescue mode

| ID | Property | Checked by |
|---|---|---|
| P1 | While paused, no tokens move. `endFulfillment`, `cancel`, `exclude`, `reinstate` and the setters still work. | handler `_checkPaused` (every token-moving call reverts and no state changes); handler `endFulfillment`, `cancel`, `setPausedByMsig`, `setComplianceCheck` succeed exactly when allowed, paused or not; E2 and E3 for `exclude` and `reinstate` |
| P2 | In rescue mode, every msig elevated action reverts, on the auction and on the factory. | auction: handler `_checkRescueMode` on every msig call, `proposeExecutor`, and the exact-success checks; factory: fuzz `test_fuzz_factoryRulesHold` ("createAuction not gated on rescue mode", "msig proposal not gated on rescue mode", "executor proposal not gated on rescue mode") |
| P3 | In rescue mode the rescuer can only pause, unpause, `cancel`, disable compliance, switch rescue mode, and hand over its own role. It can never `endFulfillment`, `recoverToken`, repoint compliance, `exclude`, `reinstate`, create auctions or propose code. | handler `setPausedByRescuer`, `cancelByRescuer`, `setRescueMode`, `disableComplianceCheck`, `proposeRescuer`, `rescuerOverreach`; handler `exclude` and `reinstate`, which include the rescuer among their callers; unit `test_exclude_access`, `test_exclude_access_rescueMode`; factory: fuzz `test_fuzz_factoryRulesHold` ("rescuer used an msig power") |
| P4 | No executor proposal exists while rescue mode is on, and on the factory no implementation proposal either. | `invariant_rolesStaySeparate`; fuzz `test_fuzz_liabilitiesAlwaysHeld` and `test_fuzz_factoryRulesHold` after every step |
| P5 | The executor and the rescuer are never the same address, under any order of handovers. | `invariant_rolesStaySeparate` (handler `proposeExecutor`/`acceptExecutor`/`proposeRescuer`/`acceptRescuer` over a candidate pool shared by both roles); fuzz `test_fuzz_liabilitiesAlwaysHeld` and `test_fuzz_factoryRulesHold` |
| P6 | A proposed executor can accept only `EXECUTOR_HANDOVER_DELAY` (1 day) after the latest proposal; a re-proposal restarts the clock. | unit `test_executorHandover`; handler `acceptExecutor` ("acceptExecutor: refused other than for the rescuer or the delay") |

## Compliance

| ID | Property | Checked by |
|---|---|---|
| C1 | A blocked account's `deposits`, `claimed` and `excluded` can't change by its own hand: its deposit, withdrawal, claim and `withdrawExcluded` revert. Only `exclude` moves a blocked account's deposit. | handler `_post` ("blocked call succeeded", "blocked state changed") on `deposit`, `withdrawDeposit`, `claim`, `withdrawExcluded`; handler `withdrawExcluded` ("failed withdrawExcluded moved the balance") |
| C2 | The compliance pointer is never zero. Once compliance is disabled it stays disabled, and the pointer is frozen. | `invariant_compliancePointer` |
| C3 | The treasury paths (`fund`, `withdrawExcess`, `claimTreasury`) are never screened. | handler `fund` ("fund refused while open"), `claimTreasury` ("claimTreasury refused while due") and `withdrawExcess`, with `setBlocked` also blocking the funder and the treasury caller; unit `test_treasuryPaths_unscreened` |

## Exclusion

| ID | Property | Checked by |
|---|---|---|
| E1 | An excluded balance is never in the fill: `exclude` moves exactly the account's whole deposit out of `deposits` and `totalDeposits` into `excluded`, and `reinstate` moves exactly the excluded balance back. Claims and the settlement only ever use `deposits` and `totalDeposits`. | handler `exclude` ("exclude didn't move exactly the deposit"), `reinstate` ("reinstate didn't move exactly the excluded balance"); S2; unit `FixedPriceAuctionExclusionTest` (an excluded bidder's `claim` reverts `NothingToClaim` unless it deposits again once cleared during Deposit, and then only that new deposit is filled: `test_excludeInDeposit_redeposit_onlyNewDepositFills`) |
| E2 | `exclude` succeeds exactly when the caller is the msig or is a blocker on the current list, both outside rescue mode, the phase is Deposit or Fulfillment (so never after `fulfillmentEnd`, an early settlement or a cancel), compliance is enabled, the account is blocked, and it has a deposit. Pause doesn't stop it. | handler `exclude` ("exclude not exactly when allowed", "failed exclude changed state"); unit `test_exclude_access*`, `test_excludeInFulfillment_afterFullFunding`, `test_removedBlocker_losesExcludeAndReinstate`, `test_exclude_fail`, `test_paused`, `test_flaggedAfterSettlement_notExcluded` |
| E3 | `reinstate` succeeds exactly when the caller is the msig or, while compliance is enabled, is a blocker on the current list, rescue mode is off, the phase is Deposit, the account isn't blocked and it has an excluded balance. Pause doesn't stop it. | handler `reinstate` ("reinstate not exactly when allowed", "failed reinstate changed state"); unit `test_reinstate_fail`, `test_removedBlocker_losesExcludeAndReinstate`, `test_complianceDisabled_blockerCannotReinstate`, `test_exclude_access_rescueMode`, `test_reinstate_fail_fundingOverflow` (the deposit overflow guard re-runs) |
| E4 | Excluded balances are always held: the bid-token balance covers deposits plus excluded balances before an outcome, and unpaid claims plus excluded balances after. `recoverToken` can never take them. | S1, S3, S4 (`bidOwed` counts excluded balances until `withdrawExcluded`); unit `test_bidOwed_coversExcluded` |
| E5 | Only the owner can withdraw an excluded balance, all of it, in any phase, once unpaused and not blocked (blocked or not, once compliance is disabled). | handler `withdrawExcluded` ("withdrawExcluded not exactly when allowed", "withdrawExcluded didn't pay exactly the excluded balance"); unit `test_complianceDisabled_excludeReverts_withdrawExcludedWorks`, `test_cancel_withExcludedBalance` |
| E6 | Exclusion never changes another bidder's share except by removing the excluded deposit from the total: no other account's deposit moves, and no tokens move. | handler `_checkOnlyMoved` ("exclude moved another deposit", "reinstate moved another deposit", "exclude moved tokens", "reinstate moved tokens") |

## Factory

| ID | Property | Checked by |
|---|---|---|
| F1 | Every auction with `isAuction` true is a clone of an implementation the rescuer accepted (or the constructor's), initialized once, with the factory's executor and its rescuer at creation. | fuzz `test_fuzz_factoryRulesHold` (`_checkCreated`: recorded, `LibClone.implementationOf` is the current and an accepted implementation, roles of the day, second `initialize` reverts) |
| F2 | `implementation` changes only through `acceptImplementation`, and only to the address currently proposed. | fuzz `test_fuzz_factoryRulesHold` ("implementation moved without an accept", "accept not exactly the proposal") |
| F3 | The implementation contract itself can never be initialized or move tokens. | unit `test_initialize_fail_implementation`, `test_implementation_neverMovesTokens`. Unit, not a property test: it is one fixed contract with no state to explore. The token-moving calls revert only incidentally (the implementation has no clone args, so `_config()` decodes its own runtime code and reverts with empty data, and every call that reads the config reverts), not through an explicit guard |
| F4 | The implementation is never an address without code, in the constructor or at proposal. | unit `test_constructor_validation`, `test_swapImplementation_twoKeys` (a code-less proposal) |
| F5 | Both tokens have 6 to 18 decimals; `initialize` rejects anything else. | factory `test_createAuction_configValidation` (19- and 5-decimal tokens) |

## Wishing Well

| ID | Property | Checked by |
|---|---|---|
| W1 | `wishOf(account, from, to)` and its `WishSet` event equal the inputs of the last wish for that key, and only `account` can change it. | fuzz `test_fuzz_wishMatchesInputs` |
