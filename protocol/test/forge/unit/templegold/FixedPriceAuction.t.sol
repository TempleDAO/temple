pragma solidity ^0.8.21;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LibClone } from "solady/src/utils/LibClone.sol";
import { Vm } from "forge-std/Vm.sol";
import { TempleTest } from "test/forge/unit/TempleTest.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";
import { FakeBlocklistERC20 } from "test/forge/invariant/templegold/handlers/FakeBlocklistERC20.sol";

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { FixedPriceAuction } from "contracts/templegold/FixedPriceAuction.sol";
import { AuctionFactory } from "contracts/templegold/AuctionFactory.sol";
import { ComplianceCheck } from "contracts/templegold/ComplianceCheck.sol";
import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";
import { IRescuableAccess } from "contracts/interfaces/templegold/IRescuableAccess.sol";
import { PRBMath_MulDiv_Overflow } from "@prb/math/src/Common.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";

contract RevertingComplianceCheck {
    function isBlocked(address) external pure returns (bool) {
        revert("Compliance unavailable");
    }
}

/// @dev All the TempleGold constructor needs from a LayerZero endpoint, so real TGLD deploys without a fork.
contract LayerZeroEndpointStub {
    function setDelegate(address) external { }
}

contract FixedPriceAuctionTestBase is TempleTest {
    /// @dev 0.0466 USDS per TGLD
    uint256 internal constant PRICE = 0.0466e18;

    FakeERC20CustomDecimals internal tgld;
    FakeERC20CustomDecimals internal usds;
    ComplianceCheck internal compliance;
    FixedPriceAuction internal implementation;
    AuctionFactory internal factory;
    FixedPriceAuction internal auction;

    address internal funder = makeAddr("funder");
    address internal proceedsRecipient = makeAddr("proceedsRecipient");
    address internal blocker = makeAddr("blocker");

    function setUp() public virtual {
        vm.warp(1_000_000);
        tgld = new FakeERC20CustomDecimals("Temple Gold", "TGLD", address(0), 0, 18);
        usds = new FakeERC20CustomDecimals("USDS", "USDS", address(0), 0, 18);
        compliance = new ComplianceCheck(executor);
        implementation = new FixedPriceAuction();
        factory = new AuctionFactory(executor, rescuer, address(implementation));
        auction = _create(_config(address(tgld), address(usds), PRICE, 0));
    }

    function _config(address bidToken, address fillToken, uint256 price, uint256 minDeposit)
        internal
        view
        returns (IFixedPriceAuction.AuctionConfig memory)
    {
        uint64 start = uint64(block.timestamp + 1 days);
        return IFixedPriceAuction.AuctionConfig({
            bidToken: bidToken,
            fillToken: fillToken,
            price: price,
            depositStart: start,
            depositEnd: start + 5 days,
            fulfillmentEnd: start + 8 days,
            minDeposit: minDeposit,
            funder: funder,
            proceedsRecipient: proceedsRecipient,
            complianceCheck: address(compliance)
        });
    }

    function _create(IFixedPriceAuction.AuctionConfig memory config) internal returns (FixedPriceAuction) {
        vm.prank(executor);
        return FixedPriceAuction(factory.createAuction(abi.encode(config)));
    }

    /// @dev A clone of the implementation that nobody has initialized yet.
    function _clone(IFixedPriceAuction.AuctionConfig memory config) internal returns (FixedPriceAuction) {
        return FixedPriceAuction(LibClone.clone(address(implementation), abi.encode(config)));
    }

    function _toDeposit(FixedPriceAuction a) internal {
        vm.warp(a.getTiming().depositStart);
    }

    function _toFulfillment(FixedPriceAuction a) internal {
        vm.warp(a.getTiming().depositEnd);
    }

    function _toEnd(FixedPriceAuction a) internal {
        vm.warp(a.getTiming().fulfillmentEnd);
    }

    function _deposit(FixedPriceAuction a, address account, uint256 amount) internal {
        FakeERC20CustomDecimals token = FakeERC20CustomDecimals(a.getConfig().bidToken);
        token.mint(account, amount);
        vm.startPrank(account);
        token.approve(address(a), amount);
        a.deposit(amount);
        vm.stopPrank();
    }

    function _fund(FixedPriceAuction a, uint256 amount) internal {
        FakeERC20CustomDecimals token = FakeERC20CustomDecimals(a.getConfig().fillToken);
        token.mint(funder, amount);
        vm.startPrank(funder);
        token.approve(address(a), amount);
        a.fund(amount);
        vm.stopPrank();
    }

    function _setBlocked(address account, bool value) internal {
        address[] memory accounts = new address[](1);
        accounts[0] = account;
        vm.prank(executor);
        compliance.setBlocked(accounts, value);
    }

    /// @dev Rescue mode cancels a pending executor proposal, so a hijacked msig's proposee can never accept it.
    function _checkRescueModeCancelsExecutorProposal(IRescuableAccess target) internal {
        vm.prank(executor);
        target.proposeNewExecutor(alice);

        vm.expectEmit(address(target));
        emit IExecutorAccess.NewExecutorProposed(executor, alice, address(0));
        vm.prank(rescuer);
        target.setRescueMode(true);
        assertEq(target.proposedExecutor(), address(0));

        vm.prank(rescuer);
        target.setRescueMode(false);
        vm.prank(alice);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        target.acceptExecutor();
        assertEq(target.executor(), executor);
    }

    /// @dev Switching rescue mode off while it's already off leaves a pending proposal alone.
    function _checkRescueModeOffKeepsProposal(IRescuableAccess target) internal {
        vm.prank(executor);
        target.proposeNewExecutor(alice);
        vm.prank(rescuer);
        target.setRescueMode(false);
        assertEq(target.proposedExecutor(), alice);
    }

    /// @dev With nothing pending, switching rescue mode on emits only `RescueModeSet`.
    function _checkRescueModeOnEmitsOnlyRescueModeSet(IRescuableAccess target) internal {
        vm.recordLogs();
        vm.prank(rescuer);
        target.setRescueMode(true);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].topics[0], IRescuableAccess.RescueModeSet.selector);
    }

    /// @dev Alice 60mm and Bob 40mm TGLD, then the funder funds `funding` USDS.
    function _workedExample(uint256 funding) internal {
        _toDeposit(auction);
        _deposit(auction, alice, 60_000_000e18);
        _deposit(auction, bob, 40_000_000e18);
        _toFulfillment(auction);
        if (funding > 0) _fund(auction, funding);
    }

    function _claimAll(FixedPriceAuction a) internal {
        vm.prank(alice);
        a.claim();
        vm.prank(bob);
        a.claim();
        a.claimTreasury();
    }

    function _assertBalances(address account, uint256 expectedBid, uint256 expectedFill) internal view {
        assertEq(tgld.balanceOf(account), expectedBid, "bid token balance");
        assertEq(usds.balanceOf(account), expectedFill, "fill token balance");
    }
}

