pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { ITreasuryPriceIndexOracle } from "contracts/interfaces/v2/ITreasuryPriceIndexOracle.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TreasuryPriceIndexOracleTest is TempleTest {
    ITreasuryPriceIndexOracle public tpiOracle;

    uint96 public defaultPrice = 0.97e18;
    uint96 public defaultMaxDelta = 0.1e18; // 10 cents
    uint32 public defaultCooldownSecs = 30;
    uint32 public defaultTargetDateDelta = 1 weeks; // 1 week

    event TreasuryPriceIndexSetAt(uint96 oldTpi, uint96 newTpiTarget, uint256 time);
    event TpiCooldownSet(uint32 cooldownSecs);
    event MaxTreasuryPriceIndexDeltaSet(uint256 maxDelta);
    event MaxTreasuryPriceIndexTargetDateDeltaSet(uint32 maxTargetDateDelta);


    function setUp() public {
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, defaultPrice, defaultMaxDelta, defaultTargetDateDelta);
    }
    
    function checkTpiData(uint96 expectedCurrent, uint96 expectedTargetTpi, uint32 expectedUpdatedAt, uint32 expectedTargetDate, uint96 expectedTpiSlope, bool expectedIncreaseInTargetTpi) internal {
        (
            uint96 currentTpi,
            uint96 targetTpi,
            uint32 lastUpdatedAt,
            uint32 targetDate,
            uint96 tpiSlope,
            bool increaseInTargetTpi
        ) = tpiOracle.tpiData();
        assertEq(currentTpi, expectedCurrent);
        assertEq(targetTpi, expectedTargetTpi);
        assertEq(lastUpdatedAt, expectedUpdatedAt);
        assertEq(targetDate, expectedTargetDate);
        assertEq(tpiSlope, expectedTpiSlope);
        assertEq(increaseInTargetTpi, expectedIncreaseInTargetTpi);
    }

    function test_initialize() public {
        checkTpiData(defaultPrice, defaultPrice, uint32(block.timestamp), uint32(block.timestamp), 1, true);
        assertEq(tpiOracle.maxTreasuryPriceIndexDelta(), defaultMaxDelta);
        assertEq(tpiOracle.maxTreasuryPriceIndexTargetDateDelta(), defaultTargetDateDelta);
        assertEq(tpiOracle.treasuryPriceIndex(), defaultPrice);
        assertEq(tpiOracle.TPI_DECIMALS(), 18);
    }
    
    function test_access_setMaxTreasuryPriceIndexDelta() public {
        expectElevatedAccess();
        tpiOracle.setMaxTreasuryPriceIndexDelta(0.15e18);
    }

    function test_access_setMaxTreasuryPriceIndexTargetDateDelta() public {
        expectElevatedAccess();
        tpiOracle.setMaxTreasuryPriceIndexTargetDateDelta(uint32(block.timestamp+1));
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

    function test_setMaxTreasuryPriceIndexTargetDateDelta() public {
        vm.startPrank(executor);

        vm.expectEmit(address(tpiOracle));
        emit MaxTreasuryPriceIndexTargetDateDeltaSet(uint32(1 weeks));

        tpiOracle.setMaxTreasuryPriceIndexTargetDateDelta(uint32(1 weeks));
        assertEq(tpiOracle.maxTreasuryPriceIndexTargetDateDelta(), 1 weeks);
    }

    function test_setTreasuryPriceIndex_successUp() public {
        uint96 newTpi = 1.07e18;
        vm.startPrank(executor);
        tpiOracle.setMaxTreasuryPriceIndexTargetDateDelta(0);

        vm.expectEmit(address(tpiOracle));
        emit TreasuryPriceIndexSetAt(defaultPrice, newTpi, block.timestamp+1);

        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp)+1);
        checkTpiData(defaultPrice, newTpi, uint32(block.timestamp), uint32(block.timestamp)+1, 1e17, true);
    }

    function test_setTreasuryPriceIndex_successDown() public {
        uint96 newTpi = 0.87e18;
        vm.startPrank(executor);
        tpiOracle.setMaxTreasuryPriceIndexTargetDateDelta(0);

        vm.expectEmit(address(tpiOracle));
        emit TreasuryPriceIndexSetAt(defaultPrice, newTpi, block.timestamp+1);

        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp)+1);
        checkTpiData(defaultPrice, newTpi, uint32(block.timestamp), uint32(block.timestamp)+1, 1e17, false);
    }

    function test_setTreasuryPriceIndex_breachDeltaUp() public {
        uint96 newTpi = 1.0700001e18;
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxTpiDelta.selector, defaultPrice, newTpi, defaultMaxDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp)+1);
    }

    function test_setTreasuryPriceIndex_breachDeltaDown() public {
        uint96 newTpi = 0.8699999e18;
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxTpiDelta.selector, defaultPrice, newTpi, defaultMaxDelta));
        tpiOracle.setTreasuryPriceIndexAt(newTpi, uint32(block.timestamp)+1);
    }

    function test_setTreasuryPriceIndex_breachDateDelta() public {
        vm.startPrank(executor);

        uint32 targetDate = uint32(block.timestamp + 2);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxDateDelta.selector, targetDate, uint32(block.timestamp), 1 weeks));
        tpiOracle.setTreasuryPriceIndexAt(1.07e18, targetDate);
    }

    function test_setTreasuryPriceIndex_flatAtTargetDate() public {
        uint96 newTpi = 1.06e18;
        vm.startPrank(executor);
        tpiOracle.setMaxTreasuryPriceIndexTargetDateDelta(0);

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

    function test_setTreasuryPriceIndex_increasesAtExpectedRate() public {
        uint96 newTpi = 1.07e18;
        vm.startPrank(executor);
        tpiOracle.setMaxTreasuryPriceIndexTargetDateDelta(0);

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
}