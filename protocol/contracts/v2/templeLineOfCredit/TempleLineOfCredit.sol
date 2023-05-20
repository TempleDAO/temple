pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TlcReserveLogic } from "contracts/v2/templeLineOfCredit/TlcReserveLogic.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";

import "forge-std/console.sol";

// @todo need to pause/unpause borrows/repays
// @todo add liquidations

contract TempleLineOfCredit is ITempleLineOfCredit, AbstractStrategy {
    using SafeERC20 for IERC20;
    using TlcReserveLogic for ReserveCache;

    string public constant VERSION = "1.0.0";

    /**
     * @notice Collateral Token supplied by users
     */
    IERC20 public immutable templeToken;

    /**
     * @notice User collateral and current token debt information
     */
    mapping(address => UserData) userData;

    /**
     * @notice Configuration and current data for borrowed tokens
     */
    mapping(IERC20 => ReserveToken) private reserveTokens;

    // @todo change oud to be updatable since it will be deployed later.
    IMintableToken public immutable oudToken;

    TokenPriceType public tpt; // 1
    InterestRateModelType public irmt; // 1
    address public irm;
    uint256 public mlr;
    
    ReserveToken public rtx;
    UserData public udx;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _templeToken,
        ReserveTokenConfig memory _stableTokenConfig,
        address _oudAddress,
        ReserveTokenConfig memory _oudTokenConfig
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        templeToken = IERC20(_templeToken);
        oudToken = IMintableToken(_oudAddress);

        ReserveToken storage rt = reserveTokens[stableToken];
        rt.config = _stableTokenConfig;
        rt.totals.interestAccumulator = 1e18;
        rt.totals.lastUpdatedAt = block.timestamp;

        rt = reserveTokens[IERC20(_oudAddress)];
        rt.config = _oudTokenConfig;
        rt.totals.interestAccumulator = 1e18;
        rt.totals.lastUpdatedAt = block.timestamp;

        // reserveTokens[IERC20(_oudAddress)].config = _oudTokenConfig;
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    function getReserveToken(address token) external view returns (ReserveToken memory) {
        return _getReserveToken(IERC20(token));
    }

    function getUserData(address account) external view returns (
        uint256 collateralPosted, 
        UserTokenDebt memory daiDebt, 
        UserTokenDebt memory oudDebt
    ) {
        UserData storage _userData = userData[account];
        collateralPosted = _userData.collateralPosted;
        daiDebt = _userData.debtData[stableToken];
        oudDebt = _userData.debtData[oudToken];
    }

    function _getReserveToken(IERC20 token) internal view returns (
        ReserveToken storage reserveToken
    ) {
        reserveToken = reserveTokens[token];
        if (address(reserveToken.config.interestRateModel) == address(0)) {
            revert CommonEventsAndErrors.InvalidToken(address(token));
        }
    }

    /**
     * @notice Update the total debt up until now, then recalculate the interest rate
     * based on the updated utilisation ratio
     * @param token address of the debt token
     */
    function refreshInterestRates(address token) external {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));
        ReserveCache memory reserveCache = TlcReserveLogic.cache(reserveToken, treasuryReservesVault);

        // Checkpoint the interest up until now, using the prior interest rate
        // reserveCache.updateState(reserveToken);
        reserveCache.updateInterestRates(reserveToken, address(token)); //, 0, 0);
    }

    function setReserveTokenConfig(address token, ReserveTokenConfig memory config) external onlyElevatedAccess {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));
        ReserveCache memory reserveCache = TlcReserveLogic.cache(reserveToken, treasuryReservesVault);

        // Checkpoint the interest up until now, using the prior interest rate
        // reserveCache.updateState(reserveToken);

        reserveToken.config.tokenPriceType = /*reserveCache.tokenPriceType =*/ config.tokenPriceType;
        reserveToken.config.interestRateModelType = reserveCache.interestRateModelType = config.interestRateModelType;
        reserveToken.config.interestRateModel = reserveCache.interestRateModel = config.interestRateModel;
        // reserveToken.config.maxLtvRatio = config.maxLtvRatio;
        reserveToken.config.maxLtvRatio = reserveCache.maxLtvRatio = config.maxLtvRatio;

        reserveCache.updateInterestRates(reserveToken, address(token)); //, 0, 0);
    }

    function setMaxLtvRatio(address token, uint256 maxLtvRatio) external onlyElevatedAccess {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));
        reserveToken.config.maxLtvRatio = maxLtvRatio;
    }

    // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
    // so the rate is updated.
    // add a test for this.

    function totalDebtInfo() external view returns (
        uint256 stableUtilizationRatio, // based off the last debt checkpoint
        uint256 stableBorrowRate,  // based off the last debt checkpoint
        uint256 stableTotalDebt, // the last debt checkpoint compounded to now
        uint256 oudBorrowRate, // based off the last debt checkpoint
        uint256 oudTotalDebt // the last debt checkpoint compounded to now
    ) {
        ITreasuryReservesVault trv = treasuryReservesVault;

        // Stable (eg DAI)
        ReserveCache memory reserveCache = TlcReserveLogic.cacheRO(reserveTokens[stableToken], trv);
        stableUtilizationRatio = reserveCache.utilizationRatio();
        stableBorrowRate = reserveCache.interestRate; //getBorrowRate(0, 0);
        stableTotalDebt = reserveCache.compoundDebt();

        // OUD
        reserveCache = TlcReserveLogic.cacheRO(reserveTokens[oudToken], trv);
        // utilization ratio for OUD is always zero
        oudBorrowRate = reserveCache.interestRate; //getBorrowRate(0, 0);
        oudTotalDebt = reserveCache.compoundDebt();
    }

    /**
     * @dev Get user total debt incurred (principal + interest)
     * @param account user address
     */
    function userTotalDebt(address account) public view returns (uint256 stableAmount, uint256 oudAmount) {
        ITreasuryReservesVault _trv = treasuryReservesVault;

        // Stable (eg DAI) Debt
        ReserveCache memory _reserveCache = TlcReserveLogic.cacheRO(reserveTokens[stableToken], _trv);
        UserTokenDebt storage _userTokenDebt = userData[account].debtData[stableToken];
        stableAmount = currentUserTokenDebt(
            _reserveCache,
            _userTokenDebt
        );

        // OUD Debt
        _reserveCache = TlcReserveLogic.cacheRO(reserveTokens[oudToken], _trv);
        _userTokenDebt = userData[account].debtData[oudToken];
        oudAmount = currentUserTokenDebt(
            _reserveCache,
            _userTokenDebt
        );
    }

    // @todo add a version where i can post collateral for someone else?

    /**
     * @dev Allows borrower to deposit temple collateral
     * @param collateralAmount is the amount to deposit
     */
    function postCollateral(uint256 collateralAmount) external {
        if (collateralAmount == 0) revert CommonEventsAndErrors.InvalidAmount(address(templeToken), collateralAmount);
        emit PostCollateral(msg.sender, collateralAmount);

        userData[msg.sender].collateralPosted += collateralAmount;

        templeToken.safeTransferFrom(
            msg.sender,
            address(this),
            collateralAmount 
        );
    }

    // @todo add a version where i can state the recipient

    /**
     * @dev Allows user to borrow debt tokens
     * @param stableBorrowAmount amount of stable (eg DAI) to borrow
     * @param oudBorrowAmount amount of OUD to borrow
     */
    function borrow(uint256 stableBorrowAmount, uint256 oudBorrowAmount) external {
        UserData storage _userData = userData[msg.sender];

        if (stableBorrowAmount != 0 ) {
            // @todo keep a buffer?
            treasuryReservesVault.borrow(stableBorrowAmount, msg.sender);
            _borrow(_userData, stableToken, stableBorrowAmount);
        }
        
        if (oudBorrowAmount != 0) {
            _borrow(_userData, oudToken, oudBorrowAmount);
            oudToken.mint(
               msg.sender,
               oudBorrowAmount
            );
        }
    }

    function _borrow(
        UserData storage _userData,
        IERC20 _token,
        uint256 _borrowAmount
    ) internal {
        ReserveToken storage _reserveToken = _getReserveToken(_token);
        ReserveCache memory _reserveCache = TlcReserveLogic.cache(_reserveToken, treasuryReservesVault);
        UserTokenDebt storage _userTokenDebt = _userData.debtData[_token];
        uint256 _newDebt = updateUserTokenDebt(_userTokenDebt, _reserveCache);

        uint256 _borrowCapacity = maxBorrowCapacityInternal(_userData, _reserveCache) - _newDebt;
        if (_borrowAmount > _borrowCapacity) revert InsufficentCollateral(_borrowCapacity, _borrowAmount);

        emit Borrow(msg.sender, address(_token), _borrowAmount);

        _newDebt += _borrowAmount;
        _userTokenDebt.debt = _newDebt;
        _reserveToken.totals.debt = _reserveCache.debt = _reserveCache.debt + _borrowAmount;

        _reserveCache.updateInterestRates(_reserveToken, address(_token));
    }

    // Use this to do the interest rate calcs

    // function callInternalModule(uint moduleId, bytes memory input) internal returns (bytes memory) {
    //     (bool success, bytes memory result) = moduleLookup[moduleId].delegatecall(input);
    //     if (!success) revertBytes(result);
    //     return result;
    // }

    function currentUserTokenDebt(
        ReserveCache memory _reserveCache,
        UserTokenDebt storage _userTokenDebt
    ) internal view returns (uint256) {
        uint256 prevDebt = _userTokenDebt.debt;
        return (prevDebt == 0) 
            ? 0
            : prevDebt * _reserveCache.interestAccumulator / _userTokenDebt.interestAccumulator;
    }

    function updateUserTokenDebt(
        UserTokenDebt storage _userTokenDebt,
        ReserveCache memory _reserveCache
    ) internal returns (uint256 newDebt) {
        newDebt = _userTokenDebt.debt = currentUserTokenDebt(_reserveCache, _userTokenDebt);
        _userTokenDebt.interestAccumulator = _reserveCache.interestAccumulator;
    }

    // @todo add a version where i can repay on behalf of

    /**
     * @notice Allows borrower to repay borrowed amount
     * @param repayStableAmount amount of stable (eg DAI) to repay
     * @param repayOudAmount amount of oud to repay
     */
    function repay(uint256 repayStableAmount, uint256 repayOudAmount) public {
        UserData storage _userData = userData[msg.sender];

        if (repayStableAmount != 0 ) {
            _repay(_userData, stableToken, repayStableAmount);
            stableToken.safeTransferFrom(
                msg.sender,
                address(this),
                repayStableAmount 
            );
        } 
        
        if (repayOudAmount != 0) {
            _repay(_userData, oudToken, repayOudAmount);
            oudToken.burn(
                msg.sender,
                repayOudAmount
            );
        } 
    }

   /**
     * @notice Allows borrower to repay all outstanding balances
     * @dev leave no dust balance
     */
    function repayAll() external {
        // @todo this is filling in the cache twice...
        // can optimise
        (uint256 stableTotalAmount, uint256 oudTotalAmount) = userTotalDebt(msg.sender);
        repay(stableTotalAmount, oudTotalAmount);
    }

    function _repay(
        UserData storage _userData,
        IERC20 _token,
        uint256 _repayAmount
    ) internal {
        ReserveToken storage _reserveToken = _getReserveToken(_token);
        ReserveCache memory _reserveCache = TlcReserveLogic.cache(_reserveToken, treasuryReservesVault);
        UserTokenDebt storage _userTokenDebt = _userData.debtData[_token];
        uint256 _newDebt = updateUserTokenDebt(_userTokenDebt, _reserveCache);

        if (_repayAmount > _newDebt) revert ExceededBorrowedAmount(_newDebt, _repayAmount);

        emit Repay(msg.sender, address(_token), _repayAmount);

        _newDebt -= _repayAmount;
        _userTokenDebt.debt = _newDebt;
        _reserveToken.totals.debt = _reserveCache.debt = _reserveCache.debt - _repayAmount;

        _reserveCache.updateInterestRates(_reserveToken, address(_token));
    }

    /**
     * @notice Get user max borrow capacity 
     * @param token token to get max borrow capacity for 
     * @param account address of user 
     */
    function maxBorrowCapacity(address token, address account) external view returns(uint256) {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));
        ReserveCache memory reserveCache = TlcReserveLogic.cacheRO(reserveToken, treasuryReservesVault);

        return maxBorrowCapacityInternal(
            userData[account],
            reserveCache
        );
    }

    function maxBorrowCapacityInternal(
        UserData storage _userData,
        ReserveCache memory reserveCache
    ) internal view returns (uint256) {
        console.log("_maxBorrowCapacity:", _userData.collateralPosted);
        console.log("\t:", reserveCache.price, reserveCache.maxLtvRatio);
        return mulDiv(
            _userData.collateralPosted * reserveCache.price,
            reserveCache.maxLtvRatio,
            1e8
        );
    }

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override view returns (AssetBalance[] memory assetBalances, uint256 debt) {
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
}