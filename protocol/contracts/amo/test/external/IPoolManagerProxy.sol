pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__IPoolManagerProxy {
    function addPool(address _lptoken, address _gauge, uint256 _stashVersion) external returns(bool);
}