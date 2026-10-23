# Threat analysis, resolved and closed: simplified FixedPriceAuction, clone AuctionFactory, ComplianceCheck and WishingWell

Companion to [threat-analysis-fpa-simplified.md](threat-analysis-fpa-simplified.md), which keeps the decisions for the team, the open and fixed findings, operational risks and test gaps. Everything here is resolved, checked and found to hold, or kept for traceability. Scope, method and line-number conventions are the same as there; finding numbers (T-n) and decision numbers (D-n) refer to that file.

## Resolved findings

Resolved since round 1: a pending executor proposal now dies when rescue mode switches on, and so does a pending implementation proposal on the factory. The rescuer can `cancel` in rescue mode, which ends the permanent-freeze case of unbounded windows ([T-3](#t-3-unbounded-windows-resolved-low)).

### T-2 (resolved part) Pending proposals die in rescue mode
A proposal the hijacked msig leaves *pending* now dies when rescue mode switches on (`RescuableAccess.sol:35-39`), and nobody can propose during rescue mode. On the factory, rescue mode also cancels a pending implementation proposal (`AuctionFactory.sol:57-62`). The open part of T-2, an atomic propose-and-accept, is fixed on the factory and auctions by D11's one-day delay. On `ComplianceCheck` the msig can overwrite a proposal within the day (T-2).

### T-3 Unbounded windows (resolved, Low)
**Low.** Proven (`test_XC_farFulfillmentEnd_rescuerCancels`, 100 years in). `FixedPriceAuction.sol:86-93`, `:231-242`.
- **Before:** in round 1 a far-future `fulfillmentEnd` froze deposits for good, because the rescuer couldn't end an auction.
- **Now:** the rescuer can `cancel` in rescue mode at any time before `fulfillmentEnd`, which refunds everyone. With a far-future `fulfillmentEnd` that's always available.
- **Residual:** depositors have no exit between `depositEnd` and whenever a multisig acts. "Genuine auctions finish under rescue mode by the clock" is false for a long window: in rescue mode they can only be cancelled, never settled. A freeze is permanent only if the rescuer is lost too.
- **Mitigation:** a maximum fulfillment window is optional insurance, part of D1.

### T-13 A `proposeNewExecutor` grant on `ComplianceCheck` handed over the list (resolved by design)
**Resolved by design:** `ComplianceCheck` has no per-function grants; a blocker can only edit the list. Proven (`test_proposeNewExecutor_fail_blocker`). `ComplianceCheck.sol:22-36`.
- **Before:** `ComplianceCheck` had per-function grants. A `proposeNewExecutor` grantee could propose itself, accept, and own the list (Medium: likelihood Low, impact High).
- **Now:** the msig appoints blockers with `setBlocker`, and on `ComplianceCheck` a blocker can only call `setBlocked`. `proposeNewExecutor` and `setBlocker` are executor-only. D6 is resolved the same way.

### Test gaps closed

The branch now has tests for the rescuer's cancel, proposal cancellation on rescue mode, settlement at the overflow bound, and 226 hand-written mutants of which only behaviour-equivalent ones survive.

A later round ran slither-mutate over the six contracts (1,127 compiled mutants) and applied every operand of every `||`/`&&` chain and ternary by hand, at the gate's full fuzz and invariant settings. Every survivor that changes behaviour now has a test: deposit timings strictly out of order (a start in the past, a start after the end, an end after fulfillment); zero-amount claim legs to a recipient blocklisted on that token; and a stray token whose address sorts above the auction tokens. Duplicated tests were removed only where running the suite without them showed every mutant they killed is still killed by another test.

## Checked and found closed

- **Stealing others' funds:** claims pay `msg.sender` only. Each share is `floor(d·X/T)`, so the shares sum to at most the snapshot. The treasury takes exactly `filledDeposits` and `funderRefund`.
- **Solvency at extremes:** holds for decimals 0–18 both ways (`initialize` now requires 6–18), prices up to 2^200, and funding up to 2^250. The deposit-time `_requiredFunding` guard bounds every later `mulDiv`. The branch now has a test at the overflow bound.
- **Lazy settlement can't drift:** after `fulfillmentEnd` nothing can change `totalDeposits` or `fillOwed` until the snapshot is written, so whoever settles first computes the same numbers.
- **Phase boundaries:** `depositEnd` and `fulfillmentEnd` each start the next phase, consistently across `_phase`, `cancel` and `_settleIfDue`.
- **Front-running bidders:** deposits close before any funding, and `withdrawExcess` is computed against a fixed requirement.
- **Reentrancy:** state is written before every transfer, and a recipient-hook token re-entering `claim` hits `AlreadyClaimed`. `isBlocked` is a view and runs as a STATICCALL.
- **Claims can't be DoS'd:** there are no loops. A claim whose shares both round to zero still succeeds.
- **Donations:** settlement and `recoverToken` use the owed counters, not balances, so a stray transfer changes nothing.
- **Exclusion accounting** (unit and invariant tests, not the analysis rounds): an excluded balance is never in the fill, stays held in the auction, and only its owner can withdraw it, once not flagged. `reinstate` works only during Deposit and re-runs the deposit overflow guard. `recoverToken` can't reach excluded balances.
- **Rescuer cancel:** refunds exactly (`amount·T/T`) and can't redirect funds. It closes cleanly against `endFulfillment` in both directions and moves with a rescuer handover. The rescuer still can't `endFulfillment`, `recoverToken`, `setComplianceCheck`, `createAuction` or `proposeImplementation`.
- **Factory and clones:**
  - **Swap safety:** acceptance is by address, so a proposal swapped after review reverts. Rescue mode on the factory cancels a pending proposal.
  - **Rescuer limits:** the rescuer alone can't add code.
  - **Initialization:** clone and `initialize` happen in one call, and the implementation is locked in its constructor and inert.
  - **Clone args:** they're read from code, not calldata. Malformed args revert, and dirty upper bits are rejected.
  - **No puppet rescuer or executor** can be passed in, and a pending rescuer handover doesn't leak into new auctions.
- **Access bases:** the executor and rescuer can't collide under any order of handovers. Rescue mode locks every `onlyElevatedAccess` function on both the factory and the auction. No executor proposal can exist in rescue mode, so `acceptExecutor` needs no rescue check.
- **Packed storage slot:** all six fields then in the slot survived interleaved writes in round 2. `treasuryClaimed` has since joined the slot, making seven (with `settledAt` narrowed to `uint40`); the invariant suite exercises it alongside the others.
- **Blockers** (unit tests, not the analysis rounds): a blocker can only edit the list: it can't add blockers or propose an executor (`test_access_setBlocker`, `test_proposeNewExecutor_fail_blocker`).
- **Both keys breached:** new code reaches only new auctions, and owed funds in existing clones still can't be redirected. With both keys an attacker can put arbitrary code behind `isAuction` for new auctions; that's the two-key design's limit. A delay between propose and accept would make a swap public before it takes effect.

## Cross-check against the original analysis

The original analysis (not in this branch) covered PRs 1304 and 1305. Every finding was re-checked against 08747cdd.

| Original | Status here | Where it went |
|---|---|---|
| M-1 `totalStated` inflatable | Resolved | No on-chain totals. The indexer's balance cap carries the defence (T-18). |
| M-2 Well compliance can't be switched off | Resolved for the Well. Changed for auctions. | T-14 |
| M-3 No list of genuine auctions | Resolved by `isAuction`. Residuals remain. | T-16, T-17 |
| L-1 One balance counts for every market | Still applies, off-chain | T-18 (one balance, many wishes) |
| L-2 Capital present only at sample blocks | Still applies, off-chain | T-18 |
| L-3 A failed claim leg blocks the other | Still applies, wider | T-6, T-7 |
| L-4 Cap squatting | Not applicable (no cap) | Pro-rata dilution, Info |
| L-5 Natspec claims a burner is enforced | Changed: the false claim is gone, but nothing enforces a burner | Operational 10 |
| L-6 Lazy settlement misplaces fills in time | Resolved in the event. A residual remains in the view. | T-9 |
| L-7 The Well and auctions screen different people | Changed | T-17 |
| L-8 Registry reads | Not applicable | — |
| L-9 State changes without `WishSet` | Resolved | — |
| L-10 Interfaces declared twice | Resolved | — |
| L-11 Short-notice auctions | Still applies, with a weaker guard | T-15, T-8 |
| L-12 No chain-id check | Still applies | Info, Operational 12 |
| I-1 Dust and zero fills | Changed: the dust is now locked for good | Info, T-11 |
| I-2 Front-running exclusion | Still applies: exclusion is back, and a target can front-run `setBlocked` plus `exclude` during Deposit | T-12, T-5 |
| I-3 Pause natspec | Resolved; it matches now | — |
| I-4 A wish carries no price | Still applies | Info |
| I-5, I-6 Nonces and ERC-1271 | Not applicable (no signatures) | — |
| I-7 Gas of on-chain totals | Not applicable | — |
| I-8 No reentrancy guard or received-amount check | Still applies, outside the token assumption | Info |
| Op 1 Wrong compliance address | Changed: recoverable in one transaction | Operational 6 |
| Op 2 Wrong TGLD `proceedsRecipient` | Still applies | Operational 6, 10 |
| Op 3 Price units | Still applies | Operational 6 |
| Op 6 Pause timing | Still applies, broader | Operational 2 |
| Op 7 Late admin transactions | Still applies | Operational 7 |
| Op 8 Irreversible switches | Changed: only `disableComplianceCheck` is one-way | Operational 1 |
| Op 9 Bad cap or minimum | Changed: `minDeposit` is fixed in the clone args | Operational 6 |
| Op 10 Tokens with two addresses | Still applies | Operational 11 |
| Op 12 Indexer runbook | Changed, larger | D9 |
| Op 4, 5, 11 | Not applicable | — |

The simplified design brings back three original threat classes in new places:
- **Look-alike auctions:** now direct clones of the genuine implementation (T-16).
- **Screening as a halting dependency:** now through a code-less pointer in the auctions (T-14).
- **No bound on a freeze:** the 14-day pause timer is gone, which shows up as T-1.
