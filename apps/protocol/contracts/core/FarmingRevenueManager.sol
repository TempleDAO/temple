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

    mapping(address => bool) public activeVaults;

    /**
     * @notice Account for revenue earned by minting ehares in a given strategy
     */
    function addRevenue(IVault[] memory vaults, Position position, uint256 amount) external onlyOwner {
        if (address(pools[position]) == address(0x0)) {
            activePositions.push(position);
            pools[position] = new FarmingRevenue(position);
            position.addMinter(address(pools[position]));
        }

        rebalance(vaults, position);
        pools[position].addRevenue(amount);
    }

    function claimFor(Position position, address account) external {
        pools[position].claimFor(account);
    }

    function rebalance(IVault[] memory vaults, Position position) public {
        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");

            uint256 currentRevenueShare = pools[position].shares(address(vaults[i]));
            uint256 targetRevenueShare= vaults[i].targetRevenueShare();

            if (targetRevenueShare > currentRevenueShare) {
                pools[position].increaseShares(address(vaults[i]), targetRevenueShare - currentRevenueShare);
            } else if (targetRevenueShare < currentRevenueShare) {
                pools[position].decreaseShares(address(vaults[i]), currentRevenueShare - targetRevenueShare);
            }
        }
    }
}

interface IVault {
    function targetRevenueShare() external view returns (uint256);
}