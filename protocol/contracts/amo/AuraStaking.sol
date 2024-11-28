pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (amo/AuraStaking.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { IAuraStaking } from "contracts/interfaces/amo/IAuraStaking.sol";
import { IAuraBaseRewardPool } from "contracts/interfaces/external/aura/IAuraBaseRewardPool.sol";
import { IAuraBooster } from "contracts/interfaces/external/aura/IAuraBooster.sol";

contract AuraStaking is IAuraStaking, TempleElevatedAccess {
    using SafeERC20 for IERC20;

    // @notice BPT tokens for balancer pool
    IERC20 public immutable override bptToken;

    AuraPoolInfo public override auraPoolInfo;

    // @notice Aura booster
    IAuraBooster public immutable override booster;

    address public override rewardsRecipient;
    address[] public override rewardTokens;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        IERC20 _bptToken,
        IAuraBooster _booster,
        address[] memory _rewardTokens
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor) 
    {
        bptToken = _bptToken;
        booster = _booster;
        rewardTokens = _rewardTokens;
    }

    function setAuraPoolInfo(uint32 _pId, address _token, address _rewards) external override onlyElevatedAccess {
        auraPoolInfo.pId = _pId;
        auraPoolInfo.token = _token;
        auraPoolInfo.rewards = _rewards;

        emit SetAuraPoolInfo(_pId, _token, _rewards);
    }

    function setRewardsRecipient(address _recipient) external override onlyElevatedAccess {
        rewardsRecipient = _recipient;

        emit SetRewardsRecipient(_recipient);
    }

    /// @notice Set the expected reward tokens which are checked/transferred to the rewardsRecipient
    /// when getReward is called
    function setRewardTokens(address[] calldata _rewardTokens) external override onlyElevatedAccess {
        rewardTokens = _rewardTokens;
        emit RewardTokensSet(_rewardTokens);
    }

    /**
     * @notice Recover any token from AMO
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external override onlyElevatedAccess {
        IERC20(token).safeTransfer(to, amount);

        emit RecoveredToken(token, to, amount);
    }
    
    function isAuraShutdown() public override view returns (bool) {
        // It's not necessary to check that the booster itself is shutdown, as that can only
        // be shutdown once all the pools are shutdown - see Aura BoosterOwner.shutdownSystem()
        return booster.poolInfo(auraPoolInfo.pId).shutdown;
    }

    function depositAndStake(uint256 amount) external override onlyElevatedAccess {
        // Only deposit if the aura pool is open. Otherwise leave the BPT in this contract.
        if (!isAuraShutdown()) {
            bptToken.safeIncreaseAllowance(address(booster), amount);
            booster.deposit(auraPoolInfo.pId, amount, true);
        }
    }

    // withdraw deposit token and unwrap to bpt tokens
    function withdrawAndUnwrap(uint256 amount, bool claim, address recipient) external override onlyElevatedAccess {
        // Optimistically use BPT balance in this contract, and then try and unstake any remaining
        uint256 bptBalance = bptToken.balanceOf(address(this));
        uint256 toUnstake = (amount < bptBalance) ? 0 : amount - bptBalance;
        if (toUnstake > 0) {
            IAuraBaseRewardPool(auraPoolInfo.rewards).withdrawAndUnwrap(toUnstake, claim);
        }

        if (recipient != address(0)) {
            // unwrapped amount is 1 to 1
            bptToken.safeTransfer(recipient, amount);
        }
    }

    function withdrawAllAndUnwrap(bool claim, address recipient) external override onlyElevatedAccess {
        IAuraBaseRewardPool(auraPoolInfo.rewards).withdrawAllAndUnwrap(claim);
        if (recipient != address(0)) {
            uint256 bptBalance = bptToken.balanceOf(address(this));
            bptToken.safeTransfer(recipient, bptBalance);
        }
    }

    function getReward(bool claimExtras) external override {
        IAuraBaseRewardPool(auraPoolInfo.rewards).getReward(address(this), claimExtras);
        address _rewardsRecipient = rewardsRecipient;
        if (_rewardsRecipient != address(0)) {
            uint256 length = rewardTokens.length;
            IERC20 rewardToken;
            for (uint i; i < length; ++i) {
                rewardToken = IERC20(rewardTokens[i]);
                uint256 balance = rewardToken.balanceOf(address(this));

                if (balance > 0) {
                    rewardToken.safeTransfer(_rewardsRecipient, balance);
                }
            }
        }
    }

    function stakedBalance() public override view returns (uint256 balance) {
        balance = IAuraBaseRewardPool(auraPoolInfo.rewards).balanceOf(address(this));
    }

    /**
     * @notice The total balance of BPT owned by this contract - either staked in Aura 
     * or unstaked
     */
    function totalBalance() external override view returns (uint256) {
        return stakedBalance() + bptToken.balanceOf(address(this));
    }

    function earned() public override view returns (uint256 earnedRewards) {
        earnedRewards = IAuraBaseRewardPool(auraPoolInfo.rewards).earned(address(this));
    }

    /**
     * @notice show staked position and earned rewards
     */
    function showPositions() external override view returns (Position memory position){
        position.staked = stakedBalance();
        position.earned = earned();
    }
}