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
        assertFalse(compliance.isFlagged(alice));
        assertFalse(compliance.explicitFunctionAccess(flagger, ComplianceCheck.setFlagged.selector));
    }

    function test_access_setFlagged() public {
        expectElevatedAccess();
        compliance.setFlagged(_accounts(), true);
    }

    function test_access_setExplicitAccess() public {
        expectElevatedAccess();
        compliance.setExplicitAccess(flagger, _access(ComplianceCheck.setFlagged.selector, true));

        // A grantee can't widen its own access.
        _grant(flagger, ComplianceCheck.setFlagged.selector, true);
        vm.prank(flagger);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setExplicitAccess(flagger, _access(ComplianceCheck.setExplicitAccess.selector, true));

        // Nor can a grant of setExplicitAccess itself reach it: only the executor can.
        _grant(flagger, ComplianceCheck.setExplicitAccess.selector, true);
        vm.prank(flagger);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setExplicitAccess(alice, _access(ComplianceCheck.setFlagged.selector, true));
    }

    function test_setExplicitAccess_fail_zeroAddress() public {
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        compliance.setExplicitAccess(address(0), _access(ComplianceCheck.setFlagged.selector, true));
    }

    function test_setExplicitAccess_success_grantAndRevoke() public {
        ITempleElevatedAccess.ExplicitAccess[] memory access = new ITempleElevatedAccess.ExplicitAccess[](2);
        access[0] = ITempleElevatedAccess.ExplicitAccess(ComplianceCheck.setFlagged.selector, true);
        access[1] = ITempleElevatedAccess.ExplicitAccess(ComplianceCheck.setExplicitAccess.selector, false);
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.ExplicitAccessSet(flagger, ComplianceCheck.setFlagged.selector, true);
        vm.expectEmit(address(compliance));
        emit IComplianceCheck.ExplicitAccessSet(flagger, ComplianceCheck.setExplicitAccess.selector, false);
        vm.prank(executor);
        compliance.setExplicitAccess(flagger, access);
        assertTrue(compliance.explicitFunctionAccess(flagger, ComplianceCheck.setFlagged.selector));

        vm.expectEmit(address(compliance));
        emit IComplianceCheck.ExplicitAccessSet(flagger, ComplianceCheck.setFlagged.selector, false);
        _grant(flagger, ComplianceCheck.setFlagged.selector, false);
        assertFalse(compliance.explicitFunctionAccess(flagger, ComplianceCheck.setFlagged.selector));
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

    function test_setFlagged_success_byGranteeUntilRevoked() public {
        vm.prank(flagger);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setFlagged(_accounts(), true);

        _grant(flagger, ComplianceCheck.setFlagged.selector, true);
        vm.prank(flagger);
        compliance.setFlagged(_accounts(), true);
        assertTrue(compliance.isFlagged(bob));
        vm.prank(flagger);
        compliance.setFlagged(_accounts(), false);
        assertFalse(compliance.isFlagged(bob));

        _grant(flagger, ComplianceCheck.setFlagged.selector, false);
        vm.prank(flagger);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setFlagged(_accounts(), true);
    }

    function test_setFlagged_fail_otherSelectorGranted() public {
        _grant(flagger, ComplianceCheck.setExplicitAccess.selector, true);
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
        vm.prank(alice);
        compliance.acceptExecutor();
        assertEq(compliance.executor(), alice);

        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setFlagged(_accounts(), true);
    }

    /// @dev A proposeNewExecutor grant lets the grantee take the executor role.
    function test_setExplicitAccess_proposeNewExecutorGrantHandsOverExecutor() public {
        _grant(flagger, IExecutorAccess.proposeNewExecutor.selector, true);

        vm.expectEmit(address(compliance));
        emit IExecutorAccess.NewExecutorProposed(executor, address(0), flagger);
        vm.prank(flagger);
        compliance.proposeNewExecutor(flagger);
        vm.prank(flagger);
        compliance.acceptExecutor();

        assertEq(compliance.executor(), flagger);
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        compliance.setFlagged(_accounts(), true);
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
