pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { Governable } from "contracts/common/access/Governable.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

contract MockGovernable is Governable {
    constructor(address _initialGov) Governable(_initialGov) {}
}

contract GovernableTest is TempleTest {
    MockGovernable public governable;

    event NewGovernorProposed(address indexed previousGov, address indexed previousProposedGov, address indexed newProposedGov);
    event NewGovernorAccepted(address indexed previousGov, address indexed newGov);

    function setUp() public {
        governable = new MockGovernable(gov);
    }

    function test_invalidInit() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        governable = new MockGovernable(address(0));
    }

    function test_changeGov() public {
        assertEq(governable.gov(), gov);

        vm.startPrank(gov);      
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        governable.proposeNewGov(address(0));

        vm.expectEmit(true, true, true, true);
        emit NewGovernorProposed(gov, address(0), alice);
        governable.proposeNewGov(alice);

        assertEq(governable.gov(), gov);

        changePrank(alice);
        vm.expectEmit(true, true, true, true);
        emit NewGovernorAccepted(gov, alice);
        governable.acceptGov();
        assertEq(governable.gov(), alice);
    }
    
    function test_access_proposeNewGov() public {
        expectOnlyGov();
        governable.proposeNewGov(alice);
    }

    function test_access_acceptGov() public {
        vm.prank(gov);
        governable.proposeNewGov(alice);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        governable.acceptGov();
    }
}
