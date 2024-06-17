pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleGoldStakingMock.sol)


import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";

/** 
 * @title Temple Gold Staking
 * @notice Temple Gold Staking contract. Stakers deposit Temple and claim rewards in Temple Gold. 
 * Temple Gold is distributed to staking contract for stakers on mint. Minted Temple Gold are sent directly to Staking contract.
 * A non-transferrable vote token is minted 1;1 to stakers on the amount they staked. Duration for distributing staking rewards is 7 days.
 */
contract TempleGoldStakingMock is TempleElevatedAccess, Pausable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    /// @notice The staking token. Temple
    IERC20 public immutable stakingToken;
    /// @notice Reward token. Temple Gold
    IERC20 public immutable rewardToken;

    ITempleGoldStaking public previousStaking;

    /// @notice Distribution starter
    address public distributionStarter;

    uint256 constant public WEEK_LENGTH = 7 days;

    /// @notice Rewards stored per token
    uint256 public rewardPerTokenStored;
    /// @notice Total supply of staking token
    uint256 public totalSupply;

    /// @notice The time it takes until half the voting weight is reached for a staker
    uint256 public halfTime;

    /// @notice Time tracking
    uint256 public periodFinish;
    uint256 public lastUpdateTime;

    /// @notice Store next reward amount for next epoch
    uint256 public nextRewardAmount;
    /// @notice Duration for rewards distribution
    uint256 public rewardDuration;
    /// @notice Cooldown time before next distribution of rewards
    /// @dev If set to zero, rewards distribution is callable any time 
    uint160 public rewardDistributionCoolDown;
    /// @notice Timestamp for last reward notification
    uint96 public lastRewardNotificationTimestamp;

    /// @notice Time of delegation before reset
    uint32 public delegationPeriod;

    /// @notice For use when migrating to a new staking contract if TGLD changes.
    address public migrator;
    /// @notice Data struct for rewards
    Reward internal rewardData;
    /// @notice Staker balances
    mapping(address account => uint256 balance) private _balances;
    
    /// @notice Use as alias for delegate "balances" for easier vote weight calculation
    mapping(address delegate => uint256 balance) private _delegateBalances;
    // /// @notice keep track of user withdraw times
    mapping(address user => uint256 withdrawTime) public userWithdrawTimes;

    mapping(address account => address delegate) public delegates;

    /// @notice Track account stakes
    mapping(address account => mapping(uint256 index => StakeInfo)) private _stakeInfos;
    mapping(address account => EnumerableSet.UintSet indexes) private _accountStakes;
    mapping(address account => uint256 lastIndex) private _accountLastStakeIndex;
    /// @notice Stakers claimable rewards
    mapping(address account => mapping(uint256 index => uint256 amount)) public claimableRewards;
    /// @notice Staker reward per token paid
    mapping(address account => mapping(uint256 index => uint256 amount)) public userRewardPerTokenPaid;
    /// @notice Track voting
    mapping(address account => mapping(uint256 epoch => Checkpoint)) public checkpoints;
    mapping(address account => uint256 number) public numCheckpoints;

    uint32 public vestingPeriod;

    event GoldDistributionNotified(uint256 amount, uint256 timestamp);
    event Staked(address indexed staker, uint256 amount);
    event RewardPaid(address indexed staker, address toAddress, uint256 reward);
    event MigratorSet(address migrator);
    event Withdrawn(address indexed staker, address to, uint256 stakeIndex, uint256 amount);
    event RewardDistributionCoolDownSet(uint160 cooldown);
    event DistributionStarterSet(address indexed starter);
    event HalfTimeSet(uint256 halfTime);
    event VoteDelegateSet(address _delegate, bool _approved);
    event UserDelegateSet(address indexed user, address _delegate);
    event DelegationPeriodSet(uint32 _minimumPeriod);
    event VestingPeriodSet(uint32 _period);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
    event RewardPaidIndex(address indexed staker, address toAddress, uint256 index, uint256 reward);
    event RewardDurationSet(uint256 duration);

    error InvalidDelegate();
    error CannotDistribute();
    error CannotDelegate();
    error MinimumStakePeriod();
    error InvalidOperation();
    error NoStaker();

    struct Reward {
        uint40 periodFinish;
        uint216 rewardRate;  // The reward amount (1e18) per total reward duration
        uint40 lastUpdateTime;
        uint216 rewardPerTokenStored;
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

    constructor(
        address _rescuer,
        address _executor,
        address _stakingToken,
        address _rewardToken,
        address _previousStaking
    ) TempleElevatedAccess(_rescuer, _executor){
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        previousStaking = ITempleGoldStaking(_previousStaking);
    }

    /**
      * @notice For migrations to a new staking contract if TGLD changes
      *         1. Withdraw `staker`s tokens to the new staking contract (the migrator)
      *         2. Any existing rewards are claimed and sent directly to the `staker`
      * @dev Called only from the new staking contract (the migrator).
      *      `setMigrator(new_staking_contract)` needs to be called first
      */
    function migrateWithdraw() external view onlyMigrator {
        revert CommonEventsAndErrors.Unimplemented();
    }

    function migrateFromPreviousStaking(uint256 index) external {
        uint256 amount = previousStaking.migrateWithdraw(msg.sender, index);
        uint256 _lastIndex = _accountLastStakeIndex[msg.sender];
        _accountLastStakeIndex[msg.sender] = ++_lastIndex;
        _applyStake(msg.sender, amount, _lastIndex);
        _moveDelegates(address(0), delegates[msg.sender], amount);
    }

   function setVestingPeriod(uint32 _period) external onlyElevatedAccess {
        if (_period < WEEK_LENGTH) { revert CommonEventsAndErrors.InvalidParam(); }
        vestingPeriod = _period;
        emit VestingPeriodSet(_period);
    }

    function setRewardDuration(uint256 _duration) external onlyElevatedAccess {
        // minimum reward duration
        if (_duration < WEEK_LENGTH) { revert CommonEventsAndErrors.InvalidParam(); }
        // only change after reward epoch ends
        if (rewardData.periodFinish >= block.timestamp) { revert InvalidOperation(); }
        rewardDuration = _duration;
        emit RewardDurationSet(_duration);
    }

    /**
     * @notice Set starter of rewards distribution for the next epoch
     * @dev If starter is address zero, anyone can call `distributeRewards` to apply and 
     *      distribute
      rewards for next 7 days
     * @param _starter Starter address
     * @dev could be:
     * - a bot (if set to non zero address) that checks requirements are met before starting auction
     * - or anyone if set to zero address
     */
    function setDistributionStarter(address _starter) external onlyElevatedAccess {
        /// @notice Starter can be address zer0
        distributionStarter = _starter;
        emit DistributionStarterSet(_starter);
    }

    /**
     * @notice Set migrator
     * @param _migrator Migrator
     */
    function setMigrator(address _migrator) external onlyElevatedAccess {
        if (_migrator == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        migrator = _migrator;
        emit MigratorSet(_migrator);
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) external {
        if (userWithdrawTimes[msg.sender] > block.timestamp) { revert CannotDelegate(); }
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @notice Set reward distribution cooldown
     * @param _cooldown Cooldown in seconds
     */
    function setRewardDistributionCoolDown(uint160 _cooldown) external onlyElevatedAccess {
        /// @dev zero cooldown is allowed
        rewardDistributionCoolDown = _cooldown;
        emit RewardDistributionCoolDownSet(_cooldown);
    }

    /**
     * @notice Set half time parameter for calculating vote weight.
     * @dev The voting half-time variable determines the time it takes until half the voting weight is reached for a stake.
     *      Formular from st-yETH https://docs.yearn.fi/getting-started/products/yeth/overview
     * @param _halfTime Cooldown in seconds
     */
    function setHalfTime(uint256 _halfTime) external onlyElevatedAccess {
        if (_halfTime == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        halfTime = _halfTime;
        emit HalfTimeSet(_halfTime);
    }

    /**
     * @notice Set minimum time before undelegation. This is also used to check before withdrawal after stake if account is delegated
     * @param _period Delegation period
     */
    function setDelegationPeriod(uint32 _period) external onlyElevatedAccess {
        if (_period == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        delegationPeriod = _period;
        emit DelegationPeriodSet(_period);
    }

    /**
      * @notice For migrations to a new staking contract if TGLD changes
      *         1. Withdraw `staker`s tokens to the new staking contract (the migrator)
      *         2. Any existing rewards are claimed and sent directly to the `staker`
      * @dev Called only from the new staking contract (the migrator).
      *      `setMigrator(new_staking_contract)` needs to be called first
      * @param staker The staker who is being migrated to a new staking contract.
      * @param index Index of stake to withdraw
      */
    function migrateWithdraw(address staker, uint256 index) external onlyMigrator returns (uint256) {
        if (staker == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        StakeInfo storage _stakeInfo = _stakeInfos[staker][index];
        uint256 stakerBalance = _stakeInfo.amount;
        _withdrawFor(_stakeInfo, staker, msg.sender, index, _stakeInfo.amount, true, staker);
        return stakerBalance;
    }
    
    /**
     * @notice Distributed TGLD rewards minted to this contract to stakers
     * @dev This starts another 7-day rewards distribution. Calculates new `rewardRate` from any left over rewards up until now
     */
    function distributeRewards() updateReward(address(0), 0) external {
        if (distributionStarter != address(0) && msg.sender != distributionStarter) 
            { revert CommonEventsAndErrors.InvalidAccess(); }
        if (totalSupply == 0) { revert NoStaker(); }
        // Mint and distribute TGLD if no cooldown set
        if (lastRewardNotificationTimestamp + rewardDistributionCoolDown > block.timestamp) 
                { revert CannotDistribute(); }
        _distributeGold();
        uint256 rewardAmount = nextRewardAmount;
        if (rewardAmount == 0 ) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        nextRewardAmount = 0;
        _notifyReward(rewardAmount);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint256) {
        uint256 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256) {
        require(blockNumber < block.number, "gOHM::getPriorVotes: not yet determined");

        uint256 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint256 lower = 0;
        uint256 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    /**
     * @notice Stake
     * @param amount Amount of staking token
     */
    function stake(uint256 amount) external {
        // stakeFor(msg.sender, amount);
        stakeFor2(msg.sender, amount);
    }

    function stakeFor2(address _for, uint256 _amount) public whenNotPaused {
        if (_amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        
        // pull tokens and apply stake
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _lastIndex = _accountLastStakeIndex[_for];
        _accountLastStakeIndex[_for] = ++_lastIndex;
        _applyStake(_for, _amount, _lastIndex);
        _moveDelegates(address(0), delegates[_for], _amount);
    }

    function getAccountLastStakeIndex(address account) external view returns (uint256) {
        return _accountLastStakeIndex[account];
    }

    function getAccountStakeInfo(address account, uint256 index) external view returns (StakeInfo memory) {
        return _stakeInfos[account][index];
    }

    function getCheckpoint(address account, uint256 epoch) external view returns (Checkpoint memory) {
        return checkpoints[account][epoch];
    }

    function _withdrawFor(
        StakeInfo storage stakeInfo,
        address staker,
        address toAddress,
        uint256 stakeIndex,
        uint256 amount,
        bool claimRewards,
        address rewardsToAddress
    ) internal updateReward(staker, stakeIndex) {
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        uint256 _stakeAmount = stakeInfo.amount;
        if (_stakeAmount < amount) 
            { revert CommonEventsAndErrors.InsufficientBalance(address(stakingToken), amount, _stakeAmount); }

        unchecked {
            stakeInfo.amount = _stakeAmount - amount;
        }
        _balances[staker] -= amount;
        totalSupply -= amount;
        _moveDelegates(delegates[staker], address(0), amount);

        stakingToken.safeTransfer(toAddress, amount);
        emit Withdrawn(staker, toAddress, stakeIndex, amount);

        if (claimRewards) {
            // can call internal because user reward already updated
            _getReward(staker, rewardsToAddress, stakeIndex);
        }
    }

    /**
     * @notice Withdraw staked tokens
     * @param amount Amount to withdraw
     * @param claim Boolean if to claim rewards
     */
    function withdraw(uint256 amount, uint256 index, bool claim) external {
        // _withdrawFor(msg.sender, msg.sender, amount, claim, msg.sender);
        StakeInfo storage _stakeInfo = _stakeInfos[msg.sender][index];
        _withdrawFor(_stakeInfo, msg.sender, msg.sender, index, amount, claim, msg.sender);
    }

    /**
     * @notice Withdraw all staked tokens
     * @param claim Boolean if to claim rewards
     */
    function withdrawAll(uint256 stakeIndex, bool claim) external {
        // _withdrawFor(msg.sender, msg.sender, _balances[msg.sender], claim, msg.sender);
        StakeInfo storage _stakeInfo = _stakeInfos[msg.sender][stakeIndex];
        _withdrawFor(_stakeInfo, msg.sender, msg.sender, stakeIndex, _stakeInfo.amount, claim, msg.sender);
    }

    /// @notice Owner can pause user swaps from occuring
    function pause() external onlyElevatedAccess {
        _pause();
    }

    /// @notice Owner can unpause so user swaps can occur
    function unpause() external onlyElevatedAccess {
        _unpause();
    }

    /**
     * @notice Get account staked balance
     * @param account Account
     * @return Staked balance of account
     */
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function stakeBalanceOf(address account, uint256 stakeIndex) external view returns (uint256) {
        StakeInfo storage stakeInfo = _stakeInfos[account][stakeIndex];
        return stakeInfo.amount;
    }

    /**
     * @notice Get earned rewards of account
     * @param account Account
     * @param index Index
     * @return Earned rewards of account
     */
    function earned(address account, uint256 index) external view returns (uint256) {
        return _earned(account, index, _stakeInfos[account][index].amount);
    }

    /**
     * @notice Get Temple Gold reward per token of Temple 
     * @return Reward per token
     */
    function rewardPerToken() external view returns (uint256) {
        return _rewardPerToken();
    }

    /**
     * @notice Get finish timestamp of rewards
     * @return Finish timestamp
     */
    function rewardPeriodFinish() external view returns (uint40) {
        return rewardData.periodFinish;
    }

    /**
     * @notice Elevated access can recover tokens which are not staking or reward tokens
     * @param _token Token to recover
     * @param _to Recipient
     * @param _amount Amount of tokens
     */
    function recoverToken(address _token, address _to, uint256 _amount) external onlyElevatedAccess {
        if (_token == address(stakingToken) || _token == address(rewardToken )) 
            { revert CommonEventsAndErrors.InvalidAddress(); }

        IERC20(_token).safeTransfer(_to, _amount);
        emit CommonEventsAndErrors.TokenRecovered(_to, _token, _amount);
    }

    /**  
     * @notice Get rewards
     * @param staker Staking account
     * @param index Index
     */
    function getReward(address staker, uint256 index) external updateReward(staker, index) {
        _getReward(staker, staker, index);
    }

    /**  
     * @notice Mint and distribute Temple Gold rewards 
     */
    function distributeGold() external {
        _distributeGold();
    }

    /**  
     * @notice Notify rewards distribution. Called by TempleGold contract after successful mint
     * @param amount Amount minted to this contract
     */
    function notifyDistribution(uint256 amount) external {
        if (msg.sender != address(rewardToken)) { revert CommonEventsAndErrors.InvalidAccess(); }
        /// @notice Temple Gold contract mints TGLD amount to contract before calling `notifyDistribution`
        nextRewardAmount += amount;
        lastRewardNotificationTimestamp = uint96(block.timestamp);
        emit GoldDistributionNotified(amount, block.timestamp);
    }
    
    /**  
     * @notice Get reward data
     * @return Reward data
     */
    function getRewardData() external view returns (Reward memory) {
        return rewardData;
    }

    function _getReward(address staker, address rewardsToAddress, uint256 index) internal {
        uint256 amount = claimableRewards[staker][index];
        if (amount > 0) {
            claimableRewards[staker][index] = 0;
            rewardToken.safeTransfer(rewardsToAddress, amount);
            emit RewardPaidIndex(staker, rewardsToAddress, index, amount);
        }
    }

    function _earned(
        address _account,
        uint256 _index,
        uint256 _balance
    ) internal view returns (uint256) {
        StakeInfo storage _stakeInfo = _stakeInfos[_account][_index];
        if (_stakeInfo.stakeTime == 0) {
            return 0;
        }

        uint256 vestingRate;
        if (block.timestamp > _stakeInfo.fullyVestedAt) {
            vestingRate = 1e18;
        } else {
            vestingRate = (block.timestamp - _stakeInfo.stakeTime) * 1e18 / vestingPeriod;
        }
        uint256 _perTokenReward;
        if (vestingRate == 1e18) { 
            _perTokenReward = _rewardPerToken(); 
        } else { 
            _perTokenReward = _rewardPerToken() * vestingRate / 1e18;
        }
        
        return
            (_balance * (_perTokenReward - userRewardPerTokenPaid[_account][_index])) / 1e18 +
            claimableRewards[_account][_index];
    }

    function _getVestingRate(StakeInfo storage _stakeInfo) internal view returns (uint256 vestingRate) {
        if (_stakeInfo.stakeTime == 0) {
            return 0;
        }
        if (block.timestamp > _stakeInfo.fullyVestedAt) {
            vestingRate = 1e18;
        } else {
            vestingRate = (block.timestamp - _stakeInfo.stakeTime) * 1e18 / vestingPeriod;
        }
    }

    function _applyStake(address _for, uint256 _amount, uint256 _index) internal updateReward(_for, _index) {
        totalSupply += _amount;
        _balances[_for] += _amount;
        _stakeInfos[_for][_index] = StakeInfo(uint64(block.timestamp), uint64(block.timestamp + vestingPeriod), _amount);
        emit Staked(_for, _amount);
    }

    function _rewardPerToken() internal view returns (uint256) {
        if (totalSupply == 0) {
            return rewardData.rewardPerTokenStored;
        }

        return
            rewardData.rewardPerTokenStored +
            (((_lastTimeRewardApplicable(rewardData.periodFinish) -
                rewardData.lastUpdateTime) *
                rewardData.rewardRate * 1e18)
                / totalSupply);
    }

    function _notifyReward(uint256 amount) private {
        if (block.timestamp >= rewardData.periodFinish) {
            rewardData.rewardRate = uint216(amount / rewardDuration);
            // collect dust
            nextRewardAmount = amount - (rewardData.rewardRate * rewardDuration);
        } else {
            uint256 remaining = uint256(rewardData.periodFinish) - block.timestamp;
            uint256 leftover = remaining * rewardData.rewardRate;
            rewardData.rewardRate = uint216((amount + leftover) / rewardDuration);
            // collect dust
            nextRewardAmount = (amount + leftover) - (rewardData.rewardRate * rewardDuration);
        }
        rewardData.lastUpdateTime = uint40(block.timestamp);
        rewardData.periodFinish = uint40(block.timestamp + rewardDuration);
    }

    function _lastTimeRewardApplicable(uint256 _finishTime) internal view returns (uint256) {
        if (_finishTime < block.timestamp) {
            return _finishTime;
        }
        return block.timestamp;
    }

    function _distributeGold() internal {
        /// @dev no op silent fail if nothing to distribute
        ITempleGold(address(rewardToken)).mint();
    }

    function _updateAccountWithdrawTime(address _account, uint256 _amount, uint256 _newBalance) private {
        if (userWithdrawTimes[_account] == 0) {
            userWithdrawTimes[_account] = block.timestamp + delegationPeriod;
        } else {
            userWithdrawTimes[_account] = userWithdrawTimes[_account] + delegationPeriod * _amount/ _newBalance;
        }
    }

    function _canWithdraw(address _account) private view returns (bool) {
        return userWithdrawTimes[_account] <= block.timestamp;
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint256 delegatorBalance = _balances[delegator];
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);
        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint256 amount
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint256 srcRepNum = numCheckpoints[srcRep];
                uint256 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint256 srcRepNew = srcRepOld - amount;
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint256 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint256 dstRepNew = dstRepOld + amount;
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint256 nCheckpoints,
        uint256 oldVotes,
        uint256 newVotes
    ) internal {
        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == block.number) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(block.number, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        } 
        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    modifier updateReward(address _account, uint256 _index) {
        {
            // stack too deep
            rewardData.rewardPerTokenStored = uint216(_rewardPerToken());
            rewardData.lastUpdateTime = uint40(_lastTimeRewardApplicable(rewardData.periodFinish));
            if (_account != address(0)) {
                StakeInfo storage _stakeInfo = _stakeInfos[_account][_index];
                uint256 vestingRate = _getVestingRate(_stakeInfo);
                claimableRewards[_account][_index] = _earned(_account, _index, _stakeInfo.amount);
                vestingRate = _getVestingRate(_stakeInfo);
                userRewardPerTokenPaid[_account][_index] = vestingRate * uint256(rewardData.rewardPerTokenStored) / 1e18;
            }
        }
        _;
    }
    
    modifier onlyMigrator() {
        if (msg.sender != migrator) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}