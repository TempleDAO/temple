pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/core/ITempleGoldStaking.sol)

interface ITempleGoldStaking {
    event StakingProxySet(address stakingProxy);
    event Staked(address indexed staker, uint256 amount);
    event RewardPaid(address indexed staker, address toAddress, uint256 reward);
    event MigratorSet(address migrator);
    event Withdrawn(address indexed staker, address to, uint256 amount);
    event RewardDistributionCoolDownSet(uint160 cooldown);
    event DistributionStarterSet(address indexed starter);

    error OnlyStakingProxy();
    error CannotDistribute();

    struct Reward {
        uint40 periodFinish;
        uint216 rewardRate;  // The reward amount (1e18) per total reward duration
        uint40 lastUpdateTime;
        uint216 rewardPerTokenStored;
    }

    /**
     * @notice Set migrator
     * @param _migrator Migrator
     */
    function setMigrator(address _migrator) external;

    /**
     * @notice Stake
     * @param amount Amount of staking token
     */
    function stake(uint256 amount) external;

    /**
     * @notice Stake all balance of staker
     */
    function stakeAll() external;

    /**
     * @notice Stake for account when contract is not paused.
     * @param _for Account to stake for
     * @param _amount Amount of staking token
     */
    function stakeFor(address _for, uint256 _amount) external;

    /**
     * @notice Withdraw staked tokens
     * @param amount Amount to withdraw
     * @param claim Boolean if to claim rewards
     */
    function withdraw(uint256 amount, bool claim) external;

    /**
     * @notice Withdraw all staked tokens
     * @param claim Boolean if to claim rewards
     */
    function withdrawAll(bool claim) external;

    /// @notice Owner can pause user swaps from occuring
    function pause() external;

    /// @notice Owner can unpause so user swaps can occur
    function unpause() external;

    /**
     * @notice Get account staked balance
     * @param account Account
     * @return Staked balance of account
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @notice Get earned rewards of account
     * @param _account Account
     * @return Earned rewards of account
     */
    function earned(address _account) external view returns (uint256);

    /**
     * @notice Get Temple Gold reward per token of Temple 
     * @return Reward per token
     */
    function rewardPerToken() external view returns (uint256);

    /**
     * @notice Get finish timestamp of rewards
     * @return Finish timestamp
     */
    function rewardPeriodFinish() external view returns (uint40);

    /**
     * @notice Elevated access can recover tokens which are not staking or reward tokens
     * @param _token Token to recover
     * @param _to Recipient
     * @param _amount Amount of tokens
     */
    function recoverToken(address _token, address _to, uint256 _amount) external;

    /**  
     * @notice Get rewards
     * @param staker Staking account
     */
    function getReward(address staker) external;

    function notifyDistribution(uint256 amount) external;

    function setRewardDistributionCoolDown(uint160 _cooldown) external;
}