pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleLineOfCreditTestBorrow is TlcBaseTest {

    function test_requestBorrow_failsZeroBalance() external {
        vm.expectRevert(abi.encodeWithSelector(InsufficientAmount.selector, 1_000e18, 0));
        vm.prank(alice);
        tlc.requestBorrow(0);
    }

    function test_requestBorrow_failsUnderMinAmount() external {
        vm.expectRevert(abi.encodeWithSelector(InsufficientAmount.selector, 1_000e18, 999e18));
        vm.prank(alice);
        tlc.requestBorrow(999e18);
    }

    function test_requestBorrow_failsNoCollateral() external {
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, 0, 0, 1_000e18));
        vm.prank(alice);
        tlc.requestBorrow(1_000e18);
    }

    function test_requestBorrow_failsNotEnoughCollateral() external {
        addCollateral(alice, 1_000e18);
        vm.prank(alice);

        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, 1_000e18, collateralValue(1_000e18), 1_000e18));
        tlc.requestBorrow(1_000e18);
    }

    function test_requestBorrow_failsOverflow() external {
        addCollateral(alice, 10_000e18);
        vm.prank(alice);

        vm.expectRevert(abi.encodeWithSelector(SafeCast.Overflow.selector, 2**128 + 1));
        tlc.requestBorrow(2**128 + 1);
    }

    function test_requestBorrow_failsZeroLtv() external {
        addCollateral(alice, 10_000e18);
        
        vm.prank(executor);
        tlc.setMaxLtvRatio(0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, 10_000e18, collateralValue(10_000e18), 1_000e18));
        tlc.requestBorrow(1_000e18);
    }

    function test_requestBorrow_success() external {
        addCollateral(alice, 10_000e18);
        vm.prank(alice);

        vm.expectEmit(address(tlc));
        emit BorrowRequested(alice, 1_000e18);
        tlc.requestBorrow(1_000e18);

        AccountData memory accountData = tlc.accountData(alice);
        assertEq(accountData.borrowRequestAmount, 1_000e18);
        assertEq(accountData.borrowRequestAt, block.timestamp);
    }

    function test_cancelBorrowRequest_failsBadAccess() public {
        addCollateral(alice, 10_000e18);

        // Works for alice
        {
            vm.startPrank(alice);
            tlc.requestBorrow(1_000e18);
            vm.expectEmit(address(tlc));
            emit BorrowRequestCancelled(alice);
            tlc.cancelBorrowRequest(alice);
        }

        // Works for executor
        {
            tlc.requestBorrow(1_000e18);
            changePrank(executor);
            vm.expectEmit(address(tlc));
            emit BorrowRequestCancelled(alice);
            tlc.cancelBorrowRequest(alice);
        }

        // Works for operator when whitelisted
        {
            changePrank(alice);
            tlc.requestBorrow(1_000e18);

            changePrank(executor);
            setExplicitAccess(tlc, address(operator), TempleLineOfCredit.cancelBorrowRequest.selector, true);

            changePrank(operator);
            vm.expectEmit(address(tlc));
            emit BorrowRequestCancelled(alice);
            tlc.cancelBorrowRequest(alice);
        }

        // Fails for bob
        {
            changePrank(alice);
            tlc.requestBorrow(1_000e18);
            changePrank(bob);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            tlc.cancelBorrowRequest(alice);
        }
    }

    function test_cancelBorrowRequest_failsNoRequest() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vm.startPrank(alice);
        tlc.cancelBorrowRequest(alice);
    }       

    function test_cancelBorrowRequest_success() public {
        uint256 collateralAmount = 10_000e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(1_000e18);

        vm.expectEmit(address(tlc));
        emit BorrowRequestCancelled(alice);
        tlc.cancelBorrowRequest(alice);

        AccountData memory accountData = tlc.accountData(alice);
        assertEq(accountData.borrowRequestAmount, 0);
        assertEq(accountData.borrowRequestAt, 0);
    }

    function test_borrow_failBeforeCooldown() public {
        uint256 collateralAmount = 10_000e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(1_000e18);

        uint32 ts = uint32(block.timestamp);
        vm.warp(block.timestamp + 30);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, ts, BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS));
        tlc.borrow(alice);
    }

    function test_borrow_successAtCooldownMin() public {
        uint256 collateralAmount = 10_000e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(1_000e18);

        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, alice, 1_000e18);
        tlc.borrow(alice);

        // Check the request has been removed
        AccountData memory accountData = tlc.accountData(alice);
        assertEq(accountData.borrowRequestAmount, 0);
        assertEq(accountData.borrowRequestAt, 0);
    }

    function test_borrow_failAfterExpiry() public {
        uint256 collateralAmount = 10_000e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(1_000e18);

        uint32 ts = uint32(block.timestamp);
        vm.warp(block.timestamp + 121);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, ts, BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS));
        tlc.borrow(alice);
    }

    function test_borrow_successAtCooldownMax() public {
        uint256 collateralAmount = 10_000e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(1_000e18);

        vm.warp(block.timestamp + BORROW_REQUEST_MAX_SECS);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, alice, 1_000e18);
        tlc.borrow(alice);
    }

    function test_borrow_failsNoRequest() external {
        addCollateral(alice, 10_000e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, 0, BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS));
        tlc.borrow(alice);
    }

    function test_borrow_failCheckLiquidity() external {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        // Borrow 80% of max
        uint256 borrowAmount = maxBorrowInfo.daiMaxBorrow * 8/10;

        vm.startPrank(alice);
        tlc.requestBorrow(borrowAmount);

        // Lower the maxLTV       
        changePrank(executor);
        tlc.setMaxLtvRatio(0.5e18);

        // Alice is now underwater for that borrow amount
        AccountPosition memory position = tlc.accountPosition(alice, true);
        assertEq(position.maxBorrow, 48_500e18);
        assertApproxEqRel(position.healthFactor, 0.73529e18, 0.0001e18);
        assertEq(position.loanToValueRatio, 0.68e18);

        // Now alice can't execute on the borrow
        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);
        changePrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, collateralAmount, collateralValue(collateralAmount), borrowAmount));
        tlc.borrow(alice);

        // But she can still cancel the request, and re-go for a smaller amount
        tlc.cancelBorrowRequest(alice);

        // Position now drops
        position = tlc.accountPosition(alice, true);
        assertEq(position.maxBorrow, 48_500e18);
        assertEq(position.healthFactor, type(uint256).max);
        assertEq(position.loanToValueRatio, 0);

        // Can now borrow a smaller amount and still be healthy.
        borrowAmount = maxBorrowInfo.daiMaxBorrow * 4/10;
        tlc.requestBorrow(borrowAmount);
        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);
        tlc.borrow(alice);
        position = tlc.accountPosition(alice, true);
        assertGt(position.healthFactor, 1e18);
    }

    function test_borrowDaiOnly_success() external {
        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        uint256 borrowAmount = 90_000e18;

        uint256 collateralAmount = 200_000e18;
        addCollateral(alice, collateralAmount);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        uint256 trvBalBefore = daiToken.balanceOf(address(trv));
        uint256 tlcBalBefore = daiToken.balanceOf(address(tlc));
        uint256 tlcStrategyBefore = daiToken.balanceOf(address(tlcStrategy));
        uint256 aliceBalBefore = daiToken.balanceOf(address(alice));

        {
            vm.startPrank(alice);
            tlc.requestBorrow(borrowAmount);
            vm.warp(block.timestamp+BORROW_REQUEST_MIN_SECS);

            // An IR update is logged for DAI
            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(0.1e18-1);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, borrowAmount);

            tlc.borrow(alice);

            // Fails now since the request was cleared.
            vm.expectRevert(abi.encodeWithSelector(
                ITlcEventsAndErrors.NotInFundsRequestWindow.selector,
                block.timestamp,
                0,
                BORROW_REQUEST_MIN_SECS,
                BORROW_REQUEST_MAX_SECS
            ));
            tlc.borrow(alice);
            vm.stopPrank();
        }

        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        checkDebtTokenDetails(borrowAmount, 0.1e18, expectedDaiAccumulator, uint32(block.timestamp));

        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: borrowAmount,
                expectedAccountPosition: createAccountPosition(
                    collateralAmount, borrowAmount, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: borrowAmount,
                expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );

        uint256 trvBalAfter = daiToken.balanceOf(address(trv));
        uint256 tlcBalAfter = daiToken.balanceOf(address(tlc));
        uint256 tlcStrategyAfter = daiToken.balanceOf(address(tlcStrategy));
        uint256 aliceBalAfter = daiToken.balanceOf(address(alice));

        assertEq(trvBalAfter, trvBalBefore-borrowAmount);
        assertEq(tlcBalAfter, tlcBalBefore);
        assertEq(tlcStrategyAfter, tlcStrategyBefore);
        assertEq(aliceBalAfter, aliceBalBefore+borrowAmount);

        // Check the DAI amount was borrowed fom the TRV and recorded correctly
        {
            ITempleStrategy.AssetBalance[] memory assetBalances = tlcStrategy.latestAssetBalances();
            assertEq(assetBalances.length, 1);
            assertEq(assetBalances[0].asset, address(daiToken));
            assertEq(assetBalances[0].balance, borrowAmount);
        }

        // Gas tests
        // borrow(alice, 10000 ether, 1000 ether, BORROW_REQUEST_MIN_SECS);
        // borrow(unauthorizedUser, 10000 ether, 1000 ether, BORROW_REQUEST_MIN_SECS);
        // borrow(rescuer, 10000 ether, 1000 ether, BORROW_REQUEST_MIN_SECS);
        // borrow(rescuer, 10000 ether, 1000 ether, BORROW_REQUEST_MIN_SECS);
    }

    function test_borrow_differentRecipient() public {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        uint256 borrowAmount = 50_000e18;
        vm.startPrank(alice);
        tlc.requestBorrow(borrowAmount);
        tlc.requestBorrow(borrowAmount);
        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, bob, borrowAmount);
        tlc.borrow(bob);
        
        assertEq(daiToken.balanceOf(alice), 0);
        assertEq(daiToken.balanceOf(bob), borrowAmount);
    }

    function test_borrow_noWait() public {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        vm.prank(executor);
        tlc.setBorrowRequestConfig(0, 0);

        uint256 borrowAmount = 50_000e18;
        vm.startPrank(alice);
        tlc.requestBorrow(borrowAmount);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, alice, borrowAmount);
        tlc.borrow(alice);
    }

    function test_pause_borrow() public {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        vm.prank(executor);
        tlc.setBorrowRequestConfig(1, 0);

        uint256 borrowAmount = 50_000e18;
        vm.startPrank(alice);
        tlc.requestBorrow(borrowAmount);

        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, block.timestamp, 1, 0));
        tlc.borrow(alice);

        vm.warp(block.timestamp + 1);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, block.timestamp-1, 1, 0));
        tlc.borrow(alice);
    }
}