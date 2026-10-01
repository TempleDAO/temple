pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/wishingwell/FixedPriceAuction.t.sol)

// Tests for FixedPriceAuction as implemented in PR #1305.
// Two tests are regressions for review comments and fail until those fixes are applied:
//   - test_deposit_reentrantDepositKeepsTotalConsistent  (comment 1: reentrancy / stale total)
//   - test_deposit_feeOnTransferReverts, test_fund_feeOnTransferReverts  (comment 2: received-amount check)

import { IFixedPriceAuction } from "contracts/interfaces/wishingwell/IFixedPriceAuction.sol";

import { TempleTest } from "test/forge/unit/TempleTest.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";

import { FixedPriceAuction } from "contracts/wishingwell/FixedPriceAuction.sol";

/// @notice Takes a 1% fee on every transfer between two nonzero addresses.
contract FeeOnTransferToken is FakeERC20 {
    constructor() FakeERC20("Fee Token", "FEE", address(0), 0) {}

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = value / 100;
        super._update(from, address(0xdead), fee);
        super._update(from, to, value - fee);
    }
}

/// @notice Calls back into the sender during transferFrom (ERC-777 tokensToSend style).
contract HookToken is FakeERC20 {
    constructor() FakeERC20("Hook Token", "HOOK", address(0), 0) {}

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && from != msg.sender && from.code.length > 0) {
            ReentrantDepositor(from).onTransfer();
        }
        super._update(from, to, value);
    }
}

/// @notice Deposits again from inside the token's transfer hook.
contract ReentrantDepositor {
    FixedPriceAuction internal immutable auction;
    uint256 internal pending;

    constructor(FixedPriceAuction auction_, FakeERC20 token) {
        auction = auction_;
        token.approve(address(auction_), type(uint256).max);
    }

    function attack(uint256 first, uint256 second) external {
        pending = second;
        auction.deposit(first);
    }

    function onTransfer() external {
        uint256 amount = pending;
        if (amount > 0) {
            pending = 0;
            auction.deposit(amount);
        }
    }
}

contract FixedPriceAuctionTestBase is TempleTest {
    address internal treasury = makeAddr("treasury");
    address internal carl = makeAddr("carl");

    // RFC-011 example price: 0.028 USDS per TGLD (both 18 decimals)
    uint256 internal constant PRICE_NUMERATOR = 28;
    uint256 internal constant PRICE_DENOMINATOR = 1000;
    uint64 internal constant DEPOSIT_DURATION = 5 days;
    uint64 internal constant FULFILLMENT_DURATION = 5 days;

    FakeERC20 internal TGLD;
    FakeERC20 internal USDS;
    FixedPriceAuction internal auction;
    uint64 internal depositStart;

    function setUp() public {
        vm.warp(1000);
        TGLD = new FakeERC20("Temple Gold", "TGLD", address(0), 0);
        USDS = new FakeERC20("USDS", "USDS", address(0), 0);
        depositStart = uint64(block.timestamp + 1 days);
        auction = _deploy(address(TGLD), address(USDS), PRICE_NUMERATOR, PRICE_DENOMINATOR);
    }

    function _config(
        address depositToken,
        address fundingToken,
        uint256 numerator,
        uint256 denominator
    ) internal view returns (IFixedPriceAuction.AuctionConfig memory) {
        return IFixedPriceAuction.AuctionConfig(
            depositToken,
            fundingToken,
            treasury,
            numerator,
            denominator,
            depositStart,
            DEPOSIT_DURATION,
            FULFILLMENT_DURATION
        );
    }

    function _deploy(
        address depositToken,
        address fundingToken,
        uint256 numerator,
        uint256 denominator
    ) internal returns (FixedPriceAuction) {
        return new FixedPriceAuction(_config(depositToken, fundingToken, numerator, denominator), executor, rescuer);
    }

    function _toDeposit() internal {
        vm.warp(depositStart);
    }

    function _toFulfillment() internal {
        vm.warp(depositStart + DEPOSIT_DURATION);
    }

    function _toSettled() internal {
        vm.warp(depositStart + DEPOSIT_DURATION + FULFILLMENT_DURATION);
    }

    function _deposit(FixedPriceAuction auction_, address user, uint256 amount) internal {
        FakeERC20 token = FakeERC20(auction_.getConfig().depositToken);
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(auction_), amount);
        auction_.deposit(amount);
        vm.stopPrank();
    }

    function _fund(FixedPriceAuction auction_, uint256 amount) internal {
        FakeERC20 token = FakeERC20(auction_.getConfig().fundingToken);
        token.mint(treasury, amount);
        vm.startPrank(treasury);
        token.approve(address(auction_), amount);
        auction_.fund(amount);
        vm.stopPrank();
    }

    function _expectPhase(IFixedPriceAuction.Phase expected, IFixedPriceAuction.Phase actual) internal {
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidPhase.selector, expected, actual));
    }

    function _assertPhase(IFixedPriceAuction.Phase expected) internal view {
        assertEq(uint8(auction.phase()), uint8(expected));
    }
}

