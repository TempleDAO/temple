pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

import { SafeCast } from "contracts/common/SafeCast.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";

/**
 * @title Temple Line of Credit (TLC)
 * @notice Users supply Temple as collateral, and can then borrow DAI.
 * 
 * Both borrows and collateral withdraws require two transactions:
 *   1/ Request the borrow | collateral withdrawal
 *   2/ Wait until the min request time has passed (and before the max time)
 *      and then do the borrow | collateral withdrawal.
 * This is in order to further mitigate money market attack vectors. Requests 
 * can be cancelled by the user or with elevated access on behalf of users.
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
     *      (reducing the dUSD debt of the TlcStrategy)
     */
    ITreasuryReservesVault public override treasuryReservesVault;

    /**
     * @notice The Strategy contract managing the TRV borrows and equity positions of TLC.
     */
    ITlcStrategy public override tlcStrategy;

    /**
     * @notice Users/accounts must first request to remove collateral. 
     * The user must wait a period of time after the request before they can action the withdraw.
     * The request also has an expiry time.
     * If a request expires, a new request will need to be made or the actual withdraw will then revert.
     */
    FundsRequestConfig public override removeCollateralRequestConfig;
    
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
     * @notice An internal state tracking how interest has accumulated.
     */
    uint256 internal constant INITIAL_INTEREST_ACCUMULATOR = 1e27;

    /**
     * @notice The minimum borrow amount per transaction
     * @dev It costs gas to liquidate users, so we don't want dust amounts.
     */
    uint256 public constant MIN_BORROW_AMOUNT = 1000e18;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _templeToken,
        address _daiToken, 
        DebtTokenConfig memory _daiTokenConfig
    ) 
        TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        templeToken = IERC20(_templeToken);
        daiToken = IERC20(_daiToken);

        if (_daiTokenConfig.maxLtvRatio > 1e18) revert CommonEventsAndErrors.InvalidParam();
        if (address(_daiTokenConfig.interestRateModel) == address(0)) revert CommonEventsAndErrors.ExpectedNonZero();

        debtTokenConfig = _daiTokenConfig;
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
    function addCollateral(uint256 collateralAmount, address onBehalfOf) external override {
        if (collateralAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit CollateralAdded(msg.sender, onBehalfOf, collateralAmount);

        allAccountsData[onBehalfOf].collateral = (
            allAccountsData[onBehalfOf].collateral + 
            collateralAmount
        ).encodeUInt128();

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
     * @notice An account requests to remove Temple collateral.
     * @dev After this request is issued, the account must then execute the `removeCollateral()`
     * within the `removeCollateralRequestConfig`
     * Subsequent requests override previous requests.
     * @param amount The amount of collateral to remove
     */
    function requestRemoveCollateral(uint256 amount) external override {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        AccountData storage _accountData = allAccountsData[msg.sender];
        if (amount > _accountData.collateral) revert CommonEventsAndErrors.InvalidAmount(address(templeToken), amount);

        _accountData.removeCollateralRequestAmount = amount.encodeUInt128();
        _accountData.removeCollateralRequestAt = uint64(block.timestamp);
        checkLiquidity(_accountData);

        emit RemoveCollateralRequested(msg.sender, amount);
    }

    /**
     * @notice An account (or elevated access) cancels an existing Remove Collateral request
     * @param account The account to cancel the request for.
     */
    function cancelRemoveCollateralRequest(address account) external override {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        
        AccountData storage _accountData = allAccountsData[account];
        if (_accountData.removeCollateralRequestAt == 0) revert CommonEventsAndErrors.InvalidParam();

        _accountData.removeCollateralRequestAmount = _accountData.removeCollateralRequestAt = 0;
        emit RemoveCollateralRequestCancelled(account);
    }

    /**
     * @notice Execute the remove collateral request, within the window of the prior issued request
     * @param recipient Send the Temple collateral to a specified recipient address.
     */
    function removeCollateral(address recipient) external override {
        AccountData storage _accountData = allAccountsData[msg.sender];

        uint256 _removeAmount;
        {
            checkWithdrawalCooldown(
                removeCollateralRequestConfig.minSecs, 
                removeCollateralRequestConfig.maxSecs, 
                _accountData.removeCollateralRequestAt
            );
            _removeAmount = _accountData.removeCollateralRequestAmount;
            _accountData.removeCollateralRequestAmount = _accountData.removeCollateralRequestAt = 0;
        }

        // Update the collateral, and then verify that it doesn't make the debt unsafe.
        // A subtraction in collateral (where the removeAmount is always <= existing collateral
        // - so the downcast here is safe
        _accountData.collateral = uint128(_accountData.collateral - _removeAmount);
        totalCollateral -= _removeAmount;
        emit CollateralRemoved(msg.sender, recipient, _removeAmount);

        checkLiquidity(_accountData);

        templeToken.safeTransfer(
            recipient,
            _removeAmount
        );
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           BORROW                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice An account requests to borrow DAI
     * @dev After this request is issued, the account must then execute the `borrow()`
     * within the valid borrow request window
     * Subsequent requests override previous requests.
     * @param amount The amount to borrow
     */
    function requestBorrow(uint256 amount) external override {
        if (amount < MIN_BORROW_AMOUNT) revert InsufficientAmount(MIN_BORROW_AMOUNT, amount);

        AccountData storage _accountData = allAccountsData[msg.sender];
        _accountData.borrowRequestAmount = amount.encodeUInt128();
        _accountData.borrowRequestAt = uint64(block.timestamp);
        emit BorrowRequested(msg.sender, amount);

        checkLiquidity(_accountData);
    }

    /**
     * @notice An account (or elevated access) cancels an existing Borrow request
     * @param account The account to cancel the request for.
     */
    function cancelBorrowRequest(address account) external override {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();

        AccountData storage _accountData = allAccountsData[account];
        if (_accountData.borrowRequestAt == 0) revert CommonEventsAndErrors.InvalidParam();

        _accountData.borrowRequestAmount = _accountData.borrowRequestAt = 0;
        emit BorrowRequestCancelled(account);
    }

    /**
     * @notice Execute the borrow request, within the window of the prior issued request
     * @param recipient Send the borrowed token to a specified recipient address.
     */
    function borrow(address recipient) external override {
        AccountData storage _accountData = allAccountsData[msg.sender];
        DebtTokenCache memory _debtTokenCache = debtTokenCache();

        // Validate and pop the borrow request
        uint256 _borrowAmount;
        {
            checkWithdrawalCooldown(
                _debtTokenCache.config.borrowRequestConfig.minSecs, 
                _debtTokenCache.config.borrowRequestConfig.maxSecs, 
                _accountData.borrowRequestAt
            );
            _borrowAmount = _accountData.borrowRequestAmount;
            _accountData.borrowRequestAmount = _accountData.borrowRequestAt = 0;
        }

        // Apply the new borrow
        {
            uint256 _totalDebt = currentAccountDebt(
                _debtTokenCache, 
                _accountData.debtCheckpoint, 
                _accountData.interestAccumulator,
                false // don't round on the way in
            ) + _borrowAmount;

            // Update the state
            _accountData.debtCheckpoint = _totalDebt.encodeUInt128();
            _accountData.interestAccumulator = _debtTokenCache.interestAccumulator;
            debtTokenData.totalDebt = _debtTokenCache.totalDebt = (
                _debtTokenCache.totalDebt + _borrowAmount
            ).encodeUInt128();

            // Update the borrow interest rates based on the now increased utilization ratio
            updateInterestRates(_debtTokenCache);
        }

        emit Borrow(msg.sender, recipient, _borrowAmount);
        checkLiquidity(_accountData);

        // Finally, borrow the funds from the TRV and send the tokens to the recipient.
        tlcStrategy.fundFromTrv(_borrowAmount, recipient);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            REPAY                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice An account repays some of its borrowed DAI debt
     * @param repayAmount The amount to repay. Cannot be more than the current debt.
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repay(uint256 repayAmount, address onBehalfOf) external override {
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        AccountData storage _accountData = allAccountsData[onBehalfOf];
        repayToken(debtTokenCache(), repayAmount.encodeUInt128(), _accountData, msg.sender, onBehalfOf);
    }

    /**
     * @notice An account repays all of its DAI debt
     * @dev The amount of debt is calculated as of this block.
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repayAll(address onBehalfOf) external override {
        DebtTokenCache memory _debtTokenCache = debtTokenCache();
        AccountData storage _accountData = allAccountsData[onBehalfOf];

        // Get the outstanding debt for Stable
        uint128 repayAmount = currentAccountDebt(
            _debtTokenCache,
            _accountData.debtCheckpoint,
            _accountData.interestAccumulator,
            true // use the rounded up amount
        );
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        repayToken(_debtTokenCache, repayAmount, _accountData, msg.sender, onBehalfOf);
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
        address[] memory accounts
    ) external override returns (
        uint256 totalCollateralClaimed,
        uint256 totalDebtWiped
    ) {
        LiquidationStatus memory _status;
        DebtTokenCache memory _debtTokenCache = debtTokenCache();
        address _account;
        uint256 _numAccounts = accounts.length;
        for (uint256 i; i < _numAccounts; ++i) {
            _account = accounts[i];
            _status = computeLiquidity(
                allAccountsData[_account], 
                _debtTokenCache, 
                false
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

        // burn the temple collateral by repaying to TRV. This will burn the equivalent dUSD debt too.
        if (totalCollateralClaimed != 0) {
            treasuryReservesVault.repayTemple(totalCollateralClaimed, address(tlcStrategy));
            totalCollateral -= totalCollateralClaimed;
        }

        // Remove debt from the totals
        repayTotalDebt(_debtTokenCache, totalDebtWiped.encodeUInt128());
    }
    
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            ADMIN                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

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
    }

    /**
     * @notice Set the Withdrawal Collateral Request window parameters
     * @param minSecs The number of seconds which must elapse between a request and the action
     * @param maxSecs The number of seconds until a request expires
     */
    function setWithdrawCollateralRequestConfig(
        uint256 minSecs,
        uint256 maxSecs
    ) external override onlyElevatedAccess {
        emit RemoveCollateralRequestConfigSet(minSecs, maxSecs);
        removeCollateralRequestConfig = FundsRequestConfig(uint32(minSecs), uint32(maxSecs));
    }

    /**
     * @notice Set the Borrow Request window parameters
     * @param minSecs The number of seconds which must elapse between a request and the action
     * @param maxSecs The number of seconds until a request expires
     */
    function setBorrowRequestConfig(
        uint256 minSecs,
        uint256 maxSecs
    ) external override onlyElevatedAccess {
        emit BorrowRequestConfigSet(minSecs, maxSecs);
        debtTokenConfig.borrowRequestConfig = FundsRequestConfig(uint32(minSecs), uint32(maxSecs));
    }

    /**
     * @notice Update the interest rate model contract for DAI borrows
     * @param interestRateModel The contract address of the new model
     */
    function setInterestRateModel(
        address interestRateModel
    ) external override onlyElevatedAccess {
        emit InterestRateModelSet(interestRateModel);
        DebtTokenCache memory _cache = debtTokenCache();

        // Update the cache entry and calculate the new interest rate based off this model.
        debtTokenConfig.interestRateModel = _cache.config.interestRateModel = IInterestRateModel(interestRateModel);
        updateInterestRates(_cache);
    }

    /**
     * @notice Set the maximum Loan To Value Ratio allowed for DAI borrows before the position is liquidated
     * @param maxLtvRatio The max LTV ratio (18 decimal places)
     */
    function setMaxLtvRatio(
        uint256 maxLtvRatio
    ) external override onlyElevatedAccess {
        if (maxLtvRatio > 1e18) revert CommonEventsAndErrors.InvalidParam();

        emit MaxLtvRatioSet(maxLtvRatio);
        debtTokenConfig.maxLtvRatio = uint96(maxLtvRatio);
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
        updateInterestRates(debtTokenCache());
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           VIEWS                            */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice An view of an accounts current and up to date position as of this block
     * @param account The account to get a position for
     * @param includePendingRequests Whether to include any pending but not yet executed
     * requests for Collateral Withdraw or Borrow. 
     */
    function accountPosition(
        address account,
        bool includePendingRequests
    ) external override view returns (
        AccountPosition memory position
    ) {
        AccountData storage _accountData = allAccountsData[account];
        DebtTokenCache memory _debtTokenCache = debtTokenCacheRO();

        position.collateral = _accountData.collateral;
        position.currentDebt = currentAccountDebt(
            _debtTokenCache, 
            _accountData.debtCheckpoint,
            _accountData.interestAccumulator,
            true
        );

        if (includePendingRequests) {
            position.collateral -= _accountData.removeCollateralRequestAmount;
            position.currentDebt += _accountData.borrowRequestAmount; 
        }

        position.maxBorrow = maxBorrowLimit(_debtTokenCache, position.collateral);
        position.healthFactor = healthFactor(_debtTokenCache, position.collateral, position.currentDebt);
        position.loanToValueRatio = loanToValueRatio(_debtTokenCache, position.collateral, position.currentDebt);
    }

    /**
     * @notice Get the current total DAI debt position across all accounts
     * as of this block.
     */
    function totalDebtPosition() external override view returns (
        TotalDebtPosition memory position
    ) {
        DebtTokenCache memory _debtTokenCache = debtTokenCacheRO();
        position.utilizationRatio = utilizationRatio(_debtTokenCache);
        position.borrowRate = _debtTokenCache.interestRate;
        position.totalDebt = _debtTokenCache.totalDebt;
    }

    /**
     * @notice Compute the liquidity status for a set of accounts.
     * @dev This can be used to verify if accounts can be liquidated or not.
     * @param accounts The accounts to get the status for.
     * @param includePendingRequests Whether to include any pending but not yet executed
     * requests for Collateral Withdraw or Borrow. 
     */
    function computeLiquidity(
        address[] memory accounts,
        bool includePendingRequests
    ) external override view returns (LiquidationStatus[] memory status) {
        uint256 _numAccounts = accounts.length;
        status = new LiquidationStatus[](_numAccounts);
        for (uint256 i; i < _numAccounts; ++i) {
            status[i] = computeLiquidity(
                allAccountsData[accounts[i]], 
                debtTokenCacheRO(),
                includePendingRequests
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
        return debtTokenCacheRO();
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
        uint128 interestAccumulator;

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
    function initDebtTokenCache(DebtTokenCache memory _cache) private view returns (bool dirty) {

        // Copies from storage (once)
        _cache.config = debtTokenConfig;

        // No need to use `encodeUInt128()` here - straight from storage of the same dimension
        _cache.interestAccumulator = uint128(debtTokenData.interestAccumulator);
        _cache.totalDebt = debtTokenData.totalDebt;
        _cache.interestRate = debtTokenData.interestRate;

        // Set the debt ceiling and price.
        {
            ITreasuryReservesVault _trv = treasuryReservesVault;
            _cache.trvDebtCeiling = _trv.strategyDebtCeiling(address(tlcStrategy));
            _cache.price = _trv.treasuryPriceIndex();
        }
        
        // Only compound if we're on a new block
        uint256 interestAccumulatorUpdatedAt = debtTokenData.interestAccumulatorUpdatedAt;
        uint32 blockTs = uint32(block.timestamp);
        if (blockTs != interestAccumulatorUpdatedAt) {
            dirty = true;

            // Compound the accumulator
            uint256 newInterestAccumulator = uint256(_cache.interestAccumulator).continuouslyCompounded(
                blockTs - interestAccumulatorUpdatedAt,
                _cache.interestRate
            );

            // Calculate the latest totalDebt from this
            _cache.totalDebt = mulDiv(
                newInterestAccumulator,
                _cache.totalDebt,
                _cache.interestAccumulator
            ).encodeUInt128();
            _cache.interestAccumulator = newInterestAccumulator.encodeUInt128();
        }
    }

    /**
     * @dev Setup the DebtTokenCache for a given token
     * Update storage if and only if the state has changed.
     */
    function debtTokenCache() internal returns (
        DebtTokenCache memory cache
    ) {
        if (initDebtTokenCache(cache)) {
            debtTokenData.interestAccumulatorUpdatedAt = uint32(block.timestamp);
            debtTokenData.totalDebt = cache.totalDebt;
            debtTokenData.interestAccumulator = cache.interestAccumulator;
        }
    }

    /**
     * @dev Setup the DebtTokenCache for a given token
     * read only -- storage isn't updated.
     */
    function debtTokenCacheRO() internal view returns (
        DebtTokenCache memory cache
    ) {
        initDebtTokenCache(cache);
    }

    /**
     * @dev Calculate the borrow interest rate, given the utilization ratio of the token.
     * If the rate has changed, then update storage and emit an event.
     */
    function updateInterestRates(
        DebtTokenCache memory _debtTokenCache
    ) internal {
        uint96 newInterestRate = _debtTokenCache.config.interestRateModel.calculateInterestRate(
            utilizationRatio(_debtTokenCache)
        );

        // Update storage if the new rate differs from the old rate.
        if (_debtTokenCache.interestRate != newInterestRate) {
            emit InterestRateUpdate(newInterestRate);
            debtTokenData.interestRate = _debtTokenCache.interestRate = newInterestRate;
        }
    }

    /**
     * @dev ensure a collateral withdraw or borrow is within the allowed window after the request.
     */
    function checkWithdrawalCooldown(
        uint32 _minSecs,
        uint32 _maxSecs,
        uint64 _requestedAt
    ) internal view {
        unchecked {
            if (block.timestamp < _requestedAt+_minSecs)
                revert NotInFundsRequestWindow(block.timestamp, _requestedAt, _minSecs, _maxSecs);
            if (block.timestamp > _requestedAt+_maxSecs)
                revert NotInFundsRequestWindow(block.timestamp, _requestedAt, _minSecs, _maxSecs);
        }
    }

    /**
     * @dev The implementation of the debt token repayment, used by repay() and repayAll()
     */
    function repayToken(
        DebtTokenCache memory _debtTokenCache,
        uint128 _repayAmount,
        AccountData storage _accountData,
        address _fromAccount,
        address _onBehalfOf
    ) internal {
        // Update the account's latest debt
        uint128 _newDebt = currentAccountDebt(
            _debtTokenCache, 
            _accountData.debtCheckpoint,
            _accountData.interestAccumulator,
            true // round up for repay balance
        );

        // They cannot repay more than this debt
        if (_repayAmount > _newDebt) {
            revert ExceededBorrowedAmount(_newDebt, _repayAmount);
        }
        unchecked {
            _newDebt -= _repayAmount;
        }

        // Update storage
        _accountData.debtCheckpoint = _newDebt;
        _accountData.interestAccumulator = _debtTokenCache.interestAccumulator;
        repayTotalDebt(_debtTokenCache, _repayAmount);

        emit Repay(_fromAccount, _onBehalfOf, _repayAmount);
        // NB: Liquidity doesn't need to be checked after a repay, as that only improves the health.

        // Pull the stables, and repay the TRV debt on behalf of the strategy.
        {
            daiToken.safeTransferFrom(_fromAccount, address(this), _repayAmount);
            treasuryReservesVault.repay(_repayAmount, address(tlcStrategy));
        }
    }

    /**
     * @dev Generate the LiquidationStatus struct with current details 
     * for this account.
     * Optionally include pending collateral withdraw / borrow requests
     */
    function computeLiquidity(
        AccountData storage _accountData,
        DebtTokenCache memory _debtTokenCache,
        bool _includePendingRequests
    ) internal view returns (LiquidationStatus memory status) {
        status.collateral = _accountData.collateral;

        status.currentDebt = currentAccountDebt(
            _debtTokenCache, 
            _accountData.debtCheckpoint, 
            _accountData.interestAccumulator,
            true // round up for user reported debt
        );

        if (_includePendingRequests) {
            status.collateral -= _accountData.removeCollateralRequestAmount;
            status.currentDebt += _accountData.borrowRequestAmount; 
        }

        status.collateralValue = status.collateral * _debtTokenCache.price / 1e18;

        status.hasExceededMaxLtv = status.currentDebt > maxBorrowLimit(
            _debtTokenCache,
            status.collateral
        );
    }

    /**
     * @dev Check if this account is to be liquidated given the current
     * account, debt token and market conditions.
     * Revert if the account has exceeded the maximum LTV
     */
    function checkLiquidity(AccountData storage _accountData) internal view {
        DebtTokenCache memory _cache = debtTokenCacheRO();
        LiquidationStatus memory _status = computeLiquidity(
            _accountData,
            _cache,
            true
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
    function repayTotalDebt(
        DebtTokenCache memory _debtTokenCache,
        uint128 _repayAmount
    ) internal {
        if (_repayAmount == 0) return;

        uint128 _newDebt = (_repayAmount > _debtTokenCache.totalDebt)
            ? 0
            : _debtTokenCache.totalDebt - _repayAmount;

        debtTokenData.totalDebt = _debtTokenCache.totalDebt = _newDebt;

        // Update interest rates now the total debt has been updated.
        updateInterestRates(_debtTokenCache);
    }

    /**
     * @dev Calculate the Utilization Ratio. 
     * It is only relevant for DAI, where there is a debt ceiling set in the cache.
     * Numerator = The total debt across all users for this token
     * Denominator = The max amount which TLC can borrow from the Treasury Reserves Vault
     */
    function utilizationRatio(
        DebtTokenCache memory _debtTokenCache
    ) internal pure returns (uint256) {
        return _debtTokenCache.trvDebtCeiling == 0
            ? 0
            : mulDiv(_debtTokenCache.totalDebt, 1e18, _debtTokenCache.trvDebtCeiling);
    }
    
    /**
     * @dev mulDiv with an option to round the result up or down to the nearest wei
     */
    function mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
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
    function currentAccountDebt(
        DebtTokenCache memory _debtTokenCache,
        uint128 _accountDebtCheckpoint,
        uint256 _accountInterestAccumulator,
        bool roundUp
    ) internal pure returns (uint128 result) {
        return (_accountDebtCheckpoint == 0) 
            ? 0
            : mulDivRound(
                _accountDebtCheckpoint, 
                _debtTokenCache.interestAccumulator, 
                _accountInterestAccumulator, 
                roundUp
            ).encodeUInt128();
    }

    /**
     * @dev What is the max borrow liit for a given token and 
     * amount of collateral
     */
    function maxBorrowLimit(
        DebtTokenCache memory _debtTokenCache,
        uint256 _collateral
    ) internal pure returns (uint256) {
        return mulDiv(
            _collateral * _debtTokenCache.price,
            _debtTokenCache.config.maxLtvRatio,
            1e36
        );
    }

    /**
     * @dev What is the health factor, given an amount of 
     * collateral and debt.
     * health = (collateral value / debt value) * max LTV Limit
     */
    function healthFactor(
        DebtTokenCache memory _debtTokenCache,
        uint256 _collateral,
        uint256 _debt
    ) internal pure returns (uint256) {
        return _debt == 0
            ? type(uint256).max
            : mulDiv(
                _collateral * _debtTokenCache.price,
                _debtTokenCache.config.maxLtvRatio,
                _debt * 1e18
            );
    }

    /**
     * @dev What is the Loan To Value (LTV), given an amount of 
     * collateral and debt.
     * LTV = debt value / collateral value
     */
    function loanToValueRatio(
        DebtTokenCache memory _debtTokenCache,
        uint256 _collateral,
        uint256 _debt
    ) internal pure returns (uint256) {
        return _collateral == 0
            ? type(uint256).max
            : mulDiv(
                _debt,
                1e36,
                _collateral * _debtTokenCache.price
            );
    }
}