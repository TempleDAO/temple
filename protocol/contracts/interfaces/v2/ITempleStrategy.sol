pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (interfaces/v2/ITempleStrategy.sol)

// Common functions which each strategy in V2 will need to implement.
// Primarily for reporting purposes only.
interface ITempleStrategy {
    /**
     *
     * VIEW FUNCTIONS
     *
     */

    /// API version to help with future integrations/migrations
    function apiVersion() external pure returns (string memory);

    /// A string representation of the strategy
    function strategyName() external pure returns (string memory);

    /// The version of this particular strategy
    function strategyVersion() external pure returns (string memory);

    /// @notice The latest checkpoint of total equity (latestAssetsValue - latestInternalDebt)
    /// Where:
    ///    assets = Latest checkpoint of value of assets in this strategy
    ///    debt   = The latest checkpoint of the internal Temple debt this strategy has accrued
    ///             The same as `dUSD.balanceOf(strategy)`
    ///             NB: the internal debt tokens won't be transferrable - Strategy Manager & GOV can mint/burn.
    ///    equity = assets - debt
    function latestTotalEquity() external view returns (uint256 equity, uint256 assets, uint256 debt);

    /**
     *
     * WRITE FUNCTIONS
     *
     */

    /// @dev Calculate the latest assets and liabilities and checkpoint
    /// eg For DAI's DSR, we need to checkpoint to get the latest total.
    function markToMarket() external returns (uint256 equity, uint256 assets, uint256 debt);

    /// @notice Governance can call to shutdown this strategy. It must be set to 'isShuttingDown' in the StrategyManager first.
    /// 1/ All positions must be unwound before calling - which will be specific to the underlying strategy.
    /// 2/ The strategy manager should have max allowance to pull stables. Any stables are used to pay off dUSD
    /// 3/ Any remaining dUSD is a realised loss (bad debt).
    /// 4/ Any remaining stables are a realised profit.
    function shutdown() external;
}