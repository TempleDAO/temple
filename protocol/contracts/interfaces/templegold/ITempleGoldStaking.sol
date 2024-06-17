pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/ITempleGoldStaking.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITempleGoldStaking {
    event GoldDistributionNotified(uint256 amount, uint256 timestamp);
    event Staked(address indexed staker, uint256 amount);
    event MigratorSet(address migrator);
    event Withdrawn(address indexed staker, address to, uint256 stakeIndex, uint256 amount);
    event RewardDistributionCoolDownSet(uint160 cooldown);
    event DistributionStarterSet(address indexed starter);
    event VestingPeriodSet(uint32 _period);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
    event RewardPaid(address indexed staker, address toAddress, uint256 index, uint256 reward);
    event RewardDurationSet(uint256 duration);

    error CannotDistribute();
    error CannotDelegate();
    error InvalidOperation();
    error InvalidBlockNumber();
    error NoStaker();

    struct Reward {
        uint40 periodFinish;
        uint216 rewardRate;  // The reward amount (1e18) per total reward duration
        uint40 lastUpdateTime;
        uint216 rewardPerTokenStored;
    }

    struct AccountWeightParams {
        uint64 weekNumber;
        uint64 stakeTime;
        uint64 updateTime;
    }

    struct AccountPreviousWeightParams {
        AccountWeightParams weight;
        uint256 balance;
    }

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint256 fromBlock;
        uint256 votes;
    }

    struct StakeInfo {
        uint64 stakeTime;
        uint64 fullyVestedAt; // store, if vesting period changes
        uint256 amount;
    }

    /// @notice The staking token. Temple
    function stakingToken() external view returns (IERC20);
    /// @notice Reward token. Temple Gold
    function rewardToken() external view returns (IERC20);

    /// @notice Distribution starter
    function distributionStarter() external view returns (address);

    /// @notice Rewards stored per token
    function rewardPerTokenStored() external view returns (uint256);
    /// @notice Total supply of staking token
    function totalSupply() external view returns (uint256);

    /// @notice Time tracking
    function periodFinish() external view returns (uint256);
    function lastUpdateTime() external view returns (uint256);

    /// @notice Store next reward amount for next epoch
    function nextRewardAmount() external view returns (uint256);
    /// @notice Cooldown time before next distribution of rewards
    /// @dev If set to zero, rewards distribution is callable any time 
    function rewardDistributionCoolDown() external view returns (uint160);
    /// @notice Timestamp for last reward notification
    function lastRewardNotificationTimestamp() external view returns (uint96);

    /// @notice For use when migrating to a new staking contract if TGLD changes.
    function migrator() external view returns (address);

    /// @notice Stakers claimable rewards at stake index
    function claimableRewards(address account, uint256 stakeIndex) external view returns (uint256);
    /// @notice Staker reward per token paid at stake index
    function userRewardPerTokenPaid(address account, uint256 stakeIndex) external view returns (uint256);

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
     * @notice Stake for account when contract is not paused.
     * @param _for Account to stake for
     * @param _amount Amount of staking token
     */
    function stakeFor(address _for, uint256 _amount) external;

    /**
     * @notice Withdraw staked tokens
     * @param amount Amount to withdraw
     * @param stakeIndex Stake index
     * @param claim Boolean if to claim rewards
     */
    function withdraw(uint256 amount, uint256 stakeIndex, bool claim) external;

    /**
     * @notice Withdraw all staked tokens
     * @param stakeIndex Stake index
     * @param claim Boolean if to claim rewards
     */
    function withdrawAll(uint256 stakeIndex, bool claim) external;

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
     * @notice Get staker vesting period
     * @return Vesting period
     */
    function vestingPeriod() external view returns (uint32);

    /**
     * @notice Get earned rewards of account
     * @param _account Account
     * @param _index Index
     * @return Earned rewards of account
     */
    function earned(address _account, uint256 _index) external view returns (uint256);

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
     * @param index Index
     */
    function getReward(address staker, uint256 index) external;

    /**  
     * @notice Notify rewards distribution. Called by TempleGold contract after successful mint
     * @param amount Amount minted to this contract
     */
    function notifyDistribution(uint256 amount) external;

    /**
     * @notice Set reward distribution cooldown
     * @param _cooldown Cooldown in seconds
     */
    function setRewardDistributionCoolDown(uint160 _cooldown) external;

    /**
     * @notice Mint and distribute TGLD 
     */
    function distributeGold() external;

    /**  
     * @notice Get reward data
     * @return Reward data
     */
    function getRewardData() external view returns (Reward memory);

    /**
      * @notice For migrations to a new staking contract if TGLD changes
      *         1. Withdraw `staker`s tokens to the new staking contract (the migrator)
      *         2. Any existing rewards are claimed and sent directly to the `staker`
      * @dev Called only from the new staking contract (the migrator).
      *      `setMigrator(new_staking_contract)` needs to be called first
      * @param staker The staker who is being migrated to a new staking contract.
      * @param index Index of staker
      */
    function migrateWithdraw(address staker, uint256 index) external returns (uint256);

    /**
     * @notice Get account checkpoint data 
     * @param account Account
     * @param epoch Epoch
     * @return Checkpoint data
     */
    function getCheckpoint(address account, uint256 epoch) external view returns (Checkpoint memory);

    /**
     * @notice Get account number of checkpoints
     * @param account Account
     * @return Number of checkpoints
     */
    function numCheckpoints(address account) external view returns (uint256);

    /**
     * @notice Set vesting period for stakers
     * @param _period Vesting period
     */
    function setVestingPeriod(uint32 _period) external;

    /**
     * @notice Set reward duration
     * @param _duration Reward duration
     */
    function setRewardDuration(uint256 _duration) external;

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) external;

    /**   
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint256);

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256);

    /**
     * @notice Get last stake index for account
     * @param account Account
     * @return Last stake index
     */
    function getAccountLastStakeIndex(address account) external view returns (uint256);

    /**
     * @notice Get account stake info
     * @param account Account
     * @return Stake info
     */
    function getAccountStakeInfo(address account, uint256 index) external view returns (StakeInfo memory);

    /**
     * @notice Get account staked balance
     * @param account Account
     * @param stakeIndex Staked index
     * @return Staked balance of account
     */
    function stakeBalanceOf(address account, uint256 stakeIndex) external view returns (uint256);
}