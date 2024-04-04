pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuctionFactory.sol)


import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { SpiceAuction } from "contracts/templegold/SpiceAuction.sol";

contract SpiceAuctionFactory is TempleElevatedAccess {

    address public immutable timelock;
    mapping(bytes32 id => address auction) public deployedAuctions;

    event AuctionCreated(bytes32 id, address auction);
    constructor(
        address _rescuer,
        address _executor,
        address _timelock
    ) TempleElevatedAccess(_rescuer, _executor) {
        timelock = _timelock;
    }

    function createAuction(address token0, address token1, string memory name) external {
        if (token0 == address(0) || token1 == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        SpiceAuction spiceAuction = new SpiceAuction(token0, token1, timelock, name);
        bytes32 pairId = _getPairHash(token0, token1);
        deployedAuctions[pairId] = address(spiceAuction);
        emit AuctionCreated(pairId, address(spiceAuction));
    }

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