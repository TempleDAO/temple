pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { TempleTokenBaseStrategy } from "contracts/v2/strategies/TempleTokenBaseStrategy.sol";
import { GnosisStrategy } from "contracts/v2/strategies/GnosisStrategy.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleERC20Token } from "contracts/core/TempleERC20Token.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";
import { TempleCircuitBreakerProxy } from "contracts/v2/circuitBreaker/TempleCircuitBreakerProxy.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/* solhint-disable func-name-mixedcase, not-rely-on-time */
contract TempleTokenBaseStrategyTestBase is TempleTest {
    TempleTokenBaseStrategy public strategy;
    TempleERC20Token public temple;
    TempleDebtToken public dTEMPLE;
    TreasuryPriceIndexOracle public tpiOracle;
    TreasuryReservesVault public trv;

    event TempleMinted(uint256 amount);
    event TempleBurned(uint256 amount);

    function _setUp() internal {
        temple = new TempleERC20Token();

        // 0% interest for dTEMPLE
        dTEMPLE = new TempleDebtToken("Temple Debt TEMPLE", "dTEMPLE", rescuer, executor, 0);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 0.97e18, 0.1e18, 0);
        trv = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        strategy = new TempleTokenBaseStrategy(rescuer, executor, "TempleTokenBaseStrategy", address(trv), address(temple));

        temple.addMinter(address(strategy));

        vm.startPrank(executor);
        dTEMPLE.addMinter(executor);
        vm.stopPrank();
    }

    function expectOnlyTrv() internal {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.OnlyTreasuryReserveVault.selector, unauthorizedUser));
    }
}

contract TempleTokenBaseStrategyTestAdmin is TempleTokenBaseStrategyTestBase {

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.executor(), executor);
        assertEq(strategy.rescuer(), rescuer);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "TempleTokenBaseStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.templeToken()), address(temple));
        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);
    }
}

contract TempleTokenBaseStrategyTestAccess is TempleTokenBaseStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_borrowAndDeposit() public {
        expectElevatedAccess();
        strategy.borrowAndDeposit(0);
    }

    function test_access_trvDeposit() public {
        expectOnlyTrv();
        strategy.trvDeposit(0);
    }

    function test_access_trvWithdraw() public {
        expectOnlyTrv();
        strategy.trvWithdraw(0);
    }
}

contract TempleTokenBaseStrategyTestBorrow is TempleTokenBaseStrategyTestBase {
    uint256 public constant TRV_STARTING_BALANCE = 10e18;
    uint256 public constant BORROW_CEILING = 1.01e18;

    function setUp() public {
        _setUp();

        // Add the new strategy
        vm.startPrank(executor);

        trv.setBorrowToken(temple, address(strategy), 0, 0, address(dTEMPLE));

        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(temple), BORROW_CEILING);
        trv.addStrategy(address(strategy), -123, debtCeiling);

        deal(address(temple), address(trv), TRV_STARTING_BALANCE, true);
        dTEMPLE.addMinter(address(trv));

        vm.stopPrank();
    }

    function test_borrowAndDeposit() public {       
        uint256 amount = 1e18;
        assertEq(temple.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), temple);
        assertEq(available, BORROW_CEILING);

        vm.expectEmit(address(strategy));
        emit TempleBurned(amount);

        vm.startPrank(executor);
        strategy.borrowAndDeposit(amount);

        assertEq(temple.balanceOf(address(strategy)), 0);
        assertEq(temple.balanceOf(address(trv)), TRV_STARTING_BALANCE-amount);
        assertEq(temple.totalSupply(), TRV_STARTING_BALANCE-amount);

        assertEq(dTEMPLE.balanceOf(address(strategy)), amount);
        assertEq(dTEMPLE.balanceOf(address(trv)), 0);

        available = trv.availableForStrategyToBorrow(address(strategy), temple);
        assertEq(available, 0.01e18);

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e18, 0.02e18));
        strategy.borrowAndDeposit(0.02e18);
    }

    function test_latestAssetBalances() public {
        ITempleStrategy.AssetBalance[] memory balances = strategy.latestAssetBalances();
        assertEq(balances.length, 1);
        assertEq(balances[0].asset, address(temple));
        assertEq(balances[0].balance, 0);
    }

    function test_automatedShutdown() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.Unimplemented.selector));
        strategy.automatedShutdown("");
    }
}

