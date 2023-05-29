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
    
    uint32 public constant BORROW_DAI_COOLDOWN_SECS = 30;
    uint32 public constant BORROW_OUD_COOLDOWN_SECS = 60;
    uint32 public constant WITHDRAW_COLLATERAL_COOLDOWN_SECS = 60;

    // event InterestRateUpdate(address indexed token, int96 newInterestRate);

    function setUp() public {
        // Default starts at 0 which can hide some issues
        vm.warp(1_000_000);

        daiToken = new FakeERC20("DAI Token", "DAI", executor, 500_000e18);
        vm.label(address(daiToken), "DAI");
        templeToken = new FakeERC20("TempleToken", "Temple", executor, 500_000e18);
        vm.label(address(templeToken), "TEMPLE");
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, defaultBaseInterest);
        vm.label(address(dUSD), "dUSD");

        trv = new TreasuryReservesVault(rescuer, executor, address(templeToken), address(daiToken), address(dUSD), templePrice);
        
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
            address(templeToken),
            defaultDaiConfig(),
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

        // positionHelper = new TlcPositionHelper(address(tlc));

        vm.startPrank(executor);
        // tlc.setBorrowCooldownSecs(TokenType.DAI, BORROW_DAI_COOLDOWN_SECS);
        // tlc.setBorrowCooldownSecs(TokenType.OUD, BORROW_OUD_COOLDOWN_SECS);
        tlc.setTlcStrategy(address(tlcStrategy));
        tlc.setWithdrawCollateralCooldownSecs(WITHDRAW_COLLATERAL_COOLDOWN_SECS);

        dUSD.addMinter(address(trv));
        trv.addNewStrategy(address(tlcStrategy), borrowCeiling, 0);
        vm.stopPrank();
        deal(address(daiToken), address(trv), trvStartingBalance, true);
    }

    function defaultDaiConfig() internal view returns (ITempleLineOfCredit.ReserveTokenConfig memory) {
        return ReserveTokenConfig({
            tokenAddress: address(daiToken),
            tokenPriceType: TokenPriceType.STABLE,  // 1 USD
            interestRateModelType: InterestRateModelType.TRV_UTILIZATION_RATE,
            interestRateModel: daiInterestRateModel,
            maxLtvRatio: daiMaxLtvRatio,
            borrowCooldownSecs: BORROW_DAI_COOLDOWN_SECS
        });
    }

    function defaultOudConfig() internal view returns (ITempleLineOfCredit.ReserveTokenConfig memory) {
        return ReserveTokenConfig({
            tokenAddress: address(oudToken),
            tokenPriceType: TokenPriceType.TPI, // #OUD * TPI
            interestRateModelType: InterestRateModelType.FLAT,
            interestRateModel: oudInterestRateModel,
            maxLtvRatio: oudMaxLtvRatio.encodeUInt128(),
            borrowCooldownSecs: BORROW_OUD_COOLDOWN_SECS
        });
    }

    function getDefaultConfig(TokenType tokenType) internal view returns (ITempleLineOfCredit.ReserveTokenConfig memory) {
        return (tokenType == TokenType.DAI) ? defaultDaiConfig() : defaultOudConfig();
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
        info.daiCollateralValue = collateralAmount * templePrice/PRICE_PRECISION;
        info.daiMaxBorrow = info.daiCollateralValue * daiMaxLtvRatio/LTV_PRECISION;
        info.oudCollateralValue = collateralAmount;
        info.oudMaxBorrow = info.oudCollateralValue * oudMaxLtvRatio/LTV_PRECISION;
    }

    function checkReserveTokenConfig(
        ITempleLineOfCredit.ReserveTokenConfig memory actual,
        ITempleLineOfCredit.ReserveTokenConfig memory expected
    ) internal {
        assertEq(actual.tokenAddress, expected.tokenAddress, "reserveTokenConfig__tokenAddress");
        assertEq(uint256(actual.tokenPriceType), uint256(expected.tokenPriceType), "reserveTokenConfig__tokenPriceType");
        assertEq(uint256(actual.interestRateModelType), uint256(expected.interestRateModelType), "reserveTokenConfig__interestRateModelType");
        assertEq(address(actual.interestRateModel), address(expected.interestRateModel), "reserveTokenConfig__interestRateModel");
        assertEq(actual.maxLtvRatio, expected.maxLtvRatio, "reserveTokenConfig__maxLtvRatio");
        assertEq(actual.borrowCooldownSecs, expected.borrowCooldownSecs, "reserveTokenConfig__borrowCooldownSecs");
    }

    function checkReserveTotals(
        ITempleLineOfCredit.ReserveTokenTotals memory actual,
        ITempleLineOfCredit.ReserveTokenTotals memory expected
    ) internal {
        assertEq(actual.interestAccumulatorUpdatedAt, expected.interestAccumulatorUpdatedAt, "reserveTokenTotal__interestAccumulatorUpdatedAt");
        assertApproxEqRel(actual.totalDebt, expected.totalDebt, 1e10, "reserveTokenTotal__totalDebt");
        assertApproxEqRel(actual.interestRate, expected.interestRate, 1e9, "reserveTokenTotal__interestRate");
        assertApproxEqRel(actual.interestAccumulator, expected.interestAccumulator, 1e9, "reserveTokenTotal__interestAccumulator");
    }

    function checkReserveToken(
        TokenType tokenType,
        uint256 borrowedAmount,
        int96 expectedInterestRate,
        uint256 expectedInterestAccumulator,
        uint256 expectedInterestAccumulatorUpdatedAt
    ) internal {
        (ReserveTokenConfig memory config, ReserveTokenTotals memory totals) = tlc.reserveTokens(tokenType);
        checkReserveTokenConfig(config, getDefaultConfig(tokenType));

        checkReserveTotals(totals, ReserveTokenTotals({
            totalDebt: borrowedAmount.encodeUInt128(),
            interestRate: expectedInterestRate,
            interestAccumulator: expectedInterestAccumulator,
            interestAccumulatorUpdatedAt: uint32(expectedInterestAccumulatorUpdatedAt)
        }));
    }

    function checkUserPosition(
        address user, 
        uint256 expectedDaiBalance,
        uint256 expectedOudBalance,
        UserPosition memory expectedUserPosition,
        uint256 expectedDaiDebtCheckpoint,
        uint256 expectedDaiAccumulatorCheckpoint,
        uint256 expectedOudDebtCheckpoint,
        uint256 expectedOudAccumulatorCheckpoint
    ) internal {
        UserPosition memory actualUserPosition = tlc.userPosition(user);
        
        // @todo add checks for removeCollateralRequest?
        UserData memory actualUserData = tlc.getUserData(user);

        assertEq(actualUserPosition.collateralPosted, expectedUserPosition.collateralPosted, "collateral");
        assertEq(actualUserData.collateralPosted, actualUserPosition.collateralPosted, "collateral 2");

        // The 'as of now' data
        assertEq(daiToken.balanceOf(user), expectedDaiBalance, "balanceOf");
        assertApproxEqRel(actualUserPosition.debtPositions[0].debt, expectedUserPosition.debtPositions[0].debt, 1e10, "dai debt");
        assertEq(actualUserPosition.debtPositions[0].maxBorrow, expectedUserPosition.debtPositions[0].maxBorrow, "dai max borrow");
        assertApproxEqRel(actualUserPosition.debtPositions[0].healthFactor, expectedUserPosition.debtPositions[0].healthFactor, 1e10, "dai health");
        assertApproxEqRel(actualUserPosition.debtPositions[0].loanToValueRatio, expectedUserPosition.debtPositions[0].loanToValueRatio, 1e10, "dai LTV");

        assertEq(oudToken.balanceOf(user), expectedOudBalance, "balanceOf");
        assertApproxEqRel(actualUserPosition.debtPositions[1].debt, expectedUserPosition.debtPositions[1].debt, 1e10, "oud debt");
        assertEq(actualUserPosition.debtPositions[1].maxBorrow, expectedUserPosition.debtPositions[1].maxBorrow, "oud max borrow");
        assertApproxEqRel(actualUserPosition.debtPositions[1].healthFactor, expectedUserPosition.debtPositions[1].healthFactor, 1e10, "oud health");
        assertApproxEqRel(actualUserPosition.debtPositions[1].loanToValueRatio, expectedUserPosition.debtPositions[1].loanToValueRatio, 1e10, "oud LTV");

        // The latest checkpoint data
        assertApproxEqRel(actualUserData.debtData[0].debt, expectedDaiDebtCheckpoint, 1e10, "DAI debt checkpoint");
        assertApproxEqRel(actualUserData.debtData[0].interestAccumulator, expectedDaiAccumulatorCheckpoint, 1e9, "DAI interestAccumulator checkpoint");
        assertApproxEqRel(actualUserData.debtData[1].debt, expectedOudDebtCheckpoint, 1e10, "OUD debt checkpoint");
        assertApproxEqRel(actualUserData.debtData[1].interestAccumulator, expectedOudAccumulatorCheckpoint, 1e9, "OUD interestAccumulator checkpoint");
    }
    
    // @todo change this to use checkUserPosition instead
    function checkUserData(
        address account, 
        uint256 expectedCollateral, 
        uint256 expectedDaiDebt,
        uint256 expectedDaiInterestAccumulator,
        uint256 expectedOudDebt,
        uint256 expectedOudInterestAccumulator
    ) internal {
        // @todo is this a dup/similar to above?

        UserData memory actualUserData = tlc.getUserData(account);

        // @todo add check for removeCollateralRequest

        assertEq(actualUserData.collateralPosted, expectedCollateral, "collateral");
        assertEq(actualUserData.debtData[0].debt, expectedDaiDebt, "DAI debt");
        assertEq(actualUserData.debtData[0].interestAccumulator, expectedDaiInterestAccumulator, "DAI interestAccumulator");
        assertEq(actualUserData.debtData[1].debt, expectedOudDebt, "OUD debt");
        assertEq(actualUserData.debtData[1].interestAccumulator, expectedOudInterestAccumulator, "OUD interestAccumulator");
    }

    function checkTotalPosition(TotalPosition[] memory expectedPositions) internal returns (uint256, uint256) {
        TotalPosition[2] memory actualPositions = tlc.totalPosition();
        assertApproxEqRel(actualPositions[0].utilizationRatio, expectedPositions[0].utilizationRatio, 1e10, "daiUtilizationRatio");
        assertApproxEqRel(actualPositions[0].borrowRate, expectedPositions[0].borrowRate, 1e10, "daiBorrowRate"); 
        assertApproxEqRel(actualPositions[0].totalDebt, expectedPositions[0].totalDebt, 1e10, "daiTotalDebt");
        assertEq(actualPositions[1].utilizationRatio, expectedPositions[1].utilizationRatio, "oudUtilizationRatio");
        assertEq(actualPositions[1].borrowRate, expectedPositions[1].borrowRate, "oudBorrowRate");
        assertApproxEqRel(actualPositions[1].totalDebt, expectedPositions[1].totalDebt, 1e10, "oudTotalDebt");
        return (actualPositions[0].totalDebt, actualPositions[1].totalDebt);
    }

    function addCollateral(address user, uint256 collateralAmount) internal {
        deal(address(templeToken), user, collateralAmount);
        vm.startPrank(user);
        templeToken.approve(address(tlc), collateralAmount);
        tlc.addCollateral(collateralAmount, user);
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
            tlc.requestBorrow(TokenType.DAI, daiBorrowAmount);
        }
        if (oudBorrowAmount != 0) {
            tlc.requestBorrow(TokenType.OUD, oudBorrowAmount);
        }
        
        // Sleep it off...
        vm.warp(block.timestamp + cooldownSecs);

        if (daiBorrowAmount != 0) tlc.borrow(TokenType.DAI, _account);
        if (oudBorrowAmount != 0) tlc.borrow(TokenType.OUD, _account);

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

    function getDebtPositions(
        uint256 daiDebt,
        uint256 oudDebt,
        MaxBorrowInfo memory maxBorrowInfo
    ) internal view returns (UserDebtPosition[2] memory) {
        return [
            UserDebtPosition({
                debt: daiDebt, 
                maxBorrow: maxBorrowInfo.daiMaxBorrow, 
                healthFactor: calcHealthFactor(maxBorrowInfo.daiCollateralValue, daiDebt, daiMaxLtvRatio), 
                loanToValueRatio: calcLtv(maxBorrowInfo.daiCollateralValue, daiDebt)
            }),
            UserDebtPosition({
                debt: oudDebt, 
                maxBorrow: maxBorrowInfo.oudMaxBorrow, 
                healthFactor: calcHealthFactor(maxBorrowInfo.oudCollateralValue, oudDebt, oudMaxLtvRatio),
                loanToValueRatio: calcLtv(maxBorrowInfo.oudCollateralValue, oudDebt)
            })
        ];
    }
}