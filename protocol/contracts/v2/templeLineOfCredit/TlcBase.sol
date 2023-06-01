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

    struct DebtTokenCache {
        DebtTokenConfig config;

        /// @notice Total amount that has already been borrowed, which increases as interest accrues
        uint128 totalDebt;

        /// @notice The interest rate as of the last borrow/repay/
        int96 interestRate;

        uint128 interestAccumulator;

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
        // `encodeUInt128()` not required here, as the storage is already guaranteed to fit.
        _cache.interestAccumulator = uint128(_debtTokenDetails.data.interestAccumulator);
        _cache.totalDebt = _debtTokenDetails.data.totalDebt;
        _cache.interestRate = _debtTokenDetails.data.interestRate;

        if (_token == daiToken) {
            ITreasuryReservesVault _trv = treasuryReservesVault;
            _cache.trvDebtCeiling = _trv.strategyDebtCeiling(address(tlcStrategy));
            _cache.price = _trv.treasuryPriceIndex();
        } else if (_token == oudToken) {
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

    // @todo read only re-entrancy?
    function debtTokenCacheRO(
        IERC20 _token
    ) internal view returns (
        DebtTokenCache memory cache
    ) {
        initDebtTokenCache(_token, debtTokenDetails[_token], cache);
    }

    function updateInterestRates(
        IERC20 _token,
        DebtTokenDetails storage _debtTokenDetails,
        DebtTokenCache memory _debtTokenCache
    ) internal {
        int96 newInterestRate = _debtTokenCache.config.interestRateModel.calculateInterestRate(
            utilizationRatio(_debtTokenCache)
        );

        // Update storage if it differs to the existing one.
        if (_debtTokenCache.interestRate != newInterestRate) {
            emit InterestRateUpdate(address(_token), newInterestRate);
            _debtTokenDetails.data.interestRate = _debtTokenCache.interestRate = newInterestRate;
        }
    }

    // @todo scan all places we can use unchecked

    function checkWithdrawalCooldown(
        uint32 _requestedAt
    ) internal view {
        unchecked {
            if (block.timestamp < _requestedAt+fundsRequestWindow.minSecs)
                revert NotInFundsRequestWindow(block.timestamp, _requestedAt, fundsRequestWindow.minSecs, fundsRequestWindow.maxSecs);
            if (block.timestamp > _requestedAt+fundsRequestWindow.maxSecs)
                revert NotInFundsRequestWindow(block.timestamp, _requestedAt, fundsRequestWindow.minSecs, fundsRequestWindow.maxSecs);
        }
    }

    function _doRepayToken(
        IERC20 _token,
        DebtTokenCache memory _debtTokenCache,
        uint256 _repayAmount,
        AccountDebtData storage _accountDebtData,
        address _fromAccount,
        address _onBehalfOf
    ) internal {
        // Update the account's latest debt
        uint256 _newDebt = currentAccountDebtData(_debtTokenCache, _accountDebtData.debtCheckpoint, _accountDebtData.interestAccumulator);

        // They cannot repay more than this debt
        // address tokenAddress = _debtTokenCache.config.tokenAddress;
        if (_repayAmount > _newDebt) {
            revert ExceededBorrowedAmount(address(_token), _newDebt, _repayAmount);
        }

        _newDebt -= _repayAmount;
        _accountDebtData.debtCheckpoint = _newDebt.encodeUInt128();
        _accountDebtData.interestAccumulator = _debtTokenCache.interestAccumulator;
        DebtTokenDetails storage _debtTokenDetails = debtTokenDetails[_token];
        _debtTokenDetails.data.totalDebt = _debtTokenCache.totalDebt = uint128(
            _debtTokenCache.totalDebt - _repayAmount
        );

        updateInterestRates(_token, _debtTokenDetails, _debtTokenCache);

        emit Repay(_fromAccount, _onBehalfOf, address(_token), _repayAmount);
        
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
    ) internal view returns (uint256 currentDebt) {
        if (_accountDebtData.debtCheckpoint == 0) return 0;

        currentDebt = currentAccountDebtData(
            _debtTokenCache, 
            _accountDebtData.debtCheckpoint, 
            _accountDebtData.interestAccumulator
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
        if (_status.hasExceededMaxLtv) revert ExceededMaxLtv();
    }

    function wipeDebt(
        IERC20 _token,
        DebtTokenCache memory _debtTokenCache,
        uint256 _totalDebtWiped
    ) internal {
        DebtTokenDetails storage _debtTokenDetails = debtTokenDetails[_token];

        // Update the reserve token details, and then update the interest rates.            
        // A decrease in amount, so this downcast is safe without a check
        _debtTokenDetails.data.totalDebt = _debtTokenCache.totalDebt = uint128(
            _debtTokenCache.totalDebt - _totalDebtWiped
        );

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

        uint256 _latestDebt = currentAccountDebtData(
            _debtTokenCache, 
            _accountDebtData.debtCheckpoint,
            _accountDebtData.interestAccumulator
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
            : uint256(_debtTokenCache.totalDebt) * 1e18 / _debtTokenCache.trvDebtCeiling;
    }
    
    function currentAccountDebtData(
        DebtTokenCache memory _debtTokenCache,
        uint128 _accountDebtData,
        uint128 _accountInterestAccumulator
    ) internal pure returns (uint256) {
        uint256 prevDebt = _accountDebtData;
        return (prevDebt == 0) 
            ? 0
            : prevDebt * _debtTokenCache.interestAccumulator / _accountInterestAccumulator;
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