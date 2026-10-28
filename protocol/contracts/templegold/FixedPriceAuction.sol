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
    uint256 public constant override MIN_DEPOSIT_START_DELAY = 1 days;
    /// @inheritdoc IFixedPriceAuction
    uint256 public constant override MIN_DEPOSIT_WINDOW = 1 days;
    /// @inheritdoc IFixedPriceAuction
    uint256 public constant override CLAIM_PAUSE_EXPIRY = 30 days;

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
    /// @dev Set by `settleEarly` or `cancel`. `phase()` reads Settlement from `fulfillmentEnd` while this is `None`.
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
    uint256 public override funding;

    /// @inheritdoc IFixedPriceAuction
    uint256 public override totalExcluded;
    /// @inheritdoc IFixedPriceAuction
    uint256 public override bidPaid;
    /// @inheritdoc IFixedPriceAuction
    uint256 public override fillPaid;

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
        _requireComplianceCheck(config.complianceCheck);
        if (
            config.depositStart < block.timestamp + MIN_DEPOSIT_START_DELAY
                || config.depositEnd < config.depositStart + MIN_DEPOSIT_WINDOW
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
    function deposit(uint256 amount) external override whenNotPaused notFlagged {
        AuctionConfig memory config = _config();
        _requirePhase(config, Phase.Deposit);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        uint256 newDeposit = deposits[msg.sender] + amount;
        if (newDeposit < config.minDeposit) revert DepositBelowMinimum(newDeposit, config.minDeposit);
        // Reject deposits that would make the funding calculation overflow and prevent settlement.
        _requiredFunding(totalDeposits + amount, config.price);

        deposits[msg.sender] = newDeposit;
        totalDeposits += amount;

        emit Deposited(msg.sender, amount, newDeposit, totalDeposits);
        IERC20(config.bidToken).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawDeposit(uint256 amount) external override whenNotPaused notFlagged {
        AuctionConfig memory config = _config();
        _requirePhase(config, Phase.Deposit);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        uint256 current = deposits[msg.sender];
        if (amount > current) revert CommonEventsAndErrors.InsufficientBalance(config.bidToken, amount, current);

        uint256 remainder = current - amount;
        if (remainder != 0 && remainder < config.minDeposit) revert DepositBelowMinimum(remainder, config.minDeposit);

        deposits[msg.sender] = remainder;
        totalDeposits -= amount;

        emit DepositWithdrawn(msg.sender, amount, remainder, totalDeposits);
        IERC20(config.bidToken).safeTransfer(msg.sender, amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function exclude(address account) external override {
        _onlyExclusionAdmin();
        AuctionConfig memory config = _config();
        Phase current = _phase(config);
        if (current != Phase.Deposit && current != Phase.Fulfillment) revert InvalidPhase(Phase.Fulfillment, current);
        if (!_isFlagged(account)) revert AccountNotFlagged(account);
        uint256 amount = deposits[account];
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        emit BidderExcluded(account, amount);
        deposits[account] = 0;
        excluded[account] += amount;
        totalExcluded += amount;
        totalDeposits -= amount;
    }

    /// @inheritdoc IFixedPriceAuction
    function reinstate(address account) external override {
        _onlyExclusionAdmin();
        AuctionConfig memory config = _config();
        _requirePhase(config, Phase.Deposit);
        if (_isFlagged(account)) revert FlaggedAccount(account);
        uint256 amount = excluded[account];
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        // Reject a reinstate that would make the funding calculation overflow and prevent settlement.
        _requiredFunding(totalDeposits + amount, config.price);

        emit BidderReinstated(account, amount);
        excluded[account] = 0;
        totalExcluded -= amount;
        deposits[account] += amount;
        totalDeposits += amount;
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawExcluded() external override notFlagged {
        AuctionConfig memory config = _config();
        _requireClaimNotPaused(config);
        uint256 amount = excluded[msg.sender];
        if (amount == 0) revert NothingToClaim();

        excluded[msg.sender] = 0;
        totalExcluded -= amount;

        emit ExcludedWithdrawn(msg.sender, amount);
        IERC20(config.bidToken).safeTransfer(msg.sender, amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function fund(uint256 amount) external override whenNotPaused {
        AuctionConfig memory config = _config();
        _onlyFunder(config.funder);
        _requirePhase(config, Phase.Fulfillment);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        funding += amount;

        emit Funded(msg.sender, amount, funding);
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

        funding -= amount;

        emit ExcessWithdrawn(msg.sender, amount, funding);
        IERC20(config.fillToken).safeTransfer(msg.sender, amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function settleEarly() external override onlyElevatedAccess {
        AuctionConfig memory config = _config();
        _requirePhase(config, Phase.Fulfillment);
        _outcome = Outcome.Settled;
        // Safe: unix seconds fit in uint40 until the year 36812.
        // forge-lint: disable-next-line(unsafe-typecast)
        _emitSettlement(uint40(block.timestamp), config.price);
    }

    /// @inheritdoc IFixedPriceAuction
    function cancel() external override {
        _onlyExecutorOrRescuerInRescueMode();
        AuctionConfig memory config = _config();
        if (_outcome != Outcome.None || block.timestamp >= config.fulfillmentEnd) {
            revert InvalidPhase(Phase.Fulfillment, _phase(config));
        }

        _outcome = Outcome.Cancelled;

        emit AuctionCancelled(totalDeposits, funding);
    }

    /// @inheritdoc IFixedPriceAuction
    function emitSettlement() external override {
        AuctionConfig memory config = _config();
        _requirePhase(config, Phase.Settlement);
        if (settledAt != 0) revert AlreadySettled();
        _emitClockSettlement(config);
    }

    /// @inheritdoc IFixedPriceAuction
    function claim() external override notFlagged {
        AuctionConfig memory config = _config();
        _requireClaimNotPaused(config);
        _requireFinal(config);
        if (claimed[msg.sender]) revert AlreadyClaimed();
        if (deposits[msg.sender] == 0) revert NothingToClaim();
        _emitClockSettlementIfDue(config);

        UserClaim memory userClaim = _claimable(msg.sender, config);
        claimed[msg.sender] = true;
        bidPaid += userClaim.refund;
        fillPaid += userClaim.fill;

        emit UserClaimed(msg.sender, userClaim.fill, userClaim.refund);
        if (userClaim.refund > 0) {
            IERC20(config.bidToken).safeTransfer(msg.sender, userClaim.refund);
        }
        if (userClaim.fill > 0) {
            IERC20(config.fillToken).safeTransfer(msg.sender, userClaim.fill);
        }
    }

    /// @inheritdoc IFixedPriceAuction
    function claimTreasury() external override {
        AuctionConfig memory config = _config();
        _requireClaimNotPaused(config);
        _requireFinal(config);
        if (treasuryClaimed) revert AlreadyClaimed();
        _emitClockSettlementIfDue(config);

        TreasuryClaim memory treasuryClaim = _treasuryClaimable(config);
        treasuryClaimed = true;
        bidPaid += treasuryClaim.proceeds;
        fillPaid += treasuryClaim.funderRefund;

        emit TreasuryClaimed(
            config.proceedsRecipient, config.funder, treasuryClaim.proceeds, treasuryClaim.funderRefund
        );
        if (treasuryClaim.proceeds > 0) {
            IERC20(config.bidToken).safeTransfer(config.proceedsRecipient, treasuryClaim.proceeds);
        }
        if (treasuryClaim.funderRefund > 0) {
            IERC20(config.fillToken).safeTransfer(config.funder, treasuryClaim.funderRefund);
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
        (uint256 bidLiability, uint256 fillLiability) = _liabilities();
        uint256 owed = token == config.bidToken ? bidLiability : token == config.fillToken ? fillLiability : 0;
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
        _requireComplianceCheck(newComplianceCheck);
        emit ComplianceCheckSet(newComplianceCheck);
        complianceCheck = newComplianceCheck;
    }

    /// @inheritdoc IFixedPriceAuction
    function disableComplianceCheck() external override onlyRescuer {
        if (!inRescueMode) revert CommonEventsAndErrors.InvalidAccess();
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
    function encodeConfig(AuctionConfig calldata config) external pure override returns (bytes memory) {
        return abi.encode(config);
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawableExcess() external view override returns (uint256) {
        return _withdrawableExcess(_config());
    }

    /// @inheritdoc IFixedPriceAuction
    function settlement() external view override returns (Settlement memory) {
        return _settlement(_config().price);
    }

    /// @inheritdoc IFixedPriceAuction
    function claimable(address account) external view override returns (UserClaim memory) {
        return _claimable(account, _config());
    }

    /// @inheritdoc IFixedPriceAuction
    function treasuryClaimable() external view override returns (TreasuryClaim memory) {
        return _treasuryClaimable(_config());
    }

    /// @inheritdoc IFixedPriceAuction
    function liabilities() external view override returns (uint256 bidLiability, uint256 fillLiability) {
        return _liabilities();
    }

    /// @dev The config the factory appended to this clone's code.
    function _config() internal view returns (AuctionConfig memory) {
        return abi.decode(LibClone.argsOnClone(address(this)), (AuctionConfig));
    }

    /// @dev Deposits, excluded balances and funding, less what claims have already paid out.
    function _liabilities() private view returns (uint256 bidLiability, uint256 fillLiability) {
        bidLiability = totalDeposits + totalExcluded - bidPaid;
        fillLiability = funding - fillPaid;
    }

    /// @dev The first claim after the clock settles emits `AuctionSettled`, unless `emitSettlement` already has.
    function _emitClockSettlementIfDue(AuctionConfig memory config) private {
        if (_outcome == Outcome.None && settledAt == 0) _emitClockSettlement(config);
    }

    function _emitClockSettlement(AuctionConfig memory config) private {
        // Safe: initialize caps fulfillmentEnd at type(uint40).max.
        // forge-lint: disable-next-line(unsafe-typecast)
        _emitSettlement(uint40(config.fulfillmentEnd), config.price);
    }

    /// @dev `settledAt` doubles as the once-only flag for the event.
    function _emitSettlement(uint40 at, uint256 price) private {
        settledAt = at;
        Settlement memory s = _calculateSettlement(price);
        emit AuctionSettled(at, totalDeposits, s.filledBids, s.userFill, s.userRefund, s.funderRefund);
    }

    function _phase(AuctionConfig memory config) private view returns (Phase) {
        if (_outcome == Outcome.Settled) return Phase.Settlement;
        if (_outcome == Outcome.Cancelled) return Phase.Cancelled;
        if (block.timestamp < config.depositStart) return Phase.Scheduled;
        if (block.timestamp < config.depositEnd) return Phase.Deposit;
        if (block.timestamp < config.fulfillmentEnd) return Phase.Fulfillment;
        return Phase.Settlement;
    }

    function _withdrawableExcess(AuctionConfig memory config) private view returns (uint256) {
        if (paused || _phase(config) != Phase.Fulfillment) return 0;
        uint256 required = _requiredFunding(totalDeposits, config.price);
        return funding > required ? funding - required : 0;
    }

    function _settlement(uint256 price) private view returns (Settlement memory) {
        if (_outcome == Outcome.Cancelled) return Settlement(0, 0, totalDeposits, funding);
        return _calculateSettlement(price);
    }

    function _claimable(
        address account,
        AuctionConfig memory config
    ) private view returns (UserClaim memory userClaim) {
        if (!_isFinal(config) || claimed[account] || totalDeposits == 0) return userClaim;
        Settlement memory s = _settlement(config.price);
        uint256 amount = deposits[account];
        // Independent, rounded-down shares, so claim order doesn't matter. The dust stays put.
        userClaim.fill = amount.mulDivRound(s.userFill, totalDeposits, false);
        userClaim.refund = amount.mulDivRound(s.userRefund, totalDeposits, false);
    }

    function _treasuryClaimable(AuctionConfig memory config) private view returns (TreasuryClaim memory treasuryClaim) {
        if (!_isFinal(config) || treasuryClaimed) return treasuryClaim;
        Settlement memory s = _settlement(config.price);
        treasuryClaim.proceeds = s.filledBids;
        treasuryClaim.funderRefund = s.funderRefund;
    }

    /// @dev Reads only totalDeposits and funding as state, which stop changing once the phase is final.
    function _calculateSettlement(uint256 price) private view returns (Settlement memory) {
        uint256 denominator = priceDenominator;
        // The fill tokens bought round down, so bidders never get more than the funding covers.
        uint256 filled = funding >= _requiredFunding(totalDeposits, price)
            ? totalDeposits
            : funding.mulDivRound(denominator, price, false);
        uint256 userFill = filled.mulDivRound(price, denominator, false);
        // Charge the rounded-up cost of userFill and refund the rest, so a zero userFill takes no bid tokens.
        filled = userFill.mulDivRound(denominator, price, true);
        return Settlement(filled, userFill, totalDeposits - filled, funding - userFill);
    }

    function _requireFinal(AuctionConfig memory config) private view {
        if (!_isFinal(config)) revert InvalidPhase(Phase.Settlement, _phase(config));
    }

    function _isFinal(AuctionConfig memory config) private view returns (bool) {
        Phase current = _phase(config);
        return current == Phase.Settlement || current == Phase.Cancelled;
    }

    /// @dev Round up, so a fully funded auction always covers the fixed price.
    function _requiredFunding(uint256 amount, uint256 price) private view returns (uint256) {
        return amount.mulDivRound(price, priceDenominator, true);
    }

    function _requirePhase(AuctionConfig memory config, Phase expected) private view {
        Phase current = _phase(config);
        if (current != expected) revert InvalidPhase(expected, current);
    }

    /// @dev Reverts unless `list` answers `isFlagged` with a bool, which rejects an address with no code, a precompile
    /// and most wrong contracts. A proxy or a delegated account still passes.
    function _requireComplianceCheck(address list) private view {
        (bool ok, bytes memory data) = list.staticcall(abi.encodeCall(IComplianceCheck.isFlagged, (address(0))));
        if (!ok || data.length != 32 || abi.decode(data, (uint256)) > 1) revert CommonEventsAndErrors.InvalidAddress();
    }

    function _isFlagged(address account) private view returns (bool) {
        return !complianceDisabled && IComplianceCheck(complianceCheck).isFlagged(account);
    }

    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    function _requireNotPaused() private view {
        if (paused) revert IsPaused();
    }

    function _requireClaimNotPaused(AuctionConfig memory config) private view {
        if (paused && block.timestamp <= config.fulfillmentEnd + CLAIM_PAUSE_EXPIRY) revert IsPaused();
    }

    modifier notFlagged() {
        _requireNotFlagged();
        _;
    }

    function _requireNotFlagged() private view {
        if (_isFlagged(msg.sender)) revert FlaggedAccount(msg.sender);
    }

    /// @dev The executor or an active flagger.
    function _onlyExclusionAdmin() private view {
        if (!_isElevatedAccess(msg.sender) && !_isActiveFlagger(msg.sender)) {
            revert CommonEventsAndErrors.InvalidAccess();
        }
    }

    /// @dev A flagger on the current list, outside rescue mode, while compliance is enabled.
    /// ComplianceCheck has no rescue mode, so the lockout lives here.
    function _isActiveFlagger(address caller) private view returns (bool) {
        return !inRescueMode && !complianceDisabled && IComplianceCheck(complianceCheck).isFlagger(caller);
    }

    function _onlyExecutorOrRescuerInRescueMode() private view {
        if (msg.sender != (inRescueMode ? rescuer : executor)) revert CommonEventsAndErrors.InvalidAccess();
    }

    function _onlyFunder(address funder) private view {
        if (msg.sender != funder) revert CommonEventsAndErrors.InvalidAccess();
    }
}
