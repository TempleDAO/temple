pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (v2/TempleBaseDebtToken.sol)

import { IERC20, IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { mulDiv } from "@prb/math/src/Common.sol";
import { Governable } from "contracts/common/access/Governable.sol";
import { Operators } from "contracts/common/access/Operators.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// @todo remove after testing
import {console2} from "forge-std/Test.sol";

/**
 * @title Temple Debt Token
 * @notice A rebasing ERC20 representing principal accruing at a `base + risk premium` continuously compounding interest rate.
 *
 * There are 3 components to the debt:
 *   1/ Principal
 *   2/ 'base' interest, which a common rate for all borrowers, representing a Temple wide risk free rate.
 *      It is implemented using a vaults/share based implementation.
 *   3/ 'risk premium' interest, where the interest rate is set per borrower
 *
 * On a repayment, the interest accruing at the higher rate is paid down first.
 * 
 * This token is is non-transferrable. Only approved Operators can borrow/repay the debt on behalf of a user.
 */
contract TempleDebtToken is IERC20, IERC20Metadata, Governable, Operators {
    using CompoundedInterest for uint256;
    using SafeERC20 for IERC20;

    string public constant VERSION = "0.1.0";

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
    uint8 public constant override decimals = 18;

    /**
     * @notice The current (base rate) interest common for all users. This can be updated by governance
     * @dev 1e18 format, where 0.01e18 = 1%
     */
    uint256 public baseRate;

    /**
     * @notice The (base rate) total number of shares allocated out to users for internal book keeping
     */
    uint256 public baseShares;

    /**
     * @notice The (base rate) total principal and interest owed across all debtors as of the latest checkpoint
     */
    uint256 public baseCheckpoint;

    /**
     * @notice The last checkpoint time of the (base rate) principal and interest checkpoint
     */
    uint256 public baseCheckpointTime;

    struct Debtor {
        /// @notice The current principal owed by this debtor
        uint256 principal;

        /// @notice The number of this shares this debtor is allocated of the base interest.
        uint256 baseShares;

        /// @notice The current (risk premium) interest rate specific to this debtor. This can be updated by governance
        /// @dev 1e18 format, where 0.01e18 = 1%
        uint256 rate;

        /// @notice The debtor's (risk premium) interest (no principal) owed as of the last checkpoint
        uint256 checkpoint;

        /// @notice The last checkpoint time of this debtor's (risk premium) interest
        uint256 checkpointTime;
    }

    /**
     * @notice Per address status of debt
     */
    mapping(address => Debtor) public debtors;

    /**
     * @notice The latest estimate of the (risk premium) interest (no principal) owed.
     * @dev Indicative only. This total is only updated on a per strategy basis when that strategy gets 
     * checkpointed (on borrow/repay rate change).
     * So it is generally always going to be out of date as each strategy will accrue interest independently 
     * on different rates.
     */
    uint256 public estimatedTotalDebtorInterest;

    error NonTransferrable();
    error RepayingMoreThanDebt(uint256 remainingDebt, uint256 repayAmount);

    event BaseInterestRateSet(uint256 rate);
    event DebtorInterestRateSet(address indexed debtor, uint256 rate);
    event RecoveredToken(address indexed token, address to, uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        address _initialGov,
        uint256 _baseInterestRate
    ) Governable(_initialGov)
    {
        name = _name;
        symbol = _symbol;
        baseRate = _baseInterestRate;
        baseCheckpointTime = block.timestamp;
    }

    /**
     * @notice Governance can add an address which is able to add or paydown debt 
     * positions on behalf of users.
     */
    function addOperator(address _account) external override onlyGov {
        _addOperator(_account);
    }

    /**
     * @notice Governance can remove an address which is able to add or paydown debt 
     * positions on behalf of users.
     */
    function removeOperator(address _account) external override onlyGov {
        _removeOperator(_account);
    }

    /**
     * @notice Track the deployed version of this contract. 
     */
    function version() external pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice Governance can update the continuously compounding (base) interest rate of all debtors, from this block onwards.
     */
    function setBaseInterestRate(uint256 _rate) external onlyGov {
        _checkpointBase(_compoundedBaseInterest());
        baseRate = _rate;
        emit BaseInterestRateSet(_rate);
    }

    /**
     * @notice Governance can update the continuously compounding (risk premium) interest rate for a given debtor, from this block onwards
     */
    function setDebtorInterestRate(address _debtor, uint256 _rate) external onlyGov {
        Debtor storage debtor = debtors[_debtor];
        _checkpointDebtor(debtor);
        debtor.rate = _rate;
        emit DebtorInterestRateSet(_debtor, _rate);
    }

    /**
     * @notice Approved operators can add a new borrow position on behalf of a user.
     * @param _debtor The address of the debtor who is issued new debt
     * @param _borrowAmount The notional amount of debt tokens to issue.
     */
    function borrow(address _debtor, uint256 _borrowAmount) external onlyOperators {
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress(_debtor);
        if (_borrowAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        // Checkpoint the (base) debt and the (risk premium) debt for this borrower
        uint256 _totalPrincipalAndBase = _compoundedBaseInterest();
        _checkpointBase(_totalPrincipalAndBase);
        uint256 _totalBaseShares = baseShares;

        Debtor storage debtor = debtors[_debtor];
        _checkpointDebtor(debtor);              
        
        // Calculate the number of (base) debt shares for this borrow amount. Ensure this is rounded down (same as EIP-4626)
        uint256 sharesAmount = _debtToShares(_borrowAmount, _totalPrincipalAndBase, _totalBaseShares, false);
        console2.log("BORROWING: debt=", _borrowAmount, " shares=", sharesAmount);

        // Add the shares to the debtor and total
        debtor.baseShares += sharesAmount;
        baseShares = _totalBaseShares + sharesAmount;

        // The principal borrowed now increases (which affects the risk premium interest accrual)
        // and also the (base rate) checkpoint representing the principal+base interest
        debtor.principal += _borrowAmount;
        baseCheckpoint += _borrowAmount;

        emit Transfer(address(0), _debtor, _borrowAmount);
    }

    /**
     * @notice Approved operators can repay debt on behalf of a user.
     * @dev Interest is repaid in preference:
     *   1/ Firstly to the higher interest rate of (baseRate, debtor risk premium rate)
     *   2/ Any remaining of the repayment is then paid of the other interest amount.
     *   3/ Finally if there is still some repayment amount unallocated, 
     *      then the principal will be paid down. This is like a new debt is issued for the lower balance,
     *      where interest accrual starts fresh.
     * @param _debtor The address of the debtor
     * @param _repayAmount The notional amount of debt tokens to repay.
     */
    function repay(address _debtor, uint256 _repayAmount) external onlyOperators {
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress(_debtor);
        if (_repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        Debtor storage debtor = debtors[_debtor];
        uint256 _totalPrincipalAndBase = _compoundedBaseInterest();
        
        {
            // Check the user isn't paying off more debt than they have
            uint256 _debtorBalance = _balanceOf(debtor, _totalPrincipalAndBase);
            if (_repayAmount > _debtorBalance) revert RepayingMoreThanDebt(_balanceOf(debtor, _totalPrincipalAndBase), _repayAmount);
        }
        emit Transfer(_debtor, address(0), _repayAmount);
        _repay(debtor, _repayAmount, _totalPrincipalAndBase);
    }

    /**
     * @notice Approved operators can repay the entire debt on behalf of a user.
     * @param _debtor The address of the debtor
     */
    function repayAll(address _debtor) external onlyOperators {
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress(_debtor);
        Debtor storage debtor = debtors[_debtor];
        uint256 _totalPrincipalAndBase = _compoundedBaseInterest();
        uint256 _repayAmount = _balanceOf(debtor, _totalPrincipalAndBase);

        if (_repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit Transfer(_debtor, address(0), _repayAmount);
        _repay(debtor, _repayAmount, _totalPrincipalAndBase);
    }

    function _repay(Debtor storage debtor, uint256 _repayAmount, uint256 _totalPrincipalAndBase) internal {
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
            _debtorDebtRepaid = _repayDebtorInterest(
                _repayAmount,
                _debtorCheckpoint
            );
            _repayAmount -= _debtorDebtRepaid;

            _baseDebtRepaid = _repayBaseInterest(
                _repayAmount,
                _debtorShares,
                _totalPrincipalAndBase,
                _totalBaseShares,
                _debtorPrincipal
            );
            _repayAmount -= _baseDebtRepaid;
        } else {
            _baseDebtRepaid = _repayBaseInterest(
                _repayAmount,
                _debtorShares,
                _totalPrincipalAndBase,
                _totalBaseShares,
                _debtorPrincipal
            );
            _repayAmount -= _baseDebtRepaid;

            _debtorDebtRepaid = _repayDebtorInterest(
                _repayAmount,
                _debtorCheckpoint
            );
            _repayAmount -= _debtorDebtRepaid;
        }

        // Any remaining out of `_repayAmount` is principal which is repaid.
        console2.log("REPAYING PRINCIPAL:", _repayAmount);

        /**
         * @todo Can this ever overflow because of rounding? Possibly...
         * might need to handle that explicitly.
         * debtor.principal = (_repayAmount == _debtorPrincipal+1) 
         *     ? 0
         *     : _debtorPrincipal - _repayAmount;
         * I want to see it happen first though.
         */
        debtor.principal = _debtorPrincipal - _repayAmount;

        // The base principal and interest checkpoint is updated, the sum of the base debt repaid plus any remaining
        // repayment which represents a principal paydown.
        uint256 _totalBaseRepaid = _baseDebtRepaid + _repayAmount;
        baseCheckpoint -= _totalBaseRepaid;

        // Calculate the number of shares (base) total repayment represents. Round up to the nearest share (same as EIP-4626)
        {
            uint256 _totalSharesRepaid = _debtToShares(_totalBaseRepaid, _totalPrincipalAndBase, _totalBaseShares, true);
            debtor.baseShares = _debtorShares - _totalSharesRepaid;
            baseShares = _totalBaseShares - _totalSharesRepaid;
        }

        // Update the per debtor checkpoint of (risk premium) interest, and also update the 
        // cumulative estimate of total debtor interest owing.
        {
            debtor.checkpoint = _debtorCheckpoint - _debtorDebtRepaid;
            estimatedTotalDebtorInterest -= _debtorDebtRepaid;
        }
    }

    function _repayDebtorInterest(
        uint256 _repayAmount, 
        uint256 _debtorCheckpoint
    ) internal view returns (
        uint256 _debtRepaid
    ) {
        // Repay the per debtor interest - the minimum of what's debt is still outstanding, 
        // and what of the repayment amount is still unallocated
        _debtRepaid = _debtorCheckpoint < _repayAmount ? _debtorCheckpoint : _repayAmount;
        console2.log("repaying PER DEBTOR INTEREST:", _debtRepaid);
    }

    function _repayBaseInterest(
        uint256 _repayAmount,
        uint256 _baseInterestShares,
        uint256 _totalPrincipalAndBase,
        uint256 _totalBaseShares,
        uint256 _debtorPrincipal
    ) internal view returns (
        uint256 _debtRepaid
    ) {
        // Get the interest-only portion remaining of the base debt given the amount of shares.
        // Round down for the base interest which is repaid. Any difference will be covered later by the principal repayment (which rounds up)
        _debtRepaid = _sharesToDebt(_baseInterestShares, _totalPrincipalAndBase, _totalBaseShares, false) - _debtorPrincipal;

        // Use the minimum of what's debt is still outstanding, and what of the repayment amount is still unallocated.
        _debtRepaid = _debtRepaid < _repayAmount ? _debtRepaid : _repayAmount;
        console2.log("repaying BASE INTEREST:", _debtRepaid);
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
    ) external pure returns (uint256) {
        return 0;
    }

    /**
     * @notice Debt tokens are not transferrable. Allowance always returns 0
     */
    function approve(
        address /*spender*/,
        uint256 /*amount*/
    ) external pure returns (bool) {
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
    function checkpointPrincipalAndBaseInterest() external returns (uint256) {
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
    function checkpointDebtorInterest(address debtor) external returns (uint256) {
        return _checkpointDebtor(debtors[debtor]);
    }

    /**
     * @notice Checkpoint multiple accounts (risk premium) interest (no principal) owed up to this block.
     * @dev Provided in case there needs to be block synchronisation on the total debt.
     */
    function checkpointDebtorsInterest(address[] memory _debtors) external {
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
        estimatedTotalDebtorInterest += (interest - debtor.checkpoint);
        console2.log("estimatedTotalDebtorInterest + ", (interest - debtor.checkpoint));
        debtor.checkpoint = interest;
        debtor.checkpointTime = block.timestamp;
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
        console2.log("_debtorInterest:", _timeElapsed);
        uint256 _principal = debtor.principal;
        uint256 _principalAndInterest = _principal + debtor.checkpoint;
        return _principalAndInterest.continuouslyCompounded(_timeElapsed, _rate) - _principal;
    }

    /**
     * @notice Returns the amount of tokens owed by the debtor as of this block.
     * It includes the principal + the base interest + specific debtor risk premium interest
     */
    function balanceOf(address _debtor) public view returns (uint256) {
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
    function currentDebtOf(address _debtor) external view returns (
        uint256 principal, 
        uint256 baseInterest, 
        uint256 riskPremiumInterest
    ) {
        Debtor storage debtor = debtors[_debtor];
        principal = debtor.principal;
        console2.log("currentDebtOf:", debtor.baseShares, _sharesToDebt(debtor.baseShares, _compoundedBaseInterest(), baseShares, false));
        baseInterest = _sharesToDebt(debtor.baseShares, _compoundedBaseInterest(), baseShares, false) - principal;
        riskPremiumInterest = _compoundedDebtorInterest(debtor);
    }

    /**
      * @notice The current total principal + total base interest, total (estimate) debtor specific risk premium interest owed by all debtors.
      * @dev Note the (total principal + total base interest) portion is up to date.
      * However the (debtor specific risk premium interest) portion is likely stale.
      * The `estimatedTotalDebtorInterest` is only updated when each debtor checkpoints, so it's going to be out of date.
      * For more up to date current totals, off-chain aggregation of balanceOf() will be required - eg via subgraph.
      */
    function currentTotalDebt() public view returns (
        uint256 basePrincipalAndInterest, 
        uint256 estimatedDebtorInterest
    ) {
        return (
            _compoundedBaseInterest(),
            estimatedTotalDebtorInterest
        );
    }

    /**
      * @notice The current total principal + total base interest, total (estimate) debtor specific risk premium interest owed by all debtors.
      * @dev Note the (total principal + total base interest) portion is up to date.
      * However the (debtor specific risk premium interest) portion is likely stale.
      * The `estimatedTotalDebtorInterest` is only updated when each debtor checkpoints, so it's going to be out of date.
      * For more up to date current totals, off-chain aggregation of balanceOf() will be required - eg via subgraph.
      */
    function totalSupply() public view returns (uint256) {
        (uint256 basePrincipalAndInterest, uint256 estimatedDebtorInterest) = currentTotalDebt();
        return basePrincipalAndInterest + estimatedDebtorInterest;
    }

    /**
     * @notice Convert a (base interest) debt amount into proportional amount of shares
     */
    function baseDebtToShares(uint256 debt) external view returns (uint256) {
        return _debtToShares(debt, _compoundedBaseInterest(), baseShares, false);
    }

    function _debtToShares(uint256 _debt, uint256 _totalDebt, uint256 _totalShares, bool roundUp) internal pure returns (uint256) {
        return _totalDebt == 0 
            ? _debt 
            : mulDivRound(_debt, _totalShares, _totalDebt, roundUp); 
    }

    /**
     * @notice Convert a number of (base interest) shares into proportional amount of debt
     */
    function baseSharesToDebt(uint256 shares) external view returns (uint256) {
        return _sharesToDebt(shares, _compoundedBaseInterest(), baseShares, false);
    }

    function _sharesToDebt(uint256 _shares, uint256 _totalDebt, uint256 _totalShares, bool roundUp) internal pure returns (uint256) {
        return _totalShares == 0 
            ? _shares
            : mulDivRound(_shares, _totalDebt, _totalShares, roundUp);
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
    function recoverToken(address token, address to, uint256 amount) external onlyGov {
        IERC20(token).safeTransfer(to, amount);
        emit RecoveredToken(token, to, amount);
    }

}
