pragma solidity ^0.8.4; // SPDX-License-Identifier: GPL-3.0-or-later

import "./TempleTreasury.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


/**
 * Proxy all treasury management methods
 *
 * Intention is to be deployed as the new treasury owner, a workaround required
 * to make harvest publically callable.
 */
contract TreasuryManagementProxy {
    TempleTreasury public treasury;

    bool public harvestEnabled = true;
    address owner;

    uint256 public harvestDistributionPercentage = 80;

    constructor(address _owner, address _treasury) {
        owner = _owner;
        treasury = TempleTreasury(_treasury);
    }

    modifier onlyOwner() {
       require(owner == msg.sender, "caller is not the owner");
       _;
    }

    function harvest() external {
        if (harvestEnabled) {
           treasury.harvest(harvestDistributionPercentage);
        }
    }

    function setHarvestDistributionPercentage(uint256 _harvestDistributionPercentage) external onlyOwner {
        harvestDistributionPercentage = _harvestDistributionPercentage;
    }

    function toggleHarvest() external onlyOwner {
        harvestEnabled = !harvestEnabled;
    }

    function resetIV() external onlyOwner {
        treasury.resetIV();
    }

    function distributeHarvest() external onlyOwner {
        treasury.distributeHarvest();
    }

    function mintAndAllocateTemple(address _contract, uint256 amountTemple) external onlyOwner {
        treasury.mintAndAllocateTemple(_contract, amountTemple);

    }

    function unallocateAndBurnUnusedMintedTemple(address _contract) external onlyOwner {
        treasury.unallocateAndBurnUnusedMintedTemple(_contract);
    }

    function allocateTreasuryStablec(ITreasuryAllocation _contract, uint256 amountStablec) external onlyOwner {
        treasury.allocateTreasuryStablec(_contract, amountStablec);
    }

    function updateMarkToMarket(ITreasuryAllocation _contract) external onlyOwner {
        treasury.updateMarkToMarket(_contract);
    }

    function withdraw(ITreasuryAllocation _contract) external onlyOwner {
        treasury.withdraw(_contract);
    }

    function ejectTreasuryAllocation(ITreasuryAllocation _contract) external onlyOwner {
        treasury.ejectTreasuryAllocation(_contract);
    }

    function upsertPool(address _contract, uint96 _poolHarvestShare) external onlyOwner {
        treasury.upsertPool(_contract, _poolHarvestShare);
    }

    function removePool(uint256 idx, address _contract) external onlyOwner {
        treasury.removePool(idx, _contract);
    }

    // If we want to transfer ownership way from proxy
    function transferOwnership(address newOwner) external onlyOwner {
        treasury.transferOwnership(newOwner);
    }
}