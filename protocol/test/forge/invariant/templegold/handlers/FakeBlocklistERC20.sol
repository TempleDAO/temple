pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FakeERC20CustomDecimals } from "contracts/fakes/FakeERC20CustomDecimals.sol";

/// @dev A USDC-style token: the owner can block an address, and any transfer, mint or burn to or from a blocked
/// address reverts.
contract FakeBlocklistERC20 is FakeERC20CustomDecimals {
    error BlockedAddress(address account);

    address public immutable owner;
    mapping(address account => bool isBlocked) public blocked;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address owner_
    ) FakeERC20CustomDecimals(name_, symbol_, address(0), 0, decimals_) {
        owner = owner_;
    }

    function setBlocked(address account, bool value) external {
        require(msg.sender == owner, "not owner");
        blocked[account] = value;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (blocked[from]) revert BlockedAddress(from);
        if (blocked[to]) revert BlockedAddress(to);
        super._update(from, to, value);
    }
}
