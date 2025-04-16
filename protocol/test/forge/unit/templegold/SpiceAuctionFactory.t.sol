pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/SpiceAuctionFactory.t.sol)

import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleGoldCommon } from "test/forge/unit/templegold/TempleGoldCommon.t.sol";
import { SpiceAuctionFactory } from "contracts/templegold/SpiceAuctionFactory.sol";
import { SpiceAuction } from "contracts/templegold/SpiceAuction.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";


contract SpiceAuctionFactoryTestBase is TempleGoldCommon {
    event SpiceAuctionImplementationSet(address implementation);
    event StrategyGnosisSet(address gnosis);
    event OperatorSet(address operator);
    event DaoExecutorSet(address executor);

    address internal fakeToken = makeAddr("fakeToken");

    address internal cssGnosis = makeAddr("cssGnosis");

    SpiceAuction internal implementation;

    SpiceAuctionFactory internal factory;

    TempleGold internal templeGold;

    uint256 internal constant DEFAULT_LZ_RECEIVE_EXECUTOR_GAS = 85_889;
    
    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);

        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();
        implementation = new SpiceAuction();
        templeGold = new TempleGold(initArgs);
        factory = new SpiceAuctionFactory(address(implementation), rescuer, executor, executor, mike, cssGnosis,
            address(templeGold), ARBITRUM_ONE_LZ_EID, uint32(arbitrumOneChainId));
    }

    function test_initialization() public view {
        assertEq(factory.executor(), executor);
        assertEq(factory.rescuer(), rescuer);
        assertEq(factory.daoExecutor(), executor);
        assertEq(factory.templeGold(), address(templeGold));
        assertEq(factory.operator(), mike);
        assertEq(factory.strategyGnosis(), cssGnosis);
        assertEq(address(factory.implementation()), address(implementation));
        assertEq(implementation.lzReceiveExecutorGas(), DEFAULT_LZ_RECEIVE_EXECUTOR_GAS);
    }
}

contract SpiceAuctionFactoryTestAccess is SpiceAuctionFactoryTestBase {

    function test_access_setOperator() public {
        _expectElevatedAccess();
        factory.setOperator(alice);
    }

    function test_access_setStrategyGnosis() public {
        _expectElevatedAccess();
        factory.setStrategyGnosis(alice);
    }

    function test_access_setDaoExecutor() public {
        _expectElevatedAccess();
        factory.setDaoExecutor(alice);
    }

    function test_access_setImplementation() public {
        _expectElevatedAccess();
        factory.setImplementation(alice);
    }

    function test_access_createAuction() public {
        _expectElevatedAccess();
        factory.createAuction(address(templeGold), NAME_ONE);
    }

}

contract SpiceAuctionFactoryTest is SpiceAuctionFactoryTestBase {
    
    function test_setImplementation_invalid_address() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        vm.startPrank(executor);
        factory.setImplementation(address(0));
    }

    function test_setOperator_invalid_address() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        vm.startPrank(executor);
        factory.setOperator(address(0));
    }

    function test_setStrategyGnosis_invalid_address() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        vm.startPrank(executor);
        factory.setStrategyGnosis(address(0));
    }

    function test_setDaoExecutor_invalid_address() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        vm.startPrank(executor);
        factory.setDaoExecutor(address(0));
    }

    function test_createAuction_invalid_address() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        factory.createAuction(address(0), NAME_ONE);
    }

    function test_createAuction_invalid_spice_token() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        factory.createAuction(address(templeGold), NAME_ONE);
    }

    function test_setStrategyGnosis() public {
        vm.startPrank(executor);
        vm.expectEmit(address(factory));
        emit StrategyGnosisSet(alice);
        factory.setStrategyGnosis(alice);
        assertEq(factory.strategyGnosis(), alice);
        
        vm.expectEmit(address(factory));
        emit StrategyGnosisSet(bob);
        factory.setStrategyGnosis(bob);
        assertEq(factory.strategyGnosis(), bob);
    }

    function test_setDaoExecutor() public {
        vm.startPrank(executor);
        vm.expectEmit(address(factory));
        emit DaoExecutorSet(alice);
        factory.setDaoExecutor(alice);

        assertEq(factory.daoExecutor(), alice);
        vm.expectEmit(address(factory));
        emit DaoExecutorSet(bob);
        factory.setDaoExecutor(bob);
        assertEq(factory.daoExecutor(), bob);
    }

    function test_setOperator() public {
        vm.startPrank(executor);
        vm.expectEmit(address(factory));
        emit OperatorSet(alice);
        factory.setOperator(alice);

        assertEq(factory.operator(), alice);
        vm.expectEmit(address(factory));
        emit OperatorSet(bob);
        factory.setOperator(bob);
        assertEq(factory.operator(), bob);
    }

    function test_setImplementation() public {
        vm.startPrank(executor);
        vm.expectEmit(address(factory));
        emit SpiceAuctionImplementationSet(address(implementation));
        factory.setImplementation(address(implementation));
        assertEq(factory.implementation(), address(implementation));

        SpiceAuction auction = new SpiceAuction();
        vm.expectEmit(address(factory));
        emit SpiceAuctionImplementationSet(address(auction));
        factory.setImplementation(address(auction));
        assertEq(factory.implementation(), address(auction));
    }

    function test_createAuction() public {
        vm.startPrank(executor);
        assertEq(factory.getLastAuctionVersion(usdcToken), 0);
        address auction = factory.createAuction(usdcToken, NAME_ONE);
        assertTrue(auction != address(0));
        assertEq(factory.getLastAuctionVersion(usdcToken), 1);
        uint256 version = factory.getLastAuctionVersion(usdcToken);
        assertEq(auction, factory.findAuctionForSpiceToken(usdcToken));
        assertEq(factory.deployedAuctions(usdcToken, version), auction);

        // deploy same spice token again. new auction address is stored as latest version
        address oldAuction = auction;
        auction = factory.createAuction(usdcToken, NAME_ONE);
        assertFalse(auction == address(0));
        version = factory.getLastAuctionVersion(usdcToken);
        assertEq(version, 2);
        assertEq(factory.deployedAuctions(usdcToken, 1), oldAuction);
        assertNotEq(oldAuction, factory.deployedAuctions(usdcToken, version));
        assertEq(auction, factory.findAuctionForSpiceToken(usdcToken));
        assertEq(factory.deployedAuctions(usdcToken, version), auction);
        assertEq(oldAuction.code, auction.code);

        ISpiceAuction spiceAuction = ISpiceAuction(auction);
        assertEq(spiceAuction.name(), NAME_ONE);
        assertEq(spiceAuction.spiceToken(), usdcToken);
        assertEq(spiceAuction.templeGold(), address(templeGold));
        assertEq(spiceAuction.daoExecutor(), executor);
        assertEq(spiceAuction.operator(), mike);
        assertEq(spiceAuction.strategyGnosis(), cssGnosis);
    }
}