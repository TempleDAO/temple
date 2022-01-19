// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

interface ITempleStaking {
  function stake(uint256 _amountTemple)
    external
    returns (uint256 amountOgTemple);

  function unstake(uint256 _amountOgTemple) external;
}
