pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcBase.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";

import { SafeCast } from "contracts/common/SafeCast.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { TlcStorage } from "contracts/v2/templeLineOfCredit/TlcStorage.sol";

/**
 * @notice Temple Line of Credit abstract base contract, 
 * encapsulating all internal/reused functions.
 */
abstract contract TlcBase is TlcStorage, ITlcEventsAndErrors { 
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using CompoundedInterest for uint256;

    constructor(address _templeToken, address _daiToken, address _oudToken) 
        TlcStorage(_templeToken, _daiToken, _oudToken)
    {}

    /**
     * @dev An internal struct used to track the latest storage data (and new updates)
     * for a given debt token.
     * This is setup once from storage, and then reads/writes are cheap.
     */
    struct DebtTokenCache {
        /**
         * @notice This debt token's configuration.
         */
        DebtTokenConfig config;

        /**
         * @notice The total amount that has already been borrowed by all accounts.
         * This increases as interest accrues or new borrows. 
         * Decreases on repays or liquidations.
         */
        uint128 totalDebt;

        /**
         * @notice The interest rate as of the last borrow/repay/liquidation.
         * This last rate is used to accrue interest from that last action time
         * until the current block.
         */
        uint96 interestRate;

        /**
         * @notice Internal tracking of the accumulated interest as an index starting from 1.0e27
         * When this accumulator is compunded by the interest rate, the total debt can be calculated as
         * `updatedTotalDebt = prevTotalDebt * latestInterestAccumulator / prevInterestAccumulator
         */
        uint128 interestAccumulator;

        /**
         * @dev The price of this token as of this block. 
         * No external price oracles - only dependant on TPI
         */
        uint256 price;
        
        /**
         * @notice The maximum amount that the TLC Strategy is allowed to borrow from the TRV
         * @dev This puts a ceiling on the total amount allowed to be borrowed
         * by users from TLC. This is used as the denominator in the Utilisation Ratio
         * (the interest rate calcs are dependant on the UR)
         */
        uint256 trvDebtCeiling;
    }
    
    /**
     * @dev Initialize a new debt token (DAI/OUD) into storage
     */
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

    /**
     * @dev Initialize the DebtTokenCache from storage to this block, for a given token.
     */
    function initDebtTokenCache(
        IERC20 _token,
        DebtTokenDetails storage _debtTokenDetails,
        DebtTokenCache memory _cache
    ) private view returns (bool dirty) {
        // Copies from storage (once)
        _cache.config = _debtTokenDetails.config;
        // No need to use `encodeUInt128()` here - straight from storage of the same dimension
        _cache.interestAccumulator = uint128(_debtTokenDetails.data.interestAccumulator);
        _cache.totalDebt = _debtTokenDetails.data.totalDebt;
        _cache.interestRate = _debtTokenDetails.data.interestRate;

        // Set the debt ceiling and price.
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
        
        // Only compound if we're on a new block
        uint256 interestAccumulatorUpdatedAt = _debtTokenDetails.data.interestAccumulatorUpdatedAt;
        uint32 blockTs = uint32(block.timestamp);
        if (blockTs != interestAccumulatorUpdatedAt) {
            dirty = true;

            // Compound the accumulator
            uint256 newInterestAccumulator = uint256(_cache.interestAccumulator).continuouslyCompounded(
                blockTs - interestAccumulatorUpdatedAt,
                _cache.interestRate
            );

            // Calculate the latest totalDebt from this
            _cache.totalDebt = mulDiv(
                newInterestAccumulator,
                _cache.totalDebt,
                _cache.interestAccumulator
            ).encodeUInt128();
            _cache.interestAccumulator = newInterestAccumulator.encodeUInt128();
        }
    }

    /**
     * @dev Setup the DebtTokenCache for a given token
     * Update storage if and only if the state has changed.
     */
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

    /**
     * @dev Setup the DebtTokenCache for a given token
     * read only -- storage isn't updated.
     */
    function debtTokenCacheRO(
        IERC20 _token
    ) internal view returns (
        DebtTokenCache memory cache
    ) {
        initDebtTokenCache(_token, debtTokenDetails[_token], cache);
    }

    /**
     * @dev Ensure the user supplied token is valid in TLC
     */
    function checkValidDebtToken(IERC20 _token) internal view {
        if (_token != daiToken && _token != oudToken) {
            revert CommonEventsAndErrors.InvalidToken(address(_token));
        }
    }

    /**
     * @dev Calculate the borrow interest rate, given the utilization ratio of the token.
     * If the rate has changed, then update storage and emit an event.
     */
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

    /**
     * @dev ensure a collateral withdraw or borrow is within the allowed window after the request.
     */
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

    /**
     * @dev The implementation of the debt token repayment, used by repay() and repayAll()
     */
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

    /**
     * @dev Fill the LiquidationStatus struct (by reference) with current details 
     * for this account & token.
     * Optionally include pendig collateral withdraw / borrow requests
     * depending on the use case
     * The position can be liquidated if the current debt is greater
     * than the max borrow capacity allowed
     */
    function computeLiquidityForToken(
        DebtTokenCache memory _debtTokenCache,
        AccountDebtData storage _accountDebtData,
        bool _includePendingRequests,
        LiquidationStatus memory status
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
            status.hasExceededMaxLtv = currentDebt > maxBorrowLimit(
                _debtTokenCache,
                status.collateral
            );
        }
    }

    /**
     * @dev Generate the LiquidationStatus struct with current details 
     * for this account for both DAI and OUD.
     * Optionally include pendig collateral withdraw / borrow requests
     * depending on the use case
     */
    function computeLiquidity(
        AccountData storage _accountData,
        DebtTokenCache memory _daiTokenCache,
        DebtTokenCache memory _oudTokenCache,
        bool _includePendingRequests
    ) internal view returns (LiquidationStatus memory status) {
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

    /**
     * @dev Check if this account is to be liquidated given the current
     * account, debt token and market conditions.
     * Revert if the account has exceeded the maximum LTV allowed for either DAI or OUD
     */
    function checkLiquidity(AccountData storage _accountData) internal view {
        LiquidationStatus memory _status = computeLiquidity(
            _accountData,
            debtTokenCacheRO(daiToken),
            debtTokenCacheRO(oudToken),
            true
        );
        if (_status.hasExceededMaxLtv) {
            revert ExceededMaxLtv(_status.collateral, _status.currentDaiDebt, _status.currentOudDebt);
        }
    }

    /**
     * @dev Reduce the total debt in storage by a repayment amount.
     * The sum each users debt may be slightly more than the recorded total debt
     * because users debt is rounded up for dust.
     * The Total debt is floored at 0.
     */
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

    /**
     * @dev Fill the AcountDebtPosition struct when reporting the overall user
     * position in views.
     */
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
            maxBorrow: maxBorrowLimit(_debtTokenCache, collateralPosted),
            healthFactor: healthFactor(_debtTokenCache, collateralPosted, _latestDebt),
            loanToValueRatio: loanToValueRatio(_debtTokenCache, collateralPosted, _latestDebt)
        });
    }

    /**
     * @dev Fill the totalDebtPosition struct when reporting the
     * debt token positions in views.
     */
    function fillTotalDebtPosition(
        IERC20 _token
    ) internal view returns (
        TotalDebtPosition memory position
    ) {
        DebtTokenCache memory _debtTokenCache = debtTokenCacheRO(_token);
        position.utilizationRatio = utilizationRatio(_debtTokenCache);
        position.borrowRate = _debtTokenCache.interestRate;
        position.totalDebt = _debtTokenCache.totalDebt;
    }
    
    /**
     * @dev Calculate the Utilization Ratio. 
     * It is only relevant for DAI, where there is a debt ceiling set in the cache.
     * Numerator = The total debt across all users for this token
     * Denominator = The max amount which TLC can borrow from the Treasury Reserves Vault
     */
    function utilizationRatio(
        DebtTokenCache memory _debtTokenCache
    ) internal pure returns (uint256) {
        return _debtTokenCache.trvDebtCeiling == 0
            ? 0
            : mulDiv(_debtTokenCache.totalDebt, 1e18, _debtTokenCache.trvDebtCeiling);
    }
    
    /**
     * @dev mulDiv with an option to round the result up or down to the nearest wei
     */
    function mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }

    /**
     * @dev Calculate the latest debt for a given account & token.
     * Derived from the prior debt checkpoint, and the interest accumulator.
     */
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

    /**
     * @dev What is the max borrow liit for a given token and 
     * amount of collateral
     */
    function maxBorrowLimit(
        DebtTokenCache memory _debtTokenCache,
        uint256 _collateralPosted
    ) internal pure returns (uint256) {
        return mulDiv(
            _collateralPosted * _debtTokenCache.price,
            _debtTokenCache.config.maxLtvRatio,
            1e36
        );
    }

    /**
     * @dev What is the health factor, given an amount of 
     * collateral and debt.
     * health = (collateral value / debt value) * max LTV Limit
     */
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

    /**
     * @dev What is the Loan To Value (LTV), given an amount of 
     * collateral and debt.
     * LTV = debt value / collateral value
     */
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