contract FixedPriceAuctionSettlementTest is FixedPriceAuctionTestBase {
    /// @dev settledAt is a uint40: timestamps past 2^32 (the year 2106) are stored whole, early or by the clock.
    function test_settledAt_after2106() public {
        vm.warp(uint256(type(uint32).max) + 1);
        FixedPriceAuction early = _create(_config(address(tgld), address(usds), PRICE, 0));
        FixedPriceAuction byClock = _create(_config(address(tgld), address(usds), PRICE, 0));
        _toDeposit(early);
        _deposit(early, alice, 100e18);
        _deposit(byClock, alice, 100e18);
        _toFulfillment(early);
        vm.prank(executor);
        early.endFulfillment();
        assertEq(early.settledAt(), block.timestamp);
        assertGt(early.settledAt(), type(uint32).max);

        _toEnd(byClock);
        vm.prank(alice);
        byClock.claim();
        assertEq(byClock.settledAt(), byClock.getConfig().fulfillmentEnd);
    }

    function test_workedExample_fullFunding() public {
        _workedExample(4_660_000e18);
        _toEnd(auction);
        _claimAll(auction);

        _assertBalances(alice, 0, 2_796_000e18);
        _assertBalances(bob, 0, 1_864_000e18);
        _assertBalances(proceedsRecipient, 100_000_000e18, 0);
        _assertBalances(funder, 0, 0);
        _assertBalances(address(auction), 0, 0);
    }

    function test_endFulfillment_eventCarriesFunderRefund() public {
        _workedExample(5_000_000e18);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.AuctionSettled(
            uint64(block.timestamp), 100_000_000e18, 100_000_000e18, 4_660_000e18, 0, 340_000e18
        );
        vm.prank(executor);
        auction.endFulfillment();
    }

    function test_workedExample_halfFunding() public {
        _workedExample(2_330_000e18);
        _toEnd(auction);
        _claimAll(auction);

        _assertBalances(alice, 30_000_000e18, 1_398_000e18);
        _assertBalances(bob, 20_000_000e18, 932_000e18);
        _assertBalances(proceedsRecipient, 50_000_000e18, 0);
        _assertBalances(funder, 0, 0);
        _assertBalances(address(auction), 0, 0);
    }

    function test_workedExample_overFunding() public {
        _workedExample(6_000_000e18);
        _toEnd(auction);
        _claimAll(auction);

        _assertBalances(alice, 0, 2_796_000e18);
        _assertBalances(bob, 0, 1_864_000e18);
        _assertBalances(proceedsRecipient, 100_000_000e18, 0);
        _assertBalances(funder, 0, 1_340_000e18);
        _assertBalances(address(auction), 0, 0);
    }

    function test_workedExample_noFunding() public {
        _workedExample(0);
        _toEnd(auction);
        _claimAll(auction);

        _assertBalances(alice, 60_000_000e18, 0);
        _assertBalances(bob, 40_000_000e18, 0);
        _assertBalances(proceedsRecipient, 0, 0);
        _assertBalances(address(auction), 0, 0);
    }

    function test_workedExample_cancelAfterHalfFunding() public {
        _workedExample(2_330_000e18);
        vm.prank(executor);
        auction.cancel();
        _claimAll(auction);

        _assertBalances(alice, 60_000_000e18, 0);
        _assertBalances(bob, 40_000_000e18, 0);
        _assertBalances(proceedsRecipient, 0, 0);
        _assertBalances(funder, 0, 2_330_000e18);
        _assertBalances(address(auction), 0, 0);
    }

    function test_rounding_requiredFundingRoundsUp() public {
        // 3 wei bid at 1.5 fill per bid needs 4.5 wei, rounded up to 5.
        auction = _create(_config(address(tgld), address(usds), 1.5e18, 0));
        _toDeposit(auction);
        _deposit(auction, alice, 1);
        _deposit(auction, bob, 2);
        _toFulfillment(auction);
        _fund(auction, 4);
        assertEq(auction.previewSettlement().filledDeposits, 2, "4 wei is not full funding");

        _fund(auction, 1);
        assertEq(auction.previewSettlement().filledDeposits, 3, "5 wei is full funding");
        vm.prank(funder);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(usds), 1, 0)
        );
        auction.withdrawExcess(1);
    }

    function test_rounding_exactRequiredFundingFillsEverything() public {
        // 22 wei bid at 0.0466 needs 1.0252 wei, rounded up to 2; exactly 2 fills every deposit.
        _toDeposit(auction);
        _deposit(auction, alice, 22);
        _toFulfillment(auction);
        _fund(auction, 2);
        _toEnd(auction);
        IFixedPriceAuction.Settlement memory s = auction.previewSettlement();
        assertEq(s.filledDeposits, 22);
        assertEq(s.userFunding, 1);
        assertEq(s.funderRefund, 1);
    }

    function test_rounding_fillsAndSharesRoundDown() public {
        auction = _create(_config(address(tgld), address(usds), 1.5e18, 0));
        _toDeposit(auction);
        _deposit(auction, alice, 1);
        _deposit(auction, bob, 2);
        _toFulfillment(auction);
        _fund(auction, 4);
        _toEnd(auction);

        // 4 wei fills floor(4 / 1.5) = 2 bid; those 2 buy floor(2 * 1.5) = 3 fill.
        IFixedPriceAuction.Settlement memory s = auction.previewSettlement();
        assertEq(s.filledDeposits, 2);
        assertEq(s.userFunding, 3);
        assertEq(s.userRefund, 1);
        assertEq(s.funderRefund, 1);

        // Alice's 1/3 of the 1 wei refund rounds down to 0, as does Bob's 2/3.
        _claimAll(auction);
        _assertBalances(alice, 0, 1);
        _assertBalances(bob, 0, 2);
        // The rounding dust stays put and stays owed.
        assertEq(auction.bidOwed(), 1);
        assertEq(auction.fillOwed(), 0);
        assertEq(tgld.balanceOf(address(auction)), 1);
    }

    function test_minDeposit_appliesToDepositsAndRemainders() public {
        auction = _create(_config(address(tgld), address(usds), PRICE, 10e18));
        _toDeposit(auction);
        tgld.mint(alice, 100e18);
        vm.startPrank(alice);
        tgld.approve(address(auction), 100e18);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositBelowMinimum.selector, 9e18, 10e18));
        auction.deposit(9e18);
        auction.deposit(10e18);
        // Top ups below the minimum are fine once the balance clears it.
        auction.deposit(1e18);

        // 11 - 2 leaves 9, under the minimum.
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositBelowMinimum.selector, 9e18, 10e18));
        auction.withdrawDeposit(2e18);
        // 12 - 2 leaves exactly the minimum.
        auction.deposit(1e18);
        auction.withdrawDeposit(2e18);
        assertEq(auction.deposits(alice), 10e18);
        auction.withdrawDeposit(10e18);
        vm.stopPrank();
        assertEq(auction.deposits(alice), 0);
        assertEq(tgld.balanceOf(alice), 100e18);
    }

    function test_withdrawableExcess_matchesWithdrawExcess() public {
        assertEq(auction.withdrawableExcess(), 0, "scheduled");
        _toDeposit(auction);
        _deposit(auction, alice, 60_000_000e18);
        _deposit(auction, bob, 40_000_000e18);
        assertEq(auction.withdrawableExcess(), 0, "deposit");

        _toFulfillment(auction);
        assertEq(auction.withdrawableExcess(), 0, "unfunded");
        _fund(auction, 1_000_000e18);
        assertEq(auction.withdrawableExcess(), 0, "underfunded");
        // 100mm TGLD at 0.0466 needs 4.66mm USDS; 6mm funded leaves 1.34mm.
        _fund(auction, 5_000_000e18);
        assertEq(auction.withdrawableExcess(), 1_340_000e18);

        vm.startPrank(funder);
        vm.expectRevert(
            abi.encodeWithSelector(
                CommonEventsAndErrors.InsufficientBalance.selector, address(usds), 1_340_000e18 + 1, 1_340_000e18
            )
        );
        auction.withdrawExcess(1_340_000e18 + 1);
        auction.withdrawExcess(1_340_000e18);
        vm.stopPrank();
        assertEq(auction.withdrawableExcess(), 0);

        _fund(auction, 1);
        assertEq(auction.withdrawableExcess(), 1);
        _toEnd(auction);
        assertEq(auction.withdrawableExcess(), 0, "settled");
    }

    function test_withdrawableExcess_zeroAfterEarlyEndOrCancel() public {
        _workedExample(6_000_000e18);
        uint256 snapshot = vm.snapshotState();
        vm.prank(executor);
        auction.endFulfillment();
        assertEq(auction.withdrawableExcess(), 0);

        vm.revertToState(snapshot);
        vm.prank(executor);
        auction.cancel();
        assertEq(auction.withdrawableExcess(), 0);
    }

    function test_mixedDecimals_sixDecimalBidToken() public {
        FakeERC20CustomDecimals usdc = new FakeERC20CustomDecimals("USDC", "USDC", address(0), 0, 6);
        // 0.0466 USDS per USDC, so 100mm USDC needs 4.66mm USDS.
        auction = _create(_config(address(usdc), address(usds), PRICE, 0));
        assertEq(auction.priceDenominator(), 1e6);

        _toDeposit(auction);
        _deposit(auction, alice, 60_000_000e6);
        _deposit(auction, bob, 40_000_000e6);
        _toFulfillment(auction);
        uint256 snapshot = vm.snapshotState();

        _fund(auction, 6_000_000e18);
        assertEq(auction.withdrawableExcess(), 1_340_000e18);
        vm.prank(funder);
        auction.withdrawExcess(1_340_000e18);
        _toEnd(auction);
        _claimAll(auction);
        assertEq(usds.balanceOf(alice), 2_796_000e18);
        assertEq(usds.balanceOf(bob), 1_864_000e18);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(proceedsRecipient), 100_000_000e6);

        vm.revertToState(snapshot);
        _fund(auction, 2_330_000e18);
        assertEq(auction.withdrawableExcess(), 0);
        _toEnd(auction);
        _claimAll(auction);
        assertEq(usds.balanceOf(alice), 1_398_000e18);
        assertEq(usds.balanceOf(bob), 932_000e18);
        assertEq(usdc.balanceOf(alice), 30_000_000e6);
        assertEq(usdc.balanceOf(bob), 20_000_000e6);
        assertEq(usdc.balanceOf(proceedsRecipient), 50_000_000e6);
    }

    function test_settlement_zeroFillGuard() public {
        _toDeposit(auction);
        _deposit(auction, alice, 100e18);
        _toFulfillment(auction);
        _fund(auction, 1);
        // 1 wei fills floor(1 / 0.0466) = 21 bid wei, which buy floor(21 * 0.0466) = 0 fill wei.
        IFixedPriceAuction.Settlement memory s = auction.previewSettlement();
        assertEq(s.filledDeposits, 0);
        assertEq(s.userFunding, 0);
        assertEq(s.userRefund, 100e18);
        assertEq(s.funderRefund, 1);

        _toEnd(auction);
        vm.prank(alice);
        auction.claim();
        auction.claimTreasury();
        _assertBalances(alice, 100e18, 0);
        _assertBalances(funder, 0, 1);
        _assertBalances(proceedsRecipient, 0, 0);
    }
}

