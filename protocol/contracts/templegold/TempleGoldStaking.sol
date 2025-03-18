pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleGoldStaking.sol)


import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/** 
 * @title Temple Gold Staking
 * @notice Temple Gold Staking contract. Stakers deposit Temple and claim rewards in Temple Gold. 
 * Temple Gold is distributed to staking contract for stakers on mint.
 * Duration for distributing staking rewards is set with `setRewardDuration`. An unstake period is used
 * to encourage longer staking times.
 */
contract TempleGoldStaking is ITempleGoldStaking, TempleElevatedAccess, Pausable {
    using SafeERC20 for IERC20;

    /// @notice The staking token. Temple
    IERC20 public immutable override stakingToken;
    /// @notice Reward token. Temple Gold
    IERC20 public immutable override rewardToken;

    /// @notice Distribution starter
    address public override distributionStarter;
    /// @notice DAO executor
    address public override daoExecutor;
    /// @notice Week length
    uint256 constant public WEEK_LENGTH = 7 days;
    /// @notice Total supply of staking token
    uint256 public override totalSupply;

    /// @notice Store next reward amount for next epoch
    uint256 public override nextRewardAmount;
    /// @notice Duration for rewards distribution
    uint256 public override rewardDuration;
    /// @notice Cooldown time before next distribution of rewards
    /// @dev If set to zero, rewards distribution is callable any time 
    uint160 public override rewardDistributionCoolDown;
    /// @notice Timestamp for last reward notification
    uint96 public override lastRewardNotificationTimestamp;
    /// @notice Cooldown time before unstake
    uint32 public override unstakeCooldown;
    /// @notice Maximum unstake cooldown
    uint32 constant public MAXIMUM_UNSTAKE_COOLDOWN = 30 days;

    /// @notice For use when migrating to a new staking contract if TGLD changes.
    address public override migrator;
    /// @notice Data struct for rewards
    Reward internal rewardData;
    /// @notice Staker balances
    mapping(address account => uint256 balance) private _balances;
    /// @notice Account vote delegates
    mapping(address account => address delegate) public delegates;
    /// @notice Stakers claimable rewards
    mapping(address account => uint256 amount) public override claimableRewards;
    /// @notice Staker reward per token paid
    mapping(address account => uint256 amount) public override userRewardPerTokenPaid;
    /// @notice Track voting checkpoints
    mapping(address account => mapping(uint256 epoch => Checkpoint)) private _checkpoints;
    /// @notice Track number of checkpoint for account
    mapping(address account => uint256 number) public override numCheckpoints;
    /// @notice Track stake times for accounts
    mapping(address account => uint256 stakeTime) public override stakeTimes;
    
    constructor(
        address _rescuer,
        address _executor,
        address _stakingToken,
        address _rewardToken
    ) TempleElevatedAccess(_rescuer, _executor){
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    /**
     * @notice Set unstake cooldown
     * @param _period Cooldown period. Zero value accepted to disable cooldown feature
     */
    function setUnstakeCooldown(uint32 _period) external override onlyElevatedAccess {
        if (_period > MAXIMUM_UNSTAKE_COOLDOWN) { revert CommonEventsAndErrors.InvalidParam(); }
        unstakeCooldown = _period;
        emit UnstakeCooldownSet(_period);
    }

    /**
     * @notice Set reward duration
     * @param _duration Reward duration
     */
    function setRewardDuration(uint256 _duration) external override onlyElevatedAccess {
        // minimum reward duration
        if (_duration < WEEK_LENGTH) { revert CommonEventsAndErrors.InvalidParam(); }
        // only change after reward epoch ends
        if (rewardData.periodFinish >= block.timestamp) { revert InvalidOperation(); }
        rewardDuration = _duration;
        emit RewardDurationSet(_duration);
    }

    /**
     * @notice Set starter of rewards distribution
     * @param _starter Starter address
     */
    function setDistributionStarter(address _starter) external onlyElevatedAccess {
        if (_starter == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        distributionStarter = _starter;
        emit DistributionStarterSet(_starter);
    }

    /**
     * @notice Set migrator
     * @param _migrator Migrator
     */
    function setMigrator(address _migrator) external override onlyElevatedAccessUntilDAO {
        if (_migrator == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        migrator = _migrator;
        emit MigratorSet(_migrator);
    }

    /**
     * @notice Set DAO executor
     * @param _executor DAO executor
     */
    function setDaoExecutor(address _executor) external override onlyElevatedAccessUntilDAO {
        if (_executor == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        daoExecutor = _executor;
        emit DAOExecutorSet(_executor);
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) external override {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @notice Set reward distribution cooldown
     * @param _cooldown Cooldown in seconds
     */
    function setRewardDistributionCoolDown(uint160 _cooldown) external override onlyElevatedAccess {
        /// @dev zero cooldown is allowed
        rewardDistributionCoolDown = _cooldown;
        emit RewardDistributionCoolDownSet(_cooldown);
    }

    /**
      * @notice For migrations to a new staking contract
      *         1. Withdraw `staker`s tokens to the new staking contract (the migrator)
      *         2. Any existing rewards are claimed and sent directly to the `staker`
      * @dev Called only from the new staking contract (the migrator).
      *      `setMigrator(new_staking_contract)` needs to be called first
      * @param staker The staker who is being migrated to a new staking contract.
      * @return Staker balance
      */
    function migrateWithdraw(address staker) external override onlyMigrator returns (uint256) {
        if (staker == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        uint256 stakerBalance = _balances[staker];
        _withdrawFor(staker, msg.sender, stakerBalance, true, staker);
        return stakerBalance;
    }
    
    /**
     * @notice Distributed TGLD rewards minted to this contract to stakers
     * @dev This starts another epoch of rewards distribution. Calculates new `rewardRate` from any left over rewards up until now
     */
    function distributeRewards() external override whenNotPaused updateReward(address(0)) {
        if (msg.sender != distributionStarter) { revert CommonEventsAndErrors.InvalidAccess(); }
        if (totalSupply == 0) { revert NoStaker(); }
        // Mint and distribute TGLD if no cooldown set
        if (lastRewardNotificationTimestamp + rewardDistributionCoolDown > block.timestamp) 
                { revert CannotDistribute(); }
        _distributeGold();
        uint256 rewardAmount = nextRewardAmount;
        // revert if next reward is 0 or less than reward duration (final dust amounts)
        if (rewardAmount < rewardDuration ) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        nextRewardAmount = 0;
        _notifyReward(rewardAmount);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external override view returns (uint256) {
        uint256 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? _checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber) external override view returns (uint256) {
        if (blockNumber >= block.number) { revert InvalidBlockNumber(); }

        uint256 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (_checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return _checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (_checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint256 lower = 0;
        uint256 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = _checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return _checkpoints[account][lower].votes;
    }

    /**
     * @notice Stake for an account when contract is not paused
     * @param amount Amount of staking token
     */
    function stake(uint256 amount) external override whenNotPaused {
        _stake(msg.sender, amount);
    }

    /**
     * @notice Private stake function.
     * @param _for Staking account
     * @param _amount Amount of staking token
     */
    function _stake(address _for, uint256 _amount) private  {
        if (_amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        
        // pull tokens and apply stake
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        _applyStake(_for, _amount);
        _moveDelegates(address(0), delegates[_for], _amount);
    }

    /**
     * @notice Withdraw staked tokens
     * @param amount Amount to withdraw
     * @param claimRewards Whether to claim rewards
     */
    function withdraw(uint256 amount, bool claimRewards) external override whenNotPaused {
        /// @dev Check here so migrationWithdraw can skip this in emergency cases
        uint256 unstakeTime = stakeTimes[msg.sender] + unstakeCooldown;
        if (unstakeTime > block.timestamp) { revert UnstakeCooldown(block.timestamp, unstakeTime); }
        _withdrawFor(msg.sender, msg.sender, amount, claimRewards, msg.sender);
    }

    /// @notice Owner can pause user swaps from occuring
    function pause() external override onlyElevatedAccess {
        _pause();
    }

    /// @notice Owner can unpause so user swaps can occur
    function unpause() external override onlyElevatedAccess {
        _unpause();
    }

    /**
     * @notice Get account checkpoint data 
     * @param account Account
     * @param epoch Epoch
     * @return Checkpoint data
     */
    function getCheckpoint(address account, uint256 epoch) external override view returns (Checkpoint memory) {
        return _checkpoints[account][epoch];
    }

    /**
     * @notice Get account staked balance
     * @param account Account
     * @return Staked balance of account
     */
    function balanceOf(address account) public override view returns (uint256) {
        return _balances[account];
    }

    /**
     * @notice Get earned rewards of account
     * @param account Account
     * @return Earned rewards of account
     */
    function earned(address account) external override view returns (uint256) {
        uint256 rewardPerToken_ = _rewardPerToken();
        return _earned(account, rewardPerToken_);
    }

    /**
     * @notice Get Temple Gold reward per token of Temple 
     * @return Reward per token
     */
    function rewardPerToken() external override view returns (uint256) {
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
     * @notice Get account unstake time
     * @param account Account
     * @return Unstake time
     */
    function getAccountUnstakeTime(address account) external override view returns (uint256) {
        return stakeTimes[account] == 0 ? 0 : stakeTimes[account] + unstakeCooldown;
    }

    /**
     * @notice Elevated access can recover tokens which are not staking or reward tokens
     * @param _token Token to recover
     * @param _to Recipient
     * @param _amount Amount of tokens
     */
    function recoverToken(address _token, address _to, uint256 _amount) external override onlyElevatedAccess {
        if (_token == address(stakingToken) || _token == address(rewardToken )) 
            { revert CommonEventsAndErrors.InvalidAddress(); }

        IERC20(_token).safeTransfer(_to, _amount);
        emit CommonEventsAndErrors.TokenRecovered(_to, _token, _amount);
    }

    /**  
     * @notice Get rewards
     * @param staker Staking account
     */
    function getReward(
        address staker
    ) external override whenNotPaused updateReward(staker) {
        _getReward(staker, staker);
    }

    /**  
     * @notice Mint and distribute Temple Gold rewards 
     */
    function distributeGold() external whenNotPaused {
        _distributeGold();
    }

    /**  
     * @notice Notify rewards distribution. Called by TempleGold contract after successful mint
     * @param amount Amount minted to this contract
     */
    function notifyDistribution(uint256 amount) external override {
        if (msg.sender != address(rewardToken) && !isElevatedAccess(msg.sender, msg.sig)) { revert CommonEventsAndErrors.InvalidAccess(); }
        /// @notice Temple Gold contract mints TGLD amount to contract before calling `notifyDistribution`
        nextRewardAmount += amount;
        emit GoldDistributionNotified(amount, block.timestamp);
    }
    
    /**  
     * @notice Get reward data
     * @return Reward data
     */
    function getRewardData() external override view returns (Reward memory) {
        return rewardData;
    }

    function _getReward(address _staker, address _to) internal {
        uint256 amount = claimableRewards[_staker];
        if (amount > 0) {
            claimableRewards[_staker] = 0;
            rewardToken.safeTransfer(_to, amount);
            emit RewardPaid(_staker, _to, amount);
        }
    }

    function _withdrawFor(
        address _staker,
        address _to,
        uint256 _amount,
        bool _claimRewards,
        address _rewardsTo
    ) private updateReward(_staker) {
        if (_amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        uint256 _balance = _balances[_staker];
        if (_amount > _balance) 
            { revert CommonEventsAndErrors.InsufficientBalance(address(stakingToken), _amount, _balance); }
        unchecked {
            _balances[_staker] = _balance - _amount;
        }
        totalSupply -= _amount;
        _moveDelegates(delegates[_staker], address(0), _amount);

        stakingToken.safeTransfer(_to, _amount);
        emit Withdrawn(_staker, _to, _amount);

        // claim reward
        if (_claimRewards) {
            // can call internal because user reward already updated
            _getReward(_staker, _rewardsTo);
        }
    }

    function _earned(
        address account_,
        uint256 rewardPerToken_
    ) internal view returns (uint256) {
        return _balances[account_] * (rewardPerToken_ - userRewardPerTokenPaid[account_]) / 1e18 
            + claimableRewards[account_];
    }

    function _applyStake(address _for, uint256 _amount) internal updateReward(_for) {
        totalSupply += _amount;
        _balances[_for] += _amount;
        stakeTimes[_for] = block.timestamp;
        emit Staked(_for, _amount);
    }

    function _rewardPerToken() internal view returns (uint256) {
        if (totalSupply == 0 || rewardData.lastUpdateTime == rewardData.periodFinish) {
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
        uint256 rewardDurationCache = rewardDuration;
        if (block.timestamp >= rewardData.periodFinish) {
            rewardData.rewardRate = uint216(amount / rewardDurationCache);
            // collect dust
            nextRewardAmount = amount - (rewardData.rewardRate * rewardDurationCache);
        } else {
            uint256 remaining = uint256(rewardData.periodFinish) - block.timestamp;
            uint256 leftover = remaining * rewardData.rewardRate;
            rewardData.rewardRate = uint216((amount + leftover) / rewardDurationCache);
            // collect dust
            nextRewardAmount = (amount + leftover) - (rewardData.rewardRate * rewardDurationCache);
        }
        rewardData.lastUpdateTime = uint40(block.timestamp);
        rewardData.periodFinish = uint40(block.timestamp + rewardDurationCache);
        // update reward notification timestamp
        lastRewardNotificationTimestamp = uint32(block.timestamp);
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
                uint256 srcRepOld = srcRepNum > 0 ? _checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint256 srcRepNew = srcRepOld - amount;
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint256 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld = dstRepNum > 0 ? _checkpoints[dstRep][dstRepNum - 1].votes : 0;
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
        if (nCheckpoints > 0 && _checkpoints[delegatee][nCheckpoints - 1].fromBlock == block.number) {
            _checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            _checkpoints[delegatee][nCheckpoints] = Checkpoint(block.number, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        } 
        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    modifier updateReward(address _account) {
        {
            uint216 rewardPerTokenCached = rewardData.rewardPerTokenStored = uint216(_rewardPerToken());
            rewardData.lastUpdateTime = uint40(_lastTimeRewardApplicable(rewardData.periodFinish));
            if (_account != address(0)) {
                claimableRewards[_account] = _earned(_account, rewardPerTokenCached);
                userRewardPerTokenPaid[_account] = uint256(rewardPerTokenCached);
            }
        }
        _;
    }
    
    modifier onlyMigrator() {
        if (msg.sender != migrator) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }

    modifier onlyElevatedAccessUntilDAO() {
        if (daoExecutor == address(0)) {
            if (!isElevatedAccess(msg.sender, msg.sig)) revert CommonEventsAndErrors.InvalidAccess();
        } else if(msg.sender != daoExecutor) {
            revert CommonEventsAndErrors.InvalidAccess();
        }
        _;
    }
}