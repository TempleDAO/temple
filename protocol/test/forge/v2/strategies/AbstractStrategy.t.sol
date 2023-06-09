pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { MockStrategy } from "./MockStrategy.t.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { TreasuryReservesVault, ITreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

/* solhint-disable func-name-mixedcase */
contract AbstractStrategyTestBase is TempleTest {
    MockStrategy public strategy;
    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);
    FakeERC20 public frax = new FakeERC20("FRAX", "FRAX", address(0), 0);
    FakeERC20 public usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    TempleDebtToken public dUSD;
    TreasuryReservesVault public trv;
    uint256 public constant DEFAULT_BASE_INTEREST = 0.01e18;

    address[] public reportedAssets = [address(dai), address(frax)];

    function _setUp() public {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        trv = new TreasuryReservesVault(rescuer, executor, address(temple), address(dai), address(dUSD), 9700);
        strategy = new MockStrategy(rescuer, executor, "MockStrategy", address(trv), reportedAssets);

        vm.startPrank(executor);
        dUSD.addMinter(executor);
        dUSD.addMinter(address(trv));
        vm.stopPrank();
    }
}

contract AbstractStrategyTestAdmin is AbstractStrategyTestBase {
    event TreasuryReservesVaultSet(address indexed trv);
    event StrategyIsShuttingDownSet(address indexed strategy, bool isShuttingDown);
    event Shutdown(uint256 stablesRecovered);
    event StrategyShutdown(address indexed strategy, uint256 stablesRecovered, uint256 debtBurned);
    event RealisedGain(address indexed strategy, uint256 amount);

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.executors(executor), true);
        assertEq(strategy.rescuers(rescuer), true);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.superApiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "MockStrategy");
        assertEq(strategy.strategyVersion(), "X.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.stableToken()), address(dai));
        assertEq(address(strategy.internalDebtToken()), address(dUSD));
        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);
        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, 0);
        assertEq(ceiling, 0);
        assertEq(dai.allowance(address(strategy), address(trv)), type(uint256).max);
    }

    function test_recoverToken() public {
        uint256 amount = 100 ether;
        deal(address(dai), address(strategy), amount, true);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, address(dai), amount);

        vm.startPrank(executor);
        strategy.recoverToken(address(dai), alice, amount);
        assertEq(dai.balanceOf(alice), amount);
        assertEq(dai.balanceOf(address(strategy)), 0);
    }

    function test_setTreasuryReservesVault() public {
        assertEq(address(strategy.treasuryReservesVault()), address(trv));

        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        strategy.setTreasuryReservesVault(address(0));

        vm.expectRevert();
        strategy.setTreasuryReservesVault(alice);

        TreasuryReservesVault trv2 = new TreasuryReservesVault(rescuer, executor, address(temple), address(dai), address(dUSD), 9700);

        vm.expectEmit();
        emit TreasuryReservesVaultSet(address(trv2));
        strategy.setTreasuryReservesVault(address(trv2));
        assertEq(address(strategy.treasuryReservesVault()), address(trv2));

        assertEq(dai.allowance(address(strategy), address(trv)), 0);
        assertEq(dai.allowance(address(strategy), address(trv2)), type(uint256).max);

        strategy.setApiVersion("XXX");
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.InvalidVersion.selector, "XXX", "1.0.0"));
        strategy.setTreasuryReservesVault(address(trv2));
    }

    function test_automatedShutdown() public {
        vm.startPrank(executor);
        dUSD.mint(address(strategy), 10);
        bytes memory params = abi.encode(2, 10);
        bytes memory shutdownData = strategy.populateShutdownData(params);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.NotEnabled.selector));
        strategy.automatedShutdown(shutdownData);

        trv.addNewStrategy(address(strategy), 100e18, 0);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.NotShuttingDown.selector));
        strategy.automatedShutdown(shutdownData);

        vm.expectEmit(address(trv));
        emit StrategyIsShuttingDownSet(address(strategy), true);
        trv.setStrategyIsShuttingDown(address(strategy), true);

        vm.expectEmit(address(strategy));
        emit Shutdown(25);

        vm.expectEmit(address(trv));
        emit RealisedGain(address(strategy), 15);

        vm.expectEmit(address(trv));
        emit StrategyShutdown(address(strategy), 25, 10);

        uint256 stables = strategy.automatedShutdown(shutdownData);
        assertEq(stables, 25);
    }

}

contract AbstractStrategyTestAccess is AbstractStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_setTreasuryReservesVault() public {
        expectElevatedAccess();
        strategy.setTreasuryReservesVault(alice);
    }

    function test_access_recoverToken() public {
        expectElevatedAccess();
        strategy.recoverToken(address(dai), alice, 100);
    }

    function test_access_setManualAssetBalanceDeltas() public {
        expectElevatedAccess();
        ITempleStrategy.AssetBalanceDelta[] memory deltas = new ITempleStrategy.AssetBalanceDelta[](0);
        strategy.setManualAdjustments(deltas);
    }
}

