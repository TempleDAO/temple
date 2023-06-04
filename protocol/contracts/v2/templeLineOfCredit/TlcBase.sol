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

abstract contract TlcBase is TlcStorage, ITlcEventsAndErrors { 
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using CompoundedInterest for uint256;

    struct DebtTokenCache {
        DebtTokenConfig config;

        /// @notice Total amount that has already been borrowed, which increases as interest accrues
        uint128 totalDebt;

        /// @notice The interest rate as of the last borrow/repay/
        uint96 interestRate;

        uint128 interestAccumulator;

        // 18 decimals
        uint256 price;
        
        /// @notice The max allowed to be borrowed from the TRV
        /// @dev Used as the denominator in the Utilisation Ratio
        uint256 trvDebtCeiling;
    }
    
    constructor(address _templeToken, address _daiToken, address _oudToken) 
        TlcStorage(_templeToken, _daiToken, _oudToken)
    {}

    function addDebtToken(
        IERC20 _token,
        DebtTokenConfig memory _config
    ) internal {
        if (_config.maxLtvRatio > 1e18) revert CommonEventsAndErrors.InvalidParam();
        if (address(_config.interestRateModel) == address(0)) revert CommonEventsAndErrors.ExpectedNonZero();

        DebtTokenDetails storage _debtTokenDetails = debtTokenDetails[_token];
        _debtTokenDetails.config = _config;
        _debtTokenDetails.data.interestAccumulator = INITIAL_INTEREST_ACCUMULATOR;
        _debtTokenDetails.data.interestAccumulatorUpdatedAt = uint32(block.timestamp);
    }

    function initDebtTokenCache(
        IERC20 _token,
        DebtTokenDetails storage _debtTokenDetails,
        DebtTokenCache memory _cache
    ) private view returns (bool dirty) {
        _cache.config = _debtTokenDetails.config;
        // No need to use `encodeUInt128()` here - straight from storage of the same dimension
        _cache.interestAccumulator = uint128(_debtTokenDetails.data.interestAccumulator);
        _cache.totalDebt = _debtTokenDetails.data.totalDebt;
        _cache.interestRate = _debtTokenDetails.data.interestRate;

        if (_token == daiToken) {
            ITreasuryReservesVault _trv = treasuryReservesVault;
            _cache.trvDebtCeiling = _trv.strategyDebtCeiling(address(tlcStrategy));
            _cache.price = _trv.treasuryPriceIndex();
        } else if (_token == oudToken) {
            // _cache.trvDebtCeiling remains as 0
            _cache.price = 1e18;
        } else {
            revert CommonEventsAndErrors.InvalidToken(address(_token));
        }
        
        uint256 interestAccumulatorUpdatedAt = _debtTokenDetails.data.interestAccumulatorUpdatedAt;
        uint32 blockTs = uint32(block.timestamp);
        if (blockTs != interestAccumulatorUpdatedAt) {
            dirty = true;

            uint256 newInterestAccumulator = uint256(_cache.interestAccumulator).continuouslyCompounded(
                blockTs - interestAccumulatorUpdatedAt,
                _cache.interestRate
            );

            _cache.totalDebt = mulDiv(
                newInterestAccumulator,
                _cache.totalDebt,
                _cache.interestAccumulator
            ).encodeUInt128();
            _cache.interestAccumulator = newInterestAccumulator.encodeUInt128();
        }
    }

    function debtTokenCache(
        IERC20 _token
    ) internal returns (
        DebtTokenCache memory cache
    ) {
        DebtTokenDetails storage _debtTokenDetails = debtTokenDetails[_token];
        if (initDebtTokenCache(_token, _debtTokenDetails, cache)) {
            _debtTokenDetails.data.interestAccumulatorUpdatedAt = uint32(block.timestamp);
            _debtTokenDetails.data.totalDebt = cache.totalDebt;
            _debtTokenDetails.data.interestAccumulator = cache.interestAccumulator;
        }
    }

    function debtTokenCacheRO(
        IERC20 _token
    ) internal view returns (
        DebtTokenCache memory cache
    ) {
        initDebtTokenCache(_token, debtTokenDetails[_token], cache);
    }

    function checkValidDebtToken(IERC20 _token) internal view {
        if (_token != daiToken && _token != oudToken) {
            revert CommonEventsAndErrors.InvalidToken(address(_token));
        }
    }

    function updateInterestRates(
        IERC20 _token,
        DebtTokenDetails storage _debtTokenDetails,
        DebtTokenCache memory _debtTokenCache
    ) internal {
        uint96 newInterestRate = _debtTokenCache.config.interestRateModel.calculateInterestRate(
            utilizationRatio(_debtTokenCache)
        );

        // Update storage if the new rate differs from the old rate.
        if (_debtTokenCache.interestRate != newInterestRate) {
            emit InterestRateUpdate(address(_token), newInterestRate);
            _debtTokenDetails.data.interestRate = _debtTokenCache.interestRate = newInterestRate;
        }
    }

    function checkWithdrawalCooldown(
        uint32 _minSecs,
        uint32 _maxSecs,
        uint32 _requestedAt
    ) internal view {
        unchecked {
            if (block.timestamp < _requestedAt+_minSecs)
                revert NotInFundsRequestWindow(block.timestamp, _requestedAt, _minSecs, _maxSecs);
            if (block.timestamp > _requestedAt+_maxSecs)
                revert NotInFundsRequestWindow(block.timestamp, _requestedAt, _minSecs, _maxSecs);
        }
    }

    function repayToken(
        IERC20 _token,
        DebtTokenCache memory _debtTokenCache,
        uint128 _repayAmount,
        AccountDebtData storage _accountDebtData,
        address _fromAccount,
        address _onBehalfOf
    ) internal {
        // Update the account's latest debt
        uint128 _newDebt = currentAccountDebt(
            _debtTokenCache, 
            _accountDebtData.debtCheckpoint,
            _accountDebtData.interestAccumulator,
            true // round up for repay balance
        );

        // They cannot repay more than this debt
        if (_repayAmount > _newDebt) {
            revert ExceededBorrowedAmount(address(_token), _newDebt, _repayAmount);
        }
        unchecked {
            _newDebt -= _repayAmount;
        }

        // Update storage
        _accountDebtData.debtCheckpoint = _newDebt;
        _accountDebtData.interestAccumulator = _debtTokenCache.interestAccumulator;
        repayTotalDebt(_token, _debtTokenCache, _repayAmount);

        emit Repay(_fromAccount, _onBehalfOf, address(_token), _repayAmount);
        // NB: Liquidity doesn't need to be checked after a repay, as that only improves the health.

        if (_token == daiToken) {
            // Pull the stables, and repay the TRV debt on behalf of the strategy.
            _token.safeTransferFrom(_fromAccount, address(this), _repayAmount);
            treasuryReservesVault.repay(_repayAmount, address(tlcStrategy));
        } else {
            // Burn the OUD
            IMintableToken(address(_token)).burn(_fromAccount, _repayAmount);
        }
    }

    function computeLiquidityForToken(
        DebtTokenCache memory _debtTokenCache,
        AccountDebtData storage _accountDebtData,
        bool _includePendingRequests,
        LiquidityStatus memory status
    ) internal view returns (uint128 currentDebt) {
        currentDebt = currentAccountDebt(
            _debtTokenCache, 
            _accountDebtData.debtCheckpoint, 
            _accountDebtData.interestAccumulator,
            true // round up for user reported debt
        );

        if (_includePendingRequests) {
            currentDebt += _accountDebtData.borrowRequest.amount; 
        }

        if (!status.hasExceededMaxLtv) {
            status.hasExceededMaxLtv = currentDebt > maxBorrowCapacity(
                _debtTokenCache,
                status.collateral
            );
        }
    }

    function computeLiquidity(
        AccountData storage _accountData,
        DebtTokenCache memory _daiTokenCache,
        DebtTokenCache memory _oudTokenCache,
        bool _includePendingRequests
    ) internal view returns (LiquidityStatus memory status) {
        status.collateral = _accountData.collateralPosted;
        if (_includePendingRequests) {
            unchecked {
                status.collateral -= _accountData.removeCollateralRequest.amount;
            }
        }

        status.currentDaiDebt = computeLiquidityForToken(
            _daiTokenCache,
            _accountData.debtData[daiToken],
            _includePendingRequests,
            status
        );
        status.currentOudDebt = computeLiquidityForToken(
            _oudTokenCache,
            _accountData.debtData[oudToken],
            _includePendingRequests,
            status
        );
    }

    function checkLiquidity(AccountData storage _accountData) internal view {
        LiquidityStatus memory _status = computeLiquidity(
            _accountData,
            debtTokenCacheRO(daiToken),
            debtTokenCacheRO(oudToken),
            true
        );
        if (_status.hasExceededMaxLtv) {
            revert ExceededMaxLtv(_status.collateral, _status.currentDaiDebt, _status.currentOudDebt);
        }
    }

    // The sum each users debt may be slightly more than the recorded total debt
    // because users debt is rounded up for dust.
    // This floors the total debt to 0 and updates storage
    function repayTotalDebt(
        IERC20 _token,
        DebtTokenCache memory _debtTokenCache,
        uint128 _repayAmount
    ) internal {
        if (_repayAmount == 0) return;
        DebtTokenDetails storage _debtTokenDetails = debtTokenDetails[_token];

        uint128 _newDebt = (_repayAmount > _debtTokenCache.totalDebt)
            ? 0
            : _debtTokenCache.totalDebt - _repayAmount;

        _debtTokenDetails.data.totalDebt = _debtTokenCache.totalDebt = _newDebt;

        // Update interest rates now the total debt has been updated.
        updateInterestRates(_token, _debtTokenDetails, _debtTokenCache);
    }

    function fillAccountPosition(
        IERC20 _token, 
        AccountData storage _accountData,
        uint256 collateralPosted,
        bool _includePendingRequests
    ) internal view returns (AccountDebtPosition memory) {
        DebtTokenCache memory _debtTokenCache = debtTokenCacheRO(_token);
        AccountDebtData storage _accountDebtData = _accountData.debtData[_token];

        uint256 _latestDebt = currentAccountDebt(
            _debtTokenCache, 
            _accountDebtData.debtCheckpoint,
            _accountDebtData.interestAccumulator,
            true
        );

        if (_includePendingRequests) {
            _latestDebt += _accountDebtData.borrowRequest.amount; 
        }

        return AccountDebtPosition({
            currentDebt: _latestDebt,
            maxBorrow: maxBorrowCapacity(_debtTokenCache, collateralPosted),
            healthFactor: healthFactor(_debtTokenCache, collateralPosted, _latestDebt),
            loanToValueRatio: loanToValueRatio(_debtTokenCache, collateralPosted, _latestDebt)
        });
    }

    function fillTotalPosition(
        IERC20 _token
    ) internal view returns (
        TotalPosition memory position
    ) {
        DebtTokenCache memory _debtTokenCache = debtTokenCacheRO(_token);
        position.utilizationRatio = utilizationRatio(_debtTokenCache);
        position.borrowRate = _debtTokenCache.interestRate;
        position.totalDebt = _debtTokenCache.totalDebt;
    }
    
    function utilizationRatio(
        DebtTokenCache memory _debtTokenCache
    ) internal pure returns (uint256) {
        // The UR parameter is used by the 'Fixed' interest rate model
        return _debtTokenCache.trvDebtCeiling == 0
            ? 0
            : mulDiv(_debtTokenCache.totalDebt, 1e18, _debtTokenCache.trvDebtCeiling);
    }
    
    /// @notice mulDiv with an option to round the result up or down to the nearest wei
    function mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }

    function currentAccountDebt(
        DebtTokenCache memory _debtTokenCache,
        uint128 _accountDebtCheckpoint,
        uint128 _accountInterestAccumulator,
        bool roundUp
    ) internal pure returns (uint128 result) {
        return (_accountDebtCheckpoint == 0) 
            ? 0
            : mulDivRound(
                _accountDebtCheckpoint, 
                _debtTokenCache.interestAccumulator, 
                _accountInterestAccumulator, 
                roundUp
            ).encodeUInt128();
    }

    function maxBorrowCapacity(
        DebtTokenCache memory _debtTokenCache,
        uint256 _collateralPosted
    ) internal pure returns (uint256) {
        return mulDiv(
            _collateralPosted * _debtTokenCache.price,
            _debtTokenCache.config.maxLtvRatio,
            1e36
        );
    }

    function healthFactor(
        DebtTokenCache memory _debtTokenCache,
        uint256 _collateralPosted,
        uint256 _debt
    ) internal pure returns (uint256) {
        return _debt == 0
            ? type(uint256).max
            : mulDiv(
                _collateralPosted * _debtTokenCache.price,
                _debtTokenCache.config.maxLtvRatio,
                _debt * 1e18
            );
    }

    function loanToValueRatio(
        DebtTokenCache memory _debtTokenCache,
        uint256 _collateralPosted,
        uint256 _debt
    ) internal pure returns (uint256) {
        return _collateralPosted == 0
            ? type(uint256).max
            : mulDiv(
                _debt,
                1e36,
                _collateralPosted * _debtTokenCache.price
            );
    }
}