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

    event TreasuryPriceIndexSet(uint96 oldTpi, uint96 newTpi);
    event TpiCooldownSet(uint32 cooldownSecs);
    event MaxTreasuryPriceIndexDeltaSet(uint256 maxDelta);

    function setUp() public {
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, defaultPrice, defaultMaxDelta, defaultCooldownSecs);
    }
    
    function checkTpiData(uint96 expectedCurrent, uint96 expectedPrevious, uint32 expectedUpdatedAt, uint32 expectedCooldown) internal {
        (
            uint96 currentTpi,
            uint96 previousTpi,
            uint32 lastUpdatedAt,
            uint32 cooldownSecs
        ) = tpiOracle.tpiData();
        assertEq(currentTpi, expectedCurrent);
        assertEq(previousTpi, expectedPrevious);
        assertEq(lastUpdatedAt, expectedUpdatedAt);
        assertEq(cooldownSecs, expectedCooldown);
    }

    function test_initialize() public {
        checkTpiData(defaultPrice, defaultPrice, uint32(block.timestamp), defaultCooldownSecs);
        assertEq(tpiOracle.maxTreasuryPriceIndexDelta(), defaultMaxDelta);
        assertEq(tpiOracle.treasuryPriceIndex(), defaultPrice);
        assertEq(tpiOracle.TPI_DECIMALS(), 18);
    }

    function test_access_setTpiCooldown() public {
        expectElevatedAccess();
        tpiOracle.setTpiCooldown(100);
    }
    
    function test_access_setMaxTreasuryPriceIndexDelta() public {
        expectElevatedAccess();
        tpiOracle.setMaxTreasuryPriceIndexDelta(0.15e18);
    }
    
    function test_access_setTreasuryPriceIndex() public {
        expectElevatedAccess();
        tpiOracle.setTreasuryPriceIndex(1.02e18);
    }

    function test_setTpiCooldown() public {
        vm.startPrank(executor);

        vm.expectEmit(address(tpiOracle));
        emit TpiCooldownSet(uint32(99));

        tpiOracle.setTpiCooldown(99);
         (,,, uint32 cooldownSecs) = tpiOracle.tpiData();
        assertEq(cooldownSecs, 99);
    }

    function test_setMaxTreasuryPriceIndexDelta() public {
        vm.startPrank(executor);

        vm.expectEmit(address(tpiOracle));
        emit MaxTreasuryPriceIndexDeltaSet(0.11e18);

        tpiOracle.setMaxTreasuryPriceIndexDelta(0.11e18);
        assertEq(tpiOracle.maxTreasuryPriceIndexDelta(), 0.11e18);
    }

    function test_setTreasuryPriceIndex_successUp() public {
        uint96 newTpi = 1.07e18;
        vm.startPrank(executor);

        vm.expectEmit(address(tpiOracle));
        emit TreasuryPriceIndexSet(defaultPrice, newTpi);

        tpiOracle.setTreasuryPriceIndex(newTpi);
        checkTpiData(newTpi, defaultPrice, uint32(block.timestamp), defaultCooldownSecs);
    }

    function test_setTreasuryPriceIndex_successDown() public {
        uint96 newTpi = 0.87e18;
        vm.startPrank(executor);

        vm.expectEmit(address(tpiOracle));
        emit TreasuryPriceIndexSet(defaultPrice, newTpi);

        tpiOracle.setTreasuryPriceIndex(newTpi);
        checkTpiData(newTpi, defaultPrice, uint32(block.timestamp), defaultCooldownSecs);
    }

    function test_setTreasuryPriceIndex_breachDeltaUp() public {
        uint96 newTpi = 1.0700001e18;
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxTpiDelta.selector, defaultPrice, newTpi, defaultMaxDelta));
        tpiOracle.setTreasuryPriceIndex(newTpi);
    }

    function test_setTreasuryPriceIndex_breachDeltaDown() public {
        uint96 newTpi = 0.8699999e18;
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryPriceIndexOracle.BreachedMaxTpiDelta.selector, defaultPrice, newTpi, defaultMaxDelta));
        tpiOracle.setTreasuryPriceIndex(newTpi);
    }

    function test_treasuryPriceIndex_beforeCooldown() public {
        uint96 newTpi = 1.05e18;
        vm.startPrank(executor);
        tpiOracle.setTreasuryPriceIndex(newTpi);
        vm.warp(block.timestamp + defaultCooldownSecs-1);
        assertEq(tpiOracle.treasuryPriceIndex(), defaultPrice);
    }

    function test_treasuryPriceIndex_atCooldown() public {
        uint96 newTpi = 1.05e18;
        vm.startPrank(executor);
        tpiOracle.setTreasuryPriceIndex(newTpi);
        vm.warp(block.timestamp + defaultCooldownSecs);
        assertEq(tpiOracle.treasuryPriceIndex(), newTpi);
    }

    function test_treasuryPriceIndex_afterCooldown() public {
        uint96 newTpi = 1.05e18;
        vm.startPrank(executor);
        tpiOracle.setTreasuryPriceIndex(newTpi);
        vm.warp(block.timestamp + defaultCooldownSecs+1);
        assertEq(tpiOracle.treasuryPriceIndex(), newTpi);
    }

    function test_treasuryPriceIndex_zeroCooldown() public {
        uint96 newTpi = 1.05e18;
        vm.startPrank(executor);
        tpiOracle.setTpiCooldown(0);
        tpiOracle.setTreasuryPriceIndex(newTpi);
        assertEq(tpiOracle.treasuryPriceIndex(), newTpi);
    }

    function test_treasuryPriceIndex_reset_beforeCooldown() public {
        uint96 newTpi = 1.05e18;
        vm.startPrank(executor);
        tpiOracle.setTreasuryPriceIndex(newTpi);
        vm.warp(block.timestamp + defaultCooldownSecs-1);
        uint96 newTpi2 = 1.07e18;
        tpiOracle.setTreasuryPriceIndex(newTpi2);
        assertEq(tpiOracle.treasuryPriceIndex(), defaultPrice);
    }

    function test_treasuryPriceIndex_reset_atCooldown() public {
        uint96 newTpi = 1.05e18;
        vm.startPrank(executor);
        tpiOracle.setTreasuryPriceIndex(newTpi);
        vm.warp(block.timestamp + defaultCooldownSecs);
        uint96 newTpi2 = 1.07e18;
        tpiOracle.setTreasuryPriceIndex(newTpi2);
        assertEq(tpiOracle.treasuryPriceIndex(), newTpi);
    }

    function test_treasuryPriceIndex_reset_afterCooldown() public {
        uint96 newTpi = 1.05e18;
        vm.startPrank(executor);
        tpiOracle.setTreasuryPriceIndex(newTpi);
        vm.warp(block.timestamp + defaultCooldownSecs+1);
        uint96 newTpi2 = 1.07e18;
        tpiOracle.setTreasuryPriceIndex(newTpi2);
        assertEq(tpiOracle.treasuryPriceIndex(), newTpi);
    }

    function test_treasuryPriceIndex_reset_zeroCooldown() public {
        uint96 newTpi = 1.05e18;
        vm.startPrank(executor);
        tpiOracle.setTpiCooldown(0);
        tpiOracle.setTreasuryPriceIndex(newTpi);
        uint96 newTpi2 = 1.07e18;
        tpiOracle.setTreasuryPriceIndex(newTpi2);
        assertEq(tpiOracle.treasuryPriceIndex(), newTpi2);
    }
}