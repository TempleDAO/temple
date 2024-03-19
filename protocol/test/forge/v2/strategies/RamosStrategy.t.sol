pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { TempleTest } from "../../TempleTest.sol";

import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { IAuraBooster } from "contracts/interfaces/external/aura/IAuraBooster.sol";
import { IAuraBaseRewardPool } from "contracts/interfaces/external/aura/IAuraBaseRewardPool.sol";
import { IBalancerBptToken } from "contracts/interfaces/external/balancer/IBalancerBptToken.sol";
import { IBalancerVault } from "contracts/interfaces/external/balancer/IBalancerVault.sol";

import { Ramos } from "contracts/amo/Ramos.sol";
import { RamosStrategy } from "contracts/v2/strategies/RamosStrategy.sol";
import { TempleTokenBaseStrategy } from "contracts/v2/strategies/TempleTokenBaseStrategy.sol";
import { TempleERC20Token } from "contracts/core/TempleERC20Token.sol";
import { BalancerPoolHelper } from "contracts/amo/helpers/BalancerPoolHelper.sol";
import { AuraStaking } from "contracts/amo/AuraStaking.sol";
import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { TreasuryPriceIndexOracle } from "contracts/v2/TreasuryPriceIndexOracle.sol";
import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";
import { TempleCircuitBreakerProxy } from "contracts/v2/circuitBreaker/TempleCircuitBreakerProxy.sol";

/* solhint-disable func-name-mixedcase, max-states-count */

