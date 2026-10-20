# Threat analysis: simplified FixedPriceAuction, clone AuctionFactory, ComplianceCheck and WishingWell

| | |
|---|---|
| Scope | Branch `fpa-simplified` at **dbe701af** (the code commit on `2127d590`, the head of [TempleDAO/temple#1305](https://github.com/TempleDAO/temple/pull/1305)). The contract code is identical to 08747cdd, where round 2 ran; dbe701af changes only tests, natspec and the README. |
| Files | `protocol/contracts/templegold/{FixedPriceAuction,AuctionFactory,ComplianceCheck,WishingWell}.sol`, `templegold/access/{ExecutorAccess,RescuableAccess}.sol`, and their interfaces in `protocol/contracts/interfaces/templegold/`. Dependencies: Solady 0.1.26 `LibClone`, OZ 5.0.2 `SafeERC20`, `TempleMath`, `TempleGold` (TGLD only moves to or from authorized contracts). |
| Method | Two rounds of five independent analyses: privileged-role compromise, the unprivileged attacker, integration and indexers, lifecycle and economics, and a cross-check. Round 1 ran at f1ccb404. Round 2 ran at 08747cdd and re-checked every claim in round 1 and in the original analysis of PRs 1304 and 1305, which isn't in this branch. Non-obvious claims were proven with forge tests in scratch copies of `protocol/`. Those tests aren't in the branch. The headline findings were re-checked against the code by hand. |
| Source of truth | The branch code. The design proposal (`fpa-simplified-model.md`) was used only to say what the code is meant to do. Line numbers refer to 08747cdd and may be off by a line or two at dbe701af. |
| Date | 2026-10-20 |

## Trust model

The msig (executor), the rescuer (a separate, well-secured multisig), the funder and the proceeds recipient are trusted, so "a malicious admin could…" findings are left out. There's one exception. The design builds deliberate checks on two roles, and those checks are analysed adversarially:
- the rescuer as a check on a hijacked msig: rescue mode on the factory and on each auction, the auction pause and `cancel` in rescue mode, `disableComplianceCheck`, and the second key on the implementation swap;
- the msig as a check on a rogue granted account or a broken compliance list: revoke and repoint.

Easy, hard-to-undo mistakes by trusted roles are listed separately under [Operational risks](#operational-risks).

The attackers and failure sources in scope are:
- unprivileged users, bidders, griefers and front-runners;
- callers of the permissionless functions (`claim`, `claimTreasury`), and anyone cloning the implementation;
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
- **`recoverToken` can't reach owed funds,** including a blocked account's unclaimed share, and including after a cancel.
- **The clone factory holds:** no clone listed in `isAuction` runs code the rescuer didn't accept, or has roles the design forbids.

The material risks sit in the designed checks:

1. **[Medium, decision D11] A hijacked msig can steal the executor role in one transaction** ([T-2](#t-2-a-hijacked-msig-can-take-the-executor-role-in-one-transaction)). It proposes a new executor and accepts it in the same batch, on the factory, every auction and `ComplianceCheck`. Rescue mode only cancels a *pending* proposal, so a Safe hijacked for a single transaction is lost for good. A delay before `acceptExecutor` closes this.
2. **[Medium, decision D1] The rescuer's reaction window can be seconds** ([T-8](#t-8-rogue-auctions-through-the-genuine-factory)). A hijacked msig can create a genuine-looking auction that opens almost at once. From `depositEnd` it can settle the auction to itself, so the rescuer's hard deadline is `depositEnd`, not `fulfillmentEnd`. A minimum lead time and deposit window guarantee the rescuer time to cancel.
3. **[High, accepted] A breached rescuer can freeze every auction indefinitely, or cancel it outright** ([T-1](#t-1-a-breached-rescuer-can-freeze-or-cancel-auctions)). It switches rescue mode on and cancels in one transaction, with no window for the msig. The freeze outlasts settlement and has no cap.
4. **A breached rescuer takes the factory's rescuer role for good** ([T-4](#t-4-a-breached-rescuer-takes-the-factorys-rescuer-role-for-good)), so every later auction carries the attacker as rescuer.
5. **A hijacked msig can freeze every TGLD auction through TempleGold** ([T-19](#t-19-a-hijacked-msig-can-freeze-tgld-auctions-through-templegold)). The msig owns TempleGold and can de-authorize live auctions. The rescuer has no power over TempleGold.
6. **Coupled payouts** ([T-6](#t-6-treasury-payouts-are-coupled-and-fixed), [T-7](#t-7-a-users-two-claim-legs-are-coupled)). One blocklisted or unauthorized leg blocks the other, in both `claim` and `claimTreasury`.

Resolved since round 1: a pending executor proposal now dies when rescue mode switches on, and so does a pending implementation proposal on the factory. The rescuer can `cancel` in rescue mode, which ends the permanent-freeze case of unbounded windows ([T-3](#t-3-unbounded-windows-resolved-low)).

## Decisions for the team

| # | Question | Findings | Recommendation |
|---|---|---|---|
| D1 | Guarantee the rescuer a reaction window: a minimum lead time (`depositStart ≥ now + MIN_LEAD`) and a minimum deposit window, checked in `FixedPriceAuction.initialize`? Optionally a maximum fulfillment window too. | T-8, T-3, T-15 | Yes. This reverses the earlier "drop `MIN_LEAD`" call, because the rescuer's `cancel` only helps if it lands before `depositEnd`. Make the bounds constants in the implementation, not factory settings or config fields: the msig controls both, and the bounds exist to stop a hijacked msig. Changing them means a new implementation, which needs the rescuer. |
| D11 | Add a delay before `acceptExecutor` (for example 24 hours after the proposal), or let the rescuer propose an executor while rescue mode is on? | T-2, T-5 | Yes to the delay. Then rescue mode always has a window to cancel a hijacker's proposal, on the factory, auctions and `ComplianceCheck`. The rescuer-proposes option adds a power to the rescuer. |
| D2 | Let claims ignore the pause once `block.timestamp > fulfillmentEnd + N days`, so a breached or lost rescuer can't freeze settled funds for good? | T-1 | Worth it. Claims only ever pay the depositor, so this can't redirect funds. |
| D3 | Should the rescuer handover need a second key, or a delay? | T-4 | A delay on `acceptRescuer` lets the msig see a takeover coming. A second key gives a hijacked msig a veto. Otherwise document it. |
| D4 | Pay each `claim`/`claimTreasury` leg separately, or add the decision-6 setters? | T-6, T-7 | At least split `claimTreasury`. Its addresses are fixed for the auction's life. |
| D5 | Reject a code-less compliance pointer in `initialize` and `setComplianceCheck`? | T-14 | Yes. One line, and it turns a deploy typo into a revert. |
| D6 | Reject `proposeNewExecutor` in `ComplianceCheck.setExplicitAccess`? | T-13 | Yes. Today only the natspec warns about it. |
| D7 | Minimum token decimals (for example ≥ 6)? | T-11 | Yes, as a deploy check, or enforce it in `initialize`. |
| D8 | Is "settled" defined by `phase()` or by `AuctionSettled`? Should `getTiming().settledAt` report `fulfillmentEnd` before the snapshot is written? | T-9 | Define it by `phase()` in the indexer spec. Optionally fix the view. |
| D9 | Indexer rules: fills per pair or per bucket, the tie rule for "settled after the wish", the cap split across pairs, "held in auction" from `claimable` once final, which list to screen against, zero-address proposal events as cancellations, and implementation allowlisting. | T-10, T-16, T-17, T-18, T-20 | Decide decisions 9 and 12 in the proposal, and fail closed on unknown implementations. |
| D10 | Who holds a standing `setBlocked` grant, so compliance control survives a lost Safe? | T-5 | A hardened ops key, which also sends blocks privately (T-12). |
| D12 | Who controls TempleGold authorization for live auctions? | T-19 | At minimum a runbook rule: never de-authorize an auction until its claims are done. Moving TempleGold ownership is out of scope here. |

## Findings

### T-1 A breached rescuer can freeze or cancel auctions
**High (accepted risk).** Proven. `RescuableAccess.sol:31-42`, `FixedPriceAuction.sol:177-188`, `:253-257`, `:417-420`. `claim` and `claimTreasury` are `whenNotPaused` (`:191`, `:212`).
- **Freeze:** the attacker switches rescue mode on, then `setPaused(true)` on each auction. The msig can't unpause, cancel or `endFulfillment`. After `fulfillmentEnd` the auction is Settled, but every claim reverts for as long as the attacker holds the key. A lost rescuer key while paused in rescue mode has the same effect.
- **Cancel:** the attacker batches `setRescueMode(true)` and `cancel()`. It can do this to a fully funded auction one block before `fulfillmentEnd`. The msig has no window to `endFulfillment` first. Everyone is refunded; the sale is lost.
- **What stops it:** nothing on-chain. The msig's only levers (`cancel`, `endFulfillment`) must land before the rescuer's first transaction.
- **Mitigation:** accepted in the proposal's rescue-mode callout. D2 would cap the freeze. Requiring a pause of some duration before a rescuer `cancel` would give the msig a visible window to settle a genuine auction.

### T-2 A hijacked msig can take the executor role in one transaction
**Medium. Decision D11.** Proven (`test_PR1_atomicExecutorSteal_beatsRescueCancel`, `test_XC_completedHandoverSurvivesRescueMode`). `ExecutorAccess.sol:24-40`, `RescuableAccess.sol:31-42`.
- **Resolved part:** a proposal the hijacked msig leaves *pending* now dies when rescue mode switches on (`RescuableAccess.sol:35-39`), and nobody can propose during rescue mode. On the factory, rescue mode also cancels a pending implementation proposal (`AuctionFactory.sol:57-62`).
- **Open part:** the hijacked msig batches `proposeNewExecutor(thief)` and `acceptExecutor()` from the thief in one Safe transaction, on the factory, every live auction and `ComplianceCheck`. Nothing is left pending to cancel. Only the executor can propose a successor, so neither the rescuer nor the recovered Safe can take the role back.
- **Impact:** a Safe that was hijacked for one transaction becomes a Safe lost for good. The team needs a new factory and `ComplianceCheck`. Live auctions finish under permanent rescue mode, and the rescuer must keep the old factory in rescue mode forever. There is no fund loss.
- **Fix:** D11, a delay before `acceptExecutor`.

### T-3 Unbounded windows (resolved, Low)
**Low.** Proven (`test_XC_farFulfillmentEnd_rescuerCancels`, 100 years in). `FixedPriceAuction.sol:81-87`, `:177-188`.
- **Before:** in round 1 a far-future `fulfillmentEnd` froze deposits for good, because the rescuer couldn't end an auction.
- **Now:** the rescuer can `cancel` in rescue mode at any time before `fulfillmentEnd`, which refunds everyone. With a far-future `fulfillmentEnd` that's always available.
- **Residual:** depositors have no exit between `depositEnd` and whenever a multisig acts. "Genuine auctions finish under rescue mode by the clock" is false for a long window: in rescue mode they can only be cancelled, never settled. A freeze is permanent only if the rescuer is lost too.
- **Mitigation:** a maximum fulfillment window (D1) is optional insurance.

### T-4 A breached rescuer takes the factory's rescuer role for good
**Medium.** Code. `RescuableAccess.sol:49-62`, `AuctionFactory.sol:37`.
- **Scenario:** `proposeNewRescuer(attackerKey)`, then `acceptRescuer()`. The only guard is `!= executor`. Recovering the original rescuer Safe doesn't help. Every auction created afterwards carries the attacker as rescuer, with T-1's powers, and the attacker can hold the factory in rescue mode.
- **Recovery:** a new factory and an indexer migration. No funds are lost.
- **Mitigation:** the msig checks `factory.rescuer()` in every `createAuction` batch. D3 is the code option.

### T-5 Compliance control under compromise
**Medium.** Code. `ComplianceCheck.sol:26-49`, `FixedPriceAuction.sol:260-271`.
- **A hijacked msig on `ComplianceCheck`:** the contract has no rescue mode, so the msig can hand over its executor role for good, in one transaction (T-2). If it blocks everyone, the rescuer's only answer is `disableComplianceCheck` on each auction, which is one-way and ends screening. Unblocking a sanctioned address can't be stopped on-chain. Recovery is a new `ComplianceCheck` and repointing each auction, which needs each auction's executor.
- **A breached rescuer:** it can disable compliance on every auction for good, one transaction each. The msig's only answer is to `cancel` before the rescuer switches rescue mode on for that auction.
- **A rogue granted account:** the msig revokes it (`setExplicitAccess` is executor-only and can't be granted) and repairs the list. Bidders blocked through `depositEnd` are locked into the sale.
- **Mitigation:** design-accepted. D10 and D11.

### T-6 Treasury payouts are coupled and fixed
**Medium for a compromised proceeds recipient; Low otherwise.** Proven (`test_UA_blocklistedBidderAndRecipient`, `test_PR5_proceedsRecipient_payoutIsPermissionlessAfterClock`). `FixedPriceAuction.sol:212-231`.
- **Coupling:** `claimTreasury` pays `filledDeposits` to `proceedsRecipient` and `funderRefund` to `funder` in one call. If a blocklisting token (USDC) blocks either address, or blocks the auction itself, both legs are stuck. Both addresses are fixed in the clone args, and `recoverToken` can't go below what's owed, so this is permanent.
- **A compromised `proceedsRecipient` after `fulfillmentEnd`:** `cancel` is no longer possible, and the attacker can call `claimTreasury` itself. Pausing stops it, but also stops every depositor's claim. Before `fulfillmentEnd`, pause and cancel works.
- **A compromised `funder`** can only lose its own tokens: `withdrawExcess` can't go below what fills every deposit. Any excess funding is lost whatever the msig does, because it reaches the same address as `funderRefund`. Fund exactly the requirement after `depositEnd`.
- **Mitigation:** D4, either separate legs or the decision-6 setters.

### T-7 A user's two claim legs are coupled
**Low.** Proven (`test_UA_blocklistedBidderAndRecipient`, round-1 `test_restrictedFill_unauthorisedClone_strandsUsers`). `FixedPriceAuction.sol:191-209`. TempleGold `_update` needs `from` or `to` authorized.
- **USDC blocklists a claimant:** their other-token leg reverts with it. Only that user is affected.
- **TGLD is one of the tokens and the clone isn't authorized on TempleGold** (never authorized, or de-authorized mid-life): every TGLD transfer from the auction to a user reverts, and every claim with it. Every user's other-token refund is stranded until the TempleGold owner authorizes the clone.
- **Mitigation:** the TGLD process in [Operational risks](#operational-risks), and D4.

### T-8 Rogue auctions through the genuine factory
**Medium; High before the rescuer reacts. Decision D1.** Proven (round-1 `test_PR3_hijackedMsig_rugAuction_rescuerCheck`, round-2 `test_poc_noLeadTime`, `test_msigFrontRunsRescuerCancel`). `AuctionFactory.sol:32-38`, `FixedPriceAuction.sol:81-87`, `:168-175`, `:177-188`.
- **Scenario:** a hijacked msig calls `createAuction` with itself as funder and proceeds recipient and a worthless fill token. `initialize` only requires `depositStart > block.timestamp`, so the auction can open a second later. `isAuction` is true, so front-ends list it as genuine. From `depositEnd` the msig funds with junk and calls `endFulfillment` in one block, and `claimTreasury` pays the deposits to it.
- **The check:** the rescuer switches rescue mode on the factory (no more creations), then on each rogue auction switches rescue mode on and calls `cancel`. That refunds every depositor. It must land **before `depositEnd`**, because from then the msig can settle first, and a settled auction can't be cancelled. It takes two transactions per auction, and the attacker can create one auction per transaction.
- **Can't revoke:** `isAuction` stays true for a rogue auction, even after a cancel.
- **Mitigation:**
  - D1 guarantees the rescuer a reaction window.
  - Alert on `AuctionCreated` with an unknown funder, proceeds recipient or compliance pointer.
  - Front-ends list only announced auctions, and check `inRescueMode()`, `phase()` and the treasury addresses, not just `isAuction`.

### T-9 A clock-settled auction emits no event, and `settledAt` stays 0
**Low.** Proven. `FixedPriceAuction.sol:44`, `:285-288`, `:315-322`, `:366-380`.
- **Scenario:** once `fulfillmentEnd` passes, `phase()` returns Settled, but `settledAt` stays 0 and `AuctionSettled` is only emitted by the first successful `claim` or `claimTreasury`. That never happens in three cases:
  - while the auction is paused;
  - when a non-depositor claims, because `NothingToClaim` rolls the settlement back;
  - with zero deposits and nobody calling `claimTreasury`, or a blocklisted treasury address.
- **Impact:** an indexer that waits for the event stays in its "before settlement" branch. The amounts don't drift: after `fulfillmentEnd`, `previewSettlement` equals the final snapshot.
- **Mitigation:** D8. Effective settlement time is the event's `settledAt` if present, else `fulfillmentEnd` once the phase is Settled.

### T-10 Indexer ordering and semantics
**Low.** Code and Design. `FixedPriceAuction.sol:173`, `:379`, `WishingWell.sol:14-17`.
- **Timing:** a lazy settlement's event lands long after `settledAt`. Compare `settledAt`, not the event's block time, against the wish. `endFulfillment` ties with a wish in the same block. `wishOf` stores no timestamp, so the rule needs logs.
- **Gaming the fill subtraction:**
  - **Fills via another pair go uncounted:** fills through a different pair in the same bucket are never subtracted.
  - **Wish resets:** under "a new wish resets fills", one transaction restores a filled wish.
  - **Deposit then wish:** depositing, then wishing for more, undercounts the extra demand.
  - **Address hopping:** a user who wishes from one address and bids from another keeps the wish counted after being filled.
- **Cancels reverse preview fills:** `AuctionCancelled` carries no `userRefund`, and fills drop to zero. The event doesn't say whether the rescuer cancelled.
- **Mitigation:** D9. Pin the tie rule (block, logIndex), decide per-pair versus per-bucket matching, and reverse preview fills on `AuctionCancelled`.

### T-11 Low-decimal tokens lose each bidder's fractional fill
**Low.** Proven (`test_UA_zeroDecimalFill_wholeTokenLossPerBidder`, `test_smallDepositorPaysForNothing`). `FixedPriceAuction.sol:89-94`, `:335-346`, `:354-364`.
- **Scenario:** with a 0-decimal fill token worth 100 USDC, bidders of 199 USDC each get 1 unit. A 99 USDC bidder gets nothing and no refund, because the auction is fully filled. The treasury takes all the USDC, and the leftover units stay locked as dust. A 0-decimal bid token has the same problem on refunds.
- **Impact:** negligible for TGLD→USDC/USDS (at most 1e-6 USDC per bidder). Material only for tokens with 0–2 decimals.
- **Mitigation:** D7, and set `minDeposit` in every config.

### T-12 A target can front-run its own block
**Low** (higher if legal treats the freeze as mandatory). Design. `ComplianceCheck.sol:39-44`, `FixedPriceAuction.sol:120-136`, `:191-209`, `:411-415`.
- **Scenario:** queued Safe transactions are public before they execute. The target sees `setBlocked` coming and withdraws during Deposit, or claims after settlement. A blocked person can also use a fresh address.
- **Mitigation:** process only. A granted hot key sends `setBlocked` directly through a private relay, and known addresses are blocked before `depositStart`.

### T-13 A `proposeNewExecutor` grant on `ComplianceCheck` hands over the list
**Low.** Proven by the branch's own test. `ComplianceCheck.sol:26-49`.
- The grantee proposes itself, accepts, and owns the list.
- `setExplicitAccess` checks `executor` directly, so a grantee can't widen its own grant otherwise.
- The natspec documents the risk.
- **Mitigation:** D6.

### T-14 A code-less or reverting compliance pointer halts the auction
**Low.** Proven (`test_XC_codelessCompliancePointer`). `FixedPriceAuction.sol:80`, `:262`, `:411-415`.
- **Scenario:** `initialize` and `setComplianceCheck` reject only zero. An EOA or a non-conforming contract makes every `deposit`, `withdrawDeposit` and `claim` revert (it fails closed).
- **Recovery:** one transaction, either the msig repoints or the rescuer disables.
- **Mitigation:** D5.

### T-15 No minimum notice or window length
**Low.** Code. `FixedPriceAuction.sol:81-87`.
- `initialize` only requires `depositStart > now` and strict ordering, so a one-second window is valid. Wishers can miss a short-notice auction, and the rescuer has no guaranteed time to react (T-8).
- **Mitigation:** D1.

### T-16 Look-alike auctions from the genuine implementation
**Low.** Proven (`test_UA_lookalikeCloneStealsBids`, `test_poc_thirdPartyClone`). `FixedPriceAuction.sol:72-98`, `AuctionFactory.sol:22`.
- **Scenario:** anyone can `LibClone.clone(implementation, ownConfig)` and `initialize` it with their own roles and a fake fill token. It runs Temple's verified code and emits the genuine events, and explorers show it as a proxy to verified source. That makes for convincing phishing.
- **What protects integrators:** an indexer that filters on the factory's `AuctionCreated` and `isAuction` is unaffected. Genuine code only emits `Deposited` for `msg.sender`, so it can't forge third-party deposits.
- **Mitigation:** the integrator docs say `isAuction` on the canonical factory is the only valid check, never a code or source match, and front-ends show token addresses, not just names.
  - **Optional hardening:** `initialize` requires the factory as caller.

### T-17 Integration across swaps, factories and compliance lists
**Low.** Design and Code. `AuctionFactory.sol:16`, `:24-62`, `FixedPriceAuction.sol:260-271`.
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
- **Mitigation:** D9. Held in auction is `deposits` while the auction is live, and `claimable(account).bidTokenRefund` once it's final.

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
4. **Grants:** granting any selector other than `setBlocked`. A mistyped selector silently grants nothing.
5. **Partial rotations:** rotating the rescuer or executor on the factory but not on live auctions or `ComplianceCheck`. Rescue mode is per contract too: switching it on at the factory leaves each auction's executor proposal live.
6. **Wrong values at creation:** a wrong `funder`, `proceedsRecipient`, price units, `minDeposit` or schedule in `createAuction`. All are fixed in the clone args; the only exit is `cancel` before `fulfillmentEnd`. A wrong compliance pointer is fixable with `setComplianceCheck`.
7. **Late admin transactions:** `cancel` and `endFulfillment` revert from the `fulfillmentEnd` second onward.
8. **Rescue mode left on with the rescuer key lost:** the msig is locked out for good, and if paused, funds are frozen for good.
9. **Over-funding:** excess funding during Fulfillment is at risk if the funder is compromised (T-6). Plain-transferred fill tokens aren't counted in `fillOwed` and can be recovered.
10. **TGLD:** authorize after `createAuction` from the emitted address, before `depositStart`; never de-authorize before claims are done (T-19); use the burner as `proceedsRecipient` (decision 11; nothing enforces it).
11. **Tokens with two addresses:** `recoverToken` only reserves the configured addresses.
12. **Wrong-chain TGLD:** TGLD on a chain where it can't be burned or moved back needs a deploy check.

## Checked and found closed

- **Stealing others' funds:** claims pay `msg.sender` only. Each share is `floor(d·X/T)`, so the shares sum to at most the snapshot. The treasury takes exactly `filledDeposits` and `funderRefund`.
- **Solvency at extremes:** holds for decimals 0–18 both ways, prices up to 2^200, and funding up to 2^250. The deposit-time `_requiredFunding` guard bounds every later `mulDiv`. The branch now has a test at the overflow bound.
- **Lazy settlement can't drift:** after `fulfillmentEnd`, no state-changing function works until settlement, so whoever settles first computes the same numbers.
- **Phase boundaries:** `depositEnd` and `fulfillmentEnd` each start the next phase, consistently across `_phase`, `cancel` and `_settleIfDue`.
- **Front-running bidders:** deposits close before any funding, and `withdrawExcess` is computed against a fixed requirement.
- **Reentrancy:** state is written before every transfer, and a recipient-hook token re-entering `claim` hits `AlreadyClaimed`. `isBlocked` is a view and runs as a STATICCALL.
- **Claims can't be DoS'd:** there are no loops. A claim whose shares both round to zero still succeeds.
- **Donations:** settlement and `recoverToken` use the owed counters, not balances, so a stray transfer changes nothing.
- **Rescuer cancel:** refunds exactly (`amount·T/T`) and can't redirect funds. It closes cleanly against `endFulfillment` in both directions and moves with a rescuer handover. The rescuer still can't `endFulfillment`, `recoverToken`, `setComplianceCheck`, `createAuction` or `proposeImplementation`.
- **Factory and clones:**
  - **Swap safety:** acceptance is by address, so a proposal swapped after review reverts. Rescue mode on the factory cancels a pending proposal.
  - **Rescuer limits:** the rescuer alone can't add code.
  - **Initialization:** clone and `initialize` happen in one call, and the implementation is locked in its constructor and inert.
  - **Clone args:** they're read from code, not calldata. Malformed args revert, and dirty upper bits are rejected.
  - **No puppet rescuer or executor** can be passed in, and a pending rescuer handover doesn't leak into new auctions.
- **Access bases:** the executor and rescuer can't collide under any order of handovers. Rescue mode locks every `onlyElevatedAccess` function on both the factory and the auction. No executor proposal can exist in rescue mode, so `acceptExecutor` needs no rescue check.
- **Packed storage slot:** all six fields survive interleaved writes.
- **Grants:** a grantee can't widen its own grant, and `setExplicitAccess` and `acceptExecutor` aren't grantable.
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
| I-2 Front-running exclusion | Changed: now front-running `setBlocked` | T-12 |
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

## Test gaps

The branch now has tests for the rescuer's cancel, proposal cancellation on rescue mode, settlement at the overflow bound, and 226 hand-written mutants of which only behaviour-equivalent ones survive. What's still missing:
- **Invariant suite:**
  - one configuration only: 18/18 decimals, one price, fake tokens with no TGLD restriction or blocklisting;
  - no end-of-run drain (unpause, unblock, everyone claims, nothing reverts);
  - timing and role rotation never vary, and there's no factory rescue mode or multi-auction run;
  - only about 1–3% of runs reach a funded settlement followed by a claim.
- **Fuzz suite:** the decimal-mix fuzz covers settlement maths only, without pause, cancel, rescue or compliance interleavings. Fairness is checked as an upper bound only, not that each user gets at least their pro-rata share minus one wei.
- **Events:** nothing checks that `AuctionSettled` is emitted exactly once and matches the snapshot.
- **TGLD:** no test uses real TGLD; T-7 and T-19 are proven with a mock that has the same transfer rule.
