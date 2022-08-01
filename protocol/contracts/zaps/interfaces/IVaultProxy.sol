pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

interface IVaultProxy {
  function getFaithMultiplier(uint256 _amountFaith, uint256 _amountTemple) pure external returns (uint256);
  function faithClaimEnabled() external view returns (bool);
}