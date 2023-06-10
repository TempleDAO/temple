pragma solidity ^0.8.17;
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
import { TempleERC20Token } from "contracts/core/TempleERC20Token.sol";
import { BalancerPoolHelper } from "contracts/amo/helpers/BalancerPoolHelper.sol";
import { AuraStaking } from "contracts/amo/AuraStaking.sol";
import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";

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

    uint256 public constant DEFAULT_BASE_INTEREST = 0.01e18;
    TempleDebtToken public dUSD;
    TreasuryReservesVault public trv;

    function _setUp() public {
        fork("mainnet", 17300437);

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
                templeIndexPool, balancerPoolId
            );
        }

        // RAMOS setup settings
        vm.startPrank(executor);
        {
            amoStaking.setAuraPoolInfo(poolId, auraStakingDepositToken, auraRewardsToken);
            amoStaking.setRewardsRecipient(executor);
            amoStaking.setExplicitAccess(address(ramos), AuraStaking.depositAndStake.selector, true);
            amoStaking.setExplicitAccess(address(ramos), AuraStaking.withdrawAndUnwrap.selector, true);
            
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
            changePrank(executor);
            ramos.depositAndStakeBptTokens(bptBalance, true);
        }

        // `templeToken` settings
        {
            address templeTokenOwner = temple.owner();
            startHoax(templeTokenOwner);
            temple.addMinter(address(ramos));
            vm.stopPrank();
        }

        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        trv = new TreasuryReservesVault(rescuer, executor, address(temple), address(dai), address(dUSD), 9700);
        strategy = new RamosStrategy(rescuer, executor, "RamosStrategy", address(trv), address(ramos));

        vm.prank(executor);
        dUSD.addMinter(executor);
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

            (balances.totalTemple, balances.totalStable) = poolHelper.getTempleStableBalances();
            balances.ramosTemple = balances.totalTemple * balances.ramosBpt / balances.bptTotalSupply;
            balances.ramosStable = balances.totalStable * balances.ramosBpt / balances.bptTotalSupply;
        }
    }
}

contract RamosStrategyTestAdmin is RamosStrategyTestBase {

    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.executors(executor), true);
        assertEq(strategy.rescuers(rescuer), true);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "RamosStrategy");
        assertEq(strategy.strategyVersion(), "1.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.stableToken()), address(dai));
        assertEq(address(strategy.internalDebtToken()), address(dUSD));
        ITempleStrategy.AssetBalanceDelta[] memory adjs = strategy.manualAdjustments();
        assertEq(adjs.length, 0);

        assertEq(address(strategy.ramos()), address(ramos));
    }

    function test_automatedShutdown() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.Unimplemented.selector));
        strategy.automatedShutdown("");
    }
}

contract RamosStrategyTestAccess is RamosStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function test_access_borrowAndAddLiquidity() public {
        uint256 amount = 1e18;
        uint256 slippageBps = 100;  // 1%
        (,,, IBalancerVault.JoinPoolRequest memory requestData) = ramos.proportionalAddLiquidityQuote(amount, slippageBps);
        expectElevatedAccess();
        strategy.borrowAndAddLiquidity(amount, requestData);
    }

    function test_access_removeLiquidityAndRepay() public {
        uint256 bptOut = 1e18;
        uint256 slippageBps = 100;  // 1%
        (,,,, IBalancerVault.ExitPoolRequest memory requestDataForRemoveLiquidity) = ramos.proportionalRemoveLiquidityQuote(bptOut, slippageBps);
        expectElevatedAccess();
        strategy.removeLiquidityAndRepay(requestDataForRemoveLiquidity, bptOut);
    }
}

contract RamosStrategyTestBalances is RamosStrategyTestBase {
    function setUp() public {
        _setUp();
    }

    function checkBalance(uint256 expected) internal {
        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 1);
        assertEq(assetBalances[0].asset, address(dai));
        assertEq(assetBalances[0].balance, expected);
    }

    function test_latestAssetBalances() public {
        vm.prank(executor);
        Balances memory initialBalances = getRamosBalances();

        // Check the actual balances vs the forked mainnet as a point of reference
        assertEq(initialBalances.ramosTemple, 5809705521458524909668712);
        assertEq(initialBalances.ramosStable, 5872605221247683475983439);

        // Assets set, no balances
        checkBalance(initialBalances.ramosStable);

        // Deal some assets to the strategy - no change
        {
            deal(address(dai), address(strategy), 5e18, true);
            deal(address(aura), address(strategy), 100e18, true);
            deal(address(bal), address(strategy), 200e18, true);
            checkBalance(initialBalances.ramosStable);
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

            uint256 expected = initialBalances.totalStable * expectedRamosBpt / expectedTotalBpt;
            checkBalance(expected);
        }

        // Add some BPTs to the user, Ramos' balance of stables changes as the ratio changes
        {
            uint256 extraBpt = 10_000e18;
            deal(address(bptToken), alice, extraBpt, true);

            // Balancer takes a portion of fees - the total supply isn't exactly an extra 10k
            expectedTotalBpt += extraBpt + 0.020752113873203652e18;

            uint256 expected = initialBalances.totalStable * expectedRamosBpt / expectedTotalBpt;
            checkBalance(expected);
        }
    }
}