contract RamosStrategyTestBase is TempleTest {
    RamosStrategy public strategy;

    Ramos public ramos;
    address public balancerVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address public balancerHelpers = 0x5aDDCCa35b7A0D07C74063c48700C8590E87864E;
    TempleERC20Token public temple = TempleERC20Token(0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7);
    uint64 public templeIndexPool = 0;
    bytes32 public balancerPoolId = 0x8bd4a1e74a27182d23b98c10fd21d4fbb0ed4ba00002000000000000000004ed;
    BalancerPoolHelper public poolHelper;
    AuraStaking public amoStaking;
    IAuraBooster public auraBooster = IAuraBooster(0xA57b8d98dAE62B26Ec3bcC4a365338157060B234);
    IBalancerBptToken public bptToken = IBalancerBptToken(0x8Bd4A1E74A27182D23B98c10Fd21D4FbB0eD4BA0);
    IERC20 public dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 public aura = IERC20(0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF);
    IERC20 public bal = IERC20(0xba100000625a3754423978a60c9317c58a424e3D);

    address public constant MAINNET_AURA_STAKING = 0x70989E7D20C065ce7628C8DdAA240853437953d7;

    uint32 public poolId = 79;
    address public auraStakingDepositToken = 0x0B7C71d61D960F70d89ecaC55DC2B4c1A7b508ee;
    address public auraRewardsToken = 0x13544617b10E1923363c89D902b749bea331AC4E;

    uint96 public constant DEFAULT_BASE_INTEREST = 0.01e18;
    uint256 public constant BORROW_CEILING = 1.01e25;
    TempleDebtToken public dUSD;
    TempleDebtToken public dTEMPLE;
    TreasuryPriceIndexOracle public tpiOracle;
    TreasuryReservesVault public trv;

    TempleTokenBaseStrategy public templeBaseStrategy;

    uint256 public constant TRV_STARTING_BALANCE = 10e25;

    address public feeCollector = makeAddr("feeCollector");
    
    TempleCircuitBreakerAllUsersPerPeriod public templeCircuitBreaker;
    TempleCircuitBreakerAllUsersPerPeriod public daiCircuitBreaker;
    TempleCircuitBreakerProxy public circuitBreakerProxy;
    bytes32 public constant INTERNAL_STRATEGY = keccak256("INTERNAL_STRATEGY");

    function _setUp() internal {
        fork("mainnet", 17300437);

        dUSD = new TempleDebtToken("Temple Debt USD", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        dTEMPLE = new TempleDebtToken("Temple Debt TEMPLE", "dTEMPLE", rescuer, executor, DEFAULT_BASE_INTEREST);
        tpiOracle = new TreasuryPriceIndexOracle(rescuer, executor, 0.97e18, 0.1e18, 0);
        trv = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        templeBaseStrategy = new TempleTokenBaseStrategy(rescuer, executor, "TempleTokenBaseStrategy", address(trv), address(temple));

        poolHelper = new BalancerPoolHelper(
            balancerVault, balancerHelpers, address(temple), 
            address(dai), address(bptToken), 
            address(amoStaking), 
            templeIndexPool, balancerPoolId
        );

        // Construct RAMOS
        {
            address[] memory _rewardTokens = new address[](2);
            _rewardTokens[0] = address(bal);
            _rewardTokens[1] = address(aura);
            amoStaking = new AuraStaking(rescuer, executor, bptToken, auraBooster, _rewardTokens);
            ramos = new Ramos(
                rescuer, executor, balancerVault, 
                address(temple), address(dai), address(bptToken), 
                address(amoStaking), 
                templeIndexPool, balancerPoolId, feeCollector, 200
            );
        }

        // RAMOS setup settings
        vm.startPrank(executor);
        {
            amoStaking.setAuraPoolInfo(poolId, auraStakingDepositToken, auraRewardsToken);
            amoStaking.setRewardsRecipient(executor);
            setExplicitAccess(amoStaking, address(ramos), AuraStaking.depositAndStake.selector, AuraStaking.withdrawAndUnwrap.selector, true);
            
            ramos.setPoolHelper(address(poolHelper));
            ramos.setCoolDown(1800);    // 30 mins
            ramos.setRebalancePercentageBounds(200, 500);
            ramos.setMaxRebalanceAmounts(1e28, 1e28, 1e28); // bpt, temple, stable
        }
        
        // Suck in the BPT from the mainnet AuraStaking address into this testnet one
        {
            startHoax(MAINNET_AURA_STAKING);
            IAuraBaseRewardPool(auraRewardsToken).withdrawAllAndUnwrap(false);
            uint256 bptBalance = bptToken.balanceOf(MAINNET_AURA_STAKING);
            bptToken.transfer(address(ramos), bptBalance);
            vm.startPrank(executor);
            ramos.depositAndStakeBptTokens(bptBalance, true);
        }

        circuitBreakerProxy = new TempleCircuitBreakerProxy(rescuer, executor);

        // solhint-disable-next-line reentrancy
        strategy = new RamosStrategy(rescuer, executor, "RamosStrategy", address(trv), address(ramos), address(temple), address(dai), address(circuitBreakerProxy));
        setExplicitAccess(strategy, address(ramos), RamosStrategy.borrowProtocolToken.selector, RamosStrategy.repayProtocolToken.selector, true);
        setExplicitAccess(strategy, address(ramos), RamosStrategy.borrowQuoteToken.selector, RamosStrategy.repayQuoteToken.selector, true);

        ramos.setTokenVault(address(strategy));
        ramos.setTpiOracle(address(tpiOracle));

        // `templeToken` settings
        {
            address templeTokenOwner = temple.owner();
            startHoax(templeTokenOwner);
            temple.addMinter(address(templeBaseStrategy));
        }

        vm.startPrank(executor);
        dUSD.addMinter(executor);
        dUSD.addMinter(address(trv));
        dTEMPLE.addMinter(address(trv));

        // Circuit Breaker
        {
            templeCircuitBreaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 26 hours, 13, 20_000_000e18);
            daiCircuitBreaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 26 hours, 13, 20_000_000e18);

            circuitBreakerProxy.setIdentifierForCaller(address(strategy), "INTERNAL_STRATEGY");
            circuitBreakerProxy.setCircuitBreaker(INTERNAL_STRATEGY, address(temple), address(templeCircuitBreaker));
            circuitBreakerProxy.setCircuitBreaker(INTERNAL_STRATEGY, address(dai), address(daiCircuitBreaker));

            setExplicitAccess(templeCircuitBreaker, address(circuitBreakerProxy), templeCircuitBreaker.preCheck.selector, true);
            setExplicitAccess(daiCircuitBreaker, address(circuitBreakerProxy), daiCircuitBreaker.preCheck.selector, true);
        }
    }

    function _setupTrv() internal {
        vm.startPrank(executor);

        trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
        trv.setBorrowToken(temple, address(templeBaseStrategy), 0, 0, address(dTEMPLE));

        // Add the new strategy, and setup TRV such that it has stables to lend and issue dUSD.
        ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](2);
        debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), BORROW_CEILING);
        debtCeiling[1] = ITempleStrategy.AssetBalance(address(temple), BORROW_CEILING);
        trv.addStrategy(address(strategy), -123, debtCeiling);

        deal(address(dai), address(trv), TRV_STARTING_BALANCE, true);
        dUSD.addMinter(address(trv));
        // Set the explicit access to RAMOS functions
        setExplicitAccess(ramos, address(strategy), ramos.addLiquidity.selector, ramos.removeLiquidity.selector, true);
        vm.stopPrank();
    }

    struct Balances {
        uint256 bptTotalSupply;
        uint256 ramosBpt;
        uint256 ramosTemple;
        uint256 ramosStable;
        uint256 totalTemple;
        uint256 totalStable;
    }

    function getRamosBalances() internal view returns (
        Balances memory balances
    ) {
        balances.bptTotalSupply = bptToken.getActualSupply();

        if (balances.bptTotalSupply > 0) {
            balances.ramosBpt = amoStaking.stakedBalance() + bptToken.balanceOf(address(amoStaking));

            (balances.totalTemple, balances.totalStable) = poolHelper.getPairBalances();
            balances.ramosTemple = balances.totalTemple * balances.ramosBpt / balances.bptTotalSupply;
            balances.ramosStable = balances.totalStable * balances.ramosBpt / balances.bptTotalSupply;
        }
    }
}