contract FixedPriceAuctionTestAccess is FixedPriceAuctionTestBase {
    function test_access_elevated() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.cancelScheduled();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.cancelDeposit();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.endDeposit();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.cancelFulfillment();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.endFulfillment();
        vm.stopPrank();
    }

    function test_access_treasury() public {
        _toFulfillment();
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.OnlyTreasury.selector));
        auction.fund(1);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.OnlyTreasury.selector));
        auction.withdrawExcess(1);
        vm.stopPrank();
    }
}

contract FixedPriceAuctionTestConfig is FixedPriceAuctionTestBase {
    function test_constructor_storesImmutableConfig() public view {
        IFixedPriceAuction.AuctionConfig memory config = auction.getConfig();
        assertEq(config.depositToken, address(TGLD));
        assertEq(config.fundingToken, address(USDS));
        assertEq(config.treasury, treasury);
        assertEq(config.priceNumerator, PRICE_NUMERATOR);
        assertEq(config.priceDenominator, PRICE_DENOMINATOR);
        assertEq(auction.executor(), executor);
        assertEq(auction.rescuer(), rescuer);
        _assertPhase(IFixedPriceAuction.Phase.Scheduled);
    }

    function test_constructor_invalidConfig() public {
        IFixedPriceAuction.AuctionConfig memory config = _config(address(TGLD), address(TGLD), 28, 1000);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(config, executor, rescuer);

        config = _config(address(TGLD), address(USDS), 0, 1000);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(config, executor, rescuer);

        config = _config(address(TGLD), address(USDS), 28, 0);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(config, executor, rescuer);

        config = _config(address(TGLD), address(USDS), 28, 1000);
        config.depositStart = uint64(block.timestamp - 1);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(config, executor, rescuer);

        config = _config(address(TGLD), address(USDS), 28, 1000);
        config.treasury = address(0);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(config, executor, rescuer);

        config = _config(address(TGLD), address(USDS), 28, 1000);
        config.depositDuration = 0;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(config, executor, rescuer);
    }
}

contract FixedPriceAuctionTestDeposit is FixedPriceAuctionTestBase {
    function test_deposit_addAndWithdraw() public {
        _toDeposit();
        _deposit(auction, alice, 100 ether);
        _deposit(auction, alice, 50 ether);
        vm.prank(alice);
        auction.withdrawDeposit(30 ether);
        assertEq(auction.deposits(alice), 120 ether);
        assertEq(auction.totalDeposits(), 120 ether);
        assertEq(TGLD.balanceOf(alice), 30 ether);
        assertEq(TGLD.balanceOf(address(auction)), 120 ether);
    }

    function test_deposit_revertsOutsideDepositEpoch() public {
        TGLD.mint(alice, 1 ether);
        vm.startPrank(alice);
        TGLD.approve(address(auction), 1 ether);
        _expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Scheduled);
        auction.deposit(1 ether);
        vm.stopPrank();

        _toFulfillment();
        vm.startPrank(alice);
        _expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Fulfillment);
        auction.deposit(1 ether);
        vm.stopPrank();
    }

    function test_withdraw_revertsAfterDepositEpoch() public {
        _toDeposit();
        _deposit(auction, alice, 100 ether);
        _toFulfillment();
        vm.prank(alice);
        _expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Fulfillment);
        auction.withdrawDeposit(100 ether);
    }

    function test_withdraw_revertsAboveDeposit() public {
        _toDeposit();
        _deposit(auction, alice, 100 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InsufficientDeposit.selector));
        auction.withdrawDeposit(100 ether + 1);
    }

    /// @dev Review comment 1. A token that calls back during transferFrom must not let a nested deposit
    /// drop out of totalDeposits. Either the reentrant call reverts, or the totals stay consistent.
    /// Fails against the current code: the contract holds 300 while totalDeposits reads 200.
    function test_deposit_reentrantDepositKeepsTotalConsistent() public {
        HookToken hook = new HookToken();
        FixedPriceAuction hooked = _deploy(address(hook), address(USDS), PRICE_NUMERATOR, PRICE_DENOMINATOR);
        ReentrantDepositor attacker = new ReentrantDepositor(hooked, hook);
        hook.mint(address(attacker), 200 ether);
        _toDeposit();
        _deposit(hooked, alice, 100 ether);

        try attacker.attack(100 ether, 100 ether) {} catch {}

        uint256 recorded = hooked.deposits(alice) + hooked.deposits(address(attacker));
        assertEq(hooked.totalDeposits(), recorded, "totalDeposits differs from the sum of deposits");
        assertEq(hook.balanceOf(address(hooked)), recorded, "balance differs from recorded deposits");
    }

    /// @dev Review comment 2. IFixedPriceAuction documents exact balance deltas and declares
    /// UnsupportedTokenTransfer. Fails against the current code: the deposit is accepted,
    /// totalDeposits is overstated and the last claimant can't be paid.
    function test_deposit_feeOnTransferReverts() public {
        FeeOnTransferToken fee = new FeeOnTransferToken();
        FixedPriceAuction feeAuction = _deploy(address(fee), address(USDS), 28, 1000);
        _toDeposit();
        fee.mint(alice, 100 ether);
        vm.startPrank(alice);
        fee.approve(address(feeAuction), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.UnsupportedTokenTransfer.selector, address(fee)));
        feeAuction.deposit(100 ether);
        vm.stopPrank();
    }
}

