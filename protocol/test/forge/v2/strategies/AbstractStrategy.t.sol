pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { AbstractStrategy, ITempleStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";

import { ITempleDebtToken, TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

contract MockStrategy is AbstractStrategy {

    string public constant VERSION = "X.0.0";

    string public API_VERSION_X;

    address[] public assets;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address[] memory _assets 
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        assets = _assets;
        API_VERSION_X = "1.0.0";
    }

    function strategyVersion() external pure returns (string memory) {
        return VERSION;
    }

    function superApiVersion() public view returns (string memory) {
        return super.apiVersion();
    }

    function apiVersion() public view override returns (string memory) {
        return API_VERSION_X;
    }

    function setApiVersion(string memory v) external {
        API_VERSION_X = v;
    }

    function latestAssetBalances() public virtual override view returns (AssetBalance[] memory assetBalances, uint256 debt) {
        uint256 _length = assets.length;
        assetBalances = new AssetBalance[](_length);

        // Sum the balance on this contract + any manual adjustment
        address _asset;
        for (uint256 i; i < _length; ++i) {
            _asset = assets[i];
            assetBalances[i] = AssetBalance({
                asset: _asset,
                balance: addManualAssetBalanceDelta(
                    FakeERC20(_asset).balanceOf(address(this)),
                    _asset
                )
            });
        }

        debt = currentDebt();
    }

    function automatedShutdown() external pure returns (uint256) {
        revert Unimplemented();
    }
}

contract AbstractStrategyTestBase is TempleTest {
    MockStrategy public strategy;
    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);
    FakeERC20 public frax = new FakeERC20("FRAX", "FRAX", address(0), 0);
    FakeERC20 public usdc = new FakeERC20("USDC", "USDC", address(0), 0);

    TempleDebtToken public dUSD;
    TreasuryReservesVault public trv;
    uint256 public constant defaultBaseInterest = 0.01e18;

    address[] public reportedAssets = [address(dai), address(frax)];

    function _setUp() public {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, defaultBaseInterest);
        trv = new TreasuryReservesVault(rescuer, executor, address(temple), address(dai), address(dUSD), 9700);
        strategy = new MockStrategy(rescuer, executor, "MockStrategy", address(trv), reportedAssets);

        vm.prank(executor);
        dUSD.addMinter(executor);
    }
}

contract AbstractStrategyTestAdmin is AbstractStrategyTestBase {
    event TreasuryReservesVaultSet(address indexed trv);
    
    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(strategy.executors(executor), true);
        assertEq(strategy.rescuers(rescuer), true);
        assertEq(strategy.apiVersion(), "1.0.0");
        assertEq(strategy.superApiVersion(), "1.0.0");
        assertEq(strategy.strategyName(), "MockStrategy");
        assertEq(strategy.strategyVersion(), "X.0.0");
        assertEq(address(strategy.treasuryReservesVault()), address(trv));
        assertEq(address(strategy.stableToken()), address(dai));
        assertEq(address(strategy.internalDebtToken()), address(dUSD));
        assertEq(strategy.manualAssetBalanceDeltas(address(dai)), 0);
        assertEq(strategy.currentDebt(), 0);
        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, 0);
        assertEq(ceiling, 0);
        assertEq(dai.allowance(address(strategy), address(trv)), type(uint256).max);
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

    function test_setTreasuryReservesVault() public {
        assertEq(address(strategy.treasuryReservesVault()), address(trv));

        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        strategy.setTreasuryReservesVault(address(0));

        vm.expectRevert();
        strategy.setTreasuryReservesVault(alice);

        TreasuryReservesVault trv2 = new TreasuryReservesVault(rescuer, executor, address(temple), address(dai), address(dUSD), 9700);

        vm.expectEmit();
        emit TreasuryReservesVaultSet(address(trv2));
        strategy.setTreasuryReservesVault(address(trv2));
        assertEq(address(strategy.treasuryReservesVault()), address(trv2));

        assertEq(dai.allowance(address(strategy), address(trv)), 0);
        assertEq(dai.allowance(address(strategy), address(trv2)), type(uint256).max);

        strategy.setApiVersion("XXX");
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.InvalidVersion.selector, "XXX", "1.0.0"));
        strategy.setTreasuryReservesVault(address(trv2));
    }

    function test_automatedShutdown() public {
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.Unimplemented.selector));
        strategy.automatedShutdown();
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

    function test_access_setManualAssetBalanceDeltas() public {
        expectElevatedAccess();
        ITempleStrategy.AssetBalanceDelta[] memory deltas = new ITempleStrategy.AssetBalanceDelta[](0);
        strategy.setManualAssetBalanceDeltas(deltas);
    }
}

