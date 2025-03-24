pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/SpiceAuctionFactory.t.sol)

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { SpiceAuctionFactory } from "contracts/templegold/SpiceAuctionFactory.sol";
import { SpiceAuctionDeployer } from "contracts/templegold/SpiceAuctionDeployer.sol";
import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

contract SpiceAuctionFactoryTestBase is TempleGoldCommon {
    event AuctionCreated(bytes32 id, address auction);

    address public fakeToken = makeAddr("fakeToken");
    address public cssGnosis = makeAddr("cssGnosis");
    SpiceAuctionFactory public factory;
    TempleGold public templeGold;
    SpiceAuctionDeployer public deployer;
    
    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);

        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();

        templeGold = new TempleGold(initArgs);
        deployer = new SpiceAuctionDeployer();
        factory = new SpiceAuctionFactory(rescuer, executor, executor, mike, cssGnosis, address(deployer),
            address(templeGold), ARBITRUM_ONE_LZ_EID, uint32(arbitrumOneChainId));
    }

    function test_initialization() public view {
        assertEq(factory.executor(), executor);
        assertEq(factory.rescuer(), rescuer);
        assertEq(factory.daoExecutor(), executor);
        assertEq(factory.templeGold(), address(templeGold));
        assertEq(factory.operator(), mike);
        assertEq(factory.strategyGnosis(), cssGnosis);
        assertEq(address(factory.deployer()), address(deployer));
    }
}

contract SpiceAuctionFactoryTestAccess is SpiceAuctionFactoryTestBase {
    function test_access_createAuction() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        factory.createAuction(usdcToken, bytes32(""), NAME_ONE);
    }
}

contract SpiceAuctionFactoryTest is SpiceAuctionFactoryTestBase {
    function test_createAuction() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        factory.createAuction(address(0), bytes32(""), NAME_ONE);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        factory.createAuction(address(templeGold), bytes32(""), NAME_ONE);

        address auction = factory.createAuction(usdcToken, bytes32(""), NAME_ONE);
        bytes32 id = factory.getPairId(usdcToken);
        assertEq(auction, factory.findAuctionForSpiceToken(usdcToken));
        assertEq(factory.deployedAuctions(id), auction);

        // cannot use same salt for same spice token
        vm.expectRevert(abi.encodeWithSelector(Create2.Create2FailedDeployment.selector));
        factory.createAuction(usdcToken, bytes32(""), NAME_ONE);

        // deploy same spice token again. new auction address is stored
        address oldAuction = auction;
        auction = factory.createAuction(usdcToken, bytes32("1"), NAME_ONE);
        id = factory.getPairId(usdcToken);
        assertNotEq(oldAuction, factory.deployedAuctions(id));
        assertEq(auction, factory.findAuctionForSpiceToken(usdcToken));
        assertEq(factory.deployedAuctions(id), auction);

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
        address auction = factory.createAuction(usdcToken, bytes32(""), NAME_ONE);
        bytes32 id = factory.getPairId(usdcToken);
        assertEq(auction, factory.findAuctionForSpiceToken(usdcToken));
        assertEq(factory.deployedAuctions(id), auction);
        
        auction = factory.createAuction(daiToken, bytes32(""), NAME_ONE);
        id = factory.getPairId(daiToken);
        assertEq(auction, factory.findAuctionForSpiceToken(daiToken));
        assertEq(factory.deployedAuctions(id), auction);

        // get id of token < templeGold. test coverage
        id = factory.getPairId(fakeToken);
    }
}