contract FixedPriceAuctionLifecycleTest is FixedPriceAuctionTestBase {
    function test_phase_transitions() public {
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Scheduled));
        vm.warp(auction.getTiming().depositStart - 1);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Scheduled));
        _toDeposit(auction);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Deposit));
        vm.warp(auction.getTiming().depositEnd - 1);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Deposit));
        _toFulfillment(auction);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Fulfillment));
        vm.warp(auction.getTiming().fulfillmentEnd - 1);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Fulfillment));
        _toEnd(auction);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Settled));
    }

    function test_deposit_onlyInDepositPhase() public {
        tgld.mint(alice, 1e18);
        vm.startPrank(alice);
        tgld.approve(address(auction), 1e18);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Deposit,
                IFixedPriceAuction.Phase.Scheduled
            )
        );
        auction.deposit(1e18);
        _toFulfillment(auction);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Deposit,
                IFixedPriceAuction.Phase.Fulfillment
            )
        );
        auction.deposit(1e18);
        vm.stopPrank();
    }

    function test_fund_onlyFunderInFulfillment() public {
        _toDeposit(auction);
        vm.prank(funder);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Deposit
            )
        );
        auction.fund(1);
        _toFulfillment(auction);
        vm.prank(alice);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.fund(1);
    }

    function test_endFulfillment_settlesEarly() public {
        _workedExample(2_330_000e18);
        vm.warp(block.timestamp + 1 hours);

        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.AuctionSettled(
            uint64(block.timestamp), 100_000_000e18, 50_000_000e18, 2_330_000e18, 50_000_000e18, 0
        );
        vm.prank(executor);
        auction.endFulfillment();

        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Settled));
        assertEq(auction.getTiming().settledAt, block.timestamp);

        // Funding is closed and claims are open.
        usds.mint(funder, 1);
        vm.prank(funder);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Settled
            )
        );
        auction.fund(1);
        _claimAll(auction);
        _assertBalances(alice, 30_000_000e18, 1_398_000e18);
    }

    function test_endFulfillment_onlyMsigInFulfillment() public {
        _toDeposit(auction);
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Deposit
            )
        );
        auction.endFulfillment();

        _toFulfillment(auction);
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.endFulfillment();
    }

    function test_claim_settlesLazilyAtFulfillmentEnd() public {
        _workedExample(2_330_000e18);
        _toEnd(auction);
        // Preview is live before the snapshot.
        assertEq(auction.previewSettlement().filledDeposits, 50_000_000e18);
        assertEq(auction.getTiming().settledAt, 0);
        vm.warp(block.timestamp + 10 days);

        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.AuctionSettled(
            auction.getTiming().fulfillmentEnd, 100_000_000e18, 50_000_000e18, 2_330_000e18, 50_000_000e18, 0
        );
        vm.prank(alice);
        auction.claim();
        assertEq(auction.getTiming().settledAt, auction.getTiming().fulfillmentEnd);
    }

    function test_claimTreasury_settlesLazily_anyone() public {
        _workedExample(4_660_000e18);
        _toEnd(auction);
        vm.prank(unauthorizedUser);
        auction.claimTreasury();
        assertEq(auction.getTiming().settledAt, auction.getTiming().fulfillmentEnd);
        _assertBalances(proceedsRecipient, 100_000_000e18, 0);
    }

    function test_claim_revertsBeforeSettlement() public {
        _workedExample(4_660_000e18);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Settled,
                IFixedPriceAuction.Phase.Fulfillment
            )
        );
        auction.claim();
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Settled,
                IFixedPriceAuction.Phase.Fulfillment
            )
        );
        auction.claimTreasury();
    }

    function test_claimable_zeroBeforeSettlement() public {
        _workedExample(4_660_000e18);
        IFixedPriceAuction.UserClaim memory c = auction.claimable(alice);
        assertEq(c.fillTokenAmount, 0);
        assertEq(c.bidTokenRefund, 0);
    }

    function test_claim_twiceReverts() public {
        _workedExample(4_660_000e18);
        _toEnd(auction);
        _claimAll(auction);

        vm.prank(alice);
        vm.expectRevert(IFixedPriceAuction.AlreadyClaimed.selector);
        auction.claim();
        vm.expectRevert(IFixedPriceAuction.AlreadyClaimed.selector);
        auction.claimTreasury();
        assertEq(auction.claimable(alice).fillTokenAmount, 0);
        assertEq(auction.treasuryClaimable().bidTokenAmount, 0);
    }

    function test_claim_nothingToClaim() public {
        _workedExample(4_660_000e18);
        _toEnd(auction);
        vm.prank(unauthorizedUser);
        vm.expectRevert(IFixedPriceAuction.NothingToClaim.selector);
        auction.claim();
    }

    function test_cancel_inEachPhaseBeforeFulfillmentEnd() public {
        uint256 snapshot = vm.snapshotState();
        vm.prank(executor);
        auction.cancel();
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));

        vm.revertToState(snapshot);
        _toDeposit(auction);
        vm.prank(executor);
        auction.cancel();
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));

        vm.revertToState(snapshot);
        _workedExample(1e18);
        vm.warp(auction.getTiming().fulfillmentEnd - 1);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.AuctionCancelled(100_000_000e18, 1e18);
        vm.prank(executor);
        auction.cancel();
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
    }

    function test_cancel_notAtOrAfterFulfillmentEnd() public {
        _workedExample(1e18);
        _toEnd(auction);
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Settled
            )
        );
        auction.cancel();
    }

    function test_cancel_notAfterEarlySettlementOrTwice() public {
        _workedExample(1e18);
        vm.startPrank(executor);
        auction.endFulfillment();
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Settled
            )
        );
        auction.cancel();
        vm.stopPrank();

        auction = _create(_config(address(tgld), address(usds), PRICE, 0));
        vm.startPrank(executor);
        auction.cancel();
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Cancelled
            )
        );
        auction.cancel();
        vm.stopPrank();
    }

    function test_access_cancel() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.cancel();
    }

    function test_withdrawDeposit() public {
        _toDeposit(auction);
        _deposit(auction, alice, 100e18);
        vm.startPrank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(tgld), 101e18, 100e18)
        );
        auction.withdrawDeposit(101e18);
        auction.withdrawDeposit(40e18);
        vm.stopPrank();
        assertEq(auction.deposits(alice), 60e18);
        assertEq(auction.totalDeposits(), 60e18);
        assertEq(tgld.balanceOf(alice), 40e18);
    }

    function test_withdrawDeposit_fail_outsideDeposit() public {
        _toDeposit(auction);
        _deposit(auction, alice, 10e18);

        vm.warp(auction.getTiming().depositStart - 1);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Deposit,
                IFixedPriceAuction.Phase.Scheduled
            )
        );
        auction.withdrawDeposit(1);

        _toDeposit(auction);
        vm.prank(alice);
        auction.withdrawDeposit(1);
        vm.warp(auction.getTiming().depositEnd - 1);
        vm.prank(alice);
        auction.withdrawDeposit(1);

        _toFulfillment(auction);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Deposit,
                IFixedPriceAuction.Phase.Fulfillment
            )
        );
        auction.withdrawDeposit(1);
        assertEq(auction.deposits(alice), 10e18 - 2);
    }

    function test_withdrawExcess_fail_outsideFulfillment() public {
        _toDeposit(auction);
        _deposit(auction, alice, 10e18);
        vm.warp(auction.getTiming().depositEnd - 1);
        vm.prank(funder);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Deposit
            )
        );
        auction.withdrawExcess(1);

        _toFulfillment(auction);
        _fund(auction, 1e18);
        vm.prank(funder);
        auction.withdrawExcess(1);
        vm.warp(auction.getTiming().fulfillmentEnd - 1);
        vm.prank(funder);
        auction.withdrawExcess(1);

        _toEnd(auction);
        vm.prank(funder);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Settled
            )
        );
        auction.withdrawExcess(1);
        assertEq(usds.balanceOf(funder), 2);
    }

    function test_deposit_fail_fundingOverflow() public {
        // A huge price: type(uint128).max, about 3.4e20 fill per bid. Settlement maths overflows once deposits pass
        // ~3.4e56.
        uint256 hugePrice = uint256(type(uint128).max);
        auction = _create(_config(address(tgld), address(usds), hugePrice, 0));
        _toDeposit(auction);
        _deposit(auction, alice, 1e50);

        tgld.mint(bob, 1e60);
        vm.startPrank(bob);
        tgld.approve(address(auction), 1e60);
        vm.expectRevert(abi.encodeWithSelector(PRBMath_MulDiv_Overflow.selector, 1e50 + 1e60, hugePrice, 1e18));
        auction.deposit(1e60);
        vm.stopPrank();
        assertEq(auction.totalDeposits(), 1e50);
    }

    function test_deposit_fail_zeroAmount() public {
        _toDeposit(auction);
        vm.prank(alice);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        auction.deposit(0);
    }

    function test_withdrawDeposit_fail_zeroAmount() public {
        _toDeposit(auction);
        _deposit(auction, alice, 1e18);
        vm.prank(alice);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        auction.withdrawDeposit(0);
    }

    function test_fund_fail_zeroAmount() public {
        _toFulfillment(auction);
        vm.prank(funder);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        auction.fund(0);
    }

    function test_withdrawExcess_fail_zeroAmount() public {
        _toFulfillment(auction);
        vm.prank(funder);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        auction.withdrawExcess(0);
    }
}

