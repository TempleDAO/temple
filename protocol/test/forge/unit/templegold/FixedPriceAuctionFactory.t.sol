pragma solidity ^0.8.21;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { FixedPriceAuction } from "contracts/templegold/FixedPriceAuction.sol";
import { IFixedPriceAuctionFactory } from "contracts/interfaces/templegold/IFixedPriceAuctionFactory.sol";
import { FixedPriceAuctionFactory } from "contracts/templegold/FixedPriceAuctionFactory.sol";
import { FixedPriceAuctionTestBase } from "test/forge/unit/templegold/FixedPriceAuction.t.sol";
import { LibClone } from "solady/src/utils/LibClone.sol";

contract FixedPriceAuctionV2 is FixedPriceAuction {
    function version() external pure returns (uint256) {
        return 2;
    }
}

contract FixedPriceAuctionFactoryTest is FixedPriceAuctionTestBase {
    function test_initialization() public view {
        assertEq(factory.executor(), executor);
        assertEq(factory.proposedExecutor(), address(0));
        assertEq(factory.rescuer(), rescuer);
        assertEq(factory.proposedRescuer(), address(0));
        assertFalse(factory.inRescueMode());
        assertEq(factory.implementation(), address(implementation));
        assertEq(factory.proposedImplementation(), address(0));
    }

    function test_constructor_validation() public {
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        new FixedPriceAuctionFactory(address(0), rescuer, address(implementation));
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        new FixedPriceAuctionFactory(executor, address(0), address(implementation));
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        new FixedPriceAuctionFactory(executor, executor, address(implementation));
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        new FixedPriceAuctionFactory(executor, rescuer, alice);
    }

    function test_constructor_emitsImplementationSet() public {
        vm.expectEmit(vm.computeCreateAddress(address(this), vm.getNonce(address(this))));
        emit IFixedPriceAuctionFactory.ImplementationSet(address(implementation));
        new FixedPriceAuctionFactory(executor, rescuer, address(implementation));
    }

    function test_access_createAuction() public {
        bytes memory config = abi.encode(_config(address(tgld), address(usds), PRICE, 0));
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        factory.createAuction(config);
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        factory.createAuction(config);
    }

    function test_createAuction_rolesAndRecord() public {
        IFixedPriceAuction.AuctionConfig memory config = _config(address(tgld), address(usds), PRICE, 1e18);
        address expected = vm.computeCreateAddress(address(factory), vm.getNonce(address(factory)));
        vm.expectEmit(address(factory));
        emit IFixedPriceAuctionFactory.AuctionCreated(expected, address(implementation), abi.encode(config));
        FixedPriceAuction created = _create(config);
        assertEq(address(created), expected);

        assertTrue(factory.isAuction(address(created)));
        assertFalse(factory.isAuction(address(tgld)));
        assertFalse(factory.isAuction(address(implementation)));
        assertEq(created.executor(), executor);
        assertEq(created.rescuer(), rescuer);

        IFixedPriceAuction.AuctionConfig memory stored = created.getConfig();
        assertEq(abi.encode(stored), abi.encode(config));
    }

    function test_createAuction_fromEncodeConfig() public {
        IFixedPriceAuction.AuctionConfig memory config = _config(address(tgld), address(usds), PRICE, 1e18);
        bytes memory encoded = implementation.encodeConfig(config);
        vm.prank(executor);
        FixedPriceAuction created = FixedPriceAuction(factory.createAuction(encoded));
        assertEq(abi.encode(created.getConfig()), abi.encode(config));
    }

    function test_createAuction_executorIsTheCaller() public {
        vm.prank(executor);
        factory.proposeNewExecutor(alice);
        vm.warp(block.timestamp + factory.EXECUTOR_HANDOVER_DELAY());
        vm.prank(alice);
        factory.acceptExecutor();

        vm.prank(alice);
        FixedPriceAuction created = FixedPriceAuction(
            factory.createAuction(abi.encode(_config(address(tgld), address(usds), PRICE, 0)))
        );
        assertEq(created.executor(), alice);
        assertEq(created.rescuer(), rescuer);
    }

    function test_createAuction_pendingRescuerNotUsed() public {
        vm.prank(rescuer);
        factory.proposeNewRescuer(bob);
        FixedPriceAuction created = _create(_config(address(tgld), address(usds), PRICE, 0));
        assertEq(created.rescuer(), rescuer);
    }

    function _expectRevert(IFixedPriceAuction.AuctionConfig memory config, bytes4 selector) internal {
        vm.prank(executor);
        vm.expectRevert(selector);
        factory.createAuction(abi.encode(config));
    }

    function _expectInvalid(IFixedPriceAuction.AuctionConfig memory config) internal {
        _expectRevert(config, CommonEventsAndErrors.InvalidParam.selector);
    }

    function _expectInvalidAddress(IFixedPriceAuction.AuctionConfig memory config) internal {
        _expectRevert(config, CommonEventsAndErrors.InvalidAddress.selector);
    }

    function test_createAuction_configValidation() public {
        IFixedPriceAuction.AuctionConfig memory config = _config(address(tgld), address(usds), PRICE, 0);

        IFixedPriceAuction.AuctionConfig memory c = config;
        c.depositStart = uint64(block.timestamp);
        _expectInvalid(c);

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.depositEnd = c.depositStart;
        _expectInvalid(c);

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.fulfillmentEnd = c.depositEnd;
        _expectInvalid(c);

        // Strictly out of order, not just equal: a start in the past, a start after the end, an end after fulfillment.
        c = _config(address(tgld), address(usds), PRICE, 0);
        c.depositStart = uint64(block.timestamp - 1);
        _expectInvalid(c);

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.depositEnd = c.depositStart - 1;
        _expectInvalid(c);

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.fulfillmentEnd = c.depositEnd - 1;
        _expectInvalid(c);

        _expectInvalid(_config(address(tgld), address(tgld), PRICE, 0));
        _expectInvalid(_config(address(tgld), address(usds), 0, 0));

        // settledAt is a uint40 and may hold fulfillmentEnd, so fulfillmentEnd must fit; the bound itself is allowed.
        c = _config(address(tgld), address(usds), PRICE, 0);
        c.fulfillmentEnd = uint64(type(uint40).max) + 1;
        _expectInvalid(c);
        c.fulfillmentEnd = type(uint40).max;
        _create(c);

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.funder = address(0);
        _expectInvalidAddress(c);

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.proceedsRecipient = address(0);
        _expectInvalidAddress(c);

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.complianceCheck = address(0);
        _expectInvalidAddress(c);
        c.complianceCheck = alice;
        _expectInvalidAddress(c);
        c.complianceCheck = address(usds);
        _expectInvalidAddress(c);

        FakeERC20CustomDecimals wide = new FakeERC20CustomDecimals("Wide", "WIDE", address(0), 0, 19);
        _expectInvalid(_config(address(wide), address(usds), PRICE, 0));
        _expectInvalid(_config(address(tgld), address(wide), PRICE, 0));
        FakeERC20CustomDecimals narrow = new FakeERC20CustomDecimals("Narrow", "NARROW", address(0), 0, 5);
        _expectInvalid(_config(address(narrow), address(usds), PRICE, 0));
        _expectInvalid(_config(address(tgld), address(narrow), PRICE, 0));
    }

    function test_createAuction_fail_malformedConfig() public {
        bytes memory config = abi.encode(_config(address(tgld), address(usds), PRICE, 0));
        bytes memory short = new bytes(config.length - 32);
        for (uint256 i; i < short.length; ++i) {
            short[i] = config[i];
        }
        vm.prank(executor);
        // abi.decode of a short config reverts without data
        vm.expectRevert(bytes(""));
        factory.createAuction(short);

        vm.prank(executor);
        // abi.decode of an empty config reverts without data
        vm.expectRevert(bytes(""));
        factory.createAuction("");
    }

    function test_createAuction_emitsInitialComplianceCheck() public {
        vm.expectEmit(vm.computeCreateAddress(address(factory), vm.getNonce(address(factory))));
        emit IFixedPriceAuction.ComplianceCheckSet(address(compliance));
        _create(_config(address(tgld), address(usds), PRICE, 0));
    }

    function test_swapImplementation() public {
        FixedPriceAuctionV2 v2 = new FixedPriceAuctionV2();

        vm.expectEmit(address(factory));
        emit IFixedPriceAuctionFactory.ImplementationProposed(address(v2));
        vm.prank(executor);
        factory.proposeImplementation(address(v2));
        assertEq(factory.proposedImplementation(), address(v2));
        assertEq(factory.implementation(), address(implementation));

        vm.expectEmit(address(factory));
        emit IFixedPriceAuctionFactory.ImplementationSet(address(v2));
        vm.prank(rescuer);
        factory.acceptImplementation(address(v2));
        assertEq(factory.implementation(), address(v2));
        assertEq(factory.proposedImplementation(), address(0));

        FixedPriceAuctionV2 created =
            FixedPriceAuctionV2(address(_create(_config(address(tgld), address(usds), PRICE, 0))));
        assertEq(created.version(), 2);
        assertTrue(factory.isAuction(address(created)));
        assertEq(created.executor(), executor);
        assertEq(created.getConfig().bidToken, address(tgld));

        // The auction created before the swap keeps the old code, which has no version(): the call reverts
        // without data.
        vm.expectRevert(bytes(""));
        FixedPriceAuctionV2(address(auction)).version();
        assertTrue(factory.isAuction(address(auction)));
    }

    function test_swapImplementation_twoKeys() public {
        FixedPriceAuctionV2 v2 = new FixedPriceAuctionV2();

        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        factory.proposeImplementation(address(v2));
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        factory.proposeImplementation(address(v2));

        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        factory.acceptImplementation(address(v2));

        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        factory.proposeImplementation(alice);

        vm.prank(executor);
        factory.proposeImplementation(address(v2));
        vm.prank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        factory.acceptImplementation(address(v2));
        assertEq(factory.implementation(), address(implementation));

        // A later proposal replaces the earlier one.
        FixedPriceAuctionV2 v3 = new FixedPriceAuctionV2();
        vm.prank(executor);
        factory.proposeImplementation(address(v3));
        vm.prank(rescuer);
        factory.acceptImplementation(address(v3));
        assertEq(factory.implementation(), address(v3));
    }

    function test_acceptImplementation_fail_zeroWithNoProposal() public {
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        factory.acceptImplementation(address(0));
        assertEq(factory.implementation(), address(implementation));
    }

    function test_rescueMode_locksMsig() public {
        bytes memory config = abi.encode(_config(address(tgld), address(usds), PRICE, 0));
        FixedPriceAuctionV2 v2 = new FixedPriceAuctionV2();
        vm.prank(rescuer);
        factory.setRescueMode(true);

        vm.startPrank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        factory.createAuction(config);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        factory.proposeImplementation(address(v2));
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        factory.proposeNewExecutor(alice);
        vm.stopPrank();

        vm.prank(rescuer);
        factory.setRescueMode(false);

        vm.startPrank(executor);
        assertTrue(factory.isAuction(factory.createAuction(config)));
        factory.proposeImplementation(address(v2));
        factory.proposeNewExecutor(alice);
        vm.stopPrank();
        assertEq(factory.proposedImplementation(), address(v2));
        assertEq(factory.proposedExecutor(), alice);
    }

    function test_setRescueMode_cancelsExecutorProposal() public {
        _checkRescueModeCancelsExecutorProposal(factory);
    }

    function test_setRescueMode_offKeepsExecutorProposal() public {
        _checkRescueModeOffKeepsProposal(factory);
    }

    function test_setRescueMode_onWithNothingPendingEmitsOnce() public {
        _checkRescueModeOnEmitsOnlyRescueModeSet(factory);
    }

    function test_setRescueMode_cancelsImplementationProposal() public {
        FixedPriceAuctionV2 v2 = new FixedPriceAuctionV2();
        vm.prank(executor);
        factory.proposeImplementation(address(v2));

        vm.expectEmit(address(factory));
        emit IFixedPriceAuctionFactory.ImplementationProposed(address(0));
        vm.prank(rescuer);
        factory.setRescueMode(true);
        assertEq(factory.proposedImplementation(), address(0));

        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        factory.acceptImplementation(address(v2));
        assertEq(factory.implementation(), address(implementation));

        // Recovery: out of rescue mode, the msig re-proposes and the rescuer accepts.
        vm.prank(rescuer);
        factory.setRescueMode(false);
        vm.prank(executor);
        factory.proposeImplementation(address(v2));
        vm.prank(rescuer);
        factory.acceptImplementation(address(v2));
        FixedPriceAuction created = _create(_config(address(tgld), address(usds), PRICE, 0));
        assertEq(FixedPriceAuctionV2(address(created)).version(), 2);
    }

    function test_setRescueMode_offKeepsImplementationProposal() public {
        FixedPriceAuctionV2 v2 = new FixedPriceAuctionV2();
        vm.prank(executor);
        factory.proposeImplementation(address(v2));
        vm.prank(rescuer);
        factory.setRescueMode(false);
        assertEq(factory.proposedImplementation(), address(v2));
    }

    function test_rescuerHandover() public {
        vm.prank(rescuer);
        factory.proposeNewRescuer(bob);
        vm.prank(bob);
        factory.acceptRescuer();
        assertEq(factory.rescuer(), bob);
        assertEq(factory.proposedRescuer(), address(0));

        FixedPriceAuction created = _create(_config(address(tgld), address(usds), PRICE, 0));
        assertEq(created.rescuer(), bob);
        assertEq(auction.rescuer(), rescuer);

        // The new rescuer holds the factory's rescuer powers; the old one doesn't.
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        factory.setRescueMode(true);
        vm.prank(bob);
        factory.setRescueMode(true);
        assertTrue(factory.inRescueMode());
    }
}

