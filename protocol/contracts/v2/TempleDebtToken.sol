pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/TempleBaseDebtToken.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";

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

    string public constant VERSION = "1.0.0";

    /**
     * @dev Returns the name of the token.
     */
    string public override name;

    /**
     * @dev Returns the symbol of the token.
     */
    string public override symbol;

    /**
     * @dev Returns the decimals places of the token.
     */
    // solhint-disable-next-line const-name-snakecase
    uint8 public constant override decimals = 18;

    /**
     * @notice The current (base rate) interest common for all strategies. This can be updated by the DAO
     * @dev 1e18 format, where 0.01e18 = 1%
     */
    uint96 public override baseRate;

    /**
     * @notice The (base rate) total number of shares allocated out to strategies for internal book keeping
     */
    uint256 public override baseShares;

    /**
     * @notice The (base rate) total principal and interest owed across all debtors as of the latest checkpoint
     */
    uint256 public override baseCheckpoint;

    /**
     * @notice The last checkpoint time of the (base rate) principal and interest checkpoint
     */
    uint256 public override baseCheckpointTime;

    /**
     * @notice Per address status of debt
     */
    mapping(address => Debtor) public override debtors;

    /**
     * @notice The net amount of principal amount of debt minted across all strategies.
     */
    uint256 public override totalPrincipal;

    /**
     * @notice The latest estimate of the (risk premium) interest (no principal) owed.
     * @dev Indicative only. This total is only updated on a per strategy basis when that strategy gets 
     * checkpointed (on borrow/repay rate change).
     * So it is generally always going to be out of date as each strategy will accrue interest independently 
     * on different rates.
     */
    uint256 public override estimatedTotalRiskPremiumInterest;

    /// @notice A set of addresses which are approved to mint/burn
    mapping(address => bool) public override minters;

    constructor(
        string memory _name,
        string memory _symbol,
        address _initialRescuer,
        address _initialExecutor,
        uint256 _baseInterestRate
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        name = _name;
        symbol = _symbol;
        baseRate = _baseInterestRate.encodeUInt96();
        baseCheckpointTime = block.timestamp;
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
    function setBaseInterestRate(uint256 _rate) external override onlyElevatedAccess {
        _checkpointBase(_compoundedBaseInterest());
        baseRate = _rate.encodeUInt96();
        emit BaseInterestRateSet(_rate);
    }

    /**
     * @notice Update the continuously compounding (risk premium) interest rate for a given debtor, from this block onwards
     */
    function setRiskPremiumInterestRate(address _debtor, uint256 _rate) external override onlyElevatedAccess {
        Debtor storage debtor = debtors[_debtor];
        _checkpointDebtor(debtor);
        debtor.rate = _rate.encodeUInt64();
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

        // Checkpoint the (base) debt and the (risk premium) debt for this borrower
        uint256 _totalPrincipalAndBase = _compoundedBaseInterest();
        _checkpointBase(_totalPrincipalAndBase);
        uint256 _totalBaseShares = baseShares;

        Debtor storage debtor = debtors[_debtor];
        _checkpointDebtor(debtor);              
        
        // Calculate the number of (base) debt shares for this borrow amount. Ensure this is rounded down (same as EIP-4626)
        uint256 sharesAmount = _debtToShares(_mintAmount, _totalPrincipalAndBase, _totalBaseShares, false);

        // Update the contract state
        {
            // Add the shares to the debtor and total
            debtor.baseShares += sharesAmount.encodeUInt128();
            baseShares = _totalBaseShares + sharesAmount;

            // The principal borrowed now increases (which affects the risk premium interest accrual)
            // and also the (base rate) checkpoint representing the principal+base interest
            debtor.principal += _mintAmount.encodeUInt128();
            totalPrincipal += _mintAmount;
            baseCheckpoint += _mintAmount;
        }

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

        Debtor storage debtor = debtors[_debtor];
        uint256 _totalPrincipalAndBase = _compoundedBaseInterest();
        
        {
            // The user can't pay off more debt than they have.
            // It is capped, and the actual amount burned returned as a value
            uint256 _debtorBalance = _balanceOf(debtor, _totalPrincipalAndBase);
            if (_burnAmount > _debtorBalance) {
                _burnAmount = _debtorBalance;
            }
        }

        emit Transfer(_debtor, address(0), _burnAmount);
        _burn(debtor, _burnAmount, _totalPrincipalAndBase);
        return _burnAmount;
    }

    /**
     * @notice Approved Minters can burn the entire debt on behalf of a user.
     * @param _debtor The address of the debtor
     */
    function burnAll(address _debtor) external override returns (uint256 burnedAmount) {
        if (!minters[msg.sender]) revert CannotMintOrBurn(msg.sender);
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress();

        Debtor storage debtor = debtors[_debtor];
        uint256 _totalPrincipalAndBase = _compoundedBaseInterest();
        burnedAmount = _balanceOf(debtor, _totalPrincipalAndBase);

        if (burnedAmount != 0) {
            emit Transfer(_debtor, address(0), burnedAmount);
            _burn(debtor, burnedAmount, _totalPrincipalAndBase);
        }
    }

    function _burn(Debtor storage debtor, uint256 _burnAmount, uint256 _totalPrincipalAndBase) internal {
        // First checkpoint both the base interest and (risk premium) interest of the debtor.
        _checkpointBase(_totalPrincipalAndBase);
        _checkpointDebtor(debtor);

        // Local vars to save multiple stoarge lookups
        uint256 _totalBaseShares = baseShares;
        uint256 _debtorShares = debtor.baseShares;
        uint256 _debtorPrincipal = debtor.principal;
        uint256 _debtorCheckpoint = debtor.checkpoint;
        uint256 _debtorDebtRepaid;
        uint256 _baseDebtRepaid;

        // Calculate what can be repaid out of the (base interest) and (risk premium interest).
        // Pay off the the item with the higher interest rate first.
        if (debtor.rate > baseRate) {
            // The minimum of what debt is still outstanding, and the requested amount to be burned
            _debtorDebtRepaid = _debtorCheckpoint < _burnAmount ? _debtorCheckpoint : _burnAmount;
            _burnAmount -= _debtorDebtRepaid;

            _baseDebtRepaid = _burnBaseInterest(
                _burnAmount,
                _debtorShares,
                _totalPrincipalAndBase,
                _totalBaseShares,
                _debtorPrincipal
            );
            _burnAmount -= _baseDebtRepaid;
        } else {
            _baseDebtRepaid = _burnBaseInterest(
                _burnAmount,
                _debtorShares,
                _totalPrincipalAndBase,
                _totalBaseShares,
                _debtorPrincipal
            );
            _burnAmount -= _baseDebtRepaid;

            // The minimum of what debt is still outstanding, and the requested amount to be burned
            _debtorDebtRepaid = _debtorCheckpoint < _burnAmount ? _debtorCheckpoint : _burnAmount;
            _burnAmount -= _debtorDebtRepaid;
        }

        // Update the contract state.
        // Any remaining out of `_burnAmount` is principal which is repaid.
        {
            unchecked {
                debtor.principal = uint128(_debtorPrincipal - _burnAmount);
                totalPrincipal -= _burnAmount;
            }

            // The base principal and interest checkpoint is updated, the sum of the base debt repaid plus any remaining
            // repayment which represents a principal paydown.
            uint256 _totalBaseRepaid = _baseDebtRepaid + _burnAmount;
            unchecked {
                baseCheckpoint -= _totalBaseRepaid;
            }

            // Calculate the number of shares (base) total repayment represents. Round up to the nearest share (same as EIP-4626)
            uint256 _totalSharesRepaid = _debtToShares(_totalBaseRepaid, _totalPrincipalAndBase, _totalBaseShares, true);
            unchecked {
                debtor.baseShares = uint128(_debtorShares - _totalSharesRepaid);
                baseShares = _totalBaseShares - _totalSharesRepaid;
            }

            // Update the per debtor checkpoint of (risk premium) interest, and also update the 
            // cumulative estimate of total debtor interest owing.
            unchecked {
                debtor.checkpoint = uint160(_debtorCheckpoint - _debtorDebtRepaid);
                estimatedTotalRiskPremiumInterest -= _debtorDebtRepaid;
            }
        }
    }

    function _burnBaseInterest(
        uint256 _burnAmount,
        uint256 _baseInterestShares,
        uint256 _totalPrincipalAndBase,
        uint256 _totalBaseShares,
        uint256 _debtorPrincipal
    ) internal pure returns (
        uint256 _debtRepaid
    ) {
        // Get the interest-only portion remaining of the base debt given the amount of shares.
        // Round down for the base interest which is repaid. Any difference will be covered later by the principal repayment (which rounds up)
        _debtRepaid = _sharesToDebt(_baseInterestShares, _totalPrincipalAndBase, _totalBaseShares, false) - _debtorPrincipal;

        // Use the minimum of what's debt is still outstanding, and what of the repayment amount is still unallocated.
        _debtRepaid = _debtRepaid < _burnAmount ? _debtRepaid : _burnAmount;
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
        uint256 _totalPrincipalAndBase = _compoundedBaseInterest();
        _checkpointBase(_totalPrincipalAndBase);
        return _totalPrincipalAndBase;
    }

    function _checkpointBase(uint256 _totalDebt) internal {
        baseCheckpoint = _totalDebt;
        baseCheckpointTime = block.timestamp;
    }
    
    /**
     * @notice Checkpoint a debtor's (risk premium) interest (no principal) owed up to this block.
     */
    function checkpointDebtorInterest(address debtor) external override returns (uint256) {
        return _checkpointDebtor(debtors[debtor]);
    }

    /**
     * @notice Checkpoint multiple accounts (risk premium) interest (no principal) owed up to this block.
     * @dev Provided in case there needs to be block synchronisation on the total debt.
     */
    function checkpointDebtorsInterest(address[] calldata _debtors) external override {
        uint256 _length = _debtors.length;
        for (uint256 i; i < _length; ++i) {
            _checkpointDebtor(debtors[_debtors[i]]);
        }
    }

    /**
     * @notice Checkpoint a debtor's (risk premium) interest (no principal) owed up to this block.
     */
    function _checkpointDebtor(Debtor storage debtor) internal returns (uint256) {
        uint256 interest = _compoundedDebtorInterest(debtor);
        unchecked {
            estimatedTotalRiskPremiumInterest += (interest - debtor.checkpoint);
        }
        debtor.checkpoint = uint160(interest);
        debtor.checkpointTime = uint32(block.timestamp);
        return interest;
    }

    /**
     * @notice The total principal and base interest owed by all debtors as of now.
     */
    function _compoundedBaseInterest() internal view returns (uint256) {
        uint256 _timeElapsed = block.timestamp - baseCheckpointTime;
        return baseCheckpoint.continuouslyCompounded(_timeElapsed, baseRate);
    }

    /**
     * @notice The current (risk premium) interest owed by a debtor (doesn't include principal or base interest)
     */
    function _compoundedDebtorInterest(Debtor storage debtor) internal view returns (uint256) {
        uint256 _rate = debtor.rate;
        if (_rate == 0) return 0;

        uint256 _timeElapsed = block.timestamp - debtor.checkpointTime;
        uint256 _principal = debtor.principal;
        uint256 _principalAndInterest = _principal + debtor.checkpoint;
        return _principalAndInterest.continuouslyCompounded(_timeElapsed, uint96(_rate)) - _principal;
    }

    /**
     * @notice Returns the amount of tokens owed by the debtor as of this block.
     * It includes the principal + the base interest + specific debtor risk premium interest
     */
    function balanceOf(address _debtor) public override view returns (uint256) {
        return _balanceOf(debtors[_debtor], _compoundedBaseInterest());
    }

    /**
     * @notice Returns the amount of tokens owed by the debtor as of this block.
     * It includes the principal + the base interest + specific debtor risk premium interest
     */
    function _balanceOf(Debtor storage debtor, uint256 _totalPrincipalAndBase) internal view returns (uint256) {
        return (
            _sharesToDebt(debtor.baseShares, _totalPrincipalAndBase, baseShares, false) + 
            _compoundedDebtorInterest(debtor)
        );
    }

    /**
     * @notice The current debt for a given user split out by
     * principal, base interest, risk premium (per debtor) interest
     */
    function currentDebtOf(address _debtor) external override view returns (
        uint256 principal, 
        uint256 baseInterest, 
        uint256 riskPremiumInterest
    ) {
        Debtor storage debtor = debtors[_debtor];
        principal = debtor.principal;
        baseInterest = _sharesToDebt(debtor.baseShares, _compoundedBaseInterest(), baseShares, false) - principal;
        riskPremiumInterest = _compoundedDebtorInterest(debtor);
    }

    /**
      * @notice The current total principal + total base interest, total (estimate) debtor specific risk premium interest owed by all debtors.
      * @dev Note the (total principal + total base interest) portion is up to date.
      * However the (debtor specific risk premium interest) portion is likely stale.
      * The `estimatedTotalRiskPremiumInterest` is only updated when each debtor checkpoints, so it's going to be out of date.
      * For more up to date current totals, off-chain aggregation of balanceOf() will be required - eg via subgraph.
      */
    function currentTotalDebt() public override view returns (
        uint256 principal,
        uint256 baseInterest, 
        uint256 estimatedRiskPremiumInterest
    ) {
        uint256 _basePrincipalAndInterest = _compoundedBaseInterest();
        return (
            totalPrincipal,
            _basePrincipalAndInterest - totalPrincipal,
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
        (uint256 principal, uint256 baseInterest, uint256 estimatedRiskPremiumInterest) = currentTotalDebt();
        return principal + baseInterest + estimatedRiskPremiumInterest;
    }

    /**
     * @notice Convert a (base interest) debt amount into proportional amount of shares
     */
    function baseDebtToShares(uint256 debt) external override view returns (uint256) {
        return _debtToShares(debt, _compoundedBaseInterest(), baseShares, false);
    }

    function _debtToShares(uint256 _debt, uint256 _totalDebt, uint256 _totalShares, bool roundUp) internal pure returns (uint256) {
        return _totalDebt > 0 
            ? mulDivRound(_debt, _totalShares, _totalDebt, roundUp)
            : _debt;
    }

    /**
     * @notice Convert a number of (base interest) shares into proportional amount of debt
     */
    function baseSharesToDebt(uint256 shares) external override view returns (uint256) {
        return _sharesToDebt(shares, _compoundedBaseInterest(), baseShares, false);
    }

    function _sharesToDebt(uint256 _shares, uint256 _totalDebt, uint256 _totalShares, bool roundUp) internal pure returns (uint256) {
        return _totalShares > 0 
            ? mulDivRound(_shares, _totalDebt, _totalShares, roundUp)
            : _shares;
    }

    /// @notice mulDiv with an option to round the result up or down to the nearest wei
    function mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
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
