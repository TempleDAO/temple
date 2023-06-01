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

import "forge-std/console.sol";

// contract XXXRefreshIR is TlcBaseTest {
//     function test_refreshInterestRates() public {
//         uint256 borrowDaiAmountFirst = 30_000e18;
//         uint256 borrowOudAmountFirst = 20_000e18;
//         uint256 collateralAmount = 100_000e18;
//         borrow(alice, collateralAmount, borrowDaiAmountFirst, borrowOudAmountFirst, FUNDS_REQUEST_MIN_SECS);
        
//         vm.warp(block.timestamp + 365);
//         tlc.refreshInterestRates(daiToken);
//         tlc.refreshInterestRates(oudToken);
//         vm.warp(block.timestamp + 365);
//         uint256 gas = gasleft();
//         tlc.refreshInterestRates(daiToken);
//         tlc.refreshInterestRates(oudToken);
//         console.log("gas:", gas-gasleft());
//         vm.warp(block.timestamp + 365);
//         tlc.refreshInterestRates(daiToken);
//         tlc.refreshInterestRates(oudToken);
//     }
// }

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
        (uint32 minSecs, uint32 maxSecs) = newTlc.fundsRequestWindow();
        assertEq(minSecs, 0);
        assertEq(maxSecs, 0);

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
            (uint32 minSecs, uint32 maxSecs) = tlc.fundsRequestWindow();
            assertEq(minSecs, FUNDS_REQUEST_MIN_SECS);
            assertEq(maxSecs, FUNDS_REQUEST_MAX_SECS);
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
                maxLtvRatio: daiMaxLtvRatio
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
                maxLtvRatio: 1.01e18
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

        vm.expectRevert();
        tlc.setTlcStrategy(alice);
    }

    function test_setFundsRequestWindow() public {
        vm.startPrank(executor);
        (uint32 minSecs, uint32 maxSecs) = tlc.fundsRequestWindow();
        assertEq(minSecs, FUNDS_REQUEST_MIN_SECS);
        assertEq(maxSecs, FUNDS_REQUEST_MAX_SECS);
        
        vm.expectEmit(address(tlc));
        emit FundsRequestWindowSet(2 days, 4 days);

        tlc.setFundsRequestWindow(2 days, 4 days);
        (minSecs, maxSecs) = tlc.fundsRequestWindow();
        assertEq(minSecs, 2 days);
        assertEq(maxSecs, 4 days);

        // Intentionally no restrictions if the max < min (effectively pausing withdrawals in emergency)
        tlc.setFundsRequestWindow(3 days, 1 days);
        (minSecs, maxSecs) = tlc.fundsRequestWindow();
        assertEq(minSecs, 3 days);
        assertEq(maxSecs, 1 days);
    }

    function test_setInterestRateModel_noDebt() public {
        // After a rate refresh, the 'next' period of interest is set.
        tlc.refreshInterestRates(daiToken);
        checkDebtTokenDetails(daiToken, 0, 0.05e18, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));
        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));
        tlc.refreshInterestRates(oudToken);
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
        borrow(alice, collateralAmount, borrowDaiAmount, 0, FUNDS_REQUEST_MIN_SECS);
        
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
        borrow(alice, collateralAmount, borrowDaiAmount, 0, FUNDS_REQUEST_MIN_SECS);

        uint32 ts2 = uint32(block.timestamp);
        uint256 age = 10000;
        vm.warp(block.timestamp + age);

        int96 expectedDaiRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);

        checkDebtTokenDetails(daiToken, borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, ts2);
        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, ts);

        tlc.refreshInterestRates(daiToken);

        uint256 expectedAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiRate, age);
        uint256 expectedDaiDebt = approxInterest(borrowDaiAmount, expectedDaiRate, age);
        checkDebtTokenDetails(daiToken, expectedDaiDebt, expectedDaiRate, expectedAccumulator, uint32(block.timestamp));
        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, ts);

        tlc.refreshInterestRates(oudToken);
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
            maxLtvRatio: uint128(maxLtvRatio)
        }));

        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: 0,
            interestRate: 0,
            interestAccumulator: INITIAL_INTEREST_ACCUMULATOR,
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));

        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        // Overflow over 2^128
        vm.expectRevert(abi.encodeWithSelector(SafeCast.Overflow.selector, 2**200));
        tlc.setMaxLtvRatio(daiToken, 2**200);
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

    function test_access_setFundsRequestWindow() public {
        expectElevatedAccess();
        tlc.setFundsRequestWindow(0, 0);
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



contract TempleLineOfCreditTest_Collateral is TlcBaseTest {
    // event CollateralAdded(address indexed fundedBy, address indexed onBehalfOf, uint256 collateralAmount);
    // event CollateralRemoved(address indexed account, address indexed recipient, uint256 collateralAmount);

// @todo add collateral on behalf of another account.
// @todo remove collateral (with cooldown)

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
            checkAccountData(
                alice,
                collateralAmount,
                0, 0, 0, 0
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

            checkAccountData(
                bob,
                newCollateralAmount,
                0, 0, 0, 0
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

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: 0,
                expectedOudBalance: 0,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: collateralAmount,
                    daiDebtPosition: AccountDebtPosition(0, maxBorrowInfo.daiMaxBorrow, type(uint256).max, 0),
                    oudDebtPosition: AccountDebtPosition(0, maxBorrowInfo.oudMaxBorrow, type(uint256).max, 0)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 5e18,
                expectedRemoveCollateralRequestAt: block.timestamp
            }),
            true
        );
    }

    function test_requestRemoveCollateral_failsCheckLiquidity() public {
        uint256 collateralAmount = 100_000e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        borrow(alice, collateralAmount, maxBorrowInfo.daiMaxBorrow, 0, FUNDS_REQUEST_MIN_SECS);

        // Can't remove any collateral now
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector));
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
            tlc.setExplicitAccess(operator, TempleLineOfCredit.cancelRemoveCollateralRequest.selector, true);

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

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        CheckAccountPositionParams memory params = CheckAccountPositionParams({
            account: alice,
            expectedDaiBalance: 0,
            expectedOudBalance: 0,
            expectedAccountPosition: AccountPosition({
                collateralPosted: collateralAmount,
                daiDebtPosition: AccountDebtPosition(0, maxBorrowInfo.daiMaxBorrow, type(uint256).max, 0),
                oudDebtPosition: AccountDebtPosition(0, maxBorrowInfo.oudMaxBorrow, type(uint256).max, 0)
            }),
            expectedDaiDebtCheckpoint: 0,
            expectedDaiAccumulatorCheckpoint: 0,
            expectedOudDebtCheckpoint: 0,
            expectedOudAccumulatorCheckpoint: 0,
            expectedRemoveCollateralRequest: 50,
            expectedRemoveCollateralRequestAt: block.timestamp
        });
        checkAccountPosition(params, true);
    
        vm.expectEmit(address(tlc));
        emit RemoveCollateralRequestCancelled(alice);
        tlc.cancelRemoveCollateralRequest(alice);

        params.expectedRemoveCollateralRequest = 0;
        params.expectedRemoveCollateralRequestAt = 0;
        checkAccountPosition(params, true);
    }

    function test_removeCollateral_failBeforeCooldown() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        uint32 ts = uint32(block.timestamp);
        vm.warp(block.timestamp + 30);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, ts, FUNDS_REQUEST_MIN_SECS, FUNDS_REQUEST_MAX_SECS));
        tlc.removeCollateral(alice);
    }

    function test_removeCollateral_successAtCooldownMin() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        vm.warp(block.timestamp + FUNDS_REQUEST_MIN_SECS);

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
        vm.warp(block.timestamp + 121);
        vm.expectRevert(abi.encodeWithSelector(NotInFundsRequestWindow.selector, block.timestamp, ts, FUNDS_REQUEST_MIN_SECS, FUNDS_REQUEST_MAX_SECS));
        tlc.removeCollateral(alice);
    }

    function test_removeCollateral_successAtCooldownMax() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        vm.warp(block.timestamp + FUNDS_REQUEST_MAX_SECS);

        vm.expectEmit(address(tlc));
        emit CollateralRemoved(alice, alice, 50);
        tlc.removeCollateral(alice);
    }

    function test_removeCollateral_failCheckLiquidity() public {
        // Lower the max LTV between doing the request and actually removing collateral.
        uint256 collateralAmount = 10 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        // Borrow half
        uint256 borrowAmount = maxBorrowInfo.daiMaxBorrow / 2;
        borrow(alice, collateralAmount, borrowAmount, 0, FUNDS_REQUEST_MIN_SECS);

        AccountPosition memory position = tlc.accountPosition(alice, true);
        assertEq(position.daiDebtPosition.maxBorrow, borrowAmount*2);
        assertEq(position.daiDebtPosition.healthFactor, 2e18);
        assertEq(position.daiDebtPosition.loanToValueRatio, 0.425e18);

        // Request the remaining half of the collateral back
        // Health = 1 (right at the limit)
        vm.startPrank(alice);
        tlc.requestRemoveCollateral(collateralAmount/2);
        
        position = tlc.accountPosition(alice, true);
        assertEq(position.daiDebtPosition.maxBorrow, borrowAmount);
        assertEq(position.daiDebtPosition.healthFactor, 1e18);
        assertEq(position.daiDebtPosition.loanToValueRatio, 0.85e18);

        // Lower the maxLTV       
        changePrank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.65e18);

        // Alice is now underwater...
        position = tlc.accountPosition(alice, true);
        assertEq(position.daiDebtPosition.maxBorrow, 3.1525e18);
        assertApproxEqRel(position.daiDebtPosition.healthFactor, 0.7647e18, 0.0001e18);
        assertEq(position.daiDebtPosition.loanToValueRatio, 0.85e18);

        // Now alice can't execute on the collateral remove request
        vm.warp(block.timestamp + FUNDS_REQUEST_MIN_SECS);
        changePrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ExceededMaxLtv.selector));
        tlc.removeCollateral(alice);

        // But she can still cancel the request, and re-go for a smaller amount
        tlc.cancelRemoveCollateralRequest(alice);

        // Position now drops
        position = tlc.accountPosition(alice, true);
        assertEq(position.daiDebtPosition.maxBorrow, 6.305e18);
        assertApproxEqRel(position.daiDebtPosition.healthFactor, 1.5294e18, 0.0001e18);
        assertApproxEqRel(position.daiDebtPosition.loanToValueRatio, 0.425e18, 0.0001e18);

        // And can now remove 1/3 of the collateral and still be healthy
        tlc.requestRemoveCollateral(collateralAmount/3);
        vm.warp(block.timestamp + FUNDS_REQUEST_MIN_SECS);
        tlc.removeCollateral(alice);
        position = tlc.accountPosition(alice, true);
        assertGt(position.daiDebtPosition.healthFactor, 1e18);
    }
    
    function test_removeCollateral_successWithChecks() public {
        uint256 collateralAmount = 1000;
        addCollateral(alice, collateralAmount);

        vm.startPrank(alice);
        tlc.requestRemoveCollateral(50);

        vm.warp(block.timestamp + FUNDS_REQUEST_MIN_SECS);

        assertEq(templeToken.balanceOf(alice), 0);

        vm.expectEmit(address(tlc));
        emit CollateralRemoved(alice, alice, 50);
        tlc.removeCollateral(alice);

        // The removeCollateral request is removed
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount-50);
        CheckAccountPositionParams memory params = CheckAccountPositionParams({
            account: alice,
            expectedDaiBalance: 0,
            expectedOudBalance: 0,
            expectedAccountPosition: AccountPosition({
                collateralPosted: collateralAmount-50,
                daiDebtPosition: AccountDebtPosition(0, maxBorrowInfo.daiMaxBorrow, type(uint256).max, 0),
                oudDebtPosition: AccountDebtPosition(0, maxBorrowInfo.oudMaxBorrow, type(uint256).max, 0)
            }),
            expectedDaiDebtCheckpoint: 0,
            expectedDaiAccumulatorCheckpoint: 0,
            expectedOudDebtCheckpoint: 0,
            expectedOudAccumulatorCheckpoint: 0,
            expectedRemoveCollateralRequest: 0,
            expectedRemoveCollateralRequestAt: 0
        });
        checkAccountPosition(params, true);
        assertEq(tlc.totalCollateral(), collateralAmount-50);
        assertEq(templeToken.balanceOf(address(tlc)), collateralAmount-50);
        assertEq(templeToken.balanceOf(alice), 50);

        // Pull the rest
        tlc.requestRemoveCollateral(collateralAmount-50);
        vm.warp(block.timestamp + FUNDS_REQUEST_MIN_SECS);
        tlc.removeCollateral(alice);
        params.expectedAccountPosition = AccountPosition({
            collateralPosted: 0,
            daiDebtPosition: AccountDebtPosition(0, 0, type(uint256).max, type(uint256).max),
            oudDebtPosition: AccountDebtPosition(0, 0, type(uint256).max, type(uint256).max)
        });
        checkAccountPosition(params, true);
        assertEq(tlc.totalCollateral(), 0);
        assertEq(templeToken.balanceOf(address(tlc)), 0);
        assertEq(templeToken.balanceOf(alice), collateralAmount);
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
                    daiDebtPosition: AccountDebtPosition(0, maxBorrowInfo.daiMaxBorrow, type(uint256).max, 0),
                    oudDebtPosition: AccountDebtPosition(0, maxBorrowInfo.oudMaxBorrow, type(uint256).max, 0)
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
        // checkAccountPosition(
        //     alice, 
        //     0, 0,
        //     AccountPosition({
        //         collateralPosted: collateralAmount,
        //         daiDebtPosition: AccountDebtPosition(0, maxBorrowInfo.daiMaxBorrow, type(uint256).max, 0),
        //         oudDebtPosition: AccountDebtPosition(0, maxBorrowInfo.oudMaxBorrow, type(uint256).max, 0)
        //     }),
        //     0, 0,
        //     0, 0,
        //     0
        // );
    }
}

