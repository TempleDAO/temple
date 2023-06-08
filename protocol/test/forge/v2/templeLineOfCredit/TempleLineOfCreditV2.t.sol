pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { LinearWithKinkInterestRateModel } from "contracts/v2/interestRate/LinearWithKinkInterestRateModel.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { TlcStrategy } from "contracts/v2/templeLineOfCredit/TlcStrategy.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";

contract TempleLineOfCreditTest_Admin is TlcBaseTest {
    // @dev On a fresh TLC without the expected post creation setup
    function test_creation() public {
        TempleLineOfCredit newTlc = new TempleLineOfCredit(
            rescuer, 
            executor, 
            address(templeToken),
            address(daiToken),
            defaultDaiConfig()
        );

        assertEq(newTlc.executors(executor), true);
        assertEq(newTlc.rescuers(rescuer), true);

        assertEq(address(newTlc.templeToken()), address(templeToken));
        assertEq(address(newTlc.daiToken()), address(daiToken));
        assertEq(newTlc.totalCollateral(), 0);

        assertEq(address(newTlc.treasuryReservesVault()), address(0));
        {
            (uint32 minSecs, uint32 maxSecs) = newTlc.removeCollateralRequestConfig();
            assertEq(minSecs, 0);
            assertEq(maxSecs, 0);

            (DebtTokenConfig memory cfg,) = newTlc.debtTokenDetails();
            assertEq(cfg.borrowRequestConfig.minSecs, BORROW_REQUEST_MIN_SECS);
            assertEq(cfg.borrowRequestConfig.maxSecs, BORROW_REQUEST_MAX_SECS);
        }

        (DebtTokenConfig memory config, DebtTokenData memory totals) = newTlc.debtTokenDetails();
        checkDebtTokenConfig(config, getDefaultConfig());
        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: 0,
            interestRate: 0,
            interestAccumulator: INITIAL_INTEREST_ACCUMULATOR,
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));
    }

    // @dev After the trv/etc has been set
    function test_initalization() public {
        // Reserve tokens are initialized
        checkDebtTokenDetails(0, 0, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

        // After the expected init functions
        {
            assertEq(address(tlc.treasuryReservesVault()), address(trv));
            assertEq(daiToken.allowance(address(tlc), address(trv)), type(uint256).max);

            (uint32 minSecs, uint32 maxSecs) = tlc.removeCollateralRequestConfig();
            assertEq(minSecs, COLLATERAL_REQUEST_MIN_SECS);
            assertEq(maxSecs, COLLATERAL_REQUEST_MAX_SECS);

            (DebtTokenConfig memory cfg,) = tlc.debtTokenDetails();
            assertEq(cfg.borrowRequestConfig.minSecs, BORROW_REQUEST_MIN_SECS);
            assertEq(cfg.borrowRequestConfig.maxSecs, BORROW_REQUEST_MAX_SECS);
        }
    }

    function test_init_bad_config() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        TempleLineOfCredit newTlc = new TempleLineOfCredit(
            rescuer, 
            executor, 
            address(templeToken),
            address(daiToken),
            DebtTokenConfig({
                interestRateModel: IInterestRateModel(address(0)),
                maxLtvRatio: daiMaxLtvRatio,
                borrowRequestConfig: FundsRequestConfig(0, 0)
            })
        );

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        newTlc = new TempleLineOfCredit(
            rescuer, 
            executor, 
            address(templeToken),
            address(daiToken),
            DebtTokenConfig({
                interestRateModel: daiInterestRateModel,
                maxLtvRatio: 1.01e18,
                borrowRequestConfig: FundsRequestConfig(0, 0)
            })
        );
    }

    function test_invalidDebtToken() public {
        TempleLineOfCredit.DebtTokenCache memory cache = tlc.getDebtTokenCache();
        assertEq(address(cache.config.interestRateModel), address(daiInterestRateModel));
    }

    function test_setTlcStrategy() public {
        vm.startPrank(executor);
        assertEq(address(tlc.tlcStrategy()), address(tlcStrategy));
        assertEq(address(tlc.treasuryReservesVault()), address(trv));

        TreasuryReservesVault newTrv = new TreasuryReservesVault(rescuer, executor, address(templeToken), address(daiToken), address(dUSD), templePrice);
        TlcStrategy newTlcStrategy = new TlcStrategy(
            rescuer, 
            executor, 
            "TempleLineOfCredit",
            address(newTrv), 
            address(tlc), 
            address(templeToken)
        );

        vm.expectEmit(address(tlc));
        emit TlcStrategySet(address(newTlcStrategy), address(newTrv));

        tlc.setTlcStrategy(address(newTlcStrategy));
        assertEq(address(tlc.tlcStrategy()), address(newTlcStrategy));
        assertEq(address(tlc.treasuryReservesVault()), address(newTrv));
        assertEq(daiToken.allowance(address(tlc), address(trv)), 0);
        assertEq(daiToken.allowance(address(tlc), address(newTrv)), type(uint256).max);

        vm.expectRevert();
        tlc.setTlcStrategy(alice);
    }

    function test_setWithdrawCollateralRequestConfig() public {
        vm.startPrank(executor);
        (uint32 minSecs, uint32 maxSecs) = tlc.removeCollateralRequestConfig();
        assertEq(minSecs, COLLATERAL_REQUEST_MIN_SECS);
        assertEq(maxSecs, COLLATERAL_REQUEST_MAX_SECS);
        
        vm.expectEmit(address(tlc));
        emit RemoveCollateralRequestConfigSet(2 days, 4 days);

        tlc.setWithdrawCollateralRequestConfig(2 days, 4 days);
        (minSecs, maxSecs) = tlc.removeCollateralRequestConfig();
        assertEq(minSecs, 2 days);
        assertEq(maxSecs, 4 days);

        // Intentionally no restrictions if the max < min (effectively pausing withdrawals in emergency)
        tlc.setWithdrawCollateralRequestConfig(3 days, 1 days);
        (minSecs, maxSecs) = tlc.removeCollateralRequestConfig();
        assertEq(minSecs, 3 days);
        assertEq(maxSecs, 1 days);
    }

    function test_setBorrowRequestConfig() public {
        vm.startPrank(executor);

        (DebtTokenConfig memory cfg,) = tlc.debtTokenDetails();
        assertEq(cfg.borrowRequestConfig.minSecs, BORROW_REQUEST_MIN_SECS);
        assertEq(cfg.borrowRequestConfig.maxSecs, BORROW_REQUEST_MAX_SECS);
        
        vm.expectEmit(address(tlc));
        emit BorrowRequestConfigSet(2 days, 4 days);

        tlc.setBorrowRequestConfig(2 days, 4 days);
        (cfg,) = tlc.debtTokenDetails();
        assertEq(cfg.borrowRequestConfig.minSecs, 2 days);
        assertEq(cfg.borrowRequestConfig.maxSecs, 4 days);

        // Intentionally no restrictions if the max < min (effectively pausing withdrawals in emergency)
        tlc.setBorrowRequestConfig(3 days, 1 days);
        (cfg,) = tlc.debtTokenDetails();
        assertEq(cfg.borrowRequestConfig.minSecs, 3 days);
        assertEq(cfg.borrowRequestConfig.maxSecs, 1 days);
    }

    function test_setInterestRateModel_noDebt() public {
        // After a rate refresh, the 'next' period of interest is set.
        tlc.refreshInterestRates();
        checkDebtTokenDetails(0, 0.05e18, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

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
            interestAccumulator: approxInterest(INITIAL_INTEREST_ACCUMULATOR, 0.05e18, age),
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));
    }

    function test_setInterestRateModel_withDebt() public {
        uint256 collateralAmount = 10_000 ether;
        uint256 borrowDaiAmount = 1_000 ether;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);
        
        uint96 expectedInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);
        checkDebtTokenDetails(borrowDaiAmount, expectedInterestRate, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

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
            totalDebt: uint128(borrowDaiAmount * actualTotals.interestAccumulator / INITIAL_INTEREST_ACCUMULATOR),
            interestRate: calculateInterestRate(updatedInterestRateModel, borrowDaiAmount, borrowCeiling),
            interestAccumulator: approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedInterestRate, age),
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));
    }

    function test_refreshInterestRates() public {
        uint256 collateralAmount = 10_000 ether;
        uint256 borrowDaiAmount = 1_000 ether;
        borrow(alice, collateralAmount, borrowDaiAmount, BORROW_REQUEST_MIN_SECS);

        uint32 ts2 = uint32(block.timestamp);
        uint256 age = 10000;
        vm.warp(block.timestamp + age);

        uint96 expectedDaiRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);

        checkDebtTokenDetails(borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, ts2);

        tlc.refreshInterestRates();

        uint256 expectedAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiRate, age);
        uint256 expectedDaiDebt = approxInterest(borrowDaiAmount, expectedDaiRate, age);
        expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, borrowCeiling);
        checkDebtTokenDetails(expectedDaiDebt, expectedDaiRate, expectedAccumulator, uint32(block.timestamp));
    }

    function test_setMaxLtvRatio() public {
        uint96 maxLtvRatio = 0.75e18;
        emit MaxLtvRatioSet(maxLtvRatio);

        vm.startPrank(executor);
        tlc.setMaxLtvRatio(maxLtvRatio);

        (DebtTokenConfig memory config, DebtTokenData memory totals) = tlc.debtTokenDetails();
        checkDebtTokenConfig(config, DebtTokenConfig({
            interestRateModel: daiInterestRateModel,
            maxLtvRatio: maxLtvRatio,
            borrowRequestConfig: FundsRequestConfig(BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS)
        }));

        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: 0,
            interestRate: 0,
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
}

