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
                                                            └─ data/liveSource.ts → contracts over RPC
```

- **`GranaryProvider`** (mounted by `GranaryLayout`) owns every read (react-query, keyed under `['granary', …]`) and every write. A write checks for a wallet (prompting a connect if there is none), switches it to the Granary chain, sends the transaction, shows a notification, then refetches all Granary queries. Each action resolves `true` once mined and `false` on failure.
- **`liveSource`** reads the contracts in `getAppConfig().granary`: Sepolia on test (`VITE_ENV=preview`), mainnet on prod. Reverts are decoded into `GranaryError` codes the provider shows in words. Token symbols come from the app's token config by address, so Sepolia's USDS shows as USDS although its contract calls itself DAI.
- **`data/derive.ts`** holds client-side derivations (phase, funded %, one depositor's settlement) and formatting.

## Config

`constants/newenv/{test,prod}.ts`, under `granary`:

- `factory`, `wishingWell`, `complianceCheck`: the deployed contracts. Zero addresses on prod until it's deployed; the Granary then shows no auctions and the wish screen says it isn't taking wishes.
- `auctions`: the auctions to read. Add each new auction the factory creates here until the indexer lists them.
- `wishTokens`: the tokens the wish screen offers, as any give → get pair.
- `subgraphUrl`: empty until the Granary indexer is deployed.

## Contract mapping

| UI action            | Contract call                                                                   |
| -------------------- | ------------------------------------------------------------------------------- |
| Deposit              | `FixedPriceAuction.deposit(amount)`, after approving exactly `amount`           |
| Withdraw all         | `FixedPriceAuction.withdrawDeposit(deposits(me))`                               |
| Claim                | `FixedPriceAuction.claim()`; disabled while paused, up to 30 days after the end |
| Withdraw excluded    | `FixedPriceAuction.withdrawExcluded()`                                          |
| Make / edit / extend | `WishingWell.wish(give, get, amount, now + duration)`                           |
| Remove wish          | `WishingWell.wish(give, get, 0, 0)`                                             |

ABIs for the dapp's typechain are in `apps/dapp/abi/contracts/interfaces/templegold/`, compiled from the PR #1312 interfaces with `solc --abi`. `IFixedPriceAuction` and `IFixedPriceAuctionFactory` also carry `CommonEventsAndErrors`' errors so reverts decode. Regenerate them if the interfaces change before merge.

## Waiting on the indexer

Search for `TODO(granary-subgraph)`. Until the Granary indexer (`spec/indexer-implementation-spec.md` on the prototype branch) is deployed:

- **Auction list.** Only the auctions in config show, read with 7 calls each. The indexer lists every `AuctionCreated` from the factory.
- **Auction numbers and dates.** `#N` is counted per pair by deposit start; creation and cancellation dates are unknown (the timeline shows "opened" instead of "created").
- **Wish demand.** "N wished for" on pairs is hidden. It sums every account's wishes less their fills (spec §6.5), so it can't come from the contract.
- **Your wishes.** Read with `wishOf` for each pair of configured tokens; wishes for other tokens don't show.
- **Your positions and activity.** Read per configured auction; a claimed row can't show what it paid.
- **Pair history and the chart.** Limited to configured auctions.
- **Earn.** TGLD auctions aren't filtered on `tgldAuthorized` yet.
- **Freshness and phase clock.** "Updated N min ago" and phases use the RPC's latest block and the wall clock, not the indexer's `_meta.block`.

## Flags

- **Splash art.** `SPLASH_ART` in `screens/Splash.tsx` picks the default (`'drawn'`). Add `?art=painted` or `?art=drawn` to the URL to compare.

## Legacy claims

My Activity → Spice Bazaar (past) embeds the existing `MyActivityTGLD` and `MyActivitySpice` components, so old Spice Bazaar claims keep working. They take an `embedded` prop that hides their own sub-nav.

## Not done yet

- The indexer reads above.
- Compliance: the UI doesn't read `isFlagged(me)` before a deposit; a flagged wallet sees the revert as "This wallet cannot take part".
- Phone layouts.
- Redirecting `/dapp/spice/bid` and `/dapp/spice/spend`, and moving the nav entry, at switch-over.