contract RamosStrategyTestAdmin is RamosStrategyTestBase {
    event Shutdown();

    event StrategyRemoved(address indexed strategy);
    event StrategyShutdownCreditAndDebt(address indexed strategy, address indexed token, uint256 outstandingCredit, uint256 outstandingDebt);
    event StrategyCreditAndDebtBalance(address indexed strategy, address indexed token, uint256 credit, uint256 debt);
    event Repay(address indexed strategy, address indexed token, address indexed from, uint256 stablesAmount);
    event LiquidityRemoved(uint256 quoteTokenReceived, uint256 protocolTokenReceived, uint256 bptRemoved);

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.executor(), executor);
        assertEq(strategy.rescuer(), rescuer);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "RamosStrategy");
        assertEq(strategy.strategyVersion(), "1.0.1");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.quoteToken()), address(dai));
        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);

        assertEq(address(strategy.ramos()), address(ramos));
    }

    function test_automatedShutdown() public {
        // Setup the strategy, mint it some dUSD, start the shutdown process
        vm.startPrank(executor);
        {
            setExplicitAccess(ramos, address(strategy), ramos.removeLiquidity.selector, true);

            trv.setBorrowToken(dai, address(0), 0, 0, address(dUSD));
            trv.setBorrowToken(temple, address(0), 0, 0, address(dTEMPLE));
            
            ITempleStrategy.AssetBalance[] memory debtCeiling = new ITempleStrategy.AssetBalance[](2);
            debtCeiling[0] = ITempleStrategy.AssetBalance(address(dai), BORROW_CEILING);
            debtCeiling[1] = ITempleStrategy.AssetBalance(address(temple), 0);
            trv.addStrategy(address(strategy), -123, debtCeiling);

            dUSD.mint(address(strategy), 1_000_000e18);
            trv.setStrategyIsShuttingDown(address(strategy), true);
        }

        // Get the current positions.
        (
            uint256 bptAmountBefore,
            uint256 templeAmountBefore,
            uint256 stableAmountBefore
        ) = ramos.positions();
        assertGt(bptAmountBefore, 1_000_000e18);
        assertGt(templeAmountBefore, 1_000_000e18);
        assertGt(stableAmountBefore, 1_000_000e18);

        bytes memory params = abi.encode(100); // 1% slippage, but it will all be removed in test
        bytes memory shutdownData = strategy.populateShutdownData(params);

        uint256 _stablesRepaid = 5_872_605.221247683473796320e18;
        uint256 _templeRepaid = 5_809_705.521458524907505019e18;
        uint256 _bptRemoved = 11_670_178.797912999066086745e18;

        // Events galore for shutdowns.
        // The strategy first repays any remaining temple & stables
        {
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(temple), address(strategy), _templeRepaid);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(temple), _templeRepaid, 0);
            
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), address(strategy), _stablesRepaid);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), _stablesRepaid - 1_000_000e18, 0);
        }

        vm.expectEmit(address(ramos));
        emit LiquidityRemoved(_stablesRepaid, _templeRepaid, _bptRemoved);

        {
            // The strategy shuts down
            vm.expectEmit(address(strategy));
            emit Shutdown();

            // There's a realised Gain (1mm dUSD)
            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(dai), _stablesRepaid - 1_000_000e18, 0);

            vm.expectEmit(address(trv));
            emit StrategyShutdownCreditAndDebt(address(strategy), address(temple), _templeRepaid, 0);

            vm.expectEmit(address(trv));
            emit StrategyRemoved(address(strategy));
        }

        uint256 trvBalBefore = dai.balanceOf(address(trv));
        strategy.automatedShutdown(shutdownData);
        uint256 trvBalAfter = dai.balanceOf(address(trv));

        (
            uint256 bptAmountAfter,
            uint256 templeAmountAfter,
            uint256 stableAmountAfter
        ) = ramos.positions();
        assertEq(bptAmountAfter, 0);
        assertEq(templeAmountAfter, 0);
        assertEq(stableAmountAfter, 0);
        assertEq(trvBalAfter-trvBalBefore, _stablesRepaid);
    }

    function test_setTreasuryReservesVault() public {
        vm.startPrank(executor);
        TreasuryReservesVault trv2 = new TreasuryReservesVault(rescuer, executor, address(tpiOracle));
        strategy.setTreasuryReservesVault(address(trv2));
        assertEq(address(strategy.treasuryReservesVault()), address(trv2));

        assertEq(dai.allowance(address(strategy), address(trv)), 0);
        assertEq(temple.allowance(address(strategy), address(trv)), 0);
        assertEq(dai.allowance(address(strategy), address(trv2)), type(uint256).max);
        assertEq(temple.allowance(address(strategy), address(trv2)), type(uint256).max);
    }
}

