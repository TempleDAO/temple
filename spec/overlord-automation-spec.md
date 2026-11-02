# Overlord automation for Granary auctions

**Contracts:** [TempleDAO/temple, branch `fpa-frozen-inputs`](https://github.com/TempleDAO/temple/tree/fpa-frozen-inputs) (FixedPriceAuction, FixedPriceAuctionFactory, ComplianceCheck). **Code goes in:** `apps/automation/automation-v2` (Overlord).

## The ask

Build three Overlord tasks:

| # | Task | Schedule | Sends transactions? | In one line |
|---|---|---|---|---|
| 1 | **`fpa-compliance-flagger`** | Every minute | Yes, from a dedicated hot key | Flags every OFAC-sanctioned address, plus any address ops list, on the compliance list, then removes flagged bidders' deposits from live auctions |
| 2 | **`fpa-watch`** | Every minute (suggested) | No | Posts a Discord alert when something happens that the msig or the rescuer must act on, such as a rogue auction, a key handover, a pause or a missing TGLD authorisation |
| 3 | **Signer balance** | Hourly (existing task) | No | Adds the flagger key to the existing low-ETH alert |

Overlord never signs as the msig or the rescuer. Both are Safes, and the alerts in task 2 tell their signers when to act.

**Blocking decision before task 1 can ship:** which private relay the flagger sends through (Q2). The rest have defaults. See [Decisions needed](#decisions-needed).

---

## Task 1: `fpa-compliance-flagger`

### What it does

Each run does three things in order:

```
1. Work out who should be flagged:      F = OFAC SDN addresses ∪ ops' manual list
2. Flag anyone in F not yet flagged:     ComplianceCheck.setFlagged(newAddresses, true)   (private relay)
3. Tidy up live auctions:                exclude flagged depositors; reinstate cleared ones (Deposit only)
```

- **Flag everyone up front.** The task flags the whole list ahead of time rather than checking each depositor when they bid. A sanctioned address is then already flagged before it can deposit, which is what the threat analysis asks for (T-12).
- **Flags are never removed automatically.** When an address drops off `F`, the task alerts and the msig decides (Q4).

**Signer:** a dedicated hot key, `fpa_flagger_signer`. The msig makes it a flagger with `setFlagger(key, true)` on each `ComplianceCheck`.

**Schedule:** `cronSchedule: '* * * * *'`. If a run is still waiting on a receipt when the next run starts, the next run exits silently, so a flag is never sent twice.

### Step 1: who should be flagged (`F = SDN ∪ M`)

**`SDN`: OFAC's sanctioned crypto addresses.** OFAC publishes the SDN list through its Sanctions List Service. It has no webhooks and needs no API key, so the task polls.

| When | Request | Returns |
|---|---|---|
| Every run (the change check) | `GET https://sanctionslistservice.ofac.treas.gov/changes/history/{YYYY}` | JSON array of `{ publicationID, datePublished }`, newest first. Example: `{"publicationID":1080,"datePublished":"2026-10-28T10:03:02.588807"}` (fetched 2026-10-30) |
| Only when there's a new publication | `GET https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML` | The full SDN list as XML. It's large, so parse it as a stream. The old `treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml` URL 302-redirects here |

1. **Check for changes.**
   - Request the history for the current UTC year. If the array is empty (early January), request the previous year.
   - Compare the largest `publicationID` with `sdnPublicationId` in KV. Compare IDs, not dates, because the dates carry no time zone.
   - If they match, reuse the stored `SDN` set.
2. **On a new publication, download and parse** (logic from the MIT-licensed [0xB10C extractor](https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses)):
   - **Namespace:** `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ADVANCED_XML`.
   - **Feature types:** in `ReferenceValueSets/FeatureTypeValues`, collect the `ID` of every entry whose text starts with `Digital Currency Address - ` (`… - ETH`, `… - USDT`, `… - USDC`, …).
   - **Addresses:** in `DistinctParties`, read the `VersionDetail` text under every `Feature` with one of those `FeatureTypeID`s.
   - **Filter:** keep values matching `^0x[0-9a-fA-F]{40}$`, then lower-case and dedupe.
     - This deliberately keeps every EVM-format address, whatever its ticker tag, because a sanctioned party controls the same key on Ethereum.
     - BTC, TRX and other non-EVM addresses are dropped.
3. **Sanity-check before storing.** Reject the result, keep the stored set and alert `defcon3` if any of these hold:
   - no `Digital Currency Address - ETH` feature type is found;
   - fewer than `minSdnCount` addresses result;
   - the set shrinks by more than `maxSdnDrop` addresses.

   A failed or truncated download must never read as "nobody is sanctioned".
4. **Store and report.** Only after a good parse, store `SDN` and the publication ID, then post `defcon5` with the counts added and removed. Most publications don't touch crypto addresses, so most produce no change.
5. **Request failures.** If a request fails, keep the stored set and retry on the next run. Alert `defcon3` only when no check has succeeded for `sdnStaleAlertSecs`.
6. **User-Agent.** Send a `User-Agent` header on every request. A third-party guide says the service returns 403 without one. That's unverified, but the header is harmless.

**`M`: addresses ops want flagged.** These come from the `fpa_manual_flags` config variable, a comma-separated `StringVariable`. Overlord config has no list type.
- Validate each entry with viem's `isAddress`.
- If any entry is invalid, ignore all of `M` for this run and alert `defcon3`, naming the bad entries. `SDN` still applies.

### Step 2: flag (for each configured `ComplianceCheck`)

1. `add = { a ∈ F : !isFlagged(a) }`.
2. Send `setFlagged(add, true)` in batches of at most `maxBatch`. One call flags any number of addresses.
   - **Send it through a private relay, never the public mempool.** A target who sees the flag coming can withdraw first (T-12). The provider is Q2.
   - Wait for the receipt before step 3.
3. **Dropped addresses.** If an address this task flagged is no longer in `F`, alert `defcon3`. This happens when OFAC delists it (as with Tornado Cash in 2025) or ops remove it from `M`. Leave the flag in place; the msig decides (Q4).

### Step 3: exclude and reinstate (for each live auction)

A **live auction** is one in phase `Deposit` or `Fulfillment`. The live auctions and their depositors come from the subgraph (`Indexer` §7.1).

**Skip the auction** (log only) unless the flagger has powers on it. These are the contract's own conditions, and rechecking them avoids reverted transactions:
- it points at one of our lists;
- compliance isn't disabled;
- it isn't in rescue mode;
- it's before `fulfillmentEnd`.

1. **Exclude** each account that is flagged and has `deposits(account) > 0`, read on-chain. Call `exclude(account)`.
   - This moves the deposit out of the fill. The account gets it back once its flag is cleared.
   - The account can't withdraw once flagged, so this transaction can be public.
   - By default the task excludes in both Deposit and Fulfillment (Q5).
2. **Cut-off.** Within `excludeCutoffSecs` of `fulfillmentEnd`, don't send `exclude`, because it reverts from `fulfillmentEnd`. Alert `defcon3` with the accounts not excluded instead.
3. **Reinstate,** during Deposit only, each account with `excluded(account) > 0` that is no longer flagged. Call `reinstate(account)`. This covers accounts the msig unflagged.
4. **After Fulfillment, do nothing.** A flagged bidder's claim reverts by itself, and its funds stay in the auction.

### Guards

| Condition | What the task does |
|---|---|
| The subgraph lags chain time by more than `maxSubgraphLagSecs` | Skip step 3 and alert `defcon3`. Steps 1 and 2 don't need the subgraph, so they still run |
| `isFlagged` reverts on a list (T-14) | Skip that list and alert `defcon3`, naming the auctions on it. Those auctions are halted until the msig repoints them or the rescuer disables compliance |
| Our key is no longer a flagger on a list | Skip that list and alert `defcon3`. This is what the msig removing a rogue flagger looks like |
| Gas above `maxGasPrice` | Skip the run, as in `spice-auction-burn-and-notify.ts`. **Except** for `setFlagged` while any auction on that list is in Deposit, since a delayed flag lets the target withdraw |
| Every transaction | `defcon5` with the explorer link on success, `defcon3` on failure |

---

## Task 2: `fpa-watch` (alerts only)

This task reads events from a last-processed block kept in KV, and alerts once per event or state change, not on every run.

| # | Alert when | Level | Who acts, and why |
|---|---|---|---|
| W1 | `AuctionCreated` with a `funder`, `proceedsRecipient` or `complianceCheck` not in the expected sets | defcon3, rescuer tagged | A hijacked msig may have created a rogue auction. The rescuer must turn on rescue mode and `cancel` before `depositEnd` (T-8) |
| W2 | Any `AuctionCreated` | defcon5 | A record for the team, and a prompt to authorise TGLD (W3) |
| W3 | A TGLD auction that isn't `TempleGold.authorized` within `tgldAuthLeadSecs` of `depositStart`, or is de-authorised while it still owes TGLD | defcon3 | The msig must authorise it. Without that, every TGLD transfer reverts and claims are stranded (T-7, T-19) |
| W4 | `NewExecutorProposed` on the factory, any auction or any `ComplianceCheck` | defcon3 | It may be a hijacked msig taking the role. There are 2 days to cancel the proposal (rescue mode) or overwrite it (the Safe's honest owners) (T-2, D11) |
| W5 | `NewRescuerProposed` on the factory or any auction | defcon3 | The handover has no delay, so a human must confirm it's expected (D3) |
| W6 | `ImplementationProposed`, or a proposal left pending longer than `staleProposalSecs` | defcon3 | A breached rescuer could accept a stale proposal (Operational risks 3) |
| W7 | `FlaggerSet` on any list | defcon3 | A new flagger can exclude bidders in every auction on that list (Operational risks 4) |
| W8 | `RescueModeSet`, `PausedSet`, `ComplianceCheckSet` or `ComplianceCheckDisabled` | defcon3 | An incident state, or a change to which list screens the auction |
| W9 | A paused auction within `pauseDeadlineWarnSecs` of `depositEnd` or `fulfillmentEnd` | defcon3 | A pause across `depositEnd` removes withdrawals. A pause across `fulfillmentEnd` settles at the current funding and removes `cancel` (Operational risks 2) |
| W10 | Subgraph unhealthy: indexing errors, lag, an unsupported auction or implementation, or `settlementMismatch` (`Indexer` §9.3) | defcon3 | The dapp and task 1 both depend on the subgraph |

## Task 3: signer balance

Add `fpa_flagger_signer` to the existing `check-accounts-balance` task (`src/tasks/check-signer-balance.ts`).

---

## Config

Contract addresses go in `src/config/contract_addresses/*`; variables go in `src/config/variables.ts`.

| Key | Kind | Used by |
|---|---|---|
| `fixedPriceAuctionFactory` | address | Task 1, W1–W6 |
| `complianceChecks` | address[] | Task 1, W1, W4, W7 |
| `templeGold` | address (already present) | W3 |
| `fpaSubgraphUrl` | string | Task 1, W10 |
| `fpa_flagger_signer` | signer id | Tasks 1 and 3 |
| `fpa_manual_flags` | string, comma-separated addresses | Task 1 |
| `expectedFunders`, `expectedProceedsRecipients` | address[] | W1 |
| `sdnHistoryUrl`, `sdnListUrl` | strings, defaulting to the URLs above | Task 1 |
| `minSdnCount`, `maxSdnDrop`, `sdnStaleAlertSecs`, `maxBatch`, `maxGasPrice`, `maxSubgraphLagSecs`, `excludeCutoffSecs`, `tgldAuthLeadSecs`, `staleProposalSecs`, `pauseDeadlineWarnSecs` | numbers, values for ops to choose | Tasks 1 and 2 |
| Private relay endpoint | per Q2 | Task 1 |

**ABIs to install** with `src/scripts/install-abis.sh` from the contracts branch: `IFixedPriceAuction`, `IFixedPriceAuctionFactory`, `IComplianceCheck`, `IExecutorAccess`, `IRescuableAccess`.

## Build checklist

Each step is done when `yarn build` passes in `apps/automation/automation-v2`.

1. Install the ABIs and add the config.
2. Add an FPA subgraph client, reusing `subgraphRequest` from `src/tlc/subgraph/subgraph-request.ts`.
3. Implement task 1 once Q2 is answered.
4. Implement task 2.
5. Register both in `src/main.ts` with `runner.addPeriodicTask`, and add the flagger key to `check-accounts-balance`.
6. Add a local-test webhook per task in `main-localtest/mainnet.ts`, as the README describes.

---

## Decisions needed

| # | Question | Default if unanswered |
|---|---|---|
| **Q2** | **Which private relay sends the flags (Flashbots Protect, MEV-Blocker, a builder RPC)? Does Overlord's transaction manager support it?** | **None: this blocks task 1** |
| Q4 | Should the bot ever unflag? In particular, should removing an address from `fpa_manual_flags` unflag it? | Never unflags; the msig unflags. The bot then reinstates automatically during Deposit |
| Q5 | Should the bot exclude during Fulfillment, or only during Deposit? A Fulfillment exclusion can't be undone, and it moves a partial fill to the other bidders (T-5) | Both phases |
| Q6 | Should W8 and W10 run here or in Goldsky's own alerts? | Here |
| Q7 | Who gets the defcon3 alerts? Do W1 and W4 need paging rather than Discord? | The existing treasury-ops tag |
| Q8 | One flagger key for all lists, or one per list? | One key |

## Optional extras (no source requires these; accept or drop)

| # | Task | What it would do |
|---|---|---|
| C1 | `fpa-claim-treasury` | Once an auction is final and unpaused, call the permissionless `claimTreasury()`, which pays the proceeds and the unused funding. It's the equivalent of Spice's `burnAndNotify` task |
| C2 | TGLD burn reminder | After `TreasuryClaimed` on a TGLD-bid auction, alert until the `proceedsRecipient` burns the TGLD. Nothing enforces the burn (`Model` decision 11) |
| C3 | Funding reminder | Alert when an auction in Fulfillment is underfunded and near `fulfillmentEnd` |
| C4 | Public Discord notices | Post auction opened, deposits closed and settled, like the TGLD auction sidebar bot |
| C5 | `emitSettlement` | Not needed: the indexer computes the settlement itself |

---

## Appendix A. Already decided

| Decision | Source |
|---|---|
| The flagger is the Overlord bot | `Threat` D10 |
| Flags go through a private relay, and known addresses are flagged before `depositStart` | `Threat` T-12 |
| The bot excludes and reinstates without the msig, but can't pause | Operator, 2026-10-29; `Model` decision 5 |
| The list exists to stop sanctioned wallets buying or selling through the auctions | `PO` "Compliance checks" |
| Flag sources: the OFAC SDN list plus `fpa_manual_flags` | Operator, 2026-10-30 |
| Task 1 runs once per minute | Operator, 2026-10-30 |
| Out of scope: msig and rescuer actions (Safes); demand and balance checks (the dashboard); indexer behaviour (`Indexer`) | `Model` "Who can call what", "Demand rules" |

## Appendix B. What the contracts allow the flagger

| Call | Allowed when | Reverts when | Source |
|---|---|---|---|
| `ComplianceCheck.setFlagged(accounts[], value)` | Any time, by the executor or a flagger | Caller isn't either | `CC.sol` L30-36 |
| `auction.exclude(account)` | Deposit or Fulfillment, even while paused | Flagger not active, wrong phase, account not flagged, or no deposit | `FPA.sol` L156-170 |
| `auction.reinstate(account)` | Deposit only, even while paused | Account still flagged, nothing excluded, or overflow | `FPA.sol` L173-188 |

- **Active flagger:** `!inRescueMode && !complianceDisabled && list.isFlagger(caller)` on that auction's current list (`FPA.sol` L537-539).
- **Batching:**
  - Any number of flags is one transaction, and any number of unflags is another, because `value` applies to the whole array.
  - `exclude` and `reinstate` take one account per transaction per auction.
- **Effect of a flag:** `deposit`, `withdrawDeposit`, `claim` and `withdrawExcluded` revert for the account, and its funds stay put (`FPA.sol` L120, L138, L265).
- **Can't be undone:** an exclusion after `depositEnd`. Any `exclude` from `fulfillmentEnd` on reverts (`Threat` Operational risks 7, 13).
- **Fund movements:**
  - An excluded deposit is refunded through `withdrawExcluded` once the flag clears.
  - Excluding some bidders during Fulfillment moves their share of a partial fill to the others. That is accepted, because flaggers are trusted (`Threat` T-5).

## Appendix C. Sources

| Tag | Where |
|---|---|
| `FPA.sol`, `IFPA.sol`, `CC.sol` | `protocol/contracts/templegold/FixedPriceAuction.sol`, `interfaces/templegold/IFixedPriceAuction.sol` and `templegold/ComplianceCheck.sol` on `fpa-frozen-inputs`. Line numbers match commit `9239f7da` |
| `Model` | `protocol/contracts/templegold/docs/fpa-simplified-model.md` on `fpa-frozen-inputs` |
| `Threat`, T-*n*, D*n*, Operational risks | `protocol/contracts/templegold/docs/threat-analysis-fpa-simplified.md` on `fpa-frozen-inputs` |
| `PO` | `spec/product-owner-notes.md` |
| `Indexer` | `spec/indexer-implementation-spec.md` on `claude/granary-auctions-prototype-f26d20` |
| OFAC endpoints | [SLS SDN downloads](https://sanctionslist.ofac.treas.gov/Home/static/sdn.html), [publication history](https://sanctionslistservice.ofac.treas.gov/changes/history/2026), and the [0xB10C extractor](https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses) for the XML layout |

Alert levels follow `src/utils/discord.ts`: `defcon3` means a human must look, and `defcon5` is a success notice.
