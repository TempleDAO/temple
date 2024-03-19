pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { MockStrategy } from "./MockStrategy.t.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { TreasuryReservesVault, ITreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ud } from "@prb/math/src/UD60x18.sol";
import { stdError } from "forge-std/StdError.sol";

/* solhint-disable func-name-mixedcase, not-rely-on-time */
contract AbstractStrategyTestBase is TempleTest {
    MockStrategy public strategy;
    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);
    FakeERC20 public weth = new FakeERC20("WETH", "WETH", address(0), 0);
    FakeERC20 public usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    TempleDebtToken public dUSD;
    TreasuryPriceIndexOracle public tpiOracle;
    TreasuryReservesVault public trv;
    uint96 public constant DEFAULT_BASE_INTEREST = 0.01e18;

    address[] public reportedAssets = [address(dai), address(weth)];

    function _setUp() internal {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 0.97e18, 0.1e18, 0);
        trv = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        strategy = new MockStrategy(rescuer, executor, "MockStrategy", address(trv), address(dai), address(weth), address(temple), reportedAssets);

        vm.startPrank(executor);
        dUSD.addMinter(executor);
        dUSD.addMinter(address(trv));
        vm.stopPrank();
    }
}

contract AbstractStrategyTestAdmin is AbstractStrategyTestBase {
    using SafeERC20 for FakeERC20;

    // ITempleStrategy
    event TreasuryReservesVaultSet(address indexed trv);
    event Shutdown();
    event TokenAllowanceSet(address token, address spender, uint256 amount);

    // ITreasuryReservesVault
    event StrategyIsShuttingDownSet(address indexed strategy, bool isShuttingDown);
    event StrategyShutdownCreditAndDebt(address indexed strategy, address indexed token, uint256 outstandingCredit, uint256 outstandingDebt);
    event StrategyCreditAndDebtBalance(address indexed strategy, address indexed token, uint256 credit, uint256 debt);
    event Repay(address indexed strategy, address indexed token, address indexed from, uint256 stablesAmount);

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.executor(), executor);
        assertEq(strategy.rescuer(), rescuer);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.superApiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "MockStrategy");
        assertEq(strategy.strategyVersion(), "X.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.dai()), address(dai));
        assertEq(address(strategy.weth()), address(weth));
        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
        trv.availableForStrategyToBorrow(address(strategy), dai);
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

    function test_setTokenAllowance() public {
        vm.startPrank(executor);

        uint256 amount = 123;
        vm.expectEmit();
        emit TokenAllowanceSet(address(dai), alice, amount);

        strategy.setTokenAllowance(dai, alice, amount);
        assertEq(dai.allowance(address(strategy), alice), amount);

        // No-op
        strategy.setTokenAllowance(dai, alice, amount);
        assertEq(dai.allowance(address(strategy), alice), amount);

        // set to 0
        vm.expectEmit();
        emit TokenAllowanceSet(address(dai), alice, 0);
        strategy.setTokenAllowance(dai, alice, 0);
        assertEq(dai.allowance(address(strategy), alice), 0);

    }

    function test_setTreasuryReservesVault() public {
        assertEq(address(strategy.treasuryReservesVault()), address(trv));

        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        strategy.setTreasuryReservesVault(address(0));

        vm.expectRevert();
        strategy.setTreasuryReservesVault(alice);

        TreasuryReservesVault trv2 = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));

        vm.expectEmit();
        emit TreasuryReservesVaultSet(address(trv2));
        strategy.setTreasuryReservesVault(address(trv2));
        assertEq(address(strategy.treasuryReservesVault()), address(trv2));
    }

    function test_automatedShutdown() public {
        // The strategy pulls tokens from alice to repay
        vm.startPrank(alice);
        dai.approve(address(strategy), 25);
        dai.mint(alice, 25);

        vm.startPrank(executor);
        dUSD.mint(address(strategy), 60);
 
        bytes memory params = abi.encode(2, 10, alice);
        bytes memory shutdownData = strategy.populateShutdownData(params);

        // The mock strategy wants to repay DAI, which isn't enabled.
        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
        strategy.automatedShutdown(shutdownData);

        // The strategy still isn't enabled
        trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
        strategy.automatedShutdown(shutdownData);

        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 100e18);
        trv.addStrategy(address(strategy), -123, debtCeiling);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.NotShuttingDown.selector));
        strategy.automatedShutdown(shutdownData);

        vm.expectEmit(address(trv));
        emit StrategyIsShuttingDownSet(address(strategy), true);
        trv.setStrategyIsShuttingDown(address(strategy), true);

        // The strategy first repays any remaining stables (the mock does 2 * 10 + 5)
        vm.expectEmit(address(trv));
        emit Repay(address(strategy), address(dai), address(strategy), 25);

        // There was an outstanding debt of 35
        vm.expectEmit(address(trv));
        emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, 35);

        // The strategy shuts down
        vm.expectEmit(address(strategy));
        emit Shutdown();

        // There was an outstanding debt of 35
        vm.expectEmit(address(trv));
        emit StrategyShutdownCreditAndDebt(address(strategy), address(dai), 0, 35);

        strategy.automatedShutdown(shutdownData);

        // The debt is now cleared, and DAI repaid to strategy
        assertEq(dUSD.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(strategy)), 0);

        // The DAI was repaid to TRV
        assertEq(dai.balanceOf(address(trv)), 25);
    }

    function test_debtCeilingUpdated() public {
        vm.startPrank(address(trv));

        assertEq(strategy.debtCeilingUpdatedCalled(), false);
        strategy.debtCeilingUpdated(dai, 100);
        assertEq(strategy.debtCeilingUpdatedCalled(), true);
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

    function test_access_setTokenAllowance() public {
        expectElevatedAccess();
        strategy.setTokenAllowance(dai, alice, 100);
    }

    function test_access_setManualAssetBalanceDeltas() public {
        expectElevatedAccess();
        ITempleStrategy.AssetBalanceDelta[] memory deltas = new ITempleStrategy.AssetBalanceDelta[](0);
        strategy.setManualAdjustments(deltas);
    }

    function test_access_debtCeilingUpdated() public {
        expectElevatedAccess();
        strategy.debtCeilingUpdated(dai, 100);
    }
}

