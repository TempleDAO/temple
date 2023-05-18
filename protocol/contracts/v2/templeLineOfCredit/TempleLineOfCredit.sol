pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { mulDiv } from "@prb/math/src/Common.sol";
import { TlcReserveLogic } from "contracts/v2/templeLineOfCredit/TlcReserveLogic.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

import "forge-std/console.sol";

// @todo need to pause/unpause borrows/repays
// @todo add liquidations

contract TempleLineOfCredit is ITempleLineOfCredit, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using CompoundedInterest for uint256;
    using TlcReserveLogic for ReserveCache;

    /**
     * @notice Collateral Token supplied by users
     */
    IERC20 public immutable templeToken;

    /**
     * @notice Total collateral posted per user
     */
    mapping(address => uint256) public userCollateralPosted;

    /**
     * @notice The per user amount of shares issued
     * @dev account => tokenAddress => amount
     */
    mapping(address => mapping(IERC20 => uint256)) public userDebtShares;

    mapping(IERC20 => ReserveToken) private reserveTokens;

    IERC20 public immutable daiToken;

    // @todo change dai to be updatable since it will be deployed later.
    IMintableToken public immutable oudToken;

    ITreasuryReservesVault public treasuryReservesVault;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _templeToken,
        address _daiAddress,
        ReserveTokenConfig memory _daiTokenConfig,
        address _oudAddress,
        ReserveTokenConfig memory _oudTokenConfig,
        address _treasuryReservesVault
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        templeToken = IERC20(_templeToken);

        daiToken = IERC20(_daiAddress);
        reserveTokens[IERC20(_daiAddress)].config = _daiTokenConfig;

        oudToken = IMintableToken(_oudAddress);
        reserveTokens[IERC20(_oudAddress)].config = _oudTokenConfig;
        treasuryReservesVault = ITreasuryReservesVault(_treasuryReservesVault);
    }

    function getReserveToken(address token) external view returns (ReserveToken memory) {
        return _getReserveToken(IERC20(token));
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
        reserveCache.updateState(reserveToken);
        reserveCache.updateInterestRates(reserveToken, address(token), 0, 0);
    }

    function setReserveTokenConfig(address token, ReserveTokenConfig memory config) external onlyElevatedAccess {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));
        ReserveCache memory reserveCache = TlcReserveLogic.cache(reserveToken, treasuryReservesVault);

        // Checkpoint the interest up until now, using the prior interest rate
        reserveCache.updateState(reserveToken);

        reserveToken.config.tokenPriceType = reserveCache.tokenPriceType = config.tokenPriceType;
        reserveToken.config.interestRateModelType = reserveCache.interestRateModelType = config.interestRateModelType;
        reserveToken.config.interestRateModel = reserveCache.interestRateModel = config.interestRateModel;
        reserveToken.config.maxLtvRatio = config.maxLtvRatio;
        reserveToken.config.maxLtvRatio = reserveCache.maxLtvRatio = config.maxLtvRatio;

        reserveCache.updateInterestRates(reserveToken, address(token), 0, 0);
    }

    function setMaxLtvRatio(address token, uint256 maxLtvRatio) external onlyElevatedAccess {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));
        reserveToken.config.maxLtvRatio = maxLtvRatio;
    }

    // @todo remove once we inherit from AbstractStrategy
    /**
     * @notice A strategy's current amount borrowed from the TRV, and how much remaining is free to borrow
     * @dev The remaining amount free to borrow is bound by:
     *   1/ How much stables is globally available (in this contract + in the base strategy)
     *   2/ The amount each individual strategy is whitelisted to borrow.
     * @return currentDebt The current debt position for the strategy, 
     * @return availableToBorrow The remaining amount which the strategy can borrow
     * @return debtCeiling The debt ceiling of the stratgy
     */
    function trvBorrowPosition() external view returns (
        uint256 currentDebt, 
        uint256 availableToBorrow, 
        uint256 debtCeiling
    ) {
        return treasuryReservesVault.strategyBorrowPosition(address(this));
    }

    // @todo when the TRV cap changes, the UR will change. A checkpoint will need to be done then too, 
    // so the rate is updated.
    // add a test for this.

    function totalDebtInfo() external view returns (
        uint256 daiUtilizationRatio, // based off the last debt checkpoint
        uint256 daiBorrowRate,  // based off the last debt checkpoint
        uint256 daiTotalDebt, // the last debt checkpoint compounded to now
        uint256 oudBorrowRate, // based off the last debt checkpoint
        uint256 oudTotalDebt // the last debt checkpoint compounded to now
    ) {
        ITreasuryReservesVault trv = treasuryReservesVault;

        // DAI
        ReserveCache memory reserveCache = TlcReserveLogic.cache(reserveTokens[daiToken], trv);
        daiUtilizationRatio = reserveCache.utilizationRatio();
        daiBorrowRate = reserveCache.interestRate; //getBorrowRate(0, 0);
        daiTotalDebt = reserveCache.compoundDebt();

        // OUD
        reserveCache = TlcReserveLogic.cache(reserveTokens[oudToken], trv);
        oudBorrowRate = reserveCache.interestRate; //getBorrowRate(0, 0);
        oudTotalDebt = reserveCache.compoundDebt();
    }

    /**
     * @dev Get user total debt incurred (principal + interest)
     * @param account user address
     */
    function userTotalDebt(address account) public view returns (uint256 daiAmount, uint256 oudAmount) {
        mapping(IERC20 => uint256) storage _userShares = userDebtShares[account];
        ITreasuryReservesVault _trv = treasuryReservesVault;
        ReserveCache memory _reserveCache;

        // DAI Debt
        {
            _reserveCache = TlcReserveLogic.cache(reserveTokens[daiToken], _trv);

            daiAmount = _sharesToDebt(
                _userShares[daiToken],
                _reserveCache.compoundDebt(),
                _reserveCache.shares, 
                false
            );
        }

        // OUD Debt
        {
            _reserveCache = TlcReserveLogic.cache(reserveTokens[oudToken], _trv);

            oudAmount = _sharesToDebt(
                _userShares[oudToken], 
                _reserveCache.compoundDebt(),
                _reserveCache.shares, 
                false
            );
        }
    }

    /**
     * @dev Allows borrower to deposit temple collateral
     * @param collateralAmount is the amount to deposit
     */
    function postCollateral(uint256 collateralAmount) external {
        if (collateralAmount == 0) revert CommonEventsAndErrors.InvalidAmount(address(templeToken), collateralAmount);
        emit PostCollateral(msg.sender, collateralAmount);

        userCollateralPosted[msg.sender] += collateralAmount;

        templeToken.safeTransferFrom(
            msg.sender,
            address(this),
            collateralAmount 
        );
    }

    /**
     * @dev Allows user to borrow debt tokens
     * @param daiBorrowAmount amount of dai to borrow
     * @param oudBorrowAmount amount of oud to borrow
     */
    function borrow(uint256 daiBorrowAmount, uint256 oudBorrowAmount) external {
        uint256 collateralAmount = userCollateralPosted[msg.sender];

        if (daiBorrowAmount != 0 ) {
            // @todo keep a buffer?
            treasuryReservesVault.borrow(daiBorrowAmount, msg.sender);
            _borrow(daiToken, collateralAmount, daiBorrowAmount);
        } 
        
        if (oudBorrowAmount != 0) {
            _borrow(oudToken, collateralAmount, oudBorrowAmount);
            oudToken.mint(
               msg.sender,
               oudBorrowAmount 
            );
        } 
    }

    function _borrow(
        IERC20 token,
        uint256 collateralAmount, 
        uint256 borrowAmount
    ) internal {
        ReserveToken storage reserveToken = _getReserveToken(token);
        ReserveCache memory reserveCache = TlcReserveLogic.cache(reserveToken, treasuryReservesVault);

        reserveCache.updateState(reserveToken);

        console.log("\n_borrow:", address(token));
        console.log("\tdebt:", reserveCache.debt, "shares:", reserveCache.shares);

        // Check if user has sufficient collateral
        uint256 sharesAmount = userDebtShares[msg.sender][token];
        {
            uint256 existingBorrowedAmount = _sharesToDebt(sharesAmount, reserveCache.debt, reserveCache.shares, false);
            uint256 borrowCapacity = (
                _maxBorrowCapacity(collateralAmount, reserveCache.tokenPriceType, reserveCache.maxLtvRatio) - 
                existingBorrowedAmount
            );

            console.log("collateral check:", sharesAmount, existingBorrowedAmount);
            console.log("\t:", borrowAmount, borrowCapacity);
            if (borrowAmount > borrowCapacity) {
                revert InsufficentCollateral(borrowCapacity, borrowAmount);
            }
        }

        emit Borrow(msg.sender, address(token), borrowAmount);

        sharesAmount = _debtToShares(borrowAmount, reserveCache.debt, reserveCache.shares, false);
        
        userDebtShares[msg.sender][token] += sharesAmount;
        reserveToken.totals.shares = reserveCache.shares + sharesAmount;
        reserveToken.totals.debt = reserveCache.debt + borrowAmount; 

        console.log("debt:", reserveToken.totals.debt, "shares:", reserveToken.totals.shares);
        console.log("------:");

        reserveCache.updateInterestRates(reserveToken, address(token), borrowAmount, 0);
    }

    /**
     * @notice Allows borrower to repay borrowed amount
     * @param repayDaiAmount amount of dai to repay
     * @param repayOudAmount amount of oud to repay
     */
    function repay(uint256 repayDaiAmount, uint256 repayOudAmount) public {
        if (repayDaiAmount != 0 ) {
            _repay(daiToken, repayDaiAmount);
            daiToken.safeTransferFrom(
                msg.sender,
                address(this),
                repayDaiAmount 
            );
        } 
        
        if (repayOudAmount != 0) {
            _repay(oudToken, repayOudAmount);
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
        (uint256 daiTotalAmount, uint256 oudTotalAmount) = userTotalDebt(msg.sender);
        repay(daiTotalAmount, oudTotalAmount);
    }

    function _repay(
        IERC20 token,
        uint256 repayAmount
    ) internal {
        ReserveToken storage reserveToken = _getReserveToken(token);
        ReserveCache memory reserveCache = TlcReserveLogic.cache(reserveToken, treasuryReservesVault);

        reserveCache.updateState(reserveToken);

        console.log("\n_repay:", address(token));
        console.log("\tdebt:", reserveCache.debt, "shares:", reserveCache.shares);

        // _accrueInterest(token, reserveToken);

        // uint256 _totalDebt = reserveToken.totals.debt;
        // uint256 _totalShares = reserveToken.totals.shares;
        uint256 sharesAmount = userDebtShares[msg.sender][token];
        {
            uint256 existingBorrowedAmount = _sharesToDebt(sharesAmount, reserveCache.debt, reserveCache.shares, false);

            console.log("repay too much check:", sharesAmount);
            console.log("\t:", repayAmount, existingBorrowedAmount);
            if (repayAmount > existingBorrowedAmount) {
                revert ExceededBorrowedAmount(existingBorrowedAmount, repayAmount);
            }
        }

        emit Repay(msg.sender, address(token), repayAmount);

        sharesAmount = _debtToShares(repayAmount, reserveCache.debt, reserveCache.shares, true);
        
        userDebtShares[msg.sender][token] -= sharesAmount;
        reserveToken.totals.shares = reserveCache.shares - sharesAmount;
        reserveToken.totals.debt = reserveCache.debt - repayAmount; 

        console.log("debt:", reserveToken.totals.debt, "shares:", reserveToken.totals.shares);
        console.log("------:");

        // _totalDebt -= repayAmount;

        // _updateInterestRates(token, reserveToken, _totalDebt);
        reserveCache.updateInterestRates(reserveToken, address(token), 0, repayAmount);
    }

    /**
     * @notice Get user max borrow capacity 
     * @param token token to get max borrow capacity for 
     * @param account address of user 
     */
    function maxBorrowCapacity(address token, address account) external view returns(uint256) {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));

        return _maxBorrowCapacity(
            userCollateralPosted[account], 
            reserveToken.config.tokenPriceType, 
            reserveToken.config.maxLtvRatio
        );
    }

    function _maxBorrowCapacity(
        uint256 collateralAmount, 
        TokenPriceType debtPriceType,
        uint256 maxLtvRatio
    ) internal view returns (uint256) {
        if (debtPriceType == TokenPriceType.STABLE) {
            // // Debt token isn't the same price as the Temple collateral (eg it's DAI)
            // console.log("_maxBorrowCapacity debt=STABLE (DAI):");
            // console.log("\ttemple:", treasuryReservesVault.treasuryPriceIndex());
            // console.log("\tparams:", collateralAmount, maxLtvRatio);
            // console.log("\tresult:", mulDiv(
            //     collateralAmount * treasuryReservesVault.treasuryPriceIndex(), 
            //     maxLtvRatio,
            //     1e8)
            // );

            // collateralAmount [1e18] * TPI [1e4] * maxLTV [1e4] / [1e8]
            return mulDiv(
                collateralAmount * treasuryReservesVault.treasuryPriceIndex(), 
                maxLtvRatio,
                1e8
            );
        } else {
            // // Debt token is the same price type as the Temple collateral (eg it's OUD)
            // console.log("_maxBorrowCapacity debt=TPI (OUD):");
            // console.log("\tparams:", collateralAmount, maxLtvRatio);
            // console.log("\tresult:", (
            //     collateralAmount *           /* 1e18 */
            //     maxLtvRatio /                  /* 10_000 */
            //     10_000                       /* 10_000 */
            // ));

            // collateralAmount [1e18] * maxLTV [1e4] / [1e4]
            return mulDiv(collateralAmount, maxLtvRatio, 1e4);
        }
    }

    /// @notice mulDiv with an option to round the result up or down to the nearest wei
    function mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }

    function _debtToShares(uint256 _debt, uint256 _totalDebt, uint256 _totalShares, bool roundUp) internal pure returns (uint256) {
        return _totalDebt > 0 
            ? mulDivRound(_debt, _totalShares, _totalDebt, roundUp)
            : _debt;
    }

    function _sharesToDebt(uint256 _shares, uint256 _totalDebt, uint256 _totalShares, bool roundUp) internal pure returns (uint256) {
        return _totalShares > 0 
            ? mulDivRound(_shares, _totalDebt, _totalShares, roundUp)
            : _shares;
    }

}