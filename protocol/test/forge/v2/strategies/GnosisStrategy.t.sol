pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { GnosisStrategy } from "contracts/v2/strategies/GnosisStrategy.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

/* solhint-disable func-name-mixedcase */
contract GnosisStrategyTestBase is TempleTest {
    GnosisStrategy public strategy;

    address public gnosisSafeWallet = makeAddr("gnosis");
    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);
    FakeERC20 public frax = new FakeERC20("FRAX", "FRAX", address(0), 0);
    FakeERC20 public usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    uint256 public constant DEFAULT_BASE_INTEREST = 0.01e18;
    TempleDebtToken public dUSD;
    TreasuryReservesVault public trv;

    address[] public reportedAssets = [address(dai), address(frax), address(0)];

    function _setUp() public {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        trv = new TreasuryReservesVault(rescuer, executor, address(temple), address(dai), address(dUSD), 9700);
        strategy = new GnosisStrategy(rescuer, executor, "GnosisStrategy", address(trv), gnosisSafeWallet);

        vm.startPrank(executor);
        dUSD.addMinter(executor);
        vm.stopPrank();
    }
}

contract GnosisStrategyTestAdmin is GnosisStrategyTestBase {

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.executors(executor), true);
        assertEq(strategy.rescuers(rescuer), true);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "GnosisStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.stableToken()), address(dai));
        assertEq(address(strategy.internalDebtToken()), address(dUSD));
        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);

        assertEq(strategy.gnosisSafeWallet(), gnosisSafeWallet);
        address[] memory assets = new address[](0);
        assertEq(strategy.getAssets(), assets);
    }

    function test_recoverToGnosis() public {
        uint256 amount = 100 ether;
        deal(address(dai), address(strategy), amount, true);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(gnosisSafeWallet, address(dai), amount);

        vm.startPrank(executor);
        strategy.recoverToGnosis(address(dai), amount);
        assertEq(dai.balanceOf(gnosisSafeWallet), amount);
        assertEq(dai.balanceOf(address(strategy)), 0);
    }

    function test_automatedShutdown() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.Unimplemented.selector));
        strategy.automatedShutdown("");
    }
}

contract GnosisStrategyTestAccess is GnosisStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_setAssets() public {
        expectElevatedAccess();
        address[] memory assets = new address[](0);
        strategy.setAssets(assets);
    }

    function test_access_borrow() public {
        expectElevatedAccess();
        strategy.borrow(0);
    }

    function test_access_borrowMax() public {
        expectElevatedAccess();
        strategy.borrowMax();
    }

    function test_access_repay() public {
        expectElevatedAccess();
        strategy.repay(0);
    }

    function test_access_repayAll() public {
        expectElevatedAccess();
        strategy.repayAll();
    }

    function test_access_recoverToGnosis() public {
        expectElevatedAccess();
        strategy.recoverToGnosis(address(dai), 0);
    }

    function test_access_automatedShutdown() public {
        expectElevatedAccess();
        strategy.automatedShutdown("");
    }
}

contract GnosisStrategyTestBalances is GnosisStrategyTestBase {
    event AssetsSet(address[] _assets);

    function setUp() public {
        _setUp();
    }

    function test_setAssets() public {
        vm.startPrank(executor);
        
        address[] memory assets = strategy.getAssets();
        assertEq(assets.length, 0);

        vm.expectEmit();
        emit AssetsSet(reportedAssets);
        strategy.setAssets(reportedAssets);

        assets = strategy.getAssets();
        assertEq(assets.length, 3);
        assertEq(assets[0], reportedAssets[0]);
        assertEq(assets[1], reportedAssets[1]);
        assertEq(assets[2], reportedAssets[2]);
    }

    function test_latestAssetBalances_default() public {
        vm.startPrank(executor);
        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 0);

        // Deal some assets
        deal(address(dai), address(strategy), 50, true);
        deal(address(frax), address(strategy), 100, true);
        deal(address(usdc), address(strategy), 200, true);

        assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 0);
    }

    function test_latestAssetBalances() public {
        vm.prank(executor);
        strategy.setAssets(reportedAssets);
        ITempleStrategy.AssetBalance[] memory assetBalances;

        // Assets set, no balances
        {
            assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            for (uint256 i; i < assetBalances.length; ++i) {
                assertEq(assetBalances[i].asset, reportedAssets[i]);
                assertEq(assetBalances[i].balance, 0);
            }
        }

        // Deal some assets to the strategy
        {
            deal(address(dai), address(strategy), 50, true);
            deal(address(frax), address(strategy), 100, true);
            deal(address(usdc), address(strategy), 200, true);
            deal(address(strategy), 0.1e18);
            vm.prank(executor);
            dUSD.mint(address(strategy), 100e18);

            assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, 50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 100);
            assertEq(assetBalances[2].asset, address(0));
            assertEq(assetBalances[2].balance, 0); // The gnosis strategy can't accept eth, it's not payable.
        }

        // Deal some assets to the gnosis
        {
            deal(address(dai), address(gnosisSafeWallet), 50, true);
            deal(address(frax), address(gnosisSafeWallet), 100, true);
            deal(address(usdc), address(gnosisSafeWallet), 200, true);
            deal(address(gnosisSafeWallet), 0.1e18);

            assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, 2*50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 2*100);
            assertEq(assetBalances[2].asset, address(0));
            assertEq(assetBalances[2].balance, 0.1e18);
        }
    }

    function test_checkpointAssetBalances() public {
        vm.prank(executor);
        strategy.setAssets(reportedAssets);

        // Deal some assets
        {
            deal(address(dai), address(strategy), 50, true);
            deal(address(frax), address(strategy), 100, true);
        }

        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
        {
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, 50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 100);
            assertEq(assetBalances[2].asset, address(0));
            assertEq(assetBalances[2].balance, 0); // The gnosis strategy can't accept eth, it's not payable.
        }

        // Checkpoint balances are the same by default
        ITempleStrategy.AssetBalance[] memory checkpointBalances = strategy.checkpointAssetBalances();
        {
            assertEq(assetBalances.length, checkpointBalances.length);
            assertEq(assetBalances[0].asset, checkpointBalances[0].asset);
            assertEq(assetBalances[0].balance, checkpointBalances[0].balance);
            assertEq(assetBalances[1].asset, checkpointBalances[1].asset);
            assertEq(assetBalances[1].balance, checkpointBalances[1].balance);
            assertEq(assetBalances[2].asset, checkpointBalances[2].asset);
            assertEq(assetBalances[2].balance, checkpointBalances[2].balance);
        }
    }

}

