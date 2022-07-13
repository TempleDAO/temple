pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "../core/Exposure.sol";
import "../core/TempleERC20Token.sol";
import "../core/VaultedTemple.sol";

/**
 * @title No-op liquidator to use in tests
 */
contract NoopVaultedTempleLiquidator is ILiquidator {
    TempleERC20Token templeToken;
    VaultedTemple vaultedTemple;

    constructor(TempleERC20Token _templeToken, VaultedTemple _vaultedTemple) {
        templeToken = _templeToken;
        vaultedTemple = _vaultedTemple;
    }

    function toTemple(uint256 amount, address /* toAccount */) external override {
        templeToken.mint(address(vaultedTemple), amount);
    }
}