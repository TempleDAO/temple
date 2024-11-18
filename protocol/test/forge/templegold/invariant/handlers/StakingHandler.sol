pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/invariant/StakingHandler.sol)

import { BaseHandler } from "./BaseHandler.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { TimestampStore } from "test/forge/templegold/invariant/stores/TimestampStore.sol";
import { StateStore } from "test/forge/templegold/invariant/stores/StateStore.sol";

contract StakingHandler is BaseHandler {

    ITempleGoldStaking public staking;
    IERC20 public templeToken;
    uint256 public totalStakes;
    uint256 public totalWithdraws;
    uint256 public totalRewards;
    uint256 public collectedRewards;
    mapping(address account => uint256 amount) public rewards;

    constructor(
        TimestampStore timestampStore_,
        StateStore stateStore_,
        address _staking,
        address _templeToken,
        uint256 _initialSupply,
        uint256 _totalRewards
    ) BaseHandler(timestampStore_, stateStore_) {
        staking = ITempleGoldStaking(_staking);
        templeToken = IERC20(_templeToken);
        totalStakes = _initialSupply;
        totalRewards = _totalRewards;
    }

    function stake(uint256 _amount) public instrument useSender {
        uint256 totalStakeBefore = staking.totalSupply();
        // _amount = _bound(_amount, 0, 10_000 ether);
        // approve and stake
        {
            deal(address(templeToken), msg.sender, _amount, true);
            approve(address(templeToken), address(staking), _amount);

            staking.stake(_amount);
        }
        totalStakes += _amount;
        assertGe(totalStakes, totalStakeBefore, "Invariant violation: total staked should be higher after stake");
    }

    function claim(uint256 timeJumpSeed) public instrument useSender adjustTimestamp(timeJumpSeed) {
        // vm.warp(block.timestamp+_bound(timeJumpSeed, 0, 7 days));
        uint256 rewardAmount = staking.earned(msg.sender);
        if (rewardAmount == 0) {
            stateStore.setFinishedEarly();
            return;
        }
        staking.getReward(msg.sender);
        rewards[msg.sender] += rewardAmount;
        collectedRewards += rewardAmount;
        assertGe(
            totalRewards,
            collectedRewards,
            "Invariant violation: total rewards should  be higher than collected rewards"
        );
    }

    function withdraw(uint256 amount) public instrument useSender returns (uint256 withdrawAmount) {
        uint256 totalStake = staking.balanceOf(msg.sender);
        amount = _bound(amount, 0, totalStake);
        if (amount == 0) {
            stateStore.setFinishedEarly();
            return 0;
        }
        // avoid early withdrawal. withdraw end of period finish
        ITempleGoldStaking.Reward memory rData = staking.getRewardData();
        if (block.timestamp < rData.periodFinish) {
            stateStore.setFinishedEarly();
            return 0;
        }
        uint256 withdrawsCache = totalWithdraws;
        staking.withdraw(amount, false);
        withdrawAmount = amount;
        totalWithdraws += amount;
        assertGt(totalWithdraws, withdrawsCache, "Invariant violation: total withdraws  should be higher after withdraw");
    }
}