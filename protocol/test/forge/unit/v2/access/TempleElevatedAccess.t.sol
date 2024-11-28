pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { TempleElevatedAccess, ITempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
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

    // A magic function with a signature of 0x00000000
    function wycpnbqcyf() external view onlyElevatedAccess {}
}

contract TempleElevatedAccessTestBase is TempleTest {
    Mock public mock;

    function setUp() public {
        mock = new Mock(rescuer, executor);
    }

    function test_initialization() public {
        assertEq(mock.rescuer(), rescuer);
        assertEq(mock.executor(), executor);
        assertEq(mock.inRescueMode(), false);
    }

    function test_construction_fail() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        mock = new Mock(address(0), executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        mock = new Mock(rescuer, address(0));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        mock = new Mock(rescuer, rescuer);
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

    function test_access_proposeNewRescuer() public {
        expectElevatedAccess();
        mock.proposeNewRescuer(alice);

        // Still not for the executor
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.proposeNewRescuer(alice);

        vm.prank(rescuer);
        mock.proposeNewRescuer(alice);
    }

    function test_access_proposeNewExecutor() public {
        expectElevatedAccess();
        mock.proposeNewExecutor(alice);

        // ok for executor and rescuer (when in rescue mode)
        vm.prank(executor);
        mock.proposeNewExecutor(alice);

        vm.startPrank(rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.proposeNewExecutor(alice);

        mock.setRescueMode(true);
        mock.proposeNewExecutor(alice);
    }

    function test_access_acceptRescuer() public {
        expectElevatedAccess();
        mock.acceptRescuer();

        // Not for executor or rescuer
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.acceptRescuer();

        vm.prank(rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.acceptRescuer();
    }

    function test_access_acceptExecutor() public {
        expectElevatedAccess();
        mock.acceptExecutor();

        // Not for executor or rescuer
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.acceptExecutor();

        vm.prank(rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.acceptExecutor();
    }
    
    function test_access_setExplicitAccess() public {
        expectElevatedAccess();
        setExplicitAccess(mock, alice, msg.sig, true);
    }
}

contract TempleElevatedAccessTestSetters is TempleElevatedAccessTestBase {
    event ExplicitAccessSet(address indexed account, bytes4 indexed fnSelector, bool indexed value);
    event RescueModeSet(bool indexed value);

    event NewRescuerProposed(address indexed oldRescuer, address indexed oldProposedRescuer, address indexed newProposedRescuer);
    event NewRescuerAccepted(address indexed oldRescuer, address indexed newRescuer);

    event NewExecutorProposed(address indexed oldExecutor, address indexed oldProposedExecutor, address indexed newProposedExecutor);
    event NewExecutorAccepted(address indexed oldExecutor, address indexed newExecutor);

    function test_setRescueMode() public {
        assertEq(mock.inRescueMode(), false);
        vm.startPrank(rescuer);

        vm.expectEmit(address(mock));
        emit RescueModeSet(true);
        mock.setRescueMode(true);
        assertEq(mock.inRescueMode(), true);

        vm.expectEmit(address(mock));
        emit RescueModeSet(false);
        mock.setRescueMode(false);
        assertEq(mock.inRescueMode(), false);
    }

    function test_newRescuer() public {
        vm.startPrank(rescuer);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        mock.proposeNewRescuer(address(0));

        vm.expectEmit(address(mock));
        emit NewRescuerProposed(rescuer, address(0), alice);
        mock.proposeNewRescuer(alice);

        vm.startPrank(alice);
        vm.expectEmit(address(mock));
        emit NewRescuerAccepted(rescuer, alice);
        mock.acceptRescuer();
        assertEq(mock.rescuer(), alice);
    }

    function test_newRescuer_failNotTheSame() public {
        vm.startPrank(rescuer);

        vm.expectEmit(address(mock));
        emit NewRescuerProposed(rescuer, address(0), executor);
        mock.proposeNewRescuer(executor);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        mock.acceptRescuer();
    }

    function test_newExecutor() public {
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        mock.proposeNewExecutor(address(0));

        vm.expectEmit(address(mock));
        emit NewExecutorProposed(executor, address(0), alice);
        mock.proposeNewExecutor(alice);

        vm.startPrank(alice);
        vm.expectEmit(address(mock));
        emit NewExecutorAccepted(executor, alice);
        mock.acceptExecutor();
        assertEq(mock.executor(), alice);
    }

    function test_newExecutor_failNotTheSame() public {
        vm.startPrank(executor);

        vm.expectEmit(address(mock));
        emit NewExecutorProposed(executor, address(0), rescuer);
        mock.proposeNewExecutor(rescuer);

        vm.startPrank(rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        mock.acceptExecutor();
    }

    function test_setExplicitAccess_single() public {
        bytes4 fnSig = bytes4(keccak256("someFunctionSignature(uint256)"));
        bytes4 fnSig2 = bytes4(keccak256("someFunctionSignature(uint256,string)"));
        assertEq(mock.explicitFunctionAccess(alice, fnSig), false);
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        setExplicitAccess(mock, address(0), msg.sig, true);

        vm.expectEmit(address(mock));
        emit ExplicitAccessSet(alice, fnSig, true);
        setExplicitAccess(mock, alice, fnSig, true);
        assertEq(mock.explicitFunctionAccess(alice, fnSig), true);
        assertEq(mock.explicitFunctionAccess(alice, fnSig2), false);

        vm.expectEmit(address(mock));
        emit ExplicitAccessSet(alice, fnSig, false);
        setExplicitAccess(mock, alice, fnSig, false);
        assertEq(mock.explicitFunctionAccess(alice, fnSig), false);
        assertEq(mock.explicitFunctionAccess(alice, fnSig2), false);
    }

    function test_setExplicitAccess_zeroSig() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.wycpnbqcyf();

        vm.startPrank(executor);
        bytes4 fnSig = bytes4(keccak256("wycpnbqcyf()"));
        vm.expectEmit(address(mock));
        emit ExplicitAccessSet(alice, fnSig, true);
        setExplicitAccess(mock, alice, fnSig, true);

        // Now succeeds
        vm.startPrank(alice);
        mock.wycpnbqcyf();
    }

    function test_setExplicitAccess_multiple() public {
        bytes4 fnSig = bytes4(keccak256("someFunctionSignature(uint256)"));
        bytes4 fnSig2 = bytes4(keccak256("someFunctionSignature(uint256,string)"));
        assertEq(mock.explicitFunctionAccess(alice, fnSig), false);
        vm.startPrank(executor);

        // Single
        setExplicitAccess(mock, alice, fnSig, true);

        // Now update to switch
        ITempleElevatedAccess.ExplicitAccess[] memory access = new ITempleElevatedAccess.ExplicitAccess[](2);
        access[0] = ITempleElevatedAccess.ExplicitAccess(fnSig, false);
        access[1] = ITempleElevatedAccess.ExplicitAccess(fnSig2, true);

        vm.expectEmit(address(mock));
        emit ExplicitAccessSet(alice, fnSig, false);
        emit ExplicitAccessSet(alice, fnSig2, true);
        mock.setExplicitAccess(alice, access);
        assertEq(mock.explicitFunctionAccess(alice, fnSig), false);
        assertEq(mock.explicitFunctionAccess(alice, fnSig2), true);
    }
}

contract TempleElevatedAccessTestModifiers is TempleElevatedAccessTestBase {
    function test_onlyInRescueMode() public {
        // No access for alice or executor
        {
            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.validateOnlyInRescueMode();

            vm.startPrank(executor);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.validateOnlyInRescueMode();
        }

        // No access for rescuer until they first set rescue mode.
        {
            vm.startPrank(rescuer);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.validateOnlyInRescueMode();

            mock.setRescueMode(true);
            mock.validateOnlyInRescueMode();
        }

        // Still no access for alice or executor
        {
            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.validateOnlyInRescueMode();

            vm.startPrank(executor);
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

        vm.startPrank(rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.validateOnlyElevatedAccess();

        // The executor has access
        vm.startPrank(executor);
        mock.validateOnlyElevatedAccess();

        // Set alice to now have explicit access too
        setExplicitAccess(mock, alice, Mock.validateOnlyElevatedAccess.selector, true);
        vm.startPrank(alice);
        mock.validateOnlyElevatedAccess();
    }

    function test_onlyElevatedAccess_inRescueMode() public {
        // When IN rescue mode, only the rescuer can call.
        vm.startPrank(rescuer);
        mock.setRescueMode(true);
        assertEq(mock.inRescueMode(), true);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.validateOnlyElevatedAccess();

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mock.validateOnlyElevatedAccess();

        // The rescuer has access
        vm.startPrank(rescuer);
        mock.validateOnlyElevatedAccess();

        // Set alice to now have explicit access too -- but still no access
        setExplicitAccess(mock, alice, Mock.validateOnlyElevatedAccess.selector, true);
        vm.startPrank(alice);
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

            vm.startPrank(executor);
            setExplicitAccess(mock, alice, Mock.checkSig.selector, true);

            vm.startPrank(alice);
            mock.checkSig();
        }

        // When using `this.`, have to set it to the thing which calls that external function
        // ie the mock contract calling validateOnlyElevatedAccess()
        {
            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            mock.checkSigThis();

            vm.startPrank(executor);
            setExplicitAccess(mock, address(mock), Mock.validateOnlyElevatedAccess.selector, true);

            vm.startPrank(alice);
            mock.checkSigThis();
        }
    }
}