# 🔐 Security Review — temple-frozen-audit-fixes

## Decisions

| # | Item | Decision | Comment |
| --- | --- | --- | --- |
| 1 | One blocked treasury transfer locks both treasury payouts | Not fixed: accepted | Very low risk, and not worth the extra complexity. If the risk matters for an auction, we will not use a token that can block an address (for example DAI rather than USDC). Both payouts locked together is better than one paid and one locked. |
| 2 | A block on one token stops the bidder's other claim payout | Not fixed: accepted | As finding 1. |
| Lead | Each bidder can lose up to one fill unit's price to rounding | Closed: no change | The loss is dust: at most one base unit of each token per bidder. The 6-decimal minimum keeps that at most 1e-6 of a token, and the `MIN_TOKEN_DECIMALS` comment is accurate. |

---

## Scope

|  |  |
| --- | --- |
| **Commit** | `fpa-frozen-inputs` @ `b1f98e45` |
| **Date** | 2026-10-28 |
| **Mode** | filename |
| **Files reviewed** | `protocol/contracts/templegold/FixedPriceAuction.sol` · `protocol/contracts/templegold/FixedPriceAuctionFactory.sol` · `protocol/contracts/templegold/ComplianceCheck.sol`<br>`protocol/contracts/templegold/WishingWell.sol` · `protocol/contracts/templegold/access/ExecutorAccess.sol` · `protocol/contracts/templegold/access/RescuableAccess.sol`<br>`protocol/contracts/interfaces/templegold/IFixedPriceAuction.sol` · `protocol/contracts/interfaces/templegold/IFixedPriceAuctionFactory.sol` · `protocol/contracts/interfaces/templegold/IComplianceCheck.sol`<br>`protocol/contracts/interfaces/templegold/IWishingWell.sol` · `protocol/contracts/interfaces/templegold/IExecutorAccess.sol` · `protocol/contracts/interfaces/templegold/IRescuableAccess.sol` |
| **Confidence threshold (1-100)** | 75 |
| **Passes** | 5 |
| **Memory** | 0 records before this scan · 3 after · `b1f98e45` |

---

## Findings

[75] **1. One blocked treasury transfer locks both treasury payouts**

`FixedPriceAuction.claimTreasury` · Confidence: 75 · seen in 5/5 runs · NEW

**Description**
`claimTreasury` pays `proceedsRecipient` and `funder` in one call, so a token blacklist on one fixed address makes the other address lose its payout permanently.

**Fix**

```diff
-    bool public treasuryClaimed;
+    bool public proceedsClaimed;
+    bool public funderRefundClaimed;
-    function claimTreasury() external override {
+    function claimProceeds() external override {
         AuctionConfig memory config = _config();
         _requireClaimNotPaused(config);
         _requireFinal(config);
-        if (treasuryClaimed) revert AlreadyClaimed();
+        if (proceedsClaimed) revert AlreadyClaimed();
         _emitClockSettlementIfDue(config);
-        TreasuryClaim memory treasuryClaim = _treasuryClaimable(config);
-        treasuryClaimed = true;
-        bidPaid += treasuryClaim.proceeds;
-        fillPaid += treasuryClaim.funderRefund;
-        ...
-        if (treasuryClaim.funderRefund > 0) {
-            IERC20(config.fillToken).safeTransfer(config.funder, treasuryClaim.funderRefund);
-        }
+        uint256 proceeds = _settlement(config.price).filledBids;
+        proceedsClaimed = true;
+        bidPaid += proceeds;
+        if (proceeds > 0) IERC20(config.bidToken).safeTransfer(config.proceedsRecipient, proceeds);
     }
+    // claimFunderRefund(): the same shape, with funderRefundClaimed, fillPaid and config.funder
```

---

[75] **2. A block on one token stops the bidder's other claim payout**

`FixedPriceAuction.claim` · Confidence: 75 · seen in 3/5 runs · NEW

**Description**
`claim` pays the refund and the fill to `msg.sender` in one call, so a token issuer that blocks the bidder on one token also locks the other token.

**Fix**

```diff
-    function claim() external override notFlagged {
+    function claim(address to) external override notFlagged {
+        if (to == address(0)) revert CommonEventsAndErrors.InvalidAddress();
         ...
-        emit UserClaimed(msg.sender, userClaim.fill, userClaim.refund);
+        emit UserClaimed(msg.sender, userClaim.fill, userClaim.refund);
         if (userClaim.refund > 0) {
-            IERC20(config.bidToken).safeTransfer(msg.sender, userClaim.refund);
+            IERC20(config.bidToken).safeTransfer(to, userClaim.refund);
         }
         if (userClaim.fill > 0) {
-            IERC20(config.fillToken).safeTransfer(msg.sender, userClaim.fill);
+            IERC20(config.fillToken).safeTransfer(to, userClaim.fill);
         }
```

---

Findings List

| # | Confidence | Title |
|---|---|---|
| 1 | [75] | One blocked treasury transfer locks both treasury payouts |
| 2 | [75] | A block on one token stops the bidder's other claim payout |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass. These are not false positives — they are high-signal leads for manual review. Not scored._

- **Each bidder can lose up to one fill unit's price to rounding** — `FixedPriceAuction._claimable` · seen in 5/5 runs · NEW — Code smells: `amount.mulDivRound(s.userFill, totalDeposits, false)` per bidder; the `MIN_TOKEN_DECIMALS` comment says decimals bound the loss, but `priceDenominator / price` bounds it. — The executor can set a price where one fill base unit costs many bid units, so each bidder loses up to that many bid units. We did not find a planned token pair where this is more than dust.

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