contract RamosStrategyTestAccess is RamosStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_addLiquidity() public {
        uint256 amount = 1e18;
        uint256 slippageBps = 100;  // 1%
        (,,, IBalancerVault.JoinPoolRequest memory requestData) = strategy.proportionalAddLiquidityQuote(amount, slippageBps);
        expectElevatedAccess();
        strategy.addLiquidity(requestData);
    }

    function test_access_removeLiquidity() public {
        uint256 bptOut = 1e18;
        uint256 slippageBps = 100;  // 1%
        (,,,, IBalancerVault.ExitPoolRequest memory requestDataForRemoveLiquidity) = strategy.proportionalRemoveLiquidityQuote(bptOut, slippageBps);
        expectElevatedAccess();
        strategy.removeLiquidity(requestDataForRemoveLiquidity, bptOut);
    }

    function test_access_borrowProtocolToken() public {
        expectElevatedAccess();
        strategy.borrowProtocolToken(0, alice);
    }

    function test_access_borrowQuoteToken() public {
        expectElevatedAccess();
        strategy.borrowQuoteToken(0, alice);
    }

    function test_access_repayProtocolToken() public {
        expectElevatedAccess();
        strategy.repayProtocolToken(0);
    }

    function test_access_repayQuoteToken() public {
        expectElevatedAccess();
        strategy.repayQuoteToken(0);
    }
}

