pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ud } from "@prb/math/src/UD60x18.sol";
import { TempleTest } from "../../TempleTest.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { TempleLineOfCredit, ITempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { TlcStrategy } from "contracts/v2/templeLineOfCredit/TlcStrategy.sol";
import { TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { LinearWithKinkInterestRateModel } from "contracts/v2/interestRate/LinearWithKinkInterestRateModel.sol";
import { TempleERC20Token } from "contracts/core/TempleERC20Token.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TlcBaseTest is TempleTest, ITlcDataTypes, ITlcEventsAndErrors {
    TempleLineOfCredit public tlc;
    TlcStrategy public tlcStrategy;

    TempleERC20Token public templeToken;
    using SafeCast for uint256;
    
    FakeERC20 public daiToken;
    IInterestRateModel public daiInterestRateModel;
    uint96 public daiMaxLtvRatio = 0.85e18; // 85%

    uint256 public templePrice = 0.97e18; // $0.97

    TreasuryPriceIndexOracle public tpiOracle;
    TreasuryReservesVault public trv;
    TempleDebtToken public dUSD;
    TempleDebtToken public dTEMPLE;
    uint96 public constant DEFAULT_BASE_INTEREST = 0.01e18; // 1%
    uint96 public constant MIN_BORROW_RATE = 0.05e18;  // 5% interest rate (rate% at 0% UR)

    uint256 public constant TRV_STARTING_BALANCE = 1_000_000e18;
    uint256 public constant BORROW_CEILING = 100_000e18;

    uint256 internal constant INITIAL_INTEREST_ACCUMULATOR = 1e27;
    
    uint32 public constant COLLATERAL_REQUEST_MIN_SECS = 30;
    uint32 public constant COLLATERAL_REQUEST_MAX_SECS = 45;
    uint32 public constant BORROW_REQUEST_MIN_SECS = 60;
    uint32 public constant BORROW_REQUEST_MAX_SECS = 120;

    function setUp() public {
        // Default starts at 0 which can hide some issues
        vm.warp(1_000_000);

        // Create tokens
        {
            daiToken = new FakeERC20("DAI Token", "DAI", executor, 500_000e18);
            vm.label(address(daiToken), "DAI");
            templeToken = new TempleERC20Token();
            vm.label(address(templeToken), "TEMPLE");
            dUSD = new TempleDebtToken("Temple Debt USD", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
            dTEMPLE = new TempleDebtToken("Temple Debt TEMPLE", "dTEMPLE", rescuer, executor, DEFAULT_BASE_INTEREST);
            vm.label(address(dUSD), "dUSD");
            vm.label(address(dTEMPLE), "dTEMPLE");
        }

        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, templePrice, 0.1e18, 0);
        trv = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        
        daiInterestRateModel = new LinearWithKinkInterestRateModel(
            rescuer,
            executor,
            MIN_BORROW_RATE,  // 5% interest rate (rate% at 0% UR)
            20e18 / 100, // 20% percent interest rate (rate% at 100% UR)
            90e18 / 100, // 90% utilization (UR for when the kink starts)
            10e18 / 100  // 10% percent interest rate (rate% at kink% UR)
        );

        tlc = new TempleLineOfCredit(
            rescuer, 
            executor, 
            address(templeToken),
            address(daiToken),
            defaultDaiConfig()
        );

        tlcStrategy = new TlcStrategy(
            rescuer, 
            executor, 
            "TempleLineOfCredit",
            address(trv), 
            address(tlc), 
            address(daiToken)
        );

        vm.startPrank(executor);

        // Add the TLC Strategy into TRV so it can borrow DAI
        {
            dUSD.addMinter(address(trv));
            dTEMPLE.addMinter(address(trv));

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(daiToken), BORROW_CEILING);
            trv.addStrategy(address(tlcStrategy), 0, debtCeiling);
            trv.setBorrowToken(daiToken, address(0), 0, 0, address(dUSD));
            trv.setBorrowToken(templeToken, address(0), 0, 0, address(dTEMPLE));

            deal(address(daiToken), address(trv), TRV_STARTING_BALANCE, true);
        }

        // Post create steps
        {
            tlc.setTlcStrategy(address(tlcStrategy));
            tlc.setWithdrawCollateralRequestConfig(COLLATERAL_REQUEST_MIN_SECS, COLLATERAL_REQUEST_MAX_SECS);
            tlc.setBorrowRequestConfig(BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS);
        }

        vm.stopPrank();
    }

    function defaultDaiConfig() internal view returns (ITempleLineOfCredit.DebtTokenConfig memory) {
        return DebtTokenConfig({
            interestRateModel: daiInterestRateModel,
            maxLtvRatio: daiMaxLtvRatio,
            borrowRequestConfig: FundsRequestConfig(BORROW_REQUEST_MIN_SECS, BORROW_REQUEST_MAX_SECS)
        });
    }

    function getDefaultConfig() internal view returns (ITempleLineOfCredit.DebtTokenConfig memory) {
        return defaultDaiConfig();
    }

    struct MaxBorrowInfo {
        uint256 daiCollateralValue;
        uint256 daiMaxBorrow;
    }

    function expectedMaxBorrows(uint256 collateralAmount) internal view returns (
        MaxBorrowInfo memory info
    ) {
        info.daiCollateralValue = collateralAmount * templePrice / 1e18;
        info.daiMaxBorrow = collateralAmount * templePrice * daiMaxLtvRatio / 1e36;
    }

    function checkDebtTokenConfig(
        ITempleLineOfCredit.DebtTokenConfig memory actual,
        ITempleLineOfCredit.DebtTokenConfig memory expected
    ) internal {
        assertEq(address(actual.interestRateModel), address(expected.interestRateModel), "DebtTokenConfig__interestRateModel");
        assertEq(actual.maxLtvRatio, expected.maxLtvRatio, "DebtTokenConfig__maxLtvRatio");
        assertEq(actual.borrowRequestConfig.minSecs, expected.borrowRequestConfig.minSecs, "DebtTokenConfig__borrowRequestConfig.minSecs");
        assertEq(actual.borrowRequestConfig.maxSecs, expected.borrowRequestConfig.maxSecs, "DebtTokenConfig__borrowRequestConfig.maxSecs");
    }

    function checkDebtTokenData(
        ITempleLineOfCredit.DebtTokenData memory actual,
        ITempleLineOfCredit.DebtTokenData memory expected
    ) internal {
        assertEq(actual.interestAccumulatorUpdatedAt, expected.interestAccumulatorUpdatedAt, "DebtTokenData__interestAccumulatorUpdatedAt");
        assertApproxEqRel(actual.totalDebt, expected.totalDebt, 1e10, "DebtTokenData__totalDebt");
        assertApproxEqRel(actual.interestRate, expected.interestRate, 1e11, "DebtTokenData__interestRate");
        assertApproxEqRel(actual.interestAccumulator, expected.interestAccumulator, 1e10, "DebtTokenData__interestAccumulator");
    }

    function checkDebtTokenDetails(
        uint256 borrowedAmount,
        uint96 expectedInterestRate,
        uint256 expectedInterestAccumulator,
        uint256 expectedInterestAccumulatorUpdatedAt
    ) internal {
        (DebtTokenConfig memory config, DebtTokenData memory totals) = tlc.debtTokenDetails();
        checkDebtTokenConfig(config, getDefaultConfig());

        checkDebtTokenData(totals, DebtTokenData({
            totalDebt: borrowedAmount.encodeUInt128(),
            interestRate: expectedInterestRate,
            interestAccumulator: expectedInterestAccumulator,
            interestAccumulatorUpdatedAt: uint32(expectedInterestAccumulatorUpdatedAt)
        }));
    }

    function assertApproxRelOrMax(
        uint256 a,
        uint256 b,
        uint256 maxPercentDelta, // An 18 decimal fixed point number, where 1e18 == 100%
        string memory err
    ) internal {
        if (a == type(uint256).max || b == type(uint256).max) {
            assertEq(a, b, err);
        } else {
            assertApproxEqRel(a, b, maxPercentDelta, err);
        }
    }

    struct CheckAccountPositionParams {
        address account;
        uint256 expectedDaiBalance;
        AccountPosition expectedAccountPosition;
        uint256 expectedDaiDebtCheckpoint;
        uint256 expectedDaiAccumulatorCheckpoint;
        uint256 expectedRemoveCollateralRequest;
        uint256 expectedRemoveCollateralRequestAt;
    }

    function checkAccountPosition(CheckAccountPositionParams memory params, bool includePendingRequests) internal {
        AccountPosition memory actualAccountPosition = tlc.accountPosition(params.account, includePendingRequests);        
        AccountData memory accountData = tlc.accountData(params.account);

        assertEq(actualAccountPosition.collateral, params.expectedAccountPosition.collateral, "collateral");
        assertEq(accountData.collateral, actualAccountPosition.collateral + params.expectedRemoveCollateralRequest, "collateral with request");
        assertEq(accountData.removeCollateralRequestAmount, params.expectedRemoveCollateralRequest, "removeCollateralRequest.amount");
        assertEq(accountData.removeCollateralRequestAt, uint32(params.expectedRemoveCollateralRequestAt), "removeCollateralRequest.requestedAt");

        // The 'as of now' data
        assertEq(daiToken.balanceOf(params.account), params.expectedDaiBalance, "expectedDaiBalance");
        assertApproxEqRel(actualAccountPosition.currentDebt, params.expectedAccountPosition.currentDebt, 1e11, "dai debt");
        assertEq(actualAccountPosition.maxBorrow, params.expectedAccountPosition.maxBorrow, "dai max borrow");
        assertApproxRelOrMax(actualAccountPosition.healthFactor, params.expectedAccountPosition.healthFactor, 1e11, "dai health");
        assertApproxRelOrMax(actualAccountPosition.loanToValueRatio, params.expectedAccountPosition.loanToValueRatio, 1e11, "dai LTV");

        // The latest checkpoint data
        assertApproxEqRel(accountData.debtCheckpoint, params.expectedDaiDebtCheckpoint, 1e11, "DAI debt checkpoint");
        assertApproxEqRel(accountData.interestAccumulator, params.expectedDaiAccumulatorCheckpoint, 1e9, "DAI interestAccumulator checkpoint");
    }
    
    function checkTotalDebtPosition(
        uint256 expectedDaiUR,
        uint256 expectedDaiIR,
        uint256 expectedDaiDebt
    ) internal returns (uint256) {
        TotalDebtPosition memory actualDaiPosition = tlc.totalDebtPosition();
        assertApproxEqRel(actualDaiPosition.utilizationRatio, expectedDaiUR, 1e10, "daiUtilizationRatio");
        assertApproxEqRel(actualDaiPosition.borrowRate, expectedDaiIR, 1e10, "daiBorrowRate"); 
        assertApproxEqRel(actualDaiPosition.totalDebt, expectedDaiDebt, 1e10, "daiTotalDebt");
    return actualDaiPosition.totalDebt;
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
        uint256 cooldownSecs
    ) internal {
        if (collateralAmount != 0) {
            addCollateral(_account, collateralAmount);
        }
        vm.startPrank(_account);
        
        if (daiBorrowAmount != 0) {
            tlc.requestBorrow(daiBorrowAmount);
        }
        
        // Sleep it off...
        vm.warp(block.timestamp + cooldownSecs);

        if (daiBorrowAmount != 0) tlc.borrow(_account);

        vm.stopPrank();
    }

    function approxInterest(uint256 principal, uint96 rate, uint256 age) internal pure returns (uint256) {
        // Approxmiate as P * (1 + r/365 days)^(age)
        // ie compounding every 1 second (almost but not quite continuous)
        uint256 onePlusRate = uint256(rate / 365 days + 1e18);

        return ud(principal).mul(ud(onePlusRate).powu(age)).unwrap();
    }

    function utilizationRatio(uint256 borrowed, uint256 cap) internal pure returns (uint256) {
        return borrowed * 1e18 / cap;
    }

    function calculateInterestRate(IInterestRateModel model, uint256 borrowed, uint256 cap) internal view returns (uint96) {
        return model.calculateInterestRate(utilizationRatio(borrowed, cap));
    }

    function calcHealthFactor(uint256 _collateralValue, uint256 _debtAmount, uint256 _maxLtvRatio) internal pure returns (uint256) {
        return _debtAmount == 0 ? type(uint256).max : _collateralValue * _maxLtvRatio / _debtAmount;
    }

    function calcLtv(uint256 _collateralValue, uint256 _debtAmount) internal pure returns (uint256) {
        return _collateralValue == 0 ? type(uint256).max : _debtAmount * 1e18 / _collateralValue;
    }

    function collateralValue(uint256 _collateralAmount) internal view returns (uint256) {
        return _collateralAmount * templePrice / 1e18;
    }

    function createAccountPosition(
        uint256 collateral,
        uint256 debt,
        MaxBorrowInfo memory maxBorrowInfo
    ) internal view returns (AccountPosition memory) {
        return AccountPosition({
            collateral: collateral,
            currentDebt: debt, 
            maxBorrow: maxBorrowInfo.daiMaxBorrow, 
            healthFactor: calcHealthFactor(maxBorrowInfo.daiCollateralValue, debt, daiMaxLtvRatio), 
            loanToValueRatio: calcLtv(maxBorrowInfo.daiCollateralValue, debt)
        });
    }

    function checkLiquidationStatus(
        address account,
        bool includePendingRequests,
        bool expectedHasExceededMaxLtv,
        uint256 expectedCollateral,
        uint256 expectedCurrentDaiDebt
    ) internal {
        address[] memory accounts = new address[](1);
        accounts[0] = account;
        LiquidationStatus[] memory status = tlc.computeLiquidity(accounts, includePendingRequests);

        assertEq(status[0].hasExceededMaxLtv, expectedHasExceededMaxLtv, "hasExceededMaxLtv");
        assertEq(status[0].collateral, expectedCollateral, "collateral");
        assertEq(status[0].collateralValue, collateralValue(expectedCollateral), "collateralValue");
        assertApproxEqRel(status[0].currentDebt, expectedCurrentDaiDebt, 1e8, "currentDaiDebt");
    }

    function checkBatchLiquidate(
        address[] memory accounts,
        uint256 expectedCollateralClaimed,
        uint256 expectedDaiDebtWiped
    ) internal {
        (
            uint256 totalCollateralClaimed,
            uint256 totalDaiDebtWiped
        ) = tlc.batchLiquidate(accounts);
        assertEq(totalCollateralClaimed, expectedCollateralClaimed, "liquidate_collateral");
        assertApproxEqRel(totalDaiDebtWiped, expectedDaiDebtWiped, 1e10, "liquidate_dai");
    }
}