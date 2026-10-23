pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/FixedPriceAuction.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { LibClone } from "solady/src/utils/LibClone.sol";

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { IComplianceCheck } from "contracts/interfaces/templegold/IComplianceCheck.sol";
import { RescuableAccess } from "contracts/templegold/access/RescuableAccess.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/// @title FixedPriceAuction
/// @notice See IFixedPriceAuction.
/// @dev Deployed once as an implementation; each auction is a clone whose args hold its `AuctionConfig`.
contract FixedPriceAuction is IFixedPriceAuction, RescuableAccess {
    using SafeERC20 for IERC20;
    using TempleMath for uint256;

    /// @dev How the auction ended.
    enum Outcome {
        None,
        Settled,
        Cancelled
    }

    /// @dev The most decimals either token may have.
    uint8 private constant MAX_TOKEN_DECIMALS = 18;
    /// @dev The fewest decimals either token may have. Below this, rounding each bidder's fill and refund down to
    /// whole base units can cost them a material amount.
    uint8 private constant MIN_TOKEN_DECIMALS = 6;

    /// @inheritdoc IFixedPriceAuction
    uint256 public override priceDenominator;

    /// @inheritdoc IFixedPriceAuction
    address public override complianceCheck;
    /// @inheritdoc IFixedPriceAuction
    bool public override complianceDisabled;
    /// @inheritdoc IFixedPriceAuction
    bool public override paused;

    /// @inheritdoc IFixedPriceAuction
    uint40 public override settledAt;
    /// @dev Set by `_settle` or `cancel`. `phase()` reads Settled from `fulfillmentEnd` even while this is `None`.
    Outcome private _outcome;
    /// @dev True on the implementation from deployment, and on a clone once `initialize` runs.
    bool private _initialized;
    /// @inheritdoc IFixedPriceAuction
    bool public override treasuryClaimed;

    /// @inheritdoc IFixedPriceAuction
    mapping(address account => uint256 amount) public override deposits;
    /// @inheritdoc IFixedPriceAuction
    mapping(address account => bool hasClaimed) public override claimed;
    /// @inheritdoc IFixedPriceAuction
    uint256 public override totalDeposits;
    /// @inheritdoc IFixedPriceAuction
    mapping(address account => uint256 amount) public override excluded;

    /// @inheritdoc IFixedPriceAuction
    uint256 public override bidOwed;
    /// @inheritdoc IFixedPriceAuction
    uint256 public override fillOwed;

    /// @dev The settlement snapshot, written with `_outcome`. All zero while `_outcome` is `None`.
    Settlement private _settlement;

    constructor() {
        _initialized = true;
    }

    /// @inheritdoc IFixedPriceAuction
    function initialize(address initialExecutor, address initialRescuer) external override {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;
        _initRescuableAccess(initialExecutor, initialRescuer);

        AuctionConfig memory config = _config();
        if (config.funder == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        if (config.proceedsRecipient == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        if (config.complianceCheck == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        if (
            config.depositStart <= block.timestamp
                || config.depositStart >= config.depositEnd
                || config.depositEnd >= config.fulfillmentEnd
                || config.fulfillmentEnd > type(uint40).max
                || config.bidToken == config.fillToken
                || config.price == 0
        ) revert CommonEventsAndErrors.InvalidParam();

        uint8 bidDecimals = IERC20Metadata(config.bidToken).decimals();
        uint8 fillDecimals = IERC20Metadata(config.fillToken).decimals();
        if (
            bidDecimals > MAX_TOKEN_DECIMALS || fillDecimals > MAX_TOKEN_DECIMALS || bidDecimals < MIN_TOKEN_DECIMALS
                || fillDecimals < MIN_TOKEN_DECIMALS
        ) {
            revert CommonEventsAndErrors.InvalidParam();
        }
        priceDenominator = 10 ** (18 + uint256(bidDecimals) - fillDecimals);

        emit ComplianceCheckSet(config.complianceCheck);
        complianceCheck = config.complianceCheck;
    }

    /// @inheritdoc IFixedPriceAuction
    function deposit(uint256 amount) external override whenNotPaused notBlocked {
        AuctionConfig memory config = _config();
        _requirePhase(config, Phase.Deposit);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        uint256 newDeposit = deposits[msg.sender] + amount;
        if (newDeposit < config.minDeposit) revert DepositBelowMinimum(newDeposit, config.minDeposit);
        // Reject deposits that would make the funding calculation overflow and prevent settlement.
        _requiredFunding(totalDeposits + amount, config.price);

        deposits[msg.sender] = newDeposit;
        totalDeposits += amount;
        bidOwed += amount;

        emit Deposited(msg.sender, amount, newDeposit, totalDeposits);
        IERC20(config.bidToken).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawDeposit(uint256 amount) external override whenNotPaused notBlocked {
        AuctionConfig memory config = _config();
        _requirePhase(config, Phase.Deposit);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        uint256 current = deposits[msg.sender];
        if (amount > current) revert CommonEventsAndErrors.InsufficientBalance(config.bidToken, amount, current);

        uint256 remainder = current - amount;
        if (remainder != 0 && remainder < config.minDeposit) revert DepositBelowMinimum(remainder, config.minDeposit);

        deposits[msg.sender] = remainder;
        totalDeposits -= amount;
        bidOwed -= amount;

        emit DepositWithdrawn(msg.sender, amount, remainder, totalDeposits);
        IERC20(config.bidToken).safeTransfer(msg.sender, amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function exclude(address account) external override {
        _onlyExclusionAdmin();
        AuctionConfig memory config = _config();
        Phase current = _phase(config);
        if (current != Phase.Deposit && current != Phase.Fulfillment) revert InvalidPhase(Phase.Fulfillment, current);
        if (!_isBlocked(account)) revert AccountNotBlocked(account);
        uint256 amount = deposits[account];
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        emit BidderExcluded(account, amount);
        deposits[account] = 0;
        excluded[account] += amount;
        totalDeposits -= amount;
    }

    /// @inheritdoc IFixedPriceAuction
    function reinstate(address account) external override {
        _onlyExclusionAdmin();
        AuctionConfig memory config = _config();
        _requirePhase(config, Phase.Deposit);
        if (_isBlocked(account)) revert BlockedAccount(account);
        uint256 amount = excluded[account];
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        // Reject a reinstate that would make the funding calculation overflow and prevent settlement.
        _requiredFunding(totalDeposits + amount, config.price);

        emit BidderReinstated(account, amount);
        excluded[account] = 0;
        deposits[account] += amount;
        totalDeposits += amount;
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawExcluded() external override whenNotPaused notBlocked {
        uint256 amount = excluded[msg.sender];
        if (amount == 0) revert NothingToClaim();

        excluded[msg.sender] = 0;
        bidOwed -= amount;

        emit ExcludedWithdrawn(msg.sender, amount);
        IERC20(_config().bidToken).safeTransfer(msg.sender, amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function fund(uint256 amount) external override whenNotPaused {
        AuctionConfig memory config = _config();
        _onlyFunder(config.funder);
        _requirePhase(config, Phase.Fulfillment);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        fillOwed += amount;

        emit Funded(msg.sender, amount, fillOwed);
        IERC20(config.fillToken).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawExcess(uint256 amount) external override whenNotPaused {
        AuctionConfig memory config = _config();
        _onlyFunder(config.funder);
        _requirePhase(config, Phase.Fulfillment);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        uint256 available = _withdrawableExcess(config);
        if (amount > available) revert CommonEventsAndErrors.InsufficientBalance(config.fillToken, amount, available);

        fillOwed -= amount;

        emit ExcessWithdrawn(msg.sender, amount, fillOwed);
        IERC20(config.fillToken).safeTransfer(msg.sender, amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function endFulfillment() external override onlyElevatedAccess {
        AuctionConfig memory config = _config();
        _requirePhase(config, Phase.Fulfillment);
        // Safe: unix seconds fit in uint40 until the year 36812.
        // forge-lint: disable-next-line(unsafe-typecast)
        _settle(uint40(block.timestamp), config.price);
    }

    /// @inheritdoc IFixedPriceAuction
    function cancel() external override {
        _onlyExecutorOrRescuerInRescueMode();
        AuctionConfig memory config = _config();
        if (_outcome != Outcome.None || block.timestamp >= config.fulfillmentEnd) {
            revert InvalidPhase(Phase.Fulfillment, _phase(config));
        }

        _settlement = Settlement(0, 0, totalDeposits, fillOwed);
        _outcome = Outcome.Cancelled;

        emit AuctionCancelled(totalDeposits, fillOwed);
    }

    /// @inheritdoc IFixedPriceAuction
    function claim() external override whenNotPaused notBlocked {
        AuctionConfig memory config = _config();
        _settleIfDue(config);
        if (claimed[msg.sender]) revert AlreadyClaimed();
        if (deposits[msg.sender] == 0) revert NothingToClaim();

        UserClaim memory userClaim = _claimable(msg.sender, config);
        claimed[msg.sender] = true;
        bidOwed -= userClaim.bidTokenRefund;
        fillOwed -= userClaim.fillTokenAmount;

        emit UserClaimed(msg.sender, userClaim.fillTokenAmount, userClaim.bidTokenRefund);
        if (userClaim.bidTokenRefund > 0) {
            IERC20(config.bidToken).safeTransfer(msg.sender, userClaim.bidTokenRefund);
        }
        if (userClaim.fillTokenAmount > 0) {
            IERC20(config.fillToken).safeTransfer(msg.sender, userClaim.fillTokenAmount);
        }
    }

    /// @inheritdoc IFixedPriceAuction
    function claimTreasury() external override whenNotPaused {
        AuctionConfig memory config = _config();
        _settleIfDue(config);
        if (treasuryClaimed) revert AlreadyClaimed();

        TreasuryClaim memory treasuryClaim = _treasuryClaimable(config);
        treasuryClaimed = true;
        bidOwed -= treasuryClaim.bidTokenAmount;
        fillOwed -= treasuryClaim.fillTokenRefund;

        emit TreasuryClaimed(
            config.proceedsRecipient, config.funder, treasuryClaim.bidTokenAmount, treasuryClaim.fillTokenRefund
        );
        if (treasuryClaim.bidTokenAmount > 0) {
            IERC20(config.bidToken).safeTransfer(config.proceedsRecipient, treasuryClaim.bidTokenAmount);
        }
        if (treasuryClaim.fillTokenRefund > 0) {
            IERC20(config.fillToken).safeTransfer(config.funder, treasuryClaim.fillTokenRefund);
        }
    }

    /// @inheritdoc IFixedPriceAuction
    function recoverToken(
        address token,
        address to,
        uint256 amount
    ) external override whenNotPaused onlyElevatedAccess {
        if (to == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        AuctionConfig memory config = _config();
        uint256 owed = token == config.bidToken ? bidOwed : token == config.fillToken ? fillOwed : 0;
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 recoverable = balance > owed ? balance - owed : 0;
        if (amount > recoverable) revert CommonEventsAndErrors.InsufficientBalance(token, amount, recoverable);

        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function setPaused(bool value) external override {
        _onlyExecutorOrRescuerInRescueMode();
        emit PausedSet(value);
        paused = value;
    }

    /// @inheritdoc IFixedPriceAuction
    function setComplianceCheck(address newComplianceCheck) external override onlyElevatedAccess {
        if (complianceDisabled) revert ComplianceCheckIsDisabled();
        if (newComplianceCheck == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        emit ComplianceCheckSet(newComplianceCheck);
        complianceCheck = newComplianceCheck;
    }

    /// @inheritdoc IFixedPriceAuction
    function disableComplianceCheck() external override onlyRescuer {
        emit ComplianceCheckDisabled();
        complianceDisabled = true;
    }

    /// @inheritdoc IFixedPriceAuction
    function phase() external view override returns (Phase) {
        return _phase(_config());
    }

    /// @inheritdoc IFixedPriceAuction
    function getConfig() external view override returns (AuctionConfig memory config) {
        config = _config();
        config.complianceCheck = complianceCheck;
    }

    /// @inheritdoc IFixedPriceAuction
    function getTiming() external view override returns (AuctionTiming memory) {
        AuctionConfig memory config = _config();
        return AuctionTiming(config.depositStart, config.depositEnd, config.fulfillmentEnd, settledAt);
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawableExcess() external view override returns (uint256) {
        return _withdrawableExcess(_config());
    }

    /// @inheritdoc IFixedPriceAuction
    function previewSettlement() external view override returns (Settlement memory) {
        return _previewSettlement(_config().price);
    }

    /// @inheritdoc IFixedPriceAuction
    function claimable(address account) external view override returns (UserClaim memory) {
        return _claimable(account, _config());
    }

    /// @inheritdoc IFixedPriceAuction
    function treasuryClaimable() external view override returns (TreasuryClaim memory) {
        return _treasuryClaimable(_config());
    }

    /// @dev The config the factory appended to this clone's code.
    function _config() internal view returns (AuctionConfig memory) {
        return abi.decode(LibClone.argsOnClone(address(this)), (AuctionConfig));
    }

    function _phase(AuctionConfig memory config) private view returns (Phase) {
        if (_outcome == Outcome.Settled) return Phase.Settled;
        if (_outcome == Outcome.Cancelled) return Phase.Cancelled;
        if (block.timestamp < config.depositStart) return Phase.Scheduled;
        if (block.timestamp < config.depositEnd) return Phase.Deposit;
        if (block.timestamp < config.fulfillmentEnd) return Phase.Fulfillment;
        return Phase.Settled;
    }

    function _withdrawableExcess(AuctionConfig memory config) private view returns (uint256) {
        if (paused || _phase(config) != Phase.Fulfillment) return 0;
        uint256 required = _requiredFunding(totalDeposits, config.price);
        return fillOwed > required ? fillOwed - required : 0;
    }

    function _previewSettlement(uint256 price) private view returns (Settlement memory) {
        if (_outcome != Outcome.None) return _settlement;
        return _calculateSettlement(price);
    }

    function _claimable(
        address account,
        AuctionConfig memory config
    ) private view returns (UserClaim memory userClaim) {
        if (!_isFinal(config) || claimed[account] || totalDeposits == 0) return userClaim;
        Settlement memory preview = _previewSettlement(config.price);
        uint256 amount = deposits[account];
        // Independent, rounded-down shares, so claim order doesn't matter. The dust stays put.
        userClaim.fillTokenAmount = amount.mulDivRound(preview.userFunding, totalDeposits, false);
        userClaim.bidTokenRefund = amount.mulDivRound(preview.userRefund, totalDeposits, false);
    }

    function _treasuryClaimable(AuctionConfig memory config) private view returns (TreasuryClaim memory treasuryClaim) {
        if (!_isFinal(config) || treasuryClaimed) return treasuryClaim;
        Settlement memory preview = _previewSettlement(config.price);
        treasuryClaim.bidTokenAmount = preview.filledDeposits;
        treasuryClaim.fillTokenRefund = preview.funderRefund;
    }

    function _calculateSettlement(uint256 price) private view returns (Settlement memory) {
        uint256 denominator = priceDenominator;
        // The fill tokens bought round down, so bidders never get more than the funding covers.
        uint256 filled = fillOwed >= _requiredFunding(totalDeposits, price)
            ? totalDeposits
            : fillOwed.mulDivRound(denominator, price, false);
        uint256 userFunding = filled.mulDivRound(price, denominator, false);
        // Charge the rounded-up cost of userFunding and refund the rest, so a zero userFunding takes no bid tokens.
        filled = userFunding.mulDivRound(denominator, price, true);
        return Settlement(filled, userFunding, totalDeposits - filled, fillOwed - userFunding);
    }

    function _settle(uint40 timestamp, uint256 price) private {
        _settlement = _calculateSettlement(price);
        _outcome = Outcome.Settled;
        settledAt = timestamp;

        Settlement memory s = _settlement;
        emit AuctionSettled(timestamp, totalDeposits, s.filledDeposits, s.userFunding, s.userRefund, s.funderRefund);
    }

    function _settleIfDue(AuctionConfig memory config) private {
        Phase current = _phase(config);
        if (current == Phase.Cancelled) return;
        if (current != Phase.Settled) revert InvalidPhase(Phase.Settled, current);
        // Safe: initialize caps fulfillmentEnd at type(uint40).max.
        // forge-lint: disable-next-line(unsafe-typecast)
        if (_outcome == Outcome.None) _settle(uint40(config.fulfillmentEnd), config.price);
    }

    function _isFinal(AuctionConfig memory config) private view returns (bool) {
        Phase current = _phase(config);
        return current == Phase.Settled || current == Phase.Cancelled;
    }

    /// @dev Round up, so a fully funded auction always covers the fixed price.
    function _requiredFunding(uint256 amount, uint256 price) private view returns (uint256) {
        return amount.mulDivRound(price, priceDenominator, true);
    }

    function _isBlocked(address account) private view returns (bool) {
        return !complianceDisabled && IComplianceCheck(complianceCheck).isBlocked(account);
    }

    function _requirePhase(AuctionConfig memory config, Phase expected) private view {
        Phase current = _phase(config);
        if (current != expected) revert InvalidPhase(expected, current);
    }

    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    function _requireNotPaused() private view {
        if (paused) revert IsPaused();
    }

    modifier notBlocked() {
        _requireNotBlocked();
        _;
    }

    function _requireNotBlocked() private view {
        if (_isBlocked(msg.sender)) revert BlockedAccount(msg.sender);
    }

    /// @dev Outside rescue mode only: the executor, or, while compliance is enabled, a blocker on the current list.
    /// ComplianceCheck has no rescue mode and the msig can repoint the list, so rescue mode must lock blockers out
    /// here.
    function _onlyExclusionAdmin() private view {
        if (_isElevatedAccess(msg.sender, msg.sig)) return;
        if (inRescueMode) revert CommonEventsAndErrors.InvalidAccess();
        if (complianceDisabled || !IComplianceCheck(complianceCheck).isBlocker(msg.sender)) {
            revert CommonEventsAndErrors.InvalidAccess();
        }
    }

    function _onlyExecutorOrRescuerInRescueMode() private view {
        if (msg.sender != (inRescueMode ? rescuer : executor)) revert CommonEventsAndErrors.InvalidAccess();
    }

    function _onlyFunder(address funder) private view {
        if (msg.sender != funder) revert CommonEventsAndErrors.InvalidAccess();
    }
}