contract FixedPriceAuctionPauseTest is FixedPriceAuctionTestBase {
    function _pause() internal {
        vm.prank(executor);
        auction.setPaused(true);
    }

    function test_access_setPaused() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.setPaused(true);
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setPaused(true);
    }

    function test_setPaused_events() public {
        vm.startPrank(executor);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.PausedSet(true);
        auction.setPaused(true);
        assertTrue(auction.paused());
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.PausedSet(false);
        auction.setPaused(false);
        assertFalse(auction.paused());
    }

    function test_paused_depositAndWithdrawRevert() public {
        _toDeposit(auction);
        _deposit(auction, alice, 10e18);
        _pause();
        vm.startPrank(alice);
        vm.expectRevert(IFixedPriceAuction.IsPaused.selector);
        auction.deposit(1e18);
        vm.expectRevert(IFixedPriceAuction.IsPaused.selector);
        auction.withdrawDeposit(1e18);
        vm.stopPrank();
    }

    function test_paused_fundAndWithdrawExcessRevert() public {
        _workedExample(6_000_000e18);
        _pause();
        vm.startPrank(funder);
        vm.expectRevert(IFixedPriceAuction.IsPaused.selector);
        auction.fund(1);
        vm.expectRevert(IFixedPriceAuction.IsPaused.selector);
        auction.withdrawExcess(1);
        vm.stopPrank();
    }

    function test_paused_claimsAndRecoverRevert() public {
        _workedExample(6_000_000e18);
        _toEnd(auction);
        _pause();
        vm.prank(alice);
        vm.expectRevert(IFixedPriceAuction.IsPaused.selector);
        auction.claim();
        vm.expectRevert(IFixedPriceAuction.IsPaused.selector);
        auction.claimTreasury();

        usds.mint(address(auction), 1);
        vm.prank(executor);
        vm.expectRevert(IFixedPriceAuction.IsPaused.selector);
        auction.recoverToken(address(usds), executor, 1);

        // Unpausing lets the same calls through.
        vm.prank(executor);
        auction.setPaused(false);
        _claimAll(auction);
    }

    function test_paused_endFulfillmentWorks() public {
        _workedExample(1e18);
        _pause();
        vm.prank(executor);
        auction.endFulfillment();
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Settled));
    }

    function test_paused_cancelAndSettersWork() public {
        _pause();
        vm.startPrank(executor);
        ComplianceCheck other = new ComplianceCheck(executor);
        auction.setComplianceCheck(address(other));
        assertEq(auction.complianceCheck(), address(other));
        auction.cancel();
        vm.stopPrank();
        vm.prank(rescuer);
        auction.disableComplianceCheck();
        assertTrue(auction.complianceDisabled());
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
    }
}

