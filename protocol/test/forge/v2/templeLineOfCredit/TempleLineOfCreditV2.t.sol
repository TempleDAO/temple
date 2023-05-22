// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// import "forge-std/Test.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TempleTest } from "../../TempleTest.sol";

import { TempleLineOfCredit, ITempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { LinearWithKinkInterestRateModel } from "contracts/v2/interestRate/LinearWithKinkInterestRateModel.sol";
import { FlatInterestRateModel } from "contracts/v2/interestRate/FlatInterestRateModel.sol";
import { TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";

import { ud } from "@prb/math/src/UD60x18.sol";

contract TempleLineOfCreditTestBase is TempleTest {
    TempleLineOfCredit public tlc;
    FakeERC20 templeToken;
    using SafeCast for uint256;
    
    FakeERC20 daiToken;
    IInterestRateModel daiInterestRateModel;
    uint216 daiMaxLtvRatio = 8500; // 85%

    uint256 templePrice = 9700;

    FakeERC20 oudToken;
    IInterestRateModel oudInterestRateModel;
    uint256 oudMaxLtvRatio = 9000; // 90%

    TreasuryReservesVault public trv;
    TempleDebtToken public dUSD;
    uint256 public constant defaultBaseInterest = 0.01e18;
    int96 public constant oudInterestRate = 0.05e18;

    // @todo move to sub tests.
    uint256 public constant trvStartingBalance = 1_000_000e18;
    uint256 public constant borrowCeiling = 100_000e18; //1_000_000e18;

    uint256 public constant PRICE_PRECISION = 10_000;

    event InterestRateUpdate(address indexed token, int96 newInterestRate);

    function setUp() public {
        // Default starts at 0 which can hide some issues
        vm.warp(1_000_000);

        daiToken = new FakeERC20("DAI Token", "DAI", executor, 500_000e18);
        vm.label(address(daiToken), "DAI");
        templeToken = new FakeERC20("TempleToken", "Temple", executor, 500_000e18);
        vm.label(address(templeToken), "TEMPLE");
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, defaultBaseInterest);
        vm.label(address(dUSD), "dUSD");

        trv = new TreasuryReservesVault(rescuer, executor, address(daiToken), address(dUSD), templePrice);
        
        // uint256 _baseInterestRate, uint256 _maxInterestRate, uint _kinkUtilization, uint _kinkInterestRateBps) {
        daiInterestRateModel = new LinearWithKinkInterestRateModel(
            5e18 / 100,  // 5% interest rate (rate% at 0% UR)
            20e18 / 100, // 20% percent interest rate (rate% at 100% UR)
            90e18 / 100, // 90% utilization (UR for when the kink starts)
            10e18 / 100  // 10% percent interest rate (rate% at kink% UR)
        );

        oudToken = new FakeERC20("OUD Token", "OUD", executor, 500_000e18);
        vm.label(address(oudToken), "OUD");
        oudInterestRateModel = new FlatInterestRateModel(uint256(int256(oudInterestRate)));

        tlc = new TempleLineOfCredit(
            rescuer, 
            executor, 
            "TempleLineOfCredit",
            address(trv),
            address(templeToken),
            defaultDaiConfig(),
            address(oudToken),
            defaultOudConfig()
        );

        vm.startPrank(executor);
        dUSD.addMinter(address(trv));
        trv.addNewStrategy(address(tlc), borrowCeiling, 0);
        vm.stopPrank();
        deal(address(daiToken), address(trv), trvStartingBalance, true);
    }

    function defaultDaiConfig() internal view returns (ITempleLineOfCredit.ReserveTokenConfig memory) {
        return ITlcDataTypes.ReserveTokenConfig({
            tokenPriceType: ITlcDataTypes.TokenPriceType.STABLE,  // 1 USD
            maxLtvRatio: daiMaxLtvRatio,
            interestRateModelType: ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE,
            interestRateModel: daiInterestRateModel
        });
    }

    function defaultOudConfig() internal view returns (ITempleLineOfCredit.ReserveTokenConfig memory) {
        return ITlcDataTypes.ReserveTokenConfig({
            tokenPriceType: ITlcDataTypes.TokenPriceType.TPI, // #OUD * TPI
            maxLtvRatio: oudMaxLtvRatio.encodeUInt216(),
            interestRateModelType: ITlcDataTypes.InterestRateModelType.FLAT,
            interestRateModel: oudInterestRateModel
        });
    }

    function getDefaultConfig(IERC20 token) internal view returns (ITempleLineOfCredit.ReserveTokenConfig memory) {
        return (address(token) == address(daiToken)) ? defaultDaiConfig() : defaultOudConfig();
    }

    function checkReserveTokenConfig(
        ITempleLineOfCredit.ReserveTokenConfig memory actual,
        ITempleLineOfCredit.ReserveTokenConfig memory expected
    ) internal {
        assertEq(uint256(actual.tokenPriceType), uint256(expected.tokenPriceType), "tokenPriceType");
        assertEq(actual.maxLtvRatio, expected.maxLtvRatio, "maxLtvRatio");
        assertEq(uint256(actual.interestRateModelType), uint256(expected.interestRateModelType), "interestRateModelType");
        assertEq(address(actual.interestRateModel), address(expected.interestRateModel), "interestRateModel");
    }

    function checkReserveTotals(
        ITempleLineOfCredit.ReserveTokenTotals memory actual,
        ITempleLineOfCredit.ReserveTokenTotals memory expected
    ) internal {
        assertEq(actual.totalDebt, expected.totalDebt, "totalDebt");
        assertApproxEqAbs(actual.interestRate, expected.interestRate, 1, "interestRate");
        assertApproxEqAbs(actual.interestAccumulator, expected.interestAccumulator, 1, "interestAccumulator");
        assertEq(actual.interestAccumulatorUpdatedAt, expected.interestAccumulatorUpdatedAt, "interestAccumulatorUpdatedAt");
    }

    function checkAfterBorrow(
        address user,
        IERC20 token,
        uint256 borrowedAmount,
        int96 expectedInterestRate,
        uint256 expectedInterestAccumulator
    ) internal {
        assertEq(token.balanceOf(user), borrowedAmount, "balanceOf");

        ITempleLineOfCredit.ReserveToken memory rt = tlc.getReserveToken(address(token));
        checkReserveTokenConfig(rt.config, getDefaultConfig(token));

        checkReserveTotals(rt.totals, ITlcDataTypes.ReserveTokenTotals({
            totalDebt: borrowedAmount.encodeUInt128(),
            interestRate: expectedInterestRate,
            interestAccumulator: expectedInterestAccumulator,
            interestAccumulatorUpdatedAt: uint32(block.timestamp)
        }));
    }

    function checkUserData(
        address account, 
        uint256 expectedCollateral, 
        uint256 expectedDaiDebt,
        uint256 expectedDaiInterestAccumulator,
        uint256 expectedOudDebt,
        uint256 expectedOudInterestAccumulator
    ) internal {
        (
            uint256 collateralPosted, 
            ITempleLineOfCredit.UserTokenDebt memory daiDebt,
            ITempleLineOfCredit.UserTokenDebt memory oudDebt
        ) = tlc.getUserData(account);

        assertEq(collateralPosted, expectedCollateral, "collateral");
        assertEq(daiDebt.debt, expectedDaiDebt, "DAI debt");
        assertEq(daiDebt.interestAccumulator, expectedDaiInterestAccumulator, "DAI interestAccumulator");
        assertEq(oudDebt.debt, expectedOudDebt, "OUD debt");
        assertEq(oudDebt.interestAccumulator, expectedOudInterestAccumulator, "OUD interestAccumulator");
    }

    function checkTotalDebtInfo(
        uint256 expectedUR, 
        int96 expectedDaiInterestRate, 
        uint256 expectedDaiDebt, 
        int96 expectedOudInterestRate, 
        uint256 expectedOudDebt
    ) internal returns (uint256, uint256) {
        (
            uint256 daiUtilizationRatio, 
            int256 daiBorrowRate, 
            uint256 daiTotalDebt,
            int256 oudBorrowRate,
            uint256 oudTotalDebt
        ) = tlc.totalDebtInfo();
        assertApproxEqRel(daiUtilizationRatio, expectedUR, 1e9);
        assertEq(daiBorrowRate, int96(expectedDaiInterestRate)); 
        assertApproxEqRel(daiTotalDebt, expectedDaiDebt, 1e9);
        assertEq(oudBorrowRate, int96(expectedOudInterestRate));
        assertApproxEqRel(oudTotalDebt, expectedOudDebt, 1e9);
        return (daiTotalDebt, oudTotalDebt);
    }

    function postCollateral(address user, uint256 collateralAmount) internal {
        // _initDeposit(reserveAmount);
        deal(address(templeToken), user, collateralAmount);
        vm.startPrank(user);
        templeToken.approve(address(tlc), collateralAmount);
        tlc.postCollateral(collateralAmount, user);
        vm.stopPrank();
    }

    function borrow(
        address _account, 
        uint256 collateralAmount, 
        uint256 daiBorrowAmount, 
        uint256 oudBorrowAmount
    ) internal {
        if (collateralAmount != 0) {
            postCollateral(_account, collateralAmount);
        }
        vm.startPrank(_account);
        tlc.borrow(daiBorrowAmount, oudBorrowAmount, _account);
        vm.stopPrank();
    }

    function approxInterest(uint256 principal, int96 rate, uint256 age) internal pure returns (uint256) {
        // Approxmiate as P * (1 + r/365 days)^(age)
        // ie compounding every 1 second (almost but not quite continuous)
        uint256 onePlusRate = uint256(int256(int96(1e18) + rate / 365 days));
        return ud(principal).mul(ud(onePlusRate).powu(age)).unwrap();
    }

    function utilizationRatio(uint256 borrowed, uint256 cap) internal pure returns (uint256) {
        return borrowed * 1e18 / cap;
    }

    function calculateInterestRate(IInterestRateModel model, uint256 borrowed, uint256 cap) internal view returns (int96) {
        return model.calculateInterestRate(utilizationRatio(borrowed, cap));
    }

}

contract TempleLineOfCreditTestAdmin is TempleLineOfCreditTestBase {
    function test_Initalization() public {
        assertEq(address(tlc.templeToken()), address(templeToken));
        // assertEq(uint256(tlc.templePriceType()), uint256(ITempleLineOfCredit.TokenPriceType.TPI));

        {
            ITempleLineOfCredit.ReserveToken memory daiRt = tlc.getReserveToken(address(daiToken));
            checkReserveTokenConfig(daiRt.config, defaultDaiConfig());
            checkReserveTotals(daiRt.totals, ITlcDataTypes.ReserveTokenTotals({
                totalDebt: 0,
                interestRate: 0,
                interestAccumulator: 1e18,
                interestAccumulatorUpdatedAt: uint32(block.timestamp)
            }));
        }

        {
            ITempleLineOfCredit.ReserveToken memory oudRt = tlc.getReserveToken(address(oudToken));
            checkReserveTokenConfig(oudRt.config, defaultOudConfig());
            checkReserveTotals(oudRt.totals, ITlcDataTypes.ReserveTokenTotals({
                totalDebt: 0,
                interestRate: 0,
                interestAccumulator: 1e18,
                interestAccumulatorUpdatedAt: uint32(block.timestamp)
            }));
        }

        assertEq(address(tlc.treasuryReservesVault()), address(trv));
    }

    function test_SetReserveTokenConfig_NoDebt() public {
        // By default, the interest rate is 0
        ITempleLineOfCredit.ReserveToken memory rt = tlc.getReserveToken(address(daiToken));
        assertEq(address(rt.config.interestRateModel), address(daiInterestRateModel));
        assertEq(rt.totals.totalDebt, 0);
        assertEq(rt.totals.interestRate, 0);
        assertEq(rt.totals.interestAccumulator, 1e18);
        assertEq(rt.totals.interestAccumulatorUpdatedAt, uint32(block.timestamp));

        tlc.refreshInterestRates(address(daiToken));
        rt = tlc.getReserveToken(address(daiToken));
        assertEq(address(rt.config.interestRateModel), address(daiInterestRateModel));
        assertEq(rt.totals.totalDebt, 0);
        assertEq(rt.totals.interestRate, oudInterestRate);
        assertEq(rt.totals.interestAccumulator, 1e18);
        assertEq(rt.totals.interestAccumulatorUpdatedAt, uint32(block.timestamp));

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
        ITlcDataTypes.ReserveTokenConfig memory newConfig = ITlcDataTypes.ReserveTokenConfig({
            tokenPriceType: ITlcDataTypes.TokenPriceType.STABLE,
            maxLtvRatio: daiMaxLtvRatio,
            interestRateModelType: ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE,
            interestRateModel: updatedInterestRateModel
        });
        tlc.setReserveTokenConfig(address(daiToken), newConfig);

        rt = tlc.getReserveToken(address(daiToken));
        assertEq(address(rt.config.interestRateModel), address(updatedInterestRateModel));
        assertEq(rt.totals.interestRate, 10e18 / 100);
        assertEq(rt.totals.totalDebt, 0);

        // The interest was accumulated up to now, using the prior interest rate 
        assertApproxEqAbs(rt.totals.interestAccumulator, approxInterest(1e18, oudInterestRate, age), 1e6);
        assertEq(rt.totals.interestAccumulatorUpdatedAt, uint32(block.timestamp));
    }

    function test_SetReserveTokenConfig_WithDebt() public {
        // By default, the interest rate is 0
        ITempleLineOfCredit.ReserveToken memory rt = tlc.getReserveToken(address(daiToken));
        assertEq(address(rt.config.interestRateModel), address(daiInterestRateModel));
        assertEq(rt.totals.totalDebt, 0);
        assertEq(rt.totals.interestRate, 0);
        assertEq(rt.totals.interestAccumulator, 1e18);
        assertEq(rt.totals.interestAccumulatorUpdatedAt, uint32(block.timestamp));

        uint256 borrowDaiAmount = 1 ether;
        postCollateral(alice, 10 ether);
        vm.startPrank(alice);
        tlc.borrow(1 ether, 0, alice);
        vm.stopPrank();
        
        // tlc.refreshInterestRates(address(daiToken));
        rt = tlc.getReserveToken(address(daiToken));
        assertEq(address(rt.config.interestRateModel), address(daiInterestRateModel));
        assertEq(rt.totals.totalDebt, 1 ether);
        int96 expectedInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);
        assertEq(rt.totals.interestRate, expectedInterestRate);
        assertEq(rt.totals.interestAccumulator, 1e18);
        assertEq(rt.totals.interestAccumulatorUpdatedAt, uint32(block.timestamp));

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
        ITlcDataTypes.ReserveTokenConfig memory newConfig = ITlcDataTypes.ReserveTokenConfig({
            tokenPriceType: ITlcDataTypes.TokenPriceType.STABLE,
            maxLtvRatio: daiMaxLtvRatio,
            interestRateModelType: ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE,
            interestRateModel: updatedInterestRateModel
        });
        tlc.setReserveTokenConfig(address(daiToken), newConfig);

        rt = tlc.getReserveToken(address(daiToken));
        assertEq(address(rt.config.interestRateModel), address(updatedInterestRateModel));
        assertEq(rt.totals.interestRate, calculateInterestRate(updatedInterestRateModel, borrowDaiAmount, borrowCeiling));
        assertEq(rt.totals.totalDebt, 1 ether * rt.totals.interestAccumulator / 1e18);

        // The interest was accumulated up to now, using the prior interest rate 
        assertApproxEqAbs(rt.totals.interestAccumulator, approxInterest(1e18, expectedInterestRate, age), 1e6);
        assertEq(rt.totals.interestAccumulatorUpdatedAt, uint32(block.timestamp));
    }

//     function test_setMaxLtvRatio() internal {
//         // @todo
//     }

}

