pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleLineOfCreditTest_Collateral is TlcBaseTest {
    function test_addCollateral_failsZeroBalance() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.addCollateral(0, alice);
    }

    function test_addCollateral_failsOverflow() external {
        vm.expectRevert(abi.encodeWithSelector(SafeCast.Overflow.selector, 2**200));
        vm.prank(alice);
        tlc.addCollateral(2**200, alice);
    }
    
    function test_addCollateral_success() external {
        uint256 collateralAmount = 200_000e18;

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
                    expectedDaiAccumulatorCheckpoint: 0,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );

            assertEq(tlc.totalCollateral(), collateralAmount);
        }

        // Alice posts collateral, but on behalf of Bob
        uint256 newCollateralAmount = 100_000e18;
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
                    expectedDaiAccumulatorCheckpoint: 0,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
            
            assertEq(tlc.totalCollateral(), collateralAmount + newCollateralAmount);
        }
    }

    function test_requestRemoveCollateral_failsZeroBalance() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.requestRemoveCollateral(0);
    }

    function test_requestRemoveCollateral_failsTooMuch() public {
        addCollateral(alice, 50);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAmount.selector, address(templeToken), 100));
        vm.prank(alice);
        tlc.requestRemoveCollateral(100);
    }

    function test_requestRemoveCollateral_success() public {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);
        vm.prank(alice);

        vm.expectEmit(address(tlc));
        emit RemoveCollateralRequested(alice, 5e18);
        tlc.requestRemoveCollateral(5e18);

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount-5e18);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: 0,
                expectedAccountPosition: createAccountPosition(
                    collateralAmount-5e18, 0, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 5e18,
                expectedRemoveCollateralRequestAt: block.timestamp
            }),
            true
        );
    }

    function test_requestRemoveCollateral_failsCheckLiquidity() public {
        uint256 collateralAmount = 100_000e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        borrow(alice, collateralAmount, maxBorrowInfo.daiMaxBorrow, BORROW_REQUEST_MIN_SECS);

        // Can't remove any collateral now
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, collateralAmount-1, collateralValue(collateralAmount-1), maxBorrowInfo.daiMaxBorrow));
        vm.prank(alice);
        tlc.requestRemoveCollateral(1);
    }

    function test_cancelRemoveCollateralRequest_failsBadAccess() public {
        addCollateral(alice, 1000);

        // Works for alice
        {
            vm.startPrank(alice);
            tlc.requestRemoveCollateral(50);
            vm.expectEmit(address(tlc));
            emit RemoveCollateralRequestCancelled(alice);
            tlc.cancelRemoveCollateralRequest(alice);
        }

        // Works for executor
        {
            tlc.requestRemoveCollateral(50);
            changePrank(executor);
            vm.expectEmit(address(tlc));
            emit RemoveCollateralRequestCancelled(alice);
            tlc.cancelRemoveCollateralRequest(alice);
        }

        // Works for operator when whitelisted
        {
            changePrank(alice);
            tlc.requestRemoveCollateral(50);

            changePrank(executor);
            setExplicitAccess(tlc, address(operator), TempleLineOfCredit.cancelRemoveCollateralRequest.selector, true);

            changePrank(operator);
            vm.expectEmit(address(tlc));
            emit RemoveCollateralRequestCancelled(alice);
            tlc.cancelRemoveCollateralRequest(alice);
        }

        // Fails for bob
        {
            changePrank(alice);
            tlc.requestRemoveCollateral(50);
            changePrank(bob);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            tlc.cancelRemoveCollateralRequest(alice);
        }
    }

    function test_cancelRemoveCollateralRequest_failsNoRequest() public {
        addCollateral(alice, 1000);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vm.startPrank(alice);
        tlc.cancelRemoveCollateralRequest(alice);
    }       

    function test_cancelRemoveCollateralRequest_success() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount-50);
        CheckAccountPositionParams memory params = CheckAccountPositionParams({
            account: alice,
            expectedDaiBalance: 0,
            expectedAccountPosition: createAccountPosition(
                collateralAmount-50, 0, maxBorrowInfo
            ),
            expectedDaiDebtCheckpoint: 0,
            expectedDaiAccumulatorCheckpoint: 0,
            expectedRemoveCollateralRequest: 50,
            expectedRemoveCollateralRequestAt: block.timestamp
        });
        checkAccountPosition(params, true);
    
        vm.expectEmit(address(tlc));
        emit RemoveCollateralRequestCancelled(alice);
        tlc.cancelRemoveCollateralRequest(alice);

        maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        params.expectedAccountPosition = createAccountPosition(
            collateralAmount, 0, maxBorrowInfo
        );
        params.expectedRemoveCollateralRequest = 0;
        params.expectedRemoveCollateralRequestAt = 0;
        checkAccountPosition(params, true);
    }

    function test_removeCollateral_failNoRequest() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, 0, COLLATERAL_REQUEST_MIN_SECS, COLLATERAL_REQUEST_MAX_SECS));

        tlc.removeCollateral(alice);
    }

    function test_removeCollateral_failBeforeCooldown() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        uint32 ts = uint32(block.timestamp);
        vm.warp(block.timestamp + 29);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, ts, COLLATERAL_REQUEST_MIN_SECS, COLLATERAL_REQUEST_MAX_SECS));
        tlc.removeCollateral(alice);
    }

    function test_removeCollateral_successAtCooldownMin() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        vm.warp(block.timestamp + COLLATERAL_REQUEST_MIN_SECS);

        vm.expectEmit(address(tlc));
        emit CollateralRemoved(alice, alice, 50);
        tlc.removeCollateral(alice);
    }

    function test_removeCollateral_failAfterExpiry() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        uint32 ts = uint32(block.timestamp);
        vm.warp(block.timestamp + 46);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, ts, COLLATERAL_REQUEST_MIN_SECS, COLLATERAL_REQUEST_MAX_SECS));
        tlc.removeCollateral(alice);
    }

    function test_removeCollateral_successAtCooldownMax() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        vm.warp(block.timestamp + COLLATERAL_REQUEST_MAX_SECS);

        vm.expectEmit(address(tlc));
        emit CollateralRemoved(alice, alice, 50);
        tlc.removeCollateral(alice);
    }

    function test_removeCollateral_failCheckLiquidity() public {
        // Lower the max LTV between doing the request and actually removing collateral.
        uint256 collateralAmount = 10_000 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        // Borrow half
        uint256 borrowAmount = maxBorrowInfo.daiMaxBorrow / 2;
        borrow(alice, collateralAmount, borrowAmount, BORROW_REQUEST_MIN_SECS);

        AccountPosition memory position = tlc.accountPosition(alice, true);
        assertEq(position.maxBorrow, borrowAmount*2);
        assertEq(position.healthFactor, 2e18);
        assertEq(position.loanToValueRatio, 0.425e18);

        // Request the remaining half of the collateral back
        // Health = 1 (right at the limit)
        vm.startPrank(alice);
        tlc.requestRemoveCollateral(collateralAmount/2);
        
        position = tlc.accountPosition(alice, true);
        assertEq(position.maxBorrow, borrowAmount);
        assertEq(position.healthFactor, 1e18);
        assertEq(position.loanToValueRatio, 0.85e18);

        // Lower the maxLTV       
        changePrank(executor);
        tlc.setMaxLtvRatio(0.65e18);

        // Alice is now underwater...
        position = tlc.accountPosition(alice, true);
        assertEq(position.maxBorrow, 3_152.5e18);
        assertApproxEqRel(position.healthFactor, 0.7647e18, 0.0001e18);
        assertEq(position.loanToValueRatio, 0.85e18);

        // Now alice can't execute on the collateral remove request
        vm.warp(block.timestamp + COLLATERAL_REQUEST_MIN_SECS);
        changePrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, collateralAmount/2, collateralValue(collateralAmount/2), borrowAmount+205067233156703));
        tlc.removeCollateral(alice);

        // But she can still cancel the request, and re-go for a smaller amount
        tlc.cancelRemoveCollateralRequest(alice);

        // Position now drops
        position = tlc.accountPosition(alice, true);
        assertEq(position.maxBorrow, 6_305e18);
        assertApproxEqRel(position.healthFactor, 1.5294e18, 0.0001e18);
        assertApproxEqRel(position.loanToValueRatio, 0.425e18, 0.0001e18);

        // And can now remove 1/3 of the collateral and still be healthy
        tlc.requestRemoveCollateral(collateralAmount/3);
        vm.warp(block.timestamp + COLLATERAL_REQUEST_MIN_SECS);
        tlc.removeCollateral(alice);
        position = tlc.accountPosition(alice, true);
        assertGt(position.healthFactor, 1e18);
    }
    
    function test_removeCollateral_successWithChecks() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        vm.warp(block.timestamp + COLLATERAL_REQUEST_MIN_SECS);

        assertEq(templeToken.balanceOf(alice), 0);

        vm.expectEmit(address(tlc));
        emit CollateralRemoved(alice, alice, 50);
        tlc.removeCollateral(alice);

        // The removeCollateral request is removed
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount-50);
        CheckAccountPositionParams memory params = CheckAccountPositionParams({
            account: alice,
            expectedDaiBalance: 0,
            expectedAccountPosition: createAccountPosition(
                collateralAmount-50, 0, maxBorrowInfo
            ),
            expectedDaiDebtCheckpoint: 0,
            expectedDaiAccumulatorCheckpoint: 0,
            expectedRemoveCollateralRequest: 0,
            expectedRemoveCollateralRequestAt: 0
        });
        checkAccountPosition(params, true);
        assertEq(tlc.totalCollateral(), collateralAmount-50);
        assertEq(templeToken.balanceOf(address(tlc)), collateralAmount-50);
        assertEq(templeToken.balanceOf(alice), 50);

        // Pull the rest
        tlc.requestRemoveCollateral(collateralAmount-50);
        vm.warp(block.timestamp + COLLATERAL_REQUEST_MIN_SECS);
        tlc.removeCollateral(alice);
        maxBorrowInfo = expectedMaxBorrows(0);
        params.expectedAccountPosition = createAccountPosition(
            0, 0, maxBorrowInfo
        );
        checkAccountPosition(params, true);
        assertEq(tlc.totalCollateral(), 0);
        assertEq(templeToken.balanceOf(address(tlc)), 0);
        assertEq(templeToken.balanceOf(alice), collateralAmount);
    }

    function test_removeCollateral_differentRecipient() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        vm.warp(block.timestamp + COLLATERAL_REQUEST_MIN_SECS);
        assertEq(templeToken.balanceOf(alice), 0);

        vm.expectEmit(address(tlc));
        emit CollateralRemoved(alice, bob, 50);
        tlc.removeCollateral(bob);

        assertEq(templeToken.balanceOf(alice), 0);
        assertEq(templeToken.balanceOf(bob), 50);
        assertEq(templeToken.balanceOf(address(tlc)), collateralAmount-50);
    }

    function test_removeCollateral_noWait() public {
        vm.prank(executor);
        tlc.setWithdrawCollateralRequestConfig(0, 0);

        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        vm.expectEmit(address(tlc));
        emit CollateralRemoved(alice, alice, 50);
        tlc.removeCollateral(alice);
    }

    function test_pause_removeCollateral() public {
        vm.prank(executor);
        tlc.setWithdrawCollateralRequestConfig(1, 0);

        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, block.timestamp, 1, 0));
        tlc.removeCollateral(alice);

        vm.warp(block.timestamp + 1);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, block.timestamp-1, 1, 0));
        tlc.removeCollateral(alice);
    }
}