pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/ITreasuryReservesVault.sol)

/**
 * @title Treasury Reserves Vault (TRV)
 *
 * @notice Temple has various strategies which utilise the treasury funds to generate 
 * profits for token holders.
 * 
 * The maximum amount of funds allocated to each strategy is determined by governance, 
 * and then each strategy can borrow/repay as required (up to the cap).
 * 
 * When strategies borrow funds, they are issued `dUSD`, an accruing debt token representing
 * the debt to the temple treasury. This is used to compare strategies performance, where
 * we can determine an equity value (assets - debt).
 */
interface ITreasuryReservesVault {

    struct StrategyConfig {
        /// @dev Whether this address is enabled as a valid strategy.
        bool isEnabled;

        /// @dev Governance can pause borrows
        bool borrowPaused;

        /// @dev Governance can pause repayments
        bool repaysPaused;

        /// @dev Governance nominates this strategy to be shutdown.
        /// The strategy executor then needs to unwind (may be manual) 
        /// and the strategy needs to then call shutdown() when ready.
        bool isShuttingDown;

        /// @dev The strategy can borrow up to this limit of accrued debt.
        /// `dUSD` is minted on any borrows 1:1 and then accrues interest
        /// When a strategy repays, the `dUSD` is burned 1:1
        uint256 debtCeiling;

        /// @dev Each strategy will have a different threshold of expected performance.
        /// This underperforming threshold is used for reporting to determine if the strategy is underperforming.
        uint256 underperformingEquityThreshold;
    }

    /**
     *
     * VIEW FUNCTIONS
     *
     */

    /// API version to help with future integrations/migrations
    function apiVersion() external pure returns (string memory);

    /// @notice The address of the stable token (eg DAI) used to value all strategy's assets and debt.
    function stableToken() external view returns (address);

    /// @notice The address of the internal debt token used by all strategies.
    function internalDebtToken() external view returns (address);

    /// @notice A helper to collate information about a given strategy for reporting purposes.
    /// @dev Note the current assets may not be 100% up to date, as some strategies may need to checkpoint based
    /// on the underlying strategy protocols (eg DSR for DAI would need to checkpoint to get the latest valuation).
    function strategyDetails(address strategy) external view returns (
        string memory name,
        string memory version,
        StrategyConfig memory config,
        uint256 estimateTotalEquity,
        uint256 estimateAssetsValue,
        uint256 debtBalance
    );

    /// @notice availableToBorrow = debtCeiling - debtBalance;
    function availableToBorrow(address strategy) external view returns (uint256);

    /**
     *
     * WRITE FUNCTIONS WHICH GOVERNANCE/DELEGATE CAN CALL
     *
     */

    /// Governance can pause all strategy borrow and repays
    function globalSetPaused(bool borrow, bool repay) external;

    /// @notice Set whether borrows and repayments are paused for a given strategy.
    function strategySetPaused(address strategy, bool borrow, bool repay) external;

    /// Governance can add a new strategy
    function addNewStrategy(address strategy, uint256 debtCeiling, uint256 underperformingEquityThreshold) external;

    /// @notice Governance can update the debt ceiling for a given strategy
    function setStrategyDebtCeiling(address strategy, uint256 newDebtCeiling) external;

    /// @notice Governance can update other config for a strategy
    function setStrategyConfig(address strategy, uint256 underperformingEquityThreshold) external;

    /// @notice Checkpoint each of the strategies such that they calculate the latest value of their assets and debt.
    /// @dev Each strategy should do this itself - this is a helper in case we need to schedule it centrally - eg daily/weekly for all.
    function markToMarket(address[] memory strategys) external;

    /// @notice Governance sets whether a strategy is slated for shutdown.
    /// The strategy (or governance) then needs to call shutdown as a separate call once ready.
    function setStrategyIsShuttingDown(address strategy, bool isShuttingDown) external;

    /**
     *
     * WRITE FUNCTIONS WHICH STRATEGIES CAN CALL
     *
     */

    /// @notice A strategy calls to request more funding.
    /// @dev This will revert if the strategy requests more stables than it's able to borrow.
    /// `dUSD` will be minted 1:1 for the amount of stables borrowed
    function borrow(uint256 stablesAmount) external;

    /// @notice A strategy calls to paydown it's debt
    /// This will pull the stables, and will burn the equivalent amount of dUSD from the strategy.
    function repay(uint256 stablesAmount) external;

    /// @notice A strategy calls to paydown all of it's debt
    /// This will pull the stables for the entire dUSD balance of the strategy, and burn the dUSD.
    function repayAll() external;

    /// @notice A strategy calls when it shuts down (or governance forces it). 
    /// isShuttingDown must be true.
    /// 1/ The strategy is responsible for unwinding all it's positions first.
    /// 2/ The nominated stables are pulled from the caller and used to pay off as much of the strategies debt as possible
    /// 3/ Any remaining debt is a realised loss (bad debt). This debt is then wiped.
    /// 4/ Any remaining stables are a realised profit.
    function shutdown(address strategy, uint256 stablesAmount) external;
}