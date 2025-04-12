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
    event AuctionCreated(bytes32 id, address auction);

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
    function test_access_createAuction() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        factory.createAuction(usdcToken, NAME_ONE);
    }
}

contract SpiceAuctionFactoryTest is SpiceAuctionFactoryTestBase {
    // function test_deploy() public {
    //     address auction = deployer.deploy(address(TGLD), address(SPICE_TOKEN_A), executor, executor, executor,
    //         11, 1, AUCTION_A_NAME);
    //     assertNotEq(auction, address(0));
    //     address auction2 = deployer.deploy(address(TGLD), address(SPICE_TOKEN_A), executor, executor, executor,
    //         11, 1, AUCTION_A_NAME);
    //     assertNotEq(auction2, address(0));
    //     assertEq(auction.code, auction2.code);
    // }

    function test_createAuction() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        factory.createAuction(address(0), NAME_ONE);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        factory.createAuction(address(templeGold), NAME_ONE);

        address auction = factory.createAuction(usdcToken, NAME_ONE);
        assertFalse(auction == address(0));
        bytes32 id = factory.getPairId(usdcToken);
        assertEq(auction, factory.findAuctionForSpiceToken(usdcToken));
        assertEq(factory.deployedAuctions(id), auction);

        // deploy same spice token again. new auction address is stored
        address oldAuction = auction;
        auction = factory.createAuction(usdcToken, NAME_ONE);
        assertFalse(auction == address(0));
        id = factory.getPairId(usdcToken);
        assertNotEq(oldAuction, factory.deployedAuctions(id));
        assertEq(auction, factory.findAuctionForSpiceToken(usdcToken));
        assertEq(factory.deployedAuctions(id), auction);
        assertEq(oldAuction.code, auction.code);

        ISpiceAuction spiceAuction = ISpiceAuction(auction);
        assertEq(spiceAuction.name(), NAME_ONE);
        assertEq(spiceAuction.spiceToken(), usdcToken);
        assertEq(spiceAuction.templeGold(), address(templeGold));
        assertEq(spiceAuction.daoExecutor(), executor);
        assertEq(spiceAuction.operator(), mike);
        assertEq(spiceAuction.strategyGnosis(), cssGnosis);
    }

    function test_getPairId() public {
        vm.startPrank(executor);
        address auction = factory.createAuction(usdcToken, NAME_ONE);
        bytes32 id = factory.getPairId(usdcToken);
        assertEq(auction, factory.findAuctionForSpiceToken(usdcToken));
        assertEq(factory.deployedAuctions(id), auction);
        
        auction = factory.createAuction(daiToken, NAME_ONE);
        id = factory.getPairId(daiToken);
        assertEq(auction, factory.findAuctionForSpiceToken(daiToken));
        assertEq(factory.deployedAuctions(id), auction);

        // get id of token < templeGold. test coverage
        id = factory.getPairId(fakeToken);
    }
}