contract RamosStrategyTestVaultFunctions is RamosStrategyTestBase {
    uint256 public constant AMOUNT_BORROW_REPAY = 100e18;
    uint256 public constant TEMPLE_INITIAL_TOTAL_SUPPLY = 17.2400172562265383993664804e25;

    event Borrow(address indexed strategy, address indexed token, address indexed recipient, uint256 amount);
    event Repay(address indexed strategy, address indexed token, address indexed from, uint256 amount);
    event BorrowToken(address indexed token, uint256 amount);
    event RepayToken(address indexed token, uint256 amount);

    function setUp() public {
        _setUp();
        _setupTrv();
    }

    function test_borrowProtocolToken_failCircuitBreaker() public {
        vm.startPrank(executor);
        uint128 amount = 1e18;
        templeCircuitBreaker.updateCap(amount-1);

        vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, amount, amount-1));
        strategy.borrowProtocolToken(amount, alice);
    }

    function test_borrowProtocolToken() public {       
        vm.startPrank(executor);
        // check balance before borrowing temple
        assertEq(temple.balanceOf(address(trv)), 0);
        assertEq(temple.balanceOf(address(ramos)), 0);
        assertEq(temple.totalSupply(), TEMPLE_INITIAL_TOTAL_SUPPLY);
        assertEq(dTEMPLE.balanceOf(address(trv)), 0);
        assertEq(dTEMPLE.balanceOf(address(ramos)), 0);
        assertEq(dTEMPLE.totalSupply(), 0);
        
        vm.expectEmit(address(strategy));
        emit BorrowToken(address(temple), AMOUNT_BORROW_REPAY);
        vm.expectEmit(address(trv));
        emit Borrow(address(strategy), address(temple), address(ramos), AMOUNT_BORROW_REPAY);

        strategy.borrowProtocolToken(AMOUNT_BORROW_REPAY, address(ramos));
        
        // check balance after borrowing temple
        assertEq(temple.balanceOf(address(ramos)), AMOUNT_BORROW_REPAY);
        assertEq(temple.balanceOf(address(trv)), 0);
        assertEq(temple.totalSupply(), TEMPLE_INITIAL_TOTAL_SUPPLY + AMOUNT_BORROW_REPAY);
        assertEq(dTEMPLE.balanceOf(address(trv)), 0);
        assertEq(dTEMPLE.balanceOf(address(ramos)), 0);
        assertEq(dTEMPLE.totalSupply(), AMOUNT_BORROW_REPAY);
    }

    function test_borrowQuoteToken_failCircuitBreaker() public {
        vm.startPrank(executor);
        uint128 amount = 1e18;
        daiCircuitBreaker.updateCap(amount-1);

        vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, amount, amount-1));
        strategy.borrowQuoteToken(amount, alice);
    }

    function test_borrowQuoteToken() public {
        vm.startPrank(executor);
        // check balance before borrowing dai
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);
        assertEq(dai.balanceOf(address(ramos)), 0);
        assertEq(dUSD.balanceOf(address(trv)), 0);
        assertEq(dUSD.balanceOf(address(ramos)), 0);
        assertEq(dUSD.totalSupply(), 0);

        vm.expectEmit(address(strategy));
        emit BorrowToken(address(dai), AMOUNT_BORROW_REPAY);
        vm.expectEmit(address(trv));
        emit Borrow(address(strategy), address(dai), address(ramos), AMOUNT_BORROW_REPAY);

        strategy.borrowQuoteToken(AMOUNT_BORROW_REPAY, address(ramos));      

        // check balance after borrowing dai
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE - AMOUNT_BORROW_REPAY);
        assertEq(dai.balanceOf(address(ramos)), AMOUNT_BORROW_REPAY);
        assertEq(dUSD.balanceOf(address(trv)), 0);
        assertEq(dUSD.balanceOf(address(ramos)), 0);
        assertEq(dUSD.totalSupply(), AMOUNT_BORROW_REPAY);
    }

    function test_repayProtocolToken() public {
        // borrow protocol(temple) trv -> ramos
        test_borrowProtocolToken();
        
        // repay protocol(temple) ramos -> trv
        vm.startPrank(address(ramos));

        vm.expectEmit(address(strategy));
        emit RepayToken(address(temple), AMOUNT_BORROW_REPAY);
        vm.expectEmit(address(trv));
        emit Repay(address(strategy), address(temple), address(strategy), AMOUNT_BORROW_REPAY);

        strategy.repayProtocolToken(AMOUNT_BORROW_REPAY);

        assertEq(temple.balanceOf(address(trv)), 0);
        assertEq(temple.balanceOf(address(ramos)), 0);
        assertEq(temple.totalSupply(), TEMPLE_INITIAL_TOTAL_SUPPLY);
        assertEq(dTEMPLE.balanceOf(address(trv)), 0);
        assertEq(dTEMPLE.balanceOf(address(ramos)), 0);
        assertEq(dTEMPLE.totalSupply(), 0);
    }

    function test_repayQuoteToken() public {
        // borrow quote(dai/dUSD) trv -> ramos
        test_borrowQuoteToken();
        
        // repay quote(dai/dUSD) ramos -> trv
        vm.startPrank(address(ramos));

        vm.expectEmit(address(strategy));
        emit RepayToken(address(dai), AMOUNT_BORROW_REPAY);
        vm.expectEmit(address(trv));
        emit Repay(address(strategy), address(dai), address(strategy), AMOUNT_BORROW_REPAY);

        strategy.repayQuoteToken(AMOUNT_BORROW_REPAY);
        
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);
        assertEq(dai.balanceOf(address(ramos)), 0);
        assertEq(dUSD.balanceOf(address(trv)), 0);
        assertEq(dUSD.balanceOf(address(ramos)), 0);
        assertEq(dUSD.totalSupply(), 0);
    }
}

