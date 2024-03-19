pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
import {TempleTest} from '../../TempleTest.sol';
import {LinearWithKinkInterestRateModel} from 'contracts/v2/interestRate/LinearWithKinkInterestRateModel.sol';
import {CommonEventsAndErrors} from 'contracts/common/CommonEventsAndErrors.sol';

contract LinearWithKinkInterestRateModelTestBase is TempleTest {
    LinearWithKinkInterestRateModel public interestRateModelKinkNinety;
    LinearWithKinkInterestRateModel public interestRateModelFlat;
    uint256 public UTILIZATION_RATIO_90 = 0.9e18; // 90%

    uint80 public IR_AT_0_UR = 0.05e18; // 5%
    uint80 public IR_AT_100_UR = 0.2e18; // 20%
    uint80 public IR_AT_KINK_90 = 0.1e18; // 10%

    uint80 public FLAT_IR_12 = 0.12e18; // 12%

    uint96 internal constant MAX_ALLOWED_INTEREST_RATE = 5e18; // 500% APR

    function setUp() public {
        interestRateModelKinkNinety = new LinearWithKinkInterestRateModel(
            rescuer,
            executor,
            IR_AT_0_UR, // 5% interest rate (rate% at 0% UR)
            IR_AT_100_UR, // 20% percent interest rate (rate% at 100% UR)
            UTILIZATION_RATIO_90, // 90% utilization (UR for when the kink starts)
            IR_AT_KINK_90 // 10% percent interest rate (rate% at kink% UR)
        );

        // check we didn't forget to set any param
        assertNewRateParams(
            interestRateModelKinkNinety,
            uint80(IR_AT_0_UR),
            uint80(IR_AT_100_UR),
            UTILIZATION_RATIO_90,
            uint80(IR_AT_KINK_90)
        );

        interestRateModelFlat = new LinearWithKinkInterestRateModel(
            rescuer,
            executor,
            FLAT_IR_12, // 12% interest rate (rate% at 0% UR)
            FLAT_IR_12, // 12% percent interest rate (rate% at 100% UR)
            UTILIZATION_RATIO_90, // 90% utilization (UR for when the kink starts)
            FLAT_IR_12 // 12% percent interest rate (rate% at kink% UR)
        );
    }

    function assertNewRateParams(
        LinearWithKinkInterestRateModel baseModel,
        uint80 newBaseInterestRate,
        uint80 newMaxInterestRate,
        uint256 newKinkUtilizationRatio,
        uint80 newKinkInterestRate
    ) internal {
        // get initial params
        (
            uint80 baseInterestRate,
            uint80 maxInterestRate,
            uint80 kinkInterestRate,
            uint256 kinkUtilizationRatio
        ) = baseModel.rateParams();

        assertEq(baseInterestRate, newBaseInterestRate);
        assertEq(maxInterestRate, newMaxInterestRate);
        assertEq(kinkInterestRate, newKinkInterestRate);
        assertEq(kinkUtilizationRatio, newKinkUtilizationRatio);
    }
}

