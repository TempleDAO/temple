pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";
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
 * @notice Users supply Temple as collateral, and can then borrow DAI and OUD.
 * 
 * Both borrows and collateral withdraws require two transactions:
 *   1/ Request the borrow | collateral withdrawal
 *   2/ Wait until the min request time has passed (and before the max time)
 *      and then do the borrow | collateral withdrawal.
 * This is in order to further mitigate money market attack vectors. Requests 
 * can be cancelled by the user or with elevated access on behalf of users.
 * 
 * Temple and Oud are valued at the Temple Treasury Price Index (TPI)
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
        DebtTokenConfig memory _daiTokenConfig,
        address _oudToken,
        DebtTokenConfig memory _oudTokenConfig
    ) 
        TempleElevatedAccess(_initialRescuer, _initialExecutor)
        TlcBase(_templeToken, _daiToken, _oudToken)
    {
        // Initialize the Reserve Tokens
        addDebtToken(daiToken, _daiTokenConfig);
        addDebtToken(oudToken, _oudTokenConfig);
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

        allAccountsData[onBehalfOf].collateralPosted = (
            allAccountsData[onBehalfOf].collateralPosted + 
            collateralAmount
        ).encodeUInt128();

        unchecked {
            totalCollateral += collateralAmount;
        }

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
     * within the `removeCollateralRequestWindow`
     * Subsequent requests override previous requests.
     * @param amount The amount of collateral to remove
     */
    function requestRemoveCollateral(uint256 amount) external override {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        AccountData storage _accountData = allAccountsData[msg.sender];
        if (amount > _accountData.collateralPosted) revert CommonEventsAndErrors.InvalidAmount(address(templeToken), amount);

        _accountData.removeCollateralRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));
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
        if (_accountData.removeCollateralRequest.requestedAt == 0) revert CommonEventsAndErrors.InvalidParam();

        delete _accountData.removeCollateralRequest;
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
            WithdrawFundsRequest storage _request = _accountData.removeCollateralRequest;
            checkWithdrawalCooldown(removeCollateralRequestWindow.minSecs, removeCollateralRequestWindow.maxSecs, _request.requestedAt);
            _removeAmount = _request.amount;
            delete allAccountsData[msg.sender].removeCollateralRequest;
        }

        // Update the collateral, and then verify that it doesn't make the debt unsafe.
        // A subtraction in collateral (where the removeAmount is always <= existing collateral
        // - so the downcast here is safe
        unchecked {
            _accountData.collateralPosted = uint128(_accountData.collateralPosted - _removeAmount);
            totalCollateral -= _removeAmount;
        }
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
     * @notice An account requests to borrow either Dai or Oud
     * @dev After this request is issued, the account must then execute the `borrow()`
     * within the `borrowRequestWindow`
     * Subsequent requests override previous requests.
     * @param token The token to borrow - either Dai or Oud
     * @param amount The amount to borrow
     */
    function requestBorrow(IERC20 token, uint256 amount) external override {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        checkValidDebtToken(token);

        AccountData storage _accountData = allAccountsData[msg.sender];
        AccountDebtData storage _accountDebtData = _accountData.debtData[token];
        _accountDebtData.borrowRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));
        emit BorrowRequested(msg.sender, address(token), amount);

        checkLiquidity(_accountData);
    }

    /**
     * @notice An account (or elevated access) cancels an existing Borrow request
     * @param account The account to cancel the request for.
     * @param token The token to cancel the request for.
     */
    function cancelBorrowRequest(address account, IERC20 token) external override {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        checkValidDebtToken(token);

        AccountDebtData storage _debtData = allAccountsData[account].debtData[token];
        if (_debtData.borrowRequest.requestedAt == 0) revert CommonEventsAndErrors.InvalidParam();

        delete _debtData.borrowRequest;
        emit BorrowRequestCancelled(account, address(token));
    }

    /**
     * @notice Execute the borrow request, within the window of the prior issued request
     * @param token The token to borrow
     * @param recipient Send the borrowed token to a specified recipient address.
     */
    function borrow(IERC20 token, address recipient) external override {
        AccountData storage _accountData = allAccountsData[msg.sender];
        AccountDebtData storage _accountDebtData = _accountData.debtData[token];
        DebtTokenCache memory _debtTokenCache = debtTokenCache(token);

        // Validate and pop the borrow request for this token
        uint256 _borrowAmount;
        {
            WithdrawFundsRequest storage _request = _accountDebtData.borrowRequest;
            checkWithdrawalCooldown(
                _debtTokenCache.config.borrowRequestWindow.minSecs, 
                _debtTokenCache.config.borrowRequestWindow.maxSecs, 
                _request.requestedAt
            );
            _borrowAmount = _request.amount;
            delete _accountDebtData.borrowRequest;
        }

        // Apply the new borrow
        {
            DebtTokenDetails storage _debtTokenDetails = debtTokenDetails[token];

            uint256 _totalDebt = currentAccountDebt(
                _debtTokenCache, 
                _accountDebtData.debtCheckpoint, 
                _accountDebtData.interestAccumulator,
                false // don't round on the way in
            ) + _borrowAmount;

            // Update the state
            _accountDebtData.debtCheckpoint = _totalDebt.encodeUInt128();
            _accountDebtData.interestAccumulator = _debtTokenCache.interestAccumulator;
            _debtTokenDetails.data.totalDebt = _debtTokenCache.totalDebt = (
                _debtTokenCache.totalDebt + _borrowAmount
            ).encodeUInt128();

            // Update the borrow interest rates based on the now increased utilization ratio
            updateInterestRates(token, _debtTokenDetails, _debtTokenCache);
        }

        emit Borrow(msg.sender, recipient, address(token), _borrowAmount);
        checkLiquidity(_accountData);

        // Finally, send the tokens to the recipient.
        if (token == daiToken) {
            // Borrow the funds from the TRV and send to the recipient
            tlcStrategy.fundFromTrv(_borrowAmount, recipient);
        } else {
            // Mint the OUD and send to recipient
            IMintableToken(address(token)).mint(recipient, _borrowAmount );
        }
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            REPAY                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice An account repays some of its DAI or OUD debt
     * @param token The debt token to repay
     * @param repayAmount The amount to repay. Cannot be more than the current debt.
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repay(IERC20 token, uint256 repayAmount, address onBehalfOf) external override {
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        AccountDebtData storage _accountDebtData = allAccountsData[onBehalfOf].debtData[token];
        repayToken(token, debtTokenCache(token), repayAmount.encodeUInt128(), _accountDebtData, msg.sender, onBehalfOf);
    }

    /**
     * @notice An account repays all of its DAI or OUD debt
     * @dev The amount of debt is calculated as of this block.
     * @param token The debt token to repay
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repayAll(IERC20 token, address onBehalfOf) external override {
        DebtTokenCache memory _debtTokenCache = debtTokenCache(token);
        AccountDebtData storage _accountDebtData = allAccountsData[onBehalfOf].debtData[token];

        // Get the outstanding debt for Stable
        uint128 repayAmount = currentAccountDebt(
            _debtTokenCache,
            _accountDebtData.debtCheckpoint,
            _accountDebtData.interestAccumulator,
            true // use the rounded up amount
        );
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        repayToken(token, _debtTokenCache, repayAmount, _accountDebtData, msg.sender, onBehalfOf);
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
        uint128 totalDaiDebtWiped,
        uint128 totalOudDebtWiped
    ) {
        LiquidationStatus memory _status;
        DebtTokenCache memory daiTokenCache = debtTokenCache(daiToken);
        DebtTokenCache memory oudTokenCache = debtTokenCache(oudToken);
        address _account;
        uint256 _numAccounts = accounts.length;
        for (uint256 i; i < _numAccounts; ++i) {
            _account = accounts[i];
            _status = computeLiquidity(
                allAccountsData[_account], 
                daiTokenCache, 
                oudTokenCache, 
                false
            );

            // Skip if this account is still under the maxLTV across both DAI and OUD
            if (_status.hasExceededMaxLtv) {
                emit Liquidated(_account, _status.collateral, _status.currentDaiDebt,  _status.currentOudDebt);
                unchecked {
                    totalCollateralClaimed += _status.collateral;
                    totalDaiDebtWiped += _status.currentDaiDebt;
                    totalOudDebtWiped += _status.currentOudDebt;
                }

                // Clear the account data
                delete allAccountsData[_account].debtData[daiToken];
                delete allAccountsData[_account].debtData[oudToken];
                delete allAccountsData[_account];
            }
        }

        // burn the temple collateral by repaying to TRV. This will burn the equivalent dUSD debt too.
        if (totalCollateralClaimed != 0) {
            treasuryReservesVault.repayTemple(totalCollateralClaimed, address(tlcStrategy));
            totalCollateral -= totalCollateralClaimed;
        }

        // Remove debt from the totals
        repayTotalDebt(daiToken, daiTokenCache, totalDaiDebtWiped);
        repayTotalDebt(oudToken, oudTokenCache, totalOudDebtWiped);
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
     * @notice Set the Withdrawal Collateral Request Window parameters
     * @param minSecs The number of seconds which must elapse between a request and the action
     * @param maxSecs The number of seconds until a request expires
     */
    function setWithdrawCollateralRequestWindow(
        uint256 minSecs,
        uint256 maxSecs
    ) external override onlyElevatedAccess {
        emit RemoveCollateralRequestWindowSet(minSecs, maxSecs);
        removeCollateralRequestWindow = FundsRequestWindow(uint32(minSecs), uint32(maxSecs));
    }

    /**
     * @notice Set the Borrow Request Window parameters
     * @param minSecs The number of seconds which must elapse between a request and the action
     * @param maxSecs The number of seconds until a request expires
     */
    function setBorrowRequestWindow(
        IERC20 token,
        uint256 minSecs,
        uint256 maxSecs
    ) external override onlyElevatedAccess {
        checkValidDebtToken(token);
        emit BorrowRequestWindowSet(address(token), minSecs, maxSecs);
        debtTokenDetails[token].config.borrowRequestWindow = FundsRequestWindow(uint32(minSecs), uint32(maxSecs));
    }

    /**
     * @notice Update the interest rate model for either DAI or OUD
     * @param token The token to update the model for
     * @param interestRateModel The contract address of the new model
     */
    function setInterestRateModel(
        IERC20 token, 
        address interestRateModel
    ) external override onlyElevatedAccess {
        emit InterestRateModelSet(address(token), interestRateModel);
        DebtTokenCache memory _cache = debtTokenCache(token);

        // Update the cache entry and calculate the new interest rate based off this model.
        DebtTokenDetails storage _debtTokenDetails = debtTokenDetails[token];
        _debtTokenDetails.config.interestRateModel = _cache.config.interestRateModel = IInterestRateModel(interestRateModel);
        updateInterestRates(token, _debtTokenDetails, _cache);
    }

    /**
     * @notice Set the maximum Loan To Value Ratio for either DAI or OUD
     * @param token The token to update the max LTV for
     * @param maxLtvRatio The max LTV ratio (18 decimal places)
     */
    function setMaxLtvRatio(
        IERC20 token, 
        uint256 maxLtvRatio
    ) external override onlyElevatedAccess {
        checkValidDebtToken(token);
        if (maxLtvRatio > 1e18) revert CommonEventsAndErrors.InvalidParam();

        emit MaxLtvRatioSet(address(token), maxLtvRatio);
        debtTokenDetails[token].config.maxLtvRatio = uint128(maxLtvRatio);
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
        updateInterestRates(daiToken, debtTokenDetails[daiToken], debtTokenCache(daiToken));
        updateInterestRates(oudToken, debtTokenDetails[oudToken], debtTokenCache(oudToken));
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
        position.collateralPosted = _accountData.collateralPosted;

        if (includePendingRequests) {
            unchecked {
                position.collateralPosted -= _accountData.removeCollateralRequest.amount;
            }
        }

        position.daiDebtPosition = fillAccountPosition(
            daiToken, 
            _accountData,
            position.collateralPosted,
            includePendingRequests
        );
        position.oudDebtPosition = fillAccountPosition(
            oudToken,
            _accountData,
            position.collateralPosted,
            includePendingRequests
        );
    }

    /**
     * @notice Get the current total debt positions for both DAI and OUD
     * as of this block.
     */
    function totalDebtPosition() external override view returns (
        TotalDebtPosition memory daiPosition,
        TotalDebtPosition memory oudPosition
    ) {
        daiPosition = fillTotalDebtPosition(daiToken);
        oudPosition = fillTotalDebtPosition(oudToken);
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
                debtTokenCacheRO(daiToken),
                debtTokenCacheRO(oudToken),
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
        uint256 collateralPosted,
        WithdrawFundsRequest memory removeCollateralRequest,
        AccountDebtData memory daiDebtData,
        AccountDebtData memory oudDebtData
    ) {
        AccountData storage _accountData = allAccountsData[account];
        collateralPosted = _accountData.collateralPosted;
        removeCollateralRequest = _accountData.removeCollateralRequest;
        daiDebtData = _accountData.debtData[daiToken];
        oudDebtData = _accountData.debtData[oudToken];
    }

    /**
     * @notice A view of the derived/internal cache data.
     */
    function getDebtTokenCache(IERC20 token) external view returns (DebtTokenCache memory) {
        return debtTokenCacheRO(token);
    }
}