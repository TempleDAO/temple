pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";

import { IFixedPriceAuction } from "contracts/interfaces/templegold/IFixedPriceAuction.sol";
import { FixedPriceAuction } from "contracts/templegold/FixedPriceAuction.sol";
import { IAuctionFactory } from "contracts/interfaces/templegold/IAuctionFactory.sol";
import { AuctionFactory } from "contracts/templegold/AuctionFactory.sol";
import { FixedPriceAuctionTestBase } from "test/forge/unit/templegold/FixedPriceAuction.t.sol";

contract FixedPriceAuctionV2 is FixedPriceAuction {
    function version() external pure returns (uint256) {
        return 2;
    }
}

contract AuctionFactoryTest is FixedPriceAuctionTestBase {
    function test_initialization() public view {
        assertEq(factory.executor(), executor);
        assertEq(factory.proposedExecutor(), address(0));
        assertEq(factory.rescuer(), rescuer);
        assertEq(factory.proposedRescuer(), address(0));
        assertFalse(factory.inRescueMode());
        assertEq(factory.implementation(), address(implementation));
        assertEq(factory.proposedImplementation(), address(0));
    }

    function test_acceptExecutor_fail_rescuer() public {
        vm.prank(executor);
        factory.proposeNewExecutor(rescuer);
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        factory.acceptExecutor();
        assertEq(factory.executor(), executor);
    }

    function test_constructor_validation() public {
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        new AuctionFactory(address(0), rescuer, address(implementation));
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        new AuctionFactory(executor, address(0), address(implementation));
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        new AuctionFactory(executor, executor, address(implementation));
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        new AuctionFactory(executor, rescuer, alice);
    }

    function test_constructor_emitsImplementationSet() public {
        vm.expectEmit(vm.computeCreateAddress(address(this), vm.getNonce(address(this))));
        emit IAuctionFactory.ImplementationSet(address(implementation));
        new AuctionFactory(executor, rescuer, address(implementation));
    }

    function test_access_createAuction() public {
        bytes memory config = abi.encode(_config(address(tgld), address(usds), PRICE, 0));
        vm.prank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAccess.selector);
        factory.createAuction(config);
        expectElevatedAccess();
        factory.createAuction(config);
    }

    function test_createAuction_rolesAndRecord() public {
        IFixedPriceAuction.AuctionConfig memory config = _config(address(tgld), address(usds), PRICE, 1e18);
        address expected = vm.computeCreateAddress(address(factory), vm.getNonce(address(factory)));
        vm.expectEmit(address(factory));
        emit IAuctionFactory.AuctionCreated(expected, address(implementation), abi.encode(config));
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

    function test_createAuction_executorIsTheCaller() public {
        vm.prank(executor);
        factory.proposeNewExecutor(alice);
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

        _expectInvalid(_config(address(tgld), address(tgld), PRICE, 0));
        _expectInvalid(_config(address(tgld), address(usds), 0, 0));

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.funder = address(0);
        _expectInvalidAddress(c);

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.proceedsRecipient = address(0);
        _expectInvalidAddress(c);

        c = _config(address(tgld), address(usds), PRICE, 0);
        c.complianceCheck = address(0);
        _expectInvalidAddress(c);

        uint8 tooMany = implementation.MAX_TOKEN_DECIMALS() + 1;
        FakeERC20CustomDecimals wide = new FakeERC20CustomDecimals("Wide", "WIDE", address(0), 0, tooMany);
        _expectInvalid(_config(address(wide), address(usds), PRICE, 0));
        _expectInvalid(_config(address(tgld), address(wide), PRICE, 0));
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
        emit IAuctionFactory.ImplementationProposed(address(v2));
        vm.prank(executor);
        factory.proposeImplementation(address(v2));
        assertEq(factory.proposedImplementation(), address(v2));
        assertEq(factory.implementation(), address(implementation));

        vm.expectEmit(address(factory));
        emit IAuctionFactory.ImplementationSet(address(v2));
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
        expectElevatedAccess();
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

    function test_acceptImplementation_fail_staleProposal() public {
        FixedPriceAuctionV2 a = new FixedPriceAuctionV2();
        FixedPriceAuctionV2 b = new FixedPriceAuctionV2();
        vm.startPrank(executor);
        factory.proposeImplementation(address(a));
        factory.proposeImplementation(address(b));
        vm.stopPrank();

        vm.startPrank(rescuer);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        factory.acceptImplementation(address(a));
        factory.acceptImplementation(address(b));
        vm.stopPrank();
        assertEq(factory.implementation(), address(b));
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
        emit IAuctionFactory.ImplementationProposed(address(0));
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
