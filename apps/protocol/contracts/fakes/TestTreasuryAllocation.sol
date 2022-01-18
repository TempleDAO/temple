pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../ITreasuryAllocation.sol";

/**
 * A fake contract to test semantics of treasury allocating/updating mark to market/withdrawing STABLEC
 * from various treasury activities designed to increase IV.
 */
contract TestTreasuryAllocation is Ownable, ITreasuryAllocation {
    ERC20 STABLEC;

    constructor(ERC20 _STABLEC) {
      STABLEC = _STABLEC;
    }

    function reval() public view override returns (uint256) {
      return STABLEC.balanceOf(address(this));
    }

    function transfer(address to, uint256 amount) external {
      SafeERC20.safeTransfer(STABLEC, to, amount);
    }

    function increaseAllowance(address to, uint256 addedValue) external {
      SafeERC20.safeIncreaseAllowance(STABLEC, to, addedValue);
    }
}