// contract TempleLineOfCreditTestBorrow is TlcBaseTest {
//     event FundsRequested(address indexed account, FundsRequestType requestType, uint256 amount);

//     function test_requestBorrow_zeroAmount() external {
//         vm.startPrank(alice);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
//         tlc.requestBorrow(daiToken, 0);
//     }

//     function test_requestBorrow_success() external {
//         vm.startPrank(alice);
//         emit FundsRequested(alice, FundsRequestType.BORROW_DAI, 100 ether);
//         tlc.requestBorrow(daiToken, 100 ether);
//         checkFundsRequests(alice, 100 ether, block.timestamp, 0, 0, 0, 0);
//         checkFundsRequests(unauthorizedUser, 0, 0, 0, 0, 0, 0);

//         emit FundsRequested(alice, FundsRequestType.WITHDRAW_COLLATERAL, 50 ether);
//         tlc.requestBorrow(FundsRequestType.WITHDRAW_COLLATERAL, 50 ether);
//         checkFundsRequests(alice, 100 ether, block.timestamp, 0, 0, 50 ether, block.timestamp);

//         uint256 tsBefore = block.timestamp;
//         vm.warp(tsBefore + 100);

//         emit FundsRequested(alice, FundsRequestType.WITHDRAW_COLLATERAL, 75 ether);
//         tlc.requestBorrow(FundsRequestType.WITHDRAW_COLLATERAL, 75 ether);
//         checkFundsRequests(alice, 100 ether, tsBefore, 0, 0, 75 ether, block.timestamp);

