pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuctionFactory.sol)


import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { SpiceAuction } from "contracts/templegold/SpiceAuction.sol";
import { ISpiceAuctionFactory } from "contracts/interfaces/templegold/ISpiceAuctionFactory.sol";

contract SpiceAuctionFactory is ISpiceAuctionFactory, TempleElevatedAccess {
    /// @notice Dao executing contract
    address public immutable daoExecutor;
    /// @notice Keep track of deployed spice auctions
    mapping(bytes32 id => address auction) public deployedAuctions;

    constructor(
        address _rescuer,
        address _executor,
        address _daoExecutor
    ) TempleElevatedAccess(_rescuer, _executor) {
        daoExecutor = _daoExecutor;
    }

    /**
     * @notice Create Spice Auction contract
     * @param token0 Token0
     * @param token1 Token1
     * @param name Name of spice auction contract
     */
    function createAuction(address token0, address token1, string memory name) external {
        if (token0 == address(0) || token1 == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        SpiceAuction spiceAuction = new SpiceAuction(token0, token1, daoExecutor, name);
        bytes32 pairId = _getPairHash(token0, token1);
        deployedAuctions[pairId] = address(spiceAuction);
        emit AuctionCreated(pairId, address(spiceAuction));
    }

    /**
     * @notice Given a pair of tokens, retrieve spice auction contract
     * @param token0 Token0
     * @param token1 Token1
     * @return Address of auction contract
     */
    function findAuctionForPair(address token0, address token1) external view returns (address) {
        bytes32 pairId = _getPairHash(token0, token1);
        return deployedAuctions[pairId];
    }

    function _getPairHash(address _token0, address _token1) private pure returns (bytes32 pairId) {
        if (_token0 < _token1) {
            pairId = keccak256(abi.encodePacked(_token0, _token1));
        } else {
            pairId = keccak256(abi.encodePacked(_token1, _token0));
        }
    }
}