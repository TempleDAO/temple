# Threat analysis: simplified FixedPriceAuction, clone FixedPriceAuctionFactory, ComplianceCheck and WishingWell

| | |
|---|---|
| Scope | Branch `fpa-frozen-inputs`, which settles as a view over frozen deposits and funding. Rounds 1 and 2 ran on `fpa-simplified` at **08747cdd**, before this branch existed. Bidder exclusion (`exclude`, `reinstate`, `withdrawExcluded`) was added after round 2; the findings below were updated for it by review against that code, not by a third analysis round. On this branch there is no stored settlement (T-9 is resolved), there are no `bidOwed`/`fillOwed` counters (funding is `funding()`). Payout counters (`totalExcluded`, `bidPaid`, `fillPaid`) back `liabilities()`, and `recoverToken` sends only a token's balance above it, so donated TEMPLE or USDS can be recovered and owed funds can't. A settlement by the clock emits `AuctionSettled` at its first claim or `emitSettlement`. Both were added after the analysis rounds and reviewed against the code, not re-analysed. |
| Files | `protocol/contracts/templegold/{FixedPriceAuction,FixedPriceAuctionFactory,ComplianceCheck,WishingWell}.sol`, `templegold/access/{ExecutorAccess,RescuableAccess}.sol`, and their interfaces in `protocol/contracts/interfaces/templegold/`. Dependencies: Solady 0.1.26 `LibClone`, OZ 5.0.2 `SafeERC20`, `TempleMath`, `TempleGold` (TGLD only moves to or from authorized contracts). |
| Method | Two rounds of five independent analyses: privileged-role compromise, the unprivileged attacker, integration and indexers, lifecycle and economics, and a cross-check. Round 1 ran at f1ccb404. Round 2 ran at 08747cdd and re-checked every claim in round 1 and in the original analysis of PRs 1304 and 1305, which isn't in this branch. Non-obvious claims were proven with forge tests in scratch copies of `protocol/`. Those tests aren't in the branch. The headline findings were re-checked against the code by hand. |
| Source of truth | The branch code. The design proposal (`fpa-simplified-model.md`) was used only to say what the code is meant to do. Line numbers refer to 08747cdd. The frozen-inputs change and exclusion, added afterwards, shift FixedPriceAuction.sol, so search by function name. |
| Date | 2026-10-20 |

## Trust model

The msig (executor), the rescuer (a separate, well-secured multisig), the funder and the proceeds recipient are trusted, so "a malicious admin could…" findings are left out. There's one exception. The design builds deliberate checks on two roles, and those checks are analysed adversarially:
- the rescuer as a check on a hijacked msig: rescue mode on the factory and on each auction, the auction pause and `cancel` in rescue mode, `disableComplianceCheck`, and the second key on the implementation swap;
- the msig as a check on a rogue granted account or a broken compliance list: revoke and repoint.

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

## Summary

**No unprivileged party can take or lock other users' funds.** Every analysis, in both rounds, held on these points:
- **Solvency** held across bid and fill decimals 0–18, prices from 1e-18 to 2^200 fill per bid, and funding up to 2^250. After every claim the balances equal what's owed, and the dust is under one wei per claimant per token.
- **No double payment:** claims pay only `msg.sender` and the fixed treasury addresses.
- **`recoverToken` can't reach owed funds,** including a flagged account's unclaimed share, an excluded balance and rounding dust, and including after a cancel: it sends only the balance above `liabilities()`.
- **The clone factory holds:** no clone listed in `isAuction` runs code the rescuer didn't accept, or has roles the design forbids.

The material risks sit in the designed checks:

