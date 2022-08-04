pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

interface IExitQueue {
    function join(address _exiter, uint256 _amount) external;
}