//         uint256 tsBefore2 = block.timestamp;
//         vm.warp(tsBefore2 + 100);

//         changePrank(unauthorizedUser);
//         emit FundsRequested(unauthorizedUser, FundsRequestType.BORROW_OUD, 25 ether);
//         tlc.requestBorrow(oudToken, 25 ether);
//         checkFundsRequests(alice, 100 ether, tsBefore, 0, 0, 75 ether, tsBefore2);
//         checkFundsRequests(unauthorizedUser, 0, 0, 25 ether, block.timestamp, 0, 0);
//     }

//     // @todo need to check cancel too.
//     // @todo also guard against requesting in advance...need to track a nonce?
// }

contract TempleLineOfCreditTestBorrow is TlcBaseTest {
    // event Borrow(address indexed account, address indexed recipient, address indexed token, uint256 amount);

    function test_borrow_noRequest() external {
        vm.expectRevert(abi.encodeWithSelector(
            ITlcEventsAndErrors.NotInFundsRequestWindow.selector,
            0,
            FUNDS_REQUEST_MIN_SECS,
            FUNDS_REQUEST_MAX_SECS
        ));

        vm.prank(alice);
        tlc.borrow(daiToken, alice);
    }

    function test_borrow_requestInCooldown() external {
        vm.startPrank(alice);
        tlc.requestBorrow(daiToken, 25 ether);

        vm.warp(block.timestamp+10);
        vm.expectRevert(abi.encodeWithSelector(
            ITlcEventsAndErrors.NotInFundsRequestWindow.selector,
            block.timestamp-10,
            FUNDS_REQUEST_MIN_SECS,
            FUNDS_REQUEST_MAX_SECS
        ));
        tlc.borrow(daiToken, alice);

        // After the 30s, it now fails with a lack of collateral as expected
        vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS-10);
        vm.expectRevert(abi.encodeWithSelector(ITlcEventsAndErrors.ExceededMaxLtv.selector));
        tlc.borrow(daiToken, alice);
    }

    function test_borrow_failInsufficientCollateral() external {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        // Fails for more than we're allowed to borrow
        vm.startPrank(alice);
        uint256 borrowAmount = maxBorrowInfo.daiMaxBorrow + 1;
        {
            vm.expectRevert(abi.encodeWithSelector(ITlcEventsAndErrors.ExceededMaxLtv.selector));
            tlc.requestBorrow(daiToken, borrowAmount);
            // vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);

            // vm.expectRevert(abi.encodeWithSelector(ITlcEventsAndErrors.ExceededMaxLtv.selector));
            // tlc.borrow(daiToken, alice);
        }

        {
            tlc.requestBorrow(daiToken, borrowAmount-1);
            vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);

            // Since we now have the borrow request in play, we can't request
            // a remove collateral
            vm.expectRevert(abi.encodeWithSelector(ITlcEventsAndErrors.ExceededMaxLtv.selector));
            tlc.requestRemoveCollateral(collateralAmount);
        }

        // With the exact max amount succeeds
        {
            tlc.requestBorrow(daiToken, borrowAmount-1);
            vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);
            tlc.borrow(daiToken, alice);
        }
    }

    function test_borrowDaiOnly_success() external {
        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        uint256 borrowAmount = 90_000e18;

        uint256 collateralAmount = 200_000e18;
        addCollateral(alice, collateralAmount);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        vm.startPrank(alice);

        uint32 tsBefore = uint32(block.timestamp);
        {
            tlc.requestBorrow(daiToken, borrowAmount);
            vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);

            // An IR update is logged for DAI
            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), 0.1e18-1);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(daiToken), borrowAmount);

            tlc.borrow(daiToken, alice);

            // Fails now since the request was cleared.
            vm.expectRevert(abi.encodeWithSelector(
                ITlcEventsAndErrors.NotInFundsRequestWindow.selector,
                0,
                FUNDS_REQUEST_MIN_SECS,
                FUNDS_REQUEST_MAX_SECS
            ));
            tlc.borrow(daiToken, alice);
        }

        checkDebtTokenDetails(daiToken, borrowAmount, 0.1e18, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));
        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, tsBefore);

        // // // Check the DAI amount was borrowed fom the TRV and recorded correctly
        // // {
        // //     (uint256 debt, uint256 available, uint256 ceiling) = tlc.trvBorrowPosition();
        // //     assertEq(debt, borrowAmount);
        // //     assertEq(available, borrowCeiling-borrowAmount);  
        // //     assertEq(ceiling, borrowCeiling);
        // // }
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
        // checkAccountPosition(
        //     alice, 
        //     borrowAmount, 0,
        //     AccountPosition({
        //         collateralPosted: collateralAmount,
        //         daiDebtPosition: createDebtPosition(daiToken, borrowAmount, maxBorrowInfo),
        //         oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
        //     }),
        //     borrowAmount, INITIAL_INTEREST_ACCUMULATOR,
        //     0, 0,
        //     0
        // );

        // vm.stopPrank();
        // addCollateral(alice, 10 ether);
        // vm.startPrank(alice);
        // tlc.requestBorrow(daiToken, 1 ether);
        // vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);
        // tlc.borrow(daiToken, alice);
        // vm.stopPrank();

        // addCollateral(unauthorizedUser, 10 ether);
        // vm.startPrank(unauthorizedUser);
        // tlc.requestBorrow(daiToken, 1 ether);
        // vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);
        // tlc.borrow(daiToken, unauthorizedUser);
        // vm.stopPrank();

        // addCollateral(rescuer, 10 ether);
        // vm.startPrank(rescuer);
        // tlc.requestBorrow(daiToken, 1 ether);
        // vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);
        // uint256 gas = gasleft();
        // tlc.borrow(daiToken, rescuer);
        // console.log(gas-gasleft());

        // tlc.requestBorrow(daiToken, 1 ether);
        // vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);
        // gas = gasleft();
        // tlc.borrow(daiToken, rescuer);
        // console.log(gas-gasleft());
        // vm.stopPrank();
    }

    function test_borrowOudOnly_success() external {
        // For OUD, it's a flat rate of 5% interest rate
        uint256 borrowAmount = 10_000e18;

        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

        vm.startPrank(alice);

        uint32 tsBefore = uint32(block.timestamp);
        {
            tlc.requestBorrow(oudToken, borrowAmount);
            vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(oudToken), oudInterestRate);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(oudToken), borrowAmount);

            tlc.borrow(oudToken, alice);

            // Fails now since the request was cleared.
            vm.expectRevert(abi.encodeWithSelector(
                ITlcEventsAndErrors.NotInFundsRequestWindow.selector,
                0,
                FUNDS_REQUEST_MIN_SECS,
                FUNDS_REQUEST_MAX_SECS
            ));
            tlc.borrow(oudToken, alice);
        }

        checkDebtTokenDetails(daiToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, tsBefore);
        checkDebtTokenDetails(oudToken, borrowAmount, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

        // // Nothing changes in the TRV from borrowing OUD
        // {
        //     (uint256 debt, uint256 available, uint256 ceiling) = tlc.trvBorrowPosition();
        //     assertEq(debt, 0);
        //     assertEq(available, borrowCeiling);  
        //     assertEq(ceiling, borrowCeiling);
        // }
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
        // checkAccountPosition(
        //     alice, 
        //     0, borrowAmount,
        //     AccountPosition({
        //         collateralPosted: collateralAmount,
        //         daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
        //         oudDebtPosition: createDebtPosition(oudToken, borrowAmount, maxBorrowInfo)
        //     }),
        //     0, 0,
        //     borrowAmount, INITIAL_INTEREST_ACCUMULATOR,
        //     0
        // );

        // addCollateral(alice, 10 ether);
        // vm.startPrank(alice);
        // gasBefore = gasleft();
        // tlc.borrow(0, 1 ether, alice);
        // console.log("Gas:", gasBefore-gasleft());
        // vm.stopPrank();

        // addCollateral(unauthorizedUser, 10 ether);
        // vm.startPrank(unauthorizedUser);
        // gasBefore = gasleft();
        // tlc.borrow(0, 1 ether, unauthorizedUser);
        // console.log("Gas:", gasBefore-gasleft());
        // vm.stopPrank();

        // addCollateral(rescuer, 10 ether);
        // vm.startPrank(rescuer);
        // gasBefore = gasleft();
        // tlc.borrow(0, 1 ether, rescuer);
        // console.log("Gas:", gasBefore-gasleft());
        // vm.stopPrank();
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
            vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);

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
            // checkAccountPosition(
            //     alice, 
            //     borrowDaiAmount/2, borrowOudAmount/2,
            //     AccountPosition({
            //         collateralPosted: collateralAmount,
            //         daiDebtPosition: createDebtPosition(daiToken, borrowDaiAmount/2, maxBorrowInfo),
            //         oudDebtPosition: createDebtPosition(oudToken, borrowOudAmount/2, maxBorrowInfo)
            //     }),
            //     borrowDaiAmount/2, INITIAL_INTEREST_ACCUMULATOR,
            //     borrowOudAmount/2, INITIAL_INTEREST_ACCUMULATOR,
            //     0
            // );
        }

        // // Borrow the other half
        // expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);
        // {
        //     // ## TEST
        //         console.log("approxInterest:", approxInterest(borrowDaiAmount / 2, expectedDaiInterestRate, FUNDS_REQUEST_MIN_SECS));
        //         AccountPosition memory actualAccountPosition = positionHelper.accountPosition(alice);
        //         console.log(actualAccountPosition.debtPositions[0].debt);
        //     // ## TEST

        //     tlc.requestBorrow(daiToken, borrowDaiAmount / 2);
        //     tlc.requestBorrow(oudToken, borrowOudAmount / 2);
        //     vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);

        //     // ## TEST
        //         console.log("approxInterest:", approxInterest(borrowDaiAmount / 2, expectedDaiInterestRate, FUNDS_REQUEST_MIN_SECS));
        //         actualAccountPosition = positionHelper.accountPosition(alice);
        //         console.log(actualAccountPosition.debtPositions[0].debt);
        //     // ## TEST

        //     vm.expectEmit(address(tlc));
        //     emit InterestRateUpdate(address(daiToken), expectedDaiInterestRate);

        //     vm.expectEmit(address(tlc));
        //     emit Borrow(alice, alice, address(daiToken), borrowDaiAmount / 2);

        //     tlc.borrow(daiToken, alice);

        //     vm.expectEmit(address(tlc));
        //     emit Borrow(alice, alice, address(oudToken), borrowOudAmount / 2);

        //     // No OUD IR event as that hasn't changed.
        //     tlc.borrow(oudToken, alice);
        // }

        // {
        //     checkDebtTokenDetails(daiToken, borrowDaiAmount, expectedDaiInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        //     checkDebtTokenDetails(oudToken, borrowOudAmount, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        //     checkAccountPosition(
        //         alice, 
        //         borrowDaiAmount, borrowOudAmount,
        //         AccountPosition({
        //             collateralPosted: collateralAmount,
                    // daiDebtPosition: createDebtPosition(daiToken, borrowDaiAmount/2, maxBorrowInfo),
                    // oudDebtPosition: createDebtPosition(oudToken, borrowOudAmount/2, maxBorrowInfo)
        //         }),
        //         borrowDaiAmount, INITIAL_INTEREST_ACCUMULATOR,
        //         borrowOudAmount, INITIAL_INTEREST_ACCUMULATOR
        //     );
        // }

        // // Nothing left to borrow
        // tlc.requestBorrow(daiToken, 1);
        // tlc.requestBorrow(oudToken, 1);
        // vm.warp(block.timestamp+FUNDS_REQUEST_MIN_SECS);

        // vm.expectRevert(abi.encodeWithSelector(ITlcEventsAndErrors.ExceededMaxLtv.selector)); 
        // tlc.borrow(daiToken, alice);

        // vm.expectRevert(abi.encodeWithSelector(ITlcEventsAndErrors.ExceededMaxLtv.selector)); 
        // tlc.borrow(oudToken, alice);
    }

