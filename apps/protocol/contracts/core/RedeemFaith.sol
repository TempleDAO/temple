pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./IFaith.sol";

/*
 * Manage process of a user redeeming their share of a given month's revenue
 * 
 * If they take no action, it will auto-compoound into the next period.
 *
 * This contract isn't designed to be called directly (@see RedeemFaithManager)
 */
contract RedeemFaith is Ownable {
    IERC20 public templeToken;

    mapping(address => uint112) public pendingClaims;
    uint112 public totalPendingClaims;

    event IncreaseClaim(address claimer, uint256 amount);
    event WithdrawRewards(address claimer, uint256 faithAmount, uint256 templeAmount);
    event InClaimMode(address account, uint256 faithUsed, uint256 templeRewarded);

    constructor(
      IERC20 _templeToken
    ) {
      templeToken = _templeToken;
    }

    /*
     * increase a users claim
     */
    function increaseClaim(address _claimer, uint112 _amountFaith) external onlyOwner {
        pendingClaims[_claimer] += _amountFaith;
        totalPendingClaims += _amountFaith;

        emit IncreaseClaim(_claimer, _amountFaith);
    }

    /*
     * Withdraw in temple a given users claim
     */
    function withdrawRewards(address _claimer) external  {
        uint256 totalRewardsTemple = templeToken.balanceOf(address(this));
        require(totalRewardsTemple > 0, "RedeemFaith: no temple in contract to claim");

        uint112 withdrawShare = pendingClaims[_claimer];
        uint256 templeShare = templeToken.balanceOf(address(this)) * withdrawShare / totalPendingClaims;
        pendingClaims[_claimer] = 0;
        totalPendingClaims -= withdrawShare;

        SafeERC20.safeTransfer(templeToken, _claimer, templeShare);
        emit WithdrawRewards(_claimer, withdrawShare, templeShare);
    }
}