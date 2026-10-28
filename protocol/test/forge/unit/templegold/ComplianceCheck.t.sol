pragma solidity ^0.8.21;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "test/forge/unit/TempleTest.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IComplianceCheck } from "contracts/interfaces/templegold/IComplianceCheck.sol";
import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";
import { ComplianceCheck } from "contracts/templegold/ComplianceCheck.sol";

contract ComplianceCheckTest is TempleTest {
    ComplianceCheck internal compliance;
    address internal flagger = makeAddr("flagger");

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

    function _setFlagger(address account, bool value) internal {
        vm.prank(executor);
        compliance.setFlagger(account, value);
    }

    function test_initialization() public view {
        assertEq(compliance.executor(), executor);
        assertEq(compliance.proposedExecutor(), address(0));
        assertFalse(compliance.isFlagged(alice));
        assertFalse(compliance.isFlagger(flagger));
    }

    function test_access_setFlagged() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        compliance.setFlagged(_accounts(), true);
    }

    function test_access_setFlagger() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        compliance.setFlagger(flagger, true);

        // A flagger can't add another.
        _setFlagger(flagger, true);
        vm.prank(flagger);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setFlagger(alice, true);
    }

    function test_setFlagger_fail_zeroAddress() public {
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        compliance.setFlagger(address(0), true);
    }

    function test_setFlagger_success_addAndRemove() public {
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.FlaggerSet(flagger, true);
        _setFlagger(flagger, true);
        assertTrue(compliance.isFlagger(flagger));

        vm.expectEmit(address(compliance));
        emit IComplianceCheck.FlaggerSet(flagger, false);
        _setFlagger(flagger, false);
        assertFalse(compliance.isFlagger(flagger));
    }

    function test_setFlagged_success_byExecutor() public {
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.FlaggedSet(alice, true);
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.FlaggedSet(bob, true);
        vm.prank(executor);
        compliance.setFlagged(_accounts(), true);
        assertTrue(compliance.isFlagged(alice));
        assertTrue(compliance.isFlagged(bob));

        vm.expectEmit(address(compliance));
        emit IComplianceCheck.FlaggedSet(alice, false);
        vm.prank(executor);
        compliance.setFlagged(_accounts(), false);
        assertFalse(compliance.isFlagged(alice));
    }

    function test_setFlagged_success_byFlaggerUntilRemoved() public {
        vm.prank(flagger);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setFlagged(_accounts(), true);

        _setFlagger(flagger, true);
        vm.prank(flagger);
        compliance.setFlagged(_accounts(), true);
        assertTrue(compliance.isFlagged(bob));
        vm.prank(flagger);
        compliance.setFlagged(_accounts(), false);
        assertFalse(compliance.isFlagged(bob));

        _setFlagger(flagger, false);
        vm.prank(flagger);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setFlagged(_accounts(), true);
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
        compliance.setFlagged(_accounts(), true);
    }

    function test_proposeNewExecutor_fail_flagger() public {
        _setFlagger(flagger, true);
        vm.prank(flagger);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.proposeNewExecutor(flagger);
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