/// @dev Random sequences of factory actions by whoever holds each role, with the factory's rules checked after
/// every step: implementations move only by acceptance, rescue mode locks the msig out and kills proposals, the
/// rescuer never gets msig powers, the roles never merge, and every auction is a clone of an accepted
/// implementation with the roles of its day.
contract FixedPriceAuctionFactoryFuzzTest is FixedPriceAuctionTestBase {
    uint256 internal constant STEPS = 40;

    address[3] internal impls;
    mapping(address impl => bool accepted) internal accepted;
    address[4] internal candidates;
    /// @dev The implementation the factory should have: changed only by a successful accept.
    address internal ghostImplementation;

    function test_fuzz_factoryRulesHold(uint256 seed) public {
        impls = [address(implementation), address(new FixedPriceAuctionV2()), address(new FixedPriceAuctionV2())];
        accepted[address(implementation)] = true;
        ghostImplementation = address(implementation);
        candidates = [executor, rescuer, alice, bob];

        for (uint256 i; i < STEPS; ++i) {
            _step(uint256(keccak256(abi.encode(seed, i))));
            assertEq(factory.implementation(), ghostImplementation, "implementation moved without an accept");
            assertTrue(factory.executor() != factory.rescuer(), "executor is the rescuer");
            if (factory.inRescueMode()) {
                assertEq(factory.proposedExecutor(), address(0), "executor proposal in rescue mode");
                assertEq(factory.proposedImplementation(), address(0), "implementation proposal in rescue mode");
            }
        }
    }

    function _step(uint256 r) internal {
        address exec = factory.executor();
        address resc = factory.rescuer();
        address impl = impls[(r >> 8) % 3];
        address candidate = candidates[(r >> 16) % 4];
        bool rescueMode = factory.inRescueMode();
        bool ok;
        uint256 op = r % 9;

        if (op == 0) {
            vm.prank(exec);
            try factory.proposeImplementation(impl) {
                ok = true;
            } catch { }
            assertEq(ok, !rescueMode, "msig proposal not gated on rescue mode");
            if (ok) assertEq(factory.proposedImplementation(), impl);
        } else if (op == 1) {
            // The rescuer accepts the proposal half the time, otherwise a random implementation.
            address target = (r >> 24) % 2 == 0 ? factory.proposedImplementation() : impl;
            address proposed = factory.proposedImplementation();
            vm.prank(resc);
            try factory.acceptImplementation(target) {
                ok = true;
            } catch { }
            assertEq(ok, target != address(0) && target == proposed, "accept not exactly the proposal");
            if (ok) {
                ghostImplementation = target;
                accepted[target] = true;
                assertEq(factory.proposedImplementation(), address(0), "proposal survived its accept");
            }
        } else if (op == 2) {
            vm.prank(resc);
            factory.setRescueMode((r >> 24) % 3 == 0);
        } else if (op == 3) {
            vm.prank(exec);
            try factory.createAuction(abi.encode(_config(address(tgld), address(usds), PRICE, 0))) returns (
                address created
            ) {
                ok = true;
                _checkCreated(FixedPriceAuction(created), exec, resc);
            } catch { }
            assertEq(ok, !rescueMode, "createAuction not gated on rescue mode");
        } else if (op == 4) {
            // The rescuer never has the msig's factory powers, in or out of rescue mode.
            vm.startPrank(resc);
            try factory.createAuction(abi.encode(_config(address(tgld), address(usds), PRICE, 0))) {
                ok = true;
            } catch { }
            try factory.proposeImplementation(impl) {
                ok = true;
            } catch { }
            try factory.proposeNewExecutor(resc) {
                ok = true;
            } catch { }
            vm.stopPrank();
            assertFalse(ok, "rescuer used an msig power");
        } else if (op == 5) {
            vm.prank(exec);
            try factory.proposeNewExecutor(candidate) {
                ok = true;
            } catch { }
            assertEq(ok, !rescueMode, "executor proposal not gated on rescue mode");
        } else if (op == 6) {
            address proposed = factory.proposedExecutor();
            if (proposed == address(0)) return;
            vm.warp(block.timestamp + factory.EXECUTOR_HANDOVER_DELAY());
            vm.prank(proposed);
            try factory.acceptExecutor() {
                ok = true;
            } catch { }
            assertEq(ok, proposed != resc, "acceptExecutor: only the rescuer is refused");
        } else if (op == 7) {
            vm.prank(resc);
            factory.proposeNewRescuer(candidate);
        } else {
            address proposed = factory.proposedRescuer();
            if (proposed == address(0)) return;
            vm.prank(proposed);
            try factory.acceptRescuer() {
                ok = true;
            } catch { }
            assertEq(ok, proposed != exec, "acceptRescuer: only the executor is refused");
        }
    }

    function _checkCreated(FixedPriceAuction created, address exec, address resc) internal {
        assertTrue(factory.isAuction(address(created)), "created auction not recorded");
        address impl = LibClone.implementationOf(address(created));
        assertEq(impl, factory.implementation(), "auction not a clone of the current implementation");
        assertTrue(accepted[impl], "auction cloned from an implementation nobody accepted");
        assertEq(created.executor(), exec, "auction executor isn't the factory's");
        assertEq(created.rescuer(), resc, "auction rescuer isn't the factory's");
        vm.expectRevert(IFixedPriceAuction.AlreadyInitialized.selector);
        created.initialize(alice, bob);
    }
}
