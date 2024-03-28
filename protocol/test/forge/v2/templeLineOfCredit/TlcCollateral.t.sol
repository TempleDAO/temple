pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleLineOfCreditTest_Collateral is TlcBaseTest {
    function test_addCollateral_failsZeroBalance() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.addCollateral(0, alice);
    }

    function test_addCollateral_success() external {
        uint128 collateralAmount = 200_000e18;

        // Alice posts collateral
        {
            deal(address(templeToken), alice, collateralAmount);
            vm.startPrank(alice);
            templeToken.approve(address(tlc), collateralAmount);

            vm.expectEmit(address(tlc));
            emit CollateralAdded(alice, alice, collateralAmount);

            tlc.addCollateral(collateralAmount, alice);
            assertEq(templeToken.balanceOf(address(tlc)), collateralAmount);
            assertEq(templeToken.balanceOf(alice), 0);

            MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: 0,
                    expectedAccountPosition: createAccountPosition(
                        collateralAmount, 0, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: 0,
                    expectedDaiAccumulatorCheckpoint: 0
                })
            );

            assertEq(tlc.totalCollateral(), collateralAmount);
        }

        // Alice posts collateral, but on behalf of Bob
        uint128 newCollateralAmount = 100_000e18;
        {
            deal(address(templeToken), alice, newCollateralAmount);
            templeToken.approve(address(tlc), newCollateralAmount);

            vm.expectEmit(address(tlc));
            emit CollateralAdded(alice, bob, newCollateralAmount);

            tlc.addCollateral(newCollateralAmount, bob);
            assertEq(templeToken.balanceOf(address(tlc)), collateralAmount + newCollateralAmount);
            assertEq(templeToken.balanceOf(alice), 0);
            assertEq(templeToken.balanceOf(bob), 0);

            MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(newCollateralAmount);
            checkAccountPosition(
                CheckAccountPositionParams({
                    account: bob,
                    expectedDaiBalance: 0,
                    expectedAccountPosition: createAccountPosition(
                        newCollateralAmount, 0, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: 0,
                    expectedDaiAccumulatorCheckpoint: 0
                })
            );
            
            assertEq(tlc.totalCollateral(), collateralAmount + newCollateralAmount);
        }
    }

    function test_removeCollateral_failsZeroAmount() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.removeCollateral(0, alice);
    }

    function test_removeCollateral_failsTooMuch() public {
        addCollateral(alice, 50);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAmount.selector, address(templeToken), 100));
        vm.prank(alice);
        tlc.removeCollateral(100, alice);
    }

    function test_removeCollateral_failCheckLiquidity() public {
        // Lower the max LTV between doing the request and actually removing collateral.
        uint128 collateralAmount = 10_000 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        // Borrow 70% of the max
        uint128 borrowAmount = maxBorrowInfo.daiMaxBorrow * 70 / 100;
        borrow(alice, collateralAmount, borrowAmount, BORROW_REQUEST_MIN_SECS);

        AccountPosition memory position = tlc.accountPosition(alice);
        assertEq(position.maxBorrow, maxBorrowInfo.daiMaxBorrow);
        assertApproxEqRel(position.healthFactor, 1.42857e18, 0.0001e18);
        assertEq(position.loanToValueRatio, 0.595e18);

        // Lower the maxLTV       
        vm.startPrank(executor);
        tlc.setMaxLtvRatio(0.5e18);

        // Alice is now underwater...
        position = tlc.accountPosition(alice);
        assertEq(position.maxBorrow, 4_850e18);
        assertApproxEqRel(position.healthFactor, 0.8403e18, 0.0001e18);
        assertEq(position.loanToValueRatio, 0.595e18);

        // Now alice can't execute on the remove collateral
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, collateralAmount-1, collateralValue(collateralAmount-1), borrowAmount));
        tlc.removeCollateral(1, alice);

        // If she repays some she can then remove some collateral and still be healthy
        daiToken.approve(address(tlc), borrowAmount/2);
        tlc.repay(borrowAmount/2, alice);

        tlc.removeCollateral(collateralAmount/3, alice);
        position = tlc.accountPosition(alice);
        assertGt(position.healthFactor, 1e18);
    }
    
    function test_removeCollateral_successWithChecks() public {
        uint128 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        assertEq(templeToken.balanceOf(alice), 0);

        vm.expectEmit(address(tlc));
        emit CollateralRemoved(alice, alice, 50);
        tlc.removeCollateral(50, alice);

        // The removeCollateral request is removed
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount-50);
        CheckAccountPositionParams memory params = CheckAccountPositionParams({
            account: alice,
            expectedDaiBalance: 0,
            expectedAccountPosition: createAccountPosition(
                collateralAmount-50, 0, maxBorrowInfo
            ),
            expectedDaiDebtCheckpoint: 0,
            expectedDaiAccumulatorCheckpoint: 0
        });
        checkAccountPosition(params);
        assertEq(tlc.totalCollateral(), collateralAmount-50);
        assertEq(templeToken.balanceOf(address(tlc)), collateralAmount-50);
        assertEq(templeToken.balanceOf(alice), 50);

        // Pull the rest
        tlc.removeCollateral(collateralAmount-50, alice);
        maxBorrowInfo = expectedMaxBorrows(0);
        params.expectedAccountPosition = createAccountPosition(
            0, 0, maxBorrowInfo
        );
        checkAccountPosition(params);
        assertEq(tlc.totalCollateral(), 0);
        assertEq(templeToken.balanceOf(address(tlc)), 0);
        assertEq(templeToken.balanceOf(alice), collateralAmount);
    }

    function test_removeCollateral_differentRecipient() public {
        uint128 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        assertEq(templeToken.balanceOf(alice), 0);

        vm.expectEmit(address(tlc));
        emit CollateralRemoved(alice, bob, 50);
        tlc.removeCollateral(50, bob);

        assertEq(templeToken.balanceOf(alice), 0);
        assertEq(templeToken.balanceOf(bob), 50);
        assertEq(templeToken.balanceOf(address(tlc)), collateralAmount-50);
    }

    function test_removeCollateral_rescueMode() public {
        uint128 collateralAmount = 100_000e18;
        deal(address(templeToken), alice, 2*collateralAmount);
        vm.startPrank(alice);
        templeToken.approve(address(tlc), 2*collateralAmount);

        {
            vm.startPrank(rescuer);
            tlc.setRescueMode(true);

            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            tlc.addCollateral(collateralAmount, alice);

            vm.startPrank(rescuer);
            tlc.setRescueMode(false);

            vm.startPrank(alice);
            tlc.addCollateral(collateralAmount, alice);
        }

        {
            vm.startPrank(rescuer);
            tlc.setRescueMode(true);

            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            tlc.removeCollateral(50, alice);

            vm.startPrank(rescuer);
            tlc.setRescueMode(false);

            vm.startPrank(alice);
            tlc.removeCollateral(50, alice);
        }
    }

    function test_removeCollateral_circuitBreaker() public {
        uint128 collateralAmount = 1_000_000e18;
        addCollateral(alice, collateralAmount);
        
        vm.startPrank(executor);
        templeCircuitBreaker.updateCap(100_000e18);

        vm.startPrank(alice);
        tlc.removeCollateral(100_000e18, alice);

        // Circuit breaker breached
        vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 100_000e18+1, 100_000e18));
        tlc.removeCollateral(1, alice);

        // OK again after a day
        vm.warp(block.timestamp + 26 hours);
        tlc.removeCollateral(1, alice);
    }

    function _addCollateralIteration(address account) internal returns (uint256 first, uint256 second, uint256 third) {
        uint128 collateralAmount = 100_000e18;

        deal(address(templeToken), account, collateralAmount*3);
        vm.startPrank(account);
        templeToken.approve(address(tlc), collateralAmount*3);
        uint256 gasStart = gasleft();
        tlc.addCollateral(collateralAmount, account);
        first = gasStart-gasleft();
        gasStart = gasleft();
        tlc.addCollateral(collateralAmount, account);
        second = gasStart-gasleft();
        vm.warp(block.timestamp + 2 days);
        gasStart = gasleft();
        tlc.addCollateral(collateralAmount, account);
        third = gasStart-gasleft();
    }

    function test_addCollateral_gas() public {
        // With unoptmised solc FOUNDRY_PROFILE=lite
        (uint256 first, uint256 second, uint256 third) = _addCollateralIteration(makeAddr("acct1"));
        assertLt(first, 115_000, "acct1 1");
        assertLt(second, 61_200, "acct1 2");
        assertLt(third, 51_600, "acct1 3");

        (first, second, third) = _addCollateralIteration(makeAddr("acct2"));
        assertLt(first, 78_300, "acct2 1");
        assertLt(second, 61_200, "acct2 2");
        assertLt(third, 51_600, "acct2 3");
        
        (first, second, third) = _addCollateralIteration(makeAddr("acct3"));
        assertLt(first, 78_300, "acct3 1");
        assertLt(second, 61_200, "acct3 2");
        assertLt(third, 51_600, "acct3 3");
    }

    function _removeCollateralIteration(address account) internal returns (uint256 first, uint256 second, uint256 third) {
        uint128 collateralAmount = 100_000e18;

        addCollateral(account, collateralAmount*3);
        vm.startPrank(account);
        uint256 gasStart = gasleft();
        tlc.removeCollateral(collateralAmount, account);
        first = gasStart-gasleft();
        gasStart = gasleft();
        tlc.removeCollateral(collateralAmount, account);
        second = gasStart-gasleft();
        vm.warp(block.timestamp + 2 days);
        gasStart = gasleft();
        tlc.removeCollateral(collateralAmount, account);
        third = gasStart-gasleft();
    }

    function test_removeCollateral_gas() public {
        // With unoptmised solc FOUNDRY_PROFILE=lite
        (uint256 first, uint256 second, uint256 third) = _removeCollateralIteration(makeAddr("acct1"));
        assertLt(first, 167_500, "acct1 1");
        assertLt(second, 150_322, "acct1 2");
        assertLt(third, 142_000, "acct1 3");

        (first, second, third) = _removeCollateralIteration(makeAddr("acct2"));
        assertLt(first, 163_300, "acct2 1");
        assertLt(second, 150_083, "acct2 2");
        assertLt(third, 142_000, "acct2 3");
        
        (first, second, third) = _removeCollateralIteration(makeAddr("acct3"));
        assertLt(first, 163_300, "acct3 1");
        assertLt(second, 150_083, "acct3 2");
        assertLt(third, 141_900, "acct3 3");
    }
}