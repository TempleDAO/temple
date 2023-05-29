pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

import { SafeCast } from "contracts/common/SafeCast.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TlcBase } from "contracts/v2/templeLineOfCredit/TlcBase.sol";

contract TempleLineOfCredit is TlcBase, ITempleLineOfCredit, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    // @dev Once constructed, setTlcStrategy() needs to be called
    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _templeToken,
        DebtTokenConfig memory _daiTokenConfig,
        DebtTokenConfig memory _oudTokenConfig
    ) 
        TempleElevatedAccess(_initialRescuer, _initialExecutor)
        TlcBase(_templeToken)
    {
        // Initialize the Reserve Tokens
        addDebtToken(TokenType.DAI, _daiTokenConfig);
        addDebtToken(TokenType.OUD, _oudTokenConfig);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                         COLLATERAL                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @dev Allows borrower to deposit temple collateral
     * @param collateralAmount is the amount to deposit
     */
    function addCollateral(uint256 collateralAmount, address onBehalfOf) external {
        if (collateralAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit CollateralAdded(msg.sender, onBehalfOf, collateralAmount);

        allAccountsData[onBehalfOf].collateralPosted = (allAccountsData[onBehalfOf].collateralPosted + collateralAmount).encodeUInt128();

        templeToken.safeTransferFrom(
            msg.sender,
            address(this),
            collateralAmount 
        );
    }

    function requestRemoveCollateral(uint256 amount) external {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        AccountData storage _accountData = allAccountsData[msg.sender];

        _accountData.removeCollateralRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));

        if (_accountData.removeCollateralRequest.amount > _accountData.collateralPosted) revert ExceededMaxLtv();
        checkLiquidity(_accountData);

        emit RemoveCollateralRequested(msg.sender, amount);
    }

    function cancelRemoveCollateralRequest(address account) external {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        
        delete allAccountsData[msg.sender].removeCollateralRequest;
        emit RemoveCollateralRequestCancelled(account);
    }

    /**
     * @dev Allows borrower to deposit temple collateral
     */
    function removeCollateral(address recipient) external {
        AccountData storage _accountData = allAccountsData[msg.sender];

        uint256 _removeAmount;
        {
            WithdrawFundsRequest storage _request = _accountData.removeCollateralRequest;
            // @todo change the cooldown secs structure?
            checkWithdrawalCooldown(_request.requestedAt, withdrawCollateralCooldownSecs);
            _removeAmount = _request.amount;
            // uint256 _removeAmount = popRequest(msg.sender, FundsRequestType.WITHDRAW_COLLATERAL);
            delete allAccountsData[msg.sender].removeCollateralRequest;
        }

        uint256 _newCollateral = _accountData.collateralPosted - _removeAmount;

        // Update the collateral, and then verify that it doesn't make the debt unsafe.
        _accountData.collateralPosted = uint128(_newCollateral);

        // A subtraction in collateral - so the downcast is safe
        _accountData.collateralPosted = uint128(_newCollateral);
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

    function requestBorrow(TokenType tokenType, uint256 amount) external {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        AccountData storage _accountData = allAccountsData[msg.sender];
        AccountDebtData storage _accountDebtData = _accountData.debtData[uint256(tokenType)];

        _accountDebtData.borrowRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));
        emit BorrowRequested(msg.sender, tokenType, amount);

        // @todo add a test case for this.
        // This will check both assets.
        // This is expected, because even though they may be borrowing DAI
        // they may have exceeded the max LTV in OUD. In that case
        // they shouldn't be allowed to borrow DAI until that OUD debt is paid down.
        checkLiquidity(_accountData);
    }

    function cancelBorrowRequest(address account, TokenType tokenType) external {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        
        delete allAccountsData[msg.sender].debtData[uint256(tokenType)].borrowRequest;
        emit BorrowRequestCancelled(account, tokenType);
    }

    function borrow(TokenType tokenType, address recipient) external {
        AccountData storage _accountData = allAccountsData[msg.sender];
        AccountDebtData storage _accountDebtData = _accountData.debtData[uint256(tokenType)];
        DebtTokenDetails storage _debtToken = debtTokenDetails[tokenType];
        DebtTokenCache memory _debtTokenCache = debtTokenCache(_debtToken);

        // Validate and pop the borrow request for this token
        uint256 _borrowAmount;
        {
            WithdrawFundsRequest storage _request = _accountDebtData.borrowRequest;
            checkWithdrawalCooldown(_request.requestedAt, _debtTokenCache.config.borrowCooldownSecs);
            _borrowAmount = _request.amount;
            delete _accountDebtData.borrowRequest;
        }

        // Apply the new borrow
        {

            uint256 _totalDebt = currentAccountDebtData(
                _debtTokenCache, 
                _accountDebtData.debtCheckpoint, 
                _accountDebtData.interestAccumulator
            ) + _borrowAmount;

            // Update the state
            _accountDebtData.debtCheckpoint = _totalDebt.encodeUInt128();
            _accountDebtData.interestAccumulator = _debtTokenCache.interestAccumulator;
            _debtToken.data.totalDebt = _debtTokenCache.totalDebt = (
                _debtTokenCache.totalDebt + _borrowAmount
            ).encodeUInt128();

            // Update the borrow interest rates based on the now increased utilization ratio
            // console.log("about to update interest rate");
            updateInterestRates(_debtToken, _debtTokenCache);
        }

        emit Borrow(msg.sender, recipient, tokenType, _borrowAmount);
        checkLiquidity(_accountData);

        // Finally, send the tokens to the recipient.
        if (tokenType == TokenType.DAI) {
            // Borrow the funds from the TRV and send to the recipient
            tlcStrategy.fundFromTrv(_borrowAmount, recipient);
        } else {
            // Mint the OUD and send to recipient
            IMintableToken(_debtTokenCache.config.tokenAddress).mint(recipient, _borrowAmount );
        }
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            REPAY                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function repay(TokenType tokenType, uint256 repayAmount, address onBehalfOf) external {
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        DebtTokenDetails storage _debtToken = debtTokenDetails[tokenType];
        AccountDebtData storage _accountDebtData = allAccountsData[onBehalfOf].debtData[uint256(tokenType)];
        _doRepayToken(_debtToken, debtTokenCache(_debtToken), repayAmount, _accountDebtData, tokenType, msg.sender, onBehalfOf);
    }

    /**
     * @notice Allows borrower to repay all outstanding balances
     * @dev leave no dust balance
     */
    function repayAll(TokenType tokenType, address onBehalfOf) external {
        DebtTokenDetails storage _debtToken = debtTokenDetails[tokenType];
        DebtTokenCache memory _debtTokenCache = debtTokenCache(_debtToken);
        AccountDebtData storage _accountDebtData = allAccountsData[onBehalfOf].debtData[uint256(tokenType)];

        // Get the outstanding debt for Stable
        uint256 repayAmount = currentAccountDebtData(
            _debtTokenCache,
            _accountDebtData.debtCheckpoint,
            _accountDebtData.interestAccumulator
        );
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        _doRepayToken(_debtToken, _debtTokenCache, repayAmount, _accountDebtData, tokenType, msg.sender, onBehalfOf);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                       LIQUIDATIONS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    // Given there are no dependencies on price, relying on off-chain lists of
    // accounts (eg via subgraph) is enough for the bot to get the list of accounts.
    function computeLiquidity(
        address[] memory accounts,
        bool includePendingRequests
    ) external view returns (LiquidityStatus[] memory status) {
        DebtTokenCache[NUM_TOKEN_TYPES] memory debtTokenCaches = [
            debtTokenCacheRO(debtTokenDetails[TokenType.DAI]),
            debtTokenCacheRO(debtTokenDetails[TokenType.OUD])
        ];

        uint256 _numAccounts = accounts.length;
        for (uint256 i; i < _numAccounts; ++i) {
            status[i] = computeLiquidity(
                allAccountsData[accounts[i]], 
                debtTokenCaches, 
                includePendingRequests
            );
        }
    }

    function batchLiquidate(address[] memory accounts) external {
        LiquidityStatus memory _status;
        uint256 _daiIndex = uint256(TokenType.DAI);
        uint256 _oudIndex = uint256(TokenType.OUD);

        uint256 _numAccounts = accounts.length;
        uint256 totalCollateralClaimed;
        DebtTokenCache[NUM_TOKEN_TYPES] memory debtTokenCaches = [
            debtTokenCache(debtTokenDetails[TokenType.DAI]),
            debtTokenCache(debtTokenDetails[TokenType.OUD])
        ];

        uint256[NUM_TOKEN_TYPES] memory totalDebtWiped;
        uint256 i;
        address _account;
        for (; i < _numAccounts; ++i) {
            _account = accounts[i];
            _status = computeLiquidity(allAccountsData[_account], debtTokenCaches, false);

            // Skip if this account is still under the maxLTV across all assets
            if (_status.hasExceededMaxLtv) {
                totalCollateralClaimed += _status.collateral;
                totalDebtWiped[_daiIndex] += _status.currentDebt[_daiIndex];
                totalDebtWiped[_oudIndex] += _status.currentDebt[_oudIndex];
                delete allAccountsData[_account];    
            }
        }

        // burn the temple collateral by repaying to TRV. This will burn the equivalent dUSD debt too.
        treasuryReservesVault.repayTemple(totalCollateralClaimed, address(tlcStrategy));

        // Update the reserve token total state and update interest rates.
        for (i = 0; i < NUM_TOKEN_TYPES; ++i) {
            DebtTokenDetails storage _debtToken = debtTokenDetails[TokenType(i)];
            // LiquidationTokenParams memory _tokenParams = _liquidationParams.tokens[i];
            DebtTokenCache memory _debtTokenCache = debtTokenCaches[i];

            // Update the reserve token details, and then update the interest rates.            
            // A decrease in amount, so this downcast is safe without a check
            _debtToken.data.totalDebt = _debtTokenCache.totalDebt = uint128(
                _debtTokenCache.totalDebt - totalDebtWiped[i]
            );

            updateInterestRates(_debtToken, _debtTokenCache);
        }
    }
    
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            ADMIN                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    // @todo Check we have setters and events for all the things

    // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
    // so the rate is updated.
    // add a test for this.

    function setTlcStrategy(
        address _tlcStrategy
    ) external onlyElevatedAccess {
        tlcStrategy = ITlcStrategy(_tlcStrategy);
        treasuryReservesVault = tlcStrategy.treasuryReservesVault();
        emit TlcStrategySet(_tlcStrategy);
    }

    function setWithdrawCollateralCooldownSecs(uint256 cooldownSecs) external onlyElevatedAccess {
        withdrawCollateralCooldownSecs = uint32(cooldownSecs);
        emit WithdrawCollateralCooldownSecsSet(cooldownSecs);
    }

    function setBorrowCooldownSecs(TokenType tokenType, uint256 cooldownSecs) external onlyElevatedAccess {
        debtTokenDetails[tokenType].config.borrowCooldownSecs = uint32(cooldownSecs);
        emit BorrowCooldownSecsSet(tokenType, uint32(cooldownSecs));
    }

    function setInterestRateModel(TokenType tokenType, address interestRateModel) external onlyElevatedAccess {
        DebtTokenDetails storage _debtToken = debtTokenDetails[tokenType];
        DebtTokenCache memory _cache = debtTokenCache(_debtToken);

        // Update the cache entry and calculate the new interest rate based off this model.
        _debtToken.config.interestRateModel = _cache.config.interestRateModel = IInterestRateModel(interestRateModel);
        updateInterestRates(_debtToken, _cache);
    }

    function setMaxLtvRatio(TokenType tokenType, uint256 maxLtvRatio) external onlyElevatedAccess {
        DebtTokenDetails storage _debtToken = debtTokenDetails[tokenType];
        _debtToken.config.maxLtvRatio = maxLtvRatio.encodeUInt128();
    }

    /**
     * @notice Governance can recover any token from the strategy.
     */
    function recoverToken(address token, address to, uint256 amount) external /*override*/ onlyElevatedAccess {
        // @todo need to change so collateral can't be pinched.
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Update the total debt up until now, then recalculate the interest rate
     * based on the updated utilisation ratio
     */
    function refreshInterestRates(TokenType tokenType) external {
        DebtTokenDetails storage _debtToken = debtTokenDetails[tokenType];
        updateInterestRates(_debtToken, debtTokenCache(_debtToken));
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           VIEWS                            */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function accountData(address account) external view returns (AccountData memory) {
        return allAccountsData[account];
    }

    function getDebtTokenCache(TokenType tokenType) external view returns (DebtTokenCache memory) {
        return debtTokenCacheRO(debtTokenDetails[tokenType]);
    }

    function accountPosition(address account) external view returns (AccountPosition memory position) {
        AccountData storage _accountData = allAccountsData[account];
        position.collateralPosted = _accountData.collateralPosted;

        DebtTokenCache memory _debtTokenCache;
        AccountDebtData storage _accountDebtData;
        uint256 _latestDebt;
        for (uint256 i; i < NUM_TOKEN_TYPES; ++i) {
            _debtTokenCache = debtTokenCacheRO(debtTokenDetails[TokenType(i)]);
            _accountDebtData = _accountData.debtData[i];
            _latestDebt = currentAccountDebtData(
                _debtTokenCache, 
                _accountDebtData.debtCheckpoint,
                _accountDebtData.interestAccumulator
            );
            position.debtPositions[i] = AccountDebtPosition({
                currentDebt: _latestDebt,
                maxBorrow: maxBorrowCapacity(_debtTokenCache, position.collateralPosted),
                healthFactor: healthFactor(_debtTokenCache, position.collateralPosted, _latestDebt),
                loanToValueRatio: loanToValueRatio(_debtTokenCache, position.collateralPosted, _latestDebt)
            });
        }
    }

    function totalPosition() external view returns (TotalPosition[2] memory positions) {
        DebtTokenCache memory _debtTokenCache;
        TotalPosition memory _position;
        for (uint256 i; i < NUM_TOKEN_TYPES; ++i) {
            _debtTokenCache = debtTokenCacheRO(debtTokenDetails[TokenType(i)]);
            _position.utilizationRatio = utilizationRatio(_debtTokenCache);
            _position.borrowRate = _debtTokenCache.interestRate;
            _position.totalDebt = _debtTokenCache.totalDebt;
            positions[i] = _position;
        }
    }
}