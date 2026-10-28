# 🔐 Security Review — protocol

## Branch note: fpa-frozen-inputs

This report is from a scan of `fpa-simplified` at `860ea95d` (2026-10-22), not of this branch.

| `fpa-simplified` | `fpa-frozen-inputs` |
| --- | --- |
| `AuctionFactory` | `FixedPriceAuctionFactory` |
| `setBlocked` / `isBlocked` / `BlockedAccount` | `setFlagged` / `isFlagged` / `FlaggedAccount` |
| a `setBlocked` grantee (`setExplicitAccess`) | a flagger (`setFlagger`) |
| `endFulfillment` | `settleEarly` |
| `previewSettlement` | `settlement` |
| `fillOwed` | `funding` |
| `userFunding` | `userFill` |
| `filledDeposits` | `filledBids` |
| phase `Settled` | phase `Settlement` |

Every finding also applied to `fpa-frozen-inputs` at `ef69ca8c`: the code each one touches differs only by these names. The PoCs for findings 1, 3 and 6 and for the lead were re-run on this branch and passed.

| # | Finding | Fixed on this branch by | Note |
| --- | --- | --- | --- |
| 1 | An EIP-7702 EOA implementation lets its key holder rewrite every auction | Not fixed: accepted as operational risk | Any pointer can be a proxy or a delegated account whose code changes after review, and no on-chain check can rule that out. The rescuer's review before it accepts an implementation is the control. The factory still rejects an implementation with no code. |
| 2 | A hijacked msig proposes and accepts a new executor in one transaction | `fix: make a proposed executor wait a day before it can accept` | On the factory and auctions rescue mode can now cancel the proposal. On `ComplianceCheck` the msig can overwrite a proposal before the delay ends (T-2). The delay is two days. |
| 3 | A hijacked msig repoints the list, so rescue mode cannot stop exclude | `fix: lock compliance-list grants out of exclude and reinstate in rescue mode` | |
| 4 | Settlement charges bidders for the funding, not the rounded-down fill | `fix: charge bidders only for the whole fill-token wei they get` | Option A of the report's fix. Option B was not used. |
| 5 | A small bidder can pay bid tokens and get zero fill | `fix: require 6 to 18 decimals for both auction tokens` | Option A (decimals), for both tokens. |
| 6 | Rescue mode does not stop a list grantee from calling exclude | `fix: lock compliance-list grants out of exclude and reinstate in rescue mode` | |
| 7 | Exclusion in Fulfillment moves a partial fill to the other bidders | Not fixed: accepted, flaggers are trusted | The msig picks and removes flaggers, and trusts them as it trusts its own signers, so a flagger can still exclude in Fulfillment (T-5). |
| 8 | A grantee gives a colluding bidder a free exit during Fulfillment | Not fixed: accepted, flaggers are trusted | As finding 7. A bidder that gets itself flagged in Fulfillment can still get a full refund once it is excluded and the flag is cleared (T-5). |
| Lead | Initialize accepts a deposit window of one second | `feat: require a day's notice and a day-long deposit window` | Decision D1: `MIN_DEPOSIT_START_DELAY` and `MIN_DEPOSIT_WINDOW`, one day each. |

Each fix commit applies alone on the report commit.

Not scanned: the scan never saw code that exists only on this branch. That is the settlement as a view over the frozen `totalDeposits` and `funding`; `emitSettlement` and the clock-settlement `AuctionSettled` event; `liabilities()` with the `totalExcluded`, `bidPaid` and `fillPaid` counters; and `recoverToken` sending only the balance above `liabilities()`. An audit of this branch should cover these, and treat the findings above as known, with the status the table gives: check the fixes, and the open or narrowed items, rather than re-report them.

The finding sections below are the original report, unchanged, so their code, line references and Fix diffs use `fpa-simplified`'s names.

---

## Scope

|  |  |
| --- | --- |
| **Mode** | filename |
| **Files reviewed** | `contracts/templegold/AuctionFactory.sol` · `contracts/templegold/ComplianceCheck.sol` · `contracts/templegold/FixedPriceAuction.sol`<br>`contracts/templegold/WishingWell.sol` · `contracts/templegold/access/ExecutorAccess.sol` · `contracts/templegold/access/RescuableAccess.sol` |
| **Confidence threshold (1-100)** | 75 |
| **Passes** | 5 |
| **Memory** | 0 records before this scan · 9 after · `860ea95d` |

---

## Findings

[80] **1. An EIP-7702 EOA implementation lets its key holder rewrite every auction**

`AuctionFactory.acceptImplementation` · Confidence: 80 · seen in 3/5 runs · NEW

**Severity:** Medium · **Likelihood:** Low — a hijacked msig must propose an EOA and the rescuer must accept it · **Impact:** High — the key holder takes the deposits of every auction cloned from it, existing and new