// contract TempleLineOfCreditTestAccess is TempleLineOfCreditTestBase {

//     function testSetInterestRateFailsNotOperator() public {
//         expectElevatedAccess();
//         tlc.setReserveTokenConfig(address(daiToken), defaultDaiConfig());
//     }

//     function testSetInterestRateFailsUnsupported() public {
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidToken.selector, alice));

//         vm.prank(executor);
//         tlc.setReserveTokenConfig(alice, defaultDaiConfig());
//     }
// }



    // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
    // so the rate is updated.
    // add a test for this.



contract TempleLineOfCreditTestCollateral is TempleLineOfCreditTestBase {
    event PostCollateral(address indexed fundedBy, address indexed onBehalfOf, uint256 collateralAmount);

    function testPostCollateralZeroBalanceRevert() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAmount.selector, address(templeToken), 0));
        vm.prank(alice);
        uint256 collateralAmount = 0;
        tlc.postCollateral(collateralAmount, alice);
    }

    function testPostCollateralPasses() external {
        uint256 collateralAmount = 200_000e18;
        deal(address(templeToken), alice, collateralAmount);
        vm.startPrank(alice);
        templeToken.approve(address(tlc), collateralAmount);

        // assert emit 
        vm.expectEmit(true, true, true, true, address(tlc));
        emit PostCollateral(alice, alice, collateralAmount);

        tlc.postCollateral(collateralAmount, alice);
        assertEq(templeToken.balanceOf(address(tlc)), collateralAmount);
        // assertEq(tlc.userCollateralPosted(alice), collateralAmount);
        checkUserData(
            alice,
            collateralAmount,
            0, 0, 0, 0
        );

        // Post collateral again
        uint256 newCollateralAmount = 100_000e18;
        deal(address(templeToken), alice, newCollateralAmount);
        templeToken.approve(address(tlc), newCollateralAmount);

        // assert emit 
        vm.expectEmit(true, true, true, true, address(tlc));
        emit PostCollateral(alice, alice, newCollateralAmount);

        tlc.postCollateral(newCollateralAmount, alice);
        assertEq(templeToken.balanceOf(address(tlc)), collateralAmount + newCollateralAmount);

        checkUserData(
            alice,
            collateralAmount + newCollateralAmount,
            0, 0, 0, 0
        );

        vm.stopPrank();
    }

    function testBorrowCapacityCorrect() external {
        uint256 collateralAmount = 100_000e18;
        postCollateral(alice, collateralAmount);
        uint256 expectedMaxBorrowCapacity = collateralAmount * 9_700/10_000 * 85/100;
        assertEq(tlc.maxBorrowCapacity(address(daiToken), alice), expectedMaxBorrowCapacity);

        expectedMaxBorrowCapacity = collateralAmount * 90/100;
        assertEq(tlc.maxBorrowCapacity(address(oudToken), alice), expectedMaxBorrowCapacity);
    }
}

