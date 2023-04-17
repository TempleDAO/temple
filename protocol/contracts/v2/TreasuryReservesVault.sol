pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/TreasuryReservesVault.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { Governable } from "contracts/common/access/Governable.sol";

//
// next @todo : base strategy handling -- a threshold balance + pull from the baseStrategy
//

contract TreasuryReservesVault is ITreasuryReservesVault, Governable {
    using SafeERC20 for IERC20;
    string public constant API_VERSION = "1.0.0";

    /**
     * @notice The configuration for a given strategy
     */
    mapping(address => StrategyConfig) public override strategies;

    /**
     * @notice True if all borrows are paused for all strategies.
     */
    bool public override globalBorrowPaused;

    /**
     * @notice True if all repayments are paused for all strategies.
     */
    bool public override globalRepaysPaused;

    /**
     * @notice The address of the stable token (eg DAI) used to value all strategy's assets and debt.
     */
    IERC20 public immutable override stableToken;

    /**
     * @notice The address of the internal debt token used by all strategies.
     */
    ITempleDebtToken public immutable override internalDebtToken;

    constructor(
        address _initialGov,
        address _stableToken,
        address _internalDebtToken
    ) Governable(_initialGov)
    {
        stableToken = IERC20(_stableToken);
        internalDebtToken = ITempleDebtToken(_internalDebtToken);
    }

    /**
     * @notice Track the deployed version of this contract. 
     */
    function apiVersion() external pure override returns (string memory) {
        return API_VERSION;
    }

    /**
     * @notice A helper to collate information about a given strategy for reporting purposes.
     * @dev Note the current assets may not be 100% up to date, as some strategies may need to checkpoint based
     * on the underlying strategy protocols (eg DSR for DAI would need to checkpoint to get the latest valuation).
     */
    function strategyDetails(address strategyAddr) external override view returns (
        string memory name,
        string memory version,
        StrategyConfig memory config,
        int256 estimateTotalEquity,
        uint256 estimateAssetsValue,
        uint256 debtBalance
    ) {
        ITempleStrategy _strategy = ITempleStrategy(strategyAddr);
        config = strategies[strategyAddr];
        name = _strategy.strategyName();
        version = _strategy.strategyVersion();
        (estimateTotalEquity, estimateAssetsValue, debtBalance) = _strategy.latestEquityCheckpoint();
    }

    /**
     * @notice availableToBorrow = debtCeiling - debtBalance;
     */
    function availableToBorrow(address strategy) external override view returns (uint256) {
        return _availableToBorrow(strategy, strategies[strategy].debtCeiling);
    }

    function _availableToBorrow(address strategyAddr, uint256 debtCeiling) internal view returns (uint256) {
        uint256 _currentDebt = internalDebtToken.balanceOf(strategyAddr);
        return _currentDebt > debtCeiling ? 0 : debtCeiling - _currentDebt;
    }

    /**
     * Governance can pause all strategy borrow and repays
     */
    function globalSetPaused(bool _borrow, bool _repays) external override onlyGov {
        emit GlobalPausedSet(_borrow, _repays);
        globalBorrowPaused = _borrow;
        globalRepaysPaused = _repays;
    }

    /**
     * @notice Set whether borrows and repayments are paused for a given strategy.
     */
    function strategySetPaused(address _strategy, bool _borrow, bool _repays) external override onlyGov {
        StrategyConfig storage config = strategies[_strategy];
        if (!config.isEnabled) revert NotEnabled();
        emit StrategyPausedSet(_strategy, _borrow, _repays);
        config.borrowPaused = _borrow;
        config.repaysPaused = _repays;
    }

    /**
     * Governance can add a new strategy
     */
    function addNewStrategy(address strategy, uint256 debtCeiling, uint256 underperformingEquityThreshold) external override onlyGov {
        StrategyConfig storage config = strategies[strategy];
        if (config.isEnabled) revert AlreadyEnabled();
        if (debtCeiling == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        if (underperformingEquityThreshold == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        config.isEnabled = true;
        config.debtCeiling = debtCeiling;
        config.underperformingEquityThreshold = underperformingEquityThreshold;
        emit NewStrategyAdded(strategy, debtCeiling, underperformingEquityThreshold);
    }

    /**
     * @notice Governance can update the debt ceiling for a given strategy
     */
    function setStrategyDebtCeiling(address strategy, uint256 newDebtCeiling) external override onlyGov {
        StrategyConfig storage config = strategies[strategy];
        if (!config.isEnabled) revert NotEnabled();
        if (newDebtCeiling == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit DebtCeilingUpdated(strategy, config.debtCeiling, newDebtCeiling);
        config.debtCeiling = newDebtCeiling;
    }

    /**
     * @notice Governance can update the underperforming equity threshold.
     */
    function setStrategyUnderperformingThreshold(address strategy, uint256 underperformingEquityThreshold) external override onlyGov {
        StrategyConfig storage config = strategies[strategy];
        if (!config.isEnabled) revert NotEnabled();
        if (underperformingEquityThreshold == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit UnderperformingEquityThresholdUpdated(strategy, config.underperformingEquityThreshold, underperformingEquityThreshold);
        config.underperformingEquityThreshold = underperformingEquityThreshold;
    }

    /**
     * @notice Checkpoint each of the strategies such that they calculate the latest value of their assets and debt.
     * @dev Each strategy should do this itself - this is a helper in case we need to schedule it centrally - eg daily/weekly for all.
     */
    function checkpointEquity(address[] memory strategyAddrs) external override {
        uint256 length = strategyAddrs.length;
        for (uint256 i; i < length; ++i) {
            ITempleStrategy(strategyAddrs[i]).checkpointEquity();
        }
    }

    /**
     * @notice Governance sets whether a strategy is slated for shutdown.
     * The strategy (or governance) then needs to call shutdown as a separate call once ready.
     */
    function setStrategyIsShuttingDown(address strategy, bool isShuttingDown) external override onlyGov {
        StrategyConfig storage config = strategies[strategy];
        if (!config.isEnabled) revert NotEnabled();
        emit StrategyIsShuttingDownSet(strategy, isShuttingDown);
        config.isShuttingDown = isShuttingDown;
    }

    /**
     * @notice A strategy calls to request more funding.
     * @dev This will revert if the strategy requests more stables than it's able to borrow.
     * `dUSD` will be minted 1:1 for the amount of stables borrowed
     */
    function borrow(uint256 stablesAmount) external override {
        if (globalBorrowPaused) revert BorrowPaused();

        StrategyConfig storage config = strategies[msg.sender];
        if (!config.isEnabled) revert NotEnabled();
        if (config.isShuttingDown) revert StrategyIsShutdown();
        if (config.borrowPaused) revert BorrowPaused();

        // This is not allowed to take them over the debt ceiling
        uint256 available = _availableToBorrow(msg.sender, config.debtCeiling);
        if (stablesAmount > available) revert TooMuchDebt(available, stablesAmount);

        emit Borrow(msg.sender, stablesAmount);

        // Mint new dUSD and send the strategy the stables.
        internalDebtToken.mint(msg.sender, stablesAmount);
        stableToken.safeTransfer(msg.sender, stablesAmount);
    }

    /**
     * @notice A strategy calls to paydown it's debt
     * This will pull the stables, and will burn the equivalent amount of dUSD from the strategy.
     */
    function repay(uint256 stablesAmount) external override {
        _repay(msg.sender, internalDebtToken.balanceOf(msg.sender), stablesAmount);
    }

    /**
     * @notice A strategy calls to paydown all of it's debt
     * This will pull the stables for the entire dUSD balance of the strategy, and burn the dUSD.
     */
    function repayAll() external override {
        uint256 _currentDebt = internalDebtToken.balanceOf(msg.sender);
        _repay(msg.sender, _currentDebt, _currentDebt);
    }

    function _repay(address strategyAddr, uint256 currentDebt, uint256 repayAmount) internal {
        if (globalRepaysPaused) revert RepaysPaused();

        StrategyConfig storage config = strategies[strategyAddr];
        if (!config.isEnabled) revert NotEnabled();
        if (config.isShuttingDown) revert StrategyIsShutdown();
        if (config.repaysPaused) revert RepaysPaused();

        if (repayAmount > currentDebt) revert DebtOverpayment(currentDebt, repayAmount);

        emit Repay(strategyAddr, repayAmount);

        // Pull the stables and burn the dUSD
        stableToken.safeTransferFrom(strategyAddr, address(this), repayAmount);
        internalDebtToken.burn(strategyAddr, repayAmount);
    }

    /**
     * @notice A strategy calls when it shuts down (or governance forces it). 
     * isShuttingDown must be true.
     * 1/ The strategy is responsible for unwinding all it's positions first.
     * 2/ The nominated stables are pulled from the caller and used to pay off as much of the strategies debt as possible
     * 3/ Any remaining debt is a realised loss (bad debt). This debt is then wiped.
     * 4/ Any remaining stables are a realised profit.
     */
    function shutdown(address strategyAddr, uint256 stablesRecovered) external override {
        if (!(msg.sender == _gov || msg.sender == strategyAddr)) revert OnlyGovOrStrategy();

        StrategyConfig storage config = strategies[strategyAddr];
        if (!config.isEnabled) revert NotEnabled();
        if (!config.isShuttingDown) revert NotShuttingDown();

        // Burn any existing debt.
        uint256 _currentDebt = internalDebtToken.balanceOf(msg.sender);
        internalDebtToken.burn(strategyAddr, _currentDebt);

        uint256 _remainingBadDebt = stablesRecovered > _currentDebt ? 0 : _currentDebt - stablesRecovered;
        uint256 _remainingProfit = stablesRecovered > _currentDebt ? stablesRecovered - _currentDebt : 0;
        emit StrategyShutdown(strategyAddr, stablesRecovered, _remainingBadDebt, _remainingProfit);

        config.isEnabled = false;

        // @todo How to handle bad debt...?
        // Is doing via events good enough (where we just burn the debt)?
    }

    /**
     * @notice Recover any token from the debt token
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyGov {
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

}