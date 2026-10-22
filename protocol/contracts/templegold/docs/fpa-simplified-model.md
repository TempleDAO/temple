# FixedPriceAuction and Wishing Well: a simplified model

This proposal simplifies [TempleDAO/temple#1305](https://github.com/TempleDAO/temple/pull/1305) (FixedPriceAuction, at `2127d590`) and [#1304](https://github.com/TempleDAO/temple/pull/1304) (WishingWell, at `4320b382`) to the smallest design that meets the requirements below.

These roles appear throughout:

| Role | Who it is |
|---|---|
| **msig** | The team multisig, the `executor` in code. |
| **granted account** | An account the msig grants `setBlocked` with `setExplicitAccess`, as in `TempleElevatedAccess`. |
| **rescuer** | A guardian held by a separate, well-secured multisig. It has narrow powers, and the msig can't change it. |
| **funder**, **proceedsRecipient** | Treasury addresses. |

A FixedPriceAuction sells `fillToken` for deposited `bidToken` at a fixed price. Depositors bid during a deposit window, and the Treasury funds during a fulfillment window. If funding falls short, every depositor fills the same fraction.

The requirements are:

- if an account is blocked, its funds stay in the auction, and nothing moves them to escrow or releases them after a delay;
- a compliance list that the msig or a granted account can edit, with a pointer the msig can update;
- a rescuer-only, one-way switch to disable compliance, as a check on a rogue msig;
- a way to stop everything in an incident, which the msig controls and the rescuer can take over.

The Wishing Well lets an account record that it would swap one token for another. The team sums these wishes off-chain to decide which auctions to run.

Numbered decisions refer to the list at the end.

## The design in brief

`ComplianceCheck` blocks addresses. Each auction has its own pause that stops every function that moves tokens. Blocked or paused means the call reverts and the money stays put. The rescuer can disable compliance for good. It can also switch on rescue mode, which locks the msig out of the auction and lets the rescuer pause and unpause until it switches rescue mode off.

## Who can call what

| Role | In code | Can do |
|---|---|---|
| **msig** (factory) | `executor`; locked out while the factory's rescue mode is on | `createAuction`, `proposeImplementation`, `proposeNewExecutor` |
| **msig** (auction) | `executor`; locked out while rescue mode is on | `cancel`, `settleEarly`, `setPaused`, `setComplianceCheck`, `recoverToken`, `exclude`, `reinstate`, `proposeNewExecutor`, and the proposed `setFunder`/`setProceedsRecipient` (decision 6) |
| **msig** (`ComplianceCheck`) | `executor` | `setBlocked`, `setExplicitAccess` |
| **granted account** | an address the msig grants with `setExplicitAccess` | the functions granted, normally `setBlocked`. A `setBlocked` grant also lets it `exclude` and `reinstate` on every auction pointing at that list, in rescue mode too, while compliance is enabled |
| **rescuer** | `rescuer` (each auction takes the factory's current one) | factory: `acceptImplementation`, `setRescueMode`, and the two-step rescuer handover. Auction: `disableComplianceCheck` (one-way, any time), `setRescueMode`, `setPaused` and `cancel` while rescue mode is on, and the two-step rescuer handover. Nothing else. |
| **funder** | `funder` (fixed at deploy, see decision 6) | `fund`, `withdrawExcess` |
| **anyone** | — | `deposit`, `withdrawDeposit`, `claim`, `withdrawExcluded`, `claimTreasury` (pays the funder and proceeds addresses), `emitSettlement` |

## Contracts

### 1. `ComplianceCheck` (new, one shared instance)

```solidity
contract ComplianceCheck is IComplianceCheck, ExecutorAccess {
    mapping(address account => bool blocked) public isBlocked;
    mapping(address caller => mapping(bytes4 fnSelector => bool allowed)) public explicitFunctionAccess;

    event BlockedSet(address indexed account, bool blocked);

    function setExplicitAccess(address allowedCaller, ExplicitAccess[] calldata access) external { /* msig only */ }
    function setBlocked(address[] calldata accounts, bool value) external onlyElevatedAccess {}
}
```

`ComplianceCheck` uses the same per-function grants as `TempleElevatedAccess`: the `executor`, and any account the msig grants `setBlocked`, can edit the list. There's no rescuer and no rescue mode. A grant of `proposeNewExecutor` would hand over the executor role, so the msig only ever grants `setBlocked`.

If you later want a Chainalysis sanctions feed, deploy a new `ComplianceCheck` that wraps it and have the msig repoint each auction.

Put `IComplianceCheck` in its own file, imported by `ComplianceCheck`, the auction and the factory. #1305 declares `IComplianceCheck` and `IAuctionTokenRegistry` in `IFixedPriceAuction.sol`, and #1304 declares them again in `WishingWell.sol`, so a file that imports both files whole fails to compile.

### 2. `FixedPriceAuction` (simplified)

```text
Clone args: bidToken, fillToken, price, depositStart, depositEnd, fulfillmentEnd,
            minDeposit, funder, proceedsRecipient, initial complianceCheck
            (fixed for the auction's life; see section 4)

State:      priceDenominator (set once in initialize)
            complianceCheck (msig-settable), complianceDisabled (one-way)
            paused
            outcome (None | Settled | Cancelled)
            settledAt (set by settleEarly, or to fulfillmentEnd by the first claim or
            emitSettlement after a settlement by the clock)
            deposits[account], claimed[account], treasuryClaimed
            totalDeposits (excluded balances aren't in it)
            excluded[account] (bid tokens taken out of the fill; never filled)
            funding (fill tokens funded, net of withdrawExcess; fixed once Fulfillment ends)
            totalExcluded, bidPaid, fillPaid (payout counters, read only by liabilities())
            No settlement snapshot: the settlement is a view over totalDeposits and
            funding, which stop changing once the phase is final.
```

Bidders deposit `bidToken`, and the funder supplies `fillToken`. `price` is fill tokens per whole bid token, scaled by 1e18; `priceDenominator` is derived from the tokens' decimals at deploy. Phases: Scheduled before `depositStart`, Deposit until `depositEnd`, Fulfillment until `fulfillmentEnd`, then Settled (or Settled early when the msig calls `settleEarly`). If `funding` covers only part of the deposits, every depositor fills the same fraction and gets the rest of their bid tokens back.

| Function | What it does | Caller | Phase | Blocked address | Paused |
|---|---|---|---|---|---|
| `deposit(amount)` | Pulls bid tokens from the caller and adds them to their deposit. Enforces `minDeposit`. | anyone | Deposit | revert | revert |
| `withdrawDeposit(amount)` | Returns part or all of the caller's deposit. What's left must be zero or at least `minDeposit`. | depositor | Deposit | revert | revert |
| `fund(amount)` | Pulls fill tokens from the funder into the auction. | funder | Fulfillment | — | revert |
| `withdrawExcess(amount)` | Returns fill tokens above what's needed to fill every deposit. | funder | Fulfillment | — | revert |
| `settleEarly()` | Settles the auction now, with the funding held so far. | msig | Fulfillment | — | allowed |
| `cancel()` | Aborts the auction: no trade, all deposits and funding become refundable. | msig; the rescuer instead while rescue mode is on | unsettled, before `fulfillmentEnd` | — | allowed |
| `exclude(account)` | Moves a blocked bidder's whole deposit out of the fill into `excluded[account]`, lowering `totalDeposits`. No tokens move. | msig (locked out in rescue mode), or an account the current list grants `setBlocked` | Deposit or Fulfillment | the target must be blocked; reverts once compliance is disabled | allowed |
| `reinstate(account)` | Puts a cleared account's excluded balance back into its deposit. Re-runs the deposit overflow guard. | as `exclude`; a list grant stops counting once compliance is disabled | Deposit | the target must not be blocked | allowed |
| `withdrawExcluded()` | Returns the caller's whole excluded balance. | excluded bidder | any | revert; withdraw later | revert |
| `claim()` | Pays the caller their pro-rata fill tokens and the unfilled refund. On a cancelled auction it refunds the whole deposit. | depositor | Settled or Cancelled | revert; claim later | revert |
| `claimTreasury()` | Pays `filledBids` to `proceedsRecipient` and `funderRefund` to `funder` from the settlement. | anyone | Settled or Cancelled | — | revert |
| `emitSettlement()` | Emits `AuctionSettled` for a settlement by the clock, if no claim has yet, and records `fulfillmentEnd` in `settledAt`. Once. | anyone | Settled | — | allowed |
| `recoverToken(token, to, amount)` | Sends out a token's surplus, such as tokens sent by mistake: the balance less `liabilities()` for the bid and fill tokens, the whole balance for any other token. | msig | any | — | revert |
| `setPaused(bool)` | Pauses or unpauses the auction. | msig; the rescuer instead while rescue mode is on | any | — | allowed |
| `setRescueMode(bool)` | Switches rescue mode on or off. While it's on, the msig can't call any msig function on that auction and the rescuer controls the pause. | rescuer | any | — | allowed |
| `proposeNewExecutor`/`acceptExecutor`, `proposeNewRescuer`/`acceptRescuer` | Two-step role handovers (see the rescue-mode callout). | propose: msig (locked out in rescue mode) or rescuer; accept: the proposed address | any | — | allowed |
| `setComplianceCheck(addr)` | Points the auction at a `ComplianceCheck` contract, for example to replace a broken or rogue one. Reverts on `address(0)`. Only `disableComplianceCheck` turns screening off. | msig | any, until disabled | — | allowed |
| `disableComplianceCheck()` | Switches screening off for good. Afterwards `setComplianceCheck` reverts. | rescuer | any | — | allowed |
| `setFunder(addr)`, `setProceedsRecipient(addr)` | Proposed (decision 6). Replace a compromised Treasury address. | msig | any | — | allowed |
| views: `phase`, `getConfig`, `settlement`, `claimable`, `treasuryClaimable`, `withdrawableExcess`, `liabilities` | Read the current phase, the deployment terms and schedule, the settlement maths, what each party can claim, how much funding the funder can withdraw now, and what the auction still owes in each token. | anyone | any | — | allowed |

`fund`, `withdrawExcess` and `claimTreasury` aren't screened, because they only pay Treasury addresses.

```solidity
function _isBlocked(address a) private view returns (bool) {
    return !complianceDisabled && IComplianceCheck(complianceCheck).isBlocked(a);
}
```

The pause stops every function that moves tokens. `settleEarly` moves no tokens, so it works while paused, as `endFulfillment` does today. The pause has no timer and no single-use limit. The msig toggles the pause. The rescuer can take over the pause (see [Pause and rescue mode](#pause-and-rescue-mode)). The clock keeps running while paused, so a long pause can let the deposit or fulfillment window lapse.

> [!NOTE]
> **A pause during the fulfillment window decides the funding.** `fund` and `withdrawExcess` revert while paused, and the clock doesn't stop. If the auction is still paused when `fulfillmentEnd` passes, it settles with whatever funding it held when the pause began: a partial fill, or no fill and a full refund for every depositor. Unpause before `fulfillmentEnd` if the funder still needs to top up. A pause held across `depositEnd` likewise takes away depositors' right to withdraw.

> [!IMPORTANT]
> **Rescue mode needs its own small access-control base.** While rescue mode is on, the rescuer controls the pause and can `cancel`, and gets none of the msig's other powers: no `settleEarly`, `setComplianceCheck`, `recoverToken`, factory or address setters.
>
> ```solidity
> // ExecutorAccess: the executor passes; RescuableAccess narrows it.
> function _isElevatedAccess(address caller, bytes4 fnSelector) internal view override returns (bool) {
>     return !inRescueMode && super._isElevatedAccess(caller, fnSelector);
> }
>
> function setPaused(bool value) external {
>     if (inRescueMode ? msg.sender != rescuer : msg.sender != executor) revert InvalidAccess();
>     emit PausedSet(value);
>     paused = value;
> }
> ```
>
> Don't inherit `TempleElevatedAccess` as it is. In its rescue mode the rescuer passes every `onlyElevatedAccess` check. In #1305 that means the three cancel functions, `endDeposit`, `endFulfillment`, `setDepositsPaused`, `setMaxTotalDeposits`, `recoverToken`, `excludeBidder`, `proposeRelease`/`executeRelease`, `disableComplianceCheck`, `setExplicitAccess` and `proposeNewExecutor`. Here it would also cover `setComplianceCheck`.
>
> **Accepted risk.** A breached rescuer could lock the msig out of an auction. It could keep the auction paused, even past settlement, unpause one the msig paused during an incident, or cancel a genuine auction, which refunds everyone and loses the sale. Claims only ever pay the depositor, so funds can't be redirected. The team accepts this risk because the rescuer is a separate, well-secured multisig.
>
> Rescue mode is per auction. Each auction keeps the two-step handovers from `TempleElevatedAccess`, with two changes. The rescuer can't propose a new executor, and switching rescue mode on cancels any pending executor proposal, so a hijacked msig can't leave one to be accepted once rescue mode lifts. On the factory it also cancels a pending implementation proposal. Rescue mode is per contract: switching it on at the factory doesn't touch the auctions' proposals. `proposeNewRescuer` is rescuer-only, and `acceptRescuer` is callable only by the proposed rescuer, so only the rescuer picks its successor. The factory already rotates its own rescuer two-step; rotating it on live auctions is decision 14. `ComplianceCheck` has no rescuer and no rescue mode; the rescuer's answer to a rogue list is `disableComplianceCheck` on each auction.

#### Pause and rescue mode

```mermaid
stateDiagram-v2
    direction LR
    state "Running · msig in control" as RunMsig
    state "Paused · msig in control" as PauseMsig
    state "Running · rescue mode (msig locked out)" as RunRescue
    state "Paused · rescue mode (msig locked out)" as PauseRescue

    [*] --> RunMsig
    RunMsig --> PauseMsig: msig setPaused(true)
    PauseMsig --> RunMsig: msig setPaused(false)

    RunMsig --> RunRescue: rescuer setRescueMode(true)
    PauseMsig --> PauseRescue: rescuer setRescueMode(true)

    RunRescue --> PauseRescue: rescuer setPaused(true)
    PauseRescue --> RunRescue: rescuer setPaused(false)

    RunRescue --> RunMsig: rescuer setRescueMode(false)
    PauseRescue --> PauseMsig: rescuer setRescueMode(false)
```

| State | Bidders (deposit, withdraw, claim) | msig functions | Who controls the pause |
|---|---|---|---|
| Running · msig | work, unless the account is blocked | work | msig |
| Paused · msig | revert; funds stay put | work, except `recoverToken`; `cancel` only before `fulfillmentEnd` | msig |
| Running · rescue mode | work, unless the account is blocked | locked out | rescuer |
| Paused · rescue mode | revert; funds stay put | locked out | rescuer |

`disableComplianceCheck` sits outside these states. The rescuer can call it in any state; it's one-way, and afterwards nobody is blocked.

In rescue mode the rescuer can `cancel`, under the same rule as the msig: unsettled and before `fulfillmentEnd`. Cancelling only ever refunds, so it can't redirect funds, and it gives the rescuer a way to end an incident without the msig. The rescuer can't `settleEarly`, because settling a rogue auction with the attacker's junk funding would pay the deposits to the attacker. After `fulfillmentEnd` nobody can abort (decision 10).

#### Settlement, recovery and events

Settlement keeps today's maths. Required funding rounds up, and fills and shares round down. The `Settlement` (`filledBids`, `userFill`, `userRefund` and `funderRefund`) is a view over `totalDeposits` and `funding`. Both stop changing once the phase is final, at `fulfillmentEnd` or on `settleEarly` or `cancel`, so nothing is stored at settlement and claims never move them. If all the deposits together would buy less than one fill-token wei, nothing fills: `filledBids` is 0 and every depositor gets a full refund, even at full funding. `claimTreasury` is permissionless and pays `filledBids` to `proceedsRecipient` and `funderRefund` to `funder`.

`AuctionSettled` goes out once per settlement, carrying `settledAt` and the settlement. `settleEarly` emits it. For a settlement by the clock, the first successful `claim` or `claimTreasury` emits it, with `settledAt` set to `fulfillmentEnd`; anyone can call `emitSettlement` to emit it sooner, and it reverts `AlreadySettled` once the event has gone out. `settledAt` is the once-only flag, so `initialize` rejects a `fulfillmentEnd` above `type(uint40).max`.

`recoverToken` sends only surplus. Three payout counters track what's left to pay: `totalExcluded` (up in `exclude`, down in `reinstate` and `withdrawExcluded`), and `bidPaid` and `fillPaid` (up in `claim` and `claimTreasury`). `liabilities()` is `totalDeposits + totalExcluded − bidPaid` in bid tokens and `funding − fillPaid` in fill tokens. A bid or fill token balance above that is a donation and can be recovered; anything else, including a blocked account's unclaimed share, an excluded balance and rounding dust, stays counted until paid; rounding dust stays counted for good. Any other token can be recovered in full.

#### Excluding flagged bidders

"Flagged" means the auction's current compliance list blocks the account, with compliance enabled. A flagged bidder's deposit stays in the fill unless the msig or a `setBlocked` grantee calls `exclude`. Exclusion is a balance, `excluded[account]`, not a sticky flag: settlement, claims and `withdrawableExcess` use `totalDeposits`, which no longer counts it, so they need no exclusion logic. Exclusion zeroes deposits. An account cleared during Deposit can deposit again; unless the msig or a grantee calls reinstate, only that new deposit is filled.

| Flagged during | At the flag | Cleared in the same phase | Cleared later |
|---|---|---|---|
| Scheduled | Nothing to exclude; can't deposit while flagged | Deposits normally | Same |
| Deposit | Excluded: the deposit leaves the fill and is frozen; the treasury neither gets nor pays for it | back in as a full participant only if the msig or a grantee calls `reinstate` | `withdrawExcluded` only, never a fill |
| Fulfillment | Excluded, same treatment; funding already sent for it becomes withdrawable excess if the rest is fully funded; under partial funding the remaining bidders fill more | `withdrawExcluded` only | `withdrawExcluded` only |
| Settled | Not excluded: the fill stands; fill tokens and unfilled refund frozen; the filled bid tokens go to the treasury | Claims normally | Claims whenever cleared |
| Cancelled | Its refund, or its excluded balance, stays frozen | claim for a refund, withdrawExcluded for an excluded balance | Same |
| Deposit or Fulfillment, `exclude` not called | Still in the fill, filled at settlement, payout frozen | Ordinary bidder | Claims when cleared |

The rescuer's answer to a rogue list is `disableComplianceCheck`: afterwards nobody is flagged, so nothing more can be excluded and every excluded balance becomes withdrawable once the auction is unpaused.

**Events:** `Deposited`, `DepositWithdrawn`, `BidderExcluded`, `BidderReinstated`, `ExcludedWithdrawn`, `Funded`, `ExcessWithdrawn`, `AuctionSettled(settledAt, …)` (from `settleEarly`, or once after a settlement by the clock from the first claim or `emitSettlement`), `AuctionCancelled`, `UserClaimed`, `TreasuryClaimed`, `PausedSet(bool)`, `RescueModeSet`, `ComplianceCheckSet`, `ComplianceCheckDisabled`, and `FunderSet`/`ProceedsRecipientSet` if decision 6 says yes. `initialize` emits `ComplianceCheckSet` for the initial pointer.

### 3. `WishingWell`: record-only, keyed by (account, from, to)

A wish says an account would give up to `amount` of `from` to get `to`, until `expiresAt`.

```solidity
contract WishingWell {
    struct Wish { uint192 amount; uint64 expiresAt; }

    mapping(address account => mapping(address from => mapping(address to => Wish))) public wishOf;

    event WishSet(address indexed account, address indexed from, address indexed to, uint256 amount, uint64 expiresAt);

    function wish(address from, address to, uint192 amount, uint64 expiresAt) external {
        wishOf[msg.sender][from][to] = Wish(amount, expiresAt); // amount 0 revokes
        emit WishSet(msg.sender, from, to, amount, expiresAt);
    }
}
```

The Well holds no money and makes no compliance call. The indexer screens wishes against a `ComplianceCheck` (decision 12), so the Well needs no rescuer switch, pointer or pause.

### 4. `FixedPriceAuctionFactory`: one factory, swappable auction code

Anyone can deploy a `FixedPriceAuction`, or a contract that emits the same events. Without an on-chain list of genuine auctions, an indexer or front-end that finds auctions by their events can be fed fake ones. A fake auction can emit `AuctionSettled`, and the indexer would subtract those fills from real wishes. A factory closes this gap. It records every auction it deploys.

The aim is one factory for good, so indexers and front-ends watch one address. The factory deploys each auction as a Solady `LibClone` clone of its current `implementation`, with the auction's config appended as immutable args, the same pattern as Origami's `OpalAdapterFactory`. New auction code ships as a new implementation, swapped in with two keys: the msig proposes it and the rescuer accepts it by address, so a proposal changed after the rescuer reviewed it can't be accepted by mistake. A hijacked msig alone can't put new code behind `isAuction`, and a breached rescuer alone can't propose any.

```solidity
contract FixedPriceAuctionFactory is IFixedPriceAuctionFactory, RescuableAccess {
    address public implementation;
    address public proposedImplementation;
    mapping(address auction => bool genuine) public isAuction;

    event AuctionCreated(address indexed auction, address indexed implementation, bytes config);
    event ImplementationProposed(address indexed implementation);
    event ImplementationSet(address indexed implementation);

    function createAuction(bytes calldata config) external onlyElevatedAccess returns (address auction) {
        auction = LibClone.clone(implementation, config);
        isAuction[auction] = true;
        emit AuctionCreated(auction, implementation, config);
        IAuction(auction).initialize(executor, rescuer); // validates config; the implementation can't be initialized
    }

    function proposeImplementation(address newImplementation) external onlyElevatedAccess {}
    function acceptImplementation(address newImplementation) external onlyRescuer {} // must match the proposal
}
```

- **The config is opaque bytes,** so a later implementation can take a different config without a new factory. For this version it's `abi.encode(AuctionConfig)`, and indexers decode it by `implementation`.
- **The auction reads its config from the clone's code,** not storage: one `_config()` decodes the whole `AuctionConfig` with `abi.decode(LibClone.argsOnClone(address(this)), (AuctionConfig))`, and `getConfig()` returns it. There are no per-field getters (`bidToken()` and so on) and no byte offsets to get wrong. Reading the config this way, plus the clone's forwarding call, adds about 2.1k gas to each call. Only what changes lives in storage: the roles, the pause, the compliance pointer, the deposits, the excluded balances, `funding`, the payout counters (`totalExcluded`, `bidPaid`, `fillPaid`) and the claim flags (`claimed`, `treasuryClaimed`). `priceDenominator` is worked out once in `initialize` and stored, because it reads token decimals.
- **`initialize` runs in the same call as the clone,** so nobody can get in first. The implementation marks itself initialized in its constructor, so it can never be initialized directly.
- **The factory gets rescue mode,** using the same base as the auction. With one factory for good, redeploying it is no longer the answer to a hijacked msig. Rescue mode locks the msig out of `createAuction` and `proposeImplementation` until the rescuer switches it off. The rescuer hands over its own role in two steps, as in the auction, and new auctions take the factory's current rescuer. Rotating it leaves each live auction with the rescuer it was created with.

```solidity
struct AuctionConfig { // abi-encoded into each clone
    address bidToken; address fillToken; uint256 price;
    uint64 depositStart; uint64 depositEnd; uint64 fulfillmentEnd;
    uint256 minDeposit; address funder; address proceedsRecipient; address complianceCheck;
}
```

The factory deploys each auction with its own `executor` (the msig, which is the only caller `createAuction` allows) as `executor` and the factory's current `rescuer` as the rescuer, and no caller can pass a different one. Otherwise a rogue msig could deploy auctions with a puppet rescuer. Config validation lives in the auction's `initialize`: `depositStart` in the future, `depositStart < depositEnd < fulfillmentEnd`, `fulfillmentEnd ≤ type(uint40).max`, `bidToken != fillToken`, `price != 0`, non-zero `funder`, `proceedsRecipient` and `complianceCheck`, token decimals ≤ 18.

TGLD (TempleGold) can only move to or from contracts that TempleGold has authorised. Every TGLD deposit reverts with `NonTransferrable` unless the auction is authorised. `TempleGold.authorizeContract` is owner-only and the msig owns TempleGold, so the msig authorises each TGLD auction in a transaction after `createAuction`, using the address from `AuctionCreated` and before `depositStart`. Authorising in the same batch would mean predicting the clone's address from the factory's nonce, which goes wrong if queued creations run out of order. Never de-authorise an auction until its claims are done. The factory can't do it without being given control of TempleGold's whole authorisation list.

TGLD auctions are meant to burn the TGLD they collect. No burner contract exists yet. Building one, and requiring TGLD auctions to use it as `proceedsRecipient`, is decision 11. If `setProceedsRecipient` exists (decision 6), it must keep the burner on TGLD auctions.

- Indexers subscribe to one event on one address, `AuctionCreated`. Its `config` gives each auction's market (`bidToken` → `fillToken`).
- Front-ends reject look-alike contracts with `isAuction`.


### Upgrading the auction

The msig proposes a new implementation and the rescuer accepts it. Auctions created after that use the new code; existing auctions keep theirs. Keep `IFixedPriceAuction` unchanged across versions, or only add to it, so the indexer reads every version the same way. A version that changes the config layout changes how `config` decodes, which indexers key on `implementation`.

A new factory is only needed if the factory itself changes, or if the msig's Safe is lost for good: rescue mode stops a hijacked msig, but only the msig can hand over the executor role.

## What the indexer does

With a record-only Well, all judgement about demand happens off-chain. The indexer only counts auction events from addresses where `isAuction` is true. It reads:

| Need | Event |
|---|---|
| The wish | `WishSet(account, from, to, amount, expiresAt)` |
| Which auctions are genuine, and their market | `AuctionCreated` from the factory |
| Who bid, and how much | `Deposited`, `DepositWithdrawn` |
| How much filled, and when | `settlement()` once `phase()` is Settled; `AuctionSettled` (carrying `settledAt`), which a settlement by the clock emits only at its first claim or `emitSettlement` |
| Cancelled auctions (no fills, deposits refundable) | `AuctionCancelled` |
| Each auction's screening | `ComplianceCheckSet`, `ComplianceCheckDisabled` |
| Balances | ERC-20 `Transfer`, or `balanceOf` at a pinned block |
| Who is blocked | `BlockedSet` from `ComplianceCheck` |

Rules:
- A wish matches an auction when `bidToken == from` and `fillToken == to`.
- **A wish counts the smaller of two numbers.** One is its amount minus fills from matching auctions settled after the wish. The other is the account's balance of `from`.
- An account's fill is `deposit − floor(deposit × userRefund / totalDeposits)` in `from` units. Take `userRefund` from `settlement()` and `totalDeposits` from `totalDeposits()`; both are fixed once `phase()` is final. A settlement by the clock emits its event late, at the first claim or `emitSettlement`, with `settledAt` = `fulfillmentEnd`.
- **One balance cap per `from` asset.** The sum of an account's counted wishes that give the same asset can't exceed what it holds of it.
- **Buckets** are indexer config that group pairs into markets, for example USDS and USDC as "stables". The team reads demand per bucket. Summing across a bucket normalises decimals (USDS has 18, USDC has 6).
- Expired wishes and wishes with amount 0 count zero.
- **Blocked accounts count zero.**
- **Every batch of reads uses one pinned block,** so one balance can't be counted twice by moving it between reads.

Open choices for the indexer (decision 9):
- Does a new wish reset the fills already subtracted? Recommended: yes, because the latest wish replaces the old one.
- Do tokens sitting in a live auction, or an unclaimed refund, count as held? Recommended: yes, otherwise demand drops to zero the moment a wisher bids. Count `deposits(account)` while the auction is live and `claimable(account).refund` once it's final, plus `excluded(account)`: `deposits()` doesn't drop when an account claims, so using it after a claim double-counts the refund.

## What happens when something goes wrong

| Incident | Response |
|---|---|
| One address must be blocked | msig or a granted account blocks it. Its deposit, withdrawal and claim revert, and its funds stay put. Before settlement, either can also `exclude` it, so its deposit is refunded once it's cleared and never filled. |
| Accounting bug, or a rush of depositors to withdraw | msig pauses the affected auction: every function that moves tokens stops. Investigate, then unpause, or `cancel` before `fulfillmentEnd`. |
| Compromised `funder` or `proceedsRecipient` | If decision 6 adds the setters: msig pauses, replaces the address with `setFunder` or `setProceedsRecipient`, then unpauses. Without them, for `proceedsRecipient`: pause, then cancel before `fulfillmentEnd`, so no proceeds accrue. For `funder`, don't cancel, because cancelling returns all funding to the compromised address. Let the auction settle, so fills go to depositors and only the unused funding reaches the funder. |
| Rogue granted account | msig revokes its grant and fixes the list, or repoints the auctions to a new `ComplianceCheck`. |
| Rogue msig pauses for good, or blocks everyone | rescuer switches rescue mode on, which locks the msig out. It unpauses and/or calls `disableComplianceCheck`, and switches rescue mode off once the msig can be trusted again. If the Safe can't be recovered, rescue mode stays on until the auction settles by the clock. |
| Hijacked msig deploys rogue auctions through the factory | (1) The rescuer switches rescue mode on in the factory, which stops new auctions and code proposals, and in every live auction, which locks the hijacked msig out. It calls `disableComplianceCheck` on any auction whose list the msig has abused. (2) For each rogue auction already created, the rescuer switches rescue mode on and cancels it as soon as `AuctionCreated` appears, ideally before `depositStart` and at the latest before `depositEnd`: from `depositEnd` the hijacked msig can fund with junk and settle in one block, and a settled auction can't be cancelled. Anyone who already deposited gets a full refund at once, whatever the auction's windows. (3) If the Safe's signers recover it, the rescuer switches rescue mode off. If the Safe is lost for good, the team deploys a new Safe, `ComplianceCheck` and factory, and the indexer and front-ends add the new factory and stop counting new auctions from the old one. Genuine auctions finish under rescue mode, because they settle by the clock at fulfillmentEnd. |
| Incident while the msig can't act | rescuer switches rescue mode on and pauses. To abort, it cancels before `fulfillmentEnd`, which refunds everyone. |

## Deploy checks

- **Price units.** The price is fill tokens per whole bid token, scaled by 1e18, and it's fixed at deploy. Print a sample conversion (for example "100 TGLD buys 4.66 USDS") before signing. Entering `4` instead of `4e18` makes the fill 1e18 times too small. 100 TGLD would buy 400 wei of USDS.

## What this cuts from #1305

| Removed | Why it's safe |
|---|---|
| Frozen escrow and the release flow: `frozenBid`/`frozenFill`, `proposeRelease`/`executeRelease`/`vetoRelease`, the 7-day delay, `frozenFundsReceiver` | blocked now means it stays put and is claimable once unblocked |
| `excludeBidder`'s escrow | replaced by `exclude`, which only moves the deposit out of the fill into a balance the bidder withdraws once cleared (decision 2) |
| `emergencyPause`/`emergencyUnpause` with their 14-day timer and single-use flag | replaced by a plain pause over every function that moves tokens, toggled by the msig, or by the rescuer in rescue mode |
| `setDepositsPaused` | the auction pause, or `cancel` |
| `endDeposit` and `noticePeriod` | fixed schedule; `cancel` to abort |
| The deposit cap: `maxTotalDeposits`, `setMaxTotalDeposits` | funding is discretionary, so the Treasury fills what it chooses, and cap squatting (one large deposit fills the cap and shuts others out, then withdraws) goes away |
| `depositWithPermit` | permit only helps stables; approve then deposit works for every token |
| `finalize`, `_releaseDust`, `unclaimedBidders`, the claim budgets | the settlement is a view, so there's nothing to finalize; a few wei of rounding dust stays put |
| Three cancel functions | merged into `cancel()` |
| Supported-token registry check (`IAuctionTokenRegistry`) and the notice and maximum-duration rules | the msig chooses the tokens and schedule in `createAuction`; the auction relies on standard ERC-20s with exact transfers (decision 13) |
| The `remainingFunding` and `fullFundingRequired` views | folded into `settlement` and `claimable`. `liabilities()` now exists, backed by the payout counters |
| `disableComplianceCheck` callable by the msig | now rescuer-only, so the rescuer can lift a rogue msig's blocks for good. The msig can still repoint to a permissive list, which the requirements allow, since the msig can update the pointer. |

About 35 external functions shrink to 24, counting `initialize` and the views but not access-control-base functions or public getters (26 with the decision 6 setters; 39 in `IFixedPriceAuction` with the getters). Of 20 events and 23 errors, roughly half remain. These threats go away with the code that caused them:
- frozen-release snapshot bugs
- dust-counter accounting
- a timed pause outlasting the windows
- cap squatting
- the escrow-accounting invariants

## What this cuts from #1304

The record-only Well drops signed wishes and nonces, the on-chain balance and compliance checks, the token registry check, the Sell/Buy direction, with Buy wishes priced in a separate payment asset, exclusions, thresholds and quorum durations, and the on-chain totals. The indexer applies all of these rules off-chain.

## What it keeps on purpose

- **Fixed price, pro-rata fill, partial funding, refunds and cancellation.** The auction exists to provide these.
- **`minDeposit`.** It stops dust deposits.
- **`recoverToken` for surplus.** Stray tokens can be recovered: any other token in full, and the bid and fill tokens above `liabilities()`. Three payout counters back it; there are no budgets.

## Decisions for the team

1. Are these cuts acceptable? That covers the timed emergency pause, the deposit pause (`setDepositsPaused`), the cap, early close (`endDeposit`) and permit.
2. ~~**Legal:** can a blocked account's deposit be filled, with its fill waiting until it's unblocked?~~ **Resolved** by the exclusion rules in [Excluding flagged bidders](#excluding-flagged-bidders): before settlement, `exclude` takes a flagged deposit out of the fill and it's refund-only; after settlement the fill stands and the payout waits.
3. Should `withdrawDeposit` revert for blocked accounts? This proposal assumes yes, to match "funds stay where they are".
4. The pause is per auction, so stopping everything takes one transaction per live auction. Is that acceptable, given only a few auctions run at once?
5. Should a granted account also be able to pause? That needs per-function grants in the auction's access-control base, locked out in rescue mode like the msig.
6. Should the msig be able to change `funder` and `proceedsRecipient`? Today both are fixed. If yes, TGLD auctions must keep the burner. Without the setters, a compromised funder can't be recovered from. A hijacked msig could point both addresses at itself before the rescuer reacts, and the rescuer can't change them back.
7. **Rescue mode (see the rescue-mode callout in [`FixedPriceAuction`](#2-fixedpriceauction-simplified)):** confirm the small access-control base, where rescue mode only locks the msig out and hands the rescuer the pause, and the accepted risk that a breached rescuer could lock the msig out of an auction.
8. **One factory with swappable code:** confirm the two-key swap (msig proposes, rescuer accepts) and rescue mode on the factory. The cost is a Solady dependency, clone-arg reads in the auction, and an `initialize` step. Every auction version also depends on one factory contract, so one bug in it reaches every auction.
9. **Indexer choices:** does a new wish reset subtracted fills, and do tokens in a live auction count as held?
10. Should `cancel` also be allowed after `fulfillmentEnd` while paused? If added, should it stay msig-only?
11. Should we build a TGLD burner contract and require TGLD auctions to use it as `proceedsRecipient`?
12. Which `ComplianceCheck` does the indexer screen against? Does it stop screening when the rescuer disables compliance on the auctions? In this design, the rescuer's switch only reaches the auctions.
13. Should the factory keep the supported-token check (`IAuctionTokenRegistry`) at `createAuction`?
14. How does the rescuer rotate on live auctions? The factory already rotates its rescuer two-step, and new auctions take the factory's current rescuer, so the open part is only live auctions and the msig. Options: a handover on each live auction, or auctions that read the rescuer from the factory. When the msig rotates, do `ComplianceCheck` and the factory get a two-step executor handover, or do we redeploy them and repoint the auctions?
15. **Renames, applied** on `fpa-frozen-inputs`:
    - `endFulfillment()` → `settleEarly()`, because it only settles before `fulfillmentEnd`;
    - `previewSettlement()` → `settlement()`, because once the auction is final it's the actual settlement;
    - `Settlement.userFunding` → `userFill`, the fill tokens shared among bidders;
    - `Settlement.filledDeposits` → `filledBids`, the bid tokens that were filled;
    - `emitSettled()` → `emitSettlement()`, since it emits the settlement;
    - `endedAt` → `settledAt`, in storage, its getter and the `AuctionSettled` event;
    - `AuctionFactory` / `IAuctionFactory` → `FixedPriceAuctionFactory` / `IFixedPriceAuctionFactory`.

    The `AuctionSettled` event keeps its name. `bidToken` / `fillToken`, `claimTreasury` and the Fulfillment phase names stay as they are.
