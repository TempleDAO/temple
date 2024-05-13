pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/SpiceAuctionFactory.t.sol)

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { SpiceAuctionFactory } from "contracts/templegold/SpiceAuctionFactory.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";

contract SpiceAuctionFactoryTestBase is TempleGoldCommon {
    event AuctionCreated(bytes32 id, address auction);

    address public fakeToken = makeAddr("fakeToken");
    SpiceAuctionFactory public factory;
    TempleGold public templeGold;
    
    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);

        ITempleGold.InitArgs memory initArgs;
        initArgs.executor = executor;
        initArgs.staking = address(0);
        initArgs.escrow = address(0);
        initArgs.gnosis = teamGnosis;
        initArgs.layerZeroEndpoint = layerZeroEndpointArbitrumOne;
        initArgs.mintChainId = arbitrumOneChainId;
        initArgs.name = TEMPLE_GOLD_NAME;
        initArgs.symbol = TEMPLE_GOLD_SYMBOL;

        templeGold = new TempleGold(initArgs);
        factory = new SpiceAuctionFactory(rescuer, executor, executor, address(templeGold));
    }

    function test_initialization() public {
        assertEq(factory.executor(), executor);
        assertEq(factory.rescuer(), rescuer);
        assertEq(factory.daoExecutor(), executor);
        assertEq(factory.templeGold(), address(templeGold));
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
    function test_createAuction() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        factory.createAuction(address(0), NAME_ONE);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        factory.createAuction(address(templeGold), NAME_ONE);

        address auction = factory.createAuction(usdcToken, NAME_ONE);
        bytes32 id = factory.getPairId(usdcToken);
        assertEq(auction, factory.findAuctionForSpiceToken(usdcToken));
        assertEq(factory.deployedAuctions(id), auction);
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