contract FixedPriceAuctionRescueModeTest is FixedPriceAuctionTestBase {
    function _rescueMode(bool value) internal {
        vm.prank(rescuer);
        auction.setRescueMode(value);
    }

    function test_access_setRescueMode() public {
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setRescueMode(true);

        vm.expectEmit(address(auction));
        emit IRescuableAccess.RescueModeSet(true);
        _rescueMode(true);
        assertTrue(auction.inRescueMode());
    }

    function test_rescueMode_locksMsigOut() public {
        _workedExample(1e18);
        _rescueMode(true);
        vm.startPrank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.cancel();
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.endFulfillment();
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setComplianceCheck(address(compliance));
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.recoverToken(address(usds), executor, 1);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.proposeNewExecutor(alice);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setPaused(true);
        vm.stopPrank();

        // Switching rescue mode off hands control back.
        _rescueMode(false);
        vm.prank(executor);
        auction.cancel();
    }

    function test_rescueMode_rescuerPausesButHasNoMsigPowers() public {
        _workedExample(1e18);
        _rescueMode(true);
        vm.startPrank(rescuer);
        auction.setPaused(true);
        assertTrue(auction.paused());
        auction.setPaused(false);
        assertFalse(auction.paused());

        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.endFulfillment();
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setComplianceCheck(address(compliance));
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.recoverToken(address(usds), rescuer, 1);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.proposeNewExecutor(alice);
        vm.stopPrank();
    }

    function test_rescueMode_rescuerCancelsInFulfillmentWhilePaused_refundsInFull() public {
        _workedExample(2_330_000e18);
        _rescueMode(true);
        vm.startPrank(rescuer);
        auction.setPaused(true);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.AuctionCancelled(100_000_000e18, 2_330_000e18);
        auction.cancel();
        auction.setPaused(false);
        vm.stopPrank();
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
        _claimAll(auction);

        _assertBalances(alice, 60_000_000e18, 0);
        _assertBalances(bob, 40_000_000e18, 0);
        _assertBalances(proceedsRecipient, 0, 0);
        _assertBalances(funder, 0, 2_330_000e18);
        _assertBalances(address(auction), 0, 0);
    }

    function test_rescueMode_rescuerCancelsInDeposit_refundsInFull() public {
        _toDeposit(auction);
        _deposit(auction, alice, 60_000_000e18);
        _deposit(auction, bob, 40_000_000e18);
        _rescueMode(true);
        vm.prank(rescuer);
        auction.cancel();
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
        _claimAll(auction);

        _assertBalances(alice, 60_000_000e18, 0);
        _assertBalances(bob, 40_000_000e18, 0);
        _assertBalances(proceedsRecipient, 0, 0);
        _assertBalances(address(auction), 0, 0);
    }

    function test_rescueMode_rescuerCancelKeepsPhaseRules() public {
        _workedExample(1e18);
        _rescueMode(true);
        _toEnd(auction);
        vm.prank(rescuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IFixedPriceAuction.InvalidPhase.selector,
                IFixedPriceAuction.Phase.Fulfillment,
                IFixedPriceAuction.Phase.Settled
            )
        );
        auction.cancel();
    }

    function test_cancel_rescuerOnlyInRescueMode() public {
        _workedExample(1e18);
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.cancel();
    }

    function test_setRescueMode_offKeepsExecutorProposal() public {
        _checkRescueModeOffKeepsProposal(auction);
    }

    function test_setRescueMode_onWithNothingPendingEmitsOnce() public {
        _checkRescueModeOnEmitsOnlyRescueModeSet(auction);
    }

    function test_setRescueMode_offEmitsFalse() public {
        _rescueMode(true);
        vm.expectEmit(address(auction));
        emit IRescuableAccess.RescueModeSet(false);
        _rescueMode(false);
        assertFalse(auction.inRescueMode());
    }

    function test_rescuerHandover_inRescueMode() public {
        _workedExample(1e18);
        _rescueMode(true);
        vm.prank(rescuer);
        auction.proposeNewRescuer(bob);
        vm.prank(bob);
        auction.acceptRescuer();
        assertEq(auction.rescuer(), bob);

        // The new rescuer controls the pause and cancel; the old one doesn't.
        vm.startPrank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setPaused(true);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.cancel();
        vm.stopPrank();
        vm.startPrank(bob);
        auction.setPaused(true);
        auction.cancel();
        vm.stopPrank();
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
    }

    function test_rescueMode_rescuerCancelsInScheduled() public {
        _rescueMode(true);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Scheduled));
        vm.prank(rescuer);
        auction.cancel();
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
    }

    function test_rescueMode_bidderCallsStillWork() public {
        _rescueMode(true);
        _toDeposit(auction);
        _deposit(auction, alice, 10e18);
        vm.prank(alice);
        auction.withdrawDeposit(10e18);
        assertEq(tgld.balanceOf(alice), 10e18);
    }

    function test_executorHandover() public {
        vm.prank(alice);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.proposeNewExecutor(alice);

        vm.prank(executor);
        auction.proposeNewExecutor(alice);
        vm.prank(bob);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.acceptExecutor();
        uint256 readyAt = block.timestamp + auction.EXECUTOR_HANDOVER_DELAY();
        assertEq(auction.proposedExecutorAt(), block.timestamp);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IExecutorAccess.ExecutorHandoverNotReady.selector, readyAt));
        auction.acceptExecutor();
        vm.warp(readyAt - 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IExecutorAccess.ExecutorHandoverNotReady.selector, readyAt));
        auction.acceptExecutor();

        // A re-proposal restarts the clock.
        vm.prank(executor);
        auction.proposeNewExecutor(alice);
        vm.warp(readyAt);
        readyAt = readyAt - 1 + auction.EXECUTOR_HANDOVER_DELAY();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IExecutorAccess.ExecutorHandoverNotReady.selector, readyAt));
        auction.acceptExecutor();

        vm.warp(readyAt);
        vm.expectEmit(address(auction));
        emit IExecutorAccess.NewExecutorAccepted(executor, alice);
        vm.prank(alice);
        auction.acceptExecutor();
        assertEq(auction.executor(), alice);
        assertEq(auction.proposedExecutor(), address(0));
    }

    function test_setRescueMode_cancelsExecutorProposal() public {
        _checkRescueModeCancelsExecutorProposal(auction);
    }

    function test_executorHandover_cannotBeRescuer() public {
        vm.prank(executor);
        auction.proposeNewExecutor(rescuer);
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        auction.acceptExecutor();
    }

    function test_rescuerHandover() public {
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.proposeNewRescuer(executor);

        vm.prank(rescuer);
        auction.proposeNewRescuer(alice);
        vm.prank(bob);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.acceptRescuer();
        vm.prank(alice);
        auction.acceptRescuer();
        assertEq(auction.rescuer(), alice);
        assertEq(auction.proposedRescuer(), address(0));

        // The old rescuer has lost its powers.
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setRescueMode(true);
    }

    function test_rescuerHandover_cannotBeExecutor() public {
        vm.prank(rescuer);
        auction.proposeNewRescuer(executor);
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        auction.acceptRescuer();
    }

    function test_rescuerTakeover() public {
        _workedExample(4_660_000e18);
        _toEnd(auction);
        vm.prank(executor);
        auction.setPaused(true);
        vm.prank(rescuer);
        auction.setRescueMode(true);

        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setPaused(false);

        vm.prank(rescuer);
        auction.setPaused(false);
        _claimAll(auction);
        _assertBalances(alice, 0, 2_796_000e18);

        vm.prank(rescuer);
        auction.setRescueMode(false);
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.setPaused(true);
        vm.prank(executor);
        auction.setPaused(true);
        assertTrue(auction.paused());
    }

    function test_proposeNewExecutor_fail_zeroAddress() public {
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        auction.proposeNewExecutor(address(0));
    }

    function test_proposeNewRescuer_fail_zeroAddress() public {
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        auction.proposeNewRescuer(address(0));
    }
}

contract FixedPriceAuctionComplianceTest is FixedPriceAuctionTestBase {
    function test_blocked_cannotDepositWithdrawOrClaim_untilUnblocked() public {
        _toDeposit(auction);
        _deposit(auction, alice, 60_000_000e18);
        _deposit(auction, bob, 40_000_000e18);
        _setBlocked(alice, true);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.deposit(1);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.withdrawDeposit(1);
        vm.stopPrank();

        _toFulfillment(auction);
        _fund(auction, 2_330_000e18);
        _toEnd(auction);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.claim();

        // The blocked deposit stays in the pro-rata split; everyone else settles as normal.
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();
        _assertBalances(bob, 20_000_000e18, 932_000e18);
        _assertBalances(proceedsRecipient, 50_000_000e18, 0);

        // Alice's share waits in the auction and can't be recovered.
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(usds), 1, 0)
        );
        auction.recoverToken(address(usds), executor, 1);

        _setBlocked(alice, false);
        vm.prank(alice);
        auction.claim();
        _assertBalances(alice, 30_000_000e18, 1_398_000e18);
    }

    function test_setComplianceCheck() public {
        ComplianceCheck other = new ComplianceCheck(executor);
        vm.startPrank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        auction.setComplianceCheck(address(0));

        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.ComplianceCheckSet(address(other));
        auction.setComplianceCheck(address(other));
        vm.stopPrank();
        assertEq(auction.getConfig().complianceCheck, address(other));

        // Screening follows the new pointer: the old list no longer blocks, the new one does.
        _setBlocked(alice, true);
        _toDeposit(auction);
        _deposit(auction, alice, 1);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        vm.prank(executor);
        other.setBlocked(accounts, true);
        tgld.mint(alice, 1);
        vm.startPrank(alice);
        tgld.approve(address(auction), 1);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.deposit(1);
        vm.stopPrank();
    }

    /// @dev An invalid replacement leaves the existing compliance source and screening the same.
    function test_setComplianceCheck_fail_withoutCode() public {
        _toDeposit(auction);
        _deposit(auction, alice, 10e18);
        _setBlocked(alice, true);

        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        auction.setComplianceCheck(bob);
        assertEq(auction.complianceCheck(), address(compliance));
        assertEq(auction.getConfig().complianceCheck, address(compliance));
        assertFalse(auction.complianceDisabled());

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.withdrawDeposit(1);
        assertEq(auction.deposits(alice), 10e18);
    }

    function test_access_setComplianceCheck() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.setComplianceCheck(alice);
    }

    function test_disableComplianceCheck_rescuerOnly_oneWay() public {
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.disableComplianceCheck();

        _setBlocked(alice, true);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.ComplianceCheckDisabled();
        vm.prank(rescuer);
        auction.disableComplianceCheck();

        vm.prank(executor);
        vm.expectRevert(IFixedPriceAuction.ComplianceCheckIsDisabled.selector);
        auction.setComplianceCheck(address(compliance));

        // Nobody is blocked any more.
        _toDeposit(auction);
        _deposit(auction, alice, 1);
        assertEq(auction.deposits(alice), 1);
    }

    function test_revertingComplianceCheck_failsClosed_disableFixes() public {
        _toDeposit(auction);
        _deposit(auction, alice, 10e18);
        RevertingComplianceCheck broken = new RevertingComplianceCheck();
        vm.prank(executor);
        auction.setComplianceCheck(address(broken));

        vm.startPrank(alice);
        vm.expectRevert("Compliance unavailable");
        auction.deposit(1);
        vm.expectRevert("Compliance unavailable");
        auction.withdrawDeposit(1);
        vm.stopPrank();

        _toFulfillment(auction);
        _fund(auction, 1e18); // funding isn't screened
        _toEnd(auction);
        vm.prank(alice);
        vm.expectRevert("Compliance unavailable");
        auction.claim();

        vm.prank(rescuer);
        auction.disableComplianceCheck();
        vm.prank(alice);
        auction.claim();
        // 10e18 TGLD at 0.0466 needs 0.466e18 USDS, under the 1e18 funded, so Alice fills in full.
        assertEq(usds.balanceOf(alice), 0.466e18);
    }

    function test_treasuryPaths_unscreened() public {
        _toDeposit(auction);
        _deposit(auction, alice, 60_000_000e18);
        _deposit(auction, bob, 40_000_000e18);
        RevertingComplianceCheck broken = new RevertingComplianceCheck();
        vm.prank(executor);
        auction.setComplianceCheck(address(broken));

        _toFulfillment(auction);
        _fund(auction, 6_000_000e18);
        vm.prank(funder);
        auction.withdrawExcess(1_000_000e18);
        _toEnd(auction);
        auction.claimTreasury();

        _assertBalances(proceedsRecipient, 100_000_000e18, 0);
        // 1mm withdrawn early, then the 0.34mm left above full funding.
        _assertBalances(funder, 0, 1_340_000e18);
    }
}

