pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "./Exposure.sol";
import "./TreasuryFarmingRevenue.sol";
import "./Vault.sol";

library OpsManagerLib {
    /** 
     * @notice Creates a new exposure and sets it on provided array and mapping
     */
    function createExposure(
        string memory name, 
        string memory symbol, 
        IERC20 revalToken, 
        mapping(IERC20 => TreasuryFarmingRevenue) storage pools
    ) public returns (Exposure) {
        // Create position and transfer ownership to the caller
        Exposure exposure = new Exposure(name, symbol, revalToken);

        // Create a FarmingRevenue pool associated with this exposure
        pools[revalToken] = new TreasuryFarmingRevenue(exposure);
        exposure.setMinterState(address(pools[revalToken]), true);
        exposure.transferOwnership(msg.sender);

        // transfer exposure ownership back to ops manager, as it manages
        // exposure rebasing
        exposure.transferOwnership(msg.sender);

        return exposure;
    }

    function rebalance(
        Vault vault, 
        TreasuryFarmingRevenue farmingPool
    ) public {
        require(!vault.inEnterExitWindow(), "FarmingRevenueManager: Cannot rebalance vaults in their exit/entry window");

        uint256 currentRevenueShare = farmingPool.shares(address(vault));
        uint256 targetRevenueShare = vault.targetRevenueShare();

        if (targetRevenueShare > currentRevenueShare) {
            farmingPool.increaseShares(address(vault), targetRevenueShare - currentRevenueShare);
        } else if (targetRevenueShare < currentRevenueShare) {
            farmingPool.decreaseShares(address(vault), currentRevenueShare - targetRevenueShare);
        } else {
            farmingPool.claimFor(address(vault));
        }
    }

    /**
     * Return an array, same length as vaults, where each entry is true/false as to if
     * that vault requires a rebalance before updating revenue attributed to a particular
     * exposure
     */
    function requiresRebalance(
        Vault[] memory vaults, 
        TreasuryFarmingRevenue farmingPool
    ) public view returns (bool[] memory) {
        bool[] memory requiresUpdate = new bool[](vaults.length);

        for (uint256 i = 0; i < vaults.length; i++) {
            if (vaults[i].inEnterExitWindow()) {
                continue;
            }

            requiresUpdate[i] = farmingPool.shares(address(vaults[i])) != vaults[i].targetRevenueShare();
        }

        return requiresUpdate;
    }
}