pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
import {ud} from '@prb/math/src/UD60x18.sol';

import {TempleTest} from '../../TempleTest.sol';
import {LinearWithKinkInterestRateModel} from 'contracts/v2/interestRate/LinearWithKinkInterestRateModel.sol';
import {CommonEventsAndErrors} from 'contracts/common/CommonEventsAndErrors.sol';
import {IInterestRateModel} from 'contracts/interfaces/v2/interestRate/IInterestRateModel.sol';
import {FakeERC20} from 'contracts/fakes/FakeERC20.sol';
import { SafeCast } from "contracts/common/SafeCast.sol";

contract Mock is LinearWithKinkInterestRateModel {
  constructor(
    address _initialRescuer,
    address _initialExecutor,
    uint256 _baseInterestRate,
    uint256 _maxInterestRate,
    uint256 _kinkUtilizationRatio,
    uint256 _kinkInterestRate
  )
    LinearWithKinkInterestRateModel(
      _initialRescuer,
      _initialExecutor,
      _baseInterestRate,
      _maxInterestRate,
      _kinkUtilizationRatio,
      _kinkInterestRate
    )
  {}
}

contract LinearWithKinkInterestRateModelTestBase is TempleTest {
  Mock public mock;
  FakeERC20 public daiToken;
  IInterestRateModel public daiInterestRateModel;
  uint256 public expectedDaiDebt;
  uint96 public expectedDaiInterestRate;
  uint256 public expectedUtilizationRation;

  uint96 public constant DEFAULT_BASE_INTEREST = 0.01e18; // 1%
  uint256 public constant BORROW_CEILING = 100_000e18;

  function setUp() public {
    mock = new Mock(rescuer, executor, 0.02e18, 0.80e18, 0.50e18, 0.81e18);

    uint256 borrowDaiAmount = 50_000e18; // 50% UR, ... At kink approximately 10% interest rate

    // Create dai token
    daiToken = new FakeERC20('DAI Token', 'DAI', executor, 500_000e18);
    vm.label(address(daiToken), 'DAI');

    daiInterestRateModel = new LinearWithKinkInterestRateModel(
      rescuer,
      executor,
      5e18 / 100, // 5% interest rate (rate% at 0% UR)
      20e18 / 100, // 20% percent interest rate (rate% at 100% UR)
      90e18 / 100, // 90% utilization (UR for when the kink starts)
      10e18 / 100 // 10% percent interest rate (rate% at kink% UR)
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

    expectedUtilizationRation = utilizationRatio(
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
      mock.setRateParams(2e18 / 100, 75e18 / 100, 50e18 / 100, 10e18 / 100);
      vm.stopPrank();
    }

    // access for executor
    {
      vm.startPrank(executor);
      vm.expectEmit();
      emit InterestRateParamsSet(2e18 / 100, 75e18 / 100, 50e18 / 100, 10e18 / 100);
      mock.setRateParams(2e18 / 100, 75e18 / 100, 50e18 / 100, 10e18 / 100);
    }
  }

  function test_getRateParams() public {    
    uint80 testBaseInterestRate = uint256(2e18 / 100).encodeUInt80();
    uint80 testMaxInterestRate = uint256(80e18 / 100).encodeUInt80();
    uint80 testKinkInterestRate = uint256(81e18 / 100).encodeUInt80();
    uint256 testKinkUtilizationRatio = uint256(50e18 / 100);
    
    // get initial params
    (
      uint256 baseInterestRate,
      uint256 maxInterestRate,
      uint256 kinkInterestRate,
      uint256 kinkUtilizationRatio
    ) = mock.rateParams();
    
    assertEq(baseInterestRate, testBaseInterestRate);
    assertEq(maxInterestRate, testMaxInterestRate);
    assertEq(kinkInterestRate, testKinkInterestRate);
    assertEq(kinkUtilizationRatio, testKinkUtilizationRatio);
  }

  function test_computeInterestRateImpl() public {
    uint256 utilizationRation = mock.computeInterestRateImpl(expectedUtilizationRation);

    assertEq(utilizationRation, expectedDaiInterestRate);

  }
}
