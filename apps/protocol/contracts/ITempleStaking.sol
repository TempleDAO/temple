// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

interface ITempleStaking {
  function stakeFor(address _staker, uint256 _amountTemple)
    external
    returns (uint256 amountOgTemple);
}
