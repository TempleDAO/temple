pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/SpiceAuctionDeployer.t.sol)

import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { SpiceAuctionDeployer } from "contracts/templegold/SpiceAuctionDeployer.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

contract SpiceAuctionDeployerTestBase is TempleGoldCommon {
    SpiceAuctionDeployer public deployer;
    FakeERC20 public TGLD;

    FakeERC20 public SPICE_TOKEN_A;
    FakeERC20 public SPICE_TOKEN_B;

    bytes32 public constant SALT_1 = bytes32("1");
    bytes32 public constant SALT_2 = bytes32("2");

    string public constant AUCTION_A_NAME = "SPICE_AUCTION_TGLD_TOKENA";
    string public constant AUCTION_B_NAME = "SPICE_AUCTION_TGLD_TOKENB";

    function setUp() public {

        TGLD = new FakeERC20("TEMPLE GOLD", "TGLD", executor, 100 ether);
        deployer = new SpiceAuctionDeployer();
        SPICE_TOKEN_A = new FakeERC20("SPICE TOKEN A", "TOKENA", executor, 100 ether);
        SPICE_TOKEN_B = new FakeERC20("SPICE TOKEN B", "TOKENB", executor, 100 ether);
    }
}

contract SpiceAuctionDeployerTest is SpiceAuctionDeployerTestBase {

    function test_deploy_duplicate_salt() public {
        deployer.deploy(address(TGLD), address(SPICE_TOKEN_A), executor, executor, executor,
            11, 1, AUCTION_A_NAME, SALT_1);
        // duplicate salt for same bytecode
        vm.expectRevert(abi.encodeWithSelector(Create2.Create2FailedDeployment.selector));
        deployer.deploy(address(TGLD), address(SPICE_TOKEN_A), executor, executor, executor,
            11, 1, AUCTION_A_NAME, SALT_1);
    }

    function test_deploy() public {
        address auction = deployer.deploy(address(TGLD), address(SPICE_TOKEN_A), executor, executor, executor,
            11, 1, AUCTION_A_NAME, SALT_1);
        assertNotEq(auction, address(0));
        address auction2 = deployer.deploy(address(TGLD), address(SPICE_TOKEN_A), executor, executor, executor,
            11, 1, AUCTION_A_NAME, SALT_2);
        assertNotEq(auction2, address(0));
        assertEq(auction.code, auction2.code);
    }
}