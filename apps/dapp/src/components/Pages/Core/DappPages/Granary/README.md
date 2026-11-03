# Temple Granary

The Temple Gold section built on FixedPriceAuction and WishingWell (PR #1312, branch `fpa-frozen-inputs`). It will replace the Spice Bazaar's Bid For Temple Gold and Spend Temple Gold tabs. It started from the prototype on `claude/granary-auctions-prototype-f26d20`, and is desktop first.

## Where it lives

It's a separate route, `/dapp/granary`, so the live Spice Bazaar at `/dapp/spice` is unchanged until the team switches over. The routes are declared in `src/main.tsx`; there is no side-nav entry yet.

| Screen                   | Route                                                    |
| ------------------------ | -------------------------------------------------------- |
| Splash / Overview        | `/dapp/granary`                                          |
| Earn Temple Gold         | `/dapp/granary/earn`                                     |
| All auctions, List       | `/dapp/granary/auctions`                                 |
| All auctions, Chart      | `/dapp/granary/auctions?view=chart`                      |
| Pair page                | `/dapp/granary/pair/temple-usds` (`?auction=N` for #N)   |
| Pair history             | `/dapp/granary/pair/temple-usds/history`                 |
| Make a wish              | `/dapp/granary/wish` (`?give=TEMPLE&get=USDS&amount=10`) |
| My Activity              | `/dapp/granary/activity`                                 |
| My Activity, past Bazaar | `/dapp/granary/activity/legacy`                          |

A pair page for a pair with no auction redirects to the wish screen for that pair.

## Data flow

```
screens → data/hooks.ts → providers/GranaryProvider.tsx → GranaryDataSource (data/source.ts)
                                                            └─ data/liveSource.ts
                                                                 ├─ data/indexer.ts → Granary indexer (subgraph)
                                                                 └─ contracts over RPC
```

- **`GranaryProvider`** (mounted by `GranaryLayout`) owns every read (react-query, keyed under `['granary', …]`) and every write. A write checks for a wallet (prompting a connect if there is none), switches it to the Granary chain, sends the transaction, waits for the indexer to reach its block (staking writes skip this: the indexer doesn't track staking), shows a notification, then refetches all Granary queries. Each action resolves `true` once done and `false` on failure.
- **Indexer reads** (`data/indexer.ts`): auctions, pairs, positions, wishes and wish demand. They come from the Spice Bazaar subgraph's Granary entities (v0.6.0 on Sepolia), following `docs/granary.md` and `docs/granary-queries.graphql` on `TempleDAO/spice-bazaar-subgraph` (branch `feat/granary-indexer`). Each read is pinned to the block `_meta` reports.
- **Contract reads**: wallet balances, `claimable(me)`, `TempleGoldStaking` (pool totals without a wallet; stake, rewards, unlock time and delegate with one), and `isFlagged(me)` on each compliance list the auctions use (the docs' design A).
- **Clocks**: `useNow()` is the indexer's block time; phases and countdowns use it so they agree with the data. `useWallClock()` is the browser's, used only for "updated N min ago", the chart's today line, and wish expiry dates.
- **Tokens**: only tokens in the app's token config are shown, with the config's symbol (Sepolia's USDS calls itself DAI on-chain). Auctions and wishes in other tokens are left out; add the token to `constants/newenv` to show them.
- **`data/derive.ts`** holds client-side derivations (phase, funded %, one depositor's settlement) and formatting.

## Config

`constants/newenv/{test,prod}.ts`, under `granary`:

- `factory`, `wishingWell`, `complianceCheck`: the deployed contracts. Zero addresses on prod until it's deployed.
- `wishTokens`: the tokens the wish screen offers, as any give → get pair.
- `subgraphUrl`: the Granary indexer. Empty on prod for now, so prod shows no auctions.

## Contract mapping

| UI action            | Contract call                                                                 |
| -------------------- | ----------------------------------------------------------------------------- |
| Deposit              | `FixedPriceAuction.deposit(amount)`, after approving exactly `amount`         |
| Withdraw all         | `FixedPriceAuction.withdrawDeposit(deposits(me))`                             |
| Claim                | `FixedPriceAuction.claim()`                                                   |
| Withdraw excluded    | `FixedPriceAuction.withdrawExcluded()`                                        |
| Make / edit / extend | `WishingWell.wish(give, get, amount, now + duration)`                         |
| Remove wish          | `WishingWell.wish(give, get, 0, 0)`                                           |
| Stake                | `TempleGoldStaking.stake(amount)`, after approving exactly `amount` of TEMPLE |
| Unstake              | `TempleGoldStaking.withdraw(amount, claimRewards)`                            |
| Delegate             | `TempleGoldStaking.delegate(delegatee)`                                       |
| Claim TGLD           | `TempleGoldStaking.getReward(me)`                                             |

Actions are disabled, with a note, when the wallet is on the auction's compliance list, when the auction is paused (claims: until 30 days after it ends), and when a TGLD auction isn't authorised by TempleGold yet. Stake, unstake and claim TGLD are disabled while staking is paused, and unstake until the stake's lock ends.

Staking moved here from Spice Bazaar's Earn tab (`SpiceBazaar/Earn/StakeTemple`), which is unchanged. It uses `contracts.templeGoldStaking` and `contracts.templeGold`, and only when they're on the Granary chain.

ABIs for the dapp's typechain are in `apps/dapp/abi/contracts/interfaces/templegold/`, compiled from the PR #1312 interfaces with `solc --abi`. `IFixedPriceAuction` and `IFixedPriceAuctionFactory` also carry `CommonEventsAndErrors`' errors so reverts decode. Regenerate them if the interfaces change before merge.

## Indexer gaps

- **Buckets.** Wish demand is per pair; the docs' buckets (e.g. USDS + USDC as one "stables" side) aren't configured.
- **Flagged wishers.** Demand still counts wishes from flagged accounts; screening them needs the indexer's design B.
- **Indexer lag.** After a write the app waits up to 90s for the indexer, then refreshes anyway.

## Flags

- **Splash art.** `SPLASH_ART` in `screens/Splash.tsx` picks the default (`'drawn'`). Add `?art=painted` or `?art=drawn` to the URL to compare.

## Legacy claims

My Activity → Spice Bazaar (past) embeds the existing `MyActivityTGLD` and `MyActivitySpice` components, so old Spice Bazaar claims keep working. They take an `embedded` prop that hides their own sub-nav.

## Not done yet

- Phone layouts.
- The mainnet deployment and indexer.
- Redirecting `/dapp/spice/bid` and `/dapp/spice/spend`, and moving the nav entry, at switch-over.
