pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

contract TempleLineOfCreditTestBorrow is TlcBaseTest {

    function test_requestBorrow_failsZeroBalance() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.requestBorrow(daiToken, 0);
    }

    function test_requestBorrow_failsBadToken() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidToken.selector, address(templeToken)));
        vm.prank(alice);
        tlc.requestBorrow(templeToken, 100);
    }

    function test_requestBorrow_failsNoCollateral() external {
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, 0, 100, 0));
        vm.prank(alice);
        tlc.requestBorrow(daiToken, 100);
    }

    function test_requestBorrow_failsNotEnoughCollateral() external {
        addCollateral(alice, 10e18);
        vm.prank(alice);

        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, 10e18, 10e18, 0));
        tlc.requestBorrow(daiToken, 10e18);
    }

    function test_requestBorrow_failsOverflow() external {
        addCollateral(alice, 10e18);
        vm.prank(alice);

        vm.expectRevert(abi.encodeWithSelector(SafeCast.Overflow.selector, 2**128 + 1));
        tlc.requestBorrow(daiToken, 2**128 + 1);
    }

    function test_requestBorrow_success() external {
        addCollateral(alice, 10e18);
        vm.prank(alice);

        vm.expectEmit(address(tlc));
        emit BorrowRequested(alice, address(daiToken), 1e18);
        tlc.requestBorrow(daiToken, 1e18);

        (,, AccountDebtData memory daiDebtData,) = tlc.accountData(alice);
        assertEq(daiDebtData.borrowRequest.amount, 1e18);
        assertEq(daiDebtData.borrowRequest.requestedAt, block.timestamp);
    }

    function test_cancelBorrow_failsBadToken() external {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidToken.selector, address(templeToken)));
        tlc.cancelBorrowRequest(alice, templeToken);
    }

    function test_cancelBorrowRequest_failsBadAccess() public {
        addCollateral(alice, 10e18);

        // Works for alice
        {
            vm.startPrank(alice);
            tlc.requestBorrow(daiToken, 1e18);
            vm.expectEmit(address(tlc));
            emit BorrowRequestCancelled(alice, address(daiToken));
            tlc.cancelBorrowRequest(alice, daiToken);
        }

        // Works for executor
        {
            tlc.requestBorrow(daiToken, 1e18);
            changePrank(executor);
            vm.expectEmit(address(tlc));
            emit BorrowRequestCancelled(alice, address(daiToken));
            tlc.cancelBorrowRequest(alice, daiToken);
        }

        // Works for operator when whitelisted
        {
            changePrank(alice);
            tlc.requestBorrow(daiToken, 1e18);

            changePrank(executor);
            tlc.setExplicitAccess(operator, TempleLineOfCredit.cancelBorrowRequest.selector, true);

            changePrank(operator);
            vm.expectEmit(address(tlc));
            emit BorrowRequestCancelled(alice, address(daiToken));
            tlc.cancelBorrowRequest(alice, daiToken);
        }

        // Fails for bob
        {
            changePrank(alice);
            tlc.requestBorrow(daiToken, 1e18);
            changePrank(bob);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            tlc.cancelBorrowRequest(alice, daiToken);
        }
    }

    function test_cancelBorrowRequest_failsNoRequest() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vm.startPrank(alice);
        tlc.cancelBorrowRequest(alice, daiToken);
    }       

    function test_cancelBorrowRequest_success() public {
        uint256 collateralAmount = 10e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, 1e18);

        vm.expectEmit(address(tlc));
        emit BorrowRequestCancelled(alice, address(daiToken));
        tlc.cancelBorrowRequest(alice, daiToken);

        (,, AccountDebtData memory daiDebtData,) = tlc.accountData(alice);
        assertEq(daiDebtData.borrowRequest.amount, 0);
        assertEq(daiDebtData.borrowRequest.requestedAt, 0);
    }

    function test_borrow_failsBadToken() external {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidToken.selector, address(templeToken)));
        tlc.borrow(templeToken, alice);
    }

    function test_borrow_failBeforeCooldown() public {
        uint256 collateralAmount = 10e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, 1e18);

        uint32 ts = uint32(block.timestamp);
        vm.warp(block.timestamp + 30);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, ts, BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS));
        tlc.borrow(daiToken, alice);
    }

    function test_borrow_successAtCooldownMin() public {
        uint256 collateralAmount = 10e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, 1e18);

        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, alice, address(daiToken), 1e18);
        tlc.borrow(daiToken, alice);

        // Check the request has been removed
        (,, AccountDebtData memory daiDebtData,) = tlc.accountData(alice);
        assertEq(daiDebtData.borrowRequest.amount, 0);
        assertEq(daiDebtData.borrowRequest.requestedAt, 0);
    }

    function test_borrow_failAfterExpiry() public {
        uint256 collateralAmount = 10e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, 1e18);

        uint32 ts = uint32(block.timestamp);
        vm.warp(block.timestamp + 121);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, ts, BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS));
        tlc.borrow(daiToken, alice);
    }

    function test_borrow_successAtCooldownMax() public {
        uint256 collateralAmount = 10e18;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, 1e18);

        vm.warp(block.timestamp + BORROW_REQUEST_MAX_SECS);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, alice, address(daiToken), 1e18);
        tlc.borrow(daiToken, alice);
    }

    function test_borrow_failsNoRequest() external {
        addCollateral(alice, 10e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, 0, BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS));
        tlc.borrow(daiToken, alice);
    }

    function test_borrow_failCheckLiquidity() external {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        // Borrow 80% of max
        uint256 borrowAmount = maxBorrowInfo.daiMaxBorrow * 8/10;

        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, borrowAmount);

        // Lower the maxLTV       
        changePrank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.5e18);

        // Alice is now underwater for that borrow amount
        AccountPosition memory position = tlc.accountPosition(alice, true);
        assertEq(position.daiDebtPosition.maxBorrow, 48_500e18);
        assertApproxEqRel(position.daiDebtPosition.healthFactor, 0.73529e18, 0.0001e18);
        assertEq(position.daiDebtPosition.loanToValueRatio, 0.68e18);

        // Now alice can't execute on the borrow
        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);
        changePrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector, collateralAmount, borrowAmount, 0));
        tlc.borrow(daiToken, alice);

        // But she can still cancel the request, and re-go for a smaller amount
        tlc.cancelBorrowRequest(alice, daiToken);

        // Position now drops
        position = tlc.accountPosition(alice, true);
        assertEq(position.daiDebtPosition.maxBorrow, 48_500e18);
        assertEq(position.daiDebtPosition.healthFactor, type(uint256).max);
        assertEq(position.daiDebtPosition.loanToValueRatio, 0);

        // Can now borrow a smaller amount and still be healthy.
        borrowAmount = maxBorrowInfo.daiMaxBorrow * 4/10;
        tlc.requestBorrow(daiToken, borrowAmount);
        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);
        tlc.borrow(daiToken, alice);
        position = tlc.accountPosition(alice, true);
        assertGt(position.daiDebtPosition.healthFactor, 1e18);
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

        uint32 tsBefore = uint32(block.timestamp);
        {
            vm.startPrank(alice);
            tlc.requestBorrow(daiToken, borrowAmount);
            vm.warp(block.timestamp+BORROW_REQUEST_MIN_SECS);

            // An IR update is logged for DAI
            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), 0.1e18-1);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(daiToken), borrowAmount);

            tlc.borrow(daiToken, alice);

            // Fails now since the request was cleared.
            vm.expectRevert(abi.encodeWithSelector(
                ITlcEventsAndErrors.NotInFundsRequestWindow.selector,
                block.timestamp,
                0,
                BORROW_REQUEST_MIN_SECS,
                BORROW_REQUEST_MAX_SECS
            ));
            tlc.borrow(daiToken, alice);
            vm.stopPrank();
        }

        checkDebtTokenDetails(daiToken, borrowAmount, 0.1e18, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));
        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, tsBefore);

        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: borrowAmount,
                expectedOudBalance: 0,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: collateralAmount,
                    daiDebtPosition: createDebtPosition(daiToken, borrowAmount, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: borrowAmount,
                expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
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
            (
                ITempleStrategy.AssetBalance[] memory assetBalances, 
                uint256 debt
            ) = tlcStrategy.latestAssetBalances();
            assertEq(debt, borrowAmount);
            assertEq(assetBalances.length, 2);
            assertEq(assetBalances[0].asset, address(daiToken));
            assertEq(assetBalances[0].balance, borrowAmount);   
            assertEq(assetBalances[1].asset, address(oudToken));
            assertEq(assetBalances[1].balance, 0);   
        }

        // borrow(alice, 10 ether, 1 ether, 0, BORROW_REQUEST_MIN_SECS);
        // borrow(unauthorizedUser, 10 ether, 1 ether, 0, BORROW_REQUEST_MIN_SECS);
        // borrow(rescuer, 10 ether, 1 ether, 0, BORROW_REQUEST_MIN_SECS);
        // borrow(rescuer, 0.1e18, 1 ether, 0, BORROW_REQUEST_MIN_SECS);
    }

    function test_borrowOudOnly_success() external {
        // For OUD, it's a flat rate of 5% interest rate
        uint256 borrowAmount = 10_000e18;

        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        uint256 oudSupplyBefore = oudToken.totalSupply();
        uint256 tlcBalBefore = oudToken.balanceOf(address(tlc));
        uint256 aliceBalBefore = oudToken.balanceOf(address(alice));

        uint32 tsBefore = uint32(block.timestamp);
        {
            vm.startPrank(alice);
            tlc.requestBorrow(oudToken, borrowAmount);
            vm.warp(block.timestamp+BORROW_REQUEST_MIN_SECS);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(oudToken), oudInterestRate);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(oudToken), borrowAmount);

            tlc.borrow(oudToken, alice);

            // Fails now since the request was cleared.
            vm.expectRevert(abi.encodeWithSelector(
                ITlcEventsAndErrors.NotInFundsRequestWindow.selector,
                block.timestamp,
                0,
                BORROW_REQUEST_MIN_SECS,
                BORROW_REQUEST_MAX_SECS
            ));
            tlc.borrow(oudToken, alice);
            vm.stopPrank();
        }

        checkDebtTokenDetails(daiToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, tsBefore);
        checkDebtTokenDetails(oudToken, borrowAmount, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: 0,
                expectedOudBalance: borrowAmount,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: collateralAmount,
                    daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, borrowAmount, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: borrowAmount,
                expectedOudAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );

        uint256 oudSupplyAfter = oudToken.totalSupply();
        uint256 tlcBalAfter = oudToken.balanceOf(address(tlc));
        uint256 aliceBalAfter = oudToken.balanceOf(address(alice));

        assertEq(oudSupplyAfter, oudSupplyBefore+borrowAmount);
        assertEq(tlcBalAfter, tlcBalBefore);
        assertEq(aliceBalAfter, aliceBalBefore+borrowAmount);

        // Check nothing was borrowed from the TRV
        {
            (
                ITempleStrategy.AssetBalance[] memory assetBalances, 
                uint256 debt
            ) = tlcStrategy.latestAssetBalances();
            assertEq(debt, 0);
            assertEq(assetBalances.length, 2);
            assertEq(assetBalances[0].asset, address(daiToken));
            assertEq(assetBalances[0].balance, 0);   
            assertEq(assetBalances[1].asset, address(oudToken));
            assertEq(assetBalances[1].balance, borrowAmount);   
        }

        // borrow(alice, 10 ether, 0, 1 ether, BORROW_REQUEST_MIN_SECS);
        // borrow(unauthorizedUser, 10 ether, 0, 1 ether, BORROW_REQUEST_MIN_SECS);
        // borrow(rescuer, 10 ether, 0, 1 ether, BORROW_REQUEST_MIN_SECS);
        // borrow(rescuer, 0.1e18, 0, 1 ether, BORROW_REQUEST_MIN_SECS);
    }

    function test_borrowDaiAndOudInParallel() external {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 borrowDaiAmount = maxBorrowInfo.daiMaxBorrow;
        uint256 borrowOudAmount = maxBorrowInfo.oudMaxBorrow;

        vm.startPrank(alice);

        int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount / 2, borrowCeiling);

        // Borrow half the max amount of each
        // uint32 tsBefore = uint32(block.timestamp);
        {
            tlc.requestBorrow(daiToken, borrowDaiAmount/2);
            tlc.requestBorrow(oudToken, borrowOudAmount/2);
            vm.warp(block.timestamp+BORROW_REQUEST_MIN_SECS);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), expectedDaiInterestRate);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(daiToken), borrowDaiAmount/2);

            tlc.borrow(daiToken, alice);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(oudToken), oudInterestRate);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(oudToken), borrowOudAmount/2);

            tlc.borrow(oudToken, alice);
        }

        // Verify
        {
            checkDebtTokenDetails(daiToken, borrowDaiAmount/2, expectedDaiInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
            checkDebtTokenDetails(oudToken, borrowOudAmount/2, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: borrowDaiAmount/2,
                    expectedOudBalance: borrowOudAmount/2,
                    expectedAccountPosition: AccountPosition({
                        collateralPosted: collateralAmount,
                        daiDebtPosition: createDebtPosition(daiToken, borrowDaiAmount/2, maxBorrowInfo),
                        oudDebtPosition: createDebtPosition(oudToken, borrowOudAmount/2, maxBorrowInfo)
                    }),
                    expectedDaiDebtCheckpoint: borrowDaiAmount/2,
                    expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedOudDebtCheckpoint: borrowOudAmount/2,
                    expectedOudAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        // Borrow the other half
        int96 updatedDaiInterestRate;
        {
            // Can almost get the full other half, but since there's some elapsed time, we can't borrow the exact
            // amount due to accrued interest. So take off 1e16
            tlc.requestBorrow(daiToken, (borrowDaiAmount / 2) - 1e16);
            tlc.requestBorrow(oudToken, (borrowOudAmount / 2) - 1e16);
            vm.warp(block.timestamp+BORROW_REQUEST_MIN_SECS);

            updatedDaiInterestRate = 95805553176705164;
            assertApproxEqRel(
                uint256(int256(calculateInterestRate(daiInterestRateModel, borrowDaiAmount-1e16, borrowCeiling))), 
                uint256(int256(updatedDaiInterestRate)),
                0.0001e18
            );

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), updatedDaiInterestRate);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(daiToken), (borrowDaiAmount / 2) - 1e16);

            tlc.borrow(daiToken, alice);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(oudToken), (borrowOudAmount / 2) - 1e16);

            // No OUD IR event as that hasn't changed.
            tlc.borrow(oudToken, alice);
        }

        // Check positions
        {
            uint256 daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, BORROW_REQUEST_MIN_SECS);
            uint256 oudAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, oudInterestRate, BORROW_REQUEST_MIN_SECS);

            checkDebtTokenDetails(daiToken, borrowDaiAmount, updatedDaiInterestRate, daiAccumulator, block.timestamp);
            checkDebtTokenDetails(oudToken, borrowOudAmount, oudInterestRate, oudAccumulator, block.timestamp);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: borrowDaiAmount-1e16,
                    expectedOudBalance: borrowOudAmount-1e16,
                    expectedAccountPosition: AccountPosition({
                        collateralPosted: collateralAmount,
                        daiDebtPosition: createDebtPosition(daiToken, borrowDaiAmount-1e16, maxBorrowInfo),
                        oudDebtPosition: createDebtPosition(oudToken, borrowOudAmount-1e16, maxBorrowInfo)
                    }),
                    expectedDaiDebtCheckpoint: borrowDaiAmount-1e16,
                    expectedDaiAccumulatorCheckpoint: daiAccumulator,
                    expectedOudDebtCheckpoint: borrowOudAmount-1e16,
                    expectedOudAccumulatorCheckpoint: oudAccumulator,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        // Now pretty much at the cap, just pennies left so 1e16 reverts.
        vm.expectRevert(abi.encodeWithSelector(ITlcEventsAndErrors.ExceededMaxLtv.selector, collateralAmount, 82450005718069296582000, 89999994280822121375000)); 
        tlc.requestBorrow(daiToken, 1e16);

        vm.expectRevert(abi.encodeWithSelector(ITlcEventsAndErrors.ExceededMaxLtv.selector, collateralAmount, 82449995718069296582000, 90000004280822121375000)); 
        tlc.requestBorrow(oudToken, 1e16);
    }

    function test_borrow_differentRecipient() public {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        uint256 borrowAmount = 50_000e18;
        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, borrowAmount);
        tlc.requestBorrow(oudToken, borrowAmount);
        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, bob, address(daiToken), borrowAmount);
        tlc.borrow(daiToken, bob);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, bob, address(oudToken), borrowAmount);
        tlc.borrow(oudToken, bob);
        
        assertEq(daiToken.balanceOf(alice), 0);
        assertEq(daiToken.balanceOf(bob), borrowAmount);

        assertEq(oudToken.balanceOf(alice), 0);
        assertEq(oudToken.balanceOf(bob), borrowAmount);
    }

    function test_borrow_noWait() public {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        vm.prank(executor);
        tlc.setBorrowRequestWindow(daiToken, 0, 0);

        uint256 borrowAmount = 50_000e18;
        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, borrowAmount);

        vm.expectEmit(address(tlc));
        emit Borrow(alice, alice, address(daiToken), borrowAmount);
        tlc.borrow(daiToken, alice);
    }

    function test_pause_borrow() public {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        vm.prank(executor);
        tlc.setBorrowRequestWindow(daiToken, 1, 0);

        uint256 borrowAmount = 50_000e18;
        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, borrowAmount);

        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, block.timestamp, 1, 0));
        tlc.borrow(daiToken, alice);

        vm.warp(block.timestamp + 1);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, block.timestamp-1, 1, 0));
        tlc.borrow(daiToken, alice);

        // OUD is unaffected
        tlc.requestBorrow(oudToken, borrowAmount);
        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);
        vm.expectEmit(address(tlc));
        emit Borrow(alice, alice, address(oudToken), borrowAmount);
        tlc.borrow(oudToken, alice);
    }
}