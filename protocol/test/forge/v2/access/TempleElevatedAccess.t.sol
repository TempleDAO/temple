pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/* solhint-disable func-name-mixedcase */
contract Mock is TempleElevatedAccess {
    constructor(
        address _initialRescuer,
        address _initialExecutor
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    // solhint-disable-next-line no-empty-blocks
    {}

    // solhint-disable-next-line no-empty-blocks
    function validateOnlyElevatedAccess() public view onlyElevatedAccess {}

    // solhint-disable-next-line no-empty-blocks
    function validateOnlyInRescueMode() public view onlyInRescueMode {}

    function checkSig() public view {
        validateOnlyElevatedAccess();
    }

    function checkSigThis() public view {
        this.validateOnlyElevatedAccess();
    }
}

contract TempleElevatedAccessTestBase is TempleTest {
    Mock public mock;

    function setUp() public {
        mock = new Mock(rescuer, executor);
    }

    function test_initialization() public {
        assertEq(mock.rescuers(rescuer), true);
        assertEq(mock.rescuers(executor), false);
        assertEq(mock.executors(rescuer), false);
        assertEq(mock.executors(executor), true);
        assertEq(mock.inRescueMode(), false);
    }
}

contract TempleElevatedAccessTest is TempleElevatedAccessTestBase {
    function test_access_setRescueMode() public {
        expectElevatedAccess();
        mock.setRescueMode(true);

        // Still not for the executor
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.setRescueMode(true);

        vm.prank(rescuer);
        mock.setRescueMode(true);
    }

    function test_access_setRescuer() public {
        expectElevatedAccess();
        mock.setRescuer(alice, false);
    }

    function test_access_setExecutor() public {
        expectElevatedAccess();
        mock.setExecutor(alice, false);
    }
    
    function test_access_setExplicitAccess() public {
        expectElevatedAccess();
        mock.setExplicitAccess(alice, msg.sig, false);
    }
}

contract TempleElevatedAccessTestSetters is TempleElevatedAccessTestBase {

    event ExecutorSet(address indexed account, bool indexed value);
    event RescuerSet(address indexed account, bool indexed value);
    event ExplicitAccessSet(address indexed account, bytes4 indexed fnSelector, bool indexed value);
    event RescueModeSet(bool indexed value);

    function test_setRescueMode() public {
        assertEq(mock.inRescueMode(), false);
        vm.startPrank(rescuer);

        vm.expectEmit();
        emit RescueModeSet(true);
        mock.setRescueMode(true);
        assertEq(mock.inRescueMode(), true);

        vm.expectEmit();
        emit RescueModeSet(false);
        mock.setRescueMode(false);
        assertEq(mock.inRescueMode(), false);
    }

    function test_setRescuer() public {
        assertEq(mock.rescuers(alice), false);
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        mock.setRescuer(address(0), true);

        vm.expectEmit();
        emit RescuerSet(alice, true);
        mock.setRescuer(alice, true);
        assertEq(mock.rescuers(alice), true);

        vm.expectEmit();
        emit RescuerSet(alice, false);
        mock.setRescuer(alice, false);
        assertEq(mock.rescuers(alice), false);
    }

    function test_setExecutor() public {
        assertEq(mock.executors(alice), false);
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        mock.setExecutor(address(0), true);

        vm.expectEmit();
        emit ExecutorSet(alice, true);
        mock.setExecutor(alice, true);
        assertEq(mock.executors(alice), true);

        vm.expectEmit();
        emit ExecutorSet(alice, false);
        mock.setExecutor(alice, false);
        assertEq(mock.executors(alice), false);
    }

    function test_setExplicitAccess() public {
        bytes4 fnSig = bytes4(keccak256("someFunctionSignature(uint256)"));
        bytes4 fnSig2 = bytes4(keccak256("someFunctionSignature(uint256,string)"));
        assertEq(mock.explicitFunctionAccess(alice, fnSig), false);
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        mock.setExplicitAccess(address(0), msg.sig, true);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        mock.setExplicitAccess(alice, bytes4(0), true);

        vm.expectEmit();
        emit ExplicitAccessSet(alice, fnSig, true);
        mock.setExplicitAccess(alice, fnSig, true);
        assertEq(mock.explicitFunctionAccess(alice, fnSig), true);
        assertEq(mock.explicitFunctionAccess(alice, fnSig2), false);

        vm.expectEmit();
        emit ExplicitAccessSet(alice, fnSig, false);
        mock.setExplicitAccess(alice, fnSig, false);
        assertEq(mock.explicitFunctionAccess(alice, fnSig), false);
        assertEq(mock.explicitFunctionAccess(alice, fnSig2), false);
    }
}

contract TempleElevatedAccessTestModifiers is TempleElevatedAccessTestBase {
    function test_onlyInRescueMode() public {
        // No access for alice or executor
        {
            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.validateOnlyInRescueMode();

            changePrank(executor);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.validateOnlyInRescueMode();
        }

        // No access for rescuer until they first set rescue mode.
        {
            changePrank(rescuer);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.validateOnlyInRescueMode();

            mock.setRescueMode(true);
            mock.validateOnlyInRescueMode();
        }

        // Still no access for alice or executor
        {
            changePrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.validateOnlyInRescueMode();

            changePrank(executor);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.validateOnlyInRescueMode();
        }
    }

    function test_onlyElevatedAccess_notInRescueMode() public {
        // When NOT in rescue mode, only the executor (or explicit access) can call.
        assertEq(mock.inRescueMode(), false);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.validateOnlyElevatedAccess();

        changePrank(rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.validateOnlyElevatedAccess();

        // The executor has access
        changePrank(executor);
        mock.validateOnlyElevatedAccess();

        // Set alice to now have explicit access too
        mock.setExplicitAccess(alice, Mock.validateOnlyElevatedAccess.selector, true);
        changePrank(alice);
        mock.validateOnlyElevatedAccess();
    }

    function test_onlyElevatedAccess_inRescueMode() public {
        // When IN rescue mode, only the rescuer can call.
        vm.startPrank(rescuer);
        mock.setRescueMode(true);
        assertEq(mock.inRescueMode(), true);

        changePrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.validateOnlyElevatedAccess();

        changePrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.validateOnlyElevatedAccess();

        // The rescuer has access
        changePrank(rescuer);
        mock.validateOnlyElevatedAccess();

        // Set alice to now have explicit access too -- but still no access
        mock.setExplicitAccess(alice, Mock.validateOnlyElevatedAccess.selector, true);
        changePrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.validateOnlyElevatedAccess();
    }

    function test_onlyElevatedAccess_explicitExternal() public {
        // When NOT in rescue mode, only the executor (or explicit access) can call.
        assertEq(mock.inRescueMode(), false);

        // When not using `this.`, have to set to the external function we are calling
        // ie checkSig()
        {
            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.checkSig();

            changePrank(executor);
            mock.setExplicitAccess(alice, Mock.checkSig.selector, true);

            changePrank(alice);
            mock.checkSig();
        }

        // When using `this.`, have to set it to the thing which calls that external function
        // ie the mock contract calling validateOnlyElevatedAccess()
        {
            changePrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.checkSigThis();

            changePrank(executor);
            mock.setExplicitAccess(address(mock), Mock.validateOnlyElevatedAccess.selector, true);

            changePrank(alice);
            mock.checkSigThis();
        }
    }
}