contract AbstractStrategyTestBalances is AbstractStrategyTestBase {

    event AssetBalancesCheckpoint(ITempleStrategy.AssetBalance[] assetBalances);
    event ManualAdjustmentsSet(ITempleStrategy.AssetBalanceDelta[] adjustments);

    function setUp() public {
        _setUp();
    }

    function test_availableToBorrow() public {
        vm.startPrank(executor);

        // Setup dai to be borrowed
        {
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
            deal(address(dai), address(trv), 100e18, true);
        }

        // Setup the strategy
        {
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 33e18);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, 33e18);

        deal(address(dai), address(trv), 1000e18, true);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, 33e18);

        // Borrow 25e18
        strategy.borrow(dai, 25e18);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, 8e18);

        // Repay 30e18 --> 5e18 in credit
        deal(address(dai), address(strategy), 30e18, true);
        strategy.repay(dai, 30e18);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, 38e18);

        // Change the debt ceiling to 0
        trv.setStrategyDebtCeiling(address(strategy), dai, 0);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, 5e18);

        // Can still borrow the 5e18 credit
        strategy.borrow(dai, 4.99e18);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, 0.01e18);

        // Can't go over
        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e18, 0.02e18));
        strategy.borrow(dai, 0.02e18);
    }

    function test_availableToBorrow_overflow() public {
        vm.startPrank(executor);

        // Setup dai to be borrowed
        {
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
            deal(address(dai), address(trv), 100e18, true);
        }

        uint256 debtCeiling = type(uint256).max - 10e18;

        // Setup the strategy
        {
            ITempleStrategy.AssetBalance[] memory debtCeilingArr = new ITempleStrategy.AssetBalance[](1);
            debtCeilingArr[0] = ITempleStrategy.AssetBalance(address(dai), debtCeiling);
            trv.addStrategy(address(strategy), 0, debtCeilingArr);
        }

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling);

        deal(address(dai), address(trv), 1000e18, true);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling);

        // Borrow 25e18
        strategy.borrow(dai, 25e18);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling-25e18);

        // Repay 30e18 --> 5e18 in credit
        deal(address(dai), address(strategy), 30e18, true);
        strategy.repay(dai, 30e18);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, debtCeiling + 5e18);

        // Repay another 5e18 -> right at the max available now.
        deal(address(dai), address(strategy), 5e18, true);
        strategy.repay(dai, 5e18);
        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, type(uint256).max);

        // Repaying any more will overflow.
        deal(address(dai), address(strategy), 1, true);
        vm.expectRevert(stdError.arithmeticError);
        strategy.repay(dai, 1);
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
        deal(address(weth), address(strategy), 100, true);
        deal(address(usdc), address(strategy), 200, true);

        assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 50);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 100);
    }

    function test_checkpointAssetBalances() public {
        vm.startPrank(executor);
        deal(address(dai), address(strategy), 50, true);
        deal(address(weth), address(strategy), 100, true);
        deal(address(usdc), address(strategy), 200, true);
        dUSD.mint(address(strategy), 100e18);

        ITempleStrategy.AssetBalance[] memory expectedBalances = new ITempleStrategy.AssetBalance[](2);
        expectedBalances[0] = ITempleStrategy.AssetBalance(address(dai), 50);
        expectedBalances[1] = ITempleStrategy.AssetBalance(address(weth), 100);

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
        deltas[0] = ITempleStrategy.AssetBalanceDelta(address(weth), 50);
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

        // Deal some dai/weth balance and check the asset balances are the same
        {
            deal(address(dai), address(strategy), 1000, true);
            deal(address(weth), address(strategy), 1000, true);

            ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 2);
            assertEq(assetBalances[0].asset, address(dai));
            assertEq(assetBalances[0].balance, 1000);
            assertEq(assetBalances[1].asset, address(weth));
            assertEq(assetBalances[1].balance, 1000);
        }
    }
}

