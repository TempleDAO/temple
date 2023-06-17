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
    AssetBalanceDelta[] internal _manualAdjustments;

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
        if (_trv == address(0)) revert CommonEventsAndErrors.InvalidAddress();

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
     * @notice The Strategy Executor may set manual adjustments to asset balances
     * if they cannot be reported automatically - eg a staked position with no receipt token.
     */
    function setManualAdjustments(
        AssetBalanceDelta[] memory adjustments
    ) external virtual onlyElevatedAccess {
        delete _manualAdjustments;
        uint256 _length = adjustments.length;
        for (uint256 i; i < _length; ++i) {
            _manualAdjustments.push(adjustments[i]);
        }
        emit ManualAdjustmentsSet(adjustments);
    }

    /**
     * @notice Get the set of manual adjustment deltas, set by the Strategy Executor.
     */
    function manualAdjustments() public virtual view returns (
        AssetBalanceDelta[] memory adjustments
    ) {
        return _manualAdjustments;
    }

    /**
     * @notice The strategy's current asset balances, any manual adjustments and the current debt
     * of the strategy.
     * 
     * This will be used to report equity performance: `sum($assetValue +- $manualAdj) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     * along with formulating the union of asset balances and manual adjustments
     */
    function balanceSheet() public virtual override view returns (
        AssetBalance[] memory assetBalances, 
        AssetBalanceDelta[] memory manAdjustments, 
        uint256 debt
    ) {
        return (
            latestAssetBalances(), 
            _manualAdjustments,
            internalDebtToken.balanceOf(address(this))
        );
    }

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds.
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public virtual override view returns (
        AssetBalance[] memory assetBalances
    );

    /**
     * @notice By default, we assume there is no checkpoint required for a strategy
     * In which case it would be identical to just calling `latestAssetBalances()`
     *
     * A strategy can override this if on-chain functions are required to run to force balance
     * updates first - eg checkpoint DSR
     */
    function checkpointAssetBalances() external virtual override returns (
        AssetBalance[] memory
    ) {
        return latestAssetBalances();
    }

    /**
     * @notice populate data required for shutdown - for example quote data.
     * This may/may not be required in order to do a shutdown. For example to avoid frontrunning/MEV
     * quotes to exit an LP position may need to be obtained off-chain prior to the actual shutdown.
     * Each strategy can abi encode params that it requires.
     * @dev Intentionally not a view - as some quotes require a non-view (eg Balancer)
     * The intention is for clients to call as 'static', like a view
     */
    function populateShutdownData(
        bytes memory populateParamsData
    ) external virtual override returns (
        bytes memory shutdownParamsData
    // solhint-disable-next-line no-empty-blocks
    ) {
        // Not implemented by default.
    }

    function automatedShutdown(
        bytes memory shutdownParamsData
    ) external virtual override onlyElevatedAccess returns (
        uint256 stablesRepaid
    ) {
        // Instruct the underlying strategy to liquidate
        doShutdown(shutdownParamsData);

        // NB: solc warns that this is unreachable - but that's a bug and not true
        // It's a a virtual function where not all implementations revert (eg DsrBaseStrategy)
        
        // Repay any stables back to the TRV
        stablesRepaid = stableToken.balanceOf(address(this));
        if (stablesRepaid != 0) {
            treasuryReservesVault.repay(stablesRepaid, address(this));
        }
 
        emit Shutdown(stablesRepaid);

        // Now mark as shutdown in the TRV.
        // This will only succeed if governance has first set the strategy to `isShuttingDown`
        treasuryReservesVault.shutdown(address(this));
    }  

    function doShutdown(
        bytes memory shutdownParams
    ) internal virtual;

    /**
     * @notice Governance can recover any token from the strategy.
     */
    function recoverToken(
        address token, 
        address to, 
        uint256 amount
    ) external virtual override onlyElevatedAccess {
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }
}