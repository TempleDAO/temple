pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/admin/EpochPayments.t.sol)

import { IEpochPayments } from "contracts/interfaces/admin/IEpochPayments.sol";

import { TempleTest } from "../TempleTest.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { EpochPayments } from "contracts/admin/EpochPayments.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

contract EpochPaymentsTestBase is TempleTest {
    event FundsOwnerSet(address indexed fundOwner);
    event CancelledEpochPayment(address indexed recipient, uint256 indexed epoch, uint256 amountRevoked);
    event ClaimedEpoch(address indexed recipient, uint256 indexed epoch, uint256 amount);
    event EpochAllocationSet(address indexed recipient, uint256 indexed epoch, uint256 amount);
    event NextEpochSet(uint256 epoch);
    event MinimumEpochDurationSet(uint256 duration);

    FakeERC20 public paymentToken;
    FakeERC20 public fakeToken;
    EpochPayments public payment;
    address public fundsOwner = makeAddr("fundsOwner");
    address public mike = makeAddr("mike");

    function setUp() public {
        paymentToken = new FakeERC20("DAI", "Dai Token", fundsOwner, 1_000_000 ether);
        fakeToken = new FakeERC20("FAKE", "Fake Token", executor, 10_000 ether);
        payment = new EpochPayments(rescuer, executor, fundsOwner, address(paymentToken));
        deal(address(paymentToken), fundsOwner, 1000e18, true);
        vm.prank(fundsOwner);
        paymentToken.approve(address(payment), type(uint256).max);
    }

    function test_initialization() public view {
        assertEq(payment.rescuer(), rescuer);
        assertEq(payment.executor(), executor);
        assertEq(payment.fundsOwner(), fundsOwner);
        assertEq(address(payment.paymentToken()), address(paymentToken));
    }

    function test_initialization_invalid_paymentToken() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        /*EpochPayments epochPayments = */ new EpochPayments(rescuer, executor, fundsOwner, address(0));
    }
}

contract TeamPaymentsAccessTest is EpochPaymentsTestBase {
    function test_access_fail_setFundsOwner() public {
        expectElevatedAccess();
        payment.setFundsOwner(alice);
    }

    function test_access_fail_setEpochPayments() public {
        uint256[] memory amounts = new uint256[](1);
        address[] memory recipients = new address[](1);
        expectElevatedAccess();
        payment.setEpochPayments(recipients, amounts);
    }

    function test_access_fail_revokeEpochPayment() public {
        expectElevatedAccess();
        payment.revokeEpochPayment(1, alice);
    }

    function test_access_fail_setMinimumEpochDuration() public {
        expectElevatedAccess();
        payment.setMinimumEpochDuration(1);
    }

    function test_access_fail_recoverToken() public {
        expectElevatedAccess();
        payment.recoverToken(address(fakeToken), alice, 1);
    }

    function test_access_fail_updateEpochAllocations() public {
        expectElevatedAccess();
        uint256[] memory amounts = new uint256[](1);
        address[] memory recipients = new address[](1);
        payment.updateEpochPayments(recipients, amounts);
    }

    function test_access_success_setFundsOwner() public {
        vm.prank(executor);
        payment.setFundsOwner(alice);
    }

    function test_access_success_setEpochPayments() public {
        vm.startPrank(executor);
        payment.setMinimumEpochDuration(4 weeks);
        uint256[] memory amounts = new uint256[](1);
        address[] memory recipients = new address[](1);
        amounts[0] = 1e18;
        recipients[0] = bob;
        payment.setEpochPayments(recipients, amounts);
    }

    function test_access_success_revokeEpochPayment() public {
        test_access_success_setEpochPayments();
        payment.revokeEpochPayment(1, bob);
    }

    function test_access_success_setMinimumEpochDuration() public {
        vm.startPrank(executor);
        payment.setMinimumEpochDuration(1 weeks);
    }

    function test_access_success_recoverToken() public {
        vm.startPrank(executor);
        deal(address(fakeToken), address(payment), 1e18, true);
        payment.recoverToken(address(fakeToken), alice, 1e18);
    }

    function test_access_success_updateEpochAllocations() public {
        test_access_success_setEpochPayments();
        uint256[] memory amounts = new uint256[](1);
        address[] memory recipients = new address[](1);
        amounts[0] = 1e18;
        recipients[0] = bob;
        payment.updateEpochPayments(recipients, amounts);
    }
}

