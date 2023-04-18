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
    event TreasuryReservesVaultSet(address indexed trv);
    event Shutdown(uint256 stablesRecovered);
    event EquityCheckpoint(int256 equity, uint256 assets, uint256 debt);
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
     * @notice The current dUSD debt of this strategy
     */
    function currentDebt() external view returns (uint256);

    /**
     * @notice The latest checkpoint of total equity (latestAssetsValue - latestInternalDebt)
     *  Where:
     *     assets = Latest checkpoint of value of assets in this strategy
     *     debt   = The latest checkpoint of the internal Temple debt this strategy has accrued
     *              The same as `dUSD.balanceOf(strategy)`
     *     equity = assets - debt. This could be negative.
     */
    function latestEquityCheckpoint() external view returns (int256 equity, uint256 assets, uint256 debt);

    /**
     * @notice Calculate the latest assets and liabilities and checkpoint
     * eg For DAI's Savings Rate contract, we need to call a writable function to get the latest total.
     */
    function checkpointEquity() external returns (int256 equity, uint256 assets, uint256 debt);

    /**
     * @notice The strategy executor can shutdown this strategy, only after Governance has 
     * marked the strategy as `isShuttingDown` in the TRV.
     * This should handle all liquidations and send all funds back to the TRV, and will then call `TRV.shutdown()`
     * to apply the shutdown.
     */
    function automatedShutdown() external;
}