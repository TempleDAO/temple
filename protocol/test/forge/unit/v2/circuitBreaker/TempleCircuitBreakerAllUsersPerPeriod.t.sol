pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";
import { console2 } from "forge-std/Test.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

contract MockCaller {
    TempleCircuitBreakerAllUsersPerPeriod public breaker;

    constructor(address _breaker) {
        breaker = TempleCircuitBreakerAllUsersPerPeriod(_breaker);
    }

    function doStuff(uint256 amt) external {
        breaker.preCheck(address(this), amt);       
    }
}

/* solhint-disable func-name-mixedcase, not-rely-on-time */
contract TempleCircuitBreakerTestBase is TempleTest {
    bool public constant LOG = false;

    TempleCircuitBreakerAllUsersPerPeriod public breaker;

    // Expected buckets - cleared after every check
    uint256[100] internal ebkts;

    event ConfigSet(uint32 periodDuration, uint32 nBuckets, uint128 cap);
    event CapSet(uint128 cap);

    function setUp() public {
        breaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 1 days, 24, 100e18);
    }

    function test_initialization() public {
        assertEq(breaker.nBuckets(), 24);
        assertEq(breaker.periodDuration(), 1 days); 
        assertEq(breaker.secondsPerBucket(), 60*60);
        assertEq(breaker.bucketIndex(), 0);
        assertEq(breaker.cap(), 100e18);
    }

    function test_access_setConfig() public {
        expectElevatedAccess();
        breaker.setConfig(0, 0, 0);
    }

    function test_access_updateCap() public {
        expectElevatedAccess();
        breaker.updateCap(0);
    }

    function test_setConfig() public {
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        breaker.setConfig(0, 0, 0);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        breaker.setConfig(24, 23, 0);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        breaker.setConfig(65536, 65536, 0);

        vm.expectEmit(address(breaker));
        emit ConfigSet(10, 2, 0);
        breaker.setConfig(10, 2, 0);
        assertEq(breaker.nBuckets(), 2);
        assertEq(breaker.periodDuration(), 10); 
        assertEq(breaker.secondsPerBucket(), 5);
        assertEq(breaker.bucketIndex(), 0);
        assertEq(breaker.cap(), 0);
        for (uint256 i = 0; i < 5; ++i) {
            assertEq(breaker.buckets(i), 1);
        }

        breaker.setConfig(uint32(breaker.MAX_BUCKETS()), uint32(breaker.MAX_BUCKETS()), 0);
    }

    function test_updateCap() public {
        vm.startPrank(executor);

        vm.expectEmit(address(breaker));
        emit CapSet(20e18);
        breaker.updateCap(20e18);
        assertEq(breaker.cap(), 20e18);
    }
}

