
pragma solidity ^0.8.4;
interface ITempleTreasury {

    event RewardsHarvested(uint256 _amount);
    event HarvestDistributed(address _contract, uint256 _amount);

     function numPools() external view returns (uint256);

     function resetIV() external;

     function seedMint(uint256 amountStablec, uint256 amountTemple) external;
     function harvest(uint256 distributionPercent) external;
     function distributeHarvest() external;
     function mintAndAllocateTemple(address _contract, uint256 amountTemple) external;
     function unallocateAndBurnUnusedMintedTemple(address _contract) external;

     function upsertPool(address _contract, uint96 _poolHarvestShare) external;
     function removePool(uint256 idx, address _contract) external;

     function intrinsicValueRatio() external view returns(uint256 stablec, uint256 temple);
     function harvestedRewardsTemple() external view returns(uint256);
     function seeded() external view returns(bool);
     function pools(uint) external view returns(address);
}