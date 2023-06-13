pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from '../../TempleTest.sol';
import { CompoundedInterest } from 'contracts/v2/interestRate/CompoundedInterest.sol';
import { CommonEventsAndErrors } from 'contracts/common/CommonEventsAndErrors.sol';

import { stdError } from "forge-std/Test.sol";
// import { PRBMath_MulDiv18_Overflow } from "src/Common.sol";
// import { PRBMath_MulDiv18_Overflow } from "@prb/math/src/UD60x18.sol";

contract CompoundedInterestTestBase is TempleTest {
  using CompoundedInterest for uint256;
  uint256 public constant ONE_PCT_INTEREST = 0.01e18;
  uint256 public constant ONE_PCT_1DAY = 100002739763558233400;
  uint256 public constant ONE_PCT_30DAY = 100082225567522087300;
  uint256 public constant ONE_PCT_1YEAR = 101005016708416805700;
  
  uint256 public constant FIVE_PCT_INTEREST = 0.05e18;
  uint256 public constant FIVE_PCT_1DAY = 100013699568442168900;
  uint256 public constant FIVE_PCT_30DAY = 100411804498165141800;
  uint256 public constant FIVE_PCT_1YEAR = 105127109637602403900;
  
  uint256 public constant TEN_PCT_INTEREST = 0.10e18;
  uint256 public constant TEN_PCT_1DAY = 100027401013666092800;
  uint256 public constant TEN_PCT_30DAY = 100825304825777374100;
  uint256 public constant TEN_PCT_1YEAR = 110517091807564762400;


  uint256 public initialPrincipalAmount = 100e18;
  
}

contract CompoundedInterestTestModifiers is CompoundedInterestTestBase {

  error PRBMath_MulDiv18_Overflow(uint256 x, uint256 y);

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
    vm.expectRevert(abi.encodeWithSelector(PRBMath_MulDiv18_Overflow.selector, -1, 1000274010136660928));
    uint256 newInterestRate = CompoundedInterest.continuouslyCompounded(type(uint256).max, 1 days, uint96(TEN_PCT_INTEREST));
    assertEq(newInterestRate, TEN_PCT_1DAY);
  }
}