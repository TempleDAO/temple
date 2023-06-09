pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { RamosStrategy } from "contracts/v2/strategies/RamosStrategy.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITreasuryReservesVault, TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { RAMOS } from "contracts/amo/Ramos.sol";
import { PoolHelper, AMO__IBalancerVault } from "contracts/amo/helpers/PoolHelper.sol";
import { AuraStaking } from "contracts/amo/AuraStaking.sol";
import { TempleERC20Token } from "contracts/core/TempleERC20Token.sol";

interface IBPT {
    function getActualSupply() external view returns (uint256);
}

contract RamosStrategyTestBase is TempleTest {
    RamosStrategy public strategy;

    RAMOS public ramos;
    address balancerVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address balancerHelpers = 0x5aDDCCa35b7A0D07C74063c48700C8590E87864E;
    address temple = 0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7;
    uint64 templeIndexPool = 0;
    bytes32 balancerPoolId = 0x8bd4a1e74a27182d23b98c10fd21d4fbb0ed4ba00002000000000000000004ed;
    address public constant POOL_HELPER_ADDRESS = 0x4A02CbdBcd97BC639a13b864710550A7c39A3416;
    AuraStaking public amoStaking = AuraStaking(0x70989E7D20C065ce7628C8DdAA240853437953d7);
    IERC20 public bptToken = IERC20(0x8Bd4A1E74A27182D23B98c10Fd21D4FbB0eD4BA0);
    IERC20 public dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 public aura = IERC20(0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF);
    IERC20 public bal = IERC20(0xba100000625a3754423978a60c9317c58a424e3D);

    uint256 public constant defaultBaseInterest = 0.01e18;
    TempleDebtToken public dUSD;
    TreasuryReservesVault public trv;

    address[] public reportedAssets = [address(dai), address(aura), address(bal)];

    function _setUp() public {
        fork("mainnet", 17300437);

        PoolHelper poolHelper = new PoolHelper(balancerVault, balancerHelpers, temple, address(dai), address(bptToken), address(amoStaking), templeIndexPool, balancerPoolId);
        vm.etch(POOL_HELPER_ADDRESS, address(poolHelper).code);

        ramos = new RAMOS(rescuer, executor, balancerVault, temple, address(dai), address(bptToken), address(amoStaking), templeIndexPool, balancerPoolId);
        // RAMOS settings
        vm.startPrank(executor);
        ramos.setPoolHelper(POOL_HELPER_ADDRESS);
        ramos.setCoolDown(1800);    // 30 mins
        ramos.setTemplePriceFloorNumerator(9700);
        ramos.setRebalancePercentageBounds(200, 500);
        ramos.setMaxRebalanceAmounts(1e28, 1e28, 1e28); // bpt, temple, stable
        vm.stopPrank();
        
        // `amoStaking` settings
        address amoStakingOwner = amoStaking.owner();
        startHoax(amoStakingOwner);
        amoStaking.setOperator(address(ramos));
        amoStaking.setRewardsRecipient(executor);
        vm.stopPrank();
        
        // `templeToken` settings
        address templeTokenOwner = TempleERC20Token(temple).owner();
        startHoax(templeTokenOwner);
        TempleERC20Token(temple).addMinter(address(ramos));
        vm.stopPrank();

        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, defaultBaseInterest);
        trv = new TreasuryReservesVault(rescuer, executor, address(temple), address(dai), address(dUSD), 9700);
        strategy = new RamosStrategy(rescuer, executor, "RamosStrategy", address(trv), address(ramos));
        vm.startPrank(executor);
        dUSD.addMinter(executor);
        vm.stopPrank();
    }

    function getRamosBalances() internal view returns (
        uint256 bptTotalSupply, 
        uint256 bptBalance, 
        uint256 templeBalance, 
        uint256 stableBalance
    ) {
        bptTotalSupply = IBPT(address(bptToken)).getActualSupply();

        if (bptTotalSupply > 0) {
            bptBalance = amoStaking.stakedBalance() + bptToken.balanceOf(address(amoStaking));

            (uint256 templeBalanceInLP, uint256 stableBalanceInLP) = PoolHelper(POOL_HELPER_ADDRESS).getTempleStableBalances();
            templeBalance = templeBalanceInLP * bptBalance / bptTotalSupply;
            stableBalance = stableBalanceInLP * bptBalance / bptTotalSupply;
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
        address[] memory assets = new address[](0);
        assertEq(strategy.getAssets(), assets);
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

    function test_access_setAssets() public {
        expectElevatedAccess();
        address[] memory assets = new address[](0);
        strategy.setAssets(assets);
    }

    function test_access_borrowAndAddLiquidity() public {
        uint256 amount = 1e18;
        uint256 slippageBps = 100;  // 1%
        (,,, AMO__IBalancerVault.JoinPoolRequest memory requestData) = PoolHelper(POOL_HELPER_ADDRESS).proportionalAddLiquidityQuote(amount, slippageBps);
        expectElevatedAccess();
        strategy.borrowAndAddLiquidity(amount, requestData);
    }

    function test_access_removeLiquidityAndRepay() public {
        uint256 bptOut = 1e18;
        uint256 slippageBps = 100;  // 1%
        (,,,, AMO__IBalancerVault.ExitPoolRequest memory requestDataForRemoveLiquidity) = PoolHelper(POOL_HELPER_ADDRESS).proportionalRemoveLiquidityQuote(bptOut, slippageBps);
        expectElevatedAccess();
        strategy.removeLiquidityAndRepay(requestDataForRemoveLiquidity, bptOut);
    }
}

contract RamosStrategyTestBalances is RamosStrategyTestBase {
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

        // RAMOS strategy can't accept eth
        address[] memory invalidReportedAssets = new address[](4);
        invalidReportedAssets[0] = reportedAssets[0];
        invalidReportedAssets[1] = reportedAssets[1];
        invalidReportedAssets[2] = reportedAssets[2];
        invalidReportedAssets[3] = address(0);
        
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        strategy.setAssets(invalidReportedAssets);
    }

    function test_latestAssetBalances_default() public {
        vm.startPrank(executor);
        ITempleStrategy.AssetBalance[] memory assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 0);

        // Deal some assets
        deal(address(dai), address(strategy), 50, true);
        deal(address(aura), address(strategy), 100, true);
        deal(address(bal), address(strategy), 200, true);

        assetBalances = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 0);
    }

    function test_latestAssetBalances() public {
        vm.prank(executor);
        strategy.setAssets(reportedAssets);
        ITempleStrategy.AssetBalance[] memory assetBalances;

        (uint256 initialBptTotalSupply,,, uint256 initialDaiBalance) = getRamosBalances();

        // Assets set, no balances
        {
            assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            for (uint256 i; i < assetBalances.length; ++i) {
                assertEq(assetBalances[i].asset, reportedAssets[i]);
                if (reportedAssets[i] == address(dai)) {
                    assertEq(assetBalances[i].balance, initialDaiBalance);
                } else {
                    assertEq(assetBalances[i].balance, 0);
                }
            }
        }

        // Deal some assets to the strategy
        {
            deal(address(dai), address(strategy), 50, true);
            deal(address(aura), address(strategy), 100, true);
            deal(address(bal), address(strategy), 200, true);
            vm.prank(executor);
            dUSD.mint(address(strategy), 100e18);

            assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, initialDaiBalance+50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 200);
        }

        // Deal some BPTs to the `amoStaking`, no balance changes
        {
            deal(address(bptToken), address(amoStaking), 100, true);

            assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, initialDaiBalance+50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 200);
        }

        // Add some BPTs to the user, balance changes
        {
            deal(address(bptToken), alice, 100, true);
            assetBalances = strategy.latestAssetBalances();

            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertApproxEqAbs(assetBalances[0].balance, (initialDaiBalance+50) * initialBptTotalSupply / (initialBptTotalSupply+100), 1);  // delta by the rounding
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 200);
        }

        // Deal some rewards to the `amoStaking`
        {
            deal(address(aura), address(amoStaking), 100, true);
            deal(address(bal), address(amoStaking), 200, true);

            assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertApproxEqAbs(assetBalances[0].balance, (initialDaiBalance+50) * initialBptTotalSupply / (initialBptTotalSupply+100), 1);  // delta by the rounding
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 2*100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 2*200);
        }

        // Deal some rewards to the `rewardsRecipient` of `amoStaking`, no balance changes
        // We won't include the `rewardsRecipient` balance
        {
            address rewardsRecipient = amoStaking.rewardsRecipient();

            deal(address(aura), address(rewardsRecipient), 100, true);
            deal(address(bal), address(rewardsRecipient), 200, true);

            assetBalances = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertApproxEqAbs(assetBalances[0].balance, (initialDaiBalance+50) * initialBptTotalSupply / (initialBptTotalSupply+100), 1);  // delta by the rounding
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 2*100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 2*200);
        }
    }
}

