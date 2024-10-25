pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/admin/TeamPayments.t.sol)

import { TempleTest } from "../TempleTest.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TeamPayments } from "contracts/admin/TeamPayments.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITeamPayments } from "contracts/interfaces/admin/ITeamPayments.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";

contract TeamPaymentsTestBase is TempleTest {
    event CancelledPayment(address indexed recipient, uint256 totalClaimed, uint256 unreleased);
    event CancelledEpochPayment(address indexed recipient, uint256 epoch, uint256 amountRevoked);
    event PaymentSet(address indexed recipient, uint32 startTime, uint32 endTime, uint256 amount);
    event FundsOwnerSet(address indexed fundOwner);
    event ClaimedEpoch(address indexed recipient, uint256 epoch, uint256 amount);
    event ClaimedFixed(address indexed recipient, uint256 amount, uint256 claimed);
    event PaymentTokenSet(address token);
    event EpochAllocationSet(address indexed recipient, uint256 epoch, uint256 amount);

    FakeERC20 public paymentToken;
    FakeERC20 public fakeToken;
    TeamPayments public payment;
    address public fundsOwner = makeAddr("fundsOwner");
    address public mike = makeAddr("mike");

    function setUp() public {
        paymentToken = new FakeERC20("DAI", "Dai Token", fundsOwner, 1_000_000 ether);
        fakeToken = new FakeERC20("FAKE", "Fake Token", executor, 10_000 ether);
        payment = new TeamPayments(rescuer, executor, fundsOwner, address(paymentToken));
    }

    function test_initialization() public {
        assertEq(payment.rescuer(), rescuer);
        assertEq(payment.executor(), executor);
        assertEq(payment.fundsOwner(), fundsOwner);
        assertEq(address(payment.paymentToken()), address(paymentToken));
    }
}

contract TeampPaymentsAccessTest is TeamPaymentsTestBase {
    function test_access_setFundsOwner() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        payment.setFundsOwner(alice);
    }

    function test_access_setPaymentToken() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        payment.setPaymentToken(alice);
    }

    function test_acceess_setPayments() public {
        ITeamPayments.Payment[] memory payments = new ITeamPayments.Payment[](1);
        address[] memory recipients = new address[](1);
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        payment.setPayments(recipients, payments);
    }

    function test_access_setEpochPayments() public {
        uint256[] memory amounts = new uint256[](1);
        address[] memory recipients = new address[](1);
        uint256 epoch = 1;
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        payment.setEpochPayments(epoch, recipients, amounts);
    }

    function test_access_revokePayment() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        payment.revokePayment(alice);
    }

    function test_access_revokeEpochPayment() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        payment.revokeEpochPayment(1, alice);
    }
}

