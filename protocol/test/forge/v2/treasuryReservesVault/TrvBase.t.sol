pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { TempleTest } from "../../TempleTest.sol";
import { ITempleDebtToken, TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { TreasuryReservesVault, ITreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { MockStrategy } from "../strategies/MockStrategy.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { stdError } from "forge-std/StdError.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TreasuryReservesVaultTestBase is TempleTest {
    MockStrategy public strategy;
    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);
    FakeERC20 public weth = new FakeERC20("WETH", "WETH", address(0), 0);

    TempleDebtToken public dTEMPLE;
    TempleDebtToken public dUSD;
    TempleDebtToken public dETH;

    TreasuryPriceIndexOracle public tpiOracle;
    TreasuryReservesVault public trv;

    uint96 public constant DSR_INTEREST = 0.01e18;
    uint96 public constant ETH_INTEREST = 0.04e18;

    address[] public reportedAssets = [address(dai), address(weth)];

    function _setUp() internal {
        dUSD = new TempleDebtToken("Temple Debt USD", "dUSD", rescuer, executor, DSR_INTEREST);
        dTEMPLE = new TempleDebtToken("Temple Debt TEMPLE", "dTEMPLE", rescuer, executor, 0);
        dETH = new TempleDebtToken("Temple Debt ETH", "dETH", rescuer, executor, ETH_INTEREST);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 0.97e18, 0.1e18, 0);
        trv = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        
        strategy = new MockStrategy(rescuer, executor, "MockStrategy", address(trv), address(dai), address(weth), address(temple), reportedAssets);

        vm.startPrank(executor);
        dUSD.addMinter(address(trv));
        dTEMPLE.addMinter(address(trv));
        dETH.addMinter(address(trv));
        vm.stopPrank();
    }
}

contract TreasuryReservesVaultTestAccess is TreasuryReservesVaultTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_setBorrowToken() public {
        expectElevatedAccess();
        trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
    }
    
    function test_access_removeBorrowToken() public {
        expectElevatedAccess();
        trv.removeBorrowToken(dai);
    }
    
    function test_access_setTpiOracle() public {
        expectElevatedAccess();
        trv.setTpiOracle(address(tpiOracle));
    }
    
    function test_access_setGlobalPaused() public {
        expectElevatedAccess();
        trv.setGlobalPaused(true, true);
    }
    
    function test_access_addStrategy() public {
        expectElevatedAccess();
        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](0);
        trv.addStrategy(address(strategy), 100, debtCeiling);
    }
        
    function test_access_updateStrategyEnabledBorrowTokens() public {
        expectElevatedAccess();
        IERC20[] memory tokens = new IERC20[](0);
        trv.updateStrategyEnabledBorrowTokens(address(strategy), tokens, tokens);
    }
    
    function test_access_setStrategyPaused() public {
        expectElevatedAccess();
        trv.setStrategyPaused(address(strategy), true, true);
    }
    
    function test_access_setStrategyDebtCeiling() public {
        expectElevatedAccess();
        trv.setStrategyDebtCeiling(address(strategy), dai, 123);
    }
    
    function test_access_setStrategyUnderperformingThreshold() public {
        expectElevatedAccess();
        trv.setStrategyUnderperformingThreshold(address(strategy), 123);
    }
    
    function test_access_setStrategyIsShuttingDown() public {
        expectElevatedAccess();
        trv.setStrategyIsShuttingDown(address(strategy), true);
    }
    
    function test_access_shutdown() public {
        expectElevatedAccess();
        trv.shutdown(address(strategy));

        // Access is ok for both the executor and the strategy
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
        trv.shutdown(address(strategy));

        vm.startPrank(address(strategy));
        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
        trv.shutdown(address(strategy));
    }
    
    function test_access_recoverToken() public {
        expectElevatedAccess();
        trv.recoverToken(address(dai), alice, 100);
    }
}

