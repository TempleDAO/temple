pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleLineOfCreditTestRepay is TlcBaseTest {
    function test_repay_failsZeroAmount() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.repay(0, alice);
    }
    
    function test_repay_failsNoBorrows() external {
        vm.expectRevert(abi.encodeWithSelector(ExceededBorrowedAmount.selector, 0, 100));
        vm.prank(alice);
        tlc.repay(100, alice);
    }
    
    function test_repay_failsTooMuch() external {
        borrow(alice, 10_000e18, 1_000e18, BORROW_REQUEST_MIN_SECS);
        vm.expectRevert(abi.encodeWithSelector(ExceededBorrowedAmount.selector, 1_000e18, 1_001e18));
        vm.prank(alice);
        tlc.repay(1_001e18, alice);
    }

    struct Balances {
        uint256 daiTrv;
        uint256 daiTlc;
        uint256 daiTlcStrategy;
        uint256 daiAlice;
        uint256 daiBob;
    }

    function getBalances() internal view returns (Balances memory) {
        return Balances(
            daiToken.balanceOf(address(trv)),
            daiToken.balanceOf(address(tlc)),
            daiToken.balanceOf(address(tlcStrategy)),
            daiToken.balanceOf(address(alice)),
            daiToken.balanceOf(address(bob))
        );
    }

    function test_repay_success() external {
        uint256 borrowDaiAmount = 50_000e18; // 50% UR, ... At kink approximately 10% interest rate
        uint256 collateralAmount = 200_000e18;

        Balances memory balancesBefore = getBalances();
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);

        uint32 tsBefore = uint32(block.timestamp);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        vm.startPrank(alice);

        uint96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, BORROW_CEILING); // 7.77 %
        uint256 expectedDaiDebt = approxInterest(borrowDaiAmount, expectedDaiInterestRate, 365 days); // ~54k

        daiToken.approve(address(tlc), borrowDaiAmount);

        // Repay and check state
        uint256 daiAccumulator;
        {
            uint256 daiTotalDebt = checkTotalDebtPosition(
                utilizationRatio(expectedDaiDebt, BORROW_CEILING),
                expectedDaiInterestRate,
                expectedDaiDebt
            );

            checkDebtTokenDetails(borrowDaiAmount, expectedDaiInterestRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);

            uint96 updatedDaiInterestRate = calculateInterestRate(daiInterestRateModel, daiTotalDebt-borrowDaiAmount, BORROW_CEILING);
            expectedDaiDebt -= borrowDaiAmount;

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(updatedDaiInterestRate);
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, borrowDaiAmount);
            tlc.repay(borrowDaiAmount, alice);

            // Check Reserve Token state
            daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, 365 days);
            checkDebtTokenDetails(
                expectedDaiDebt, 
                updatedDaiInterestRate,
                daiAccumulator, 
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
                    expectedAccountPosition: createAccountPosition(
                        collateralAmount, expectedDaiDebt, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: expectedDaiDebt,
                    expectedDaiAccumulatorCheckpoint: daiAccumulator,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        // And the total debt position
        {
            expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, BORROW_CEILING);
            checkTotalDebtPosition(
                utilizationRatio(expectedDaiDebt, BORROW_CEILING),
                expectedDaiInterestRate,
                expectedDaiDebt
            );
        }

        // And the balances
        {
            Balances memory balancesAfter = getBalances();

            assertEq(balancesAfter.daiTrv, balancesBefore.daiTrv);
            assertEq(balancesAfter.daiTlc, balancesBefore.daiTlc);
            assertEq(balancesAfter.daiTlcStrategy, balancesBefore.daiTlcStrategy);
            assertEq(balancesAfter.daiAlice, balancesBefore.daiAlice);
        }
        
        // Check the DAI amount was repaid to the TRV and recorded correctly
        {
            ITempleStrategy.AssetBalance[] memory assetBalances = tlcStrategy.latestAssetBalances();
            // dusd == any interest accrued
            // assertApproxEqRel(debt, approxInterest(borrowDaiAmount, uint96(DEFAULT_BASE_INTEREST), 365 days) - borrowDaiAmount, 1e10);
            assertEq(assetBalances.length, 1);
            assertEq(assetBalances[0].asset, address(daiToken));
            assertApproxEqRel(assetBalances[0].balance, expectedDaiDebt, 1e10);
        }
    }

    function test_repayOnBehalfOf_success() external {
        uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        uint256 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding
        AccountPosition memory position = tlc.accountPosition(alice, true);
        
        dealAdditional(daiToken, bob, position.currentDebt);

        vm.startPrank(bob);
        daiToken.approve(address(tlc), position.currentDebt);

        vm.expectEmit(address(tlc));
        emit InterestRateUpdate(0.05e18);
        vm.expectEmit(address(tlc));
        emit Repay(bob, alice, position.currentDebt);
        tlc.repay(position.currentDebt, alice);

        Balances memory balancesAfter = getBalances();
        assertEq(balancesAfter.daiTrv, TRV_STARTING_BALANCE+position.currentDebt-borrowDaiAmount);
        assertEq(balancesAfter.daiTlc, 0);
        assertEq(balancesAfter.daiTlcStrategy, 0);
        assertEq(balancesAfter.daiAlice, borrowDaiAmount);
        assertEq(balancesAfter.daiBob, 0);
    }

    function test_repayEverything_success() external {
        uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate

        uint256 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);

        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        AccountPosition memory position = tlc.accountPosition(alice, true);

        // Repay the whole debt amount
        {
            // Deal extra for the accrued interest
            dealAdditional(daiToken, alice, position.currentDebt - borrowDaiAmount);

            vm.startPrank(alice);
            daiToken.approve(address(tlc), position.currentDebt);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(0.05e18);
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, position.currentDebt);
            tlc.repay(position.currentDebt, alice);
        }

        uint96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, BORROW_CEILING);
        uint256 daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, 365 days);

        // Check the Reserve Tokens
        {
            checkDebtTokenDetails(
                0, 
                5e18 / 100, // back to the base interest rate
                daiAccumulator, 
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
                    expectedAccountPosition: createAccountPosition(
                        collateralAmount, 0, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: 0,
                    expectedDaiAccumulatorCheckpoint: daiAccumulator,
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
        tlc.repayAll(alice);
    }

    function test_repayAll_success() external {
        uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        
        uint256 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        AccountPosition memory position = tlc.accountPosition(alice, true);

        // RepayAll
        {
            // Deal extra for the accrued interest
            dealAdditional(daiToken, alice, position.currentDebt - borrowDaiAmount);

            vm.startPrank(alice);
            daiToken.approve(address(tlc), position.currentDebt);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(0.05e18);
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, position.currentDebt);
            tlc.repayAll(alice);
        }

        uint96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, BORROW_CEILING);
        uint256 daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, 365 days);

        // Check the Reserve Tokens
        {
            checkDebtTokenDetails(
                0, 
                5e18 / 100, // back to the base interest rate
                daiAccumulator, 
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
                    expectedAccountPosition: createAccountPosition(
                        collateralAmount, 0, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: 0,
                    expectedDaiAccumulatorCheckpoint: daiAccumulator,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }
    }

    function test_repayAllOnBehalfOf_success() external {
        uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        uint256 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding
        AccountPosition memory position = tlc.accountPosition(alice, true);
        
        dealAdditional(daiToken, bob, position.currentDebt);

        vm.startPrank(bob);
        daiToken.approve(address(tlc), position.currentDebt);

        vm.expectEmit(address(tlc));
        emit InterestRateUpdate(0.05e18);
        vm.expectEmit(address(tlc));
        emit Repay(bob, alice, position.currentDebt);
        tlc.repayAll(alice);

        Balances memory balancesAfter = getBalances();
        assertEq(balancesAfter.daiTrv, TRV_STARTING_BALANCE+position.currentDebt-borrowDaiAmount);
        assertEq(balancesAfter.daiTlc, 0);
        assertEq(balancesAfter.daiTlcStrategy, 0);
        assertEq(balancesAfter.daiAlice, borrowDaiAmount);
        assertEq(balancesAfter.daiBob, 0);
    }

}