pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import {TempleTest} from '../../TempleTest.sol';
import {CompoundedInterest} from 'contracts/v2/interestRate/CompoundedInterest.sol';
import {PRBMath_MulDiv18_Overflow} from '@prb/math/src/Common.sol';
import {PRBMath_UD60x18_Exp_InputTooBig} from '@prb/math/src/UD60x18.sol';

contract CompoundedInterestTest is TempleTest {
    using CompoundedInterest for uint256;

    uint96 public constant ZERO_PCT_INTEREST = 0e18;
    uint96 public constant ZERO_PCT_1DAY = 100e18;
    uint96 public constant ZERO_PCT_30DAY = 100e18;
    uint96 public constant ZERO_PCT_1YEAR = 100e18;

    uint96 public constant ONE_PCT_INTEREST = 0.01e18;
    uint96 public constant ONE_PCT_1DAY = 100_002739763558233400;
    uint96 public constant ONE_PCT_30DAY = 100_082225567522087300;
    uint96 public constant ONE_PCT_1YEAR = 101_005016708416805700;

    uint96 public constant FIVE_PCT_INTEREST = 0.05e18;
    uint96 public constant FIVE_PCT_1DAY = 100_013699568442168900;
    uint96 public constant FIVE_PCT_30DAY = 100_411804498165141800;
    uint96 public constant FIVE_PCT_1YEAR = 105_127109637602403900;

    uint96 public constant TEN_PCT_INTEREST = 0.10e18;
    uint96 public constant TEN_PCT_1DAY = 100_027401013666092800;
    uint96 public constant TEN_PCT_30DAY = 100_825304825777374100;
    uint96 public constant TEN_PCT_1YEAR = 110_517091807564762400;

    uint256 public initialPrincipalAmount = 100e18;
    uint256 public zeroPrincipalAmount = 0e18;

    // Zero percent interest tests
    function test_compound_zeroPct_dayOne() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            1 days,
            ZERO_PCT_INTEREST
        );
        assertEq(newInterestRate, ZERO_PCT_1DAY);
    }

    function test_compound_zeroPct_dayThirty() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            30 days,
            ZERO_PCT_INTEREST
        );
        assertEq(newInterestRate, ZERO_PCT_30DAY);
    }

    function test_compound_zeroPct_yearOne() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            365 days,
            ZERO_PCT_INTEREST
        );
        assertEq(newInterestRate, ZERO_PCT_1YEAR);
    }

    // One percent interest tests
    function test_compound_onePct_dayOne() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            1 days,
            ONE_PCT_INTEREST
        );
        assertEq(newInterestRate, ONE_PCT_1DAY);
    }

    function test_compound_onePct_dayThirty() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            30 days,
            ONE_PCT_INTEREST
        );
        assertEq(newInterestRate, ONE_PCT_30DAY);
    }

    function test_compound_onePct_yearOne() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            365 days,
            ONE_PCT_INTEREST
        );
        assertEq(newInterestRate, ONE_PCT_1YEAR);
    }

    // Five percent interest tests
    function test_compound_fivePct_dayOne() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            1 days,
            FIVE_PCT_INTEREST
        );
        assertEq(newInterestRate, FIVE_PCT_1DAY);
    }

    function test_compound_fivePct_dayThirty() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            30 days,
            FIVE_PCT_INTEREST
        );
        assertEq(newInterestRate, FIVE_PCT_30DAY);
    }

    function test_compound_fivePct_yearOne() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            365 days,
            FIVE_PCT_INTEREST
        );
        assertEq(newInterestRate, FIVE_PCT_1YEAR);
    }

    // Ten percent interest tests
    function test_compound_yenPct_dayOne() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            1 days,
            TEN_PCT_INTEREST
        );
        assertEq(newInterestRate, TEN_PCT_1DAY);
    }

    function test_compound_yenPct_dayThirty() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            30 days,
            TEN_PCT_INTEREST
        );
        assertEq(newInterestRate, TEN_PCT_30DAY);
    }

    function test_compound_yenPct_yearOne() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            365 days,
            TEN_PCT_INTEREST
        );
        assertEq(newInterestRate, TEN_PCT_1YEAR);
    }

    function test_compound_zeroPrincipal() public {
        uint256 newInterestRate = zeroPrincipalAmount.continuouslyCompounded(
            1 days,
            FIVE_PCT_INTEREST
        );
        assertEq(newInterestRate, 0e18);
    }

    function test_compound_zeroDays() public {
        uint256 newInterestRate = initialPrincipalAmount.continuouslyCompounded(
            0 days,
            FIVE_PCT_INTEREST
        );
        assertEq(newInterestRate, initialPrincipalAmount);
    }

    // Revert tests
    function test_compute_maxPrincipal_expectOverflow() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                PRBMath_MulDiv18_Overflow.selector,
                -1,
                100_0274010136660928
            )
        );
        type(uint256).max.continuouslyCompounded(1 days, TEN_PCT_INTEREST);
    }

    function test_compute_maxRate_expectInputTooBig() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                PRBMath_UD60x18_Exp_InputTooBig.selector,
                217063458943189966009709452
            )
        );

        initialPrincipalAmount.continuouslyCompounded(1 days, type(uint96).max);
    }

    function test_compute_maxDays_expectInputTooBig() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                PRBMath_UD60x18_Exp_InputTooBig.selector,
                251230855258321719918645200199771689497
            )
        );

        initialPrincipalAmount.continuouslyCompounded(
            type(uint96).max,
            TEN_PCT_INTEREST
        );
    }
}
