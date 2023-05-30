pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";

import { ITempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
// import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { LinearWithKinkInterestRateModel } from "contracts/v2/interestRate/LinearWithKinkInterestRateModel.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
// import { ITlcPositionHelper } from "contracts/interfaces/v2/templeLineOfCredit/ITlcPositionHelper.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";

import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";


    // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
    // so the rate is updated.
    // add a test for this.

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

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           DONE                             */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/


contract TempleLineOfCreditTestAdmin is TlcBaseTest {
    function test_Initalization() public {
        // assertEq(tlc.VERSION(), "1.0.0");
        assertEq(address(tlc.templeToken()), address(templeToken));

        // Check the enums line up
        // {
            // assertEq(tlc.NUM_TOKEN_TYPES(), uint256(type(TokenType).max) + 1);
            // assertEq(positionHelper.NUM_TOKEN_TYPES(), tlc.NUM_TOKEN_TYPES());
            // assertEq(uint256(daiToken), uint256(FundsRequestType.BORROW_DAI));
            // assertEq(uint256(oudToken), uint256(FundsRequestType.BORROW_OUD));
        // }

        // Reserve tokens are initialized
        checkDebtTokenDetails(daiToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));
        checkDebtTokenDetails(oudToken, 0, 0, INITIAL_INTEREST_ACCUMULATOR, uint32(block.timestamp));

        assertEq(address(tlc.treasuryReservesVault()), address(trv));

        (uint32 minSecs, uint32 maxSecs) = tlc.fundsRequestWindow();
        assertEq(minSecs, FUNDS_REQUEST_MIN_SECS);
        assertEq(maxSecs, FUNDS_REQUEST_MAX_SECS);
    }

    // function test_automatedShutdown() public {
    //     vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.Unimplemented.selector));
    //     tlc.automatedShutdown();
    // }

    function test_setInterestRateModel_NoDebt() public {
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

    // @todo add test to check cooldown

    function test_setInterestRateModel_WithDebt() public {
        uint256 collateralAmount = 10 ether;
        uint256 borrowDaiAmount = 1 ether;
        uint32 ts = uint32(block.timestamp);
        borrow(alice, collateralAmount, borrowDaiAmount, 0, 30);
        
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

// // //     function test_setMaxLtvRatio() internal {
// // //         // @todo
// // //     }

}

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           DONE                             */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

// contract TempleLineOfCreditTestAccess is TlcBaseTest {
//     function test_access_setFundRequestCooldownSecs() public {
//         expectElevatedAccess();
//         tlc.setFundRequestCooldownSecs(FundsRequestType.BORROW_DAI, FUNDS_REQUEST_MIN_SECS);
//     }

//     function test_access_setInterestRateModel() public {
//         expectElevatedAccess();
//         tlc.setInterestRateModel(daiToken, address(daiInterestRateModel));
//     }

//     function test_access_setMaxLtvRatio() public {
//         expectElevatedAccess();
//         tlc.setMaxLtvRatio(daiToken, 0);
//     }

//     function test_access_cancelFundsRequest() public {
//         expectElevatedAccess();
//         tlc.cancelFundsRequest(alice, FundsRequestType.BORROW_DAI);
//     }
// }

// @todo check that if LTV is zero, then borrows are disabled.


//     // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
//     // so the rate is updated.
//     // add a test for this.



contract TempleLineOfCreditTestCollateral is TlcBaseTest {
    // event CollateralAdded(address indexed fundedBy, address indexed onBehalfOf, uint256 collateralAmount);
    // event CollateralRemoved(address indexed account, address indexed recipient, uint256 collateralAmount);

// @todo add collateral on behalf of another account.
// @todo remove collateral (with cooldown)

    function test_addCollateral_failsZeroBalance() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vm.prank(alice);
        tlc.addCollateral(0, alice);
    }

    function test_addCollateral_success() external {
        uint256 collateralAmount = 200_000e18;

        {
            deal(address(templeToken), alice, collateralAmount);
            vm.startPrank(alice);
            templeToken.approve(address(tlc), collateralAmount);

            vm.expectEmit(true, true, true, true, address(tlc));
            emit CollateralAdded(alice, alice, collateralAmount);

            tlc.addCollateral(collateralAmount, alice);
            assertEq(templeToken.balanceOf(address(tlc)), collateralAmount);
            checkAccountData(
                alice,
                collateralAmount,
                0, 0, 0, 0
            );
        }

        // Post collateral again
        uint256 newCollateralAmount = 100_000e18;
        {
            deal(address(templeToken), alice, newCollateralAmount);
            templeToken.approve(address(tlc), newCollateralAmount);

            vm.expectEmit(true, true, true, true, address(tlc));
            emit CollateralAdded(alice, alice, newCollateralAmount);

            tlc.addCollateral(newCollateralAmount, alice);
            assertEq(templeToken.balanceOf(address(tlc)), collateralAmount + newCollateralAmount);

            checkAccountData(
                alice,
                collateralAmount + newCollateralAmount,
                0, 0, 0, 0
            );
        }
    }

    function test_accountPosition_afterAddCollateral() external {
        uint256 collateralAmount = 100_000e18;
        addCollateral(alice, collateralAmount);

        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        checkAccountPosition(
            alice, 
            0, 0,
            AccountPosition({
                collateralPosted: collateralAmount,
                daiDebtPosition: AccountDebtPosition(0, maxBorrowInfo.daiMaxBorrow, type(uint256).max, 0),
                oudDebtPosition: AccountDebtPosition(0, maxBorrowInfo.oudMaxBorrow, type(uint256).max, 0)
            }),
            0, 0,
            0, 0
        );
    }
}

// contract TempleLineOfCreditTestrequestBorrow is TlcBaseTest {
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
            alice, 
            borrowAmount, 0,
            AccountPosition({
                collateralPosted: collateralAmount,
                daiDebtPosition: createDebtPosition(daiToken, borrowAmount, maxBorrowInfo),
                oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
            }),
            borrowAmount, INITIAL_INTEREST_ACCUMULATOR,
            0, 0
        );

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
            alice, 
            0, borrowAmount,
            AccountPosition({
                collateralPosted: collateralAmount,
                daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                oudDebtPosition: createDebtPosition(oudToken, borrowAmount, maxBorrowInfo)
            }),
            0, 0,
            borrowAmount, INITIAL_INTEREST_ACCUMULATOR
        );

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
                alice, 
                borrowDaiAmount/2, borrowOudAmount/2,
                AccountPosition({
                    collateralPosted: collateralAmount,
                    daiDebtPosition: createDebtPosition(daiToken, borrowDaiAmount/2, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, borrowOudAmount/2, maxBorrowInfo)
                }),
                borrowDaiAmount/2, INITIAL_INTEREST_ACCUMULATOR,
                borrowOudAmount/2, INITIAL_INTEREST_ACCUMULATOR
            );
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

//             vm.expectEmit(true, true, true, true, address(tlc));
//             emit Repay(alice, alice, address(daiToken), position.daiDebt);

//             vm.expectEmit(true, true, true, true, address(tlc));
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

//             vm.expectEmit(true, true, true, true, address(tlc));
//             emit Repay(alice, alice, address(daiToken), position.daiDebt);

//             vm.expectEmit(true, true, true, true, address(tlc));
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
