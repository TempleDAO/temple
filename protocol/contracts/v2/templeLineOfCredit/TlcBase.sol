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

    // @todo check if all of these are actually used
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
    
    constructor(address _templeToken) 
        TlcStorage(_templeToken)
    {}

    function addDebtToken(
        TokenType _tokenType,
        DebtTokenConfig memory _config
    ) internal {
        // Do not allow an LTV > 100%
        if (_config.maxLtvRatio > 1e18) revert CommonEventsAndErrors.InvalidParam();
        if (address(_config.tokenAddress) == address(0)) revert CommonEventsAndErrors.ExpectedNonZero();
        if (address(_config.interestRateModel) == address(0)) revert CommonEventsAndErrors.ExpectedNonZero();
        if (_config.tokenType != _tokenType) revert CommonEventsAndErrors.InvalidParam();

        DebtTokenDetails storage debtToken = debtTokenDetails[_tokenType];
        debtToken.config = _config;
        debtToken.data.interestAccumulator = INITIAL_INTEREST_ACCUMULATOR;
        debtToken.data.interestAccumulatorUpdatedAt = uint32(block.timestamp);
    }

    function initDebtTokenCache(
        DebtTokenDetails storage _debtToken,
        DebtTokenCache memory _cache
    ) private view returns (bool dirty) {
        _cache.config = _debtToken.config;
        _cache.interestAccumulator = _debtToken.data.interestAccumulator.encodeUInt128();
        _cache.totalDebt = _debtToken.data.totalDebt;
        _cache.interestRate = _debtToken.data.interestRate;

        if (_cache.config.tokenType == TokenType.DAI) {
            ITreasuryReservesVault _trv = treasuryReservesVault;
            _cache.trvDebtCeiling = _trv.strategyDebtCeiling(address(tlcStrategy));
            _cache.price = _trv.treasuryPriceIndex();
        } else {
            _cache.price = 1e18;
        }
        
        uint256 interestAccumulatorUpdatedAt = _debtToken.data.interestAccumulatorUpdatedAt;
        uint32 blockTs = uint32(block.timestamp);
        if (blockTs != interestAccumulatorUpdatedAt) {
            dirty = true;

            // @todo Euler also checks for overflows and ignores if it will take it over...?
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
        DebtTokenDetails storage _debtToken
    ) internal returns (
        DebtTokenCache memory cache
    ) {
        if (initDebtTokenCache(_debtToken, cache)) {
            _debtToken.data.interestAccumulatorUpdatedAt = uint32(block.timestamp);
            _debtToken.data.totalDebt = cache.totalDebt;
            _debtToken.data.interestAccumulator = cache.interestAccumulator;
        }
    }

    // @todo read only re-entrancy?
    function debtTokenCacheRO(
        DebtTokenDetails storage _debtToken
    ) internal view returns (
        DebtTokenCache memory cache
    ) {
        initDebtTokenCache(_debtToken, cache);
    }

    function updateInterestRates(
        DebtTokenDetails storage _debtToken,
        DebtTokenCache memory _debtTokenCache
    ) internal {
        int96 newInterestRate = _debtTokenCache.config.interestRateModel.calculateInterestRate(
            utilizationRatio(_debtTokenCache)
        );

        // Update storage if it differs to the existing one.
        if (_debtTokenCache.interestRate != newInterestRate) {
            emit InterestRateUpdate(_debtTokenCache.config.tokenAddress, newInterestRate);
            _debtToken.data.interestRate = _debtTokenCache.interestRate = newInterestRate;
        }
    }

    function checkWithdrawalCooldown(
        uint32 _requestedAt, 
        uint32 _cooldownSecs
    ) internal view {
        if (_requestedAt == 0 || block.timestamp < _requestedAt + _cooldownSecs)
            revert CooldownPeriodNotMet(_requestedAt, _cooldownSecs);
    }

    function _doRepayToken(
        DebtTokenDetails storage _debtToken,
        DebtTokenCache memory _debtTokenCache,
        uint256 _repayAmount,
        AccountDebtData storage _accountDebtData,
        TokenType _tokenType,
        address _fromAccount,
        address _onBehalfOf
    ) internal {
        // Update the account's latest debt
        uint256 _newDebt = currentAccountDebtData(_debtTokenCache, _accountDebtData.debtCheckpoint, _accountDebtData.interestAccumulator);

        // They cannot repay more than this debt
        // address tokenAddress = _debtTokenCache.config.tokenAddress;
        if (_repayAmount > _newDebt) revert ExceededBorrowedAmount(_debtTokenCache.config.tokenAddress, _newDebt, _repayAmount);

        _newDebt -= _repayAmount;
        _accountDebtData.debtCheckpoint = _newDebt.encodeUInt128();
        _accountDebtData.interestAccumulator = _debtTokenCache.interestAccumulator;
        _debtToken.data.totalDebt = _debtTokenCache.totalDebt = uint128(
            _debtTokenCache.totalDebt - _repayAmount
        );

        updateInterestRates(_debtToken, _debtTokenCache);

        emit Repay(_fromAccount, _onBehalfOf, _tokenType, _repayAmount);
        
        if (_tokenType == TokenType.DAI) {
            // Pull the stables, and repay the TRV debt on behalf of the strategy.
            IERC20(_debtTokenCache.config.tokenAddress).safeTransferFrom(_fromAccount, address(this), _repayAmount);
            treasuryReservesVault.repay(_repayAmount, address(tlcStrategy));
        } else {
            // Burn the OUD
            IMintableToken(_debtTokenCache.config.tokenAddress).burn(_fromAccount, _repayAmount);
        }
    }

    function computeLiquidityForToken(
        DebtTokenCache memory _debtTokenCache,
        AccountDebtData storage _accountDebtData,
        bool _includePendingRequests,
        LiquidityStatus memory status
    ) internal view {
        if (_accountDebtData.debtCheckpoint == 0) return;
        uint256 totalDebt = currentAccountDebtData(_debtTokenCache, _accountDebtData.debtCheckpoint, _accountDebtData.interestAccumulator);
        if (_includePendingRequests) {
            totalDebt += _accountDebtData.borrowRequest.amount; 
        }

        if (!status.hasExceededMaxLtv) {
            status.hasExceededMaxLtv = totalDebt > maxBorrowCapacity(
                _debtTokenCache,
                status.collateral
            );
        }
    }

    function computeLiquidity(
        AccountData storage _accountData,
        DebtTokenCache[NUM_TOKEN_TYPES] memory _debtTokenCaches,
        bool _includePendingRequests
    ) internal view returns (LiquidityStatus memory status) {
        status.collateral = _accountData.collateralPosted;
        if (_includePendingRequests) {
            status.collateral -= _accountData.removeCollateralRequest.amount;
        }

        computeLiquidityForToken(
            _debtTokenCaches[uint256(TokenType.DAI)],
            _accountData.debtData[uint256(TokenType.DAI)],
            _includePendingRequests,
            status
        );
        computeLiquidityForToken(
            _debtTokenCaches[uint256(TokenType.OUD)],
            _accountData.debtData[uint256(TokenType.OUD)],
            _includePendingRequests,
            status
        );
    }

    function checkLiquidity(AccountData storage _accountData) internal view {
        DebtTokenCache[NUM_TOKEN_TYPES] memory debtTokenCaches = [
            debtTokenCacheRO(debtTokenDetails [TokenType.DAI]),
            debtTokenCacheRO(debtTokenDetails [TokenType.OUD])
        ];
        LiquidityStatus memory _status = computeLiquidity(_accountData, debtTokenCaches, true);
        if (_status.hasExceededMaxLtv) revert ExceededMaxLtv();
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