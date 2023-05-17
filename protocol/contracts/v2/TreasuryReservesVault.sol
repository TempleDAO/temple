pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/TreasuryReservesVault.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITempleStrategy, ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

contract TreasuryReservesVault is ITreasuryReservesVault, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    string public constant API_VERSION = "1.0.0";

    /**
     * @notice The configuration for a given strategy
     */
    mapping(address => Strategy) public override strategies;

    /**
     * @notice The base strategy used to keep transient vault deposits
     */
    ITempleBaseStrategy public override baseStrategy;

    /**
     * @notice When withdrawing stables from the base strategy it will attempt to withdraw
     * at least this minimum threshold, so there's a buffer to save from withdrawing
     * immediately again on the next borrow.
     * @dev This is because the DSR withdrawal is relatively expensive for gas.
     */
    uint256 public baseStrategyWithdrawalThreshold;

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

    /**
     * @notice When strategies are shutdown, all remaining stables are recovered
     * and outstanding debt is burned.
     * This leaves a net balance of positive or negative equity, which is tracked.
     * @dev Total current equity == shutdownStrategyNetEquity + 
                                    SUM(strategy.equity() for strategy in active strategies)
     */
    int256 public override shutdownStrategyNetEquity;

    /**
     * @notice The Treasury Price Index, used within strategies.
     */
    uint256 public override treasuryPriceIndex;

    /**
     * @notice The decimal precision of 'tpi'/Temple Price index
     * @dev Decimal precision for 'tpi', 9880 == $0.988, precision = 4
     */
    uint256 public constant override TPI_DECIMALS = 4;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _stableToken,
        address _internalDebtToken,
        uint256 _treasuryPriceIndex
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        stableToken = IERC20(_stableToken);
        internalDebtToken = ITempleDebtToken(_internalDebtToken);
        treasuryPriceIndex = _treasuryPriceIndex;
    }

    function setBaseStrategy(address _baseStrategy) external override onlyElevatedAccess {
        baseStrategy = ITempleBaseStrategy(_baseStrategy);

        // Ensure the new base strategy has it's TRV set as this contract.
        if (address(baseStrategy.treasuryReservesVault()) != address(this)) 
            revert CommonEventsAndErrors.InvalidAddress(address(baseStrategy.treasuryReservesVault()));

        // Also check the API version matches.
        if (keccak256(abi.encodePacked(baseStrategy.apiVersion())) != keccak256(abi.encodePacked(API_VERSION)))
            revert CommonEventsAndErrors.InvalidAddress(address(baseStrategy.treasuryReservesVault()));

        emit BaseStrategySet(_baseStrategy);
    }

    /**
     * @notice Set the Treasury Price Index (TPI)
     * @dev 4dp, so 9800 = 0.98
     */
    function setTreasuryPriceIndex(uint256 value) external override onlyElevatedAccess {
        emit TreasuryPriceIndexSet(treasuryPriceIndex, value);
        treasuryPriceIndex = value;
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
        Strategy memory strategyData,
        ITempleStrategy.AssetBalance[] memory assetBalances,
        uint256 debtBalance
    ) {
        ITempleStrategy _strategy = ITempleStrategy(strategyAddr);
        strategyData = strategies[strategyAddr];
        name = _strategy.strategyName();
        version = _strategy.strategyVersion();
        (assetBalances, debtBalance) = _strategy.latestAssetBalances();
    }

    function strategyDebtCeiling(address strategy) external override view returns (uint256) {
        return strategies[strategy].debtCeiling;
    }

    /**
     * @notice The total available stables, both as a balance in this contract and
     * any available to withdraw from the baseStrategy
     */
    function totalAvailableStables() public override view returns (uint256) {
        uint256 baseStrategyAvailable;
        ITempleBaseStrategy _baseStrategy = baseStrategy;

        // Pull the available from the baseStrategy if it's set.
        if (address(_baseStrategy) != address(0)) {
            (ITempleStrategy.AssetBalance[] memory assetBalances, ) = _baseStrategy.latestAssetBalances();

            // The base strategy should only have one Asset balance, which should be the stable.
            if (assetBalances.length != 1 || assetBalances[0].asset != address(stableToken)) revert CommonEventsAndErrors.InvalidParam();

            baseStrategyAvailable = assetBalances[0].balance;
        }

        return stableToken.balanceOf(address(this)) + baseStrategyAvailable;
    }

    /**
     * @notice A strategy's current amount borrowed, and how much remaining is free to borrow
     * @dev The remaining amount free to borrow is bound by:
     *   1/ How much stables is globally available (in this contract + in the base strategy)
     *   2/ The amount each individual strategy is whitelisted to borrow.
     * @return currentDebt The current debt position for the strategy, 
     * @return availableToBorrow The remaining amount which the strategy can borrow
     * @return debtCeiling The debt ceiling of the stratgy
     */
    function strategyBorrowPosition(address strategy) external override view returns (
        uint256 currentDebt, 
        uint256 availableToBorrow,
        uint256 debtCeiling
    ) {
        return _borrowPosition(strategy, strategies[strategy].debtCeiling);
    }

    function _borrowPosition(
        address strategy, 
        uint256 debtCeiling
    ) internal view returns (
        uint256 debt, 
        uint256 available,
        uint256 ceiling
    ) {
        debt = internalDebtToken.balanceOf(strategy);

        // The debt ceiling minus the current debt (floor at 0)
        uint256 _strategyMax = debtCeiling > debt ? debtCeiling - debt : 0;

        uint256 _totalAvailableStables = totalAvailableStables();

        // The max of the max amount the strategy can borrow and the available stables in the TRV.
        available = _totalAvailableStables < _strategyMax ? _totalAvailableStables : _strategyMax;
        ceiling = debtCeiling;
    }

    /**
     * Pause all strategy borrow and repays
     */
    function globalSetPaused(bool _pauseBorrow, bool _pauseRepays) external override onlyElevatedAccess {
        emit GlobalPausedSet(_pauseBorrow, _pauseRepays);
        globalBorrowPaused = _pauseBorrow;
        globalRepaysPaused = _pauseRepays;
    }

    /**
     * @notice Set whether borrows and repayments are paused for a given strategy.
     */
    function strategySetPaused(address _strategy, bool _pauseBorrow, bool _pauseRepays) external override onlyElevatedAccess {
        Strategy storage strategyData = strategies[_strategy];
        if (!strategyData.isEnabled) revert NotEnabled();
        emit StrategyPausedSet(_strategy, _pauseBorrow, _pauseRepays);
        strategyData.borrowPaused = _pauseBorrow;
        strategyData.repaysPaused = _pauseRepays;
    }

    /**
     * Add a new strategy
     */
    function addNewStrategy(address strategy, uint256 debtCeiling, int256 underperformingEquityThreshold) external override onlyElevatedAccess {
        Strategy storage strategyData = strategies[strategy];
        if (strategyData.isEnabled) revert AlreadyEnabled();
        if (debtCeiling == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        strategyData.isEnabled = true;
        strategyData.debtCeiling = debtCeiling;
        strategyData.underperformingEquityThreshold = underperformingEquityThreshold;
        emit NewStrategyAdded(strategy, debtCeiling, underperformingEquityThreshold);
    }

    /**
     * @notice Update the debt ceiling for a given strategy
     */
    function setStrategyDebtCeiling(address strategy, uint256 newDebtCeiling) external override onlyElevatedAccess {
        Strategy storage strategyData = strategies[strategy];
        if (!strategyData.isEnabled) revert NotEnabled();
        if (newDebtCeiling == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit DebtCeilingUpdated(strategy, strategyData.debtCeiling, newDebtCeiling);
        strategyData.debtCeiling = newDebtCeiling;
    }

    /**
     * @notice Update the underperforming equity threshold.
     */
    function setStrategyUnderperformingThreshold(address strategy, int256 underperformingEquityThreshold) external override onlyElevatedAccess {
        Strategy storage strategyData = strategies[strategy];
        if (!strategyData.isEnabled) revert NotEnabled();
        if (underperformingEquityThreshold == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit UnderperformingEquityThresholdUpdated(strategy, strategyData.underperformingEquityThreshold, underperformingEquityThreshold);
        strategyData.underperformingEquityThreshold = underperformingEquityThreshold;
    }

    /**
     * @notice Checkpoint each of the strategies such that they calculate the latest value of their assets and debt.
     * @dev Each strategy should do this itself - this is a helper in case we need to schedule it centrally - eg daily/weekly for all.
     */
    function checkpointAssetBalances(address[] memory strategyAddrs) external override {
        uint256 length = strategyAddrs.length;
        for (uint256 i; i < length; ++i) {
            ITempleStrategy(strategyAddrs[i]).checkpointAssetBalances();
        }
    }

    /**
     * @notice The first step in a two-phase shutdown. Executor first sets whether a strategy is slated for shutdown.
     * The strategy then needs to call shutdown as a separate call once ready.
     */
    function setStrategyIsShuttingDown(address strategy, bool isShuttingDown) external override onlyElevatedAccess {
        Strategy storage strategyData = strategies[strategy];
        if (!strategyData.isEnabled) revert NotEnabled();
        emit StrategyIsShuttingDownSet(strategy, isShuttingDown);
        strategyData.isShuttingDown = isShuttingDown;
    }

    /**
     * @notice A strategy calls to request more funding.
     * @dev This will revert if the strategy requests more stables than it's able to borrow.
     * `dUSD` will be minted 1:1 for the amount of stables borrowed
     */
    function borrow(uint256 borrowAmount, address recipient) external override {
        Strategy storage strategyData = strategies[msg.sender];

        // This is not allowed to take the borrower over the debt ceiling
        (, uint256 available,) = _borrowPosition(msg.sender, strategyData.debtCeiling);
        if (borrowAmount > available) revert DebtCeilingBreached(available, borrowAmount);

        _borrow(msg.sender, recipient, strategyData, borrowAmount);
    }

    /**
     * @notice A strategy calls to request the most funding it can.
     * @dev This will revert if the strategy requests more stables than it's able to borrow.
     * `dUSD` will be minted 1:1 for the amount of stables borrowed
     */
    function borrowMax(address recipient) external override returns (uint256 borrowedAmount) {
        Strategy storage strategyData = strategies[msg.sender];
        (, borrowedAmount,) = _borrowPosition(msg.sender, strategyData.debtCeiling);
        _borrow(msg.sender, recipient, strategyData, borrowedAmount);
    }

    function _borrow(address strategyAddr, address recipient, Strategy storage strategyData, uint256 borrowAmount) internal {
        if (borrowAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        if (globalBorrowPaused) revert BorrowPaused();
        if (strategyData.borrowPaused) revert BorrowPaused();
        if (!strategyData.isEnabled) revert NotEnabled();
        if (strategyData.isShuttingDown) revert StrategyIsShutdown();

        emit Borrow(strategyAddr, recipient, borrowAmount);

        // Mint new dUSD, source stables from the baseStrategy and send the strategy wanting to borrow.
        internalDebtToken.mint(strategyAddr, borrowAmount);
        _withdrawAndSendStables(recipient, borrowAmount);
    }
    
    function _withdrawAndSendStables(address to, uint256 amount) internal {
        // If a baseStrategy is defined, then pull as many stables directly from this
        // contract (not yet deposited into the baseStrategy)
        // and then pull the rest from baseStrategyDeposits.
        ITempleBaseStrategy _baseStrategy = baseStrategy;
        if (address(_baseStrategy) != address(0)) {
            uint256 withdrawFromBaseStrategyAmount;
            {
                uint256 _balance = stableToken.balanceOf(address(this));
                uint256 _directTransferAmount = _balance > amount ? amount : _balance;
                withdrawFromBaseStrategyAmount = amount - _directTransferAmount;
            }

            // Pull any remainder required from the base strategy.
            // This will ensure we get at least the min threshold amount.
            if (withdrawFromBaseStrategyAmount != 0) {
                // So there aren't many small withdrawals, ensure we withdraw at least
                // some minimum threshold amount each time.
                uint256 _threshold = baseStrategyWithdrawalThreshold;
                uint256 _stablesToWithdraw = withdrawFromBaseStrategyAmount < _threshold ? _threshold : withdrawFromBaseStrategyAmount;

                // The amount actually withdrawn may be less than requested
                // as it's capped to any actual remaining balance.
                uint256 _withdrawnAmount = _baseStrategy.trvWithdraw(_stablesToWithdraw);

                // Burn that amount of dUSD from the base strategy.
                internalDebtToken.burn(address(_baseStrategy), _withdrawnAmount, true);
            }
        }

        // Finally send the stables.
        stableToken.safeTransfer(to, amount);
    }

    /**
     * @notice A strategy calls to paydown it's debt
     * This will pull the stables, and will burn the equivalent amount of dUSD from the strategy.
     */
    function repay(uint256 repayAmount) external override {
        _repay(msg.sender, repayAmount);
    }

// @todo Ability for anyone to pay debt off on behalf of strategies

    /**
     * @notice A strategy calls to paydown all of it's debt
     * This will pull the stables for the entire dUSD balance of the strategy, and burn the dUSD.
     */
    function repayAll() external override returns (uint256 amountRepaid) {
        amountRepaid = internalDebtToken.balanceOf(msg.sender);
        _repay(msg.sender, amountRepaid);
    }

    function _repay(address _strategyAddr, uint256 _repayAmount) internal {
        if (_repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        if (globalRepaysPaused) revert RepaysPaused();

        Strategy storage strategyData = strategies[_strategyAddr];
        if (!strategyData.isEnabled) revert NotEnabled();
        if (strategyData.repaysPaused) revert RepaysPaused();

        emit Repay(_strategyAddr, _repayAmount);

        // Burn the dUSD tokens. This will fail if the repayment amount is greater than the balance.
        uint256 burnedAmount = internalDebtToken.burn(_strategyAddr, _repayAmount, true);

        // Pull the stables from the strategy.
        stableToken.safeTransferFrom(_strategyAddr, address(this), _repayAmount);

        // If more stables are repaid than their total debt, then that difference is a realised gain.
        if (_repayAmount > burnedAmount) {
            uint256 gain = _repayAmount-burnedAmount;
            emit RealisedGain(_strategyAddr, gain);
            shutdownStrategyNetEquity += int256(gain);
        }
    }

    /**
     * @notice The second step in a two-phase shutdown. A strategy (automated) or executor (manual) calls
     * to effect the shutdown. isShuttingDown must be true for the strategy first.
     * The strategy executor is responsible for unwinding all it's positions first and sending stables to the TRV.
     * All outstanding dUSD debt is burned, leaving a net gain/loss of equity for the shutdown strategy.
     */
    function shutdown(address strategyAddr, uint256 stablesRecovered) external override {
        if (msg.sender != strategyAddr) validateElevatedAccess(msg.sender, msg.sig);

        Strategy storage strategyData = strategies[strategyAddr];
        if (!strategyData.isEnabled) revert NotEnabled();
        if (!strategyData.isShuttingDown) revert NotShuttingDown();

        // Burn any remaining dUSD debt.
        uint256 _remainingDebt = internalDebtToken.burnAll(strategyAddr);

        int256 _realisedGainOrLoss = int256(stablesRecovered) - int256(_remainingDebt);
        shutdownStrategyNetEquity += _realisedGainOrLoss;

        if (_realisedGainOrLoss > 0) {
            emit RealisedGain(strategyAddr, uint256(_realisedGainOrLoss));
        } else {
            emit RealisedLoss(strategyAddr, uint256(-_realisedGainOrLoss));
        }
        emit StrategyShutdown(strategyAddr, stablesRecovered, _remainingDebt);

        // Clears all config, and sets isEnabled = false
        delete strategies[strategyAddr];
    }

    /**
     * @notice Recover any token from the debt token
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyElevatedAccess {
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

}