pragma solidity 0.8.10;

import "ds-test/test.sol";
import "../core/JoiningFee.sol";

interface Vm {
    function warp(uint256) external;
    function assume(bool) external; 
}

contract JoiningFeeTest is DSTest {
    JoiningFee joiningFee;
    Vm vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    
    function setUp() public {
        joiningFee = new JoiningFee(10000000000000000000);
    }

    function testSetJoiningFeeFor(uint256 fee) public {
        joiningFee.setHourlyJoiningFeeFor(address(0x0), fee);
        assertEq(joiningFee.defaultHourlyJoiningFee(), fee);
    }

    function testFuzzCalc(uint256 rnd) public {
        uint256 date = 1649864241;
        vm.assume(rnd < date);
        vm.assume((date-rnd) > 1);
        vm.assume(rnd > 0);
        vm.warp(date);
        uint256 result = joiningFee.calc((date - rnd), (5*rnd), address(0x0));
    }
}