contract FixedPriceAuctionRecoverTokenTest is FixedPriceAuctionTestBase {
    function test_recoverToken_strayToken() public {
        FakeERC20CustomDecimals stray = new FakeERC20CustomDecimals("Stray", "STRAY", address(auction), 5e18, 18);
        vm.expectEmit(address(auction));
        emit CommonEventsAndErrors.TokenRecovered(alice, address(stray), 5e18);
        vm.prank(executor);
        auction.recoverToken(address(stray), alice, 5e18);
        assertEq(stray.balanceOf(alice), 5e18);

        // A stray token whose address sorts above the auction's own tokens owes nothing either.
        _workedExample(4_660_000e18);
        address high = address(type(uint160).max);
        deployCodeTo("FakeERC20CustomDecimals.sol", abi.encode("High", "HIGH", address(auction), 5e18, 18), high);
        vm.prank(executor);
        auction.recoverToken(high, alice, 5e18);
        assertEq(FakeERC20CustomDecimals(high).balanceOf(alice), 5e18);
    }

    function test_recoverToken_onlyExcessAboveOwed() public {
        _workedExample(4_660_000e18);
        tgld.mint(address(auction), 7);
        usds.mint(address(auction), 3);

        vm.startPrank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(tgld), 8, 7)
        );
        auction.recoverToken(address(tgld), executor, 8);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(usds), 4, 3)
        );
        auction.recoverToken(address(usds), executor, 4);
        auction.recoverToken(address(tgld), executor, 7);
        auction.recoverToken(address(usds), executor, 3);
        vm.stopPrank();

        // What's left is exactly what's owed, and it all pays out.
        _toEnd(auction);
        _claimAll(auction);
        _assertBalances(address(auction), 0, 0);
    }

    function test_recoverToken_neverUnclaimedShares() public {
        _workedExample(4_660_000e18);
        _toEnd(auction);
        auction.claimTreasury();
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(usds), 1, 0)
        );
        auction.recoverToken(address(usds), executor, 1);
    }

    function test_recoverToken_validation() public {
        vm.startPrank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        auction.recoverToken(address(usds), address(0), 1);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        auction.recoverToken(address(usds), executor, 0);
        vm.stopPrank();
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.recoverToken(address(usds), executor, 1);
    }
}

