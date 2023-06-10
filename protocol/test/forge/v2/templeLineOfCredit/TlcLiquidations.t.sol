pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleLineOfCreditTestCheckLiquidity is TlcBaseTest {
    function test_computeLiquidity_noBorrowsNoCollateral() external {
        checkLiquidationStatus(alice, true, false, 0, 0);
        checkLiquidationStatus(alice, false, false, 0, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateral() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        checkLiquidationStatus(alice, true, false, collateralAmount, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateralAndRemoveRequest() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestRemoveCollateral(50_000);

        checkLiquidationStatus(alice, true, false, 50_000, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0);
    }

    function test_computeLiquidity_withBorrowRequestUnderMaxLTV() external {
        uint256 collateralAmount = 100_000e18;
        uint256 daiBorrowAmount = 20_000e18;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiBorrowAmount);
        
        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0);
    }

    function test_computeLiquidity_withBorrowRequestAtMaxLTV() external {
        uint256 collateralAmount = 100_000e18;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        tlc.requestBorrow(daiBorrowAmount);

        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0);
    }

    function test_computeLiquidity_withBorrowRequestOverMaxLTV() external {
        uint256 collateralAmount = 100_000e18;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        tlc.requestBorrow(daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(0.8e18);

        checkLiquidationStatus(alice, true, true, collateralAmount, daiBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0);
    }

    function test_computeLiquidity_withBorrowUnderMaxLTV() external {
        uint256 collateralAmount = 10_000e18;
        uint256 daiBorrowAmount = 1_000e18;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);

        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount);
    }

    function test_computeLiquidity_withBorrowAtMaxLTV() external {
        uint256 collateralAmount = 10_000e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);

        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount);
    }

    function test_computeLiquidity_withBorrowOverMaxLTV() external {
        uint256 collateralAmount = 10_000e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);

        vm.prank(executor);
        tlc.setMaxLtvRatio(0.8e18);

        checkLiquidationStatus(alice, true, true, collateralAmount, daiBorrowAmount);
        checkLiquidationStatus(alice, false, true, collateralAmount, daiBorrowAmount);
    }
    
    function test_computeLiquidity_withBorrowAndRequestUnderMaxLTV() external {
        uint256 collateralAmount = 50_000e18;
        uint256 daiBorrowAmount = 2_000e18;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);
        vm.prank(alice);
        tlc.requestBorrow(1_000e18);


        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount+1_000e18);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount);
    }

    function test_computeLiquidity_withBorrowAndRequestAtMaxLTV() external {
        uint256 collateralAmount = 50_000e18;
        uint256 daiBorrowAmount = 1_000e18;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        checkLiquidationStatus(alice, true, false, collateralAmount, maxBorrowInfo.daiMaxBorrow);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount);

        // After a day of interest this is now over
        vm.warp(block.timestamp + 86400);
        checkLiquidationStatus(alice, true, true, collateralAmount, 41_225.13851796411244e18);
        checkLiquidationStatus(alice, false, false, collateralAmount, 1_000.13851796411244e18);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV() external {
        uint256 collateralAmount = 10_000e18;
        uint256 daiBorrowAmount = 1_000e18;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(0.8e18);

        checkLiquidationStatus(alice, true, true, collateralAmount, maxBorrowInfo.daiMaxBorrow);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV_afterRepayOK() external {
        uint256 collateralAmount = 50_000e18;
        uint256 daiBorrowAmount = 8_000e18;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(0.8e18);

        vm.startPrank(alice);
        daiToken.approve(address(tlc), maxBorrowInfo.daiMaxBorrow/10);
        tlc.repay(maxBorrowInfo.daiMaxBorrow/10, alice);

        checkLiquidationStatus(alice, true, false, collateralAmount, maxBorrowInfo.daiMaxBorrow*9/10);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount-maxBorrowInfo.daiMaxBorrow/10);
    }

    function test_computeLiquidity_afterRepayAll() external {
        uint256 collateralAmount = 50_000e18;
        uint256 daiBorrowAmount = 8_000e18;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(0.8e18);

        vm.startPrank(alice);
        daiToken.approve(address(tlc), daiBorrowAmount);
        tlc.repayAll(alice);

        checkLiquidationStatus(alice, true, false, collateralAmount, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0);

        tlc.cancelBorrowRequest(alice);
        checkLiquidationStatus(alice, true, false, collateralAmount, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0);

        tlc.requestRemoveCollateral(collateralAmount);
        checkLiquidationStatus(alice, true, false, 0, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0);

        vm.warp(block.timestamp + COLLATERAL_REQUEST_MIN_SECS);
        tlc.removeCollateral(alice);
        checkLiquidationStatus(alice, true, false, 0, 0);
        checkLiquidationStatus(alice, false, false, 0, 0);
    }
}

