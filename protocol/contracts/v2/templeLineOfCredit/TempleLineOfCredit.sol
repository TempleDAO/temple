pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { IInterestRateModel } from "contracts/interfaces/v2/interestRate/IInterestRateModel.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TlcReserveLogic } from "contracts/v2/templeLineOfCredit/TlcReserveLogic.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";

import "forge-std/console.sol";

// @todo need to pause/unpause borrows/repays
// @todo add liquidations

contract TempleLineOfCredit is ITempleLineOfCredit, AbstractStrategy {
    using SafeERC20 for IERC20;
    using CompoundedInterest for uint256;
    using TlcReserveLogic for ReserveCache;

    string public constant VERSION = "1.0.0";

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

    // @todo change oud to be updatable since it will be deployed later.
    IMintableToken public immutable oudToken;

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

        reserveTokens[stableToken].config = _stableTokenConfig;

        oudToken = IMintableToken(_oudAddress);
        reserveTokens[IERC20(_oudAddress)].config = _oudTokenConfig;
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
        ReserveCache memory reserveCache = TlcReserveLogic.cache(reserveTokens[stableToken], trv);
        stableUtilizationRatio = reserveCache.utilizationRatio();
        stableBorrowRate = reserveCache.interestRate; //getBorrowRate(0, 0);
        stableTotalDebt = reserveCache.compoundDebt();

        // OUD
        reserveCache = TlcReserveLogic.cache(reserveTokens[oudToken], trv);
        oudBorrowRate = reserveCache.interestRate; //getBorrowRate(0, 0);
        oudTotalDebt = reserveCache.compoundDebt();
    }

    /**
     * @dev Get user total debt incurred (principal + interest)
     * @param account user address
     */
    function userTotalDebt(address account) public view returns (uint256 stableAmount, uint256 oudAmount) {
        mapping(IERC20 => uint256) storage _userShares = userDebtShares[account];
        ITreasuryReservesVault _trv = treasuryReservesVault;
        ReserveCache memory _reserveCache;

        // Stable (eg DAI) Debt
        {
            _reserveCache = TlcReserveLogic.cache(reserveTokens[stableToken], _trv);

            stableAmount = _sharesToDebt(
                _userShares[stableToken],
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
     * @param stableBorrowAmount amount of stable (eg DAI) to borrow
     * @param oudBorrowAmount amount of OUD to borrow
     */
    function borrow(uint256 stableBorrowAmount, uint256 oudBorrowAmount) external {
        uint256 collateralAmount = userCollateralPosted[msg.sender];

        if (stableBorrowAmount != 0 ) {
            // @todo keep a buffer?
            treasuryReservesVault.borrow(stableBorrowAmount, msg.sender);
            _borrow(stableToken, collateralAmount, stableBorrowAmount);
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
     * @param repayStableAmount amount of stable (eg DAI) to repay
     * @param repayOudAmount amount of oud to repay
     */
    function repay(uint256 repayStableAmount, uint256 repayOudAmount) public {
        if (repayStableAmount != 0 ) {
            _repay(stableToken, repayStableAmount);
            stableToken.safeTransferFrom(
                msg.sender,
                address(this),
                repayStableAmount 
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
        (uint256 stableTotalAmount, uint256 oudTotalAmount) = userTotalDebt(msg.sender);
        repay(stableTotalAmount, oudTotalAmount);
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