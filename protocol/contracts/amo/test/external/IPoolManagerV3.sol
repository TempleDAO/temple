pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__IPoolManagerV3 {
    function addPool(address _gauge, uint256 _stashVersion) external returns(bool);
    //function addPool(address _gauge) external returns(bool);
}