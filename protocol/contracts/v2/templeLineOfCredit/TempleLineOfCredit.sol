pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

import { SafeCast } from "contracts/common/SafeCast.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TlcBase } from "contracts/v2/templeLineOfCredit/TlcBase.sol";

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
contract TempleLineOfCredit is TlcBase, ITempleLineOfCredit, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _templeToken,
        address _daiToken, 
        DebtTokenConfig memory _daiTokenConfig
    ) 
        TempleElevatedAccess(_initialRescuer, _initialExecutor)
        TlcBase(_templeToken, _daiToken)
    {
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
}