pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (interfaces/v2/ITempleStrategyManager.sol)

// Governs the debt ceilings of each strategy
interface ITempleStrategyManager {

    struct StrategyConfig {
        /// @dev Whether this address is enabled as a valid strategy.
        bool isEnabled;

        /// @dev Governance can pause borrows
        bool borrowPaused;

        /// @dev Governance can pause repayments
        bool repaysPaused;

        /// @dev Governance nominates this strategy to be shutdown.
        /// The strategy then needs to unwind and call shutdown() when ready.
        bool isShuttingDown;

        /// @dev The total amount of dUSD the strategy can borrow.
        /// Note: The strategy may end up accruing more debt than this ceiling as it accrues
        uint256 debtCeiling;

        /// @dev When the strategies totalEquity() is below this amount then operators
        /// should consider unwinding positions and paying down debt.
        /// A soft limit for reporting purposes only.
        uint256 underperformingEquityThreshold;
    }

    /**
     *
     * VIEW FUNCTIONS
     *
     */

    /// API version to help with future integrations/migrations
    function apiVersion() external pure returns (string memory);

    /// @notice The address of the stables token used to base the debt token and all strategies asset value
    /// @dev eg DAI
    function stableToken() external view returns (address);

    /// @notice The address of the internal debt token used by all strategies
    /// @dev eg dUSD
    function internalDebtToken() external view returns (address);

    /// @notice A helper to collate information about a given strategy.
    /// @dev Note the current assets may not be 100% up to date, as some strategies may need to checkpoint based
    /// on the underlying strategy protocols (eg DSR for DAI would need to checkpoint to get the latest valuation)
    function strategyDetails(address strategy) external view returns (
        string memory strategyName,
        string memory strategyVersion,
        uint256 debtCeilingAmount,
        uint256 latestTotalEquity,
        uint256 latestAssetsValue,
        uint256 currentDebtAmount,
        bool isUnderPerforming
    );

    /// @notice The total cap on how much a strategy can borrow
    /// @dev Note: The strategy may end up accruing more debt than this ceiling
    function debtCeiling(address strategy) external view returns (uint256);

    /// @notice availableToBorrow = debtCeiling - currentDebt;
    function availableToBorrow(address strategy) external view returns (uint256);

    /**
     *
     * WRITE FUNCTIONS WHICH GOVERNANCE/DELEGATE CALLS
     *
     */

    /// Governance can pause all strategy borrow and repays
    function globalSetPaused(bool borrow, bool repay) external;

    /// Governance can add a new strategy
    function addNewStrategy(address strategy, uint256 debtCeiling) external;

    /// @notice Governance can update the debt ceiling for a given strategy
    function setStrategyDebtCeiling(address strategy, uint256 newDebtCeiling) external;

    /// @notice Checkpoint each of the strategies such that they calculate the latest accurate assets/liabilities
    /// @dev Each strategy should do this itself - this is a helper in case we need to schedule it centrally - eg daily/weekly for all.
    function markToMarket(address[] memory strategy) external;

    /// @notice Set whether borrows and repayments are paused for a given strategy.
    function setPaused(address strategy, bool pauseBorrow, bool pauseRepay) external;

    /// @notice Governance sets whether a strategy is slated for shutdown.
    /// The strategy (or governance) then needs to call shutdown as a separate call.
    function setStrategyIsShuttingDown(address strategy, bool isShuttingDown) external;

    /**
     *
     * WRITE FUNCTIONS WHICH STRATEGIES CALL
     *
     */

    /// @notice A strategy calls to request more funding.
    /// @dev This will revert if the strategy requests more stables than it's able to borrow.
    /// The debtTokenAmount will be minted 1:1 for the amount of stables.
    function borrow(uint256 stablesAmount) external returns (uint256 debtTokenAmount);

    /// @notice A strategy calls to paydown it's debt
    /// This will pull the stables, and will burn the equivalent amount of dUSD from the strategy.
    function repay(uint256 stablesAmount) external returns (uint256 debtTokenAmount);

    /// @notice A strategy calls to paydown all of it's debt
    /// This will pull the equivalent amount of stables for the entire dUSD balance of the strategy, and burn the dUSD.
    function repayAll() external returns (uint256 debtTokenAmount);

    /// @notice A strategy calls when it shuts down (or governance forces it). 
    /// isShuttingDown must be true.
    /// 1/ The strategy is responsible for unwinding all it's positions first.
    /// 2/ The nominated stables are pulled from the caller and used to pay off as much of the strategies debt as possible
    /// 3/ Any remaining debt is a realised loss (bad debt). This debt is then wiped.
    /// 4/ Any remaining stables are a realised profit.
    function shutdown(address strategy, uint256 stablesAmount) external;

}