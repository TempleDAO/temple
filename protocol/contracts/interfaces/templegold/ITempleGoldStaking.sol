pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/ITempleGoldStaking.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITempleGoldStaking {
    event GoldDistributionNotified(uint256 amount, uint256 timestamp);
    event Staked(address indexed staker, uint256 amount);
    event RewardPaid(address indexed staker, address toAddress, uint256 reward);
    event MigratorSet(address migrator);
    event Withdrawn(address indexed staker, address to, uint256 amount);
    event RewardDistributionCoolDownSet(uint160 cooldown);
    event DistributionStarterSet(address indexed starter);
    event HalfTimeSet(uint256 halfTime);
    event VoteDelegateSet(address _delegate, bool _approved);
    event UserDelegateSet(address indexed user, address _delegate);
    event MinimumDelegationPeriodSet(uint32 _minimumPeriod);

    error InvalidDelegate();
    error CannotDistribute();
    error CannotDelegate();

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

    /// @notice The time it takes until half the voting weight is reached for a staker
    function halfTime() external view returns (uint256);

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

    /// @notice Stakers claimable rewards
    function claimableRewards(address account) external view returns (uint256);
    /// @notice Staker reward per token paid
    function userRewardPerTokenPaid(address account) external view returns (uint256);

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
     * @notice Set half time parameter for calculating vote weight.
     * @dev The voting half-time variable determines the time it takes until half the voting weight is reached for a stake.
     *      Formular from st-yETH https://docs.yearn.fi/getting-started/products/yeth/overview
     * @param _halfTime Cooldown in seconds
     */
    function setHalfTime(uint256 _halfTime) external;

    /**
     * @notice Mint and distribute TGLD 
     */
    function distributeGold() external;

    /**  
     * @notice Get vote weight of an account
     * @param account Account
     */
    function getVoteWeight(address account) external view returns (uint256);

    /**  
     * @notice Get reward data
     * @return Reward data
     */
    function getRewardData() external view returns (Reward memory);

    /**  
     * @notice Get weights used for measuring vote weight for an account
     * @param _account Account
     * @return weight AccountWeightParams
     */
    function getAccountWeights(address _account) external view returns (AccountWeightParams memory weight);

    /**
      * @notice For migrations to a new staking contract if TGLD changes
      *         1. Withdraw `staker`s tokens to the new staking contract (the migrator)
      *         2. Any existing rewards are claimed and sent directly to the `staker`
      * @dev Called only from the new staking contract (the migrator).
      *      `setMigrator(new_staking_contract)` needs to be called first
      * @param staker The staker who is being migrated to a new staking contract.
      */
    function migrateWithdraw(address staker) external returns (uint256);

    /**  
     * @notice Check if user is delegated to delegate
     * @param _user User
     * @param _delegate Delegate
     * @return Bool if user is delegated to delegate
     */
    function userDelegated(address _user, address _delegate) external view returns (bool);

    /**  
     * @notice Set self as vote delegate. If false all users delegated to `msg.sendeer` have to select new delegates
     * @param _approve If delegate approved
     */
    function setSelfAsDelegate(bool _approve) external;

    /**  
     * @notice Unset delegate for a user
     */
    function unsetUserVoteDelegate() external;

    /**  
     * @notice Get all accounts delegated to delegate
     * @param _delegate Delegate
     * @return users Array of accounts
     */
    function getDelegateUsers(address _delegate) external view returns (address[] memory users);

    /**  
     * @notice Set vote delegate for a user
     * @param _delegate Delegate
     */
    function setUserVoteDelegate(address _delegate) external;

    /**  
     * @notice Get vote weight of delegate
     * @param _delegate Delegate
     * @return Vote weight
     */
    function getDelegatedVoteWeight(address _delegate) external view returns (uint256);

    /// @notice Delegates
    function delegates(address _delegate) external view returns (bool);
    /// @notice Keep track of users and their delegates
    function userDelegates(address _account) external view returns (address);

    /// @notice Minimum time of delegation before reset
    function minimumDelegationPeriod() external view returns (uint32);

    /**
     * @notice Set minimum time before undelegation. This is also used to check before withdrawal after stake if account is delegated
     * @param _minimumPeriod Minimum delegation time
     */
    function setDelegationMinimumPeriod(uint32 _minimumPeriod) external;

}