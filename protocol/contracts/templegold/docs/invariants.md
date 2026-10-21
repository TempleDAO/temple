# FixedPriceAuction invariants

The properties the contracts must always keep. The fuzz and invariant suites are built from this list: each property names where it's checked, and a property with no check is a test gap.

"Unpaid" means what the auction still has to pay, computed by the test from deposits, claimed flags and the settlement split: every deposit and all `funding` until the phase is final, then each unclaimed bidder's pro-rata shares and the unclaimed treasury legs. The auction keeps no liability counters. "Held" means the auction's balance of a token less its stray transfers. "Final" means the phase is Settled (by the clock or `endFulfillment`) or Cancelled. "Claimants" means the depositors plus the treasury. "Stray" means tokens sent to the auction by plain transfer rather than through `deposit` or `fund`.

## Solvency

| ID | Property | Checked by |
|---|---|---|
| S1 | Held equals what came in less what was paid out, and is at least what's unpaid in each token; the surplus is rounding dust, none before final or on a cancel. | `invariant_balancesCoverOwed`; `afterInvariant` after the drain; fuzz `_assertUnpaidHeld` in `test_fuzz_liabilitiesAlwaysHeld` after every step, in `_checkClaims` and `test_settlement_atOverflowBound` |
| S2 | `totalDeposits` equals the sum of every account's `deposits`. | `invariant_totalDepositsIsSumOfDeposits` |
| S3 | `funding()` always equals what was funded minus the excess withdrawn; claims never move it. (The `bidOwed == totalDeposits` half is gone with the counter.) | `invariant_fundingMatchesBooks` |
| S4 | Once final, held covers every unpaid claim as the `claimable` and `treasuryClaimable` views report it, with a surplus under one wei per claimant. | `invariant_owedCoversClaims` |
| S5 | `recoverToken` always reverts for the bid and fill tokens, stray or not, and recovers any other token in full. A donation of either auction token changes no payout. | handler `recoverToken` ("recoverToken took the auction's own tokens or more than the stray", "recoverToken != recoverable"); `invariant_balancesCoverOwed`; unit `test_recoverToken_ownTokensNever_donationChangesNoPayout` |
| S6 | Liveness: once unpaused, unblocked and past `fulfillmentEnd` (or cancelled), every depositor and the treasury can claim without a revert, and afterwards held is under the number of claimants. | `afterInvariant` (handler `drain`: lifts rescue mode, pause, both compliance lists and the fill token's blocklist, then every depositor and the treasury claim with no try/catch); fuzz `test_fuzz_liabilitiesAlwaysHeld` finish |

## Settlement maths

| ID | Property | Checked by |
|---|---|---|
| M1 | `filledDeposits + userRefund == totalDeposits`, and `userFunding + funderRefund == funding`. | `invariant_settlementMaths`; fuzz `_checkSplit` |
| M2 | Required funding rounds up; `userFunding` is at most `filledDeposits × price / priceDenominator`, rounded down. | `invariant_settlementMaths`; handler `withdrawExcess` (funding left after withdrawing the full excess still covers every deposit); fuzz `_checkSplit` |
| M3 | Funding that covers the rounded-up requirement fills every deposit, unless all deposits together buy less than one fill-token wei. | `invariant_settlementMaths`; fuzz `_checkSplit` (a quarter of runs fund exactly the rounded-up requirement) |
| M4 | `userFunding == 0` implies `filledDeposits == 0`: no bid tokens are taken for nothing. | `invariant_settlementMaths`; fuzz `_checkSplit` |
| M5 | Each bidder's fill and refund are within one wei of their exact pro-rata share, and never above it. | fuzz `_checkClaims` in `test_fuzz_settlementMaths*`: each share equals OpenZeppelin `Math.mulDiv(deposit, pool, totalDeposits)`, the exact pro-rata share rounded down |
| M6 | A cancel refunds exactly: every depositor gets their whole deposit and the funder all its funding, with no dust. | `invariant_cancelRefundsExactly`; `afterInvariant` (no dust after a cancel); fuzz `_assertUnpaidHeld` (no surplus after a cancel) |
| M7 | Folded into L1: there is no stored snapshot for the preview to differ from. Once `fulfillmentEnd` passes the phase is final, and L1 holds the preview fixed from then. | `invariant_outcomeFrozen` |

## Lifecycle

| ID | Property | Checked by |
|---|---|---|
| L1 | Once the phase is final, by the clock or a call, the phase, `previewSettlement()` and `endedAt` never change, and Settled and Cancelled are exclusive. | `invariant_outcomeFrozen`; `invariant_outcomeEmittedOnceAndMatchesSnapshot` ("both settled and cancelled") |
| L2 | Each action works only in its phase: deposits and withdrawals in Deposit, funding and excess withdrawal in Fulfillment, `cancel` while unsettled and before `fulfillmentEnd`, claims once Settled or Cancelled. | handler phase checks on every successful call (`_checkPhase`, "claim before an outcome", "cancel after an outcome or fulfillmentEnd", "msig cancel not exactly while open", "endFulfillment refused in Fulfillment"); unit `FixedPriceAuctionLifecycleTest` |
| L3 | No account and no treasury claims twice. | handler `_bookClaim` ("account claimed twice") and `_bookTreasuryClaim` ("treasury claimed twice") |
| L4 | `AuctionSettled` is emitted only by `endFulfillment`, once, with `endedAt` and fields equal to `previewSettlement()`; a settlement by the clock emits nothing; `AuctionCancelled` exactly once on cancel; never both. | handler `_countOutcomeEvents` (each event's fields against the settlement); `invariant_outcomeEmittedOnceAndMatchesSnapshot` (`AuctionSettled` seen exactly when `endedAt` is set), also after the drain; unit `test_claim_atFulfillmentEnd_emitsNoSettlement` |
| L5 | `withdrawableExcess()` is exactly what `withdrawExcess` accepts: one wei more reverts, and it's zero while paused or outside Fulfillment. | handler `withdrawExcess` ("withdrawExcess disagrees with withdrawableExcess", tries the view, the view plus one wei and random amounts) |

## Pause and rescue mode

| ID | Property | Checked by |
|---|---|---|
| P1 | While paused, no tokens move. `endFulfillment`, `cancel` and the setters still work. | handler `_checkPaused` (every token-moving call reverts and no state changes); handler `endFulfillment`, `cancel`, `setPausedByMsig`, `setComplianceCheck` succeed exactly when allowed, paused or not |
| P2 | In rescue mode, every msig elevated action reverts, on the auction and on the factory. | auction: handler `_checkRescueMode` on every msig call, `proposeExecutor`, and the exact-success checks; factory: fuzz `test_fuzz_factoryRulesHold` ("createAuction not gated on rescue mode", "msig proposal not gated on rescue mode", "executor proposal not gated on rescue mode") |
| P3 | In rescue mode the rescuer can only pause, unpause, `cancel`, disable compliance, switch rescue mode, and hand over its own role. It can never `endFulfillment`, `recoverToken`, repoint compliance, create auctions or propose code. | handler `setPausedByRescuer`, `cancelByRescuer`, `setRescueMode`, `disableComplianceCheck`, `proposeRescuer`, `rescuerOverreach`; factory: fuzz `test_fuzz_factoryRulesHold` ("rescuer used an msig power") |
| P4 | No executor proposal exists while rescue mode is on, and on the factory no implementation proposal either. | `invariant_rolesStaySeparate`; fuzz `test_fuzz_liabilitiesAlwaysHeld` and `test_fuzz_factoryRulesHold` after every step |
| P5 | The executor and the rescuer are never the same address, under any order of handovers. | `invariant_rolesStaySeparate` (handler `proposeExecutor`/`acceptExecutor`/`proposeRescuer`/`acceptRescuer` over a candidate pool shared by both roles); fuzz `test_fuzz_liabilitiesAlwaysHeld` and `test_fuzz_factoryRulesHold` |

## Compliance

| ID | Property | Checked by |
|---|---|---|
| C1 | A blocked account's `deposits` and `claimed` can't change: its deposit, withdrawal and claim revert. | handler `_post` ("blocked call succeeded", "blocked state changed") on `deposit`, `withdrawDeposit`, `claim` |
| C2 | The compliance pointer is never zero. Once compliance is disabled it stays disabled, and the pointer is frozen. | `invariant_compliancePointer` |
| C3 | The treasury paths (`fund`, `withdrawExcess`, `claimTreasury`) are never screened. | handler `fund` ("fund refused while open"), `claimTreasury` ("claimTreasury refused while due") and `withdrawExcess`, with `setBlocked` also blocking the funder and the treasury caller; unit `test_treasuryPaths_unscreened` |

## Factory

| ID | Property | Checked by |
|---|---|---|
| F1 | Every auction with `isAuction` true is a clone of an implementation the rescuer accepted (or the constructor's), initialized once, with the factory's executor and its rescuer at creation. | fuzz `test_fuzz_factoryRulesHold` (`_checkCreated`: recorded, `LibClone.implementationOf` is the current and an accepted implementation, roles of the day, second `initialize` reverts) |
| F2 | `implementation` changes only through `acceptImplementation`, and only to the address currently proposed. | fuzz `test_fuzz_factoryRulesHold` ("implementation moved without an accept", "accept not exactly the proposal") |
| F3 | The implementation contract itself can never be initialized or move tokens. | unit `test_initialize_fail_implementation`, `test_implementation_neverMovesTokens`. Unit, not a property test: it is one fixed contract with no state to explore. The token-moving calls revert only incidentally (the implementation has no clone args, so its config and compliance pointer read as zero), not through an explicit guard |

## Wishing Well

| ID | Property | Checked by |
|---|---|---|
| W1 | `wishOf(account, from, to)` equals the values in the last `WishSet` for that key, and only `account` can change it. | fuzz `test_fuzz_wishMatchesLastWishSet` |
