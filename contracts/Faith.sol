pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

contract Faith is Ownable {

    // User balance
    mapping(address => uint256) public balances;
    mapping(address => bool ) private canManageFaith;

    uint256 public totalSupply;
 
    event Gain(address account, uint256 amount);
    event Loose(address account, uint256 amount);

    constructor() {
    }

    function gain(address to, uint256 amount) external {
        require(canManageFaith[msg.sender] == true, "Faith: caller cannot manage faith");
        totalSupply += amount;
        balances[to] += amount;
        emit Gain(to, amount);
    }

    function loose(address to, uint256 amount) external {
        require(canManageFaith[msg.sender] == true, "Faith: caller cannot manage faith");
        if (amount > balances[to]) {
            amount = balances[to];
        }
        totalSupply -= amount;
        balances[to] -= amount;
        emit Loose(to, amount);
    }

    function addManager(address account) external onlyOwner {
        canManageFaith[account] = true;
    }

    function removeManager(address account) external onlyOwner {
        canManageFaith[account] = false;
  }
}