contract AbstractStrategyTestBalances is AbstractStrategyTestBase {

    event AssetBalancesCheckpoint(ITempleStrategy.AssetBalance[] assetBalances);
    event ManualAdjustmentsSet(ITempleStrategy.AssetBalanceDelta[] adjustments);

    function setUp() public {
        _setUp();
    }

    function test_trvBorrowPosition() public {
        vm.startPrank(executor);
        uint256 borrowCeiling = 100e18;
        trv.addNewStrategy(address(strategy), borrowCeiling, 0);
        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, 0);
        assertEq(ceiling, borrowCeiling);

        deal(address(dai), address(trv), 1000e18, true);
        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, 100e18);
        assertEq(ceiling, borrowCeiling);

        dUSD.mint(address(strategy), 25e18);
        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 25e18);
        assertEq(available, 75e18);
        assertEq(ceiling, borrowCeiling);

        dUSD.burn(address(strategy), 10e18);
        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 15e18);
        assertEq(available, 85e18);
        assertEq(ceiling, borrowCeiling);
    }

    function test_latestAssetBalances() public {
        vm.startPrank(executor);
        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, reportedAssets.length);
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 0);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 0);

        // Deal some assets
        deal(address(dai), address(strategy), 50, true);
        deal(address(frax), address(strategy), 100, true);
        deal(address(usdc), address(strategy), 200, true);

        assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 50);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 100);
    }

    function test_balanceSheet() public {
        (
            ITempleStrategy.AssetBalance[] memory assetBalances, 
            ITempleStrategy.AssetBalanceDelta[] memory manAdjustments, 
            uint256 debt
        ) = strategy.balanceSheet();
        
        assertEq(assetBalances.length, reportedAssets.length);
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 0);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 0);
        assertEq(debt, 0);

        // Deal some assets
        deal(address(dai), address(strategy), 50, true);
        deal(address(frax), address(strategy), 100, true);
        deal(address(usdc), address(strategy), 200, true);
        vm.startPrank(executor);
        dUSD.mint(address(strategy), 100e18);

        // Set manual adjustments
        ITempleStrategy.AssetBalanceDelta[] memory deltas = new ITempleStrategy.AssetBalanceDelta[](3);
        deltas[0] = ITempleStrategy.AssetBalanceDelta(address(frax), 50);
        deltas[1] = ITempleStrategy.AssetBalanceDelta(address(dai), -50);
        deltas[2] = ITempleStrategy.AssetBalanceDelta(address(usdc), 1000);
        strategy.setManualAdjustments(deltas);

        (
            assetBalances, 
            manAdjustments, 
            debt
        ) = strategy.balanceSheet();
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 50);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 100);
        assertEq(manAdjustments.length, 3);
        assertEq(manAdjustments[0].asset, address(frax));
        assertEq(manAdjustments[0].delta, 50);
        assertEq(manAdjustments[1].asset, address(dai));
        assertEq(manAdjustments[1].delta, -50);
        assertEq(manAdjustments[2].asset, address(usdc));
        assertEq(manAdjustments[2].delta, 1000);
        assertEq(debt, 100e18);
    }

    function test_checkpointAssetBalances() public {
        vm.startPrank(executor);
        deal(address(dai), address(strategy), 50, true);
        deal(address(frax), address(strategy), 100, true);
        deal(address(usdc), address(strategy), 200, true);
        dUSD.mint(address(strategy), 100e18);

        ITempleStrategy.AssetBalance[] memory expectedBalances = new ITempleStrategy.AssetBalance[](2);
        expectedBalances[0] = ITempleStrategy.AssetBalance(address(dai), 50);
        expectedBalances[1] = ITempleStrategy.AssetBalance(address(frax), 100);

        vm.expectEmit(address(strategy));
        emit AssetBalancesCheckpoint(expectedBalances);

        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.checkpointAssetBalances();
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, expectedBalances[0].asset);
        assertEq(assetBalances[0].balance, expectedBalances[0].balance);
        assertEq(assetBalances[1].asset, expectedBalances[1].asset);
        assertEq(assetBalances[1].balance, expectedBalances[1].balance);
    }

    function test_setManualAssetBalanceDeltas() public {
        vm.startPrank(executor);

        ITempleStrategy.AssetBalanceDelta[] memory deltas = new ITempleStrategy.AssetBalanceDelta[](3);
        deltas[0] = ITempleStrategy.AssetBalanceDelta(address(frax), 50);
        deltas[1] = ITempleStrategy.AssetBalanceDelta(address(dai), -50);
        deltas[2] = ITempleStrategy.AssetBalanceDelta(address(usdc), 1000);

        vm.expectEmit();
        emit ManualAdjustmentsSet(deltas);
        strategy.setManualAdjustments(deltas);

        ITempleStrategy.AssetBalanceDelta[] memory getDeltas = strategy.manualAdjustments();
        assertEq(getDeltas.length, deltas.length);
        for (uint256 i; i < getDeltas.length; ++i) {
            assertEq(getDeltas[i].asset, deltas[i].asset);
            assertEq(getDeltas[i].delta, deltas[i].delta);
        }

        // Deal some dai/frax balance and check the asset balances are the same
        {
            deal(address(dai), address(strategy), 1000, true);
            deal(address(frax), address(strategy), 1000, true);

            ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 2);
            assertEq(assetBalances[0].asset, address(dai));
            assertEq(assetBalances[0].balance, 1000);
            assertEq(assetBalances[1].asset, address(frax));
            assertEq(assetBalances[1].balance, 1000);
        }
    }
}