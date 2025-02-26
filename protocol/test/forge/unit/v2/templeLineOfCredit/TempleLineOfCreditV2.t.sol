pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { LinearWithKinkInterestRateModel } from "contracts/v2/interestRate/LinearWithKinkInterestRateModel.sol";
import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { TlcStrategy } from "contracts/v2/strategies/TlcStrategy.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleLineOfCreditTest_Admin is TlcBaseTest {
    // @dev On a fresh TLC without the expected post creation setup
    function test_creation() public {
        TempleLineOfCredit newTlc = new TempleLineOfCredit(
            rescuer, 
            executor,
            address(circuitBreakerProxy),
            address(templeToken),
            address(daiToken),
            daiMaxLtvRatio,
            address(daiInterestRateModel)
        );

        assertEq(newTlc.executor(), executor);
        assertEq(newTlc.rescuer(), rescuer);

        assertEq(address(newTlc.templeToken()), address(templeToken));
        assertEq(address(newTlc.daiToken()), address(daiToken));
        assertEq(newTlc.totalCollateral(), 0);

        assertEq(address(newTlc.treasuryReservesVault()), address(0));

        (DebtTokenConfig memory config, DebtTokenData memory totals) = newTlc.debtTokenDetails();
        checkDebtTokenConfig(config, getDefaultConfig());
        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: 0,
            interestRate: 0,
            interestAccumulator: INITIAL_INTEREST_ACCUMULATOR,
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));

        assertEq(newTlc.liquidationsPaused(), false);
        assertEq(newTlc.minBorrowAmount(), 1000e18);
    }

    // @dev After the trv/etc has been set
    function test_initalization() public {
        // Reserve tokens are initialized
        checkDebtTokenDetails(0, MIN_BORROW_RATE, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

        // After the expected init functions
        {
            assertEq(address(tlc.treasuryReservesVault()), address(trv));
            assertEq(daiToken.allowance(address(tlc), address(trv)), type(uint256).max);
        }
    }

    function test_init_bad_config() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        TempleLineOfCredit newTlc = new TempleLineOfCredit(
            rescuer, 
            executor,
            address(circuitBreakerProxy), 
            address(templeToken),
            address(daiToken),
            daiMaxLtvRatio,
            address(0)
        );

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        newTlc = new TempleLineOfCredit(
            rescuer, 
            executor, 
            address(circuitBreakerProxy),
            address(templeToken),
            address(daiToken),
            1.01e18,
            address(daiInterestRateModel)
        );
    }

    function test_getDebtTokenCache() public {
        TempleLineOfCredit.DebtTokenCache memory cache = tlc.getDebtTokenCache();
        checkDebtTokenConfig(cache.config, defaultDaiConfig());
        assertEq(cache.totalDebt, 0);
        assertEq(cache.interestRate, MIN_BORROW_RATE);
        assertEq(cache.interestAccumulator, INITIAL_INTEREST_ACCUMULATOR);
        assertEq(cache.price, templePrice);
        assertEq(cache.trvDebtCeiling, BORROW_CEILING);

        borrow(alice, 20_000e18, 15_000e18, BORROW_REQUEST_MIN_SECS);

        cache = tlc.getDebtTokenCache();
        checkDebtTokenConfig(cache.config, defaultDaiConfig());
        assertEq(cache.totalDebt, 15_000e18);
        assertEq(cache.interestRate, 0.058333333333333333e18);
        assertEq(cache.interestAccumulator, 1.000000095129380475e27);
        assertEq(cache.price, templePrice);
        assertEq(cache.trvDebtCeiling, BORROW_CEILING);
    }

    function test_setTlcStrategy() public {
        borrow(alice, 20_000e18, 15_000e18, BORROW_REQUEST_MIN_SECS);

        vm.startPrank(executor);
        assertEq(address(tlc.tlcStrategy()), address(tlcStrategy));
        assertEq(address(tlc.treasuryReservesVault()), address(trv));

        TreasuryReservesVault newTrv = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        TlcStrategy newTlcStrategy = new TlcStrategy(
            rescuer, 
            executor, 
            "TempleLineOfCredit",
            address(newTrv), 
            address(tlc),
            address(daiToken)
        );

        // Add the new strategy with the ceiling at 100%
        // so the interest rate needs updating.
        {
            newTrv.setBorrowToken(daiToken, address(0), 0, 0, address(dUSD));
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(daiToken), 15_000e18);
            newTrv.addStrategy(address(newTlcStrategy), 0, debtCeiling);
        }

        {
            vm.expectEmit(address(tlc));
            emit TlcStrategySet(address(newTlcStrategy), address(newTrv));

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(0.2e18); // 100% UR

            tlc.setTlcStrategy(address(newTlcStrategy));
        }
        
        assertEq(address(tlc.tlcStrategy()), address(newTlcStrategy));
        assertEq(address(tlc.treasuryReservesVault()), address(newTrv));
        assertEq(daiToken.allowance(address(tlc), address(trv)), 0);
        assertEq(daiToken.allowance(address(tlc), address(newTrv)), type(uint256).max);

        vm.expectRevert();
        tlc.setTlcStrategy(alice);
    }

    function test_setInterestRateModel_noDebt() public {
        // After a rate refresh, the 'next' period of interest is set.
        tlc.refreshInterestRates();
        checkDebtTokenDetails(0, MIN_BORROW_RATE, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

        uint256 age = 10000;
        vm.warp(block.timestamp + age);

        // 10% flat
        LinearWithKinkInterestRateModel updatedInterestRateModel = new LinearWithKinkInterestRateModel(
            rescuer,
            executor,
            10e18 / 100,
            10e18 / 100,
            1, // Doesn't matter where the kink is
            10e18 / 100
        );

        vm.prank(executor);

        vm.expectEmit(address(tlc));
        emit InterestRateModelSet(address(updatedInterestRateModel));
        tlc.setInterestRateModel(address(updatedInterestRateModel));

        (DebtTokenConfig memory actualConfig, DebtTokenData memory actualTotals) = tlc.debtTokenDetails();
        DebtTokenConfig memory expectedConfig = defaultDaiConfig();
        expectedConfig.interestRateModel = LinearWithKinkInterestRateModel(updatedInterestRateModel);
        checkDebtTokenConfig(actualConfig, expectedConfig);

        checkDebtTokenData(actualTotals, DebtTokenData({
            totalDebt: 0,
            interestRate: 10e18 / 100,
            interestAccumulator: approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, age),
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));
    }

    function test_setInterestRateModel_withDebt() public {
        uint128 collateralAmount = 10_000 ether;
        uint128 borrowDaiAmount = 1_000 ether;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        uint96 expectedInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, BORROW_CEILING);
        checkDebtTokenDetails(borrowDaiAmount, expectedInterestRate, expectedDaiAccumulator, uint32(block.timestamp));

        uint256 age = 10000;
        vm.warp(block.timestamp + age);

        // 10% flat
        LinearWithKinkInterestRateModel updatedInterestRateModel = new LinearWithKinkInterestRateModel(
            rescuer,
            executor,
            10e18 / 100,
            10e18 / 100,
            1, // Doesn't matter where the kink is
            10e18 / 100
        );

        vm.prank(executor);
        tlc.setInterestRateModel(address(updatedInterestRateModel));

        (DebtTokenConfig memory actualConfig, DebtTokenData memory actualTotals) = tlc.debtTokenDetails();
        DebtTokenConfig memory expectedConfig = defaultDaiConfig();
        expectedConfig.interestRateModel = LinearWithKinkInterestRateModel(updatedInterestRateModel);
        checkDebtTokenConfig(actualConfig, expectedConfig);

        checkDebtTokenData(actualTotals, DebtTokenData({
            totalDebt: uint128(borrowDaiAmount * actualTotals.interestAccumulator / expectedDaiAccumulator),
            interestRate: calculateInterestRate(updatedInterestRateModel, borrowDaiAmount, BORROW_CEILING),
            interestAccumulator: approxInterest(expectedDaiAccumulator, expectedInterestRate, age),
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));
    }

    function test_refreshInterestRates() public {
        uint128 collateralAmount = 10_000 ether;
        uint128 borrowDaiAmount = 1_000 ether;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        uint32 ts2 = uint32(block.timestamp);
        uint256 age = 10000;
        vm.warp(block.timestamp + age);

        uint96 expectedDaiRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, BORROW_CEILING);

        checkDebtTokenDetails(borrowDaiAmount, expectedDaiRate, expectedDaiAccumulator, ts2);

        tlc.refreshInterestRates();

        expectedDaiAccumulator = approxInterest(expectedDaiAccumulator, expectedDaiRate, age);
        uint256 expectedDaiDebt = approxInterest(borrowDaiAmount, expectedDaiRate, age);
        expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, BORROW_CEILING);
        checkDebtTokenDetails(expectedDaiDebt, expectedDaiRate, expectedDaiAccumulator, uint32(block.timestamp));
    }

    function test_setMinBorrowAmount() public {
        vm.startPrank(executor);
        vm.expectEmit(address(tlc));
        emit MinBorrowAmountSet(2000e18);
        tlc.setMinBorrowAmount(2000e18);
        assertEq(tlc.minBorrowAmount(), 2000e18);
    }

    function test_setMaxLtvRatio() public {
        uint96 maxLtvRatio = 0.75e18;
        vm.expectEmit(address(tlc));
        emit MaxLtvRatioSet(maxLtvRatio);

        vm.startPrank(executor);
        tlc.setMaxLtvRatio(maxLtvRatio);

        (DebtTokenConfig memory config, DebtTokenData memory totals) = tlc.debtTokenDetails();
        checkDebtTokenConfig(config, DebtTokenConfig({
            interestRateModel: daiInterestRateModel,
            maxLtvRatio: maxLtvRatio,
            borrowsPaused: false
        }));

        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: 0,
            interestRate: MIN_BORROW_RATE,
            interestAccumulator: INITIAL_INTEREST_ACCUMULATOR,
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));

        // Max = 1e18
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        tlc.setMaxLtvRatio(1.01e18);
    }

    function test_recoverToken() public {
        addCollateral(alice, 500 ether);
        assertEq(tlc.totalCollateral(), 500 ether);

        // Can take any amount of non-Temple collateral
        {
            uint256 amount = 100 ether;
            deal(address(daiToken), address(tlc), amount, true);

            vm.expectEmit();
            emit CommonEventsAndErrors.TokenRecovered(alice, address(daiToken), amount);

            vm.startPrank(executor);
            tlc.recoverToken(address(daiToken), alice, amount);
            assertEq(daiToken.balanceOf(alice), amount);
            assertEq(daiToken.balanceOf(address(tlc)), 0);
        }
        
        // Can't take any of the user Temple collateral
        {
            uint256 amount = 10 ether;
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAmount.selector, address(templeToken), amount));
            tlc.recoverToken(address(templeToken), alice, amount);

            // If we deal extra (500 collateral + 11), we can now take it
            deal(address(templeToken), address(tlc), 511 ether, true);
            vm.expectEmit();
            emit CommonEventsAndErrors.TokenRecovered(alice, address(templeToken), amount);
            tlc.recoverToken(address(templeToken), alice, amount);
            assertEq(templeToken.balanceOf(alice), amount);
            assertEq(templeToken.balanceOf(address(tlc)), 501 ether);

            // But no more
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAmount.selector, address(templeToken), 2 ether));
            tlc.recoverToken(address(templeToken), alice, 2 ether);
        }
    }

    function test_setBorrowPaused() public {
        vm.startPrank(executor);
        vm.expectEmit();
        emit BorrowPausedSet(true);
        tlc.setBorrowPaused(true);

        (DebtTokenConfig memory config,) = tlc.debtTokenDetails();
        assertEq(config.borrowsPaused, true);

        vm.expectEmit();
        emit BorrowPausedSet(false);
        tlc.setBorrowPaused(false);
        (config,) = tlc.debtTokenDetails();
        assertEq(config.borrowsPaused, false);
    }

    function test_setLiquidationsPaused() public {
        vm.startPrank(executor);
        vm.expectEmit();
        emit LiquidationsPausedSet(true);
        tlc.setLiquidationsPaused(true);

        assertEq(tlc.liquidationsPaused(), true);

        vm.expectEmit();
        emit LiquidationsPausedSet(false);
        tlc.setLiquidationsPaused(false);
        assertEq(tlc.liquidationsPaused(), false);
    }
}

