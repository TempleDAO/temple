pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__IPoolManagerV3 {
    function addPool(address _gauge, uint256 _stashVersion) external returns(bool);
    function shutdownPool(uint256 _pid) external returns(bool);
}