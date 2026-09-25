// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;
// (contracts/wishingwell/FixedPriceAuction.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IFixedPriceAuction } from "contracts/interfaces/wishingwell/IFixedPriceAuction.sol";

import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

contract FixedPriceAuction is IFixedPriceAuction, TempleElevatedAccess, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using TempleMath for uint256;

    AuctionConfig private _config;
    uint64 private _effectiveDepositEnd;
    Phase private _finalOutcome;
    SettlementPreview private _settlement;

    /// @inheritdoc IFixedPriceAuction
    mapping(address => uint256) public override deposits;
    /// @inheritdoc IFixedPriceAuction
    mapping(address => bool) public override claimed;
    /// @inheritdoc IFixedPriceAuction
    bool public override treasuryClaimed;
    /// @inheritdoc IFixedPriceAuction
    uint256 public override totalDeposits;
    /// @inheritdoc IFixedPriceAuction
    uint256 public override remainingFunding;

    constructor(
        AuctionConfig memory config_,
        address executor_,
        address rescuer_
    ) TempleElevatedAccess(rescuer_, executor_) {
        uint256 end = uint256(config_.depositStart) + config_.depositDuration;
        // Do validation
        /// @dev An alternative to this approach would be using Initializable and calling contract.initialize(), but that adds
        /// extra complexity for this single instance design
        if (
            config_.depositToken.code.length == 0 || config_.fundingToken.code.length == 0
                || config_.depositToken == config_.fundingToken || config_.treasury == address(0)
                || config_.treasury == address(this) || config_.priceNumerator == 0 || config_.priceDenominator == 0
                || config_.depositStart < block.timestamp || config_.depositDuration == 0
                || config_.fulfillmentDuration == 0 || end + config_.fulfillmentDuration > type(uint64).max
        ) {
            revert InvalidConfig();
        }
        _config = config_;
        _effectiveDepositEnd = uint64(end);
    }

    /// @inheritdoc IFixedPriceAuction
    function endDeposit() external override onlyElevatedAccess {
        _requirePhase(Phase.Deposit);

        _effectiveDepositEnd = uint64(block.timestamp);

        emit DepositEndedEarly(msg.sender, _effectiveDepositEnd, _fulfillmentEnd());
    }

    /// @inheritdoc IFixedPriceAuction
    function cancelScheduled() external override onlyElevatedAccess {
        _requirePhase(Phase.Scheduled);
        _cancel(Phase.Scheduled);
    }

    /// @inheritdoc IFixedPriceAuction
    function endFulfillment() external override onlyElevatedAccess {
        _requirePhase(Phase.Fulfillment);
        _settle(true);
    }

    /// @inheritdoc IFixedPriceAuction
    function cancelFulfillment() external override onlyElevatedAccess {
        _requirePhase(Phase.Fulfillment);
        _cancel(Phase.Fulfillment);
    }

    /// @inheritdoc IFixedPriceAuction
    function cancelDeposit() external override onlyElevatedAccess {
        _requirePhase(Phase.Deposit);
        _cancel(Phase.Deposit);
    }

    /// @inheritdoc IFixedPriceAuction
    function phase() public view override returns (Phase) {
        if (_finalOutcome == Phase.Settled || _finalOutcome == Phase.Cancelled) { return _finalOutcome; }
        if (block.timestamp < _config.depositStart) { return Phase.Scheduled; }
        if (block.timestamp < _effectiveDepositEnd) { return Phase.Deposit; }
        if (block.timestamp < _fulfillmentEnd()) { return Phase.Fulfillment; }

        return Phase.Settled;
    }

    /// @inheritdoc IFixedPriceAuction
    function getConfig() external view override returns (AuctionConfig memory) {
        return _config;
    }

    /// @inheritdoc IFixedPriceAuction
    function getTiming() external view override returns (AuctionTiming memory) {
        return AuctionTiming(
            _config.depositStart,
            _config.depositStart + _config.depositDuration,
            _effectiveDepositEnd,
            _effectiveDepositEnd,
            _fulfillmentEnd()
        );
    }

    /// @inheritdoc IFixedPriceAuction
    function deposit(uint256 amount) external override {
        _requirePhase(Phase.Deposit);

        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        uint256 updatedTotal = totalDeposits + amount;
        // Verify the resulting full-funding requirement remains representable before accepting assets.
        _requiredFunding(updatedTotal);

        IERC20(_config.depositToken).safeTransferFrom(msg.sender, address(this), amount);
        totalDeposits = updatedTotal;
        deposits[msg.sender] += amount;

        emit Deposited(msg.sender, amount, deposits[msg.sender], updatedTotal);
    }

    // @todo Reentrancy
    /// @inheritdoc IFixedPriceAuction
    function withdrawDeposit(uint256 amount) external override {
        _requirePhase(Phase.Deposit);

        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (amount > deposits[msg.sender]) { revert InsufficientDeposit(); }

        deposits[msg.sender] -= amount;
        totalDeposits -= amount;

        IERC20(_config.depositToken).safeTransfer(msg.sender, amount);

        emit DepositWithdrawn(msg.sender, amount, deposits[msg.sender], totalDeposits);
    }

    /// @inheritdoc IFixedPriceAuction
    function fund(uint256 amount) external override onlyTreasury {
        _requirePhase(Phase.Fulfillment);

        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        remainingFunding += amount;

        IERC20(_config.fundingToken).safeTransferFrom(msg.sender, address(this), amount);

        emit Funded(msg.sender, amount, remainingFunding);
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawExcess(uint256 amount) external override onlyTreasury {
        _requirePhase(Phase.Fulfillment);
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        uint256 available = withdrawableExcess();
        if (amount > available) { revert ExcessExceeded(amount, available); }

        remainingFunding -= amount;
        IERC20(_config.fundingToken).safeTransfer(_config.treasury, amount);

        emit ExcessWithdrawn(msg.sender, amount, remainingFunding);
    }

    /// @inheritdoc IFixedPriceAuction
    function finalize() external override {
        _requirePhase(Phase.Settled);
        if (_finalOutcome != Phase.Settled) _settle(false);
    }

    /// @inheritdoc IFixedPriceAuction
    function claim() external override {
        /// @notice First user claim can finaluize an expired auction automatically
        _ensureFinalized();

        if (claimed[msg.sender]) { revert AlreadyClaimed(); }
        if (deposits[msg.sender] == 0) { revert NothingToClaim(); }

        UserClaim memory amounts = claimable(msg.sender);
        claimed[msg.sender] = true;
        remainingFunding -= amounts.fundingTokenAmount;

        if (amounts.fundingTokenAmount > 0) { IERC20(_config.fundingToken).safeTransfer(msg.sender, amounts.fundingTokenAmount); }
        
        if (amounts.depositTokenRefund > 0) { IERC20(_config.depositToken).safeTransfer(msg.sender, amounts.depositTokenRefund); }

        emit UserClaimed(msg.sender, amounts.fundingTokenAmount, amounts.depositTokenRefund);
    }

    /// @inheritdoc IFixedPriceAuction
    function claimTreasury() external override {
        _ensureFinalized();
        if (treasuryClaimed) { revert AlreadyClaimed(); }

        TreasuryClaim memory amounts = treasuryClaimable();
        treasuryClaimed = true;
        remainingFunding -= amounts.fundingTokenRefund;
        if (amounts.fundingTokenRefund > 0) {
            IERC20(_config.fundingToken).safeTransfer(_config.treasury, amounts.fundingTokenRefund);
        }
        if (amounts.depositTokenAmount > 0) {
            IERC20(_config.depositToken).safeTransfer(_config.treasury,amounts.depositTokenAmount);
        }

        emit TreasuryClaimed(msg.sender, _config.treasury, amounts.depositTokenAmount, amounts.fundingTokenRefund);
    }

    /// @inheritdoc IFixedPriceAuction
    function fullFundingRequired() public view override returns (uint256) {
        return _requiredFunding(totalDeposits);
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawableExcess() public view override returns (uint256) {
        if (phase() != Phase.Fulfillment) { return 0; }

        uint256 required = fullFundingRequired();
        return remainingFunding > required ? remainingFunding - required : 0;
    }

    /// @inheritdoc IFixedPriceAuction
    function previewSettlement() public view override returns (SettlementPreview memory) {
        if (_finalOutcome == Phase.Settled || _finalOutcome == Phase.Cancelled) { return _settlement; }

        return _calculateSettlement();
    }

    /// @inheritdoc IFixedPriceAuction
    function claimable(address account) public view override returns (UserClaim memory amounts) {
        Phase current = phase();

        if ((current != Phase.Settled && current != Phase.Cancelled) || claimed[account]) { return amounts; }
        if (current == Phase.Cancelled) {
            amounts.depositTokenRefund = deposits[account];
        } else if (totalDeposits != 0) {
            SettlementPreview memory result = previewSettlement();
            amounts.fundingTokenAmount = deposits[account].mulDivRound(result.userFunding, totalDeposits, false);
            amounts.depositTokenRefund = deposits[account].mulDivRound(result.userDepositRefund, totalDeposits, false);
        }
    }

    /// @inheritdoc IFixedPriceAuction
    function treasuryClaimable() public view override returns (TreasuryClaim memory amounts) {
        Phase current = phase();

        if ((current != Phase.Settled && current != Phase.Cancelled) || treasuryClaimed) { return amounts; }
        SettlementPreview memory result = previewSettlement();
        amounts.depositTokenAmount = result.filledDeposits;
        amounts.fundingTokenRefund = result.treasuryFundingRefund;
    }

    function _calculateSettlement() private view returns (SettlementPreview memory result) {
        result.totalDeposits = totalDeposits;
        uint256 required = fullFundingRequired();
        uint256 filled = remainingFunding >= required
            ? totalDeposits
            : remainingFunding.mulDivRound(_config.priceDenominator, _config.priceNumerator, false);
        uint256 userFunding = filled.mulDivRound(_config.priceNumerator, _config.priceDenominator, false);
        // Avoid exchanging a positive deposit quantity for zero aggregate payment.
        if (userFunding == 0) { filled = 0; }
        result.filledDeposits = filled;
        result.userFunding = userFunding;
        result.userDepositRefund = totalDeposits - filled;
        result.treasuryFundingRefund = remainingFunding - userFunding;
    }

    function _settle(bool early) private {
        _settlement = _calculateSettlement();
        _finalOutcome = Phase.Settled;
        SettlementPreview memory settlement_ = _settlement;
        emit AuctionSettled(
            msg.sender,
            early,
            settlement_.totalDeposits,
            settlement_.filledDeposits,
            settlement_.userFunding,
            settlement_.userDepositRefund,
            settlement_.treasuryFundingRefund
        );
    }

    function _cancel(Phase previousPhase) private {
        _settlement = SettlementPreview(totalDeposits, 0, 0, totalDeposits, remainingFunding);
        _finalOutcome = Phase.Cancelled;

        emit AuctionCancelled(msg.sender, previousPhase, totalDeposits, remainingFunding);
    }

    function _ensureFinalized() private {
        Phase current = phase();
        if (current == Phase.Cancelled) { return; }
        if (current != Phase.Settled) { revert InvalidPhase(Phase.Settled, current); }
        if (_finalOutcome != Phase.Settled) { _settle(false); }
    }

    function _requiredFunding(uint256 amount) private view returns (uint256) {
        // Round up so funding covers all deposits at the fixed price. Any unused funding is refunded to Treasury.
        return amount.mulDivRound(_config.priceNumerator, _config.priceDenominator, true);
    }

    function _fulfillmentEnd() private view returns (uint64) {
        return _effectiveDepositEnd + _config.fulfillmentDuration;
    }

    function _requirePhase(Phase expected) private view {
        Phase current = phase();
        if (current != expected) { revert InvalidPhase(expected, current); }
    }

    modifier onlyTreasury() {
        if (msg.sender != _config.treasury) { revert OnlyTreasury(); }
        _;
    }
}