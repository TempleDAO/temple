pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { GnosisStrategy } from "contracts/v2/strategies/GnosisStrategy.sol";

import { ITempleDebtToken, TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { StrategyExecutors } from "contracts/v2/access/StrategyExecutors.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

contract GnosisStrategyTestBase is TempleTest {
    GnosisStrategy public strategy;

    address public executor = makeAddr("executor");
    address public gnosisSafeWallet = makeAddr("gnosis");
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);
    FakeERC20 public frax = new FakeERC20("FRAX", "FRAX", address(0), 0);
    FakeERC20 public usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    uint256 public constant defaultBaseInterest = 0.01e18;
    TempleDebtToken public dUSD;
    TreasuryReservesVault public trv;

    address[] public reportedAssets = [address(dai), address(frax), address(0)];

    function _setUp() public {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", gov, defaultBaseInterest);
        trv = new TreasuryReservesVault(gov, address(dai), address(dUSD));
        strategy = new GnosisStrategy(gov, "GnosisStrategy", address(trv), address(dai), address(dUSD), gnosisSafeWallet);

        vm.startPrank(gov);
        dUSD.addMinter(gov);
        strategy.addStrategyExecutor(executor);
        vm.stopPrank();
    }

    function expectOnlyStrategyExecutors() internal {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(StrategyExecutors.OnlyStrategyExecutors.selector, unauthorizedUser));
    }
}

contract GnosisStrategyTestAdmin is GnosisStrategyTestBase {

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.gov(), gov);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "GnosisStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.stableToken()), address(dai));
        assertEq(address(strategy.internalDebtToken()), address(dUSD));
        assertEq(strategy.manualAssetBalanceDeltas(address(dai)), 0);
        assertEq(strategy.currentDebt(), 0);

        assertEq(strategy.gnosisSafeWallet(), gnosisSafeWallet);
        address[] memory assets = new address[](0);
        assertEq(strategy.getAssets(), assets);
    }

    function test_recoverToGnosis() public {
        uint256 amount = 100 ether;
        deal(address(dai), address(strategy), amount, true);

        vm.expectEmit(true, true, true, true);
        emit CommonEventsAndErrors.TokenRecovered(gnosisSafeWallet, address(dai), amount);

        vm.startPrank(executor);
        strategy.recoverToGnosis(address(dai), amount);
        assertEq(dai.balanceOf(gnosisSafeWallet), amount);
        assertEq(dai.balanceOf(address(strategy)), 0);
    }

    function test_automatedShutdown() public {
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.Unimplemented.selector));
        strategy.automatedShutdown();
    }
}

contract GnosisStrategyTestAccess is GnosisStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_setAssets() public {
        expectOnlyStrategyExecutors();
        address[] memory assets = new address[](0);
        strategy.setAssets(assets);
    }

    function test_access_borrow() public {
        expectOnlyStrategyExecutors();
        strategy.borrow(0);
    }

    function test_access_borrowMax() public {
        expectOnlyStrategyExecutors();
        strategy.borrowMax();
    }

    function test_access_repay() public {
        expectOnlyStrategyExecutors();
        strategy.repay(0);
    }

    function test_access_repayAll() public {
        expectOnlyStrategyExecutors();
        strategy.repayAll();
    }

    function test_access_recoverToGnosis() public {
        expectOnlyStrategyExecutors();
        strategy.recoverToGnosis(address(dai), 0);
    }
}

contract GnosisStrategyTestBalances is GnosisStrategyTestBase {
    event AssetsSet(address[] _assets);

    function setUp() public {
        _setUp();
    }

    function test_currentDebt() public {
        vm.startPrank(gov);
        dUSD.mint(address(strategy), 100e18);
        assertEq(strategy.currentDebt(), 100e18);
        dUSD.burn(address(strategy), 100e18);
        assertEq(strategy.currentDebt(), 0);
    }

    function test_setAssets() public {
        vm.startPrank(executor);
        
        address[] memory assets = strategy.getAssets();
        assertEq(assets.length, 0);

        vm.expectEmit(true, true, true, true);
        emit AssetsSet(reportedAssets);
        strategy.setAssets(reportedAssets);

        assets = strategy.getAssets();
        assertEq(assets.length, 3);
        assertEq(assets[0], reportedAssets[0]);
        assertEq(assets[1], reportedAssets[1]);
        assertEq(assets[2], reportedAssets[2]);
    }

    function test_latestAssetBalances_default() public {
        vm.startPrank(gov);
        (ITempleStrategy.AssetBalance[] memory assetBalances, uint256 debt) = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 0);
        assertEq(debt, 0);

        // Deal some assets
        deal(address(dai), address(strategy), 50, true);
        deal(address(frax), address(strategy), 100, true);
        deal(address(usdc), address(strategy), 200, true);
        dUSD.mint(address(strategy), 100e18);

        (assetBalances, debt) = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 0);
        assertEq(debt, 100e18);
    }

    function test_latestAssetBalances() public {
        vm.prank(executor);
        strategy.setAssets(reportedAssets);
        ITempleStrategy.AssetBalance[] memory assetBalances;
        uint256 debt;

        // Assets set, no balances
        {
            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            for (uint256 i; i < assetBalances.length; ++i) {
                assertEq(assetBalances[i].asset, reportedAssets[i]);
                assertEq(assetBalances[i].balance, 0);
            }
            assertEq(debt, 0);
        }

        // Deal some assets to the strategy
        {
            deal(address(dai), address(strategy), 50, true);
            deal(address(frax), address(strategy), 100, true);
            deal(address(usdc), address(strategy), 200, true);
            deal(address(strategy), 0.1e18);
            vm.prank(gov);
            dUSD.mint(address(strategy), 100e18);

            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, 50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 100);
            assertEq(assetBalances[2].asset, address(0));
            assertEq(assetBalances[2].balance, 0); // The gnosis strategy can't accept eth, it's not payable.
            assertEq(debt, 100e18);
        }

        // Deal some assets to the gnosis
        {
            deal(address(dai), address(gnosisSafeWallet), 50, true);
            deal(address(frax), address(gnosisSafeWallet), 100, true);
            deal(address(usdc), address(gnosisSafeWallet), 200, true);
            deal(address(gnosisSafeWallet), 0.1e18);

            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, 2*50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 2*100);
            assertEq(assetBalances[2].asset, address(0));
            assertEq(assetBalances[2].balance, 0.1e18);
            assertEq(debt, 100e18);
        }

        // Add some manual balance deltas
        {

            ITempleStrategy.AssetBalanceDelta[] memory deltas = new ITempleStrategy.AssetBalanceDelta[](3);
            deltas[0] = ITempleStrategy.AssetBalanceDelta(address(frax), 50);
            deltas[1] = ITempleStrategy.AssetBalanceDelta(address(dai), -50);
            deltas[2] = ITempleStrategy.AssetBalanceDelta(address(usdc), 1000);
            deltas[2] = ITempleStrategy.AssetBalanceDelta(address(0), 2000);
            vm.prank(executor);
            strategy.setManualAssetBalanceDeltas(deltas);

            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, 2*50-50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 2*100+50);
            assertEq(assetBalances[2].asset, address(0));
            assertEq(assetBalances[2].balance, 0.1e18+2000);
            assertEq(debt, 100e18);
        }
    }
}