contract EpochPaymentsViewTest is EpochPaymentsTestBase {
    function test_totalAllocation() public {
        vm.startPrank(executor);
        payment.setMinimumEpochDuration(4 weeks);
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = alice;
        amounts[0] = 1e18;
        payment.setEpochPayments(recipients, amounts);

        assertEq(payment.totalAllocation(), 1e18);
        amounts = new uint256[](1);
        recipients = new address[](1);
        amounts[0] = 3e18;
        recipients[0] = bob;
        payment.updateEpochPayments(recipients, amounts);
        assertEq(payment.totalAllocation(), 4e18);
        amounts[0] = 2e18;
        recipients[0] = mike;
        payment.updateEpochPayments(recipients, amounts);
        assertEq(payment.totalAllocation(), 6e18);
    }

    function test_totalClaimed_claimedEpochs() public {
        test_totalAllocation();
        assertEq(payment.claimedEpochs(alice, 1), false);
        vm.startPrank(alice);
        payment.claimEpoch(1);
        assertEq(payment.totalClaimed(), 1e18);
        assertEq(payment.claimedEpochs(bob, 1), false);
        vm.startPrank(bob);
        payment.claimEpoch(1);
        assertEq(payment.totalClaimed(), 4e18);
        assertEq(payment.claimedEpochs(bob, 1), true);
        assertEq(payment.claimedEpochs(mike, 1), false);
        vm.startPrank(mike);
        payment.claimEpoch(1);
        assertEq(payment.totalClaimed(), 6e18);
        assertEq(payment.claimedEpochs(mike, 1), true);
    }

    function test_currentEpoch_epochStartTimes() public {
        assertEq(payment.currentEpoch(), 0);
        vm.startPrank(executor);
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = alice;
        amounts[0] = 1e18;
        payment.setEpochPayments(recipients, amounts);
        assertEq(payment.currentEpoch(), 1);
        assertEq(payment.epochStartTimes(1), block.timestamp);

        skip(payment.minEpochDuration()+1);
        payment.setEpochPayments(recipients, amounts);
        assertEq(payment.currentEpoch(), 2);
        assertEq(payment.epochStartTimes(2), block.timestamp);

        skip(payment.minEpochDuration()+1);
        payment.setEpochPayments(recipients, amounts);
        assertEq(payment.currentEpoch(), 3);
        assertEq(payment.epochStartTimes(3), block.timestamp);
    }

    function test_minEpochDuration() public {
        uint256 before_ = payment.minEpochDuration();
        vm.prank(executor);
        payment.setMinimumEpochDuration(before_ + 1);
        assertEq(payment.minEpochDuration(), before_ + 1);
    }
}

