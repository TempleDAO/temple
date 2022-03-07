pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Model the global revenue share for any given addresss.
 */
contract RevenueShare is Ownable {

    /** 
     * shares for a given account
     */
    mapping(address => uint256) public balanceOf;

    /**
     * Total outstanding shares.
     *
     * If, for example, a user has 100 shares, and the total outstanding is 1000, this user will have a claim
     * on 10% of temple revenue (noting this simplifies the bookkeeping, and doesn't include vault specific revenue)
     */ 
    uint256 public totalSupply;
 
    /**
     * Collaborator contracts that can manage a given accounts shares
     */
    mapping(address => bool) private isManager;

    event Increase(address account, uint256 amount);
    event Decrease(address account, uint256 amount);

    constructor() {}

    function increaseBy(address to, uint256 amount) external onlyManager {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Increase(to, amount);
    }

    function decreaseBy(address to, uint256 amount) external onlyManager {
        totalSupply -= amount;
        balanceOf[to] -= amount;
        emit Decrease(to, amount);
    }

    function addManager(address account) external onlyOwner {
        isManager[account] = true;
    }

    function removeManager(address account) external onlyOwner {
        isManager[account] = false;
    }

    /**
     * Throws if called by any account other than the manager.
     */
    modifier onlyManager() {
        require(isManager[msg.sender], "RevenueShare: caller is not a manager");
        _;
    }
  }
}