contract TempleLineOfCreditTestBorrow is TempleLineOfCreditTestBase {
    event Borrow(address indexed account, address indexed recipient, address indexed token, uint256 amount);

    function testBorrowInsufficientCollateral() external {
        uint256 collateralAmount = 100_000e18;
        postCollateral(alice, collateralAmount);
        uint256 maxBorrowCapacity = tlc.maxBorrowCapacity(address(daiToken), alice);
        uint256 borrowAmount = maxBorrowCapacity + 1;
        vm.expectRevert(abi.encodeWithSelector(ITempleLineOfCredit.InsufficentCollateral.selector, maxBorrowCapacity, borrowAmount));

        vm.startPrank(alice);
        tlc.borrow(borrowAmount, 0, alice);
        vm.stopPrank();
    }

    function test_BorrowDaiOnlySuccess() external {
        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        uint256 borrowAmount = 90_000e18;

        uint256 collateralAmount = 200_000e18;
        postCollateral(alice, collateralAmount);

        uint256 maxDaiBorrow = tlc.maxBorrowCapacity(address(daiToken), alice);
        assertEq(maxDaiBorrow, collateralAmount * templePrice/10_000 * daiMaxLtvRatio/10_000);

        vm.prank(alice);

        {
            // An IR update is logged for DAI
            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), 0.1e18-1);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(daiToken), borrowAmount);

            tlc.borrow(borrowAmount, 0, alice);
        }

        // checkAfterBorrow(alice, daiToken, borrowAmount, 0.1e18, 1e18);
        // checkAfterBorrow(alice, oudToken, 0, 0, 1e18);

        // // Check the DAI amount was borrowed fom the TRV and recorded correctly
        // {
        //     (uint256 debt, uint256 available, uint256 ceiling) = tlc.trvBorrowPosition();
        //     assertEq(debt, borrowAmount/2);
        //     assertEq(available, borrowCeiling-borrowAmount/2);  
        //     assertEq(ceiling, borrowCeiling);
        // }

        // // Max borrow remains unchanged.
        // assertEq(tlc.maxBorrowCapacity(address(daiToken), alice), maxDaiBorrow);

        // (uint256 daiBorrowed, uint256 oudBorrowed) = tlc.userTotalDebt(alice);
        // assertEq(daiBorrowed, borrowAmount);
        // assertEq(oudBorrowed, 0);


        // postCollateral(alice, 10 ether);
        // vm.startPrank(alice);
        // tlc.borrow(1 ether, 0, alice);
        // vm.stopPrank();

        // postCollateral(unauthorizedUser, 10 ether);
        // vm.startPrank(unauthorizedUser);
        // tlc.borrow(1 ether, 0, unauthorizedUser);
        // vm.stopPrank();

        // postCollateral(rescuer, 10 ether);
        // vm.startPrank(rescuer);
        // console.log(gasleft());
        // tlc.borrow(1 ether, 0, rescuer);
        // console.log(gasleft());
        // vm.stopPrank();
    }

    function test_BorrowOudOnlySuccess() external {
        // For OUD, it's a flat rate of 5% interest rate
        uint256 borrowAmount = 10_000e18;

        uint256 collateralAmount = 100_000e18;
        postCollateral(alice, collateralAmount);
        uint256 maxOudBorrow = tlc.maxBorrowCapacity(address(oudToken), alice);
        assertEq(maxOudBorrow, collateralAmount * oudMaxLtvRatio/10_000);

        vm.prank(alice);

        {
            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(oudToken), oudInterestRate);

            // An IR update is not logged for OUD as it didn't change
            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(oudToken), borrowAmount);

            tlc.borrow(0, borrowAmount, alice);
        }

        checkAfterBorrow(alice, daiToken, 0, 0, 1e18); //, 0);
        checkAfterBorrow(alice, oudToken, borrowAmount, oudInterestRate, 1e18); //, 0);

        // Max borrow remains unchanged.
        assertEq(tlc.maxBorrowCapacity(address(oudToken), alice), maxOudBorrow);

        (uint256 daiBorrowed, uint256 oudBorrowed) = tlc.userTotalDebt(alice);
        assertEq(daiBorrowed, 0);
        assertEq(oudBorrowed, borrowAmount);

        // postCollateral(alice, 10 ether);
        // vm.startPrank(alice);
        // gasBefore = gasleft();
        // tlc.borrow(0, 1 ether, alice);
        // console.log("Gas:", gasBefore-gasleft());
        // vm.stopPrank();

        // postCollateral(unauthorizedUser, 10 ether);
        // vm.startPrank(unauthorizedUser);
        // gasBefore = gasleft();
        // tlc.borrow(0, 1 ether, unauthorizedUser);
        // console.log("Gas:", gasBefore-gasleft());
        // vm.stopPrank();

        // postCollateral(rescuer, 10 ether);
        // vm.startPrank(rescuer);
        // gasBefore = gasleft();
        // tlc.borrow(0, 1 ether, rescuer);
        // console.log("Gas:", gasBefore-gasleft());
        // vm.stopPrank();
    }

    function test_BorrowDaiAndOudSucess() external {
        postCollateral(alice, 100_000e18);

        uint256 borrowDaiAmount = tlc.maxBorrowCapacity(address(daiToken), alice);
        uint256 borrowOudAmount = tlc.maxBorrowCapacity(address(oudToken), alice); 

        vm.startPrank(alice);

        int96 expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount / 2, borrowCeiling);

        {
            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), expectedDaiInterestRate);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(daiToken), borrowDaiAmount / 2);

            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(oudToken), oudInterestRate);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(oudToken), borrowOudAmount / 2);

            tlc.borrow(borrowDaiAmount/2 , borrowOudAmount/2, alice);
        }

        checkAfterBorrow(alice, daiToken, borrowDaiAmount / 2, expectedDaiInterestRate, 1e18);
        checkAfterBorrow(alice, oudToken, borrowOudAmount / 2, oudInterestRate, 1e18);

        expectedDaiInterestRate = calculateInterestRate(daiInterestRateModel, borrowDaiAmount, borrowCeiling);

        {
            vm.expectEmit(address(tlc));
            emit InterestRateUpdate(address(daiToken), expectedDaiInterestRate);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(daiToken), borrowDaiAmount / 2);

            vm.expectEmit(address(tlc));
            emit Borrow(alice, alice, address(oudToken), borrowOudAmount / 2);

            // No OUD IR event as that hasn't changed.

            tlc.borrow(borrowDaiAmount/2 , borrowOudAmount/2, alice);
        }

        checkAfterBorrow(alice, daiToken, borrowDaiAmount, expectedDaiInterestRate, 1e18);
        checkAfterBorrow(alice, oudToken, borrowOudAmount, oudInterestRate, 1e18);

        vm.expectRevert(abi.encodeWithSelector(ITempleLineOfCredit.InsufficentCollateral.selector, 0,  1)); 
        tlc.borrow(1, 0, alice);

        vm.expectRevert(abi.encodeWithSelector(ITempleLineOfCredit.InsufficentCollateral.selector, 0,  1)); 
        tlc.borrow(0, 1, alice);
    }

    function testBorrowAlreadyBorrowedFailInsufficientCollateral() external {
        uint256 borrowDaiAmountFirst = 30_000e18;
        uint256 borrowOudAmountFirst = 20_000e18;
        
        // console.log("Max Borrow Capacity 1:", tlc.maxBorrowCapacity(address(daiToken), alice));
        borrow(alice, 100_000e18, borrowDaiAmountFirst, borrowOudAmountFirst);

        uint256 borrowDaiAmountSecond = tlc.maxBorrowCapacity(address(daiToken), alice) - borrowDaiAmountFirst + 1;
        uint256 borrowOudAmountSecond = 10_000e18;

        // console.log("Max Borrow Capacity 2:", tlc.maxBorrowCapacity(address(daiToken), alice));
        // console.log("Borrowing:", borrowDaiAmountSecond, borrowOudAmountSecond);

        vm.expectRevert(abi.encodeWithSelector(ITempleLineOfCredit.InsufficentCollateral.selector, borrowDaiAmountSecond - 1,  borrowDaiAmountSecond)); 
        borrow(alice, 0, borrowDaiAmountSecond, borrowOudAmountSecond);
    }
}