contract EpochPaymentsTest is EpochPaymentsTestBase {
    function test_setFundsOwner_owner_invalid_address() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.setFundsOwner(address(0));
        vm.stopPrank();
    }

    function test_setFundsOwner() public {
        vm.startPrank(executor);
        vm.expectEmit(address(payment));
        emit FundsOwnerSet(bob);
        payment.setFundsOwner(bob);
        assertEq(payment.fundsOwner(), bob);

        vm.expectEmit(address(payment));
        emit FundsOwnerSet(alice);
        payment.setFundsOwner(alice);
        assertEq(payment.fundsOwner(), alice);
        vm.stopPrank();
    }

    function test_setMinimumEpochDuration_zero_value() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.setMinimumEpochDuration(0);
    }

    function test_setMinimumEpochDuration() public {
        vm.startPrank(executor);
        vm.expectEmit(address(payment));
        emit MinimumEpochDurationSet(1 weeks);
        payment.setMinimumEpochDuration(1 weeks);
        assertEq(payment.minEpochDuration(), 1 weeks);
    }

    function test_setEpochPayments_first_epoch() public {
        assertEq(payment.currentEpoch(), 0);
        assertEq(payment.epochStartTimes(1), 0);
        assertEq(payment.epochStartTimes(0), 0);
        vm.startPrank(executor);
        payment.setMinimumEpochDuration(4 weeks);
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = alice;
        amounts[0] = 1e18;
        vm.expectEmit(address(payment));
        emit NextEpochSet(1);
        payment.setEpochPayments(recipients, amounts);
    }

    function test_setEpochPayments_next_epochs_base() public {
        test_setEpochPayments_first_epoch();
        payment.setMinimumEpochDuration(4 weeks);
        skip(payment.minEpochDuration()+1);
    }

    function test_setEpochPayments_next_epochs_invalid_amount() public {
        test_setEpochPayments_next_epochs_base();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = alice;
        amounts[0] = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.setEpochPayments(recipients, amounts);
    }

    function test_setEpochPayments_next_epochs_invalid_recipient() public {
        test_setEpochPayments_next_epochs_base();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = address(0);
        amounts[0] = 1e18;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.setEpochPayments(recipients, amounts);
    }

    function test_setEpochPayments_next_epochs() public {
        test_setEpochPayments_next_epochs_base();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = alice;
        amounts[0] = 1e18;
        uint256 totalAllocation = payment.totalAllocation();
        vm.expectEmit(address(payment));
        emit EpochAllocationSet(recipients[0], 2, amounts[0]);
        payment.setEpochPayments(recipients, amounts);
        totalAllocation += amounts[0];
        assertEq(payment.epochPayments(alice, 2), amounts[0]);
        assertEq(payment.totalAllocation(), totalAllocation);

        skip(payment.minEpochDuration()+1 seconds);
        recipients = new address[](2);
        amounts = new uint256[](2);
        recipients[0] = alice;
        amounts[0] = 1e18;
        recipients[1] = bob;
        amounts[1] = 2e18;
        totalAllocation += amounts[1];
        totalAllocation += amounts[0];
        vm.expectEmit(true, true, false, true, address(payment));
        emit NextEpochSet(3);
        emit EpochAllocationSet(recipients[0], 3, amounts[0]);
        emit EpochAllocationSet(recipients[1], 3, amounts[1]);
        payment.setEpochPayments(recipients, amounts);
        assertEq(payment.totalAllocation(), totalAllocation);
        assertEq(payment.epochPayments(alice, 3), amounts[0]);
        assertEq(payment.epochPayments(bob, 3), amounts[1]);
    }

    function test_setEpochPayments_invalid_array_length() public {
        test_setEpochPayments_first_epoch();
        skip(payment.minEpochDuration()+1);
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](2);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.AllocationsLengthMismatch.selector));
        payment.setEpochPayments(recipients, amounts);
    }

    function test_setEpochPayments_cannot_start_epoch() public {
        test_setEpochPayments_first_epoch();
        payment.setMinimumEpochDuration(4 weeks);
        skip(payment.minEpochDuration()-1);
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.CannotStartEpoch.selector, 2));
        payment.setEpochPayments(recipients, amounts);
        
        skip(1 seconds);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.CannotStartEpoch.selector, 2));
        payment.setEpochPayments(recipients, amounts);
    }

    function test_updateEpochAllocations_epoch_ended() public {
        test_setEpochPayments_first_epoch();
        // skip to end of epoch
        skip(payment.minEpochDuration()+1);
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.EpochEnded.selector));
        payment.updateEpochPayments(recipients, amounts);
    }

    function test_updateEpochAllocations_epoch_is_zero() public {
        vm.startPrank(executor);
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.EpochEnded.selector));
        payment.updateEpochPayments(recipients, amounts);
    }

    function test_updateEpochAllocations_length_mismatch() public {
        test_setEpochPayments_first_epoch();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](2);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.AllocationsLengthMismatch.selector));
        payment.updateEpochPayments(recipients, amounts);
    }

    function test_updateEpochAllocations_already_claimed() public {
        test_setEpochPayments_first_epoch();
        vm.startPrank(alice);
        payment.claimEpoch(1);
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1e18;
        recipients[0] = alice;
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.AlreadyClaimed.selector, alice, 1));
        payment.updateEpochPayments(recipients, amounts);
    }

    function test_updateEpochAllocations_zero_amount() public {
        test_setEpochPayments_first_epoch();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0;
        recipients[0] = alice;
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.updateEpochPayments(recipients, amounts);
    }

    function test_updateEpochAllocations_zero_address() public {
        test_setEpochPayments_first_epoch();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1e18;
        recipients[0] = address(0);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.updateEpochPayments(recipients, amounts);
    }

    function test_updateEpochAllocations_single_call_duplicate_accounts() public {
        // test case: [alice, alice], [amt, amt]
        test_setEpochPayments_first_epoch();
        address[] memory recipients = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        recipients[0] = bob;
        recipients[1] = bob;
        amounts[0] = 1e18;
        amounts[1] = 2e18;
        // expected behaviour is to override
        vm.startPrank(executor);
        payment.updateEpochPayments(recipients, amounts);
        assertEq(payment.epochPayments(bob, 1), 2e18);
        vm.stopPrank();
    }

    function test_updateEpochAllocations_new_allocation() public {
        test_setEpochPayments_first_epoch();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 3e18;
        recipients[0] = mike;
        vm.expectEmit(address(payment));
        emit EpochAllocationSet(mike, 1, 3e18);
        payment.updateEpochPayments(recipients, amounts);
        assertEq(payment.epochPayments(mike, 1), 3e18);
    }

    function test_updateEpochAllocations_update_allocation() public {
        test_setEpochPayments_first_epoch();
        uint256 totalBefore = payment.totalAllocation();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 3e18;
        recipients[0] = alice;
        assertEq(payment.epochPayments(alice, 1), 1e18);
        vm.expectEmit(address(payment));
        emit EpochAllocationSet(alice, 1, 3e18);
        payment.updateEpochPayments(recipients, amounts);
        assertEq(payment.epochPayments(alice, 1), 3e18);
        assertEq(payment.totalAllocation(), totalBefore - 1e18 + 3e18);
    }

    function test_updateEpochAllocations_update_allocation_larger_allocation() public {
        test_setEpochPayments_first_epoch();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 3e18;
        recipients[0] = alice;
        uint256 totalAllocation = payment.totalAllocation();
        assertEq(payment.epochPayments(alice, 1), 1e18);
        payment.updateEpochPayments(recipients, amounts);
        assertEq(payment.totalAllocation(), totalAllocation+2e18);
    }

    function test_updateEpochAllocations_update_allocation_smaller_allocation() public {
        test_setEpochPayments_first_epoch();
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0.5e18;
        recipients[0] = alice;
        uint256 totalAllocation = payment.totalAllocation();
        assertEq(payment.epochPayments(alice, 1), 1e18);
        payment.updateEpochPayments(recipients, amounts);
        assertEq(payment.totalAllocation(), totalAllocation-0.5e18);
    }

    function test_revokeEpochPayment_invalid_address() public {
        _createEpochPayment(alice, 1e18);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        payment.revokeEpochPayment(1, address(0));
    }

    function test_revokeEpochPayment_zero_amount() public {
        _createEpochPayment(alice, 1e18);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.revokeEpochPayment(0, alice);
    }

    function test_revokeEpochPayment_invalid_epoch() public {
        _createEpochPayment(alice, 1e18);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.InvalidEpoch.selector, 2));
        payment.revokeEpochPayment(2, alice);
    }

    function test_revokeEpochPayment_invalid_allocation() public {
        _createEpochPayment(alice, 1e18);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.revokeEpochPayment(1, mike);
    }

    function test_revokeEpochPayment() public {
        uint256 _amount = 1_000 ether;
        _createEpochPayment(alice, _amount);
        vm.startPrank(executor);

        vm.expectEmit(address(payment));
        emit CancelledEpochPayment(alice, 1, _amount);
        payment.revokeEpochPayment(1, alice);
        assertEq(payment.totalAllocation(), 0);
        assertEq(payment.epochPayments(alice, 1), 0);
        assertEq(payment.claimedEpochs(alice, 1), false);
    }

    function test_revokeEpochPayment_already_claimed() public {
        _createEpochPayment(alice, 1e18);
        // make claim
        vm.startPrank(alice);
        payment.claimEpoch(1);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.AlreadyClaimed.selector, alice, 1));
        payment.revokeEpochPayment(1, alice);
    }

    function test_revokeEpochPayment_add_later() public {
        uint256 amount = 1_000 ether;
        _createEpochPayment(alice, amount);
        vm.startPrank(executor);
        payment.setMinimumEpochDuration(4 weeks);
        // revoke epoch payment
        payment.revokeEpochPayment(1, alice);

        uint256[] memory amounts = new uint256[](1);
        address[] memory recipients = new address[](1);
        amount = 2_000 ether;
        recipients[0] = alice;
        amounts[0] = amount;
        // set epoch payment for same epoch and updated amount
        payment.updateEpochPayments(recipients, amounts);
        uint256 epochPayment = payment.epochPayments(alice, 1);
        assertEq(epochPayment, amount);
    }

    function test_claim_epoch_zero_amount() public {
        _approveContract();
        _createEpochPayment(alice, 1e18);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        payment.claimEpoch(0);
    }

     function test_claim_epoch_zero_claimable() public {
        _approveContract();
        _createEpochPayment(alice, 1e18);
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.ZeroClaimable.selector));
        payment.claimEpoch(1);
    }

    function test_claim_epoch() public {
        _approveContract();
        uint256 amount = 100 ether;
        _createEpochPayment(alice, amount);

        uint256 balanceBefore = paymentToken.balanceOf(alice);
        vm.startPrank(alice);
        vm.expectEmit(address(payment));
        emit ClaimedEpoch(alice, 1, amount);
        payment.claimEpoch(1);
        assertEq(payment.claimedEpochs(alice, 1), true);
        assertEq(paymentToken.balanceOf(alice), balanceBefore+amount);
    }

    function test_claim_epoch_already_claimed() public {
        test_claim_epoch();
        vm.expectRevert(abi.encodeWithSelector(IEpochPayments.AlreadyClaimed.selector, alice, 1));
        payment.claimEpoch(1);
    }

    function test_recover_token_epoch_payments() public {
        uint256 amount = 100 ether;
        deal(address(fakeToken), address(payment), amount, true);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, address(fakeToken), amount);

        vm.startPrank(executor);
        payment.recoverToken(address(fakeToken), alice, amount);
        assertEq(fakeToken.balanceOf(alice), amount);
        assertEq(fakeToken.balanceOf(address(payment)), 0);
    }

    function _createEpochPayment(address _recipient, uint256 _amount) internal {
        uint256[] memory amounts = new uint256[](1);
        address[] memory recipients = new address[](1);
        recipients[0] = _recipient;
        amounts[0] = _amount;
        vm.startPrank(executor);
        payment.setEpochPayments(recipients, amounts);
        vm.stopPrank();
    }

    function _approveContract() internal {
        vm.startPrank(fundsOwner);
        paymentToken.approve(address(payment), type(uint256).max);
        vm.stopPrank();
    }
}