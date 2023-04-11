pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (v2/TempleBaseDebtToken.sol)

import { IERC20, IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { mulDiv } from "@prb/math/src/Common.sol";
import { Governable } from "contracts/common/access/Governable.sol";
import { Operators } from "contracts/common/access/Operators.sol";

// @todo remove
import {console2} from "forge-std/Test.sol";

// @todo perhaps make it upgradeable. It's internal only and we may want to change the structure later...?

/**
 * @title Temple Debt Token
 * 3 components to the debt:
 *   Principal
 *   Common 'base' rate interest (share based implementation)
 *   Per strategy interest (rate set per strategy)
 *
 * On repay, pay off the highest interest rate first.
 * 
 * This is non-transferrable, only the Operators (ie the Treasury Reserve Vault) can borrow/repay 
 * the debt on behalf of a user
 */
contract TempleDebtToken is IERC20, IERC20Metadata, Governable, Operators {
    using CompoundedInterest for uint256;

    string public constant VERSION = "0.1.0";

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    // @todo The current variable names aren't great - rename.
    // perhaps 'marginalInterest'

    // @todo Can probably flatten this rather than a struct.
    struct BaseInterest {
        /// @notice The current base interest rate
        uint256 interestRateBps;

        /// @notice The total shares allocated out to users
        uint256 totalShares;

        /// @notice The principal and total base interest across all users as of the last checkpoint
        uint256 totalDebtCheckpoint;

        /// @notice The last checkpoint time of the total base debt
        uint256 totalDebtCheckpointTime;
    }

    /// @notice The latest base interest information across all users.
    BaseInterest public baseInterest;

    // @todo Can optimise byte packing in the struct (reason why the params are in a weird order)
    struct Debtor {
        /// @notice The current interest rate specific to this debtor
        uint256 interestRateBps;

        /// @notice The last checkpoint time of this user's specific interest only
        uint256 debtCheckpointTime;

        /// @notice The current principal owed by this debtor
        uint256 principal;

        /// @notice The total base debt across all users as of the last checkpoint
        uint256 debtCheckpoint;

        /// @notice The number of this shares this debtor is allocated of the base interest.
        uint256 baseInterestShares;
    }

    /// @notice Per user debt
    mapping(address => Debtor) public debtors;

    // Indicative only. We can't track the exact amount of interest owed for each debtor
    // as they are all accumulating at different rates - so this just keeps
    // track whenever a debtor checkpoints.
    // The totalSupply() is then an estimate, which is guaranteed 
    // to be at least the principal and base debt, 
    // but may not include the most up to date `sum(strategy specific interest)`
    uint256 public estimatedTotalDebtorInterest;

    error NonTransferrable();
    error RepayingMoreThanDebt(uint256 remainingDebt, uint256 repayAmount);

    event BaseInterestRateSet(uint256 rateBps);
    event DebtorInterestRateSet(address debtor, uint256 rateBps);

    constructor(
        string memory _name,
        string memory _symbol,
        address _initialGov,
        uint256 _baseInterestRateBps
    ) Governable(_initialGov)
    {
        name = _name;
        symbol = _symbol;

        baseInterest.interestRateBps = _baseInterestRateBps;
        baseInterest.totalDebtCheckpointTime = block.timestamp;
    }

    function addOperator(address _account) external override onlyGov {
        _addOperator(_account);
    }

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
     * @notice Update the continuously compounding base interest rate of all holders, from this block onwards
     */
    function setBaseInterestRate(
        uint256 _baseInterestRateBps
    ) external onlyGov {
        // First checkpoint the total debt based on the prior rate
        _checkpointBaseDebt(totalBaseDebt());

        baseInterest.interestRateBps = _baseInterestRateBps;
        emit BaseInterestRateSet(_baseInterestRateBps);
    }

    /**
     * @notice Update the continuously compounding interest rate for a given debtor, from this block onwards
     */
    function setDebtorInterestRate(
        address _debtor,
        uint256 _debtorInterestRateBps
    ) external onlyGov {
        // First checkpoint the total debt based on the prior rate
        Debtor storage debtor = debtors[_debtor];
        _checkpointDebtor(debtor);

        debtor.interestRateBps = _debtorInterestRateBps;
        emit DebtorInterestRateSet(_debtor, _debtorInterestRateBps);
    }

    function borrow(address _debtor, uint256 _debtAmount) external onlyOperators {
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress(_debtor);
        if (_debtAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        uint256 _totalBaseDebt = totalBaseDebt();
        _checkpointBaseDebt(_totalBaseDebt);
        uint256 _totalBaseShares = baseInterest.totalShares;

        Debtor storage debtor = debtors[_debtor];
        _checkpointDebtor(debtor);              
        
        // Mint new shares for the base debt
        // Round down the number of shares the user gets (same as EIP-4626)
        uint256 sharesAmount = _debtToShares(_debtAmount, _totalBaseDebt, _totalBaseShares, false);
        console2.log("BORROWING: debt=", _debtAmount, " shares=", sharesAmount);

        baseInterest.totalShares = _totalBaseShares + sharesAmount;
        baseInterest.totalDebtCheckpoint += _debtAmount;
        debtor.baseInterestShares += sharesAmount;

        // Update the principal borrowed, so the per strategy interest also increases it's accrual
        debtor.principal += _debtAmount;

        emit Transfer(address(0), _debtor, _debtAmount);
    }

    function repayAll(address _debtor) external onlyOperators {
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress(_debtor);
        Debtor storage debtor = debtors[_debtor];
        uint256 _totalBaseDebt = totalBaseDebt();
        uint256 _repayAmount = _balanceOf(debtor, _totalBaseDebt);
        emit Transfer(_debtor, address(0), _repayAmount);
        _repay(debtor, _repayAmount, _totalBaseDebt);
    }

    function repay(address _debtor, uint256 _repayAmount) external onlyOperators {
        if (_debtor == address(0)) revert CommonEventsAndErrors.InvalidAddress(_debtor);
        if (_repayAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        Debtor storage debtor = debtors[_debtor];
        uint256 _totalBaseDebt = totalBaseDebt();
        
        {
            // Check the user isn't paying off more debt than they have
            uint256 _debtorBalance = _balanceOf(debtor, _totalBaseDebt);
            if (_repayAmount > _debtorBalance) revert RepayingMoreThanDebt(_balanceOf(debtor, _totalBaseDebt), _repayAmount);
        }
        emit Transfer(_debtor, address(0), _repayAmount);
        _repay(debtor, _repayAmount, _totalBaseDebt);
    }
    
    function _repay(Debtor storage debtor, uint256 _repayAmount, uint256 _totalBaseDebt) internal {
        _checkpointBaseDebt(_totalBaseDebt);
        _checkpointDebtor(debtor);

        // @todo may be edging towards stack too deep here. Might need to use a struct instead for local vars
        uint256 _totalBaseShares = baseInterest.totalShares;
        uint256 _debtorShares = debtor.baseInterestShares;
        uint256 _debtorPrincipal = debtor.principal;
        uint256 _debtorCheckpoint = debtor.debtCheckpoint;
        uint256 _debtorDebtRepaid;
        uint256 _baseDebtRepaid;

        // Pay off the per higher interest portion first
        // uint256 _repayPortion;
        if (debtor.interestRateBps > baseInterest.interestRateBps) {
            _debtorDebtRepaid = _repayDebtorInterest(
                _repayAmount,
                _debtorCheckpoint
            );
            _repayAmount -= _debtorDebtRepaid;

            _baseDebtRepaid = _repayBaseInterest(
                _repayAmount,
                _debtorShares,
                _totalBaseDebt,
                _totalBaseShares,
                _debtorPrincipal
            );
            _repayAmount -= _baseDebtRepaid;

        } else {
            _baseDebtRepaid = _repayBaseInterest(
                _repayAmount,
                _debtorShares,
                _totalBaseDebt,
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

        // Update the storage slots.
        // Any remaining _repayAmount is principal which is repaid.
        console2.log("REPAYING PRINCIPAL:", _repayAmount);
        // @todo Can this ever overflow because of rounding? Possibly...
        // might need to handle that explicitly.
        // debtor.principal = (_repayAmount == _debtorPrincipal+1) 
        //     ? 0
        //     : _debtorPrincipal - _repayAmount;
        // I want to see it happen first though.
        debtor.principal -= _repayAmount;

        uint256 _totalBaseRepaid = _baseDebtRepaid + _repayAmount;
        baseInterest.totalDebtCheckpoint -= _totalBaseRepaid;

        // Round up the number of shares which are burned from the user supplied debt (same as EIP-4626)
        uint256 _totalSharesRepaid = _debtToShares(_totalBaseRepaid, _totalBaseDebt, _totalBaseShares, true);
        console2.log("Total repay shares:", _totalSharesRepaid);

        debtor.baseInterestShares = _debtorShares - _totalSharesRepaid;
        baseInterest.totalShares = _totalBaseShares - _totalSharesRepaid;
    }

    function _repayDebtorInterest(
        uint256 _repayAmount, 
        uint256 _debtorCheckpoint
    ) internal view returns (
        uint256 _debtRepaid
    ) {
        // Repay the per debtor interest - the min of what's remaining and what was requested
        _debtRepaid = _debtorCheckpoint < _repayAmount ? _debtorCheckpoint : _repayAmount;
        console2.log("repaying PER DEBTOR INTEREST:", _debtRepaid);
    }

    function _repayBaseInterest(
        uint256 _repayAmount,
        uint256 _baseInterestShares,
        uint256 _totalBaseDebt,
        uint256 _totalBaseShares,
        uint256 _debtorPrincipal
    ) internal view returns (
        uint256 _debtRepaid
    ) {
        // Get the only-interest portion remaining of the base interest
        // Round down for the base interest repaid. The principal repaid will round up to cover the difference later.
        _debtRepaid = _sharesToDebt(_baseInterestShares, _totalBaseDebt, _totalBaseShares, false) - _debtorPrincipal;
        _debtRepaid = _debtRepaid < _repayAmount ? _debtRepaid : _repayAmount;
        console2.log("repaying BASE INTEREST:", _debtRepaid);
    }

    function transfer(
        address /*to*/, 
        uint256 /*amount*/
    ) public pure override returns (bool) {
        revert NonTransferrable();
    }

    function allowance(
        address /*owner*/,
        address /*spender*/
    ) external pure returns (uint256) {
        return 0;
    }

    function approve(
        address /*spender*/,
        uint256 /*amount*/
    ) external pure returns (bool) {
        revert NonTransferrable();
    }

    function transferFrom(
        address /*from*/,
        address /*to*/,
        uint256 /*amount*/
    ) public pure override returns (bool) {
        revert NonTransferrable();
    }

    /**
     * @notice Checkpoint the total base principal and interest owed by all debtors up to this block.
     */
    function checkpointBaseDebt() external returns (uint256) {
        uint256 _totalBaseDebt = totalBaseDebt();
        _checkpointBaseDebt(_totalBaseDebt);
        return _totalBaseDebt;
    }

    function _checkpointBaseDebt(uint256 _totalDebt) public {
        baseInterest.totalDebtCheckpoint = _totalDebt;
        baseInterest.totalDebtCheckpointTime = block.timestamp;
    }
    
    /**
     * @notice The total principal and base interest owed by all debtors as of now.
     */
    function totalBaseDebt() public view returns (uint256) {
        uint256 _timeElapsed = block.timestamp - baseInterest.totalDebtCheckpointTime;
        return baseInterest.totalDebtCheckpoint.continuouslyCompounded(_timeElapsed, baseInterest.interestRateBps);
    }

    /**
     * @notice Checkpoint a debtor's specific interest owed up to this block.
     */
    function checkpointDebtor(address debtor) external returns (uint256) {
        return _checkpointDebtor(debtors[debtor]);
    }

    /**
     * @notice Checkpoint a debtor's specific interest owed up to this block.
     */
    function _checkpointDebtor(Debtor storage debtor) internal returns (uint256) {
        uint256 interest = _debtorInterest(debtor);
        estimatedTotalDebtorInterest = estimatedTotalDebtorInterest + interest - debtor.debtCheckpoint;
        debtor.debtCheckpoint = interest;
        debtor.debtCheckpointTime = block.timestamp;
        return interest;
    }

    /// @notice The current specific interest owed by a debtor (doesn't include principal or base interest)
    function debtorInterest(address _debtor) public view returns (uint256) {
        return _debtorInterest(debtors[_debtor]);
    }

    /// @notice The current specific interest owed by a debtor (doesn't include principal or base interest)
    function _debtorInterest(Debtor storage debtor) internal view returns (uint256) {
        uint256 _timeElapsed = block.timestamp - debtor.debtCheckpointTime;
        uint256 _principal = debtor.principal;
        uint256 _principalAndInterest = _principal + debtor.debtCheckpoint;
        return _principalAndInterest.continuouslyCompounded(_timeElapsed, debtor.interestRateBps) - _principal;
    }

    /**
     * @notice Returns the amount of tokens owed by the debtor.
     * This balance increases every block by the continuously compounding interest rate.
     * It includes the principal + the base interest + specific debtor interest
     */
    function balanceOf(address _debtor) public view returns (uint256) {
        return _balanceOf(debtors[_debtor], totalBaseDebt());
    }

    /**
     * @notice Returns the amount of tokens owed by the debtor.
     * This balance increases every block by the continuously compounding interest rate.
     * It includes the principal + the base interest + specific debtor interest
     */
    function _balanceOf(Debtor storage debtor, uint256 _totalBaseDebt) internal view returns (uint256) {
        return (
            _sharesToDebt(debtor.baseInterestShares, _totalBaseDebt, baseInterest.totalShares, false) + 
            _debtorInterest(debtor)
        );
    }

    /// @notice Returns the current debt for a given user split out by
    /// principal, base interest, specific debtor interest
    function currentDebtOf(address _debtor) external view returns (
        uint256 principal, 
        uint256 baseInterestDebt, 
        uint256 debtorInterestDebt
    ) {
        Debtor storage debtor = debtors[_debtor];
        principal = debtor.principal;
        baseInterestDebt = _sharesToDebt(debtor.baseInterestShares, totalBaseDebt(), baseInterest.totalShares, false);
        debtorInterestDebt = _debtorInterest(debtor);
    }

    /// @notice The current total principal, total base interest, total (estimate) debtor specific interest owed by all debtors.
    /// @dev The total specific interest owed is an estimate only.
    /// This is only updated when each debtor checkpoints, so it's going to be out of date.
    /// For current totals, instead rely on periodic subgraph updates.
    function currentTotalDebt() public view returns (
        uint256 basePrincipalAndInterest, 
        uint256 estimatedDebtorInterest
    ) {
        return (
            _sharesToDebt(baseInterest.totalShares, totalBaseDebt(), baseInterest.totalShares, false),
            estimatedTotalDebtorInterest
        );
    }

    /// @notice The current total principal, total base interest, total (estimate) debtor specific interest owed by all debtors.
    /// @dev The total specific interest owed is an estimate only.
    /// This is only updated when each debtor checkpoints, so it's going to be out of date.
    /// For current totals, instead rely on periodic subgraph updates.
    function totalSupply() public view returns (uint256) {
        (uint256 basePrincipalAndInterest, uint256 estimatedDebtorInterest) = currentTotalDebt();
        return basePrincipalAndInterest + estimatedDebtorInterest;
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
     * @notice Convert a debt amount into proportional amount of shares
     */
    function _debtToShares(uint256 _debt, uint256 _totalDebt, uint256 _totalShares, bool roundUp) internal pure returns (uint256) {
        // uint256 _totalDebt = totalBaseDebt();
        return _totalDebt == 0 
            ? _debt 
            : mulDivRound(_debt, _totalShares, _totalDebt, roundUp); 
    }

    /**
     * @notice Convert a number of shares into proportional amount of debt
     */
    function _sharesToDebt(uint256 _shares, uint256 _totalDebt, uint256 _totalShares, bool roundUp) internal pure returns (uint256) {
        // uint256 _totalShares = baseInterest.totalShares;
        return _totalShares == 0 
            ? _shares
            : mulDivRound(_shares, _totalDebt, _totalShares, roundUp);
    }

}
