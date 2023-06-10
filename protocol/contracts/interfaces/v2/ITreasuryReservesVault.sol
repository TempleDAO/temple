pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/ITreasuryReservesVault.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { ITempleStrategy, ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";

/**
 * @title Treasury Reserves Vault (TRV)
 *
 * @notice Temple has various strategies which utilise the treasury funds to generate 
 * gains for token holders.
 * 
 * The maximum amount of funds allocated to each strategy is determined by governance, 
 * and then each strategy can borrow/repay as required (up to the cap).
 * 
 * When strategies borrow funds, they are issued `dUSD`, an accruing debt token representing
 * the debt to the temple treasury. This is used to compare strategies performance, where
 * we can determine an equity value (assets - debt).
 */
interface ITreasuryReservesVault is ITempleElevatedAccess {
    event GlobalPausedSet(bool borrow, bool repay);
    event StrategyPausedSet(address indexed strategy, bool borrow, bool repay);
    event NewStrategyAdded(address indexed strategy, uint256 debtCeiling, int256 underperformingEquityThreshold);
    event DebtCeilingUpdated(address indexed strategy, uint256 oldDebtCeiling, uint256 newDebtCeiling);
    event UnderperformingEquityThresholdUpdated(address indexed strategy, int256 oldThreshold, int256 newThreshold);
    event StrategyIsShuttingDownSet(address indexed strategy, bool isShuttingDown);
    event StrategyShutdown(address indexed strategy, uint256 stablesRecovered, uint256 debtBurned);
    event BaseStrategySet(address indexed baseStrategy);

    event Borrow(address indexed strategy, address indexed recipient, uint256 stablesAmount);
    event Repay(address indexed strategy, address indexed from, uint256 stablesAmount);
    // event RepayTemple(address indexed strategy, address indexed from, uint256 templeBurned, uint256 debtBurned);
    event RealisedGain(address indexed strategy, uint256 amount);
    event RealisedLoss(address indexed strategy, uint256 amount);
    event TreasuryPriceIndexSet(uint256 oldTpi, uint256 newTpi);

    error NotEnabled();
    error AlreadyEnabled();
    error BorrowPaused();
    error RepaysPaused();
    error StrategyIsShutdown();
    error DebtCeilingBreached(uint256 available, uint256 borrowAmount);
    error DebtOverpayment(uint256 current, uint256 repayAmount);
    error NotShuttingDown();

    struct Strategy {
        /**
         * @notice Whether this address is enabled as a valid strategy.
         */
        bool isEnabled;

        /**
         * @notice Pause borrows
         */
        bool borrowPaused;

        /**
         * @notice Pause repayments
         */
        bool repaysPaused;

        /**
         * @notice Governance nominates this strategy to be shutdown.
         * The strategy executor then needs to unwind (may be manual) 
         * and the strategy needs to then call shutdown() when ready.
         */
        bool isShuttingDown;

        /**
         * @notice The strategy can borrow up to this limit of accrued debt.
         * `dUSD` is minted on any borrows 1:1 and then accrues interest
         * When a strategy repays, the `dUSD` is burned 1:1
         */
        uint256 debtCeiling;

        /**
         * @notice Each strategy will have a different threshold of expected performance.
         * This underperforming threshold is used for reporting to determine if the strategy is underperforming.
         */
        int256 underperformingEquityThreshold;
    }

    /**
     * @notice True if all borrows are paused for all strategies.
     */
    function globalBorrowPaused() external view returns (bool);

    /**
     * @notice True if all repayments are paused for all strategies.
     */
    function globalRepaysPaused() external view returns (bool);

    /**
     * @notice The configuration for a given strategy
     */
    function strategies(address strategyAddress) external view returns (
        bool isEnabled,
        bool borrowPaused,
        bool repaysPaused,
        bool isShuttingDown,
        uint256 debtCeiling,
        int256 underperformingEquityThreshold
    );

    /**
     * @notice The base strategy used to keep transient vault deposits
     */
    function baseStrategy() external view returns (ITempleBaseStrategy);

    /**
     * @notice Set the base strategy
     */
    function setBaseStrategy(address _baseStrategy) external;

    /**
     * @notice The Treasury Price Index, used within strategies.
     */
    function treasuryPriceIndex() external view returns (uint256);

    /**
     * @notice The decimal precision of 'tpi'/Temple Price index
     * @dev Decimal precision for 'tpi', 9880 == $0.988, precision = 4
     */
    // solhint-disable-next-line func-name-mixedcase
    function TPI_DECIMALS() external view returns (uint256);

    /**
     * @notice Set the Treasury Price Index (TPI)
     */
    function setTreasuryPriceIndex(uint256 value) external;

    /**
     * API version to help with future integrations/migrations
     */
    function apiVersion() external pure returns (string memory);

    /**
     * @notice The address of the Temple token.
     */
    function templeToken() external view returns (ITempleERC20Token);

    /**
     * @notice The address of the stable token (eg DAI) used to value all strategy's assets and debt.
     */
    function stableToken() external view returns (IERC20);

    /**
     * @notice The address of the internal debt token used by all strategies.
     */
    function internalDebtToken() external view returns (ITempleDebtToken);

    /**
     * @notice When strategies are shutdown, all remaining stables are recovered
     * and outstanding debt is burned.
     * This leaves a net balance of positive or negative equity, which is tracked.
     * @dev Total current equity == totalRealisedGainOrLoss + 
                                    SUM(strategy.equity() for strategy in active strategies)
     */
    function totalRealisedGainOrLoss() external view returns (int256);

    /**
     * @notice A helper to collate information about a given strategy for reporting purposes.
     * @dev Note the current assets may not be 100% up to date, as some strategies may need to checkpoint based
     * on the underlying strategy protocols (eg DSR for DAI would need to checkpoint to get the latest valuation).
     */
    function strategyDetails(address strategy) external view returns (
        string memory name,
        string memory version,
        Strategy memory strategyData,
        ITempleStrategy.AssetBalance[] memory assetBalances,
        ITempleStrategy.AssetBalanceDelta[] memory manualAdjustments, 
        uint256 debtBalance
    );

    /**
     * @notice The current max debt ceiling that a strategy is allowed to borrow up to.
     */
    function strategyDebtCeiling(address strategy) external view returns (uint256);

    /**
     * @notice The total available stables, both as a balance in this contract and
     * any available to withdraw from the baseStrategy
     */
    function totalAvailableStables() external view returns (uint256);

    /**
     * @notice A strategy's current amount borrowed, and how much remaining is free to borrow
     * @dev The remaining amount free to borrow is bound by:
     *   1/ How much stables is globally available (in this contract + in the base strategy)
     *   2/ The amount each individual strategy is whitelisted to borrow.
     * @return currentDebt The current debt position for the strategy, 
     * @return availableToBorrow The remaining amount which the strategy can borrow
     * @return debtCeiling The debt ceiling of the stratgy
     */
    function strategyBorrowPosition(address strategy) external view returns (
        uint256 currentDebt, 
        uint256 availableToBorrow,
        uint256 debtCeiling
    );

    /**
     * Pause all strategy borrow and repays
     */
    function globalSetPaused(bool borrow, bool repays) external;

    /**
     * @notice Set whether borrows and repayments are paused for a given strategy.
     */
    function strategySetPaused(address strategy, bool borrow, bool repays) external;

    /**
     * Add a new strategy
     */
    function addNewStrategy(address strategy, uint256 debtCeiling, int256 underperformingEquityThreshold) external;

    /**
     * @notice Update the debt ceiling for a given strategy
     */
    function setStrategyDebtCeiling(address strategy, uint256 newDebtCeiling) external;

    /**
     * @notice Update the underperforming equity threshold.
     */
    function setStrategyUnderperformingThreshold(address strategy, int256 underperformingEquityThreshold) external;

    /**
     * @notice Checkpoint each of the strategies such that they calculate the latest value of their assets and debt.
     * @dev Each strategy should do this itself - this is a helper in case we need to schedule it centrally - eg daily/weekly for all.
     */
    function checkpointAssetBalances(address[] memory strategyAddrs) external;

    /**
     * @notice The first step in a two-phase shutdown. Executor first sets whether a strategy is slated for shutdown.
     * The strategy then needs to call shutdown as a separate call once ready.
     */
    function setStrategyIsShuttingDown(address strategy, bool isShuttingDown) external;

    /**
     * @notice A strategy calls to request more funding.
     * @dev This will revert if the strategy requests more stables than it's able to borrow.
     * `dUSD` will be minted 1:1 for the amount of stables borrowed
     */
    function borrow(uint256 borrowAmount, address recipient) external;

    /**
     * @notice A strategy calls to request the most funding it can.
     * @dev This will revert if the strategy requests more stables than it's able to borrow.
     * `dUSD` will be minted 1:1 for the amount of stables borrowed
     */
    function borrowMax(address recipient) external returns (uint256);

    /**
     * @notice A strategy calls to paydown it's debt
     * This will pull the stables, and will burn the equivalent amount of dUSD from the strategy.
     */
    function repay(uint256 repayAmount, address strategy) external;

    /**
     * @notice A strategy calls to paydown all of it's debt
     * This will pull the stables for the entire dUSD balance of the strategy, and burn the dUSD.
     */
    function repayAll(address strategy) external returns (uint256 amountRepaid);

    function repayTemple(uint256 repayAmount, address strategy) external;

    /**
     * @notice The second step in a two-phase shutdown. A strategy (automated) or executor (manual) calls
     * to effect the shutdown. isShuttingDown must be true for the strategy first.
     * The strategy executor is responsible for unwinding all it's positions first and sending stables to the TRV.
     * All outstanding dUSD debt is burned, leaving a net gain/loss of equity for the shutdown strategy.
     */
    function shutdown(address strategy, uint256 stablesRecovered) external;   
}