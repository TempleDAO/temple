pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/strategies/ITempleStrategy.sol)

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";

/**
 * @title Temple Strategy
 * @notice The Temple Strategy is responsible for borrowing funds from the Treasury Reserve Vault
 * and generating positive equity from that capital.
 * 
 * When it borrows funds it is issued systematic debt (`dUSD`) which accrues interest at a common base rate
 * plus a risk premium rate specific to this strategy, agreed and set by governance.
 *
 * The strategy reports it's assets (total available funds in investments) and it's debt (`dUSD`)
 * in order to report the equity of the strategy -- ie a comparable performance metric across all strategy's.
 *
 * The Strategy Executor role is responsible for applying the capital within the strategy, and can borrow funds from
 * the TRV up to a cap (set by governance). Similarly the Executor is responsible for operations - borrow/repay/liquidate/etc.
 *
 * The strategy can be shutdown - first by Governance giving the go-ahead by setting it to `isShuttingDown` in the TRV
 * and then the Executor can either:
 *   a/ Graceful shutdown, where any liquidation can happen automatically
 *   b/ Force shutdown, where the Executor needs to handle any liquidations manually and send funds back to Treasury first.
 */
interface ITempleStrategy {
    struct AssetBalance {
        address asset;
        uint256 balance;
    }

    struct AssetBalanceDelta {
        address asset;
        int256 delta;
    }

    event TreasuryReservesVaultSet(address indexed trv);
    event Shutdown(uint256 stablesRecovered);
    event AssetBalancesCheckpoint(AssetBalance[] assetBalances, uint256 debt);
    event ManualAssetBalanceDeltasSet(AssetBalanceDelta[] assetDeltas);
    
    error InvalidVersion(string expected, string actual);
    error OnlyTreasuryReserveVault(address caller);
    error Unimplemented();
    error InvalidAssetBalanceDelta(address asset, uint256 balance, int256 manualAssetBalanceDelta);

    /**
     * @notice API version to help with future integrations/migrations
     */
    function apiVersion() external view returns (string memory);

    /**
     * @notice A human readable name of the strategy
     */
    function strategyName() external view returns (string memory);

    /**
     * @notice The version of this particular strategy
     */
    function strategyVersion() external view returns (string memory);

    /**
     * @notice The address of the treasury reserves vault.
     */
    function treasuryReservesVault() external view returns (ITreasuryReservesVault);

    /**
     * @notice Governance can set the address of the treasury reserves vault.
     */
    function setTreasuryReservesVault(address _trv) external;

    /**
     * @notice The address of the stable token (eg DAI) used to value all strategy's assets and debt.
     */
    function stableToken() external view returns (IERC20);

    /**
     * @notice The address of the internal debt token used by all strategies.
     */
    function internalDebtToken() external view returns (ITempleDebtToken);

    /**
     * @notice The Strategy Executor may set manual updates to asset balances
     * if they cannot be reported automatically - eg a staked position with no receipt token.
     */
    function manualAssetBalanceDeltas(address asset) external view returns (int256);

    /**
     * @notice The current dUSD debt of this strategy
     */
    function currentDebt() external view returns (uint256);

    /**
     * @notice How much this strategy is free to borrow from the Treasury Reserves Vault
     * @dev This is bound by:
     *   1/ How much stables is globally available (in the TRV + in the TRV base strategy)
     *   2/ The amount this individual strategy is whitelisted to borrow.
     */
    function availableToBorrow() external view returns (uint256);

    /**
     * @notice The Strategy Executor may set manual updates to asset balances
     * if they cannot be reported automatically - eg a staked position with no receipt token.
     * 
     * @dev It is up to the Strategy implementation to add these deltas to the `latestAssetBalances()`
     * and `checkpointAssetBalances()` functions.
     */
    function setManualAssetBalanceDeltas(AssetBalanceDelta[] calldata assetDeltas) external;

    /**
     * @notice Get the set of manual asset balance deltas, set by the Strategy Executor.
     */
    function getManualAssetBalanceDeltas() external view returns (AssetBalanceDelta[] memory assetDeltas);

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() external view returns (AssetBalance[] memory assetBalances, uint256 debt);

    /**
     * @notice Update each asset balance this stratgy holds, prior to returning those balances 
     * and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev If the strategy's balances are always 'current', and no checkpoint is required
     * this just returns `latestAssetBalances()`.
     */
    function checkpointAssetBalances() external returns (AssetBalance[] memory assetBalances, uint256 debt);

    /**
     * @notice The strategy executor can shutdown this strategy, only after Governance has 
     * marked the strategy as `isShuttingDown` in the TRV.
     * This should handle all liquidations and send all funds back to the TRV, and will then call `TRV.shutdown()`
     * to apply the shutdown.
     */
    function automatedShutdown() external returns (uint256 stablesReturned);

    /**
     * @notice Governance can recover any token from the strategy.
     */
    function recoverToken(address token, address to, uint256 amount) external;
}