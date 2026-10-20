pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { FixedPriceAuction } from "contracts/templegold/FixedPriceAuction.sol";
import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { PRBMath_MulDiv_Overflow } from "@prb/math/src/Common.sol";
import { FixedPriceAuctionTestBase } from "test/forge/unit/templegold/FixedPriceAuction.t.sol";

contract FixedPriceAuctionFuzzTest is FixedPriceAuctionTestBase {
    using TempleMath for uint256;

    uint256 internal constant STEPS = 40;
    address[3] internal actors;

    function _assertLiabilitiesHeld() internal view {
        assertEq(tgld.balanceOf(address(auction)), auction.bidOwed(), "bid balance != bidOwed");
        assertEq(usds.balanceOf(address(auction)), auction.fillOwed(), "fill balance != fillOwed");
    }

    function _step(uint256 r) internal {
        address actor = actors[(r >> 8) % 3];
        uint256 amount = _bound(r >> 16, 1, 1e24);
        // Deposits get 3 of 12 slots, so most runs build up deposits before the window closes.
        uint256 op = r % 12;
        if (op >= 10) op = 2;

        if (op < 2) {
            vm.warp(block.timestamp + _bound(r >> 128, 1 hours, 2 days));
        } else if (op == 2) {
            tgld.mint(actor, amount);
            vm.prank(actor);
            tgld.approve(address(auction), amount);
            vm.prank(actor);
            try auction.deposit(amount) { } catch { }
        } else if (op == 3) {
            uint256 held = auction.deposits(actor);
            if (held == 0) return;
            vm.prank(actor);
            try auction.withdrawDeposit(_bound(amount, 1, held)) { } catch { }
        } else if (op == 4) {
            usds.mint(funder, amount);
            vm.prank(funder);
            usds.approve(address(auction), amount);
            vm.prank(funder);
            try auction.fund(amount) { } catch { }
        } else if (op == 5) {
            vm.prank(funder);
            try auction.withdrawExcess(amount) { } catch { }
        } else if (op == 6) {
            vm.prank(actor);
            try auction.claim() { } catch { }
        } else if (op == 7) {
            try auction.claimTreasury() { } catch { }
        } else if (op == 8) {
            vm.prank(executor);
            try auction.endFulfillment() { } catch { }
        } else if ((r >> 200) % 4 == 0) {
            vm.prank(executor);
            try auction.cancel() { } catch { }
        }
    }

    function test_fuzz_liabilitiesAlwaysHeld(uint256 seed, uint256 price) public {
        // Price from 1e-6 to 1000 fill per bid, so fills neither round to zero nor overflow.
        price = _bound(price, 1e12, 1e21);
        auction = _create(_config(address(tgld), address(usds), price, 0));
        actors = [alice, bob, makeAddr("carol")];
        _toDeposit(auction);
        // Random steps can close the deposit window before any deposit lands, so seed one.
        _deposit(auction, alice, _bound(seed, 1, 1e24));

        for (uint256 i; i < STEPS; ++i) {
            _step(uint256(keccak256(abi.encode(seed, i))));
            _assertLiabilitiesHeld();
        }

        // Finish: everyone still owed can claim.
        if (block.timestamp < auction.getTiming().fulfillmentEnd) _toEnd(auction);
        for (uint256 i; i < actors.length; ++i) {
            if (auction.deposits(actors[i]) > 0 && !auction.claimed(actors[i])) {
                vm.prank(actors[i]);
                auction.claim();
            }
        }
        if (!auction.treasuryClaimed()) auction.claimTreasury();
        _assertLiabilitiesHeld();

        // Only rounding dust stays: under one wei per claimant per token, and none on a cancel.
        if (auction.phase() == IFixedPriceAuction.Phase.Cancelled) {
            assertEq(auction.bidOwed(), 0);
            assertEq(auction.fillOwed(), 0);
        } else {
            assertLt(auction.bidOwed(), actors.length);
            assertLt(auction.fillOwed(), actors.length);
        }
    }

    struct Case {
        FakeERC20CustomDecimals bid;
        FakeERC20CustomDecimals fill;
        FixedPriceAuction a;
        uint256 price;
        uint256 denominator;
        uint256 funding;
        uint256 total;
        address[] accounts;
        uint256[] amounts;
    }

    function test_fuzz_settlementMaths(
        uint8 bidDecimals,
        uint8 fillDecimals,
        uint256 price,
        uint256 funding,
        uint256 bidders,
        uint256 seed
    ) public {
        _checkSettlement(
            uint8(_bound(bidDecimals, 0, 18)), uint8(_bound(fillDecimals, 0, 18)), price, funding, bidders, seed
        );
    }

    function test_fuzz_settlementMaths_bid6Fill18(uint256 price, uint256 funding, uint256 bidders, uint256 seed)
        public
    {
        _checkSettlement(6, 18, price, funding, bidders, seed);
    }

    function test_fuzz_settlementMaths_bid18Fill6(uint256 price, uint256 funding, uint256 bidders, uint256 seed)
        public
    {
        _checkSettlement(18, 6, price, funding, bidders, seed);
    }

    function test_fuzz_settlementMaths_bid6Fill6(uint256 price, uint256 funding, uint256 bidders, uint256 seed) public {
        _checkSettlement(6, 6, price, funding, bidders, seed);
    }

    function _checkSettlement(
        uint8 bidDecimals,
        uint8 fillDecimals,
        uint256 price,
        uint256 funding,
        uint256 bidders,
        uint256 seed
    ) internal {
        Case memory c;
        // Price from 1e-18 to 1e12 fill per bid: both ends of the zero-fill guard, and full fills.
        c.price = _bound(price, 1, 1e30);
        c.funding = _bound(funding, 0, 1e40);
        bidders = _bound(bidders, 1, 5);

        c.bid = new FakeERC20CustomDecimals("Bid", "BID", address(0), 0, bidDecimals);
        c.fill = new FakeERC20CustomDecimals("Fill", "FILL", address(0), 0, fillDecimals);
        c.a = _create(_config(address(c.bid), address(c.fill), c.price, 0));
        c.denominator = c.a.priceDenominator();

        _toDeposit(c.a);
        c.accounts = new address[](bidders);
        c.amounts = new uint256[](bidders);
        for (uint256 i; i < bidders; ++i) {
            c.accounts[i] = address(uint160(0x1000 + i));
            // At least 1 wei, at most 1e30 wei, so totals stay far from overflow at the top price.
            c.amounts[i] = _bound(uint256(keccak256(abi.encode(seed, i))), 1, 1e30);
            _deposit(c.a, c.accounts[i], c.amounts[i]);
        }
        c.total = c.a.totalDeposits();
        // A quarter of runs fund exactly the rounded-up requirement, the full-fill boundary.
        if (funding % 4 == 0) c.funding = c.total.mulDivRound(c.price, c.denominator, true);

        _toFulfillment(c.a);
        if (c.funding > 0) _fund(c.a, c.funding);
        _toEnd(c.a);
        IFixedPriceAuction.Settlement memory s = c.a.previewSettlement();
        _checkSplit(c, s);
        _checkClaims(c, s);
    }

    function _checkSplit(Case memory c, IFixedPriceAuction.Settlement memory s) internal pure {
        // The split adds up.
        assertLe(s.filledDeposits, c.total, "filled > total");
        assertEq(s.userRefund, c.total - s.filledDeposits, "userRefund");
        assertEq(s.funderRefund, c.funding - s.userFunding, "funderRefund");
        // Bidders never get more than their filled deposits buy.
        assertLe(
            s.userFunding, s.filledDeposits.mulDivRound(c.price, c.denominator, false), "userFunding > filled value"
        );
        // Full funding fills everything, unless every deposit together buys under one fill wei. Then the
        // zero-fill guard wins and nothing fills.
        if (c.funding >= c.total.mulDivRound(c.price, c.denominator, true)) {
            if (c.total.mulDivRound(c.price, c.denominator, false) == 0) {
                assertEq(s.filledDeposits, 0, "dust deposits filled");
            } else {
                assertEq(s.filledDeposits, c.total, "full funding didn't fill everything");
            }
        }
        // No fill tokens, no bid tokens taken.
        if (s.userFunding == 0) assertEq(s.filledDeposits, 0, "bid tokens filled for no fill tokens");
    }

    function _checkClaims(Case memory c, IFixedPriceAuction.Settlement memory s) internal {
        uint256 sumFill;
        uint256 sumRefund;
        for (uint256 i; i < c.accounts.length; ++i) {
            vm.prank(c.accounts[i]);
            c.a.claim();
            uint256 got = c.fill.balanceOf(c.accounts[i]);
            uint256 refund = c.bid.balanceOf(c.accounts[i]);
            assertLe(refund, c.amounts[i], "refund > deposit");
            assertLe(got, (c.amounts[i] - refund).mulDivRound(c.price, c.denominator, false), "fill > paid x price");
            // Each share is the exact pro-rata share of its pool rounded down: within one wei of it and never above.
            // OpenZeppelin's 512-bit mulDiv, so the check doesn't share the contract's maths library.
            assertEq(got, Math.mulDiv(c.amounts[i], s.userFunding, c.total), "fill share != pro-rata share");
            assertEq(refund, Math.mulDiv(c.amounts[i], s.userRefund, c.total), "refund share != pro-rata share");
            sumFill += got;
            sumRefund += refund;
        }
        c.a.claimTreasury();

        // Pro-rata shares never exceed the pools they're cut from, and the treasury gets its legs exactly.
        assertLe(sumFill, s.userFunding, "user fill shares > userFunding");
        assertLe(sumRefund, s.userRefund, "user refund shares > userRefund");
        assertEq(c.bid.balanceOf(proceedsRecipient), s.filledDeposits, "proceeds");
        assertEq(c.fill.balanceOf(funder), s.funderRefund, "funder refund");

        // The dust left is under one wei per claimant, per token, and still fully held.
        assertLt(c.a.bidOwed(), c.accounts.length, "bid dust");
        assertLt(c.a.fillOwed(), c.accounts.length, "fill dust");
        assertEq(c.bid.balanceOf(address(c.a)), c.a.bidOwed(), "bid held");
        assertEq(c.fill.balanceOf(address(c.a)), c.a.fillOwed(), "fill held");
    }

    /// @dev Deposits sit just under the bound where requiredFunding overflows uint256, so settlement and claims run
    /// with funding above 2**255.
    function test_settlement_atOverflowBound(bool underfund) public {
        uint256 price = 2 ** 200;
        FixedPriceAuction a = _create(_config(address(tgld), address(usds), price, 0));
        _toDeposit(a);
        _deposit(a, alice, 7e34);
        _deposit(a, bob, 1);
        uint256 required = a.totalDeposits().mulDivRound(price, 1e18, true);
        assertGt(required, 2 ** 255);

        // One more meaningful deposit trips the overflow guard.
        uint256 extra = 3e33;
        tgld.mint(bob, extra);
        vm.startPrank(bob);
        tgld.approve(address(a), extra);
        vm.expectRevert(
            abi.encodeWithSelector(PRBMath_MulDiv_Overflow.selector, a.totalDeposits() + extra, price, 1e18)
        );
        a.deposit(extra);
        vm.stopPrank();

        _toFulfillment(a);
        _fund(a, underfund ? required - 1 : required + 2 ** 250);
        _toEnd(a);
        vm.prank(alice);
        a.claim();
        vm.prank(bob);
        a.claim();
        a.claimTreasury();
        assertEq(tgld.balanceOf(address(a)), a.bidOwed());
        assertEq(usds.balanceOf(address(a)), a.fillOwed());
        assertLt(a.bidOwed(), 2);
        assertLt(a.fillOwed(), 2);
    }
}