//     function test_borrowAlreadyBorrowed_failInsufficientCollateral() external {
//         uint256 borrowDaiAmountFirst = 30_000e18;
//         uint256 borrowOudAmountFirst = 20_000e18;
        
//         uint256 collateralAmount = 100_000e18;
//         borrow(alice, collateralAmount, borrowDaiAmountFirst, borrowOudAmountFirst);
//         MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

//         uint256 borrowDaiAmountSecond = maxBorrowInfo.daiMaxBorrow - borrowDaiAmountFirst + 1;
//         uint256 borrowOudAmountSecond = 10_000e18;

//         vm.expectRevert(abi.encodeWithSelector(
//             ITlcEventsAndErrors.ExceededMaxLtv.selector,
//             address(daiToken),
//             borrowDaiAmountSecond - 1,
//             borrowDaiAmountSecond
//         )); 
//         borrow(alice, 0, borrowDaiAmountSecond, borrowOudAmountSecond);
//     }
}

// contract TempleLineOfCreditTestInterestAccrual is TlcBaseTest {

//     function testBorrowAccruesInterestRate() external {
//         // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
//         uint256 borrowDaiAmount = 90_000e18;
//         int96 expectedDaiRate = 0.1e18;

//         // Flat interest rate of 5%
//         uint256 borrowOudAmount = 20_000e18;
//         int96 expectedOudRate = 0.05e18;
        
