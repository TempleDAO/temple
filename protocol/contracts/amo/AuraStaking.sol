pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IBaseRewardPool.sol";
import "./interfaces/IAuraBooster.sol";
import "./AMOErrors.sol";

abstract contract AuraStaking {
    using SafeERC20 for IERC20;
    
    IERC20 public bptToken;
    AuraPoolInfo public auraPoolInfo;
    IAuraBooster public booster;

    struct AuraPoolInfo {
        address token;
        address rewards;
        uint32 pId;
    }

    function _depositAndStake(uint256 amount) internal {
        if (bptToken.balanceOf(address(this)) < amount) {
            revert AMOErrors.InsufficientBPTAmount(amount);
        }

        bptToken.safeIncreaseAllowance(address(booster), amount);
        // deposit and stake. poolId = 38
        booster.deposit(auraPoolInfo.pId, amount, true);
    }

    function _depositAllAndStake() internal {
        uint256 bptBalance = bptToken.balanceOf(address(this));
        if (bptBalance == 0) {
            revert AMOErrors.InsufficientBPTAmount(0);
        }

        bptToken.safeIncreaseAllowance(address(booster), bptBalance);
        booster.depositAll(auraPoolInfo.pId, true);
    }

    function _withdrawAll(bool claim) internal {
        IBaseRewardPool(auraPoolInfo.rewards).withdrawAll(claim);
    }

    function _withdraw(uint256 amount, bool claim) internal {
        IBaseRewardPool(auraPoolInfo.rewards).withdraw(amount, claim);
    }

    function _withdrawAndUnwrap(uint256 amount, bool claim) internal {
        IBaseRewardPool(auraPoolInfo.rewards).withdrawAndUnwrap(amount, claim);
    }

    function _withdrawAllAndUnwrap(bool claim) internal {
        IBaseRewardPool(auraPoolInfo.rewards).withdrawAllAndUnwrap(claim);
    }

    function _getReward(bool claimExtras) internal {
        IBaseRewardPool(auraPoolInfo.rewards).getReward(address(this), claimExtras);
    }
}