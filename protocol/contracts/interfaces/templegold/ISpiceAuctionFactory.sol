pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/core/ISpiceAuctionFactory.sol)

interface ISpiceAuctionFactory {
    event AuctionCreated(bytes32 id, address auction);

    /**
     * @notice Create Spice Auction contract
     * @param token0 Token0
     * @param token1 Token1
     * @param name Name of spice auction contract
     */
    function createAuction(address token0, address token1, string memory name) external;

    /**
     * @notice Given a pair of tokens, retrieve spice auction contract
     * @param token0 Token0
     * @param token1 Token1
     * @return Address of auction contract
     */
    function findAuctionForPair(address token0, address token1) external view returns (address);
}