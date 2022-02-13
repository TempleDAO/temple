pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./IFaith.sol";
import "./RedeemFaith.sol";

/*
 * Automatically manage faith redemption, allowing the owner to close a given round
 */
contract RedeemFaithManager is Ownable {

    RedeemFaith[] public closed;
    RedeemFaith public active;

    IERC20 public templeToken;
    IFaith public faith;

    event CloseAndRollActiveClaim(address account, uint256 faithUsed, uint256 templeRewarded);

    constructor(
      IERC20 _templeToken,
      IFaith _faith
    ) {
      templeToken = _templeToken;
      faith = _faith;

      active = new RedeemFaith(templeToken);
    }

    /*
     * increase a users claim
     */
    function increaseClaim(uint112 _amountFaith) external {
        (uint112 lifetimeFaith, uint112 usableFaith) = faith.balances(msg.sender);
        require(_amountFaith <= usableFaith, "RedeemFaith: insufficient faith");

        active.increaseClaim(msg.sender, _amountFaith);
        faith.redeem(msg.sender, _amountFaith);
    }

    /*
     * increase a users claim
     */
    function withdrawRewards(address _claimer, uint256[] memory _idxs) external {
        for (uint256 i = 0; i < _idxs.length; i++) {
            closed[_idxs[i]].withdrawRewards(_claimer);
        }
    }

    /*
     * Close off active contract and roll into the next
     */ 
    function closeAndRollActiveClaim(uint256 _amountTemple) external onlyOwner {
        SafeERC20.safeTransfer(templeToken, address(active), _amountTemple);

        closed.push(active);
        active = new RedeemFaith(templeToken);
    }

    function withdrawBalance(IERC20 token, address _to, uint256 _amount)
        external
        onlyOwner
    {
        SafeERC20.safeTransfer(token, _to, _amount);
    }
}