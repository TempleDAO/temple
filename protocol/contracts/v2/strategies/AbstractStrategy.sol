pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/AbstractStrategy.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import { ITempleStrategy, ITreasuryReservesVault } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

/**
 * @dev Abstract base contract implementation of a Temple Strategy. 
 * All strategies should inherit this.
 */
abstract contract AbstractStrategy is ITempleStrategy, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    string public constant API_VERSION = "1.0.0";

    /**
     * @notice A human readable name of the strategy
     */
    string public override strategyName;

    /**
     * @notice The address of the treasury reserves vault.
     */
    ITreasuryReservesVault public override treasuryReservesVault;

    /**
     * @notice The address of the stable token (eg DAI) used to value all strategy's assets and debt.
     */
    IERC20 public immutable override stableToken;

    /**
     * @notice The address of the internal debt token used by all strategies.
     */
    ITempleDebtToken public immutable override internalDebtToken;

    /**
     * @notice The Strategy Executor may set manual updates to asset balances
     * if they cannot be reported automatically - eg a staked position with no receipt token.
     */
    mapping(address => int256) public override manualAssetBalanceDeltas;
    EnumerableSet.AddressSet private manualAssetBalanceDeltasKeys;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        strategyName = _strategyName;
        treasuryReservesVault = ITreasuryReservesVault(_treasuryReservesVault);
        stableToken = treasuryReservesVault.stableToken();
        internalDebtToken = treasuryReservesVault.internalDebtToken();

        // Give the TRV rights to pull back the stables at any time.
        stableToken.safeApprove(_treasuryReservesVault, type(uint256).max);
    }

    /**
     * @notice Governance can set the address of the treasury reserves vault.
     */
    function setTreasuryReservesVault(address _trv) external override onlyElevatedAccess {
        if (_trv == address(0)) revert CommonEventsAndErrors.InvalidAddress(_trv);

        // Remove stable approvals from the old TRV, and give to the new TRV.
        stableToken.safeApprove(address(treasuryReservesVault), 0);
        stableToken.safeApprove(_trv, 0);
        stableToken.safeApprove(_trv, type(uint256).max);

        emit TreasuryReservesVaultSet(_trv);
        treasuryReservesVault = ITreasuryReservesVault(_trv);

        string memory trvVersion = treasuryReservesVault.apiVersion();
        if (keccak256(abi.encodePacked(trvVersion)) != keccak256(abi.encodePacked(apiVersion())))
            revert InvalidVersion(apiVersion(), trvVersion);
    }

    /**
     * @notice The current dUSD debt of a strategy
     */
    function currentDebt() public override view returns (uint256) {
        return internalDebtToken.balanceOf(address(this));
    }

    /**
     * @notice A strategy's current amount borrowed from the TRV, and how much remaining is free to borrow
     * @dev The remaining amount free to borrow is bound by:
     *   1/ How much stables is globally available (in this contract + in the base strategy)
     *   2/ The amount each individual strategy is whitelisted to borrow.
     * @return debt The current debt position for the strategy, 
     * @return availableToBorrow The remaining amount which the strategy can borrow
     * @return debtCeiling The debt ceiling of the stratgy
     */
    function trvBorrowPosition() external override view returns (
        uint256 debt, 
        uint256 availableToBorrow,
        uint256 debtCeiling
    ) {
        return treasuryReservesVault.strategyBorrowPosition(address(this));
    }

    /**
     * @notice Track the deployed version of this contract. 
     */
    function apiVersion() public view virtual override returns (string memory) {
        return API_VERSION;
    }

    /**
     * @notice The Strategy Executor may set manual updates to asset balances
     * if they cannot be reported automatically - eg a staked position with no receipt token.
     * 
     * @dev It is up to the Strategy implementation to add these deltas to the `latestAssetBalances()`
     * and `checkpointAssetBalances()` functions.
     */
    function setManualAssetBalanceDeltas(AssetBalanceDelta[] calldata assetDeltas) external virtual onlyElevatedAccess {
        // This doesn't delete prior deltas. If no longer required then set to 0
        uint256 _length = assetDeltas.length;
        AssetBalanceDelta calldata abd;
        for (uint256 i; i < _length; ++i) {
            abd = assetDeltas[i];
            manualAssetBalanceDeltasKeys.add(abd.asset);
            manualAssetBalanceDeltas[abd.asset] = abd.delta;
        }

        emit ManualAssetBalanceDeltasSet(assetDeltas);
    }

    /**
     * @notice Get the set of manual asset balance deltas, set by the Strategy Executor.
     */
    function getManualAssetBalanceDeltas() external virtual view returns (AssetBalanceDelta[] memory assetDeltas) {
        uint256 _length = manualAssetBalanceDeltasKeys.length();
        assetDeltas = new AssetBalanceDelta[](_length);
        address _asset;
        for (uint256 i; i < _length; ++i) {
            _asset = manualAssetBalanceDeltasKeys.at(i);
            assetDeltas[i] = AssetBalanceDelta(_asset, manualAssetBalanceDeltas[_asset]);
        }
    }

    /**
     * @dev An internal helper to add any manual asset balance delta to the `lhs`
     */
    function addManualAssetBalanceDelta(uint256 lhs, address asset) internal virtual view returns (uint256) {
        int256 balance = int256(lhs) + manualAssetBalanceDeltas[asset];
        if (balance < 0) revert InvalidAssetBalanceDelta(asset, lhs, manualAssetBalanceDeltas[asset]);
        return uint256(balance);
    }

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public virtual override view returns (AssetBalance[] memory assetBalances, uint256 debt);

    /**
     * @notice By default, we assume there is no checkpoint required for a strategy
     * So just return the `latestAssetBalances()`
     * A strategy can override this if on-chain functions are required to run to force balance
     * updates first.
     */
    function checkpointAssetBalances() external virtual override returns (AssetBalance[] memory assetBalances, uint256 debt) {
        (assetBalances, debt) = latestAssetBalances();
        emit AssetBalancesCheckpoint(assetBalances, debt);
    }

    /**
     * @notice Governance can recover any token from the strategy.
     */
    function recoverToken(address token, address to, uint256 amount) external virtual override onlyElevatedAccess {
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

}