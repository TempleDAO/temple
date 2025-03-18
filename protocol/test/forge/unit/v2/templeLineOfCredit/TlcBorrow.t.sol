pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleLineOfCreditTestBorrow is TlcBaseTest {
    function test_borrow_failsUnderMinAmount() external {
        addCollateral(alice, 10_000e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InsufficientAmount.selector, 1_000e18, 999e18));
        tlc.borrow(999e18, alice);
    }

    function test_borrow_failsZeroLtv() external {
        addCollateral(alice, 10_000e18);
        
        vm.prank(executor);
        tlc.setMaxLtvRatio(0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, 10_000e18, collateralValue(10_000e18), 1_000e18));
        tlc.borrow(1_000e18, alice);
    }

    function test_borrow_failCheckLiquidity() external {
        uint128 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        // Borrow 80% of max
        uint128 borrowAmount = maxBorrowInfo.daiMaxBorrow * 8/10;

        // Lower the maxLTV       
        vm.startPrank(executor);
        tlc.setMaxLtvRatio(0.5e18);

        // Now alice can't execute on the borrow
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, collateralAmount, collateralValue(collateralAmount), borrowAmount));
        tlc.borrow(borrowAmount, alice);

        // Can now borrow a smaller amount and still be healthy.
        borrowAmount = maxBorrowInfo.daiMaxBorrow * 4/10;
        tlc.borrow(borrowAmount, alice);
        AccountPosition memory position = tlc.accountPosition(alice);
        assertGt(position.healthFactor, 1e18);
    }

    function test_borrowDai_success() external {
        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        uint128 borrowAmount = 90_000e18;

        uint128 collateralAmount = 200_000e18;
        addCollateral(alice, collateralAmount);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        uint256 trvBalBefore = daiToken.balanceOf(address(trv));
        uint256 tlcBalBefore = daiToken.balanceOf(address(tlc));
        uint256 tlcStrategyBefore = daiToken.balanceOf(address(tlcStrategy));
        uint256 aliceBalBefore = daiToken.balanceOf(address(alice));

        {
            vm.startPrank(alice);
            vm.warp(block.timestamp+BORROW_REQUEST_MIN_SECS);

            // An IR update is logged for DAI
            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(0.1e18-1);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, borrowAmount);

            tlc.borrow(borrowAmount, alice);
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
                expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator
            })
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
        uint128 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        uint128 borrowAmount = 50_000e18;
        vm.startPrank(alice);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, bob, borrowAmount);
        tlc.borrow(borrowAmount, bob);
        
        assertEq(daiToken.balanceOf(alice), 0);
        assertEq(daiToken.balanceOf(bob), borrowAmount);
    }

    function test_pause_borrow() public {
        uint128 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(executor);
        tlc.setBorrowPaused(true);

        uint128 borrowAmount = 50_000e18;
        vm.startPrank(alice);

        vm.expectRevert(abi.encodeWithSelector(Paused.selector));
        tlc.borrow(borrowAmount, alice);

        // Unpause
        vm.startPrank(executor);
        tlc.setBorrowPaused(false);

        vm.startPrank(alice);
        tlc.borrow(borrowAmount, alice);
    }

    function test_borrow_rescueMode() public {
        uint128 collateralAmount = 100_000e18;
        uint128 borrowAmount = 50_000e18;
        addCollateral(alice, collateralAmount);

        {
            vm.startPrank(rescuer);
            tlc.setRescueMode(true);

            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            tlc.borrow(borrowAmount, alice);

            vm.startPrank(rescuer);
            tlc.setRescueMode(false);

            vm.startPrank(alice);
            tlc.borrow(borrowAmount, alice);
        }
    }

    function test_borrow_circuitBreaker() public {
        uint128 collateralAmount = 1_000_000e18;
        addCollateral(alice, collateralAmount);
        
        vm.startPrank(executor);
        daiCircuitBreaker.updateCap(10_000e18);

        vm.startPrank(alice);
        tlc.borrow(10_000e18, alice);

        // Circuit breaker breached
        vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 11_000e18, 10_000e18));
        tlc.borrow(1_000e18, alice);

        // OK again after a day
        vm.warp(block.timestamp + 26 hours);
        tlc.borrow(1_000e18, alice);
    }

    function _borrowIteration(address account) internal returns (uint256 first, uint256 second, uint256 third) {
        uint128 collateralAmount = 100_000e18;
        uint128 borrowAmount = 1_000e18;

        addCollateral(account, collateralAmount);
        vm.startPrank(account);
        uint256 gasStart = gasleft();
        tlc.borrow(borrowAmount, account);
        first = gasStart-gasleft();
        gasStart = gasleft();
        tlc.borrow(borrowAmount, account);
        second = gasStart-gasleft();
        vm.warp(block.timestamp + 2 days);
        gasStart = gasleft();
        tlc.borrow(borrowAmount, account);
        third = gasStart-gasleft();
    }

    function test_borrow_gas() public {
        // With unoptmised solc FOUNDRY_PROFILE=lite
        (uint256 first, uint256 second, uint256 third) = _borrowIteration(makeAddr("acct1"));
        assertLt(first, 310_500, "acct1 1");
        assertLt(second, 210_812, "acct1 2");
        assertLt(third, 241_500, "acct1 3");

        (first, second, third) = _borrowIteration(makeAddr("acct2"));
        assertLt(first, 247_420, "acct2 1");
        assertLt(second, 210_800, "acct2 2");
        assertLt(third, 241_530, "acct2 3");
        
        (first, second, third) = _borrowIteration(makeAddr("acct3"));
        assertLt(first, 247_420, "acct3 1");
        assertLt(second, 210_800, "acct3 2");
        assertLt(third, 241_530, "acct3 3");
    }
}