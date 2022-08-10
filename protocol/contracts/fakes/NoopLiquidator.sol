pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "../core/Exposure.sol";
import "../core/TempleERC20Token.sol";

/**
 * @title No-op liquidator to use in tests
 */
contract NoopLiquidator is ILiquidator {
    TempleERC20Token templeToken;

    constructor(TempleERC20Token _templeToken) {
        templeToken = _templeToken;
    }

    function toTemple(uint256 amount, address toAccount) external override {
        templeToken.mint(toAccount, amount);
    }
}