contract TeampPaymentsTest is TeamPaymentsTestBase {
    function test_setFundsOwner() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.setFundsOwner(address(0));

        vm.expectEmit(address(payment));
        emit FundsOwnerSet(bob);
        payment.setFundsOwner(bob);
        assertEq(payment.fundsOwner(), bob);

        vm.expectEmit(address(payment));
        emit FundsOwnerSet(alice);
        payment.setFundsOwner(alice);
        assertEq(payment.fundsOwner(), alice);
    }

    function test_setPaymentToken() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.setPaymentToken(address(0));

        vm.expectEmit(address(payment));
        emit PaymentTokenSet(address(fakeToken));
        payment.setPaymentToken(address(fakeToken));
        assertEq(address(payment.paymentToken()), address(fakeToken));
    }

    function test_setPayments() public {
        vm.startPrank(executor);
        ITeamPayments.Payment[] memory payments = new ITeamPayments.Payment[](1);
        address[] memory recipients = new address[](2);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        payment.setPayments(recipients, payments);
        payments[0] = ITeamPayments.Payment(
            0,
            0,
            true,
            1,
            0
        );
        recipients = new address[](1);
        // recipients[0] = alice;
        // start = 0
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.setPayments(recipients, payments);
        uint32 startTime = payments[0].start = uint32(block.timestamp);
        // duration = 0
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.setPayments(recipients, payments);
        payments[0].duration = uint32(56 weeks);
        // amount = 0
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.setPayments(recipients, payments);
        uint128 aliceAmount = 1_000 ether;
        payments[0].amount = aliceAmount;
        // claim > 0
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        payment.setPayments(recipients, payments);
        payments[0].claimed = 0;
        // isCancelled = true;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        payment.setPayments(recipients, payments);
        payments[0].isCancelled = false;
        // address zero
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.setPayments(recipients, payments);
        recipients[0] = alice;

        uint32 endTime = startTime + 56 weeks;
        vm.expectEmit(address(payment));
        emit PaymentSet(alice, startTime, endTime, aliceAmount);
        payment.setPayments(recipients, payments);
        assertEq(payment.totalAllocation(), aliceAmount);
        ITeamPayments.Payment memory _payment = payment.getPaymentInfo(alice);
        assertEq(_payment.start, startTime);
        assertEq(_payment.duration, payments[0].duration);
        assertEq(_payment.amount, payments[0].amount);
        assertEq(_payment.claimed, payments[0].claimed);
        assertEq(_payment.isCancelled, payments[0].isCancelled);

        // add same address without revoking 
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.setPayments(recipients, payments);

        payments = new ITeamPayments.Payment[](2);
        recipients = new address[](2);
        recipients[0] = bob;
        recipients[1] = mike;
        uint128 bobAmount = 2_000 ether;
        uint128 mikeAmount = 4_000 ether;
        payments[0] = ITeamPayments.Payment(
            startTime,
            48 weeks,
            false,
            0,
            bobAmount
        );
        payments[1] = ITeamPayments.Payment(
            startTime,
            24 weeks,
            false,
            0,
            mikeAmount
        );
        vm.expectEmit(address(payment));
        emit PaymentSet(bob, startTime, startTime+48 weeks, bobAmount);
        vm.expectEmit(address(payment));
        emit PaymentSet(mike, startTime, startTime+24 weeks, mikeAmount);
        payment.setPayments(recipients, payments);
        assertEq(payment.totalAllocation(), aliceAmount+bobAmount+mikeAmount);
        _payment = payment.getPaymentInfo(bob);
        assertEq(_payment.start, startTime);
        assertEq(_payment.duration, 48 weeks);
        assertEq(_payment.amount, bobAmount);
        assertEq(_payment.claimed, 0);
        assertEq(_payment.isCancelled, false);
        _payment = payment.getPaymentInfo(mike);
        assertEq(_payment.start, startTime);
        assertEq(_payment.duration, 24 weeks);
        assertEq(_payment.amount, mikeAmount);
        assertEq(_payment.claimed, 0);
        assertEq(_payment.isCancelled, false);
        assertEq(payment.totalClaimed(), 0);
    }

    function test_setEpochPayments() public {
        vm.startPrank(executor);
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256 epoch = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.setEpochPayments(epoch, recipients, amounts);
        amounts = new uint256[](2);
        epoch = 1;
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.AllocationsLengthMismatch.selector));
        payment.setEpochPayments(epoch, recipients, amounts);
        amounts = new uint256[](1);
        amounts[0] = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.setEpochPayments(epoch, recipients, amounts);
        amounts[0] = 1_000 ether;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.setEpochPayments(epoch, recipients, amounts);
        recipients[0] = alice; 
        vm.expectEmit(address(payment));
        emit EpochAllocationSet(recipients[0], epoch, amounts[0]);
        payment.setEpochPayments(epoch, recipients, amounts);
        assertEq(payment.totalAllocation(), amounts[0]);
        assertEq(payment.totalClaimed(), 0);
        assertEq(payment.epochPayments(recipients[0], epoch), amounts[0]);
    }

    function test_revokePayment() public {
        _createPayment();
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.revokePayment(address(0));

        uint256 _unreleased = 1_000 ether;
        // cancel same time, 0 released
        vm.expectEmit(address(payment));
        emit CancelledPayment(alice, 0, _unreleased);
        payment.revokePayment(alice);
        assertEq(payment.totalAllocation(), 0);
        assertEq(payment.totalClaimed(), 0);

        _createTwoPayments();
        vm.startPrank(executor);
        uint256 bobBalanceBefore = paymentToken.balanceOf(bob);
        uint256 mikeBalanceBefore = paymentToken.balanceOf(mike);
        // cancel after some time
        // half of bob payment time
        skip(28 weeks);
        uint256 claimable = payment.getClaimablePayment(bob);
        _unreleased = 1_000 ether - claimable;
        uint256 _totalClaimed = claimable;
        uint256 _totalAllocation = payment.totalAllocation();
        _approveContract();
        vm.startPrank(executor);
        vm.expectEmit(address(payment));
        emit CancelledPayment(bob, _totalClaimed, _unreleased);
        payment.revokePayment(bob);
        assertEq(paymentToken.balanceOf(bob), bobBalanceBefore+claimable);
        assertEq(payment.totalAllocation(), _totalAllocation-claimable);
        // mike period is over. should get full amount
        claimable = payment.getClaimablePayment(mike);
        _unreleased = 0;
        _totalClaimed = claimable;
        _totalAllocation = payment.totalAllocation();
        vm.expectEmit(address(payment));
        emit CancelledPayment(mike, _totalClaimed, _unreleased);
        payment.revokePayment(mike);
        assertEq(paymentToken.balanceOf(mike), mikeBalanceBefore+claimable);
        // 0 urnreleased
        assertEq(payment.totalAllocation(), _totalAllocation);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        payment.revokePayment(bob);
    }

    function test_revokeEpochPayment() public {
        uint256 _amount = 1_000 ether;
        _createEpochPayment(alice, 1, _amount);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.revokeEpochPayment(1, address(0));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.revokeEpochPayment(0, alice);
        // invalid epoch
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.revokeEpochPayment(2, alice);

        vm.expectEmit(address(payment));
        emit CancelledEpochPayment(alice, 1, _amount);
        payment.revokeEpochPayment(1, alice);
        assertEq(payment.totalAllocation(), 0);
        assertEq(payment.epochPayments(alice, 1), 0);
        assertEq(payment.claimedEpochs(alice, 1), true);

        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.AlreadyClaimed.selector));
        payment.revokeEpochPayment(1, alice);
    }

    function test_claim_team_payment() public {
        _approveContract();
        _createPayment();
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.NoPayment.selector));
        payment.claim();
        vm.startPrank(alice);
        // smae time 0 releasable
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.NothingClaimable.selector));
        payment.claim();

        skip(28 weeks);
        uint256 claimable = payment.getClaimablePayment(alice);
        vm.expectEmit(address(payment));
        emit ClaimedFixed(alice, claimable, claimable);
        payment.claim();
        assertEq(payment.totalClaimed(), claimable);
        // 0 releasable
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.NothingClaimable.selector));
        payment.claim();
        vm.startPrank(executor);
        payment.revokePayment(alice);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.PaymentCancelled.selector));
        payment.claim();

        _createTwoPayments();
        vm.startPrank(bob);
        skip(24 weeks);
        claimable = payment.getClaimablePayment(bob);
        vm.expectEmit(address(payment));
        emit ClaimedFixed(bob, claimable, claimable);
        payment.claim();
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.NothingClaimable.selector));
        payment.claim();
        
        skip(32 weeks);
        vm.startPrank(mike);
        claimable = payment.getClaimablePayment(mike);
        vm.expectEmit(address(payment));
        emit ClaimedFixed(mike, claimable, claimable);
        payment.claim();
        vm.startPrank(bob);
        claimable = payment.getClaimablePayment(bob);
        vm.expectEmit(address(payment));
        emit ClaimedFixed(bob, claimable, 1_000 ether);
        payment.claim();
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.NothingClaimable.selector));
        payment.claim();
        vm.startPrank(mike);
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.NothingClaimable.selector));
        payment.claim();
    }

    function test_claim_amount_team_payment() public {
        _approveContract();
        _createPayment();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.claimAmount(0);
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.NoPayment.selector));
        payment.claimAmount(1);
        vm.startPrank(alice);
        // smae time 0 releasable
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.NothingClaimable.selector));
        payment.claim();

        skip(28 weeks);
        uint256 allocation = payment.totalAllocation();
        uint256 claimable = payment.getClaimablePayment(alice);
        uint256 amount = 100 ether;
        uint256 leftover = claimable - amount;
        vm.expectEmit(address(payment));
        emit ClaimedFixed(alice, amount, amount);
        payment.claimAmount(amount);
        assertEq(payment.getClaimablePayment(alice), leftover);
        assertEq(payment.totalClaimed(), amount);
        // try claiming more than available
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        payment.claimAmount(claimable);
        vm.startPrank(executor);
        payment.revokePayment(alice);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.PaymentCancelled.selector));
        payment.claimAmount(amount);
        assertEq(payment.totalAllocation(), allocation-leftover-amount);

        _createTwoPayments();
        vm.startPrank(bob);
        skip(24 weeks);
        claimable = payment.getClaimablePayment(bob);
        leftover = claimable - amount;
        uint256 totalClaimed = payment.totalClaimed();
        vm.expectEmit(address(payment));
        emit ClaimedFixed(bob, amount, amount);
        payment.claimAmount(amount);
        assertEq(payment.getClaimablePayment(bob), leftover);
        vm.expectEmit(address(payment));
        emit ClaimedFixed(bob, amount, 2*amount);
        payment.claimAmount(amount);
        assertEq(payment.totalClaimed(), totalClaimed+2*amount);
        leftover = claimable-2*amount;
        assertEq(payment.getClaimablePayment(bob), leftover);

        skip(32 weeks);
        vm.startPrank(mike);
        claimable = payment.getClaimablePayment(mike);
        leftover = claimable - amount;
        vm.expectEmit(address(payment));
        emit ClaimedFixed(mike, amount, amount);
        payment.claimAmount(amount);
        totalClaimed = totalClaimed+3*amount;
        assertEq(payment.totalClaimed(), totalClaimed);
        assertEq(payment.getClaimablePayment(mike), leftover);
        vm.expectEmit(address(payment));
        emit ClaimedFixed(mike, 4*amount, 5*amount);
        payment.claimAmount(4*amount);
        leftover = claimable-5*amount;
        totalClaimed += 4*amount;
        assertEq(payment.getClaimablePayment(mike), leftover);
        assertEq(payment.totalClaimed(), totalClaimed);
        vm.expectEmit(address(payment));
        emit ClaimedFixed(mike, leftover, 2_000 ether);
        payment.claimAmount(leftover);

        vm.startPrank(bob);
        claimable = payment.getClaimablePayment(bob);
        payment.claimAmount(claimable);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        payment.claimAmount(amount);
        vm.startPrank(mike);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        payment.claimAmount(amount);
    }

    function test_claim_epoch() public {
        _approveContract();
        uint256 amount = 100 ether;
        _createEpochPayment(alice, 1, amount);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        payment.claimEpoch(0);
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.NothingClaimable.selector));
        payment.claimEpoch(1);
        uint256 balanceBefore = paymentToken.balanceOf(alice);
        vm.startPrank(alice);
        vm.expectEmit(address(payment));
        emit ClaimedEpoch(alice, 1, amount);
        payment.claimEpoch(1);
        assertEq(payment.claimedEpochs(alice, 1), true);
        assertEq(paymentToken.balanceOf(alice), balanceBefore+amount);
        vm.expectRevert(abi.encodeWithSelector(ITeamPayments.AlreadyClaimed.selector));
        payment.claimEpoch(1);
    }

    function test_recover_token_team_payments() public {
        uint256 amount = 100 ether;
        deal(address(fakeToken), address(payment), amount, true);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, address(fakeToken), amount);

        vm.startPrank(executor);
        payment.recoverToken(address(fakeToken), alice, amount);
        assertEq(fakeToken.balanceOf(alice), amount);
        assertEq(fakeToken.balanceOf(address(payment)), 0);
    }

    function test_getClaimablePayment() public {
        _approveContract();
        uint256 period = 56 weeks;
        uint256 amount = 1_000 ether;
        uint256 start = block.timestamp;
        ITeamPayments.Payment memory _payment =_createPayment();
        assertEq(payment.getClaimablePayment(alice), 0);
        skip(1 weeks);
        uint256 oneWeekClaimable = 1 weeks * amount / period;
        assertEq(payment.getClaimablePayment(alice), oneWeekClaimable);
        assertApproxEqAbs(payment.getClaimablePaymentAt(alice, uint32(block.timestamp+1 weeks)), 2*oneWeekClaimable, 1);
        skip(1 weeks);
        assertEq(payment.getClaimablePayment(alice), 2 weeks * amount / period);
        // assertApproxEqAbs(payment.getClaimablePaymentAt(alice, uint32(block.timestamp+26 weeks)), 28*oneWeekClaimable, 1);
        assertApproxEqAbs(payment.getClaimablePaymentAt(alice, uint32(block.timestamp+26 weeks)), _calculateTotalPayoutAt(_payment, uint32(block.timestamp+26 weeks)), 1);
        skip(26 weeks);
        assertEq(payment.getClaimablePayment(alice), amount/2);
        skip(28 weeks);
        assertEq(payment.getClaimablePayment(alice), amount);
        skip(1 days);
        assertEq(payment.getClaimablePayment(alice), amount);
        vm.startPrank(alice);
        payment.claim();
        assertEq(payment.getClaimablePayment(alice), 0);
    }

    function test_get_payment_info() public {
        uint256 period = 56 weeks;
        uint256 amount = 1_000 ether;
        _createPayment();
        _approveContract();
        ITeamPayments.Payment memory _payment = payment.getPaymentInfo(alice);
        assertEq(_payment.amount, amount);
        assertEq(_payment.claimed, 0);
        assertEq(_payment.duration, 56 weeks);
        assertEq(_payment.isCancelled, false);
        assertEq(_payment.start, block.timestamp);
        skip(1 weeks);
        uint256 claimable = payment.getClaimablePayment(alice);
        vm.startPrank(alice);
        payment.claim();
        _payment = payment.getPaymentInfo(alice);
        assertEq(_payment.claimed, claimable);
        assertEq(_payment.amount, amount);
        assertEq(_payment.isCancelled, false);
        vm.startPrank(executor);
        payment.revokePayment(alice);
        _payment = payment.getPaymentInfo(alice);
        assertEq(_payment.claimed, claimable);
        assertEq(_payment.amount, amount);
        assertEq(_payment.isCancelled, true);
        assertEq(payment.getClaimablePayment(alice), 0);
    }

    function _calculateTotalPayoutAt(
        ITeamPayments.Payment memory _payment,
        uint32 _releaseTime
    ) private view returns (uint256) {
        uint256 _elapsed = _getElapsedTime(_payment.start, _releaseTime, _payment.duration);
        uint256 _total = TempleMath.mulDivRound(_payment.amount, _elapsed, _payment.duration, false);
        return _total;
    }

    function _getElapsedTime(uint32 _start, uint32 _end, uint32 _duration) private pure returns (uint32) {
        return _end - _start > _duration ? _duration : _end - _start;
    }

    function _createPayment() internal returns (ITeamPayments.Payment memory _payment) {
        ITeamPayments.Payment[] memory payments = new ITeamPayments.Payment[](1);
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        _payment = ITeamPayments.Payment(
            uint32(block.timestamp),
            56 weeks,
            false,
            0,
            1_000 ether
        );
        payments[0] = _payment;
        vm.startPrank(executor);
        payment.setPayments(recipients, payments);
        vm.stopPrank();
    }

    function _createTwoPayments() internal returns (ITeamPayments.Payment[] memory payments) {
        payments = new ITeamPayments.Payment[](2);
        address[] memory recipients = new address[](2);
        recipients[0] = bob;
        recipients[1] = mike;
        payments[0] = ITeamPayments.Payment(
            uint32(block.timestamp),
            56 weeks,
            false,
            0,
            1_000 ether
        );
        payments[1] = ITeamPayments.Payment(
            uint32(block.timestamp),
            24 weeks,
            false,
            0,
            2_000 ether
        );
        vm.startPrank(executor);
        payment.setPayments(recipients, payments);
        vm.stopPrank();
    }

    function _createEpochPayment(address _recipient, uint256 _epoch, uint256 _amount) internal {
        uint256[] memory amounts = new uint256[](1);
        address[] memory recipients = new address[](1);
        recipients[0] = _recipient;
        amounts[0] = _amount;
        vm.startPrank(executor);
        payment.setEpochPayments(_epoch, recipients, amounts);
        vm.stopPrank();
    }

    function _approveContract() internal {
        vm.startPrank(fundsOwner);
        paymentToken.approve(address(payment), type(uint256).max);
        vm.stopPrank();
    }
}