contract TempleLineOfCreditTest_Access is TlcBaseTest {
    function test_access_setTlcStrategy() public {
        expectElevatedAccess();
        tlc.setTlcStrategy(alice);
    }

    function test_access_setWithdrawCollateralRequestConfig() public {
        expectElevatedAccess();
        tlc.setWithdrawCollateralRequestConfig(0, 0);
    }

    function test_access_setBorrowRequestConfig() public {
        expectElevatedAccess();
        tlc.setBorrowRequestConfig(0, 0);
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

    function test_access_cancelRemoveCollateralRequest() public {
        expectElevatedAccess();
        tlc.cancelRemoveCollateralRequest(alice);
    }

    function test_access_cancelBorrowRequest() public {
        expectElevatedAccess();
        tlc.cancelBorrowRequest(alice);
    }
}

contract TempleLineOfCreditTest_Positions is TlcBaseTest {
    function test_accountPosition_afterAddCollateral() external {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: 0,
                expectedAccountPosition: createAccountPosition(collateralAmount, 0, maxBorrowInfo),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
    }

    function test_accountPosition_includePendingRequests() external {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        uint256 borrowAmount = 5_000e18;
        uint256 removeCollateralAmount = 20_000e18;
        vm.startPrank(alice);
        tlc.requestBorrow(borrowAmount);
        tlc.requestRemoveCollateral(removeCollateralAmount);

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount-removeCollateralAmount);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: 0,
                expectedAccountPosition: createAccountPosition(
                    collateralAmount-removeCollateralAmount, borrowAmount, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: removeCollateralAmount,
                expectedRemoveCollateralRequestAt: uint32(block.timestamp)
            }),
            true
        );
    }
}

