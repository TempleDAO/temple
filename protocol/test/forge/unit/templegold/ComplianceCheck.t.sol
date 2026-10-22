pragma solidity ^0.8.21;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "test/forge/unit/TempleTest.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IComplianceCheck } from "contracts/interfaces/templegold/IComplianceCheck.sol";
import { IExecutorAccess } from "contracts/interfaces/templegold/IExecutorAccess.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";
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

    function _access(
        bytes4 selector,
        bool allowed
    ) internal pure returns (ITempleElevatedAccess.ExplicitAccess[] memory access) {
        access = new ITempleElevatedAccess.ExplicitAccess[](1);
        access[0] = ITempleElevatedAccess.ExplicitAccess(selector, allowed);
    }

    function _grant(address account, bytes4 selector, bool allowed) internal {
        vm.prank(executor);
        compliance.setExplicitAccess(account, _access(selector, allowed));
    }

    function test_initialization() public view {
        assertEq(compliance.executor(), executor);
        assertEq(compliance.proposedExecutor(), address(0));
        assertFalse(compliance.isBlocked(alice));
        assertFalse(compliance.explicitFunctionAccess(blocker, ComplianceCheck.setBlocked.selector));
    }

    function test_access_setBlocked() public {
        expectElevatedAccess();
        compliance.setBlocked(_accounts(), true);
    }

    function test_access_setExplicitAccess() public {
        expectElevatedAccess();
        compliance.setExplicitAccess(blocker, _access(ComplianceCheck.setBlocked.selector, true));

        // A grantee can't widen its own access.
        _grant(blocker, ComplianceCheck.setBlocked.selector, true);
        vm.prank(blocker);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setExplicitAccess(blocker, _access(ComplianceCheck.setExplicitAccess.selector, true));

        // Nor can a grant of setExplicitAccess itself reach it: only the executor can.
        _grant(blocker, ComplianceCheck.setExplicitAccess.selector, true);
        vm.prank(blocker);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setExplicitAccess(alice, _access(ComplianceCheck.setBlocked.selector, true));
    }

    function test_setExplicitAccess_fail_zeroAddress() public {
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        compliance.setExplicitAccess(address(0), _access(ComplianceCheck.setBlocked.selector, true));
    }

    function test_setExplicitAccess_success_grantAndRevoke() public {
        ITempleElevatedAccess.ExplicitAccess[] memory access = new ITempleElevatedAccess.ExplicitAccess[](2);
        access[0] = ITempleElevatedAccess.ExplicitAccess(ComplianceCheck.setBlocked.selector, true);
        access[1] = ITempleElevatedAccess.ExplicitAccess(ComplianceCheck.setExplicitAccess.selector, false);
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.ExplicitAccessSet(blocker, ComplianceCheck.setBlocked.selector, true);
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.ExplicitAccessSet(blocker, ComplianceCheck.setExplicitAccess.selector, false);
        vm.prank(executor);
        compliance.setExplicitAccess(blocker, access);
        assertTrue(compliance.explicitFunctionAccess(blocker, ComplianceCheck.setBlocked.selector));

        vm.expectEmit(address(compliance));
        emit IComplianceCheck.ExplicitAccessSet(blocker, ComplianceCheck.setBlocked.selector, false);
        _grant(blocker, ComplianceCheck.setBlocked.selector, false);
        assertFalse(compliance.explicitFunctionAccess(blocker, ComplianceCheck.setBlocked.selector));
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

    function test_setBlocked_success_byGranteeUntilRevoked() public {
        vm.prank(blocker);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setBlocked(_accounts(), true);

        _grant(blocker, ComplianceCheck.setBlocked.selector, true);
        vm.prank(blocker);
        compliance.setBlocked(_accounts(), true);
        assertTrue(compliance.isBlocked(bob));
        vm.prank(blocker);
        compliance.setBlocked(_accounts(), false);
        assertFalse(compliance.isBlocked(bob));

        _grant(blocker, ComplianceCheck.setBlocked.selector, false);
        vm.prank(blocker);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setBlocked(_accounts(), true);
    }

    function test_setBlocked_fail_otherSelectorGranted() public {
        _grant(blocker, ComplianceCheck.setExplicitAccess.selector, true);
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
        vm.prank(alice);
        compliance.acceptExecutor();
        assertEq(compliance.executor(), alice);

        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setBlocked(_accounts(), true);
    }

    /// @dev A proposeNewExecutor grant lets the grantee take the executor role.
    function test_setExplicitAccess_proposeNewExecutorGrantHandsOverExecutor() public {
        _grant(blocker, IExecutorAccess.proposeNewExecutor.selector, true);

        vm.expectEmit(address(compliance));
        emit IExecutorAccess.NewExecutorProposed(executor, address(0), blocker);
        vm.prank(blocker);
        compliance.proposeNewExecutor(blocker);
        vm.prank(blocker);
        compliance.acceptExecutor();

        assertEq(compliance.executor(), blocker);
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setBlocked(_accounts(), true);
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
