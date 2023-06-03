pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

contract TempleLineOfCreditTestRepay is TlcBaseTest {
    function test_repay_failsZeroAmount() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.repay(daiToken, 0, alice);
    }
    
    function test_repay_failsBadToken() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidToken.selector, address(templeToken)));
        vm.prank(alice);
        tlc.repay(templeToken, 100, alice);
    }
    
    function test_repay_failsNoBorrows() external {
        vm.expectRevert(abi.encodeWithSelector(ExceededBorrowedAmount.selector, address(daiToken), 0, 100));
        vm.prank(alice);
        tlc.repay(daiToken, 100, alice);
    }
    
    function test_repay_failsTooMuch() external {
        borrow(alice, 10 ether, 1 ether, 0, BORROW_REQUEST_MIN_SECS);
        vm.expectRevert(abi.encodeWithSelector(ExceededBorrowedAmount.selector, address(daiToken), 1e18, 1.01e18));
        vm.prank(alice);
        tlc.repay(daiToken, 1.01e18, alice);
    }

    struct Balances {
        uint256 daiTrv;
        uint256 daiTlc;
        uint256 daiTlcStrategy;
        uint256 daiAlice;
        uint256 daiBob;
        uint256 oudSupply;
        uint256 oudTlc;
        uint256 oudAlice;
        uint256 oudBob;
    }

    function getBalances() internal view returns (Balances memory) {
        return Balances(
            daiToken.balanceOf(address(trv)),
            daiToken.balanceOf(address(tlc)),
            daiToken.balanceOf(address(tlcStrategy)),
            daiToken.balanceOf(address(alice)),
            daiToken.balanceOf(address(bob)),
            oudToken.totalSupply(),
            oudToken.balanceOf(address(tlc)),
            oudToken.balanceOf(address(alice)),
            oudToken.balanceOf(address(bob))
        );
    }

    function test_repay_success() external {
        uint256 borrowDaiAmount = 50_000e18; // 50% UR, ... At kink approximately 10% interest rate
        uint256 borrowOudAmount = 20_000e18; // Flat interest rate of 5%
        uint256 collateralAmount = 200_000e18;

        Balances memory balancesBefore = getBalances();
        borrow(alice, collateralAmount, borrowDaiAmount, borrowOudAmount, BORROW_REQUEST_MIN_SECS);

        uint32 tsBefore = uint32(block.timestamp);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        vm.startPrank(alice);

        int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling); // 7.77 %
        uint256 expectedDaiDebt = approxInterest(borrowDaiAmount, expectedDaiInterestRate, 365 days); // ~54k
        uint256 expectedOudDebt = approxInterest(borrowOudAmount, oudInterestRate, 365 days);

        daiToken.approve(address(tlc), borrowDaiAmount);

        // Repay and check state
        uint256 daiAccumulator;
        uint256 oudAccumulator;
        {
            (uint256 daiTotalDebt,) = checkTotalPosition(
                utilizationRatio(expectedDaiDebt, borrowCeiling),
                expectedDaiInterestRate,
                expectedDaiDebt,
                oudInterestRate,
                expectedOudDebt
            );

            checkDebtTokenDetails(daiToken, borrowDaiAmount, expectedDaiInterestRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);
            checkDebtTokenDetails(oudToken, borrowOudAmount, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);

            int96 updatedDaiInterestRate = calculateInterestRate(daiInterestRateModel, daiTotalDebt-borrowDaiAmount, borrowCeiling);
            expectedDaiDebt -= borrowDaiAmount;
            expectedOudDebt -= borrowOudAmount;

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), updatedDaiInterestRate);
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, address(daiToken), borrowDaiAmount);
            tlc.repay(daiToken, borrowDaiAmount, alice);

           
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, address(oudToken), borrowOudAmount);
            // No InterestRateUpdate for OUD as the rate didn't change
            tlc.repay(oudToken, borrowOudAmount, alice);

            // Check Reserve Token state
            daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, 365 days);
            oudAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, oudInterestRate, 365 days);
            checkDebtTokenDetails(
                daiToken, 
                expectedDaiDebt, 
                updatedDaiInterestRate,
                daiAccumulator, 
                block.timestamp
            );
            checkDebtTokenDetails(
                oudToken, 
                expectedOudDebt, 
                oudInterestRate, 
                oudAccumulator, 
                block.timestamp
            );
        }

        // Check account position
        {
            MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: 0,
                    expectedOudBalance: 0,
                    expectedAccountPosition: AccountPosition({
                        collateralPosted: collateralAmount,
                        daiDebtPosition: createDebtPosition(daiToken, expectedDaiDebt, maxBorrowInfo),
                        oudDebtPosition: createDebtPosition(oudToken, expectedOudDebt, maxBorrowInfo)
                    }),
                    expectedDaiDebtCheckpoint: expectedDaiDebt,
                    expectedDaiAccumulatorCheckpoint: daiAccumulator,
                    expectedOudDebtCheckpoint: expectedOudDebt,
                    expectedOudAccumulatorCheckpoint: oudAccumulator,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        // And the total debt position
        {
            expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, borrowCeiling);
            checkTotalPosition(
                utilizationRatio(expectedDaiDebt, borrowCeiling),
                expectedDaiInterestRate,
                expectedDaiDebt,
                oudInterestRate,
                expectedOudDebt
            );
        }

        // And the balances
        {
            Balances memory balancesAfter = getBalances();

            assertEq(balancesAfter.daiTrv, balancesBefore.daiTrv);
            assertEq(balancesAfter.daiTlc, balancesBefore.daiTlc);
            assertEq(balancesAfter.daiTlcStrategy, balancesBefore.daiTlcStrategy);
            assertEq(balancesAfter.daiAlice, balancesBefore.daiAlice);
            assertEq(balancesAfter.oudSupply, balancesBefore.oudSupply);
            assertEq(balancesAfter.oudTlc, balancesBefore.oudTlc);
            assertEq(balancesAfter.oudAlice, balancesBefore.oudAlice);
        }
        
        // Check the DAI amount was repaid to the TRV and recorded correctly
        {
            (
                ITempleStrategy.AssetBalance[] memory assetBalances, 
                uint256 debt
            ) = tlcStrategy.latestAssetBalances();
            // dusd == any interest accrued
            assertApproxEqRel(debt, approxInterest(borrowDaiAmount, int96(uint96(defaultBaseInterest)), 365 days) - borrowDaiAmount, 1e10);
            assertEq(assetBalances.length, 2);
            assertEq(assetBalances[0].asset, address(daiToken));
            assertApproxEqRel(assetBalances[0].balance, expectedDaiDebt, 1e10);
            assertEq(assetBalances[1].asset, address(oudToken));
            assertApproxEqRel(assetBalances[1].balance, expectedOudDebt, 1e10);
        }
    }

    function test_repayOnBehalfOf_success() external {
        uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        uint256 borrowOudAmount = 20_000e18; // Flat interest rate of 5%
        uint256 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, borrowOudAmount, BORROW_REQUEST_MIN_SECS);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding
        AccountPosition memory position = tlc.accountPosition(alice, true);
        
        dealAdditional(daiToken, bob, position.daiDebtPosition.currentDebt);
        dealAdditional(oudToken, bob, position.oudDebtPosition.currentDebt);

        vm.startPrank(bob);
        daiToken.approve(address(tlc), position.daiDebtPosition.currentDebt);

        vm.expectEmit(address(tlc));
        emit InterestRateUpdate(address(daiToken), 0.05e18);
        vm.expectEmit(address(tlc));
        emit Repay(bob, alice, address(daiToken), position.daiDebtPosition.currentDebt);
        tlc.repay(daiToken, position.daiDebtPosition.currentDebt, alice);

        vm.expectEmit(address(tlc));
        emit Repay(bob, alice, address(oudToken), position.oudDebtPosition.currentDebt);
        tlc.repay(oudToken, position.oudDebtPosition.currentDebt, alice);

        Balances memory balancesAfter = getBalances();
        assertEq(balancesAfter.daiTrv, trvStartingBalance+position.daiDebtPosition.currentDebt-borrowDaiAmount);
        assertEq(balancesAfter.daiTlc, 0);
        assertEq(balancesAfter.daiTlcStrategy, 0);
        assertEq(balancesAfter.daiAlice, borrowDaiAmount);
        assertEq(balancesAfter.daiBob, 0);
        assertEq(balancesAfter.oudSupply, 500_000e18 + borrowOudAmount); // 500k initial supply at construction
        assertEq(balancesAfter.oudTlc, 0);
        assertEq(balancesAfter.oudAlice, borrowOudAmount);
        assertEq(balancesAfter.oudBob, 0);
    }

    function test_repayEverything_success() external {
        uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        uint256 borrowOudAmount = 20_000e18; // Flat interest rate of 5%

        uint256 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, borrowOudAmount, BORROW_REQUEST_MIN_SECS);

        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        AccountPosition memory position = tlc.accountPosition(alice, true);

        // Repay the whole debt amount
        {
            // Deal extra for the accrued interest
            dealAdditional(daiToken, alice, position.daiDebtPosition.currentDebt - borrowDaiAmount);
            dealAdditional(oudToken, alice, position.oudDebtPosition.currentDebt - borrowOudAmount);

            vm.startPrank(alice);
            daiToken.approve(address(tlc), position.daiDebtPosition.currentDebt);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), 0.05e18);
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, address(daiToken), position.daiDebtPosition.currentDebt);
            tlc.repay(daiToken, position.daiDebtPosition.currentDebt, alice);

            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, address(oudToken), position.oudDebtPosition.currentDebt);
            tlc.repay(oudToken, position.oudDebtPosition.currentDebt, alice);
        }

        int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);
        uint256 daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, 365 days);
        uint256 oudAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, oudInterestRate, 365 days);

        // Check the Reserve Tokens
        {
            checkDebtTokenDetails(
                daiToken, 
                0, 
                5e18 / 100, // back to the base interest rate
                daiAccumulator, 
                block.timestamp
            );
            checkDebtTokenDetails(
                oudToken, 
                0, 
                oudInterestRate, 
                oudAccumulator, 
                block.timestamp
            );
        }

        {
            // Check the account position
            MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: 0,
                    expectedOudBalance: 0,
                    expectedAccountPosition: AccountPosition({
                        collateralPosted: collateralAmount,
                        daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                        oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                    }),
                    expectedDaiDebtCheckpoint: 0,
                    expectedDaiAccumulatorCheckpoint: daiAccumulator,
                    expectedOudDebtCheckpoint: 0,
                    expectedOudAccumulatorCheckpoint: oudAccumulator,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }
    }

    function test_repayAll_failsZeroAmount() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.repayAll(daiToken, alice);
    }
    
    function test_repayAll_failsBadToken() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidToken.selector, address(templeToken)));
        vm.prank(alice);
        tlc.repayAll(templeToken, alice);
    }

    function test_repayAll_success() external {
        uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        uint256 borrowOudAmount = 20_000e18; // Flat interest rate of 5%
        
        uint256 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, borrowOudAmount, BORROW_REQUEST_MIN_SECS);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        AccountPosition memory position = tlc.accountPosition(alice, true);

        // RepayAll
        {
            // Deal extra for the accrued interest
            dealAdditional(daiToken, alice, position.daiDebtPosition.currentDebt - borrowDaiAmount);
            dealAdditional(oudToken, alice, position.oudDebtPosition.currentDebt - borrowOudAmount);

            vm.startPrank(alice);
            daiToken.approve(address(tlc), position.daiDebtPosition.currentDebt);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), 0.05e18);
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, address(daiToken), position.daiDebtPosition.currentDebt);
            tlc.repayAll(daiToken, alice);

            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, address(oudToken), position.oudDebtPosition.currentDebt);
            tlc.repayAll(oudToken, alice);
        }

        int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);
        uint256 daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, 365 days);
        uint256 oudAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, oudInterestRate, 365 days);

        // Check the Reserve Tokens
        {
            checkDebtTokenDetails(
                daiToken, 
                0, 
                5e18 / 100, // back to the base interest rate
                daiAccumulator, 
                block.timestamp
            );
            checkDebtTokenDetails(
                oudToken, 
                0, 
                oudInterestRate, 
                oudAccumulator, 
                block.timestamp
            );
        }

        {
            // Check the account position
            MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: 0,
                    expectedOudBalance: 0,
                    expectedAccountPosition: AccountPosition({
                        collateralPosted: collateralAmount,
                        daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                        oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                    }),
                    expectedDaiDebtCheckpoint: 0,
                    expectedDaiAccumulatorCheckpoint: daiAccumulator,
                    expectedOudDebtCheckpoint: 0,
                    expectedOudAccumulatorCheckpoint: oudAccumulator,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }
    }

    function test_repayAllOnBehalfOf_success() external {
        uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        uint256 borrowOudAmount = 20_000e18; // Flat interest rate of 5%
        uint256 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, borrowOudAmount, BORROW_REQUEST_MIN_SECS);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding
        AccountPosition memory position = tlc.accountPosition(alice, true);
        
        dealAdditional(daiToken, bob, position.daiDebtPosition.currentDebt);
        dealAdditional(oudToken, bob, position.oudDebtPosition.currentDebt);

        vm.startPrank(bob);
        daiToken.approve(address(tlc), position.daiDebtPosition.currentDebt);

        vm.expectEmit(address(tlc));
        emit InterestRateUpdate(address(daiToken), 0.05e18);
        vm.expectEmit(address(tlc));
        emit Repay(bob, alice, address(daiToken), position.daiDebtPosition.currentDebt);
        tlc.repayAll(daiToken, alice);

        vm.expectEmit(address(tlc));
        emit Repay(bob, alice, address(oudToken), position.oudDebtPosition.currentDebt);
        tlc.repayAll(oudToken, alice);

        Balances memory balancesAfter = getBalances();
        assertEq(balancesAfter.daiTrv, trvStartingBalance+position.daiDebtPosition.currentDebt-borrowDaiAmount);
        assertEq(balancesAfter.daiTlc, 0);
        assertEq(balancesAfter.daiTlcStrategy, 0);
        assertEq(balancesAfter.daiAlice, borrowDaiAmount);
        assertEq(balancesAfter.daiBob, 0);
        assertEq(balancesAfter.oudSupply, 500_000e18 + borrowOudAmount); // 500k initial supply at construction
        assertEq(balancesAfter.oudTlc, 0);
        assertEq(balancesAfter.oudAlice, borrowOudAmount);
        assertEq(balancesAfter.oudBob, 0);
    }

}