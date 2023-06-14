pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
import {ud} from '@prb/math/src/UD60x18.sol';

import {TempleTest} from '../../TempleTest.sol';
import {LinearWithKinkInterestRateModel} from 'contracts/v2/interestRate/LinearWithKinkInterestRateModel.sol';
import {CommonEventsAndErrors} from 'contracts/common/CommonEventsAndErrors.sol';
import {IInterestRateModel} from 'contracts/interfaces/v2/interestRate/IInterestRateModel.sol';
import { SafeCast } from "contracts/common/SafeCast.sol";

contract LinearWithKinkInterestRateModelTestBase is TempleTest {
  LinearWithKinkInterestRateModel public daiInterestRateModel;
  uint256 public utilizationRatioPct;
  uint256 public expectedDaiDebt;
  uint96 public expectedDaiInterestRate;
  uint256 public expectedUtilizationRatio;
  uint256 public constant BORROW_CEILING = 100_000e18;

  function setUp() public {
    uint256 borrowDaiAmount = 50_000e18; // 50% UR, ... At kink approximately 10% interest rate
    utilizationRatioPct = ud(borrowDaiAmount).div(ud(BORROW_CEILING)).unwrap();

    daiInterestRateModel = new LinearWithKinkInterestRateModel(
      rescuer,
      executor,
      0.05e18, // 5% interest rate (rate% at 0% UR)
      0.2e18, // 20% percent interest rate (rate% at 100% UR)
      0.9e18, // 90% utilization (UR for when the kink starts)
      0.1e18 // 10% percent interest rate (rate% at kink% UR)
    );

    expectedDaiInterestRate = calculateInterestRate(
      daiInterestRateModel,
      borrowDaiAmount,
      BORROW_CEILING
    ); // 7.77 %

    expectedDaiDebt = approxInterest(
      borrowDaiAmount,
      expectedDaiInterestRate,
      365 days
    ); // ~54k

    expectedUtilizationRatio = utilizationRatio(
      expectedDaiDebt,
      BORROW_CEILING
    ); // ~54%
  }

  function utilizationRatio(
    uint256 borrowed,
    uint256 cap
  ) internal pure returns (uint256) {
    return (borrowed * 1e18) / cap;
  }

  function calculateInterestRate(
    IInterestRateModel model,
    uint256 borrowed,
    uint256 cap
  ) internal view returns (uint96) {
    return model.calculateInterestRate(utilizationRatio(borrowed, cap));
  }

  function approxInterest(
    uint256 principal,
    uint96 rate,
    uint256 age
  ) internal pure returns (uint256) {
    // Approxmiate as P * (1 + r/365 days)^(age)
    // ie compounding every 1 second (almost but not quite continuous)
    uint256 onePlusRate = uint256(rate / 365 days + 1e18);

    return ud(principal).mul(ud(onePlusRate).powu(age)).unwrap();
  }
}

contract LinearWithKinkInterestRateModelTestModifiers is
  LinearWithKinkInterestRateModelTestBase
{
  event InterestRateParamsSet(
    uint256 _baseInterestRate,
    uint256 _maxInterestRate,
    uint256 _kinkUtilizationRatio,
    uint256 _kinkInterestRate
  );

  using SafeCast for uint256;

  function test_accessSetRateParams() public {
    // no access for alice
    {
      vm.startPrank(alice);
      vm.expectRevert(
        abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector)
      );
      daiInterestRateModel.setRateParams(0.02e18, 0.75e18, 0.5e18, 0.1e18);
      vm.stopPrank();
    }

    // access for executor
    {
      vm.startPrank(executor);
      vm.expectEmit();
      emit InterestRateParamsSet(0.02e18, 0.75e18, 0.5e18, 0.1e18);
      daiInterestRateModel.setRateParams(0.02e18, 0.75e18, 0.5e18, 0.1e18);
      vm.stopPrank();
    }

    // access for rescuer
    {
      vm.startPrank(rescuer);
      vm.expectRevert(
        abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector)
      );
      daiInterestRateModel.setRateParams(0.02e18, 0.75e18, 0.5e18, 0.1e18);

      daiInterestRateModel.setRescueMode(true);
      vm.expectEmit();
      emit InterestRateParamsSet(0.02e18, 0.75e18, 0.5e18, 0.1e18);
      daiInterestRateModel.setRateParams(0.02e18, 0.75e18, 0.5e18, 0.1e18);
      vm.stopPrank();
    }
  }

  function test_getRateParams() public {    
    uint80 testBaseInterestRate = uint256(0.05e18).encodeUInt80(); // 5%
    uint80 testMaxInterestRate = uint256(0.2e18).encodeUInt80(); // 20%
    uint80 testKinkInterestRate = uint256(0.1e18).encodeUInt80(); // 10%
    uint256 testKinkUtilizationRatio = uint256(0.9e18); // %90%
    
    // get initial params
    (
      uint256 baseInterestRate,
      uint256 maxInterestRate,
      uint256 kinkInterestRate,
      uint256 kinkUtilizationRatio
    ) = daiInterestRateModel.rateParams();
    
    assertEq(baseInterestRate, testBaseInterestRate);
    assertEq(maxInterestRate, testMaxInterestRate);
    assertEq(kinkInterestRate, testKinkInterestRate);
    assertEq(kinkUtilizationRatio, testKinkUtilizationRatio);
  }

  function test_utilizationRation() public {
    assertEq(utilizationRatioPct, 0.5e18); // 50%
  }
  function test_expectedInterestRate() public {
    assertEq(expectedDaiInterestRate, 0.077777777777777777e18); // ~7%
  }
  function test_expectedDebtAmount() public {
    assertEq(expectedDaiDebt, 54_044.121788100384500000e18); // ~54k
  }
  function test_expectedUtilizationRatio() public {
    assertEq(expectedUtilizationRatio, 0.540441217881003845e18); // ~54%
  }
}
