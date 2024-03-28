pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

contract Faith is Ownable {

    // User Faith total and usable balance
    struct FaithBalance {
      uint112 lifeTimeFaith;
      uint112 usableFaith;
    } 

    mapping(address => FaithBalance) public balances;
    mapping(address => bool ) private canManageFaith;

    uint256 public totalSupply;
 
    event Gain(address account, uint256 amount);
    event Loose(address account, uint256 amount);

    constructor() Ownable(msg.sender) {
        // Seed with a single unit of faith, assigned to this contract itself
        // required as faith bonus are calculated as a % of total supply. Without
        // this we get div by 0 errors until the first faith is allocated
        totalSupply += 1;
        balances[address(this)].lifeTimeFaith += 1;
        balances[address(this)].lifeTimeFaith += 1;
    }

    function gain(address to, uint112 amount) external {
        require(canManageFaith[msg.sender] == true, "Faith: caller cannot manage faith");
        totalSupply += amount;
        balances[to].lifeTimeFaith += amount;
        balances[to].usableFaith += amount;
        emit Gain(to, amount);
    }

    function redeem(address to, uint112 amount) external {
        require(canManageFaith[msg.sender] == true, "Faith: caller cannot manage faith");
        uint256 usableFaith = balances[to].usableFaith;
        require(usableFaith >= amount, "Burn exceeds allowance");
        totalSupply -= amount;
        unchecked {
           balances[to].usableFaith -= amount;
        }
        emit Loose(to, amount);
    }

    function addManager(address account) external onlyOwner {
        canManageFaith[account] = true;
    }

    function removeManager(address account) external onlyOwner {
        canManageFaith[account] = false;
  }
}