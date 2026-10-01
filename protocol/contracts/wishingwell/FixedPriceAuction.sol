// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;
// (contracts/wishingwell/FixedPriceAuction.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IFixedPriceAuction, IAuctionTokenRegistry, IComplianceCheck } from "contracts/interfaces/wishingwell/IFixedPriceAuction.sol";

import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

contract FixedPriceAuction is IFixedPriceAuction, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    using TempleMath for uint256;

    /// @inheritdoc IFixedPriceAuction
    uint64 public constant override MIN_NOTICE = 1 hours;
    /// @inheritdoc IFixedPriceAuction
    uint64 public constant override MAX_DURATION = 30 days;
    /// @inheritdoc IFixedPriceAuction
    uint64 public constant override FROZEN_ACTION_DELAY = 7 days;
    /// @inheritdoc IFixedPriceAuction
    uint256 public constant override EMERGENCY_PAUSE_DURATION = 14 days;

    /// @inheritdoc IFixedPriceAuction
    uint8 public immutable bidDecimals;
    /// @inheritdoc IFixedPriceAuction
    uint8 public immutable override fillDecimals;

    AuctionConfig private _config;
    uint64 private _depositEnd;
    Phase private _finalOutcome;
    SettlementPreview private _settlement;
    uint256 private immutable _priceDenominator;

    /// @inheritdoc IFixedPriceAuction
    mapping(address => uint256) public override deposits;
    /// @inheritdoc IFixedPriceAuction
    mapping(address => bool) public override claimed;
    /// @inheritdoc IFixedPriceAuction
    mapping(address => bool) public override excluded;
    /// @inheritdoc IFixedPriceAuction
    mapping(address => uint256) public override frozenBid;
    /// @inheritdoc IFixedPriceAuction
    mapping(address => uint256) public override frozenFill;
    mapping(address => ReleaseProposal) private _releases;

    /// @inheritdoc IFixedPriceAuction
    bool public override treasuryClaimed;
    /// @inheritdoc IFixedPriceAuction
    uint256 public override totalDeposits;

    /// @inheritdoc IFixedPriceAuction
    address public override complianceCheck;
    /// @inheritdoc IFixedPriceAuction
    uint256 public override maxTotalDeposits;
    /// @inheritdoc IFixedPriceAuction
    bool public override depositsPaused;

    uint256 private _bidLiability;
    uint256 private _fillLiability;
    uint256 public unclaimedBidders;
    uint256 private _userBidBudget;
    uint256 private _userFillBudget;

    bool public override emergencyPauseUsed;
    uint64 public override emergencyPausedUntil;
    
    constructor(
        AuctionConfig memory config_,
        address executor_,
        address rescuer_
    ) TempleElevatedAccess(rescuer_, executor_) {
        /// An alternative to this approach would be using Initializable and calling contract.initialize(), but that adds
        /// extra complexity for this single instance design
        /// Assumes bidToken and fillToken are approved ERC20s with exact transfers: no taxes,
        /// fee-on-transfer behavior, rebasing or callbacks, and no holder blacklisting/freezing
        if (
            config_.bidToken.code.length == 0 || config_.fillToken.code.length == 0
                || config_.bidToken == config_.fillToken || config_.funder == address(0)
                || config_.proceedsRecipient == address(0)
                || config_.frozenFundsReceiver == address(this) || config_.price == 0
                || config_.depositStart < block.timestamp || config_.depositDuration == 0
                || config_.depositDuration > MAX_DURATION || config_.fulfillmentDuration == 0
                || config_.fulfillmentDuration > MAX_DURATION || config_.noticePeriod < MIN_NOTICE
                || config_.noticePeriod > config_.depositDuration
                || config_.tokenRegistry.code.length == 0
                || (config_.complianceCheck != address(0) && config_.complianceCheck.code.length == 0)
        ) { revert InvalidConfig(); }

        _requireSupported(config_.tokenRegistry, config_.bidToken);
        _requireSupported(config_.tokenRegistry, config_.fillToken);

        uint8 bd = IERC20Metadata(config_.bidToken).decimals();
        uint8 fd = IERC20Metadata(config_.fillToken).decimals();
        bidDecimals = bd;
        fillDecimals = fd;
        if (bd > 18 || fd > 18) {
            revert InvalidConfig();
        }
        _priceDenominator = 10 ** (uint256(18) + bd - fd);
        uint256 end = uint256(config_.depositStart) + config_.depositDuration;
        _config = config_;
        _depositEnd = uint64(end);

        complianceCheck = config_.complianceCheck;
        maxTotalDeposits = config_.maxTotalDeposits;
        emit AuctionConfigured(config_, bd, fd);
    }

    /// @inheritdoc IFixedPriceAuction
    function endDeposit() external override onlyElevatedAccess {
        // Cannot extend the window. Early closure remains blocked while paused.
        _requireUnpaused();
        _requirePhase(Phase.Deposit);

        uint256 newEndTime = block.timestamp + _config.noticePeriod;
        if (newEndTime >= getTiming().effectiveDepositEnd) { revert NoEarlierEnd(); }
        _depositEnd = uint64(newEndTime);
        AuctionTiming memory timing = getTiming();

        emit DepositEndScheduled(msg.sender, timing.effectiveDepositEnd, timing.fulfillmentEnd);
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
    function finalize() external override {
        _ensureFinalized();
    }

    /// @inheritdoc IFixedPriceAuction
    function phase() public view override returns (Phase) {
        if (_finalOutcome == Phase.Settled || _finalOutcome == Phase.Cancelled) { return _finalOutcome; }
        AuctionTiming memory t = getTiming();
        if (block.timestamp < t.depositStart) { return Phase.Scheduled; }
        if (block.timestamp < t.effectiveDepositEnd) { return Phase.Deposit; }
        if (block.timestamp < t.fulfillmentEnd) { return Phase.Fulfillment; }

        return Phase.Settled;
    }

    /// @inheritdoc IFixedPriceAuction
    function getConfig() external view override returns (AuctionConfig memory) {
        return _config;
    }

    /// @inheritdoc IFixedPriceAuction
    function deposit(uint256 amount) external override {
        _deposit(amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external override {
        // FPA-7/11/12/46: do not invoke permit during either pause or an invalid phase.
        _checkDepositEntry();

        try IERC20Permit(_config.bidToken).permit(msg.sender, address(this), amount, deadline, v, r, s) {
            // Permit succeeded and allowance is set.
        } catch {
            // Permit may already have been submitted; rely on allowance
        }
        _deposit(amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawDeposit(uint256 amount) external override {
        // Withdrawal is never screened, but excluded funds have already been frozen.
        _requireUnpaused();
        _requirePhase(Phase.Deposit);
        if (excluded[msg.sender]) { revert BidderIsExcluded(msg.sender); }

        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (amount > deposits[msg.sender]) { revert InsufficientDeposit(); }

        uint256 remainder = deposits[msg.sender] - amount;
        _checkMinimum(remainder);
        deposits[msg.sender] = remainder;
        totalDeposits -= amount;
        if (remainder == 0) { --unclaimedBidders; }
        _account(0, amount, 0, 0);

        IERC20(_config.bidToken).safeTransfer(msg.sender, amount);

        emit DepositWithdrawn(msg.sender, amount, remainder, totalDeposits);
    }

    /// @inheritdoc IFixedPriceAuction
    function fund(uint256 amount) external override onlyFunder {
        // Funding starts only after deposits close.
        _requireUnpaused();
        _requirePhase(Phase.Fulfillment);

        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        IERC20(_config.fillToken).safeTransferFrom(msg.sender, address(this), amount);
        _account(0, 0, amount, 0);

        emit Funded(msg.sender, amount, remainingFunding());
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawExcess(uint256 amount) external override onlyFunder {
        // Committed funds can only be recovered by cancelling the entire auction.
        _requireUnpaused();
        _requirePhase(Phase.Fulfillment);
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        uint256 available = withdrawableExcess();
        if (amount > available) { revert ExcessExceeded(amount, available); }

        _account(0, 0, 0, amount);
        IERC20(_config.fillToken).safeTransfer(_config.funder, amount);

        emit ExcessWithdrawn(msg.sender, amount, remainingFunding());
    }

    /// @inheritdoc IFixedPriceAuction
    function claim() external override {
        // FPA-21–24/28/33: Freeze, rather than pay, a flagged account's immutable entitlement.
        _requireUnpaused();
        _ensureFinalized();

        if (excluded[msg.sender]) { revert BidderIsExcluded(msg.sender); }
        if (claimed[msg.sender]) { revert AlreadyClaimed(); }
        if (deposits[msg.sender] == 0) { revert NothingToClaim(); }

        UserClaim memory userClaim = claimable(msg.sender);
        bool blocked = _isBlocked(msg.sender);
        claimed[msg.sender] = true;
        --unclaimedBidders;
        _userBidBudget -= userClaim.bidTokenRefund;
        _userFillBudget -= userClaim.fillTokenAmount;
        if (blocked) {
            frozenBid[msg.sender] += userClaim.bidTokenRefund;
            frozenFill[msg.sender] += userClaim.fillTokenAmount;
            // Total liabilities stay unchanged
        } else {
            _account(0, userClaim.bidTokenRefund, 0, userClaim.fillTokenAmount);
        }
        _releaseDust();
        if (blocked) {
            emit ClaimFrozen(msg.sender, userClaim.fillTokenAmount, userClaim.bidTokenRefund);
        } else {
            if (userClaim.bidTokenRefund > 0) {
                IERC20(_config.bidToken).safeTransfer(msg.sender, userClaim.bidTokenRefund);
            }
            if (userClaim.fillTokenAmount > 0) {
                IERC20(_config.fillToken).safeTransfer(msg.sender, userClaim.fillTokenAmount);
            }
            
            emit UserClaimed(msg.sender, userClaim.fillTokenAmount, userClaim.bidTokenRefund);
        }
    }

    /// @inheritdoc IFixedPriceAuction
    function claimTreasury() external override {
        // Immutable, separate destinations. Calling is permissionless.
        _requireUnpaused();
        _ensureFinalized();

        if (treasuryClaimed) { revert AlreadyClaimed(); }

        TreasuryClaim memory treasuryClaim = treasuryClaimable();
        treasuryClaimed = true;
        _account(0, treasuryClaim.bidTokenAmount, 0, treasuryClaim.fillTokenRefund);

        if (treasuryClaim.bidTokenAmount > 0) {
            IERC20(_config.bidToken).safeTransfer(_config.proceedsRecipient, treasuryClaim.bidTokenAmount);
        }

        if (treasuryClaim.fillTokenRefund > 0) {
            IERC20(_config.fillToken).safeTransfer(_config.funder, treasuryClaim.fillTokenRefund);
        }

        emit TreasuryClaimed(msg.sender, _config.proceedsRecipient, _config.funder, treasuryClaim.bidTokenAmount, treasuryClaim.fillTokenRefund);
    }

    /// @inheritdoc IFixedPriceAuction
    function excludeBidder(address account) external override onlyElevatedAccess {
        // Only a source-flagged account, before any settlement, can leave the denominator.
        Phase current = phase();

        if (current != Phase.Deposit && current != Phase.Fulfillment) { revert InvalidPhase(Phase.Deposit, current); }
        if (excluded[account]) { revert BidderIsExcluded(account); }
        if (!_isBlocked(account)) { revert AccountNotBlocked(); }

        uint256 amount = deposits[account];
        if (amount == 0) { revert NothingToClaim(); }

        excluded[account] = true;
        deposits[account] = 0;
        totalDeposits -= amount;
        --unclaimedBidders;
        frozenBid[account] += amount;

        emit BidderExcluded(account, amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function proposeRelease(address account, address to) external override onlyElevatedAccess {
        // FPA-34/D36: zero escrow never authorizes a zero-address release.
        if (to == address(0) || (to != account && to != _config.frozenFundsReceiver)) { revert InvalidReleaseRecipient(); }
        if (frozenBid[account] == 0 && frozenFill[account] == 0) { revert NothingToClaim(); }

        uint256 executableAt = block.timestamp + FROZEN_ACTION_DELAY;
        if (executableAt > type(uint64).max) { revert InvalidConfig(); }
        _releases[account] = ReleaseProposal(to, uint64(executableAt));

        emit ReleaseProposed(account, to, uint64(executableAt));
    }

    /// @inheritdoc IFixedPriceAuction
    function executeRelease(address account) external override onlyElevatedAccess {
        _requireUnpaused();

        ReleaseProposal memory releaseProposal_ = _releases[account];
        if (releaseProposal_.to == address(0)) { revert NoReleaseProposal(); }
        if (block.timestamp < releaseProposal_.executableAt) { revert ReleaseNotReady(); }

        uint256 bid = frozenBid[account];
        uint256 fill = frozenFill[account];
        delete _releases[account];
        delete frozenBid[account];
        delete frozenFill[account];
        _account(0, bid, 0, fill);

        if (bid > 0) { IERC20(_config.bidToken).safeTransfer(releaseProposal_.to, bid); }
        if (fill > 0) { IERC20(_config.fillToken).safeTransfer(releaseProposal_.to, fill); }

        emit FrozenReleased(account, releaseProposal_.to, bid, fill);
    }

    /// @inheritdoc IFixedPriceAuction
    function vetoRelease(address account) external override onlyRescuer {
        if (_releases[account].to == address(0)) { revert NoReleaseProposal(); }
        delete _releases[account];

        emit ReleaseVetoed(account);
    }

    /// @inheritdoc IFixedPriceAuction
    function releaseProposal(address account) external view override returns (ReleaseProposal memory) {
        return _releases[account];
    }

    /// @inheritdoc IFixedPriceAuction
    function disableComplianceCheck() external override onlyElevatedAccess {
        // FPA-31: There is deliberately no setter to restore or replace the source.
        complianceCheck = address(0);

        emit ComplianceCheckDisabled();
    }

    /// @inheritdoc IFixedPriceAuction
    function setDepositsPaused(bool paused) external override onlyElevatedAccess {
        // FPA-12: deposit-only pause leaves the schedule and every other operation unchanged.
        depositsPaused = paused;

        emit DepositsPaused(paused);
    }

     /// @inheritdoc IFixedPriceAuction
    function setMaxTotalDeposits(uint256 newCap) external override onlyElevatedAccess {
        // FPA-9a: Zero is unlimited, not a cap.
        Phase current = phase();
        if (current == Phase.Settled || current == Phase.Cancelled) { revert InvalidPhase(Phase.Deposit, current); }
        if (newCap != 0 && (maxTotalDeposits == 0 || newCap < maxTotalDeposits)) { revert CannotLowerCap(); }
        maxTotalDeposits = newCap;

        emit MaxTotalDepositsSet(newCap);
    }

    /// @inheritdoc IFixedPriceAuction
    function recoverToken(address token, address to, uint256 amount) external override onlyElevatedAccess {
        // FPA-40: All phases, but never frozen/unclaimed liabilities or emergency-paused movements.
        _requireUnpaused();
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        uint256 reserved = token == _config.bidToken ? _bidLiability : token == _config.fillToken ? _fillLiability : 0;
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < reserved || amount > balance - reserved) { revert InsufficientRecoverableBalance(); }

        if (amount > 0) { IERC20(token).safeTransfer(to, amount); }

        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
    }

    /// @inheritdoc IFixedPriceAuction
    function emergencyPause() external override onlyRescuer {
        // FPA-43/44/45/48: Bound the freeze even if the rescuer becomes unavailable.
        if (emergencyPauseUsed) { revert EmergencyPauseAlreadyUsed(); }

        uint256 until = block.timestamp + EMERGENCY_PAUSE_DURATION;
        if (until > type(uint64).max) revert InvalidConfig();

        emergencyPauseUsed = true;
        emergencyPausedUntil = uint64(until);
        emit EmergencyPaused(emergencyPausedUntil);
    }

    /// @inheritdoc IFixedPriceAuction
    function emergencyUnpause() external override onlyRescuer {
        // FPA-44: Early unpause restores transfers without resetting the one-use limit.
        if (!emergencyPaused()) { revert NotEmergencyPaused(); }
        emergencyPausedUntil = uint64(block.timestamp);
        emit EmergencyUnpaused();
    }

    /// @inheritdoc IFixedPriceAuction
    function remainingFunding() public view override returns (uint256) {
        return _fillLiability;
    }

    /// @inheritdoc IFixedPriceAuction
    function liabilities() external view override returns (uint256 bid, uint256 fill) {
        return (_bidLiability, _fillLiability);
    }

    /// @inheritdoc IFixedPriceAuction
    function fullFundingRequired() public view override returns (uint256) {
        return _requiredFunding(totalDeposits);
    }

    /// @inheritdoc IFixedPriceAuction
    function withdrawableExcess() public view override returns (uint256) {
        if (phase() != Phase.Fulfillment) { return 0; }

        uint256 required = fullFundingRequired();
        return _fillLiability > required ? _fillLiability - required : 0;
    }

    /// @inheritdoc IFixedPriceAuction
    function previewSettlement() public view override returns (SettlementPreview memory) {
        if (_finalOutcome == Phase.Settled || _finalOutcome == Phase.Cancelled) { return _settlement; }

        return _calculateSettlement();
    }

    /// @inheritdoc IFixedPriceAuction
    function emergencyPaused() public view override returns (bool) {
        // Lift the emergency pause without a transaction.
        return block.timestamp < emergencyPausedUntil;
    }

    /// @inheritdoc IFixedPriceAuction
    function claimable(address account) public view override returns (UserClaim memory userClaim) {
        Phase current = phase();
        if ((current != Phase.Settled && current != Phase.Cancelled) || claimed[account] || excluded[account]) { return userClaim; }
        if (current == Phase.Cancelled) {
            userClaim.bidTokenRefund = deposits[account];
        } else if (totalDeposits != 0) {
            SettlementPreview memory preview = previewSettlement();
            // FPA-22/30/39: independent downward-rounded allocations. Claim order does not matter.
            userClaim.fillTokenAmount = deposits[account].mulDivRound(preview.userFunding, totalDeposits, false);
            userClaim.bidTokenRefund = deposits[account].mulDivRound(preview.userRefund, totalDeposits, false);
        }
    }

    /// @inheritdoc IFixedPriceAuction
    function treasuryClaimable() public view override returns (TreasuryClaim memory tsryClaim) {
        Phase current = phase();
        if ((current != Phase.Settled && current != Phase.Cancelled) || treasuryClaimed) { return tsryClaim; }
        SettlementPreview memory preview = previewSettlement();
        tsryClaim.bidTokenAmount = preview.filledDeposits;
        tsryClaim.fillTokenRefund = preview.funderRefund;
    }

    /// @inheritdoc IFixedPriceAuction
    function getTiming() public view override returns (AuctionTiming memory timing) {
        // FPA-45: Emmergency pauses stop transfers not the auction clock.
        // An incident should be investigated/aborted rather than extending the trading windows.
        timing.depositStart = _config.depositStart;
        timing.scheduledDepositEnd = _config.depositStart + _config.depositDuration;
        timing.effectiveDepositEnd = _depositEnd;
        timing.fulfillmentStart = _depositEnd;
        timing.fulfillmentEnd = _depositEnd + _config.fulfillmentDuration;
    }

    function _calculateSettlement() private view returns (SettlementPreview memory preview) {
        // FPA-18–20/22/26/30: zero deposits/funding, partial, full and overfunded outcomes.
        uint256 required = fullFundingRequired();
        uint256 filled =
            _fillLiability >= required ? totalDeposits : _fillLiability.mulDivRound(_priceDenominator, _config.price, false);
        uint256 userFunding = filled.mulDivRound(_config.price, _priceDenominator, false);
        if (userFunding == 0) { filled = 0; }
        preview = SettlementPreview(totalDeposits, filled, userFunding, totalDeposits - filled, _fillLiability - userFunding);
    }

    function _settle(bool early) private {
        // FPA-21: snapshot before any claims, regardless of which entry point finalizes.
        _settlement = _calculateSettlement();
        _finalOutcome = Phase.Settled;
        _userBidBudget = _settlement.userRefund;
        _userFillBudget = _settlement.userFunding;

        _releaseDust();
        SettlementPreview memory preview = _settlement;
        emit AuctionSettled(
            msg.sender, early, preview.totalDeposits, preview.filledDeposits,
            preview.userFunding, preview.userRefund, preview.funderRefund
        );
    }

    function _cancel(Phase previousPhase) private {
        // FPA-46: deliberately callable while paused, because cancellation moves no tokens.
        // It records an abort only; refund/claim transfers stay blocked until early unpause or expiry.
        // Deadlines continue running. Once Settled (even lazily), cancellation remains forbidden.
        // FPA-27–29: no trade, frozen exclusions stay frozen and are not reintroduced into D.
        _settlement = SettlementPreview(totalDeposits, 0, 0, totalDeposits, _fillLiability);
        _finalOutcome = Phase.Cancelled;
        _userBidBudget = totalDeposits;
        _userFillBudget = 0;

        _releaseDust();

        emit AuctionCancelled(msg.sender, previousPhase, totalDeposits, _settlement.funderRefund);
    }

    function _ensureFinalized() private {
        Phase current = phase();
        if (current == Phase.Cancelled) { return; }
        if (current != Phase.Settled) { revert InvalidPhase(Phase.Settled, current); }
        if (_finalOutcome != Phase.Settled) { _settle(false); }
    }

    function _requiredFunding(uint256 amount) private view returns (uint256) {
        // FPA-4/30: round up to fully cover the fixed price. Unused funding returns to the funder.
        return amount.mulDivRound(_config.price, _priceDenominator, true);
    }

    function _account(uint256 bidIn, uint256 bidOut, uint256 fillIn, uint256 fillOut) private {
        // FPA-38a: Sole writer of total liabilities
        _bidLiability = _bidLiability + bidIn - bidOut;
        _fillLiability = _fillLiability + fillIn - fillOut;
    }

    function _releaseDust() private {
        // FPA-38a/40: Only final claimant releases budget rounding residues, not frozen balances.
        if (unclaimedBidders == 0) {
            _account(0, _userBidBudget, 0, _userFillBudget);
            _userBidBudget = 0;
            _userFillBudget = 0;
        }
    }

    function _requireUnpaused() private view {
        if (emergencyPaused()) { revert EmergencyPauseActive(); }
    }

    function _requirePhase(Phase expected) private view {
        Phase actual = phase();
        if (actual != expected) { revert InvalidPhase(expected, actual); }
    }

    function _checkMinimum(uint256 amount) private view {
        if (amount != 0 && amount < _config.minDeposit) { revert DepositBelowMinimum(); }
    }

    function _isBlocked(address account) private view returns (bool) {
        return complianceCheck != address(0) && IComplianceCheck(complianceCheck).isBlocked(account);
    }

    function _requireSupported(address registry, address token) private view {
        if (!IAuctionTokenRegistry(registry).isSupported(token)) { revert InvalidConfig(); }
    }

    function _deposit(uint256 amount) private {
        _checkDepositEntry();
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        _checkMinimum(deposits[msg.sender] + amount);
        if (maxTotalDeposits != 0 && totalDeposits + amount > maxTotalDeposits) { revert DepositCapExceeded(); }

        _requiredFunding(totalDeposits + amount);
        IERC20(_config.bidToken).safeTransferFrom(msg.sender, address(this), amount);

        if (deposits[msg.sender] == 0) { ++unclaimedBidders; }
        deposits[msg.sender] += amount;
        totalDeposits += amount;
        _account(amount, 0, 0, 0);

        emit Deposited(msg.sender, amount, deposits[msg.sender], totalDeposits);
    }

    function _checkDepositEntry() private view {
        _requireUnpaused();
        _requirePhase(Phase.Deposit);

        if (depositsPaused) { revert DepositsArePaused(); }
        if (excluded[msg.sender]) { revert BidderIsExcluded(msg.sender); }
        if (_isBlocked(msg.sender)) { revert BlockedAccount(msg.sender); }
    }

    // FPA-34/43/44/48: rescuer-only actions do not require rescue mode.
    modifier onlyRescuer() {
        if (msg.sender != rescuer) { revert OnlyRescuer(); }
        _;
    }

    // FPA-36: funding authority is distinct from elevated lifecycle/compliance authority.
    modifier onlyFunder() {
        if (msg.sender != _config.funder) { revert OnlyFunder(); }
        _;
    }
}