# Temple Granary prototype

Clickable prototype of the Temple Gold auctions section (FixedPriceAuction + WishingWell) that will replace the Spice Bazaar's Bid For Temple Gold and Spend Temple Gold tabs. Desktop first, dummy data only: no chain calls, and buttons simulate success after a short wallet delay.

## Where it lives

It's a separate route, `/dapp/granary`, so the live Spice Bazaar at `/dapp/spice` is unchanged until the team switches over. The routes are declared in `src/main.tsx`.

| Storyboard frame                       | Route                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| 1 Splash / Overview                    | `/dapp/granary`                                            |
| 2 Earn Temple Gold                     | `/dapp/granary/earn`                                       |
| 3 All auctions, List                   | `/dapp/granary/auctions`                                   |
| 4 All auctions, Chart                  | `/dapp/granary/auctions?view=chart`                        |
| 5 Pair page, deposit into #4           | `/dapp/granary/pair/temple-usds`                           |
| 6 Two auctions at once (#7, #8 paused) | `/dapp/granary/pair/tgld-usds` (`?auction=8` for #8)       |
| 7 Past auction #3, claim               | `/dapp/granary/pair/temple-usds?auction=3`                 |
| 8 Pair history                         | `/dapp/granary/pair/tgld-usds/history`                     |
| 9 Wish for a pair with no auction      | `/dapp/granary/wish` (`?give=TGLD&get=wstETH&amount=2000`) |
| 10 My Activity                         | `/dapp/granary/activity`                                   |
| 11 My Activity, Spice Bazaar (past)    | `/dapp/granary/activity/legacy`                            |

A pair page for a pair with no open auction redirects to the wish screen for that pair.

## Flags

- **Splash art.** `SPLASH_ART` in `screens/Splash.tsx` picks the default (`'drawn'`). Add `?art=painted` or `?art=drawn` to the URL to compare.
- **Clock.** Every countdown, phase and date is derived from `useNow()`. `GranaryLayout` provides `FIXED_NOW` (27 Oct 2026 16:00 UTC). Pass a different `Date` to `<NowProvider>` to see other phases.

## Data

The indexer and its queries are specified in [`spec/indexer-implementation-spec.md`](../../../../../../../../../spec/indexer-implementation-spec.md) (repo root). Each hook in `data/hooks.ts` has a comment naming the operation and section it maps to; §11 of the spec has the full mapping and the type changes needed when wiring.

All dummy data is in `data/fixtures.ts`: the storyboard's example wallet (0x7a…41c2), its positions and wishes, and every auction. Screens read it only through the hooks in `data/hooks.ts`. Each hook returns `{ data, isLoading }` like react-query, so the hooks can be replaced with real reads without touching the screens.

Summary (see the spec §11 for detail):

| Hook                          | Replace with                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `usePairs`, `usePair(pairId)` | Indexer: pairs with counted wish demand at a pinned block                      |
| `useAuctions()`               | Indexer: all auctions, with config, totals, `funding`, `PausedSet` and outcome |
| `usePairAuctions(pairId)`     | The same query filtered to one pair, newest first (paged by cursor)            |
| `useMyPositions()`            | Indexer: the account's `Deposited`/`DepositWithdrawn` and claims               |
| `useMyWishes()`               | Indexer: `WishSet` for the account                                             |
| `useIndexerStatus()`          | Indexer: latest block number and time (freshness, pinned demand block)         |
| `useClaimable(auction)`       | Contract: `claimable(account)` on that auction                                 |
| `useWalletBalance(token)`     | Contract: `balanceOf(account)`                                                 |
| `useStaking()`                | The existing staking reads                                                     |
| `useAuctionActions()`         | `deposit`, `withdrawDeposit`, `claim` transactions                             |
| `useWishActions()`            | `wish(from, to, amount, expiry)`, for both a new wish and an extension         |

`data/derive.ts` holds the client-side derivations (phase from config times, funded %, the settlement for one depositor) and the formatting. These stay when the hooks are swapped.

Simulated writes update an in-memory store, so a claim, deposit or new wish shows up on every screen until the page reloads.

## Legacy claims

Frame 11 embeds the existing `MyActivityTGLD` and `MyActivitySpice` components, so old Spice Bazaar claims keep working on real data. They take an `embedded` prop that hides their own sub-nav.

## Local dev in a sandbox

Inside the agent sandbox, macOS FSEvents delivers no file events, so Vite never sees edits. `CHOKIDAR_USEPOLLING` doesn't help, because chokidar still uses FSEvents on macOS. Start the dev server with `WATCH_POLLING=1 yarn dev` to switch Vite's watcher to polling. The flag is off by default, so the shared config and CI behave as before.

Dependencies: yarn 1's tarball downloads abort through the sandbox proxy (curl, npm and plain Node download fine), so run `yarn install --frozen-lockfile` outside the sandbox. This branch was last checked against such an install (`yarn check --integrity --ignore-scripts` in sync).

## Not done yet

- Phone layouts (the Moon Log).
- Redirecting `/dapp/spice/bid` and `/dapp/spice/spend`, and moving the nav entry, at switch-over.
