pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

import { SafeCast } from "contracts/common/SafeCast.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TlcBase } from "contracts/v2/templeLineOfCredit/TlcBase.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TlcBase } from "contracts/v2/templeLineOfCredit/TlcBase.sol";

contract TempleLineOfCredit is TlcBase, ITempleLineOfCredit, TempleElevatedAccess {
contract TempleLineOfCredit is TlcBase, ITempleLineOfCredit, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    // @dev Once constructed, setTlcStrategy() needs to be called
    // @dev Once constructed, setTlcStrategy() needs to be called
    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _templeToken,
        ReserveTokenConfig memory _daiTokenConfig,
        ReserveTokenConfig memory _daiTokenConfig,
        ReserveTokenConfig memory _oudTokenConfig
    ) 
        TempleElevatedAccess(_initialRescuer, _initialExecutor)
        TlcBase(_templeToken)
    {
        // Initialize the Reserve Tokens
        addReserveToken(reserveTokens[TokenType.DAI], _daiTokenConfig);
        addReserveToken(reserveTokens[TokenType.OUD], _oudTokenConfig);
    ) 
        TempleElevatedAccess(_initialRescuer, _initialExecutor)
        TlcBase(_templeToken)
    {
        // Initialize the Reserve Tokens
        addReserveToken(reserveTokens[TokenType.DAI], _daiTokenConfig);
        addReserveToken(reserveTokens[TokenType.OUD], _oudTokenConfig);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                         COLLATERAL                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/
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
    function addCollateral(uint256 collateralAmount, address onBehalfOf) external {
        if (collateralAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit CollateralAdded(msg.sender, onBehalfOf, collateralAmount);

        allUserData[onBehalfOf].collateralPosted = (allUserData[onBehalfOf].collateralPosted + collateralAmount).encodeUInt128();
        allUserData[onBehalfOf].collateralPosted = (allUserData[onBehalfOf].collateralPosted + collateralAmount).encodeUInt128();

        templeToken.safeTransferFrom(
            msg.sender,
            address(this),
            collateralAmount 
        );
    }

    function requestRemoveCollateral(uint256 amount) external {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        UserData storage _userData = allUserData[msg.sender];

        _userData.removeCollateralRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));

        if (_userData.removeCollateralRequest.amount > _userData.collateralPosted) revert ExceededMaxLtv();
        checkLiquidity(_userData);

        emit RemoveCollateralRequested(msg.sender, amount);
    }

    function cancelRemoveCollateralRequest(address account) external {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        
        delete allUserData[msg.sender].removeCollateralRequest;
        emit RemoveCollateralRequestCancelled(account);
    }

    function requestRemoveCollateral(uint256 amount) external {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        UserData storage _userData = allUserData[msg.sender];

        _userData.removeCollateralRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));

        if (_userData.removeCollateralRequest.amount > _userData.collateralPosted) revert ExceededMaxLtv();
        checkLiquidity(_userData);

        emit RemoveCollateralRequested(msg.sender, amount);
    }

    function cancelRemoveCollateralRequest(address account) external {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        
        delete allUserData[msg.sender].removeCollateralRequest;
        emit RemoveCollateralRequestCancelled(account);
    }

    /**
     * @dev Allows borrower to deposit temple collateral
     * @dev Allows borrower to deposit temple collateral
     */
    function removeCollateral(address recipient) external {
        UserData storage _userData = allUserData[msg.sender];

        uint256 _removeAmount;
        {
            WithdrawFundsRequest storage _request = _userData.removeCollateralRequest;
            // @todo change the cooldown secs structure?
            checkWithdrawalCooldown(_request.requestedAt, withdrawCollateralCooldownSecs);
            _removeAmount = _request.amount;
            // uint256 _removeAmount = popRequest(msg.sender, FundsRequestType.WITHDRAW_COLLATERAL);
            delete allUserData[msg.sender].removeCollateralRequest;
    function removeCollateral(address recipient) external {
        UserData storage _userData = allUserData[msg.sender];

        uint256 _removeAmount;
        {
            WithdrawFundsRequest storage _request = _userData.removeCollateralRequest;
            // @todo change the cooldown secs structure?
            checkWithdrawalCooldown(_request.requestedAt, withdrawCollateralCooldownSecs);
            _removeAmount = _request.amount;
            // uint256 _removeAmount = popRequest(msg.sender, FundsRequestType.WITHDRAW_COLLATERAL);
            delete allUserData[msg.sender].removeCollateralRequest;
        }

        uint256 _newCollateral = _userData.collateralPosted - _removeAmount;

        // Update the collateral, and then verify that it doesn't make the debt unsafe.
        _userData.collateralPosted = uint128(_newCollateral);

        // A subtraction in collateral - so the downcast is safe
        _userData.collateralPosted = uint128(_newCollateral);
        emit CollateralRemoved(msg.sender, recipient, _removeAmount);

        uint256 _newCollateral = _userData.collateralPosted - _removeAmount;

        // Update the collateral, and then verify that it doesn't make the debt unsafe.
        _userData.collateralPosted = uint128(_newCollateral);

        // A subtraction in collateral - so the downcast is safe
        _userData.collateralPosted = uint128(_newCollateral);
        emit CollateralRemoved(msg.sender, recipient, _removeAmount);

        checkLiquidity(_userData);
        checkLiquidity(_userData);

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
        UserData storage _userData = allUserData[msg.sender];
        UserTokenDebt storage _userTokenDebt = _userData.debtData[uint256(tokenType)];

        _userTokenDebt.borrowRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));
        emit BorrowRequested(msg.sender, tokenType, amount);

        // @todo add a test case for this.
        // This will check both assets.
        // This is expected, because even though they may be borrowing DAI
        // they may have exceeded the max LTV in OUD. In that case
        // they shouldn't be allowed to borrow DAI until that OUD debt is paid down.
        checkLiquidity(_userData);
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
        UserData storage _userData = allUserData[msg.sender];
        UserTokenDebt storage _userTokenDebt = _userData.debtData[uint256(tokenType)];

        _userTokenDebt.borrowRequest = WithdrawFundsRequest(amount.encodeUInt128(), uint32(block.timestamp));
        emit BorrowRequested(msg.sender, tokenType, amount);

        // @todo add a test case for this.
        // This will check both assets.
        // This is expected, because even though they may be borrowing DAI
        // they may have exceeded the max LTV in OUD. In that case
        // they shouldn't be allowed to borrow DAI until that OUD debt is paid down.
        checkLiquidity(_userData);
    }

    function cancelBorrowRequest(address account, TokenType tokenType) external {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        
        delete allUserData[msg.sender].debtData[uint256(tokenType)].borrowRequest;
        emit BorrowRequestCancelled(account, tokenType);
    }

    function borrow(TokenType tokenType, address recipient) external {
        UserData storage _userData = allUserData[msg.sender];
        UserTokenDebt storage _userTokenDebt = _userData.debtData[uint256(tokenType)];
        ReserveToken storage _reserveToken = reserveTokens[tokenType];
        ReserveCache memory _reserveCache = cache(_reserveToken);

        // Validate and pop the borrow request for this token
        uint256 _borrowAmount;
        {
            WithdrawFundsRequest storage _request = _userTokenDebt.borrowRequest;
            checkWithdrawalCooldown(_request.requestedAt, _reserveCache.config.borrowCooldownSecs);
            _borrowAmount = _request.amount;
            delete _userTokenDebt.borrowRequest;
        }

        // Apply the new borrow
        {

            uint256 _totalDebt = currentUserTokenDebt(_reserveCache, _userTokenDebt.debt, _userTokenDebt.interestAccumulator) + _borrowAmount;

            // Update the state
            _userTokenDebt.debt = _totalDebt.encodeUInt128();
            _userTokenDebt.interestAccumulator = _reserveCache.interestAccumulator;
            _reserveToken.totals.totalDebt = _reserveCache.totalDebt = (
                _reserveCache.totalDebt + _borrowAmount
            ).encodeUInt128();
    function cancelBorrowRequest(address account, TokenType tokenType) external {
        // Either the account holder or the DAO elevated access is allowed to cancel individual requests
        if (msg.sender != account && !isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        
        delete allUserData[msg.sender].debtData[uint256(tokenType)].borrowRequest;
        emit BorrowRequestCancelled(account, tokenType);
    }

    function borrow(TokenType tokenType, address recipient) external {
        UserData storage _userData = allUserData[msg.sender];
        UserTokenDebt storage _userTokenDebt = _userData.debtData[uint256(tokenType)];
        ReserveToken storage _reserveToken = reserveTokens[tokenType];
        ReserveCache memory _reserveCache = cache(_reserveToken);

        // Validate and pop the borrow request for this token
        uint256 _borrowAmount;
        {
            WithdrawFundsRequest storage _request = _userTokenDebt.borrowRequest;
            checkWithdrawalCooldown(_request.requestedAt, _reserveCache.config.borrowCooldownSecs);
            _borrowAmount = _request.amount;
            delete _userTokenDebt.borrowRequest;
        }

        // Apply the new borrow
        {

            uint256 _totalDebt = currentUserTokenDebt(_reserveCache, _userTokenDebt.debt, _userTokenDebt.interestAccumulator) + _borrowAmount;

            // Update the state
            _userTokenDebt.debt = _totalDebt.encodeUInt128();
            _userTokenDebt.interestAccumulator = _reserveCache.interestAccumulator;
            _reserveToken.totals.totalDebt = _reserveCache.totalDebt = (
                _reserveCache.totalDebt + _borrowAmount
            ).encodeUInt128();

            // Update the borrow interest rates based on the now increased utilization ratio
            // console.log("about to update interest rate");
            updateInterestRates(_reserveToken, _reserveCache);
            // Update the borrow interest rates based on the now increased utilization ratio
            // console.log("about to update interest rate");
            updateInterestRates(_reserveToken, _reserveCache);
        }

        emit Borrow(msg.sender, recipient, tokenType, _borrowAmount);
        checkLiquidity(_userData);

        // Finally, send the tokens to the user.
        if (tokenType == TokenType.DAI) {
            // Borrow the funds from the TRV and send to the recipient
            tlcStrategy.fundFromTrv(_borrowAmount, recipient);
        } else {
            // Mint the OUD and send to recipient
            IMintableToken(_reserveCache.config.tokenAddress).mint(recipient, _borrowAmount );
        emit Borrow(msg.sender, recipient, tokenType, _borrowAmount);
        checkLiquidity(_userData);

        // Finally, send the tokens to the user.
        if (tokenType == TokenType.DAI) {
            // Borrow the funds from the TRV and send to the recipient
            tlcStrategy.fundFromTrv(_borrowAmount, recipient);
        } else {
            // Mint the OUD and send to recipient
            IMintableToken(_reserveCache.config.tokenAddress).mint(recipient, _borrowAmount );
        }
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            REPAY                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function repay(TokenType tokenType, uint256 repayAmount, address onBehalfOf) external {
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        ReserveToken storage _reserveToken = reserveTokens[tokenType];
        UserTokenDebt storage _userTokenDebt = allUserData[onBehalfOf].debtData[uint256(tokenType)];
        _doRepayToken(_reserveToken, cache(_reserveToken), repayAmount, _userTokenDebt, tokenType, msg.sender, onBehalfOf);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            REPAY                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function repay(TokenType tokenType, uint256 repayAmount, address onBehalfOf) external {
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        ReserveToken storage _reserveToken = reserveTokens[tokenType];
        UserTokenDebt storage _userTokenDebt = allUserData[onBehalfOf].debtData[uint256(tokenType)];
        _doRepayToken(_reserveToken, cache(_reserveToken), repayAmount, _userTokenDebt, tokenType, msg.sender, onBehalfOf);
    }

    /**
     * @notice Allows borrower to repay all outstanding balances
     * @dev leave no dust balance
     */
    function repayAll(TokenType tokenType, address onBehalfOf) external {
        ReserveToken storage _reserveToken = reserveTokens[tokenType];
        ReserveCache memory _reserveCache = cache(_reserveToken);
        UserTokenDebt storage _userTokenDebt = allUserData[onBehalfOf].debtData[uint256(tokenType)];

    function repayAll(TokenType tokenType, address onBehalfOf) external {
        ReserveToken storage _reserveToken = reserveTokens[tokenType];
        ReserveCache memory _reserveCache = cache(_reserveToken);
        UserTokenDebt storage _userTokenDebt = allUserData[onBehalfOf].debtData[uint256(tokenType)];

        // Get the outstanding debt for Stable
        uint256 repayAmount = currentUserTokenDebt(_reserveCache, _userTokenDebt.debt, _userTokenDebt.interestAccumulator);
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        _doRepayToken(_reserveToken, _reserveCache, repayAmount, _userTokenDebt, tokenType, msg.sender, onBehalfOf);
    }
        uint256 repayAmount = currentUserTokenDebt(_reserveCache, _userTokenDebt.debt, _userTokenDebt.interestAccumulator);
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        _doRepayToken(_reserveToken, _reserveCache, repayAmount, _userTokenDebt, tokenType, msg.sender, onBehalfOf);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                       LIQUIDATIONS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    // Given there are no dependencies on price, relying on off-chain lists of
    // users (eg via subgraph) is enough for the bot to get the list of users
    function computeLiquidity(
        address[] memory accounts,
        bool includePendingRequests
    ) external view returns (LiquidityStatus[] memory status) {
        ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
            cacheRO(reserveTokens[TokenType.DAI]),
            cacheRO(reserveTokens[TokenType.OUD])
        ];
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                       LIQUIDATIONS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    // Given there are no dependencies on price, relying on off-chain lists of
    // users (eg via subgraph) is enough for the bot to get the list of users
    function computeLiquidity(
        address[] memory accounts,
        bool includePendingRequests
    ) external view returns (LiquidityStatus[] memory status) {
        ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
            cacheRO(reserveTokens[TokenType.DAI]),
            cacheRO(reserveTokens[TokenType.OUD])
        ];

        uint256 _numAccounts = accounts.length;
        for (uint256 i; i < _numAccounts; ++i) {
            status[i] = computeLiquidity(
                allUserData[accounts[i]], 
                reserveCaches, 
                includePendingRequests
            );
        uint256 _numAccounts = accounts.length;
        for (uint256 i; i < _numAccounts; ++i) {
            status[i] = computeLiquidity(
                allUserData[accounts[i]], 
                reserveCaches, 
                includePendingRequests
            );
        }
    }

    function batchLiquidate(address[] memory accounts) external {
        LiquidityStatus memory _status;
        uint256 _daiIndex = uint256(TokenType.DAI);
        uint256 _oudIndex = uint256(TokenType.OUD);
    function batchLiquidate(address[] memory accounts) external {
        LiquidityStatus memory _status;
        uint256 _daiIndex = uint256(TokenType.DAI);
        uint256 _oudIndex = uint256(TokenType.OUD);

        uint256 _numAccounts = accounts.length;
        uint256 totalCollateralClaimed;
        ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
            cache(reserveTokens[TokenType.DAI]),
            cache(reserveTokens[TokenType.OUD])
        ];
        uint256 _numAccounts = accounts.length;
        uint256 totalCollateralClaimed;
        ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
            cache(reserveTokens[TokenType.DAI]),
            cache(reserveTokens[TokenType.OUD])
        ];

        uint256[NUM_TOKEN_TYPES] memory totalDebtWiped;
        uint256 i;
        address _account;
        for (; i < _numAccounts; ++i) {
            _account = accounts[i];
            _status = computeLiquidity(allUserData[_account], reserveCaches, false);
        uint256[NUM_TOKEN_TYPES] memory totalDebtWiped;
        uint256 i;
        address _account;
        for (; i < _numAccounts; ++i) {
            _account = accounts[i];
            _status = computeLiquidity(allUserData[_account], reserveCaches, false);

            // Skip if this account is still under the maxLTV across all assets
            if (_status.hasExceededMaxLtv) {
                totalCollateralClaimed += _status.collateral;
                totalDebtWiped[_daiIndex] += _status.debt[_daiIndex];
                totalDebtWiped[_oudIndex] += _status.debt[_oudIndex];
                delete allUserData[_account];    
            }
        }
            // Skip if this account is still under the maxLTV across all assets
            if (_status.hasExceededMaxLtv) {
                totalCollateralClaimed += _status.collateral;
                totalDebtWiped[_daiIndex] += _status.debt[_daiIndex];
                totalDebtWiped[_oudIndex] += _status.debt[_oudIndex];
                delete allUserData[_account];    
            }
        }

        // burn the temple collateral by repaying to TRV. This will burn the equivalent dUSD debt too.
        treasuryReservesVault.repayTemple(totalCollateralClaimed, address(tlcStrategy));

        // Update the reserve token total state and update interest rates.
        for (i = 0; i < NUM_TOKEN_TYPES; ++i) {
            ReserveToken storage _reserveToken = reserveTokens[TokenType(i)];
            // LiquidationTokenParams memory _tokenParams = _liquidationParams.tokens[i];
            ReserveCache memory _reserveCache = reserveCaches[i];

            // Update the reserve token details, and then update the interest rates.            
            // A decrease in amount, so this downcast is safe without a check
            _reserveToken.totals.totalDebt = _reserveCache.totalDebt = uint128(
                _reserveCache.totalDebt - totalDebtWiped[i]
            );

            updateInterestRates(_reserveToken, _reserveCache);
        }
        // burn the temple collateral by repaying to TRV. This will burn the equivalent dUSD debt too.
        treasuryReservesVault.repayTemple(totalCollateralClaimed, address(tlcStrategy));

        // Update the reserve token total state and update interest rates.
        for (i = 0; i < NUM_TOKEN_TYPES; ++i) {
            ReserveToken storage _reserveToken = reserveTokens[TokenType(i)];
            // LiquidationTokenParams memory _tokenParams = _liquidationParams.tokens[i];
            ReserveCache memory _reserveCache = reserveCaches[i];

            // Update the reserve token details, and then update the interest rates.            
            // A decrease in amount, so this downcast is safe without a check
            _reserveToken.totals.totalDebt = _reserveCache.totalDebt = uint128(
                _reserveCache.totalDebt - totalDebtWiped[i]
            );

            updateInterestRates(_reserveToken, _reserveCache);
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
    function setWithdrawCollateralCooldownSecs(uint256 cooldownSecs) external onlyElevatedAccess {
        withdrawCollateralCooldownSecs = uint32(cooldownSecs);
        emit WithdrawCollateralCooldownSecsSet(cooldownSecs);
    }

    function setBorrowCooldownSecs(TokenType tokenType, uint256 cooldownSecs) external onlyElevatedAccess {
        reserveTokens[tokenType].config.borrowCooldownSecs = uint32(cooldownSecs);
        emit BorrowCooldownSecsSet(tokenType, uint32(cooldownSecs));
    function setBorrowCooldownSecs(TokenType tokenType, uint256 cooldownSecs) external onlyElevatedAccess {
        reserveTokens[tokenType].config.borrowCooldownSecs = uint32(cooldownSecs);
        emit BorrowCooldownSecsSet(tokenType, uint32(cooldownSecs));
    }

    function setInterestRateModel(TokenType tokenType, address interestRateModel) external onlyElevatedAccess {
        ReserveToken storage reserveToken = reserveTokens[tokenType]; //_getReserveToken(tokenType);
        ReserveCache memory reserveCache = cache(reserveToken);

    function setInterestRateModel(TokenType tokenType, address interestRateModel) external onlyElevatedAccess {
        ReserveToken storage reserveToken = reserveTokens[tokenType]; //_getReserveToken(tokenType);
        ReserveCache memory reserveCache = cache(reserveToken);

        // Update the cache entry and calculate the new interest rate based off this model.
        reserveToken.config.interestRateModel = reserveCache.config.interestRateModel = IInterestRateModel(interestRateModel);
        updateInterestRates(reserveToken, reserveCache);
        // Update the cache entry and calculate the new interest rate based off this model.
        reserveToken.config.interestRateModel = reserveCache.config.interestRateModel = IInterestRateModel(interestRateModel);
        updateInterestRates(reserveToken, reserveCache);
    }

    function setMaxLtvRatio(TokenType tokenType, uint256 maxLtvRatio) external onlyElevatedAccess {
        ReserveToken storage reserveToken = reserveTokens[tokenType]; //_getReserveToken(tokenType);
        reserveToken.config.maxLtvRatio = maxLtvRatio.encodeUInt128();
    function setMaxLtvRatio(TokenType tokenType, uint256 maxLtvRatio) external onlyElevatedAccess {
        ReserveToken storage reserveToken = reserveTokens[tokenType]; //_getReserveToken(tokenType);
        reserveToken.config.maxLtvRatio = maxLtvRatio.encodeUInt128();
    }

    /**
     * @notice Governance can recover any token from the strategy.
     */
    function recoverToken(address token, address to, uint256 amount) external /*override*/ onlyElevatedAccess {
        // @todo need to change so collateral can't be pinched.
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
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
     * @notice Update the total debt up until now, then recalculate the interest rate
     * based on the updated utilisation ratio
     */
    function refreshInterestRates(TokenType tokenType) external {
        ReserveToken storage reserveToken = reserveTokens[tokenType];
        updateInterestRates(reserveToken, cache(reserveToken));
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           VIEWS                            */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function getUserData(address account) external view returns (UserData memory) {
        return allUserData[account];
    }

    function getReserveCache(TokenType tokenType) external view returns (ReserveCache memory) {
        return cacheRO(reserveTokens[tokenType]);
    }

    function userPosition(address account) external view returns (UserPosition memory position) {
        UserData storage _userData = allUserData[account];
        position.collateralPosted = _userData.collateralPosted;

        ReserveCache memory _reserveCache;
        UserTokenDebt storage _userTokenDebt;
        uint256 latestDebt;
        for (uint256 i; i < NUM_TOKEN_TYPES; ++i) {
            _reserveCache = cacheRO(reserveTokens[TokenType(i)]);
            _userTokenDebt = _userData.debtData[i];
            latestDebt = currentUserTokenDebt(_reserveCache, _userTokenDebt.debt, _userTokenDebt.interestAccumulator);
            position.debtPositions[i] = UserDebtPosition({
                debt: latestDebt,
                maxBorrow: maxBorrowCapacity(_reserveCache, position.collateralPosted), //_reserveToken.config.maxLtvRatio, price),
                healthFactor: healthFactor(_reserveCache, position.collateralPosted, latestDebt), //_reserveToken.config.maxLtvRatio, price),
                loanToValueRatio: loanToValueRatio(_reserveCache, position.collateralPosted, latestDebt) //, price)
            });
        }
    }

    function totalPosition() external view returns (TotalPosition[2] memory positions) {
        ReserveCache memory _reserveCache;
        TotalPosition memory _position;
        for (uint256 i; i < NUM_TOKEN_TYPES; ++i) {
            _reserveCache = cacheRO(reserveTokens[TokenType(i)]);
            _position.utilizationRatio = utilizationRatio(_reserveCache);
            _position.borrowRate = _reserveCache.interestRate;
            _position.totalDebt = _reserveCache.totalDebt;
            positions[i] = _position;
        }
    }
}