contract TempleLineOfCreditTest_Access is TlcBaseTest {
    function test_access_setTlcStrategy() public {
        expectElevatedAccess();
        tlc.setTlcStrategy(alice);
    }

    function test_access_setInterestRateModel() public {
        expectElevatedAccess();
        tlc.setInterestRateModel(address(daiInterestRateModel));
    }

    function test_access_setMaxLtvRatio() public {
        expectElevatedAccess();
        tlc.setMaxLtvRatio(0);
    }

    function test_access_recoverToken() public {
        expectElevatedAccess();
        tlc.recoverToken(address(daiToken), alice, 0);
    }

    function test_access_setBorrowPaused() public {
        expectElevatedAccess();
        tlc.setBorrowPaused(true);
    }

    function test_access_setLiquidationsPaused() public {
        expectElevatedAccess();
        tlc.setLiquidationsPaused(true);
    }

    function test_access_setMinBorrowAmount() public {
        expectElevatedAccess();
        tlc.setMinBorrowAmount(2000e18);
    }
}

contract TempleLineOfCreditTest_Positions is TlcBaseTest {
    function test_accountPosition_afterAddCollateral() external {
        uint128 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: 0,
                expectedAccountPosition: createAccountPosition(collateralAmount, 0, maxBorrowInfo),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0
            })
        );
    }
}