**Description**
A delegated EOA has 23 bytes of code and passes the check, so after acceptance its key holder re-delegates and takes the deposits of every clone.

**Fix**

```diff
+    /// @dev EIP-7702 delegated EOAs: their code is 0xef0100 ++ target and can change after review.
+    function _requireFixedCode(address impl) private view {
+        bytes memory code = impl.code;
+        if (code.length == 0 || (code.length == 23 && bytes3(code) == 0xef0100)) {
+            revert CommonEventsAndErrors.InvalidAddress();
+        }
+    }
 ...
     function proposeImplementation(address newImplementation) external override onlyElevatedAccess {
-        if (newImplementation.code.length == 0) revert CommonEventsAndErrors.InvalidAddress();
+        _requireFixedCode(newImplementation);
 ...
         if (newImplementation == address(0) || newImplementation != proposedImplementation) {
             revert CommonEventsAndErrors.InvalidAddress();
         }
+        _requireFixedCode(newImplementation);
```

---

[75] **2. A hijacked msig proposes and accepts a new executor in one transaction**

`ExecutorAccess.acceptExecutor` · Confidence: 75 · seen in 2/5 runs · NEW

**Severity:** Medium · **Likelihood:** Low — needs a hijacked msig · **Impact:** High — the thief keeps the executor role on the factory, auctions and ComplianceCheck for good

**Description**
A hijacked msig batches proposeNewExecutor and acceptExecutor, so rescue mode finds no proposal to cancel and the thief keeps the executor role.

**Fix**

```diff
     function proposeNewExecutor(address account) external override onlyElevatedAccess {
         if (account == address(0)) revert CommonEventsAndErrors.InvalidAddress();
         emit NewExecutorProposed(executor, proposedExecutor, account);
         proposedExecutor = account;
+        proposedExecutorAt = block.timestamp;
     }
 ...
     function _acceptExecutor() internal {
         if (msg.sender != proposedExecutor) revert CommonEventsAndErrors.InvalidAccess();
+        if (block.timestamp < proposedExecutorAt + EXECUTOR_DELAY) revert CommonEventsAndErrors.InvalidAccess();
```

---

[80] **3. A hijacked msig repoints the list, so rescue mode cannot stop exclude**

`FixedPriceAuction.exclude` · Confidence: 80 · seen in 5/5 runs · NEW

**Severity:** Low · **Likelihood:** Low — a hijacked msig must repoint the list before the rescuer turns rescue mode on · **Impact:** Medium — bidders lose their fill and claims stay blocked until compliance is disabled; deposits stay refundable

**Description**
A hijacked msig points the auction at its own list before rescue mode, so any address then excludes bidders and the rescuer cannot point it back.

**Fix**

```diff
     function _onlyExclusionAdmin() private view {
         if (_isElevatedAccess(msg.sender, msg.sig)) return;
+        if (inRescueMode) revert CommonEventsAndErrors.InvalidAccess();
         bytes4 selector = IComplianceCheck.setBlocked.selector;
```

---

[75] **4. Settlement charges bidders for the funding, not the rounded-down fill**

`FixedPriceAuction._calculateSettlement` · Confidence: 75 · seen in 5/5 runs · NEW

**Severity:** Low · **Likelihood:** Low — needs a fill token with 0 to 2 decimals; TGLD, USDS and USDC have 6 or more · **Impact:** Medium — bidders lose up to one fill-token unit per auction; dust at 6 or more decimals

**Description**
Both branches take bid tokens for the funding but pay floor(filled*price/d) fill, so with a 0-decimal fill token bidders lose up to one fill unit.

**Fix (Option A — restrict)**:

```diff
         uint256 userFunding = filled.mulDivRound(price, denominator, false);
+        // Take only the bid tokens that the rounded-down fill pays for.
+        uint256 paid = userFunding.mulDivRound(denominator, price, true);
+        if (paid < filled) filled = paid;
         // A fill too small to buy one fill-token wei takes no bid tokens.
         if (userFunding == 0) filled = 0;
```

**Fix (Option B — allow-and-handle)**:

```diff
-        uint256 userFunding = filled.mulDivRound(price, denominator, false);
+        uint256 userFunding = filled == totalDeposits
+            ? _requiredFunding(totalDeposits, price)
+            : filled.mulDivRound(price, denominator, false);
```

---

[75] **5. A small bidder can pay bid tokens and get zero fill**

`FixedPriceAuction._claimable` · Confidence: 75 · seen in 5/5 runs · NEW

**Severity:** Low · **Likelihood:** Low — needs a bid or fill token with 0 to 2 decimals, or a minDeposit of zero with tiny bids · **Impact:** Medium — each small bidder loses up to one token unit

**Description**
Each bidder's fill and refund round down on their own, so with a 0-decimal fill or bid token a bidder can lose up to one whole token unit.

**Fix (Option A — validate decimals)**:

