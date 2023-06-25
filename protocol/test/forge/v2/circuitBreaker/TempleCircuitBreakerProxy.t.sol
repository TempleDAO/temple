pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";

import { TempleCircuitBreakerAllUsersPerPeriod } from "contracts/v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol";
import { TempleCircuitBreakerProxy } from "contracts/v2/circuitBreaker/TempleCircuitBreakerProxy.sol";
import { TempleCircuitBreakerIdentifiers } from "contracts/v2/circuitBreaker/TempleCircuitBreakerIdentifiers.sol";
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

    event CircuitBreakerSet(bytes32 indexed identifier, address indexed token, address circuitBreaker);

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

    function test_access_setCircuitBreaker() public {
        expectElevatedAccess();
        circuitBreakerProxy.setCircuitBreaker(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(templeToken), address(templeCircuitBreaker));
    }

    function test_access_preCheck() public {
        expectElevatedAccess();
        circuitBreakerProxy.preCheck(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(templeToken), address(0), 100);
    }

    function test_setCircuitBreaker() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        circuitBreakerProxy.setCircuitBreaker(bytes32(""), address(templeToken), address(templeCircuitBreaker));

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        circuitBreakerProxy.setCircuitBreaker(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(templeToken), address(0));

        vm.expectEmit(address(circuitBreakerProxy));
        emit CircuitBreakerSet(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(templeToken), address(daiCircuitBreaker));
        circuitBreakerProxy.setCircuitBreaker(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(templeToken), address(daiCircuitBreaker));

        bytes32[] memory ids = circuitBreakerProxy.identifiers();
        assertEq(ids.length, 1);
        assertEq(ids[0], TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS);
    }

    function setupProxy() internal {
        vm.startPrank(executor);
        circuitBreakerProxy.setCircuitBreaker(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(templeToken), address(templeCircuitBreaker));
        circuitBreakerProxy.setCircuitBreaker(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(daiToken), address(daiCircuitBreaker));

        setExplicitAccess(templeCircuitBreaker, address(circuitBreakerProxy), templeCircuitBreaker.preCheck.selector, true);
        setExplicitAccess(daiCircuitBreaker, address(circuitBreakerProxy), daiCircuitBreaker.preCheck.selector, true);
        setExplicitAccess(circuitBreakerProxy, caller, circuitBreakerProxy.preCheck.selector, true);
        vm.stopPrank();
    }

    function test_preCheck_unknownId() public {
        setupProxy();

        vm.startPrank(caller);
        vm.expectRevert();
        circuitBreakerProxy.preCheck(keccak256("UNKNOWN"), address(daiToken), alice, 100);
    }

    function test_preCheck_unknownToken() public {
        setupProxy();

        vm.startPrank(caller);
        vm.expectRevert();
        circuitBreakerProxy.preCheck(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, bob, alice, 100);
    }

    function test_preCheck_success() public {
        setupProxy();
        vm.startPrank(caller);
        circuitBreakerProxy.preCheck(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(daiToken), alice, 1_000e18);

        // Can't borrow any more dai
        vm.expectRevert(abi.encodeWithSelector(TempleCircuitBreakerAllUsersPerPeriod.CapBreached.selector, 2_000e18, 1_000e18));
        circuitBreakerProxy.preCheck(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(daiToken), alice, 1_000e18);

        // Can borrow temple though
        circuitBreakerProxy.preCheck(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(templeToken), alice, 1_000e18);

        // Can borrow more after waiting...
        vm.warp(block.timestamp + 2 days);
        circuitBreakerProxy.preCheck(TempleCircuitBreakerIdentifiers.EXTERNAL_ALL_USERS, address(daiToken), alice, 1_000e18);
    }
}