contract TreasuryReservesVaultTestAdmin is TreasuryReservesVaultTestBase {
    event GlobalPausedSet(bool borrow, bool repay);
    event StrategyPausedSet(address indexed strategy, bool borrow, bool repay);

    event StrategyAdded(address indexed strategy, int256 underperformingEquityThreshold);
    event DebtCeilingUpdated(address indexed strategy, address indexed token, uint256 oldDebtCeiling, uint256 newDebtCeiling);
    event UnderperformingEquityThresholdUpdated(address indexed strategy, int256 oldThreshold, int256 newThreshold);

    event BorrowTokenSet(address indexed token, address baseStrategy, uint256 baseStrategyWithdrawalBuffer, uint256 baseStrategyDepositThreshold, address dToken);
    event BorrowTokenRemoved(address indexed token);

    event TpiOracleSet(address indexed tpiOracle);

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(trv.apiVersion(), "1.0.0");
        address[] memory strategiesList = trv.strategiesList();
        assertEq(strategiesList.length, 0);
        address[] memory tokensList = trv.borrowTokensList();
        assertEq(tokensList.length, 0);
        assertEq(trv.globalBorrowPaused(), false);
        assertEq(trv.globalRepaysPaused(), false);
        assertEq(address(trv.tpiOracle()), address(tpiOracle));
        assertEq(trv.treasuryPriceIndex(), 0.97e18);
    }

    function test_setBorrowToken() public {
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        trv.setBorrowToken(IERC20(address(0)), address(0), 0, 0, address(0));

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        trv.setBorrowToken(dai, address(0), 0, 0, address(0));

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        trv.setBorrowToken(dai, address(0), 100, 99, address(dUSD));

        // Base strategy left unset
        vm.expectEmit(address(trv));
        emit BorrowTokenSet(address(dai), address(0), 100, 101, address(dUSD));
        trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));

        address[] memory tokensList = trv.borrowTokensList();
        assertEq(tokensList.length, 1);
        assertEq(tokensList[0], address(dai));

        (
            ITempleBaseStrategy baseStrategy,
            uint256 baseStrategyWithdrawalBuffer,
            uint256 baseStrategyDepositThreshold,
            ITempleDebtToken dToken
        ) = trv.borrowTokens(dai);
        assertEq(address(baseStrategy), address(0));
        assertEq(baseStrategyWithdrawalBuffer, 100);
        assertEq(baseStrategyDepositThreshold, 101);
        assertEq(address(dToken), address(dUSD));

        // Resetting the same token is OK - it just updates the config.
        {
            // Base strategy set to something
            trv.setBorrowToken(dai, bob, 0, 0, address(dUSD));
            
            tokensList = trv.borrowTokensList();
            assertEq(tokensList.length, 1);
            assertEq(tokensList[0], address(dai));

            (baseStrategy, baseStrategyWithdrawalBuffer, baseStrategyDepositThreshold, dToken) = trv.borrowTokens(dai);
            assertEq(address(baseStrategy), bob);
            assertEq(baseStrategyWithdrawalBuffer, 0);
            assertEq(baseStrategyDepositThreshold, 0);
            assertEq(address(dToken), address(dUSD));
        }
    }

    function test_removeBorrowToken() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
        trv.removeBorrowToken(dai);

        trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));

        address[] memory tokensList = trv.borrowTokensList();
        assertEq(tokensList.length, 1);

        vm.expectEmit(address(trv));
        emit BorrowTokenRemoved(address(dai));
        trv.removeBorrowToken(dai);

        tokensList = trv.borrowTokensList();
        assertEq(tokensList.length, 0);
        
        (
            ITempleBaseStrategy baseStrategy,
            uint256 baseStrategyWithdrawalBuffer,
            uint256 baseStrategyDepositThreshold,
            ITempleDebtToken dToken
        ) = trv.borrowTokens(dai);
        assertEq(address(baseStrategy), address(0));
        assertEq(baseStrategyWithdrawalBuffer, 0);
        assertEq(baseStrategyDepositThreshold, 0);
        assertEq(address(dToken), address(0));
    }

    function test_setTpiOracle() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        trv.setTpiOracle(address(0));
        
        // An oracle with a TPI=0 fails
        TreasuryPriceIndexOracle newTpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 0, 0.1e18, 0);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        trv.setTpiOracle(address(newTpiOracle));

        // Not an oracle fails
        vm.expectRevert();
        trv.setTpiOracle(address(bob));

        // Success
        newTpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 1.23e18, 0.1e18, 0);
        vm.expectEmit(address(trv));
        emit TpiOracleSet(address(newTpiOracle));
        trv.setTpiOracle(address(newTpiOracle));

        assertEq(address(trv.tpiOracle()), address(newTpiOracle));
        assertEq(trv.treasuryPriceIndex(), 1.23e18);
    }

    function test_setGlobalPaused() public {
        vm.startPrank(executor);
        vm.expectEmit(address(trv));
        emit GlobalPausedSet(true, true);
        trv.setGlobalPaused(true, true);
        assertEq(trv.globalBorrowPaused(), true);
        assertEq(trv.globalRepaysPaused(), true);
    }

    function test_addStrategy() public {
        vm.startPrank(executor);

        {
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](2);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 500);
            debtCeiling[1] = ITempleStrategy.AssetBalance(address(weth), 123);

            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.addStrategy(address(strategy), -100, debtCeiling);
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
            trv.setBorrowToken(weth, address(0), 999, 1000, address(dETH));
        }

        {
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](2);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 500);
            debtCeiling[1] = ITempleStrategy.AssetBalance(address(weth), 123);

            vm.expectEmit(address(trv));
            emit StrategyAdded(address(strategy), -100);

            vm.expectEmit(address(trv));
            emit DebtCeilingUpdated(address(strategy), address(dai), 0, 500);

            vm.expectEmit(address(trv));
            emit DebtCeilingUpdated(address(strategy), address(weth), 0, 123);

            trv.addStrategy(address(strategy), -100, debtCeiling);

            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.AlreadyEnabled.selector));
            trv.addStrategy(address(strategy), -100, debtCeiling);
        }

        address[] memory strategiesList = trv.strategiesList();
        assertEq(strategiesList.length, 1);
        assertEq(strategiesList[0], address(strategy));

        {
            (
                bool borrowPaused,
                bool repaysPaused,
                bool isShuttingDown,
                int256 underperformingEquityThreshold
            ) = trv.strategies(address(strategy));
            assertEq(borrowPaused, false);
            assertEq(repaysPaused, false);
            assertEq(isShuttingDown, false);
            assertEq(underperformingEquityThreshold, -100);
        }

        {
            (
                string memory name,
                string memory version,
                bool borrowPaused,
                bool repaysPaused,
                bool isShuttingDown,
                int256 underperformingEquityThreshold,
                ITempleStrategy.AssetBalance[] memory debtCeiling
            ) = trv.strategyDetails(address(strategy));
            assertEq(name, "MockStrategy");
            assertEq(version, "X.0.0");
            assertEq(borrowPaused, false);
            assertEq(repaysPaused, false);
            assertEq(isShuttingDown, false);
            assertEq(underperformingEquityThreshold, -100);

            (,,,,,, debtCeiling) = trv.strategyDetails(address(strategy));
            assertEq(debtCeiling.length, 2);
            assertEq(debtCeiling[0].asset, address(dai));
            assertEq(debtCeiling[0].balance, 500);
            assertEq(debtCeiling[1].asset, address(weth));
            assertEq(debtCeiling[1].balance, 123);
        }

        {
            assertEq(trv.strategyEnabledBorrowTokens(address(strategy), dai), true);
            assertEq(trv.strategyEnabledBorrowTokens(address(strategy), weth), true);
            assertEq(trv.strategyEnabledBorrowTokens(address(strategy), temple), false);
        }
    }

    function test_updateStrategyEnabledBorrowTokens() public {
        vm.startPrank(executor);

        IERC20[] memory enableBorrowTokens = new IERC20[](1);
        enableBorrowTokens[0] = temple;
        IERC20[] memory disableBorrowTokens = new IERC20[](1);
        disableBorrowTokens[0] = weth;

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
        trv.updateStrategyEnabledBorrowTokens(address(strategy), enableBorrowTokens, disableBorrowTokens);

        {
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
            trv.setBorrowToken(weth, address(0), 999, 1000, address(dETH));

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](2);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 500);
            debtCeiling[1] = ITempleStrategy.AssetBalance(address(weth), 123);
            trv.addStrategy(address(strategy), -100, debtCeiling);
        }

        // temple hasn't been added as a borrow token yet.
        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
        trv.updateStrategyEnabledBorrowTokens(address(strategy), enableBorrowTokens, disableBorrowTokens);
        trv.setBorrowToken(temple, address(0), 100, 101, address(dTEMPLE));

        enableBorrowTokens = new IERC20[](2);
        enableBorrowTokens[0] = temple;
        enableBorrowTokens[1] = weth;
        trv.updateStrategyEnabledBorrowTokens(address(strategy), enableBorrowTokens, disableBorrowTokens);

        {
            assertEq(trv.strategyEnabledBorrowTokens(address(strategy), dai), true);
            assertEq(trv.strategyEnabledBorrowTokens(address(strategy), temple), true);
            assertEq(trv.strategyEnabledBorrowTokens(address(strategy), weth), false);
        }

        enableBorrowTokens = new IERC20[](0);
        disableBorrowTokens = new IERC20[](3);
        disableBorrowTokens[0] = temple;
        disableBorrowTokens[1] = weth;
        disableBorrowTokens[2] = dai;
        trv.updateStrategyEnabledBorrowTokens(address(strategy), enableBorrowTokens, disableBorrowTokens);

        {
            assertEq(trv.strategyEnabledBorrowTokens(address(strategy), dai), false);
            assertEq(trv.strategyEnabledBorrowTokens(address(strategy), temple), false);
            assertEq(trv.strategyEnabledBorrowTokens(address(strategy), weth), false);
        }
    }

    function test_addStrategy_overflow() public {
        vm.startPrank(executor);

        trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));

        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), type(uint256).max - 10e18);
        trv.addStrategy(address(strategy), 0, debtCeiling);

        // Repay so there's a credit
        deal(address(dai), address(strategy), 5, true);
        strategy.repay(dai, 5);
        assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), type(uint256).max - 10e18 + 5);

        // Shutdown the strategy (the credits don't get cleared)
        trv.setStrategyIsShuttingDown(address(strategy), true);
        trv.shutdown(address(strategy));

        // Add the strategy again - still doesn't overflow
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), type(uint256).max - 1);
        trv.addStrategy(address(strategy), 0, debtCeiling);
        assertEq(trv.availableForStrategyToBorrow(address(strategy), dai), type(uint256).max - 1);
    }

    function test_setStrategyPaused() public {
        vm.startPrank(executor);

        // Strategy needs to exist
        {
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.setStrategyPaused(address(strategy), true, true);
            
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 500);
            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            trv.addStrategy(address(strategy), 100, debtCeiling);
        }

        vm.expectEmit(address(trv));
        emit StrategyPausedSet(address(strategy), true, true);
        trv.setStrategyPaused(address(strategy), true, true);

        (
            bool borrowPaused,
            bool repaysPaused,
            bool isShuttingDown,
            int256 underperformingEquityThreshold
        ) = trv.strategies(address(strategy));
        assertEq(borrowPaused, true);
        assertEq(repaysPaused, true);
        assertEq(isShuttingDown, false);
        assertEq(underperformingEquityThreshold, 100);
    }

    function test_setStrategyDebtCeiling() public {
        vm.startPrank(executor);
        // Borrow token needs to exist
        {
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.setStrategyDebtCeiling(address(strategy), dai, 123);
            
            trv.setBorrowToken(dai, address(0), 100, 101, address(dUSD));
        }

        // Strategy needs to exist
        {
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.setStrategyDebtCeiling(address(strategy), dai, 123);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 500);
            trv.addStrategy(address(strategy), 100, debtCeiling);
        }

        vm.expectEmit(address(trv));
        emit DebtCeilingUpdated(address(strategy), address(dai), 500, 123);
        trv.setStrategyDebtCeiling(address(strategy), dai, 123);

        assertEq(trv.strategyDebtCeiling(address(strategy), dai), 123);

        // While we're at it, check strategyDebtCeiling edge conditions
        {
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.strategyDebtCeiling(address(alice), dai);
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.strategyDebtCeiling(address(strategy), weth);
        }

        // disable the borrow token and it should now revert
        {
            IERC20[] memory disableBorrowTokens = new IERC20[](1);
            disableBorrowTokens[0] = dai;
            trv.updateStrategyEnabledBorrowTokens(address(strategy), new IERC20[](0), disableBorrowTokens);
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.setStrategyDebtCeiling(address(strategy), dai, 123);

            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.BorrowTokenNotEnabled.selector));
            trv.strategyDebtCeiling(address(strategy), dai);
        }
    }

    function test_setStrategyDebtCeiling_overflow() public {
        vm.startPrank(executor);

        trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));

        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), type(uint256).max - 10e18);
        trv.addStrategy(address(strategy), 0, debtCeiling);

        // Repay so there's a credit
        deal(address(dai), address(strategy), 5, true);
        strategy.repay(dai, 5);

        vm.expectRevert(stdError.arithmeticError);
        trv.setStrategyDebtCeiling(address(strategy), dai, type(uint256).max - 1);
    }

    function test_setStrategyUnderperformingThreshold() public {
        vm.startPrank(executor);
        // Strategy needs to exist
        {
            vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.StrategyNotEnabled.selector));
            trv.setStrategyUnderperformingThreshold(address(strategy), 123);

            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](1);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), 500);
            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            trv.addStrategy(address(strategy), 100, debtCeiling);
        }

        vm.expectEmit(address(trv));
        emit UnderperformingEquityThresholdUpdated(address(strategy), 100, 123);
        trv.setStrategyUnderperformingThreshold(address(strategy), 123);

        (
            bool borrowPaused,
            bool repaysPaused,
            bool isShuttingDown,
            int256 underperformingEquityThreshold
        ) = trv.strategies(address(strategy));
        assertEq(borrowPaused, false);
        assertEq(repaysPaused, false);
        assertEq(isShuttingDown, false);
        assertEq(underperformingEquityThreshold, 123);
    }

    function test_recoverToken() public {
        uint256 amount = 100 ether;
        deal(address(dai), address(trv), amount, true);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, address(dai), amount);

        vm.startPrank(executor);
        trv.recoverToken(address(dai), alice, amount);
        assertEq(dai.balanceOf(alice), amount);
        assertEq(dai.balanceOf(address(trv)), 0);
    }
}
