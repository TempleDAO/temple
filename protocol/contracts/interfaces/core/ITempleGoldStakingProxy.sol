pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/core/ITempleGoldStakingProxy.sol)

interface ITempleGoldStakingProxy {
    event RewardsNotified(uint256 amount, uint256 duration, uint256 periodStart, uint256 periodEnd);
    event StakingSet(address staking);

    error InvalidAmount();

    /**
     * @notice Set staking contract address
     * @param _staking Staking contract
     */
    function setStaking(address _staking) external;

    /**
     * @notice Distribute rewards for new epoch
     * @param amount Amount of reward tokens
     * @param duration Duration of reward distribution
     */
    function notifyReward(uint256 amount, uint256 duration) external;

    /**
     * @notice Approve staking contract to pull tokens
     */
    function approveStaking() external;

    /**
     * @notice Get Temple Gold balance of this staking proxy contract
     * @return Balance of this staking proxy
     */
    function templeGoldBalance() external view returns (uint256);
}