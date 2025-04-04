pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuctionDeployer.sol)


import { SpiceAuction } from "contracts/templegold/SpiceAuction.sol";
import { ISpiceAuctionDeployer } from "contracts/interfaces/templegold/ISpiceAuctionDeployer.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

/** 
 * @title SpiceAuctionDeployer
 * @notice Helper deployer using create2 to deploy spice auctions. 
 * @dev This implementation is removed from spice auction factory because the contract bytcode size exceeded the limit.
 * @dev This is because of importing SpiceAuction contract.
 */
contract SpiceAuctionDeployer is ISpiceAuctionDeployer {

    function deploy(
        address templeGold,
        address spiceToken,
        address daoExecutor,
        address operator,
        address strategyGnosis,
        uint32 mintChainLzEid,
        uint32 mintChainId,
        string memory name,
        bytes32 salt
    ) external override returns (address deployedAt) {
        bytes memory bytecode = type(SpiceAuction).creationCode;
        bytecode = abi.encodePacked(bytecode, abi.encode(templeGold, spiceToken, daoExecutor,
            operator, strategyGnosis, mintChainLzEid, mintChainId, name));
        deployedAt = Create2.deploy(0, salt, bytecode);
    }
}