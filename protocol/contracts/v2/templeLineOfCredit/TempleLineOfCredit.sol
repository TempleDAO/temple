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

// import "forge-std/console.sol";

contract TempleLineOfCredit is TlcBase, ITempleLineOfCredit, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    // @dev Once constructed, setTlcStrategy() needs to be called
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
     * @dev Allows borrower to deposit temple collateral
     * @param collateralAmount is the amount to deposit
     */
    function addCollateral(uint256 collateralAmount, address onBehalfOf) external override {
        if (collateralAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit CollateralAdded(msg.sender, onBehalfOf, collateralAmount);

        allAccountsData[onBehalfOf].collateralPosted = (
            allAccountsData[onBehalfOf].collateralPosted + 
            collateralAmount
        ).encodeUInt128();

        unchecked {
            // Cannot overflow - already know it's less than 2^128
            totalCollateral += collateralAmount;
        }

        // Note: No need to check liquidity when adding collateral.
        templeToken.safeTransferFrom(
            msg.sender,
            address(this),
            collateralAmount 
        );
    }

    function requestRemoveCollateral(uint256 amount) external override {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        AccountData storage _accountData = allAccountsData[msg.sender];
        if (amount > _accountData.collateralPosted) revert CommonEventsAndErrors.InvalidAmount(address(templeToken), amount);

        _accountData.removeCollateralRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));
        checkLiquidity(_accountData);

        emit RemoveCollateralRequested(msg.sender, amount);
    }

    function cancelRemoveCollateralRequest(address account) external override {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        AccountData storage _accountData = allAccountsData[account];
        if (_accountData.removeCollateralRequest.requestedAt == 0) revert CommonEventsAndErrors.InvalidParam();

        delete _accountData.removeCollateralRequest;
        emit RemoveCollateralRequestCancelled(account);
    }

    /**
     * @dev Allows borrower to deposit temple collateral
     */
    function removeCollateral(address recipient) external override {
        AccountData storage _accountData = allAccountsData[msg.sender];

        uint256 _removeAmount;
        {
            WithdrawFundsRequest storage _request = _accountData.removeCollateralRequest;
            checkWithdrawalCooldown(_request.requestedAt);
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

    function requestBorrow(IERC20 token, uint256 amount) external override {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        AccountData storage _accountData = allAccountsData[msg.sender];
        AccountDebtData storage _accountDebtData = _accountData.debtData[token];

        _accountDebtData.borrowRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));
        emit BorrowRequested(msg.sender, address(token), amount);

        // @todo add a test case for this.
        // This will check both assets.
        // This is expected, because even though they may be borrowing DAI
        // they may have exceeded the max LTV in OUD. In that case
        // they shouldn't be allowed to borrow DAI until that OUD debt is paid down.
        checkLiquidity(_accountData);
    }

    function cancelBorrowRequest(address account, IERC20 token) external override {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        AccountDebtData storage _debtData = allAccountsData[msg.sender].debtData[token];
        if (_debtData.borrowRequest.requestedAt == 0) revert CommonEventsAndErrors.InvalidParam();

        delete _debtData.borrowRequest;
        emit BorrowRequestCancelled(account, address(token));
    }

    // @todo check for 0 amount borrow requests

    function borrow(IERC20 token, address recipient) external override {
        AccountData storage _accountData = allAccountsData[msg.sender];
        AccountDebtData storage _accountDebtData = _accountData.debtData[token];
        DebtTokenCache memory _debtTokenCache = debtTokenCache(token);

        // Validate and pop the borrow request for this token
        uint256 _borrowAmount;
        {
            WithdrawFundsRequest storage _request = _accountDebtData.borrowRequest;
            checkWithdrawalCooldown(_request.requestedAt);
            _borrowAmount = _request.amount;
            delete _accountDebtData.borrowRequest;
        }

        // Apply the new borrow
        {
            DebtTokenDetails storage _debtTokenDetails = debtTokenDetails[token];

            uint256 _totalDebt = currentAccountDebtData(
                _debtTokenCache, 
                _accountDebtData.debtCheckpoint, 
                _accountDebtData.interestAccumulator
            ) + _borrowAmount;

            // Update the state
            _accountDebtData.debtCheckpoint = _totalDebt.encodeUInt128();
            _accountDebtData.interestAccumulator = _debtTokenCache.interestAccumulator;
            _debtTokenDetails.data.totalDebt = _debtTokenCache.totalDebt = (
                _debtTokenCache.totalDebt + _borrowAmount
            ).encodeUInt128();

            // Update the borrow interest rates based on the now increased utilization ratio
            // console.log("about to update interest rate");
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

    function repay(IERC20 token, uint256 repayAmount, address onBehalfOf) external override {
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        AccountDebtData storage _accountDebtData = allAccountsData[onBehalfOf].debtData[token];
        _doRepayToken(token, debtTokenCache(token), repayAmount, _accountDebtData, msg.sender, onBehalfOf);
    }

    /**
     * @notice Allows borrower to repay all outstanding balances
     * @dev leave no dust balance
     */
    function repayAll(IERC20 token, address onBehalfOf) external override {
        DebtTokenCache memory _debtTokenCache = debtTokenCache(token);
        AccountDebtData storage _accountDebtData = allAccountsData[onBehalfOf].debtData[token];

        // Get the outstanding debt for Stable
        uint256 repayAmount = currentAccountDebtData(
            _debtTokenCache,
            _accountDebtData.debtCheckpoint,
            _accountDebtData.interestAccumulator
        );
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        _doRepayToken(token, _debtTokenCache, repayAmount, _accountDebtData, msg.sender, onBehalfOf);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                       LIQUIDATIONS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    struct LiquidateParams {
        DebtTokenCache daiTokenCache;
        DebtTokenCache oudTokenCache;
        uint256 daiDebtWiped;
        uint256 oudDebtWiped;
    }

    function batchLiquidate(
        address[] memory accounts
    ) external override {
        LiquidityStatus memory _status;

        uint256 _numAccounts = accounts.length;
        uint256 totalCollateralClaimed;
        LiquidateParams memory _params;
        _params.daiTokenCache = debtTokenCache(daiToken);
        _params.oudTokenCache = debtTokenCache(oudToken);

        uint256 i;
        address _account;
        for (; i < _numAccounts; ++i) {
            _account = accounts[i];
            _status = computeLiquidity(
                allAccountsData[_account], 
                _params.daiTokenCache, 
                _params.oudTokenCache, 
                false
            );

            // Skip if this account is still under the maxLTV across all assets
            if (_status.hasExceededMaxLtv) {
                totalCollateralClaimed += _status.collateral;
                _params.daiDebtWiped += _status.currentDaiDebt;
                _params.oudDebtWiped += _status.currentOudDebt;
                delete allAccountsData[_account];    
            }
        }

        // burn the temple collateral by repaying to TRV. This will burn the equivalent dUSD debt too.
        treasuryReservesVault.repayTemple(totalCollateralClaimed, address(tlcStrategy));

        wipeDebt(daiToken, _params.daiTokenCache, _params.daiDebtWiped);
        wipeDebt(oudToken, _params.oudTokenCache, _params.oudDebtWiped);
    }
    
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            ADMIN                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function setTlcStrategy(
        address _tlcStrategy
    ) external override onlyElevatedAccess {
        tlcStrategy = ITlcStrategy(_tlcStrategy);
        ITreasuryReservesVault _trv = tlcStrategy.treasuryReservesVault();
        treasuryReservesVault = _trv;
        emit TlcStrategySet(_tlcStrategy, address(_trv));
    }

    function setFundsRequestWindow(
        uint256 minSecs,
        uint256 maxSecs
    ) external override onlyElevatedAccess {
        emit FundsRequestWindowSet(minSecs, maxSecs);
        fundsRequestWindow = FundsRequestWindow(uint32(minSecs), uint32(maxSecs));
    }

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

    function setMaxLtvRatio(
        IERC20 token, 
        uint256 maxLtvRatio
    ) external override onlyElevatedAccess {
        emit MaxLtvRatioSet(address(token), maxLtvRatio);
        debtTokenDetails[token].config.maxLtvRatio = maxLtvRatio.encodeUInt128();
    }

    /**
     * @notice Governance can recover any token from the strategy.
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
     * @notice Update the total debt up until now, then recalculate the interest rate
     * based on the updated utilisation ratio
     */
    function refreshInterestRates(
        IERC20 token
    ) external override {
        updateInterestRates(daiToken, debtTokenDetails[token], debtTokenCache(token));
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           VIEWS                            */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    // @todo check all overrides are there

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

    function getDebtTokenCache(IERC20 token) external view returns (DebtTokenCache memory) {
        return debtTokenCacheRO(token);
    }

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

    function totalPosition() external override view returns (
        TotalPosition memory daiPosition,
        TotalPosition memory oudPosition
    ) {
        daiPosition = fillTotalPosition(daiToken);
        oudPosition = fillTotalPosition(oudToken);
    }

    // Given there are no dependencies on price, relying on off-chain lists of
    // accounts (eg via subgraph) is enough for the bot to get the list of accounts.
    function computeLiquidity(
        address[] memory accounts,
        bool includePendingRequests
    ) external override view returns (LiquidityStatus[] memory status) {
        uint256 _numAccounts = accounts.length;
        for (uint256 i; i < _numAccounts; ++i) {
            status[i] = computeLiquidity(
                allAccountsData[accounts[i]], 
                debtTokenCacheRO(daiToken),
                debtTokenCacheRO(oudToken),
                includePendingRequests
            );
        }
    }
}