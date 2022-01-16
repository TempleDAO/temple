
pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later
interface IFaith {

    function totalSupply() external view returns(uint256);

    function balances(address account) external view returns(uint112, uint112);

    function canManagerFaith(address account) external returns(bool);
    
    function gain(address to, uint112 amount) external;
    function redeem(address to, uint112 amount) external;

    function addManager(address account) external;

    function removeManager(address account) external;
}