# Temple Granary indexer: implementation spec

**Contracts:** [TempleDAO/temple, branch `fpa-frozen-inputs`](https://github.com/TempleDAO/temple/tree/fpa-frozen-inputs) (FixedPriceAuction, FixedPriceAuctionFactory, WishingWell, ComplianceCheck).

## 0. Sources and conventions

| Short name | Path |
|---|---|
| `FPA.sol` / `IFPA.sol` | `protocol/contracts/templegold/FixedPriceAuction.sol` / `protocol/contracts/interfaces/templegold/IFixedPriceAuction.sol`, temple repo branch [`fpa-frozen-inputs`](https://github.com/TempleDAO/temple/tree/fpa-frozen-inputs) (line numbers match commit `9239f7da`) |
| `Factory.sol` / `IFactory.sol` | `FixedPriceAuctionFactory.sol` / `IFixedPriceAuctionFactory.sol`, same branch |
| `WW.sol` / `IWW.sol` | `WishingWell.sol` / `IWishingWell.sol`, same branch |
| `ICC.sol` / `CC.sol` | `IComplianceCheck.sol` / `ComplianceCheck.sol`, same branch |
| `IRA.sol` / `RA.sol` | `IRescuableAccess.sol` / `access/RescuableAccess.sol`, same branch |
| `TG.sol` / `ITG.sol` | `protocol/contracts/templegold/TempleGold.sol` / `interfaces/templegold/ITempleGold.sol`, same branch |
| `Model` | `protocol/contracts/templegold/docs/fpa-simplified-model.md`, same branch |
| `Spike` | `TempleDAO/spice-bazaar-subgraph`, branch `fpa-spike` (`43c0402`). This is the repo you change |
| `Proto` | dapp prototype, `TempleDAO/temple` branch `claude/granary-auctions-prototype-f26d20`, commit `2f1c0fe5`, under `apps/dapp/src/components/Pages/Core/DappPages/SpiceBazaar/Granary/` (`data/hooks.ts`, `data/types.ts`, `data/derive.ts`, `data/fixtures.ts`, `screens/*`) |
| `Storyboard fN` | `granary-storyboard.html`, frame `fN` (`fh` = pair history) |

Conventions:
- All amounts are raw token base units (`BigInt`). The client formats with `Token.decimals`.
- **Indexed** = stored by a handler. **Render** = computed by the dapp hook from indexed fields plus `T = _meta.block.timestamp` of the block `N` the query ran at.
- IDs are `Bytes`; `concat` is byte concatenation.

## 1. Goal and scope

Extend the Spice Bazaar subgraph to index Temple's `FixedPriceAuctionFactory`, every `FixedPriceAuction` it clones, and the `WishingWell`, so the Granary auctions UI is served by one `_meta` request plus one GraphQL request per screen, with no per-auction contract calls.

In scope:
- New sources, entities and handlers for factory, auctions, wishes, and `ContractAuthorizationSet` on the existing `TempleGold` source.
- The GraphQL operations and render-time rules the dapp hooks use (§6, §7), and the contract reads that remain (§7.7).
- Deploy scripts and monitoring.

Out of scope:
- Every legacy data source, template, entity and enum stays unchanged (`Metric`, `TempleGold`, `TempleGoldStaking`, `SpiceAuction*`, `StableGoldAuction*`, `AuctionInstance`, `UserTransaction`, `Position`, `User`, snapshots, `Schedule`). The one exception: legacy `Token` gains nullable `metadataPending`, and the legacy `getOrCreateToken` re-reads a pending row (§5.7).
- FPA entities don't implement `AuctionInstance`/`UserTransaction` and don't write `Position`, `User` or `Metric`. `AuctionType` gets no FPA member.
- Wallet balances, staking figures, demand thresholds or time series.

## 2. Decisions already made

- **No balance cap.** No wish-token balances, no ERC-20 `Transfer` sources, no `TempleGold` `Transfer` handler. Demand is wished minus fills (`Model` L336, decision 9).
- **`outcome` mirrors the contract's `_outcome`.** `Settled` only from an early `AuctionSettled` (`settledAt < fulfillmentEnd`); a clock settlement leaves `None` (`FPA.sol` L55, L237).
- **Settlement mismatch flags, doesn't halt.** Store the event's figures, set `settlementMismatch = true`, `log.error` (Q10 default).
- **Event figures are final.** After `AuctionSettled` or `AuctionCancelled`, `save(A)` never recomputes the mirror.
- **Flags: design A by default** (dapp reads `isFlagged(me)`); design B (index `FlaggedSet`) is Appendix A, pending Q6.
- **Only the genuine factory's `AuctionCreated` creates auctions.** Unknown implementations are stored as `UnsupportedFixedPriceAuction`; never decode them with an existing decoder by guesswork (`Model` L310).
- **Per-pair `number`** = `++Pair.auctionCount` in creation order; it is the history cursor.
- **No stored demand aggregate.** Demand is computed in the hook at one pinned block.
- **Buckets live in the hook config** (`buckets: { stables: [USDS, USDC] }`), not the indexer (Q9).
- **`onWishSet` makes no contract calls.** Token metadata is read by `onAuctionCreated` or the legacy helper.
- **`Settle`/`Cancel` activity rows use the zero address as `account`.**
- **Deploy through Goldsky's CLI (`yarn goldsky`), grafted;** never `graph deploy --product hosted-service`.

## 3. Data sources and manifest changes

| Name | Kind | ABI | Handlers |
|---|---|---|---|
| `FixedPriceAuctionFactory` | static, new | `FixedPriceAuctionFactory.json` (+ `ERC20`, already listed on the spike's factory source) | §5.1 |
| `FixedPriceAuction` | template, created from `AuctionCreated` | `FixedPriceAuction.json`, with `claimable()`'s `fill` output renamed `fillAmount` (re-apply on every ABI refresh) | §5.2–5.4 |
| `WishingWell` | static, new | `WishingWell.json` only. `entities`: `Wish`, `Token`, `Pair` (documentation) | §5.6 |
| `TempleGold` | static, existing | `TempleGold.json` | add `ContractAuthorizationSet` (§5.5) |
| `ComplianceCheck` | static, design B only | `ComplianceCheck.json` (new) | Appendix A |
| Legacy sources | unchanged | unchanged | unchanged |

Event signatures (factory: `IFactory.sol` L16-19, `IRA.sol` L12; template: `IFPA.sol` L88-115, `IRA.sol` L12; Well: `IWW.sol` L17-23; TempleGold: `ITG.sol` L37):

| Source | Event | Handler |
|---|---|---|
| factory | `AuctionCreated(indexed address,indexed address,bytes)` | `onAuctionCreated` |
| factory | `ImplementationProposed(indexed address)` | `onImplementationProposed` |
| factory | `ImplementationSet(indexed address)` | `onImplementationSet` |
| factory | `RescueModeSet(indexed bool)` | `onFactoryRescueModeSet` |
| template | `Deposited(indexed address,uint256,uint256,uint256)` | `onDeposited` |
| template | `DepositWithdrawn(indexed address,uint256,uint256,uint256)` | `onDepositWithdrawn` |
| template | `BidderExcluded(indexed address,uint256)` | `onBidderExcluded` |
| template | `BidderReinstated(indexed address,uint256)` | `onBidderReinstated` |
| template | `ExcludedWithdrawn(indexed address,uint256)` | `onExcludedWithdrawn` |
| template | `Funded(indexed address,uint256,uint256)` | `onFunded` |
| template | `ExcessWithdrawn(indexed address,uint256,uint256)` | `onExcessWithdrawn` |
| template | `AuctionSettled(uint64,uint256,uint256,uint256,uint256,uint256)` | `onAuctionSettled` |
| template | `AuctionCancelled(uint256,uint256)` | `onAuctionCancelled` |
| template | `UserClaimed(indexed address,uint256,uint256)` | `onUserClaimed` |
| template | `TreasuryClaimed(indexed address,indexed address,uint256,uint256)` | `onTreasuryClaimed` |
| template | `PausedSet(bool)` | `onPausedSet` |
| template | `RescueModeSet(indexed bool)` | `onRescueModeSet` |
| template | `ComplianceCheckSet(indexed address)` | `onComplianceCheckSet` |
| template | `ComplianceCheckDisabled()` | `onComplianceCheckDisabled` |
| WishingWell | `WishSet(indexed address,indexed address,indexed address,uint256,uint64)` | `onWishSet` |
| TempleGold | `ContractAuthorizationSet(indexed address,bool)` | `onContractAuthorizationSet` |

Not indexed: executor/rescuer handover events, `TokenRecovered`, `FlaggerSet`.

**Config and start blocks.** Add to each deployment's `config/<network>.json` and `*.template.yaml`: `fixedPriceAuctionFactory { address, startBlock }`, `wishingWell { address, startBlock }`, and the implementation → decoder entries (§5.1). Each start block is the contract's deploy block; the factory's must be at or before its deploy block, because the constructor emits the first `ImplementationSet` (`Factory.sol` L24-29). Add FPA sources only to a template whose config has these keys: mustache renders a missing key as `address: ''`, which is invalid.

A retired factory's source gets `source.endBlock`; a new factory is a new static source.

## 4. Schema

Add to `schema.graphql`. Legacy `Token` gets one nullable field only:

```graphql
type Token @entity {
  # ...existing fields unchanged...
  metadataPending: Boolean   # true = created by onWishSet without reading the token; null/false = loaded
}
```

New fields on existing entities must be nullable if the deployment is grafted; `metadataPending` is nullable for that reason.

```graphql
enum FixedPriceAuctionOutcome { None Settled Cancelled }

enum FixedPriceAuctionActivityKind {
  Deposit Withdraw Exclude Reinstate WithdrawExcluded Fund WithdrawExcess Claim ClaimTreasury Settle Cancel
}

type FixedPriceAuctionFactory @entity {
  id: Bytes!                               # factory address
  timestamp: BigInt!
  implementation: Bytes!
  implementationSupported: Boolean!        # current implementation is in the decoder registry
  proposedImplementation: Bytes            # null when none / cancelled / accepted
  proposedImplementationSupported: Boolean # null when no proposal (written with unset)
  inRescueMode: Boolean!
  auctionCount: Int!                       # +1 per AuctionCreated, supported or not
  auctions: [FixedPriceAuction!]! @derivedFrom(field: "factory")
}

type Pair @entity {
  id: Bytes!                     # bidToken.concat(fillToken), 40 bytes
  bidToken: Token!
  fillToken: Token!
  auctionCount: Int!             # +1 per decoded AuctionCreated on this pair
  lastAuctionCreatedAt: BigInt!  # 0 for a wish-only pair
  auctions: [FixedPriceAuction!]! @derivedFrom(field: "pair")
  wishes: [Wish!]! @derivedFrom(field: "pair")
}

type FixedPriceAuction @entity {
  id: Bytes!                     # auction address
  factory: FixedPriceAuctionFactory!
  implementation: Bytes!
  pair: Pair!
  number: Int!
  createdAt: BigInt!
  createdBlock: BigInt!
  createdLogIndex: BigInt!
  createdHash: Bytes!
  timestamp: BigInt!             # last update, set by save(A)
  # config, decoded once
  bidToken: Token!               # config[0]
  fillToken: Token!              # config[1]
  price: BigInt!                 # config[2]: fill per whole bid × 1e18
  priceDenominator: BigInt!      # 10^(18 + bidDecimals − fillDecimals)
  depositStart: BigInt!          # config[3]
  depositEnd: BigInt!            # config[4]
  fulfillmentEnd: BigInt!        # config[5]
  minDeposit: BigInt!            # config[6]
  funder: Bytes!                 # config[7]
  proceedsRecipient: Bytes!      # config[8]
  complianceCheck: Bytes!        # config[9], then ComplianceCheckSet
  # state
  complianceDisabled: Boolean!
  paused: Boolean!
  inRescueMode: Boolean!
  outcome: FixedPriceAuctionOutcome!
  settledAt: BigInt
  settlementEmitted: Boolean!
  cancelledAt: BigInt
  endsAt: BigInt!                # fulfillmentEnd, or settledAt (early), or cancelledAt
  totalDeposits: BigInt!
  totalExcluded: BigInt!
  funding: BigInt!               # contract's funding counter (fundingHeld)
  requiredFunding: BigInt!
  filledBids: BigInt!
  userFill: BigInt!
  userRefund: BigInt!
  funderRefund: BigInt!
  depositorCount: Int!           # ever deposited; never decremented
  claimedFill: BigInt!
  claimedRefund: BigInt!
  treasuryClaimed: Boolean!
  treasuryProceeds: BigInt
  treasuryFunderRefund: BigInt
  tgldAuthorized: Boolean        # null unless a leg is TGLD
  settlementMismatch: Boolean!
  positions: [FixedPriceAuctionPosition!]! @derivedFrom(field: "auction")
  activity: [FixedPriceAuctionActivity!]! @derivedFrom(field: "auction")
}

type UnsupportedFixedPriceAuction @entity(immutable: true) {
  id: Bytes!
  factory: FixedPriceAuctionFactory!
  implementation: Bytes!
  config: Bytes!
  createdAt: BigInt!
  createdBlock: BigInt!
}

type FixedPriceAuctionPosition @entity {
  id: Bytes!                     # auction.concat(account)
  timestamp: BigInt!
  auction: FixedPriceAuction!
  account: Bytes!
  deposit: BigInt!               # equals deposits(account); claiming doesn't reduce it
  excluded: BigInt!
  excludedWithdrawn: BigInt!
  claimed: Boolean!
  claimedFill: BigInt!
  claimedRefund: BigInt!
  firstDepositAt: BigInt!
}

type FixedPriceAuctionActivity @entity(immutable: true) {
  id: Bytes!                     # txHash.concatI32(logIndex)
  timestamp: BigInt!
  blockNumber: BigInt!
  logIndex: BigInt!
  sortKey: BigInt!               # blockNumber × 2^32 + logIndex
  hash: Bytes!
  auction: FixedPriceAuction!
  account: Bytes!                # zero address for Settle and Cancel
  kind: FixedPriceAuctionActivityKind!
  amount: BigInt!
  amount2: BigInt!
}

type Wish @entity {
  id: Bytes!                     # account.concat(fromToken).concat(toToken)
  account: Bytes!
  fromToken: Bytes!
  toToken: Bytes!
  pair: Pair!                    # fromToken.concat(toToken)
  fromAmount: BigInt!            # 0 = revoked
  expiresAt: BigInt!
  setAt: BigInt!
  setBlock: BigInt!
  setLogIndex: BigInt!
  setHash: Bytes!
}

type TempleGoldAuthorization @entity {
  id: Bytes!                     # contract address
  authorized: Boolean!
  updatedAt: BigInt!
}
```

Generated-code rules:
- A nullable `Boolean`'s generated getter returns `false` for null, and its setter takes a plain `boolean`. Write null with `entity.unset("field")`; for `tgldAuthorized` on a non-TGLD auction, never set it.

## 5. Handlers

Notation:
- `A` = `FixedPriceAuction` at `event.address`.
- `P` = `getOrCreatePosition(A, account)`. On create it sets `firstDepositAt = timestamp` and `A.depositorCount += 1`. The first event creating a position is always `Deposited`.
- `save(A)` = recompute `requiredFunding`; unless `A.settlementEmitted || A.outcome == Cancelled`, recompute the mirror (§6.2); set `A.timestamp`; save.
- Each auction handler writes one `FixedPriceAuctionActivity` of the kind named, with `blockNumber`, `logIndex`, `sortKey`.

### 5.1 Factory

Every factory handler loads or creates the factory row with defaults: `implementation` = zero address, `implementationSupported = false`, `inRescueMode = false`, `auctionCount = 0`, `timestamp`.

**Decoder registry** (`src/config/fixedPriceAuction.ts`): `Map<string, string>` of implementation → decoder id, filled from the deployment's config.
- Keys are lower-case hex: build them with `Address.fromString("0x…").toHexString()` (config JSON is checksummed; `toHexString()` returns lower case). Look up with `implementation.toHexString()`; a `Map` keyed by `Bytes` compares by identity and misses.
- Call `has` before `get` (AssemblyScript `Map.get` aborts on a missing key).
- Decoder `v1`: `ethereum.decode("(address,address,uint256,uint64,uint64,uint64,uint256,address,address,address)", config)` (`IFPA.sol` L26-45, `FPA.sol` L397). Trailing bytes are fine. Several implementations may map to the same decoder id; all produce the same entity.

**`onAuctionCreated(auction, implementation, config)`**
1. Load/create factory; `auctionCount += 1`.
2. Not in registry → save `UnsupportedFixedPriceAuction` (`createdAt`, `createdBlock`, raw `config`) and return. No template, pair or number.
3. Decode. Load/create `Token` for both legs with the FPA token helper (§5.7). For a leg that is new or has `metadataPending == true`: `try_name`, `try_symbol`, `try_decimals`, following `createToken`'s body including the zero-address branch (`Spike src/entities/token.ts` L15-24); fall back to `"?"`/0 on revert; set `metadataPending = false`; `price = 0`, no price call. Then `priceDenominator = 10^(18 + bidDecimals − fillDecimals)` (exponent 6..30; `FPA.sol` L105-113).
4. Load/create `Pair(bidToken.concat(fillToken))` (create with `auctionCount = 0`, `lastAuctionCreatedAt = 0`); `auctionCount += 1`; `lastAuctionCreatedAt = block.timestamp`.
5. Create `A`: config fields, `number = Pair.auctionCount`, `outcome = None`, `endsAt = fulfillmentEnd`, all totals 0, booleans false, `createdAt/Block/LogIndex/Hash`.
6. If either leg is `TGLD` (`Spike src/config/addresses.ts`): `const auth = TempleGoldAuthorization.load(auction); A.tgldAuthorized = auth ? auth.authorized : false` (no optional chaining in AS 0.19). Else leave unset.
7. `save(A)`; `FixedPriceAuctionTemplate.create(auction)`.

**`onImplementationProposed(implementation)`**: zero → `proposedImplementation = null`, `unset("proposedImplementationSupported")`. Else set it and `proposedImplementationSupported = registry.has(implementation.toHexString())`.

**`onImplementationSet(implementation)`**: `implementation = it`; `implementationSupported = registry.has(...)` (also for the constructor emission, `Factory.sol` L27); `proposedImplementation = null`; `unset("proposedImplementationSupported")`.

**`onFactoryRescueModeSet(value)`**: factory `inRescueMode = value`.

### 5.2 Deposits and exclusions

- **`onDeposited(account, amount, accountDeposit, totalDeposits)`**: `P.deposit = accountDeposit`; `A.totalDeposits = totalDeposits`; `save(A)`; activity `Deposit(amount)`.
- **`onDepositWithdrawn(account, amount, accountDeposit, totalDeposits)`**: same assignments; activity `Withdraw(amount)`.
- **`onBidderExcluded(account, amount)`** (`FPA.sol` L162-169): if `P.deposit != amount` → `A.settlementMismatch = true`, `log.error`. Then `P.deposit = 0`; `P.excluded += amount`; `A.totalDeposits −= amount`; `A.totalExcluded += amount`; `save(A)`; activity `Exclude(amount)`.
- **`onBidderReinstated(account, amount)`** (`FPA.sol` L178, L184-187): `P.excluded = 0`; `P.deposit += amount`; `A.totalExcluded −= amount`; `A.totalDeposits += amount`; `save(A)`; activity `Reinstate(amount)`.
- **`onExcludedWithdrawn(account, amount)`** (`FPA.sol` L197-200): `P.excluded = 0`; `P.excludedWithdrawn += amount`; `A.totalExcluded −= amount`; save; activity `WithdrawExcluded(amount)`.

### 5.3 Funding, settlement, cancel, claims

- **`onFunded` / `onExcessWithdrawn(funder, amount, fundingHeld)`**: `A.funding = fundingHeld` (absolute counter, not the token balance; `IFPA.sol` L222-224); `save(A)`; activity `Fund(amount)` / `WithdrawExcess(amount)`.
- **`onAuctionSettled(settledAt, totalDeposits, filledBids, userFill, userRefund, funderRefund)`**. Emitted early by `settleEarly` (`settledAt < fulfillmentEnd`), or late at the first `claim`/`claimTreasury`/`emitSettlement` after `fulfillmentEnd` with `settledAt = fulfillmentEnd`, before `UserClaimed`/`TreasuryClaimed` in the same tx (`FPA.sol` L234-241, L257-262, L406-422).
  1. `A.settledAt = settledAt`; `A.settlementEmitted = true`.
  2. If `settledAt < A.fulfillmentEnd`: `outcome = Settled`, `endsAt = settledAt`. Else leave `outcome = None`, `endsAt = fulfillmentEnd`.
  3. Compare `totalDeposits` and the four figures with the stored mirror. Mismatch → `settlementMismatch = true`, `log.error`. Either way store the event's `totalDeposits`, `filledBids`, `userFill`, `userRefund`, `funderRefund`.
  4. `save(A)` (no recompute now); activity `Settle(filledBids, userFill)`, `account` = zero address.
- **`onAuctionCancelled(totalDeposits, funderRefund)`** (`FPA.sol` L244-254, L439-441): mismatch if `totalDeposits != A.totalDeposits` or `funderRefund != A.funding` → flag + `log.error`. Store `A.totalDeposits = totalDeposits`, `filledBids = userFill = 0`, `userRefund = totalDeposits`, `funderRefund = funderRefund`; `outcome = Cancelled`; `cancelledAt = endsAt = block.timestamp`; `save(A)`; activity `Cancel(totalDeposits, funderRefund)`, `account` = zero address. `settledAt` stays null.
- **`onUserClaimed(account, fill, refund)`**: optionally, before setting `P.claimed`, compute the §6.4 estimate and set `settlementMismatch` if it differs. Then `P.claimed = true`; `P.claimedFill = fill`; `P.claimedRefund = refund`; `A.claimedFill += fill`; `A.claimedRefund += refund`; save; activity `Claim(fill, refund)`.
- **`onTreasuryClaimed(proceedsRecipient, funder, proceeds, funderRefund)`**: `treasuryClaimed = true`; `treasuryProceeds = proceeds`; `treasuryFunderRefund = funderRefund`; save; activity `ClaimTreasury(proceeds, funderRefund)`, `account = proceedsRecipient`.

### 5.4 Status

- **`onPausedSet(paused)`**: `A.paused = paused`; save without changing the settlement.
- **`onRescueModeSet(value)`**: `A.inRescueMode = value`.
- **`onComplianceCheckSet(complianceCheck)`**: `A.complianceCheck = complianceCheck`. Idempotent (initialize emits it in the creating tx, `FPA.sol` L115). Design B: `log.warning` if not a configured list source.
- **`onComplianceCheckDisabled()`**: `A.complianceDisabled = true`.

### 5.5 TempleGold

**`onContractAuthorizationSet(_contract, _whitelisted)`**: upsert `TempleGoldAuthorization(_contract)` (`authorized`, `updatedAt`). If `FixedPriceAuction(_contract)` exists and has a TGLD leg, `tgldAuthorized = _whitelisted`. Mirror whatever is emitted.

### 5.6 WishingWell

**`onWishSet(account, fromToken, toToken, fromAmount, expiresAt)`**
1. Load/create `Token` for both with **no contract calls**: new row `name = symbol = "?"`, `decimals = 0`, `price = 0`, `timestamp = event.block.timestamp`, `metadataPending = true`. Load/create `Pair(fromToken.concat(toToken))` with `auctionCount = 0`, `lastAuctionCreatedAt = 0`.
2. Load/create `Wish(account.concat(fromToken).concat(toToken))`; set `pair`, `fromAmount` (store as `BigInt`), `expiresAt`, `setAt`, `setBlock`, `setLogIndex`, `setHash`.

### 5.7 Token helpers

- **FPA/Wish helper** (new): load-or-create used by §5.1 and §5.6 exactly as described there. `price = 0` on create, never refreshed; no `getTokenPriceInUSD`, no `updateToken`. Don't call the spike's `getOrCreateToken`/`createToken` (plain calls abort on non-tokens, and they price on every load: `Spike src/entities/token.ts` L16-19, L27, L51-57).
- **Legacy `getOrCreateToken`** (`Spike src/entities/token.ts` L34-37): when it loads a row with `metadataPending == true`, re-read name, symbol and decimals through `createToken`'s body (zero-address branch kept, L15-24) and set `metadataPending = false`. A row with null `metadataPending` is never re-read.

## 6. Derived values

| Value | Where | Rule |
|---|---|---|
| Phase | hook | §6.1 |
| `filledBids`, `userFill`, `userRefund`, `funderRefund` | indexer | §6.2; event figures once settled/cancelled |
| `requiredFunding` | indexer | `ceil(totalDeposits × price / priceDenominator)` (`FPA.sol` L485-488) |
| `priceDenominator` | indexer, once | §5.1 step 3 |
| `endsAt` | indexer | §4 |
| Funded % | hook | `funding / requiredFunding`; undefined when `requiredFunding == 0`; may exceed 100% |
| Fill % after settlement | hook | `filledBids / totalDeposits`; 0% (or "—") when `totalDeposits == 0` |
| Claimable | hook | §6.4 |
| Claims blocked by pause | hook | `paused && T ≤ fulfillmentEnd + 30 days` (`FPA.sol` L41, L515-517) |
| Withdrawable excess (funder) | hook | Fulfillment `&& !paused` ? `max(0, funding − requiredFunding)` : 0 (`FPA.sol` L433-437) |
| "You'd get" at full funding | hook | `floor(amount × price / priceDenominator)` (display estimate; up to 1 wei above the contract's share) |
| Demand | hook, pinned block | §6.5 |

### 6.1 Phase (hook)

Apply `_phase` (`FPA.sol` L424-431) with `T` from `_meta.block.timestamp`, never the wall clock:

```
outcome == Settled   → Settlement
outcome == Cancelled → Cancelled
T < depositStart     → Scheduled
T < depositEnd       → Deposit
T < fulfillmentEnd   → Fulfillment
otherwise            → Settlement
```

Final = Settlement or Cancelled. The wall clock is used only for: the freshness label ("updated N min ago" = wall clock − `_meta.block.timestamp`), the chart's today line, the chart window `$from`/`$to` and axis end, the expiry sent with `wish()`, and the form's expiry option labels. Everything else uses `T`, including My Activity's Extend "soon" test and "in N days".

### 6.2 Settlement mirror (indexer, in `save(A)`)

Mirror `_calculateSettlement`/`_settlement` (`FPA.sol` L439-442, L463-474); keep the spike's `updateSettlement` (`Spike src/entities/fixedPriceAuction.ts` L56-86):

```
required = ceil(totalDeposits × price / priceDenominator)
filled   = funding ≥ required ? totalDeposits : floor(funding × priceDenominator / price)
userFill = floor(filled × price / priceDenominator)
filled   = ceil(userFill × priceDenominator / price)
(filledBids, userFill, userRefund, funderRefund) = (filled, userFill, totalDeposits − filled, funding − userFill)
```

No cancelled branch: `onAuctionCancelled` writes `(0, 0, totalDeposits, funderRefund)` itself. Once final, the mirror is the settlement (inputs no longer change), so a clock settlement needs no RPC and no `AuctionSettled`.

### 6.3 Excluded balance (hook)

`P.excluded` is separate from claimable: withdrawable with `withdrawExcluded` in any phase once unpaused or past `fulfillmentEnd + 30 days`, and only if not flagged (`FPA.sol` L191-202).

### 6.4 Claimable estimate (hook)

As `_claimable` (`FPA.sol` L444-454):

```
if not final(T) or P.claimed or A.totalDeposits == 0: (0, 0)
fill   = floor(P.deposit × A.userFill   / A.totalDeposits)
refund = floor(P.deposit × A.userRefund / A.totalDeposits)
```

Cancelled → `(0, deposit)`. Ignores pause and flags, like `claimable()`. For a claimed position display `P.claimedFill` / `P.claimedRefund` instead. Pressing Claim still reads `claimable(me)`.

Edge cases the hook must render: a pause held across `fulfillmentEnd` settles on the funding held when it began, so show "funded so far" (`exclude` can still lower `totalDeposits` until `fulfillmentEnd`); if every deposit is too small to buy 1 wei of fill, `filledBids = 0` and everything is refunded even at full funding (`Model` L184).

### 6.5 Demand (hook)

All inputs from one pinned block `N` (`block: { number: N }` on every demand query), `T_N` its timestamp. For each account `a` and bucket key `k = (bucket(fromToken), bucket(toToken))`, with `bucket(t)` = configured bucket or `t`:

1. **Active wishes:** `W_k = Σ fromAmount` over `a`'s wishes in `k` with `fromAmount > 0 && expiresAt > T_N`. Normalise mixed-decimal buckets (USDS 18, USDC 6) to 18 decimals using the hook's bucket/token config, never `Token.decimals`.
2. **Reset point:** `R_k = max(setAt)` over **all** of `a`'s wishes in `k`, revoked and expired included (Q2).
3. **Fills:** `F_k = Σ fill(P)` over `a`'s positions in auctions whose pair is in `k`, where the auction is final at `T_N` and not cancelled; `settleTime = settledAt ?? fulfillmentEnd` and `settleTime > R_k` strictly; `fill(P) = P.deposit − floor(P.deposit × A.userRefund / A.totalDeposits)` in `fromToken` units. Skip positions with `P.deposit == 0` (this also avoids dividing by zero when `totalDeposits == 0`). Excluded balances are never fills.
4. **Remaining:** `D_k = max(0, W_k − F_k)`.
5. **Flagged:** if `a` is flagged on the screening list, `D_k = 0` (design B only in the dapp; Q5).
6. No balance cap.

Bucket figure = `Σ_a D_k`. `Pair.wishedFor` = `Σ_a max(0, W_p − F_p)` using only that pair's wishes and auctions, with the bucket's `R_k` (Q4). *Wished* = `Σ W_k`.

## 7. Queries

**Rules for every query:**
- `$N`, `$T` come from `Meta`. Pass `block: { number: $N }` on every root field.
- `$me` is lower-case hex. With no wallet, send the zero address as `$me` (and `$wishId` = zero + from + to) and keep every field (unused variables fail validation). Don't run `MyActivityHistory` without a wallet.
- Every unpaged list sets `first: 1000`. Never use `skip`; page with cursors (`number_lt`, `id_gt` starting at `"0x"`, `sortKey_lt`).
- `hasIndexingErrors` true → show stale-data copy and don't present demand.
- After a write, poll `_meta.block.number` until ≥ the receipt block.

```graphql
query Meta { _meta { block { number timestamp hash } hasIndexingErrors } }

fragment Tok on Token { id symbol decimals }
fragment AuctionCard on FixedPriceAuction {
  id number pair { id }
  bidToken { ...Tok } fillToken { ...Tok }
  price priceDenominator minDeposit
  createdAt depositStart depositEnd fulfillmentEnd endsAt
  outcome settledAt settlementEmitted cancelledAt
  paused inRescueMode complianceCheck complianceDisabled tgldAuthorized
  totalDeposits funding requiredFunding depositorCount
  filledBids userFill userRefund funderRefund
}
fragment MyPosition on FixedPriceAuctionPosition {
  id deposit excluded claimed claimedFill claimedRefund firstDepositAt
  auction { ...AuctionCard }
}
```

### 7.1 All auctions: list (f3) and chart (f4)

```graphql
query AllAuctions($N: Int!, $T: BigInt!, $me: Bytes!, $from: BigInt!, $to: BigInt!) {
  running: fixedPriceAuctions(block: { number: $N }, where: { endsAt_gt: $T }, first: 1000) { ...AuctionCard }
  chart: fixedPriceAuctions(block: { number: $N }, first: 1000, orderBy: depositStart,
                            where: { createdAt_lte: $to, endsAt_gte: $from }) {
    id number pair { id } createdAt depositStart depositEnd fulfillmentEnd endsAt outcome paused filledBids totalDeposits
  }
  pairs(block: { number: $N }, first: 1000, orderBy: lastAuctionCreatedAt, orderDirection: desc) {
    id bidToken { ...Tok } fillToken { ...Tok } auctionCount
    recent: auctions(first: 3, orderBy: number, orderDirection: desc, where: { endsAt_lte: $T }) {
      id number outcome endsAt fulfillmentEnd depositStart depositEnd filledBids totalDeposits
    }
  }
  mine: fixedPriceAuctionPositions(block: { number: $N }, where: { account: $me }, first: 1000) { ...MyPosition }
  wishes(block: { number: $N }, first: 1000, orderBy: id, where: { id_gt: "0x" }) { id account fromToken toToken fromAmount expiresAt setAt }
  demandPositions: fixedPriceAuctionPositions(block: { number: $N }, first: 1000, orderBy: id, where: { deposit_gt: "0" }) {
    account deposit excluded claimed
    auction { id bidToken { id } fillToken { id } outcome settledAt fulfillmentEnd totalDeposits userRefund userFill }
  }
  # Design B only: myFlags (claim gates) and DemandFlags' first page
  myFlags: complianceFlags(block: { number: $N }, first: 1000, where: { account: $me, flagged: true }) { list }
  flags: complianceFlags(block: { number: $N }, first: 1000, orderBy: id, where: { flagged: true, id_gt: "0x" }) { id list account }
}
```

- **Demand:** `wishes` + `demandPositions` (filtered to wishers client-side) feed §6.5. If `wishes` returns 1000 rows, continue with `DemandWishes` from the last `id`; if `demandPositions` returns 1000, drop it and run `DemandPositions` over the wishers; if `flags` returns 1000, continue with `DemandFlags`.
- **Running:** client sorts by next deadline and derives the phase.
- **Claims strip:** `mine` filtered to final auctions with `!claimed && deposit > 0`, plus any with `excluded > 0` (any phase).
- **Claim and excluded-row gates** (also used by §7.2 and §7.5). A row is actionable only if all three hold; otherwise show it **blocked, not hidden**:
  1. Not flagged on the auction's list. Design A: one `isFlagged(me)` per distinct list, read when such rows render. Design B: `complianceCheck` not in `myFlags.list`, or design A's read if the list isn't a configured source. Nobody is flagged once `complianceDisabled`. A reverting `isFlagged` read counts as flagged (`ICC.sol` L9-10).
  2. Not `paused && T ≤ fulfillmentEnd + 30 days` (`FPA.sol` L267, L193, L515-517).
  3. TGLD leg: `tgldAuthorized != false` where TGLD would pay. Claim row: blocked if TGLD bid token with refund > 0, or TGLD fill token with fill > 0 (§6.4 estimate). Excluded row: blocked only if TGLD is the bid token (`FPA.sol` L201, L279-284; `TG.sol` L227-232). Conservative: may over-block an account that is itself authorised.
- **Pairs:** `recent` = 3 newest past auctions (`endsAt ≤ T`, complement of `running`). E.g. TGLD → USDS with #7, #8 running returns #6, #5, #4. Client may re-sort (Q12).
- **List view:** drop pairs with `auctionCount == 0`; the chart keeps them.
- **Chart:** window `[from, to]`, default 4 months, then 1 year or All (`$from: "0"`). Lines run from `min(depositStart, endsAt)` to `endsAt`; the All axis starts at the earliest line start. Client trims to the window. Overlapping auctions are separate lanes, never merged.

### 7.2 Pair page (f5–f8)

```graphql
query PairPage($N: Int!, $T: BigInt!, $pair: ID!, $pairRef: String!, $me: Bytes!, $wishId: ID!, $n: Int!) {
  pair(id: $pair, block: { number: $N }) {
    id bidToken { ...Tok } fillToken { ...Tok } auctionCount
    recent: auctions(first: 4, orderBy: number, orderDirection: desc, where: { endsAt_lte: $T }) { ...AuctionCard }
  }
  running: fixedPriceAuctions(block: { number: $N }, where: { pair: $pairRef, endsAt_gt: $T }, first: 1000, orderBy: number) { ...AuctionCard }
  selected: fixedPriceAuctions(block: { number: $N }, where: { pair: $pairRef, number: $n }, first: 1) { ...AuctionCard }
  mine: fixedPriceAuctionPositions(block: { number: $N }, where: { account: $me, auction_: { pair: $pairRef } }, first: 1000) { ...MyPosition }
  myWish: wish(id: $wishId, block: { number: $N }) { fromAmount expiresAt setAt }
  # Design B only
  myFlags: complianceFlags(block: { number: $N }, first: 1000, where: { account: $me, flagged: true }) { list }
}
```

- **Selection:** `?auction=N` → `$n: N`; else `$n: 0` (matches nothing) and default to the running auction with the earliest `fulfillmentEnd`.
- **Wish screen (f8):** runs `PairPage` with `$n: 0` plus the demand passes (§7.6, `DemandWishesForPairs`).
- **Deposit/Withdraw:** hidden while `paused`. Blocked while the account is flagged and `complianceDisabled` is false (`FPA.sol` L120, L138; design A read or design B `myFlags`).
- **TGLD readiness:** while `tgldAuthorized == false`, hide Deposit, and hide Withdraw when TGLD is the bid token. Claim/excluded rows use §7.1's TGLD gate.
- **Moons row:** `recent` 4, plus final auctions in `mine` with `!claimed && deposit > 0` or `excluded > 0`. On a past-auction view, also running auctions in `mine` with `deposit > 0`. On a running-auction view those show in the switcher and the "You're also in #N" card.
- **Quiet wish line:** only when `myWish.fromAmount > 0 && myWish.expiresAt > T`.
- **Settlement lines:** mirror figures and §6.4 estimate; claimed positions show `claimedFill`/`claimedRefund`.
- **No auction:** `pair` may be null (no wish yet) or have `auctionCount: 0`.

### 7.3 Pair history (fh)

```graphql
query PairHistory($N: Int!, $pair: ID!, $pairRef: String!, $me: Bytes!, $cursor: Int!) {   # first page: cursor = 2147483647
  rows: fixedPriceAuctions(block: { number: $N }, first: 20, orderBy: number, orderDirection: desc,
                           where: { pair: $pairRef, number_lt: $cursor }) {
    ...AuctionCard
    positions(where: { account: $me }) { deposit excluded claimed claimedFill claimedRefund }
  }
  # First page only; later pages drop pair, strip, mineIds and $pair.
  pair(id: $pair, block: { number: $N }) { bidToken { ...Tok } fillToken { ...Tok } auctionCount }
  strip: fixedPriceAuctions(block: { number: $N }, first: 1000, orderBy: number, orderDirection: asc,
                            where: { pair: $pairRef }) {
    number outcome endsAt fulfillmentEnd filledBids totalDeposits
  }
  mineIds: fixedPriceAuctionPositions(block: { number: $N }, first: 1000,
                                      where: { account: $me, auction_: { pair: $pairRef } }) { id }
}
query PairHistoryMine($N: Int!, $pairRef: String!, $me: Bytes!, $cursor: Int!) {
  fixedPriceAuctions(block: { number: $N }, first: 20, orderBy: number, orderDirection: desc,
                     where: { pair: $pairRef, number_lt: $cursor, positions_: { account: $me } }) {
    ...AuctionCard
    positions(where: { account: $me }) { deposit excluded claimed claimedFill claimedRefund }
  }
}
```

- Next cursor = last row's `number`.
- `strip`: one bar per auction, oldest first; final when `endsAt ≤ T`, hatched when `Cancelled`, fill = `filledBids / totalDeposits` (0% or "—" when 0). "All N" = its row count = `Pair.auctionCount`.
- "Showing X of Y" in Only-mine mode: Y = `mineIds` row count. "Only mine" = any position, including fully withdrawn.
- If graph-node rejects `positions_` (a filter through a derived field), page `mineIds` and query `fixedPriceAuctions(where: { id_in: … })` instead.

### 7.4 Earn: TGLD list (f2)

```graphql
query EarnTgld($N: Int!, $T: BigInt!, $tgld: String!, $me: Bytes!) {
  fixedPriceAuctions(block: { number: $N }, where: { bidToken: $tgld, endsAt_gt: $T, tgldAuthorized: true }, first: 1000) { ...AuctionCard }
  mine: fixedPriceAuctionPositions(block: { number: $N }, where: { account: $me, auction_: { bidToken: $tgld } }, first: 1000) { ...MyPosition }
}
```

`$tgld` is the TGLD `Token` id as a string.

### 7.5 My Activity (f9)

```graphql
query MyActivity($N: Int!, $T: BigInt!, $me: Bytes!) {
  positions: fixedPriceAuctionPositions(block: { number: $N }, where: { account: $me }, first: 1000,
                                        orderBy: firstDepositAt, orderDirection: desc) { ...MyPosition }
  running: fixedPriceAuctions(block: { number: $N }, where: { endsAt_gt: $T }, first: 1000) { ...AuctionCard }
  wishes(block: { number: $N }, where: { account: $me, fromAmount_gt: "0", expiresAt_gt: $T }, first: 1000,
         orderBy: setAt, orderDirection: desc) {
    id pair { id bidToken { ...Tok } fillToken { ...Tok } } fromAmount expiresAt setAt
  }
  # Design B only
  myFlags: complianceFlags(block: { number: $N }, first: 1000, where: { account: $me, flagged: true }) { list }
}
# Optional; not in the first build.
query MyActivityHistory($N: Int!, $me: Bytes!, $cursor: BigInt!) {   # first page: cursor = (N + 1) × 2^32
  history: fixedPriceAuctionActivities(block: { number: $N }, first: 20, orderBy: sortKey, orderDirection: desc,
                                       where: { account: $me, sortKey_lt: $cursor }) {
    id sortKey timestamp hash kind amount amount2 auction { id number pair { id } }
  }
}
```

- Order: claim rows (as §7.1, with its gates; a fully withdrawn position is not a claim row), deposits in running auctions, wishes (with whether an auction is running/scheduled on the pair, from `running`), past auctions.
- "Show history": past positions sorted client-side by `auction.endsAt` desc and paged client-side; no second query.

### 7.6 Wish form and demand passes

The form reads `wish(id: me+from+to) { fromAmount expiresAt }` so it edits rather than adds. Tokens with `symbol "?"`/`decimals 0` are formatted from the client token config.

```graphql
query DemandWishes($N: Int!, $idGt: Bytes!) {
  wishes(block: { number: $N }, first: 1000, orderBy: id, where: { id_gt: $idGt }) {
    id account fromToken toToken fromAmount expiresAt setAt
  }
}
# $wishers in chunks of at most 1000 accounts
query DemandPositions($N: Int!, $wishers: [Bytes!]!, $idGt: Bytes!) {
  positions: fixedPriceAuctionPositions(block: { number: $N }, first: 1000, orderBy: id,
                                        where: { account_in: $wishers, id_gt: $idGt }) {
    id account deposit excluded claimed
    auction { id bidToken { id } fillToken { id } outcome settledAt fulfillmentEnd totalDeposits userRefund userFill }
  }
}
# Design B only
query DemandFlags($N: Int!, $idGt: Bytes!) {
  flags: complianceFlags(block: { number: $N }, first: 1000, orderBy: id, where: { flagged: true, id_gt: $idGt }) {
    id list account
  }
}
# Pair and wish pages: $pairs = every pair id in the page's bucket
query DemandWishesForPairs($N: Int!, $idGt: Bytes!, $pairs: [String!]!) {
  wishes(block: { number: $N }, first: 1000, orderBy: id, where: { id_gt: $idGt, pair_in: $pairs }) {
    id account fromToken toToken fromAmount expiresAt setAt
  }
}
```

Next cursor = last row's `id`; first page `"0x"`. If wishes pass about 5000, move demand to a dashboard service running the same algorithm.

### 7.7 Contract reads the UI still makes

| Read | When |
|---|---|
| `balanceOf(me)` per token shown | wallet header, deposit form, Earn |
| `allowance(me, auction)` | deposit form |
| `claimable(me)` on one auction | Claim pressed |
| `isFlagged(me)` per distinct list shown | design A: when claim/excluded rows render and before deposit/withdraw; design B: only for an unconfigured list. Revert = flagged |
| `isAuction(address)` on the factory | only when a page opens from a raw address |

## 8. Implementation tasks

Work in `TempleDAO/spice-bazaar-subgraph` on branch `fpa-spike`. Each task is done when its check passes.

1. **Schema.** Apply §4: new `Pair`, `TempleGoldAuthorization`; new fields on spike entities (factory `implementationSupported`, `proposedImplementationSupported`; auction `pair`, `number`, `createdBlock`, `createdLogIndex`, `endsAt`, `cancelledAt`, `treasuryProceeds`, `treasuryFunderRefund`, `tgldAuthorized`, `settlementMismatch`; `UnsupportedFixedPriceAuction.createdBlock`; position `firstDepositAt`; activity `blockNumber`, `logIndex`, `sortKey`; wish `pair`, `setBlock`, `setLogIndex`); `Token.metadataPending: Boolean`. *Check:* `yarn codegen && yarn build` pass; no legacy type changed except `Token`.
2. **Decoder registry.** Replace the hard-coded list in `src/config/fixedPriceAuction.ts` (`Spike` L5, L13-18) with the config-driven registry of §5.1. *Check:* a checksummed implementation address in config matches the lower-case `toHexString()` of the event's `implementation`.
3. **Token helpers.** Add the FPA/Wish helper and the legacy re-read (§5.7) in `src/entities/token.ts`. *Check:* `yarn build` passes.
4. **Factory mappings** (`src/mappings/fixedPriceAuctionFactory.ts`): §5.1, including factory defaults, Pair/numbering, metadata re-read before `priceDenominator` (replacing the spike's `getOrCreateToken` call at L57-58), TGLD authorisation lookup, `unset` for the proposal flag. *Check:* `yarn build` passes.
5. **Auction mappings** (`src/mappings/fixedPriceAuction.ts`, `src/entities/fixedPriceAuction.ts`): §5.2–5.4. Changes vs spike: `outcome = Settled` only when early; replace the mismatch `assert` (L113-117) with flag + `log.error`; `save(A)` skips the mirror after settle/cancel; `endsAt`/`cancelledAt`; exclude consistency check; treasury amounts; `Settle`/`Cancel` `account` = zero address (was `event.transaction.from`, L121, L135); activity `blockNumber`/`logIndex`/`sortKey`. *Check:* `yarn build` passes.
6. **TempleGold.** Add `ContractAuthorizationSet` to the `TempleGold` source in each template and `onContractAuthorizationSet` in `src/mappings/templeGold.ts` (§5.5). *Check:* `yarn build` passes.
7. **WishingWell** (`src/mappings/wishingWell.ts`): §5.6. Add `Token`, `Pair` to the source's `entities` (today it lists only `WishingWell` and `Wish`). *Check:* `yarn build` passes.
8. **Manifests and config.** Add the factory, auction template and WishingWell sources and the §3 config keys to each deployment's template and config. *Check:* `yarn prepare:<network> && yarn codegen && yarn build` pass; no `address: ''` in the generated `subgraph.yaml`.
9. **Deploy scripts.** Replace the `deploy:*` scripts (`graph deploy --product hosted-service`, `package.json` L8-17) with the Goldsky command of §9.1. *Check:* `yarn goldsky --help` runs and the script prints the §9.1 command.
10. **Design B (only if Q6 adopts it).** Appendix A.

## 9. Operations

### 9.1 Deploy (grafted)

1. `yarn goldsky login`.
2. Confirm production exists on Goldsky as `<name>/<current>` (the README says production goes through Alchemy).
3. Always rebuild (a leftover `build/` is deployed as-is), then deploy with `B` below the earliest new `startBlock`:
   ```
   yarn prepare:<network> && yarn codegen && yarn build && yarn goldsky subgraph deploy <name>/<new> --path . --graft-from <name>/<current> --start-block <B>
   ```
   Without `--start-block`, `--graft-from` grafts from the base's latest block and new sources miss history. Alternative: manifest `graft: { base: <Qm… deployment ID>, block: B }` with `B` already indexed by the base.
4. No Goldsky base: deploy without `--graft-from`/`--start-block`, let it sync from the legacy start blocks, then switch the UI.
5. Design B: a new `ComplianceCheck` source needs `B` below its deploy block.

### 9.2 Implementation upgrade

1. **Detect:** `proposedImplementationSupported == false` or `implementationSupported == false` alerts.
2. **Prepare:** diff the new `IFixedPriceAuction` and config against v1.
   - Same config and events → add the address to the registry under `v1`.
   - New config layout → decoder `v2` into the same entity fields; new entity fields nullable.
   - Events only added → add handlers to the same template.
   - Event signature changed → second template `FixedPriceAuctionV2`, chosen per implementation in `onAuctionCreated`.
3. **Release before the rescuer accepts**, or at least before the first `createAuction` on it, grafted at a recent block (§9.1).
4. **Already stored as unsupported:** redeploy grafted with `--start-block` before that `AuctionCreated`; warn the UI team that later numbers on that pair may shift by one.
5. **Retired factory:** set `source.endBlock`; add the new factory as a new static source.

### 9.3 Monitoring alerts

- `_meta.hasIndexingErrors == true`, or subgraph head behind chain head by more than a set time.
- `UnsupportedFixedPriceAuction` count > 0.
- `FixedPriceAuctionFactory.proposedImplementationSupported == false`.
- `FixedPriceAuctionFactory.implementationSupported == false`.
- `FixedPriceAuction.settlementMismatch == true`.
- TGLD auction with `tgldAuthorized == false` and `depositStart` within a set window.
- `inRescueMode` true on the factory or any auction; `paused` on any auction.
- Design B: an auction's `complianceCheck` not among configured list sources.

Thresholds are for ops to choose. Decision-time demand exports use `N = head − d` (Q15); the UI uses the latest `_meta.block`.

## 10. Open questions

| ID | Question | Spec default | If answered otherwise |
|---|---|---|---|
| Q2 | Does any `WishSet` in the bucket reset subtracted fills? | Yes (§6.5 step 2) | Change `R_k` in the hook only |
| Q4 | How are a multi-pair bucket's fills attributed per pair? | Per-pair floor with bucket `R_k` | Hook only; moot while each pair is its own bucket |
| Q5 | Which compliance list screens wishes? | Unset; demand step 5 needs design B | Hook step 5 |
| Q6 | Index flags (B) or read `isFlagged` (A)? | A | Implement Appendix A; add `myFlags`/`flags` fields |
| Q9 | Where do buckets live; which tokens are "stables"? | Hook config, USDS + USDC | Indexer config would need a re-index on change |
| Q10 | On settlement mismatch: halt or flag? | Flag + store event figures | Restore the spike's `assert` |
| Q12 | Pair row shows wished or wished minus fills; "busiest" metric; Extend window; "as of block N" vs "updated N min ago" | Order by `lastAuctionCreatedAt`; client re-sorts | Hook/UI only |
| Q13 | Hide wishes on unlisted tokens? | No filter; client token config formats them | Add allow-list filtering |
| Q15 | Confirmation depth `d` for decision-time exports | None set | Ops |
| Q16 | Must auction tokens return string `name`/`symbol`, or add bytes32 fallback ABIs? | `try_` with `"?"` fallback | Add `ERC20NameBytes`/`ERC20SymbolBytes` to the factory source |
| Q17 | When the indexer lags without `hasIndexingErrors`, disable actions or show stale copy? | None set | Hook/UI only |

Omitted: Q1 (dashboard-only balance check), Q7 (legacy sources stay either way), Q14 (out of scope). Q3 decided (no balance cap); Q8 moot.

## 11. Prototype hook mapping

Re-check against `Proto` before wiring; it's work in progress.

| Hook | Backed by |
|---|---|
| `useNow` | wall clock, only for the uses in §6.1 |
| `useIndexerStatus` | `_meta.block { number timestamp }` → `N`, `T` |
| `usePairs` | `AllAuctions.pairs` + hook demand (§6.5, §7.6) |
| `usePair` | `PairPage.pair`; on history, `PairHistory.pair` (first page) |
| `useAuctions` | `AllAuctions.running` + `chart`; pairs filter → `Pair.auctionCount`. `useRunning` → `AllAuctions.running`, `EarnTgld`, `MyActivity.running`, `PairPage.running` |
| `usePairAuctions` | `PairPage.recent` + `running` + `selected`; counts → `Pair.auctionCount`; history → `PairHistory` (`number_lt`); list moons → `AllAuctions.pairs.recent` |
| `useMyPositions` | `MyActivity.positions`, `AllAuctions.mine`, `PairPage.mine`, `PairHistory` nested `positions`, `EarnTgld.mine`; `useAuctions().find(id)` → `MyPosition.auction` |
| `useMyWishes` | `MyActivity.wishes`; `WishLine` → `PairPage.myWish` |
| `useWalletBalance` | `balanceOf(me)` |
| `useStaking` | unchanged, out of scope |
| `useClaimable` | display: §6.4 estimate; on press: `claimable(me)` (not per position) |
| `useAuctionActions` | contract writes, then `_meta` poll |
| `useWishActions` | `WishingWell.wish(...)` for `makeWish` and `extendWish`, then `_meta` poll |

Prototype behaviour that must change when wiring:
- Types: symbols and float amounts → `Token { id symbol decimals }` and `bigint`; pair id is address bytes (routes need a slug ↔ id map or address routes); auction id is the address.
- Phase, deadlines and claimability use `T`, not `useNow`.
- `outcome` stays `None` after a clock settlement; `settledAt` is null until emitted; use `settledAt ?? fulfillmentEnd` once final.
- `Position` gains `excluded` (and `excludedWithdrawn`, `claimedFill`, `claimedRefund`); claim lists and `useClaimable` include excluded balances.
- `useClaimable` uses the contract-rounded estimate, not a capped float fraction.
- Fill % on final auctions = `filledBids / totalDeposits`, not funding/required.
- Earn filters `tgldAuthorized: true`.
- Claim actions apply the pause, flag and TGLD gates (blocked, not hidden).
- Chart and history lines start at `min(depositStart, endsAt)` and end at `endsAt`.
- Moons row adds `excluded > 0` and, on a past-auction view, running auctions with `deposit > 0`.
- Quiet wish line filters `fromAmount > 0 && expiresAt > T`.
- "Only mine" includes fully withdrawn positions.
- `isNew` chip stays client-only.

## Appendix A. Flags design B (only if Q6 adopts it)

1. Add `ComplianceCheck.json` (events `FlaggedSet(indexed address,bool)`, `FlaggerSet(indexed address,bool)`, `ICC.sol` L12-13) and one static `ComplianceCheck` source per known list, from its deploy block (graft block below it).
2. Schema:
   ```graphql
   type ComplianceFlag @entity {
     id: Bytes!         # list.concat(account)
     list: Bytes!       # event.address
     account: Bytes!
     flagged: Boolean!
     updatedAt: BigInt!
   }
   ```
3. `onFlaggedSet(account, flagged)`: upsert `ComplianceFlag(event.address.concat(account))`. `FlaggerSet` not indexed.
4. `onComplianceCheckSet`: `log.warning` when the list isn't a configured source; such auctions fall back to the design A `isFlagged(me)` read.
5. The `myFlags`/`flags` fields and `DemandFlags` (§7) exist only under design B.