contract FixedPriceAuctionAdminTest is FixedPriceAuctionTestBase {
    function test_initialization() public view {
        // Both tokens have 18 decimals: 10**(18 + 18 - 18).
        assertEq(auction.priceDenominator(), 1e18);
        assertEq(auction.getTiming().depositStart, 1_000_000 + 1 days);
        assertEq(auction.getTiming().depositEnd, 1_000_000 + 6 days);
        assertEq(auction.getTiming().fulfillmentEnd, 1_000_000 + 9 days);
        assertEq(auction.complianceCheck(), address(compliance));
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Scheduled));
    }

    function test_events_depositWithdrawFundExcess() public {
        _toDeposit(auction);
        tgld.mint(alice, 100e18);
        vm.startPrank(alice);
        tgld.approve(address(auction), 100e18);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.Deposited(alice, 100e18, 100e18, 100e18);
        auction.deposit(100e18);
        vm.stopPrank();
        _deposit(auction, bob, 20e18);
        tgld.mint(alice, 50e18);
        vm.startPrank(alice);
        tgld.approve(address(auction), 50e18);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.Deposited(alice, 50e18, 150e18, 170e18);
        auction.deposit(50e18);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.DepositWithdrawn(alice, 90e18, 60e18, 80e18);
        auction.withdrawDeposit(90e18);
        vm.stopPrank();

        _toFulfillment(auction);
        usds.mint(funder, 15e18);
        vm.startPrank(funder);
        usds.approve(address(auction), 15e18);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.Funded(funder, 10e18, 10e18);
        auction.fund(10e18);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.Funded(funder, 5e18, 15e18);
        auction.fund(5e18);
        // 80e18 TGLD at 0.0466 needs 3.728e18 USDS, so 11.272e18 is excess.
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.ExcessWithdrawn(funder, 11.272e18, 3.728e18);
        auction.withdrawExcess(11.272e18);
        vm.stopPrank();
    }

    function test_events_claims() public {
        _workedExample(2_330_000e18);
        _toEnd(auction);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.UserClaimed(alice, 1_398_000e18, 30_000_000e18);
        vm.prank(alice);
        auction.claim();
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.TreasuryClaimed(proceedsRecipient, funder, 50_000_000e18, 0);
        auction.claimTreasury();
    }

    function test_events_handovers() public {
        vm.expectEmit(address(auction));
        emit IExecutorAccess.NewExecutorProposed(executor, address(0), bob);
        vm.startPrank(executor);
        auction.proposeNewExecutor(bob);
        // A re-proposal names the proposal it replaces.
        vm.expectEmit(address(auction));
        emit IExecutorAccess.NewExecutorProposed(executor, bob, alice);
        auction.proposeNewExecutor(alice);
        vm.stopPrank();
        vm.warp(block.timestamp + auction.EXECUTOR_HANDOVER_DELAY());
        vm.expectEmit(address(auction));
        emit IExecutorAccess.NewExecutorAccepted(executor, alice);
        vm.prank(alice);
        auction.acceptExecutor();

        vm.expectEmit(address(auction));
        emit IRescuableAccess.NewRescuerProposed(rescuer, address(0), alice);
        vm.startPrank(rescuer);
        auction.proposeNewRescuer(alice);
        vm.expectEmit(address(auction));
        emit IRescuableAccess.NewRescuerProposed(rescuer, alice, bob);
        auction.proposeNewRescuer(bob);
        vm.stopPrank();
        vm.expectEmit(address(auction));
        emit IRescuableAccess.NewRescuerAccepted(rescuer, bob);
        vm.prank(bob);
        auction.acceptRescuer();
    }

    function test_initialize_fail_executorIsRescuer() public {
        FixedPriceAuction clone = _clone(_config(address(tgld), address(usds), PRICE, 0));
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        clone.initialize(executor, executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        clone.initialize(address(0), rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        clone.initialize(executor, address(0));
    }

    function test_initialize_fail_implementation() public {
        vm.expectRevert(IFixedPriceAuction.AlreadyInitialized.selector);
        implementation.initialize(executor, rescuer);
    }

    /// @dev The implementation has no config of its own, so no token-moving call can run on it, even with tokens
    /// approved to it and sitting in it.
    function test_implementation_neverMovesTokens() public {
        tgld.mint(alice, 1e18);
        usds.mint(funder, 1e18);
        tgld.mint(address(implementation), 1e18);
        vm.prank(alice);
        tgld.approve(address(implementation), 1e18);
        vm.prank(funder);
        usds.approve(address(implementation), 1e18);

        vm.startPrank(alice);
        vm.expectRevert();
        implementation.deposit(1e18);
        vm.expectRevert();
        implementation.withdrawDeposit(1e18);
        vm.expectRevert();
        implementation.claim();
        vm.stopPrank();
        vm.startPrank(funder);
        vm.expectRevert();
        implementation.fund(1e18);
        vm.expectRevert();
        implementation.withdrawExcess(1e18);
        vm.stopPrank();
        vm.expectRevert();
        implementation.claimTreasury();
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        implementation.recoverToken(address(tgld), executor, 1e18);

        assertEq(tgld.balanceOf(alice), 1e18);
        assertEq(usds.balanceOf(funder), 1e18);
        assertEq(tgld.balanceOf(address(implementation)), 1e18);
    }

    function test_initialize_fail_twice() public {
        vm.expectRevert(IFixedPriceAuction.AlreadyInitialized.selector);
        auction.initialize(alice, bob);

        // A hand-built clone: anyone may initialize it once, then never again.
        FixedPriceAuction clone = _clone(_config(address(tgld), address(usds), PRICE, 0));
        vm.prank(alice);
        clone.initialize(executor, rescuer);
        assertEq(clone.executor(), executor);
        assertEq(clone.rescuer(), rescuer);
        vm.expectRevert(IFixedPriceAuction.AlreadyInitialized.selector);
        clone.initialize(alice, bob);
    }
}

contract FixedPriceAuctionAccessTest is FixedPriceAuctionTestBase {

    function test_access_withdrawExcess() public {
        _toFulfillment(auction);
        _fund(auction, 1e18);
        vm.prank(alice);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.withdrawExcess(1);
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.withdrawExcess(1);
    }

    function test_access_proposeNewExecutor() public {
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        auction.proposeNewExecutor(alice);
    }

}

/// @dev Worked examples with 6-decimal tokens. Expected values are worked by hand, not by the contract's formula.
contract FixedPriceAuctionDecimalsTest is FixedPriceAuctionTestBase {
    FakeERC20CustomDecimals internal usdc;
    FakeERC20CustomDecimals internal temple;

    function setUp() public override {
        super.setUp();
        usdc = new FakeERC20CustomDecimals("USDC", "USDC", address(0), 0, 6);
        temple = new FakeERC20CustomDecimals("Temple", "TEMPLE", address(0), 0, 18);
    }

    function _settleAndClaim(FixedPriceAuction a, address[] memory accounts) internal {
        _toEnd(a);
        for (uint256 i; i < accounts.length; ++i) {
            vm.prank(accounts[i]);
            a.claim();
        }
        a.claimTreasury();
    }

    function _one(address account) internal pure returns (address[] memory accounts) {
        accounts = new address[](1);
        accounts[0] = account;
    }

    function _two() internal view returns (address[] memory accounts) {
        accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
    }

    /// @dev A: bid USDC (6dp), fill TEMPLE (18dp), 0.9 TEMPLE per USDC.
    function test_decimals_bidUsdc_fillTemple() public {
        auction = _create(_config(address(usdc), address(temple), 0.9e18, 0));
        assertEq(auction.priceDenominator(), 1e6);
        _toDeposit(auction);
        _deposit(auction, alice, 1e9);
        _toFulfillment(auction);
        uint256 snapshot = vm.snapshotState();

        // 1,000 USDC x 0.9 = 900 TEMPLE.
        _fund(auction, 9e20);
        assertEq(auction.withdrawableExcess(), 0);
        _settleAndClaim(auction, _one(alice));
        assertEq(temple.balanceOf(alice), 9e20);
        assertEq(usdc.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(proceedsRecipient), 1e9);

        vm.revertToState(snapshot);
        // Half funding: 450 TEMPLE fills 500 USDC.
        _fund(auction, 4.5e20);
        assertEq(auction.previewSettlement().filledDeposits, 5e8);
        _settleAndClaim(auction, _one(alice));
        assertEq(temple.balanceOf(alice), 4.5e20);
        assertEq(usdc.balanceOf(alice), 5e8);
        assertEq(usdc.balanceOf(proceedsRecipient), 5e8);
    }

    /// @dev B: bid TGLD (18dp), fill USDC (6dp), 0.0466 USDC per TGLD.
    function test_decimals_bidTgld_fillUsdc() public {
        auction = _create(_config(address(tgld), address(usdc), PRICE, 0));
        assertEq(auction.priceDenominator(), 1e30);
        _toDeposit(auction);
        _deposit(auction, alice, 6e25);
        _deposit(auction, bob, 4e25);
        _toFulfillment(auction);
        uint256 snapshot = vm.snapshotState();

        // Full: 100mm TGLD x 0.0466 = 4.66mm USDC.
        _fund(auction, 4.66e12);
        _settleAndClaim(auction, _two());
        assertEq(usdc.balanceOf(alice), 2.796e12);
        assertEq(usdc.balanceOf(bob), 1.864e12);
        assertEq(tgld.balanceOf(proceedsRecipient), 1e26);
        assertEq(usdc.balanceOf(funder), 0);

        vm.revertToState(snapshot);
        // Half: 2.33mm USDC fills 50mm TGLD.
        _fund(auction, 2.33e12);
        assertEq(auction.previewSettlement().filledDeposits, 5e25);
        _settleAndClaim(auction, _two());
        assertEq(usdc.balanceOf(alice), 1.398e12);
        assertEq(tgld.balanceOf(alice), 3e25);
        assertEq(usdc.balanceOf(bob), 0.932e12);
        assertEq(tgld.balanceOf(bob), 2e25);
        assertEq(tgld.balanceOf(proceedsRecipient), 5e25);

        vm.revertToState(snapshot);
        // Over: 6mm funded, 4.66mm used, 1.34mm back.
        _fund(auction, 6e12);
        assertEq(auction.withdrawableExcess(), 1.34e12);
        _settleAndClaim(auction, _two());
        assertEq(usdc.balanceOf(funder), 1.34e12);
        assertEq(usdc.balanceOf(alice), 2.796e12);
        assertEq(usdc.balanceOf(bob), 1.864e12);
    }

    /// @dev C: bid USDC (6dp), fill a 6dp token, 1:1.
    function test_decimals_bothSixDecimals() public {
        FakeERC20CustomDecimals six = new FakeERC20CustomDecimals("Six", "SIX", address(0), 0, 6);
        auction = _create(_config(address(usdc), address(six), 1e18, 0));
        assertEq(auction.priceDenominator(), 1e18);
        _toDeposit(auction);
        _deposit(auction, alice, 1e9);
        _toFulfillment(auction);
        _fund(auction, 1e9);
        _settleAndClaim(auction, _one(alice));
        assertEq(six.balanceOf(alice), 1e9);
        assertEq(usdc.balanceOf(proceedsRecipient), 1e9);
    }

    /// @dev D: three equal TGLD bidders, USDC fill, partial funding: payouts round down to whole USDC wei.
    function test_decimals_roundingEighteenToSix() public {
        auction = _create(_config(address(tgld), address(usdc), PRICE, 0));
        address carol = makeAddr("carol");
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = carol;

        _toDeposit(auction);
        for (uint256 i; i < 3; ++i) {
            _deposit(auction, accounts[i], 1e18);
        }
        _toFulfillment(auction);
        // Full funding would be 3 TGLD x 0.0466 = 139,800 USDC wei; fund 100,001.
        _fund(auction, 100_001);

        // floor(100,001 x 1e30 / 0.0466e18) TGLD wei buys userFunding = 100,000 USDC wei, so 1 wei goes back to the
        // funder. Bidders pay only for those 100,000: ceil(100,000 x 1e30 / 0.0466e18) = 2,145,922,746,781,115,880.
        IFixedPriceAuction.Settlement memory s = auction.previewSettlement();
        assertEq(s.filledDeposits, 2_145_922_746_781_115_880);
        assertEq(s.userFunding, 100_000);
        assertEq(s.userRefund, 3e18 - 2_145_922_746_781_115_880);
        assertEq(s.funderRefund, 1);

        _settleAndClaim(auction, accounts);
        // Each third: floor(100,000 / 3) = 33,333 USDC wei and 854,077,253,218,884,120 / 3 TGLD wei.
        for (uint256 i; i < 3; ++i) {
            assertEq(usdc.balanceOf(accounts[i]), 33_333);
            assertEq(tgld.balanceOf(accounts[i]), 284_692_417_739_628_040);
        }
        // 99,999 paid of 100,000: 1 wei of fill dust stays; the refund splits exactly in three.
        assertEq(auction.fillOwed(), 1);
        assertEq(auction.bidOwed(), 0);
        assertEq(usdc.balanceOf(address(auction)), 1);
        assertEq(tgld.balanceOf(address(auction)), 0);
    }

    /// @dev Full funding still charges only for whole fill-token wei: the bid tokens worth under one are refunded.
    function test_decimals_fullFundingRefundsUnderOneFillWei() public {
        auction = _create(_config(address(tgld), address(usdc), PRICE, 0));
        _toDeposit(auction);
        _deposit(auction, alice, 1e18 + 1e12);
        _toFulfillment(auction);
        // (1e18 + 1e12) x 0.0466 = 46,600.0466 USDC wei, so the requirement rounds up to 46,601.
        _fund(auction, 46_601);

        // 46,600 USDC wei cost exactly 1e18 TGLD wei; the 1e12 left over is refunded, not taken.
        IFixedPriceAuction.Settlement memory s = auction.previewSettlement();
        assertEq(s.userFunding, 46_600);
        assertEq(s.filledDeposits, 1e18);
        assertEq(s.userRefund, 1e12);
        assertEq(s.funderRefund, 1);
    }
}

/// @dev Real TempleGold as the bid token. Its transfers need the sender or the receiver authorized.
contract FixedPriceAuctionTempleGoldTest is FixedPriceAuctionTestBase {
    TempleGold internal templeGold;

    function setUp() public override {
        super.setUp();
        templeGold = new TempleGold(
            ITempleGold.InitArgs({
                executor: executor,
                layerZeroEndpoint: address(new LayerZeroEndpointStub()),
                mintChainId: uint128(block.chainid),
                mintChainLzEid: 30_110,
                name: "TEMPLE GOLD",
                symbol: "TGLD"
            })
        );
        auction = _create(_config(address(templeGold), address(usds), PRICE, 0));
        deal(address(templeGold), alice, 60_000_000e18);
        deal(address(templeGold), bob, 40_000_000e18);
    }

    function _authorize(bool value) internal {
        vm.prank(executor);
        templeGold.authorizeContract(address(auction), value);
    }

    function _depositTgld(address account, uint256 amount) internal {
        vm.startPrank(account);
        templeGold.approve(address(auction), amount);
        auction.deposit(amount);
        vm.stopPrank();
    }

    /// @dev Alice 60mm and Bob 40mm TGLD, funded to half, so every claim has both legs.
    function _halfFundedAuction() internal {
        _authorize(true);
        _toDeposit(auction);
        _depositTgld(alice, 60_000_000e18);
        _depositTgld(bob, 40_000_000e18);
        _toFulfillment(auction);
        _fund(auction, 2_330_000e18);
        _toEnd(auction);
    }

    function _assertHalfFundedPayouts() internal view {
        assertEq(templeGold.balanceOf(alice), 30_000_000e18);
        assertEq(usds.balanceOf(alice), 1_398_000e18);
        assertEq(templeGold.balanceOf(bob), 20_000_000e18);
        assertEq(usds.balanceOf(bob), 932_000e18);
        assertEq(templeGold.balanceOf(proceedsRecipient), 50_000_000e18);
        assertEq(templeGold.balanceOf(address(auction)), auction.bidOwed());
        assertEq(usds.balanceOf(address(auction)), auction.fillOwed());
    }

    function test_templeGold_depositsRevertUntilAuctionAuthorized() public {
        _toDeposit(auction);
        vm.startPrank(alice);
        templeGold.approve(address(auction), 1e18);
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.NonTransferrable.selector, alice, address(auction)));
        auction.deposit(1e18);
        vm.stopPrank();

        _authorize(true);
        _depositTgld(alice, 1e18);
        assertEq(auction.deposits(alice), 1e18);
    }

    /// @dev TempleGold checks only that the sender or the receiver is authorized, so an authorized depositor moves TGLD
    /// into and out of an unauthorized auction while an unauthorized one can't.
    function test_templeGold_authorizedDepositor_usesUnauthorizedAuction() public {
        vm.prank(executor);
        templeGold.authorizeContract(alice, true);
        _toDeposit(auction);
        _depositTgld(alice, 2e18);
        assertEq(templeGold.balanceOf(address(auction)), 2e18);

        vm.startPrank(bob);
        templeGold.approve(address(auction), 1e18);
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.NonTransferrable.selector, bob, address(auction)));
        auction.deposit(1e18);
        vm.stopPrank();

        vm.prank(alice);
        auction.withdrawDeposit(1e18);
        assertEq(templeGold.balanceOf(address(auction)), 1e18);
    }

    function test_templeGold_fullLifecycleOnceAuthorized() public {
        _halfFundedAuction();
        _claimAll(auction);
        _assertHalfFundedPayouts();
    }

    /// @dev De-authorizing a live auction makes every TGLD leg revert, and each user's USDS leg is stranded with it,
    /// until TempleGold's owner authorizes the auction again.
    function test_templeGold_deauthorizedMidLife_claimsRevertUntilReauthorized() public {
        _halfFundedAuction();
        _authorize(false);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.NonTransferrable.selector, address(auction), alice));
        auction.claim();
        vm.expectRevert(
            abi.encodeWithSelector(ITempleGold.NonTransferrable.selector, address(auction), proceedsRecipient)
        );
        auction.claimTreasury();
        assertEq(usds.balanceOf(alice), 0, "USDS leg paid without the TGLD leg");

        _authorize(true);
        _claimAll(auction);
        _assertHalfFundedPayouts();
    }
}