contract FixedPriceAuctionTestFunding is FixedPriceAuctionTestBase {
    function test_fund_revertsOutsideFulfillment() public {
        _toDeposit();
        _deposit(auction, alice, 1000 ether);
        USDS.mint(treasury, 1 ether);
        vm.startPrank(treasury);
        USDS.approve(address(auction), 1 ether);
        _expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Deposit);
        auction.fund(1 ether);
        vm.stopPrank();
    }

    /// @dev Installments accumulate; only funding above the full requirement is withdrawable.
    function test_fund_installmentsAndExcessOnly() public {
        _toDeposit();
        _deposit(auction, alice, 1000 ether);
        _toFulfillment();
        _fund(auction, 10 ether);
        _fund(auction, 30 ether);
        assertEq(auction.fullFundingRequired(), 28 ether);
        assertEq(auction.remainingFunding(), 40 ether);
        assertEq(auction.withdrawableExcess(), 12 ether);

        vm.startPrank(treasury);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.ExcessExceeded.selector, 12 ether + 1, 12 ether));
        auction.withdrawExcess(12 ether + 1);
        auction.withdrawExcess(12 ether);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.ExcessExceeded.selector, 1, 0));
        auction.withdrawExcess(1);
        vm.stopPrank();

        assertEq(USDS.balanceOf(treasury), 12 ether);
        assertEq(auction.remainingFunding(), 28 ether);
    }

    function test_fund_underfundedHasNoExcess() public {
        _toDeposit();
        _deposit(auction, alice, 1000 ether);
        _toFulfillment();
        _fund(auction, 14 ether);
        assertEq(auction.withdrawableExcess(), 0);
        vm.prank(treasury);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.ExcessExceeded.selector, 1, 0));
        auction.withdrawExcess(1);
    }

    /// @dev Review comment 2, funding side. Fails against the current code.
    function test_fund_feeOnTransferReverts() public {
        FeeOnTransferToken fee = new FeeOnTransferToken();
        FixedPriceAuction feeAuction = _deploy(address(TGLD), address(fee), 28, 1000);
        _toDeposit();
        _deposit(feeAuction, alice, 1000 ether);
        _toFulfillment();
        fee.mint(treasury, 28 ether);
        vm.startPrank(treasury);
        fee.approve(address(feeAuction), 28 ether);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.UnsupportedTokenTransfer.selector, address(fee)));
        feeAuction.fund(28 ether);
        vm.stopPrank();
    }
}

