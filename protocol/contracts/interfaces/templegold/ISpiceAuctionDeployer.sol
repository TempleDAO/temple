pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/ISpiceAuctionDeployer.sol)

interface ISpiceAuctionDeployer {
    /**
     * @notice Deploy a spice auction
     * @param templeGold Temple Gold (TGLD) address
     * @param spiceToken Spice token address
     * @param daoExecutor Address to execute functions on behalf of DAO
     * @param operator Spice auction operator address
     * @param strategyGnosis Gnosis strategy that funds spice auctions
     * @param mintChainLzEid Layer Zero EID of mint chain
     * @param name Name of spice auction contract
     * @param salt Salt for deploying
     * @return spiceAuction Address of deployed spice auction contract
     */
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
    ) external returns (address spiceAuction);
}