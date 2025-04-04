pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/ISpiceAuctionDeployer.sol)


interface ISpiceAuctionDeployer {

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
    ) external returns (address);
}