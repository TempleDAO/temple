# Threat analysis: simplified FixedPriceAuction, clone AuctionFactory, ComplianceCheck and WishingWell

| | |
|---|---|
| Scope | Branch `fpa-simplified`. Round 2 ran at **08747cdd** (round 1 at f1ccb404). Bidder exclusion (`exclude`, `reinstate`, `withdrawExcluded`) was added after round 2; the findings below were updated for it by review against that code, not by a third analysis round. |
| Files | `protocol/contracts/templegold/{FixedPriceAuction,AuctionFactory,ComplianceCheck,WishingWell}.sol`, `templegold/access/{ExecutorAccess,RescuableAccess}.sol`, and their interfaces in `protocol/contracts/interfaces/templegold/`. Dependencies: Solady 0.1.26 `LibClone`, OZ 5.0.2 `SafeERC20`, `TempleMath`, `TempleGold` (TGLD only moves to or from authorized contracts). |
| Method | Two rounds of five independent analyses: privileged-role compromise, the unprivileged attacker, integration and indexers, lifecycle and economics, and a cross-check. Round 1 ran at f1ccb404. Round 2 ran at 08747cdd and re-checked every claim in round 1 and in the original analysis of PRs 1304 and 1305, which isn't in this branch. Non-obvious claims were proven with forge tests in scratch copies of `protocol/`. Those tests aren't in the branch. The headline findings were re-checked against the code by hand. |
| Source of truth | The branch code. The design proposal (`fpa-simplified-model.md`) was used only to say what the code is meant to do. Line numbers refer to this branch with the audit fixes. |
| Date | 2026-10-20 |

## Trust model

The msig (executor), the rescuer (a separate, well-secured multisig), the funder and the proceeds recipient are trusted, so "a malicious admin could…" findings are left out. There's one exception. The design builds deliberate checks on two roles, and those checks are analysed adversarially:
- the rescuer as a check on a hijacked msig: rescue mode on the factory and on each auction, the auction pause and `cancel` in rescue mode, `disableComplianceCheck`, and the second key on the implementation swap;
- the msig as a check on a rogue blocker or a broken compliance list: remove the blocker and repoint.