//         uint256 collateralAmount = 200_000e18;
        
//         borrow(alice, collateralAmount, borrowDaiAmount, borrowOudAmount);
//         MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

//         // Run checks after the initial borrow
//         {
//             checkDebtTokenDetails(daiToken, borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
//             checkDebtTokenDetails(oudToken, borrowOudAmount, expectedOudRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

//             checkAccountPosition(
//                 alice, 
//                 borrowDaiAmount, borrowOudAmount,
//                 AccountPosition({
//                     collateralPosted: collateralAmount,
//                     daiDebt: borrowDaiAmount,
//                     daiMaxBorrow: maxBorrowInfo.daiMaxBorrow,
//                     daiHealthFactor: maxBorrowInfo.daiCollateralValue * daiMaxLtvRatio / (borrowDaiAmount),
//                     daiLoanToValueRatio: (borrowDaiAmount) * 1e18 / maxBorrowInfo.daiCollateralValue,
//                     oudDebt: borrowOudAmount,
//                     oudMaxBorrow: maxBorrowInfo.oudMaxBorrow,
//                     oudHealthFactor: maxBorrowInfo.oudCollateralValue * oudMaxLtvRatio / (borrowOudAmount),
//                     oudLoanToValueRatio: (borrowOudAmount) * 1e18 / maxBorrowInfo.oudCollateralValue
//                 }),
//                 borrowDaiAmount, INITIAL_INTEREST_ACCUMULATOR,
//                 borrowOudAmount, INITIAL_INTEREST_ACCUMULATOR
//             );
//         }