contract AbstractStrategyTestBalances is AbstractStrategyTestBase {

    event AssetBalancesCheckpoint(ITempleStrategy.AssetBalance[] assetBalances, uint256 debt);
    event ManualAssetBalanceDeltasSet(ITempleStrategy.AssetBalanceDelta[] assetDeltas);

    function setUp() public {
        _setUp();
    }

    function test_trvBorrowPosition() public {
        vm.startPrank(executor);
        uint256 borrowCeiling = 100e18;
        trv.addNewStrategy(address(strategy), borrowCeiling, 0);
        (uint256 debt, uint256 available, uint256 ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, 0);
        assertEq(ceiling, borrowCeiling);

        deal(address(dai), address(trv), 1000e18, true);
        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 0);
        assertEq(available, 100e18);
        assertEq(ceiling, borrowCeiling);

        dUSD.mint(address(strategy), 25e18);
        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 25e18);
        assertEq(available, 75e18);
        assertEq(ceiling, borrowCeiling);

        dUSD.burn(address(strategy), 10e18);
        (debt, available, ceiling) = strategy.trvBorrowPosition();
        assertEq(debt, 15e18);
        assertEq(available, 85e18);
        assertEq(ceiling, borrowCeiling);
    }

    function test_currentDebt() public {
        vm.startPrank(executor);
        dUSD.mint(address(strategy), 100e18);
        assertEq(strategy.currentDebt(), 100e18);
        dUSD.burn(address(strategy), 100e18);
        assertEq(strategy.currentDebt(), 0);
    }

    function test_latestAssetBalances() public {
        vm.startPrank(executor);
        (ITempleStrategy.AssetBalance[] memory assetBalances, uint256 debt) = strategy.latestAssetBalances();
        assertEq(assetBalances.length, reportedAssets.length);
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 0);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 0);
        assertEq(debt, 0);

        // Deal some assets
        deal(address(dai), address(strategy), 50, true);
        deal(address(frax), address(strategy), 100, true);
        deal(address(usdc), address(strategy), 200, true);
        dUSD.mint(address(strategy), 100e18);

        (assetBalances, debt) = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, reportedAssets[0]);
        assertEq(assetBalances[0].balance, 50);
        assertEq(assetBalances[1].asset, reportedAssets[1]);
        assertEq(assetBalances[1].balance, 100);
        assertEq(debt, 100e18);
    }

    function test_checkpointAssetBalances() public {
        vm.startPrank(executor);
        deal(address(dai), address(strategy), 50, true);
        deal(address(frax), address(strategy), 100, true);
        deal(address(usdc), address(strategy), 200, true);
        dUSD.mint(address(strategy), 100e18);

        ITempleStrategy.AssetBalance[] memory expectedBalances = new ITempleStrategy.AssetBalance[](2);
        expectedBalances[0] = ITempleStrategy.AssetBalance(address(dai), 50);
        expectedBalances[1] = ITempleStrategy.AssetBalance(address(frax), 100);

        vm.expectEmit();
        emit AssetBalancesCheckpoint(expectedBalances, 100e18);

        (ITempleStrategy.AssetBalance[] memory assetBalances, uint256 debt) = strategy.checkpointAssetBalances();
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, expectedBalances[0].asset);
        assertEq(assetBalances[0].balance, expectedBalances[0].balance);
        assertEq(assetBalances[1].asset, expectedBalances[1].asset);
        assertEq(assetBalances[1].balance, expectedBalances[1].balance);
        assertEq(debt, 100e18);
    }

    function test_setManualAssetBalanceDeltas() public {
        vm.startPrank(executor);

        ITempleStrategy.AssetBalanceDelta[] memory deltas = new ITempleStrategy.AssetBalanceDelta[](3);
        deltas[0] = ITempleStrategy.AssetBalanceDelta(address(frax), 50);
        deltas[1] = ITempleStrategy.AssetBalanceDelta(address(dai), -50);
        deltas[2] = ITempleStrategy.AssetBalanceDelta(address(usdc), 1000);

        vm.expectEmit();
        emit ManualAssetBalanceDeltasSet(deltas);
        strategy.setManualAssetBalanceDeltas(deltas);

        ITempleStrategy.AssetBalanceDelta[] memory getDeltas = strategy.getManualAssetBalanceDeltas();
        assertEq(getDeltas.length, deltas.length);
        for (uint256 i; i<getDeltas.length; ++i) {
            assertEq(getDeltas[i].asset, deltas[i].asset);
            assertEq(getDeltas[i].delta, deltas[i].delta);
        }

        // Can't have a negative balance after the manual adjustment
        vm.expectRevert(abi.encodeWithSelector(ITempleStrategy.InvalidAssetBalanceDelta.selector, address(dai), 0, -50));
        strategy.latestAssetBalances();

        // Deal some dai/frax balance
        deal(address(dai), address(strategy), 1000, true);
        deal(address(frax), address(strategy), 1000, true);

        (ITempleStrategy.AssetBalance[] memory assetBalances, uint256 debt) = strategy.latestAssetBalances();
        assertEq(assetBalances.length, 2);
        assertEq(assetBalances[0].asset, address(dai));
        assertEq(assetBalances[0].balance, 1000-50);
        assertEq(assetBalances[1].asset, address(frax));
        assertEq(assetBalances[1].balance, 1000+50);
        assertEq(debt, 0);
    }
}