contract RamosStrategyTestBalances is RamosStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function checkBalance(uint256 expectedDai, uint256 expectedTemple) internal {
        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, address(dai));
        assertEq(assetBalances[0].balance, expectedDai);
        assertEq(assetBalances[1].asset, address(temple));
        assertEq(assetBalances[1].balance, expectedTemple);
    }

    function test_latestAssetBalances() public {
        vm.startPrank(executor);
        Balances memory initialBalances = getRamosBalances();

        // Check the actual balances vs the forked mainnet as a point of reference
        assertEq(initialBalances.ramosTemple, 5809705521458524909668712);
        assertEq(initialBalances.ramosStable, 5872605221247683475983439);

        // Assets set, no balances
        checkBalance(initialBalances.ramosStable, initialBalances.ramosTemple);

        // Deal some assets to the strategy - no change
        {
            deal(address(dai), address(strategy), 5e18, true);
            deal(address(aura), address(strategy), 100e18, true);
            deal(address(bal), address(strategy), 200e18, true);
            checkBalance(initialBalances.ramosStable, initialBalances.ramosTemple);
        }
        
        // Deal some BPTs to the `amoStaking` -- balance changes because Ramos didn't
        // hold 100% of all the BPT
        uint256 expectedRamosBpt = initialBalances.ramosBpt;
        uint256 expectedTotalBpt = initialBalances.bptTotalSupply;
        {
            uint256 extraBpt = 10_000e18;
            deal(address(bptToken), address(amoStaking), extraBpt, true);

            expectedRamosBpt += extraBpt;
            // Balancer takes a portion of fees - the total supply isn't exactly an extra 10k
            expectedTotalBpt += extraBpt + 0.020752113873203652e18;

            uint256 expectedDai = initialBalances.totalStable * expectedRamosBpt / expectedTotalBpt;
            uint256 expectedTemple = initialBalances.totalTemple * expectedRamosBpt / expectedTotalBpt;
            checkBalance(expectedDai, expectedTemple);
        }

        // Add some BPTs to the user, Ramos' balance of stables changes as the ratio changes
        {
            uint256 extraBpt = 10_000e18;
            deal(address(bptToken), alice, extraBpt, true);

            // Balancer takes a portion of fees - the total supply isn't exactly an extra 10k
            expectedTotalBpt += extraBpt + 0.020752113873203652e18;

            uint256 expectedDai = initialBalances.totalStable * expectedRamosBpt / expectedTotalBpt;
            uint256 expectedTemple = initialBalances.totalTemple * expectedRamosBpt / expectedTotalBpt;
            checkBalance(expectedDai, expectedTemple);
        }
    }
}