contract TempleLineOfCreditTestBatchLiquidate is TlcBaseTest {
    function test_batchLiquidate_noAccounts() external {
        uint256 collateralAmount = 10_000e18;
        borrow(alice, collateralAmount, 1_000e18, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(1_000e18, 50555555555555555, expectedDaiAccumulator, block.timestamp);

        address[] memory accounts = new address[](0);
        checkBatchLiquidate(accounts, 0, 0);

        // No change
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(1_000e18, 50555555555555555, expectedDaiAccumulator, block.timestamp);
    }

    function test_batchLiquidate_oneAccount_noLiquidate() external {
        uint256 collateralAmount = 10_000e18;
        borrow(alice, collateralAmount, 1_000e18, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(1_000e18, 50555555555555555, expectedDaiAccumulator, block.timestamp);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        checkBatchLiquidate(accounts, 0, 0);

        // No change
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(1_000e18, 50555555555555555, expectedDaiAccumulator, block.timestamp);
    }

    function test_batchLiquidate_oneAccount_noLiquidateAtMax() external {
        uint256 collateralAmount = 10_000e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        borrow(alice, collateralAmount, maxBorrowInfo.daiMaxBorrow, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(maxBorrowInfo.daiMaxBorrow, 54580555555555555, expectedDaiAccumulator, block.timestamp);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        checkBatchLiquidate(accounts, 0, 0);

        // No change
        assertEq(tlc.totalCollateral(), 10_000e18);
        checkDebtTokenDetails(maxBorrowInfo.daiMaxBorrow, 54580555555555555, expectedDaiAccumulator, block.timestamp);
    }

    struct Balances {
        uint256 aliceTemple;
        uint256 bobTemple;
        uint256 tlcTemple;
        uint256 dUsd;
    }

    function getBalances() internal view returns (Balances memory) {
        return Balances({
            aliceTemple: templeToken.balanceOf(alice),
            bobTemple: templeToken.balanceOf(bob),
            tlcTemple: templeToken.balanceOf(address(tlc)),
            dUsd: dUSD.balanceOf(address(tlcStrategy))
        });
    }

    function test_batchLiquidate_oneAccount_liquidate() external {
        uint256 collateralAmount = 10_000e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        // 1 second later...
        vm.warp(block.timestamp + 1);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        uint96 expectedDaiInterestRate = 54580555555555555;
        checkDebtTokenDetails(daiBorrowAmount, expectedDaiInterestRate, expectedDaiAccumulator, block.timestamp-1);

        uint256 expectedDaiDebt = approxInterest(daiBorrowAmount, expectedDaiInterestRate, 1);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        checkBatchLiquidate(accounts, collateralAmount, expectedDaiDebt);

        // Amounts were claimed, state and rates updated.
        assertEq(tlc.totalCollateral(), 0);
        checkDebtTokenDetails(0, MIN_BORROW_RATE, expectedDaiAccumulator, block.timestamp);

        // Check balances - Alice keeps the DAI, the rest is liquidated.
        Balances memory balances = getBalances();
        assertEq(balances.aliceTemple, 0);
        assertEq(balances.tlcTemple, 0);
        assertEq(balances.dUsd, 0);

        // Account data was wiped
        maxBorrowInfo = expectedMaxBorrows(0);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: daiBorrowAmount,
                expectedAccountPosition: createAccountPosition(
                    0, 0, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
    }

    event RealisedGain(address indexed strategy, uint256 amount);

    function test_batchLiquidate_twoAccounts_oneLiquidate() external {
        uint256 collateralAmount = 10_000e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);
        uint256 expectedInitialAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        borrow(bob, collateralAmount, 1_000e18, BORROW_REQUEST_MIN_SECS);

        // 1 second later...
        vm.warp(block.timestamp + 1);

        // After borrow
        assertEq(tlc.totalCollateral(), 2*collateralAmount);

        // The expected interest rate with UR = (daiBorrowAmount+1_000e18+interest) / max ceiling
        uint96 initialAliceInterestRate = calculateInterestRate(daiInterestRateModel, daiBorrowAmount, BORROW_CEILING);
        uint256 expectedAliceDaiDebt = approxInterest(daiBorrowAmount, initialAliceInterestRate, BORROW_REQUEST_MIN_SECS);
        uint256 expectedBobDaiDebt = 1_000e18; // The extra 1 second hasn't been checkpoint yet
        uint96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, expectedAliceDaiDebt+expectedBobDaiDebt, BORROW_CEILING);
        uint256 expectedAccumulator = approxInterest(expectedInitialAccumulator, expectedDaiInterestRate, BORROW_REQUEST_MIN_SECS);
        checkDebtTokenDetails(expectedAliceDaiDebt+expectedBobDaiDebt, expectedDaiInterestRate, expectedAccumulator, block.timestamp-1);

        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;

        // 10 Temple was repaid to TRV, which is more DAI worth than the dUSD debt.
        // Gain = (10 Temple burned * 0.97 TPI) - (total dai borrowed + interest);
        {
            uint256 expectedRealisedGain = 454999840200087272698;
            vm.expectEmit(address(trv));
            emit RealisedGain(address(tlcStrategy), expectedRealisedGain);

            checkBatchLiquidate(accounts, collateralAmount, expectedAliceDaiDebt);
        }

        // Amounts were claimed, state and rates updated.
        assertEq(tlc.totalCollateral(), collateralAmount);
        expectedBobDaiDebt = approxInterest(expectedBobDaiDebt, expectedDaiInterestRate, 1);
        expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, expectedBobDaiDebt, BORROW_CEILING);
        checkDebtTokenDetails(expectedBobDaiDebt, expectedDaiInterestRate, expectedAccumulator, block.timestamp);

        // Check balances - Alice keeps the DAI, the rest is liquidated.
        {
            Balances memory balances = getBalances();
            assertEq(balances.aliceTemple, 0);
            assertEq(balances.tlcTemple, collateralAmount);
            // The dUSD debt is now zero since there was a realised gain.
            assertEq(balances.dUsd, 0);
        }

        // Account data was wiped for Alice
        maxBorrowInfo = expectedMaxBorrows(0);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: daiBorrowAmount,
                expectedAccountPosition: createAccountPosition(
                    0, 0, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
        checkLiquidationStatus(alice, true, false, 0, 0);
        checkLiquidationStatus(alice, false, false, 0, 0);

        // Not for Bob
        maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        checkAccountPosition(
            CheckAccountPositionParams({
                account: bob,
                expectedDaiBalance: 1_000e18,
                expectedAccountPosition: createAccountPosition(
                    collateralAmount, expectedBobDaiDebt, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: 1_000e18,
                // The IR after 60 seconds of compounded interest, UR = Alice's initial debt
                expectedDaiAccumulatorCheckpoint: approxInterest(expectedInitialAccumulator, initialAliceInterestRate, BORROW_REQUEST_MIN_SECS),
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );

        checkLiquidationStatus(bob, true, false, collateralAmount, expectedBobDaiDebt);
        checkLiquidationStatus(bob, false, false, collateralAmount, expectedBobDaiDebt);
    }

    function test_batchLiquidate_twoAccounts_twoLiquidate() external {
        uint256 collateralAmount = 10_000e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);
        uint256 expectedInitialAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);
        borrow(bob, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);

        // 1 second later...
        vm.warp(block.timestamp + 1);

        // After borrow
        assertEq(tlc.totalCollateral(), 2*collateralAmount);

        // The expected interest rate with UR = (daiBorrowAmount+1_000e18+interest) / max ceiling
        uint96 initialAliceInterestRate = calculateInterestRate(daiInterestRateModel, daiBorrowAmount, BORROW_CEILING);
        uint256 expectedAliceDaiDebt = approxInterest(daiBorrowAmount, initialAliceInterestRate, BORROW_REQUEST_MIN_SECS);
        uint256 expectedBobDaiDebt = daiBorrowAmount; // The extra 1 second hasn't been checkpoint yet
        uint96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, expectedAliceDaiDebt+expectedBobDaiDebt, BORROW_CEILING);
        uint256 expectedAccumulator = approxInterest(expectedInitialAccumulator, expectedDaiInterestRate, BORROW_REQUEST_MIN_SECS);
        checkDebtTokenDetails(expectedAliceDaiDebt+expectedBobDaiDebt, expectedDaiInterestRate, expectedAccumulator, block.timestamp-1);

        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;

        {
            expectedAliceDaiDebt = approxInterest(expectedAliceDaiDebt, expectedDaiInterestRate, 1);
            expectedBobDaiDebt = approxInterest(expectedBobDaiDebt, expectedDaiInterestRate, 1);

            // Check the expected amount we calculated matches the actual amount
            assertApproxEqRel(expectedAliceDaiDebt, 8245000871663674868143, 1e5, "alice debt");
            assertApproxEqRel(expectedBobDaiDebt, 8245000015467509038790, 1e5, "bob debt");

            // Liquidation events are emitted for the exact amounts
            vm.expectEmit(address(tlc));
            emit Liquidated(alice, collateralAmount, collateralValue(collateralAmount), 8245000871663674868143);
            vm.expectEmit(address(tlc));
            emit Liquidated(bob, collateralAmount, collateralValue(collateralAmount), 8245000015467509038790);

            // 10 Temple was repaid to TRV, which is more DAI worth than the dUSD debt.
            // Gain = (20 Temple burned * 0.97 TPI) - (total dai borrowed + interest);
            uint256 expectedDusdDebt = approxInterest(daiBorrowAmount, DEFAULT_BASE_INTEREST, BORROW_REQUEST_MIN_SECS);
            expectedDusdDebt = approxInterest(expectedDusdDebt+daiBorrowAmount, DEFAULT_BASE_INTEREST, 1);
            uint256 expectedGain = (collateralValue(2*collateralAmount) - expectedDusdDebt);
            assertApproxEqRel(expectedGain, 2909999837902712856788, 1e10, "realised gain");
            vm.expectEmit(address(trv));
            emit RealisedGain(address(tlcStrategy), 2909999837902712856788);

            checkBatchLiquidate(accounts, 2*collateralAmount, expectedAliceDaiDebt+expectedBobDaiDebt);
        }

        // Amounts were claimed, state and rates updated.
        assertEq(tlc.totalCollateral(), 0);
        checkDebtTokenDetails(0, MIN_BORROW_RATE, expectedAccumulator, block.timestamp);

        // Check balances - Alice keeps the DAI, the rest is liquidated.
        {
            Balances memory balances = getBalances();
            assertEq(balances.aliceTemple, 0);
            assertEq(balances.bobTemple, 0);
            assertEq(balances.tlcTemple, 0);
            // The dUSD debt is now zero since there was a realised gain.
            assertEq(balances.dUsd, 0);
        }

        // Account data was wiped for Alice and Bob
        maxBorrowInfo = expectedMaxBorrows(0);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: daiBorrowAmount,
                expectedAccountPosition: createAccountPosition(
                    0, 0, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
        checkAccountPosition(
            CheckAccountPositionParams({
                account: bob,
                expectedDaiBalance: daiBorrowAmount,
                expectedAccountPosition: createAccountPosition(
                    0, 0, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
    }

    function test_batchLiquidate_requestDoesntLiquidate() external {
        uint256 collateralAmount = 10_000e18;
        uint256 daiBorrowAmount = 1_000e18;
        borrow(alice, collateralAmount, daiBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(0.8e18);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;

        checkLiquidationStatus(alice, true, true, collateralAmount, maxBorrowInfo.daiMaxBorrow);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount);
        checkBatchLiquidate(accounts, 0, 0);
    }
}