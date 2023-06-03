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


// @todo how to freeze new loans but allow repay and remove collateral?
// If tlc was live we would freeze all new loans but interest would continue to accrue (you can still be liquidated if you go over the LTV).


// // // @todo The debt ceiling might be higher than the amount of $$ the TRV actually has on hand.
// // // add a test to ensure that the denominator on the UR is using the max available, not the ceiling.

    // @todo Most of these tests are for DAI -- ensure OUD is sufficiently tested too.

    // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
    // so the rate is updated.
    // add a test for this.

    // @todo check all the encoding

    // @todo add test to check cooldown

// @todo check that if LTV is zero, then borrows are disabled.


//     // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
//     // so the rate is updated.
//     // add a test for this.





contract TempleLineOfCreditTest_Admin is TlcBaseTest {
    // @dev On a fresh TLC without the expected post creation setup
    function test_creation() public {
        TempleLineOfCredit newTlc = new TempleLineOfCredit(
            rescuer, 
            executor, 
            address(templeToken),
            address(daiToken),
            defaultDaiConfig(),
            address(oudToken),
            defaultOudConfig()
        );

        assertEq(newTlc.executors(executor), true);
        assertEq(newTlc.rescuers(rescuer), true);

        assertEq(address(newTlc.templeToken()), address(templeToken));
        assertEq(address(newTlc.daiToken()), address(daiToken));
        assertEq(address(newTlc.oudToken()), address(oudToken));
        assertEq(newTlc.totalCollateral(), 0);

        assertEq(address(newTlc.treasuryReservesVault()), address(0));
        {
            (uint32 minSecs, uint32 maxSecs) = newTlc.removeCollateralRequestWindow();
            assertEq(minSecs, 0);
            assertEq(maxSecs, 0);

            (DebtTokenConfig memory cfg,) = newTlc.debtTokenDetails(daiToken);
            assertEq(cfg.borrowRequestWindow.minSecs, BORROW_REQUEST_MIN_SECS);
            assertEq(cfg.borrowRequestWindow.maxSecs, BORROW_REQUEST_MAX_SECS);

            (cfg,) = newTlc.debtTokenDetails(oudToken);
            assertEq(cfg.borrowRequestWindow.minSecs, BORROW_REQUEST_MIN_SECS);
            assertEq(cfg.borrowRequestWindow.maxSecs, BORROW_REQUEST_MAX_SECS);
        }

        (DebtTokenConfig memory config, DebtTokenData memory totals) = newTlc.debtTokenDetails(daiToken);
        checkDebtTokenConfig(config, getDefaultConfig(daiToken));
        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: 0,
            interestRate: 0,
            interestAccumulator: INITIAL_INTEREST_ACCUMULATOR,
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));

        (config, totals) = newTlc.debtTokenDetails(oudToken);
        checkDebtTokenConfig(config, getDefaultConfig(oudToken));
        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: 0,
            interestRate: 0,
            interestAccumulator: INITIAL_INTEREST_ACCUMULATOR,
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));

        // Some other random address
        (config, totals) = newTlc.debtTokenDetails(IERC20(alice));
        assertEq(address(config.interestRateModel), address(0));
        checkDebtTokenData(totals, DebtTokenData(0, 0, 0, 0));
    }

    // @dev After the trv/etc has been set
    function test_initalization() public {
        // Reserve tokens are initialized
        checkDebtTokenDetails(daiToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));
        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

        // After the expected init functions
        {
            assertEq(address(tlc.treasuryReservesVault()), address(trv));
            assertEq(daiToken.allowance(address(tlc), address(trv)), type(uint256).max);

            (uint32 minSecs, uint32 maxSecs) = tlc.removeCollateralRequestWindow();
            assertEq(minSecs, COLLATERAL_REQUEST_MIN_SECS);
            assertEq(maxSecs, COLLATERAL_REQUEST_MAX_SECS);

            (DebtTokenConfig memory cfg,) = tlc.debtTokenDetails(daiToken);
            assertEq(cfg.borrowRequestWindow.minSecs, BORROW_REQUEST_MIN_SECS);
            assertEq(cfg.borrowRequestWindow.maxSecs, BORROW_REQUEST_MAX_SECS);

            (cfg,) = tlc.debtTokenDetails(oudToken);
            assertEq(cfg.borrowRequestWindow.minSecs, BORROW_REQUEST_MIN_SECS);
            assertEq(cfg.borrowRequestWindow.maxSecs, BORROW_REQUEST_MAX_SECS);
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
                borrowRequestWindow: FundsRequestWindow(0, 0)
            }),
            address(oudToken),
            defaultOudConfig()
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
                borrowRequestWindow: FundsRequestWindow(0, 0)
            }),
            address(oudToken),
            defaultOudConfig()
        );
    }

    function test_invalidDebtToken() public {
        TempleLineOfCredit.DebtTokenCache memory cache = tlc.getDebtTokenCache(daiToken);
        assertEq(address(cache.config.interestRateModel), address(daiInterestRateModel));

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidToken.selector, address(templeToken)));
        cache = tlc.getDebtTokenCache(templeToken);
    }

    // @todo add checks around TRV approvals
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

    function test_setWithdrawCollateralRequestWindow() public {
        vm.startPrank(executor);
        (uint32 minSecs, uint32 maxSecs) = tlc.removeCollateralRequestWindow();
        assertEq(minSecs, COLLATERAL_REQUEST_MIN_SECS);
        assertEq(maxSecs, COLLATERAL_REQUEST_MAX_SECS);
        
        vm.expectEmit(address(tlc));
        emit RemoveCollateralRequestWindowSet(2 days, 4 days);

        tlc.setWithdrawCollateralRequestWindow(2 days, 4 days);
        (minSecs, maxSecs) = tlc.removeCollateralRequestWindow();
        assertEq(minSecs, 2 days);
        assertEq(maxSecs, 4 days);

        // Intentionally no restrictions if the max < min (effectively pausing withdrawals in emergency)
        tlc.setWithdrawCollateralRequestWindow(3 days, 1 days);
        (minSecs, maxSecs) = tlc.removeCollateralRequestWindow();
        assertEq(minSecs, 3 days);
        assertEq(maxSecs, 1 days);
    }

    function test_setBorrowRequestWindow() public {
        vm.startPrank(executor);

        (DebtTokenConfig memory cfg,) = tlc.debtTokenDetails(daiToken);
        assertEq(cfg.borrowRequestWindow.minSecs, BORROW_REQUEST_MIN_SECS);
        assertEq(cfg.borrowRequestWindow.maxSecs, BORROW_REQUEST_MAX_SECS);
        
        vm.expectEmit(address(tlc));
        emit BorrowRequestWindowSet(address(daiToken), 2 days, 4 days);

        tlc.setBorrowRequestWindow(daiToken, 2 days, 4 days);
        (cfg,) = tlc.debtTokenDetails(daiToken);
        assertEq(cfg.borrowRequestWindow.minSecs, 2 days);
        assertEq(cfg.borrowRequestWindow.maxSecs, 4 days);

        // Intentionally no restrictions if the max < min (effectively pausing withdrawals in emergency)
        tlc.setBorrowRequestWindow(daiToken, 3 days, 1 days);
        (cfg,) = tlc.debtTokenDetails(daiToken);
        assertEq(cfg.borrowRequestWindow.minSecs, 3 days);
        assertEq(cfg.borrowRequestWindow.maxSecs, 1 days);

        // A bad token
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidToken.selector, templeToken));
        tlc.setBorrowRequestWindow(templeToken, 3 days, 1 days);
    }

    function test_setInterestRateModel_noDebt() public {
        // After a rate refresh, the 'next' period of interest is set.
        tlc.refreshInterestRates();
        checkDebtTokenDetails(daiToken, 0, 0.05e18, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));
        checkDebtTokenDetails(oudToken, 0, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

        uint256 age = 10000;
        vm.warp(block.timestamp + age);

        // 10% flat
        LinearWithKinkInterestRateModel updatedInterestRateModel = new LinearWithKinkInterestRateModel(
            10e18 / 100,
            10e18 / 100,
            100e18 / 100,
            10e18 / 100
        );

        vm.prank(executor);

        vm.expectEmit(address(tlc));
        emit InterestRateModelSet(address(daiToken), address(updatedInterestRateModel));
        tlc.setInterestRateModel(daiToken, address(updatedInterestRateModel));

        (DebtTokenConfig memory actualConfig, DebtTokenData memory actualTotals) = tlc.debtTokenDetails(daiToken);
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
        uint256 collateralAmount = 10 ether;
        uint256 borrowDaiAmount = 1 ether;
        uint32 ts = uint32(block.timestamp);
        borrow(alice, collateralAmount, borrowDaiAmount, 0, BORROW_REQUEST_MIN_SECS);
        
        int96 expectedInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);
        checkDebtTokenDetails(daiToken, borrowDaiAmount, expectedInterestRate, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));
        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, ts);

        uint256 age = 10000;
        vm.warp(block.timestamp + age);

        // 10% flat
        LinearWithKinkInterestRateModel updatedInterestRateModel = new LinearWithKinkInterestRateModel(
            10e18 / 100,
            10e18 / 100,
            100e18 / 100,
            10e18 / 100
        );

        vm.prank(executor);
        tlc.setInterestRateModel(daiToken, address(updatedInterestRateModel));

        (DebtTokenConfig memory actualConfig, DebtTokenData memory actualTotals) = tlc.debtTokenDetails(daiToken);
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
        uint256 collateralAmount = 10 ether;
        uint256 borrowDaiAmount = 1 ether;
        uint32 ts = uint32(block.timestamp);
        borrow(alice, collateralAmount, borrowDaiAmount, 0, BORROW_REQUEST_MIN_SECS);

        uint32 ts2 = uint32(block.timestamp);
        uint256 age = 10000;
        vm.warp(block.timestamp + age);

        int96 expectedDaiRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);

        checkDebtTokenDetails(daiToken, borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, ts2);
        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, ts);

        tlc.refreshInterestRates();

        uint256 expectedAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiRate, age);
        uint256 expectedDaiDebt = approxInterest(borrowDaiAmount, expectedDaiRate, age);
        checkDebtTokenDetails(daiToken, expectedDaiDebt, expectedDaiRate, expectedAccumulator, uint32(block.timestamp));
        checkDebtTokenDetails(oudToken, 0, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));
    }

    function test_setMaxLtvRatio() public {
        uint256 maxLtvRatio = 0.75e18;
        emit MaxLtvRatioSet(address(daiToken), maxLtvRatio);

        vm.startPrank(executor);
        tlc.setMaxLtvRatio(daiToken, maxLtvRatio);

        (DebtTokenConfig memory config, DebtTokenData memory totals) = tlc.debtTokenDetails(daiToken);
        checkDebtTokenConfig(config, DebtTokenConfig({
            interestRateModel: daiInterestRateModel,
            maxLtvRatio: uint128(maxLtvRatio),
            borrowRequestWindow: FundsRequestWindow(BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS)
        }));

        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: 0,
            interestRate: 0,
            interestAccumulator: INITIAL_INTEREST_ACCUMULATOR,
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));

        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        // Max = 1e18
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        tlc.setMaxLtvRatio(daiToken, 1.01e18);
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

    function test_access_setWithdrawCollateralRequestWindow() public {
        expectElevatedAccess();
        tlc.setWithdrawCollateralRequestWindow(0, 0);
    }

    function test_access_setBorrowRequestWindow() public {
        expectElevatedAccess();
        tlc.setBorrowRequestWindow(daiToken, 0, 0);
    }

    function test_access_setInterestRateModel() public {
        expectElevatedAccess();
        tlc.setInterestRateModel(daiToken, address(daiInterestRateModel));
    }

    function test_access_setMaxLtvRatio() public {
        expectElevatedAccess();
        tlc.setMaxLtvRatio(daiToken, 0);
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
        tlc.cancelBorrowRequest(alice, daiToken);
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
                expectedOudBalance: 0,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: collateralAmount,
                    daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
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
        tlc.requestBorrow(daiToken, borrowAmount);
        tlc.requestRemoveCollateral(removeCollateralAmount);

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount-removeCollateralAmount);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: 0,
                expectedOudBalance: 0,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: collateralAmount-removeCollateralAmount,
                    daiDebtPosition: createDebtPosition(daiToken, borrowAmount, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
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
        uint256 borrowOudAmount;
        uint256 collateralAmount;
    }

    function test_borrow_accruesInterestRate() external {
        Params memory params = Params({
            borrowDaiAmount: 90_000e18,
            borrowOudAmount: 20_000e18,
            collateralAmount: 200_000e18
        });

        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        int96 expectedDaiRate = 0.1e18;

        // Flat interest rate of 5%
        int96 expectedOudRate = 0.05e18;
        
        borrow(alice, params.collateralAmount, params.borrowDaiAmount, params.borrowOudAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(params.collateralAmount);

        // Run checks after the initial borrow
        {
            checkDebtTokenDetails(daiToken, params.borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
            checkDebtTokenDetails(oudToken, params.borrowOudAmount, expectedOudRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedOudBalance: params.borrowOudAmount,
                    expectedAccountPosition: AccountPosition({
                        collateralPosted: params.collateralAmount,
                        daiDebtPosition: createDebtPosition(daiToken, params.borrowDaiAmount, maxBorrowInfo),
                        oudDebtPosition: createDebtPosition(oudToken, params.borrowOudAmount, maxBorrowInfo)
                    }),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedOudDebtCheckpoint: params.borrowOudAmount,
                    expectedOudAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        uint256 tsBefore = block.timestamp;
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        uint256 expectedDaiDebt = approxInterest(params.borrowDaiAmount, expectedDaiRate, 365 days);
        uint256 expectedOudDebt = approxInterest(params.borrowOudAmount, expectedOudRate, 365 days);

        // Run checks after a year.
        // Now the total debt has increased and the health factors are updated.
        // But nothing has been 'checkpointed' in storage yet.
        {
            checkDebtTokenDetails(daiToken, params.borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);
            checkDebtTokenDetails(oudToken, params.borrowOudAmount, expectedOudRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);

            checkAccountPosition(
                CheckAccountPositionParams({
                    account: alice,
                    expectedDaiBalance: params.borrowDaiAmount,
                    expectedOudBalance: params.borrowOudAmount,
                    expectedAccountPosition: AccountPosition({
                        collateralPosted: params.collateralAmount,
                        daiDebtPosition: createDebtPosition(daiToken, expectedDaiDebt, maxBorrowInfo),
                        oudDebtPosition: createDebtPosition(oudToken, expectedOudDebt, maxBorrowInfo)
                    }),
                    expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                    expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedOudDebtCheckpoint: params.borrowOudAmount,
                    expectedOudAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                    expectedRemoveCollateralRequest: 0,
                    expectedRemoveCollateralRequestAt: 0
                }),
                true
            );
        }

        // Refresh the token rates rates based on the new UR (after debt increased)
        uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiRate, 365 days);
        uint256 expectedOudAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedOudRate, 365 days);
        expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, borrowCeiling);
        {
            tlc.refreshInterestRates();

            checkDebtTokenDetails(daiToken, expectedDaiDebt, expectedDaiRate, expectedDaiAccumulator, block.timestamp);
            checkDebtTokenDetails(oudToken, expectedOudDebt, expectedOudRate, expectedOudAccumulator, block.timestamp);

            // Account balances remain the same
            CheckAccountPositionParams memory posiParams = CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: params.borrowDaiAmount,
                expectedOudBalance: params.borrowOudAmount,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: params.collateralAmount,
                    daiDebtPosition: createDebtPosition(daiToken, expectedDaiDebt, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, expectedOudDebt, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: params.borrowDaiAmount,
                expectedDaiAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                expectedOudDebtCheckpoint: params.borrowOudAmount,
                expectedOudAccumulatorCheckpoint: INITIAL_INTEREST_ACCUMULATOR,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            });
            checkAccountPosition(posiParams, true);
        }

        // Borrow just 1 wei more and the account checkpoint will update too
        {
            maxBorrowInfo = expectedMaxBorrows(params.collateralAmount);
            vm.startPrank(alice);
            {
                tlc.requestBorrow(daiToken, 1);
                tlc.requestBorrow(oudToken, 1);
                vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);
                tlc.borrow(daiToken, alice);
                tlc.borrow(oudToken, alice);
            }

            // Update the expected amounts/rates - 30 seconds more of interest.
            {
                expectedDaiDebt = approxInterest(expectedDaiDebt, expectedDaiRate, BORROW_REQUEST_MIN_SECS) + 1;
                expectedDaiAccumulator = approxInterest(expectedDaiAccumulator, expectedDaiRate, BORROW_REQUEST_MIN_SECS);
                expectedDaiRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, borrowCeiling);

                expectedOudDebt = approxInterest(expectedOudDebt, expectedOudRate, BORROW_REQUEST_MIN_SECS) + 1;
                expectedOudAccumulator = approxInterest(expectedOudAccumulator, expectedOudRate, BORROW_REQUEST_MIN_SECS);
            }

            checkDebtTokenDetails(daiToken, expectedDaiDebt, expectedDaiRate, expectedDaiAccumulator, block.timestamp);
            checkDebtTokenDetails(oudToken, expectedOudDebt, expectedOudRate, expectedOudAccumulator, block.timestamp);

            // Account balances update
            CheckAccountPositionParams memory posiParams = CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: params.borrowDaiAmount+1,
                expectedOudBalance: params.borrowOudAmount+1,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: params.collateralAmount,
                    daiDebtPosition: createDebtPosition(daiToken, expectedDaiDebt, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, expectedOudDebt, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: expectedDaiDebt,
                expectedDaiAccumulatorCheckpoint: expectedDaiAccumulator,
                expectedOudDebtCheckpoint: expectedOudDebt,
                expectedOudAccumulatorCheckpoint: expectedOudAccumulator,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            });
            checkAccountPosition(posiParams, true);
        }
    }
}
