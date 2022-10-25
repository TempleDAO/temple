pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

interface IAuraBooster {
    function deposit(uint256 _pid, uint256 _amount, bool _stake) external returns (bool);
    function depositAll(uint256 _pid, bool _stake) external returns(bool);
}