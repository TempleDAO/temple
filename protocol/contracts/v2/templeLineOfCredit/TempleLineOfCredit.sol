pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/strategies/ITlcStrategy.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { ITempleCircuitBreakerProxy } from "contracts/interfaces/v2/circuitBreaker/ITempleCircuitBreakerProxy.sol";

import { SafeCast } from "contracts/common/SafeCast.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

/* solhint-disable not-rely-on-time */

/**
 * @title Temple Line of Credit (TLC)
 * @notice Users supply Temple as collateral, and can then borrow DAI.
 * 
 * Temple is valued at the Temple Treasury Price Index (TPI)
 * User debt increases at a continuously compounding rate.
 * Liquidations occur when users LTV exceeds the maximum allowed.
 */
contract TempleLineOfCredit is ITempleLineOfCredit, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using CompoundedInterest for uint256;

    /**
     * @notice The collateral token supplied by users/accounts
     */
    IERC20 public immutable override templeToken;

    /**
     * @notice DAI token -- the debt token which can be borrowed
     */
    IERC20 public immutable override daiToken;

    /**
     * @notice The Treasury Reserve Vault (TRV) which funds the DAI borrows to users/accounts.
     * - When users borrow, the DAI is pulled from the TRV
     *      (via the TlcStrategy, increasing the dUSD debt)
     * - When users repay, the DAI is repaid to the TRV 
     *      (reducing the dUSD debt of the TlcStrategy)
     * - When there is a liquidation, the seized Temple collateral is paid to the TRV
     *      (reducing the dTEMPLE debt of the TlcStrategy)
     */
    ITreasuryReservesVault public override treasuryReservesVault;

    /**
     * @notice The Strategy contract managing the TRV borrows and equity positions of TLC.
     */
    ITlcStrategy public override tlcStrategy;
    
    /**
     * @notice A record of the total amount of collateral deposited by users/accounts.
     */
    uint256 public override totalCollateral;

    /**
     * @notice A per user/account mapping to the data to track active collateral/debt positions.
     */
    mapping(address => AccountData) internal allAccountsData;

    /**
     * @notice Configuration and latest data snapshot of the debt tokens
     */
    DebtTokenConfig internal debtTokenConfig;
    DebtTokenData internal debtTokenData;

    /**
     * @notice Liquidations may be paused in order for users to recover/repay debt after emergency
     * actions
     */
    bool public override liquidationsPaused;

    /**
     * @notice The minimum borrow amount per transaction
     * @dev It costs gas to liquidate users, so we don't want dust amounts.
     */
    uint128 public override minBorrowAmount = 1000e18;

    /**
     * @notice New borrows and collateral withdrawals are checked against a circuit breaker
     * to ensure no more than a cap is withdrawn in a given period
     */
    ITempleCircuitBreakerProxy public immutable override circuitBreakerProxy;

    /**
     * @notice An internal state tracking how interest has accumulated.
     */
    uint256 internal constant INITIAL_INTEREST_ACCUMULATOR = 1e27;

    /**
     * @notice The precision used for Price, LTV, notional
     */
    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant DOUBLE_PRECISION = 1e36;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _circuitBreakerProxy,
        address _templeToken,
        address _daiToken, 
        uint256 _maxLtvRatio,
        address _interestRateModel
    ) 
        TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        circuitBreakerProxy = ITempleCircuitBreakerProxy(_circuitBreakerProxy);
        templeToken = IERC20(_templeToken);
        daiToken = IERC20(_daiToken);

        if (_maxLtvRatio > PRECISION) revert CommonEventsAndErrors.InvalidParam();
        if (_interestRateModel == address(0)) revert CommonEventsAndErrors.ExpectedNonZero();

        debtTokenConfig = DebtTokenConfig(
            uint96(_maxLtvRatio), 
            IInterestRateModel(_interestRateModel),
            false
        );
        debtTokenData = DebtTokenData({
            interestAccumulatorUpdatedAt: uint32(block.timestamp),
            totalDebt: 0,
            interestRate: 0,
            interestAccumulator: INITIAL_INTEREST_ACCUMULATOR
        });
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                         COLLATERAL                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice Deposit Temple as collateral
     * @param collateralAmount The amount to deposit
     * @param onBehalfOf An account can add collateral on behalf of another address.
     */
    function addCollateral(uint128 collateralAmount, address onBehalfOf) external override notInRescueMode {
        if (collateralAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit CollateralAdded(msg.sender, onBehalfOf, collateralAmount);

        allAccountsData[onBehalfOf].collateral += collateralAmount;
        totalCollateral += collateralAmount;

        // No need to check liquidity when adding collateral as it 
        // only improves the liquidity.
        templeToken.safeTransferFrom(
            msg.sender,
            address(this),
            collateralAmount 
        );
    }

    /**
     * @notice Remove Temple collateral. (active borrow positions are not allowed to go above the max LTV)
     * @param amount The amount of collateral to remove
     * @param recipient Send the Temple collateral to a specified recipient address.
     */
    function removeCollateral(uint128 amount, address recipient) external override notInRescueMode {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        AccountData storage _accountData = allAccountsData[msg.sender];
        uint128 _collateral =  _accountData.collateral;
        if (amount > _collateral) revert CommonEventsAndErrors.InvalidAmount(address(templeToken), amount);

        // Ensure that this withdrawal doesn't break the circuit breaker limits (across all users)
        circuitBreakerProxy.preCheck(
            address(templeToken), 
            msg.sender, 
            amount
        );

        // Update the collateral, and then verify that it doesn't make the debt unsafe.
        _accountData.collateral = _collateral - amount;
        totalCollateral -= amount;
        emit CollateralRemoved(msg.sender, recipient, amount);

        _checkLiquidity(_accountData, _debtTokenCacheRO());

        templeToken.safeTransfer(
            recipient,
            amount
        );
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           BORROW                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice Borrow DAI (not allowed to borrow over the max LTV)
     * @dev NOTICE: There is no buffer between the maximum the user is able to borrow 
     * (based on their collateral and the maxLTV), and the point where the user can get liquidated.
     * Therefore do not borrow the max amount possible or the position will instantly be eligable to be
     * liquidated in the next block.
     * @param amount The amount to borrow
     * @param recipient Send the borrowed token to a specified recipient address.
     */
    function borrow(uint128 amount, address recipient) external override notInRescueMode {
        if (amount < minBorrowAmount) revert InsufficientAmount(minBorrowAmount, amount);

        AccountData storage _accountData = allAccountsData[msg.sender];
        DebtTokenCache memory _cache = _debtTokenCache();
        if (_cache.config.borrowsPaused) revert Paused();

        // Ensure that this new borrow doesn't break the circuit breaker limits (across all users)
        circuitBreakerProxy.preCheck(
            address(daiToken), 
            msg.sender, 
            amount
        );

        // Apply the new borrow
        {
            uint128 _totalDebt = _currentAccountDebt(
                _cache, 
                _accountData.debtCheckpoint, 
                _accountData.interestAccumulator,
                false // don't round up on the way in
            ) + amount;

            // Update the state
            _accountData.debtCheckpoint = _totalDebt;
            _accountData.interestAccumulator = _cache.interestAccumulator;
            debtTokenData.totalDebt = _cache.totalDebt = _cache.totalDebt + amount;

            // Update the borrow interest rates based on the now increased utilization ratio
            _updateInterestRates(_cache);
        }

        emit Borrow(msg.sender, recipient, amount);
        _checkLiquidity(_accountData, _cache);

        // Finally, borrow the funds from the TRV and send the tokens to the recipient.
        tlcStrategy.fundFromTrv(amount, recipient);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            REPAY                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice An account repays some of its borrowed DAI debt
     * @param repayAmount The amount to repay. Cannot be more than the current debt.
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repay(uint128 repayAmount, address onBehalfOf) external override notInRescueMode {
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        AccountData storage _accountData = allAccountsData[onBehalfOf];
        DebtTokenCache memory _cache = _debtTokenCache();

        // Update the account's latest debt
        uint128 _newDebt = _currentAccountDebt(
            _cache, 
            _accountData.debtCheckpoint,
            _accountData.interestAccumulator,
            true // round up for repay balance
        );

        // They cannot repay more than this debt
        if (repayAmount > _newDebt) {
            revert ExceededBorrowedAmount(_newDebt, repayAmount);
        }
        unchecked {
            _newDebt -= repayAmount;
        }

        // Update storage
        _accountData.debtCheckpoint = _newDebt;
        _accountData.interestAccumulator = _cache.interestAccumulator;

        _repayToken(_cache, repayAmount, msg.sender, onBehalfOf);
    }

    /**
     * @notice An account repays all of its DAI debt
     * @dev The amount of debt is calculated as of this block.
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repayAll(address onBehalfOf) external override notInRescueMode {
        DebtTokenCache memory _cache = _debtTokenCache();
        AccountData storage _accountData = allAccountsData[onBehalfOf];

        // Get the outstanding debt for Stable
        uint128 repayAmount = _currentAccountDebt(
            _cache,
            _accountData.debtCheckpoint,
            _accountData.interestAccumulator,
            true // use the rounded up amount
        );
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        // Update storage
        _accountData.debtCheckpoint = 0;
        _accountData.interestAccumulator = _cache.interestAccumulator;

        _repayToken(_cache, repayAmount, msg.sender, onBehalfOf);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                       LIQUIDATIONS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice Liquidate one or more accounts which have exceeded the 
     * maximum allowed LTV.
     * The Temple collateral is seized, and the accounts debt wiped.
     * @dev If one of the accounts in the batch hasn't exceeded the max LTV
     * then no action is performed for that account.
     */
    function batchLiquidate(
        address[] calldata accounts
    ) external override notInRescueMode returns (
        uint128 totalCollateralClaimed,
        uint128 totalDebtWiped
    ) {
        if (liquidationsPaused) revert Paused();

        LiquidationStatus memory _status;
        DebtTokenCache memory _cache = _debtTokenCache();
        address _account;
        uint256 _numAccounts = accounts.length;
        for (uint256 i; i < _numAccounts; ++i) {
            _account = accounts[i];
            _status = _computeLiquidity(
                allAccountsData[_account], 
                _cache
            );

            // Skip if this account is still under the maxLTV
            if (_status.hasExceededMaxLtv) {
                emit Liquidated(_account, _status.collateral, _status.collateralValue, _status.currentDebt);
                totalCollateralClaimed += _status.collateral;
                totalDebtWiped += _status.currentDebt;

                // Clear the account data
                delete allAccountsData[_account];
            }
        }

        // burn the temple collateral by repaying to TRV. This will burn the equivalent dTemple debt too.
        if (totalCollateralClaimed > 0) {
            templeToken.safeIncreaseAllowance(address(treasuryReservesVault), totalCollateralClaimed);
            treasuryReservesVault.repay(templeToken, totalCollateralClaimed, address(tlcStrategy));
            totalCollateral -= totalCollateralClaimed;
        }

        // Remove debt from the totals
        if (totalDebtWiped > 0) {
            _repayTotalDebt(_cache, totalDebtWiped);
        }
    }
    
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            ADMIN                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice Liquidation may be paused in order for users to recover/repay debt after emergency
     * actions
     */
    function setLiquidationsPaused(bool isPaused) external override onlyElevatedAccess {
        liquidationsPaused = isPaused;
        emit LiquidationsPausedSet(isPaused);
    }

    /**
     * @notice Set the minimum amount of Temple which must be borrowed on each call.
     */
    function setMinBorrowAmount(uint128 amount) external override onlyElevatedAccess {
        minBorrowAmount = amount;
        emit MinBorrowAmountSet(amount);
    }

    /**
     * @notice Update the TLC Strategy contract, and Treasury Reserves Vault (TRV)
     * @dev The TRV is granted access to spend DAI, in order to repay debt.
     */
    function setTlcStrategy(
        address newTlcStrategy
    ) external override onlyElevatedAccess {
        tlcStrategy = ITlcStrategy(newTlcStrategy);

        // Remove allowance from the old TRV
        address previousTrv = address(treasuryReservesVault);
        if (previousTrv != address(0)) {
            daiToken.safeApprove(previousTrv, 0);
        }

        address _trv = address(tlcStrategy.treasuryReservesVault());
        treasuryReservesVault = ITreasuryReservesVault(_trv);

        // Set max allowance on the new TRV
        {
            daiToken.safeApprove(_trv, 0);
            daiToken.safeIncreaseAllowance(_trv, type(uint256).max);
        }

        emit TlcStrategySet(newTlcStrategy, _trv);

        // The new TRV may have a different debt ceiling. Force an update to the interest rates.
        _updateInterestRates(_debtTokenCache());
    }

    /**
     * @notice Update the interest rate model contract for DAI borrows
     * @param interestRateModel The contract address of the new model
     */
    function setInterestRateModel(
        address interestRateModel
    ) external override onlyElevatedAccess {
        emit InterestRateModelSet(interestRateModel);
        DebtTokenCache memory _cache = _debtTokenCache();

        // Update the cache entry and calculate the new interest rate based off this model.
        debtTokenConfig.interestRateModel = _cache.config.interestRateModel = IInterestRateModel(interestRateModel);
        _updateInterestRates(_cache);
    }

    /**
     * @notice Set the maximum Loan To Value Ratio allowed for DAI borrows before the position is liquidated
     * @param maxLtvRatio The max LTV ratio (18 decimal places)
     */
    function setMaxLtvRatio(
        uint256 maxLtvRatio
    ) external override onlyElevatedAccess {
        if (maxLtvRatio > PRECISION) revert CommonEventsAndErrors.InvalidParam();

        emit MaxLtvRatioSet(maxLtvRatio);
        debtTokenConfig.maxLtvRatio = uint96(maxLtvRatio);
    }

    /**
     * @notice New borrows of DAI may be paused, for example if shutting down.
     */
    function setBorrowPaused(bool isPaused) external override onlyElevatedAccess {
        emit BorrowPausedSet(isPaused);
        debtTokenConfig.borrowsPaused = isPaused;
    }

    /**
     * @notice Elevated access can recover tokens accidentally sent to this contract
     * No user Temple collateral can be taken.
     */
    function recoverToken(
        address token, 
        address to, 
        uint256 amount
    ) external override onlyElevatedAccess {
        // Can't pull any of the user collateral.
        if (token == address(templeToken)) {
            uint256 bal = templeToken.balanceOf(address(this));
            if (amount > (bal - totalCollateral)) revert CommonEventsAndErrors.InvalidAmount(token, amount);
        }

        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Update and checkpoint the total debt up until now
     * Then recalculate the interest rate based on the updated utilisation ratio.
     */
    function refreshInterestRates(
    ) external override {
        _updateInterestRates(_debtTokenCache());
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           VIEWS                            */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice An view of an accounts current and up to date position as of this block
     * @param account The account to get a position for
     */
    function accountPosition(
        address account
    ) external override view returns (
        AccountPosition memory position
    ) {
        AccountData storage _accountData = allAccountsData[account];
        DebtTokenCache memory _cache = _debtTokenCacheRO();

        position.collateral = _accountData.collateral;
        position.currentDebt = _currentAccountDebt(
            _cache, 
            _accountData.debtCheckpoint,
            _accountData.interestAccumulator,
            true
        );

        position.maxBorrow = _maxBorrowLimit(_cache, position.collateral);
        position.healthFactor = _healthFactor(_cache, position.collateral, position.currentDebt);
        position.loanToValueRatio = _loanToValueRatio(_cache, position.collateral, position.currentDebt);
    }

    /**
     * @notice Get the current total DAI debt position across all accounts
     * as of this block.
     */
    function totalDebtPosition() external override view returns (
        TotalDebtPosition memory position
    ) {
        DebtTokenCache memory _cache = _debtTokenCacheRO();
        position.utilizationRatio = _utilizationRatio(_cache);
        position.borrowRate = _cache.interestRate;
        position.totalDebt = _cache.totalDebt;
    }

    /**
     * @notice Compute the liquidity status for a set of accounts.
     * @dev This can be used to verify if accounts can be liquidated or not.
     * @param accounts The accounts to get the status for.
     */
    function computeLiquidity(
        address[] calldata accounts
    ) external override view returns (LiquidationStatus[] memory status) {
        uint256 _numAccounts = accounts.length;
        status = new LiquidationStatus[](_numAccounts);
        DebtTokenCache memory _cache = _debtTokenCacheRO();
        for (uint256 i; i < _numAccounts; ++i) {
            status[i] = _computeLiquidity(
                allAccountsData[accounts[i]], 
                _cache
            );
        }
    }

    /**
     * @notice A view of the last checkpoint of account data (not as of this block)
     */
    function accountData(
        address account
    ) external view override returns (
        AccountData memory
    ) {
        return allAccountsData[account];
    }
    
    /**
     * @notice Configuration and latest data snapshot of the DAI debt token
     */
    function debtTokenDetails() external view returns (
        DebtTokenConfig memory,
        DebtTokenData memory
    ) {
        return (debtTokenConfig, debtTokenData);
    }

    /**
     * @notice A view of the derived/internal cache data.
     */
    function getDebtTokenCache() external view returns (DebtTokenCache memory) {
        return _debtTokenCacheRO();
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                          INTERNALS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @dev An internal struct used to track the latest storage data (and new updates)
     * for a given debt token.
     * This is setup once from storage, and then reads/writes are cheap.
     */
    struct DebtTokenCache {
        /**
         * @notice This debt token's configuration.
         */
        DebtTokenConfig config;

        /**
         * @notice The total amount that has already been borrowed by all accounts.
         * This increases as interest accrues or new borrows. 
         * Decreases on repays or liquidations.
         */
        uint128 totalDebt;

        /**
         * @notice The interest rate as of the last borrow/repay/liquidation.
         * This last rate is used to accrue interest from that last action time
         * until the current block.
         */
        uint96 interestRate;

        /**
         * @notice Internal tracking of the accumulated interest as an index starting from 1.0e27
         * When this accumulator is compunded by the interest rate, the total debt can be calculated as
         * `updatedTotalDebt = prevTotalDebt * latestInterestAccumulator / prevInterestAccumulator
         */
        uint256 interestAccumulator;

        /**
         * @dev The price of this token as of this block. 
         * No external price oracles - only dependant on TPI
         */
        uint256 price;
        
        /**
         * @notice The maximum amount that the TLC Strategy is allowed to borrow from the TRV
         * @dev This puts a ceiling on the total amount allowed to be borrowed
         * by users from TLC. This is used as the denominator in the Utilisation Ratio
         * (the interest rate calcs are dependant on the UR)
         */
        uint256 trvDebtCeiling;
    }
    
    /**
     * @dev Initialize the DebtTokenCache from storage to this block, for a given token.
     */
    function _initDebtTokenCache(DebtTokenCache memory _cache) private view returns (bool dirty) {

        // Copies from storage (once)
        _cache.config = debtTokenConfig;

        _cache.interestAccumulator = debtTokenData.interestAccumulator;
        _cache.totalDebt = debtTokenData.totalDebt;
        _cache.interestRate = debtTokenData.interestRate;

        // Set the debt ceiling and price.
        {
            ITreasuryReservesVault _trv = treasuryReservesVault;
            _cache.trvDebtCeiling = _trv.strategyDebtCeiling(address(tlcStrategy), daiToken);
            _cache.price = _trv.treasuryPriceIndex();
        }
        
        // Only compound if we're on a new block
        uint32 _timeElapsed;
        unchecked {
            _timeElapsed = uint32(block.timestamp) - debtTokenData.interestAccumulatorUpdatedAt;
        }

        if (_timeElapsed > 0) {
            dirty = true;

            // Compound the accumulator
            uint256 newInterestAccumulator = _cache.interestAccumulator.continuouslyCompounded(
                _timeElapsed,
                _cache.interestRate
            );

            // Calculate the latest totalDebt from this
            _cache.totalDebt = mulDiv(
                newInterestAccumulator,
                _cache.totalDebt,
                _cache.interestAccumulator
            ).encodeUInt128();
            _cache.interestAccumulator = newInterestAccumulator;
        }
    }

    /**
     * @dev Setup the DebtTokenCache for a given token
     * Update storage if and only if the timestamp has changed since last time.
     */
    function _debtTokenCache() internal returns (
        DebtTokenCache memory cache
    ) {
        if (_initDebtTokenCache(cache)) {
            debtTokenData.interestAccumulatorUpdatedAt = uint32(block.timestamp);
            debtTokenData.totalDebt = cache.totalDebt;
            debtTokenData.interestAccumulator = cache.interestAccumulator;
        }
    }

    /**
     * @dev Setup the DebtTokenCache for a given token
     * read only -- storage isn't updated.
     */
    function _debtTokenCacheRO() internal view returns (
        DebtTokenCache memory cache
    ) {
        _initDebtTokenCache(cache);
    }

    /**
     * @dev Calculate the borrow interest rate, given the utilization ratio of the token.
     * If the rate has changed, then update storage and emit an event.
     */
    function _updateInterestRates(
        DebtTokenCache memory _cache
    ) internal {
        uint96 newInterestRate = _cache.config.interestRateModel.calculateInterestRate(
            _utilizationRatio(_cache)
        );

        // Update storage if the new rate differs from the old rate.
        if (_cache.interestRate != newInterestRate) {
            emit InterestRateUpdate(newInterestRate);
            debtTokenData.interestRate = _cache.interestRate = newInterestRate;
        }
    }

    /**
     * @dev The implementation of the debt token repayment, used by repay() and repayAll()
     */
    function _repayToken(
        DebtTokenCache memory _cache,
        uint128 _repayAmount,
        address _fromAccount,
        address _onBehalfOf
    ) internal {
        _repayTotalDebt(_cache, _repayAmount);

        emit Repay(_fromAccount, _onBehalfOf, _repayAmount);
        // NB: Liquidity doesn't need to be checked after a repay, as that only improves the health.

        // Pull the stables, and repay the TRV debt on behalf of the strategy.
        {
            daiToken.safeTransferFrom(_fromAccount, address(this), _repayAmount);
            treasuryReservesVault.repay(daiToken, _repayAmount, address(tlcStrategy));
        }
    }

    /**
     * @dev Generate the LiquidationStatus struct with current details 
     * for this account.
     */
    function _computeLiquidity(
        AccountData storage _accountData,
        DebtTokenCache memory _cache
    ) internal view returns (LiquidationStatus memory status) {
        status.collateral = _accountData.collateral;

        status.currentDebt = _currentAccountDebt(
            _cache, 
            _accountData.debtCheckpoint, 
            _accountData.interestAccumulator,
            true // round up for user reported debt
        );

        status.collateralValue = status.collateral * _cache.price / PRECISION;

        status.hasExceededMaxLtv = status.currentDebt > _maxBorrowLimit(
            _cache,
            status.collateral
        );
    }

    /**
     * @dev Check if this account is to be liquidated given the current
     * account, debt token and market conditions.
     * Revert if the account has exceeded the maximum LTV
     */
    function _checkLiquidity(AccountData storage _accountData, DebtTokenCache memory _cache) internal view {
        LiquidationStatus memory _status = _computeLiquidity(
            _accountData,
            _cache
        );
        if (_status.hasExceededMaxLtv) {
            revert ExceededMaxLtv(_status.collateral, _status.collateralValue, _status.currentDebt);
        }
    }

    /**
     * @dev Reduce the total debt in storage by a repayment amount.
     * The sum each users debt may be slightly more than the recorded total debt
     * because users debt is rounded up for dust.
     * The Total debt is floored at 0.
     */
    function _repayTotalDebt(
        DebtTokenCache memory _cache,
        uint128 _repayAmount
    ) internal {
        if (_repayAmount == 0) return;

        unchecked {
            uint128 _newDebt = (_repayAmount > _cache.totalDebt)
                ? 0
                : _cache.totalDebt - _repayAmount;

            debtTokenData.totalDebt = _cache.totalDebt = _newDebt;
        }

        // Update interest rates now the total debt has been updated.
        _updateInterestRates(_cache);
    }

    /**
     * @dev Calculate the Utilization Ratio. 
     * It is only relevant for DAI, where there is a debt ceiling set in the cache.
     * Numerator = The total debt across all users for this token
     * Denominator = The max amount which TLC can borrow from the Treasury Reserves Vault
     */
    function _utilizationRatio(
        DebtTokenCache memory _cache
    ) internal pure returns (uint256) {
        return _cache.trvDebtCeiling == 0
            ? 0
            : mulDiv(_cache.totalDebt, PRECISION, _cache.trvDebtCeiling);
    }
    
    /**
     * @dev mulDiv with an option to round the result up or down to the nearest wei
     */
    function _mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }

    /**
     * @dev Calculate the latest debt for a given account & token.
     * Derived from the prior debt checkpoint, and the interest accumulator.
     */
    function _currentAccountDebt(
        DebtTokenCache memory _cache,
        uint128 _accountDebtCheckpoint,
        uint256 _accountInterestAccumulator,
        bool roundUp
    ) internal pure returns (uint128 result) {
        return (_accountDebtCheckpoint == 0) 
            ? 0
            : _mulDivRound(
                _accountDebtCheckpoint, 
                _cache.interestAccumulator, 
                _accountInterestAccumulator, 
                roundUp
            ).encodeUInt128();
    }

    /**
     * @dev What is the max borrow liit for a given token and 
     * amount of collateral
     */
    function _maxBorrowLimit(
        DebtTokenCache memory _cache,
        uint128 _collateral
    ) internal pure returns (uint128) {
        return mulDiv(
            _collateral * _cache.price,
            _cache.config.maxLtvRatio,
            DOUBLE_PRECISION
        ).encodeUInt128();
    }

    /**
     * @dev What is the health factor, given an amount of 
     * collateral and debt.
     * health = (collateral value / debt value) * max LTV Limit
     */
    function _healthFactor(
        DebtTokenCache memory _cache,
        uint256 _collateral,
        uint256 _debt
    ) internal pure returns (uint256) {
        return _debt == 0
            ? type(uint256).max
            : mulDiv(
                _collateral * _cache.price,
                _cache.config.maxLtvRatio,
                _debt * PRECISION
            );
    }

    /**
     * @dev What is the Loan To Value (LTV), given an amount of 
     * collateral and debt.
     * LTV = debt value / collateral value
     */
    function _loanToValueRatio(
        DebtTokenCache memory _cache,
        uint256 _collateral,
        uint256 _debt
    ) internal pure returns (uint256) {
        return _collateral == 0
            ? type(uint256).max
            : mulDiv(
                _debt,
                DOUBLE_PRECISION,
                _collateral * _cache.price
            );
    }
}