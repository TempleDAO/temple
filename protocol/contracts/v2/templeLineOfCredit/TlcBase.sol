pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcReserveLogic.sol)

import { mulDiv } from "@prb/math/src/Common.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

import { SafeCast } from "contracts/common/SafeCast.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { TlcStorage } from "contracts/v2/templeLineOfCredit/TlcStorage.sol";

// import "forge-std/console.sol";

abstract contract TlcBase is TlcStorage, ITlcEventsAndErrors { 
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using CompoundedInterest for uint256;

    constructor(address _templeToken) 
        TlcStorage(_templeToken)
    {}

    function addReserveToken(
        ReserveToken storage reserveToken,
        ReserveTokenConfig memory config
    ) internal {
        // Do not allow an LTV > 100%
        if (config.maxLtvRatio > 1e18) revert CommonEventsAndErrors.InvalidParam();
        if (address(config.tokenAddress) == address(0)) revert CommonEventsAndErrors.ExpectedNonZero();
        if (address(config.interestRateModel) == address(0)) revert CommonEventsAndErrors.ExpectedNonZero();

        reserveToken.config = config;
        reserveToken.totals.interestAccumulator = INITIAL_INTEREST_ACCUMULATOR;
        reserveToken.totals.interestAccumulatorUpdatedAt = uint32(block.timestamp);
    }

    function initCache(
        ReserveToken storage reserveToken,
        ReserveCache memory reserveCache
    ) private view returns (bool dirty) {
        reserveCache.config = reserveToken.config;
        reserveCache.interestAccumulator = reserveToken.totals.interestAccumulator.encodeUInt128();
        reserveCache.totalDebt = reserveToken.totals.totalDebt;
        reserveCache.interestRate = reserveToken.totals.interestRate;

        {
            ITreasuryReservesVault _trv = treasuryReservesVault;
            if (reserveCache.config.interestRateModelType == InterestRateModelType.TRV_UTILIZATION_RATE) {
                reserveCache.trvDebtCeiling = _trv.strategyDebtCeiling(address(tlcStrategy));
            }

            reserveCache.price = (reserveCache.config.tokenPriceType == TokenPriceType.STABLE)
                ? _trv.treasuryPriceIndex()
                : 1e18;
        }

        uint256 interestAccumulatorUpdatedAt = reserveToken.totals.interestAccumulatorUpdatedAt;
        uint32 blockTs = uint32(block.timestamp);
        if (blockTs != interestAccumulatorUpdatedAt) {
            dirty = true;

            // @todo Euler also checks for overflows and ignores if it will take it over...?
            uint256 newInterestAccumulator = uint256(reserveCache.interestAccumulator).continuouslyCompounded(
                blockTs - interestAccumulatorUpdatedAt,
                reserveCache.interestRate
            );

            reserveCache.totalDebt = mulDiv(
                newInterestAccumulator,
                reserveCache.totalDebt,
                reserveCache.interestAccumulator
            ).encodeUInt128();
            reserveCache.interestAccumulator = newInterestAccumulator.encodeUInt128();
        }
    }

    function cache(
        ReserveToken storage reserveToken
    ) internal returns (
        ReserveCache memory reserveCache
    ) {
        if (initCache(reserveToken, reserveCache)) {
            reserveToken.totals.interestAccumulatorUpdatedAt = uint32(block.timestamp); //reserveCache.interestAccumulatorUpdatedAt;
            reserveToken.totals.totalDebt = reserveCache.totalDebt;
            reserveToken.totals.interestAccumulator = reserveCache.interestAccumulator;
        }
    }

    // @todo read only re-entrancy?
    function cacheRO(
        ReserveToken storage reserveToken
    ) internal view returns (
        ReserveCache memory reserveCache
    ) {
        initCache(reserveToken, reserveCache);
    }

    function updateInterestRates(
        ReserveToken storage reserveToken,
        ReserveCache memory reserveCache
    ) internal {
        int96 newInterestRate = reserveCache.config.interestRateModel.calculateInterestRate(
            utilizationRatio(reserveCache)
        );

        // Update storage if it differs to the existing one.
        if (reserveCache.interestRate != newInterestRate) {
            emit InterestRateUpdate(reserveCache.config.tokenAddress, newInterestRate);
            reserveToken.totals.interestRate = reserveCache.interestRate = newInterestRate;
        }
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                        INTERNALS                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    function checkWithdrawalCooldown(
        uint32 _requestedAt, 
        uint32 _cooldownSecs
    ) internal view {
        if (_requestedAt == 0 || block.timestamp < _requestedAt + _cooldownSecs)
            revert CooldownPeriodNotMet(_requestedAt, _cooldownSecs);
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
        uint256 _newDebt = currentUserTokenDebt(_reserveCache, _userTokenDebt.debt, _userTokenDebt.interestAccumulator);

        // They cannot repay more than this debt
        // address tokenAddress = _reserveCache.config.tokenAddress;
        if (_repayAmount > _newDebt) revert ExceededBorrowedAmount(_reserveCache.config.tokenAddress, _newDebt, _repayAmount);

        _newDebt -= _repayAmount;
        _userTokenDebt.debt = _newDebt.encodeUInt128();
        _userTokenDebt.interestAccumulator = _reserveCache.interestAccumulator;
        _reserveToken.totals.totalDebt = _reserveCache.totalDebt = uint128(
            _reserveCache.totalDebt - _repayAmount
        );

        updateInterestRates(_reserveToken, _reserveCache);

        emit Repay(_fromAccount, _onBehalfOf, _tokenType, _repayAmount);
        
        if (_tokenType == TokenType.DAI) {
            // Pull the stables, and repay the TRV debt on behalf of the strategy.
            IERC20(_reserveCache.config.tokenAddress).safeTransferFrom(_fromAccount, address(this), _repayAmount);
            treasuryReservesVault.repay(_repayAmount, address(tlcStrategy));
        } else {
            // Burn the OUD
            IMintableToken(_reserveCache.config.tokenAddress).burn(_fromAccount, _repayAmount);
        }
    }

    function computeLiquidityForToken(
        ReserveCache memory _reserveCache,
        UserTokenDebt storage _userTokenDebt,
        bool _includePendingRequests,
        LiquidityStatus memory status
    ) internal view {
        if (_userTokenDebt.debt == 0) return;
        uint256 totalDebt = currentUserTokenDebt(_reserveCache, _userTokenDebt.debt, _userTokenDebt.interestAccumulator);
        if (_includePendingRequests) {
            totalDebt += _userTokenDebt.borrowRequest.amount; 
        }

        if (!status.hasExceededMaxLtv) {
            status.hasExceededMaxLtv = totalDebt > maxBorrowCapacity(
                _reserveCache,
                status.collateral
            );
        }
    }

    function computeLiquidity(
        UserData storage _userData,
        ReserveCache[NUM_TOKEN_TYPES] memory _reserveCaches,
        bool _includePendingRequests
    ) internal view returns (LiquidityStatus memory status) {
        status.collateral = _userData.collateralPosted;
        if (_includePendingRequests) {
            status.collateral -= _userData.removeCollateralRequest.amount;
        }

        computeLiquidityForToken(_reserveCaches[uint256(TokenType.DAI)], _userData.debtData[uint256(TokenType.DAI)], _includePendingRequests, status);
        computeLiquidityForToken(_reserveCaches[uint256(TokenType.OUD)], _userData.debtData[uint256(TokenType.OUD)], _includePendingRequests, status);
    }

    function checkLiquidity(UserData storage _userData) internal view {
        ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
            cacheRO(reserveTokens[TokenType.DAI]),
            cacheRO(reserveTokens[TokenType.OUD])
        ];
        LiquidityStatus memory _status = computeLiquidity(_userData, reserveCaches, true);
        if (_status.hasExceededMaxLtv) revert ExceededMaxLtv();
    }

    function utilizationRatio(
        ReserveCache memory reserveCache
    ) internal pure returns (uint256) {
        // The UR parameter is used by the 'Fixed' interest rate model
        return reserveCache.trvDebtCeiling == 0
            ? 0
            : uint256(reserveCache.totalDebt) * 1e18 / reserveCache.trvDebtCeiling;
    }
    
    function currentUserTokenDebt(
        ReserveCache memory _reserveCache,
        uint128 _userTokenDebt,
        uint128 _userTokenInterestAccumulator
    ) internal pure returns (uint256) {
        uint256 prevDebt = _userTokenDebt;
        return (prevDebt == 0) 
            ? 0
            : prevDebt * _reserveCache.interestAccumulator / _userTokenInterestAccumulator;
    }

    function maxBorrowCapacity(
        ReserveCache memory _reserveCache,
        uint256 collateralPosted
    ) internal pure returns (uint256) {
        return mulDiv(
            collateralPosted * _reserveCache.price,
            _reserveCache.config.maxLtvRatio,
            1e36
        );
    }

    function healthFactor(
        ReserveCache memory _reserveCache,
        uint256 collateralPosted,
        uint256 debt
    ) internal pure returns (uint256) {
        return debt == 0
            ? type(uint256).max
            : mulDiv(
                collateralPosted * _reserveCache.price,
                _reserveCache.config.maxLtvRatio,
                debt * 1e18
            );
    }

    function loanToValueRatio(
        ReserveCache memory _reserveCache,
        uint256 collateralPosted,
        uint256 debt
    ) internal pure returns (uint256) {
        return collateralPosted == 0
            ? type(uint256).max
            : mulDiv(
                debt,
                1e36,
                collateralPosted * _reserveCache.price
            );
    }
}