contract TempleTokenBaseStrategyTrvWithdraw is TempleTokenBaseStrategyTestBase {
    GnosisStrategy public gnosisStrategy;
    address public gnosisSafeWallet = makeAddr("gnosis");
    uint256 public constant TRV_STARTING_BALANCE = 10e18;
    uint256 public constant TEMPLE_BASE_BORROW_CEILING = 100e18;
    uint256 public constant GNOSIS_BORROW_CEILING = 25e18;

    TempleCircuitBreakerAllUsersPerPeriod public templeCircuitBreaker;
    TempleCircuitBreakerProxy public circuitBreakerProxy;
    bytes32 public constant INTERNAL_STRATEGY = keccak256("INTERNAL_STRATEGY");

    function setUp() public {
        _setUp();

        circuitBreakerProxy = new TempleCircuitBreakerProxy(rescuer, executor);
        gnosisStrategy = new GnosisStrategy(rescuer, executor, "GnosisStrategy", address(trv), gnosisSafeWallet, address(circuitBreakerProxy));

        vm.startPrank(executor);

        trv.setBorrowToken(temple, address(strategy), 0, 0, address(dTEMPLE));
        
        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(temple), TEMPLE_BASE_BORROW_CEILING);
        trv.addStrategy(address(strategy), -123, debtCeiling);

        deal(address(temple), address(trv), TRV_STARTING_BALANCE, true);
        dTEMPLE.addMinter(address(trv));

        debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(temple), GNOSIS_BORROW_CEILING);
        trv.addStrategy(address(gnosisStrategy), -123, debtCeiling);

        // Circuit Breaker
        {
            templeCircuitBreaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 26 hours, 13, 20_000_000e18);
            circuitBreakerProxy.setIdentifierForCaller(address(gnosisStrategy), "INTERNAL_STRATEGY");
            circuitBreakerProxy.setCircuitBreaker(INTERNAL_STRATEGY, address(temple), address(templeCircuitBreaker));
            setExplicitAccess(templeCircuitBreaker, address(circuitBreakerProxy), templeCircuitBreaker.preCheck.selector, true);
        }

        vm.stopPrank();
    }

    function test_trvDeposit() public {
        vm.startPrank(address(trv));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.trvDeposit(0);

        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, address(strategy), 0, 100));
        strategy.trvDeposit(100);

        uint256 amount = 1e18;
        deal(address(temple), address(strategy), amount, true);
        vm.expectEmit(address(strategy));
        emit TempleBurned(amount);
        strategy.trvDeposit(amount);

        // Check the fresh temple was burned
        assertEq(temple.balanceOf(address(strategy)), 0);
        assertEq(temple.totalSupply(), TRV_STARTING_BALANCE);
    }

    function test_trvWithdraw_inIsoloation() public {   
        uint256 borrowAmount = 1e18;
        uint256 withdrawAmount = 0.25e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        vm.startPrank(address(trv));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        strategy.trvWithdraw(0);

        vm.expectEmit(address(strategy));
        emit TempleMinted(withdrawAmount);
        uint256 withdrawn = strategy.trvWithdraw(withdrawAmount);
        assertEq(withdrawn, withdrawAmount);

        assertEq(temple.balanceOf(address(strategy)), 0);
        assertEq(temple.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+withdrawAmount);
        assertEq(temple.totalSupply(), TRV_STARTING_BALANCE-borrowAmount+withdrawAmount);

        assertEq(dTEMPLE.balanceOf(address(strategy)), borrowAmount);
        assertEq(dTEMPLE.balanceOf(address(trv)), 0);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), temple);
        assertApproxEqAbs(available, TEMPLE_BASE_BORROW_CEILING-borrowAmount, 1);
    }

    function test_trvWithdraw_capped() public {   
        uint256 borrowAmount = 1e18;
        uint256 withdrawAmount = 1.25e18;
        vm.startPrank(executor);
        strategy.borrowAndDeposit(borrowAmount);

        // Do a direct TRV withdraw, pranking the TRV.
        // Calling trvWithdraw directly doesn't burn the dUSD (this is done in the 'complex' test)
        vm.startPrank(address(trv));
        vm.expectEmit(address(strategy));
        emit TempleMinted(withdrawAmount); // Not limited by how much was deposited
        uint256 withdrawn = strategy.trvWithdraw(withdrawAmount);

        assertEq(withdrawn, withdrawAmount);
        assertEq(temple.balanceOf(address(strategy)), 0);
        assertEq(temple.balanceOf(address(trv)), TRV_STARTING_BALANCE-borrowAmount+withdrawAmount);
        assertEq(temple.totalSupply(), TRV_STARTING_BALANCE-borrowAmount+withdrawAmount);

        // The TRV is responsible for wiping the debt, so for this test it remains.
        assertEq(dTEMPLE.balanceOf(address(strategy)), borrowAmount);
        assertEq(dTEMPLE.balanceOf(address(trv)), 0);
        assertEq(trv.totalAvailable(temple), TRV_STARTING_BALANCE-borrowAmount+withdrawAmount);
        
        uint256 available = trv.availableForStrategyToBorrow(address(strategy), temple);
        assertEq(available, TEMPLE_BASE_BORROW_CEILING-borrowAmount);
    }

    function test_trvWithdraw_complex() public {
        // First fund the base strategy
        {
            vm.startPrank(executor);

            // Trying to borrow the max ceiling (100e18), but the TRV only has 10e18
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(temple), TEMPLE_BASE_BORROW_CEILING, 10e18));
            strategy.borrowAndDeposit(TEMPLE_BASE_BORROW_CEILING);

            deal(address(temple), address(trv), TEMPLE_BASE_BORROW_CEILING, true);
            strategy.borrowAndDeposit(TEMPLE_BASE_BORROW_CEILING);
        }

        // Check trv and temple base strategy balances
        {
            assertEq(temple.balanceOf(address(strategy)), 0);
            assertEq(temple.balanceOf(address(trv)), 0);
            assertEq(temple.totalSupply(), 0);
            // For Temple, it always shows nothing is available since we always
            // burn/mint on demand.
            // Better than max
            assertEq(trv.totalAvailable(temple), 0);
            assertEq(dTEMPLE.balanceOf(address(strategy)), TEMPLE_BASE_BORROW_CEILING);
            assertEq(dTEMPLE.balanceOf(address(trv)), 0);
        }

        // Check gnosis strategy balances
        {
            assertEq(temple.balanceOf(gnosisSafeWallet), 0);
            assertEq(temple.balanceOf(address(gnosisStrategy)), 0);
            assertEq(dTEMPLE.balanceOf(address(gnosisStrategy)), 0);
        }

        // Check available to borrow
        {
            // base strategy is zero now - it was max borrowed
            uint256 available = trv.availableForStrategyToBorrow(address(strategy), temple);
            assertEq(available, 0); 
            // gnosis strategy has full capacity.
            available = trv.availableForStrategyToBorrow(address(gnosisStrategy), temple);
            assertEq(available, GNOSIS_BORROW_CEILING); 
        }

        // Now have the gnosis strategy borrow some of it
        uint256 borrowAmount = 2e18;
        gnosisStrategy.borrow(temple, borrowAmount);

        // Check available to borrow
        {
            // It was zero, and now there's two freed up - it was paid down when
            // the gnosis strategy borrowed
            uint256 available = trv.availableForStrategyToBorrow(address(strategy), temple);
            assertEq(available, borrowAmount); 
            available = trv.availableForStrategyToBorrow(address(gnosisStrategy), temple);
            assertEq(available, GNOSIS_BORROW_CEILING-borrowAmount); 
        }

        // Check trv and base strategy balances
        {
            assertEq(temple.balanceOf(address(strategy)), 0);
            assertEq(temple.balanceOf(address(trv)), 0);
            assertEq(temple.totalSupply(), borrowAmount);
            assertEq(trv.totalAvailable(temple), 0);
            assertEq(dTEMPLE.balanceOf(address(strategy)), TEMPLE_BASE_BORROW_CEILING-borrowAmount);
            assertEq(dTEMPLE.balanceOf(address(trv)), 0);
        }

        // Check gnosis strategy balances
        {
            assertEq(temple.balanceOf(gnosisSafeWallet), borrowAmount);
            assertEq(temple.balanceOf(address(gnosisStrategy)), 0);
            assertEq(dTEMPLE.balanceOf(address(gnosisStrategy)), borrowAmount);
        }
    }
}