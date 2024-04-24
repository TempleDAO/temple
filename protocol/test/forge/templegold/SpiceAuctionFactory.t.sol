pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/SpiceAuctionFactory.t.sol)

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { SpiceAuctionFactory } from "contracts/templegold/SpiceAuctionFactory.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { ISpiceAuctionFactory } from "contracts/interfaces/templegold/ISpiceAuctionFactory.sol";

contract SpiceAuctionFactoryTestBase is TempleGoldCommon {
    event AuctionCreated(bytes32 id, address auction);

    SpiceAuctionFactory public factory;
    TempleGold public templeGold;

    string public constant NAME_ONE = "SPICE_AUCTION_TGLD_USDC";
    string public constant NAME_TWO = "SPICE_AUCTION_TGLD_DAI";
    
    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);
        factory = new SpiceAuctionFactory(rescuer, executor, executor);
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
    }

    function test_initialization() public {
        assertEq(factory.executor(), executor);
        assertEq(factory.rescuer(), rescuer);
        assertEq(factory.daoExecutor(), executor);
    }
}

contract SpiceAuctionFactoryTestAccess is SpiceAuctionFactoryTestBase {
    function test_access_createAuction() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        factory.createAuction(usdcToken, address(templeGold), NAME_ONE);
    }
}

contract SpiceAuctionFactoryTest is SpiceAuctionFactoryTestBase {
    function test_createAuction() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        factory.createAuction(address(0), address(templeGold), NAME_ONE);
        
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        factory.createAuction(usdcToken, address(0), NAME_ONE);

        address auction = factory.createAuction(usdcToken, address(templeGold), NAME_ONE);
        bytes32 id = factory.getPairId(usdcToken, address(templeGold));
        assertEq(auction, factory.findAuctionForPair(usdcToken, address(templeGold)));
        assertEq(factory.deployedAuctions(id), auction);

        vm.expectRevert(abi.encodeWithSelector(ISpiceAuctionFactory.PairExists.selector, usdcToken, address(templeGold)));
        factory.createAuction(usdcToken, address(templeGold), NAME_ONE);
    }
}