pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "./Exposure.sol";
import "./TreasuryFarmingRevenue.sol";
import "./Vault.sol";
import "./Rational.sol";

/**
 * @title Manage all active treasury farmining revenue.
 */
contract OpsManager is Ownable {
    mapping(Exposure => TreasuryFarmingRevenue) public pools;
    Exposure[] public activeExposures;
    mapping(address => bool) public activeVaults;

    IERC20 public templeToken;

    constructor(IERC20 _templeToken) {
        templeToken = _templeToken;
    }

    /**
     * @notice Create a new Exposure
     */
    function createExposure(
        string memory name,
        string memory symbol,
        ERC20 revalToken
    ) external onlyOwner  { 
        // Create position and transfer ownership to the caller
        Exposure exposure = new Exposure(name, symbol, revalToken, address(this));
        activeExposures.push(exposure);
        exposure.transferOwnership(msg.sender);

        // Create a FarmingRevenue pool associated with this exposure
        pools[exposure] = new TreasuryFarmingRevenue(exposure);
        exposure.addMinter(address(pools[exposure]));
    }

    /**
     * @notice Create a new vault
     */
    function createVault(
        string memory name,
        string memory symbol,
        uint256 periodDuration,
        uint256 enterExitWindowDuration,
        Rational memory shareBoostFactory
    ) external onlyOwner {
        Vault vault = new Vault(name, symbol, templeToken, periodDuration, enterExitWindowDuration, shareBoostFactory);
        activeVaults[address(vault)] = true;
    }

    /**
     * @notice Account for revenue earned by minting shares in a given strategy
     *
     * @dev pre-condition expected to hold is all vaults that are not in their
     * entry/exit period have been rebalanced and are holding the correct portion
     * of shares expected in TreasuryFarmingRevenue
     */
    function addRevenue(Exposure[] memory exposures, uint256 amount) external onlyOwner {
        for (uint256 i = 0; i < exposures.length; i++) {
            pools[exposures[i]].addRevenue(amount);
        }
    }

    function rebalance(Vault[] memory vaults, Exposure exposure) external {
        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");
            require(vaults[i].inEnterExitWindow(), "FarmingRevenueMnager: Cannot rebalance vaults in their exit/entry window");

            uint256 currentRevenueShare = pools[exposure].shares(address(vaults[i]));
            uint256 targetRevenueShare= vaults[i].targetRevenueShare();

            if (targetRevenueShare > currentRevenueShare) {
                pools[exposure].increaseShares(address(vaults[i]), targetRevenueShare - currentRevenueShare);
            } else if (targetRevenueShare < currentRevenueShare) {
                pools[exposure].decreaseShares(address(vaults[i]), currentRevenueShare - targetRevenueShare);
            } else {
                pools[exposure].claimFor(address(vaults[i]));
            }
        }
    }

    /**
     * @notice claim revenue attributed to the given vault, into the given exposure
     * @dev not required to be called, exposed if vault users want to spend the gas to 
     * keep the accounts and compounding up to date at a faster rate than the automated
     * ops process
     */
    function claim(Vault[] memory vaults, Exposure exposure) external {
        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");
            pools[exposure].claimFor(address(vaults[i]));
        }
    }

    /**
     * @notice For the given vaults, liquidate their positions back to temple
     */
    function liquidatePositions(Vault[] memory vaults, Exposure[] memory exposures) external {
        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");

            for (uint256 j = 0; i < exposures.length; i++) {
                vaults[i].claim(exposures[j]);
            }
        }
    }

    /**
     * Return an array, same length as vaults, where each entry is true/false as to if
     * that vault requires a rebalance before updating revenue attributed to a particular
     * exposure
     */
    function requiresRebalance(Vault[] memory vaults, Exposure exposure) external view returns (bool[] memory) {
        bool[] memory requiresUpdate = new bool[](vaults.length);

        for (uint256 i = 0; i < vaults.length; i++) {
            if (vaults[i].inEnterExitWindow()) {
                continue;
            }

            requiresUpdate[i] = pools[exposure].shares(address(vaults[i])) != vaults[i].targetRevenueShare();
        }

        return requiresUpdate;
    }
}