contract TempleLineOfCreditTestInterestAccrual is TempleLineOfCreditTestBase {

    function testBorrowAccruesInterestRate() external {
        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        uint256 borrowDaiAmount = 90_000e18;
        int96 expectedDaiRate = 0.1e18;

        // Flat interest rate of 5%
        uint256 borrowOudAmount = 20_000e18;
        int96 expectedOudRate = 0.05e18;
        
        borrow(alice, 200_000e18, borrowDaiAmount, borrowOudAmount);

        (uint256 totalDaiDebt, uint256 totalOudDebt) = tlc.userTotalDebt(alice);
        assertEq(totalDaiDebt, borrowDaiAmount);
        assertEq(totalOudDebt, borrowOudAmount);
        
        // console.log("ts:", block.timestamp);
        uint256 age = 365 days;
        vm.warp(block.timestamp + age); // 1 year continuously compunding
        (totalDaiDebt, totalOudDebt) = tlc.userTotalDebt(alice);
        // console.log("ts:", block.timestamp);

        // TLC from TRV:
        //   started with 100k limit
        //   borrowed 90k
        //   1% interest on 90k = 90,904.52
        //   remaining allowance to borrow = 100k - 90,094 = 9,096
        // denominator = 100k

        // (uint256 existingDebt, uint256 availableToBorrow) = trv.trvBorrowPosition(address(tlc));
        // console.log("TRV BALANCES:", existingDebt, availableToBorrow);
        // console.log("DAI BORROW RATE:", tlc.getBorrowRate(address(daiToken)));

        // 10% continuously compounding ~ 10.52 apr
        // uint256 precision = 1_000_000_000;
        // uint256 compoundedRate = 105_170_918; // ~10% continuously compounded for 1yr. `1 * e^(0.1)`
        // approxInterest(borrowDaiAmountFirst, 0.1e18, age);

        // UR = 0%, so 
        assertApproxEqRel(totalDaiDebt, approxInterest(borrowDaiAmount, expectedDaiRate, age), 1e9);

        // 5% continuously compounding ~ 5.13 apr
        assertApproxEqRel(totalOudDebt, approxInterest(borrowOudAmount, expectedOudRate, age), 1e9);
    }
}

