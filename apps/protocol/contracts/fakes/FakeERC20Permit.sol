// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';

/**
 * A Fake ERC20PermitMock contract for testing. Can create as many named tokens as we need.
 * They all have public mint to aid testing
 */
contract ERC20PermitMock is ERC20Permit {
  constructor(string memory name, string memory symbol)
    ERC20(name, symbol)
    ERC20Permit(name)
  {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }
}