Easy, hard-to-undo mistakes by trusted roles are listed separately under [Operational risks](#operational-risks).

The attackers and failure sources in scope are:
- unprivileged users, bidders, griefers and front-runners;
- callers of the permissionless functions (`claim`, `claimTreasury`, `withdrawExcluded`), and anyone cloning the implementation;
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

- **Likelihood:** High: an unprivileged actor can do it for its own gain, with no victim mistake and nothing else going wrong; Medium: it needs a victim's mistake, a common configuration or ordinary operations; Low: it needs a breached or hijacked key, a trusted-role mistake, a token issuer's blocklist, or an unusual token.
- **Impact:** High is lost funds or a permanently lost role; Medium is frozen or misallocated funds that can be recovered, a misallocated fill with no deposit lost, or a check that stops working; Low is off-chain confusion or dust. The scale covers Temple's contracts and genuine (`isAuction`) auctions.

## Summary

**No unprivileged party can take or lock other users' funds.** Every analysis, in both rounds, held on these points:
- **Solvency** held across bid and fill decimals 0–18, prices from 1e-18 to 2^200 fill per bid, and funding up to 2^250. After every claim the balances equal what's owed, and the dust is under one wei per claimant per token.
- **No double payment:** claims pay only `msg.sender` and the fixed treasury addresses.
- **`recoverToken` can't reach owed funds,** including a blocked account's unclaimed share, and including after a cancel.
- **The clone factory holds:** no clone listed in `isAuction` runs code the rescuer didn't accept, or has roles the design forbids.

The material risks sit in the designed checks:

1. **[Medium, decision D11, fixed on the factory and auctions] A hijacked msig could steal the executor role in one transaction** ([T-2](#t-2-a-hijacked-msig-can-take-the-executor-role-in-one-transaction)). It proposed a new executor and accepted it in the same batch, on the factory, every auction and `ComplianceCheck`. Rescue mode only cancels a *pending* proposal, so a Safe hijacked for a single transaction was lost for good. A delay before `acceptExecutor`, added by audit finding 2, closes this on the factory and auctions. On `ComplianceCheck` the msig can overwrite a proposal before the delay ends (T-2).
2. **[Medium, decision D1] The rescuer's reaction window can be seconds** ([T-8](#t-8-rogue-auctions-through-the-genuine-factory)). A hijacked msig can create a genuine-looking auction that opens almost at once. From `depositEnd` it can settle the auction to itself, so the rescuer's hard deadline is `depositEnd`, not `fulfillmentEnd`. A minimum lead time and deposit window guarantee the rescuer time to cancel.
3. **[Medium, accepted] A breached rescuer can freeze every auction indefinitely, or cancel it outright** ([T-1](#t-1-a-breached-rescuer-can-freeze-or-cancel-auctions)). It switches rescue mode on and cancels in one transaction, with no window for the msig. The freeze outlasts settlement and has no cap.
4. **A breached rescuer takes the factory's rescuer role for good** ([T-4](#t-4-a-breached-rescuer-takes-the-factorys-rescuer-role-for-good)), so every later auction carries the attacker as rescuer.
5. **A hijacked msig can freeze every TGLD auction through TempleGold** ([T-19](#t-19-a-hijacked-msig-can-freeze-tgld-auctions-through-templegold)). The msig owns TempleGold and can de-authorize live auctions. The rescuer has no power over TempleGold.
6. **Coupled payouts** ([T-6](#t-6-treasury-payouts-are-coupled-and-fixed), [T-7](#t-7-a-users-two-claim-legs-are-coupled)). One blocklisted or unauthorized leg blocks the other, in both `claim` and `claimTreasury`.
7. **Exclusion is a new lever for whoever controls the compliance list** ([T-5](#t-5-compliance-control-under-compromise)). The msig, and any blocker on the auction's list, can block bidders at any time and exclude them outside rescue mode until settlement, taking away their fills. Blockers are trusted as the msig is: the msig picks and removes them. In rescue mode blockers are locked out of `exclude` and `reinstate` (D13). Excluding some bidders moves their share of a partial funding to the rest; see T-5. Excluded deposits stay in the auction and are refundable once the account is cleared.

Findings that are resolved, properties checked and found to hold, and the cross-check against the original analysis are in [threat-analysis-fpa-simplified-resolved.md](threat-analysis-fpa-simplified-resolved.md).

## Audit cross-reference

The [audit report](audit-report-fpa-simplified.md) (2026-10-22) is a code-level scan of this branch, `fpa-simplified`, at 860ea95d. It confirms open items here and adds four mechanisms this analysis didn't have. The fixes are in TempleDAO/temple#1318, four fix commits (findings 3 and 6 share one; findings 1, 7 and 8 are accepted), and are ported to `fpa-frozen-inputs` in TempleDAO/temple#1319.

| Audit finding | Severity | Threat item | Status |
|---|---|---|---|
| 1. An EIP-7702 EOA implementation lets its key holder rewrite every auction | Medium | New; nearest is T-17 (implementation swaps) | Accepted: operational risk. The rescuer's review before it accepts an implementation is the control (T-17) |
| 2. A hijacked msig proposes and accepts a new executor in one transaction | Medium | T-2, D11 | Fixed on the factory and auctions. On `ComplianceCheck` the msig can overwrite a proposal before the delay ends (T-2) |
| 3. A hijacked msig repoints the list, so rescue mode can't stop exclude | Low | T-5, D13: a new route, needing no blocker on `ComplianceCheck` | Fixed |
| 4. Settlement charges bidders for the funding, not the rounded-down fill | Low | T-11: a new mechanism, in the settlement and not per bidder | Fixed |
| 5. A small bidder can pay bid tokens and get zero fill | Low | T-11, D7 | Fixed |
| 6. Rescue mode doesn't stop a list grantee from calling exclude | Low | T-5, D13 | Fixed |
| 7. Exclusion in Fulfillment moves a partial fill to the other bidders | Low | T-5 | Accepted: blockers are trusted (T-5) |
| 8. A grantee gives a colluding bidder a free exit during Fulfillment | Low | New; T-5 had only the allocation shift | Accepted: blockers are trusted (T-5) |
| Lead: initialize accepts a deposit window of one second | Medium | T-8, T-15, D1 | Open |

## Decisions for the team

| # | Question | Findings | Severity | Status | Recommendation |
|---|---|---|---|---|---|
| D1 | Guarantee the rescuer a reaction window: a minimum lead time (`depositStart ≥ now + MIN_LEAD`) and a minimum deposit window, checked in `FixedPriceAuction.initialize`? Optionally a maximum fulfillment window too. | T-8, T-15 | Medium | Open | Yes. This reverses the earlier "drop `MIN_LEAD`" call, because the rescuer's `cancel` only helps if it lands before `depositEnd`. Make the bounds constants in the implementation, not factory settings or config fields: the msig controls both, and the bounds exist to stop a hijacked msig. Changing them means a new implementation, which needs the rescuer. |
| D11 | Add a delay before `acceptExecutor` (for example 24 hours after the proposal), or let the rescuer propose an executor while rescue mode is on? | T-2, T-5 | Medium | Fixed on the factory and auctions (audit finding 2). On `ComplianceCheck` the msig can overwrite a proposal before the delay ends (T-2) | Yes to the delay. Then rescue mode always has a window to cancel a hijacker's proposal, on the factory and auctions. The rescuer-proposes option adds a power to the rescuer. |
| D2 | Let claims (`claim`, `claimTreasury`, `withdrawExcluded`) ignore the pause once `block.timestamp > fulfillmentEnd + N days`, so a breached or lost rescuer can't freeze settled funds for good? | T-1 | Medium | Open | Worth it. Claims only ever pay the depositor, so this can't redirect funds. |
| D3 | Should the rescuer handover need a second key, or a delay? | T-4 | Medium | Decided: no change | No delay and no second key. The rescuer can pause, cancel and disable compliance, but can't move funds or change an auction's terms, so a stolen rescuer role costs a new factory, not funds. The msig checks `factory.rescuer()` in every `createAuction` batch. |
| D4 | Pay each `claim`/`claimTreasury` leg separately, or add the decision-6 setters? | T-6, T-7 | Medium | Open | At least split `claimTreasury`. Its addresses are fixed for the auction's life. |
| D5 | Reject a code-less compliance pointer in `initialize` and `setComplianceCheck`? | T-14 | Low | Fixed | Yes. A probe of `isBlocked` turns a deploy typo or the wrong contract into a revert. |
| D6 | Reject `proposeNewExecutor` in `ComplianceCheck.setExplicitAccess`? | T-13 | Medium | Resolved by design: `ComplianceCheck` has no per-function grants; a blocker can only edit the list | — |
| D7 | Minimum token decimals (for example ≥ 6)? | T-11 | Low | Fixed (audit finding 5) | Yes, as a deploy check, or enforce it in `initialize`. |
| D8 | Is "settled" defined by `phase()` or by `AuctionSettled`? Should `getTiming().settledAt` report `fulfillmentEnd` before the snapshot is written? | T-9 | Low | Open | Define it by `phase()` in the indexer spec. Optionally fix the view. |
| D9 | Indexer rules: fills per pair or per bucket, the tie rule for "settled after the wish", the cap split across pairs, "held in auction" from `claimable` once final, which list to screen against, zero-address proposal events as cancellations, and implementation allowlisting. Does an excluded balance count as demand, or only as held? | T-10, T-16, T-17, T-18, T-20 | Medium | Open | Decide decisions 9 and 12 in the proposal, and fail closed on unknown implementations. |
| D10 | Who is a standing blocker, so compliance control survives a lost Safe? | T-5 | Low | Decided | The overlord automation bot, which also sends blocks privately (T-12). A blocker can exclude until settlement, outside rescue mode. |
| D12 | Who controls TempleGold authorization for live auctions? | T-19 | Low | Open | At minimum a runbook rule: never de-authorize an auction until its claims are done. Moving TempleGold ownership is out of scope here. |
| D13 | Should a blocker's power to exclude be locked while the auction is in rescue mode, like the msig? | T-5, T-2 | Medium | Fixed (audit findings 3 and 6) | Done: rescue mode locks blockers out of `exclude` and `reinstate` on that auction, whichever list it points at (audit findings 3 and 6). |

A decision's severity is the highest of the findings it cites.

## Findings

### T-1 A breached rescuer can freeze or cancel auctions
**Medium** (likelihood Low, impact High; was High). **Accepted risk.** Proven. `RescuableAccess.sol:31-42`, `FixedPriceAuction.sol:232-243`, `:308-312`, `:495-497`. `claim`, `claimTreasury` and `withdrawExcluded` are `whenNotPaused`.
- **Freeze:** the attacker switches rescue mode on, then `setPaused(true)` on each auction. The msig can't unpause, cancel or `endFulfillment`. After `fulfillmentEnd` the auction is Settled, but every claim reverts for as long as the attacker holds the key. A lost rescuer key while paused in rescue mode has the same effect.
- **Cancel:** the attacker batches `setRescueMode(true)` and `cancel()`. It can do this to a fully funded auction one block before `fulfillmentEnd`. The msig has no window to `endFulfillment` first. Everyone is refunded; the sale is lost.
- **What stops it:** nothing on-chain. The msig's only levers (`cancel`, `endFulfillment`) must land before the rescuer's first transaction.
- **Mitigation:** accepted in the proposal's rescue-mode callout. D2 would cap the freeze. Requiring a pause of some duration before a rescuer `cancel` would give the msig a visible window to settle a genuine auction.

### T-2 A hijacked msig can take the executor role in one transaction
**Medium** (likelihood Low, impact High). **Decision D11: fixed on the factory and auctions by audit finding 2; on `ComplianceCheck` the msig can overwrite a proposal before the delay ends.** Proven (`test_PR1_atomicExecutorSteal_beatsRescueCancel`, `test_XC_completedHandoverSurvivesRescueMode`). `ExecutorAccess.sol:30-51`, `RescuableAccess.sol:31-42`.
- **Atomic handover:** the hijacked msig could batch `proposeNewExecutor(thief)` and `acceptExecutor()` from the thief in one Safe transaction, on the factory, every live auction and `ComplianceCheck`, leaving nothing pending to cancel. The two-day `EXECUTOR_HANDOVER_DELAY` closes this on the factory and auctions, where rescue mode cancels the proposal during the wait. The delay applies on `ComplianceCheck` too, but it has no rescue mode, so only the owners re-proposing before the delay ends stop a pending handover there. Only the executor can propose a successor, so neither the rescuer nor the recovered Safe can take a completed handover back.
- **Impact:** without the delay, a Safe hijacked for one transaction was lost for good on every contract. With it, that holds only for `ComplianceCheck`. On `ComplianceCheck` only the msig can overwrite a proposal: if the Safe's honest owners still reach its threshold before the delay ends, re-proposing overwrites the thief's proposal, and `setBlocker` removes any blocker it appointed; otherwise the team needs a new `ComplianceCheck`. Each auction must then be repointed to it. There is no fund loss.
- **With exclusion:** the thief who takes `ComplianceCheck`'s executor role can make itself a blocker and block bidders in every auction pointing at that list. In an auction under rescue mode blockers no longer reach `exclude`; outside rescue mode a blocker can exclude until settlement. The rescuer's answer to the blocks is disabling compliance on each auction, which also makes every excluded balance withdrawable.
- **Fix:** D11, a delay before `acceptExecutor`. Audit finding 2 adds a two-day `EXECUTOR_HANDOVER_DELAY`. On the factory and auctions rescue mode then has two days to cancel the proposal; `ComplianceCheck` has no rescue mode, so there the msig can overwrite a proposal before the delay ends (see Impact).

### T-4 A breached rescuer takes the factory's rescuer role for good
**Medium** (likelihood Low, impact High). Code. `RescuableAccess.sol:49-62`, `AuctionFactory.sol:37`.
- **Scenario:** `proposeNewRescuer(attackerKey)`, then `acceptRescuer()`. The only guard is `!= executor`. Recovering the original rescuer Safe doesn't help. Every auction created afterwards carries the attacker as rescuer, with T-1's powers, and the attacker can hold the factory in rescue mode.
- **Recovery:** a new factory and an indexer migration. No funds are lost.
- **Mitigation:** the msig checks `factory.rescuer()` in every `createAuction` batch. D3 decided against a code change: the rescuer's powers are limited.

### T-5 Compliance control under compromise
**Low** (likelihood Low, impact Medium; was Medium). **Narrowed by audit findings 3 and 6 (D13 fixed); findings 7 and 8 are accepted because blockers are trusted.** Code. `ComplianceCheck.sol:22-36`, `FixedPriceAuction.sol:315-327`, and `exclude`, `reinstate` and `_onlyExclusionAdmin` in FixedPriceAuction.sol.
- **A hijacked msig on `ComplianceCheck`:** the contract has no rescue mode, so the hijacked msig can hand over its executor role for good after the two-day delay, unless the Safe's honest owners overwrite the proposal before the delay ends and remove any blocker it appointed (T-2). If it blocks everyone, the rescuer's only answer is `disableComplianceCheck` on each auction, which is one-way and ends screening. Unblocking a sanctioned address can't be stopped on-chain. Recovery is a new `ComplianceCheck` and repointing each auction, which needs each auction's executor.
- **A breached rescuer:** it can disable compliance on every auction for good, one transaction each. The msig's only answer is to `cancel` before the rescuer switches rescue mode on for that auction.
- **A rogue blocker:** blockers are trusted, so a rogue one is out of model, as a rogue msig signer is. If one is compromised, it can block any bidder in every auction using the list and exclude it until settlement. An excluded bidder gets no fill (refund only once cleared, or reinstated if cleared during Deposit). The excluded deposit stays in the auction and is refundable once the account is cleared. In a partially funded auction an excluded bidder's share of the funding goes to the remaining bidders at the auction price, so a colluding bidder gains allocation. It can also block an ally, exclude it and unblock it, so the ally withdraws in full while the others stay locked in (audit findings 7 and 8, accepted). Example: Alice and Bob bid 100 TEMPLE each at 4 USDS. Alice is excluded, and the funder then funds 400 USDS: Bob gets all 400 instead of the 200 he'd get alongside Alice. The msig removes it (`setBlocker` is executor-only), repairs the list and reinstates bidders still in their deposit window. Bidders excluded after `depositEnd` can't be put back.
- **Accepted because blockers are trusted:** any blocker can clear a block the msig set, and nothing records who set it. A blocker can unblock and `reinstate` a bidder the msig excluded during Deposit, or reinstate a cleared bidder just before `depositEnd`, so its excluded balance goes back into the fill without its consent. A block set just before `depositEnd` stops that bidder's `withdrawDeposit`, so it stays in the trade. `exclude` and `reinstate` work while paused, so a bidder excluded during a pause that crosses `depositEnd` later withdraws in full while the pause has locked the others in.
- **A bidder that causes its own block:** it gets the same full refund once it is excluded after `depositEnd` and then cleared, with no rogue blocker involved. Accepted (model decision 17).
- **In rescue mode:** rescue mode locks blockers out of `exclude` and `reinstate` on that auction, whichever list it points at, as it locks out the msig (audit findings 3 and 6, D13). A rogue blocker can still block bidders; the rescuer's answer to that is `disableComplianceCheck` on that auction.
- **Mitigation:** D10 and D11.

### T-6 Treasury payouts are coupled and fixed
**Medium** (likelihood Low, impact High; was Medium for a compromised proceeds recipient, Low otherwise). Proven (`test_UA_blocklistedBidderAndRecipient`, `test_PR5_proceedsRecipient_payoutIsPermissionlessAfterClock`). `FixedPriceAuction.sol:267-286`.
- **Coupling:** `claimTreasury` pays `filledDeposits` to `proceedsRecipient` and `funderRefund` to `funder` in one call. If a blocklisting token (USDC) blocks either address, or blocks the auction itself, both legs are stuck. Both addresses are fixed in the clone args, and `recoverToken` can't go below what's owed, so this is permanent.
- **A compromised `proceedsRecipient` after `fulfillmentEnd`:** `cancel` is no longer possible, and the attacker can call `claimTreasury` itself. Pausing stops it, but also stops every depositor's claim. Before `fulfillmentEnd`, pause and cancel works.
- **A compromised `funder`** can only lose its own tokens: `withdrawExcess` can't go below what fills every deposit. Any excess funding is lost whatever the msig does, because it reaches the same address as `funderRefund`. Fund exactly the requirement after `depositEnd`.
- **Mitigation:** D4, either separate legs or the decision-6 setters.

### T-7 A user's two claim legs are coupled
**Low** (likelihood Low, impact Medium). Proven (`test_UA_blocklistedBidderAndRecipient`, round-1 `test_restrictedFill_unauthorisedClone_strandsUsers`). `FixedPriceAuction.sol:246-264`. TempleGold `_update` needs `from` or `to` authorized.
- **USDC blocklists a claimant:** their other-token leg reverts with it. Only that user is affected.
- **TGLD is one of the tokens and the clone isn't authorized on TempleGold** (never authorized, or de-authorized mid-life): every TGLD transfer from the auction to a user reverts, and every claim with it. Every user's other-token refund is stranded until the TempleGold owner authorizes the clone.
- **Mitigation:** the TGLD process in [Operational risks](#operational-risks), and D4.

### T-8 Rogue auctions through the genuine factory
**Medium** (likelihood Low, impact High; was Medium, High before the rescuer reacts). **Decision D1.** Proven (round-1 `test_PR3_hijackedMsig_rugAuction_rescuerCheck`, round-2 `test_poc_noLeadTime`, `test_msigFrontRunsRescuerCancel`). `AuctionFactory.sol:32-38`, `FixedPriceAuction.sol:87-94`, `:223-229`, `:232-243`.
- **Scenario:** a hijacked msig calls `createAuction` with itself as funder and proceeds recipient and a worthless fill token. `initialize` only requires `depositStart > block.timestamp`, so the auction can open a second later. `isAuction` is true, so front-ends list it as genuine. From `depositEnd` the msig funds with junk and calls `endFulfillment` in one block, and `claimTreasury` pays the deposits to it.
- **The check:** the rescuer switches rescue mode on the factory (no more creations), then on each rogue auction switches rescue mode on and calls `cancel`. That refunds every depositor. It must land **before `depositEnd`**, because from then the msig can settle first, and a settled auction can't be cancelled. It takes two transactions per auction, and the attacker can create one auction per transaction.
- **Can't revoke:** `isAuction` stays true for a rogue auction, even after a cancel.
- **Against a genuine auction:** with exclusion, a hijacked msig can block and exclude every bidder in a genuine auction before `fulfillmentEnd`, so nobody fills and the funder pays nothing. Excluding some bidders moves their share of a partial funding to the rest; see T-5. Every excluded deposit stays refundable once the rescuer disables compliance or the accounts are cleared.
- **Mitigation:**
  - D1 guarantees the rescuer a reaction window.
  - Alert on `AuctionCreated` with an unknown funder, proceeds recipient or compliance pointer.
  - Front-ends list only announced auctions, and check `inRescueMode()`, `phase()` and the treasury addresses, not just `isAuction`.

### T-9 A clock-settled auction emits no event, and `settledAt` stays 0
**Low** (likelihood Medium, impact Low). Proven. `FixedPriceAuction.sol:47`, `:341-344`, `:371-378`, `:422-438`.
- **Scenario:** once `fulfillmentEnd` passes, `phase()` returns Settled, but `settledAt` stays 0 and `AuctionSettled` is only emitted by the first successful `claim` or `claimTreasury`. That never happens in three cases:
  - while the auction is paused;
  - when a non-depositor claims, because `NothingToClaim` rolls the settlement back;
  - with zero deposits and nobody calling `claimTreasury`, or a blocklisted treasury address.
- **Impact:** an indexer that waits for the event stays in its "before settlement" branch. The amounts don't drift: after `fulfillmentEnd`, `previewSettlement` equals the final snapshot.
- **Mitigation:** D8. Effective settlement time is the event's `settledAt` if present, else `fulfillmentEnd` once the phase is Settled.

### T-10 Indexer ordering and semantics
**Medium** (likelihood High, impact Low; was Low): the fill-subtraction gaming below needs only an unprivileged wisher. Code and Design. `FixedPriceAuction.sol:228`, `:437`, `WishingWell.sol:14-17`.
- **Timing:** a lazy settlement's event lands long after `settledAt`. Compare `settledAt`, not the event's block time, against the wish. `endFulfillment` ties with a wish in the same block. `wishOf` stores no timestamp, so the rule needs logs.
- **Gaming the fill subtraction:**
  - **Fills via another pair go uncounted:** fills through a different pair in the same bucket are never subtracted.
  - **Wish resets:** under "a new wish resets fills", one transaction restores a filled wish.
  - **Deposit then wish:** depositing, then wishing for more, undercounts the extra demand.
  - **Address hopping:** a user who wishes from one address and bids from another keeps the wish counted after being filled.
- **Cancels reverse preview fills:** `AuctionCancelled` carries no `userRefund`, and fills drop to zero. The event doesn't say whether the rescuer cancelled.
- **Exclusion events:** `BidderExcluded` removes a deposit from the fill and lowers `totalDeposits`; `BidderReinstated` puts it back (Deposit only); `ExcludedWithdrawn` refunds it. Preview fills must be recomputed on each, and an excluded account's wish keeps counting unless the indexer drops it.
- **Mitigation:** D9. Pin the tie rule (block, logIndex), decide per-pair versus per-bucket matching, and reverse preview fills on `AuctionCancelled`.

### T-11 Low-decimal tokens lose each bidder's fractional fill
**Low** (likelihood Medium, impact Low). **Decision D7, fixed, with dust remaining: see audit findings 4 and 5.** Proven (`test_UA_zeroDecimalFill_wholeTokenLossPerBidder`, `test_smallDepositorPaysForNothing`). `FixedPriceAuction.sol:96-104`, `:391-401`, `:410-420`.
- **Before the fixes:** with a 0-decimal fill token worth 100 USDC, bidders of 199 USDC each got 1 unit. A 99 USDC bidder got nothing and no refund, because the auction was fully filled. The treasury took all the USDC, and the leftover units stayed locked as dust. A 0-decimal bid token had the same problem on refunds.
- **Fixed:** D7 and audit finding 5 require 6 to 18 decimals for both tokens, and audit finding 4 charges bidders only for the rounded-up cost of `userFunding`.
- **Remaining:** each bidder's fill and refund still round down separately, so each bidder can lose under one base unit of each token. At TGLD→USDC/USDS that is at most 1e-6 USDC per bidder.
- **Mitigation:** set `minDeposit` in every config.

### T-12 A target can front-run its own block
**Medium** (likelihood High, impact Low; was Low). If legal treats the freeze as mandatory, impact is Medium and severity High. Design. `ComplianceCheck.sol:30-36`, `FixedPriceAuction.sol:130-146`, `:246-264`, `:480-482`.
- **Scenario:** queued Safe transactions are public before they execute. The target sees `setBlocked` (and the `exclude` batched with it) coming and withdraws during Deposit, or claims after settlement. During Fulfillment it can't withdraw, so an exclusion lands. A blocked person can also use a fresh address.
- **Mitigation:** process only. A hot key appointed as a blocker sends `setBlocked` directly through a private relay, and known addresses are blocked before `depositStart`.

### T-14 A non-conforming compliance pointer halts the auction
**Low** (likelihood Low, impact Medium). **Decision D5: a pointer that doesn't answer `isBlocked` is now rejected.** Proven before D5 (`test_XC_codelessCompliancePointer`); the D5 checks are tested by `test_createAuction_fail_complianceCheckNotAList`, `test_setComplianceCheck_fail_withoutCode` and `test_setComplianceCheck_fail_wrongContract`. `FixedPriceAuction.sol:85-86`, `:317-318`, `:457-459`.
- **Scenario:** `initialize` and `setComplianceCheck` reject a pointer that doesn't answer `isBlocked` (D5), but a pointer whose code changes after it is set (a proxy or a delegated account, accepted in T-17) can stop answering. That makes every `deposit`, `withdrawDeposit` and `claim` revert (it fails closed), and also `exclude`, `reinstate` and `withdrawExcluded`, which read the list.
- **Recovery:** one transaction, either the msig repoints or the rescuer disables.
- **Mitigation:** D5 for a pointer that doesn't answer when it is set. For one that breaks later, recovery as above.

### T-15 No minimum notice or window length
**Low** (likelihood Low, impact Medium). Code. `FixedPriceAuction.sol:87-94`.
- `initialize` only requires `depositStart > now` and strict ordering, so a one-second window is valid. Wishers can miss a short-notice auction, and the rescuer has no guaranteed time to react (T-8).
- **Mitigation:** D1.

### T-16 Look-alike auctions from the genuine implementation
**Low** (likelihood Medium, impact Low). Proven (`test_UA_lookalikeCloneStealsBids`, `test_poc_thirdPartyClone`). `FixedPriceAuction.sol:77-108`, `AuctionFactory.sol:22`.
- **Scenario:** anyone can `LibClone.clone(implementation, ownConfig)` and `initialize` it with their own roles and a fake fill token. It runs Temple's verified code and emits the genuine events, and explorers show it as a proxy to verified source. That makes for convincing phishing.
- **What protects integrators:** an indexer that filters on the factory's `AuctionCreated` and `isAuction` is unaffected. Genuine code only emits `Deposited` for `msg.sender`, so it can't forge third-party deposits.
- **Outside the scale:** victims of a look-alike clone lose their deposits, but the scale covers only genuine auctions; front-ends checking `isAuction` are the defence.
- **Mitigation:** the integrator docs say `isAuction` on the canonical factory is the only valid check, never a code or source match, and front-ends show token addresses, not just names.
  - **Optional hardening:** `initialize` requires the factory as caller.

### T-17 Integration across swaps, factories and compliance lists
**Low** (likelihood Medium, impact Low). Design and Code. `AuctionFactory.sol:16`, `:24-62`, `FixedPriceAuction.sol:315-327`.
- **Implementation swaps:** `config` decodes "by implementation", but nothing on-chain names a layout. An indexer that falls back to the v1 decoder can decode a new layout wrongly. A changed event signature silently drops events. Trailing bytes after the 320-byte config are accepted, so a strict decoder or a hash check can mismatch.
- **Proposal events:** a zero address in `ImplementationProposed` or `NewExecutorProposed` means the proposal was cancelled by rescue mode. `acceptImplementation` clears the proposal without its own event, so indexers clear it on `ImplementationSet`. The constructor now emits `ImplementationSet`, so an events-only allowlist is complete.
- **Factory replacement:** the indexer tracks a set of factories plus a cutoff for the old one. The old factory's `isAuction` stays true for its rogue auctions, and the retired factory should stay in rescue mode for good.
- **Compliance divergence:** each auction's pointer and disable are separate, the Well doesn't screen, and the indexer must screen with each target auction's pointer and its `ComplianceCheckDisabled` state.
- **Rotation:** rotating the factory's rescuer or executor leaves live auctions on the old keys. A breach-driven rotation needs a handover on every live auction.
- **Mutable code behind a pointer (accepted):** the implementation and the compliance list can each be a proxy, or an EIP-7702 delegated account, whose code changes after review. No on-chain check can rule that out, so the review before `proposeImplementation`, `acceptImplementation`, `createAuction` and `setComplianceCheck` is the control (audit finding 1). The factory still rejects an implementation with no code.
- **Mitigation:** allowlist implementations and fail closed on `ImplementationSet` until a decoder exists. Decide decision 12.

### T-18 Demand inflation off-chain
**Medium** (likelihood High, impact Low: it feeds decisions, not funds; was Low). Design. `WishingWell.sol:11`, `:14-17`.
- **One balance, many wishes:** `wishOf[account][from][to]` lets one `from` balance back wishes to many `to` tokens, with no on-chain balance check. The indexer caps an account's total wishes from one asset at its balance, and must say how a capped balance splits across pairs.
- **Borrowed or sampled balances:** an account borrows across the pinned balance block and wishes with the borrowed balance. A contract that makes arbitrary calls can be made to `wish()`, which attributes its balance to the attacker. TGLD bridged between per-chain snapshots can count twice.
- **Input:** the Well validates nothing: `from == to`, zero or non-token addresses, `expiresAt` of 0 or in the past. Anyone can emit `WishSet` for any key, so an indexer that stores every key can be bloated.
- **Mitigation:**
  - an unpredictable snapshot block, or a minimum balance over a window;
  - count only bucket tokens with `from != to`, filtering at ingest;
  - document 0 as expired and `type(uint64).max` as "no expiry";
  - count only allowlisted contract wishers;
  - one canonical TGLD chain.

### T-19 A hijacked msig can freeze TGLD auctions through TempleGold
**Low** (likelihood Low, impact Medium; was Low to Medium). A gap in the rescuer check. Code. TempleGold `_update` (`TempleGold.sol:227-231`), `FixedPriceAuction.sol:126`, `:145`, `:259-284`.
- **Scenario:** the msig owns TempleGold. A hijacked msig de-authorizes every live TGLD auction. Every TGLD deposit, refund, claim and treasury leg then reverts until it's re-authorized, and in a TGLD-fill auction the users' other-token refunds are stranded with them. Pause and cancel don't help, and the rescuer has no power over TempleGold.
- **Address prediction:** a Safe batch can't use return values, so authorizing a new auction "in the same batch" means precomputing the clone's address from the factory's nonce. If two queued creations run out of order, the wrong auction is authorized.
- **Mitigation:** D12. Authorize in a second transaction after reading `AuctionCreated`, before `depositStart`, and never de-authorize until claims are done.

### T-20 `deposits()` doesn't drop when an account claims
**Low** (likelihood Medium, impact Low). Proven (`test_poc_depositsPersistAfterClaim`). `FixedPriceAuction.sol:56`, `:246-264`.
- **Scenario:** an indexer that counts held tokens as wallet balance plus `deposits(account)` double-counts after a claim: the refund is in the wallet and `deposits()` still shows the full amount. The filled part has already gone to the proceeds recipient.
- **Mitigation:** D9. Held in auction is `deposits` plus `excluded(account)` while the auction is live, and `claimable(account).bidTokenRefund` plus `excluded(account)` once it's final.

### Info
- **Rounding dust is locked for good:** at most one wei per claimant per token stays counted in `bidOwed`/`fillOwed`, out of `recoverToken`'s reach. Intended. Proven.
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
   - Calling `endFulfillment` while paused "to end the incident" settles with whatever was funded.
   - `endFulfillment` can land before the funder's pending top-up; batch them. The funder can't pre-fund during Deposit.
3. **Stale implementation proposal:** a breached rescuer can still accept a stale `proposedImplementation` outside rescue mode. Clear it by overwriting it with the current implementation, or by switching rescue mode on and off.
4. **Blockers:** appointing the wrong account. A blocker can also `exclude` and `reinstate` on every auction pointing at the list, outside rescue mode (`reinstate` only during Deposit).
5. **Partial rotations:** rotating the rescuer or executor on the factory but not on live auctions or `ComplianceCheck`. Rescue mode is per contract too: switching it on at the factory leaves each auction's executor proposal live.
6. **Wrong values at creation:** a wrong `funder`, `proceedsRecipient`, price units, `minDeposit` or schedule in `createAuction`. All are fixed in the clone args; the only exit is `cancel` before `fulfillmentEnd`. A wrong compliance pointer is fixable with `setComplianceCheck`.
7. **Late admin transactions:** `cancel`, `endFulfillment` and `exclude` revert from the `fulfillmentEnd` second onward.
8. **Rescue mode left on with the rescuer key lost:** the msig is locked out for good, and if paused, funds are frozen for good.
9. **Over-funding:** excess funding during Fulfillment is at risk if the funder is compromised (T-6). Plain-transferred fill tokens aren't counted in `fillOwed` and can be recovered.
10. **TGLD:** authorize after `createAuction` from the emitted address, before `depositStart`; never de-authorize before claims are done (T-19); use the burner as `proceedsRecipient` (decision 11; nothing enforces it).
11. **Tokens with two addresses:** `recoverToken` only reserves the configured addresses.
12. **Wrong-chain TGLD:** TGLD on a chain where it can't be burned or moved back needs a deploy check.
13. **Excluding by mistake:** after `depositEnd` an exclusion can't be undone; the bidder only gets its bid back.
14. **Executor rotation takes two days:** on the factory, every auction and `ComplianceCheck`, `acceptExecutor` waits `EXECUTOR_HANDOVER_DELAY` (2 days), and a new proposal restarts the clock. Plan rotations, including emergency ones, around it.

## Test gaps

Still missing:
- **Invariant suite:**
  - one price per configuration, and timing never varies;
  - no factory rescue mode or multi-auction run;
  - funded settlement followed by a claim is thin, reached in only about 25–30% of runs;
  - `reinstate` is rarely reached in the handler (unit tests cover it).
- **Fuzz suite:** the fairness lower bound (each user gets at least their pro-rata share minus one wei) is checked only in the stateless fuzz.