contract LinearWithKinkInterestRateModelTestModifiers is
    LinearWithKinkInterestRateModelTestBase
{
    event InterestRateParamsSet(
        uint80 _baseInterestRate, 
        uint80 _maxInterestRate, 
        uint256 _kinkUtilizationRatio, 
        uint80 _kinkInterestRate
    );

    function test_accessAliceSetRateParams() public {
        vm.startPrank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector)
        );
        interestRateModelKinkNinety.setRateParams(
            0.02e18,
            0.75e18,
            0.5e18,
            0.1e18
        );

        // assert params were not changed
        assertNewRateParams(
            interestRateModelKinkNinety,
            uint80(IR_AT_0_UR),
            uint80(IR_AT_100_UR),
            UTILIZATION_RATIO_90,
            uint80(IR_AT_KINK_90)
        );
    }

    function test_accessExecutorSetRateParams() public {
        vm.startPrank(executor);
        vm.expectEmit();
        emit InterestRateParamsSet(0.02e18, 0.75e18, 0.5e18, 0.1e18);
        interestRateModelKinkNinety.setRateParams(
            0.02e18,
            0.75e18,
            0.5e18,
            0.1e18
        );
        assertNewRateParams(
            interestRateModelKinkNinety,
            0.02e18,
            0.75e18,
            0.5e18,
            0.1e18
        );
    }

    function test_expectInvalidParams_Zero() public {
        vm.startPrank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector)
        );
        interestRateModelKinkNinety.setRateParams(0e18, 0e18, 0e18, 0e18);
    }

    function test_expectInvalidParams_Max() public {
        vm.startPrank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector)
        );
        interestRateModelKinkNinety.setRateParams(
            type(uint80).max,
            type(uint80).max,
            type(uint256).max,
            type(uint80).max
        );
    }

    function test_expectInvalidParams_failWrongOrder() public {
        vm.startPrank(executor);
        // Base rate is bigger thank Kink rate
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        interestRateModelKinkNinety.setRateParams(100, 100, 100, 99);

        // Kink rate is bigger thank Max rate
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        interestRateModelKinkNinety.setRateParams(100, 99, 100, 100);
    }

    function test_accessRescuerSetRateParams() public {
        vm.startPrank(rescuer);
        vm.expectRevert(
            abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector)
        );
        interestRateModelKinkNinety.setRateParams(
            0.03e18,
            0.85e18,
            0.55e18,
            0.15e18
        );

        interestRateModelKinkNinety.setRescueMode(true);
        vm.expectEmit();
        emit InterestRateParamsSet(0.03e18, 0.85e18, 0.55e18, 0.15e18);
        interestRateModelKinkNinety.setRateParams(
            0.03e18,
            0.85e18,
            0.55e18,
            0.15e18
        );
        assertNewRateParams(
            interestRateModelKinkNinety,
            0.03e18,
            0.85e18,
            0.55e18,
            0.15e18
        );
    }

    function test_calculateInterestRateKink_zeroUR() public {
        uint256 utilizationRatio = 0.0e18; // 0% UR
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(utilizationRatio);
        assertEq(expectedInterestRate, IR_AT_0_UR); // 5% IR
    }

    function test_calculateInterestRateKink_oneUR() public {
        uint256 utilizationRatio = 0.01e18; // 1% UR
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(utilizationRatio);
        assertEq(expectedInterestRate, 0.050555555555555555e18); // ~5.06% IR
    }

    function test_calculateInterestRateKink_HalfUR() public {
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(UTILIZATION_RATIO_90 / 2);
        assertEq(expectedInterestRate, 0.074999999999999999e18); // ~7.49% IR
    }

    function test_calculateInterestRateKink_BeforeKink() public {
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(UTILIZATION_RATIO_90 - 1);
        assertEq(expectedInterestRate, 0.099999999999999999e18); // <10% IR
    }

    function test_calculateInterestRateKink_AtKink() public {
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(UTILIZATION_RATIO_90);

        // the following should be 10% at kink, but calc is not exact
        assertEq(expectedInterestRate, 0.099999999999999999e18); // ~10% IR
    }

    function test_calculateInterestRateKink_AfterKink() public {
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(UTILIZATION_RATIO_90 + 1);
        assertEq(expectedInterestRate, 0.100000000000000001e18); // >10% IR
    }

    function test_calculateInterestRateKink_HalfWayUpKink() public {
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(
                UTILIZATION_RATIO_90 + (1e18 - UTILIZATION_RATIO_90) / 2
            );
        assertEq(expectedInterestRate, 0.15e18); // 15% IR
    }

    function test_calculateInterestRateKink_BeforeHundredUR() public {
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(1e18 - 1);
        assertEq(expectedInterestRate, 0.199999999999999999e18); // ~19.99% IR
    }

    function test_calculateInterestRateKink_HundredUR() public {
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(1e18);
        assertEq(expectedInterestRate, IR_AT_100_UR); // ~20% IR
    }

    function test_calculateInterestRateKink_AfterHundredUR() public {
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(1e18 + 1);
        assertEq(expectedInterestRate, IR_AT_100_UR); // ~20% IR
    }

    function test_calculateInterestRateFlat_ZeroUR() public {
        uint256 utilizationRatio = 0e18; // 0% UR
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(utilizationRatio);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterestRateFlat_OneUR() public {
        uint256 utilizationRatio = 0.01e18; // 1% UR
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(utilizationRatio);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterestRateFlat_HalfUR() public {
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(UTILIZATION_RATIO_90 / 2);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterestRateFlat_BeforeKink() public {
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(UTILIZATION_RATIO_90 - 1);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterestRateFlat_AtKink() public {
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(UTILIZATION_RATIO_90);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterestRateFlat_AfterKink() public {
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(UTILIZATION_RATIO_90 + 1);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterestRateFlat_HundredUR() public {
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(100e18);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterestRateFlat_AfterHundredUR() public {
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(100e18 + 1);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterest_ExceedPrecission() public {
        uint256 utilizationRatio = 0.1e20;
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(utilizationRatio);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterest_MaxUR() public {
        uint256 utilizationRatio = type(uint256).max;
        uint256 expectedInterestRate = interestRateModelFlat
            .calculateInterestRate(utilizationRatio);
        assertEq(expectedInterestRate, FLAT_IR_12); // 12% IR
    }

    function test_calculateInterestRateKink900_HundredUR() public {
        vm.startPrank(executor);
        vm.expectEmit();
        emit InterestRateParamsSet(
            uint80(IR_AT_0_UR),
            9e18,
            UTILIZATION_RATIO_90,
            uint80(IR_AT_KINK_90)
        );
        interestRateModelKinkNinety.setRateParams(
            uint80(IR_AT_0_UR), // 5% at 0% UR
            9e18, // 900% Max interest rate at 100% UR
            UTILIZATION_RATIO_90, // Kink at 90%
            uint80(IR_AT_KINK_90) // 10% IR at kink
        );
        assertNewRateParams(
            interestRateModelKinkNinety,
            uint80(IR_AT_0_UR),
            9e18,
            UTILIZATION_RATIO_90,
            uint80(IR_AT_KINK_90)
        );
        
        // we should expect 900% IR  at 100% UR, however, there is a hard cap at 500%
        uint256 expectedInterestRate = interestRateModelKinkNinety
            .calculateInterestRate(100e18);
        assertEq(expectedInterestRate, MAX_ALLOWED_INTEREST_RATE); // 500% IR
    }
}