contract TempleLineOfCreditTestInterestAccrual is TlcBaseTest {

    struct Params {
        uint128 borrowDaiAmount;
        uint128 collateralAmount;
    }

    function test_trvCapChange() external {
        Params memory params = Params({
            borrowDaiAmount: 90_000e18,
            collateralAmount: 200_000e18
        });

        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        uint96 expectedDaiRate = 0.1e18;

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(params.collateralAmount);
        borrow(alice, params.collateralAmount, params.borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        uint256 tsBefore = block.timestamp;
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        uint256 expectedDaiDebt = approxInterest(params.borrowDaiAmount, expectedDaiRate, 365 days);

        // Run checks after a year.
        // Now the total debt has increased and the health factors are updated.
        // But nothing has been 'checkpointed' in storage yet.
        {
            checkDebtTokenDetails(params.borrowDaiAmount, expectedDaiRate, expectedDaiAccumulator, tsBefore);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedAccountPosition: createAccountPosition(
                        params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator
                })
            );
        }

        vm.prank(executor);
        trv.setStrategyDebtCeiling(address(tlcStrategy), daiToken, 50_000e18);

        // It is checkpoint and the interest rates are updated via the debtCeilingUpdated() hook
        {
            uint256 expectedDaiAccumulator2 = approxInterest(expectedDaiAccumulator, expectedDaiRate, 365 days);
            expectedDaiDebt = approxInterest(params.borrowDaiAmount, expectedDaiRate, 365 days);
            // The rate is now updated for the next period
            expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, 50_000e18);

            checkDebtTokenDetails(expectedDaiDebt, expectedDaiRate, expectedDaiAccumulator2, block.timestamp);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedAccountPosition: createAccountPosition(
                        params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator
                })
            );
        }
    }

    function test_borrow_accruesInterestRate() external {
        Params memory params = Params({
            borrowDaiAmount: 90_000e18,
            collateralAmount: 200_000e18
        });

        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        uint96 expectedDaiRate = 0.1e18;
        
        borrow(alice, params.collateralAmount, params.borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(params.collateralAmount);

        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, MIN_BORROW_RATE, BORROW_REQUEST_MIN_SECS);

        // Run checks after the initial borrow
        {
            checkDebtTokenDetails(params.borrowDaiAmount, expectedDaiRate, expectedDaiAccumulator, block.timestamp);
            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedAccountPosition: createAccountPosition(
                        params.collateralAmount, params.borrowDaiAmount, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator
                })
            );
        }

        uint256 tsBefore = block.timestamp;
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        uint256 expectedDaiDebt = approxInterest(params.borrowDaiAmount, expectedDaiRate, 365 days);

        // Run checks after a year.
        // Now the total debt has increased and the health factors are updated.
        // But nothing has been 'checkpointed' in storage yet.
        {
            checkDebtTokenDetails(params.borrowDaiAmount, expectedDaiRate, expectedDaiAccumulator, tsBefore);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedAccountPosition: createAccountPosition(
                        params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator
                })
            );
        }

        // Refresh the token rates rates based on the new UR (after debt increased)
        uint256 expectedDaiAccumulator2 = approxInterest(expectedDaiAccumulator, expectedDaiRate, 365 days);
        expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, BORROW_CEILING);
        {
            tlc.refreshInterestRates();

            checkDebtTokenDetails(expectedDaiDebt, expectedDaiRate, expectedDaiAccumulator2, block.timestamp);

            // Account balances remain the same
            CheckAccountPositionParams memory posiParams = CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: params.borrowDaiAmount,
                expectedAccountPosition: createAccountPosition(
                    params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator
            });
            checkAccountPosition(posiParams);
        }

        // Borrow the min amount more and the account checkpoint will update too
        {
            maxBorrowInfo = expectedMaxBorrows(params.collateralAmount);
            vm.startPrank(alice);
            {
                vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);
                tlc.borrow(1000e18, alice);
            }

            // Update the expected amounts/rates - 30 seconds more of interest.
            {
                expectedDaiDebt = approxInterest(expectedDaiDebt, expectedDaiRate, BORROW_REQUEST_MIN_SECS) + 1000e18;
                expectedDaiAccumulator2 = approxInterest(expectedDaiAccumulator2, expectedDaiRate, BORROW_REQUEST_MIN_SECS);
                expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, BORROW_CEILING);
            }

            checkDebtTokenDetails(expectedDaiDebt, expectedDaiRate, expectedDaiAccumulator2, block.timestamp);

            // Account balances update
            CheckAccountPositionParams memory posiParams = CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: params.borrowDaiAmount + 1000e18,
                expectedAccountPosition: createAccountPosition(
                    params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: expectedDaiDebt,
                expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator2
            });
            checkAccountPosition(posiParams);
        }
    }
}
