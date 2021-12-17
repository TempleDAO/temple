
pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later
interface IFaith {

    function totalSupply() external returns(uint256);

    function balances(address account) external returns(uint256);

    function canManagerFaith(address account) external returns(bool);
    
    function gain(address to, uint256 amount) external;
    function loose(address to, uint256 amount) external;

    function adManager(address account) external;

    function removeManager(address account) external;
}