/// @dev Both auction tokens blocklist recipients, as USDC does, even for a zero amount.
contract FixedPriceAuctionBlocklistTokenTest is FixedPriceAuctionTestBase {
    FakeBlocklistERC20 internal bidToken;
    FakeBlocklistERC20 internal fillToken;

    function setUp() public override {
        super.setUp();
        bidToken = new FakeBlocklistERC20("Bid", "BID", 18, address(this));
        fillToken = new FakeBlocklistERC20("Fill", "FILL", 18, address(this));
        auction = _create(_config(address(bidToken), address(fillToken), PRICE, 0));
        _toDeposit(auction);
        _deposit(auction, alice, 60_000_000e18);
        _deposit(auction, bob, 40_000_000e18);
        _toFulfillment(auction);
    }

    /// @dev Fully filled: no bid refund and no funder refund, so blocking those recipients mustn't block the claims.
    function test_claims_skipZeroLegs_fullyFilled() public {
        _fund(auction, 4_660_000e18);
        _toEnd(auction);
        bidToken.setBlocked(alice, true);
        fillToken.setBlocked(funder, true);

        vm.prank(alice);
        auction.claim();
        assertEq(fillToken.balanceOf(alice), 2_796_000e18);
        auction.claimTreasury();
        assertEq(bidToken.balanceOf(proceedsRecipient), 100_000_000e18);
    }

    /// @dev Unfunded: no fill and no proceeds, so blocking those recipients mustn't block the refunds.
    function test_claims_skipZeroLegs_unfunded() public {
        _toEnd(auction);
        fillToken.setBlocked(alice, true);
        bidToken.setBlocked(proceedsRecipient, true);

        vm.prank(alice);
        auction.claim();
        assertEq(bidToken.balanceOf(alice), 60_000_000e18);
        auction.claimTreasury();
        assertTrue(auction.treasuryClaimed());
    }
}