1. **[Medium, decision D11] A hijacked msig can steal the executor role in one transaction** ([T-2](#t-2-a-hijacked-msig-can-take-the-executor-role-in-one-transaction)). It proposes a new executor and accepts it in the same batch, on the factory, every auction and `ComplianceCheck`. Rescue mode only cancels a *pending* proposal, so a Safe hijacked for a single transaction is lost for good. A delay before `acceptExecutor` closes this.
2. **[Medium, decision D1] The rescuer's reaction window can be seconds** ([T-8](#t-8-rogue-auctions-through-the-genuine-factory)). A hijacked msig can create a genuine-looking auction that opens almost at once. From `depositEnd` it can settle the auction to itself, so the rescuer's hard deadline is `depositEnd`, not `fulfillmentEnd`. A minimum lead time and deposit window guarantee the rescuer time to cancel.
3. **[High, accepted] A breached rescuer can freeze every auction indefinitely, or cancel it outright** ([T-1](#t-1-a-breached-rescuer-can-freeze-or-cancel-auctions)). It switches rescue mode on and cancels in one transaction, with no window for the msig. The freeze outlasts settlement and has no cap.
4. **A breached rescuer takes the factory's rescuer role for good** ([T-4](#t-4-a-breached-rescuer-takes-the-factorys-rescuer-role-for-good)), so every later auction carries the attacker as rescuer.
5. **A hijacked msig can freeze every TGLD auction through TempleGold** ([T-19](#t-19-a-hijacked-msig-can-freeze-tgld-auctions-through-templegold)). The msig owns TempleGold and can de-authorize live auctions. The rescuer has no power over TempleGold.
6. **Coupled payouts** ([T-6](#t-6-treasury-payouts-are-coupled-and-fixed), [T-7](#t-7-a-users-two-claim-legs-are-coupled)). One blocklisted or unauthorized leg blocks the other, in both `claim` and `claimTreasury`.
7. **Exclusion is a new lever for whoever controls the compliance list** ([T-5](#t-5-compliance-control-under-compromise)). The msig, or any account granted `setFlagged` on the auction's list, can flag and exclude bidders until `fulfillmentEnd`, taking away their fills. Excluding some bidders moves their share of a partial funding to the rest; see T-5. Excluded deposits stay in the auction and are refundable once the account is cleared. Grants still work in rescue mode, so against a rogue grant the rescuer's answer is disabling compliance (decision D13).

Findings that are resolved, properties checked and found to hold, and the cross-check against the original analysis are in [threat-analysis-fpa-simplified-resolved.md](threat-analysis-fpa-simplified-resolved.md).

## Decisions for the team

| # | Question | Findings | Recommendation |
|---|---|---|---|
| D1 | Guarantee the rescuer a reaction window: a minimum lead time (`depositStart ≥ now + MIN_LEAD`) and a minimum deposit window, checked in `FixedPriceAuction.initialize`? Optionally a maximum fulfillment window too. | T-8, T-15 | Yes. This reverses the earlier "drop `MIN_LEAD`" call, because the rescuer's `cancel` only helps if it lands before `depositEnd`. Make the bounds constants in the implementation, not factory settings or config fields: the msig controls both, and the bounds exist to stop a hijacked msig. Changing them means a new implementation, which needs the rescuer. |
| D11 | Add a delay before `acceptExecutor` (for example 24 hours after the proposal), or let the rescuer propose an executor while rescue mode is on? | T-2, T-5 | Yes to the delay. Then rescue mode always has a window to cancel a hijacker's proposal, on the factory, auctions and `ComplianceCheck`. The rescuer-proposes option adds a power to the rescuer. |
| D2 | Let claims (`claim`, `claimTreasury`, `withdrawExcluded`) ignore the pause once `block.timestamp > fulfillmentEnd + N days`, so a breached or lost rescuer can't freeze settled funds for good? | T-1 | Worth it. Claims only ever pay the depositor, so this can't redirect funds. |
| D3 | Should the rescuer handover need a second key, or a delay? | T-4 | A delay on `acceptRescuer` lets the msig see a takeover coming. A second key gives a hijacked msig a veto. Otherwise document it. |
| D4 | Pay each `claim`/`claimTreasury` leg separately, or add the decision-6 setters? | T-6, T-7 | At least split `claimTreasury`. Its addresses are fixed for the auction's life. |
| D5 | Reject a code-less compliance pointer in `initialize` and `setComplianceCheck`? | T-14 | Yes. One line, and it turns a deploy typo into a revert. |
| D6 | Reject `proposeNewExecutor` in `ComplianceCheck.setExplicitAccess`? | T-13 | Yes. Today only the natspec warns about it. |
| D7 | Minimum token decimals (for example ≥ 6)? | T-11 | Yes, as a deploy check, or enforce it in `initialize`. |
| D8 | Is "settled" defined by `phase()` or by `AuctionSettled`? | T-9 ([resolved](threat-analysis-fpa-simplified-resolved.md)) | Define it by `phase()` in the indexer spec: a settlement by the clock emits `AuctionSettled` only at its first claim or `emitSettlement`, possibly long after `fulfillmentEnd`. |
| D9 | Indexer rules: fills per pair or per bucket, the tie rule for "settled after the wish", the cap split across pairs, "held in auction" from `claimable` once final, which list to screen against, zero-address proposal events as cancellations, and implementation allowlisting. Does an excluded balance count as demand, or only as held? | T-10, T-16, T-17, T-18, T-20 | Decide decisions 9 and 12 in the proposal, and fail closed on unknown implementations. |
| D10 | Who holds a standing `setFlagged` grant, so compliance control survives a lost Safe? | T-5 | A hardened ops key, which also sends flags privately (T-12). That exclusion can move allocation to a colluding bidder (T-5) strengthens the case for hardening it. |
| D12 | Who controls TempleGold authorization for live auctions? | T-19 | At minimum a runbook rule: never de-authorize an auction until its claims are done. Moving TempleGold ownership is out of scope here. |
| D13 | Should a `setFlagged` grant's power to exclude be locked while the auction is in rescue mode, like the msig? | T-5, T-2 | Worth considering. Today a hijacked msig that grants itself `setFlagged` on the list can still exclude bidders in an auction under rescue mode; the only answer is the rescuer disabling compliance, which ends screening for that auction. Exclusion can move allocation to a colluding bidder (T-5), not just grief, which strengthens the case for locking grants in rescue mode. |

## Findings

### T-1 A breached rescuer can freeze or cancel auctions
**High (accepted risk).** Proven. `RescuableAccess.sol:31-42`, `FixedPriceAuction.sol:177-188`, `:253-257`, `:417-420`. `claim`, `claimTreasury` and `withdrawExcluded` are `whenNotPaused`.
- **Freeze:** the attacker switches rescue mode on, then `setPaused(true)` on each auction. The msig can't unpause, cancel or `settleEarly`. After `fulfillmentEnd` the auction is in Settlement, but every claim reverts for as long as the attacker holds the key. A lost rescuer key while paused in rescue mode has the same effect.
- **Cancel:** the attacker batches `setRescueMode(true)` and `cancel()`. It can do this to a fully funded auction one block before `fulfillmentEnd`. The msig has no window to `settleEarly` first. Everyone is refunded; the sale is lost.
- **What stops it:** nothing on-chain. The msig's only levers (`cancel`, `settleEarly`) must land before the rescuer's first transaction.
- **Mitigation:** accepted in the proposal's rescue-mode callout. D2 would cap the freeze. Requiring a pause of some duration before a rescuer `cancel` would give the msig a visible window to settle a genuine auction.

### T-2 A hijacked msig can take the executor role in one transaction
**Medium. Decision D11.** Proven (`test_PR1_atomicExecutorSteal_beatsRescueCancel`, `test_XC_completedHandoverSurvivesRescueMode`). `ExecutorAccess.sol:24-40`, `RescuableAccess.sol:31-42`.
- **Open part:** the hijacked msig batches `proposeNewExecutor(thief)` and `acceptExecutor()` from the thief in one Safe transaction, on the factory, every live auction and `ComplianceCheck`. Nothing is left pending to cancel. Only the executor can propose a successor, so neither the rescuer nor the recovered Safe can take the role back.
- **Impact:** a Safe that was hijacked for one transaction becomes a Safe lost for good. The team needs a new factory and `ComplianceCheck`. Live auctions finish under permanent rescue mode, and the rescuer must keep the old factory in rescue mode forever. There is no fund loss.
- **With exclusion:** the thief who takes `ComplianceCheck`'s executor role can grant itself `setFlagged`, then flag and exclude bidders in every auction pointing at that list, even under rescue mode (D13). The rescuer's answer is disabling compliance on each auction, which also makes every excluded balance withdrawable.
- **Fix:** D11, a delay before `acceptExecutor`.

### T-4 A breached rescuer takes the factory's rescuer role for good
**Medium.** Code. `RescuableAccess.sol:49-62`, `FixedPriceAuctionFactory.sol:37`.
- **Scenario:** `proposeNewRescuer(attackerKey)`, then `acceptRescuer()`. The only guard is `!= executor`. Recovering the original rescuer Safe doesn't help. Every auction created afterwards carries the attacker as rescuer, with T-1's powers, and the attacker can hold the factory in rescue mode.
- **Recovery:** a new factory and an indexer migration. No funds are lost.
- **Mitigation:** the msig checks `factory.rescuer()` in every `createAuction` batch. D3 is the code option.

### T-5 Compliance control under compromise
**Medium.** Code. `ComplianceCheck.sol:26-49`, `FixedPriceAuction.sol:260-271`, and `exclude`, `reinstate` and `_onlyExclusionAdmin` in FixedPriceAuction.sol.
- **A hijacked msig on `ComplianceCheck`:** the contract has no rescue mode, so the msig can hand over its executor role for good, in one transaction (T-2). If it flags everyone, the rescuer's only answer is `disableComplianceCheck` on each auction, which is one-way and ends screening. Unflagging a sanctioned address can't be stopped on-chain. Recovery is a new `ComplianceCheck` and repointing each auction, which needs each auction's executor.
- **A breached rescuer:** it can disable compliance on every auction for good, one transaction each. The msig's only answer is to `cancel` before the rescuer switches rescue mode on for that auction.
- **A rogue granted account:** it can flag any bidder and, with exclusion, exclude them from every auction using the list until `fulfillmentEnd`, so they get no fill (refund only once cleared, or reinstated if cleared during Deposit). No deposits are taken, but in a partially funded auction an excluded bidder's share of the funding goes to the remaining bidders at the auction price. A grantee or hijacked msig with a colluding bidder therefore gains allocation it wouldn't otherwise get. Example: Alice and Bob bid 100 TEMPLE each and 400 of 800 USDS is funded; excluding Alice during Fulfillment gives Bob all 400 USDS instead of 200. The msig revokes the grant (`setExplicitAccess` is executor-only and can't be granted), repairs the list and reinstates bidders still in their deposit window. Bidders excluded after `depositEnd` can't be put back.
- **In rescue mode:** the msig is locked out of the auction, but a grant on the list isn't, so a rogue grantee can keep excluding. The rescuer's only answer is `disableComplianceCheck` on that auction (D13), which also ends list grants' `exclude` and `reinstate` powers there.
- **Mitigation:** design-accepted. D10 and D11.

### T-6 Treasury payouts are coupled and fixed
**Medium for a compromised proceeds recipient; Low otherwise.** Proven (`test_UA_blocklistedBidderAndRecipient`, `test_PR5_proceedsRecipient_payoutIsPermissionlessAfterClock`). `FixedPriceAuction.sol:212-231`.
- **Coupling:** `claimTreasury` pays `filledBids` to `proceedsRecipient` and `funderRefund` to `funder` in one call. If a blocklisting token (USDC) blocks either address, or blocks the auction itself, both legs are stuck. Both addresses are fixed in the clone args, and `recoverToken` can't send what's owed, so this is permanent.
- **A compromised `proceedsRecipient` after `fulfillmentEnd`:** `cancel` is no longer possible, and the attacker can call `claimTreasury` itself. Pausing stops it, but also stops every depositor's claim. Before `fulfillmentEnd`, pause and cancel works.
- **A compromised `funder`** can only lose its own tokens: `withdrawExcess` can't go below what fills every deposit. Any excess funding is lost whatever the msig does, because it reaches the same address as `funderRefund`. Fund exactly the requirement after `depositEnd`.
- **Mitigation:** D4, either separate legs or the decision-6 setters.

### T-7 A user's two claim legs are coupled
**Low.** Proven (`test_UA_blocklistedBidderAndRecipient`, round-1 `test_restrictedFill_unauthorisedClone_strandsUsers`). `FixedPriceAuction.sol:191-209`. TempleGold `_update` needs `from` or `to` authorized.
- **USDC blocklists a claimant:** their other-token leg reverts with it. Only that user is affected.
- **TGLD is one of the tokens and the clone isn't authorized on TempleGold** (never authorized, or de-authorized mid-life): every TGLD transfer from the auction to a user reverts, and every claim with it. Every user's other-token refund is stranded until the TempleGold owner authorizes the clone.
- **Mitigation:** the TGLD process in [Operational risks](#operational-risks), and D4.

### T-8 Rogue auctions through the genuine factory
**Medium; High before the rescuer reacts. Decision D1.** Proven (round-1 `test_PR3_hijackedMsig_rugAuction_rescuerCheck`, round-2 `test_poc_noLeadTime`, `test_msigFrontRunsRescuerCancel`). `FixedPriceAuctionFactory.sol:32-38`, `FixedPriceAuction.sol:81-87`, `:168-175`, `:177-188`.
- **Scenario:** a hijacked msig calls `createAuction` with itself as funder and proceeds recipient and a worthless fill token. `initialize` only requires `depositStart > block.timestamp`, so the auction can open a second later. `isAuction` is true, so front-ends list it as genuine. From `depositEnd` the msig funds with junk and calls `settleEarly` in one block, and `claimTreasury` pays the deposits to it.
- **The check:** the rescuer switches rescue mode on the factory (no more creations), then on each rogue auction switches rescue mode on and calls `cancel`. That refunds every depositor. It must land **before `depositEnd`**, because from then the msig can settle first, and a settled auction can't be cancelled. It takes two transactions per auction, and the attacker can create one auction per transaction.
- **Can't revoke:** `isAuction` stays true for a rogue auction, even after a cancel.
- **Against a genuine auction:** with exclusion, a hijacked msig can flag and exclude every bidder in a genuine auction before `fulfillmentEnd`, so nobody fills and the funder pays nothing. Excluding some bidders moves their share of a partial funding to the rest; see T-5. Every excluded deposit stays refundable once the rescuer disables compliance or the accounts are cleared.
- **Mitigation:**
  - D1 guarantees the rescuer a reaction window.
  - Alert on `AuctionCreated` with an unknown funder, proceeds recipient or compliance pointer.
  - Front-ends list only announced auctions, and check `inRescueMode()`, `phase()` and the treasury addresses, not just `isAuction`.

### T-10 Indexer ordering and semantics
**Low.** Code and Design. `FixedPriceAuction.sol:173`, `:379`, `WishingWell.sol:14-17`.
- **Timing:** a settlement by the clock emits `AuctionSettled` only at its first claim or `emitSettlement`, and `settledAt` is 0 until then. Compare `settledAt` if non-zero, else `fulfillmentEnd`, against the wish. `settleEarly` ties with a wish in the same block. `wishOf` stores no timestamp, so the rule needs logs.
- **Gaming the fill subtraction:**
  - **Fills via another pair go uncounted:** fills through a different pair in the same bucket are never subtracted.
  - **Wish resets:** under "a new wish resets fills", one transaction restores a filled wish.
  - **Deposit then wish:** depositing, then wishing for more, undercounts the extra demand.
  - **Address hopping:** a user who wishes from one address and bids from another keeps the wish counted after being filled.
- **Cancels reverse preview fills:** `AuctionCancelled` carries no `userRefund`, and fills drop to zero. The event doesn't say whether the rescuer cancelled.
- **Exclusion events:** `BidderExcluded` removes a deposit from the fill and lowers `totalDeposits`; `BidderReinstated` puts it back (Deposit only); `ExcludedWithdrawn` refunds it. Preview fills must be recomputed on each, and an excluded account's wish keeps counting unless the indexer drops it.
- **Mitigation:** D9. Pin the tie rule (block, logIndex), decide per-pair versus per-bucket matching, and reverse preview fills on `AuctionCancelled`.

### T-11 Low-decimal tokens lose each bidder's fractional fill
**Low.** Proven (`test_UA_zeroDecimalFill_wholeTokenLossPerBidder`, `test_smallDepositorPaysForNothing`). `FixedPriceAuction.sol:89-94`, `:335-346`, `:354-364`.
- **Scenario:** with a 0-decimal fill token worth 100 USDC, bidders of 199 USDC each get 1 unit. A 99 USDC bidder gets nothing and no refund, because the auction is fully filled. The treasury takes all the USDC, and the leftover units stay locked as dust. A 0-decimal bid token has the same problem on refunds.
- **Impact:** negligible for TGLD→USDC/USDS (at most 1e-6 USDC per bidder). Material only for tokens with 0–2 decimals.
- **Mitigation:** D7, and set `minDeposit` in every config.

### T-12 A target can front-run its own block
**Low** (higher if legal treats the freeze as mandatory). Design. `ComplianceCheck.sol:39-44`, `FixedPriceAuction.sol:120-136`, `:191-209`, `:411-415`.
- **Scenario:** queued Safe transactions are public before they execute. The target sees `setFlagged` (and the `exclude` batched with it) coming and withdraws during Deposit, or claims after settlement. During Fulfillment it can't withdraw, so exclusion lands. A flagged person can also use a fresh address.
- **Mitigation:** process only. A granted hot key sends `setFlagged` directly through a private relay, and known addresses are flagged before `depositStart`.

### T-13 A `proposeNewExecutor` grant on `ComplianceCheck` hands over the list
**Low.** Proven by the branch's own test. `ComplianceCheck.sol:26-49`.
- The grantee proposes itself, accepts, and owns the list.
- `setExplicitAccess` checks `executor` directly, so a grantee can't widen its own grant otherwise.
- The natspec documents the risk.
- **Mitigation:** D6.

### T-14 A code-less or reverting compliance pointer halts the auction
**Low.** Proven (`test_XC_codelessCompliancePointer`). `FixedPriceAuction.sol:80`, `:262`, `:411-415`.
- **Scenario:** `initialize` and `setComplianceCheck` reject only zero. An EOA or a non-conforming contract makes every `deposit`, `withdrawDeposit` and `claim` revert (it fails closed), and also `exclude`, `reinstate` and `withdrawExcluded`, which read the list.
- **Recovery:** one transaction, either the msig repoints or the rescuer disables.
- **Mitigation:** D5.

### T-15 No minimum notice or window length
**Low.** Code. `FixedPriceAuction.sol:81-87`.
- `initialize` only requires `depositStart > now` and strict ordering, so a one-second window is valid. Wishers can miss a short-notice auction, and the rescuer has no guaranteed time to react (T-8).
- **Mitigation:** D1.

### T-16 Look-alike auctions from the genuine implementation
**Low.** Proven (`test_UA_lookalikeCloneStealsBids`, `test_poc_thirdPartyClone`). `FixedPriceAuction.sol:72-98`, `FixedPriceAuctionFactory.sol:22`.
- **Scenario:** anyone can `LibClone.clone(implementation, ownConfig)` and `initialize` it with their own roles and a fake fill token. It runs Temple's verified code and emits the genuine events, and explorers show it as a proxy to verified source. That makes for convincing phishing.
- **What protects integrators:** an indexer that filters on the factory's `AuctionCreated` and `isAuction` is unaffected. Genuine code only emits `Deposited` for `msg.sender`, so it can't forge third-party deposits.
- **Mitigation:** the integrator docs say `isAuction` on the canonical factory is the only valid check, never a code or source match, and front-ends show token addresses, not just names.
  - **Optional hardening:** `initialize` requires the factory as caller.

### T-17 Integration across swaps, factories and compliance lists
**Low.** Design and Code. `FixedPriceAuctionFactory.sol:16`, `:24-62`, `FixedPriceAuction.sol:260-271`.
- **Implementation swaps:** `config` decodes "by implementation", but nothing on-chain names a layout. An indexer that falls back to the v1 decoder can decode a new layout wrongly. A changed event signature silently drops events. Trailing bytes after the 320-byte config are accepted, so a strict decoder or a hash check can mismatch.
- **Proposal events:** a zero address in `ImplementationProposed` or `NewExecutorProposed` means the proposal was cancelled by rescue mode. `acceptImplementation` clears the proposal without its own event, so indexers clear it on `ImplementationSet`. The constructor now emits `ImplementationSet`, so an events-only allowlist is complete.
- **Factory replacement:** the indexer tracks a set of factories plus a cutoff for the old one. The old factory's `isAuction` stays true for its rogue auctions, and the retired factory should stay in rescue mode for good.
- **Compliance divergence:** each auction's pointer and disable are separate, the Well doesn't screen, and the indexer must screen with each target auction's pointer and its `ComplianceCheckDisabled` state.
- **Rotation:** rotating the factory's rescuer or executor leaves live auctions on the old keys. A breach-driven rotation needs a handover on every live auction.
- **Mitigation:** allowlist implementations and fail closed on `ImplementationSet` until a decoder exists. Decide decision 12.

### T-18 Demand inflation off-chain
**Low** (it feeds decisions, not funds). Design. `WishingWell.sol:11`, `:14-17`.
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
**Low to Medium (a gap in the rescuer check).** Code. TempleGold `_update` (`TempleGold.sol:227-231`), `FixedPriceAuction.sol:116`, `:135`, `:204-229`.
- **Scenario:** the msig owns TempleGold. A hijacked msig de-authorizes every live TGLD auction. Every TGLD deposit, refund, claim and treasury leg then reverts until it's re-authorized, and in a TGLD-fill auction the users' other-token refunds are stranded with them. Pause and cancel don't help, and the rescuer has no power over TempleGold.
- **Address prediction:** a Safe batch can't use return values, so authorizing a new auction "in the same batch" means precomputing the clone's address from the factory's nonce. If two queued creations run out of order, the wrong auction is authorized.
- **Mitigation:** D12. Authorize in a second transaction after reading `AuctionCreated`, before `depositStart`, and never de-authorize until claims are done.

### T-20 `deposits()` doesn't drop when an account claims
**Low.** Proven (`test_poc_depositsPersistAfterClaim`). `FixedPriceAuction.sol:51`, `:191-209`.
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
4. **Grants:** granting any selector other than `setFlagged`. A mistyped selector silently grants nothing. A `setFlagged` grant also carries the power to `exclude` and `reinstate` on every auction pointing at the list.
5. **Partial rotations:** rotating the rescuer or executor on the factory but not on live auctions or `ComplianceCheck`. Rescue mode is per contract too: switching it on at the factory leaves each auction's executor proposal live.
6. **Wrong values at creation:** a wrong `funder`, `proceedsRecipient`, price units, `minDeposit` or schedule in `createAuction`. All are fixed in the clone args; the only exit is `cancel` before `fulfillmentEnd`. A wrong compliance pointer is fixable with `setComplianceCheck`.
7. **Late admin transactions:** `cancel`, `settleEarly` and `exclude` revert from the `fulfillmentEnd` second onward.
8. **Rescue mode left on with the rescuer key lost:** the msig is locked out for good, and if paused, funds are frozen for good.
9. **Over-funding:** excess funding during Fulfillment is at risk if the funder is compromised (T-6). A plain transfer of either auction token is recoverable only by the msig with `recoverToken` (the balance above `liabilities()`); fund exactly.
10. **TGLD:** authorize after `createAuction` from the emitted address, before `depositStart`; never de-authorize before claims are done (T-19); use the burner as `proceedsRecipient` (decision 11; nothing enforces it).
11. **Tokens with two addresses:** `recoverToken` only counts liabilities against the configured addresses; through the other address the whole balance is recoverable.
12. **Wrong-chain TGLD:** TGLD on a chain where it can't be burned or moved back needs a deploy check.
13. **Excluding by mistake:** after `depositEnd` an exclusion can't be undone; the bidder only gets its bid back.

## Test gaps

Still missing:
- **Invariant suite:**
  - one price per configuration, and timing never varies;
  - no factory rescue mode or multi-auction run;
  - funded settlement followed by a claim is thin;
  - `reinstate` is rarely reached in the handler (unit tests cover it).
- **Fuzz suite:** fairness (each user's share equals the exact pro-rata share rounded down) is checked only in the stateless fuzz.
