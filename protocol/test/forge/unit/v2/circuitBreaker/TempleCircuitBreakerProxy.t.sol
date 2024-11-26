pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";

import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";
import { TempleCircuitBreakerProxy } from "contracts/v2/circuitBreaker/TempleCircuitBreakerProxy.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/* solhint-disable func-name-mixedcase, not-rely-on-time */
contract TempleCircuitBreakerProxyTest is TempleTest {
    TempleCircuitBreakerAllUsersPerPeriod public templeCircuitBreaker;
    TempleCircuitBreakerAllUsersPerPeriod public daiCircuitBreaker;
    TempleCircuitBreakerProxy public circuitBreakerProxy;

    FakeERC20 public daiToken;
    FakeERC20 public templeToken;
    address caller = makeAddr("caller");

    bytes32 public constant EXTERNAL_ALL_USERS = keccak256("EXTERNAL_USER");

    event CircuitBreakerSet(bytes32 indexed identifier, address indexed token, address circuitBreaker);
    event IdentifierForCallerSet(address indexed caller, string identifierString, bytes32 identifier);

    function setUp() public {
        daiToken = new FakeERC20("DAI Token", "DAI", executor, 500_000e18);
        templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 500_000e18);
        circuitBreakerProxy = new TempleCircuitBreakerProxy(rescuer, executor);
        templeCircuitBreaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 26 hours, 13, 1_000e18);
        daiCircuitBreaker = new TempleCircuitBreakerAllUsersPerPeriod(rescuer, executor, 26 hours, 13, 1_000e18);
    }

    function test_initialisation() public {
        assertEq(circuitBreakerProxy.executor(), executor);
        assertEq(circuitBreakerProxy.rescuer(), rescuer);
        bytes32[] memory ids = circuitBreakerProxy.identifiers();
        assertEq(ids.length, 0);
    }

    function test_access_setIdentifierForCaller() public {
        expectElevatedAccess();
        circuitBreakerProxy.setIdentifierForCaller(address(0), "EXTERNAL_USER");
    }

    function test_access_setCircuitBreaker() public {
        expectElevatedAccess();
        circuitBreakerProxy.setCircuitBreaker(EXTERNAL_ALL_USERS, address(templeToken), address(templeCircuitBreaker));
    }

    function test_access_preCheck() public {
        // Alice isn't mapped - so this will revert
        vm.startPrank(alice);
        vm.expectRevert();
        circuitBreakerProxy.preCheck(address(templeToken), address(0), 100);
    }

    function test_setIdentifierForCaller_failBadAddress() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        circuitBreakerProxy.setIdentifierForCaller(address(0), "");
    }

    function test_setIdentifierForCaller_failBadId() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        circuitBreakerProxy.setIdentifierForCaller(caller, "");
    }

    function test_setIdentifierForCaller_success() public {
        vm.startPrank(executor);
        vm.expectEmit(address(circuitBreakerProxy));
        emit IdentifierForCallerSet(caller, "EXTERNAL_USER", EXTERNAL_ALL_USERS);
        circuitBreakerProxy.setIdentifierForCaller(caller, "EXTERNAL_USER");

        bytes32[] memory ids = circuitBreakerProxy.identifiers();
        assertEq(ids.length, 1);
        assertEq(ids[0], EXTERNAL_ALL_USERS);
        assertEq(circuitBreakerProxy.callerToIdentifier(caller), EXTERNAL_ALL_USERS);
    }

    function test_setCircuitBreaker_failNoIdentifier() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        circuitBreakerProxy.setCircuitBreaker(EXTERNAL_ALL_USERS, address(templeToken), address(0));
    }

    function test_setCircuitBreaker_failNoCircuitBreaker() public {
        vm.startPrank(executor);
        circuitBreakerProxy.setIdentifierForCaller(caller, "EXTERNAL_USER");

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        circuitBreakerProxy.setCircuitBreaker(EXTERNAL_ALL_USERS, address(templeToken), address(0));
    }

    function test_setCircuitBreaker_success() public {
        vm.startPrank(executor);
        circuitBreakerProxy.setIdentifierForCaller(caller, "EXTERNAL_USER");

        vm.expectEmit(address(circuitBreakerProxy));
        emit CircuitBreakerSet(EXTERNAL_ALL_USERS, address(templeToken), address(daiCircuitBreaker));
        circuitBreakerProxy.setCircuitBreaker(EXTERNAL_ALL_USERS, address(templeToken), address(daiCircuitBreaker));

        assertEq(address(circuitBreakerProxy.circuitBreakers(EXTERNAL_ALL_USERS, address(templeToken))), address(daiCircuitBreaker));
    }

    function setupProxy() internal {
        vm.startPrank(executor);
        circuitBreakerProxy.setIdentifierForCaller(caller, "EXTERNAL_USER");
        circuitBreakerProxy.setCircuitBreaker(EXTERNAL_ALL_USERS, address(templeToken), address(templeCircuitBreaker));
        circuitBreakerProxy.setCircuitBreaker(EXTERNAL_ALL_USERS, address(daiToken), address(daiCircuitBreaker));

        setExplicitAccess(templeCircuitBreaker, address(circuitBreakerProxy), templeCircuitBreaker.preCheck.selector, true);
        setExplicitAccess(daiCircuitBreaker, address(circuitBreakerProxy), daiCircuitBreaker.preCheck.selector, true);
        vm.stopPrank();
    }

    function test_preCheck_unknownId() public {
        setupProxy();

        vm.startPrank(alice);
        vm.expectRevert();
        circuitBreakerProxy.preCheck(address(daiToken), alice, 100);
    }

    function test_preCheck_unknownToken() public {
        setupProxy();

        vm.startPrank(caller);
        vm.expectRevert();
        circuitBreakerProxy.preCheck(bob, alice, 100);
    }

    function test_preCheck_success() public {
        setupProxy();
        vm.startPrank(caller);
        circuitBreakerProxy.preCheck(address(daiToken), alice, 1_000e18);

        // Can't borrow any more dai
        vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 2_000e18, 1_000e18));
        circuitBreakerProxy.preCheck(address(daiToken), alice, 1_000e18);

        // Can borrow temple though
        circuitBreakerProxy.preCheck(address(templeToken), alice, 1_000e18);

        // Can borrow more after waiting...
        vm.warp(block.timestamp + 2 days);
        circuitBreakerProxy.preCheck(address(daiToken), alice, 1_000e18);
    }
}