//         uint256 age = 365 days;
//         uint256 tsBefore = block.timestamp;
//         vm.warp(block.timestamp + age); // 1 year continuously compunding

//         uint256 expectedDaiDebt = approxInterest(borrowDaiAmount, expectedDaiRate, age);
//         uint256 expectedOudDebt = approxInterest(borrowOudAmount, expectedOudRate, age);

//         // Run checks after a year.
//         // Now the total debt has increased and the health factors are updated.
//         // But nothing has been 'checkpointed' in storage yet.
//         {
//             checkDebtTokenDetails(daiToken, borrowDaiAmount, expectedDaiRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);
//             checkDebtTokenDetails(oudToken, borrowOudAmount, expectedOudRate, INITIAL_INTEREST_ACCUMULATOR, tsBefore);

//             checkAccountPosition(
//                 alice, 
//                 borrowDaiAmount, borrowOudAmount,
//                 AccountPosition({
//                     collateralPosted: collateralAmount,
//                     daiDebt: expectedDaiDebt,
//                     daiMaxBorrow: maxBorrowInfo.daiMaxBorrow,
//                     daiHealthFactor: maxBorrowInfo.daiCollateralValue * daiMaxLtvRatio / (expectedDaiDebt),
//                     daiLoanToValueRatio: (expectedDaiDebt) * 1e18 / maxBorrowInfo.daiCollateralValue,
//                     oudDebt: expectedOudDebt,
//                     oudMaxBorrow: maxBorrowInfo.oudMaxBorrow,
//                     oudHealthFactor: maxBorrowInfo.oudCollateralValue * oudMaxLtvRatio / (expectedOudDebt),
//                     oudLoanToValueRatio: (expectedOudDebt) * 1e18 / maxBorrowInfo.oudCollateralValue
//                 }),
//                 borrowDaiAmount, INITIAL_INTEREST_ACCUMULATOR,
//                 borrowOudAmount, INITIAL_INTEREST_ACCUMULATOR
//             );
//         }

//         // Refresh the token rates rates based on the new UR (after debt increased)
//         {
//             tlc.refreshInterestRates();

//             {
//                 int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, borrowCeiling);
//                 uint256 expectedAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiRate, age);
//                 checkDebtTokenDetails(daiToken, expectedDaiDebt, expectedDaiInterestRate, expectedAccumulator, block.timestamp);

//                 expectedAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedOudRate, age);
//                 checkDebtTokenDetails(oudToken, expectedOudDebt, expectedOudRate, expectedAccumulator, block.timestamp);
//             }

//             // Account balances remain the same
//             checkAccountPosition(
//                 alice, 
//                 borrowDaiAmount, borrowOudAmount,
//                 AccountPosition({
//                     collateralPosted: collateralAmount,
//                     daiDebt: expectedDaiDebt,
//                     daiMaxBorrow: maxBorrowInfo.daiMaxBorrow,
//                     daiHealthFactor: maxBorrowInfo.daiCollateralValue * daiMaxLtvRatio / (expectedDaiDebt),
//                     daiLoanToValueRatio: (expectedDaiDebt) * 1e18 / maxBorrowInfo.daiCollateralValue,
//                     oudDebt: expectedOudDebt,
//                     oudMaxBorrow: maxBorrowInfo.oudMaxBorrow,
//                     oudHealthFactor: maxBorrowInfo.oudCollateralValue * oudMaxLtvRatio / (expectedOudDebt),
//                     oudLoanToValueRatio: (expectedOudDebt) * 1e18 / maxBorrowInfo.oudCollateralValue
//                 }),
//                 borrowDaiAmount, INITIAL_INTEREST_ACCUMULATOR,
//                 borrowOudAmount, INITIAL_INTEREST_ACCUMULATOR
//             );
//         }

//         // Borrow just 1 wei more and the account checkpoint will update too
//         {
//             maxBorrowInfo = expectedMaxBorrows(collateralAmount);
//             vm.prank(alice);
//             tlc.borrow(1, 1, alice);