contract AbstractStrategyTestMultiAsset is AbstractStrategyTestBase {
    TempleDebtToken public dTEMPLE;
    TempleDebtToken public dETH;

    uint256 public constant TEMPLE_BASE_INTEREST = 0;
    uint96 public constant ETH_BASE_INTEREST = 0.04e18;

    function setUp() public {
        _setUp();
        
        dTEMPLE = new TempleDebtToken("Temple Debt TEMPLE", "dTEMPLE", rescuer, executor, 0);
        dETH = new TempleDebtToken("Temple Debt ETH", "dETH", rescuer, executor, ETH_BASE_INTEREST);

        vm.startPrank(executor);
        dTEMPLE.addMinter(address(trv));
        dETH.addMinter(address(trv));

        // Setup tokens to be borrowed
        {
            trv.setBorrowToken(dai, address(0), 1_000e18, 1_000e18, address(dUSD));
            deal(address(dai), address(trv), 1_000e18, true);

            trv.setBorrowToken(temple, address(0), 1_000e18, 1_000e18, address(dTEMPLE));
            deal(address(temple), address(trv), 1_000e18, true);

            trv.setBorrowToken(weth, address(0), 1_000e18, 1_000e18, address(dETH));
            deal(address(weth), address(trv), 1_000e18, true);
        }

        // Setup the strategy
        {
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](3);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 333e18);
            debtCeiling[1] = ITempleStrategy.AssetBalance(address(temple), 66e18);
            debtCeiling[2] = ITempleStrategy.AssetBalance(address(weth), 99e18);
            trv.addStrategy(address(strategy), -123, debtCeiling);
        }

        vm.stopPrank();
    }

    function approxInterest(uint256 principal, uint96 rate, uint256 age) internal pure returns (uint256) {
        // Approxmiate as P * (1 + r/365 days)^(age)
        // ie compounding every 1 second (almost but not quite continuous)
        uint256 onePlusRate = uint256(rate / 365 days + 1e18);

        return ud(principal).mul(ud(onePlusRate).powu(age)).unwrap();
    }

    function test_multiAsset() public {
        vm.startPrank(executor);
        {
            strategy.borrow(dai, 100e18);
            strategy.borrow(temple, 50e18);
            strategy.borrow(weth, 2e18);
        }

        {
            assertEq(dai.balanceOf(address(strategy)), 100e18);
            assertEq(dUSD.balanceOf(address(strategy)), 100e18);

            assertEq(temple.balanceOf(address(strategy)), 50e18);
            assertEq(dTEMPLE.balanceOf(address(strategy)), 50e18);

            assertEq(weth.balanceOf(address(strategy)), 2e18);
            assertEq(dETH.balanceOf(address(strategy)), 2e18);
        }

        vm.warp(block.timestamp + 365 days);

        {
            // 1% interest for dUSD
            assertEq(dai.balanceOf(address(strategy)), 100e18);
            assertApproxEqRel(
                dUSD.balanceOf(address(strategy)),
                approxInterest(100e18, DEFAULT_BASE_INTEREST, 365 days),
                1e8
            );

            // No interest for dTEMPLE
            assertEq(temple.balanceOf(address(strategy)), 50e18);
            assertEq(dTEMPLE.balanceOf(address(strategy)), 50e18);

            // 4% interest for dETH
            assertEq(weth.balanceOf(address(strategy)), 2e18);
            assertApproxEqRel(
                dETH.balanceOf(address(strategy)),
                approxInterest(2e18, ETH_BASE_INTEREST, 365 days), 
                1e8
            );
        }

        // Repay all the principal
        {
            strategy.repay(dai, 100e18);
            strategy.repay(temple, 50e18);
            strategy.repay(weth, 2e18);
        }

        {
            // 1% interest for dUSD
            assertEq(dai.balanceOf(address(strategy)), 0);
            assertApproxEqRel(
                dUSD.balanceOf(address(strategy)),
                approxInterest(100e18, DEFAULT_BASE_INTEREST, 365 days) - 100e18,
                1e10
            );

            // No interest for dTEMPLE
            assertEq(temple.balanceOf(address(strategy)), 0);
            assertEq(dTEMPLE.balanceOf(address(strategy)), 0);

            // 4% interest for dETH
            assertEq(weth.balanceOf(address(strategy)), 0);
            assertApproxEqRel(
                dETH.balanceOf(address(strategy)),
                approxInterest(2e18, ETH_BASE_INTEREST, 365 days) - 2e18, 
                1e10
            );
        }

        // Repay all
        {
            deal(address(dai), address(strategy), 2e18, true);
            deal(address(weth), address(strategy), 1e18, true);

            strategy.repay(dai, dUSD.balanceOf(address(strategy)));
            strategy.repay(weth, dETH.balanceOf(address(strategy)));
        }

        // No debt or credits.
        {
            assertEq(dUSD.balanceOf(address(strategy)), 0);
            assertEq(dTEMPLE.balanceOf(address(strategy)), 0);
            assertEq(dETH.balanceOf(address(strategy)), 0);

            assertEq(trv.strategyTokenCredits(address(strategy), dai), 0);
            assertEq(trv.strategyTokenCredits(address(strategy), temple), 0);
            assertEq(trv.strategyTokenCredits(address(strategy), weth), 0);
        }
    }
}