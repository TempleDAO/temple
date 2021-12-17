pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

contract Faith is Ownable {

    // User balance
    mapping(address => uint256) public balances;
    mapping(address => bool ) private canMint;

    uint256 public totalSupply;
 
    event Mint(address account, uint256 amount);
    constructor() {
    }

    function mint(address to, uint256 amount) external {
        require(canMint[msg.sender] == true, "Faith: caller can't mint");
        totalSupply += amount;
        balances[to] += amount;
        emit Mint(to, amount);
    }
    function addMinter(address account) external onlyOwner {
        canMint[account] = true;
   }

    function removeMinter(address account) external onlyOwner {
        canMint[account] = false;
  }
}