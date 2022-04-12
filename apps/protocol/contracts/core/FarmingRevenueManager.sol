pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "./Position.sol";
import "./FarmingRevenue.sol";

/**
 * @title Manage all active treasury farmining revenue.
 */
contract FarmingRevenueManager is Ownable {
    mapping(Position => FarmingRevenue) public pools;
    Position[] public activePositions;

    /**
     * @notice Account for revenue earned by minting ehares in a given strategy
     */
    function addRevenue(Position position, uint256 amount) external onlyOwner {
        if (pools[position] == 0x0) {
            activePositions.push(book);
            pools[position] = new FarmingRevenue(book);
            position.addMinter(pools[position]);
        }
        pools[book].addRevenue(amount);
    }

    function claimFor(Position position, address account) external {
        pools[book].claimFor(account);
    }

    // TODO(butler): make rebalance query the vault for it's expected share
    function rebalance(address vault, Position[] positions, uint256 targetRevenueShare) onlyVault(vault) external {

        for (uint256 i = 0; i < positions.length; i++) {
            uint256 currentRevenueShare = pools[positions[i]].sharesOf(msg.sender);

            pools[position].increaseShares(msg.sender, amount);

            if (targetRevenueShare > currentRevenueShare) {
                pools[positions[i]].increaseShares(vault, targetRevenueShare - currentRevenueShare);
            } else if (targetRevenueShare < currentRevenueShare) {
                pools[positions[i]].decreaseShare(vault, currentRevenueShare - target);
            }
        }
    }
}