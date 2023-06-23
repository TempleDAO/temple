pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { TempleCircuitBreaker } from "contracts/v2/access/TempleCircuitBreaker.sol";

import "forge-std/console.sol";

/* solhint-disable func-name-mixedcase, not-rely-on-time */
contract TempleCircuitBreakerTestBase is TempleTest {
    TempleCircuitBreaker public breaker;

    // Expected buckets - cleared after every check
    uint256[100] internal ebkts;

    function test_bucketIndexFromTime_1day_24buckets() public {
        breaker = new TempleCircuitBreaker(rescuer, executor, 1 days, 24, 100e18);

        uint256 timestamp = 1687403665; // Thu Jun 22 2023 03:14:25 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 3);

        timestamp = 1687374865; // Wed Jun 21 2023 19:14:25 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 19);

        timestamp = 1687356000; // Wed Jun 21 2023 14:00:00 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 14);

        timestamp = 1687391999; // Wed Jun 21 2023 23:59:59 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 23);

        timestamp = 1687392000; // Thu Jun 22 2023 00:00:00 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 0);

        timestamp = 1687392001; // Thu Jun 22 2023 00:00:01 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 0);
    }

    function test_bucketIndexFromTime_2day_24buckets() public {
        breaker = new TempleCircuitBreaker(rescuer, executor, 2 days, 48, 100e18);

        uint256 timestamp = 1687403665; // Thu Jun 22 2023 03:14:25 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 3);       
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 24+3);
        assertEq(breaker.bucketIndexFromTime(timestamp + 2 days), 3);
        
        timestamp = 1687374865; // Wed Jun 21 2023 19:14:25 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 24+19);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 19);
        assertEq(breaker.bucketIndexFromTime(timestamp + 2 days), 24+19);

        timestamp = 1687356000; // Wed Jun 21 2023 14:00:00 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 24+14);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 14);
        assertEq(breaker.bucketIndexFromTime(timestamp + 2 days), 24+14);

        timestamp = 1687391999; // Wed Jun 21 2023 23:59:59 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 24+23);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 23);
        assertEq(breaker.bucketIndexFromTime(timestamp + 2 days), 24+23);

        timestamp = 1687392000; // Thu Jun 22 2023 00:00:00 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 0);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 24);
        assertEq(breaker.bucketIndexFromTime(timestamp + 2 days), 0);

        timestamp = 1687392001; // Thu Jun 22 2023 00:00:01 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 0);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 24);
        assertEq(breaker.bucketIndexFromTime(timestamp + 2 days), 0);
    }

    function test_bucketIndexFromTime_1day_48buckets() public {
        breaker = new TempleCircuitBreaker(rescuer, executor, 1 days, 48, 100e18);

        uint256 timestamp = 1687403665; // Thu Jun 22 2023 03:14:25 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 6);       
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 6);
        
        timestamp = 1687376065; // Wed Jun 21 2023 19:34:25 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 39);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 39);

        timestamp = 1687356000; // Wed Jun 21 2023 14:00:00 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 28);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 28);

        timestamp = 1687391999; // Wed Jun 21 2023 23:59:59 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 47);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 47);

        timestamp = 1687392000; // Thu Jun 22 2023 00:00:00 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 0);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 0);

        timestamp = 1687392001; // Thu Jun 22 2023 00:00:01 GMT+0000
        assertEq(breaker.bucketIndexFromTime(timestamp), 0);
        assertEq(breaker.bucketIndexFromTime(timestamp + 1 days), 0);
    }

    function test_initialization() public {
        breaker = new TempleCircuitBreaker(rescuer, executor, 1 days, 24, 100e18);
        assertEq(breaker.nBuckets(), 24);
        assertEq(breaker.duration(), 1 days);
        assertEq(breaker.secondsPerBucket(), 60*60);
        assertEq(breaker.currentBucket(), 0);
        assertEq(breaker.cap(), 100e18);
    }


    function test_addTx_addSameBucket() public {
        breaker = new TempleCircuitBreaker(rescuer, executor, 1 days, 24, 100e18);
        vm.startPrank(executor);

        // Add works
        {
            breaker.addTx(1);
            assertEq(breaker.currentBucket(), 0);
            assertEq(breaker.buckets(0), 1);
        }

        // Breached the cap
        {
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreaker.CapBreached.selector, 100e18+1, 100e18));
            breaker.addTx(100e18);
        }

        // One less works - right at the cap
        {
            breaker.addTx(100e18-1);
            assertEq(breaker.currentBucket(), 0);
            assertEq(breaker.buckets(0), 100e18);
        }
    }

    function logTime() internal view {
        uint256 hrs = (block.timestamp/60)/60;
        uint256 dys = hrs / 24;
        uint256 mins = (block.timestamp-(hrs*60*60))/60;
        uint256 secs = (block.timestamp-(hrs*60*60)-(mins*60));
        console.log("\ndays=%d", dys);
        hrs = hrs-(dys*24);
        console.log("%d:%d:%d", hrs, mins, secs);
        console.log("\t(%d)", block.timestamp);
    }

    function warp(uint256 dd, uint256 hh, uint256 mm, uint256 ss) internal {
        uint256 ts = dd*24*60*60 + hh*60*60 + mm*60 + ss;
        vm.warp(ts);
        logTime();
    }

    function doCheck(uint256 amt, uint256 currentBucket, uint256 utilisation) internal {
        breaker.addTx(amt);
        assertEq(breaker.currentBucket(), currentBucket, "currentBucket");
        assertEq(breaker.currentUtilisation(), utilisation, "utilisation");

        for (uint256 i; i<100; ++i) {
            assertEq(breaker.buckets(i), ebkts[i]);
        }
        delete ebkts;
    }

    function test_addTx_1day_24buckets() public {
        breaker = new TempleCircuitBreaker(rescuer, executor, 1 days, 24, 100e18);
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
        }

        // day 1, 00:00:00
        // Breached the cap (24hr period ends at 01:00:00)
        {
            warp(1, 0, 0, 0);
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreaker.CapBreached.selector, 100e18+1, 100e18));
            breaker.addTx(1);
        }

        // day 1, 00:59:59
        // Breached the cap (24hr period ends at 01:00:00)
        {
            warp(1, 0, 59, 59);
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreaker.CapBreached.selector, 100e18+1, 100e18));
            breaker.addTx(1);
        }

        // day 1, 01:00:00
        // Now past the first window - so this works
        {
            warp(1, 1, 0, 0);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[23]) = (0, 20e18 + 1, 10e18, 20e18, 30e18);
            doCheck(1, 1, 80e18 + 1);
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
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreaker.CapBreached.selector, 100e18 + 1, 100e18));
            breaker.addTx(1);
        }

        // day 5, 10:00:00
        {
            warp(5, 10, 0, 0);
            ebkts[10] = 50e18;
            doCheck(50e18, 10, 50e18);
        }
    }

    function test_addTx_2day_8buckets() public {
        breaker = new TempleCircuitBreaker(rescuer, executor, 2 days, 8, 100e18);
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
        }

        // day 2, 00:00:00
        // Breached the cap (24hr period ends at 06:00:00)
        {
            warp(2, 0, 0, 0);
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreaker.CapBreached.selector, 100e18+1, 100e18));
            breaker.addTx(1);
        }

        // day 2, 05:59:59
        // Breached the cap (24hr period ends at 06:00:00)
        {
            warp(2, 5, 59, 59);
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreaker.CapBreached.selector, 100e18+1, 100e18));
            breaker.addTx(1);
        }

        // day 2, 06:00:00
        // Now past the first bucket so ok (drop the first 20)
        {
            warp(2, 6, 0, 0);
            (ebkts[0], ebkts[1], ebkts[2], ebkts[4], ebkts[7]) = (0, 20e18 + 1, 10e18, 20e18, 30e18);
            doCheck(1, 1, 80e18 + 1);
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

        // day 6, 06:00:02, the full next day
        // Now reverts
        {
            warp(6, 6, 0, 2);
            vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreaker.CapBreached.selector, 100e18 + 1, 100e18));
            breaker.addTx(1);
        }

        // day 10, 19:00:00
        {
            warp(10, 19, 0, 0);
            ebkts[3] = 50e18;
            doCheck(50e18, 3, 50e18);
        }
    }
}