```diff
-        if (bidDecimals > MAX_TOKEN_DECIMALS || fillDecimals > MAX_TOKEN_DECIMALS) {
+        if (
+            bidDecimals > MAX_TOKEN_DECIMALS || fillDecimals > MAX_TOKEN_DECIMALS
+                || bidDecimals < MIN_TOKEN_DECIMALS || fillDecimals < MIN_TOKEN_DECIMALS
+        ) {
             revert CommonEventsAndErrors.InvalidParam();
         }
```

**Fix (Option B — validate minDeposit)**:

```diff
         priceDenominator = 10 ** (18 + uint256(bidDecimals) - fillDecimals);
+        if (config.minDeposit.mulDivRound(config.price, priceDenominator, false) == 0) {
+            revert CommonEventsAndErrors.InvalidParam();
+        }
```

---

[75] **6. Rescue mode does not stop a list grantee from calling exclude**

`FixedPriceAuction._onlyExclusionAdmin` · Confidence: 75 · seen in 5/5 runs · NEW

**Severity:** Low · **Likelihood:** Low — needs a hijacked msig or a rogue setBlocked grantee · **Impact:** Medium — bidders lose their fill in an auction the rescuer has locked; deposits stay refundable

**Description**
A hijacked msig grants itself setBlocked on ComplianceCheck, which has no rescue mode, so it still calls exclude and reinstate after the rescuer turns rescue mode on.

**Fix**

```diff
     function _onlyExclusionAdmin() private view {
         if (_isElevatedAccess(msg.sender, msg.sig)) return;
+        if (inRescueMode) revert CommonEventsAndErrors.InvalidAccess();
         bytes4 selector = IComplianceCheck.setBlocked.selector;
```

---

[75] **7. Exclusion in Fulfillment moves a partial fill to the other bidders**

`FixedPriceAuction.exclude` · Confidence: 75 · seen in 3/5 runs · NEW

**Severity:** Low · **Likelihood:** Low — needs a setBlocked grantee who colludes with a bidder in a partly funded auction · **Impact:** Medium — the colluder gets the excluded bidder's fill share; the excluded bidder gets a refund only

**Description**
A setBlocked grantee excludes Alice after funding is fixed, so a colluding Bob gets her share of a half funding, 400 fill tokens instead of 200.

**Fix**

```diff
     function exclude(address account) external override {
         _onlyExclusionAdmin();
         AuctionConfig memory config = _config();
-        Phase current = _phase(config);
-        if (current != Phase.Deposit && current != Phase.Fulfillment) revert InvalidPhase(Phase.Fulfillment, current);
+        _requirePhase(config, Phase.Deposit);
```

---

[75] **8. A grantee gives a colluding bidder a free exit during Fulfillment**

`FixedPriceAuction.exclude` · Confidence: 75 · seen in 5/5 runs · NEW

**Severity:** Low · **Likelihood:** Low — needs a setBlocked grantee who colludes with a bidder after the price moves · **Impact:** Medium — the treasury loses the sale to that bidder; other bidders keep their trade

**Description**
A setBlocked grantee blocks, excludes and unblocks an ally in Fulfillment, so the ally withdraws the full deposit while other bidders cannot leave.

**Fix**

```diff
     function exclude(address account) external override {
         _onlyExclusionAdmin();
         AuctionConfig memory config = _config();
-        Phase current = _phase(config);
-        if (current != Phase.Deposit && current != Phase.Fulfillment) revert InvalidPhase(Phase.Fulfillment, current);
+        _requirePhase(config, Phase.Deposit);
```

---

Findings List

| # | Severity | Confidence | Title |
|---|---|---|---|
| 1 | Medium | [80] | An EIP-7702 EOA implementation lets its key holder rewrite every auction |
| 2 | Medium | [75] | A hijacked msig proposes and accepts a new executor in one transaction |
| 3 | Low | [80] | A hijacked msig repoints the list, so rescue mode cannot stop exclude |
| 4 | Low | [75] | Settlement charges bidders for the funding, not the rounded-down fill |
| 5 | Low | [75] | A small bidder can pay bid tokens and get zero fill |
| 6 | Low | [75] | Rescue mode does not stop a list grantee from calling exclude |
| 7 | Low | [75] | Exclusion in Fulfillment moves a partial fill to the other bidders |
| 8 | Low | [75] | A grantee gives a colluding bidder a free exit during Fulfillment |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass. These are not false positives — they are high-signal leads for manual review. Not scored._

- **Initialize accepts a deposit window of one second** — `FixedPriceAuction.initialize` · seen in 2/5 runs · NEW — Severity: Medium · Likelihood: Low — needs a hijacked msig and victims who deposit into a short rogue auction without checking its terms · Impact: High — the thief takes every deposit in that auction — Code smells: only depositStart > block.timestamp and the time order are checked — A hijacked msig can settle a rogue auction before the rescuer can cancel it. We did not find a victim who deposits in so short a window (T-8, D1).

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