// // @todo The debt ceiling might be higher than the amount of $$ the TRV actually has on hand.
// // add a test to ensure that the denominator on the UR is using the max available, not the ceiling.

contract TempleLineOfCreditTestRepay is TempleLineOfCreditTestBase {
    event Repay(address indexed fundedBy, address indexed onBehalfOf, address indexed token, uint256 repayAmount);

    function testRepayExceedBorrowedAmountFails() external {

        // uint256 reserveAmount = 100_000e18;
        uint256 borrowDaiAmountFirst = 50_000e18;
        uint256 borrowOudAmountFirst = 20_000e18;
        
        borrow(alice, 200_000e18, borrowDaiAmountFirst, borrowOudAmountFirst);

        vm.expectRevert(abi.encodeWithSelector(ITempleLineOfCredit.ExceededBorrowedAmount.selector, borrowDaiAmountFirst, borrowDaiAmountFirst + 1)); 
        vm.startPrank(alice);
        tlc.repay(borrowDaiAmountFirst + 1, 0, alice);
        vm.stopPrank();
    }

    function testRepaySuccess() external {
        uint256 borrowDaiAmountFirst = 50_000e18; // 50% UR, ... // At kink approximately 10% interest rate
        uint256 borrowOudAmountFirst = 20_000e18; // Flat interest rate of 5%
        
        borrow(alice, 200_000e18, borrowDaiAmountFirst, borrowOudAmountFirst);

        uint256 age = 365 days;
        vm.warp(block.timestamp + age); // 1 year continuously compunding

        vm.startPrank(alice);
        // (uint256 totalDaiDebtPrior, uint256 totalOudDebtPrior) = tlc.userTotalDebt(alice);

        uint256 repayDaiAmount = borrowDaiAmountFirst; // pay of initial borrowed amount 
        uint256 repayOudAmount = borrowOudAmountFirst; // pay of initial borrowed amount 
        daiToken.approve(address(tlc), repayDaiAmount);

        // Double check TRV's debt as a strategy to TLC
        {
            (uint256 trvDebt, uint256 trvAvailable, uint256 ceiling) = tlc.trvBorrowPosition();
            assertApproxEqRel(trvDebt, approxInterest(borrowDaiAmountFirst, 0.01e18, age), 1e9);
            assertEq(trvAvailable, borrowCeiling-trvDebt);
            assertEq(ceiling, borrowCeiling);
        }

        uint256 daiTotalDebt;
        {
            int96 expectedDaiInterestRate = 77777777777777777; // 7.77 %
            uint256 expectedDaiDebt = approxInterest(borrowDaiAmountFirst, expectedDaiInterestRate, age); // ~54k
            uint256 expectedUR = utilizationRatio(expectedDaiDebt, borrowCeiling); // ~54%
            (daiTotalDebt,) = checkTotalDebtInfo(
                expectedUR, 
                expectedDaiInterestRate, 
                expectedDaiDebt, 
                oudInterestRate, 
                approxInterest(borrowOudAmountFirst, oudInterestRate, age)
            );
        }

        (uint256 userDaiDebt1, uint256 userOudDebt1) = tlc.userTotalDebt(alice);

        vm.expectEmit(address(tlc));
        // console.log("expected _updateRate:", daiTotalDebt, repayDaiAmount, borrowCeiling);
        emit InterestRateUpdate(address(daiToken), calculateInterestRate(daiInterestRateModel, daiTotalDebt-repayDaiAmount, borrowCeiling));

        // assert emit    
        vm.expectEmit(address(tlc));
        emit Repay(alice, alice, address(daiToken), repayDaiAmount);

        // No InterestRateUpdate for OUD as the rate didn't change

        vm.expectEmit(address(tlc));
        emit Repay(alice, alice, address(oudToken), repayOudAmount);

        tlc.repay(repayDaiAmount, repayOudAmount, alice);

        (uint256 userDaiDebt2, uint256 userOudDebt2) = tlc.userTotalDebt(alice);

        assertEq(userDaiDebt2, userDaiDebt1 - borrowDaiAmountFirst); // Remaining amount is interest accumulated
        assertEq(userOudDebt2, userOudDebt1 - borrowOudAmountFirst);
        // // vm.stopPrank();
    }

    function test_RepayEverythingSuccess() external {

        // uint256 reserveAmount = 100_000e18;
        uint256 borrowDaiAmountFirst = 50_000e18; // At kink approximately 10% interest rate
        uint256 borrowOudAmountFirst = 20_000e18; // Flat interest rate of 5%
        
        borrow(alice, 200_000e18, borrowDaiAmountFirst, borrowOudAmountFirst);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        vm.startPrank(alice);

        (uint256 repayDaiAmount, uint256 repayOudAmount) = tlc.userTotalDebt(alice); // Repay all debt

        deal(address(daiToken), alice, repayDaiAmount); // Give to pay of interest payment
        deal(address(oudToken), alice, repayOudAmount);
        daiToken.approve(address(tlc), repayDaiAmount);

        // assert emit 
        vm.expectEmit(true, true, true, true, address(tlc));
        emit Repay(alice, alice, address(daiToken), repayDaiAmount);

        vm.expectEmit(true, true, true, true, address(tlc));
        emit Repay(alice, alice, address(oudToken), repayOudAmount);

        tlc.repay(repayDaiAmount, repayOudAmount, alice);

        (uint256 totalDaiDebt, uint256 totalOudDebt) = tlc.userTotalDebt(alice);

        assertEq(totalDaiDebt, 0);
        assertEq(totalOudDebt, 0);
        vm.stopPrank();
    }

    function test_RepayAllSuccess() external {

        // uint256 reserveAmount = 100_000e18;
        uint256 borrowDaiAmountFirst = 50_000e18; // At kink approximately 10% interest rate
        uint256 borrowOudAmountFirst = 20_000e18; // Flat interest rate of 5%
        
        borrow(alice, 200_000e18, borrowDaiAmountFirst, borrowOudAmountFirst);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        vm.startPrank(alice);

        (uint256 repayDaiAmount, uint256 repayOudAmount) = tlc.userTotalDebt(alice); // Repay all debt

        deal(address(daiToken), alice, repayDaiAmount); // Give to pay of interest payment
        deal(address(oudToken), alice, repayOudAmount);
        daiToken.approve(address(tlc), repayDaiAmount);

        // assert emit 
        vm.expectEmit(true, true, true, true, address(tlc));
        emit Repay(alice, alice, address(daiToken), repayDaiAmount);

        vm.expectEmit(true, true, true, true, address(tlc));
        emit Repay(alice, alice, address(oudToken), repayOudAmount);

        tlc.repayAll(alice);

        (uint256 totalDaiDebt, uint256 totalOudDebt) = tlc.userTotalDebt(alice);

        assertEq(totalDaiDebt, 0);
        assertEq(totalOudDebt, 0);
        vm.stopPrank();
    }
}
