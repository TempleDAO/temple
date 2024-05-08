pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * A Fake ERC20 contract for testing. Can create as many named toknens as we need. They all have public
 * mint to aid testing
 */
contract FakeERC20 is ERC20 {
    constructor (
        string memory name_,
        string memory symbol_,
        address initialAccount,
        uint256 initialBalance
    ) ERC20(name_, symbol_) {
        if (initialAccount != address(0) && initialBalance > 0) {
            _mint(initialAccount, initialBalance);
        }
    }

    function mint(address to, uint256 amount) external {
      _mint(to, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}
