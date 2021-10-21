pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * Sandalwood rewarded as part of the Opening Ceremony quests
 */
contract SandalwoodToken is ERC20, ERC20Burnable {
    constructor() ERC20("Sandalwood", "Sandalwood") {
      _mint(_msgSender(), 1e12 * 1e18);
    }
}