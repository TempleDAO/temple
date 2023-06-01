pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ud } from "@prb/math/src/UD60x18.sol";
import { TempleTest } from "../../TempleTest.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
// import { TlcPositionHelper, ITlcPositionHelper } from "contracts/v2/templeLineOfCredit/TlcPositionHelper.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { TempleLineOfCredit, ITempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { TlcStrategy } from "contracts/v2/templeLineOfCredit/TlcStrategy.sol";
import { TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { LinearWithKinkInterestRateModel } from "contracts/v2/interestRate/LinearWithKinkInterestRateModel.sol";
import { FlatInterestRateModel } from "contracts/v2/interestRate/FlatInterestRateModel.sol";

contract TlcBaseTest is TempleTest, ITlcDataTypes, ITlcEventsAndErrors {
    TempleLineOfCredit public tlc;
    TlcStrategy public tlcStrategy;
    // TlcPositionHelper public positionHelper;

    FakeERC20 templeToken;
    using SafeCast for uint256;
    
    FakeERC20 daiToken;
    IInterestRateModel daiInterestRateModel;
    uint128 daiMaxLtvRatio = 0.85e18; // 85%

    uint256 templePrice = 0.97e18; // $0.97

    FakeERC20 oudToken;
    IInterestRateModel oudInterestRateModel;
    uint256 oudMaxLtvRatio = 0.9e18; // 90%

    TreasuryReservesVault public trv;
    TempleDebtToken public dUSD;
    uint256 public constant defaultBaseInterest = 0.01e18; // 1%
    int96 public constant oudInterestRate = 0.05e18; // 5%

    // @todo move to sub tests.
    uint256 public constant trvStartingBalance = 1_000_000e18;
    uint256 public constant borrowCeiling = 100_000e18;

    uint256 internal constant INITIAL_INTEREST_ACCUMULATOR = 1e27;
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant LTV_PRECISION = 1e18;
    
    uint32 public constant FUNDS_REQUEST_MIN_SECS = 60;
    uint32 public constant FUNDS_REQUEST_MAX_SECS = 120;

    function setUp() public {
        // Default starts at 0 which can hide some issues
        vm.warp(1_000_000);

        // Create tokens
        {
            daiToken = new FakeERC20("DAI Token", "DAI", executor, 500_000e18);
            vm.label(address(daiToken), "DAI");
            templeToken = new FakeERC20("TempleToken", "Temple", executor, 500_000e18);
            vm.label(address(templeToken), "TEMPLE");
            dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, defaultBaseInterest);
            vm.label(address(dUSD), "dUSD");
            oudToken = new FakeERC20("OUD Token", "OUD", executor, 500_000e18);
            vm.label(address(oudToken), "OUD");
        }

        trv = new TreasuryReservesVault(rescuer, executor, address(templeToken), address(daiToken), address(dUSD), templePrice);
        
        daiInterestRateModel = new LinearWithKinkInterestRateModel(
            5e18 / 100,  // 5% interest rate (rate% at 0% UR)
            20e18 / 100, // 20% percent interest rate (rate% at 100% UR)
            90e18 / 100, // 90% utilization (UR for when the kink starts)
            10e18 / 100  // 10% percent interest rate (rate% at kink% UR)
        );
        oudInterestRateModel = new FlatInterestRateModel(uint256(int256(oudInterestRate)));

        tlc = new TempleLineOfCredit(
            rescuer, 
            executor, 
            address(templeToken),
            address(daiToken),
            defaultDaiConfig(),
            address(oudToken),
            defaultOudConfig()
        );

        tlcStrategy = new TlcStrategy(
            rescuer, 
            executor, 
            "TempleLineOfCredit",
            address(trv), 
            address(tlc), 
            address(templeToken)
        );

        // Post create steps
        {
            vm.startPrank(executor);
            tlc.setTlcStrategy(address(tlcStrategy));
            tlc.setFundsRequestWindow(FUNDS_REQUEST_MIN_SECS, FUNDS_REQUEST_MAX_SECS);
        }

        // Add the TLC Strategy into TRV so it can borrow DAI
        {
            dUSD.addMinter(address(trv));
            trv.addNewStrategy(address(tlcStrategy), borrowCeiling, 0);
            vm.stopPrank();
            deal(address(daiToken), address(trv), trvStartingBalance, true);
        }
    }

    function defaultDaiConfig() internal view returns (ITempleLineOfCredit.DebtTokenConfig memory) {
        return DebtTokenConfig({
            interestRateModel: daiInterestRateModel,
            maxLtvRatio: daiMaxLtvRatio
        });
    }

    function defaultOudConfig() internal view returns (ITempleLineOfCredit.DebtTokenConfig memory) {
        return DebtTokenConfig({
            // tokenType: oudToken,
            // tokenAddress: address(oudToken),
            interestRateModel: oudInterestRateModel,
            maxLtvRatio: oudMaxLtvRatio.encodeUInt128()
        });
    }

    function getDefaultConfig(IERC20 token) internal view returns (ITempleLineOfCredit.DebtTokenConfig memory) {
        return (token == daiToken) ? defaultDaiConfig() : defaultOudConfig();
    }

    struct MaxBorrowInfo {
        uint256 daiCollateralValue;
        uint256 daiMaxBorrow;
        uint256 oudCollateralValue;
        uint256 oudMaxBorrow;
    }

    function expectedMaxBorrows(uint256 collateralAmount) internal view returns (
        MaxBorrowInfo memory info
    ) {
        info.daiCollateralValue = collateralAmount * templePrice / PRICE_PRECISION;
        info.daiMaxBorrow = collateralAmount * templePrice * daiMaxLtvRatio / 1e36;
        info.oudCollateralValue = collateralAmount;
        info.oudMaxBorrow = collateralAmount * oudMaxLtvRatio / 1e18;
    }

    function checkDebtTokenConfig(
        ITempleLineOfCredit.DebtTokenConfig memory actual,
        ITempleLineOfCredit.DebtTokenConfig memory expected
    ) internal {
        assertEq(address(actual.interestRateModel), address(expected.interestRateModel), "DebtTokenConfig__interestRateModel");
        assertEq(actual.maxLtvRatio, expected.maxLtvRatio, "DebtTokenConfig__maxLtvRatio");
    }

    function checkDebtTokenData(
        ITempleLineOfCredit.DebtTokenData memory actual,
        ITempleLineOfCredit.DebtTokenData memory expected
    ) internal {
        assertEq(actual.interestAccumulatorUpdatedAt, expected.interestAccumulatorUpdatedAt, "DebtTokenData__interestAccumulatorUpdatedAt");
        assertApproxEqRel(actual.totalDebt, expected.totalDebt, 1e10, "DebtTokenData__totalDebt");
        assertApproxEqRel(actual.interestRate, expected.interestRate, 1e9, "DebtTokenData__interestRate");
        assertApproxEqRel(actual.interestAccumulator, expected.interestAccumulator, 1e9, "DebtTokenData__interestAccumulator");
    }

    function checkDebtTokenDetails(
        IERC20 token,
        uint256 borrowedAmount,
        int96 expectedInterestRate,
        uint256 expectedInterestAccumulator,
        uint256 expectedInterestAccumulatorUpdatedAt
    ) internal {
        (DebtTokenConfig memory config, DebtTokenData memory totals) = tlc.debtTokenDetails(token);
        checkDebtTokenConfig(config, getDefaultConfig(token));

        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: borrowedAmount.encodeUInt128(),
            interestRate: expectedInterestRate,
            interestAccumulator: expectedInterestAccumulator,
            interestAccumulatorUpdatedAt: uint32(expectedInterestAccumulatorUpdatedAt)
        }));
    }

    struct CheckAccountPositionParams {
        address account;
        uint256 expectedDaiBalance;
        uint256 expectedOudBalance;
        AccountPosition expectedAccountPosition;
        uint256 expectedDaiDebtCheckpoint;
        uint256 expectedDaiAccumulatorCheckpoint;
        uint256 expectedOudDebtCheckpoint;
        uint256 expectedOudAccumulatorCheckpoint;
        uint256 expectedRemoveCollateralRequest;
        uint256 expectedRemoveCollateralRequestAt;
    }

    function checkAccountPosition(CheckAccountPositionParams memory params, bool includePendingRequests) internal {
        AccountPosition memory actualAccountPosition = tlc.accountPosition(params.account, includePendingRequests);
        
        (
            uint256 collateralPosted,
            WithdrawFundsRequest memory removeCollateralRequest,
            AccountDebtData memory daiDebtData,
            AccountDebtData memory oudDebtData
        ) =  tlc.accountData(params.account);

        assertEq(actualAccountPosition.collateralPosted, params.expectedAccountPosition.collateralPosted, "collateral");
        assertEq(collateralPosted, actualAccountPosition.collateralPosted, "collateral 2");
        assertEq(removeCollateralRequest.amount, params.expectedRemoveCollateralRequest, "removeCollateralRequest.amount");
        assertEq(removeCollateralRequest.requestedAt, uint32(params.expectedRemoveCollateralRequestAt), "removeCollateralRequest.requestedAt");

        // The 'as of now' data
        assertEq(daiToken.balanceOf(params.account), params.expectedDaiBalance, "balanceOf");
        assertApproxEqRel(actualAccountPosition.daiDebtPosition.currentDebt, params.expectedAccountPosition.daiDebtPosition.currentDebt, 1e10, "dai debt");
        assertEq(actualAccountPosition.daiDebtPosition.maxBorrow, params.expectedAccountPosition.daiDebtPosition.maxBorrow, "dai max borrow");
        assertApproxEqRel(actualAccountPosition.daiDebtPosition.healthFactor, params.expectedAccountPosition.daiDebtPosition.healthFactor, 1e10, "dai health");
        assertApproxEqRel(actualAccountPosition.daiDebtPosition.loanToValueRatio, params.expectedAccountPosition.daiDebtPosition.loanToValueRatio, 1e10, "dai LTV");

        assertEq(oudToken.balanceOf(params.account), params.expectedOudBalance, "balanceOf");
        assertApproxEqRel(actualAccountPosition.oudDebtPosition.currentDebt, params.expectedAccountPosition.oudDebtPosition.currentDebt, 1e10, "oud debt");
        assertEq(actualAccountPosition.oudDebtPosition.maxBorrow, params.expectedAccountPosition.oudDebtPosition.maxBorrow, "oud max borrow");
        assertApproxEqRel(actualAccountPosition.oudDebtPosition.healthFactor, params.expectedAccountPosition.oudDebtPosition.healthFactor, 1e10, "oud health");
        assertApproxEqRel(actualAccountPosition.oudDebtPosition.loanToValueRatio, params.expectedAccountPosition.oudDebtPosition.loanToValueRatio, 1e10, "oud LTV");

        // The latest checkpoint data
        assertApproxEqRel(daiDebtData.debtCheckpoint, params.expectedDaiDebtCheckpoint, 1e10, "DAI debt checkpoint");
        assertApproxEqRel(daiDebtData.interestAccumulator, params.expectedDaiAccumulatorCheckpoint, 1e9, "DAI interestAccumulator checkpoint");
        assertApproxEqRel(oudDebtData.debtCheckpoint, params.expectedOudDebtCheckpoint, 1e10, "OUD debt checkpoint");
        assertApproxEqRel(oudDebtData.interestAccumulator, params.expectedOudAccumulatorCheckpoint, 1e9, "OUD interestAccumulator checkpoint");
    }
    
    // @todo change this to use checkAccountPosition instead
    function checkAccountData(
        address account, 
        uint256 expectedCollateral, 
        uint256 expectedDaiDebt,
        uint256 expectedDaiInterestAccumulator,
        uint256 expectedOudDebt,
        uint256 expectedOudInterestAccumulator
    ) internal {
        // @todo is this a dup/similar to above?

        // AccountData memory actualAccountData = tlc.accountData(account);
        (
            uint256 collateralPosted,
            WithdrawFundsRequest memory removeCollateralRequest,
            AccountDebtData memory daiDebtData,
            AccountDebtData memory oudDebtData
        ) =  tlc.accountData(account);

        // @todo add check for removeCollateralRequest

        assertEq(collateralPosted, expectedCollateral, "collateral");
        assertEq(daiDebtData.debtCheckpoint, expectedDaiDebt, "DAI debt");
        assertEq(daiDebtData.interestAccumulator, expectedDaiInterestAccumulator, "DAI interestAccumulator");
        assertEq(oudDebtData.debtCheckpoint, expectedOudDebt, "OUD debt");
        assertEq(oudDebtData.interestAccumulator, expectedOudInterestAccumulator, "OUD interestAccumulator");
    }

    function checkTotalPosition(TotalPosition[] memory expectedPositions) internal returns (uint256, uint256) {
        (TotalPosition memory actualDaiPosition, TotalPosition memory actualOudPosition) = tlc.totalPosition();
        assertApproxEqRel(actualDaiPosition.utilizationRatio, expectedPositions[0].utilizationRatio, 1e10, "daiUtilizationRatio");
        assertApproxEqRel(actualDaiPosition.borrowRate, expectedPositions[0].borrowRate, 1e10, "daiBorrowRate"); 
        assertApproxEqRel(actualDaiPosition.totalDebt, expectedPositions[0].totalDebt, 1e10, "daiTotalDebt");
        assertEq(actualOudPosition.utilizationRatio, expectedPositions[1].utilizationRatio, "oudUtilizationRatio");
        assertEq(actualOudPosition.borrowRate, expectedPositions[1].borrowRate, "oudBorrowRate");
        assertApproxEqRel(actualOudPosition.totalDebt, expectedPositions[1].totalDebt, 1e10, "oudTotalDebt");
        return (actualDaiPosition.totalDebt, actualOudPosition.totalDebt);
    }

    function addCollateral(address account, uint256 collateralAmount) internal {
        deal(address(templeToken), account, collateralAmount);
        vm.startPrank(account);
        templeToken.approve(address(tlc), collateralAmount);
        tlc.addCollateral(collateralAmount, account);
        vm.stopPrank();
    }

    function borrow(
        address _account, 
        uint256 collateralAmount, 
        uint256 daiBorrowAmount, 
        uint256 oudBorrowAmount,
        uint256 cooldownSecs
    ) internal {
        if (collateralAmount != 0) {
            addCollateral(_account, collateralAmount);
        }
        vm.startPrank(_account);
        
        if (daiBorrowAmount != 0) {
            tlc.requestBorrow(daiToken, daiBorrowAmount);
        }
        if (oudBorrowAmount != 0) {
            tlc.requestBorrow(oudToken, oudBorrowAmount);
        }
        
        // Sleep it off...
        vm.warp(block.timestamp + cooldownSecs);

        if (daiBorrowAmount != 0) tlc.borrow(daiToken, _account);
        if (oudBorrowAmount != 0) tlc.borrow(oudToken, _account);

        vm.stopPrank();
    }

    function approxInterest(uint256 principal, int96 rate, uint256 age) internal pure returns (uint256) {
        // Approxmiate as P * (1 + r/365 days)^(age)
        // ie compounding every 1 second (almost but not quite continuous)
        uint256 onePlusRate = uint256(int256(rate / 365 days + 1e18));

        return ud(principal).mul(ud(onePlusRate).powu(age)).unwrap();
    }

    function utilizationRatio(uint256 borrowed, uint256 cap) internal pure returns (uint256) {
        return borrowed * 1e18 / cap;
    }

    function calculateInterestRate(IInterestRateModel model, uint256 borrowed, uint256 cap) internal view returns (int96) {
        return model.calculateInterestRate(utilizationRatio(borrowed, cap));
    }

    // function checkFundsRequests(
    //     address account,
    //     uint256 borrowDai,
    //     uint256 borrowDaiTs,
    //     uint256 borrowOud,
    //     uint256 borrowOudTs,
    //     uint256 withdrawCollateral,
    //     uint256 withdrawCollateralTs
    // ) internal {
    //     // @todo check the timestamps too?
    //     (uint256 amount, uint32 ts) = tlc.fundsRequests(account, FundsRequestType.BORROW_DAI);
    //     assertEq(amount, borrowDai, "fundsRequests__BORROW_DAI");
    //     assertEq(ts, borrowDaiTs, "fundsRequests__BORROW_DAI_TS");

    //     (amount, ts) = tlc.fundsRequests(account, FundsRequestType.BORROW_OUD);
    //     assertEq(amount, borrowOud, "fundsRequests__BORROW_OUD");
    //     assertEq(ts, borrowOudTs, "fundsRequests__BORROW_OUD_TS");

    //     (amount, ts) = tlc.fundsRequests(account, FundsRequestType.WITHDRAW_COLLATERAL);
    //     assertEq(amount, withdrawCollateral, "fundsRequests__WITHDRAW_COLLATERAL");
    //     assertEq(ts, withdrawCollateralTs, "fundsRequests__WITHDRAW_COLLATERAL_TS");
    // }

    function calcHealthFactor(uint256 collateralValue, uint256 debtAmount, uint256 maxLtvRatio) internal pure returns (uint256) {
        return debtAmount == 0 ? type(uint256).max : collateralValue * maxLtvRatio / debtAmount;
    }
    function calcLtv(uint256 collateralValue, uint256 debtAmount) internal pure returns (uint256) {
        return collateralValue == 0 ? 0 : debtAmount * 1e18 / collateralValue;
    }

    function createDebtPosition(
        IERC20 token,
        uint256 debt,
        MaxBorrowInfo memory maxBorrowInfo
    ) internal view returns (AccountDebtPosition memory) {
        if (token == daiToken) {
            return AccountDebtPosition({
                currentDebt: debt, 
                maxBorrow: maxBorrowInfo.daiMaxBorrow, 
                healthFactor: calcHealthFactor(maxBorrowInfo.daiCollateralValue, debt, daiMaxLtvRatio), 
                loanToValueRatio: calcLtv(maxBorrowInfo.daiCollateralValue, debt)
            });
        } else {
            return AccountDebtPosition({
                currentDebt: debt, 
                maxBorrow: maxBorrowInfo.oudMaxBorrow, 
                healthFactor: calcHealthFactor(maxBorrowInfo.oudCollateralValue, debt, oudMaxLtvRatio),
                loanToValueRatio: calcLtv(maxBorrowInfo.oudCollateralValue, debt)
            });
        }
    }

    // function getDebtPositions(
    //     uint256 daiDebt,
    //     uint256 oudDebt,
    //     MaxBorrowInfo memory maxBorrowInfo
    // ) internal view returns (AccountDebtPosition[2] memory) {
    //     return [
    //         AccountDebtPosition({
    //             currentDebt: daiDebt, 
    //             maxBorrow: maxBorrowInfo.daiMaxBorrow, 
    //             healthFactor: calcHealthFactor(maxBorrowInfo.daiCollateralValue, daiDebt, daiMaxLtvRatio), 
    //             loanToValueRatio: calcLtv(maxBorrowInfo.daiCollateralValue, daiDebt)
    //         }),
    //         AccountDebtPosition({
    //             currentDebt: oudDebt, 
    //             maxBorrow: maxBorrowInfo.oudMaxBorrow, 
    //             healthFactor: calcHealthFactor(maxBorrowInfo.oudCollateralValue, oudDebt, oudMaxLtvRatio),
    //             loanToValueRatio: calcLtv(maxBorrowInfo.oudCollateralValue, oudDebt)
    //         })
    //     ];
    // }
}