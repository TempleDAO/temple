pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/TempleBaseDebtToken.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";

/* solhint-disable not-rely-on-time */

/**
 * @title Temple Debt Token
 * @notice A rebasing ERC20 representing principal accruing at a `base + risk premium` continuously compounding interest rate.
 *
 * All borrowers utilising the treasury will be issued accruing debt, such that the net performance (equity = assets - debt) of each strategy can be
 * evaluated on-chain. This Temple Debt Token will form the `debt` part of the equity equation in each strategy (an `asset` for the Treasury)
 *
 * There are 3 components to the debt:
 *   1/ Principal
 *   2/ 'base rate' interest, which is a common rate for all borrowers. 
 *         This represents an opportunity cost - a rate at which the Treasury would be able to otherwise earn safely
 *         (eg DAI's DSR at 1% APR). 
 *      It is implemented using a share based implementation such that this base rate can be updated for all debtors
 *   3/ 'risk premium' interest, where the interest rate is set per borrower.
 *         This represents a premium for that individual borrower depending on its purpose. 
 *         For example a higher risk / higher return borrower would have a higher risk premium.
 *
 * On a repayment, the interest accruing at the higher rate is paid down first. When there is no more `base rate` or
 * `risk premium` interest, then the principal portion is paid down.
 * 
 * This token is is non-transferrable. Only approved Minters can mint/burn the debt on behalf of a user.
 */
