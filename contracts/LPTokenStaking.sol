pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./TempleStaking.sol";
import "./ExitQueue.sol";

// import "hardhat/console.sol";

/**
 * Contract by which the community can stake LP Tokens
 */
contract LPTokenStaking is Ownable {
    struct User {
        // Amount of LP Token staked
        uint256 Deposited;

        // Rewards the user would have claimed, if they had staked at contract
        // inception. denominated in SCALED_TEMPLE (that is, TEMPLE / 1e18)
        // This allows us to calculate a users rewards as a simple multiplication
        // of Deposited * rewardsPerShare - rewardDebt
        uint256 RewardDebt;
    }

    mapping(address => User) public userDetails;

    IERC20 public LP_TOKEN; // The LP token being staked, for which TEMPLE rewards are generated
    IERC20 public TEMPLE;   // TEMPLE
    TempleStaking public TEMPLE_STAKING; // Standard staking pool

    // Total rewards per block (denominated in TEMPLE)
    uint256 public rewardPerBlock; 

    // rewards accumulated per share since contract creation up until lastRewardBlock. Denominated
    // in SCALED_TEMPLE (ie, TEMPLE / 1e18)
    uint256 public accRewardsPerShare; 

    // the block up to which we have calculated accRewardsPerShare.
    uint256 public lastRewardBlock; 

    // total LP Token currently staked
    uint256 public totalStaked; 

    event StakeCompleted(address _staker, uint256 _amount, uint256 _totalStaked);
    event PoolUpdated(uint256 _blocksRewarded, uint256 _amountRewarded);
    event RewardsClaimed(address _staker, uint256 _withdrawnAmount, uint256 _rewardsClaimed);    
    event RewardsRestaked(address _staker, uint256 _rewardsClaimed);

    constructor(
        address _LP_TOKEN,
        address _TEMPLE,
        address _TEMPLE_STAKING,
        uint256 _rewardPerBlock) {

        LP_TOKEN = IERC20(_LP_TOKEN);
        TEMPLE = IERC20(_TEMPLE);
        TEMPLE_STAKING = TempleStaking(_TEMPLE_STAKING);

        lastRewardBlock = block.number;
        rewardPerBlock = _rewardPerBlock;
    }

    /** Sets reward for each block */
    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner() {
        updatePool();
        rewardPerBlock = _rewardPerBlock;
    }

    /** get balance of a certain users' stake */
    function getUserBalance(address _staker) external view returns(uint256 _amountStaked) {
        return userDetails[_staker].Deposited;
    }

    /** returns User's pending rewards */
    function pendingRewards(address _staker) external view returns(uint256) {
        User storage user = userDetails[_staker];

        uint256 _accRewardsPerShare = accRewardsPerShare;

        if (block.number > lastRewardBlock && totalStaked != 0) {
            uint256 blocksToReward = block.number - lastRewardBlock;
            uint256 reward = blocksToReward * rewardPerBlock;
            _accRewardsPerShare = _accRewardsPerShare + (reward * 1e18 / totalStaked);
        }

        return (user.Deposited * _accRewardsPerShare / 1e18) - user.RewardDebt;
    }

    /** updates rewards in pool */
    function updatePool() public {
        if (block.number <= lastRewardBlock) {
            return;
        }

        if (totalStaked == 0) {
            lastRewardBlock = block.number;
            return;
        }

        uint256 blocksToReward = block.number - lastRewardBlock;
        lastRewardBlock = block.number;

        uint256 totalRewardsForPeriod = blocksToReward * rewardPerBlock;
        accRewardsPerShare = accRewardsPerShare + (totalRewardsForPeriod * 1e18 / totalStaked);

        emit PoolUpdated(blocksToReward, totalRewardsForPeriod);
    }

    /** lets a user stake tokens we accept */
    function stake(uint256 _amount) external {
        require(_amount > 0, "Can not stake 0 tokens");

        updatePool();

        User storage user = userDetails[msg.sender];

        user.Deposited = user.Deposited + _amount;
        totalStaked = totalStaked + _amount;
        user.RewardDebt += _amount * accRewardsPerShare / 1e18;

        SafeERC20.safeTransferFrom(LP_TOKEN, msg.sender, address(this), _amount);
        emit StakeCompleted(msg.sender, _amount, user.Deposited);
    }

    function unstake() external {        
        User storage user = userDetails[msg.sender];
        require(user.Deposited > 0, "User has no stake");

        updatePool();

        uint256 _withdrawnAmount = user.Deposited;
        uint256 _rewardsClaimed = (_withdrawnAmount * accRewardsPerShare / 1e18) - user.RewardDebt;

        user.Deposited = 0;
        user.RewardDebt = 0;
        totalStaked -= _withdrawnAmount;

        SafeERC20.safeIncreaseAllowance(TEMPLE, address(TEMPLE_STAKING.EXIT_QUEUE()), _rewardsClaimed);
        TEMPLE_STAKING.EXIT_QUEUE().join(msg.sender, _rewardsClaimed);
        SafeERC20.safeTransfer(LP_TOKEN, msg.sender, _withdrawnAmount);
        emit RewardsClaimed(msg.sender, _withdrawnAmount, _rewardsClaimed);    
    }

    function restakeTempleRewards() external {        
        User storage user = userDetails[msg.sender];
        require(user.Deposited > 0, "User has no stake");

        updatePool();

        uint256 _rewardsClaimed = (user.Deposited * accRewardsPerShare) / 1e18 - user.RewardDebt;
        user.RewardDebt = user.Deposited * accRewardsPerShare / 1e18;

        SafeERC20.safeIncreaseAllowance(TEMPLE, address(TEMPLE_STAKING), _rewardsClaimed);
        // TEMPLE_STAKING.stake(msg.sender, _rewardsClaimed);
        emit RewardsRestaked(msg.sender, _rewardsClaimed);    
    }
}