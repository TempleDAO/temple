pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TlcBaseLogic } from "contracts/v2/templeLineOfCredit/TlcBaseLogic.sol";

import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";

import { TlcStorage } from "contracts/v2/templeLineOfCredit/TlcStorage.sol";
import { ITlcLiquidationModule } from "contracts/interfaces/v2/templeLineOfCredit/ITlcLiquidationModule.sol";

import "forge-std/console.sol";

// @todo need to pause/unpause borrows/repays
// @todo add cooldown

/**
post collateral: no
borrow: yes
repay: now
withdraw collateral: yes
 */

contract TempleLineOfCredit is ITempleLineOfCredit, TlcStorage, AbstractStrategy {
    using SafeERC20 for IERC20;
    using TlcBaseLogic for ReserveCache;
    using TlcBaseLogic for ReserveToken;
    using SafeCast for uint256;

    string public constant VERSION = "1.0.0";

    // /**
    //  * @notice Collateral Token supplied by users
    //  */
    // IERC20 public immutable templeToken;

    // /**
    //  * @notice User collateral and current token debt information
    //  */
    // mapping(address => UserData) private allUserData;

    // // mapping(address => mapping(FundsRequestType => WithdrawFundsRequest)) public fundsRequests;

    // /**
    //  * @notice Configuration and current data for borrowed tokens
    //  */
    // mapping(TokenType => ReserveToken) public reserveTokens;

    // uint32 public withdrawCollateralCooldownSecs;

    // // @todo add tests to check the sizes
    // uint256 public constant NUM_TOKEN_TYPES = 2;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _templeToken,
        ReserveTokenConfig memory _daiTokenConfig,
        ReserveTokenConfig memory _oudTokenConfig
    ) 
        AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault)
        TlcStorage(_templeToken)
    {
        // templeToken = IERC20(_templeToken);

        // Initialize the Reserve Tokens
        reserveTokens[TokenType.DAI].addReserveToken(_daiTokenConfig);
        reserveTokens[TokenType.OUD].addReserveToken(_oudTokenConfig);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                          SETTERS                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function setWithdrawCollateralCooldownSecs(uint256 cooldownSecs) external onlyElevatedAccess {
        withdrawCollateralCooldownSecs = uint32(cooldownSecs);
        emit WithdrawCollateralCooldownSecsSet(cooldownSecs);
    }

    function setBorrowCooldownSecs(TokenType tokenType, uint256 cooldownSecs) external onlyElevatedAccess {
        reserveTokens[tokenType].config.borrowCooldownSecs = uint32(cooldownSecs);
        emit BorrowCooldownSecsSet(tokenType, uint32(cooldownSecs));
    }

    function setInterestRateModel(TokenType tokenType, address interestRateModel) external onlyElevatedAccess {
        ReserveToken storage reserveToken = reserveTokens[tokenType]; //_getReserveToken(tokenType);
        ReserveCache memory reserveCache = reserveToken.cache();

        // Update the cache entry and calculate the new interest rate based off this model.
        reserveToken.config.interestRateModel = reserveCache.config.interestRateModel = IInterestRateModel(interestRateModel);
        reserveToken.updateInterestRates(reserveCache, treasuryReservesVault);
    }

    function setMaxLtvRatio(TokenType tokenType, uint256 maxLtvRatio) external onlyElevatedAccess {
        ReserveToken storage reserveToken = reserveTokens[tokenType]; //_getReserveToken(tokenType);
        reserveToken.config.maxLtvRatio = maxLtvRatio.encodeUInt128();
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                          GETTERS                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    function getUserData(address account) external view returns (UserData memory) {
        return allUserData[account];
    }

    function getReserveCache(TokenType tokenType) external view returns (ReserveCache memory) {
        return reserveTokens[tokenType].cacheRO();
    }

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override view returns (
        AssetBalance[] memory assetBalances, 
        uint256 debt
    ) {
        // The only asset which TLC has is the Temple collateral given by users.
        // In the case of a user liquidation, that user Temple is burned, and
        // the equivalent dUSD debt is also reduced by `Temple x TPI`
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(templeToken),
            balance: addManualAssetBalanceDelta(
                templeToken.balanceOf(address(this)), 
                address(templeToken)
            )
        });

        debt = currentDebt();
    }

    /**
     * @notice Update the total debt up until now, then recalculate the interest rate
     * based on the updated utilisation ratio
     */
    function refreshInterestRates(TokenType tokenType) external {
        ReserveToken storage reserveToken = reserveTokens[tokenType];
        reserveToken.updateInterestRates(reserveToken.cache(), treasuryReservesVault);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                            ADMIN                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * @notice Governance can recover any token from the strategy.
     */
    function recoverToken(address token, address to, uint256 amount) external override onlyElevatedAccess {
        // @todo need to change so collateral can't be pinched.
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice An automated shutdown is not possible for TLC. All users will first have to exit positions:
     *   - Pause new borrows
     *   - Comms for users to exit
     *   - Increase the borrow rate | reduce maxLTV such that users are slowly liquidated
     *
     * Once done and all debt is repaid, they can give the all clear for governance to then shutdown the strategy
     * by calling TRV.shutdown(strategy, stables recovered)
     */
    function automatedShutdown() external virtual override returns (uint256) {
        revert Unimplemented();
    }

    // @todo add rescue token. should be able to take all collateral > total collateral

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

    function checkFundsRequest(uint32 _requestedAt, uint32 _cooldownSecs) internal view { //} returns (uint256 amount) {
        // WithdrawFundsRequest storage _request = fundsRequests[_account][_requestType];
        // amount = _request.amount;
        // uint32 _requestedAt = _request.requestedAt;
        // uint32 _cooldownSecs = 0; //fundRequestCooldownSecs[_requestType];

        console.log("cooldown:", block.timestamp, _requestedAt, _cooldownSecs);
        if (_requestedAt == 0 || block.timestamp < _requestedAt + _cooldownSecs)
            revert CooldownPeriodNotMet(_requestedAt, _cooldownSecs);

        // delete fundsRequests[_account][_requestType];
    }

    /**
     * @dev Allows borrower to deposit temple collateral
     */
    function removeCollateral(address recipient) external {
        UserData storage _userData = allUserData[msg.sender];

        uint256 _removeAmount;
        {
            WithdrawFundsRequest storage _request = _userData.removeCollateralRequest;
            // @todo change the cooldown secs structure?
            checkFundsRequest(_request.requestedAt, withdrawCollateralCooldownSecs);
            _removeAmount = _request.amount;
            // uint256 _removeAmount = popRequest(msg.sender, FundsRequestType.WITHDRAW_COLLATERAL);
            delete allUserData[msg.sender].removeCollateralRequest;
        }

        uint256 _newCollateral = _userData.collateralPosted - _removeAmount;

        // Update the collateral, and then verify that it doesn't make the debt unsafe.
        _userData.collateralPosted = uint128(_newCollateral);

        // if (isInsufficientCollateral(_userData)) revert ExceededMaxLtv();

        // A subtraction in collateral - so the downcast is safe
        _userData.collateralPosted = uint128(_newCollateral);
        emit CollateralRemoved(msg.sender, recipient, _removeAmount);

        checkLiquidity(_userData);

        templeToken.safeTransfer(
            recipient,
            _removeAmount
        );
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                        BORROW/REPAY                        */
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
        ReserveCache memory _reserveCache = _reserveToken.cache();

        // Validate and pop the borrow request for this token
        uint256 _borrowAmount;
        {
            WithdrawFundsRequest storage _request = _userTokenDebt.borrowRequest;
            checkFundsRequest(_request.requestedAt, _reserveCache.config.borrowCooldownSecs);
            _borrowAmount = _request.amount;
            delete _userTokenDebt.borrowRequest;
        }

        // Apply the new borrow
        {

            uint256 _totalDebt = _reserveCache.currentUserTokenDebt(_userTokenDebt.debt, _userTokenDebt.interestAccumulator) + _borrowAmount;

            // Update the state
            _userTokenDebt.debt = _totalDebt.encodeUInt128();
            _userTokenDebt.interestAccumulator = _reserveCache.interestAccumulator;
            _reserveToken.totals.totalDebt = _reserveCache.totalDebt = (
                _reserveCache.totalDebt + _borrowAmount
            ).encodeUInt128();

            // Update the borrow interest rates based on the now increased utilization ratio
            console.log("about to update interest rate");
            _reserveToken.updateInterestRates(_reserveCache, treasuryReservesVault);
        }

        emit Borrow(msg.sender, recipient, tokenType, _borrowAmount);
        checkLiquidity(_userData);

        // Finally, send the tokens to the user.
        if (tokenType == TokenType.DAI) {
            // Borrow the funds from the TRV and send to the recipient
            treasuryReservesVault.borrow(_borrowAmount, recipient);
        } else {
            // Mint the OUD and send to recipient
            IMintableToken(_reserveCache.config.tokenAddress).mint(recipient, _borrowAmount );
        }
    }

    function repay(TokenType tokenType, uint256 repayAmount, address onBehalfOf) external {
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        ReserveToken storage _reserveToken = reserveTokens[tokenType];
        UserTokenDebt storage _userTokenDebt = allUserData[onBehalfOf].debtData[uint256(tokenType)];
        _doRepayToken(_reserveToken, _reserveToken.cache(), repayAmount, _userTokenDebt, tokenType, msg.sender, onBehalfOf);
    }

    /**
     * @notice Allows borrower to repay all outstanding balances
     * @dev leave no dust balance
     */
    function repayAll(TokenType tokenType, address onBehalfOf) external {
        ReserveToken storage _reserveToken = reserveTokens[tokenType];
        ReserveCache memory _reserveCache = _reserveToken.cache();
        UserTokenDebt storage _userTokenDebt = allUserData[onBehalfOf].debtData[uint256(tokenType)];

        // Get the outstanding debt for Stable
        uint256 repayAmount = _reserveCache.currentUserTokenDebt(_userTokenDebt.debt, _userTokenDebt.interestAccumulator);
        if (repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        _doRepayToken(_reserveToken, _reserveCache, repayAmount, _userTokenDebt, tokenType, msg.sender, onBehalfOf);
    }

    function _doRepayToken(
        ReserveToken storage _reserveToken,
        ReserveCache memory _reserveCache,
        uint256 _repayAmount,
        UserTokenDebt storage _userTokenDebt,
        TokenType _tokenType,
        address _fromAccount,
        address _onBehalfOf
    ) internal {
        // Update the user's latest debt
        uint256 _newDebt = _reserveCache.currentUserTokenDebt(_userTokenDebt.debt, _userTokenDebt.interestAccumulator);

        // They cannot repay more than this debt
        if (_repayAmount > _newDebt) revert ExceededBorrowedAmount(_reserveCache.config.tokenAddress, _newDebt, _repayAmount);

        _newDebt -= _repayAmount;
        _userTokenDebt.debt = _newDebt.encodeUInt128();
        _userTokenDebt.interestAccumulator = _reserveCache.interestAccumulator;
        _reserveToken.totals.totalDebt = _reserveCache.totalDebt = uint128(
            _reserveCache.totalDebt - _repayAmount
        );

        _reserveToken.updateInterestRates(_reserveCache, treasuryReservesVault);

        emit Repay(_fromAccount, _onBehalfOf, _tokenType, _repayAmount);
        
        if (_tokenType == TokenType.DAI) {
            // Pull the stables, and repay the TRV debt
            IERC20(_reserveCache.config.tokenAddress).safeTransferFrom(_fromAccount, address(this), _repayAmount);
            treasuryReservesVault.repay(_repayAmount, address(this));
        } else {
            // Burn the OUD
            IMintableToken(_reserveCache.config.tokenAddress).burn(_fromAccount, _repayAmount);
        }
    }


    // /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    // /*                       LIQUIDATIONS                         */
    // /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    enum ModuleKind {
        LIQUIDATION
    }

    mapping(ModuleKind => address) public modules;

    function callInternalModule(ModuleKind moduleKind, bytes memory input) internal returns (bytes memory) {
        console.log("call internal");
        (bool success, bytes memory result) = modules[moduleKind].delegatecall(input);
        console.log("call internal result:", success);

        if (success) {
            return result;
        } else if (result.length > 0) {
            // Look for revert reason and bubble it up if present
            // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Address.sol#L232
            assembly {
                revert(add(32, result), mload(result))
            }
        } else {
            revert UnknownFailure();
        }
    }

    function checkLiquidity(UserData storage _userData) internal {
        callInternalModule(ModuleKind.LIQUIDATION, abi.encodeWithSelector(ITlcLiquidationModule.checkLiquidity.selector, _userData));
    }


    // function batchLiquidate(address[] memory accounts) external {
    //     ITreasuryReservesVault _trv = treasuryReservesVault;
    //     LiquidityStatus memory _status;
    //     uint256 _daiIndex = uint256(TokenType.DAI);
    //     uint256 _oudIndex = uint256(TokenType.OUD);

    //     uint256 _numAccounts = accounts.length;
    //     uint256 totalCollateralClaimed;
    //     ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
    //         reserveTokens[TokenType.DAI].cache(),
    //         reserveTokens[TokenType.OUD].cache()
    //     ];

    //     uint256[NUM_TOKEN_TYPES] memory totalDebtWiped;
    //     uint256 i;
    //     address _account;
    //     for (; i < _numAccounts; ++i) {
    //         _account = accounts[i];
    //         _status = computeLiquidity(allUserData[_account], reserveCaches, false);

    //         // Skip if this account is still under the maxLTV across all assets
    //         if (_status.hasExceededMaxLtv) {
    //             totalCollateralClaimed += _status.collateral;
    //             totalDebtWiped[_daiIndex] += _status.debt[_daiIndex];
    //             totalDebtWiped[_oudIndex] += _status.debt[_oudIndex];
    //             delete allUserData[_account];    
    //         }
    //     }

    //     // burn the temple collateral by repaying to TRV. This will burn the equivalent dUSD debt too.
    //     _trv.repayTemple(totalCollateralClaimed, address(this));

    //     // Update the reserve token total state and update interest rates.
    //     for (i = 0; i < NUM_TOKEN_TYPES; ++i) {
    //         ReserveToken storage _reserveToken = reserveTokens[TokenType(i)];
    //         // LiquidationTokenParams memory _tokenParams = _liquidationParams.tokens[i];
    //         ReserveCache memory _reserveCache = reserveCaches[i];

    //         // Update the reserve token details, and then update the interest rates.            
    //         // A decrease in amount, so this downcast is safe without a check
    //         _reserveToken.totals.totalDebt = _reserveCache.totalDebt = uint128(
    //             _reserveCache.totalDebt - totalDebtWiped[i]
    //         );

    //         _reserveToken.updateInterestRates(_reserveCache, treasuryReservesVault);
    //     }
    // }

    // function computeLiquidityForToken(
    //     ReserveCache memory _reserveCache,
    //     UserTokenDebt storage _userTokenDebt,
    //     bool _includePendingRequests,
    //     LiquidityStatus memory status
    // ) private view {
    //     if (_userTokenDebt.debt == 0) return;
    //     uint256 totalDebt = _reserveCache.currentUserTokenDebt(_userTokenDebt.debt, _userTokenDebt.interestAccumulator);
    //     if (_includePendingRequests) {
    //         totalDebt += _userTokenDebt.borrowRequest.amount; 
    //     }

    //     if (!status.hasExceededMaxLtv) {
    //         status.hasExceededMaxLtv = totalDebt > _reserveCache.maxBorrowCapacity(status.collateral, treasuryReservesVault);
    //     }
    // }

    // function computeLiquidity(
    //     UserData storage _userData,
    //     ReserveCache[NUM_TOKEN_TYPES] memory _reserveCaches,
    //     bool _includePendingRequests
    // ) private view returns (LiquidityStatus memory status) {
    //     status.collateral = _userData.collateralPosted;
    //     if (_includePendingRequests) {
    //         status.collateral -= _userData.removeCollateralRequest.amount;
    //     }

    //     computeLiquidityForToken(_reserveCaches[uint256(TokenType.DAI)], _userData.debtData[uint256(TokenType.DAI)], _includePendingRequests, status);
    //     computeLiquidityForToken(_reserveCaches[uint256(TokenType.OUD)], _userData.debtData[uint256(TokenType.OUD)], _includePendingRequests, status);
    // }

    // // @todo think about how best to get the list of all users
    // // so the bot can iterate on them.
    // // Just relying on subgraph could be risky if it's down?
    // // Paginated list of accounts?
    // function computeLiquidity(
    //     address account, 
    //     bool includePendingRequests
    // ) external view returns (LiquidityStatus memory status) {
    //     ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
    //         reserveTokens[TokenType.DAI].cacheRO(),
    //         reserveTokens[TokenType.OUD].cacheRO()
    //     ];
    //     status = computeLiquidity(allUserData[account], reserveCaches, includePendingRequests);
    // }

    // function checkLiquidity(UserData storage _userData) internal view {
    //     ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
    //         reserveTokens[TokenType.DAI].cacheRO(),
    //         reserveTokens[TokenType.OUD].cacheRO()
    //     ];
    //     LiquidityStatus memory _status = computeLiquidity(_userData, reserveCaches, true);
    //     if (_status.hasExceededMaxLtv) revert ExceededMaxLtv();
    // }

}