contract TempleCircuitBreakerTestPreCheck is TempleCircuitBreakerTestBase {

    function test_preCheck_addSameBucket() public {
        vm.startPrank(executor);

        // Add works
        {
            breaker.preCheck(address(this), 1);
            assertEq(breaker.bucketIndex(), 0);
            assertEq(breaker.buckets(0), 2);
        }

        // Breached the cap
        {
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 100e18+1, 100e18));
            breaker.preCheck(address(this), 100e18);
        }

        // One less works - right at the cap
        {
            breaker.preCheck(address(this), 100e18-1);
            assertEq(breaker.bucketIndex(), 0);
            assertEq(breaker.buckets(0), 100e18 + 1);
        }
    }

    function logTime() internal view {
        if (!LOG) return;

        uint256 hrs = (block.timestamp/60)/60;
        uint256 dys = hrs / 24;
        uint256 mins = (block.timestamp-(hrs*60*60))/60;
        uint256 secs = (block.timestamp-(hrs*60*60)-(mins*60));
        console2.log("\ndays=%d", dys-19358);
        hrs = hrs-(dys*24);
        console2.log("%d:%d:%d", hrs, mins, secs);
        console2.log("\t(%d)", block.timestamp);
    }

    function warp(uint256 dd, uint256 hh, uint256 mm, uint256 ss) internal {
        uint256 jan1_2023 = 1672531200;
        uint256 ts = jan1_2023 + dd*24*60*60 + hh*60*60 + mm*60 + ss;
        vm.warp(ts);
        logTime();
    }

    function doCheck(uint256 amt, uint256 bucketIndex, uint256 utilisationAfter) internal {
        assertEq(breaker.currentUtilisation(), utilisationAfter-amt, "utilisationBefore");
        breaker.preCheck(address(this), amt);
        assertEq(breaker.bucketIndex() % breaker.nBuckets(), bucketIndex, "bucketIndex");
        assertEq(breaker.currentUtilisation(), utilisationAfter, "utilisationAfter");

        for (uint256 i; i<breaker.nBuckets(); ++i) {
            assertEq(breaker.buckets(i), ebkts[i]+1);
        }

        for (uint256 i=breaker.nBuckets(); i<100; ++i) {
            assertEq(breaker.buckets(i), 0);
        }

        delete ebkts;
    }

    function test_preCheck_1day_24buckets() public {
        vm.startPrank(executor);

        // day 0, 0:00:01
        // Add 10 (total=10)
        {
            warp(0, 0, 0, 1);
            ebkts[0] = 10e18;
            doCheck(10e18, 0, 10e18);
        }

        // day 0, 0:30:01
        // Add 10 (total=20)
        {
            warp(0, 0, 30, 1);
            ebkts[0] = 20e18;
            doCheck(10e18, 0, 20e18);
        }

        // day 0, 1:00:01
        // Add 10 (total=30)
        {
            warp(0, 1, 0, 1);
            (ebkts[0], ebkts[1]) = (20e18, 10e18);
            doCheck(10e18, 1, 30e18);
        }

        // day 0, 1:30:01
        // Add 5 twice (total=40)
        {
            warp(0, 1, 30, 1);
            (ebkts[0], ebkts[1]) = (20e18, 15e18);
            doCheck(5e18, 1, 35e18);

            (ebkts[0], ebkts[1]) = (20e18, 20e18);
            doCheck(5e18, 1, 40e18);
        }

        // day 0, 2:00:01
        // Add 10 (total=50)
        {
            warp(0, 2, 0, 1);
            (ebkts[0], ebkts[1], ebkts[2]) = (20e18, 20e18, 10e18);
            doCheck(10e18, 2, 50e18);
        }

        // day 0, 4:00:01
        // Add 10 (total=60)
        {
            warp(0, 4, 0, 1);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4]) = (20e18, 20e18, 10e18, 10e18);
            doCheck(10e18, 4, 60e18);
        }

        // day 0, 4:30:01
        // Add 10 (total=70)
        {
            warp(0, 4, 30, 1);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4]) = (20e18, 20e18, 10e18, 20e18);
            doCheck(10e18, 4, 70e18);
        }

        // day 0, 23:30:01
        // Add 10 (total=80)
        {
            warp(0, 23, 30, 1);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[23]) = (20e18, 20e18, 10e18, 20e18, 10e18);
            doCheck(10e18, 23, 80e18);
        }

        // day 0, 23:59:01
        // Add 10 (total=90)
        {
            warp(0, 23, 59, 1);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[23]) = (20e18, 20e18, 10e18, 20e18, 20e18);
            doCheck(10e18, 23, 90e18);
        }

        // day 0, 23:59:59
        // Add 10 (total=100). At cap
        {
            warp(0, 23, 59, 59);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[23]) = (20e18, 20e18, 10e18, 20e18, 30e18);
            doCheck(10e18, 23, 100e18);

            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 100e18+1, 100e18));
            breaker.preCheck(address(this), 1);
        }

        // day 1, 00:00:00
        // OK again - passed the first window
        {
            warp(1, 0, 0, 0);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[23]) = (1, 20e18, 10e18, 20e18, 30e18);
            doCheck(1, 0, 80e18 + 1);
        }

        // day 2, 01:00:00, the full next day
        // Add 50, all other buckets removed
        {
            warp(2, 1, 0, 0);
            ebkts[1] = 50e18;
            doCheck(50e18, 1, 50e18);
        }

        // day 2, 01:00:01
        // Add 50 at cap
        {
            warp(2, 1, 0, 1);
            ebkts[1] = 100e18;
            doCheck(50e18, 1, 100e18);
        }

        // day 3, 01:00:01, the full next day
        // Add 100, all other durations cleared. at cap
        {
            warp(3, 1, 0, 1);
            ebkts[1] = 100e18;
            doCheck(100e18, 1, 100e18);
        }

        // day 3, 01:00:02
        // Add 1 - revert
        {
            warp(3, 1, 0, 2);
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 100e18 + 1, 100e18));
            breaker.preCheck(address(this), 1);
        }

        // day 5, 10:00:00
        {
            warp(5, 10, 0, 0);
            ebkts[10] = 50e18;
            doCheck(50e18, 10, 50e18);
        }
    }

    function test_gas() public {
        breaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 1 days, 24, 100000e18);
        MockCaller caller = new MockCaller(address(breaker));
        vm.startPrank(executor);

        setExplicitAccess(breaker, address(caller), breaker.preCheck.selector, true);

        uint256 totalGas;
        uint256 gasStart;

        for (uint256 i; i<1000; ++i) {
            gasStart = gasleft();
            caller.doStuff(1);
            totalGas += (gasStart-gasleft());
            vm.warp(block.timestamp+1);
        }
        for (uint256 i; i<1000; ++i) {
            gasStart = gasleft();
            caller.doStuff(1);
            totalGas += (gasStart-gasleft());
            vm.warp(block.timestamp+86);
        }
        for (uint256 i; i<1000; ++i) {
            gasStart = gasleft();
            caller.doStuff(1);
            totalGas += (gasStart-gasleft());
            vm.warp(block.timestamp+8640);
        }
        for (uint256 i; i<1000; ++i) {
            gasStart = gasleft();
            caller.doStuff(1);
            totalGas += (gasStart-gasleft());
            vm.warp(block.timestamp+86401);
        }

        uint256 avgGas = totalGas / 4000;
        assertLt(avgGas, 94_600);

        if (LOG) console2.log("totalGas:", totalGas, totalGas/4000);
    }

    function test_preCheck_2day_8buckets() public {
        breaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 2 days, 8, 100e18);
        vm.startPrank(executor);

        // day 0, 0:00:01
        // Add 10 (total=10)
        {
            warp(0, 0, 0, 1);
            ebkts[0] = 10e18;
            doCheck(10e18, 0, 10e18);
        }

        // day 0, 3:30:01
        // Add 10 (total=20)
        {
            warp(0, 3, 30, 1);
            ebkts[0] = 20e18;
            doCheck(10e18, 0, 20e18);
        }

        // day 0, 6:00:01
        // Add 10 (total=30)
        {
            warp(0, 6, 0, 1);
            (ebkts[0], ebkts[1]) = (20e18, 10e18);
            doCheck(10e18, 1, 30e18);
        }

        // day 0, 6:30:01
        // Add 5 twice (total=40)
        {
            warp(0, 6, 30, 1);
            (ebkts[0], ebkts[1]) = (20e18, 15e18);
            doCheck(5e18, 1, 35e18);

            (ebkts[0], ebkts[1]) = (20e18, 20e18);
            doCheck(5e18, 1, 40e18);
        }

        // day 0, 12:00:01
        // Add 10 (total=50)
        {
            warp(0, 12, 0, 1);
            (ebkts[0], ebkts[1], ebkts[2]) = (20e18, 20e18, 10e18);
            doCheck(10e18, 2, 50e18);
        }

        // day 1, 00:00:01
        // Add 10 (total=60)
        {
            warp(1, 0, 0, 1);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4]) = (20e18, 20e18, 10e18, 10e18);
            doCheck(10e18, 4, 60e18);
        }

        // day 1, 01:30:01
        // Add 10 (total=70)
        {
            warp(1, 1, 30, 1);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4]) = (20e18, 20e18, 10e18, 20e18);
            doCheck(10e18, 4, 70e18);
        }

        // day 1, 23:30:01
        // Add 10 (total=80)
        {
            warp(1, 23, 30, 1);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[7]) = (20e18, 20e18, 10e18, 20e18, 10e18);
            doCheck(10e18, 7, 80e18);
        }

        // day 1, 23:59:01
        // Add 10 (total=90)
        {
            warp(1, 23, 59, 1);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[7]) = (20e18, 20e18, 10e18, 20e18, 20e18);
            doCheck(10e18, 7, 90e18);
        }

        // day 1, 23:59:59
        // Add 10 (total=100). At cap
        {
            warp(1, 23, 59, 59);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[7]) = (20e18, 20e18, 10e18, 20e18, 30e18);
            doCheck(10e18, 7, 100e18);

            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 100e18+1, 100e18));
            breaker.preCheck(address(this), 1);
        }

        // day 2, 00:00:00
        // Now past the first bucket so ok (drop the first 20)
        {
            warp(2, 0, 0, 0);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[7]) = (1, 20e18, 10e18, 20e18, 30e18);
            doCheck(1, 0, 80e18 + 1);
        }

        // day 4, 06:00:00, the full next duration
        // Add 50, all other buckets are removed
        {
            warp(4, 6, 0, 0);
            ebkts[1] = 50e18;
            doCheck(50e18, 1, 50e18);
        }

        // day 4, 06:00:01
        // Add 50 at cap
        {
            warp(4, 6, 0, 1);
            ebkts[1] = 100e18;
            doCheck(50e18, 1, 100e18);
        }

        // day 6, 06:00:01, the full next duration
        // Add 50 all other buckets removed
        {
            warp(6, 6, 0, 1);
            ebkts[1] = 100e18;
            doCheck(100e18, 1, 100e18);
        }

        // day 6, 06:00:02
        // Now reverts
        {
            warp(6, 6, 0, 2);
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 100e18 + 1, 100e18));
            breaker.preCheck(address(this), 1);
        }

        // day 10, 19:00:00
        {
            warp(10, 19, 0, 0);
            ebkts[3] = 50e18;
            doCheck(50e18, 3, 50e18);
        }
    }


    function test_preCheck_1day_24buckets_wait() public {
        vm.startPrank(executor);

        {
            warp(0, 13, 45, 0);
            ebkts[13] = 75e18;
            doCheck(75e18, 13, 75e18);
        }

        {
            warp(0, 23, 6, 0);
            ebkts[13] = 75e18;
            ebkts[23] = 25e18;
            doCheck(25e18, 23, 100e18);
        }

        {
            warp(1, 12, 59, 59);
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 100e18 + 1, 100e18));
            breaker.preCheck(address(this), 1);
        }

        {
            warp(1, 13, 0, 0);
            ebkts[13] = 1;
            ebkts[23] = 25e18;
            doCheck(1, 13, 25e18 + 1);
        }
    }
}