//             uint256 expectedDaiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiRate, age);
//             uint256 expectedOudAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedOudRate, age);
//             {
//                 int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, borrowCeiling);
//                 checkDebtTokenDetails(daiToken, expectedDaiDebt, expectedDaiInterestRate, expectedDaiAccumulator, block.timestamp);
//                 checkDebtTokenDetails(oudToken, expectedOudDebt, expectedOudRate, expectedOudAccumulator, block.timestamp);
//             }

//             // Account balances update
//             checkAccountPosition(
//                 alice, 
//                 borrowDaiAmount+1, borrowOudAmount+1,
//                 AccountPosition({
//                     collateralPosted: collateralAmount,
//                     daiDebt: expectedDaiDebt,
//                     daiMaxBorrow: maxBorrowInfo.daiMaxBorrow,
//                     daiHealthFactor: maxBorrowInfo.daiCollateralValue * daiMaxLtvRatio / (expectedDaiDebt),
//                     daiLoanToValueRatio: (expectedDaiDebt) * 1e18 / maxBorrowInfo.daiCollateralValue,
//                     oudDebt: expectedOudDebt,
//                     oudMaxBorrow: maxBorrowInfo.oudMaxBorrow,
//                     oudHealthFactor: maxBorrowInfo.oudCollateralValue * oudMaxLtvRatio / (expectedOudDebt),
//                     oudLoanToValueRatio: (expectedOudDebt) * 1e18 / maxBorrowInfo.oudCollateralValue
//                 }),
//                 expectedDaiDebt+1, expectedDaiAccumulator,
//                 expectedOudDebt+1, expectedOudAccumulator
//             );
//         }
//     }
// }

// // // @todo The debt ceiling might be higher than the amount of $$ the TRV actually has on hand.
// // // add a test to ensure that the denominator on the UR is using the max available, not the ceiling.

// contract TempleLineOfCreditTestRepay is TlcBaseTest {
//     event Repay(address indexed fundedBy, address indexed onBehalfOf, address indexed token, uint256 repayAmount);

//     function testRepayExceedBorrowedAmountFails() external {

//         // uint256 reserveAmount = 100_000e18;
//         uint256 borrowDaiAmount = 50_000e18;
//         uint256 borrowOudAmount = 20_000e18;
        
//         borrow(alice, 200_000e18, borrowDaiAmount, borrowOudAmount);

//         vm.expectRevert(abi.encodeWithSelector(
//             ITlcEventsAndErrors.ExceededBorrowedAmount.selector, address(daiToken), 
//             borrowDaiAmount, borrowDaiAmount + 1
//         )); 
//         vm.startPrank(alice);
//         tlc.repay(borrowDaiAmount + 1, 0, alice);
//         vm.stopPrank();
//     }

//     function testRepaySuccess() external {
//         uint256 borrowDaiAmount = 50_000e18; // 50% UR, ... // At kink approximately 10% interest rate
//         uint256 borrowOudAmount = 20_000e18; // Flat interest rate of 5%
        
//         uint256 collateralAmount = 200_000e18;
//         borrow(alice, collateralAmount, borrowDaiAmount, borrowOudAmount);

//         uint256 age = 365 days;
//         vm.warp(block.timestamp + age); // 1 year continuously compunding

//         vm.startPrank(alice);

//         int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling); // 7.77 %
//         uint256 expectedDaiDebt = approxInterest(borrowDaiAmount, expectedDaiInterestRate, age); // ~54k
//         uint256 expectedOudDebt = approxInterest(borrowOudAmount, oudInterestRate, age);

//         daiToken.approve(address(tlc), borrowDaiAmount);

//         // Repay and check state
//         uint256 daiAccumulator;
//         uint256 oudAccumulator;
//         {
//             (uint256 daiTotalDebt,) = checkTotalPosition(TotalPosition(
//                 utilizationRatio(expectedDaiDebt, borrowCeiling),
//                 expectedDaiInterestRate, 
//                 expectedDaiDebt, 
//                 oudInterestRate, 
//                 expectedOudDebt
//             ));
//             int96 updatedDaiInterestRate = calculateInterestRate(daiInterestRateModel, daiTotalDebt-borrowDaiAmount, borrowCeiling);
//             expectedDaiDebt -= borrowDaiAmount;
//             expectedOudDebt -= borrowOudAmount;

//             vm.expectEmit(address(tlc));
//             emit InterestRateUpdate(address(daiToken), updatedDaiInterestRate);
 
//             vm.expectEmit(address(tlc));
//             emit Repay(alice, alice, address(daiToken), borrowDaiAmount);

//             // No InterestRateUpdate for OUD as the rate didn't change

//             vm.expectEmit(address(tlc));
//             emit Repay(alice, alice, address(oudToken), borrowOudAmount);

//             tlc.repay(borrowDaiAmount, borrowOudAmount, alice);

//             // Check Reserve Token state
//             daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, age);
//             oudAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, oudInterestRate, age);
//             checkDebtTokenDetails(
//                 daiToken, 
//                 expectedDaiDebt, 
//                 updatedDaiInterestRate,
//                 daiAccumulator, 
//                 block.timestamp
//             );
//             checkDebtTokenDetails(
//                 oudToken, 
//                 expectedOudDebt, 
//                 oudInterestRate, 
//                 oudAccumulator, 
//                 block.timestamp
//             );
//         }

//         // Check account position
//         {
//             MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);

//             checkAccountPosition(
//                 alice, 
//                 0, 0,
//                 AccountPosition({
//                     collateralPosted: collateralAmount,
//                     daiDebt: expectedDaiDebt,
//                     daiMaxBorrow: maxBorrowInfo.daiMaxBorrow,
//                     daiHealthFactor: maxBorrowInfo.daiCollateralValue * daiMaxLtvRatio / (expectedDaiDebt),
//                     daiLoanToValueRatio: (expectedDaiDebt) * 1e18 / maxBorrowInfo.daiCollateralValue,
//                     oudDebt: expectedOudDebt,
//                     oudMaxBorrow: maxBorrowInfo.oudMaxBorrow,
//                     oudHealthFactor: maxBorrowInfo.oudCollateralValue * oudMaxLtvRatio / (expectedOudDebt),
//                     oudLoanToValueRatio: (expectedOudDebt) * 1e18 / maxBorrowInfo.oudCollateralValue
//                 }),
//                 expectedDaiDebt, daiAccumulator,
//                 expectedOudDebt, oudAccumulator
//             );
//         }