contract RamosStrategyTestBorrowAndRepay is RamosStrategyTestBase {
    uint256 public constant TRV_STARTING_BALANCE = 10e25;
    uint256 public constant BORROW_CEILING = 1.01e25;

    // TRV
    event Borrow(address indexed strategy, address indexed recipient, uint256 stablesAmount);
    event Repay(address indexed strategy, address indexed from, uint256 stablesAmount);
    event RealisedGain(address indexed strategy, uint256 amount);

    // Strategy
    event BorrowAndAddLiquidity(uint256 amount);
    event RemoveLiquidityAndRepay(uint256 amount);

    function setUp() public {
        _setUp();

        vm.startPrank(executor);
        // Add the new strategy, and setup TRV such that it has stables to lend and issue dUSD.
        trv.addNewStrategy(address(strategy), BORROW_CEILING, 0);
        // strategy.setAssets(reportedAssets);
        deal(address(dai), address(trv), TRV_STARTING_BALANCE, true);
        dUSD.addMinter(address(trv));
        // Set the explicit access to RAMOS functions
        ramos.setExplicitAccess(address(strategy), ramos.addLiquidity.selector, true);
        ramos.setExplicitAccess(address(strategy), ramos.removeLiquidity.selector, true);
        vm.stopPrank();
    }

    function test_borrowAndAddLiquidity() public {
        uint256 amount = 10_000_000e18;
        uint256 slippageBps = 100;  // 1%
        ITempleStrategy.AssetBalance[] memory assetBalances;

        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, BORROW_CEILING);
        assertEq(ceiling, BORROW_CEILING);

        Balances memory balancesBefore = getRamosBalances();
        assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceBefore = assetBalances[0].balance;

        (, uint256 bptOut,, IBalancerVault.JoinPoolRequest memory requestData) = ramos.proportionalAddLiquidityQuote(amount, slippageBps);

        vm.prank(executor);
        {
            vm.expectEmit(address(trv));
            emit Borrow(address(strategy), address(ramos), amount);

            vm.expectEmit(address(strategy));
            emit BorrowAndAddLiquidity(amount);

            strategy.borrowAndAddLiquidity(amount, requestData);
        }

        assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceAfter = assetBalances[0].balance;

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE-amount);

        // When adding liquidity into the weighted pool, BPTs more than the expected `bptOut' are minted as a protocol fee and transferred to the protocol fee collector address.
        // https://docs.balancer.fi/concepts/pools/more/deployments.html
        // https://etherscan.io/tx/0x1ac228b6582ae5774de4dd508de0ca21c4e0be31e1ae27428e50bcc43acabbe3
        // Thus, the share is decreased and the token balances corresponding to the share are also decreased
        // check the balance with delta. 1e18 = 100%
        assertApproxEqRel(daiBalanceAfter-daiBalanceBefore, amount, 1e5);

        assertEq(dUSD.balanceOf(address(strategy)), amount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        {
            (debt, available, ceiling) = strategy.trvBorrowPosition();
            assertEq(debt, amount);
            assertEq(available, 0.01e25);
            assertEq(ceiling, BORROW_CEILING);
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

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e25, 0.02e25));
        vm.prank(executor);
        strategy.borrowAndAddLiquidity(0.02e25, requestData);
    }

    function test_removeLiquidityAndRepay() public {
        uint256 bptToRemove = 5_000_000e18;
        uint256 slippageBps = 100;  // 1%

        Balances memory balancesBefore = getRamosBalances();
        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceBefore = assetBalances[0].balance;

        // Remove liquidity and repay
        (, uint256 repayAmount,,, IBalancerVault.ExitPoolRequest memory requestDataForRemoveLiquidity) = ramos.proportionalRemoveLiquidityQuote(bptToRemove, slippageBps);

        vm.startPrank(executor);
        uint256 dusdAmount = 3_000_000e18;
        dUSD.mint(address(strategy), dusdAmount);

        {
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(strategy), repayAmount);

            vm.expectEmit(address(strategy));
            emit RemoveLiquidityAndRepay(repayAmount);

            strategy.removeLiquidityAndRepay(requestDataForRemoveLiquidity, bptToRemove);
        }

        assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceAfter = assetBalances[0].balance;

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), TRV_STARTING_BALANCE+repayAmount);
        // When removing liquidity, some tokens are transferred to the protocol fee collector address as a protocol fee.
        // https://etherscan.io/tx/0xa8680834644a6fedfa72d6fd819fe605fe55577f9116a739ffce0f88c21539e9
        // check the balance with delta. 1e18 = 100%
        assertApproxEqRel(daiBalanceBefore-daiBalanceAfter, repayAmount, 1e5);

        // The full debt was paid off
        uint256 expectedDusdBalance = dusdAmount-repayAmount;
        assertEq(dUSD.balanceOf(address(strategy)), expectedDusdBalance);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, dusdAmount-repayAmount);
        assertEq(available, BORROW_CEILING-dusdAmount+repayAmount);
        assertEq(ceiling, BORROW_CEILING);

        {
            Balances memory balancesAfter = getRamosBalances();
            assertEq(balancesBefore.ramosTemple * 1e18 / balancesBefore.ramosStable, balancesAfter.ramosTemple * 1e18 / balancesAfter.ramosStable); // pool balance ratio no change
        }

        // Paying off more than the dUSD debt results in a Realised Gain
        bptToRemove = 1_000_000e18;
        (, repayAmount,,, requestDataForRemoveLiquidity) = ramos.proportionalRemoveLiquidityQuote(bptToRemove, slippageBps);
        {
            vm.expectEmit(address(trv));
            emit Repay(address(strategy), address(strategy), repayAmount);

            vm.expectEmit(address(trv));
            emit RealisedGain(address(strategy), repayAmount-expectedDusdBalance);

            vm.expectEmit(address(strategy));
            emit RemoveLiquidityAndRepay(repayAmount);

            strategy.removeLiquidityAndRepay(requestDataForRemoveLiquidity, bptToRemove);
        }
        assertEq(dUSD.balanceOf(address(strategy)), 0);
    }
}