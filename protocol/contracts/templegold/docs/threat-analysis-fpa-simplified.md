# Threat analysis: simplified FixedPriceAuction, clone FixedPriceAuctionFactory, ComplianceCheck and WishingWell

| | |
|---|---|
| Scope | Branch `fpa-frozen-inputs`, which settles as a view over frozen deposits and funding. Rounds 1 and 2 ran on `fpa-simplified` at **08747cdd**, before this branch existed. Bidder exclusion (`exclude`, `reinstate`, `withdrawExcluded`) was added after round 2; the findings below were updated for it by review against that code, not by a third analysis round. On this branch there is no stored settlement (T-9 is resolved), there are no `bidOwed`/`fillOwed` counters (funding is `funding()`). Payout counters (`totalExcluded`, `bidPaid`, `fillPaid`) back `liabilities()`, and `recoverToken` sends only a token's balance above it, so donated TEMPLE or USDS can be recovered and owed funds can't. A settlement by the clock emits `AuctionSettled` at its first claim or `emitSettlement`. Both were added after the analysis rounds and reviewed against the code, not re-analysed. |
| Files | `protocol/contracts/templegold/{FixedPriceAuction,FixedPriceAuctionFactory,ComplianceCheck,WishingWell}.sol`, `templegold/access/{ExecutorAccess,RescuableAccess}.sol`, and their interfaces in `protocol/contracts/interfaces/templegold/`. Dependencies: Solady 0.1.26 `LibClone`, OZ 5.0.2 `SafeERC20`, `TempleMath`, `TempleGold` (TGLD only moves to or from authorized contracts). |
| Method | Two rounds of five independent analyses: privileged-role compromise, the unprivileged attacker, integration and indexers, lifecycle and economics, and a cross-check. Round 1 ran at f1ccb404. Round 2 ran at 08747cdd and re-checked every claim in round 1 and in the original analysis of PRs 1304 and 1305, which isn't in this branch. Non-obvious claims were proven with forge tests in scratch copies of `protocol/`. Those tests aren't in the branch. The headline findings were re-checked against the code by hand. |
| Source of truth | The branch code. The design proposal (`fpa-simplified-model.md`) was used only to say what the code is meant to do. Line numbers refer to this branch's code. FixedPriceAuction.sol is cited by function name. |
| Date | 2026-10-20 |

## Trust model

The msig (executor), the rescuer (a separate, well-secured multisig), the funder and the proceeds recipient are trusted, so "a malicious admin could…" findings are left out. There's one exception. The design builds deliberate checks on two roles, and those checks are analysed adversarially:
- the rescuer as a check on a hijacked msig: rescue mode on the factory and on each auction, the auction pause and `cancel` in rescue mode, `disableComplianceCheck`, and the second key on the implementation swap;
- the msig as a check on a rogue flagger or a broken compliance list: remove and repoint.

