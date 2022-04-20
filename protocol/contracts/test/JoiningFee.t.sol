pragma solidity 0.8.10;

import {TempleTest} from "./utils/TempleTest.t.sol";
import {JoiningFee} from "../core/JoiningFee.sol";

contract JoiningFeeTest is TempleTest {
    JoiningFee joiningFee;
    
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