pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { RamosStrategy } from "contracts/v2/strategies/RamosStrategy.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { AMO__IRamos } from "contracts/amo/interfaces/AMO__IRamos.sol";
import { AMO__IAuraStaking } from "contracts/amo/interfaces/AMO__IAuraStaking.sol";
import { AMO__IPoolHelper } from "contracts/amo/interfaces/AMO__IPoolHelper.sol";

import "forge-std/console.sol";

contract RamosStrategyTestBase is TempleTest {
    RamosStrategy public strategy;

    AMO__IRamos public ramos = AMO__IRamos(0xC3133cB9e685ccc82C73FbE580eCeDC667B41917);
    AMO__IPoolHelper public poolHelper = AMO__IPoolHelper(0x4A02CbdBcd97BC639a13b864710550A7c39A3416);
    AMO__IAuraStaking public amoStaking = AMO__IAuraStaking(0x70989E7D20C065ce7628C8DdAA240853437953d7);
    IERC20 public bptToken;
    IERC20 public dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 public aura = IERC20(0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF);
    IERC20 public bal = IERC20(0xba100000625a3754423978a60c9317c58a424e3D);

    uint256 public constant defaultBaseInterest = 0.01e18;
    TempleDebtToken public dUSD;
    TreasuryReservesVault public trv;

    address[] public reportedAssets = [address(dai), address(aura), address(bal)];

    function _setUp() public {
        fork("mainnet", 17090437);

        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, defaultBaseInterest);
        trv = new TreasuryReservesVault(rescuer, executor, address(dai), address(dUSD));
        strategy = new RamosStrategy(rescuer, executor, "RamosStrategy", address(trv), address(ramos));

        bptToken = IERC20(ramos.bptToken());

        vm.startPrank(executor);
        dUSD.addMinter(executor);
        vm.stopPrank();
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
        assertEq(strategy.manualAssetBalanceDeltas(address(dai)), 0);
        assertEq(strategy.currentDebt(), 0);

        assertEq(address(strategy.ramos()), address(ramos));
        address[] memory assets = new address[](0);
        assertEq(strategy.getAssets(), assets);
    }

    function test_automatedShutdown() public {
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.Unimplemented.selector));
        strategy.automatedShutdown();
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
}

contract RamosStrategyTestBalances is RamosStrategyTestBase {
    event AssetsSet(address[] _assets);

    function setUp() public {
        _setUp();
    }

    function getRamosBalances() internal view returns (uint256 bptTotalSupply, uint256 bptBalance, uint256 templeBalance, uint256 stableBalance) {
        bptTotalSupply = bptToken.totalSupply();
        bptBalance = amoStaking.stakedBalance() + bptToken.balanceOf(address(amoStaking));

        (uint256 templeBalanceInLP, uint256 stableBalanceInLP) = poolHelper.getTempleStableBalances();
        templeBalance = templeBalanceInLP * bptBalance / bptTotalSupply;
        stableBalance = stableBalanceInLP * bptBalance / bptTotalSupply;
    }

    function test_currentDebt() public {
        vm.startPrank(executor);
        dUSD.mint(address(strategy), 100e18);
        assertEq(strategy.currentDebt(), 100e18);
        dUSD.burn(address(strategy), 100e18, false);
        assertEq(strategy.currentDebt(), 0);
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
        (ITempleStrategy.AssetBalance[] memory assetBalances, uint256 debt) = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 0);
        assertEq(debt, 0);

        // Deal some assets
        deal(address(dai), address(strategy), 50, true);
        deal(address(aura), address(strategy), 100, true);
        deal(address(bal), address(strategy), 200, true);
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

        (uint256 initialBptTotalSupply,,, uint256 initialDaiBalance) = getRamosBalances();

        // Assets set, no balances
        {
            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            for (uint256 i; i < assetBalances.length; ++i) {
                assertEq(assetBalances[i].asset, reportedAssets[i]);
                if (reportedAssets[i] == address(dai)) {
                    assertEq(assetBalances[i].balance, initialDaiBalance);
                } else {
                    assertEq(assetBalances[i].balance, 0);
                }
            }
            assertEq(debt, 0);
        }

        // Deal some assets to the strategy
        {
            deal(address(dai), address(strategy), 50, true);
            deal(address(aura), address(strategy), 100, true);
            deal(address(bal), address(strategy), 200, true);
            vm.prank(executor);
            dUSD.mint(address(strategy), 100e18);

            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, initialDaiBalance+50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 200);
            assertEq(debt, 100e18);
        }

        // Deal some BPTs to the `amoStaking`, no balance changes
        {
            deal(address(bptToken), address(amoStaking), 100, true);

            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertEq(assetBalances[0].balance, initialDaiBalance+50);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 200);
            assertEq(debt, 100e18);
        }

        // Add some BPTs to the user, balance changes
        {
            deal(address(bptToken), alice, 100, true);
            (assetBalances, debt) = strategy.latestAssetBalances();

            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertApproxEqAbs(assetBalances[0].balance, (initialDaiBalance+50) * initialBptTotalSupply / (initialBptTotalSupply+100), 1);  // delta by the rounding
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 200);
            assertEq(debt, 100e18);
        }

        // Deal some rewards to the `amoStaking`
        {
            deal(address(aura), address(amoStaking), 100, true);
            deal(address(bal), address(amoStaking), 200, true);

            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertApproxEqAbs(assetBalances[0].balance, (initialDaiBalance+50) * initialBptTotalSupply / (initialBptTotalSupply+100), 1);  // delta by the rounding
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 2*100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 2*200);
            assertEq(debt, 100e18);
        }

        // Deal some rewards to the `rewardsRecipient` of `amoStaking`, no balance changes, we won't include the `rewardsRecipient` balance
        {
            address rewardsRecipient = amoStaking.rewardsRecipient();

            deal(address(aura), address(rewardsRecipient), 100, true);
            deal(address(bal), address(rewardsRecipient), 200, true);

            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertApproxEqAbs(assetBalances[0].balance, (initialDaiBalance+50) * initialBptTotalSupply / (initialBptTotalSupply+100), 1);  // delta by the rounding
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 2*100);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 2*200);
            assertEq(debt, 100e18);
        }

        // Add some manual balance deltas
        {

            ITempleStrategy.AssetBalanceDelta[] memory deltas = new ITempleStrategy.AssetBalanceDelta[](4);
            deltas[0] = ITempleStrategy.AssetBalanceDelta(address(dai), -50);
            deltas[1] = ITempleStrategy.AssetBalanceDelta(address(aura), 50);
            deltas[2] = ITempleStrategy.AssetBalanceDelta(address(bal), -50);
            vm.prank(executor);
            strategy.setManualAssetBalanceDeltas(deltas);

            (assetBalances, debt) = strategy.latestAssetBalances();
            assertEq(assetBalances.length, 3);
            assertEq(assetBalances[0].asset, reportedAssets[0]);
            assertApproxEqAbs(assetBalances[0].balance, (initialDaiBalance+50) * initialBptTotalSupply / (initialBptTotalSupply+100) - 50, 1);
            assertEq(assetBalances[1].asset, reportedAssets[1]);
            assertEq(assetBalances[1].balance, 2*100+50);
            assertEq(assetBalances[2].asset, reportedAssets[2]);
            assertEq(assetBalances[2].balance, 2*200-50);
            assertEq(debt, 100e18);
        }
    }
}