contract TempleDebtToken is ITempleDebtToken, TempleElevatedAccess {
    using CompoundedInterest for uint256;
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    string private constant VERSION = "1.0.0";

    /**
     * @dev Returns the name of the token.
     */
    string public override name;

    /**
     * @dev Returns the symbol of the token.
     */
    string public override symbol;

    /**
     * @notice The current (base rate) interest common for all strategies. This can be updated by the DAO
     * @dev 1e18 format, where 0.01e18 = 1%
     */
    uint96 public override baseRate;

    /**
     * @notice The last checkpoint time of the (base rate) principal and interest checkpoint
     */
    uint32 public override baseCheckpointTime;

    /**
     * @notice The (base rate) total principal and interest owed across all debtors as of the latest checkpoint
     */
    uint128 public override baseCheckpoint;

    /**
     * @notice The (base rate) total number of shares allocated out to strategies for internal book keeping
     */
    uint128 public override baseShares;

    /**
     * @notice The net amount of principal amount of debt minted across all strategies.
     */
    uint128 public override totalPrincipal;

    /**
     * @notice The latest estimate of the (risk premium) interest (no principal) owed.
     * @dev Indicative only. This total is only updated on a per strategy basis when that strategy gets 
     * checkpointed (on borrow/repay rate change).
     * So it is generally always going to be out of date as each strategy will accrue interest independently 
     * on different rates.
     */
    uint128 public override estimatedTotalRiskPremiumInterest;

    /**
     * @dev Returns the decimals places of the token.
     */
    // solhint-disable-next-line const-name-snakecase
    uint8 public constant override decimals = 18;

    /**
     * @notice Per address status of debt
     */
    mapping(address => Debtor) public override debtors;

    /// @notice A set of addresses which are approved to mint/burn
    mapping(address => bool) public override minters;

    constructor(
        string memory _name,
        string memory _symbol,
        address _initialRescuer,
        address _initialExecutor,
        uint96 _baseInterestRate
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        name = _name;
        symbol = _symbol;
        baseRate = _baseInterestRate;
        baseCheckpointTime = uint32(block.timestamp);
    }

    /**
     * @notice Add an address which is able to mint or burn debt
     * positions on behalf of users.
     */
    function addMinter(address account) external override onlyElevatedAccess {
        minters[account] = true;
        emit AddedMinter(account);
    }

    /**
     * @notice Remove an address which is able to mint or burn debt
     * positions on behalf of users.
     */
    function removeMinter(address account) external override onlyElevatedAccess {
        minters[account] = false;
        emit RemovedMinter(account);
    }

    /**
     * @notice Track the deployed version of this contract. 
     */
    function version() external pure override returns (string memory) {
        return VERSION;
    }

    /**
     * @notice Update the continuously compounding (base) interest rate of all debtors, from this block onwards.
     */
    function setBaseInterestRate(uint96 _rate) external override onlyElevatedAccess {
        // First checkpoint the base interest
        _getBaseCache();
        baseRate = _rate;
        emit BaseInterestRateSet(_rate);
    }

    /**
     * @notice Update the continuously compounding (risk premium) interest rate for a given debtor, from this block onwards
     */
    function setRiskPremiumInterestRate(address _debtor, uint96 _rate) external override onlyElevatedAccess {
        // First checkpoint the base interest & debtor risk premium interest
        Debtor storage debtor = debtors[_debtor];
        _getDebtorCache(_getBaseCache(), debtor, true);
        debtor.rate = _rate;
        emit RiskPremiumInterestRateSet(_debtor, _rate);
    }

    /**
     * @notice Approved Minters can add a new debt position on behalf of a user.
     * @param _debtor The address of the debtor who is issued new debt
     * @param _mintAmount The notional amount of debt tokens to issue.
     */
    function mint(address _debtor, uint256 _mintAmount) external override {
        if (!minters[msg.sender]) revert CannotMintOrBurn(msg.sender);
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        if (_mintAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        // First checkpoint both the base interest and (risk premium) interest of the debtor.
        // Use RO (read only) to delay the updating of the baseCache storage to the end since it needs updating later anyway.
        BaseCache memory _baseCache = _getBaseCacheRO();
        Debtor storage debtor = debtors[_debtor];

        // Get the debtor cache and update it's storage upfront since the debtor interest doesn't change later
        // don't round up on the way in
        DebtorCache memory _debtorCache = _getDebtorCache(_baseCache, debtor, false);

        // Calculate the number of (base) debt shares for this borrow amount. Ensure this is rounded down (same as EIP-4626)
        uint128 _mintAmountUInt128 = _mintAmount.encodeUInt128();
        uint128 newSharesAmount = _debtToShares(
            _mintAmountUInt128, 
            _baseCache.totalPrincipalAndBaseInterest, 
            _baseCache.baseShares, 
            false
        );

        // Update the contract state
        {
            // Add the shares to the debtor and total
            baseCheckpointTime = uint32(block.timestamp);
            baseCheckpoint = _baseCache.totalPrincipalAndBaseInterest + _mintAmountUInt128;
            baseShares = _baseCache.baseShares + newSharesAmount;

            unchecked {
                // The baseCheckpoint (principal + interest) is checked for overflow already above
                // So the total principal can be left unchecked
                totalPrincipal += _mintAmountUInt128;
            }

            // Increment the debtors total balance (principal + base interest + risk premium interest)
            _debtorCache.totalBalance += _mintAmountUInt128;

            // The principal borrowed now increases (which affects the risk premium interest accrual)
            // and also the (base rate) checkpoint representing the principal+base interest
            unchecked {
                // Since the debtor.totalBalance is overflow checked above, just checking the principal can
                // be unchecked
                debtor.principal = _debtorCache.principal = _debtorCache.principal + _mintAmountUInt128;

                // The debtor base shares can be unchecked since this will be <= the total baseShares across
                // all debtors which has already been overflow checked.
                debtor.baseShares = _debtorCache.baseShares + newSharesAmount;
            }
        }

        emit DebtorBalance(_debtor, _debtorCache.principal, _debtorCache.baseInterest, _debtorCache.riskPremiumInterest);
        emit Transfer(address(0), _debtor, _mintAmount);
    }

    /**
     * @notice Approved Minters can burn debt on behalf of a user.
     * @dev Interest is repaid in preference:
     *   1/ Firstly to the higher interest rate of (baseRate, debtor risk premium rate)
     *   2/ Any remaining of the repayment is then paid of the other interest amount.
     *   3/ Finally if there is still some repayment amount unallocated, 
     *      then the principal will be paid down. This is like a new debt is issued for the lower balance,
     *      where interest accrual starts fresh.
     * More debt than the user has cannot be burned - it is capped. The actual amount burned is returned
     * @param _debtor The address of the debtor
     * @param _burnAmount The notional amount of debt tokens to repay.
     */
    function burn(
        address _debtor, 
        uint256 _burnAmount
    ) external override returns (
        uint256 burnedAmount
    ) {
        if (!minters[msg.sender]) revert CannotMintOrBurn(msg.sender);
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        if (_burnAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        // First checkpoint both the base interest and (risk premium) interest of the debtor.
        // Use RO (read only) for both the base cache and debtor cache to delay the updating of 
        // storage to the end since it needs updating anyway.
        BaseCache memory _baseCache = _getBaseCacheRO();
        Debtor storage debtor = debtors[_debtor];
        DebtorCache memory _debtorCache = _getDebtorCacheRO(_baseCache, debtor, true);

        // The user can't pay off more debt than they have.
        // It is capped, and the actual amount burned returned as a value
        if (_burnAmount > _debtorCache.totalBalance) {
            _burnAmount = _debtorCache.totalBalance;
        }

        if (_burnAmount > 0) {
            emit Transfer(_debtor, address(0), _burnAmount);
            _burn(_baseCache, debtor, _debtorCache, _burnAmount.encodeUInt128());
        }

        emit DebtorBalance(_debtor, _debtorCache.principal, _debtorCache.baseInterest, _debtorCache.riskPremiumInterest);
        return _burnAmount;
    }

    /**
     * @notice Approved Minters can burn the entire debt on behalf of a user.
     * @param _debtor The address of the debtor
     */
    function burnAll(address _debtor) external override returns (uint256 burnedAmount) {
        if (!minters[msg.sender]) revert CannotMintOrBurn(msg.sender);
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress();

        // First checkpoint both the base interest and (risk premium) interest of the debtor.
        // Use RO (read only) for both the base cache and debtor cache to delay the updating of 
        // storage to the end since it needs updating anyway.
        BaseCache memory _baseCache = _getBaseCacheRO();
        Debtor storage debtor = debtors[_debtor];
        DebtorCache memory _debtorCache = _getDebtorCacheRO(_baseCache, debtor, true);

        burnedAmount = _debtorCache.totalBalance;
        if (burnedAmount > 0) {
            emit Transfer(_debtor, address(0), burnedAmount);
            _burn(_baseCache, debtor, _debtorCache, burnedAmount.encodeUInt128());
        }
        emit DebtorBalance(_debtor, _debtorCache.principal, _debtorCache.baseInterest, _debtorCache.riskPremiumInterest);
    }

    function _burn(
        BaseCache memory _baseCache, 
        Debtor storage _debtor, 
        DebtorCache memory _debtorCache, 
        uint128 _burnAmount
    ) internal {
        uint128 _riskPremiumDebtRepaid;
        uint128 _baseDebtRepaid;

        // Calculate what can be repaid out of the (base interest) and (risk premium interest).
        // Pay off the the item with the higher interest rate first.
        if (_debtorCache.riskPremiumRate > _baseCache.baseRate) {
            unchecked {
                // The minimum of what risk premium interest is still outstanding, and the requested amount to be burned
                _riskPremiumDebtRepaid = _debtorCache.riskPremiumInterest < _burnAmount ? _debtorCache.riskPremiumInterest : _burnAmount;
                _burnAmount -= _riskPremiumDebtRepaid;
            }

            unchecked {
                // The minimum of what base interest is still outstanding, and the requested amount to be burned
                _baseDebtRepaid = _debtorCache.baseInterest < _burnAmount ? _debtorCache.baseInterest : _burnAmount;
                _burnAmount -= _baseDebtRepaid;
            }
        } else {
            unchecked {
                // The minimum of what base interest is still outstanding, and the requested amount to be burned
                _baseDebtRepaid = _debtorCache.baseInterest < _burnAmount ? _debtorCache.baseInterest : _burnAmount;
                _burnAmount -= _baseDebtRepaid;
            }

            unchecked {
                // The minimum of what risk premium interest is still outstanding, and the requested amount to be burned
                _riskPremiumDebtRepaid = _debtorCache.riskPremiumInterest < _burnAmount ? _debtorCache.riskPremiumInterest : _burnAmount;
                _burnAmount -= _riskPremiumDebtRepaid;
            }
        }

        // Update the contract state.
        // Any remaining out of `_burnAmount` is principal which is repaid.
        {
            // Calculate the total base checkpoint (principal + base interest across all debtors) which has been repaid
            // This is the principal payment that's been repaid (remaining in the `_burnAmount` variable) + the `_baseDebtRepaid`
            uint128 _totalBaseRepaid;
            unchecked {
                _totalBaseRepaid = _baseDebtRepaid + _burnAmount;
            }

            // Calculate the number of shares (base) total repayment represents. 
            // Round up to the nearest share (same as EIP-4626)
            // Given it rounds up, there's a chance that it is slightly more than remaining on the caches, so
            // remaining totals use `subFloorZero()` which is the difference floored at zero.
            uint128 _totalSharesRepaid = _debtToShares(
                _totalBaseRepaid, 
                _baseCache.totalPrincipalAndBaseInterest, 
                _baseCache.baseShares, 
                true
            );

            // Update the base state in order of storage slots
            baseCheckpointTime = uint32(block.timestamp);
            baseCheckpoint = _subFloorZero(_baseCache.totalPrincipalAndBaseInterest, _totalBaseRepaid);
            baseShares = _subFloorZero(_baseCache.baseShares, _totalSharesRepaid);
            totalPrincipal = _subFloorZero(totalPrincipal, _burnAmount);

            // Update the cumulative estimate of total debtor interest owing.
            unchecked {
                estimatedTotalRiskPremiumInterest = _subFloorZero(
                    estimatedTotalRiskPremiumInterest + _debtorCache.riskPremiumInterestDelta,
                    _riskPremiumDebtRepaid
                );
            }

            // Update the debtor state in order of storage slots
            _debtor.principal = _debtorCache.principal = _subFloorZero(_debtorCache.principal, _burnAmount);
            _debtor.baseShares = _subFloorZero(_debtorCache.baseShares, _totalSharesRepaid);
            _debtor.checkpoint = _debtorCache.riskPremiumInterest = _subFloorZero(_debtorCache.riskPremiumInterest, _riskPremiumDebtRepaid);
            _debtor.checkpointTime = uint32(block.timestamp);

            // Update debtor base interest in the cache (log emits this updated base interest)
            unchecked {
                // Unchecked is safe since it's validated when _baseDebtRepaid is first calculated above
                _debtorCache.baseInterest = _debtorCache.baseInterest - _baseDebtRepaid;
            }
        }
    }

    /**
     * @notice Debt tokens are not transferrable.
     */
    function transfer(
        address /*to*/, 
        uint256 /*amount*/
    ) external pure override returns (bool) {
        revert NonTransferrable();
    }

    /**
     * @notice Debt tokens are not transferrable. Allowance always returns 0
     */
    function allowance(
        address /*owner*/,
        address /*spender*/
    ) external pure override returns (uint256) {
        return 0;
    }

    /**
     * @notice Debt tokens are not transferrable. Allowance always returns 0
     */
    function approve(
        address /*spender*/,
        uint256 /*amount*/
    ) external pure override returns (bool) {
        revert NonTransferrable();
    }

    /**
     * @notice Debt tokens are not transferrable. Allowance always returns 0
     */
    function transferFrom(
        address /*from*/,
        address /*to*/,
        uint256 /*amount*/
    ) external pure override returns (bool) {
        revert NonTransferrable();
    }

    /**
     * @notice Checkpoint the total principal and (base) interest owed by all debtors up to this block.
     */
    function checkpointBaseInterest() external override returns (uint256) {
        BaseCache memory _baseCache = _getBaseCache();
        return _baseCache.totalPrincipalAndBaseInterest;
    }

    /**
     * @notice Checkpoint a debtor's (risk premium) interest (no principal) owed up to this block.
     */
    function checkpointDebtorInterest(address debtor) external override returns (uint256) {
        // This checkpoints both the base interest and debtor risk premium interest
        DebtorCache memory _debtorCache = _getDebtorCache(
            _getBaseCache(),
            debtors[debtor],
            true
        );
        return _debtorCache.riskPremiumInterest;
    }

    /**
     * @notice Checkpoint multiple accounts (risk premium) interest (no principal) owed up to this block.
     * @dev Provided in case there needs to be block synchronisation on the total debt.
     */
    function checkpointDebtorsInterest(address[] calldata _debtors) external override {
        BaseCache memory _baseCache = _getBaseCache();
        DebtorCache memory _debtorCache;
        Debtor storage debtor;
        uint128 riskPremiumInterestDelta;

        // Use the RO version in order to tally the total riskPremiumInterestDelta
        // to save multiple sload/sstore of estimatedTotalRiskPremiumInterest
        uint256 _length = _debtors.length;
        for (uint256 i; i < _length; ++i) {
            debtor = debtors[_debtors[i]];
            _debtorCache = _getDebtorCacheRO(_baseCache, debtor, true);
            riskPremiumInterestDelta += _debtorCache.riskPremiumInterestDelta;
            debtor.checkpoint = _debtorCache.riskPremiumInterest;
            debtor.checkpointTime = uint32(block.timestamp);
        }
        estimatedTotalRiskPremiumInterest += riskPremiumInterestDelta;
    }

    /**
     * @notice Returns the amount of tokens owed by the debtor as of this block.
     * It includes the principal + the base interest + specific debtor risk premium interest
     */
    function balanceOf(address _debtor) public override view returns (uint256) {
        return _getDebtorCacheRO(
            _getBaseCacheRO(),
            debtors[_debtor],
            true
        ).totalBalance;
    }

    /**
     * @notice The current debt for a given user split out by
     * principal, base interest, risk premium (per debtor) interest
     */
    function currentDebtOf(address _debtor) external override view returns (
        DebtOwed memory debtOwed
    ) {
        DebtorCache memory _debtorCache = _getDebtorCacheRO(
            _getBaseCacheRO(), 
            debtors[_debtor],
            true
        );
        return DebtOwed(
            _debtorCache.principal, 
            _debtorCache.baseInterest, 
            _debtorCache.riskPremiumInterest
        );
    }

    /**
     * @notice The current debt for a given set of users split out by
     * principal, base interest, risk premium (per debtor) interest
     */
    function currentDebtsOf(address[] calldata _debtors) external override view returns (
        DebtOwed[] memory debtsOwed
    ) {
        BaseCache memory _baseCache = _getBaseCacheRO();
        uint256 _length = _debtors.length;
        debtsOwed = new DebtOwed[](_length);
        DebtorCache memory _debtorCache;
        
        for (uint256 i; i < _length; ++i) {
            _debtorCache = _getDebtorCacheRO(_baseCache, debtors[_debtors[i]], true);
            debtsOwed[i] = DebtOwed(
                _debtorCache.principal, 
                _debtorCache.baseInterest, 
                _debtorCache.riskPremiumInterest
            );
        }
    }

    /**
      * @notice The current total principal + total base interest, total (estimate) debtor specific risk premium interest owed by all debtors.
      * @dev Note the (total principal + total base interest) portion is up to date.
      * However the (debtor specific risk premium interest) portion is likely stale.
      * The `estimatedTotalRiskPremiumInterest` is only updated when each debtor checkpoints, so it's going to be out of date.
      * For more up to date current totals, off-chain aggregation of balanceOf() will be required - eg via subgraph.
      */
    function currentTotalDebt() external override view returns (
        DebtOwed memory debtOwed
    ) {
        BaseCache memory _baseCache = _getBaseCacheRO();
        uint128 _principal = totalPrincipal;
        return DebtOwed(
            _principal,
            _subFloorZero(_baseCache.totalPrincipalAndBaseInterest, _principal),
            estimatedTotalRiskPremiumInterest
        );
    }

    /**
      * @notice The current total principal + total base interest, total (estimate) debtor specific risk premium interest owed by all debtors.
      * @dev Note the (total principal + total base interest) portion is up to date.
      * However the (debtor specific risk premium interest) portion is likely stale.
      * The `estimatedTotalRiskPremiumInterest` is only updated when each debtor checkpoints, so it's going to be out of date.
      * For more up to date current totals, off-chain aggregation of balanceOf() will be required - eg via subgraph.
      */
    function totalSupply() public override view returns (uint256) {
        BaseCache memory _baseCache = _getBaseCacheRO();
        return _baseCache.totalPrincipalAndBaseInterest + estimatedTotalRiskPremiumInterest;
    }

    /**
     * @notice Convert a (base interest) debt amount into proportional amount of shares
     */
    function baseDebtToShares(uint128 debt) external override view returns (uint128) {
        BaseCache memory _baseCache = _getBaseCacheRO();
        // Ensure this is rounded down (same as EIP-4626)
        return _debtToShares(debt, _baseCache.totalPrincipalAndBaseInterest, _baseCache.baseShares, false);
    }

    function _debtToShares(uint128 _debt, uint128 _totalDebt, uint128 _totalShares, bool roundUp) internal pure returns (uint128) {
        return _totalDebt > 0 
            ? TempleMath.mulDivRound(_debt, _totalShares, _totalDebt, roundUp).encodeUInt128()
            : _debt;
    }

    /**
     * @notice Convert a number of (base interest) shares into proportional amount of debt
     */
    function baseSharesToDebt(uint128 shares) external override view returns (uint128) {
        BaseCache memory _baseCache = _getBaseCacheRO();
        // Ensure this is rounded down (same as EIP-4626)
        return _sharesToDebt(shares, _baseCache.totalPrincipalAndBaseInterest, _baseCache.baseShares, false);
    }

    function _sharesToDebt(uint128 _shares, uint128 _totalDebt, uint128 _totalShares, bool roundUp) internal pure returns (uint128) {
        return _totalShares > 0 
            ? TempleMath.mulDivRound(_shares, _totalDebt, _totalShares, roundUp).encodeUInt128()
            : _shares;
    }

    /**
     * @dev An internal struct used to track the latest storage data (and new updates)
     * for the common base interest
     * This is setup once from storage, and then reads/writes are cheap.
     */
    struct BaseCache {
        /// @dev The (base rate) total principal and interest owed across all debtors as of the latest checkpoint
        uint128 totalPrincipalAndBaseInterest;

        /// @dev The current (base rate) interest common for all users.
        uint96 baseRate;

        /// @dev The (base rate) total number of shares allocated out to users for internal book keeping
        uint128 baseShares;
    }

    /**
     * @dev Initialize the BaseCache from storage to this block.
     */
    function _initBaseCache(BaseCache memory _baseCache) private view returns (bool dirty) {
        _baseCache.totalPrincipalAndBaseInterest = baseCheckpoint;
        _baseCache.baseRate = baseRate;
        _baseCache.baseShares = baseShares;

        uint32 _timeElapsed;
        unchecked {
            _timeElapsed = uint32(block.timestamp) - baseCheckpointTime;
        }

        if (_timeElapsed > 0) {
            dirty = true;

            if (_baseCache.baseRate > 0) {
                _baseCache.totalPrincipalAndBaseInterest = uint256(_baseCache.totalPrincipalAndBaseInterest).continuouslyCompounded(
                    _timeElapsed, 
                    _baseCache.baseRate
                ).encodeUInt128();
            }
        }
    }

    /**
     * @dev Setup the BaseCache
     * Update storage if and only if the timestamp has changed since last time.
     */
    function _getBaseCache() internal returns (
        BaseCache memory baseCache
    ) {
        if (_initBaseCache(baseCache)) {
            baseCheckpoint = baseCache.totalPrincipalAndBaseInterest;
            baseCheckpointTime = uint32(block.timestamp);
        }
    }

    /**
     * @dev Setup the BaseCache without writing state.
     */
    function _getBaseCacheRO() internal view returns (
        BaseCache memory baseCache
    ) {
        _initBaseCache(baseCache);
    }

    /**
     * @dev An internal struct used to track the latest storage data (and new updates)
     * for a particular debtor
     * This is setup once from storage, and then reads/writes are cheap.
     */
    struct DebtorCache {
        /// @dev The debtor's principal
        uint128 principal;

        /// @dev The amount of base interest this debtor owes
        uint128 baseInterest;

        /// @dev The number of shares representing the debtor's principal and base interest
        uint128 baseShares;

        /// @dev The amount of risk premium interest this debtor owes
        uint128 riskPremiumInterest;
        
        /// @dev The increase in risk premium interest this debtor owes since the last checkpoint
        uint128 riskPremiumInterestDelta;

        /// @dev The risk premium interest rate for this debtor
        uint96 riskPremiumRate;

        /// @dev The total balance this debtor owes: principal + baseInterest + riskPremiumInterest
        uint128 totalBalance;
    }

    /**
     * @dev Initialize the DebtorCache from storage to this block.
     */
    function _initDebtorCache(
        BaseCache memory _baseCache, 
        Debtor storage _debtor, 
        DebtorCache memory _debtorCache,
        bool roundUp
    ) private view returns (
        bool dirty
    ) {
        _debtorCache.principal = _debtor.principal;
        _debtorCache.baseShares = _debtor.baseShares;
        _debtorCache.riskPremiumRate = _debtor.rate;
        _debtorCache.riskPremiumInterest = _debtor.checkpoint;
        uint32 _timeElapsed;
        unchecked {
            _timeElapsed = uint32(block.timestamp) - _debtor.checkpointTime;
        }

        uint128 _debtorPrincipalAndBaseInterest;
        {
            _debtorPrincipalAndBaseInterest = _sharesToDebt(
                _debtorCache.baseShares, 
                _baseCache.totalPrincipalAndBaseInterest,
                _baseCache.baseShares, 
                roundUp
            );

            // Calculate the base interest by subtracting the stored principal.
            // Floor at zero to handle an edge case due to rounding.
            _debtorCache.baseInterest = _subFloorZero(_debtorPrincipalAndBaseInterest,  _debtorCache.principal);
        }

        if (_timeElapsed > 0) {
            dirty = true;

            if (_debtorCache.riskPremiumRate > 0) {
                // Calculate the new amount of risk premium interest by compounding the total debt
                // and then subtracting just the principal.
                uint256 _debtorTotalDue;
                unchecked {
                    _debtorTotalDue = uint256(_debtorCache.principal) + _debtorCache.riskPremiumInterest;
                }
                _debtorTotalDue = _debtorTotalDue.continuouslyCompounded(
                    _timeElapsed, 
                    _debtorCache.riskPremiumRate
                );

                unchecked {
                    uint128 _newRiskPremiumInterest = _debtorTotalDue.encodeUInt128() - _debtorCache.principal;
                    _debtorCache.riskPremiumInterestDelta = _newRiskPremiumInterest - _debtorCache.riskPremiumInterest;
                    _debtorCache.riskPremiumInterest = _newRiskPremiumInterest;
                }
            }
        }

        _debtorCache.totalBalance = _debtorPrincipalAndBaseInterest + _debtorCache.riskPremiumInterest;
    }

    /**
     * @dev Setup the DebtorCache
     * Update storage if and only if the timestamp has changed since last time.
     */
    function _getDebtorCache(BaseCache memory _baseCache, Debtor storage _debtor, bool _roundUp) internal returns (
        DebtorCache memory debtorCache
    ) {
        if (_initDebtorCache(_baseCache, _debtor, debtorCache, _roundUp)) {
            unchecked {
               estimatedTotalRiskPremiumInterest += debtorCache.riskPremiumInterestDelta;
            }

            _debtor.checkpoint = debtorCache.riskPremiumInterest;
            _debtor.checkpointTime = uint32(block.timestamp);
        }
    }

    /**
     * @dev Setup the BaseCache without writing state.
     */
    function _getDebtorCacheRO(BaseCache memory _baseCache, Debtor storage _debtor, bool _roundUp) internal view returns (
        DebtorCache memory debtorCache
    ) {
        _initDebtorCache(_baseCache, _debtor, debtorCache, _roundUp);
    }

    /// @dev The difference between `a - b`, floored at zero (will not revert) for two uint128 variables
    function _subFloorZero(uint128 a, uint128 b) internal pure returns (uint128) {
        unchecked {
            return a > b ? a - b : 0;
        }
    }

    /**
     * @notice Recover any token from the debt token
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyElevatedAccess {
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

}