contract GnosisStrategyTestBorrowAndRepay is GnosisStrategyTestBase {
    uint256 public constant trvStartingBalance = 10e18;
    uint256 public constant borrowCeiling = 1.01e18;

    event Borrow(uint256 amount);
    event Repay(uint256 amount);

    function setUp() public {
        _setUp();

        // Add the new strategy, and setup TRV such that it has stables 
        // to lend and issue dUSD.
        vm.startPrank(gov);
        trv.addNewStrategy(address(strategy), borrowCeiling, 0);
        deal(address(dai), address(trv), trvStartingBalance, true);
        dUSD.addMinter(address(trv));
        vm.stopPrank();
    }

    function test_borrow() public {       
        uint256 amount = 1e18;
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance);
        assertEq(strategy.availableToBorrow(), borrowCeiling);

        vm.expectEmit(true, true, true, true);
        emit Borrow(amount);

        vm.startPrank(executor);
        strategy.borrow(amount);

        assertEq(dai.balanceOf(gnosisSafeWallet), amount);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-amount);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), amount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertEq(strategy.availableToBorrow(), 0.01e18);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e18, 0.02e18));
        strategy.borrow(0.02e18);
    }  

    function test_borrowMax() public {       
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance);
        assertEq(strategy.availableToBorrow(), borrowCeiling);

        vm.expectEmit(true, true, true, true);
        emit Borrow(borrowCeiling);

        vm.startPrank(executor);
        uint256 borrowed = strategy.borrowMax();
        assertEq(borrowed, borrowCeiling);

        assertEq(dai.balanceOf(gnosisSafeWallet), borrowCeiling);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-borrowCeiling);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), borrowCeiling);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertEq(strategy.availableToBorrow(), 0);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0, 0.02e18));
        strategy.borrow(0.02e18);
    }  

    function test_repay() public {       
        uint256 borrowAmount = 1e18;
        uint256 repayAmount = 0.25e18;
        vm.startPrank(executor);
        strategy.borrow(borrowAmount);

        vm.expectRevert("ERC20: transfer amount exceeds balance");
        strategy.repay(repayAmount);

        // The safe needs to send dai to the strategy before repaying.
        changePrank(gnosisSafeWallet);
        dai.transfer(address(strategy), repayAmount);
        changePrank(executor);

        vm.expectEmit(true, true, true, true);
        emit Repay(repayAmount);
        strategy.repay(repayAmount);      

        assertEq(dai.balanceOf(gnosisSafeWallet), borrowAmount-repayAmount);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-borrowAmount+repayAmount);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount-repayAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertEq(strategy.availableToBorrow(), borrowCeiling-borrowAmount+repayAmount);

        vm.expectRevert(abi.encodeWithSelector(ITempleDebtToken.BurnExceedsBalance.selector, 0.75e18, 0.76e18));
        strategy.repay(0.76e18);
    }

    function test_repayAll() public {       
        uint256 borrowAmount = 1e18;
        vm.startPrank(executor);
        strategy.borrow(borrowAmount);

        // The safe needs to send dai to the strategy before repaying.
        changePrank(gnosisSafeWallet);
        dai.transfer(address(strategy), borrowAmount);
        changePrank(executor);

        vm.expectEmit(true, true, true, true);
        emit Repay(borrowAmount);
        uint256 repaid = strategy.repayAll();
        assertEq(repaid, borrowAmount);

        assertEq(dai.balanceOf(gnosisSafeWallet), 0);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), 0);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        assertEq(strategy.availableToBorrow(), borrowCeiling);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.repayAll();
    }  
}