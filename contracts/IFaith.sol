
pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later
interface IFaith {

    function totalSupply() external returns(uint256);

    function balances(address account) external returns(uint256);

    function canMint(address account) external returns(bool);
    
    function mint(address to, uint256 amount) external;

    function addMinter(address account) external;

    function removeMinter(address account) external;
}