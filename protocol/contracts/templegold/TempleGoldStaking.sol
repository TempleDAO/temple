pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleGoldStaking.sol)


import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ClearableEnumerableSet } from "contracts/templegold/ClearableEnumerableSet.sol";

/** 
 * @title Temple Gold Staking
 * @notice Temple Gold Staking contract. Stakers deposit Temple and claim rewards in Temple Gold. 
 * Temple Gold is distributed to staking contract for stakers on mint. Minted Temple Gold are sent directly to Staking contract.
 * A non-transferrable vote token is minted 1;1 to stakers on the amount they staked. Duration for distributing staking rewards is 7 days.
 */
contract TempleGoldStaking is ITempleGoldStaking, TempleElevatedAccess, Pausable {
    using SafeERC20 for IERC20;
    using ClearableEnumerableSet for ClearableEnumerableSet.ClearableAddressSet;

    /// @notice The staking token. Temple
    IERC20 public immutable override stakingToken;
    /// @notice Reward token. Temple Gold
    IERC20 public immutable override rewardToken;

    /// @notice Distribution starter
    address public override distributionStarter;

    uint256 constant public WEEK_LENGTH = 7 days;

    /// @notice Rewards stored per token
    uint256 public override rewardPerTokenStored;
    /// @notice Total supply of staking token
    uint256 public override totalSupply;

    /// @notice The time it takes until half the voting weight is reached for a staker
    uint256 public override halfTime;

    /// @notice Time tracking
    uint256 public override periodFinish;
    uint256 public override lastUpdateTime;

    /// @notice Store next reward amount for next epoch
    uint256 public override nextRewardAmount;
    /// @notice Duration for rewards distribution
    uint256 public constant REWARD_DURATION = 7 days;
    /// @notice Cooldown time before next distribution of rewards
    /// @dev If set to zero, rewards distribution is callable any time 
    uint160 public override rewardDistributionCoolDown;
    /// @notice Timestamp for last reward notification
    uint96 public override lastRewardNotificationTimestamp;

    /// @notice Minimum time of delegation before reset
    uint32 public override delegationPeriod;

    /// @notice For use when migrating to a new staking contract if TGLD changes.
    address public override migrator;
    /// @notice Data struct for rewards
    Reward internal rewardData;
    /// @notice Staker balances
    mapping(address account => uint256 balance) private _balances;
    /// @notice Stakers claimable rewards
    mapping(address account => uint256 amount) public override claimableRewards;
    /// @notice Staker reward per token paid
    mapping(address account => uint256 amount) public override userRewardPerTokenPaid;

    /// @notice Staker weights for calculating vote weights
    mapping(address account => AccountWeightParams weight) private _weights;
    mapping(address account => AccountPreviousWeightParams weight) private _prevWeights;
    
    /// @notice Delegates
    mapping(address delegate => bool isDelegate) public override delegates;
    /// @notice Use as alias for delegate "balances" for easier vote weight calculation
    mapping(address delegate => uint256 balance) private _delegateBalances;
    /// @notice Keep track of users and their delegates
    mapping(address account => address delegate) public override userDelegates;
    /// @notice Keep track of delegates and users delegated to them
    mapping(address delegate => ClearableEnumerableSet.ClearableAddressSet) private _delegateUsersSet;
    /// @notice keep track of user withdraw times
    mapping(address user => uint256 withdrawTime) public userWithdrawTimes;

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
    function setMigrator(address _migrator) external override onlyElevatedAccess {
        if (_migrator == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        migrator = _migrator;
        emit MigratorSet(_migrator);
    }

    /**  
     * @notice Set vote delegate for a user. User can delegate to self
     * @param _delegate Delegate
     */
    function setUserVoteDelegate(address _delegate) external override {
        if (_delegate == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (!delegates[_delegate]) {  revert InvalidDelegate(); }
        // delegates not allowed to delgate
        // if you are self delegated as a delegate, you are not allowed to set delegate until reset
        // total vote counted from governance contracts with own vote weight and delegated vote weight
        if (delegates[msg.sender]) { revert CannotDelegate(); }

        if (userWithdrawTimes[msg.sender] > block.timestamp) { revert CannotDelegate(); }

        // remove old delegate if any
        address _userDelegate = userDelegates[msg.sender];
        if (_userDelegate == _delegate) { return; }
        ClearableEnumerableSet.ClearableAddressSet storage prevDelegateUsersSet = _delegateUsersSet[_userDelegate];
        uint256 userBalance = _balances[msg.sender];

        /// @dev for a previous delegate who is no longer a valid delegate
        /// _delegateUsersSet[_delegate] was cleared so `remove = false`
        bool removed = prevDelegateUsersSet.remove(msg.sender);
        // update vote weight and _delegateBalances
        if (userBalance > 0) {
            uint256 _prevBalance;
            uint256 _newDelegateBalance;
            if (removed) {
                // update vote weight of old delegate
                _prevBalance = _delegateBalances[_userDelegate];
                /// @dev skip for a previous delegate with 0 users delegated and 0 own vote weight
                if (_prevBalance > 0 && _userDelegate != msg.sender) {
                    /// @dev `_prevBalance > 0` because when a user sets delegate, vote weight and `_delegateBalance` are updated for delegate
                    _newDelegateBalance = _delegateBalances[_userDelegate] = _prevBalance - userBalance;
                    _updateAccountWeight(_userDelegate, _prevBalance, _newDelegateBalance, false);
                }
            }
            // setting a new delegate always increases withdraw time by delegation period
            userWithdrawTimes[msg.sender] = block.timestamp + delegationPeriod;
            /// @dev Reuse variables
            _prevBalance = _delegateBalances[_delegate];
            _newDelegateBalance = _delegateBalances[_delegate] = _prevBalance + userBalance;
            _updateAccountWeight(_delegate, _prevBalance, _newDelegateBalance, true);
        }
        userDelegates[msg.sender] = _delegate;
        _delegateUsersSet[_delegate].add(msg.sender);

        emit UserDelegateSet(msg.sender, _delegate);
    }

    /**  
     * @notice Set self as vote delegate. If false all users delegated to `msg.sendeer` have to select new delegates
     * @param _approve If delegate approved
     */
    function setSelfAsDelegate(bool _approve) external override {
        bool prevStatusTrue = delegates[msg.sender];
        delegates[msg.sender] = _approve;
        emit VoteDelegateSet(msg.sender, _approve);
        // unset old delegate
        if (_approve && userDelegates[msg.sender] != address(0)) { unsetUserVoteDelegate(); }
        // remove delegate vote and reset delegateBalance
        if (!_approve && prevStatusTrue) {
            uint256 delegateBalance = _delegateBalances[msg.sender];
            _delegateBalances[msg.sender] = 0;
            /// @dev if no user delegated to delegate
            /// delegate vote weight will default to vote weight as a user
            if (delegateBalance > 0) {
                uint256 stakeBalance = _balances[msg.sender];
                if (delegateBalance > stakeBalance) {
                    _updateAccountWeight(msg.sender, delegateBalance, stakeBalance, false);
                } else if (delegateBalance < stakeBalance) {
                    _updateAccountWeight(msg.sender, delegateBalance, stakeBalance, true);
                }
            }

            _delegateUsersSet[msg.sender].clear();
        }
    }

    /**  
     * @notice Unset delegate for a user
     */
    function unsetUserVoteDelegate() public override {
        address _delegate = userDelegates[msg.sender];
        if (_delegate == address(0)) { revert InvalidDelegate(); }

        bool removed = _delegateUsersSet[_delegate].remove(msg.sender);
        delete userDelegates[msg.sender];

        if (userWithdrawTimes[msg.sender] > block.timestamp) { revert InvalidOperation(); }
        userWithdrawTimes[msg.sender] = 0;
        uint256 userBalance = _balances[msg.sender];
        if (userBalance > 0 && removed) {
            // update vote weight of old delegate
            uint256 _prevBalance = _delegateBalances[_delegate];
            uint256 _newDelegateBalance = _delegateBalances[_delegate] = _prevBalance - userBalance;
            _updateAccountWeight(_delegate, _prevBalance, _newDelegateBalance, false);
        }
        emit UserDelegateSet(msg.sender, address(0));
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
     * @notice Set half time parameter for calculating vote weight.
     * @dev The voting half-time variable determines the time it takes until half the voting weight is reached for a stake.
     *      Formular from st-yETH https://docs.yearn.fi/getting-started/products/yeth/overview
     * @param _halfTime Cooldown in seconds
     */
    function setHalfTime(uint256 _halfTime) external override onlyElevatedAccess {
        if (_halfTime == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        halfTime = _halfTime;
        emit HalfTimeSet(_halfTime);
    }

    /**
     * @notice Set minimum time before undelegation. This is also used to check before withdrawal after stake if account is delegated
     * @param _period Minimum delegation time
     */
    function setDelegationPeriod(uint32 _period) external override onlyElevatedAccess {
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
      */
    function migrateWithdraw(address staker) external override onlyMigrator returns (uint256) {
        if (staker == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        uint256 stakerBalance = _balances[staker];
        _withdrawFor(staker, msg.sender, stakerBalance, true, staker);
        return stakerBalance;
    }
    
    /**
     * @notice Distributed TGLD rewards minted to this contract to stakers
     * @dev This starts another 7-day rewards distribution. Calculates new `rewardRate` from any left over rewards up until now
     */
    function distributeRewards() updateReward(address(0)) external {
        if (distributionStarter != address(0) && msg.sender != distributionStarter) 
            { revert CommonEventsAndErrors.InvalidAccess(); }
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
     * @notice Stake
     * @param amount Amount of staking token
     */
    function stake(uint256 amount) external override {
        stakeFor(msg.sender, amount);
    }

    /**
     * @notice Stake for account when contract is not paused.
     * @param _for Account to stake for
     * @param _amount Amount of staking token
     */
    function stakeFor(address _for, uint256 _amount) public override whenNotPaused {
        if (_amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        
        // pull tokens and apply stake
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _prevBalance = _balances[_for];
        _applyStake(_for, _amount);
        /// @dev set account weight as a fallback if delegate for account is removed in future or user changes delegates
        _updateAccountWeight(_for, _prevBalance, _balances[_for], true);
        // update delegate weight
        /// @dev this avoids using iteration to get voteWeight for all users delegated to delegate
        address delegate = userDelegates[_for];
        if (delegate != address(0) && delegate != _for && delegates[delegate]) {
            _updateAccountWithdrawTime(_for, _amount, _balances[_for]);
            /// @dev Reuse variable
            _prevBalance = _delegateBalances[delegate];
            uint256 _newDelegateBalance = _delegateBalances[delegate] = _prevBalance + _amount;
            _updateAccountWeight(delegate, _prevBalance, _newDelegateBalance, true);
        }
    }

    /**
     * @notice Withdraw staked tokens
     * @param amount Amount to withdraw
     * @param claim Boolean if to claim rewards
     */
    function withdraw(uint256 amount, bool claim) external override {
        _withdrawFor(msg.sender, msg.sender, amount, claim, msg.sender);
    }

    /**
     * @notice Withdraw all staked tokens
     * @param claim Boolean if to claim rewards
     */
    function withdrawAll(bool claim) external override {
        _withdrawFor(msg.sender, msg.sender, _balances[msg.sender], claim, msg.sender);
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
        return _earned(account, _balances[account]);
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
    function getReward(address staker) external override updateReward(staker) {
        _getReward(staker, staker);
    }

    /**  
     * @notice Get vote weight of an account
     * @param account Account
     */
    function getVoteWeight(address account) external view returns (uint256) {
        return _voteWeight(account, _balances[account]);
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
     * @notice Get vote weight of delegate
     * @param _delegate Delegate
     * @return Vote weight
     */
    function getDelegatedVoteWeight(address _delegate) external view returns (uint256) {
        return _voteWeight(_delegate, _delegateBalances[_delegate]);
    }

    /**  
     * @notice Get all accounts delegated to delegate
     * @param _delegate Delegate
     * @return users Array of accounts
     */
    function getDelegateUsers(address _delegate) external override view returns (address[] memory users) {
        return _delegateUsersSet[_delegate].values();
    }

    /**  
     * @notice Check if user is delegated to delegate
     * @param _user User
     * @param _delegate Delegate
     * @return Bool if user is delegated to delegate
     */
    function userDelegated(address _user, address _delegate) external override view returns (bool) {
        return _delegateUsersSet[_delegate].contains(_user);
    }
    
    /**  
     * @notice Get reward data
     * @return Reward data
     */
    function getRewardData() external override view returns (Reward memory) {
        return rewardData;
    }

    /**  
     * @notice Get weights used for measuring vote weight for an account
     * @param _account Account
     * @return weight AccountWeightParams
     */
    function getAccountWeights(address _account) external override view returns (AccountWeightParams memory weight) {
        weight = _weights[_account];
    }

    function _getReward(address staker, address rewardsToAddress) internal {
        uint256 amount = claimableRewards[staker];
        if (amount > 0) {
            claimableRewards[staker] = 0;
            rewardToken.safeTransfer(rewardsToAddress, amount);

            emit RewardPaid(staker, rewardsToAddress, amount);
        }
    }

    function _earned(
        address _account,
        uint256 _balance
    ) internal view returns (uint256) {
        return
            (_balance * (_rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18 +
            claimableRewards[_account];
    }

    function _applyStake(address _for, uint256 _amount) internal updateReward(_for) {
        totalSupply += _amount;
        _balances[_for] += _amount;
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

    function _withdrawFor(
        address staker,
        address toAddress,
        uint256 amount,
        bool claimRewards,
        address rewardsToAddress
    ) internal updateReward(staker) {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        uint256 _prevBalance = _balances[staker];
        if (_prevBalance < amount) 
            { revert CommonEventsAndErrors.InsufficientBalance(address(stakingToken), amount, _prevBalance); }
        if (!_canWithdraw(staker)) { revert MinimumStakePeriod(); }

        totalSupply -= amount;
        uint256 stakeBalance = _prevBalance - amount;
        _balances[staker] = stakeBalance;
        if (stakeBalance == 0) { delete userWithdrawTimes[staker]; }

        /// @dev update account weight as a fallback if delegate for account(if any) is removed in future or user changes delegates
        _updateAccountWeight(staker, _prevBalance, _balances[staker], false);
        /// @dev this avoids using iteration to get voteWeight for all users delegated to delegate
        address delegate = userDelegates[staker];
        if (delegate != address(0) && delegate != staker && delegates[delegate]) {
            /// @dev Reuse variable
            _prevBalance = _delegateBalances[delegate];
            /// @dev `_prevBalance > 0` because when a user sets delegate, vote wieght and `_delegateBalance` are updated for delegate
            uint256 _newDelegateBalance = _delegateBalances[delegate] = _prevBalance - amount;
            _updateAccountWeight(delegate, _prevBalance, _newDelegateBalance, false);
        }

        stakingToken.safeTransfer(toAddress, amount);
        emit Withdrawn(staker, toAddress, amount);
     
        if (claimRewards) {
            // can call internal because user reward already updated
            _getReward(staker, rewardsToAddress);
        }
    }

    function _notifyReward(uint256 amount) private {
        if (block.timestamp >= rewardData.periodFinish) {
            rewardData.rewardRate = uint216(amount / REWARD_DURATION);
        } else {
            uint256 remaining = uint256(rewardData.periodFinish) - block.timestamp;
            uint256 leftover = remaining * rewardData.rewardRate;
            rewardData.rewardRate = uint216((amount + leftover) / REWARD_DURATION);
        }

        rewardData.lastUpdateTime = uint40(block.timestamp);
        rewardData.periodFinish = uint40(block.timestamp + REWARD_DURATION);
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

    function _voteWeight(address _account, uint256 _balance) private view returns (uint256) {
        /// @dev Vote weights are always evaluated at the end of last week
        /// Borrowed from st-yETH staking contract (https://etherscan.io/address/0x583019fF0f430721aDa9cfb4fac8F06cA104d0B4#code)
        uint256 currentWeek = (block.timestamp / WEEK_LENGTH) - 1;
        (uint256 week, uint256 t, uint256 updated) = _unpackWeight(_account);
        if (week > currentWeek) {
            (week, t, updated, _balance) = _unpackPreviousWeight(_account);
        }
        if (week > 0) {
            t += (block.timestamp / WEEK_LENGTH * WEEK_LENGTH) - updated;
        }
        return _balance * t / (t + halfTime);
    }
    /// @dev Vote weight is the same immediately before and immediately after a deposit.
    /// A withdrawal reduces the vote weight proportionally
    function _updateAccountWeight(
        address _account,
        uint256 _prevBalance,
        uint256 _newBalance,
        bool _increment
    ) private {
        uint256 currentWeek = block.timestamp / WEEK_LENGTH;
        AccountWeightParams storage weight = _weights[_account];
        (uint256 week, uint256 t, uint256 updated) = _unpackWeight(_account);
        uint256 _lastShares = _prevBalance;
        if (week > 0 && currentWeek > week) {
            AccountPreviousWeightParams storage _prevWeight = _prevWeights[_account];
            _prevWeight.weight = AccountWeightParams(
                uint64(week),
                uint64(t),
                uint64(updated)
            );
            _prevWeight.balance = _prevBalance;
        }
        if (_newBalance == 0) {
            t = 0;
            _lastShares = 0;
        }
        if (_lastShares > 0) {
            t = t + block.timestamp - updated;
            if (_increment) {
                // amount has increased, calculate effective time that results in same weight
                uint256 _halfTime = halfTime;
                t = _prevBalance * t * _halfTime / (_newBalance * (t + _halfTime) - _prevBalance * t);
            }
        }
        // update weight
        weight.weekNumber = uint64(currentWeek);
        weight.stakeTime = uint64(t);
        weight.updateTime = uint64(block.timestamp);
    }

    function _unpackWeight(address _account) private view returns (uint256 week, uint256 t, uint256 updated) {
        AccountWeightParams memory params = _weights[_account];
        week = params.weekNumber;
        t = params.stakeTime;
        updated = params.updateTime;
    }

    function _packPreviousWeight(AccountWeightParams storage _weight, address _account, uint256 _balance) private {
        AccountPreviousWeightParams storage _prevWeight = _prevWeights[_account];
        _prevWeight.weight = AccountWeightParams(
            _weight.weekNumber,
            _weight.stakeTime,
            _weight.updateTime
        );
        _prevWeight.balance = _balance;
    }

    function _unpackPreviousWeight(
        address _account
    ) private view returns (uint256 week, uint256 t, uint256 updated, uint256 balance) {
        AccountPreviousWeightParams memory params = _prevWeights[_account];
        week = params.weight.weekNumber;
        t = params.weight.stakeTime;
        updated = params.weight.updateTime;
        balance = params.balance;
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

    modifier updateReward(address _account) {
        {
            // stack too deep
            rewardData.rewardPerTokenStored = uint216(_rewardPerToken());
            rewardData.lastUpdateTime = uint40(_lastTimeRewardApplicable(rewardData.periodFinish));
            if (_account != address(0)) {
                claimableRewards[_account] = _earned(_account, _balances[_account]);
                userRewardPerTokenPaid[_account] = uint256(rewardData.rewardPerTokenStored);
            }
        }
        _;
    }
    
    modifier onlyMigrator() {
        if (msg.sender != migrator) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}