contract GnosisStrategyTestBorrowAndRepay is GnosisStrategyTestBase {
    uint256 public constant TRV_STARTING_BALANCE = 10e18;
    uint256 public constant BORROW_CEILING = 1.01e18;

    event Borrow(uint256 amount);
    event Repay(uint256 amount);

    function setUp() public {
        _setUp();

        // Add the new strategy, and setup TRV such that it has stables 
        // to lend and issue dUSD.
        vm.startPrank(executor);
        trv.addNewStrategy(address(strategy), BORROW_CEILING, 0);
        deal(address(dai), address(trv), TRV_STARTING_BALANCE, true);
        dUSD.addMinter(address(trv));
        vm.stopPrank();
    }

    function test_borrow() public {       
        uint256 amount = 1e18;
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, BORROW_CEILING);
        assertEq(ceiling, BORROW_CEILING);

        vm.expectEmit();
        emit Borrow(amount);

        vm.startPrank(executor);
        strategy.borrow(amount);

        assertEq(dai.balanceOf(gnosisSafeWallet), amount);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-amount);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), amount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, amount);
        assertEq(available, 0.01e18);   
        assertEq(ceiling, BORROW_CEILING);     

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e18, 0.02e18));
        strategy.borrow(0.02e18);
    }  

    function test_borrowMax() public {       
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);
        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, BORROW_CEILING);
        assertEq(ceiling, BORROW_CEILING);

        vm.expectEmit();
        emit Borrow(BORROW_CEILING);

        vm.startPrank(executor);
        uint256 borrowed = strategy.borrowMax();
        assertEq(borrowed, BORROW_CEILING);

        assertEq(dai.balanceOf(gnosisSafeWallet), BORROW_CEILING);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-BORROW_CEILING);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), BORROW_CEILING);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, BORROW_CEILING);
        assertEq(available, 0);
        assertEq(ceiling, BORROW_CEILING);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.borrowMax();
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

        vm.expectEmit();
        emit Repay(repayAmount);
        strategy.repay(repayAmount);

        assertEq(dai.balanceOf(gnosisSafeWallet), borrowAmount-repayAmount);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+repayAmount);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount-repayAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, borrowAmount-repayAmount);
        assertEq(available, BORROW_CEILING-borrowAmount+repayAmount);
        assertEq(ceiling, BORROW_CEILING);

        // Only has 0.75 dUSD left, but we can still repay more DAI.
        // This generates a positive
        deal(address(dai), address(strategy), 1e18, true);
        strategy.repay(0.76e18);
        assertEq(dUSD.balanceOf(address(strategy)), 0);
    }

    function test_repayAll() public {       
        uint256 borrowAmount = 1e18;
        vm.startPrank(executor);
        strategy.borrow(borrowAmount);

        // The safe needs to send dai to the strategy before repaying.
        changePrank(gnosisSafeWallet);
        dai.transfer(address(strategy), borrowAmount);
        changePrank(executor);

        vm.expectEmit();
        emit Repay(borrowAmount);
        uint256 repaid = strategy.repayAll();
        assertEq(repaid, borrowAmount);

        assertEq(dai.balanceOf(gnosisSafeWallet), 0);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), 0);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, BORROW_CEILING);
        assertEq(ceiling, BORROW_CEILING);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.repayAll();
    }  
}