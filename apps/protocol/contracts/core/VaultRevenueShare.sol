pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Revenue share per vault
 */
contract VaultRevenueShare is Ownable {

    /** 
     * shares for a given vault
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
     * vaults that are currently enabled (each enabled vault can manage it's own shares)
     */
    mapping(address => bool) private isVault;

    event Increase(address account, uint256 amount);
    event Decrease(address account, uint256 amount);
    event Closeout(address account, uint256 amount);

    constructor() {}

    function increaseBy(uint256 amount) external isVault {
        totalSupply += amount;
        balanceOf[msg.sender] += amount;
        emit Increase(msg.sender, amount);
    }

    function decreaseBy(uint256 amount) external isVault {
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Decrease(msg.sender, amount);
    }

    function closeout() external isVault {
        uint balance = balanceOf[msg.sender];
        totalSupply -= balance;
        balanceOf[msg.sender] = 0;
        isVault[msg.sender] = false;
        emit Closeout(msg.sender, balance);
    }

    // TODO(butlerji): This isn't keeper enabled
    function registerVault(address vault) external onlyOwner {
        isVault[vault] = true;
    }

    /**
     * Throws if called by an account that isn't a registered vault
     */
    modifier isVault() {
        require(isManager[msg.sender], "RevenueShare: caller is not a manager");
        _;
    }
  }
}