contract FixedPriceAuctionTestLifecycle is FixedPriceAuctionTestBase {
    /// @dev Fulfillment starts at the actual deposit end and runs its full duration, with no gap.
    function test_endDeposit_startsFullFulfillmentImmediately() public {
        vm.warp(depositStart + 2 days);
        _deposit(auction, alice, 100 ether);
        uint64 t = uint64(block.timestamp);
        vm.prank(executor);
        auction.endDeposit();

        IFixedPriceAuction.AuctionTiming memory timing = auction.getTiming();
        assertEq(timing.scheduledDepositEnd, depositStart + DEPOSIT_DURATION);
        assertEq(timing.effectiveDepositEnd, t);
        assertEq(timing.fulfillmentStart, t);
        assertEq(timing.fulfillmentEnd, t + FULFILLMENT_DURATION);
        _assertPhase(IFixedPriceAuction.Phase.Fulfillment);

        vm.prank(alice);
        _expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Fulfillment);
        auction.withdrawDeposit(100 ether);

        vm.warp(t + FULFILLMENT_DURATION - 1);
        _assertPhase(IFixedPriceAuction.Phase.Fulfillment);
        vm.warp(t + FULFILLMENT_DURATION);
        _assertPhase(IFixedPriceAuction.Phase.Settled);
    }

    /// @dev Each operator action works only in its own phase.
    function test_operatorActions_phaseGating() public {
        vm.startPrank(executor);
        _expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Scheduled);
        auction.cancelDeposit();
        _expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Scheduled);
        auction.endDeposit();
        _expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Scheduled);
        auction.cancelFulfillment();
        _expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Scheduled);
        auction.endFulfillment();
        vm.stopPrank();

        _toDeposit();
        vm.startPrank(executor);
        _expectPhase(IFixedPriceAuction.Phase.Scheduled, IFixedPriceAuction.Phase.Deposit);
        auction.cancelScheduled();
        _expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Deposit);
        auction.endFulfillment();
        vm.stopPrank();
    }

    function test_cancelScheduled() public {
        vm.prank(executor);
        auction.cancelScheduled();
        _assertPhase(IFixedPriceAuction.Phase.Cancelled);
        _toDeposit();
        _assertPhase(IFixedPriceAuction.Phase.Cancelled);
    }

    function test_cancelDeposit_refundsImmediately() public {
        _toDeposit();
        _deposit(auction, alice, 100 ether);
        vm.prank(executor);
        auction.cancelDeposit();
        _assertPhase(IFixedPriceAuction.Phase.Cancelled);
        vm.prank(alice);
        auction.claim();
        assertEq(TGLD.balanceOf(alice), 100 ether);
    }

    /// @dev Abort refunds both sides even when fully funded; no trade executes.
    function test_cancelFulfillment_fullyFundedRefundsBothSides() public {
        _toDeposit();
        _deposit(auction, alice, 1000 ether);
        _toFulfillment();
        _fund(auction, 28 ether);
        vm.prank(executor);
        auction.cancelFulfillment();

        vm.prank(alice);
        auction.claim();
        auction.claimTreasury();
        assertEq(TGLD.balanceOf(alice), 1000 ether);
        assertEq(USDS.balanceOf(alice), 0);
        assertEq(USDS.balanceOf(treasury), 28 ether);
        assertEq(TGLD.balanceOf(treasury), 0);
    }

    function test_endFulfillment_settlesNowAndCannotBeAborted() public {
        _toDeposit();
        _deposit(auction, alice, 1000 ether);
        vm.prank(executor);
        auction.endDeposit();
        _fund(auction, 14 ether);

        vm.startPrank(executor);
        auction.endFulfillment();
        _expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Settled);
        auction.cancelFulfillment();
        vm.stopPrank();

        vm.prank(alice);
        auction.claim();
        assertEq(USDS.balanceOf(alice), 14 ether);
        assertEq(TGLD.balanceOf(alice), 500 ether);
    }

    /// @dev Once naturally expired, the auction cannot be aborted, even before anyone finalizes it.
    function test_cancel_revertsAfterNaturalExpiry() public {
        _toDeposit();
        _deposit(auction, alice, 1000 ether);
        _toSettled();
        vm.prank(executor);
        _expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Settled);
        auction.cancelFulfillment();
    }

    /// @dev No fund call and no operator action: expiry settles at 0% and users claim full refunds.
    function test_noFunding_expirySettlesToFullRefund() public {
        _toDeposit();
        _deposit(auction, alice, 100 ether);
        _toSettled();
        vm.prank(alice);
        auction.claim();
        assertEq(TGLD.balanceOf(alice), 100 ether);
        assertEq(USDS.balanceOf(alice), 0);
    }

    function test_claim_revertsBeforeSettlementAndTwice() public {
        _toDeposit();
        _deposit(auction, alice, 100 ether);
        _toFulfillment();
        vm.prank(alice);
        _expectPhase(IFixedPriceAuction.Phase.Settled, IFixedPriceAuction.Phase.Fulfillment);
        auction.claim();

        _toSettled();
        vm.startPrank(alice);
        auction.claim();
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.AlreadyClaimed.selector));
        auction.claim();
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.NothingToClaim.selector));
        auction.claim();

        auction.claimTreasury();
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.AlreadyClaimed.selector));
        auction.claimTreasury();
    }
}

