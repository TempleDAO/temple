pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/TreasuryReservesVault.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITreasuryPriceIndexOracle } from "contracts/interfaces/v2/ITreasuryPriceIndexOracle.sol";
import { ITempleStrategy, ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

/**
 * @title Treasury Reserves Vault (TRV)
 *
 * @notice Temple has various strategies which utilise the treasury funds to generate 
 * gains for token holders.
 * 
 * The maximum amount of funds allocated to each strategy is determined by governance, 
 * and then each strategy can borrow/repay as required (up to the cap).
 * 
 * When strategies borrow funds, they are issued `dToken`, an accruing debt token representing
 * the debt to the temple treasury. This is used to compare strategies performance, where
 * we can determine an equity value (assets - debt).
 *
 *    Strategies can borrow different types of tokens from the TRV, and are minted equivalent internal debt tokens eg:
 *      DAI => minted dUSD
 *      TEMPLE => minted dTEMPLE
 *      ETH => minted dETH
 *   
 *   Each of the dTokens are compounding at different risk free rates, eg:
 *      dUSD: At DAIs Savings Rate (DSR)
 *      dTEMPLE: 0% interest (no opportunity cost)
 *      dETH: ~avg LST rate
 *   
 *   And so each token which can be borrowed has separate config on how to pull/deposit idle funds.
 *   For example, this may be:
 *      DAI => DSR base strategy
 *      TEMPLE => direct Temple mint/burn 
 *      ETH => just hold in a vault
 */
contract TreasuryReservesVault is ITreasuryReservesVault, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    string private constant API_VERSION = "1.0.0";

    /**
     * @notice The configuration for a given strategy
     */
    mapping(address => StrategyConfig) public override strategies;

    /**
     * @notice The list of all strategies currently added to the TRV
     */
    EnumerableSet.AddressSet internal _strategySet;

    /**
     * @notice The configuration for a given token which can be borrowed by strategies
     */
    mapping(IERC20 => BorrowTokenConfig) public override borrowTokens;

    /**
     * @notice The list of all tokens which can be borrowed by the TRV
     */
    EnumerableSet.AddressSet internal _borrowTokenSet;

    /**
     * @notice A strategy may pay off more than it's entire debt token balance, 
     * in which case the TRV maintains a 'credit' balance which will contribute
     * towards realised gain/loss at full liquidation.
     * These credits are also a contributing factor to the strategy equity calculations.
     */
    mapping(address => mapping(IERC20 => uint256)) public override strategyTokenCredits;

    /**
     * @notice True if all borrows are paused for all strategies.
     */
    bool public override globalBorrowPaused;

    /**
     * @notice True if all repayments are paused for all strategies.
     */
    bool public override globalRepaysPaused;

    /**
     * @notice The Treasury Price Index Oracle
     */
    ITreasuryPriceIndexOracle public override tpiOracle;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _tpiOracle
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        tpiOracle = ITreasuryPriceIndexOracle(_tpiOracle);
    }

    /**
     * @notice Set the borrow token configuration. 
     * @dev This can either add a new token or update an existing token.
     */
    function setBorrowToken(
        IERC20 token, 
        address baseStrategy,
        uint256 baseStrategyWithdrawalBuffer,
        uint256 baseStrategyDepositThreshold,
        address dToken
    ) external override onlyElevatedAccess {
        if (address(token) == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        if (address(dToken) == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        if (baseStrategyDepositThreshold < baseStrategyWithdrawalBuffer) revert CommonEventsAndErrors.InvalidParam();

        emit BorrowTokenSet(address(token), baseStrategy, baseStrategyWithdrawalBuffer, baseStrategyDepositThreshold, dToken);
        borrowTokens[token] = BorrowTokenConfig({
            baseStrategy: ITempleBaseStrategy(baseStrategy),
            baseStrategyWithdrawalBuffer: baseStrategyWithdrawalBuffer,
            baseStrategyDepositThreshold: baseStrategyDepositThreshold,
            dToken: ITempleDebtToken(dToken)
        });
        _borrowTokenSet.add(address(token));
    }

    /**
     * @notice Remove the borrow token configuration. 
     */
    function removeBorrowToken(
        IERC20 token
    ) external override onlyElevatedAccess {
        if (!_borrowTokenSet.contains(address(token))) revert BorrowTokenNotEnabled();
        emit BorrowTokenRemoved(address(token));
        delete borrowTokens[token];
        _borrowTokenSet.remove(address(token));
    }

    /**
     * @notice Set the Treasury Price Index (TPI) Oracle
     */
    function setTpiOracle(address newTpiOracle) external override onlyElevatedAccess {
        if (address(newTpiOracle) == address(0)) revert CommonEventsAndErrors.InvalidAddress();

        ITreasuryPriceIndexOracle _tpiOracle = ITreasuryPriceIndexOracle(newTpiOracle);
        if (_tpiOracle.treasuryPriceIndex() == 0) revert CommonEventsAndErrors.InvalidParam();

        emit TpiOracleSet(newTpiOracle);
        tpiOracle = _tpiOracle;
    }

    /**
     * @notice Pause all strategy borrow and repays
     */
    function setGlobalPaused(bool _pauseBorrow, bool _pauseRepays) external override onlyElevatedAccess {
        emit GlobalPausedSet(_pauseBorrow, _pauseRepays);
        globalBorrowPaused = _pauseBorrow;
        globalRepaysPaused = _pauseRepays;
    }

    /**
     * @dev sum(debt ceiling, credits) need to be checked that they don't overflow, on write.
     */
    function _checkAddOverflow(uint256 a, uint256 b) internal pure {
        a + b;
    }

    /**
     * @notice Register a new strategy which can borrow tokens from Treasury Reserves
     */
    function addStrategy(
        address strategy, 
        int256 underperformingEquityThreshold,
        ITempleStrategy.AssetBalance[] calldata debtCeiling
    ) external override onlyElevatedAccess {
        if (!_strategySet.add(strategy)) revert AlreadyEnabled();
        emit StrategyAdded(strategy, underperformingEquityThreshold);

        StrategyConfig storage strategyConfig = strategies[strategy];
        strategyConfig.underperformingEquityThreshold = underperformingEquityThreshold;

        ITempleStrategy.AssetBalance calldata _assetBalance;
        uint256 _length = debtCeiling.length;
        IERC20 _token;
        for (uint256 i; i < _length; ++i) {
            _assetBalance = debtCeiling[i];
            _token = IERC20(_assetBalance.asset);
            emit DebtCeilingUpdated(
                strategy, 
                address(_token), 
                strategyConfig.debtCeiling[_token], 
                _assetBalance.balance
            );

            if (!_borrowTokenSet.contains(address(_token))) revert BorrowTokenNotEnabled();
            strategyConfig.debtCeiling[_token] = _assetBalance.balance;
            strategyConfig.enabledBorrowTokens[_token] = true;
        }
    }

    /**
     * @notice Enable and/or disable tokens which a strategy can borrow from the (configured) TRV borrow tokens
     */
    function updateStrategyEnabledBorrowTokens(
        address strategy, 
        IERC20[] calldata enableBorrowTokens, 
        IERC20[] calldata disableBorrowTokens
    ) external override onlyElevatedAccess {
        StrategyConfig storage _strategyConfig = _getStrategyConfig(strategy);

        uint256 i;
        IERC20 token;
        uint256 _length = enableBorrowTokens.length;
        for (; i < _length; ++i) {
            token = enableBorrowTokens[i];
            if (!_borrowTokenSet.contains(address(token))) revert BorrowTokenNotEnabled();
            _strategyConfig.enabledBorrowTokens[token] = true;
        }

        _length = disableBorrowTokens.length;
        for (i = 0; i < _length; ++i) {
            // Don't need to validate that the borrow token is configured when disabling.
            _strategyConfig.enabledBorrowTokens[disableBorrowTokens[i]] = false;
        }
    }

    /**
     * @notice Set whether borrows and repayments are paused for a given strategy.
     */
    function setStrategyPaused(address strategy, bool pauseBorrow, bool pauseRepays) external override onlyElevatedAccess {
        StrategyConfig storage _strategyConfig = _getStrategyConfig(strategy);
        emit StrategyPausedSet(strategy, pauseBorrow, pauseRepays);
        _strategyConfig.borrowPaused = pauseBorrow;
        _strategyConfig.repaysPaused = pauseRepays;
    }

    /**
     * @notice Update the debt ceiling for a given strategy
     */
    function setStrategyDebtCeiling(address strategy, IERC20 token, uint256 newDebtCeiling) external override onlyElevatedAccess {
        if (!_borrowTokenSet.contains(address(token))) revert BorrowTokenNotEnabled();
        StrategyConfig storage _strategyConfig = _getStrategyConfig(strategy);
        if (!_strategyConfig.enabledBorrowTokens[token]) revert BorrowTokenNotEnabled();

        emit DebtCeilingUpdated(strategy, address(token), _strategyConfig.debtCeiling[token], newDebtCeiling);

        // Revert if the debt ceiling + credit overflows
        _checkAddOverflow(newDebtCeiling, strategyTokenCredits[strategy][token]);

        _strategyConfig.debtCeiling[token] = newDebtCeiling;

        ITempleStrategy(strategy).debtCeilingUpdated(token, newDebtCeiling);
    }

    /**
     * @notice Update the underperforming equity threshold.
     */
    function setStrategyUnderperformingThreshold(address strategy, int256 underperformingEquityThreshold) external override onlyElevatedAccess {
        StrategyConfig storage _strategyConfig = _getStrategyConfig(strategy);

        emit UnderperformingEquityThresholdUpdated(strategy, _strategyConfig.underperformingEquityThreshold, underperformingEquityThreshold);
        _strategyConfig.underperformingEquityThreshold = underperformingEquityThreshold;
    }
    
    /**
     * @notice The first step in a two-phase shutdown. Executor first sets whether a strategy is slated for shutdown.
     * The strategy then needs to call shutdown as a separate call once ready.
     */
    function setStrategyIsShuttingDown(address strategy, bool isShuttingDown) external override onlyElevatedAccess {
        StrategyConfig storage _strategyConfig = _getStrategyConfig(strategy);
        emit StrategyIsShuttingDownSet(strategy, isShuttingDown);
        _strategyConfig.isShuttingDown = isShuttingDown;
    }

    /**
     * @notice The second step in a two-phase shutdown. A strategy (automated) or executor (manual) calls
     * to effect the shutdown. isShuttingDown must be true for the strategy first.
     * The strategy executor is responsible for unwinding all it's positions first and sending stables to the TRV.
     * All outstanding dToken debt is burned, leaving a net gain/loss of equity for the shutdown strategy.
     */
    function shutdown(address strategy) external override {
        if (msg.sender != strategy && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();

        StrategyConfig storage _strategyConfig = _getStrategyConfig(strategy);
        if (!_strategyConfig.isShuttingDown) revert NotShuttingDown();

        // Burn any remaining dToken debt.
        IERC20 _token;
        mapping(IERC20 => uint256) storage credits = strategyTokenCredits[strategy];
        uint256 _length = _borrowTokenSet.length();
        uint256 _outstandingDebt;
        for (uint256 i; i < _length; ++i) {
            _token = IERC20(_borrowTokenSet.at(i));
            _outstandingDebt = borrowTokens[_token].dToken.burnAll(strategy);
            emit StrategyShutdownCreditAndDebt({
                strategy: strategy,
                token: address(_token), 
                outstandingCredit: credits[_token], 
                outstandingDebt: _outstandingDebt
            });

            // Clean up the debtCeiling approvals for this borrow token.
            // Old borrow ceilings may not be removed, but not an issue
            delete _strategyConfig.debtCeiling[_token];
            delete _strategyConfig.enabledBorrowTokens[_token];
            delete credits[_token];
        }

        // Remove the strategy
        emit StrategyRemoved(strategy);

        // Required since the debt ceiling above is a nested mapping. 
        // It's been cleaned up as much as possible.
        // slither-disable-next-line mapping-deletion
        delete strategies[strategy];
        _strategySet.remove(strategy);
    }

    /**
     * @notice Recover any token from the TRV
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyElevatedAccess {
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice A strategy calls to request more funding.
     * @dev This will revert if the strategy requests more stables than it's able to borrow.
     * `dToken` will be minted 1:1 for the amount of stables borrowed
     */
    function borrow(IERC20 token, uint256 borrowAmount, address recipient) external override {
        BorrowTokenConfig storage _tokenConfig = _getBorrowTokenConfig(token);
        StrategyConfig storage _strategyConfig = _getStrategyConfig(msg.sender);
        if (!_strategyConfig.enabledBorrowTokens[token]) revert BorrowTokenNotEnabled();
        uint256 _dTokenBalance = _tokenConfig.dToken.balanceOf(msg.sender);

        // This is not allowed to take the borrower over the debt ceiling
        uint256 available = _availableForStrategyToBorrow(msg.sender, _strategyConfig, token, _dTokenBalance);
        if (borrowAmount > available) revert DebtCeilingBreached(available, borrowAmount);

        _borrow(msg.sender, token, recipient, _tokenConfig, _strategyConfig, borrowAmount, _dTokenBalance);
    }

    /**
     * @notice A strategy calls to request the most funding it can.
     * @dev This will revert if the strategy requests more stables than it's able to borrow.
     * `dToken` will be minted 1:1 for the amount of stables borrowed
     */
    function borrowMax(IERC20 token, address recipient) external override returns (uint256 borrowedAmount) {
        BorrowTokenConfig storage _tokenConfig = _getBorrowTokenConfig(token);
        StrategyConfig storage _strategyConfig = _getStrategyConfig(msg.sender);
        if (!_strategyConfig.enabledBorrowTokens[token]) revert BorrowTokenNotEnabled();
        uint256 _dTokenBalance = _tokenConfig.dToken.balanceOf(msg.sender);
        borrowedAmount = _availableForStrategyToBorrow(msg.sender, _strategyConfig, token, _dTokenBalance);
        _borrow(msg.sender, token, recipient, _tokenConfig, _strategyConfig, borrowedAmount, _dTokenBalance);
    }

    /**
     * @notice A strategy calls to paydown it's debt
     * This will pull the stables, and will burn the equivalent amount of dToken from the strategy.
     */
    function repay(IERC20 token, uint256 repayAmount, address strategy) external override {
        BorrowTokenConfig storage _tokenConfig = _getBorrowTokenConfig(token);
        uint256 _dTokenBalance = _tokenConfig.dToken.balanceOf(strategy);
        _repay(msg.sender, strategy, token, _tokenConfig, repayAmount, _dTokenBalance);
        _depositIntoBaseStrategy(token, _tokenConfig, strategy);
    }

    /**
     * @notice A strategy calls to paydown all of it's debt
     * This will pull the stables for the entire dToken balance of the strategy, and burn the dToken.
     */
    function repayAll(IERC20 token, address strategy) external override returns (uint256 amountRepaid) {
        BorrowTokenConfig storage _tokenConfig = _getBorrowTokenConfig(token);
        amountRepaid = _tokenConfig.dToken.balanceOf(strategy);
        _repay(msg.sender, strategy, token, _tokenConfig, amountRepaid, amountRepaid);
        _depositIntoBaseStrategy(token, _tokenConfig, strategy);
    }

    /**
     * @notice Track the deployed version of this contract. 
     */
    function apiVersion() external pure override returns (string memory) {
        return API_VERSION;
    }

    /**
     * @notice The list of all tokens which can be borrowed by the TRV
     */
    function borrowTokensList() external view returns (address[] memory) {
        return _borrowTokenSet.values();
    }

    /**
     * @notice The Treasury Price Index - the target price of the Treasury, in `stableToken` terms.
     */
    function treasuryPriceIndex() external view override returns (uint96) {
        return tpiOracle.treasuryPriceIndex();
    }

    /**
     * @notice A helper to collate information about a given strategy for reporting purposes.
     * @dev Note the current assets may not be 100% up to date, as some strategies may need to checkpoint based
     * on the underlying strategy protocols (eg DSR for DAI would need to checkpoint to get the latest valuation).
     */
    function strategyDetails(address strategy) external override view returns (
        string memory name,
        string memory version,
        bool borrowPaused,
        bool repaysPaused,
        bool isShuttingDown,
        int256 underperformingEquityThreshold,
        ITempleStrategy.AssetBalance[] memory debtCeiling
    ) {
        ITempleStrategy _strategy = ITempleStrategy(strategy);
        StrategyConfig storage strategyConfig = _getStrategyConfig(strategy);
        name = _strategy.strategyName();
        version = _strategy.strategyVersion();
        borrowPaused = strategyConfig.borrowPaused;
        repaysPaused = strategyConfig.repaysPaused;
        isShuttingDown = strategyConfig.isShuttingDown;
        underperformingEquityThreshold = strategyConfig.underperformingEquityThreshold;

        address _token;
        uint256 _length = _borrowTokenSet.length();
        debtCeiling = new ITempleStrategy.AssetBalance[](_length);
        for (uint256 i; i < _length; ++i) {
            _token = _borrowTokenSet.at(i);
            debtCeiling[i] = ITempleStrategy.AssetBalance(_token, strategyConfig.debtCeiling[IERC20(_token)]);
        }
    }

    /**
     * @notice A strategy's current asset balances, any manual adjustments and the current debt
     * of the strategy.
     * 
     * This will be used to report equity performance: `sum($assetValue +- $manualAdj) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     * along with formulating the union of asset balances and manual adjustments
     */
    function strategyBalanceSheet(address strategy) external override view returns (
        ITempleStrategy.AssetBalance[] memory assetBalances,
        ITempleStrategy.AssetBalanceDelta[] memory manualAdjustments, 
        ITempleStrategy.AssetBalance[] memory dTokenBalances,
        ITempleStrategy.AssetBalance[] memory dTokenCreditBalances
    ) {
        ITempleStrategy _strategy = ITempleStrategy(strategy);
        assetBalances = _strategy.latestAssetBalances();
        manualAdjustments = _strategy.manualAdjustments();

        uint256 _length = _borrowTokenSet.length();
        dTokenBalances = new ITempleStrategy.AssetBalance[](_length);
        dTokenCreditBalances = new ITempleStrategy.AssetBalance[](_length);
        address _token;
        mapping(IERC20 => uint256) storage _strategyTokenCredits = strategyTokenCredits[strategy];
        for (uint256 i; i < _length; ++i) {
            _token = _borrowTokenSet.at(i);
            dTokenBalances[i] = ITempleStrategy.AssetBalance(_token, borrowTokens[IERC20(_token)].dToken.balanceOf(strategy));
            dTokenCreditBalances[i] = ITempleStrategy.AssetBalance(_token, _strategyTokenCredits[IERC20(_token)]);
        }
    }

    /**
     * @notice The total available balance available to be borrowed, both as a balance in this contract and
     * any available to withdraw from the baseStrategy
     */
    function totalAvailable(IERC20 token) external override view returns (uint256) {
        BorrowTokenConfig storage _tokenConfig = _getBorrowTokenConfig(token);

        uint256 baseStrategyAvailable;
        ITempleBaseStrategy _baseStrategy = _tokenConfig.baseStrategy;

        // Pull the available from the baseStrategy if it's set.
        if (address(_baseStrategy) != address(0)) {
            ITempleStrategy.AssetBalance[] memory assetBalances = _baseStrategy.latestAssetBalances();

            // The base strategy will only have one Asset balance, which should be the requested token
            if (assetBalances.length != 1 || assetBalances[0].asset != address(token)) revert CommonEventsAndErrors.InvalidParam();
            baseStrategyAvailable = assetBalances[0].balance;
        }

        return token.balanceOf(address(this)) + baseStrategyAvailable;
    }

    /**
     * @notice The amount remaining that a strategy can borrow for a given token
     * taking into account: the approved debt ceiling, current dToken debt, and any credits
     * @dev available == min(ceiling - debt + credit, 0)
     */
    function availableForStrategyToBorrow(
        address strategy, 
        IERC20 token
    ) external override view returns (uint256) {
        BorrowTokenConfig storage _tokenConfig = _getBorrowTokenConfig(token);
        uint256 _dTokenBalance = _tokenConfig.dToken.balanceOf(strategy);
        StrategyConfig storage _strategyConfig = _getStrategyConfig(strategy);
        if (!_strategyConfig.enabledBorrowTokens[token]) revert BorrowTokenNotEnabled();
        return _availableForStrategyToBorrow(strategy, _strategyConfig, token, _dTokenBalance);
    }

    /**
     * @notice The list of all strategies currently added to the TRV
     */
    function strategiesList() external override view returns (address[] memory) {
        return _strategySet.values();
    }

    /**
     * @notice The current max debt ceiling that a strategy is allowed to borrow up to.
     */
    function strategyDebtCeiling(address strategy, IERC20 token) external override view returns (uint256) {
        if (!_borrowTokenSet.contains(address(token))) revert BorrowTokenNotEnabled();
        StrategyConfig storage _strategyConfig = _getStrategyConfig(strategy);
        if (!_strategyConfig.enabledBorrowTokens[token]) revert BorrowTokenNotEnabled();
        return _strategyConfig.debtCeiling[token];
    }

    /**
     * @notice Whether a token is enabled to be borrowed for a given strategy
     */
    function strategyEnabledBorrowTokens(address strategy, IERC20 token) external override view returns (bool) {
        return _getStrategyConfig(strategy).enabledBorrowTokens[token];
    }

    /// @dev Calculate the amount remaining that a strategy can borrow for a given token
    /// taking the allowed ceiling, current dToken debt, and any credits into consideration
    function _availableForStrategyToBorrow(
        address strategy,
        StrategyConfig storage strategyConfig,
        IERC20 token,
        uint256 dTokenBalance
    ) internal view returns (uint256) {
        // available == max(ceiling + credit - debt, 0)
        uint256 _ceiling = strategyConfig.debtCeiling[token];
        uint256 _credit = strategyTokenCredits[strategy][token];

        unchecked {
            // The sum of debtCeiling and credits cannot overflow as they're verified upon write.
            uint256 _totalAvailable = _ceiling + _credit;

            return _totalAvailable > dTokenBalance
                ? _totalAvailable - dTokenBalance
                : 0;
        } 
    }

    function _borrow(
        address strategy, 
        IERC20 token, 
        address recipient, 
        BorrowTokenConfig storage tokenConfig, 
        StrategyConfig storage strategyConfig, 
        uint256 borrowAmount,
        uint256 dTokenBalance
    ) internal {
        // slither-disable-next-line incorrect-equality
        if (borrowAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        if (globalBorrowPaused) revert BorrowPaused();
        if (strategyConfig.borrowPaused) revert BorrowPaused();
        if (strategyConfig.isShuttingDown) revert StrategyIsShutdown();

        emit Borrow(strategy, address(token), recipient, borrowAmount);

        // Mint any required dToken (after taking into consideration any credits)
        _mintDToken(strategy, token, tokenConfig, borrowAmount, dTokenBalance);

        // Source the token from the baseStrategy and send to the strategy.
        _withdrawFromBaseStrategy(strategy, token, tokenConfig, recipient, borrowAmount);
    }
    
    /**
     * @dev Pull tokens from the defined base strategy for this token config.
     * If the base strategy isn't set, or the requesting strategy IS the base strategy, then
     * this is a no-op. Token are sent directly from the TRV (this contract)
     */
    function _withdrawFromBaseStrategy(
        address strategy,
        IERC20 token, 
        BorrowTokenConfig storage tokenConfig, 
        address recipient, 
        uint256 amount
    ) internal {
        ITempleBaseStrategy _baseStrategy = tokenConfig.baseStrategy;
        address _baseStrategyAddr = address(_baseStrategy);
        uint256 _balance = token.balanceOf(address(this));
        if (_baseStrategyAddr != address(0) && _baseStrategyAddr != strategy) {
            // There may be idle tokens sitting idle in the TRV (ie these are not yet deposited into the baseStrategy)
            // So use these first, and only then fallback to pulling the rest from base strategy.
            uint256 _withdrawFromBaseStrategyAmount;
            unchecked {
                _withdrawFromBaseStrategyAmount = _balance > amount ? 0 : amount - _balance;
            }

            // Pull any remainder required from the base strategy.
            if (_withdrawFromBaseStrategyAmount > 0) {
                // So there aren't lots of small withdrawals, pull the amount required for this transaction
                // plus the threshold amount. Then future borrows don't need to withdraw from base every time.
                _withdrawFromBaseStrategyAmount += tokenConfig.baseStrategyWithdrawalBuffer;

                // The amount actually withdrawn may be less than requested
                // as it's capped to any actual remaining balance in the base strategy
                uint256 _withdrawnAmount = _baseStrategy.trvWithdraw(_withdrawFromBaseStrategyAmount);

                // Burn the dTokens from the base strategy.
                if (_withdrawnAmount > 0) {
                    _balance += _withdrawnAmount;

                    _burnDToken(
                        _baseStrategyAddr, 
                        strategies[_baseStrategyAddr], 
                        token, 
                        tokenConfig, 
                        _withdrawnAmount, 
                        tokenConfig.dToken.balanceOf(_baseStrategyAddr)
                    );
                }
            }
        }

        // The tokens are transferred straight from TRV, no withdrawal from the base strategy
        // Do an extra check that it at least has the requested amount in case the token isn't a standard ERC20 which already does a check.
        if (amount > _balance) revert CommonEventsAndErrors.InsufficientBalance(address(token), amount, _balance);

        // Finally send the stables.
        token.safeTransfer(recipient, amount);
    }

    /**
     * @dev Increase the dToken debt balance by `toMintAmount`. 
     * Use up any available 'token credits' first, and only mint the balance outstanding.
     */
    function _mintDToken(
        address strategy, 
        IERC20 token, 
        BorrowTokenConfig storage tokenConfig, 
        uint256 toMintAmount,
        uint256 dTokenBalance
    ) internal {
        mapping(IERC20 => uint256) storage _tokenCredits = strategyTokenCredits[strategy];
        uint256 _creditBalance = _tokenCredits[token];

        if (toMintAmount > _creditBalance) {
            // Mint new dToken for the amount not covered by prior credit balance credit
            uint256 _newDebt;
            unchecked {
                _newDebt = toMintAmount - _creditBalance;

                // Safe to be unchecked as it's also overflow checked within the dToken.mint() below
                dTokenBalance += _newDebt;
            }
            tokenConfig.dToken.mint(strategy, _newDebt);

            // The credit is now 0
            _tokenCredits[token] = _creditBalance = 0;
        } else {
            // Use up remaining credits
            unchecked {
              _creditBalance -= toMintAmount;
            }
            _tokenCredits[token] = _creditBalance;
        }

        emit StrategyCreditAndDebtBalance(strategy, address(token), _creditBalance, dTokenBalance);
    }

    /**
     * @dev Decrease the dToken debt balance by `toBurnAmount`. 
     * If there is no more dToken balance (ie fully repaid), then the strategy can go into 'credit'
     * which is just kept as state on this contract (no aToken is minted)
     */
    function _burnDToken(
        address strategy, 
        StrategyConfig storage strategyConfig,
        IERC20 token, 
        BorrowTokenConfig storage tokenConfig, 
        uint256 toBurnAmount,
        uint256 dTokenBalance
    ) internal {
        mapping(IERC20 => uint256) storage _tokenCredits = strategyTokenCredits[strategy];
        uint256 _creditBalance = _tokenCredits[token];

        uint256 _burnedAmount = tokenConfig.dToken.burn(strategy, toBurnAmount);
        uint256 _remaining;
        unchecked {
            dTokenBalance -= _burnedAmount;
            _remaining = toBurnAmount - _burnedAmount;
        }

        // If there is any remaining which is not burned, then the debt is now 0
        // Add the remainder as a credit.
        if (_remaining > 0) {
            unchecked {
                _creditBalance += _remaining;
            }

            // Revert if the debt ceiling + credit overflows
            _checkAddOverflow(strategyConfig.debtCeiling[token], _creditBalance);

            _tokenCredits[token] = _creditBalance;
        }

        emit StrategyCreditAndDebtBalance(strategy, address(token), _creditBalance, dTokenBalance);
    }

    function _getStrategyConfig(address strategy) internal view returns (StrategyConfig storage strategyConfig) {
        if (!_strategySet.contains(strategy)) revert StrategyNotEnabled();
        return strategies[strategy];
    }

    function _getBorrowTokenConfig(IERC20 token) internal view returns (BorrowTokenConfig storage tokenConfig) {
        if (!_borrowTokenSet.contains(address(token))) revert BorrowTokenNotEnabled();
        return borrowTokens[token];
    }

    /**
     * @dev Deposit any surplus token balances into the base strategy,
     * only when the token balance is greater than `baseStrategyDepositThreshold`
     * `baseStrategyWithdrawalBuffer` is always left for future withdrawals.
     * If the base strategy isn't set, or the requesting strategy IS the base strategy, then
     * don't do anything -- the tokens are just left in the TRV for future withdrawals.
     * 
     */
    function _depositIntoBaseStrategy(
        IERC20 token, 
        BorrowTokenConfig storage tokenConfig,
        address strategy
    ) internal {
        ITempleBaseStrategy _baseStrategy = tokenConfig.baseStrategy;
        if (address(_baseStrategy) != address(0) && address(_baseStrategy) != strategy) {
            uint256 _balance = token.balanceOf(address(this));

            // Do nothing if the balance isn't greater than the threshold
            if (_balance > tokenConfig.baseStrategyDepositThreshold) {
                unchecked {
                    _balance -= tokenConfig.baseStrategyWithdrawalBuffer;
                }

                // Mint new dTokens for this base strategy.
                uint256 _dTokenBalance = tokenConfig.dToken.balanceOf(address(_baseStrategy));
                _mintDToken(address(_baseStrategy), token, tokenConfig, _balance, _dTokenBalance);

                // Deposit the tokens into the base strategy
                token.safeTransfer(address(_baseStrategy), _balance);
                _baseStrategy.trvDeposit(_balance);
            }
        }
    }

    function _repay(
        address from, 
        address strategy, 
        IERC20 token, 
        BorrowTokenConfig storage tokenConfig, 
        uint256 repayAmount,
        uint256 dTokenBalance
    ) internal {
        // slither-disable-next-line incorrect-equality
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        if (globalRepaysPaused) revert RepaysPaused();
        StrategyConfig storage _strategyConfig = _getStrategyConfig(strategy);
        if (!_strategyConfig.enabledBorrowTokens[token]) revert BorrowTokenNotEnabled();

        if (_strategyConfig.repaysPaused) revert RepaysPaused();
        emit Repay(strategy, address(token), from, repayAmount);

        // Burn the dToken tokens / add credits
        _burnDToken(strategy, _strategyConfig, token, tokenConfig, repayAmount, dTokenBalance);

        // Pull the stables from the strategy.
        token.safeTransferFrom(from, address(this), repayAmount);
    }
}