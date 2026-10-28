pragma solidity ^0.8.21;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "test/forge/unit/TempleTest.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IComplianceCheck } from "contracts/interfaces/templegold/IComplianceCheck.sol";
import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";
import { ComplianceCheck } from "contracts/templegold/ComplianceCheck.sol";

contract ComplianceCheckTest is TempleTest {
    ComplianceCheck internal compliance;
    address internal blocker = makeAddr("blocker");

    function setUp() public {
        compliance = new ComplianceCheck(executor);
    }

    function test_constructor_fail_zeroExecutor() public {
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        new ComplianceCheck(address(0));
    }

    function _accounts() internal view returns (address[] memory accounts) {
        accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
    }

    function _setBlocker(address account, bool value) internal {
        vm.prank(executor);
        compliance.setBlocker(account, value);
    }

    function test_initialization() public view {
        assertEq(compliance.executor(), executor);
        assertEq(compliance.proposedExecutor(), address(0));
        assertFalse(compliance.isBlocked(alice));
        assertFalse(compliance.isBlocker(blocker));
    }

    function test_access_setBlocked() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        compliance.setBlocked(_accounts(), true);
    }

    function test_access_setBlocker() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setBlocker(blocker, true);

        // A blocker can't appoint another.
        _setBlocker(blocker, true);
        vm.prank(blocker);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setBlocker(alice, true);
    }

    function test_setBlocker_fail_zeroAddress() public {
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        compliance.setBlocker(address(0), true);
    }

    function test_setBlocker_success_appointAndRemove() public {
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.BlockerSet(blocker, true);
        _setBlocker(blocker, true);
        assertTrue(compliance.isBlocker(blocker));

        vm.expectEmit(address(compliance));
        emit IComplianceCheck.BlockerSet(blocker, false);
        _setBlocker(blocker, false);
        assertFalse(compliance.isBlocker(blocker));
    }

    function test_setBlocked_success_byExecutor() public {
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.BlockedSet(alice, true);
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.BlockedSet(bob, true);
        vm.prank(executor);
        compliance.setBlocked(_accounts(), true);
        assertTrue(compliance.isBlocked(alice));
        assertTrue(compliance.isBlocked(bob));

        vm.expectEmit(address(compliance));
        emit IComplianceCheck.BlockedSet(alice, false);
        vm.prank(executor);
        compliance.setBlocked(_accounts(), false);
        assertFalse(compliance.isBlocked(alice));
    }

    function test_setBlocked_success_byBlockerUntilRemoved() public {
        vm.prank(blocker);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setBlocked(_accounts(), true);

        _setBlocker(blocker, true);
        vm.prank(blocker);
        compliance.setBlocked(_accounts(), true);
        assertTrue(compliance.isBlocked(bob));
        vm.prank(blocker);
        compliance.setBlocked(_accounts(), false);
        assertFalse(compliance.isBlocked(bob));

        _setBlocker(blocker, false);
        vm.prank(blocker);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setBlocked(_accounts(), true);
    }

    function test_executorHandover() public {
        vm.prank(alice);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.proposeNewExecutor(alice);

        vm.prank(executor);
        compliance.proposeNewExecutor(alice);
        vm.prank(bob);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.acceptExecutor();
        uint256 readyAt = block.timestamp + compliance.EXECUTOR_HANDOVER_DELAY();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IExecutorAccess.ExecutorHandoverNotReady.selector, readyAt));
        compliance.acceptExecutor();
        vm.warp(readyAt);
        vm.prank(alice);
        compliance.acceptExecutor();
        assertEq(compliance.executor(), alice);

        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setBlocked(_accounts(), true);
    }

    function test_proposeNewExecutor_fail_blocker() public {
        _setBlocker(blocker, true);
        vm.prank(blocker);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.proposeNewExecutor(blocker);
    }

    function test_proposeNewExecutor_selfReplacesPendingProposal() public {
        vm.startPrank(executor);
        compliance.proposeNewExecutor(bob);
        compliance.proposeNewExecutor(executor);
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.acceptExecutor();
        assertEq(compliance.proposedExecutor(), executor);
    }
}