contract FixedPriceAuctionTestSettlement is FixedPriceAuctionTestBase {
    /// @dev RFC-011: 100mm TGLD deposited at 0.028, Treasury funds 2.8mm USDS.
    function test_rfcExample_fullFill() public {
        _toDeposit();
        _deposit(auction, alice, 60_000_000 ether);
        _deposit(auction, bob, 40_000_000 ether);
        _toFulfillment();
        assertEq(auction.fullFundingRequired(), 2_800_000 ether);
        _fund(auction, 2_800_000 ether);
        _toSettled();

        vm.prank(alice);
        auction.claim();
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();

        assertEq(USDS.balanceOf(alice), 1_680_000 ether);
        assertEq(TGLD.balanceOf(alice), 0);
        assertEq(USDS.balanceOf(bob), 1_120_000 ether);
        assertEq(TGLD.balanceOf(bob), 0);
        assertEq(TGLD.balanceOf(treasury), 100_000_000 ether);
        assertEq(USDS.balanceOf(treasury), 0);
    }

    /// @dev RFC-011: same deposits, Treasury funds 1.4mm USDS (50%).
    function test_rfcExample_partialFill() public {
        _toDeposit();
        _deposit(auction, alice, 60_000_000 ether);
        _deposit(auction, bob, 40_000_000 ether);
        _toFulfillment();
        _fund(auction, 1_400_000 ether);
        _toSettled();

        vm.prank(alice);
        auction.claim();
        vm.prank(bob);
        auction.claim();
        auction.claimTreasury();

        assertEq(USDS.balanceOf(alice), 840_000 ether);
        assertEq(TGLD.balanceOf(alice), 30_000_000 ether);
        assertEq(USDS.balanceOf(bob), 560_000 ether);
        assertEq(TGLD.balanceOf(bob), 20_000_000 ether);
        assertEq(TGLD.balanceOf(treasury), 50_000_000 ether);
    }

    /// @dev Overfunding that is never withdrawn is refunded to Treasury at settlement.
    function test_overfunding_excessRefundedAtSettlement() public {
        _toDeposit();
        _deposit(auction, alice, 1000 ether);
        _toFulfillment();
        _fund(auction, 40 ether);
        _toSettled();
        vm.prank(alice);
        auction.claim();
        auction.claimTreasury();
        assertEq(USDS.balanceOf(alice), 28 ether);
        assertEq(USDS.balanceOf(treasury), 12 ether);
        assertEq(TGLD.balanceOf(treasury), 1000 ether);
    }

    /// @dev 18-decimal deposit token, 6-decimal funding token, price 0.028.
    function test_mixedDecimals_fullFill() public {
        FakeERC20CustomDecimals usd6 = new FakeERC20CustomDecimals("USD6", "USD6", address(0), 0, 6);
        FixedPriceAuction mixed = _deploy(address(TGLD), address(usd6), 28_000, 1e18);
        _toDeposit();
        _deposit(mixed, alice, 1_000 ether);
        _toFulfillment();
        assertEq(mixed.fullFundingRequired(), 28e6);
        usd6.mint(treasury, 28e6);
        vm.startPrank(treasury);
        usd6.approve(address(mixed), 28e6);
        mixed.fund(28e6);
        vm.stopPrank();
        _toSettled();
        vm.prank(alice);
        mixed.claim();
        assertEq(usd6.balanceOf(alice), 28e6);
        assertEq(TGLD.balanceOf(alice), 0);
    }
}

contract FixedPriceAuctionTestFuzz is FixedPriceAuctionTestBase {
    /// @dev Everyone can claim, and no bidder is paid above the published price.
    function testFuzz_solvencyAndPrice(
        uint96 d1,
        uint96 d2,
        uint96 d3,
        uint96 funding,
        uint32 numerator,
        uint32 denominator
    ) public {
        vm.assume(d1 > 0 && d2 > 0 && d3 > 0 && funding > 0 && numerator > 0 && denominator > 0);
        FixedPriceAuction fuzzed = _deploy(address(TGLD), address(USDS), numerator, denominator);
        _toDeposit();
        _deposit(fuzzed, alice, d1);
        _deposit(fuzzed, bob, d2);
        _deposit(fuzzed, carl, d3);
        _toFulfillment();
        _fund(fuzzed, funding);
        _toSettled();

        vm.prank(alice);
        fuzzed.claim();
        vm.prank(bob);
        fuzzed.claim();
        vm.prank(carl);
        fuzzed.claim();
        fuzzed.claimTreasury();

        uint256 paid = USDS.balanceOf(alice);
        uint256 consumed = uint256(d1) - TGLD.balanceOf(alice);
        assertLe(paid * denominator, consumed * numerator + denominator);
        assertLe(USDS.balanceOf(alice) + USDS.balanceOf(bob) + USDS.balanceOf(carl) + USDS.balanceOf(treasury), funding);
    }
}