contract TempleLineOfCreditTestInterestAccrual is TlcBaseTest {

    struct Params {
        uint256 borrowDaiAmount;
        uint256 collateralAmount;
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

        uint256 tsBefore = block.timestamp;
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        uint256 expectedDaiDebt = approxInterest(params.borrowDaiAmount, expectedDaiRate, 365 days);

        // Run checks after a year.
        // Now the total debt has increased and the health factors are updated.
        // But nothing has been 'checkpointed' in storage yet.
        {
            checkDebtTokenDetails(params.borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedAccountPosition: createAccountPosition(
                        params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        vm.prank(executor);
        trv.setStrategyDebtCeiling(address(tlcStrategy), 50_000e18);

        // Still the same after the TRV cap was halved
        {
            checkDebtTokenDetails(params.borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedAccountPosition: createAccountPosition(
                        params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        // It is checkpoint and rates updated only after a forced refresh (or a new user borrow)
        tlc.refreshInterestRates();
        {
            uint256 daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiRate, 365 days);
            expectedDaiDebt = approxInterest(params.borrowDaiAmount, expectedDaiRate, 365 days);
            // The rate is now updated for the next period
            expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, 50_000e18);

            checkDebtTokenDetails(expectedDaiDebt, expectedDaiRate, daiAccumulator, block.timestamp);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedAccountPosition: createAccountPosition(
                        params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
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

        // Run checks after the initial borrow
        {
            checkDebtTokenDetails(params.borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedAccountPosition: createAccountPosition(
                        params.collateralAmount, params.borrowDaiAmount, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        uint256 tsBefore = block.timestamp;
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        uint256 expectedDaiDebt = approxInterest(params.borrowDaiAmount, expectedDaiRate, 365 days);

        // Run checks after a year.
        // Now the total debt has increased and the health factors are updated.
        // But nothing has been 'checkpointed' in storage yet.
        {
            checkDebtTokenDetails(params.borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedAccountPosition: createAccountPosition(
                        params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                    ),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        // Refresh the token rates rates based on the new UR (after debt increased)
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiRate, 365 days);
        expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, borrowCeiling);
        {
            tlc.refreshInterestRates();

            checkDebtTokenDetails(expectedDaiDebt, expectedDaiRate, expectedDaiAccumulator, block.timestamp);

            // Account balances remain the same
            CheckAccountPositionParams memory posiParams = CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: params.borrowDaiAmount,
                expectedAccountPosition: createAccountPosition(
                    params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            });
            checkAccountPosition(posiParams, true);
        }

        // Borrow the min amount more and the account checkpoint will update too
        {
            maxBorrowInfo = expectedMaxBorrows(params.collateralAmount);
            vm.startPrank(alice);
            {
                tlc.requestBorrow(1000e18);
                vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);
                tlc.borrow(alice);
            }

            // Update the expected amounts/rates - 30 seconds more of interest.
            {
                expectedDaiDebt = approxInterest(expectedDaiDebt, expectedDaiRate, BORROW_REQUEST_MIN_SECS) + 1000e18;
                expectedDaiAccumulator = approxInterest(expectedDaiAccumulator, expectedDaiRate, BORROW_REQUEST_MIN_SECS);
                expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, borrowCeiling);
            }

            checkDebtTokenDetails(expectedDaiDebt, expectedDaiRate, expectedDaiAccumulator, block.timestamp);

            // Account balances update
            CheckAccountPositionParams memory posiParams = CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: params.borrowDaiAmount + 1000e18,
                expectedAccountPosition: createAccountPosition(
                    params.collateralAmount, expectedDaiDebt, maxBorrowInfo
                ),
                expectedDaiDebtCheckpoint: expectedDaiDebt,
                expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            });
            checkAccountPosition(posiParams, true);
        }
    }
}