contract RamosStrategyTestBorrowAndRepay is RamosStrategyTestBase {
    uint256 public constant trvStartingBalance = 10e25;
    uint256 public constant borrowCeiling = 1.01e25;

    event BorrowAndAddLiquidity(uint256 amount);
    event RemoveLiquidityAndRepay(uint256 amount);

    function setUp() public {
        _setUp();

        vm.startPrank(executor);
        // Add the new strategy, and setup TRV such that it has stables to lend and issue dUSD.
        trv.addNewStrategy(address(strategy), borrowCeiling, 0);
        strategy.setAssets(reportedAssets);
        deal(address(dai), address(trv), trvStartingBalance, true);
        dUSD.addMinter(address(trv));
        // Set the explicit access to RAMOS functions
        ramos.setExplicitAccess(address(strategy), ramos.addLiquidity.selector, true);
        ramos.setExplicitAccess(address(strategy), ramos.removeLiquidity.selector, true);
        vm.stopPrank();
    }

    function test_borrowAndAddLiquidity() public {
        uint256 amount = 1e25;
        uint256 slippageBps = 100;  // 1%
        ITempleStrategy.AssetBalance[] memory assetBalances;

        assertEq(dai.balanceOf(address(trv)), trvStartingBalance);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, borrowCeiling);
        assertEq(ceiling, borrowCeiling);

        (, uint256 bptBalanceBefore, uint256 templeBalanceBefore, uint256 stableBalanceBefore) = getRamosBalances();
        assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceBefore = assetBalances[0].balance;

        (, uint256 bptOut,, AMO__IBalancerVault.JoinPoolRequest memory requestData) = PoolHelper(POOL_HELPER_ADDRESS).proportionalAddLiquidityQuote(amount, slippageBps);

        vm.expectEmit();
        emit BorrowAndAddLiquidity(amount);

        vm.startPrank(executor);
        strategy.borrowAndAddLiquidity(amount, requestData);
        vm.stopPrank();

        assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceAfter = assetBalances[0].balance;

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-amount);
        // When adding liquidity into the weighted pool, BPTs more than the expected `bptOut' are minted as a protocol fee and transferred to the protocol fee collector address.
        // https://docs.balancer.fi/concepts/pools/more/deployments.html
        // https://etherscan.io/tx/0x1ac228b6582ae5774de4dd508de0ca21c4e0be31e1ae27428e50bcc43acabbe3
        // Thus, the share is decreased and the token balances corresponding to the share are also decreased
        // check the balance with delta. 1e18 = 100%
        assertApproxEqRel(daiBalanceAfter-daiBalanceBefore, amount, 0.0001e18); // 0.001% 

        assertEq(dUSD.balanceOf(address(strategy)), amount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, amount);
        assertEq(available, 0.01e25);
        assertEq(ceiling, borrowCeiling);

        (, uint256 bptBalanceAfter, uint256 templeBalanceAfter, uint256 stableBalanceAfter) = getRamosBalances();
        assertEq(bptToken.balanceOf(address(amoStaking)), 0);
        assertEq(bptBalanceAfter, bptBalanceBefore+bptOut);
        assertEq(IERC20(temple).balanceOf(address(amoStaking)), 0);
        assertEq(dai.balanceOf(address(amoStaking)), 0);
        assertEq(templeBalanceBefore*1e18/stableBalanceBefore, templeBalanceAfter*1e18/stableBalanceAfter); // pool balance ratio no change

        vm.expectRevert(abi.encodeWithSelector(ITreasuryReservesVault.DebtCeilingBreached.selector, 0.01e25, 0.02e25));
        vm.startPrank(executor);
        strategy.borrowAndAddLiquidity(0.02e25, requestData);
        vm.stopPrank();
    }

    function test_removeLiquidityAndRepay() public {
        uint256 borrowAmount = 1e25;
        uint256 slippageBps = 100;  // 1%
        ITempleStrategy.AssetBalance[] memory assetBalances;
        uint256 bptOut;

        // Add liquidity
        {
            (, uint256 expectedBptOut,, AMO__IBalancerVault.JoinPoolRequest memory requestDataForAddLiquidity) = PoolHelper(POOL_HELPER_ADDRESS).proportionalAddLiquidityQuote(borrowAmount, slippageBps);
            bptOut = expectedBptOut;
            vm.startPrank(executor);
            strategy.borrowAndAddLiquidity(borrowAmount, requestDataForAddLiquidity);
        }

        (,, uint256 templeBalanceBefore, uint256 stableBalanceBefore) = getRamosBalances();
        assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceBefore = assetBalances[0].balance;

        // Remove liquidity and repay
        (, uint256 repayAmount,,, AMO__IBalancerVault.ExitPoolRequest memory requestDataForRemoveLiquidity) = PoolHelper(POOL_HELPER_ADDRESS).proportionalRemoveLiquidityQuote(bptOut/2, slippageBps);

        vm.expectEmit();
        emit RemoveLiquidityAndRepay(repayAmount);

        strategy.removeLiquidityAndRepay(requestDataForRemoveLiquidity, bptOut/2);

        assetBalances = strategy.latestAssetBalances();
        uint256 daiBalanceAfter = assetBalances[0].balance;

        assertEq(dai.balanceOf(address(strategy)), 0);
        assertEq(dai.balanceOf(address(trv)), trvStartingBalance-borrowAmount+repayAmount);
        // When removing liquidity, some tokens are transferred to the protocol fee collector address as a protocol fee.
        // https://etherscan.io/tx/0xa8680834644a6fedfa72d6fd819fe605fe55577f9116a739ffce0f88c21539e9
        // check the balance with delta. 1e18 = 100%
        assertApproxEqRel(daiBalanceBefore-daiBalanceAfter, repayAmount, 0.0001e18); // 0.001% 

        assertEq(dUSD.balanceOf(address(strategy)), borrowAmount-repayAmount);
        assertEq(dUSD.balanceOf(address(trv)), 0);

        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, borrowAmount-repayAmount);
        assertEq(available, borrowCeiling-borrowAmount+repayAmount);
        assertEq(ceiling, borrowCeiling);

        {
            (,, uint256 templeBalanceAfter, uint256 stableBalanceAfter) = getRamosBalances();
            assertEq(templeBalanceBefore*1e18/stableBalanceBefore, templeBalanceAfter*1e18/stableBalanceAfter); // pool balance ratio no change
        }

        // Only has `borrowAmount-repayAmount` dUSD and `bptOut/2` BPT left, but we can still repay more DAI.
        // This generates a positive
        deal(address(dai), address(strategy), 1e25, true);
        (,,,, requestDataForRemoveLiquidity) = PoolHelper(POOL_HELPER_ADDRESS).proportionalRemoveLiquidityQuote(1, slippageBps);
        strategy.removeLiquidityAndRepay(requestDataForRemoveLiquidity, 1e18);
        assertEq(dUSD.balanceOf(address(strategy)), 0);
    }
}