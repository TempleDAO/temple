pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { ITreasuryPriceIndexOracle } from "contracts/interfaces/v2/ITreasuryPriceIndexOracle.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TreasuryPriceIndexOracleTest is TempleTest {
    ITreasuryPriceIndexOracle public tpiOracle;

    uint96 public constant defaultPrice = 0.97e18;
    uint96 public constant defaultMaxDelta = 0.1e18; // 10 cents
    uint32 public constant defaultCooldownSecs = 30;
    uint32 public constant defaultMinTargetDateDelta = 1 weeks; // 1 week

    event TreasuryPriceIndexSetAt(uint96 oldTpi, uint96 newTpiTarget, uint256 time);
    event TpiCooldownSet(uint32 cooldownSecs);
    event MaxTreasuryPriceIndexDeltaSet(uint256 maxDelta);
    event MinTreasuryPriceIndexTargetDateDeltaSet(uint32 maxTargetDateDelta);


    function setUp() public {
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, defaultPrice, defaultMaxDelta, defaultMinTargetDateDelta);
    }
    
    function checkTpiData(
        uint96 expectedCurrent, 
        uint96 expectedTargetTpi, 
        uint32 expectedUpdatedAt, 
        uint32 expectedTargetDate, 
        int96 expectedTpiSlope
    ) internal {
        (
            uint96 currentTpi,
            uint96 targetTpi,
            uint32 lastUpdatedAt,
            uint32 targetDate,
            int96 tpiSlope
        ) = tpiOracle.tpiData();
        assertEq(currentTpi, expectedCurrent, "currentTpi");
        assertEq(targetTpi, expectedTargetTpi, "targetTpi");
        assertEq(lastUpdatedAt, expectedUpdatedAt, "lastUpdatedAt");
        assertEq(targetDate, expectedTargetDate, "targetDate");
        assertEq(tpiSlope, expectedTpiSlope, "tpiSlope");
    }

    function test_initialize() public {
        checkTpiData(defaultPrice, defaultPrice, uint32(block.timestamp), uint32(block.timestamp), 0);
        assertEq(tpiOracle.maxTreasuryPriceIndexDelta(), defaultMaxDelta);
        assertEq(tpiOracle.minTreasuryPriceIndexTargetDateDelta(), defaultMinTargetDateDelta);
        assertEq(tpiOracle.treasuryPriceIndex(), defaultPrice);
        assertEq(tpiOracle.TPI_DECIMALS(), 18);
    }
    
    function test_access_setMaxTreasuryPriceIndexDelta() public {
        expectElevatedAccess();
        tpiOracle.setMaxTreasuryPriceIndexDelta(0.15e18);
    }

    function test_access_setMinTreasuryPriceIndexTargetDateDelta() public {
        expectElevatedAccess();
        tpiOracle.setMinTreasuryPriceIndexTargetDateDelta(uint32(block.timestamp+1));
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

    function test_setMinTreasuryPriceIndexTargetDateDelta() public {
        vm.startPrank(executor);

        vm.expectEmit(address(tpiOracle));
        emit MinTreasuryPriceIndexTargetDateDeltaSet(uint32(1 weeks));

        tpiOracle.setMinTreasuryPriceIndexTargetDateDelta(uint32(1 weeks));
        assertEq(tpiOracle.minTreasuryPriceIndexTargetDateDelta(), 1 weeks);
    }

    function test_setTreasuryPriceIndexAt_immediate_successUp() public {
        uint96 newTpi = 1.07e18;
        vm.startPrank(executor);
        tpiOracle.setMinTreasuryPriceIndexTargetDateDelta(0);

        uint32 setTime = uint32(block.timestamp);
        uint32 targetTime = setTime+1;

        vm.expectEmit(address(tpiOracle));
        emit TreasuryPriceIndexSetAt(defaultPrice, newTpi, targetTime);

        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetTime);
        checkTpiData(defaultPrice, newTpi, setTime, targetTime, 1e17);

        // The same after the targetTime
        skip(10 days);
        checkTpiData(defaultPrice, newTpi, setTime, targetTime, 1e17);
    }

    function test_setTreasuryPriceIndexAt_immediate_successDown() public {
        uint96 newTpi = 0.87e18;
        vm.startPrank(executor);
        tpiOracle.setMinTreasuryPriceIndexTargetDateDelta(0);

        uint32 setTime = uint32(block.timestamp);
        uint32 targetTime = setTime+1;

        vm.expectEmit(address(tpiOracle));
        emit TreasuryPriceIndexSetAt(defaultPrice, newTpi, targetTime);

        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetTime);
        checkTpiData(defaultPrice, newTpi, setTime, targetTime, -1e17);

        // The same after the targetTime
        skip(10 days);
        checkTpiData(defaultPrice, newTpi, setTime, targetTime, -1e17);
    }

    function test_setTreasuryPriceIndexAt_breachDeltaUp() public {
        uint96 newTpi = defaultPrice + defaultMaxDelta + 1;
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxTpiDelta.selector, defaultPrice, newTpi, defaultMaxDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 1 weeks);

        newTpi -= 1;
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 1 weeks);
    }

    function test_setTreasuryPriceIndexAt_breachDeltaDown() public {
        uint96 newTpi = defaultPrice - defaultMaxDelta - 1;
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxTpiDelta.selector, defaultPrice, newTpi, defaultMaxDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 1 weeks);

        newTpi += 1;
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 1 weeks);
    }

    function test_setTreasuryPriceIndexAt_breachMinDateDelta() public {
        uint96 newTpi = 1.07e18;
        vm.startPrank(executor);

        // targetDate < now
        uint32 targetDate = uint32(block.timestamp)-1;
        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMinDateDelta.selector, targetDate, block.timestamp, defaultMinTargetDateDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetDate);

        // targetDate <= now
        targetDate = uint32(block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMinDateDelta.selector, targetDate, block.timestamp, defaultMinTargetDateDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetDate);

        // (targetDate - now) < minTreasuryPriceIndexTargetDateDelta
        targetDate = uint32(block.timestamp) + 7 days - 1;
        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMinDateDelta.selector, targetDate, block.timestamp, defaultMinTargetDateDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetDate);
        
        // Works with a 7 day target date
        targetDate = uint32(block.timestamp) + 7 days;
        tpiOracle.setTreasuryPriceIndexAt(newTpi, targetDate);
        checkTpiData(defaultPrice, newTpi, uint32(block.timestamp), targetDate, 165343915343);
    }

    function test_setTreasuryPriceIndexAt_flatAtTargetDate() public {
        uint96 newTpi = 1.06e18;
        vm.startPrank(executor);
        tpiOracle.setMinTreasuryPriceIndexTargetDateDelta(0);

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
        tpiOracle.setMinTreasuryPriceIndexTargetDateDelta(0);

        uint96 currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(defaultPrice, currentTpi);
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp) + 4);
        currentTpi = tpiOracle.treasuryPriceIndex();
        assertEq(defaultPrice, currentTpi);
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
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, tpiStart, 10e18, 1 days);

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
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, tpiStart, 10e18, 1 days);

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
}
