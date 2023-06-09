pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/strategies/ITempleStrategy.sol)

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";

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
interface ITempleStrategy is ITempleElevatedAccess {
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
    event AssetBalancesCheckpoint(AssetBalance[] assetBalances);
    event ManualAdjustmentsSet(AssetBalanceDelta[] adjustments);
    
    error InvalidVersion(string expected, string actual);
    error OnlyTreasuryReserveVault(address caller);
    error Unimplemented();

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
     * @notice A strategy's current amount borrowed from the TRV, and how much remaining is free to borrow
     * @dev The remaining amount free to borrow is bound by:
     *   1/ How much stables is globally available (in this contract + in the base strategy)
     *   2/ The amount each individual strategy is whitelisted to borrow.
     * @return currentDebt The current debt position for the strategy, 
     * @return availableToBorrow The remaining amount which the strategy can borrow
     * @return debtCeiling The debt ceiling of the stratgy
     */
    function trvBorrowPosition() external view returns (
        uint256 currentDebt, 
        uint256 availableToBorrow,
        uint256 debtCeiling
    );

    /**
     * @notice The Strategy Executor may set manual adjustments to asset balances
     * if they cannot be reported automatically - eg a staked position with no receipt token.
     */
    function setManualAdjustments(AssetBalanceDelta[] memory adjustments) external;

    /**
     * @notice Get the set of manual asset balance deltas, set by the Strategy Executor.
     */
    function manualAdjustments() external view returns (AssetBalanceDelta[] memory adjustments);

    /**
     * @notice The strategy's current asset balances, any manual adjustments and the current debt
     * of the strategy.
     * 
     * This will be used to report equity performance: `sum($assetValue +- $manualAdj) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     * along with formulating the union of asset balances and manual adjustments
     */
    function balanceSheet() external view returns (
        AssetBalance[] memory assetBalances, 
        AssetBalanceDelta[] memory manAdjustments,
        uint256 debt
    );

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds.
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() external view returns (AssetBalance[] memory assetBalances);

    /**
     * @notice By default, we assume there is no checkpoint required for a strategy
     * In which case it would be identical to just calling `latestAssetBalances()`
     *
     * A strategy can override this if on-chain functions are required to run to force balance
     * updates first - eg checkpoint DSR
     */
    function checkpointAssetBalances() external returns (AssetBalance[] memory assetBalances);

    /**
     * @notice populate data required for shutdown - for example quote data.
     * This may/may not be required in order to do a shutdown. For example to avoid frontrunning/MEV
     * quotes to exit an LP position may need to be obtained off-chain prior to the actual shutdown.
     * Each strategy can abi encode params that it requires.
     * @dev Intentionally not a view - as some quotes require a non-view (eg Balancer)
     * The intention is for clients to call as 'static', like a view
     */
    function populateShutdownData(bytes memory populateParams) external returns (bytes memory shutdownParams);

    /**
     * @notice The strategy executor can shutdown this strategy, only after Governance has 
     * marked the strategy as `isShuttingDown` in the TRV.
     * This should handle all liquidations and send all funds back to the TRV, and will then call `TRV.shutdown()`
     * to apply the shutdown.
     * @dev Each strategy may require a different set of params to do the shutdown. It can abi encode/decode
     * that data off chain, or by first calling populateShutdownData()
     */
    function automatedShutdown(bytes memory shutdownParams) external returns (uint256 stablesReturned);

    /**
     * @notice Governance can recover any token from the strategy.
     */
    function recoverToken(address token, address to, uint256 amount) external;
}