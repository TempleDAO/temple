pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleGoldStakingProxy.sol)


import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";
import {ITempleGoldStakingProxy} from "contracts/interfaces/templegold/ITempleGoldStakingProxy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";


/** 
 * @title Temple Gold Staking Proxy
 * @notice Temple Gold Staking proxy contract. 
 * Temple Gold is distributed for stakers on mint. Minted Temple Gold are sent directly to Staking Proxy first.
 * Elevated access starts a new staking period using Staking Proxy. Minimum duration for distributing staking rewards is 7 days.
 */
contract TempleGoldStakingProxy is ITempleGoldStakingProxy, TempleElevatedAccess {
    using SafeERC20 for IERC20;

    /// @notice Temple Gold token
    IERC20 public immutable templeGold;
    /// @notice Staking contract
    ITempleGoldStaking public staking;

    /// @notice last time rewards were distributed to start a new rewards epoch for stakers
    uint64 public lastDistributionTimestamp;
    /// @notice Minimum period for distriubting next epoch rewards for stakers
    uint64 public constant MINIMUM_REWARDS_DISTRIBUTION_PERIOD = 604800;

    
    constructor(
        address _rescuer,
        address _executor,
        address _templeGold,
        address _staking
    ) TempleElevatedAccess(_rescuer, _executor) {
        templeGold = IERC20(_templeGold);
        staking = ITempleGoldStaking(_staking);
        approveStaking();
    }

    /**
     * @notice Set staking contract address
     * @param _staking Staking contract
     */
    function setStaking(address _staking) external override onlyElevatedAccess {
        if (_staking == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        staking = ITempleGoldStaking(_staking);
        emit StakingSet(_staking);
    } 

    /**
     * @notice Distribute rewards for new epoch
     * @param amount Amount of reward tokens
     * @param duration Duration of reward distribution
     */
    function notifyReward(uint256 amount, uint256 duration) external override onlyElevatedAccess {
        /// @notice rewards distribution must be not be less than 7 days
        if (duration < MINIMUM_REWARDS_DISTRIBUTION_PERIOD) { revert CommonEventsAndErrors.InvalidParam(); }
        uint256 balance = templeGold.balanceOf(address(this));
        if (amount > balance) { revert InvalidAmount(); }
        
        if (templeGold.allowance(address(this), address(staking)) < amount) {
            approveStaking();
        }
        staking.notifyRewardAmount(amount, duration);


        lastDistributionTimestamp = uint64(block.timestamp);
        emit RewardsNotified(amount, duration, block.timestamp, uint256(duration + block.timestamp));
    }

    /**
     * @notice Approve staking contract to pull tokens
     */
    function approveStaking() public override {
        templeGold.forceApprove(address(staking), type(uint).max);
    }

    /**
     * @notice Get Temple Gold balance of this staking proxy contract
     * @return Balance of this staking proxy
     */
    function templeGoldBalance() external override view returns (uint256) {
        return templeGold.balanceOf(address(this));
    }
}