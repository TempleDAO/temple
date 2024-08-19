pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/ISpiceAuctionFactory.sol)

interface ISpiceAuctionFactory {
    event AuctionCreated(bytes32 id, address auction);

    /// @notice Temple Gold
    function templeGold() external view returns (address);

    /// @notice Dao executing contract
    function daoExecutor() external view returns (address);

    /// @notice Operator
    function operator() external view returns (address);
    
    /// @notice Keep track of deployed spice auctions
    function deployedAuctions(bytes32 id) external view returns (address);

    /**
     * @notice Create Spice Auction contract
     * @param spiceToken Spice token
     * @param name Name of spice auction contract
     */
    function createAuction(address spiceToken, string memory name) external returns (address);

    /**
     * @notice Given a pair of tokens, retrieve spice auction contract
     * @param spiceToken Spice token
     * @return Address of auction contract
     */
    function findAuctionForSpiceToken(address spiceToken) external view returns (address);

    /**
     * @notice Given a pair of tokens, retrieve pair hash Id
     * @param spiceToken Spice token
     * @return Id of token pair
     */
    function getPairId(address spiceToken) external view returns (bytes32);
}