pragma solidity 0.8.20;
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
        uint128 borrowDaiAmount = 50_000e18; // 50% UR, ... At kink approximately 10% interest rate
        uint128 collateralAmount = 200_000e18;

        Balances memory balancesBefore = getBalances();
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        uint32 tsBefore = uint32(block.timestamp);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        vm.startPrank(alice);

        uint96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, BORROW_CEILING); // 7.77 %
        uint256 expectedDaiDebt = approxInterest(borrowDaiAmount, expectedDaiInterestRate, 365 days); // ~54k

        daiToken.approve(address(tlc), borrowDaiAmount);

        // Repay and check state
        {
            uint256 daiTotalDebt = checkTotalDebtPosition(
                utilizationRatio(expectedDaiDebt, BORROW_CEILING),
                expectedDaiInterestRate,
                expectedDaiDebt
            );

            checkDebtTokenDetails(borrowDaiAmount, expectedDaiInterestRate, expectedDaiAccumulator, tsBefore);

            uint96 updatedDaiInterestRate = calculateInterestRate(daiInterestRateModel, daiTotalDebt-borrowDaiAmount, BORROW_CEILING);
            expectedDaiDebt -= borrowDaiAmount;

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(updatedDaiInterestRate);
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, borrowDaiAmount);
            tlc.repay(borrowDaiAmount, alice);

            // Check Reserve Token state
            expectedDaiAccumulator = approxInterest(expectedDaiAccumulator, expectedDaiInterestRate, 365 days);
            checkDebtTokenDetails(
                expectedDaiDebt, 
                updatedDaiInterestRate,
                expectedDaiAccumulator, 
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
                    expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator
                })
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
            assertEq(assetBalances.length, 1);
            assertEq(assetBalances[0].asset, address(daiToken));
            assertApproxEqRel(assetBalances[0].balance, expectedDaiDebt, 1e10);
        }
    }

    function test_repayOnBehalfOf_success() external {
        uint128 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        uint128 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding
        AccountPosition memory position = tlc.accountPosition(alice);
        
        dealAdditional(daiToken, bob, position.currentDebt);

        vm.startPrank(bob);
        daiToken.approve(address(tlc), position.currentDebt);

        vm.expectEmit(address(tlc));
        emit InterestRateUpdate(MIN_BORROW_RATE);
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
        uint128 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate

        uint128 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        AccountPosition memory position = tlc.accountPosition(alice);

        // Repay the whole debt amount
        {
            // Deal extra for the accrued interest
            dealAdditional(daiToken, alice, position.currentDebt - borrowDaiAmount);

            vm.startPrank(alice);
            daiToken.approve(address(tlc), position.currentDebt);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(MIN_BORROW_RATE);
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, position.currentDebt);
            tlc.repay(position.currentDebt, alice);
        }

        uint96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, BORROW_CEILING);
        expectedDaiAccumulator = approxInterest(expectedDaiAccumulator, expectedDaiInterestRate, 365 days);

        // Check the Reserve Tokens
        {
            checkDebtTokenDetails(
                0, 
                5e18 / 100, // back to the base interest rate
                expectedDaiAccumulator, 
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
                    expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator
                })
            );
        }
    }

    function test_repayAll_failsZeroAmount() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.repayAll(alice);
    }

    function test_repayAll_success() external {
        uint128 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        
        uint128 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        AccountPosition memory position = tlc.accountPosition(alice);

        // RepayAll
        {
            // Deal extra for the accrued interest
            dealAdditional(daiToken, alice, position.currentDebt - borrowDaiAmount);

            vm.startPrank(alice);
            daiToken.approve(address(tlc), position.currentDebt);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(MIN_BORROW_RATE);
            vm.expectEmit(address(tlc));
            emit Repay(alice, alice, position.currentDebt);
            tlc.repayAll(alice);
        }

        uint96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, BORROW_CEILING);
        expectedDaiAccumulator = approxInterest(expectedDaiAccumulator, expectedDaiInterestRate, 365 days);

        // Check the Reserve Tokens
        {
            checkDebtTokenDetails(
                0, 
                5e18 / 100, // back to the base interest rate
                expectedDaiAccumulator, 
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
                    expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator
                })
            );
        }
    }

    function test_repayAllOnBehalfOf_success() external {
        uint128 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
        uint128 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding
        AccountPosition memory position = tlc.accountPosition(alice);
        
        dealAdditional(daiToken, bob, position.currentDebt);

        vm.startPrank(bob);
        daiToken.approve(address(tlc), position.currentDebt);

        vm.expectEmit(address(tlc));
        emit InterestRateUpdate(MIN_BORROW_RATE);
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

    function test_repay_rescueMode() public {
        uint128 borrowDaiAmount = 50_000e18;
        uint128 collateralAmount = 200_000e18;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        
        vm.startPrank(rescuer);
        tlc.setRescueMode(true);

        vm.startPrank(alice);
        daiToken.approve(address(tlc), borrowDaiAmount);
        {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            tlc.repay(1, alice);

            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            tlc.repayAll(alice);
        }

        vm.startPrank(rescuer);
        tlc.setRescueMode(false);

        {
            vm.startPrank(alice);
            tlc.repay(1, alice);
            tlc.repayAll(alice);
        }
    }

    function _repayIteration(address account) internal returns (uint256 first, uint256 second, uint256 third) {
        uint128 collateralAmount = 100_000e18;
        uint128 borrowAmount = 1_000e18;

        borrow(account, collateralAmount, borrowAmount*3, 0);
        vm.startPrank(account);
        daiToken.approve(address(tlc), borrowAmount*3);
        uint256 gasStart = gasleft();
        tlc.repay(borrowAmount, account);
        first = gasStart-gasleft();
        gasStart = gasleft();
        tlc.repay(borrowAmount, account);
        second = gasStart-gasleft();
        vm.warp(block.timestamp + 2 days);
        gasStart = gasleft();
        tlc.repay(borrowAmount, account);
        third = gasStart-gasleft();
    }

    function test_repay_gas() public {
        // With unoptmised solc FOUNDRY_PROFILE=lite
        (uint256 first, uint256 second, uint256 third) = _repayIteration(makeAddr("acct1"));
        assertLt(first, 167_100, "acct1 1");
        assertLt(second, 167_100, "acct1 2");
        assertLt(third, 175_500, "acct1 3");

        (first, second, third) = _repayIteration(makeAddr("acct2"));
        assertLt(first, 167_200, "acct2 1");
        assertLt(second, 167_200, "acct2 2");
        assertLt(third, 175_500, "acct2 3");
        
        (first, second, third) = _repayIteration(makeAddr("acct3"));
        assertLt(first, 167_200, "acct3 1");
        assertLt(second, 167_200, "acct3 2");
        assertLt(third, 175_500, "acct3 3");
    }
}