contract RamosStrategyTestBorrowAndRepay is RamosStrategyTestBase {

    // TRV
    event Borrow(address indexed strategy, address indexed token, address indexed recipient, uint256 amount);
    event Repay(address indexed strategy, address indexed token, address indexed from, uint256 amount);
    event StrategyCreditAndDebtBalance(address indexed strategy, address indexed token, uint256 credit, uint256 debt);

    // Strategy
    event AddLiquidity(uint256 quoteTokenAmount, uint256 protocolTokenAmount, uint256 bptTokensStaked);
    event RemoveLiquidity(uint256 quoteTokenAmount, uint256 protocolTokenAmount, uint256 bptIn);

    function setUp() public {
        _setUp();
        _setupTrv();
    }

    function test_addLiquidity() public {
        uint256 amount = 10_000_000e18;
        uint256 slippageBps = 100;  // 1%
        ITempleStrategy.AssetBalance[] memory assetBalances;

        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, BORROW_CEILING);

        Balances memory balancesBefore = getRamosBalances();
        assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceBefore = assetBalances[0].balance;
        uint256 templeBalanceBefore = assetBalances[1].balance;

        (uint256 templeAmount, uint256 bptOut,, IBalancerVault.JoinPoolRequest memory requestData) = strategy.proportionalAddLiquidityQuote(amount, slippageBps);

        vm.prank(executor);
        {
            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(temple), address(ramos), templeAmount);
            
            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(temple), 0, templeAmount);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(templeBaseStrategy), address(temple), templeAmount, 0);
            
            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(dai), address(ramos), amount);

            vm.expectEmit(address(trv));
            emit StrategyCreditAndDebtBalance(address(strategy), address(dai), 0, amount);

            vm.expectEmit(address(strategy));
            emit AddLiquidity(amount, templeAmount, bptOut);

            strategy.addLiquidity(requestData);
        }

        assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceAfter = assetBalances[0].balance;
        uint256 templeBalanceAfter = assetBalances[1].balance;

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-amount);

        // When adding liquidity into the weighted pool, BPTs more than the expected `bptOut' are minted as a protocol fee and transferred to the protocol fee collector address.
        // https://docs.balancer.fi/concepts/pools/more/deployments.html
        // https://etherscan.io/tx/0x1ac228b6582ae5774de4dd508de0ca21c4e0be31e1ae27428e50bcc43acabbe3
        // Thus, the share is decreased and the token balances corresponding to the share are also decreased
        // check the balance with delta. 1e18 = 100%
        assertApproxEqRel(daiBalanceAfter-daiBalanceBefore, amount, 1e5);
        assertApproxEqRel(templeBalanceAfter-templeBalanceBefore, templeAmount, 1e5);

        assertEq(dUSD.balanceOf(address(strategy)), amount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        {
            available = trv.availableForStrategyToBorrow(address(strategy), dai);
            assertEq(available, 0.01e25);
        }

        {
            Balances memory balancesAfter = getRamosBalances();
            assertEq(bptToken.balanceOf(address(amoStaking)), 0);
            assertEq(balancesAfter.ramosBpt, balancesBefore.ramosBpt+bptOut);
            assertApproxEqRel(balancesAfter.ramosStable, balancesBefore.ramosStable + amount, 1e5); // Balancer applies slight rounding
            assertGt(balancesAfter.ramosTemple, balancesBefore.ramosTemple);
            assertEq(IERC20(temple).balanceOf(address(amoStaking)), 0);
            assertEq(dai.balanceOf(address(amoStaking)), 0);
            assertEq(balancesBefore.ramosTemple * 1e18 / balancesBefore.ramosStable, balancesAfter.ramosTemple * 1e18 / balancesAfter.ramosStable); // pool balance ratio no change
        }

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, BORROW_CEILING-templeAmount, templeAmount));
        vm.prank(executor);
        strategy.addLiquidity(requestData);
    }

    function test_removeLiquidity() public {
        uint256 bptToRemove = 5_000_000e18;
        uint256 slippageBps = 100;  // 1%

        Balances memory balancesBefore = getRamosBalances();
        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceBefore = assetBalances[0].balance;
        uint256 templeBalanceBefore = assetBalances[1].balance;

        // Remove liquidity and repay
        (uint256 burnTempleAmount, uint256 repayDaiAmount,,, IBalancerVault.ExitPoolRequest memory requestDataForRemoveLiquidity) = strategy.proportionalRemoveLiquidityQuote(bptToRemove, slippageBps);

        vm.startPrank(executor);
        uint256 dusdAmount = 3_000_000e18;
        dUSD.mint(address(strategy), dusdAmount);

        {
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(temple), address(strategy), burnTempleAmount);

            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), address(strategy), repayDaiAmount);

            vm.expectEmit(address(strategy));
            emit RemoveLiquidity(repayDaiAmount, burnTempleAmount, bptToRemove);

            strategy.removeLiquidity(requestDataForRemoveLiquidity, bptToRemove);
        }

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE+repayDaiAmount);
        // When removing liquidity, some tokens are transferred to the protocol fee collector address as a protocol fee.
        // https://etherscan.io/tx/0xa8680834644a6fedfa72d6fd819fe605fe55577f9116a739ffce0f88c21539e9
        // check the balance with delta. 1e18 = 100%
        {
            assetBalances = strategy.latestAssetBalances();
            uint256 daiBalanceAfter = assetBalances[0].balance;
            uint256 templeBalanceAfter = assetBalances[1].balance;
            assertApproxEqRel(daiBalanceBefore-daiBalanceAfter, repayDaiAmount, 1e5);
            assertApproxEqRel(templeBalanceBefore-templeBalanceAfter, burnTempleAmount, 1e5);
        }

        // The full debt was paid off
        uint256 expectedDusdBalance = dusdAmount-repayDaiAmount;
        assertEq(dUSD.balanceOf(address(strategy)), expectedDusdBalance);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        uint256 available = trv.availableForStrategyToBorrow(address(strategy), dai);
        assertEq(available, BORROW_CEILING-dusdAmount+repayDaiAmount);

        {
            Balances memory balancesAfter = getRamosBalances();
            assertEq(balancesBefore.ramosTemple * 1e18 / balancesBefore.ramosStable, balancesAfter.ramosTemple * 1e18 / balancesAfter.ramosStable); // pool balance ratio no change
        }

        // Paying off more than the dUSD debt results in a Realised Gain
        bptToRemove = 1_000_000e18;
        (burnTempleAmount, repayDaiAmount,,, requestDataForRemoveLiquidity) = strategy.proportionalRemoveLiquidityQuote(bptToRemove, slippageBps);
        {
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(temple), address(strategy), burnTempleAmount);

            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(dai), address(strategy), repayDaiAmount);

            vm.expectEmit(address(strategy));
            emit RemoveLiquidity(repayDaiAmount, burnTempleAmount, bptToRemove);

            strategy.removeLiquidity(requestDataForRemoveLiquidity, bptToRemove);
        }
        assertEq(dUSD.balanceOf(address(strategy)), 0);
    }
}