//         // And the total debt position
//         {
//             expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, expectedDaiDebt, borrowCeiling);
//             checkTotalPosition(TotalPosition(
//                 utilizationRatio(expectedDaiDebt, borrowCeiling),
//                 expectedDaiInterestRate, 
//                 expectedDaiDebt, 
//                 oudInterestRate, 
//                 expectedOudDebt
//             ));
//         }
//     }

//     // @todo fuzz on the age

//     function test_RepayEverythingSuccess() external {
//         uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
//         uint256 borrowOudAmount = 20_000e18; // Flat interest rate of 5%

//         uint256 collateralAmount = 200_000e18;
//         borrow(alice, collateralAmount, borrowDaiAmount, borrowOudAmount);
//         uint256 age = 365 days;
//         vm.warp(block.timestamp + age); // 1 year continuously compunding

//         AccountPosition memory position = tlc.accountPosition(alice);

//         // Repay the whole debt amount
//         {
//             // Deal extra for the accrued interest
//             dealAdditional(daiToken, alice, position.daiDebt - borrowDaiAmount);
//             dealAdditional(oudToken, alice, position.oudDebt - borrowOudAmount);

//             vm.startPrank(alice);
//             daiToken.approve(address(tlc), position.daiDebt);

//             vm.expectEmit(address(tlc));
//             emit Repay(alice, alice, address(daiToken), position.daiDebt);

//             vm.expectEmit(address(tlc));
//             emit Repay(alice, alice, address(oudToken), position.oudDebt);

//             tlc.repay(position.daiDebt, position.oudDebt, alice);
//         }

//         int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);
//         uint256 daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, age);
//         uint256 oudAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, oudInterestRate, age);

//         // Check the Reserve Tokens
//         {
//             checkDebtTokenDetails(
//                 daiToken, 
//                 0, 
//                 5e18 / 100, // back to the base interest rate
//                 daiAccumulator, 
//                 block.timestamp
//             );
//             checkDebtTokenDetails(
//                 oudToken, 
//                 0, 
//                 oudInterestRate, 
//                 oudAccumulator, 
//                 block.timestamp
//             );
//         }

//         // Check the account position
//         MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
//         checkAccountPosition(
//             alice, 
//             0, 0,
//             AccountPosition({
//                 collateralPosted: collateralAmount,
//                 daiDebt: 0,
//                 daiMaxBorrow: maxBorrowInfo.daiMaxBorrow,
//                 daiHealthFactor: type(uint256).max,
//                 daiLoanToValueRatio: 0,
//                 oudDebt: 0,
//                 oudMaxBorrow: maxBorrowInfo.oudMaxBorrow,
//                 oudHealthFactor: type(uint256).max,
//                 oudLoanToValueRatio: 0
//             }),
//             0, daiAccumulator,
//             0, oudAccumulator
//         );
//     }

//     function test_RepayAllSuccess() external {
//         uint256 borrowDaiAmount = 50_000e18; // At kink approximately 10% interest rate
//         uint256 borrowOudAmount = 20_000e18; // Flat interest rate of 5%
        
//         uint256 collateralAmount = 200_000e18;
//         borrow(alice, collateralAmount, borrowDaiAmount, borrowOudAmount);
//         uint256 age = 365 days;
//         vm.warp(block.timestamp + age); // 1 year continuously compunding

//         AccountPosition memory position = tlc.accountPosition(alice);

//         // RepayAll
//         {
//             // Deal extra for the accrued interest
//             dealAdditional(daiToken, alice, position.daiDebt - borrowDaiAmount);
//             dealAdditional(oudToken, alice, position.oudDebt - borrowOudAmount);

//             vm.startPrank(alice);
//             daiToken.approve(address(tlc), position.daiDebt);

//             vm.expectEmit(address(tlc));
//             emit Repay(alice, alice, address(daiToken), position.daiDebt);

//             vm.expectEmit(address(tlc));
//             emit Repay(alice, alice, address(oudToken), position.oudDebt);

//             tlc.repayAll(alice);
//         }

//         int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);
//         uint256 daiAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, expectedDaiInterestRate, age);
//         uint256 oudAccumulator = approxInterest(INITIAL_INTEREST_ACCUMULATOR, oudInterestRate, age);

//         // Check the Reserve Tokens
//         {
//             checkDebtTokenDetails(
//                 daiToken, 
//                 0, 
//                 5e18 / 100, // back to the base interest rate
//                 daiAccumulator, 
//                 block.timestamp
//             );
//             checkDebtTokenDetails(
//                 oudToken, 
//                 0, 
//                 oudInterestRate, 
//                 oudAccumulator, 
//                 block.timestamp
//             );
//         }

//         // Check the account position
//         MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
//         checkAccountPosition(
//             alice, 
//             0, 0,
//             AccountPosition({
//                 collateralPosted: collateralAmount,
//                 daiDebt: 0,
//                 daiMaxBorrow: maxBorrowInfo.daiMaxBorrow,
//                 daiHealthFactor: type(uint256).max,
//                 daiLoanToValueRatio: 0,
//                 oudDebt: 0,
//                 oudMaxBorrow: maxBorrowInfo.oudMaxBorrow,
//                 oudHealthFactor: type(uint256).max,
//                 oudLoanToValueRatio: 0
//             }),
//             0, daiAccumulator,
//             0, oudAccumulator
//         );
//     }
// }
