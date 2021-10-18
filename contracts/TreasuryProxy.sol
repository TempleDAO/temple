pragma solidity ^0.8.4; // SPDX-License-Identifier: GPL-3.0-or-later

import "./TempleTreasury.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


contract TreasuryProxy is AccessControl{

    bytes32 public constant POLICY_ROLE = keccak256("POLICY_ROLE");

    bytes32 public constant ALLOCATOR_ROLE = keccak256("ALLOCATOR_ROLE");

    TempleTreasury public TREASURY;

    bool public harvestEnabled = false;

    uint256 public harvestPercentageAmount = 0;

    constructor (address _owner, address _treasury, address _stablec) public {
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        TREASURY = TempleTreasury(_treasury);
    }

    modifier onlyAdmin() {
       require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not a minter");
       _;
    }

    function harvest() external {
        if (harvestEnabled) {
           TREASURY.harvest(harvestPercentageAmount);
        }
    }

    function setHarvestAmount(uint256 _harvestPercentageAmount) external onlyAdmin {
        harvestPercentageAmount = _harvestPercentageAmount;
    }

    function toggleHarvest() external onlyAdmin {
        harvestEnabled = !harvestEnabled;
    }

    function seedMint(uint256 amountStablec, uint256 amountTemple) external onlyAdmin {
        TREASURY.seedMint(amountStablec, amountTemple);
    }

    function resetIV() external onlyAdmin {
        TREASURY.resetIV();
    }

    function distributeHarvest() external onlyAdmin {
        TREASURY.distributeHarvest();
    }

    function mintAndAllocateTemple(address _contract, uint256 amountTemple) external onlyAdmin {
        TREASURY.mintAndAllocateTemple(_contract, amountTemple);

    }

    function unallocateAndBurnUnusedMintedTemple(address _contract) external onlyAdmin {
        TREASURY.unallocateAndBurnUnusedMintedTemple(_contract);
    }

    function allocateTreasuryStablec(ITreasuryAllocation _contract, uint256 amountStablec) external onlyAdmin {
        TREASURY.allocateTreasuryStablec(_contract, amountStablec);
    }


    function updateMarkToMarket(ITreasuryAllocation _contract) external onlyAdmin {
        TREASURY.updateMarkToMarket(_contract);
    }

    function withdraw(ITreasuryAllocation _contract) external onlyAdmin {
        TREASURY.withdraw(_contract);
    }

    function ejectTreasuryAllocation(ITreasuryAllocation _contract) external onlyAdmin {
        TREASURY.ejectTreasuryAllocation(_contract);
    }

    function upsertPool(address _contract, uint96 _poolHarvestShare) external onlyAdmin {
        TREASURY.upsertPool(_contract, _poolHarvestShare);
    }

    function removePool(uint256 idx, address _contract) external onlyAdmin {
        TREASURY.removePool(idx, _contract);
    }

    // If we want to transfer ownership way from proxy
    function transferOwnership(address newOwner) external onlyAdmin {
        TREASURY.transferOwnership(newOwner);
    }
}