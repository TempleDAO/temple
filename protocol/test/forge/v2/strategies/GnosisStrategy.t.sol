pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { GnosisStrategy } from "contracts/v2/strategies/GnosisStrategy.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";
import { TempleCircuitBreakerProxy } from "contracts/v2/circuitBreaker/TempleCircuitBreakerProxy.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/* solhint-disable func-name-mixedcase */
contract GnosisStrategyTestBase is TempleTest {
    GnosisStrategy public strategy;

    address public gnosisSafeWallet = makeAddr("gnosis");
    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);
    FakeERC20 public weth = new FakeERC20("WETH", "WETH", address(0), 0);
    FakeERC20 public usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    uint96 public constant DEFAULT_BASE_INTEREST = 0.01e18;
    TempleDebtToken public dUSD;
    TreasuryPriceIndexOracle public tpiOracle;
    TreasuryReservesVault public trv;

    address[] public reportedAssets = [address(dai), address(weth), address(0)];

    TempleCircuitBreakerAllUsersPerPeriod public daiCircuitBreaker;
    TempleCircuitBreakerProxy public circuitBreakerProxy;
    bytes32 public constant INTERNAL_STRATEGY = keccak256("INTERNAL_STRATEGY");

    function _setUp() internal {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 0.97e18, 0.1e18, 0);
        trv = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        circuitBreakerProxy = new TempleCircuitBreakerProxy(rescuer, executor);
        strategy = new GnosisStrategy(rescuer, executor, "GnosisStrategy", address(trv), gnosisSafeWallet, address(circuitBreakerProxy));

        vm.startPrank(executor);
        dUSD.addMinter(executor);

        // Circuit Breaker
        {
            daiCircuitBreaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 26 hours, 13, 1_000_000e18);
            circuitBreakerProxy.setIdentifierForCaller(address(strategy), "INTERNAL_STRATEGY");
            circuitBreakerProxy.setCircuitBreaker(INTERNAL_STRATEGY, address(dai), address(daiCircuitBreaker));
            setExplicitAccess(daiCircuitBreaker, address(circuitBreakerProxy), daiCircuitBreaker.preCheck.selector, true);
        }

        vm.stopPrank();
    }
}

contract GnosisStrategyTestAdmin is GnosisStrategyTestBase {

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.executor(), executor);
        assertEq(strategy.rescuer(), rescuer);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "GnosisStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
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
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.Unimplemented.selector));
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
        strategy.borrow(dai, 0);
    }

    function test_access_borrowMax() public {
        expectElevatedAccess();
        strategy.borrowMax(dai);
    }

    function test_access_repay() public {
        expectElevatedAccess();
        strategy.repay(dai, 0);
    }

    function test_access_repayAll() public {
        expectElevatedAccess();
        strategy.repayAll(dai);
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
        deal(address(weth), address(strategy), 100, true);
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
            deal(address(weth), address(strategy), 100, true);
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
            deal(address(weth), address(gnosisSafeWallet), 100, true);
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
            deal(address(weth), address(strategy), 100, true);
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

    event Borrow(address indexed token, uint256 amount);
    event Repay(address indexed token, uint256 amount);

    function setUp() public {
        _setUp();

        // Add the new strategy, and setup TRV such that it has stables 
        // to lend and issue dUSD.
        vm.startPrank(executor);

        trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));

        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), BORROW_CEILING);
        trv.addStrategy(address(strategy), -123, debtCeiling);

        deal(address(dai), address(trv), TRV_STARTING_BALANCE, true);
        dUSD.addMinter(address(trv));
        vm.stopPrank();
    }

    function test_borrow_failCircuitBreaker() public {
        uint128 amount = 1e18;
        vm.startPrank(executor);
        daiCircuitBreaker.updateCap(amount-1);
        vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, amount, amount-1));
        strategy.borrow(dai, amount);
    }

    function test_borrow() public {       
        uint256 amount = 1e18;
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, BORROW_CEILING);

        vm.expectEmit();
        emit Borrow(address(dai), amount);

        vm.startPrank(executor);
        strategy.borrow(dai, amount);

        assertEq(dai.balanceOf(gnosisSafeWallet), amount);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-amount);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), amount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, 0.01e18);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e18, 0.02e18));
        strategy.borrow(dai, 0.02e18);
    }  

    function test_borrowMax_failCircuitBreaker() public {
        vm.startPrank(executor);
        daiCircuitBreaker.updateCap(uint128(BORROW_CEILING) - 1);
        vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, BORROW_CEILING, BORROW_CEILING-1));
        strategy.borrowMax(dai);
    }

    function test_borrowMax() public {       
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, BORROW_CEILING);

        vm.startPrank(executor);

        vm.expectEmit();
        emit Borrow(address(dai), BORROW_CEILING);

        uint256 borrowed = strategy.borrowMax(dai);
        assertEq(borrowed, BORROW_CEILING);

        assertEq(dai.balanceOf(gnosisSafeWallet), BORROW_CEILING);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-BORROW_CEILING);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), BORROW_CEILING);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, 0);
        
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.borrowMax(dai);
    }  

    function test_repay() public {
        uint256 borrowAmount = 1e18;
        uint256 repayAmount = 0.25e18;
        vm.startPrank(executor);
        strategy.borrow(dai, borrowAmount);

        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, address(strategy), 0, repayAmount));
        strategy.repay(dai, repayAmount);

        // The safe needs to send dai to the strategy before repaying.
        vm.startPrank(gnosisSafeWallet);
        dai.transfer(address(strategy), repayAmount);
        vm.startPrank(executor);

        vm.expectEmit();
        emit Repay(address(dai), repayAmount);
        strategy.repay(dai, repayAmount);

        assertEq(dai.balanceOf(gnosisSafeWallet), borrowAmount-repayAmount);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+repayAmount);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount-repayAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, BORROW_CEILING-borrowAmount+repayAmount);

        // There shouldn't be any allowance left
        assertEq(dai.allowance(address(strategy), address(trv)), 0);

        // Only has 0.75 dUSD left, but we can still repay more DAI.
        // This generates a positive
        deal(address(dai), address(strategy), 1e18, true);
        strategy.repay(dai, 0.76e18);
        assertEq(dUSD.balanceOf(address(strategy)), 0);
    }

    function test_repayAll() public {       
        uint256 borrowAmount = 1e18;
        vm.startPrank(executor);
        strategy.borrow(dai, borrowAmount);

        // The safe needs to send dai to the strategy before repaying.
        vm.startPrank(gnosisSafeWallet);
        dai.transfer(address(strategy), borrowAmount);
        vm.startPrank(executor);

        vm.expectEmit();
        emit Repay(address(dai), borrowAmount);
        uint256 repaid = strategy.repayAll(dai);
        assertEq(repaid, borrowAmount);

        assertEq(dai.balanceOf(gnosisSafeWallet), 0);
        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        assertEq(dUSD.balanceOf(gnosisSafeWallet), 0);
        assertEq(dUSD.balanceOf(address(strategy)), 0);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, BORROW_CEILING);

        // There shouldn't be any allowance left
        assertEq(dai.allowance(address(strategy), address(trv)), 0);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.repayAll(dai);
    }  
}