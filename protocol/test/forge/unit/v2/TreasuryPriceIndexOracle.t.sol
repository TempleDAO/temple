pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { ITreasuryPriceIndexOracle } from "contracts/interfaces/v2/ITreasuryPriceIndexOracle.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TreasuryPriceIndexOracleTest is TempleTest {
    ITreasuryPriceIndexOracle public tpiOracle;

    uint96 public constant defaultTpi = 0.97e18;
    uint96 public constant defaultMaxDelta = 0.1e18; // 10 cents
    uint32 public constant defaultCooldownSecs = 30;
    uint32 public constant defaultMinTargetTimeDelta = 1 weeks; // 1 week
    uint96 public constant defaultMaxRateOfChange = uint96(0.01e18) / 1 days; // 1c / day

    event TreasuryPriceIndexSetAt(uint96 oldTpi, uint96 newTpiTarget, uint256 time);
    event TpiCooldownSet(uint32 cooldownSecs);
    event MaxTreasuryPriceIndexDeltaSet(uint256 maxDelta);
    event MinTreasuryPriceIndexTargetTimeDeltaSet(uint32 maxTargetTimeDelta);
    event MaxAbsTreasuryPriceIndexRateOfChangeSet(uint96 maxAbsRateOfChange);

    function setUp() public {
        tpiOracle = new TreasuryPriceIndexOracle(
            rescuer, 
            executor, 
            defaultTpi, 
            defaultMaxDelta, 
            defaultMinTargetTimeDelta, 
            defaultMaxRateOfChange
        );
    }
    
    function checkTpiData(
        uint96 expectedStartingTpi,  
        uint32 expectedStartTime, 
        uint96 expectedTargetTpi,
        uint32 expectedTargetTime, 
        int96 expectedTpiSlope
    ) internal view {
        (
            uint96 startingTpi,
            uint32 startTime,
            uint96 targetTpi,
            uint32 targetTime,
            int96 tpiSlope
        ) = tpiOracle.tpiData();
        assertEq(startingTpi, expectedStartingTpi, "startingTpi");
        assertEq(startTime, expectedStartTime, "startTime");
        assertEq(targetTpi, expectedTargetTpi, "targetTpi");
        assertEq(targetTime, expectedTargetTime, "targetTime");
        assertEq(tpiSlope, expectedTpiSlope, "tpiSlope");
    }

    function test_initialize() public view {
        checkTpiData(defaultTpi, uint32(block.timestamp), defaultTpi, uint32(block.timestamp), 0);
        assertEq(tpiOracle.maxTreasuryPriceIndexDelta(), defaultMaxDelta);
        assertEq(tpiOracle.minTreasuryPriceIndexTargetTimeDelta(), defaultMinTargetTimeDelta);
        assertEq(tpiOracle.maxAbsTreasuryPriceIndexRateOfChange(), defaultMaxRateOfChange);
        assertEq(tpiOracle.treasuryPriceIndex(), defaultTpi);
        assertEq(tpiOracle.TPI_DECIMALS(), 18);
    }
    
    function test_access_setMaxTreasuryPriceIndexDelta() public {
        expectElevatedAccess();
        tpiOracle.setMaxTreasuryPriceIndexDelta(0.15e18);
    }

    function test_access_setMinTreasuryPriceIndexTargetTimeDelta() public {
        expectElevatedAccess();
        tpiOracle.setMinTreasuryPriceIndexTargetTimeDelta(uint32(block.timestamp+1));
    }

    function test_access_setMaxAbsTreasuryPriceIndexRateOfChange() public {
        expectElevatedAccess();
        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(0.01e18, 1 days);
    }

    function test_access_setTreasuryPriceIndexAt() public {
        expectElevatedAccess();
        tpiOracle.setTreasuryPriceIndexAt(1.02e18, uint32(block.timestamp + 1 weeks));
    }
    
    function test_setMaxTreasuryPriceIndexDelta() public {
        vm.startPrank(executor);

        vm.expectEmit(address(tpiOracle));
        emit MaxTreasuryPriceIndexDeltaSet(0.11e18);

        tpiOracle.setMaxTreasuryPriceIndexDelta(0.11e18);
        assertEq(tpiOracle.maxTreasuryPriceIndexDelta(), 0.11e18);
    }

    function test_setMinTreasuryPriceIndexTargetTimeDelta() public {
        vm.startPrank(executor);

        vm.expectEmit(address(tpiOracle));
        emit MinTreasuryPriceIndexTargetTimeDeltaSet(uint32(1 weeks));

        tpiOracle.setMinTreasuryPriceIndexTargetTimeDelta(uint32(1 weeks));
        assertEq(tpiOracle.minTreasuryPriceIndexTargetTimeDelta(), 1 weeks);
    }

    function test_setMaxAbsTreasuryPriceIndexRateOfChange() public {
        vm.startPrank(executor);

        uint96 expectedRate = uint96(0.05e18) / uint32(1 weeks);
        vm.expectEmit(address(tpiOracle));
        emit MaxAbsTreasuryPriceIndexRateOfChangeSet(expectedRate);

        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(0.05e18, uint32(1 weeks));
        assertEq(tpiOracle.maxAbsTreasuryPriceIndexRateOfChange(), expectedRate);
    }

    function test_setTreasuryPriceIndexAt_immediate_successUp() public {
        uint96 newTpi = 1.07e18;
        vm.startPrank(executor);
        tpiOracle.setMinTreasuryPriceIndexTargetTimeDelta(0);
        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(1e18, 1);

        uint32 setTime = uint32(block.timestamp);
        uint32 targetTime = setTime+1;

        vm.expectEmit(address(tpiOracle));
        emit TreasuryPriceIndexSetAt(defaultTpi, newTpi, targetTime);

        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetTime);
        checkTpiData(defaultTpi, setTime, newTpi, targetTime, 1e17);

        // The same after the targetTime
        skip(10 days);
        checkTpiData(defaultTpi, setTime, newTpi, targetTime, 1e17);
    }

    function test_setTreasuryPriceIndexAt_immediate_successDown() public {
        uint96 newTpi = 0.87e18;
        vm.startPrank(executor);
        tpiOracle.setMinTreasuryPriceIndexTargetTimeDelta(0);
        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(1e18, 1);

        uint32 setTime = uint32(block.timestamp);
        uint32 targetTime = setTime+1;

        vm.expectEmit(address(tpiOracle));
        emit TreasuryPriceIndexSetAt(defaultTpi, newTpi, targetTime);

        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetTime);
        checkTpiData(defaultTpi, setTime, newTpi, targetTime, -1e17);

        // The same after the targetTime
        skip(10 days);
        checkTpiData(defaultTpi, setTime, newTpi, targetTime, -1e17);
    }

    function test_setTreasuryPriceIndexAt_breachDeltaUp() public {
        uint96 newTpi = defaultTpi + defaultMaxDelta + 1;
        vm.startPrank(executor);
        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(1e18, 1);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxTpiDelta.selector, defaultTpi, newTpi, defaultMaxDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 1 weeks);

        newTpi -= 1;
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 1 weeks);
    }

    function test_setTreasuryPriceIndexAt_breachDeltaDown() public {
        uint96 newTpi = defaultTpi - defaultMaxDelta - 1;
        vm.startPrank(executor);
        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(1e18, 1);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxTpiDelta.selector, defaultTpi, newTpi, defaultMaxDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 1 weeks);

        newTpi += 1;
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 1 weeks);
    }

    function test_setTreasuryPriceIndexAt_breachMinDateDelta() public {
        uint96 newTpi = 1.07e18;
        vm.startPrank(executor);
        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(1e18, 1);

        // targetTime < now
        uint32 targetTime = uint32(block.timestamp)-1;
        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMinDateDelta.selector, targetTime, block.timestamp, defaultMinTargetTimeDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetTime);

        // targetTime <= now
        targetTime = uint32(block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMinDateDelta.selector, targetTime, block.timestamp, defaultMinTargetTimeDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetTime);

        // (targetTime - now) < minTreasuryPriceIndexTargetTimeDelta
        targetTime = uint32(block.timestamp) + 7 days - 1;
        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMinDateDelta.selector, targetTime, block.timestamp, defaultMinTargetTimeDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetTime);
        
        // Works with a 7 day target date
        targetTime = uint32(block.timestamp) + 7 days;
        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetTime);
        checkTpiData(defaultTpi, uint32(block.timestamp), newTpi, targetTime, 165343915343);
    }

    function test_setTreasuryPriceIndexAt_breachMaxTpiRateOfChange() public {
        vm.startPrank(executor);
        tpiOracle.setMaxTreasuryPriceIndexDelta(1e18);
        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(0.30e18, 30 days);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxTpiRateOfChange.selector, uint96(0.3e18 + 1e7) / 30 days, uint96(0.3e18) / 30 days));
        tpiOracle.setTreasuryPriceIndexAt(defaultTpi + 0.30e18 + 1e7, uint32(block.timestamp + 30 days));

        tpiOracle.setTreasuryPriceIndexAt(defaultTpi + 0.30e18, uint32(block.timestamp + 30 days));
    }

    function test_setTreasuryPriceIndexAt_flatAtTargetTime() public {
        uint96 newTpi = 1.06e18;
        vm.startPrank(executor);
        tpiOracle.setMinTreasuryPriceIndexTargetTimeDelta(0);
        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(1e18, 1);

        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp)+1);
        // check at target date we're at the target TPI
        vm.warp(block.timestamp + 1);
        uint96 actualTpi = tpiOracle.treasuryPriceIndex();
        assertEq(newTpi, actualTpi);
        // check in future price has remained static
        vm.warp(block.timestamp + 1 days);
        actualTpi = tpiOracle.treasuryPriceIndex();
        assertEq(newTpi, actualTpi);
    }

    function test_setTreasuryPriceIndexAt_increasesAtExpectedRateSecs() public {
        uint96 newTpi = 1.07e18;
        vm.startPrank(executor);
        tpiOracle.setMinTreasuryPriceIndexTargetTimeDelta(0);
        tpiOracle.setMaxAbsTreasuryPriceIndexRateOfChange(1e18, 1);

        uint96 currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(defaultTpi, currentTpi);
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 4);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(defaultTpi, currentTpi);
        vm.warp(2);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(9.95e17, currentTpi);
        vm.warp(3);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(1.02e18, currentTpi);
        vm.warp(4);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(1.045e18, currentTpi);
        vm.warp(5);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(1.07e18, currentTpi);
    }

    function test_setTreasuryPriceIndexAt_increasesAtExpectedRateYear() public {
        // TPI @ now      = 1.5e18
        // TPI @ 365 days = 2.5e18
        uint96 tpiStart = 1.5e18;
        uint96 tpiDelta = 1e18;
        uint256 startingBlock = 1704027600;
        uint256 MAX_ABS_DELTA = 1e8; // Small (expected) rounding diffs

        vm.warp(startingBlock);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, tpiStart, 10e18, 1 days, defaultMaxRateOfChange);

        vm.startPrank(executor);
        tpiOracle.setTreasuryPriceIndexAt(tpiStart + tpiDelta, uint32(block.timestamp) + 365 days);
        
        uint256 currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(currentTpi, tpiStart);

        // 1/10th in
        vm.warp(startingBlock + 365 days / 10);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertApproxEqAbs(currentTpi, tpiStart + tpiDelta / 10, MAX_ABS_DELTA);

        // half way in
        vm.warp(startingBlock + 365 days / 2);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertApproxEqAbs(currentTpi, tpiStart + tpiDelta / 2, MAX_ABS_DELTA);

        // 9/10ths in
        vm.warp(startingBlock + 365 days * 9 / 10);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertApproxEqAbs(currentTpi, tpiStart + tpiDelta * 9 / 10, MAX_ABS_DELTA);

        // 1 second before end
        vm.warp(startingBlock + 365 days - 1);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(currentTpi, 2.499999968266096017e18); // just less than tpiStart+tpiDelta

        // At end
        vm.warp(startingBlock + 365 days);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(currentTpi, tpiStart + tpiDelta);

        // At end + 1 day
        vm.warp(startingBlock + 365 days + 1 days);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(currentTpi, tpiStart + tpiDelta);
    }

    function test_setTreasuryPriceIndexAt_decreasesAtExpectedRateYear() public {
        // TPI @ now      = 2.5e18
        // TPI @ 365 days = 1.5e18
        uint96 tpiStart = 2.5e18;
        uint96 tpiDelta = 1e18;
        uint256 startingBlock = 1704027600;
        uint256 MAX_ABS_DELTA = 1e8; // Small (expected) rounding diffs

        vm.warp(startingBlock);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, tpiStart, 10e18, 1 days, defaultMaxRateOfChange);

        vm.startPrank(executor);
        tpiOracle.setTreasuryPriceIndexAt(tpiStart - tpiDelta, uint32(block.timestamp) + 365 days);
        
        uint256 currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(currentTpi, tpiStart);

        // 1/10th in
        vm.warp(startingBlock + 365 days / 10);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertApproxEqAbs(currentTpi, tpiStart - tpiDelta / 10, MAX_ABS_DELTA);

        // half way in
        vm.warp(startingBlock + 365 days / 2);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertApproxEqAbs(currentTpi, tpiStart - tpiDelta / 2, MAX_ABS_DELTA);

        // 9/10ths in
        vm.warp(startingBlock + 365 days * 9 / 10);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertApproxEqAbs(currentTpi, tpiStart - tpiDelta * 9 / 10, MAX_ABS_DELTA);

        // At end
        vm.warp(startingBlock + 365 days);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(currentTpi, tpiStart - tpiDelta);

        // At end + 1 day
        vm.warp(startingBlock + 365 days + 1 days);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(currentTpi, tpiStart - tpiDelta);
    }

    function test_setTreasuryPriceIndexAt_keepTheSame() public {
        assertEq(tpiOracle.treasuryPriceIndex(), defaultTpi);

        vm.startPrank(executor);
        tpiOracle.setTreasuryPriceIndexAt(defaultTpi, uint32(block.timestamp) + 365 days);

        checkTpiData(defaultTpi, uint32(block.timestamp), defaultTpi, uint32(block.timestamp) + 365 days, 0);

        skip(100 days);
        assertEq(tpiOracle.treasuryPriceIndex(), defaultTpi);
    }
}
