pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from '../../TempleTest.sol';
import { CompoundedInterest } from 'contracts/v2/interestRate/CompoundedInterest.sol';
import { CommonEventsAndErrors } from 'contracts/common/CommonEventsAndErrors.sol';

import { stdError } from "forge-std/Test.sol";
import { PRBMath_MulDiv18_Overflow } from "@prb/math/src/Common.sol";

contract CompoundedInterestTestBase is TempleTest {
  using CompoundedInterest for uint256;
  uint256 public constant ONE_PCT_INTEREST = 0.01e18;
  uint256 public constant ONE_PCT_1DAY = 100_002739763558233400;
  uint256 public constant ONE_PCT_30DAY = 100_082225567522087300;
  uint256 public constant ONE_PCT_1YEAR = 101_005016708416805700;
  
  uint256 public constant FIVE_PCT_INTEREST = 0.05e18;
  uint256 public constant FIVE_PCT_1DAY = 100_013699568442168900;
  uint256 public constant FIVE_PCT_30DAY = 100_411804498165141800;
  uint256 public constant FIVE_PCT_1YEAR = 105_127109637602403900;
  
  uint256 public constant TEN_PCT_INTEREST = 0.10e18;
  uint256 public constant TEN_PCT_1DAY = 100_027401013666092800;
  uint256 public constant TEN_PCT_30DAY = 100_825304825777374100;
  uint256 public constant TEN_PCT_1YEAR = 110_517091807564762400;


  uint256 public initialPrincipalAmount = 100e18;
  
}

contract CompoundedInterestTestModifiers is CompoundedInterestTestBase {

  // One percent interest tests
  function test_computeInterestRateOnePctOneDayImpl() public {    
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(initialPrincipalAmount, 1 days, uint96(ONE_PCT_INTEREST));
    assertEq(newInterestRate, ONE_PCT_1DAY);
  }
  
  function test_computeInterestRateOnePctThirtyDayImpl() public {    
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(initialPrincipalAmount, 30 days, uint96(ONE_PCT_INTEREST));
    assertEq(newInterestRate, ONE_PCT_30DAY);
  }
  
  function test_computeInterestRateOnePctOneYearImpl() public {    
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(initialPrincipalAmount, 365 days, uint96(ONE_PCT_INTEREST));
    assertEq(newInterestRate, ONE_PCT_1YEAR);
  }

  // Five percent interest tests
  function test_computeInterestRateFivePctOneDayImpl() public {    
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(initialPrincipalAmount, 1 days, uint96(FIVE_PCT_INTEREST));
    assertEq(newInterestRate, FIVE_PCT_1DAY);
  }
  
  function test_computeInterestRateFivePctThirtyDayImpl() public {    
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(initialPrincipalAmount, 30 days, uint96(FIVE_PCT_INTEREST));
    assertEq(newInterestRate, FIVE_PCT_30DAY);
  }
  
  function test_computeInterestRateFivePctOneYearImpl() public {    
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(initialPrincipalAmount, 365 days, uint96(FIVE_PCT_INTEREST));
    assertEq(newInterestRate, FIVE_PCT_1YEAR);
  }

  // Ten percent interest tests
  function test_computeInterestRateTenPctOneDayImpl() public {    
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(initialPrincipalAmount, 1 days, uint96(TEN_PCT_INTEREST));
    assertEq(newInterestRate, TEN_PCT_1DAY);
  }
  
  function test_computeInterestRateTenPctThirtyDayImpl() public {    
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(initialPrincipalAmount, 30 days, uint96(TEN_PCT_INTEREST));
    assertEq(newInterestRate, TEN_PCT_30DAY);
  }
  
  function test_computeInterestRateTenPctOneYearImpl() public {    
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(initialPrincipalAmount, 365 days, uint96(TEN_PCT_INTEREST));
    assertEq(newInterestRate, TEN_PCT_1YEAR);
  }


  // Revert tests
  function test_expectOverflow() public {   
    vm.expectRevert(abi.encodeWithSelector(PRBMath_MulDiv18_Overflow.selector, -1, 100_0274010136660928));
    CompoundedInterest.continuouslyCompounded(type(uint256).max, 1 days, uint96(TEN_PCT_INTEREST));
  }
}