Easy, hard-to-undo mistakes by trusted roles are listed separately under [Operational risks](#operational-risks).

The attackers and failure sources in scope are:
- unprivileged users, bidders, griefers and front-runners;
- callers of the permissionless functions (`claim`, `claimTreasury`, `withdrawExcluded`, `emitSettlement`), and anyone cloning the implementation;
- token behaviour: 6-decimal and low-decimal tokens, blocklisting tokens such as USDC, TGLD's transfer restriction, and tokens outside the stated assumption;
- the compliance list as an external dependency;
- off-chain consumers (indexers and front-ends) that on-chain data could mislead.

## Evidence basis

- **Proven:** reproduced by a forge test against the branch code.
- **Code:** follows from the code alone. The trace is given.
- **Design:** follows from the stated design or an off-chain process (indexer, runbook). If that process changes, the severity can change too.

## Ratings

Each finding has a likelihood and an impact, and its severity comes from both. Ratings were added on 2026-10-23, after the [audit report](audit-report-fpa-simplified.md), and use the same matrix. Where a rating differs from the label the analysis gave first, the old label is in parentheses. Ratings describe the risk left after the fixes on this branch.

| Impact \ Likelihood | High | Medium | Low |
|---|---|---|---|
| **High** | Critical | High | Medium |
| **Medium** | High | Medium | Low |
| **Low** | Medium | Low | Low |

- **Likelihood:** High: an unprivileged actor can do it for its own gain, with no victim mistake and nothing else going wrong; Medium: it needs a victim's mistake, a common configuration or ordinary operations; Low: it needs a breached or hijacked key, a trusted-role mistake, an unusual token, or a token issuer's blocklist.
- **Impact:** High is lost funds or a permanently lost role; Medium is frozen or misallocated funds that can be recovered, a misallocated fill with no deposit lost, or a check that stops working; Low is off-chain confusion or dust. The scale covers Temple's contracts and genuine (`isAuction`) auctions.

## Summary

**No unprivileged party can take or lock other users' funds.** Every analysis, in both rounds, held on these points:
- **Solvency** held across bid and fill decimals 0–18, prices from 1e-18 to 2^200 fill per bid, and funding up to 2^250. After every claim the balances equal what's owed, and the dust is under one wei per claimant per token.
- **No double payment:** claims pay only `msg.sender` and the fixed treasury addresses.
- **`recoverToken` can't reach owed funds,** including a flagged account's unclaimed share, an excluded balance and rounding dust, and including after a cancel: it sends only the balance above `liabilities()`.
- **The clone factory holds:** no clone listed in `isAuction` runs code the rescuer didn't accept, or has roles the design forbids.

The material risks sit in the designed checks:

1. **[Medium, decision D11, fixed on the factory and auctions] A hijacked msig could steal the executor role in one transaction** ([T-2](#t-2-a-hijacked-msig-can-take-the-executor-role-in-one-transaction)). It proposed a new executor and accepted it in the same batch, on the factory, every auction and `ComplianceCheck`. Rescue mode only cancels a *pending* proposal, so a Safe hijacked for a single transaction was lost for good. A delay before `acceptExecutor`, added by audit finding 2, closes this on the factory and auctions; on `ComplianceCheck` the msig can overwrite a proposal within the day (T-2).
2. **[Medium, decision D1] The rescuer's reaction window can be seconds** ([T-8](#t-8-rogue-auctions-through-the-genuine-factory)). A hijacked msig can create a genuine-looking auction that opens almost at once. From `depositEnd` it can settle the auction to itself, so the rescuer's hard deadline is `depositEnd`, not `fulfillmentEnd`. A minimum lead time and deposit window guarantee the rescuer time to cancel.
3. **[Medium, accepted] A breached rescuer can freeze every auction indefinitely, or cancel it outright** ([T-1](#t-1-a-breached-rescuer-can-freeze-or-cancel-auctions)). It switches rescue mode on and cancels in one transaction, with no window for the msig. The freeze outlasts settlement and has no cap.
4. **A breached rescuer takes the factory's rescuer role for good** ([T-4](#t-4-a-breached-rescuer-takes-the-factorys-rescuer-role-for-good)), so every later auction carries the attacker as rescuer.
5. **A hijacked msig can freeze every TGLD auction through TempleGold** ([T-19](#t-19-a-hijacked-msig-can-freeze-tgld-auctions-through-templegold)). The msig owns TempleGold and can de-authorize live auctions. The rescuer has no power over TempleGold.
6. **Coupled payouts** ([T-6](#t-6-treasury-payouts-are-coupled-and-fixed), [T-7](#t-7-a-users-two-claim-legs-are-coupled)). One blocklisted or unauthorized leg blocks the other, in both `claim` and `claimTreasury`.
7. **Exclusion is a new lever for whoever controls the compliance list** ([T-5](#t-5-compliance-control-under-compromise)). The msig, and any flagger on the auction's list, can flag bidders at any time and exclude them outside rescue mode until settlement, taking away their fills. Flaggers are trusted as the msig is: the msig picks and removes them. In rescue mode flaggers are locked out of `exclude` and `reinstate` (D13). Excluding some bidders moves their share of a partial funding to the rest; see T-5. Excluded deposits stay in the auction and are refundable once the account is cleared.

Findings that are resolved, properties checked and found to hold, and the cross-check against the original analysis are in [threat-analysis-fpa-simplified-resolved.md](threat-analysis-fpa-simplified-resolved.md).

## Audit cross-reference

The [audit report](audit-report-fpa-simplified.md) (2026-10-22) scanned `fpa-simplified` at 860ea95d, with that branch's names (`AuctionFactory`, `setBlocked`, `endFulfillment`, `filledDeposits`, `userFunding`, `fillOwed`). Every finding also holds here: the code each one touches differs only by name, and the PoCs for findings 1, 3 and 6 and the lead pass on this branch too. Fixes are in TempleDAO/temple#1319: four fix commits (findings 3 and 6 share one); findings 1, 7 and 8 are accepted.

| Audit finding | Severity | Threat item | Status |
|---|---|---|---|
| 1. An EIP-7702 EOA implementation lets its key holder rewrite every auction | Medium | New; nearest is T-17 (implementation swaps) | Accepted: operational risk. The rescuer's review before it accepts an implementation is the control (T-17) |
| 2. A hijacked msig proposes and accepts a new executor in one transaction | Medium | T-2, D11 | Fixed on the factory and auctions. On `ComplianceCheck` the msig can overwrite a proposal within the day (T-2) |
| 3. A hijacked msig repoints the list, so rescue mode can't stop exclude | Low | T-5, D13: a new route, needing no flagger on `ComplianceCheck` | Fixed |
| 4. Settlement charges bidders for the funding, not the rounded-down fill | Low | T-11: a new mechanism, in the settlement and not per bidder | Fixed |
| 5. A small bidder can pay bid tokens and get zero fill | Low | T-11, D7 | Fixed |
| 6. Rescue mode doesn't stop a list grantee from calling exclude | Low | T-5, D13 | Fixed |
| 7. Exclusion in Fulfillment moves a partial fill to the other bidders | Low | T-5 | Accepted: flaggers are trusted (T-5) |
| 8. A grantee gives a colluding bidder a free exit during Fulfillment | Low | New; T-5 had only the allocation shift | Accepted: flaggers are trusted (T-5) |
| Lead: initialize accepts a deposit window of one second | Medium | T-8, T-15, D1 | Open |

## Decisions for the team

| # | Question | Findings | Severity | Status | Recommendation |
|---|---|---|---|---|---|
| D1 | Guarantee the rescuer a reaction window: a minimum lead time (`depositStart ≥ now + MIN_LEAD`) and a minimum deposit window, checked in `FixedPriceAuction.initialize`? Optionally a maximum fulfillment window too. | T-8, T-15 | Medium | Open | Yes. This reverses the earlier "drop `MIN_LEAD`" call, because the rescuer's `cancel` only helps if it lands before `depositEnd`. Make the bounds constants in the implementation, not factory settings or config fields: the msig controls both, and the bounds exist to stop a hijacked msig. Changing them means a new implementation, which needs the rescuer. |
| D11 | Add a delay before `acceptExecutor` (for example 24 hours after the proposal), or let the rescuer propose an executor while rescue mode is on? | T-2, T-5 | Medium | Fixed on the factory and auctions (audit finding 2); on `ComplianceCheck` the msig can overwrite a proposal within the day (T-2) | Yes to the delay. Then rescue mode always has a window to cancel a hijacker's proposal, on the factory and auctions. On `ComplianceCheck` the msig can overwrite a proposal within the day (T-2). The rescuer-proposes option adds a power to the rescuer. |
| D2 | Let claims (`claim`, `claimTreasury`, `withdrawExcluded`) ignore the pause once `block.timestamp > fulfillmentEnd + N days`, so a breached or lost rescuer can't freeze settled funds for good? | T-1 | Medium | Open | Worth it. Claims only ever pay the depositor, so this can't redirect funds. |
| D3 | Should the rescuer handover need a second key, or a delay? | T-4 | Medium | Open | A delay on `acceptRescuer` lets the msig see a takeover coming. A second key gives a hijacked msig a veto. Otherwise document it. |
| D4 | Pay each `claim`/`claimTreasury` leg separately, or add the decision-6 setters? | T-6, T-7 | Medium | Open | At least split `claimTreasury`. Its addresses are fixed for the auction's life. |
| D5 | Reject a code-less compliance pointer in `initialize` and `setComplianceCheck`? | T-14 | Low | Fixed | Done: both reject a pointer that doesn't answer `isFlagged` (no code, or the wrong contract), so a deploy typo reverts. |
| D6 | Reject `proposeNewExecutor` in `ComplianceCheck.setExplicitAccess`? | T-13 ([resolved](threat-analysis-fpa-simplified-resolved.md)) | Medium | Resolved by design: `ComplianceCheck` has no per-function grants; a flagger can only edit the list | — |
| D7 | Minimum token decimals (for example ≥ 6)? | T-11 | Low | Fixed (audit finding 5) | Yes, as a deploy check, or enforce it in `initialize`. |
| D8 | Is "settled" defined by `phase()` or by `AuctionSettled`? | T-9 ([resolved](threat-analysis-fpa-simplified-resolved.md)) | — (T-9 resolved) | Open (the event gap, T-9, is resolved on this branch) | Define it by `phase()` in the indexer spec: a settlement by the clock emits `AuctionSettled` only at its first claim or `emitSettlement`, possibly long after `fulfillmentEnd`. |
| D9 | Indexer rules: fills per pair or per bucket, the tie rule for "settled after the wish", the cap split across pairs, "held in auction" from `claimable` once final, which list to screen against, zero-address proposal events as cancellations, and implementation allowlisting. Does an excluded balance count as demand, or only as held? | T-10, T-16, T-17, T-18, T-20 | Medium | Open | Decide decisions 9 and 12 in the proposal, and fail closed on unknown implementations. |
| D10 | Who is a standing flagger, so compliance control survives a lost Safe? | T-5 | Low | Open | A hardened ops key, which also sends flags privately (T-12). A flagger can exclude until settlement, outside rescue mode. |
| D12 | Who controls TempleGold authorization for live auctions? | T-19 | Low | Open | At minimum a runbook rule: never de-authorize an auction until its claims are done. Moving TempleGold ownership is out of scope here. |
| D13 | Should a flagger's power to exclude be locked while the auction is in rescue mode, like the msig? | T-5, T-2 | Medium | Fixed (audit findings 3 and 6) | Done: rescue mode locks flaggers out of `exclude` and `reinstate` on that auction, whichever list it points at (audit findings 3 and 6). |

A decision's severity is the highest of the findings it cites.

## Findings

### T-1 A breached rescuer can freeze or cancel auctions
**Medium** (likelihood Low, impact High; was High). **Accepted risk.** Proven. `RescuableAccess.sol:31-42`, and `settleEarly`, `cancel`, `setPaused` and `_onlyExecutorOrRescuerInRescueMode` in FixedPriceAuction.sol. `claim`, `claimTreasury` and `withdrawExcluded` are `whenNotPaused`.
- **Freeze:** the attacker switches rescue mode on, then `setPaused(true)` on each auction. The msig can't unpause, cancel or `settleEarly`. After `fulfillmentEnd` the auction is in Settlement, but every claim reverts for as long as the attacker holds the key. A lost rescuer key while paused in rescue mode has the same effect.
- **Cancel:** the attacker batches `setRescueMode(true)` and `cancel()`. It can do this to a fully funded auction one block before `fulfillmentEnd`. The msig has no window to `settleEarly` first. Everyone is refunded; the sale is lost.
- **What stops it:** nothing on-chain. The msig's only levers (`cancel`, `settleEarly`) must land before the rescuer's first transaction.
- **Mitigation:** accepted in the proposal's rescue-mode callout. D2 would cap the freeze. Requiring a pause of some duration before a rescuer `cancel` would give the msig a visible window to settle a genuine auction.

### T-2 A hijacked msig can take the executor role in one transaction
**Medium** (likelihood Low, impact High). **Decision D11: fixed on the factory and auctions by audit finding 2; on `ComplianceCheck` the msig can overwrite a proposal within the day.** Proven (`test_PR1_atomicExecutorSteal_beatsRescueCancel`, `test_XC_completedHandoverSurvivesRescueMode`). `ExecutorAccess.sol:30-51`, `RescuableAccess.sol:31-42`.
- **Atomic handover:** the hijacked msig could batch `proposeNewExecutor(thief)` and `acceptExecutor()` from the thief in one Safe transaction, on the factory, every live auction and `ComplianceCheck`, leaving nothing pending to cancel. The one-day `EXECUTOR_HANDOVER_DELAY` closes this on the factory and auctions, where rescue mode cancels the proposal during the wait. The delay applies on `ComplianceCheck` too, but it has no rescue mode, so only the owners re-proposing within the day stop a pending handover there. Only the executor can propose a successor, so neither the rescuer nor the recovered Safe can take a completed handover back.
- **Impact:** without the delay, a Safe hijacked for one transaction was lost for good on every contract. With it, the risk remains only on `ComplianceCheck`. On `ComplianceCheck` only the msig can overwrite a proposal: if the Safe's honest owners still reach its threshold within the day, re-proposing overwrites the thief's proposal, and `setFlagger` removes any flagger it appointed; otherwise the team needs a new `ComplianceCheck` and must repoint each auction. There is no fund loss.
- **With exclusion:** the thief who takes `ComplianceCheck`'s executor role can make itself a flagger and flag bidders in every auction pointing at that list. In an auction under rescue mode flaggers no longer reach `exclude`; outside rescue mode a flagger can exclude until settlement. The rescuer's answer to the flags is disabling compliance on each auction, which also makes every excluded balance withdrawable.
- **Fix:** D11, a delay before `acceptExecutor`. Audit finding 2 adds a one-day `EXECUTOR_HANDOVER_DELAY`. On the factory and auctions rescue mode then has a day to cancel the proposal. On `ComplianceCheck` the msig can overwrite a proposal within the day.

### T-4 A breached rescuer takes the factory's rescuer role for good
**Medium** (likelihood Low, impact High). Code. `RescuableAccess.sol:49-62`, `FixedPriceAuctionFactory.sol:37`.
- **Scenario:** `proposeNewRescuer(attackerKey)`, then `acceptRescuer()`. The only guard is `!= executor`. Recovering the original rescuer Safe doesn't help. Every auction created afterwards carries the attacker as rescuer, with T-1's powers, and the attacker can hold the factory in rescue mode.
- **Recovery:** a new factory and an indexer migration. No funds are lost.
- **Mitigation:** the msig checks `factory.rescuer()` in every `createAuction` batch. D3 is the code option.

### T-5 Compliance control under compromise
**Low** (likelihood Low, impact Medium; was Medium). **Narrowed by audit findings 3 and 6 (D13 fixed); findings 7 and 8 are accepted because flaggers are trusted.** Code. `ComplianceCheck.sol:22-36`, and `setComplianceCheck`, `disableComplianceCheck`, `exclude`, `reinstate` and `_onlyExclusionAdmin` in FixedPriceAuction.sol.
- **A hijacked msig on `ComplianceCheck`:** the contract has no rescue mode, so the hijacked msig can hand over its executor role for good after the one-day delay, unless the Safe's honest owners overwrite the proposal within the day and remove any flagger it appointed (T-2). If it flags everyone, the rescuer's only answer is `disableComplianceCheck` on each auction, which is one-way and ends screening. Unflagging a sanctioned address can't be stopped on-chain. Recovery is a new `ComplianceCheck` and repointing each auction, which needs each auction's executor.
- **A breached rescuer:** it can disable compliance on every auction for good, one transaction each. The msig's only answer is to `cancel` before the rescuer switches rescue mode on for that auction.
- **A rogue flagger:** flaggers are trusted, so a rogue one is out of model, as a rogue msig signer is. If one is compromised, it can flag any bidder in every auction using the list and exclude it until settlement. An excluded bidder gets no fill (refund only once cleared, or reinstated if cleared during Deposit). The excluded deposit stays in the auction and is refundable once the account is cleared. In a partially funded auction an excluded bidder's share of the funding goes to the remaining bidders at the auction price, so a colluding bidder gains allocation. It can also flag an ally, exclude it and unflag it, so the ally withdraws in full while the others stay locked in (audit findings 7 and 8, accepted). Example: Alice and Bob bid 100 TEMPLE each at 4 USDS. Alice is excluded, and the funder then funds 400 USDS: Bob gets all 400 instead of the 200 he'd get alongside Alice. The msig removes it (`setFlagger` is executor-only), repairs the list and reinstates bidders still in their deposit window. Bidders excluded after `depositEnd` can't be put back.
- **Accepted because flaggers are trusted:** any flagger can clear a flag the msig set, and nothing records who set it. A flagger can unflag and `reinstate` a bidder the msig excluded during Deposit, or reinstate a cleared bidder just before `depositEnd`, so its excluded balance goes back into the fill without its consent. A flag set just before `depositEnd` blocks that bidder's `withdrawDeposit`, so it stays in the trade. `exclude` and `reinstate` work while paused, so a bidder excluded during a pause that crosses `depositEnd` later withdraws in full while the pause has locked the others in.
- **A bidder that causes its own flag:** it gets the same full refund once it is excluded after `depositEnd` and then cleared, with no rogue flagger involved. Open (model decision 17).
- **In rescue mode:** rescue mode locks flaggers out of `exclude` and `reinstate` on that auction, whichever list it points at, as it locks out the msig (audit findings 3 and 6, D13). A rogue flagger can still flag bidders; the rescuer's answer to that is `disableComplianceCheck` on that auction.
- **Mitigation:** D10 and D11.

### T-6 Treasury payouts are coupled and fixed
**Medium** (likelihood Low, impact High; was Medium for a compromised proceeds recipient, Low otherwise). Proven (`test_UA_blocklistedBidderAndRecipient`, `test_PR5_proceedsRecipient_payoutIsPermissionlessAfterClock`). `claimTreasury` in FixedPriceAuction.sol.
- **Coupling:** `claimTreasury` pays `filledBids` to `proceedsRecipient` and `funderRefund` to `funder` in one call. If a blocklisting token (USDC) blocks either address, or blocks the auction itself, both legs are stuck. Both addresses are fixed in the clone args, and `recoverToken` can't send what's owed, so this is permanent.
- **A compromised `proceedsRecipient` after `fulfillmentEnd`:** `cancel` is no longer possible, and the attacker can call `claimTreasury` itself. Pausing stops it, but also stops every depositor's claim. Before `fulfillmentEnd`, pause and cancel works.
- **A compromised `funder`** can only lose its own tokens: `withdrawExcess` can't go below what fills every deposit. Any excess funding is lost whatever the msig does, because it reaches the same address as `funderRefund`. Fund exactly the requirement after `depositEnd`.
- **Mitigation:** D4, either separate legs or the decision-6 setters.

### T-7 A user's two claim legs are coupled
**Low** (likelihood Low, impact Medium). Proven (`test_UA_blocklistedBidderAndRecipient`, round-1 `test_restrictedFill_unauthorisedClone_strandsUsers`). `claim` in FixedPriceAuction.sol. TempleGold `_update` needs `from` or `to` authorized.
- **USDC blocklists a claimant:** their other-token leg reverts with it. Only that user is affected.
- **TGLD is one of the tokens and the clone isn't authorized on TempleGold** (never authorized, or de-authorized mid-life): every TGLD transfer from the auction to a user reverts, and every claim with it. Every user's other-token refund is stranded until the TempleGold owner authorizes the clone.
- **Mitigation:** the TGLD process in [Operational risks](#operational-risks), and D4.

### T-8 Rogue auctions through the genuine factory
**Medium** (likelihood Low, impact High; was Medium, High before the rescuer reacts). **Decision D1.** Proven (round-1 `test_PR3_hijackedMsig_rugAuction_rescuerCheck`, round-2 `test_poc_noLeadTime`, `test_msigFrontRunsRescuerCancel`). `FixedPriceAuctionFactory.sol:32-38`, and `initialize`, `settleEarly`, `cancel` and `claimTreasury` in FixedPriceAuction.sol.
- **Scenario:** a hijacked msig calls `createAuction` with itself as funder and proceeds recipient and a worthless fill token. `initialize` only requires `depositStart > block.timestamp`, so the auction can open a second later. `isAuction` is true, so front-ends list it as genuine. From `depositEnd` the msig funds with junk and calls `settleEarly` in one block, and `claimTreasury` pays the deposits to it.
- **The check:** the rescuer switches rescue mode on the factory (no more creations), then on each rogue auction switches rescue mode on and calls `cancel`. That refunds every depositor. It must land **before `depositEnd`**, because from then the msig can settle first, and a settled auction can't be cancelled. It takes two transactions per auction, and the attacker can create one auction per transaction.
- **Can't revoke:** `isAuction` stays true for a rogue auction, even after a cancel.
- **Against a genuine auction:** with exclusion, a hijacked msig can flag and exclude every bidder in a genuine auction before `fulfillmentEnd`, so nobody fills and the funder pays nothing. Excluding some bidders moves their share of a partial funding to the rest; see T-5. Every excluded deposit stays refundable once the rescuer disables compliance or the accounts are cleared.
- **Mitigation:**
  - D1 guarantees the rescuer a reaction window.
  - Alert on `AuctionCreated` with an unknown funder, proceeds recipient or compliance pointer.
  - Front-ends list only announced auctions, and check `inRescueMode()`, `phase()` and the treasury addresses, not just `isAuction`.

### T-10 Indexer ordering and semantics
**Medium** (likelihood High, impact Low; was Low): the fill-subtraction gaming below needs only an unprivileged wisher. Code and Design. `settleEarly` and `_emitClockSettlement` in FixedPriceAuction.sol, `WishingWell.sol:15-18`.
- **Timing:** a settlement by the clock emits `AuctionSettled` only at its first claim or `emitSettlement`, and `settledAt` is 0 until then. Compare `settledAt` if non-zero, else `fulfillmentEnd`, against the wish. `settleEarly` ties with a wish in the same block. `wishOf` stores no timestamp, so the rule needs logs.
- **Gaming the fill subtraction:**
  - **Fills via another pair go uncounted:** fills through a different pair in the same bucket are never subtracted.
  - **Wish resets:** under "a new wish resets fills", one transaction restores a filled wish.
  - **Deposit then wish:** depositing, then wishing for more, undercounts the extra demand.
  - **Address hopping:** a user who wishes from one address and bids from another keeps the wish counted after being filled.
- **Cancels reverse preview fills:** `AuctionCancelled` carries no `userRefund`, and fills drop to zero. The event doesn't say whether the rescuer cancelled.
- **Exclusion events:** `BidderExcluded` removes a deposit from the fill and lowers `totalDeposits`; `BidderReinstated` puts it back (Deposit only); `ExcludedWithdrawn` refunds it. Preview fills must be recomputed on each, and an excluded account's wish keeps counting unless the indexer drops it.
- **Mitigation:** D9. Pin the tie rule (block, logIndex), decide per-pair versus per-bucket matching, and reverse preview fills on `AuctionCancelled`.

### T-11 Rounding loses each bidder's fractional fill
**Low** (likelihood Medium, impact Low). **Decision D7, fixed, with dust remaining: see audit findings 4 and 5.** Proven (`test_UA_zeroDecimalFill_wholeTokenLossPerBidder`, `test_smallDepositorPaysForNothing`). `initialize`, `_claimable` and `_calculateSettlement` in FixedPriceAuction.sol.
- **Fixed:** with a 0-decimal fill token worth 100 USDC, bidders of 199 USDC each got 1 unit, and a 99 USDC bidder in a fully funded auction got nothing and no refund. `initialize` now requires 6 to 18 decimals for both tokens (D7, audit finding 5), and the settlement charges each fill at the rounded-up bid-token cost of the fill-token wei it buys and refunds the rest of the deposit (audit finding 4).
- **Remains:** each bidder's fill and refund round down separately, so each bidder can lose under one base unit of each token. For TGLD→USDC that is under 1e-6 USDC.
- **Mitigation:** set `minDeposit` in every config.

### T-12 A target can front-run its own block
**Medium** (likelihood High, impact Low; was Low). If legal treats the freeze as mandatory, impact is Medium and severity High. Design. `ComplianceCheck.sol:30-36`, and `withdrawDeposit`, `claim` and `exclude` in FixedPriceAuction.sol.
- **Scenario:** queued Safe transactions are public before they execute. The target sees `setFlagged` (and the `exclude` batched with it) coming and withdraws during Deposit, or claims after settlement. During Fulfillment it can't withdraw, so an exclusion lands. A flagged person can also use a fresh address.
- **Mitigation:** process only. A hot key that is a flagger sends `setFlagged` directly through a private relay, and known addresses are flagged before `depositStart`.

### T-14 A reverting compliance pointer halts the auction
**Low** (likelihood Low, impact Medium). **D5 fixed: a pointer that doesn't answer `isFlagged` is now rejected.** Proven before the fix (`test_XC_codelessCompliancePointer`); the fix by `test_createAuction_configValidation`, `test_setComplianceCheck_fail_withoutCode` and `test_setComplianceCheck_fail_wrongContract`. `initialize`, `setComplianceCheck` and `_isFlagged` in FixedPriceAuction.sol.
- **Fixed:** `initialize` and `setComplianceCheck` reject zero and any address that doesn't answer `isFlagged` (D5), so an EOA typo or the wrong contract reverts.
- **Remains:** a pointer whose code changes after it is set (a proxy or a delegated account, accepted in T-17) can stop answering `isFlagged`, which makes every `deposit`, `withdrawDeposit` and `claim` revert (it fails closed), and also `exclude`, `reinstate` and `withdrawExcluded`, which read the list.
- **Recovery:** one transaction, either the msig repoints or the rescuer disables.

### T-15 No minimum notice or window length
**Low** (likelihood Low, impact Medium). Code. `initialize` in FixedPriceAuction.sol.
- `initialize` only requires `depositStart > now` and strict ordering, so a one-second window is valid. Wishers can miss a short-notice auction, and the rescuer has no guaranteed time to react (T-8).
- **Mitigation:** D1.

### T-16 Look-alike auctions from the genuine implementation
**Low** (likelihood Medium, impact Low). Proven (`test_UA_lookalikeCloneStealsBids`, `test_poc_thirdPartyClone`). `initialize` in FixedPriceAuction.sol, `FixedPriceAuctionFactory.sol:22`.
- **Scenario:** anyone can `LibClone.clone(implementation, ownConfig)` and `initialize` it with their own roles and a fake fill token. It runs Temple's verified code and emits the genuine events, and explorers show it as a proxy to verified source. That makes for convincing phishing.
- **What protects integrators:** an indexer that filters on the factory's `AuctionCreated` and `isAuction` is unaffected. Genuine code only emits `Deposited` for `msg.sender`, so it can't forge third-party deposits.
- **Mitigation:** the integrator docs say `isAuction` on the canonical factory is the only valid check, never a code or source match, and front-ends show token addresses, not just names.
  - **Optional hardening:** `initialize` requires the factory as caller.
- **Outside the scale:** victims of a look-alike clone lose their deposits, but the scale covers only genuine auctions; front-ends checking `isAuction` are the defence.

### T-17 Integration across swaps, factories and compliance lists
**Low** (likelihood Medium, impact Low). Design and Code. `FixedPriceAuctionFactory.sol:16`, `:24-62`, and `setComplianceCheck` and `disableComplianceCheck` in FixedPriceAuction.sol.
- **Implementation swaps:** `config` decodes "by implementation", but nothing on-chain names a layout. An indexer that falls back to the v1 decoder can decode a new layout wrongly. A changed event signature silently drops events. Trailing bytes after the 320-byte config are accepted, so a strict decoder or a hash check can mismatch.
- **Proposal events:** a zero address in `ImplementationProposed` or `NewExecutorProposed` means the proposal was cancelled by rescue mode. `acceptImplementation` clears the proposal without its own event, so indexers clear it on `ImplementationSet`. The constructor now emits `ImplementationSet`, so an events-only allowlist is complete.
- **Factory replacement:** the indexer tracks a set of factories plus a cutoff for the old one. The old factory's `isAuction` stays true for its rogue auctions, and the retired factory should stay in rescue mode for good.
- **Compliance divergence:** each auction's pointer and disable are separate, the Well doesn't screen, and the indexer must screen with each target auction's pointer and its `ComplianceCheckDisabled` state.
- **Rotation:** rotating the factory's rescuer or executor leaves live auctions on the old keys. A breach-driven rotation needs a handover on every live auction.
- **Mutable code behind a pointer (accepted):** the implementation and the compliance list can each be a proxy, or an EIP-7702 delegated account, whose code changes after review. No on-chain check can rule that out, so the review before `proposeImplementation`, `acceptImplementation`, `createAuction` and `setComplianceCheck` is the control (audit finding 1). The factory still rejects an implementation with no code.
- **Mitigation:** allowlist implementations and fail closed on `ImplementationSet` until a decoder exists. Decide decision 12.

### T-18 Demand inflation off-chain
**Medium** (likelihood High, impact Low: it feeds decisions, not funds; was Low). Design. `WishingWell.sol:11-12`, `:15-18`.
- **One balance, many wishes:** `wishOf[account][fromToken][toToken]` lets one `fromToken` balance back wishes to many `toToken`s, with no on-chain balance check. The indexer caps an account's total wishes from one asset at its balance, and must say how a capped balance splits across pairs.
- **Borrowed or sampled balances:** an account borrows across the pinned balance block and wishes with the borrowed balance. A contract that makes arbitrary calls can be made to `wish()`, which attributes its balance to the attacker. TGLD bridged between per-chain snapshots can count twice.
- **Input:** the Well validates nothing: `fromToken == toToken`, zero or non-token addresses, `expiresAt` of 0 or in the past. Anyone can emit `WishSet` for any key, so an indexer that stores every key can be bloated.
- **Mitigation:**
  - an unpredictable snapshot block, or a minimum balance over a window;
  - count only bucket tokens with `from != to`, filtering at ingest;
  - document 0 as expired and `type(uint64).max` as "no expiry";
  - count only allowlisted contract wishers;
  - one canonical TGLD chain.

### T-19 A hijacked msig can freeze TGLD auctions through TempleGold
**Low** (likelihood Low, impact Medium; was Low to Medium). A gap in the rescuer check. Code. TempleGold `_update` (`TempleGold.sol:227-231`), and `deposit`, `withdrawDeposit`, `claim` and `claimTreasury` in FixedPriceAuction.sol.
- **Scenario:** the msig owns TempleGold. A hijacked msig de-authorizes every live TGLD auction. Every TGLD deposit, refund, claim and treasury leg then reverts until it's re-authorized, and in a TGLD-fill auction the users' other-token refunds are stranded with them. Pause and cancel don't help, and the rescuer has no power over TempleGold.
- **Address prediction:** a Safe batch can't use return values, so authorizing a new auction "in the same batch" means precomputing the clone's address from the factory's nonce. If two queued creations run out of order, the wrong auction is authorized.
- **Mitigation:** D12. Authorize in a second transaction after reading `AuctionCreated`, before `depositStart`, and never de-authorize until claims are done.

### T-20 `deposits()` doesn't drop when an account claims
**Low** (likelihood Medium, impact Low). Proven (`test_poc_depositsPersistAfterClaim`). `deposits` and `claim` in FixedPriceAuction.sol.
- **Scenario:** an indexer that counts held tokens as wallet balance plus `deposits(account)` double-counts after a claim: the refund is in the wallet and `deposits()` still shows the full amount. The filled part has already gone to the proceeds recipient.
- **Mitigation:** D9. Held in auction is `deposits` plus `excluded(account)` while the auction is live, and `claimable(account).refund` plus `excluded(account)` once it's final.

### Info
- **Rounding dust is locked for good:** at most one wei per claimant per token stays in the auction. `liabilities()` keeps counting it, so `recoverToken` can't take it and the dust just stays. Intended. Proven.
- **Fee-on-transfer and rebasing tokens break solvency,** so the last claimer reverts. Excluded by the stated assumption (`IFixedPriceAuction.sol:11`); the msig picks the tokens.
- **Pro-rata timing:**
  - splitting deposits never gains: at most 1 wei lost per extra piece (proven by fuzz);
  - a last-block whale dilutes everyone's fill fraction, which is how pro-rata works;
  - bidders give the treasury a free option during Fulfillment: disclose it and keep the window short.
- **No chain-id check,** and **a wish carries no price:** unchanged from the original analysis.

## Operational risks

These are easy, hard-to-undo mistakes by trusted roles:
1. **Wrong-target or irreversible calls:**
   - `disableComplianceCheck` on the wrong auction: it's one-way, and only `cancel` before `fulfillmentEnd` escapes.
   - `cancel` on the wrong clone, by the msig or by the rescuer in rescue mode (the addresses look alike): irreversible.
2. **Pause timing:**
   - A pause across `depositEnd` takes away depositors' right to withdraw.
   - A pause across `fulfillmentEnd` settles with whatever was funded, and removes `cancel`.
   - Calling `settleEarly` while paused "to end the incident" settles with whatever was funded.
   - `settleEarly` can land before the funder's pending top-up; batch them. The funder can't pre-fund during Deposit.
3. **Stale implementation proposal:** a breached rescuer can still accept a stale `proposedImplementation` outside rescue mode. Clear it by overwriting it with the current implementation, or by switching rescue mode on and off.
4. **Flaggers:** making an account a flagger also gives it the power to `exclude` and `reinstate` on every auction pointing at the list, outside rescue mode (`reinstate` only during Deposit).
5. **Partial rotations:** rotating the rescuer or executor on the factory but not on live auctions or `ComplianceCheck`. Rescue mode is per contract too: switching it on at the factory leaves each auction's executor proposal live.
6. **Wrong values at creation:** a wrong `funder`, `proceedsRecipient`, price units, `minDeposit` or schedule in `createAuction`. All are fixed in the clone args; the only exit is `cancel` before `fulfillmentEnd`. A wrong compliance pointer is fixable with `setComplianceCheck`.
7. **Late admin transactions:** `cancel`, `settleEarly` and `exclude` revert from the `fulfillmentEnd` second onward.
8. **Rescue mode left on with the rescuer key lost:** the msig is locked out for good, and if paused, funds are frozen for good.
9. **Over-funding:** excess funding during Fulfillment is at risk if the funder is compromised (T-6). A plain transfer of either auction token is recoverable only by the msig with `recoverToken` (the balance above `liabilities()`); fund exactly.
10. **TGLD:** authorize after `createAuction` from the emitted address, before `depositStart`; never de-authorize before claims are done (T-19); use the burner as `proceedsRecipient` (decision 11; nothing enforces it).
11. **Tokens with two addresses:** `recoverToken` only counts liabilities against the configured addresses; through the other address the whole balance is recoverable.
12. **Wrong-chain TGLD:** TGLD on a chain where it can't be burned or moved back needs a deploy check.
13. **Excluding by mistake:** after `depositEnd` an exclusion can't be undone; the bidder only gets its bid back.
14. **Executor rotation takes a day:** on the factory, every auction and `ComplianceCheck`, `acceptExecutor` waits `EXECUTOR_HANDOVER_DELAY` (1 day), and a new proposal restarts the clock. Plan rotations, including emergency ones, around it.

## Test gaps

Still missing:
- **Invariant suite:**
  - one price per configuration, and timing never varies;
  - no factory rescue mode or multi-auction run;
  - funded settlement followed by a claim is thin;
  - `reinstate` is rarely reached in the handler (unit tests cover it).
- **Fuzz suite:** fairness (each user's share equals the exact pro-rata share rounded down) is checked only in the stateless fuzz.
